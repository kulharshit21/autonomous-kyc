const axios = require('axios')
const { convertPDFToImage } = require('./pdfConverter')

const MISTRAL_URL = 'https://api.mistral.ai/v1/chat/completions'
const MISTRAL_MODEL = 'pixtral-12b-2409'

const PROMPT_G001 = `You are an expert KYC document verification system.

You may receive one or more images of the same government ID. They can be multiple photos, front and back sides, or different passport pages.
For passports, pay special attention to the main identity page and the MRZ lines at the bottom. Use all provided images together before deciding.

Extract the best combined result across all images and assess the document's authenticity.

Return ONLY a valid JSON object with exactly these fields and no additional text:

{
  "documentType": "string",
  "extractedName": "string",
  "dateOfBirth": "string in DD/MM/YYYY format",
  "idNumber": "string",
  "address": "string",
  "expiryDate": "string in DD/MM/YYYY format or 'No Expiry'",
  "isAuthentic": "boolean",
  "tamperingDetected": "boolean",
  "confidenceScore": "integer from 0 to 100",
  "authenticityReason": "string"
}

Rules:
- Combine visible data from all images of the same document.
- If one image is unclear but another is clearer, prefer the clearer image.
- Extract the full legal name exactly as visible on the document, including middle names and surnames when present.
- For passports, identify the document as "Passport" when appropriate and extract the passport number, full name, date of birth, and expiry date from the passport identity page or MRZ.
- Use an empty string only when the information is genuinely not visible in any provided image.
- Do not copy placeholder values from this schema.`

const PROMPT_G002 = `You are an expert facial verification system for KYC compliance.

You have been provided with two images:
- Image 1: A government-issued ID document containing a photo of the document holder
- Image 2: A live selfie captured via webcam during the verification process

Your task is to:
1. Compare the face in the ID document photo with the face in the selfie
2. Assess whether the selfie appears to be a genuine live capture and not a photo of a photo or screen

Return ONLY a valid JSON object with exactly these fields and no additional text:

{
  "matchScore": "integer from 0 to 100",
  "isLivePerson": "boolean",
  "livenessConfidence": "integer from 0 to 100",
  "verificationPassed": "boolean",
  "faceDetectedInId": "boolean",
  "faceDetectedInSelfie": "boolean",
  "reasoning": "string"
}

Scoring rules:
- 90 to 100: very strong facial match with clear live selfie evidence
- 75 to 89: likely same person with minor uncertainty
- 50 to 74: possible match but noticeable uncertainty
- 0 to 49: weak match or likely different person

Compute each score from the actual images. Do not copy placeholder values from the schema.`

function extractJSON(text) {
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  const match = cleaned.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('No JSON found in Mistral response')
  return JSON.parse(match[0])
}

function normaliseMimeType(mimeType) {
  const map = {
    'application/pdf': 'image/jpeg',
    'image/jpg': 'image/jpeg',
    'image/jpeg': 'image/jpeg',
    'image/png': 'image/png',
    'image/webp': 'image/jpeg',
    'image/bmp': 'image/jpeg',
    'image/gif': 'image/jpeg'
  }
  return map[mimeType] || 'image/jpeg'
}

function clampScore(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 0
  return Math.max(0, Math.min(100, Math.round(numeric)))
}

function getFilledFieldCount(parsed) {
  const fields = [
    parsed.documentType,
    parsed.extractedName,
    parsed.dateOfBirth,
    parsed.idNumber,
    parsed.address,
    parsed.expiryDate
  ]

  return fields.filter(value => typeof value === 'string' && value.trim() !== '').length
}

function hasSuspiciousReason(parsed) {
  const reason = (parsed.authenticityReason || '').toLowerCase()

  return [
    'suspicious',
    'tamper',
    'forg',
    'alter',
    'manipulat',
    'mismatch',
    'unclear',
    'inconsistent'
  ].some(keyword => reason.includes(keyword))
}

function calculateDocumentConfidence(parsed, imageCount) {
  const fieldCount = getFilledFieldCount(parsed)
  const hasName = Boolean(parsed.extractedName && parsed.extractedName.trim())
  const hasDob = Boolean(parsed.dateOfBirth && parsed.dateOfBirth.trim())
  const hasIdNumber = Boolean(parsed.idNumber && parsed.idNumber.trim())
  const hasDocumentType = Boolean(parsed.documentType && parsed.documentType.trim())
  const hasExpiry = Boolean(parsed.expiryDate && parsed.expiryDate.trim())
  const isPassport = (parsed.documentType || '').toLowerCase().includes('passport')
  const suspiciousReason = hasSuspiciousReason(parsed)

  let derivedConfidence = 12

  if (parsed.isAuthentic === true) {
    derivedConfidence += 18
  } else {
    derivedConfidence -= 12
  }

  if (parsed.tamperingDetected === true) derivedConfidence -= 28
  if (suspiciousReason) derivedConfidence -= 18

  derivedConfidence += Math.min(24, fieldCount * 4)

  if (hasDocumentType) derivedConfidence += 5
  if (hasName) derivedConfidence += 6
  if (hasDob) derivedConfidence += 6
  if (hasIdNumber) derivedConfidence += 7
  if (hasExpiry || parsed.expiryDate === 'No Expiry') derivedConfidence += 4

  if (isPassport && hasName && hasDob && hasIdNumber && hasExpiry) {
    derivedConfidence += 6
  }

  if (imageCount > 1) {
    derivedConfidence += Math.min(4, imageCount * 2)
  }

  derivedConfidence = clampScore(derivedConfidence)
  const modelConfidence = clampScore(parsed.confidenceScore)
  const blendedConfidence = clampScore(Math.round((derivedConfidence * 0.75) + (modelConfidence * 0.25)))

  if (parsed.isAuthentic === false || parsed.tamperingDetected === true || suspiciousReason) {
    return Math.min(blendedConfidence, 40)
  }

  return blendedConfidence
}

function calculateFaceMatchScore(parsed) {
  const modelScore = clampScore(parsed.matchScore)
  let derivedScore = 30

  if (parsed.faceDetectedInId === true) derivedScore += 15
  if (parsed.faceDetectedInSelfie === true) derivedScore += 15
  if (parsed.verificationPassed === true) derivedScore += 20
  if (parsed.isLivePerson === true) derivedScore += 10

  if (parsed.faceDetectedInId === false) derivedScore -= 20
  if (parsed.faceDetectedInSelfie === false) derivedScore -= 20
  if (parsed.verificationPassed === false) derivedScore -= 15

  derivedScore = clampScore(derivedScore)

  if (parsed.verificationPassed === true) {
    return Math.max(derivedScore, Math.round((derivedScore + modelScore) / 2))
  }

  return Math.min(derivedScore, Math.round((derivedScore + modelScore) / 2))
}

function calculateLivenessConfidence(parsed) {
  const modelScore = clampScore(parsed.livenessConfidence)
  let derivedScore = 25

  if (parsed.faceDetectedInSelfie === true) derivedScore += 20
  if (parsed.isLivePerson === true) derivedScore += 35
  if (parsed.verificationPassed === true) derivedScore += 10

  if (parsed.faceDetectedInSelfie === false) derivedScore -= 25
  if (parsed.isLivePerson === false) derivedScore -= 25

  derivedScore = clampScore(derivedScore)

  if (parsed.isLivePerson === true) {
    return Math.max(derivedScore, Math.round((derivedScore + modelScore) / 2))
  }

  return Math.min(derivedScore, Math.round((derivedScore + modelScore) / 2))
}

async function callMistral(contentParts) {
  const apiKey = process.env.MISTRAL_API_KEY
  if (!apiKey) throw new Error('MISTRAL_API_KEY not set in .env')

  try {
    const response = await axios.post(
      MISTRAL_URL,
      {
        model: MISTRAL_MODEL,
        messages: [{ role: 'user', content: contentParts }]
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      }
    )

    return response.data.choices?.[0]?.message?.content || ''
  } catch (error) {
    if (error.response?.status === 429) {
      console.error('[ERROR] Mistral rate limit - retrying in 10 seconds')
      await new Promise(resolve => setTimeout(resolve, 10000))

      const retryResponse = await axios.post(
        MISTRAL_URL,
        {
          model: MISTRAL_MODEL,
          messages: [{ role: 'user', content: contentParts }]
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 60000
        }
      )

      return retryResponse.data.choices?.[0]?.message?.content || ''
    }

    console.error('[ERROR] Mistral full response:', JSON.stringify(error.response?.data))
    throw new Error(`Mistral API error: ${error.response?.status || 'unknown'} - ${error.message}`)
  }
}

async function normaliseDocumentInput(imageBase64, mimeType) {
  let processedImageBase64 = imageBase64
  let processedMimeType = normaliseMimeType(mimeType)

  if (mimeType === 'application/pdf') {
    console.log('[DEBUG] Converting PDF to image for Mistral...')
    processedImageBase64 = await convertPDFToImage(imageBase64)
    processedMimeType = 'image/jpeg'
    console.log('[DEBUG] PDF converted successfully')
  }

  return { processedImageBase64, processedMimeType }
}

async function verifyDocument(input, mimeType) {
  const documents = Array.isArray(input)
    ? input
    : [{ imageBase64: input, mimeType }]

  const processedDocuments = await Promise.all(
    documents.map(async (document) => {
      const { processedImageBase64, processedMimeType } = await normaliseDocumentInput(
        document.imageBase64,
        document.mimeType
      )

      return {
        processedImageBase64,
        processedMimeType
      }
    })
  )

  const contentParts = processedDocuments.map((document, index) => ({
    type: 'image_url',
    image_url: {
      url: `data:${document.processedMimeType};base64,${document.processedImageBase64}`
    }
  }))

  contentParts.push({
    type: 'text',
    text: `${PROMPT_G001}\n\nNumber of images provided: ${processedDocuments.length}.`
  })

  const text = await callMistral(contentParts)
  const parsed = extractJSON(text)
  const confidenceScore = calculateDocumentConfidence(parsed, processedDocuments.length)

  return {
    documentType: parsed.documentType || '',
    extractedName: parsed.extractedName || '',
    extractedDOB: parsed.dateOfBirth || '',
    idNumber: parsed.idNumber || '',
    address: parsed.address || '',
    expiryDate: parsed.expiryDate || '',
    isAuthentic: parsed.isAuthentic ?? false,
    tamperingDetected: parsed.tamperingDetected ?? false,
    confidenceScore,
    authenticityReason: parsed.authenticityReason || '',
    processedImageBase64: processedDocuments[0]?.processedImageBase64 || '',
    processedImageBase64List: processedDocuments.map((document) => document.processedImageBase64),
    processedMimeType: processedDocuments[0]?.processedMimeType || 'image/jpeg'
  }
}

async function verifyFace(idImageBase64, selfieBase64) {
  const contentParts = [
    {
      type: 'image_url',
      image_url: {
        url: `data:image/jpeg;base64,${idImageBase64}`
      }
    },
    {
      type: 'image_url',
      image_url: {
        url: `data:image/jpeg;base64,${selfieBase64}`
      }
    },
    {
      type: 'text',
      text: PROMPT_G002
    }
  ]

  const text = await callMistral(contentParts)
  const parsed = extractJSON(text)
  const matchScore = calculateFaceMatchScore(parsed)
  const livenessConfidence = calculateLivenessConfidence(parsed)
  const verificationPassed = parsed.verificationPassed ?? (matchScore >= 75 && parsed.isLivePerson !== false)

  return {
    matchScore,
    isLivePerson: parsed.isLivePerson ?? false,
    livenessConfidence,
    verificationPassed,
    faceDetectedInId: parsed.faceDetectedInId ?? false,
    faceDetectedInSelfie: parsed.faceDetectedInSelfie ?? false,
    reasoning: parsed.reasoning || ''
  }
}

module.exports = { verifyDocument, verifyFace }
