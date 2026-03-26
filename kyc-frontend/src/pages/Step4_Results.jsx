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
  const commonCount = enteredTokens.filter(token => extractedSet.has(token)).length
  const allEnteredPresent = enteredTokens.every(token => extractedSet.has(token))
  const allExtractedPresent = extractedTokens.every(token => enteredSet.has(token))

  if (allEnteredPresent || allExtractedPresent) return true
  return commonCount / Math.min(enteredSet.size, extractedSet.size) >= 0.8
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

  return trimmed
}

function normaliseIdNumber(value) {
  return (value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .trim()
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
  return enteredIdNumber === extractedIdNumber ? 'Yes' : 'No'
}

function buildFallbackExplanation(results) {
  if (results.decision === 'approved') {
    return `This case was approved because the document, face match, and liveness checks produced a low overall risk score of ${results.riskScore}/100. Standard onboarding can proceed without extra review.`
  }

  if (results.decision === 'review') {
    if ((results.breakdown?.dataConsistencyRisk || 0) >= 8) {
      return `This case requires manual review because the entered identity details do not align with the details extracted from the document. The document may still appear genuine, but the person information needs manual confirmation before proceeding.`
    }

    return `This case requires manual review because one or more verification checks introduced moderate risk, leading to an overall score of ${results.riskScore}/100. A compliance reviewer should confirm the flagged details before proceeding.`
  }

  return `This case was rejected because the verification checks produced a high overall risk score of ${results.riskScore}/100 and the evidence is not strong enough for approval. Manual compliance escalation is required before any onboarding action is taken.`
}

function calculateDocumentAuthenticityRisk(documentResult, supportingSignals = {}) {
  let risk = 0
  const documentConfidence = Number(documentResult.confidenceScore) || 0
  const hasStrongSupport =
    (supportingSignals.dataConsistencyRisk || 0) === 0 &&
    (supportingSignals.faceMatchRisk || 0) === 0 &&
    (supportingSignals.livenessRisk || 0) === 0

  if (documentResult.tamperingDetected === true) {
    return 30
  }

  if (documentResult.isAuthentic === false) {
    if (hasStrongSupport && documentConfidence >= 35) return 8
    if (documentConfidence >= 70) return 8
    if (documentConfidence >= 50) return 15
    return 22
  }

  if (hasStrongSupport && documentConfidence >= 35) return 0

  if (documentConfidence < 45) risk += 10
  else if (documentConfidence < 65) risk += 5

  return risk
}

function calculateLocalResults(kycData) {
  const documentResult = kycData.documentResult || {}
  const faceResult = kycData.faceResult || {}
  const customerInfo = kycData.customerInfo || {}

  const matchScore = Number(faceResult.matchScore) || 0
  let faceMatchRisk = 30
  if (matchScore >= 85) faceMatchRisk = 0
  else if (matchScore >= 72) faceMatchRisk = 5
  else if (matchScore >= 55) faceMatchRisk = 15

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
    dataConsistencyRisk += 10
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

  const documentAuthenticityRisk = calculateDocumentAuthenticityRisk(documentResult, {
    dataConsistencyRisk,
    faceMatchRisk,
    livenessRisk
  })

  const riskScore = Math.min(100, Math.round(
    documentAuthenticityRisk +
    faceMatchRisk +
    expiryRisk +
    dataConsistencyRisk +
    livenessRisk
  ))

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

  const base = {
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

  return {
    ...base,
    explanation: buildFallbackExplanation(base)
  }
}

function buildDecisionReasons(results) {
  const reasons = []
  const { breakdown, decision } = results

  if (breakdown.documentAuthenticityRisk >= 15) reasons.push('Document authenticity checks raised serious concerns.')
  else if (breakdown.documentAuthenticityRisk > 0) reasons.push('Document confidence was lower than expected.')
  else reasons.push('Document authenticity checks were strong.')

  if (breakdown.faceMatchRisk >= 15) reasons.push('Face matching showed a weak or uncertain similarity with the ID photo.')
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

        const nextResults = {
          ...localResults,
          riskScore: typeof data.riskScore === 'number' ? data.riskScore : localResults.riskScore,
          riskCategory: data.riskCategory || localResults.riskCategory,
          decision: data.decision || localResults.decision,
          explanation: data.explanation || localResults.explanation,
          breakdown: data.breakdown || localResults.breakdown
        }

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

  return (
    <StepCanvas currentStep={4}>
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="animate-card-rise rounded-[30px] border border-slate-200/70 bg-slate-950 p-6 text-white shadow-[0_24px_70px_rgba(15,23,42,0.16)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                Final Review
              </p>
              <h1 className="mt-2 text-3xl font-semibold">Verification results</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                This final screen combines document analysis, face verification, liveness, and consistency checks into one decision summary.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
              Compliance-style summary
            </div>
          </div>
        </div>

        <div className="space-y-5 animate-card-rise">
          <div className="rounded-[30px] border border-white/70 bg-white/90 p-8 text-center space-y-3 shadow-[0_22px_60px_rgba(15,23,42,0.08)] backdrop-blur-md">
            <h1 className="text-2xl font-bold text-gray-900">Verification Complete</h1>
            <p className="text-gray-500 text-sm">
              {kycData.customerInfo.fullName} - {kycData.documentResult.documentType}
            </p>
            <div className="flex justify-center pt-1">
              <DecisionBadge decision={results.decision} />
            </div>
          </div>

          {warning && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {warning}
            </div>
          )}

          <div className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-[0_18px_44px_rgba(15,23,42,0.07)] backdrop-blur-md">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Risk Score</h2>
            <RiskMeter riskScore={results.riskScore} riskCategory={results.riskCategory} />
          </div>

          <div className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-[0_18px_44px_rgba(15,23,42,0.07)] backdrop-blur-md">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Decision Reasons</h2>
            <div className="space-y-2">
              {decisionReasons.map((reason, index) => (
                <div key={`${reason}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-3 text-sm text-gray-700">
                  {reason}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-[0_18px_44px_rgba(15,23,42,0.07)] backdrop-blur-md">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Score Breakdown</h2>
            <div className="space-y-3">
              {Object.entries(BREAKDOWN_LABELS).map(([key, { label, max }]) => {
                const value = results.breakdown[key] ?? 0
                const pct = (value / max) * 100
                const barColor = pct === 0 ? 'bg-green-400' : pct <= 50 ? 'bg-amber-400' : 'bg-red-500'

                return (
                  <div key={key}>
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>{label}</span>
                      <span className="font-semibold">{value} / {max}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className={`h-2 rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-[0_18px_44px_rgba(15,23,42,0.07)] backdrop-blur-md">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Compliance Assessment</h2>
            <p className="text-gray-700 text-sm leading-relaxed italic">
              "{results.explanation}"
            </p>
          </div>

          <div className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-[0_18px_44px_rgba(15,23,42,0.07)] backdrop-blur-md">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Verification Summary</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-gray-500">Entered Name</p>
                <p className="font-medium text-gray-900">{kycData.customerInfo.fullName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Entered ID Number</p>
                <p className="font-medium text-gray-900">{kycData.customerInfo.idNumber}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Extracted Name</p>
                <p className="font-medium text-gray-900">{kycData.documentResult.extractedName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Document Type</p>
                <p className="font-medium text-gray-900">{kycData.documentResult.documentType}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">ID Number</p>
                <p className="font-medium text-gray-900">{kycData.documentResult.idNumber}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Face Match Score</p>
                <p className="font-medium text-gray-900">{kycData.faceResult.matchScore}%</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Liveness Check</p>
                <p className={`font-medium ${kycData.faceResult.isLivePerson ? 'text-green-600' : 'text-red-600'}`}>
                  {kycData.faceResult.isLivePerson ? 'Passed' : 'Failed'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Document Genuineness</p>
                <p className={`font-medium ${documentGenuinenessLabel === 'Document Appears Genuine' ? 'text-green-600' : documentGenuinenessLabel === 'Needs Review' ? 'text-amber-600' : 'text-red-600'}`}>
                  {documentGenuinenessLabel}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Identity Details Match</p>
                <p className={`font-medium ${identityMatchLabel === 'Yes' ? 'text-green-600' : 'text-amber-600'}`}>
                  {identityMatchLabel}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Name Match</p>
                <p className={`font-medium ${nameMatchLabel === 'Yes' ? 'text-green-600' : nameMatchLabel === 'No' ? 'text-amber-600' : 'text-gray-600'}`}>
                  {nameMatchLabel}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">ID Number Match</p>
                <p className={`font-medium ${idNumberMatchLabel === 'Yes' ? 'text-green-600' : idNumberMatchLabel === 'No' ? 'text-amber-600' : 'text-gray-600'}`}>
                  {idNumberMatchLabel}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Document Read Confidence</p>
                <p className="font-medium text-gray-900">
                  {kycData.documentResult.confidenceScore}% <span className="text-gray-500">{documentConfidenceLabel}</span>
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={handleStartNew}
            className="w-full rounded-2xl border-2 border-slate-950 py-3.5 text-slate-950 font-semibold transition-colors hover:bg-slate-950 hover:text-white"
          >
            Start New Verification
          </button>
        </div>
      </div>
    </StepCanvas>
  )
}
