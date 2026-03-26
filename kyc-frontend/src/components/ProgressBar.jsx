// ProgressBar.jsx — 4-step progress indicator
const STEPS = [
  { number: 1, label: 'Customer Info' },
  { number: 2, label: 'Document Upload' },
  { number: 3, label: 'Face Verification' },
  { number: 4, label: 'Results' }
]

export default function ProgressBar({ currentStep }) {
  return (
    <div className="w-full bg-white border-b border-gray-200 px-6 py-4">
      <div className="max-w-3xl mx-auto flex items-center justify-between">
        {STEPS.map((step, index) => (
          <div key={step.number} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-all
                ${step.number < currentStep ? 'bg-green-500 border-green-500 text-white' : ''}
                ${step.number === currentStep ? 'bg-blue-600 border-blue-600 text-white' : ''}
                ${step.number > currentStep ? 'bg-white border-gray-300 text-gray-400' : ''}
              `}>
                {step.number < currentStep ? '✓' : step.number}
              </div>
              <span className={`mt-1 text-xs font-medium whitespace-nowrap
                ${step.number === currentStep ? 'text-blue-600' : ''}
                ${step.number < currentStep ? 'text-green-600' : ''}
                ${step.number > currentStep ? 'text-gray-400' : ''}
              `}>
                {step.label}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 mb-4 transition-all
                ${step.number < currentStep ? 'bg-green-400' : 'bg-gray-200'}
              `} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
