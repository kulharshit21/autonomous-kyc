<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&height=220&color=0:0f172a,50:2563eb,100:14b8a6&text=Autonomous%20KYC&fontSize=48&fontColor=ffffff&fontAlignY=38&desc=AI-Powered%20Identity%20Verification%20Workflow&descAlignY=58&animation=fadeIn" width="100%" />

<br/>

<img src="https://readme-typing-svg.demolab.com?font=Inter&weight=700&size=23&duration=2500&pause=900&color=14B8A6&center=true&vCenter=true&multiline=true&width=1000&height=90&lines=Document+Analysis+%E2%80%A2+Face+Verification+%E2%80%A2+Risk+Scoring;Aadhaar+%E2%80%A2+PAN+%E2%80%A2+Passport+%E2%80%A2+Driving+Licence;React+%E2%80%A2+Vite+%E2%80%A2+Node.js+%E2%80%A2+Express+%E2%80%A2+Mistral+Pixtral" alt="Typing SVG" />

<br/>

<p align="center">
  <a href="https://github.com/kulharshit21/autonomous-kyc/stargazers">
    <img src="https://img.shields.io/github/stars/kulharshit21/autonomous-kyc?style=for-the-badge&logo=github&color=2563eb" />
  </a>
  <a href="https://github.com/kulharshit21/autonomous-kyc/network/members">
    <img src="https://img.shields.io/github/forks/kulharshit21/autonomous-kyc?style=for-the-badge&logo=github&color=14b8a6" />
  </a>
  <a href="https://github.com/kulharshit21/autonomous-kyc/issues">
    <img src="https://img.shields.io/github/issues/kulharshit21/autonomous-kyc?style=for-the-badge&logo=github&color=f59e0b" />
  </a>
  <a href="https://github.com/kulharshit21/autonomous-kyc/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/kulharshit21/autonomous-kyc?style=for-the-badge&color=22c55e" />
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Frontend-React-61DAFB?style=flat-square&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/Build-Vite-646CFF?style=flat-square&logo=vite&logoColor=white" />
  <img src="https://img.shields.io/badge/Backend-Node.js-339933?style=flat-square&logo=node.js&logoColor=white" />
  <img src="https://img.shields.io/badge/API-Express-000000?style=flat-square&logo=express&logoColor=white" />
  <img src="https://img.shields.io/badge/Styling-Tailwind-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" />
  <img src="https://img.shields.io/badge/Vision-Mistral%20Pixtral-7c3aed?style=flat-square" />
  <img src="https://img.shields.io/badge/Text%20Reasoning-Mistral-0ea5e9?style=flat-square" />
</p>

<h3>Full-stack identity verification demo with guided onboarding, document intelligence, selfie matching, liveness, and compliance-style risk scoring.</h3>

<p align="center">
  <a href="#-preview">Preview</a> •
  <a href="#-features">Features</a> •
  <a href="#-stack">Stack</a> •
  <a href="#-architecture">Architecture</a> •
  <a href="#-verification-flow">Verification Flow</a> •
  <a href="#-local-setup">Local Setup</a> •
  <a href="#-security">Security</a>
</p>

</div>

---

## ✨ Preview

<div align="center">

> Replace these placeholders with your actual screenshots / GIFs

| Onboarding | Document Verification | Risk Result |
|---|---|---|
| ![Step 1](https://placehold.co/600x340/0f172a/ffffff?text=Customer+Information) | ![Step 2](https://placehold.co/600x340/111827/ffffff?text=Document+Analysis) | ![Step 3](https://placehold.co/600x340/0b1220/ffffff?text=Risk+Summary) |

</div>

<br/>

<div align="center">

### 🎥 Demo Walkthrough
<img src="https://placehold.co/1000x500/0f172a/ffffff?text=Add+your+demo+GIF+or+video+preview+here" alt="Autonomous KYC Demo" />

</div>

---

## 🧠 About The Project

**Autonomous KYC** is a full-stack identity verification demo that combines:

- document analysis
- selfie verification
- liveness verification
- guided onboarding
- rule-based risk scoring
- compliance-style decision summaries

It is built to simulate a modern KYC pipeline where users can upload identity documents, verify themselves through a live capture flow, and receive a final review outcome such as **approve**, **review**, or **reject**.

---

## 🚀 Features

<table>
<tr>
<td width="50%">

### 📄 Document Intelligence
- Upload one or more document images
- Upload PDF files and convert them into images
- Support for multi-image document flows
- Extract name, DOB, ID number, expiry, and document type
- Run document-read and authenticity checks

</td>
<td width="50%">

### 🧍 Identity Verification
- Capture live selfie
- Compare selfie with document photo
- Run liveness checks
- Reduce spoofing risk in onboarding
- Guided verification checklist animation

</td>
</tr>
<tr>
<td width="50%">

### ⚖️ Risk Engine
- Risk score generation
- Authenticity-based reasoning
- Face match evaluation
- Expiry and consistency checks
- Approve / review / reject style outcomes

</td>
<td width="50%">

### 💻 Developer-Friendly
- Separate frontend and backend
- Node.js + Express API layer
- React + Vite multi-step interface
- Mistral-powered document understanding
- Ollama fallback kept in repo

</td>
</tr>
</table>

---

## 🛂 Supported Documents

- Aadhaar
- PAN
- Passport
- Driving Licence

---

## 🧰 Stack

### Frontend
- React
- Vite
- Tailwind CSS

### Backend
- Node.js
- Express

### AI / Model Layer
- **Vision model:** Mistral Pixtral
- **Text explanation:** Mistral text model
- **Legacy fallback in repo:** Ollama services

---

## 🏗️ Architecture

```mermaid
flowchart LR
    A[User Enters Customer Info] --> B[Upload Document Images / PDF]
    B --> C[Backend Receives Files]
    C --> D[PDF to Image Conversion]
    D --> E[Mistral Pixtral Document Analysis]
    E --> F[Field Extraction + Authenticity Signals]
    F --> G[Live Selfie Capture]
    G --> H[Face Match + Liveness Checks]
    H --> I[Risk Engine]
    I --> J[Compliance-Style Summary]
    J --> K[Approve / Review / Reject]
