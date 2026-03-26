// App.jsx — root component, global state, routing, step guards
import { useState } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import Step1_CustomerInfo from './pages/Step1_CustomerInfo'
import Step2_DocumentUpload from './pages/Step2_DocumentUpload'
import Step3_FaceVerification from './pages/Step3_FaceVerification'
import Step4_Results from './pages/Step4_Results'

const INITIAL_KYC_DATA = {
  customerInfo: { fullName: '', dateOfBirth: '', idNumber: '', email: '', phone: '' },
  documentResult: {
    documentType: '', extractedName: '', extractedDOB: '', idNumber: '',
    address: '', expiryDate: '', isAuthentic: null, tamperingDetected: null,
    confidenceScore: 0, imageBase64: '', processedImageBase64: '', processedImageBase64List: []
  },
  faceResult: {
    matchScore: 0, isLivePerson: null, livenessConfidence: 0,
    verificationPassed: null, selfieBase64: ''
  },
  riskScore: 0,
  riskCategory: '',
  decision: '',
  explanation: ''
}

export default function App() {
  const [kycData, setKycData] = useState(INITIAL_KYC_DATA)

  const updateKycData = (updates) => {
    setKycData(prev => ({ ...prev, ...updates }))
  }

  const resetKycData = () => setKycData(INITIAL_KYC_DATA)

  const canAccessStep = (step) => {
    if (step === 1) return true
    if (step === 2) return kycData.customerInfo.fullName !== ''
    if (step === 3) return kycData.documentResult.extractedName !== ''
    if (step === 4) return kycData.faceResult.matchScore > 0
    return false
  }

  const StepGuard = ({ step, children }) => {
    if (!canAccessStep(step)) return <Navigate to="/step/1" replace />
    return children
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/step/1" replace />} />
      <Route path="/step/1" element={
        <Step1_CustomerInfo
          kycData={kycData}
          updateKycData={updateKycData}
        />
      } />
      <Route path="/step/2" element={
        <StepGuard step={2}>
          <Step2_DocumentUpload
            kycData={kycData}
            updateKycData={updateKycData}
          />
        </StepGuard>
      } />
      <Route path="/step/3" element={
        <StepGuard step={3}>
          <Step3_FaceVerification
            kycData={kycData}
            updateKycData={updateKycData}
          />
        </StepGuard>
      } />
      <Route path="/step/4" element={
        <StepGuard step={4}>
          <Step4_Results
            kycData={kycData}
            updateKycData={updateKycData}
            resetKycData={resetKycData}
          />
        </StepGuard>
      } />
      <Route path="*" element={<Navigate to="/step/1" replace />} />
    </Routes>
  )
}
