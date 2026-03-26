const STEPS = [
  { number: 1, label: 'Customer Info' },
  { number: 2, label: 'Document Upload' },
  { number: 3, label: 'Face Verification' },
  { number: 4, label: 'Results' }
]

export default function ProgressBar({ currentStep }) {
  return (
    <div className="w-full border-b border-slate-200/80 bg-white/88 px-4 py-5 backdrop-blur-sm">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Autonomous KYC
            </p>
            <h2 className="text-lg font-semibold text-slate-950">
              Identity Verification Workflow
            </h2>
          </div>
          <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
            Step {currentStep} of {STEPS.length}
          </div>
        </div>

        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => (
            <div key={step.number} className="flex flex-1 items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold transition-all
                    ${step.number < currentStep ? 'border-emerald-500 bg-emerald-500 text-white shadow-[0_8px_18px_rgba(16,185,129,0.28)]' : ''}
                    ${step.number === currentStep ? 'border-slate-950 bg-slate-950 text-white shadow-[0_10px_24px_rgba(15,23,42,0.24)]' : ''}
                    ${step.number > currentStep ? 'border-slate-300 bg-white text-slate-400' : ''}
                  `}
                >
                  {step.number < currentStep ? '✓' : step.number}
                </div>
                <span
                  className={`mt-2 whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.12em]
                    ${step.number === currentStep ? 'text-slate-950' : ''}
                    ${step.number < currentStep ? 'text-emerald-600' : ''}
                    ${step.number > currentStep ? 'text-slate-400' : ''}
                  `}
                >
                  {step.label}
                </span>
              </div>

              {index < STEPS.length - 1 && (
                <div
                  className={`mx-3 mb-5 h-px flex-1 transition-all
                    ${step.number < currentStep ? 'bg-emerald-400' : 'bg-slate-200'}
                  `}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
