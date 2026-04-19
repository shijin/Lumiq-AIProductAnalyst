'use client'
import { Insight } from '@/lib/types'
import { parseRecommendation } from '@/lib/utils'
import { MessageSquare, Layers, Lightbulb, Zap, ArrowUpRight } from 'lucide-react'
import { useEffect, useState } from 'react'

function Counter({ to, delay = 0 }: { to: number; delay?: number }) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => {
      let start = 0
      const step = Math.ceil(to / 40)
      const id = setInterval(() => {
        start += step
        if (start >= to) { setVal(to); clearInterval(id) }
        else setVal(start)
      }, 28)
    }, delay)
    return () => clearTimeout(t)
  }, [to, delay])
  return <>{val}</>
}

interface Props {
  stats: { totalFeedback: number; totalClusters: number; totalInsights: number }
  insights: Insight[]
}

export function StatsBar({ stats, insights }: Props) {
  const quickWins = insights.filter(i =>
    parseRecommendation(i.recommendation || '').quickWin
  ).length

  const cards = [
    {
      label: 'Feedback Analyzed',
      value: stats.totalFeedback,
      icon: MessageSquare,
      accent: '#F97316',
      accentBg: 'rgba(249,115,22,0.1)',
      borderGlow: 'rgba(249,115,22,0.3)',
      delay: 100,
      anim: 'd-100',
      trend: '+12% this week'
    },
    {
      label: 'Problem Clusters',
      value: stats.totalClusters,
      icon: Layers,
      accent: '#A78BFA',
      accentBg: 'rgba(167,139,250,0.1)',
      borderGlow: 'rgba(167,139,250,0.3)',
      delay: 180,
      anim: 'd-150',
      trend: 'Auto-detected'
    },
    {
      label: 'Insights Generated',
      value: stats.totalInsights,
      icon: Lightbulb,
      accent: '#60A5FA',
      accentBg: 'rgba(96,165,250,0.1)',
      borderGlow: 'rgba(96,165,250,0.3)',
      delay: 260,
      anim: 'd-200',
      trend: 'AI-powered'
    },
    {
      label: 'Quick Wins',
      value: quickWins,
      icon: Zap,
      accent: '#34D399',
      accentBg: 'rgba(52,211,153,0.1)',
      borderGlow: 'rgba(52,211,153,0.3)',
      delay: 340,
      anim: 'd-300',
      trend: 'Act this sprint'
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className={`anim-fade-up ${c.anim} relative overflow-hidden
            rounded-2xl p-5 cursor-default transition-all duration-300`}
          style={{
            background: 'var(--bg-card)',
            border: `1px solid var(--border)`,
            boxShadow: `0 0 0 0px ${c.borderGlow}`,
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.boxShadow = `0 0 0 1px ${c.borderGlow}, 0 8px 24px ${c.borderGlow}`
            ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.boxShadow = `0 0 0 0px ${c.borderGlow}`
            ;(e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
          }}
        >
          {/* Subtle top accent line */}
          <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl"
            style={{ background: `linear-gradient(90deg, ${c.accent}, transparent)` }}
          />

          {/* Icon + trend row */}
          <div className="flex items-center justify-between mb-5">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ background: c.accentBg }}>
              <c.icon className="w-4 h-4" style={{ color: c.accent }} />
            </div>
            <div className="flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3" style={{ color: c.accent }} />
              <span className="text-xs font-medium" style={{ color: c.accent }}>
                {c.trend}
              </span>
            </div>
          </div>

          {/* Number */}
          <div className="font-display text-4xl font-bold mb-1.5"
            style={{ color: 'var(--text-primary)' }}>
            <Counter to={c.value} delay={c.delay} />
          </div>

          {/* Label */}
          <p className="text-sm font-medium"
            style={{ color: 'var(--text-secondary)' }}>
            {c.label}
          </p>
        </div>
      ))}
    </div>
  )
}