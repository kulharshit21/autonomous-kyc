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
  "hasPhotoInId": "boolean",
  "idPhotoClarity": "one of clear, slightly_unclear, unclear, no_photo",
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
- Set hasPhotoInId to true when any provided image contains the holder's portrait photo on the ID.
- If the uploaded image is only text, back side only, or has no visible portrait, set hasPhotoInId to false and idPhotoClarity to no_photo.
- Mark "isAuthentic" as false only when there is a strong reason to suspect forgery, tampering, manipulation, or a clearly invalid document.
- If the document looks real but the image quality is weak, keep "isAuthentic" as true and explain the quality issue in "authenticityReason" instead of calling it fake or suspicious.
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
- Do not treat "both images contain a face" as evidence of a match by itself.
- Compare actual facial similarity such as face shape, eye spacing, nose, mouth, jawline, and overall resemblance.
- Allow for reasonable differences caused by lighting, angle, camera quality, expression, and minor age variation.
- If the selfie belongs to a different person, keep matchScore low even if both faces are clearly visible and the selfie is live.
- Set verificationPassed to true only when the same-person evidence is genuinely strong.

Compute each score from the actual images. Do not copy placeholder values from the schema.`

const PROMPT_G003 = `You are performing a strict second-pass audit of a KYC face comparison.

You have been provided:
- Image 1: a government ID document that contains a printed ID portrait
- Image 2: a live selfie captured during verification

Your job is to be conservative.

Return ONLY a valid JSON object with exactly these fields and no additional text:

{
  "strictMatchScore": "integer from 0 to 100",
  "samePersonConfidence": "integer from 0 to 100",
  "idPhotoClarity": "one of clear, slightly_unclear, unclear, too_small",
  "selfieClarity": "one of clear, slightly_unclear, unclear",
  "shouldTreatAsUncertain": "boolean",
  "reasoning": "string"
}

Rules:
- Focus on the actual printed ID portrait, not the whole card layout.
- If the ID portrait is tiny, blurry, compressed, shadowed, cropped, or unclear, mark idPhotoClarity as unclear or too_small.
- If the evidence is weak, prefer shouldTreatAsUncertain = true instead of overconfident matching.
- Only give strictMatchScore above 80 when the same-person evidence is genuinely strong.
- If the faces could plausibly be different people, keep strictMatchScore below 65.
- Use face shape, eyes, nose, mouth, jawline, hairline, and overall resemblance.`

const PROMPT_G004 = `You are performing a feature-by-feature facial similarity review for KYC.

You have:
- Image 1: an ID document containing the printed portrait of the ID holder
- Image 2: a live selfie

Return ONLY a valid JSON object with exactly these fields and no additional text:

{
  "samePersonLikelihood": "integer from 0 to 100",
  "featureAgreementCount": "integer from 0 to 6",
  "featureMismatchCount": "integer from 0 to 6",
  "shouldRejectAsDifferentPerson": "boolean",
  "reasoning": "string"
}

Rules:
- Compare stable facial features: eye spacing, eyebrow shape, nose shape, lip shape, jawline/chin, and overall face shape.
- Ignore background, clothing, hairstyle changes, beard stubble changes, and minor lighting variation.
- If the visible stable features mostly align, samePersonLikelihood should be reasonably high even if the photos are from different cameras.
- If several stable facial features differ clearly, set shouldRejectAsDifferentPerson to true.
- Be conservative when the ID portrait is tiny or unclear.`

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

function normaliseClarity(value, allowedValues, fallback) {
  const clarity = String(value || '').trim().toLowerCase()
  return allowedValues.includes(clarity) ? clarity : fallback
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

function hasQualityIssueReason(parsed) {
  const reason = (parsed.authenticityReason || '').toLowerCase()

  return [
    'unclear',
    'blurry',
    'blur',
    'low quality',
    'low-resolution',
    'low resolution',
    'glare',
    'shadow',
    'cropped',
    'compression',
    'partially visible',
    'not clear'
  ].some(keyword => reason.includes(keyword))
}

function hasStrongForgerySignal(parsed) {
  const reason = (parsed.authenticityReason || '').toLowerCase()

  return [
    'forg',
    'fake',
    'tamper',
    'alter',
    'manipulat',
    'edited',
    'counterfeit'
  ].some(keyword => reason.includes(keyword))
}

function deriveDocumentAuthenticity(parsed) {
  const modelAuthentic = parsed.isAuthentic === true
  const strongForgerySignal = hasStrongForgerySignal(parsed)
  const fieldCount = getFilledFieldCount(parsed)
  const hasPhotoInId = parsed.hasPhotoInId !== false
  const hasCoreIdentityFields = Boolean(
    parsed.documentType &&
    parsed.extractedName &&
    parsed.dateOfBirth &&
    parsed.idNumber
  )
  const modelConfidence = clampScore(parsed.confidenceScore)

  if (parsed.tamperingDetected === true || strongForgerySignal) {
    return false
  }

  if (modelAuthentic) {
    return true
  }

  if (hasCoreIdentityFields && fieldCount >= 4 && hasPhotoInId && modelConfidence >= 15) {
    return true
  }

  if (hasCoreIdentityFields && fieldCount >= 4 && modelConfidence >= 25) {
    return true
  }

  return false
}

function calculateDocumentConfidence(parsed, imageCount) {
  const fieldCount = getFilledFieldCount(parsed)
  const hasName = Boolean(parsed.extractedName && parsed.extractedName.trim())
  const hasDob = Boolean(parsed.dateOfBirth && parsed.dateOfBirth.trim())
  const hasIdNumber = Boolean(parsed.idNumber && parsed.idNumber.trim())
  const hasDocumentType = Boolean(parsed.documentType && parsed.documentType.trim())
  const hasExpiry = Boolean(parsed.expiryDate && parsed.expiryDate.trim())
  const hasPhotoInId = parsed.hasPhotoInId !== false
  const idPhotoClarity = normaliseClarity(
    parsed.idPhotoClarity,
    ['clear', 'slightly_unclear', 'unclear', 'no_photo'],
    hasPhotoInId ? 'slightly_unclear' : 'no_photo'
  )
  const isPassport = (parsed.documentType || '').toLowerCase().includes('passport')
  const suspiciousReason = hasSuspiciousReason(parsed)
  const qualityIssueReason = hasQualityIssueReason(parsed)
  const effectiveAuthentic = deriveDocumentAuthenticity(parsed)

  let derivedConfidence = 12

  if (effectiveAuthentic) {
    derivedConfidence += 18
  } else {
    derivedConfidence -= 12
  }

  if (parsed.tamperingDetected === true) derivedConfidence -= 28
  if (suspiciousReason) derivedConfidence -= 12
  if (qualityIssueReason) derivedConfidence -= 8

  derivedConfidence += Math.min(24, fieldCount * 4)

  if (hasDocumentType) derivedConfidence += 5
  if (hasName) derivedConfidence += 6
  if (hasDob) derivedConfidence += 6
  if (hasIdNumber) derivedConfidence += 7
  if (hasExpiry || parsed.expiryDate === 'No Expiry') derivedConfidence += 4
  if (hasPhotoInId) derivedConfidence += 4

  if (idPhotoClarity === 'clear') derivedConfidence += 4
  else if (idPhotoClarity === 'slightly_unclear') derivedConfidence += 1
  else if (idPhotoClarity === 'unclear') derivedConfidence -= 4

  if (isPassport && hasName && hasDob && hasIdNumber && hasExpiry) {
    derivedConfidence += 6
  }

  if (imageCount > 1) {
    derivedConfidence += Math.min(4, imageCount * 2)
  }

  derivedConfidence = clampScore(derivedConfidence)
  const modelConfidence = clampScore(parsed.confidenceScore)
  const blendedConfidence = clampScore(Math.round((derivedConfidence * 0.75) + (modelConfidence * 0.25)))

  if (!effectiveAuthentic || parsed.tamperingDetected === true) {
    return Math.min(blendedConfidence, 40)
  }

  if (qualityIssueReason && fieldCount >= 4) {
    return Math.max(blendedConfidence, 60)
  }

  if (fieldCount >= 4) {
    return Math.max(blendedConfidence, 68)
  }

  return blendedConfidence
}

function calculateFaceMatchScore(parsed) {
  const modelScore = clampScore(parsed.matchScore)
  const idFaceDetected = parsed.faceDetectedInId === true
  const selfieFaceDetected = parsed.faceDetectedInSelfie === true
  const bothFacesDetected = idFaceDetected && selfieFaceDetected
  const isLive = parsed.isLivePerson === true
  const verificationPassed = parsed.verificationPassed === true

  if (!bothFacesDetected) {
    return Math.min(modelScore, 20)
  }

  let adjustedScore = modelScore

  if (!isLive) {
    adjustedScore = Math.min(adjustedScore, 55)
  }

  if (verificationPassed) {
    adjustedScore += 4
  } else if (adjustedScore >= 72 && isLive) {
    adjustedScore += 2
  } else {
    adjustedScore = Math.min(adjustedScore, 68)
  }

  return Math.max(0, Math.min(100, Math.round(clampScore(adjustedScore))))
}

function calculateStrictFaceMatchScore(primaryParsed, strictParsed) {
  const primaryScore = clampScore(primaryParsed.matchScore)
  const strictScore = clampScore(strictParsed.strictMatchScore)
  const samePersonConfidence = clampScore(strictParsed.samePersonConfidence)
  const idPhotoClarity = normaliseClarity(
    strictParsed.idPhotoClarity,
    ['clear', 'slightly_unclear', 'unclear', 'too_small'],
    'unclear'
  )
  const selfieClarity = normaliseClarity(
    strictParsed.selfieClarity,
    ['clear', 'slightly_unclear', 'unclear'],
    'unclear'
  )
  const shouldTreatAsUncertain = strictParsed.shouldTreatAsUncertain === true
  const bothFacesDetected = primaryParsed.faceDetectedInId === true && primaryParsed.faceDetectedInSelfie === true
  const isLive = primaryParsed.isLivePerson === true

  if (!bothFacesDetected) {
    return {
      matchScore: Math.min(primaryScore, 20),
      faceUncertain: true,
      idPhotoClarity,
      selfieClarity,
      samePersonConfidence
    }
  }

  let combinedScore = Math.round((primaryScore * 0.45) + (strictScore * 0.55))
  let faceUncertain = shouldTreatAsUncertain

  if (idPhotoClarity === 'too_small') {
    combinedScore = Math.min(combinedScore, 52)
    faceUncertain = true
  } else if (idPhotoClarity === 'unclear') {
    combinedScore = Math.min(combinedScore, 60)
    faceUncertain = true
  } else if (idPhotoClarity === 'slightly_unclear') {
    combinedScore = Math.min(combinedScore, 72)
  }

  if (selfieClarity === 'unclear') {
    combinedScore = Math.min(combinedScore, 60)
    faceUncertain = true
  } else if (selfieClarity === 'slightly_unclear') {
    combinedScore = Math.min(combinedScore, 74)
  }

  if (!isLive) {
    combinedScore = Math.min(combinedScore, 55)
  }

  if (samePersonConfidence < 45) {
    combinedScore = Math.min(combinedScore, 48)
  } else if (samePersonConfidence < 60) {
    combinedScore = Math.min(combinedScore, 62)
    faceUncertain = true
  }

  if (strictScore < 55 && primaryScore < 70) {
    combinedScore = Math.min(combinedScore, 58)
    faceUncertain = true
  }

  return {
    matchScore: clampScore(combinedScore),
    faceUncertain,
    idPhotoClarity,
    selfieClarity,
    samePersonConfidence
  }
}

function calculateConsensusFaceResult(primaryParsed, strictFaceResult, featureAudit) {
  const featureLikelihood = clampScore(featureAudit.samePersonLikelihood)
  const featureAgreementCount = Math.max(0, Math.min(6, Math.round(Number(featureAudit.featureAgreementCount) || 0)))
  const featureMismatchCount = Math.max(0, Math.min(6, Math.round(Number(featureAudit.featureMismatchCount) || 0)))
  const shouldRejectAsDifferentPerson = featureAudit.shouldRejectAsDifferentPerson === true
  const bothFacesDetected = primaryParsed.faceDetectedInId === true && primaryParsed.faceDetectedInSelfie === true

  if (!bothFacesDetected) {
    return {
      matchScore: Math.min(strictFaceResult.matchScore, 20),
      faceUncertain: true,
      samePersonConfidence: Math.min(strictFaceResult.samePersonConfidence, featureLikelihood),
      shouldRejectAsDifferentPerson,
      featureAgreementCount,
      featureMismatchCount
    }
  }

  let consensusScore = Math.round(
    (strictFaceResult.matchScore * 0.5) +
    (featureLikelihood * 0.35) +
    ((featureAgreementCount / 6) * 100 * 0.15)
  )

  let faceUncertain = strictFaceResult.faceUncertain
  let samePersonConfidence = Math.round((strictFaceResult.samePersonConfidence * 0.6) + (featureLikelihood * 0.4))

  if (shouldRejectAsDifferentPerson || featureMismatchCount >= 4) {
    consensusScore = Math.min(consensusScore, 45)
    samePersonConfidence = Math.min(samePersonConfidence, 40)
  } else if (featureMismatchCount === 3) {
    consensusScore = Math.min(consensusScore, 58)
    samePersonConfidence = Math.min(samePersonConfidence, 55)
    faceUncertain = true
  }

  if (featureAgreementCount >= 4 && featureMismatchCount <= 1 && !strictFaceResult.faceUncertain) {
    if (strictFaceResult.matchScore >= 68 && featureLikelihood >= 72) {
      consensusScore = Math.max(consensusScore, 76)
      samePersonConfidence = Math.max(samePersonConfidence, 74)
    }
  }

  if (strictFaceResult.idPhotoClarity === 'too_small' || strictFaceResult.idPhotoClarity === 'unclear') {
    faceUncertain = true
    consensusScore = Math.min(consensusScore, 62)
  }

  if (strictFaceResult.selfieClarity === 'unclear') {
    faceUncertain = true
    consensusScore = Math.min(consensusScore, 60)
  }

  return {
    matchScore: clampScore(consensusScore),
    faceUncertain,
    samePersonConfidence: clampScore(samePersonConfidence),
    shouldRejectAsDifferentPerson,
    featureAgreementCount,
    featureMismatchCount
  }
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

async function runStrictFaceAudit(idImageBase64, selfieBase64) {
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
      text: PROMPT_G003
    }
  ]

  const text = await callMistral(contentParts)
  return extractJSON(text)
}

async function runFeatureFaceAudit(idImageBase64, selfieBase64) {
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
      text: PROMPT_G004
    }
  ]

  const text = await callMistral(contentParts)
  return extractJSON(text)
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
  const isAuthentic = deriveDocumentAuthenticity(parsed)
  const confidenceScore = calculateDocumentConfidence(parsed, processedDocuments.length)

  return {
    documentType: parsed.documentType || '',
    extractedName: parsed.extractedName || '',
    extractedDOB: parsed.dateOfBirth || '',
    idNumber: parsed.idNumber || '',
    address: parsed.address || '',
    expiryDate: parsed.expiryDate || '',
    hasPhotoInId: parsed.hasPhotoInId ?? true,
    idPhotoClarity: normaliseClarity(
      parsed.idPhotoClarity,
      ['clear', 'slightly_unclear', 'unclear', 'no_photo'],
      parsed.hasPhotoInId === false ? 'no_photo' : 'slightly_unclear'
    ),
    isAuthentic,
    tamperingDetected: parsed.tamperingDetected ?? false,
    confidenceScore,
    authenticityReason: parsed.authenticityReason || '',
    processedImageBase64: processedDocuments[0]?.processedImageBase64 || '',
    processedImageBase64List: processedDocuments.map((document) => document.processedImageBase64),
    processedMimeType: processedDocuments[0]?.processedMimeType || 'image/jpeg'
  }
}

async function verifyFace(idImageBase64, selfieBase64, livenessFrames = []) {
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
    }
  ]

  // Include up to 3 liveness frames for better face comparison
  const framesToUse = livenessFrames.slice(0, 3)
  for (const frame of framesToUse) {
    contentParts.push({
      type: 'image_url',
      image_url: {
        url: `data:image/jpeg;base64,${frame}`
      }
    })
  }

  contentParts.push({
    type: 'text',
    text: PROMPT_G002 + (framesToUse.length > 0
      ? `\n\nNote: ${framesToUse.length} additional liveness check frames are provided (images 3${framesToUse.length > 1 ? `-${framesToUse.length + 2}` : '+2'}). These show the same person from different angles during a liveness check. Use them alongside the primary selfie (image 2) to improve your confidence in whether the selfie person matches the ID photo (image 1).`
      : '')
  })

  const text = await callMistral(contentParts)
  const parsed = extractJSON(text)
  const primaryMatchScore = calculateFaceMatchScore(parsed)
  const livenessConfidence = calculateLivenessConfidence(parsed)
  const strictParsed = await runStrictFaceAudit(idImageBase64, selfieBase64)
  const strictFaceResult = calculateStrictFaceMatchScore(
    { ...parsed, matchScore: primaryMatchScore },
    strictParsed
  )
  const featureAudit = await runFeatureFaceAudit(idImageBase64, selfieBase64)
  const consensusFaceResult = calculateConsensusFaceResult(
    parsed,
    strictFaceResult,
    featureAudit
  )
  const matchScore = consensusFaceResult.matchScore
  const borderlinePortraitPass =
    parsed.faceDetectedInId === true &&
    parsed.faceDetectedInSelfie === true &&
    parsed.isLivePerson !== false &&
    consensusFaceResult.faceUncertain &&
    ['too_small', 'unclear'].includes(strictFaceResult.idPhotoClarity) &&
    !consensusFaceResult.shouldRejectAsDifferentPerson &&
    consensusFaceResult.samePersonConfidence >= 58 &&
    matchScore >= 60

  const verificationPassed =
    parsed.faceDetectedInId === true &&
    parsed.faceDetectedInSelfie === true &&
    parsed.isLivePerson !== false &&
    !consensusFaceResult.shouldRejectAsDifferentPerson &&
    (
      (
        !consensusFaceResult.faceUncertain &&
        consensusFaceResult.samePersonConfidence >= 70 &&
        matchScore >= 72
      ) ||
      borderlinePortraitPass
    )

  const reasoningParts = [parsed.reasoning, strictParsed.reasoning, featureAudit.reasoning]
    .map(part => String(part || '').trim())
    .filter(Boolean)
  const reasoning = reasoningParts.join(' ')

  return {
    matchScore,
    isLivePerson: parsed.isLivePerson ?? false,
    livenessConfidence,
    verificationPassed,
    faceDetectedInId: parsed.faceDetectedInId ?? false,
    faceDetectedInSelfie: parsed.faceDetectedInSelfie ?? false,
    reasoning,
    faceUncertain: consensusFaceResult.faceUncertain,
    idPhotoClarity: strictFaceResult.idPhotoClarity,
    selfieClarity: strictFaceResult.selfieClarity,
    samePersonConfidence: consensusFaceResult.samePersonConfidence
  }
}

module.exports = { verifyDocument, verifyFace }
