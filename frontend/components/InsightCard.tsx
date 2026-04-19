'use client'

import { useState } from 'react'
import { Insight } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import {
  getSeverityFromScore, getSeverityColor,
  getPriorityColor, parseRecommendation, formatScore
} from '@/lib/utils'
import {
  ChevronDown, ChevronUp, Zap, Target,
  TrendingUp, Shield, AlertCircle, CheckCircle2
} from 'lucide-react'

interface Props {
  insight: Insight
  index: number
}

export function InsightCard({ insight, index }: Props) {
  const [expanded, setExpanded] = useState(false)
  const severity = getSeverityFromScore(insight.severity_score)
  const rec = parseRecommendation(insight.recommendation || '')
  const isTop3 = insight.priority_rank <= 3

  const priorityGradients: Record<number, string> = {
    1: 'from-red-500 to-rose-600',
    2: 'from-orange-500 to-amber-500',
    3: 'from-yellow-400 to-amber-400',
  }
  const gradient = priorityGradients[insight.priority_rank] || 'from-slate-400 to-slate-500'

  return (
    <div
      className={`animate-fade-up bg-white rounded-2xl border overflow-hidden card-hover
        ${isTop3 ? 'border-amber-200 shadow-amber-50' : 'border-[#ede8df]'}
        shadow-sm`}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Top accent bar */}
      <div className={`h-1 bg-gradient-to-r ${gradient}`} />

      <div className="p-5 sm:p-6">

        {/* Header row */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">

            {/* Rank badge */}
            <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center
              text-white font-bold text-sm bg-gradient-to-br ${gradient} shadow-sm`}
            >
              #{insight.priority_rank}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <h3 className="font-serif text-lg text-[#1a1714]">
                  {insight.cluster?.cluster_label}
                </h3>
                {rec.quickWin && (
                  <span className="inline-flex items-center gap-1 text-xs bg-emerald-100
                    text-emerald-700 px-2 py-0.5 rounded-full font-medium border border-emerald-200">
                    <Zap className="w-3 h-3" /> Quick Win
                  </span>
                )}
              </div>

              {/* Badges */}
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline"
                  className={`text-xs font-medium ${getSeverityColor(insight.severity_score)}`}>
                  <AlertCircle className="w-3 h-3 mr-1" />
                  {severity}
                </Badge>
                <Badge variant="outline"
                  className="text-xs text-[#6b6560] border-[#ede8df] bg-[#faf7f2]">
                  {insight.cluster?.feedback_count} feedback rows
                </Badge>
                <Badge variant="outline"
                  className={`text-xs border-[#ede8df]
                    ${rec.effort === 'LOW' ? 'text-emerald-600 bg-emerald-50' :
                      rec.effort === 'HIGH' ? 'text-red-600 bg-red-50' :
                      'text-amber-600 bg-amber-50'}`}>
                  {rec.effort} effort
                </Badge>
              </div>
            </div>
          </div>

          {/* Expand toggle */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="shrink-0 p-2 rounded-xl hover:bg-[#faf7f2] text-[#6b6560]
              hover:text-[#1a1714] transition-all duration-200"
          >
            <div className={`transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}>
              <ChevronDown className="w-5 h-5" />
            </div>
          </button>
        </div>

        {/* Score pills */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          {[
            { label: 'Frequency', value: insight.frequency_score, icon: TrendingUp, color: 'text-blue-600 bg-blue-50 border-blue-100' },
            { label: 'Severity', value: insight.severity_score, icon: AlertCircle, color: 'text-red-600 bg-red-50 border-red-100' },
            { label: 'Confidence', value: insight.confidence_score, icon: Shield, color: 'text-violet-600 bg-violet-50 border-violet-100' },
          ].map((score) => (
            <div key={score.label}
              className={`${score.color} rounded-xl p-3 text-center border`}>
              <score.icon className="w-3.5 h-3.5 mx-auto mb-1.5 opacity-60" />
              <div className="text-base font-bold">{formatScore(score.value)}</div>
              <div className="text-xs opacity-60 mt-0.5">{score.label}</div>
            </div>
          ))}
        </div>

        {/* Root cause */}
        <div className="mt-4 p-4 bg-[#faf7f2] rounded-xl border border-[#ede8df]">
          <p className="text-xs font-semibold text-[#6b6560] uppercase tracking-widest mb-2">
            Root Cause
          </p>
          <p className="text-sm text-[#1a1714] leading-relaxed">
            {insight.root_cause}
          </p>
        </div>

        {/* Expanded content */}
        {expanded && (
          <div className="animate-expand mt-4 space-y-4 border-t border-[#ede8df] pt-4">

            {/* What to fix */}
            <div>
              <p className="text-xs font-semibold text-[#6b6560] uppercase tracking-widest mb-2">
                What to Fix
              </p>
              <p className="text-sm text-[#1a1714] leading-relaxed">{rec.whatToFix}</p>
            </div>

            {/* Actions */}
            <div>
              <p className="text-xs font-semibold text-[#6b6560] uppercase tracking-widest mb-3">
                Recommended Actions
              </p>
              <div className="space-y-2.5">
                {rec.actions.map((action, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="shrink-0 w-6 h-6 bg-gradient-to-br from-amber-500 to-orange-500
                      text-white rounded-lg flex items-center justify-center text-xs font-bold mt-0.5">
                      {i + 1}
                    </div>
                    <p className="text-sm text-[#1a1714] leading-relaxed">{action}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Success metric */}
            <div className="flex items-start gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
              <Target className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-emerald-700 mb-1 uppercase tracking-widest">
                  Success Metric
                </p>
                <p className="text-sm text-emerald-800 leading-relaxed">{rec.successMetric}</p>
              </div>
            </div>

            {/* Contributing factors */}
            {insight.evidence && (
              <div>
                <p className="text-xs font-semibold text-[#6b6560] uppercase tracking-widest mb-2">
                  Contributing Factors
                </p>
                <div className="flex flex-wrap gap-2">
                  {insight.evidence.split(' | ').map((factor, i) => (
                    <span key={i}
                      className="text-xs bg-[#faf7f2] text-[#6b6560] px-3 py-1.5
                        rounded-full border border-[#ede8df]">
                      {factor}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}