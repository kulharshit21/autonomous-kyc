import { useEffect, useRef, useState } from 'react'

/**
 * ScannerLightbox — full-screen overlay showing a document being "scanned"
 */
export default function ScannerLightbox({ imageSrc, label = 'Scanning document...', onClose }) {
  const [phase, setPhase] = useState('scanning')
  const timerRef = useRef(null)

  useEffect(() => {
    setPhase('scanning')
    timerRef.current = setTimeout(() => {
      setPhase('done')
    }, 3400)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  const handleDone = () => {
    if (onClose) onClose()
  }

  return (
    <div className="scanner-lightbox" onClick={phase === 'done' ? handleDone : undefined}>
      <div className="flex flex-col items-center gap-6" onClick={e => e.stopPropagation()}>
        {/* Scanner frame */}
        <div className="scanner-frame">
          {imageSrc && (
            <img
              src={imageSrc.startsWith('data:') ? imageSrc : `data:image/jpeg;base64,${imageSrc}`}
              alt="Document being scanned"
            />
          )}

          {/* Animated scan line */}
          {phase === 'scanning' && <div className="scanner-line" />}

          {/* Corner brackets */}
          <div className="scanner-corner scanner-corner-tl" />
          <div className="scanner-corner scanner-corner-tr" />
          <div className="scanner-corner scanner-corner-bl" />
          <div className="scanner-corner scanner-corner-br" />

          {/* Done overlay */}
          {phase === 'done' && (
            <div className="absolute inset-0 flex items-center justify-center bg-teal-700/30 animate-fade-in">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-lg animate-badge-pop">
                <svg className="h-8 w-8 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          )}
        </div>

        {/* Status */}
        <div className="text-center">
          <p className="text-white text-sm font-semibold tracking-wide">
            {phase === 'done' ? '✅ Scan complete — processing...' : label}
          </p>
          {phase === 'scanning' && (
            <div className="mt-3 flex items-center justify-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-pulse" />
              <div className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-pulse" style={{ animationDelay: '200ms' }} />
              <div className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-pulse" style={{ animationDelay: '400ms' }} />
            </div>
          )}
          {phase === 'done' && (
            <button onClick={handleDone} className="mt-4 rounded-xl bg-white/20 border border-white/30 px-6 py-2 text-sm font-medium text-white hover:bg-white/30 transition-all">
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
