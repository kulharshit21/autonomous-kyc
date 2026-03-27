export default function FaceCompare({ idImageBase64, selfieBase64, matchScore, verificationPassed, faceUncertain = false, idPhotoClarity = '', selfieClarity = '' }) {
  const color = faceUncertain ? 'text-amber-600' : verificationPassed ? 'text-emerald-600' : 'text-red-600'
  const bgCls = faceUncertain ? 'bg-amber-50 border-amber-200 text-amber-700' : verificationPassed ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'
  const statusText = faceUncertain ? '⚠️ Uncertain' : verificationPassed ? '✅ Match Passed' : '❌ Match Failed'

  return (
    <div className="w-full">
      <div className="mb-4 flex justify-center gap-6 items-center">
        <div className="flex flex-col items-center gap-2">
          <img src={`data:image/jpeg;base64,${idImageBase64}`} alt="ID" className="h-36 w-36 rounded-2xl border-2 border-[var(--warm-border)] object-cover shadow-sm" />
          <span className="text-xs font-medium text-[var(--stone)]">ID Document</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className={`text-3xl font-bold ${color}`}>{matchScore}%</div>
          <div className="text-xs text-[var(--stone-light)]">Match Score</div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <img src={`data:image/jpeg;base64,${selfieBase64}`} alt="Selfie" className="h-36 w-36 rounded-2xl border-2 border-[var(--warm-border)] object-cover shadow-sm" />
          <span className="text-xs font-medium text-[var(--stone)]">Live Selfie</span>
        </div>
      </div>
      <div className={`rounded-xl border px-4 py-2.5 text-center text-sm font-semibold ${bgCls}`}>{statusText}</div>
      {(idPhotoClarity || selfieClarity) && (
        <div className="mt-3 text-center text-xs text-[var(--stone-light)]">
          ID clarity: {idPhotoClarity || 'unknown'} · Selfie clarity: {selfieClarity || 'unknown'}
        </div>
      )}
    </div>
  )
}
