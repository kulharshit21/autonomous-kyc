// server.js — Express entry point for the Autonomous KYC backend
require('dotenv').config()

const express = require('express')
const cors = require('cors')
const kycRoutes = require('./routes/kyc')

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json({ limit: '10mb' }))

// Routes
app.use('/api/kyc', kycRoutes)

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' })
})

// Global error handler
app.use((err, req, res, next) => {
  console.error('[ERROR] Unhandled error:', err.message)
  res.status(500).json({ success: false, error: 'Internal server error' })
})

app.listen(PORT, () => {
  console.log(`KYC Backend running on http://localhost:${PORT}`)
  console.log(`Mistral API key loaded: ${process.env.MISTRAL_API_KEY ? 'YES' : 'NO - check your .env'}`)
  console.log(`Ollama URL: ${process.env.OLLAMA_BASE_URL}`)
})
