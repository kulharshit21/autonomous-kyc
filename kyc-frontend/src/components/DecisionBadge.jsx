const CONFIG = {
  approved: { label: 'Approved', cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200', icon: '✅' },
  review: { label: 'Manual Review', cls: 'bg-amber-50 text-amber-700 border border-amber-200', icon: '⚠️' },
  rejected: { label: 'Rejected', cls: 'bg-red-50 text-red-700 border border-red-200', icon: '❌' }
}

export default function DecisionBadge({ decision }) {
  const c = CONFIG[decision] || CONFIG.review
  return (
    <div className={`animate-badge-pop inline-flex items-center gap-2 px-6 py-3.5 rounded-full text-base font-bold ${c.cls}`}>
      <span className="text-lg">{c.icon}</span>
      <span>{c.label}</span>
    </div>
  )
}
