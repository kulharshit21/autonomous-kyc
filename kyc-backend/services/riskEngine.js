function calculateRiskScore(documentResult, faceResult, customerInfo) {
  const identityMismatchCount = countIdentityMismatches(customerInfo, documentResult)
  const dataConsistencyRisk = calcDataConsistencyRisk(customerInfo, documentResult)
  const borderlineFaceReview = isBorderlineFaceReview(faceResult, documentResult, dataConsistencyRisk, calcLivenessRisk(faceResult))
  const faceMatchRisk = calcFaceMatchRisk(faceResult, borderlineFaceReview)
  const severeFaceMismatch = isSevereFaceMismatch(faceResult)
  const livenessRisk = calcLivenessRisk(faceResult)
  const documentAuthenticityRisk = calcDocumentRisk(documentResult, {
    dataConsistencyRisk,
    faceMatchRisk,
    livenessRisk
  })
  const expiryRisk = calcExpiryRisk(documentResult)

  let riskScore = Math.max(0, Math.min(100, Math.round(
    documentAuthenticityRisk +
    faceMatchRisk +
    expiryRisk +
    dataConsistencyRisk +
    livenessRisk
  )))

  if (dataConsistencyRisk >= 12) {
    riskScore = Math.max(riskScore, 55)
  } else if (dataConsistencyRisk >= 8) {
    riskScore = Math.max(riskScore, 40)
  }

  let riskCategory
  let decision

  if (riskScore <= 30) {
    riskCategory = 'low'
    decision = 'approved'
  } else if (riskScore <= 70) {
    riskCategory = 'medium'
    decision = 'review'
  } else {
    riskCategory = 'high'
    decision = 'rejected'
  }

  if (dataConsistencyRisk >= 8 && decision === 'approved') {
    riskCategory = 'medium'
    decision = 'review'
  }

  if (documentAuthenticityRisk >= 15 && decision === 'approved') {
    riskCategory = 'medium'
    decision = 'review'
  }

  if (faceMatchRisk >= 20 && decision === 'approved') {
    riskCategory = 'medium'
    decision = 'review'
  }

  if (borderlineFaceReview && faceResult.verificationPassed !== true && decision === 'approved') {
    riskScore = Math.max(riskScore, 35)
    riskCategory = 'medium'
    decision = 'review'
  }

  if (identityMismatchCount > 2) {
    riskScore = Math.max(riskScore, 75)
    riskCategory = 'high'
    decision = 'rejected'
  }

  if (severeFaceMismatch) {
    riskScore = Math.max(riskScore, 75)
    riskCategory = 'high'
    decision = 'rejected'
  }

  if (faceMatchRisk >= 25 && !borderlineFaceReview) {
    riskScore = Math.max(riskScore, 75)
    riskCategory = 'high'
    decision = 'rejected'
  }

  return {
    riskScore: Math.max(0, Math.min(100, Math.round(riskScore))),
    riskCategory,
    decision,
    breakdown: {
      documentAuthenticityRisk: Math.round(documentAuthenticityRisk),
      faceMatchRisk: Math.round(faceMatchRisk),
      expiryRisk: Math.round(expiryRisk),
      dataConsistencyRisk: Math.round(dataConsistencyRisk),
      livenessRisk: Math.round(livenessRisk)
    }
  }
}

function calcDocumentRisk(documentResult, supportingSignals = {}) {
  let risk = 0
  if (documentResult.tamperingDetected === true) return 30

  const confidence = Number(documentResult.confidenceScore) || 0
  const hasStrongSupport =
    (supportingSignals.dataConsistencyRisk || 0) === 0 &&
    (supportingSignals.faceMatchRisk || 0) === 0 &&
    (supportingSignals.livenessRisk || 0) === 0
  const hasModerateSupport =
    (supportingSignals.dataConsistencyRisk || 0) <= 3 &&
    (supportingSignals.faceMatchRisk || 0) <= 15 &&
    (supportingSignals.livenessRisk || 0) === 0

  if (documentResult.isAuthentic === false) {
    if (hasModerateSupport && confidence >= 35) return 8
    if (hasStrongSupport && confidence >= 35) return 8
    if (confidence >= 70) return 8
    if (confidence >= 50) return 15
    return 22
  }

  if (hasStrongSupport && confidence >= 35) return 0

  if (confidence < 45) risk += 10
  else if (confidence < 65) risk += 5

  return Math.min(30, risk)
}

function calcFaceMatchRisk(faceResult, borderlineFaceReview = false) {
  const score = Number(faceResult.matchScore) || 0
  const samePersonConfidence = Number(faceResult.samePersonConfidence) || 0
  const faceUncertain = faceResult.faceUncertain === true
  const verificationPassed = faceResult.verificationPassed === true
  const idPhotoClarity = String(faceResult.idPhotoClarity || '').toLowerCase()

  if (borderlineFaceReview) return 15
  if (verificationPassed && faceUncertain) return 12
  if (verificationPassed === false && samePersonConfidence > 0 && samePersonConfidence < 45) return 30
  if (score < 72 && samePersonConfidence > 0 && samePersonConfidence < 55) return 30
  if (verificationPassed === false && score < 72) return 25
  if (faceUncertain && (idPhotoClarity === 'too_small' || idPhotoClarity === 'unclear')) return 20
  if (faceUncertain) return 12
  if (score >= 85) return 0
  if (score >= 72) return 5
  if (score >= 55) return 25
  return 30
}

function isSevereFaceMismatch(faceResult) {
  const score = Number(faceResult.matchScore) || 0
  const samePersonConfidence = Number(faceResult.samePersonConfidence) || 0
  const verificationPassed = faceResult.verificationPassed === true
  const faceUncertain = faceResult.faceUncertain === true

  if (verificationPassed) return false
  if (samePersonConfidence > 0 && samePersonConfidence < 45) return true
  if (score < 72 && samePersonConfidence > 0 && samePersonConfidence < 55 && !faceUncertain) return true
  if (!faceUncertain && score < 60) return true
  return false
}

function isBorderlineFaceReview(faceResult, documentResult, dataConsistencyRisk, livenessRisk) {
  const score = Number(faceResult.matchScore) || 0
  const samePersonConfidence = Number(faceResult.samePersonConfidence) || 0
  const faceUncertain = faceResult.faceUncertain === true
  const idPhotoClarity = String(faceResult.idPhotoClarity || documentResult.idPhotoClarity || '').toLowerCase()
  const documentConfidence = Number(documentResult.confidenceScore) || 0
  const documentLooksStrong =
    documentResult.tamperingDetected !== true &&
    (
      (documentResult.isAuthentic === true && documentConfidence >= 55) ||
      documentConfidence >= 35
    )

  return (
    (faceUncertain || ['slightly_unclear', 'unclear', 'too_small'].includes(idPhotoClarity)) &&
    score >= 55 &&
    score < 72 &&
    samePersonConfidence >= 55 &&
    dataConsistencyRisk === 0 &&
    livenessRisk === 0 &&
    documentLooksStrong &&
    ['slightly_unclear', 'unclear', 'too_small'].includes(idPhotoClarity)
  )
}

function calcExpiryRisk(documentResult) {
  const expiryDate = documentResult.expiryDate
  if (!expiryDate || expiryDate === '') return 8
  if (expiryDate === 'No Expiry') return 0

  const parts = expiryDate.split('/')
  if (parts.length !== 3) return 8

  const parsed = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`)
  if (isNaN(parsed.getTime())) return 8
  return parsed < new Date() ? 15 : 0
}

function normaliseName(value) {
  return (value || '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokeniseName(value) {
  return normaliseName(value).split(' ').filter(Boolean)
}

function extractFirstAndLastTokens(tokens) {
  if (tokens.length === 0) return { first: '', last: '' }
  return {
    first: tokens[0],
    last: tokens[tokens.length - 1]
  }
}

function getNameMismatchRisk(enteredName, extractedName) {
  const enteredTokens = tokeniseName(enteredName)
  const extractedTokens = tokeniseName(extractedName)

  if (enteredTokens.length === 0 || extractedTokens.length === 0) return 0

  // Exact match
  if (normaliseName(enteredName) === normaliseName(extractedName)) return 0

  // Subset match: all tokens of shorter name exist in longer name
  // e.g. 'akshit' is a subset of 'akshit ohri' → treat as match
  const enteredSet = new Set(enteredTokens)
  const extractedSet = new Set(extractedTokens)
  const allEnteredInExtracted = enteredTokens.every(t => extractedSet.has(t))
  const allExtractedInEntered = extractedTokens.every(t => enteredSet.has(t))

  if (allEnteredInExtracted || allExtractedInEntered) return 0

  const enteredCore = extractFirstAndLastTokens(enteredTokens)
  const extractedCore = extractFirstAndLastTokens(extractedTokens)
  const firstMatches = enteredCore.first && extractedCore.first && enteredCore.first === extractedCore.first
  const lastMatches = enteredCore.last && extractedCore.last && enteredCore.last === extractedCore.last

  // Both first and last name tokens match — very likely same person
  if (firstMatches && lastMatches) return 1

  // Partial overlap — check how many tokens match
  const commonCount = enteredTokens.filter(t => extractedSet.has(t)).length
  const minLen = Math.min(enteredTokens.length, extractedTokens.length)
  if (commonCount >= minLen * 0.5 && (firstMatches || lastMatches)) return 3

  if (lastMatches || firstMatches) return 5

  return 12
}

function normaliseDate(value) {
  if (!value) return ''

  const trimmed = String(value).trim()

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split('-')
    return `${day}/${month}/${year}`
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    return trimmed
  }

  return trimmed
}

function normaliseIdNumber(value) {
  return (value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .trim()
}

function getIdDifferenceCount(left, right) {
  if (!left || !right || left.length !== right.length) return Number.POSITIVE_INFINITY

  let differences = 0
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) differences += 1
  }

  return differences
}

function isMinorIdMismatch(customerInfo, documentResult) {
  const enteredIdNumber = normaliseIdNumber(customerInfo.idNumber)
  const extractedIdNumber = normaliseIdNumber(documentResult.idNumber)

  if (!enteredIdNumber || !extractedIdNumber) return false
  if (enteredIdNumber === extractedIdNumber) return false
  if (enteredIdNumber.length < 6 || extractedIdNumber.length < 6) return false

  const nameMismatchRisk = getNameMismatchRisk(customerInfo.fullName || '', documentResult.extractedName || '')
  const enteredDOB = normaliseDate(customerInfo.dateOfBirth)
  const extractedDOB = normaliseDate(documentResult.extractedDOB)
  const dobMatches = !enteredDOB || !extractedDOB || enteredDOB === extractedDOB

  return getIdDifferenceCount(enteredIdNumber, extractedIdNumber) === 1 && nameMismatchRisk < 8 && dobMatches
}

function calcDataConsistencyRisk(customerInfo, documentResult) {
  let risk = 0

  const enteredName = customerInfo.fullName || ''
  const extractedName = documentResult.extractedName || ''
  if (enteredName && extractedName) {
    risk += getNameMismatchRisk(enteredName, extractedName)
  }

  const enteredDOB = normaliseDate(customerInfo.dateOfBirth)
  const extractedDOB = normaliseDate(documentResult.extractedDOB)
  if (enteredDOB && extractedDOB && enteredDOB !== extractedDOB) {
    risk += 4
  }

  const enteredIdNumber = normaliseIdNumber(customerInfo.idNumber)
  const extractedIdNumber = normaliseIdNumber(documentResult.idNumber)
  if (enteredIdNumber && extractedIdNumber && enteredIdNumber !== extractedIdNumber) {
    risk += isMinorIdMismatch(customerInfo, documentResult) ? 3 : 10
  }

  return Math.min(15, risk)
}

function countIdentityMismatches(customerInfo, documentResult) {
  let mismatches = 0

  const enteredName = customerInfo.fullName || ''
  const extractedName = documentResult.extractedName || ''
  if (enteredName && extractedName && getNameMismatchRisk(enteredName, extractedName) >= 8) {
    mismatches += 1
  }

  const enteredDOB = normaliseDate(customerInfo.dateOfBirth)
  const extractedDOB = normaliseDate(documentResult.extractedDOB)
  if (enteredDOB && extractedDOB && enteredDOB !== extractedDOB) {
    mismatches += 1
  }

  const enteredIdNumber = normaliseIdNumber(customerInfo.idNumber)
  const extractedIdNumber = normaliseIdNumber(documentResult.idNumber)
  if (enteredIdNumber && extractedIdNumber && enteredIdNumber !== extractedIdNumber && !isMinorIdMismatch(customerInfo, documentResult)) {
    mismatches += 1
  }

  return mismatches
}

function calcLivenessRisk(faceResult) {
  if (faceResult.isLivePerson === false) return 10

  const confidence = Number(faceResult.livenessConfidence) || 0
  if (confidence < 60) return 7
  if (confidence < 80) return 3
  return 0
}

module.exports = { calculateRiskScore }
