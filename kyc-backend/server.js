// server.js — Express entry point for the Autonomous KYC backend
require('dotenv').config()

const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const kycRoutes = require('./routes/kyc')

const app = express()
const PORT = process.env.PORT || 3001

// ── Security: HTTP headers ──
app.use(helmet())

// ── Security: CORS (locked to configured origin) ──
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173'
app.use(cors({ origin: CORS_ORIGIN }))

// ── Security: General rate limiter ──
const generalLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Please try again later.' }
})
app.use(generalLimiter)

// ── Security: Strict rate limiter for KYC endpoints ──
const kycLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'KYC request limit reached. Please try again later.' }
})

// Middleware
app.use(express.json({ limit: '5mb' }))

// Routes (with strict rate limiting)
app.use('/api/kyc', kycLimiter, kycRoutes)

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
  console.log(`CORS origin: ${CORS_ORIGIN}`)
  console.log(`Rate limit: ${process.env.RATE_LIMIT_MAX || 100} req / ${Math.round((Number(process.env.RATE_LIMIT_WINDOW_MS) || 900000) / 60000)} min`)
})
