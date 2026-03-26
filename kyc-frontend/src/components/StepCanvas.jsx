import ProgressBar from './ProgressBar'

export default function StepCanvas({ currentStep, maxWidth = 'max-w-5xl', children }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#f8fafc_0%,#f1f5f9_52%,#e8eef6_100%)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-10%] top-28 h-[460px] w-[460px] rounded-full bg-[radial-gradient(circle,rgba(148,163,184,0.18)_0%,rgba(148,163,184,0.06)_38%,transparent_72%)] blur-3xl" />
        <div className="absolute right-[-8%] top-44 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.10)_0%,rgba(59,130,246,0.03)_40%,transparent_74%)] blur-3xl" />
        <div className="absolute bottom-[-10%] left-1/2 h-[420px] w-[860px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.92)_0%,rgba(255,255,255,0.48)_44%,transparent_80%)] blur-2xl" />
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(148,163,184,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.16) 1px, transparent 1px)',
            backgroundSize: '56px 56px'
          }}
        />
      </div>

      <ProgressBar currentStep={currentStep} />

      <div className={`relative mx-auto ${maxWidth} px-4 py-10`}>
        <div className="pointer-events-none absolute inset-x-4 top-8 hidden h-[calc(100%-5rem)] rounded-[40px] border border-white/50 bg-white/24 shadow-[0_30px_80px_rgba(148,163,184,0.14)] backdrop-blur-[2px] lg:block" />
        <div className="relative animate-step-enter">
          {children}
        </div>
      </div>
    </div>
  )
}
