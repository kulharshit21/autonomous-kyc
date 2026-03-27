import ProgressBar from './ProgressBar'

export default function StepCanvas({ currentStep, maxWidth = 'max-w-5xl', children }) {
  return (
    <div className="kyc-page-bg">
      <ProgressBar currentStep={currentStep} />
      <div className={`relative mx-auto ${maxWidth} px-4 py-10`}>
        <div className="relative animate-step-enter">
          {children}
        </div>
      </div>
    </div>
  )
}
