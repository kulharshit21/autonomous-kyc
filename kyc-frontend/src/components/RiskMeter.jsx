import { useEffect, useState } from 'react'

const COLORS = {
  low: { bar: 'bg-emerald-500', text: 'text-emerald-600', bg: 'bg-emerald-50' },
  medium: { bar: 'bg-amber-500', text: 'text-amber-600', bg: 'bg-amber-50' },
  high: { bar: 'bg-red-500', text: 'text-red-600', bg: 'bg-red-50' }
}

export default function RiskMeter({ riskScore, riskCategory }) {
  const [display, setDisplay] = useState(0)
  const [width, setWidth] = useState(0)
  const c = COLORS[riskCategory] || COLORS.medium

  useEffect(() => {
    const t = setTimeout(() => setWidth(riskScore), 100)
    const dur = 800
    const start = performance.now()
    const anim = (now) => {
      const p = Math.min((now - start) / dur, 1)
      setDisplay(Math.round((1 - Math.pow(1 - p, 3)) * riskScore))
      if (p < 1) requestAnimationFrame(anim)
    }
    requestAnimationFrame(anim)
    return () => clearTimeout(t)
  }, [riskScore])

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-3">
        <span className="text-sm font-medium text-[var(--stone)]">Risk Level</span>
        <div className="flex items-baseline gap-1">
          <span className={`text-3xl font-bold ${c.text} animate-counter-up`}>{display}</span>
          <span className="text-sm text-[var(--stone-light)]">/100</span>
        </div>
      </div>
      <div className="w-full h-3 rounded-full bg-[var(--cream-dark)] overflow-hidden">
        <div
          className={`h-full rounded-full ${c.bar} transition-all duration-1000 ease-out`}
          style={{ width: `${width}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-[var(--stone-light)] mt-1.5 font-medium">
        <span>Low</span><span>Medium</span><span>High</span>
      </div>
    </div>
  )
}
