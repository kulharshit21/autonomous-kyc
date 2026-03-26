import { useEffect, useMemo, useState } from 'react'

function buildSteps({ hasPDF, fileCount }) {
  const steps = [
    hasPDF ? 'Converting PDF pages to images' : 'Preparing uploaded images',
    fileCount > 1 ? 'Combining document views for analysis' : 'Optimizing document for analysis',
    'Reading text and ID markers with Pixtral',
    'Extracting names, dates, and document number',
    'Checking document quality and consistency'
  ]

  return steps
}

export default function VerificationChecklistLoader({ hasPDF = false, fileCount = 1 }) {
  const steps = useMemo(() => buildSteps({ hasPDF, fileCount }), [hasPDF, fileCount])
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    setActiveIndex(0)

    const interval = setInterval(() => {
      setActiveIndex((current) => (current < steps.length - 1 ? current + 1 : current))
    }, 950)

    return () => clearInterval(interval)
  }, [steps])

  return (
    <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-sky-50 p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
          <div className="h-5 w-5 rounded-full border-2 border-white/90 border-t-transparent animate-spin" />
        </div>

        <div className="flex-1">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
            Verification In Progress
          </p>
          <h3 className="mt-1 text-lg font-semibold text-gray-900">
            Analysing document pages with Mistral Pixtral
          </h3>
          <p className="mt-2 text-sm text-gray-600">
            We&apos;re validating the uploaded document step by step so the extracted details are cleaner and easier to trust.
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
                      ? 'border-blue-200 bg-white shadow-sm'
                      : 'border-gray-200 bg-white/70'
                  }`}
                >
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold transition-all ${
                      isDone
                        ? 'bg-emerald-500 text-white'
                        : isCurrent
                        ? 'bg-blue-600 text-white'
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
                  {isCurrent && <div className="h-2.5 w-2.5 rounded-full bg-blue-500 animate-pulse" />}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
