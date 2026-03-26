// FaceCompare.jsx - side by side ID photo vs selfie with match score
export default function FaceCompare({
  idImageBase64,
  selfieBase64,
  matchScore,
  verificationPassed,
  faceUncertain = false,
  idPhotoClarity = '',
  selfieClarity = ''
}) {
  const statusClasses = faceUncertain
    ? 'bg-amber-50 text-amber-700'
    : verificationPassed
      ? 'bg-green-50 text-green-700'
      : 'bg-red-50 text-red-700'

  const statusText = faceUncertain
    ? 'Face verification uncertain'
    : verificationPassed
      ? 'Face verification passed'
      : 'Face verification failed'

  const statusIcon = faceUncertain ? '⚠️' : verificationPassed ? '✅' : '❌'

  return (
    <div className="w-full">
      <div className="mb-4 flex justify-center gap-6">
        <div className="flex flex-col items-center gap-2">
          <img
            src={`data:image/jpeg;base64,${idImageBase64}`}
            alt="ID document photo"
            className="h-36 w-36 rounded-xl border-2 border-gray-200 object-cover shadow-sm"
          />
          <span className="text-xs font-medium text-gray-500">ID Document</span>
        </div>

        <div className="flex flex-col items-center justify-center gap-1">
          <div className={`text-3xl font-bold ${faceUncertain ? 'text-amber-600' : verificationPassed ? 'text-green-600' : 'text-red-500'}`}>
            {matchScore}%
          </div>
          <div className="text-xs text-gray-400">Match Score</div>
          <div className={`text-lg ${faceUncertain ? 'text-amber-500' : verificationPassed ? 'text-green-500' : 'text-red-500'}`}>
            {statusIcon}
          </div>
        </div>

        <div className="flex flex-col items-center gap-2">
          <img
            src={`data:image/jpeg;base64,${selfieBase64}`}
            alt="Live selfie capture"
            className="h-36 w-36 rounded-xl border-2 border-gray-200 object-cover shadow-sm"
          />
          <span className="text-xs font-medium text-gray-500">Live Selfie</span>
        </div>
      </div>

      <div className={`rounded-lg px-4 py-2 text-center text-sm font-semibold ${statusClasses}`}>
        {statusIcon} {statusText}
      </div>

      {(idPhotoClarity || selfieClarity) && (
        <div className="mt-3 text-center text-xs text-slate-500">
          ID photo clarity: {idPhotoClarity || 'unknown'} | Selfie clarity: {selfieClarity || 'unknown'}
        </div>
      )}
    </div>
  )
}
