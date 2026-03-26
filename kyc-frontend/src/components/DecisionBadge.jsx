// DecisionBadge.jsx — approved / review / rejected badge
const CONFIG = {
  approved: {
    label: 'Approved',
    classes: 'bg-green-100 text-green-700 border border-green-300',
    icon: '✅'
  },
  review: {
    label: 'Manual Review Required',
    classes: 'bg-amber-100 text-amber-700 border border-amber-300',
    icon: '⚠️'
  },
  rejected: {
    label: 'Rejected',
    classes: 'bg-red-100 text-red-700 border border-red-300',
    icon: '❌'
  }
}

export default function DecisionBadge({ decision }) {
  const config = CONFIG[decision] || CONFIG.review

  return (
    <div className={`inline-flex items-center gap-2 px-5 py-3 rounded-full text-base font-semibold ${config.classes}`}>
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </div>
  )
}
