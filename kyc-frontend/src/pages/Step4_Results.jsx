import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DecisionBadge from '../components/DecisionBadge'
import RiskMeter from '../components/RiskMeter'
import StepCanvas from '../components/StepCanvas'
import { apiClient } from '../utils/apiClient'

const BREAKDOWN_LABELS = {
  documentAuthenticityRisk: { label: 'Document Authenticity', max: 30 },
  faceMatchRisk: { label: 'Face Match', max: 30 },
  expiryRisk: { label: 'Document Expiry', max: 15 },
  dataConsistencyRisk: { label: 'Data Consistency', max: 15 },
  livenessRisk: { label: 'Liveness Detection', max: 10 }
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

function isSamePersonName(enteredName, extractedName) {
  const enteredTokens = tokeniseName(enteredName)
  const extractedTokens = tokeniseName(extractedName)

  if (enteredTokens.length === 0 || extractedTokens.length === 0) return false

  const extractedSet = new Set(extractedTokens)
  const enteredSet = new Set(enteredTokens)

  // Subset match: 'akshit' matches 'akshit ohri'
  const allEnteredPresent = enteredTokens.every(t => extractedSet.has(t))
  const allExtractedPresent = extractedTokens.every(t => enteredSet.has(t))
  if (allEnteredPresent || allExtractedPresent) return true

  // Partial overlap
  const commonCount = enteredTokens.filter(t => extractedSet.has(t)).length
  return commonCount / Math.min(enteredSet.size, extractedSet.size) >= 0.5
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

  // Subset match: 'akshit' in 'akshit ohri' = no risk
  const enteredSet = new Set(enteredTokens)
  const extractedSet = new Set(extractedTokens)
  const allEnteredInExtracted = enteredTokens.every(t => extractedSet.has(t))
  const allExtractedInEntered = extractedTokens.every(t => enteredSet.has(t))
  if (allEnteredInExtracted || allExtractedInEntered) return 0

  const enteredCore = extractFirstAndLastTokens(enteredTokens)
  const extractedCore = extractFirstAndLastTokens(extractedTokens)
  const firstMatches = enteredCore.first && extractedCore.first && enteredCore.first === extractedCore.first
  const lastMatches = enteredCore.last && extractedCore.last && enteredCore.last === extractedCore.last

  if (firstMatches && lastMatches) return 1

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
  const enteredDob = normaliseDate(customerInfo.dateOfBirth)
  const extractedDob = normaliseDate(documentResult.extractedDOB)
  const dobMatches = !enteredDob || !extractedDob || enteredDob === extractedDob

  return getIdDifferenceCount(enteredIdNumber, extractedIdNumber) === 1 && nameMismatchRisk < 8 && dobMatches
}

function getNameMatchLabel(customerInfo, documentResult) {
  const enteredName = customerInfo.fullName || ''
  const extractedName = documentResult.extractedName || ''
  if (!enteredName || !extractedName) return 'Unknown'
  return getNameMismatchRisk(enteredName, extractedName) >= 8 ? 'No' : 'Yes'
}

function getIdNumberMatchLabel(customerInfo, documentResult) {
  const enteredIdNumber = normaliseIdNumber(customerInfo.idNumber)
  const extractedIdNumber = normaliseIdNumber(documentResult.idNumber)
  if (!enteredIdNumber || !extractedIdNumber) return 'Unknown'
  if (isMinorIdMismatch(customerInfo, documentResult)) return 'Near Match'
  return enteredIdNumber === extractedIdNumber ? 'Yes' : 'No'
}

function getIdentityMismatchNotes(customerInfo, documentResult) {
  const notes = []
  const enteredName = customerInfo.fullName || ''
  const extractedName = documentResult.extractedName || ''
  const enteredDob = normaliseDate(customerInfo.dateOfBirth)
  const extractedDob = normaliseDate(documentResult.extractedDOB)
  const enteredIdNumber = normaliseIdNumber(customerInfo.idNumber)
  const extractedIdNumber = normaliseIdNumber(documentResult.idNumber)

  if (enteredName && extractedName && getNameMismatchRisk(enteredName, extractedName) >= 8) {
    notes.push(`Entered name does not match the document name (${enteredName} vs ${extractedName}).`)
  }

  if (enteredDob && extractedDob && enteredDob !== extractedDob) {
    notes.push(`Entered date of birth does not match the document DOB (${enteredDob} vs ${extractedDob}).`)
  }

  if (enteredIdNumber && extractedIdNumber && enteredIdNumber !== extractedIdNumber) {
    if (isMinorIdMismatch(customerInfo, documentResult)) {
      notes.push(`Entered ID number is one character away from the extracted document number (${enteredIdNumber} vs ${extractedIdNumber}), which may be a small entry or OCR difference.`)
    } else {
      notes.push(`Entered ID number does not match the extracted document number (${enteredIdNumber} vs ${extractedIdNumber}).`)
    }
  }

  return notes
}

function countIdentityMismatches(customerInfo, documentResult) {
  let mismatches = 0

  const enteredName = customerInfo.fullName || ''
  const extractedName = documentResult.extractedName || ''
  if (enteredName && extractedName && getNameMismatchRisk(enteredName, extractedName) >= 8) {
    mismatches += 1
  }

  const enteredDob = normaliseDate(customerInfo.dateOfBirth)
  const extractedDob = normaliseDate(documentResult.extractedDOB)
  if (enteredDob && extractedDob && enteredDob !== extractedDob) {
    mismatches += 1
  }

  const enteredIdNumber = normaliseIdNumber(customerInfo.idNumber)
  const extractedIdNumber = normaliseIdNumber(documentResult.idNumber)
  if (enteredIdNumber && extractedIdNumber && enteredIdNumber !== extractedIdNumber && !isMinorIdMismatch(customerInfo, documentResult)) {
    mismatches += 1
  }

  return mismatches
}

function buildFallbackExplanation(results) {
  const faceDecision = String(results.faceResult?.faceDecision || '').toUpperCase()
  const faceVerificationFailed = faceDecision
    ? faceDecision === 'NO_MATCH' || faceDecision === 'SPOOF_FAIL'
    : results.faceResult?.verificationPassed === false

  if (results.decision === 'approved') {
    return `This case was approved because the document, face match, and liveness checks produced a low overall risk score of ${results.riskScore}/100. Standard onboarding can proceed without extra review.`
  }

  if (results.decision === 'review') {
    if (results.faceReviewHint === 'possible_age_or_photo_gap') {
      return `This case requires manual review because the selfie and ID portrait produced only a borderline face match, likely due to an older photo or a weak printed ID portrait. The rest of the identity checks were strong, so a compliance reviewer should confirm the same-person match before proceeding.`
    }

    if ((results.breakdown?.faceMatchRisk || 0) >= 20) {
      return `This case requires manual review because the captured selfie did not produce a strong enough face match against the ID photo. The document may still appear genuine, but the person match needs closer review before proceeding.`
    }

    if ((results.breakdown?.dataConsistencyRisk || 0) >= 8) {
      return `This case requires manual review because the entered identity details do not align with the details extracted from the document. The document may still appear genuine, but the person information needs manual confirmation before proceeding.`
    }

    return `This case requires manual review because one or more verification checks introduced moderate risk, leading to an overall score of ${results.riskScore}/100. A compliance reviewer should confirm the flagged details before proceeding.`
  }

  if (faceVerificationFailed) {
    return `This case was rejected because the captured selfie did not match the ID portrait strongly enough. The document may still appear genuine, but the same-person face check failed and requires compliance escalation.`
  }

  return `This case was rejected because the verification checks produced a high overall risk score of ${results.riskScore}/100 and the evidence is not strong enough for approval. Manual compliance escalation is required before any onboarding action is taken.`
}

function getDecisionSeverity(decision) {
  if (decision === 'rejected') return 3
  if (decision === 'review') return 2
  return 1
}

function mergeConservativeResults(localResults, apiResults) {
  const localSeverity = getDecisionSeverity(localResults.decision)
  const apiSeverity = getDecisionSeverity(apiResults.decision)
  const useLocalDecision = localSeverity >= apiSeverity

  const decision = useLocalDecision ? localResults.decision : apiResults.decision
  const riskCategory = useLocalDecision ? localResults.riskCategory : apiResults.riskCategory
  const explanation = useLocalDecision ? localResults.explanation : apiResults.explanation
  const breakdown = {
    documentAuthenticityRisk: Math.max(localResults.breakdown.documentAuthenticityRisk || 0, apiResults.breakdown.documentAuthenticityRisk || 0),
    faceMatchRisk: Math.max(localResults.breakdown.faceMatchRisk || 0, apiResults.breakdown.faceMatchRisk || 0),
    expiryRisk: Math.max(localResults.breakdown.expiryRisk || 0, apiResults.breakdown.expiryRisk || 0),
    dataConsistencyRisk: Math.max(localResults.breakdown.dataConsistencyRisk || 0, apiResults.breakdown.dataConsistencyRisk || 0),
    livenessRisk: Math.max(localResults.breakdown.livenessRisk || 0, apiResults.breakdown.livenessRisk || 0)
  }
  const riskScore = Math.max(localResults.riskScore || 0, apiResults.riskScore || 0)

  return {
    ...apiResults,
    riskScore,
    riskCategory,
    decision,
    explanation,
    breakdown,
    faceResult: localResults.faceResult || apiResults.faceResult,
    faceReviewHint: localResults.faceReviewHint || apiResults.faceReviewHint || ''
  }
}

function isBorderlineFaceReview(faceResult, documentResult, dataConsistencyRisk, livenessRisk) {
  const faceDecision = String(faceResult.faceDecision || '').toUpperCase()
  const score = Number(faceResult.matchScore) || 0
  const samePersonConfidence = Number(faceResult.samePersonConfidence) || 0
  const faceUncertain = faceResult.faceUncertain === true
  const verificationPassed = faceResult.verificationPassed === true
  const idPhotoClarity = String(faceResult.idPhotoClarity || documentResult.idPhotoClarity || '').toLowerCase()
  const documentConfidence = Number(documentResult.confidenceScore) || 0
  const shouldRejectAsDifferentPerson = faceResult.shouldRejectAsDifferentPerson === true
  const featureMismatchCount = Number(faceResult.featureMismatchCount) || 0
  const featureAgreementCount = Number(faceResult.featureAgreementCount) || 0
  const documentLooksStrong =
    documentResult.tamperingDetected !== true &&
    (
      (documentResult.isAuthentic === true && documentConfidence >= 55) ||
      documentConfidence >= 35
    )

  return (
    (faceDecision === 'REVIEW' || verificationPassed) &&
    (faceUncertain || ['slightly_unclear', 'unclear', 'too_small'].includes(idPhotoClarity)) &&
    score >= 55 &&
    score < 72 &&
    samePersonConfidence >= 55 &&
    dataConsistencyRisk === 0 &&
    livenessRisk === 0 &&
    documentLooksStrong &&
    !shouldRejectAsDifferentPerson &&
    featureMismatchCount <= 1 &&
    featureAgreementCount >= 3 &&
    ['slightly_unclear', 'unclear', 'too_small'].includes(idPhotoClarity)
  )
}

function calculateDocumentAuthenticityRisk(documentResult, supportingSignals = {}) {
  let risk = 0
  const documentConfidence = Number(documentResult.confidenceScore) || 0
  const hasStrongSupport =
    (supportingSignals.dataConsistencyRisk || 0) === 0 &&
    (supportingSignals.faceMatchRisk || 0) === 0 &&
    (supportingSignals.livenessRisk || 0) === 0
  const hasModerateSupport =
    (supportingSignals.dataConsistencyRisk || 0) <= 3 &&
    (supportingSignals.faceMatchRisk || 0) <= 15 &&
    (supportingSignals.livenessRisk || 0) === 0

  if (documentResult.tamperingDetected === true) {
    return 30
  }

  if (documentResult.isAuthentic === false) {
    if (hasModerateSupport && documentConfidence >= 35) return 8
    if (hasStrongSupport && documentConfidence >= 35) return 8
    if (documentConfidence >= 70) return 8
    if (documentConfidence >= 50) return 15
    return 22
  }

  if (hasStrongSupport && documentConfidence >= 35) return 0
  if (hasModerateSupport && documentConfidence >= 35) return 8

  if (documentConfidence < 45) risk += 10
  else if (documentConfidence < 65) risk += 5

  return risk
}

function calculateLocalResults(kycData) {
  const documentResult = kycData.documentResult || {}
  const faceResult = kycData.faceResult || {}
  const customerInfo = kycData.customerInfo || {}
  const identityMismatchCount = countIdentityMismatches(customerInfo, documentResult)
  const faceDecision = String(faceResult.faceDecision || '').toUpperCase()

  const matchScore = Number(faceResult.matchScore) || 0
  const samePersonConfidence = Number(faceResult.samePersonConfidence) || 0
  const faceUncertain = faceResult.faceUncertain === true
  const verificationPassed = faceResult.verificationPassed === true
  const idPhotoClarity = String(faceResult.idPhotoClarity || '').toLowerCase()
  const shouldRejectAsDifferentPerson = faceResult.shouldRejectAsDifferentPerson === true
  const featureMismatchCount = Number(faceResult.featureMismatchCount) || 0
  const featureAgreementCount = Number(faceResult.featureAgreementCount) || 0

  const expiryDate = documentResult.expiryDate
  let expiryRisk = 8
  if (expiryDate === 'No Expiry') {
    expiryRisk = 0
  } else if (expiryDate) {
    const parts = expiryDate.split('/')
    if (parts.length === 3) {
      const parsed = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`)
      if (!isNaN(parsed.getTime())) {
        expiryRisk = parsed < new Date() ? 15 : 0
      }
    }
  }

  let dataConsistencyRisk = 0
  const enteredName = customerInfo.fullName || ''
  const extractedName = documentResult.extractedName || ''
  if (enteredName && extractedName) {
    dataConsistencyRisk += getNameMismatchRisk(enteredName, extractedName)
  }

  const enteredDob = normaliseDate(customerInfo.dateOfBirth)
  const extractedDob = normaliseDate(documentResult.extractedDOB)
  if (enteredDob && extractedDob && enteredDob !== extractedDob) {
    dataConsistencyRisk += 4
  }

  const enteredIdNumber = normaliseIdNumber(customerInfo.idNumber)
  const extractedIdNumber = normaliseIdNumber(documentResult.idNumber)
  if (enteredIdNumber && extractedIdNumber && enteredIdNumber !== extractedIdNumber) {
    dataConsistencyRisk += isMinorIdMismatch(customerInfo, documentResult) ? 3 : 10
  }
  dataConsistencyRisk = Math.min(15, dataConsistencyRisk)

  let livenessRisk = 0
  if (faceResult.isLivePerson === false) {
    livenessRisk = 10
  } else {
    const confidence = Number(faceResult.livenessConfidence) || 0
    if (confidence < 60) livenessRisk = 7
    else if (confidence < 80) livenessRisk = 3
  }

  const borderlineFaceReview = isBorderlineFaceReview(faceResult, documentResult, dataConsistencyRisk, livenessRisk)
  let faceMatchRisk = 30
  if (faceDecision === 'SPOOF_FAIL' || faceDecision === 'NO_MATCH') faceMatchRisk = 30
  else if (faceDecision === 'RECAPTURE') faceMatchRisk = 20
  else if (faceDecision === 'REVIEW') faceMatchRisk = 15
  else if (shouldRejectAsDifferentPerson || featureMismatchCount >= 3) faceMatchRisk = 30
  else if (faceResult.verificationPassed === false && !borderlineFaceReview) faceMatchRisk = 25
  else if (borderlineFaceReview) faceMatchRisk = 15
  else if (verificationPassed && featureMismatchCount >= 2) faceMatchRisk = 20
  else if (verificationPassed && faceUncertain) faceMatchRisk = 12
  else if (verificationPassed === false && samePersonConfidence > 0 && samePersonConfidence < 45) faceMatchRisk = 30
  else if (matchScore < 72 && samePersonConfidence > 0 && samePersonConfidence < 55) faceMatchRisk = 30
  else if (verificationPassed === false && matchScore < 72) faceMatchRisk = 25
  else if (faceUncertain && featureMismatchCount >= 2) faceMatchRisk = 25
  else if (faceUncertain && (idPhotoClarity === 'too_small' || idPhotoClarity === 'unclear')) faceMatchRisk = 20
  else if (faceUncertain) faceMatchRisk = 12
  else if (verificationPassed && featureAgreementCount >= 4 && samePersonConfidence >= 78 && matchScore >= 80) faceMatchRisk = 0
  else if (matchScore >= 85) faceMatchRisk = 0
  else if (matchScore >= 72) faceMatchRisk = 5
  else if (matchScore >= 55) faceMatchRisk = 25

  const documentAuthenticityRisk = calculateDocumentAuthenticityRisk(documentResult, {
    dataConsistencyRisk,
    faceMatchRisk,
    livenessRisk
  })

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

  let riskCategory = 'medium'
  let decision = 'review'
  if (riskScore <= 30) {
    riskCategory = 'low'
    decision = 'approved'
  } else if (riskScore > 70) {
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

  if (borderlineFaceReview && verificationPassed !== true && decision === 'approved') {
    riskScore = Math.max(riskScore, 35)
    riskCategory = 'medium'
    decision = 'review'
  }

  if (identityMismatchCount > 2) {
    riskScore = Math.max(riskScore, 75)
    riskCategory = 'high'
    decision = 'rejected'
  }

  if ((faceDecision === 'NO_MATCH' || faceDecision === 'SPOOF_FAIL') || (!faceDecision && faceResult.verificationPassed === false)) {
    riskScore = Math.max(riskScore, 75)
    riskCategory = 'high'
    decision = 'rejected'
  }

  if (shouldRejectAsDifferentPerson || featureMismatchCount >= 3) {
    riskScore = Math.max(riskScore, 75)
    riskCategory = 'high'
    decision = 'rejected'
  }

  if (!verificationPassed && ((samePersonConfidence > 0 && samePersonConfidence < 45) || (!faceUncertain && matchScore < 60))) {
    riskScore = Math.max(riskScore, 75)
    riskCategory = 'high'
    decision = 'rejected'
  }

  if (matchScore < 72 && samePersonConfidence > 0 && samePersonConfidence < 55 && !borderlineFaceReview) {
    riskScore = Math.max(riskScore, 75)
    riskCategory = 'high'
    decision = 'rejected'
  }

  if (faceMatchRisk >= 25 && !borderlineFaceReview) {
    riskScore = Math.max(riskScore, 75)
    riskCategory = 'high'
    decision = 'rejected'
  }

  const base = {
    riskScore,
    riskCategory,
    decision,
    faceReviewHint: borderlineFaceReview ? 'possible_age_or_photo_gap' : '',
    documentConfidenceScore: Number(documentResult.confidenceScore) || 0,
    faceResult,
    breakdown: {
      documentAuthenticityRisk,
      faceMatchRisk,
      expiryRisk,
      dataConsistencyRisk,
      livenessRisk
    }
  }

  return {
    ...base,
    explanation: buildFallbackExplanation(base)
  }
}

function buildDecisionReasons(results) {
  const reasons = []
  const { breakdown, decision } = results
  const strongDifferentPersonSignal =
    results.faceResult?.shouldRejectAsDifferentPerson === true ||
    (Number(results.faceResult?.featureMismatchCount) || 0) >= 3
  const faceDecision = String(results.faceResult?.faceDecision || '').toUpperCase()
  const faceVerificationFailed = faceDecision
    ? faceDecision === 'NO_MATCH' || faceDecision === 'SPOOF_FAIL'
    : results.faceResult?.verificationPassed === false

  if (breakdown.documentAuthenticityRisk >= 15) reasons.push('Document authenticity checks raised serious concerns.')
  else if (breakdown.documentAuthenticityRisk > 0) reasons.push('Document confidence was lower than expected.')
  else reasons.push('Document authenticity checks were strong.')

  if (strongDifferentPersonSignal || faceVerificationFailed) reasons.push('Face matching found strong different-person signals between the ID photo and the captured selfie.')
  else if (breakdown.faceMatchRisk >= 15) reasons.push('Face matching showed a weak or uncertain similarity with the ID photo.')
  else if (breakdown.faceMatchRisk > 0) reasons.push('Face matching was acceptable but not fully conclusive.')
  else reasons.push('Face matching strongly supported the same-person check.')

  if (breakdown.livenessRisk >= 7) reasons.push('Liveness validation was weak or failed.')
  else if (breakdown.livenessRisk > 0) reasons.push('Liveness validation showed minor uncertainty.')
  else reasons.push('Liveness validation passed cleanly.')

  if (breakdown.dataConsistencyRisk >= 8) reasons.push('The entered name or ID number did not align well with the extracted document data.')
  else if (breakdown.dataConsistencyRisk > 0) reasons.push('There were small differences between the entered details and the extracted document data.')
  else reasons.push('The entered details aligned well with the extracted document data.')

  if (breakdown.expiryRisk >= 15) reasons.push('The document appears expired.')
  else if (breakdown.expiryRisk > 0) reasons.push('The document expiry could not be confirmed clearly.')

  if (decision === 'approved') {
    return reasons.filter(reason => reason.includes('strong') || reason.includes('passed') || reason.includes('aligned'))
  }
  if (decision === 'rejected') {
    return reasons.filter(reason => reason.includes('serious') || reason.includes('weak') || reason.includes('failed') || reason.includes('expired') || reason.includes('did not align'))
  }
  return reasons
}

function getIdentityMatchLabel(results) {
  return (results.breakdown?.dataConsistencyRisk || 0) >= 8 ? 'No' : 'Yes'
}

function getDocumentConfidenceLabel(score) {
  const confidence = Number(score) || 0
  if (confidence >= 90) return 'Excellent'
  if (confidence >= 75) return 'High'
  if (confidence >= 60) return 'Moderate'
  return 'Low'
}

function calculateOverallVerificationConfidence(results) {
  const riskScore = Number(results.riskScore) || 0
  const documentRisk = results.breakdown?.documentAuthenticityRisk || 0
  const faceRisk = results.breakdown?.faceMatchRisk || 0
  const consistencyRisk = results.breakdown?.dataConsistencyRisk || 0
  const livenessRisk = results.breakdown?.livenessRisk || 0
  const documentConfidence = Number(results.documentConfidenceScore) || 0
  const faceDecision = String(results.faceResult?.faceDecision || '').toUpperCase()
  const faceVerificationFailed = faceDecision
    ? faceDecision === 'NO_MATCH' || faceDecision === 'SPOOF_FAIL'
    : results.faceResult?.verificationPassed === false

  const documentStrength = documentConfidence
  const consistencyStrength = Math.max(0, 100 - Math.round((consistencyRisk / 15) * 100))
  const faceStrength = Math.max(0, 100 - Math.round((faceRisk / 30) * 100))
  const livenessStrength = Math.max(0, 100 - Math.round((livenessRisk / 10) * 100))
  const riskStrength = Math.max(0, 100 - riskScore)

  let confidence = Math.round(
    (documentStrength * 0.2) +
    (consistencyStrength * 0.45) +
    (faceStrength * 0.15) +
    (livenessStrength * 0.1) +
    (riskStrength * 0.1)
  )

  if (consistencyRisk >= 12) confidence = Math.min(confidence, 20)
  else if (consistencyRisk >= 10) confidence = Math.min(confidence, 28)
  else if (consistencyRisk >= 8) confidence = Math.min(confidence, 38)
  else if (consistencyRisk > 0) confidence = Math.min(confidence, 68)

  if (faceRisk >= 25) confidence = Math.min(confidence, 18)
  else if (faceRisk >= 20) confidence = Math.min(confidence, 38)
  else if (faceRisk >= 12) confidence = Math.min(confidence, 62)

  if (faceVerificationFailed) confidence = Math.min(confidence, 20)

  if (documentRisk >= 15) confidence = Math.min(confidence, 55)
  else if (documentRisk > 0) confidence = Math.min(confidence, Math.max(documentConfidence + 10, 70))

  if (documentConfidence < 50) confidence = Math.min(confidence, 78)
  else if (documentConfidence < 60) confidence = Math.min(confidence, 84)

  const isCleanApprovedCase =
    results.decision === 'approved' &&
    consistencyRisk === 0 &&
    livenessRisk === 0 &&
    documentRisk <= 8

  if (isCleanApprovedCase && faceRisk <= 12) {
    const cleanApprovedFloor = Math.round(
      Math.min(
        86,
        62 + ((100 - riskScore) * 0.12) + (Math.max(documentConfidence, 50) * 0.08)
      )
    )
    confidence = Math.max(confidence, cleanApprovedFloor)
  }

  const isStrongApprovedCase =
    results.decision === 'approved' &&
    documentRisk === 0 &&
    consistencyRisk <= 1 &&
    livenessRisk === 0 &&
    faceRisk <= 12 &&
    documentConfidence >= 80

  if (isStrongApprovedCase) {
    const approvedFloor = faceRisk === 0 ? 88 : 72
    confidence = Math.max(confidence, approvedFloor)
  }

  if (results.decision === 'approved' && consistencyRisk === 0 && faceRisk === 0 && livenessRisk === 0) {
    confidence = Math.max(confidence, Math.min(96, Math.max(documentConfidence, 88)))
  }

  if (results.decision === 'review') confidence = Math.min(confidence, 74)
  if (results.decision === 'rejected') confidence = Math.min(confidence, 45)

  return Math.max(0, Math.min(100, Math.round(confidence)))
}

function getDocumentGenuinenessLabel(documentResult, results) {
  if (documentResult.tamperingDetected === true) return 'Suspicious'
  if ((results.breakdown?.documentAuthenticityRisk || 0) >= 15) return 'Needs Review'
  return 'Document Appears Genuine'
}

export default function Step4_Results({ kycData, updateKycData, resetKycData }) {
  const navigate = useNavigate()
  const hasFetchedRef = useRef(false)
  const localResults = useMemo(() => calculateLocalResults(kycData), [kycData])
  const [warning, setWarning] = useState('')
  const [results, setResults] = useState(localResults)

  useEffect(() => {
    setResults(localResults)
  }, [localResults])

  useEffect(() => {
    if (hasFetchedRef.current) return
    hasFetchedRef.current = true

    let cancelled = false

    const fetchResults = async () => {
      try {
        setWarning('')

        const timeout = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('AI explanation timed out. Showing the fast local result instead.')), 5000)
        })

        const data = await Promise.race([
          apiClient.post('/api/kyc/score-risk', {
            documentResult: kycData.documentResult,
            faceResult: kycData.faceResult,
            customerInfo: kycData.customerInfo
          }),
          timeout
        ])

        if (cancelled) return

        const apiResults = {
          ...localResults,
          riskScore: typeof data.riskScore === 'number' ? data.riskScore : localResults.riskScore,
          riskCategory: data.riskCategory || localResults.riskCategory,
          decision: data.decision || localResults.decision,
          explanation: data.explanation || localResults.explanation,
          documentConfidenceScore: Number(kycData.documentResult.confidenceScore) || localResults.documentConfidenceScore,
          breakdown: data.breakdown || localResults.breakdown
        }

        const nextResults = mergeConservativeResults(localResults, apiResults)

        setResults(nextResults)
        updateKycData({
          riskScore: nextResults.riskScore,
          riskCategory: nextResults.riskCategory,
          decision: nextResults.decision,
          explanation: nextResults.explanation,
          breakdown: nextResults.breakdown
        })
      } catch (err) {
        if (cancelled) return
        setWarning(err.message || 'Showing the fast local result instead of the AI explanation.')
      }
    }

    fetchResults()

    return () => {
      cancelled = true
    }
  }, [kycData.customerInfo, kycData.documentResult, kycData.faceResult, localResults, updateKycData])

  const handleStartNew = () => {
    resetKycData()
    navigate('/step/1')
  }

  const decisionReasons = buildDecisionReasons(results)
  const identityMatchLabel = getIdentityMatchLabel(results)
  const nameMatchLabel = getNameMatchLabel(kycData.customerInfo, kycData.documentResult)
  const idNumberMatchLabel = getIdNumberMatchLabel(kycData.customerInfo, kycData.documentResult)
  const documentConfidenceLabel = getDocumentConfidenceLabel(kycData.documentResult.confidenceScore)
  const documentGenuinenessLabel = getDocumentGenuinenessLabel(kycData.documentResult, results)
  const overallVerificationConfidence = calculateOverallVerificationConfidence(results)
  const overallConfidenceLabel = getDocumentConfidenceLabel(overallVerificationConfidence)
  const identityMismatchNotes = getIdentityMismatchNotes(kycData.customerInfo, kycData.documentResult)

  return (
    <StepCanvas currentStep={4}>
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="animate-card-rise teal-card p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-teal-100/70">Final Review</p>
              <h1 className="mt-1 text-2xl font-bold">Verification Results</h1>
              <p className="mt-1 text-sm text-teal-100/80">Document analysis, face verification, liveness, and consistency checks combined.</p>
            </div>
            <div className="rounded-xl bg-white/10 border border-white/15 px-4 py-2.5 text-sm text-teal-50/90">✨ Compliance Summary</div>
          </div>
        </div>

        <div className="space-y-5 animate-step-enter">
          <div className="warm-card-strong p-8 text-center space-y-3 animate-card-rise">
            <h1 className="text-2xl font-bold text-[var(--charcoal)]">Verification Complete</h1>
            <p className="text-[var(--stone)] text-sm">
              {kycData.customerInfo.fullName} — {kycData.documentResult.documentType}
            </p>
            <div className="flex justify-center pt-1">
              <DecisionBadge decision={results.decision} />
            </div>
          </div>

          {warning && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
              ⚠ {warning}
            </div>
          )}

          <div className="warm-card p-6 animate-card-rise stagger-1">
            <h2 className="text-sm font-bold text-[var(--teal)] mb-4">Risk Score</h2>
            <RiskMeter riskScore={results.riskScore} riskCategory={results.riskCategory} />
          </div>

          <div className="warm-card p-6 animate-card-rise stagger-2">
            <h2 className="text-sm font-bold text-[var(--teal)] mb-4">Decision Reasons</h2>
            <div className="space-y-2">
              {decisionReasons.map((reason, index) => (
                <div key={`${reason}-${index}`} className="rounded-xl border border-[var(--warm-border)] bg-[var(--cream-mid)] px-4 py-3 text-sm text-[var(--charcoal-light)] transition-all hover:bg-[var(--cream-dark)]">
                  {reason}
                </div>
              ))}
            </div>
          </div>

          <div className="warm-card p-6 animate-card-rise stagger-3">
            <h2 className="text-sm font-bold text-[var(--teal)] mb-4">Score Breakdown</h2>
            <div className="space-y-3">
              {Object.entries(BREAKDOWN_LABELS).map(([key, { label, max }]) => {
                const value = results.breakdown[key] ?? 0
                const pct = (value / max) * 100
                const barColor = pct === 0 ? 'bg-emerald-400' : pct <= 50 ? 'bg-amber-400' : 'bg-red-500'
                return (
                  <div key={key}>
                    <div className="flex justify-between text-xs text-[var(--stone)] mb-1">
                      <span>{label}</span>
                      <span className="font-semibold text-[var(--charcoal)]">{value} / {max}</span>
                    </div>
                    <div className="w-full bg-[var(--cream-dark)] rounded-full h-2">
                      <div className={`h-2 rounded-full ${barColor} transition-all duration-700`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="warm-card p-6 animate-card-rise stagger-4">
            <h2 className="text-sm font-bold text-[var(--teal)] mb-3">Compliance Assessment</h2>
            <p className="text-[var(--charcoal-light)] text-sm leading-relaxed italic">
              "{results.explanation}"
            </p>
          </div>

          <div className="warm-card p-6 animate-card-rise stagger-5">
            <h2 className="text-sm font-bold text-[var(--teal)] mb-3">Verification Summary</h2>
            {identityMismatchNotes.length > 0 && (
              <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                <p className="font-semibold">Why this went to manual review</p>
                <div className="mt-2 space-y-1">{identityMismatchNotes.map(n => <p key={n}>{n}</p>)}</div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-[var(--stone)]">Entered Name</p><p className="font-medium text-[var(--charcoal)]">{kycData.customerInfo.fullName}</p></div>
              <div><p className="text-xs text-[var(--stone)]">Entered ID</p><p className="font-medium text-[var(--charcoal)]">{kycData.customerInfo.idNumber}</p></div>
              <div><p className="text-xs text-[var(--stone)]">Extracted Name</p><p className="font-medium text-[var(--charcoal)]">{kycData.documentResult.extractedName}</p></div>
              <div><p className="text-xs text-[var(--stone)]">Document Type</p><p className="font-medium text-[var(--charcoal)]">{kycData.documentResult.documentType}</p></div>
              <div><p className="text-xs text-[var(--stone)]">ID Number</p><p className="font-medium text-[var(--charcoal)]">{kycData.documentResult.idNumber}</p></div>
              <div><p className="text-xs text-[var(--stone)]">Face Match</p><p className="font-medium text-[var(--charcoal)]">{kycData.faceResult.matchScore}%</p></div>
              <div><p className="text-xs text-[var(--stone)]">Liveness</p><p className={`font-medium ${kycData.faceResult.isLivePerson ? 'text-emerald-600' : 'text-red-600'}`}>{kycData.faceResult.isLivePerson ? 'Passed' : 'Failed'}</p></div>
              <div><p className="text-xs text-[var(--stone)]">Genuineness</p><p className={`font-medium ${documentGenuinenessLabel === 'Document Appears Genuine' ? 'text-emerald-600' : documentGenuinenessLabel === 'Needs Review' ? 'text-amber-600' : 'text-red-600'}`}>{documentGenuinenessLabel}</p></div>
              <div><p className="text-xs text-[var(--stone)]">Identity Match</p><p className={`font-medium ${identityMatchLabel === 'Yes' ? 'text-emerald-600' : 'text-amber-600'}`}>{identityMatchLabel}</p></div>
              <div><p className="text-xs text-[var(--stone)]">Name Match</p><p className={`font-medium ${nameMatchLabel === 'Yes' ? 'text-emerald-600' : nameMatchLabel === 'No' ? 'text-amber-600' : 'text-[var(--stone)]'}`}>{nameMatchLabel}</p></div>
              <div><p className="text-xs text-[var(--stone)]">ID Match</p><p className={`font-medium ${idNumberMatchLabel === 'Yes' ? 'text-emerald-600' : idNumberMatchLabel === 'No' ? 'text-amber-600' : 'text-[var(--stone)]'}`}>{idNumberMatchLabel}</p></div>
              <div><p className="text-xs text-[var(--stone)]">Overall Confidence</p><p className="font-medium text-[var(--charcoal)]">{overallVerificationConfidence}% <span className="text-[var(--teal)]">{overallConfidenceLabel}</span></p></div>
              <div><p className="text-xs text-[var(--stone)]">Doc Confidence</p><p className="font-medium text-[var(--charcoal)]">{kycData.documentResult.confidenceScore}% <span className="text-[var(--teal)]">{documentConfidenceLabel}</span></p></div>
            </div>
          </div>

          <button onClick={handleStartNew} className="btn-secondary w-full py-3.5 text-base font-semibold">
            🔄 Start New Verification
          </button>
        </div>
      </div>
    </StepCanvas>
  )
}
