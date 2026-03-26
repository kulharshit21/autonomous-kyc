function calculateRiskScore(documentResult, faceResult, customerInfo) {
  const identityMismatchCount = countIdentityMismatches(customerInfo, documentResult)
  const dataConsistencyRisk = calcDataConsistencyRisk(customerInfo, documentResult)
  const faceMatchRisk = calcFaceMatchRisk(faceResult)
  const livenessRisk = calcLivenessRisk(faceResult)
  const documentAuthenticityRisk = calcDocumentRisk(documentResult, {
    dataConsistencyRisk,
    faceMatchRisk,
    livenessRisk
  })
  const expiryRisk = calcExpiryRisk(documentResult)

  let riskScore = Math.min(100, Math.round(
    documentAuthenticityRisk +
    faceMatchRisk +
    expiryRisk +
    dataConsistencyRisk +
    livenessRisk
  ))

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

  if (identityMismatchCount > 2) {
    riskScore = Math.max(riskScore, 75)
    riskCategory = 'high'
    decision = 'rejected'
  }

  return {
    riskScore,
    riskCategory,
    decision,
    breakdown: {
      documentAuthenticityRisk,
      faceMatchRisk,
      expiryRisk,
      dataConsistencyRisk,
      livenessRisk
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

  if (documentResult.isAuthentic === false) {
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

function calcFaceMatchRisk(faceResult) {
  const score = Number(faceResult.matchScore) || 0
  if (score >= 85) return 0
  if (score >= 72) return 5
  if (score >= 55) return 15
  return 30
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

  const enteredCore = extractFirstAndLastTokens(enteredTokens)
  const extractedCore = extractFirstAndLastTokens(extractedTokens)

  const firstMatches = enteredCore.first && extractedCore.first && enteredCore.first === extractedCore.first
  const lastMatches = enteredCore.last && extractedCore.last && enteredCore.last === extractedCore.last

  if (normaliseName(enteredName) === normaliseName(extractedName)) {
    return 0
  }

  if (firstMatches && lastMatches) {
    return 1
  }

  if (lastMatches || firstMatches) {
    return 8
  }

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
    risk += 10
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
  if (enteredIdNumber && extractedIdNumber && enteredIdNumber !== extractedIdNumber) {
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
