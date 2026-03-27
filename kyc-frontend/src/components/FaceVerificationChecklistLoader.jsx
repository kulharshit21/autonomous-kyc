import { useEffect, useMemo, useState } from 'react'

function buildSteps() {
  return [
    'Preparing the captured selfie',
    'Locating the portrait in the ID',
    'Comparing selfie with ID photo',
    'Checking liveness signals',
    'Finalizing face verification'
  ]
}

export default function FaceVerificationChecklistLoader() {
  const steps = useMemo(() => buildSteps(), [])
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    setActiveIndex(0)
    const interval = setInterval(() => {
      setActiveIndex(c => (c < steps.length - 1 ? c + 1 : c))
    }, 900)
    return () => clearInterval(interval)
  }, [steps])

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--teal)] text-white">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/80 border-t-transparent" />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--teal)]">Face Check In Progress</p>
          <h3 className="mt-1 text-base font-semibold text-[var(--charcoal)]">Comparing selfie with ID portrait</h3>
        </div>
      </div>

      <div className="space-y-2">
        {steps.map((step, i) => {
          const done = i < activeIndex, cur = i === activeIndex
          return (
            <div key={step} className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-all duration-400 ${
              done ? 'border-emerald-200 bg-emerald-50' : cur ? 'border-[var(--teal)]/30 bg-[var(--teal-subtle)]' : 'border-[var(--warm-border)] bg-[var(--warm-white)]'
            }`}>
              <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                done ? 'bg-emerald-500 text-white' : cur ? 'bg-[var(--teal)] text-white' : 'bg-[var(--cream-dark)] text-[var(--stone)]'
              }`}>
                {done ? '✓' : cur ? '…' : i + 1}
              </div>
              <p className={`text-sm font-medium ${done || cur ? 'text-[var(--charcoal)]' : 'text-[var(--stone)]'}`}>{step}</p>
              {cur && <div className="ml-auto h-2 w-2 animate-pulse rounded-full bg-[var(--teal)]" />}
            </div>
          )
        })}
      </div>
    </div>
  )
}
