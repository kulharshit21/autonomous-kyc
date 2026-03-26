// RiskMeter.jsx — visual risk score bar (0-100)
const COLOR = {
  low: 'bg-green-500',
  medium: 'bg-amber-500',
  high: 'bg-red-500'
}

const LABEL = {
  low: 'text-green-600',
  medium: 'text-amber-600',
  high: 'text-red-600'
}

export default function RiskMeter({ riskScore, riskCategory }) {
  const colorClass = COLOR[riskCategory] || COLOR.medium
  const labelClass = LABEL[riskCategory] || LABEL.medium

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-gray-600">Risk Score</span>
        <span className={`text-2xl font-bold ${labelClass}`}>
          {riskScore}<span className="text-sm font-normal text-gray-400">/100</span>
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
        <div
          className={`h-4 rounded-full transition-all duration-700 ${colorClass}`}
          style={{ width: `${riskScore}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-400 mt-1">
        <span>0 — Low</span>
        <span>50 — Medium</span>
        <span>100 — High</span>
      </div>
    </div>
  )
}
