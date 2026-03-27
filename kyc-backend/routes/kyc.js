// kyc.js — all /api/kyc/* route handlers with input validation
const express = require('express')
const router = express.Router()
const { verifyDocument, verifyFace } = require('../services/mistralVision')
const { generateExplanation } = require('../services/mistralText')
const { calculateRiskScore } = require('../services/riskEngine')

// ── Input sanitisation helpers ──

function sanitiseString(value) {
  if (typeof value !== 'string') return ''
  return value
    .replace(/<[^>]*>/g, '')           // strip HTML tags
    .replace(/[<>]/g, '')              // remove remaining angle brackets
    .trim()
}

function isValidBase64(str) {
  if (typeof str !== 'string' || str.length < 100) return false
  return /^[A-Za-z0-9+/=\s]+$/.test(str.slice(0, 200))
}

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/jpg', 'image/png',
  'image/webp', 'image/bmp', 'image/gif',
  'application/pdf'
])

function isAllowedMimeType(mime) {
  return ALLOWED_MIME_TYPES.has(String(mime || '').toLowerCase())
}

function validateEmail(email) {
  if (!email) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function validatePhone(phone) {
  if (!phone) return false
  const digits = phone.replace(/[^0-9]/g, '')
  return digits.length >= 7 && digits.length <= 15
}

// POST /api/kyc/verify-document
router.post('/verify-document', async (req, res) => {
  try {
    const { imageBase64, mimeType, documents } = req.body

    if ((!imageBase64 || !mimeType) && (!Array.isArray(documents) || documents.length === 0)) {
      return res.status(400).json({ success: false, error: 'Provide either imageBase64 + mimeType or a non-empty documents array' })
    }

    // Validate single image input
    if (imageBase64 && !isValidBase64(imageBase64)) {
      return res.status(400).json({ success: false, error: 'Invalid image data provided' })
    }
    if (mimeType && !isAllowedMimeType(mimeType)) {
      return res.status(400).json({ success: false, error: 'Unsupported file type' })
    }

    // Validate multi-document input
    if (Array.isArray(documents)) {
      if (documents.length > 6) {
        return res.status(400).json({ success: false, error: 'Maximum 6 documents allowed per request' })
      }
      for (const doc of documents) {
        if (!doc.imageBase64 || !isValidBase64(doc.imageBase64)) {
          return res.status(400).json({ success: false, error: 'One or more documents contain invalid image data' })
        }
        if (!isAllowedMimeType(doc.mimeType)) {
          return res.status(400).json({ success: false, error: 'One or more documents have an unsupported file type' })
        }
      }
    }

    const documentResult = await verifyDocument(documents || imageBase64, mimeType)
    res.json({ success: true, data: documentResult })

  } catch (error) {
    console.error('[ERROR] /verify-document:', error.message)
    res.status(500).json({ success: false, error: 'Document verification failed. Please try again.' })
  }
})

// POST /api/kyc/verify-face
router.post('/verify-face', async (req, res) => {
  try {
    const {
      idImageBase64,
      selfieBase64,
      livenessFrames,
      liveFrameQualityScores,
      primaryFrameStep,
      primaryFrameQualityScore
    } = req.body

    if (!idImageBase64 || !selfieBase64) {
      return res.status(400).json({ success: false, error: 'idImageBase64 and selfieBase64 are required' })
    }

    if (!isValidBase64(idImageBase64)) {
      return res.status(400).json({ success: false, error: 'Invalid ID image data' })
    }
    if (!isValidBase64(selfieBase64)) {
      return res.status(400).json({ success: false, error: 'Invalid selfie image data' })
    }

    // Validate liveness frames if provided
    const validFrames = Array.isArray(livenessFrames)
      ? livenessFrames.filter(f => typeof f === 'string' && isValidBase64(f))
      : []

    const validFrameQualityScores = Array.isArray(liveFrameQualityScores)
      ? liveFrameQualityScores
          .filter(item => item && typeof item === 'object')
          .map(item => ({
            step: sanitiseString(item.step || ''),
            brightness: Number(item.brightness) || 0,
            contrast: Number(item.contrast) || 0,
            sharpness: Number(item.sharpness) || 0,
            qualityScore: Number(item.qualityScore) || 0
          }))
      : []

    const faceResult = await verifyFace(
      idImageBase64,
      selfieBase64,
      validFrames,
      validFrameQualityScores,
      sanitiseString(primaryFrameStep || ''),
      Number(primaryFrameQualityScore) || 0
    )
    res.json({ success: true, data: faceResult })

  } catch (error) {
    console.error('[ERROR] /verify-face:', error.message)
    res.status(500).json({ success: false, error: 'Face verification failed. Please try again.' })
  }
})

// POST /api/kyc/score-risk
router.post('/score-risk', async (req, res) => {
  try {
    const { documentResult, faceResult, customerInfo } = req.body

    if (!documentResult || !faceResult || !customerInfo) {
      return res.status(400).json({ success: false, error: 'documentResult, faceResult and customerInfo are required' })
    }

    // Validate required customer info fields
    if (!customerInfo.fullName || sanitiseString(customerInfo.fullName).length < 2) {
      return res.status(400).json({ success: false, error: 'Valid customer full name is required' })
    }
    if (!customerInfo.dateOfBirth) {
      return res.status(400).json({ success: false, error: 'Customer date of birth is required' })
    }
    if (!customerInfo.idNumber || sanitiseString(customerInfo.idNumber).length < 4) {
      return res.status(400).json({ success: false, error: 'Valid customer ID number is required' })
    }
    if (customerInfo.email && !validateEmail(customerInfo.email)) {
      return res.status(400).json({ success: false, error: 'Invalid email format' })
    }
    if (customerInfo.phone && !validatePhone(customerInfo.phone)) {
      return res.status(400).json({ success: false, error: 'Invalid phone number format' })
    }

    // Sanitise string fields
    customerInfo.fullName = sanitiseString(customerInfo.fullName)
    customerInfo.idNumber = sanitiseString(customerInfo.idNumber)
    customerInfo.email = sanitiseString(customerInfo.email || '')
    customerInfo.phone = sanitiseString(customerInfo.phone || '')

    const { riskScore, riskCategory, decision, breakdown } = calculateRiskScore(
      documentResult,
      faceResult,
      customerInfo
    )

    const explanation = await generateExplanation(riskScore, riskCategory, decision, breakdown)

    res.json({
      success: true,
      data: {
        riskScore,
        riskCategory,
        decision,
        explanation,
        breakdown
      }
    })

  } catch (error) {
    console.error('[ERROR] /score-risk:', error.message)
    res.status(500).json({ success: false, error: 'Risk scoring failed. Please try again.' })
  }
})

module.exports = router
