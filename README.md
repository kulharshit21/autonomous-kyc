# Autonomous KYC

Autonomous KYC is a full-stack identity verification demo that combines document analysis, selfie verification, and risk scoring in a guided onboarding flow.

The app supports:
- customer information capture
- Aadhaar, PAN, passport, and driving licence uploads
- image and PDF document verification
- multi-image document uploads
- face match and liveness verification
- risk scoring with a compliance-style result summary

## Stack

- Frontend: React, Vite, Tailwind CSS
- Backend: Node.js, Express
- Vision model: Mistral Pixtral
- Text explanation: Mistral text model
- Legacy fallback kept in repo: Ollama services

## Project Structure

```text
autonomous-kyc/
  kyc-backend/
  kyc-frontend/
```

- [kyc-backend](d:/per/autonomous-kyc/kyc-backend) contains the API, document conversion, model calls, and risk engine.
- [kyc-frontend](d:/per/autonomous-kyc/kyc-frontend) contains the multi-step KYC interface.

## Features

- Upload one or more document images
- Upload PDF documents and convert them to images for vision processing
- Extract name, DOB, ID number, expiry, and document type
- Compare selfie against the document photo
- Run liveness checks
- Score risk based on authenticity, face match, expiry, consistency, and liveness
- Show decision reasons for approve, review, or reject outcomes
- Use a verification checklist animation during document analysis

## Local Setup

### 1. Clone the repo

```bash
git clone https://github.com/kulharshit21/autonomous-kyc.git
cd autonomous-kyc
```

### 2. Install backend dependencies

```bash
cd kyc-backend
npm install
```

### 3. Install frontend dependencies

```bash
cd ../kyc-frontend
npm install
```

## Environment Variables

Create `kyc-backend/.env` from `kyc-backend/.env.example`.

Expected variables:

```env
MISTRAL_API_KEY=your_mistral_api_key
MISTRAL_TEXT_MODEL=mistral-small-latest
PORT=3001
NODE_ENV=development
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
OLLAMA_VISION_MODEL=llama3.2-vision
```

Notes:
- Do not commit `.env` files or API keys.
- Ollama remains in the repo, but the main active explanation flow uses Mistral.

## Run the App

### Backend

```bash
cd kyc-backend
npm run dev
```

### Frontend

```bash
cd kyc-frontend
npm run dev
```

Default local URLs:
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`

## Verification Flow

1. Enter customer information including name, DOB, and ID number
2. Upload one or more document images or a PDF
3. Convert PDFs to images when needed
4. Analyze the document with Mistral Pixtral
5. Extract identity fields and authenticity signals
6. Capture a live selfie
7. Compare the selfie with the document photo
8. Generate a final risk score and compliance explanation

## Important Notes

- The displayed document score is a document-read confidence, not overall approval confidence.
- A document can appear genuine while the entered identity details still mismatch and trigger manual review.
- For best camera reliability, use Chrome or Edge on `localhost`.

## Build

Frontend production build:

```bash
cd kyc-frontend
npm run build
```

Backend production run:

```bash
cd kyc-backend
npm start
```

## Security

- `.env` files are ignored by Git
- `node_modules` and frontend build output are ignored by Git
- If any credentials were ever exposed locally, rotate them before using the project in production

## Roadmap Ideas

- stronger document-type-specific extraction rules
- audit logs for reviewer actions
- deployment configuration
- webhook or queue-based processing
- admin review dashboard
