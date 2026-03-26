// FaceCompare.jsx — side by side ID photo vs selfie with match score
export default function FaceCompare({ idImageBase64, selfieBase64, matchScore, verificationPassed }) {
  return (
    <div className="w-full">
      <div className="flex gap-6 justify-center mb-4">
        <div className="flex flex-col items-center gap-2">
          <img
            src={`data:image/jpeg;base64,${idImageBase64}`}
            alt="ID document photo"
            className="w-36 h-36 object-cover rounded-xl border-2 border-gray-200 shadow-sm"
          />
          <span className="text-xs text-gray-500 font-medium">ID Document</span>
        </div>

        <div className="flex flex-col items-center justify-center gap-1">
          <div className={`text-3xl font-bold ${verificationPassed ? 'text-green-600' : 'text-red-500'}`}>
            {matchScore}%
          </div>
          <div className="text-xs text-gray-400">Match Score</div>
          <div className={`text-lg ${verificationPassed ? 'text-green-500' : 'text-red-500'}`}>
            {verificationPassed ? '✓' : '✗'}
          </div>
        </div>

        <div className="flex flex-col items-center gap-2">
          <img
            src={`data:image/jpeg;base64,${selfieBase64}`}
            alt="Live selfie capture"
            className="w-36 h-36 object-cover rounded-xl border-2 border-gray-200 shadow-sm"
          />
          <span className="text-xs text-gray-500 font-medium">Live Selfie</span>
        </div>
      </div>

      <div className={`text-center text-sm font-semibold py-2 px-4 rounded-lg
        ${verificationPassed ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
        {verificationPassed ? '✅ Face verification passed' : '❌ Face verification failed'}
      </div>
    </div>
  )
}
