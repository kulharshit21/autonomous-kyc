// kyc.js — all /api/kyc/* route handlers
const express = require('express')
const router = express.Router()
const { verifyDocument, verifyFace } = require('../services/gemini')
const { generateExplanation } = require('../services/mistralText')
const { calculateRiskScore } = require('../services/riskEngine')

// POST /api/kyc/verify-document
router.post('/verify-document', async (req, res) => {
  try {
    const { imageBase64, mimeType, documents } = req.body

    if ((!imageBase64 || !mimeType) && (!Array.isArray(documents) || documents.length === 0)) {
      return res.status(400).json({ success: false, error: 'Provide either imageBase64 + mimeType or a non-empty documents array' })
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
    const { idImageBase64, selfieBase64 } = req.body

    if (!idImageBase64 || !selfieBase64) {
      return res.status(400).json({ success: false, error: 'idImageBase64 and selfieBase64 are required' })
    }

    const faceResult = await verifyFace(idImageBase64, selfieBase64)
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
