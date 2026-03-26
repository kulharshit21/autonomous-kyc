const axios = require('axios')

const MISTRAL_URL = 'https://api.mistral.ai/v1/chat/completions'
const MISTRAL_TEXT_MODEL = process.env.MISTRAL_TEXT_MODEL || 'mistral-small-latest'

function getFallbackExplanation(riskScore, riskCategory) {
  if (riskCategory === 'low') {
    return `The customer's identity verification was completed successfully with a low risk score of ${riskScore}/100, indicating all primary authentication checks passed with high confidence. Automatic onboarding approval is recommended with a standard 12-month periodic review scheduled.`
  }

  if (riskCategory === 'medium') {
    return `The customer's verification returned a medium risk score of ${riskScore}/100, indicating one or more factors require additional review before onboarding can proceed. A compliance officer should review the flagged items and request supplementary documentation as appropriate.`
  }

  return `The customer's verification returned a high risk score of ${riskScore}/100, indicating significant concerns with one or more authentication factors that prevent automatic approval. This case has been escalated for immediate manual compliance review before any onboarding steps are taken.`
}

function buildPrompt(riskScore, riskCategory, decision, breakdown) {
  const {
    documentAuthenticityRisk,
    faceMatchRisk,
    expiryRisk,
    dataConsistencyRisk,
    livenessRisk
  } = breakdown

  return `You are a senior KYC compliance officer writing a short official assessment.

Verification result:
- Risk score: ${riskScore}/100
- Risk category: ${riskCategory}
- Decision: ${decision}
- Document authenticity risk: ${documentAuthenticityRisk}/30
- Face match risk: ${faceMatchRisk}/30
- Document expiry risk: ${expiryRisk}/15
- Data consistency risk: ${dataConsistencyRisk}/15
- Liveness risk: ${livenessRisk}/10

Important:
- A document can appear genuine while the entered identity details still do not match the extracted details.
- When data consistency risk is high, clearly say that the mismatch is about identity details and not necessarily document forgery.

Write exactly 2 concise sentences in plain English:
1. Explain why this case was ${decision}
2. State the recommended compliance action

Be explicit about the strongest reasons for the decision and do not use bullets in the answer.`
}

async function generateExplanation(riskScore, riskCategory, decision, breakdown) {
  const apiKey = process.env.MISTRAL_API_KEY
  if (!apiKey) {
    console.error('[ERROR] Mistral explanation disabled: MISTRAL_API_KEY not set')
    return getFallbackExplanation(riskScore, riskCategory)
  }

  try {
    const response = await axios.post(
      MISTRAL_URL,
      {
        model: MISTRAL_TEXT_MODEL,
        temperature: 0.2,
        messages: [
          {
            role: 'user',
            content: buildPrompt(riskScore, riskCategory, decision, breakdown)
          }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    )

    const explanation = response.data.choices?.[0]?.message?.content?.trim()
    if (!explanation) throw new Error('Empty response from Mistral')
    return explanation
  } catch (error) {
    console.error('[ERROR] Mistral explanation failed, using fallback:', error.response?.status || error.message)
    return getFallbackExplanation(riskScore, riskCategory)
  }
}

module.exports = { generateExplanation }
