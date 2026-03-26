import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ProgressBar from '../components/ProgressBar'
import FaceCompare from '../components/FaceCompare'
import LoadingSpinner from '../components/LoadingSpinner'
import { apiClient } from '../utils/apiClient'

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
      } catch (error) {
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

  const captureFrame = () => {
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
    const base64 = dataURL.split(',')[1]

    setSelfieBase64(base64)
    setSelfiePreviewURL(dataURL)
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

    try {
      setLoading(true)
      setError('')
      const result = await apiClient.post('/api/kyc/verify-face', {
        idImageBase64,
        selfieBase64
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
    <div className="min-h-screen bg-gray-50">
      <ProgressBar currentStep={3} />
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Face Verification</h1>
          <p className="text-gray-600 text-sm mb-6">
            We&apos;ll compare your live selfie with the photo on your ID document.
          </p>

          <div className="space-y-5">
            {!cameraActive && !selfiePreviewURL && (
              <div className="flex flex-col items-center gap-4 py-6">
                <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center text-4xl font-semibold text-blue-600">
                  CAM
                </div>
                <p className="text-gray-600 text-sm text-center max-w-sm">
                  Start the camera and keep your face centered, well lit, and clearly visible.
                </p>
                {cameraError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg w-full text-center">
                    {cameraError}
                  </div>
                )}
                <button
                  onClick={startCamera}
                  disabled={startingCamera}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold px-8 py-3 rounded-lg transition-colors"
                >
                  {startingCamera ? 'Starting Camera...' : 'Start Camera'}
                </button>
              </div>
            )}

            {cameraActive && (
              <div className="flex flex-col items-center gap-4">
                <div className="relative w-full max-w-sm">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full rounded-xl border-2 border-blue-400 shadow-md bg-black object-cover"
                  />
                  <div className="absolute bottom-3 left-0 right-0 flex justify-center">
                    <div className="bg-black/70 text-white text-xs px-3 py-1.5 rounded-full">
                      Blink twice and look directly at the camera
                    </div>
                  </div>
                </div>
                {cameraError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg w-full">
                    {cameraError}
                  </div>
                )}
                <div className="flex gap-3 w-full max-w-sm">
                  <button
                    onClick={stopCamera}
                    className="flex-1 border border-gray-300 text-gray-700 font-medium py-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Stop Camera
                  </button>
                  <button
                    onClick={captureFrame}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors"
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
                  className="w-48 h-48 object-cover rounded-xl border-2 border-gray-200 shadow-sm"
                />
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg w-full">
                    {error}
                  </div>
                )}
                {loading && <LoadingSpinner message="Comparing faces with Mistral Pixtral..." />}
                {!loading && (
                  <div className="flex gap-3 w-full">
                    <button
                      onClick={handleRetake}
                      className="flex-1 border border-gray-300 text-gray-700 font-medium py-3 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Retake
                    </button>
                    <button
                      onClick={handleVerifyFace}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors"
                    >
                      Verify Face
                    </button>
                  </div>
                )}
              </div>
            )}

            {faceResult && (
              <div className="space-y-5">
                <FaceCompare
                  idImageBase64={idImageBase64}
                  selfieBase64={selfieBase64}
                  matchScore={faceResult.matchScore}
                  verificationPassed={faceResult.verificationPassed}
                />

                {faceResult.reasoning && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-600">
                    <span className="font-medium">AI Assessment: </span>
                    {faceResult.reasoning}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={handleRetake}
                    className="flex-1 border border-gray-300 text-gray-700 font-medium py-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Retake
                  </button>
                  <button
                    onClick={handleConfirm}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors"
                  >
                    Continue to Results
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
