import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import FaceCompare from '../components/FaceCompare'
import FaceVerificationChecklistLoader from '../components/FaceVerificationChecklistLoader'
import StepCanvas from '../components/StepCanvas'
import { apiClient } from '../utils/apiClient'
import { enhanceImageForVerification } from '../utils/imageUtils'

export default function Step3_FaceVerification({ kycData, updateKycData }) {
  const navigate = useNavigate()
  const videoRef = useRef(null)
  const streamRef = useRef(null)

  const [cameraActive, setCameraActive] = useState(false)
  const [startingCamera, setStartingCamera] = useState(false)
  const [selfieBase64, setSelfieBase64] = useState('')
  const [selfiePreviewURL, setSelfiePreviewURL] = useState('')
  const [faceResult, setFaceResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [error, setError] = useState('')

  const idImageBase64 = kycData.documentResult.processedImageBase64 || kycData.documentResult.imageBase64 || ''
  const idHasPhoto = kycData.documentResult.hasPhotoInId !== false

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

  useEffect(() => {
    if (!cameraActive || !streamRef.current || !videoRef.current) return

    const video = videoRef.current
    video.srcObject = streamRef.current

    const handleLoadedMetadata = async () => {
      try {
        await video.play()
      } catch (playError) {
        setCameraError('Camera started but the preview could not play. Try Chrome or Edge and make sure camera permission is allowed.')
      }
    }

    video.onloadedmetadata = handleLoadedMetadata

    return () => {
      video.onloadedmetadata = null
      video.srcObject = null
    }
  }, [cameraActive])

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    setCameraActive(false)
    setStartingCamera(false)
  }

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('This browser does not support camera access. Try Chrome or Edge on localhost.')
      return
    }

    try {
      setCameraError('')
      setError('')
      setStartingCamera(true)
      stopCamera()

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      })

      streamRef.current = stream
      setCameraActive(true)
    } catch (err) {
      stopCamera()
      setCameraError('Camera access failed. Allow camera permission, close other apps using the webcam, and try again.')
    } finally {
      setStartingCamera(false)
    }
  }

  const captureFrame = async () => {
    const video = videoRef.current

    if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
      setCameraError('Camera is not ready yet. Wait a moment for the preview to appear, then capture again.')
      return
    }

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    const context = canvas.getContext('2d')
    if (!context) {
      setCameraError('Unable to read the camera frame. Please retry.')
      return
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    const dataURL = canvas.toDataURL('image/jpeg', 0.92)
    const base64 = await enhanceImageForVerification(dataURL.split(',')[1], { minDimension: 960 })

    setSelfieBase64(base64)
    setSelfiePreviewURL(`data:image/jpeg;base64,${base64}`)
    setFaceResult(null)
    setError('')
    setCameraError('')
    stopCamera()
  }

  const handleVerifyFace = async () => {
    if (!selfieBase64) return
    if (!idImageBase64) {
      setError('Missing document image for face verification. Please re-upload the ID document and try again.')
      return
    }
    if (!idHasPhoto) {
      setError('No photo was detected in the uploaded ID. Please go back and upload an ID image or page that clearly contains the holder photo.')
      return
    }

    try {
      setLoading(true)
      setError('')
      const enhancedIdImageBase64 = await enhanceImageForVerification(idImageBase64, {
        minDimension: 1400,
        brightness: 1.03,
        contrast: 1.12,
        saturate: 1.03,
        quality: 0.95
      })
      const enhancedSelfieBase64 = await enhanceImageForVerification(selfieBase64, {
        minDimension: 1200,
        brightness: 1.03,
        contrast: 1.1,
        saturate: 1.02,
        quality: 0.95
      })
      const result = await apiClient.post('/api/kyc/verify-face', {
        idImageBase64: enhancedIdImageBase64,
        selfieBase64: enhancedSelfieBase64
      })
      setFaceResult(result)
    } catch (err) {
      setError(err.message || 'Face verification failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = () => {
    updateKycData({
      faceResult: {
        matchScore: faceResult.matchScore,
        isLivePerson: faceResult.isLivePerson,
        livenessConfidence: faceResult.livenessConfidence,
        verificationPassed: faceResult.verificationPassed,
        faceUncertain: faceResult.faceUncertain,
        idPhotoClarity: faceResult.idPhotoClarity,
        selfieClarity: faceResult.selfieClarity,
        samePersonConfidence: faceResult.samePersonConfidence,
        selfieBase64
      }
    })
    navigate('/step/4')
  }

  const handleRetake = () => {
    setSelfieBase64('')
    setSelfiePreviewURL('')
    setFaceResult(null)
    setError('')
    setCameraError('')
    startCamera()
  }

  return (
    <StepCanvas currentStep={3}>
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="animate-card-rise rounded-[30px] border border-slate-200/70 bg-slate-950 p-6 text-white shadow-[0_24px_70px_rgba(15,23,42,0.16)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                Face Verification
              </p>
              <h1 className="mt-2 text-3xl font-semibold">Confirm the live selfie</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                We compare the live capture with the document photo and keep liveness signals in the same verification flow.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
              Keep your face centered and well lit
            </div>
          </div>
        </div>

        <div className="animate-card-rise rounded-[30px] border border-white/70 bg-white/90 p-8 shadow-[0_22px_60px_rgba(15,23,42,0.08)] backdrop-blur-md">
          <h2 className="text-2xl font-bold text-slate-950 mb-1">Face Verification</h2>
          <p className="text-slate-600 text-sm mb-6">
            We&apos;ll compare your live selfie with the photo on your ID document.
          </p>

          <div className="space-y-5">
            {!cameraActive && !selfiePreviewURL && (
              <div className="flex flex-col items-center gap-4 py-6">
                <div className="animate-soft-pulse flex h-24 w-24 items-center justify-center rounded-full bg-slate-950 text-3xl font-semibold text-white shadow-[0_18px_40px_rgba(15,23,42,0.16)]">
                  CAM
                </div>
                <p className="max-w-sm text-center text-sm text-slate-600">
                  Start the camera and keep your face centered, well lit, and clearly visible.
                </p>
                {cameraError && (
                  <div className="w-full rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-700">
                    {cameraError}
                  </div>
                )}
                <button
                  onClick={startCamera}
                  disabled={startingCamera}
                  className="rounded-2xl bg-slate-950 px-8 py-3.5 text-white font-semibold shadow-[0_14px_30px_rgba(15,23,42,0.18)] transition-all hover:-translate-y-0.5 hover:bg-slate-800 disabled:bg-slate-500"
                >
                  {startingCamera ? 'Starting Camera...' : 'Start Camera'}
                </button>
              </div>
            )}

            {cameraActive && (
              <div className="flex flex-col items-center gap-4">
                <div className="relative w-full max-w-sm overflow-hidden rounded-[26px] border border-slate-200 bg-slate-950 p-2 shadow-[0_18px_44px_rgba(15,23,42,0.16)]">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full rounded-[20px] bg-black object-cover"
                  />
                  <div className="absolute bottom-5 left-0 right-0 flex justify-center">
                    <div className="rounded-full bg-black/72 px-3 py-1.5 text-xs text-white">
                      Blink twice and look directly at the camera
                    </div>
                  </div>
                </div>
                {cameraError && (
                  <div className="w-full rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {cameraError}
                  </div>
                )}
                <div className="flex w-full max-w-sm gap-3">
                  <button
                    onClick={stopCamera}
                    className="flex-1 rounded-2xl border border-slate-300 py-3 text-slate-700 font-medium transition-colors hover:bg-slate-50"
                  >
                    Stop Camera
                  </button>
                  <button
                    onClick={captureFrame}
                    className="flex-1 rounded-2xl bg-slate-950 py-3 text-white font-semibold shadow-[0_14px_30px_rgba(15,23,42,0.18)] transition-all hover:-translate-y-0.5 hover:bg-slate-800"
                  >
                    Capture Selfie
                  </button>
                </div>
              </div>
            )}

            {selfiePreviewURL && !faceResult && (
              <div className="flex flex-col items-center gap-4">
                <img
                  src={selfiePreviewURL}
                  alt="Captured selfie"
                  className="h-48 w-48 rounded-[24px] border border-slate-200 object-cover shadow-[0_18px_44px_rgba(15,23,42,0.12)]"
                />
                {error && (
                  <div className="w-full rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}
                {loading && (
                  <div className="w-full rounded-[28px] border border-slate-200 bg-slate-50/80 p-5">
                    <FaceVerificationChecklistLoader />
                  </div>
                )}
                {!loading && (
                  <div className="flex w-full gap-3">
                    <button
                      onClick={handleRetake}
                      className="flex-1 rounded-2xl border border-slate-300 py-3 text-slate-700 font-medium transition-colors hover:bg-slate-50"
                    >
                      Retake
                    </button>
                    <button
                      onClick={handleVerifyFace}
                      className="flex-1 rounded-2xl bg-slate-950 py-3 text-white font-semibold shadow-[0_14px_30px_rgba(15,23,42,0.18)] transition-all hover:-translate-y-0.5 hover:bg-slate-800"
                    >
                      Verify Face
                    </button>
                  </div>
                )}
              </div>
            )}

            {faceResult && (
              <div className="space-y-5">
                <div className="rounded-[28px] border border-slate-200 bg-white/80 p-4">
                  <FaceCompare
                    idImageBase64={idImageBase64}
                    selfieBase64={selfieBase64}
                    matchScore={faceResult.matchScore}
                    verificationPassed={faceResult.verificationPassed}
                    faceUncertain={faceResult.faceUncertain}
                    idPhotoClarity={faceResult.idPhotoClarity}
                    selfieClarity={faceResult.selfieClarity}
                  />
                </div>

                {faceResult.reasoning && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-3 text-sm text-slate-600">
                    <span className="font-medium">AI Assessment: </span>
                    {faceResult.reasoning}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={handleRetake}
                    className="flex-1 rounded-2xl border border-slate-300 py-3 text-slate-700 font-medium transition-colors hover:bg-slate-50"
                  >
                    Retake
                  </button>
                  <button
                    onClick={handleConfirm}
                    className="flex-1 rounded-2xl bg-slate-950 py-3 text-white font-semibold shadow-[0_14px_30px_rgba(15,23,42,0.18)] transition-all hover:-translate-y-0.5 hover:bg-slate-800"
                  >
                    Continue to Results
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </StepCanvas>
  )
}
