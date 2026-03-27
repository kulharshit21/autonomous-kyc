import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import FaceCompare from '../components/FaceCompare'
import FaceVerificationChecklistLoader from '../components/FaceVerificationChecklistLoader'
import LivenessCheck from '../components/LivenessCheck'
import StepCanvas from '../components/StepCanvas'
import { apiClient } from '../utils/apiClient'
import { enhanceImageForVerification, selectBestVerificationFrames } from '../utils/imageUtils'

export default function Step3_FaceVerification({ kycData, updateKycData }) {
  const navigate = useNavigate()
  const videoRef = useRef(null)
  const streamRef = useRef(null)

  const [stage, setStage] = useState('idle') // idle | camera | liveness | preview | verifying | result
  const [selfieBase64, setSelfieBase64] = useState('')
  const [selfiePreviewURL, setSelfiePreviewURL] = useState('')
  const [livenessFrames, setLivenessFrames] = useState([])
  const [supportFrames, setSupportFrames] = useState([])
  const [frameQualityScores, setFrameQualityScores] = useState([])
  const [primaryFrameStep, setPrimaryFrameStep] = useState('')
  const [primaryFrameQualityScore, setPrimaryFrameQualityScore] = useState(0)
  const [faceResult, setFaceResult] = useState(null)
  const [cameraError, setCameraError] = useState('')
  const [error, setError] = useState('')

  const idImageBase64 = kycData.documentResult.processedImageBase64 || kycData.documentResult.imageBase64 || ''
  const idHasPhoto = kycData.documentResult.hasPhotoInId !== false

  useEffect(() => { return () => { stopCamera() } }, [])

  // Keep video element linked to stream
  useEffect(() => {
    if (stage !== 'camera' && stage !== 'liveness') return
    if (!streamRef.current || !videoRef.current) return
    const video = videoRef.current
    if (video.srcObject !== streamRef.current) {
      video.srcObject = streamRef.current
      video.onloadedmetadata = async () => { try { await video.play() } catch {} }
    }
    return () => { if (video) { video.onloadedmetadata = null } }
  }, [stage])

  const stopCamera = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
    if (videoRef.current) { videoRef.current.srcObject = null }
  }

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) { setCameraError('Camera not supported.'); return }
    try {
      setCameraError(''); setError('')
      stopCamera()
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } })
      streamRef.current = stream
      setStage('camera')
    } catch { stopCamera(); setCameraError('Camera access denied. Please allow permissions.') }
  }

  const startLivenessCheck = () => {
    setStage('liveness')
  }

  const handleLivenessDone = useCallback(async (selfie, frames) => {
    const selection = await selectBestVerificationFrames(frames)
    const primaryFrame = selection.primaryFrame || selfie

    setSelfieBase64(primaryFrame)
    setSelfiePreviewURL(`data:image/jpeg;base64,${primaryFrame}`)
    setLivenessFrames(frames)
    setSupportFrames(selection.supportFrames)
    setFrameQualityScores(selection.frameQualityScores)
    setPrimaryFrameStep(selection.primaryFrameStep || '')
    setPrimaryFrameQualityScore(selection.primaryFrameQualityScore || 0)
    stopCamera()
    setStage('preview')
  }, [])

  const handleLivenessCancel = useCallback(() => {
    stopCamera()
    setSelfieBase64('')
    setSelfiePreviewURL('')
    setLivenessFrames([])
    setStage('idle')
  }, [])

  const buildVerificationPayload = useCallback(async ({
    idMinDimension,
    selfieMinDimension,
    frameMinDimension,
    idQuality,
    selfieQuality,
    frameQuality
  }) => {
    const frames = livenessFrames.slice(0, 6)
    const enhancedId = await enhanceImageForVerification(idImageBase64, {
      minDimension: idMinDimension,
      brightness: 1.03,
      contrast: 1.1,
      saturate: 1.02,
      quality: idQuality
    })
    const enhancedSelfie = await enhanceImageForVerification(selfieBase64, {
      minDimension: selfieMinDimension,
      brightness: 1.03,
      contrast: 1.08,
      saturate: 1.02,
      quality: selfieQuality
    })
    const enhancedFrames = await Promise.all(
      frames.map((frame) =>
        enhanceImageForVerification(frame, {
          minDimension: frameMinDimension,
          brightness: 1.02,
          contrast: 1.06,
          saturate: 1.01,
          quality: frameQuality
        })
      )
    )

    return {
      idImageBase64: enhancedId,
      selfieBase64: enhancedSelfie,
      livenessFrames: enhancedFrames,
      liveFrameQualityScores: frameQualityScores,
      primaryFrameStep,
      primaryFrameQualityScore
    }
  }, [frameQualityScores, idImageBase64, livenessFrames, primaryFrameQualityScore, primaryFrameStep, selfieBase64])

  const handleVerifyFace = async () => {
    if (!selfieBase64 || !idImageBase64) { setError('Missing required images.'); return }
    if (!idHasPhoto) { setError('No photo in ID. Go back and upload the front side.'); return }
    try {
      setStage('verifying'); setError('')
      const requestProfiles = [
        {
          idMinDimension: 1200,
          selfieMinDimension: 1040,
          frameMinDimension: 760,
          idQuality: 0.9,
          selfieQuality: 0.9,
          frameQuality: 0.84
        },
        {
          idMinDimension: 960,
          selfieMinDimension: 900,
          frameMinDimension: 640,
          idQuality: 0.82,
          selfieQuality: 0.82,
          frameQuality: 0.76
        }
      ]

      let result = null
      let lastError = null

      for (let index = 0; index < requestProfiles.length; index += 1) {
        try {
          const payload = await buildVerificationPayload(requestProfiles[index])
          result = await apiClient.post('/api/kyc/verify-face', payload)
          break
        } catch (err) {
          lastError = err
          const retryable = /Unable to reach backend|Backend returned an invalid response|Failed to fetch|NetworkError|Load failed/i.test(err?.message || '')
          if (!retryable || index === requestProfiles.length - 1) {
            throw err
          }
        }
      }

      if (!result) {
        throw lastError || new Error('Face verification failed.')
      }

      setFaceResult(result)
      setStage('result')
    } catch (err) { setError(err.message || 'Face verification failed.'); setStage('preview') }
  }

  const handleConfirm = () => {
    updateKycData({
      faceResult: {
        matchScore: faceResult.matchScore,
        isLivePerson: faceResult.isLivePerson,
        livenessConfidence: faceResult.livenessConfidence,
        faceDecision: faceResult.faceDecision,
        verificationPassed: faceResult.verificationPassed,
        faceUncertain: faceResult.faceUncertain,
        idPhotoClarity: faceResult.idPhotoClarity,
        selfieClarity: faceResult.selfieClarity,
        samePersonConfidence: faceResult.samePersonConfidence,
        shouldRejectAsDifferentPerson: faceResult.shouldRejectAsDifferentPerson,
        featureLikelihood: faceResult.featureLikelihood,
        featureAgreementCount: faceResult.featureAgreementCount,
        featureMismatchCount: faceResult.featureMismatchCount,
        perFrameSimilarityScores: faceResult.perFrameSimilarityScores || [],
        fusedMatchScore: faceResult.fusedMatchScore || faceResult.matchScore,
        liveSessionLivenessScore: faceResult.liveSessionLivenessScore || faceResult.livenessConfidence,
        liveFrameQualityScores: frameQualityScores,
        selfieBase64,
        livenessFrameCount: livenessFrames.length
      }
    })
    navigate('/step/4')
  }

  const handleRetake = () => {
    setSelfieBase64(''); setSelfiePreviewURL(''); setFaceResult(null); setLivenessFrames([]); setSupportFrames([]); setFrameQualityScores([]); setPrimaryFrameStep(''); setPrimaryFrameQualityScore(0); setError(''); setCameraError('')
    setStage('idle')
  }

  return (
    <StepCanvas currentStep={3}>
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="animate-card-rise teal-card p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-teal-100/70">Face Verification</p>
              <h1 className="mt-1 text-2xl font-bold">Liveness check & face match</h1>
              <p className="mt-1 text-sm text-teal-100/80">Follow the on-screen prompts to verify you are a real person, then we'll match against your ID.</p>
            </div>
            <div className="rounded-xl bg-white/10 border border-white/15 px-4 py-2.5 text-sm text-teal-50/90">
              🎯 6 movement checks
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="animate-card-rise stagger-1 warm-card-strong p-8">
          <h2 className="text-lg font-bold text-[var(--charcoal)] mb-1">Liveness Verification</h2>
          <p className="text-sm text-[var(--stone)] mb-5">
            We'll guide you through a series of head movements to confirm you are a real person, then compare your face with the ID photo.
          </p>

          {/* IDLE — Start button */}
          {stage === 'idle' && (
            <div className="flex flex-col items-center gap-5 py-8">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--teal-subtle)] border-2 border-[var(--teal)]/20 text-4xl">
                🧑‍💻
              </div>
              <div className="max-w-md text-center">
                <p className="text-sm text-[var(--charcoal)] font-medium mb-2">What you'll need to do:</p>
                <div className="grid grid-cols-3 gap-2 text-center text-xs text-[var(--stone)]">
                  {['😐 Look straight', '👈 Turn left', '👉 Turn right', '👆 Tilt up', '😑 Blink twice', '😊 Smile'].map(item => (
                    <div key={item} className="rounded-lg bg-[var(--cream-mid)] border border-[var(--warm-border)] py-2 px-1">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
              {cameraError && <div className="w-full rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{cameraError}</div>}
              <button onClick={startCamera} className="btn-primary">📷 Start Liveness Check</button>
            </div>
          )}

          {/* CAMERA — Preview before starting liveness */}
          {stage === 'camera' && (
            <div className="flex flex-col items-center gap-4">
              <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border-2 border-[var(--teal)] bg-black shadow-lg">
                <video ref={videoRef} autoPlay playsInline muted className="w-full bg-black object-cover" style={{ transform: 'scaleX(-1)' }} />
                <div className="absolute bottom-3 left-0 right-0 flex justify-center">
                  <div className="rounded-full bg-black/50 backdrop-blur-sm px-3 py-1.5 text-xs text-white/80">
                    Position your face in view, then start
                  </div>
                </div>
              </div>
              <div className="flex w-full max-w-sm gap-3">
                <button onClick={() => { stopCamera(); setStage('idle') }} className="btn-secondary flex-1">Cancel</button>
                <button onClick={startLivenessCheck} className="btn-primary flex-1">▶ Begin Challenges</button>
              </div>
            </div>
          )}

          {/* LIVENESS — Active challenge flow */}
          {stage === 'liveness' && (
            <LivenessCheck
              videoRef={videoRef}
              onComplete={handleLivenessDone}
              onCancel={handleLivenessCancel}
            />
          )}

          {/* PREVIEW — Selfie captured, ready to verify */}
          {stage === 'preview' && (
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <img src={selfiePreviewURL} alt="Selfie" className="h-48 w-48 rounded-2xl border-2 border-[var(--teal)] object-cover shadow-lg" />
                <div className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--teal)] text-white text-xs font-bold shadow">
                  ✓
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-[var(--charcoal)]">Liveness check passed</p>
                <p className="text-xs text-[var(--stone)]">{livenessFrames.length} frames captured. Best frontal frame selected automatically for matching.</p>
                {primaryFrameStep && (
                  <p className="mt-1 text-[11px] text-[var(--stone)]">
                    Primary match frame: <span className="font-semibold capitalize text-[var(--charcoal)]">{primaryFrameStep}</span>
                    {primaryFrameQualityScore > 0 ? ` · Quality ${primaryFrameQualityScore}` : ''}
                  </p>
                )}
              </div>
              {error && <div className="w-full rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
              <div className="flex w-full gap-3">
                <button onClick={handleRetake} className="btn-secondary flex-1">Retake</button>
                <button onClick={handleVerifyFace} className="btn-primary flex-1">🔍 Verify Face Match</button>
              </div>
            </div>
          )}

          {/* VERIFYING — Loading */}
          {stage === 'verifying' && (
            <div className="warm-card p-5">
              <FaceVerificationChecklistLoader />
            </div>
          )}

          {/* RESULT — Face comparison */}
          {stage === 'result' && faceResult && (
            <div className="space-y-5 animate-card-rise">
              <div className="warm-card p-5">
                <FaceCompare
                  idImageBase64={idImageBase64}
                  selfieBase64={selfieBase64}
                  matchScore={faceResult.matchScore}
                  faceDecision={faceResult.faceDecision}
                  verificationPassed={faceResult.verificationPassed}
                  faceUncertain={faceResult.faceUncertain}
                  idPhotoClarity={faceResult.idPhotoClarity}
                  selfieClarity={faceResult.selfieClarity}
                  shouldRejectAsDifferentPerson={faceResult.shouldRejectAsDifferentPerson}
                />
              </div>
              {faceResult.reasoning && (
                <div className="warm-card px-4 py-3 text-sm text-[var(--charcoal-light)]">
                  <span className="font-semibold text-[var(--teal)]">AI Assessment: </span>{faceResult.reasoning}
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={handleRetake} className="btn-secondary flex-1">Retake</button>
                <button onClick={handleConfirm} className="btn-primary flex-1">Continue to Results →</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </StepCanvas>
  )
}
