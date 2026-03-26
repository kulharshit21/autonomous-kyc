# Project Explanation

## 1. What This Project Is

`Autonomous KYC` is a full-stack KYC demo application that verifies a person in four guided steps:

1. customer information entry
2. document upload and extraction
3. face verification and liveness
4. final risk scoring and compliance-style decision

The purpose of the project is to simulate how an onboarding or compliance workflow can combine:

- user-entered details
- government document analysis
- selfie-based identity verification
- liveness checks
- final risk scoring

into one clear decision such as:

- `approved`
- `review`
- `rejected`

## 2. Tech Stack Used

### Frontend

The frontend is built with:

- `React`
- `Vite`
- `Tailwind CSS`
- `React Router`

The frontend is responsible for:

- collecting user details
- handling file uploads
- capturing the selfie
- calling backend APIs
- showing the final result, risk score, confidence, and decision reasons

### Backend

The backend is built with:

- `Node.js`
- `Express`
- `axios`
- `multer`
- `pdf-poppler`

The backend is responsible for:

- receiving uploaded document content
- converting PDFs into images
- calling the vision model
- calling the text explanation model
- calculating risk and final decision

### AI / Model Services

This project uses:

- `Mistral Pixtral` for document and face-image understanding
- `Mistral text model` for the compliance explanation
- `Ollama` is still present in the repo, but it is not the main active path now

## 3. Project Structure

```text
autonomous-kyc/
  kyc-backend/
  kyc-frontend/
  README.md
  Project Explanation.md
```

### Backend folders

Important backend files:

- [server.js](/d:/per/autonomous-kyc/kyc-backend/server.js)
- [kyc.js](/d:/per/autonomous-kyc/kyc-backend/routes/kyc.js)
- [gemini.js](/d:/per/autonomous-kyc/kyc-backend/services/gemini.js)
- [mistralText.js](/d:/per/autonomous-kyc/kyc-backend/services/mistralText.js)
- [pdfConverter.js](/d:/per/autonomous-kyc/kyc-backend/services/pdfConverter.js)
- [riskEngine.js](/d:/per/autonomous-kyc/kyc-backend/services/riskEngine.js)

### Frontend folders

Important frontend files:

- [main.jsx](/d:/per/autonomous-kyc/kyc-frontend/src/main.jsx)
- [App.jsx](/d:/per/autonomous-kyc/kyc-frontend/src/App.jsx)
- [Step1_CustomerInfo.jsx](/d:/per/autonomous-kyc/kyc-frontend/src/pages/Step1_CustomerInfo.jsx)
- [Step2_DocumentUpload.jsx](/d:/per/autonomous-kyc/kyc-frontend/src/pages/Step2_DocumentUpload.jsx)
- [Step3_FaceVerification.jsx](/d:/per/autonomous-kyc/kyc-frontend/src/pages/Step3_FaceVerification.jsx)
- [Step4_Results.jsx](/d:/per/autonomous-kyc/kyc-frontend/src/pages/Step4_Results.jsx)

## 4. How The Backend Works

### `server.js`

This is the Express entry point.

It does these things:

- loads environment variables from `.env`
- enables CORS for the frontend
- enables JSON request parsing
- mounts all KYC routes under `/api/kyc`
- exposes `/api/health`
- handles 404 and internal errors

### `routes/kyc.js`

This file defines the main APIs:

- `POST /api/kyc/verify-document`
- `POST /api/kyc/verify-face`
- `POST /api/kyc/score-risk`

These three endpoints are the heart of the project.

#### `verify-document`

This endpoint accepts:

- a single image
- or multiple document images
- or a PDF that is converted before analysis

It passes the document data to the document verification service and returns:

- extracted name
- extracted DOB
- extracted ID number
- document type
- authenticity flags
- confidence score

#### `verify-face`

This endpoint receives:

- the document face image
- the live selfie image

It then compares them and returns:

- match score
- liveness result
- supporting face-verification fields

#### `score-risk`

This endpoint receives:

- `documentResult`
- `faceResult`
- `customerInfo`

It uses the risk engine to calculate:

- `riskScore`
- `riskCategory`
- `decision`
- `breakdown`

Then it asks the Mistral text model to generate the final explanation shown in step 4.

## 5. How Document Verification Works

### `services/gemini.js`

Even though the file name is `gemini.js`, it currently works as the main vision service for the Mistral-based flow.

This file handles:

- document verification
- face verification
- prompt building for Pixtral
- output parsing
- confidence derivation
- document authenticity interpretation

### What happens during document verification

When the user uploads a document:

1. the frontend converts the file into base64
2. if it is a PDF, the backend converts the PDF to image form
3. the backend sends the image(s) to the vision model
4. the model extracts structured information
5. the backend normalizes and interprets the result
6. a confidence score and authenticity status are derived

### Multi-image support

The project supports multiple document images for cases like:

- passport front page + supporting page
- front and back of Aadhaar
- front and back of PAN-style documents

This improves extraction because the model can use more than one view of the document.

### PDF support

PDFs are converted into image pages first through:

- [pdfConverter.js](/d:/per/autonomous-kyc/kyc-backend/services/pdfConverter.js)

This is necessary because the vision model works best on rendered images.

## 6. How Face Verification Works

The selfie flow compares:

- the face inside the uploaded document
- the face captured from the webcam

The backend asks the model to determine:

- whether both faces are likely the same person
- whether the selfie looks live
- how strong the face match is

The frontend page for this is:

- [Step3_FaceVerification.jsx](/d:/per/autonomous-kyc/kyc-frontend/src/pages/Step3_FaceVerification.jsx)

That screen also includes:

- webcam handling
- capture flow
- simple liveness guidance

## 7. How Risk Scoring Works

### `services/riskEngine.js`

This file computes the final KYC decision.

It combines five main parts:

- document authenticity risk
- face match risk
- document expiry risk
- data consistency risk
- liveness risk

### Breakdown meaning

#### Document authenticity risk

This reflects whether the document itself appears genuine or suspicious.

#### Face match risk

This depends on the similarity between the selfie and the face on the document.

#### Document expiry risk

If a document appears expired, risk increases.

#### Data consistency risk

This compares entered values with extracted values:

- full name
- DOB
- ID number

#### Liveness risk

This checks whether the selfie appears to be from a live person.

### Important business logic added in this project

The project now includes stricter identity mismatch behavior.

Examples:

- if the name does not match strongly, risk increases
- if the ID number does not match, risk increases more
- if more than 2 core identity fields do not match, the case is forced to `rejected`

This prevents obviously false identity data from getting only a mild review result.

## 8. How The Frontend Workflow Works

The frontend is a 4-step React flow.

### Step 1: Customer Information

File:

- [Step1_CustomerInfo.jsx](/d:/per/autonomous-kyc/kyc-frontend/src/pages/Step1_CustomerInfo.jsx)

This step collects:

- full name
- date of birth
- ID number
- email
- phone number

These values are important because later they are compared against extracted document values.

### Step 2: Document Upload

File:

- [Step2_DocumentUpload.jsx](/d:/per/autonomous-kyc/kyc-frontend/src/pages/Step2_DocumentUpload.jsx)

This step handles:

- image upload
- PDF upload
- multiple document files
- sending files to the backend
- storing returned document result

This screen also includes an animated verification checklist so the upload process feels more alive than a plain spinner.

### Step 3: Face Verification

File:

- [Step3_FaceVerification.jsx](/d:/per/autonomous-kyc/kyc-frontend/src/pages/Step3_FaceVerification.jsx)

This step:

- opens the camera
- captures the selfie
- sends the selfie and document image to the backend
- stores the face-verification result

### Step 4: Results

File:

- [Step4_Results.jsx](/d:/per/autonomous-kyc/kyc-frontend/src/pages/Step4_Results.jsx)

This step:

- calculates a fast local fallback result
- calls the backend for the final risk explanation
- shows the decision
- shows score breakdown
- shows compliance explanation
- shows verification summary

This page also distinguishes between:

- document-only confidence
- overall verification confidence

This is important because:

- a document can be genuine
- but the entered person details can still be fake or mismatched

## 9. UI and UX Work Added

The UI was improved to feel more like a hackathon/demo-ready product:

- sleeker backgrounds
- better card styling
- shared step shell
- more polished progress header
- better result summaries
- clearer labels for confidence and authenticity
- animated transitions and checklist loaders

This was done without changing the actual workflow structure.

## 10. How Decision Labels Should Be Read

Some important labels mean different things:

### `Document Appears Genuine`

This means the uploaded document itself looks real enough.

It does **not** automatically mean the user entered correct identity details.

### `Document Analysis Confidence`

This is the confidence of reading and interpreting the document image.

It is not the same as final KYC approval confidence.

### `Overall Verification Confidence`

This is the confidence in the final case after combining:

- document confidence
- name/DOB/ID consistency
- face match
- liveness
- final risk result

## 11. Why Real Document + Fake Entered Data Can Still Happen

One important logic point in KYC is this:

- the uploaded document may be real
- the user may still enter fake name, fake DOB, or fake ID

That means:

- document confidence may be high
- document genuineness may be good
- but the **overall case must still be risky**

This project now handles that more clearly by separating:

- document-level trust
- person-level trust
- final case decision

## 12. Environment Variables

The backend uses a `.env` file for configuration.

Typical variables include:

- Mistral API key
- selected text model
- port
- runtime mode
- Ollama URL and model names

Important:

- `.env` files must not be committed
- API keys and secrets should never be pushed to GitHub
- if any credentials were exposed locally, they should be rotated

## 13. How To Run The Project

### Backend

```bash
cd kyc-backend
npm install
npm run dev
```

### Frontend

```bash
cd kyc-frontend
npm install
npm run dev
```

Frontend:

- `http://localhost:5173`

Backend:

- `http://localhost:3001`

## 14. End-to-End Flow Summary

Here is the complete sequence:

1. user enters name, DOB, ID number, email, and phone
2. user uploads document image(s) or PDF
3. backend converts PDFs into images if needed
4. vision model extracts document data
5. frontend stores document result
6. user captures selfie
7. backend runs face match + liveness check
8. frontend stores face result
9. backend calculates final risk and decision
10. text model generates compliance explanation
11. frontend displays result summary, confidence, and breakdown

## 15. Final Notes

This project is a strong demo of how AI can assist with KYC, but it is still a demo workflow, not a full production-grade compliance platform.

For real production use, you would normally add:

- audit logging
- stronger document-specific validation rules
- human reviewer tooling
- rate limiting
- authentication and access control
- secure secret management
- document storage strategy
- compliance and privacy controls

Still, as a hackathon/demo project, it already shows a complete and practical AI-assisted KYC pipeline from intake to final decision.
