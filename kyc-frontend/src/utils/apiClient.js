// apiClient.js — resilient fetch wrapper for backend calls

const normalizeBase = (value) => (value || '').replace(/\/+$/, '')

const unique = (values) => [...new Set(values.filter((value) => value !== undefined && value !== null))]

const configuredBase = normalizeBase(import.meta.env.VITE_API_BASE_URL)

const baseCandidates = unique([
  configuredBase,
  '',
  'http://127.0.0.1:3001',
  'http://localhost:3001'
])

let activeBase = configuredBase || ''

function buildUrl(base, endpoint) {
  return `${base}${endpoint}`
}

function orderedBases() {
  return unique([activeBase, ...baseCandidates])
}

function isProbablyProxyMiss(response, payload) {
  if (!response) return false
  if (response.status === 404) return true
  if (typeof payload === 'string' && /<!doctype html>|<html/i.test(payload)) return true
  return false
}

async function parseResponse(response) {
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return response.json()
  }

  return response.text()
}

async function request(method, endpoint, body) {
  let lastError = null

  for (const base of orderedBases()) {
    const url = buildUrl(base, endpoint)

    try {
      const response = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined
      })

      const payload = await parseResponse(response)

      if (typeof payload !== 'object' || payload === null) {
        if (base === '' && isProbablyProxyMiss(response, payload)) {
          lastError = new Error(`Local UI proxy was not available for ${endpoint}.`)
          continue
        }

        throw new Error(`Backend returned an invalid response (${response.status}). Check the backend logs for details.`)
      }

      const looksHealthy = payload.success || payload.status === 'ok'
      if (response.ok && looksHealthy) {
        activeBase = base
        return payload
      }

      if (base === '' && isProbablyProxyMiss(response, payload)) {
        lastError = new Error(`Local UI proxy was not available for ${endpoint}.`)
        continue
      }

      throw new Error(payload.error || 'An unexpected error occurred')
    } catch (error) {
      lastError = error
      const message = error?.message || ''
      const isNetworkError =
        error?.name === 'TypeError' ||
        /Failed to fetch|NetworkError|Load failed|Unable to reach backend/i.test(message)

      if (!isNetworkError) {
        throw error
      }
    }
  }

  throw new Error(
    lastError?.message ||
    'Unable to reach backend. Tried the local UI proxy and direct backends at 127.0.0.1:3001 and localhost:3001. Check that the server is running and look at the backend logs for the real error.'
  )
}

async function post(endpoint, body) {
  const result = await request('POST', endpoint, body)
  return result.data
}

async function get(endpoint) {
  return request('GET', endpoint)
}

export const apiClient = { post, get }
