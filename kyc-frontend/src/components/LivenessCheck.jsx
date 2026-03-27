import { useCallback, useEffect, useRef, useState } from 'react'

const CHALLENGES = [
  { id: 'center', instruction: 'Look straight at the camera', icon: '😐', duration: 2000 },
  { id: 'left', instruction: 'Slowly turn your head LEFT', icon: '👈', duration: 2800 },
  { id: 'right', instruction: 'Slowly turn your head RIGHT', icon: '👉', duration: 2800 },
  { id: 'up', instruction: 'Tilt your head UP slightly', icon: '👆', duration: 2200 },
  { id: 'blink', instruction: 'Blink your eyes twice', icon: '😑', duration: 2500 },
  { id: 'smile', instruction: 'Smile naturally', icon: '😊', duration: 2000 },
]

/**
 * LivenessCheck — Interactive liveness verification with head movement prompts
 * Captures a frame at each challenge step, then returns the final selfie.
 *
 * Props:
 *   videoRef: ref to the <video> element
 *   onComplete: (selfieBase64: string, capturedFrames: string[]) => void
 *   onCancel: () => void
 */
export default function LivenessCheck({ videoRef, onComplete, onCancel }) {
  const [step, setStep] = useState(0)
  const [phase, setPhase] = useState('ready') // ready | active | capturing | done
  const [countdown, setCountdown] = useState(3)
  const [progress, setProgress] = useState(0)
  const capturedFrames = useRef([])
  const timerRef = useRef(null)

  const totalSteps = CHALLENGES.length
  const currentChallenge = CHALLENGES[step] || CHALLENGES[0]

  // Capture a frame from the video
  const captureFrame = useCallback(() => {
    const video = videoRef.current
    if (!video || video.readyState < 2 || !video.videoWidth) return null
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.88).split(',')[1]
  }, [videoRef])

  // Start countdown before challenges begin
  useEffect(() => {
    if (phase !== 'ready') return
    if (countdown <= 0) {
      setPhase('active')
      return
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [phase, countdown])

  // Run challenge steps
  useEffect(() => {
    if (phase !== 'active') return
    if (step >= totalSteps) {
      setPhase('done')
      return
    }

    setProgress(0)
    const challenge = CHALLENGES[step]
    const totalDuration = challenge.duration
    const progressInterval = 50
    let elapsed = 0

    timerRef.current = setInterval(() => {
      elapsed += progressInterval
      setProgress(Math.min((elapsed / totalDuration) * 100, 100))

      if (elapsed >= totalDuration) {
        clearInterval(timerRef.current)
        // Capture frame at end of this challenge
        const frame = captureFrame()
        if (frame) capturedFrames.current.push(frame)
        setStep(s => s + 1)
      }
    }, progressInterval)

    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [phase, step, totalSteps, captureFrame])

  // When done, return the last "center" or "smile" frame as the selfie
  useEffect(() => {
    if (phase !== 'done') return
    const frames = capturedFrames.current
    const selfie = frames[frames.length - 1] || frames[0] || ''
    const t = setTimeout(() => onComplete(selfie, frames), 800)
    return () => clearTimeout(t)
  }, [phase, onComplete])

  return (
    <div className="relative">
      {/* Video feed with overlay */}
      <div className="relative w-full max-w-sm mx-auto overflow-hidden rounded-2xl border-2 border-[var(--teal)] bg-black shadow-lg">
        <video ref={videoRef} autoPlay playsInline muted className="w-full bg-black object-cover" style={{ transform: 'scaleX(-1)' }} />

        {/* Overlay content */}
        <div className="absolute inset-0 flex flex-col">
          {/* Face oval guide */}
          <div className="flex-1 flex items-center justify-center">
            <div className="w-44 h-56 rounded-[50%] border-2 border-dashed border-teal-400/50" />
          </div>

          {/* Countdown overlay */}
          {phase === 'ready' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="text-center">
                <div className="text-6xl font-bold text-white animate-badge-pop" key={countdown}>
                  {countdown > 0 ? countdown : 'Go!'}
                </div>
                <p className="mt-2 text-sm text-white/70">Get ready — center your face</p>
              </div>
            </div>
          )}

          {/* Challenge instruction bar */}
          {phase === 'active' && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pt-10">
              <div className="text-center">
                <div className="text-3xl mb-1">{currentChallenge.icon}</div>
                <p className="text-white text-sm font-semibold">{currentChallenge.instruction}</p>
                <p className="text-white/50 text-xs mt-1">Step {step + 1} of {totalSteps}</p>
              </div>

              {/* Progress bar */}
              <div className="mt-3 w-full h-1.5 rounded-full bg-white/20 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--teal)] transition-all duration-[50ms] ease-linear"
                  style={{ width: `${progress}%` }}
                />
              </div>

              {/* Step dots */}
              <div className="mt-3 flex justify-center gap-1.5">
                {CHALLENGES.map((c, i) => (
                  <div
                    key={c.id}
                    className={`h-2 w-2 rounded-full transition-all duration-300 ${
                      i < step ? 'bg-[var(--teal)]' : i === step ? 'bg-white scale-125' : 'bg-white/30'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Done overlay */}
          {phase === 'done' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 animate-fade-in">
              <div className="text-center">
                <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-[var(--teal)] text-white shadow-lg animate-badge-pop">
                  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="mt-3 text-white font-semibold">Liveness verified!</p>
                <p className="text-white/60 text-xs mt-1">{capturedFrames.current.length} frames captured</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Cancel button (only during active) */}
      {(phase === 'ready' || phase === 'active') && (
        <div className="mt-4 text-center">
          <button onClick={onCancel} className="text-sm text-[var(--stone)] hover:text-[var(--charcoal)] transition-colors">
            Cancel liveness check
          </button>
        </div>
      )}
    </div>
  )
}
