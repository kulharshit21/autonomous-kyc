const axios = require('axios')

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

Write exactly 2 concise sentences in plain English:
1. Explain the overall result
2. State the recommended compliance action

Do not use bullets in the answer.`
}

async function generateExplanation(riskScore, riskCategory, decision, breakdown) {
  const ollamaBaseURL = (process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/+$/, '')
  const model = process.env.OLLAMA_MODEL || 'llama3.2'
  const prompt = buildPrompt(riskScore, riskCategory, decision, breakdown)

  try {
    const response = await axios.post(
      `${ollamaBaseURL}/api/generate`,
      {
        model,
        prompt,
        stream: false,
        options: {
          temperature: 0.2,
          num_predict: 120
        }
      },
      { timeout: 60000 }
    )

    const explanation = response.data.response?.trim()
    if (!explanation) throw new Error('Empty response from Ollama')
    return explanation
  } catch (error) {
    console.error('[ERROR] Ollama unavailable, using fallback:', error.message)
    return getFallbackExplanation(riskScore, riskCategory)
  }
}

module.exports = { generateExplanation }
