'use client'

import { Insight } from '@/lib/types'
import { MessageSquare, Layers, Lightbulb, Zap } from 'lucide-react'
import { parseRecommendation } from '@/lib/utils'
import { useEffect, useState } from 'react'

interface Props {
  stats: {
    totalFeedback: number
    totalClusters: number
    totalInsights: number
  }
  insights: Insight[]
}

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    const duration = 1000
    const steps = 30
    const increment = value / steps
    let current = 0
    const timer = setInterval(() => {
      current += increment
      if (current >= value) {
        setDisplay(value)
        clearInterval(timer)
      } else {
        setDisplay(Math.floor(current))
      }
    }, duration / steps)
    return () => clearInterval(timer)
  }, [value])

  return <span>{display}</span>
}

export function StatsBar({ stats, insights }: Props) {
  const quickWins = insights.filter(i => {
    const rec = parseRecommendation(i.recommendation || '')
    return rec.quickWin
  }).length

  const cards = [
    {
      label: 'Feedback Analyzed',
      value: stats.totalFeedback,
      icon: MessageSquare,
      gradient: 'from-blue-500 to-indigo-600',
      bg: 'bg-blue-50',
      border: 'border-blue-100',
      delay: 'delay-100'
    },
    {
      label: 'Problem Clusters',
      value: stats.totalClusters,
      icon: Layers,
      gradient: 'from-violet-500 to-purple-600',
      bg: 'bg-violet-50',
      border: 'border-violet-100',
      delay: 'delay-200'
    },
    {
      label: 'Insights Generated',
      value: stats.totalInsights,
      icon: Lightbulb,
      gradient: 'from-amber-500 to-orange-500',
      bg: 'bg-amber-50',
      border: 'border-amber-100',
      delay: 'delay-300'
    },
    {
      label: 'Quick Wins',
      value: quickWins,
      icon: Zap,
      gradient: 'from-emerald-500 to-teal-500',
      bg: 'bg-emerald-50',
      border: 'border-emerald-100',
      delay: 'delay-400'
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`animate-fade-up ${card.delay} bg-white rounded-2xl p-5
            border ${card.border} card-hover cursor-default`}
        >
          <div className={`w-10 h-10 ${card.bg} rounded-xl flex items-center justify-center mb-4`}>
            <div className={`bg-gradient-to-br ${card.gradient} w-6 h-6 rounded-lg flex items-center justify-center`}>
              <card.icon className="w-3.5 h-3.5 text-white" />
            </div>
          </div>
          <div className="font-serif text-3xl text-[#1a1714]">
            <AnimatedNumber value={card.value} />
          </div>
          <div className="text-xs text-[#6b6560] mt-1 font-medium">{card.label}</div>
        </div>
      ))}
    </div>
  )
}