const STEPS = [
  { number: 1, label: 'Customer Info' },
  { number: 2, label: 'Document Upload' },
  { number: 3, label: 'Face Verification' },
  { number: 4, label: 'Results' }
]

export default function ProgressBar({ currentStep }) {
  return (
    <div className="w-full border-b border-[var(--warm-border)] bg-white/80 backdrop-blur-sm px-4 py-5">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--teal)]">
              Autonomous KYC
            </p>
            <h2 className="text-base font-semibold text-[var(--charcoal)]">
              Identity Verification
            </h2>
          </div>
          <div className="rounded-full border border-[var(--warm-border)] bg-[var(--cream-mid)] px-3 py-1.5 text-xs font-medium text-[var(--stone)]">
            Step {currentStep} / {STEPS.length}
          </div>
        </div>

        <div className="flex items-center">
          {STEPS.map((step, index) => {
            const done = step.number < currentStep
            const active = step.number === currentStep
            return (
              <div key={step.number} className="flex flex-1 items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition-all duration-400
                      ${done ? 'bg-[var(--teal)] text-white' : ''}
                      ${active ? 'bg-[var(--teal)] text-white ring-4 ring-[var(--teal-subtle)]' : ''}
                      ${!done && !active ? 'bg-[var(--cream-dark)] text-[var(--stone)]' : ''}
                    `}
                  >
                    {done ? (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : step.number}
                  </div>
                  <span className={`mt-2 whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.1em]
                    ${active ? 'text-[var(--teal)]' : done ? 'text-[var(--teal-dark)]' : 'text-[var(--stone-light)]'}
                  `}>
                    {step.label}
                  </span>
                </div>

                {index < STEPS.length - 1 && (
                  <div className="relative mx-3 mb-5 h-[2px] flex-1 rounded-full bg-[var(--cream-dark)]">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-[var(--teal)] transition-all duration-700 ease-out"
                      style={{ width: done ? '100%' : active ? '40%' : '0%' }}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
