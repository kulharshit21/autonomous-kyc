import { useEffect, useMemo, useState } from 'react'

function buildSteps() {
  return [
    'Preparing the captured selfie for comparison',
    'Locating the portrait inside the uploaded ID',
    'Comparing selfie features with the ID photo',
    'Checking liveness and same-person confidence',
    'Finalizing face verification result'
  ]
}

export default function FaceVerificationChecklistLoader() {
  const steps = useMemo(() => buildSteps(), [])
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    setActiveIndex(0)

    const interval = setInterval(() => {
      setActiveIndex((current) => (current < steps.length - 1 ? current + 1 : current))
    }, 900)

    return () => clearInterval(interval)
  }, [steps])

  return (
    <div className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-sky-50 p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/90 border-t-transparent" />
        </div>

        <div className="flex-1">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-700">
            Face Check In Progress
          </p>
          <h3 className="mt-1 text-lg font-semibold text-gray-900">
            Comparing the live selfie with the ID portrait
          </h3>
          <p className="mt-2 text-sm text-gray-600">
            We are checking the captured photo step by step so the match result is easier to trust and explain.
          </p>

          <div className="mt-5 space-y-3">
            {steps.map((step, index) => {
              const isDone = index < activeIndex
              const isCurrent = index === activeIndex

              return (
                <div
                  key={step}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-all duration-500 ${
                    isDone
                      ? 'border-emerald-200 bg-emerald-50'
                      : isCurrent
                      ? 'border-violet-200 bg-white shadow-sm'
                      : 'border-gray-200 bg-white/70'
                  }`}
                >
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold transition-all ${
                      isDone
                        ? 'bg-emerald-500 text-white'
                        : isCurrent
                        ? 'bg-slate-950 text-white'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {isDone ? '✓' : isCurrent ? '…' : index + 1}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${isDone || isCurrent ? 'text-gray-900' : 'text-gray-500'}`}>
                      {step}
                    </p>
                  </div>
                  {isCurrent && <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-violet-500" />}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
