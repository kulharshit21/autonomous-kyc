// apiClient.js — thin fetch wrapper for all backend calls

const BASE_URL = 'http://localhost:3001'

async function post(endpoint, body) {
  let response
  try {
    response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
  } catch (error) {
    throw new Error(`Unable to reach backend at ${BASE_URL}. Check that the server is running and look at the backend logs for the real error.`)
  }

  let result
  try {
    result = await response.json()
  } catch (error) {
    throw new Error(`Backend returned an invalid response (${response.status}). Check the backend logs for details.`)
  }

  if (!result.success) {
    throw new Error(result.error || 'An unexpected error occurred')
  }

  return result.data
}

async function get(endpoint) {
  const response = await fetch(`${BASE_URL}${endpoint}`)
  const result = await response.json()

  if (!result.success && result.status !== 'ok') {
    throw new Error(result.error || 'An unexpected error occurred')
  }

  return result
}

export const apiClient = { post, get }
