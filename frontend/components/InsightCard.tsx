'use client'
import { useState, useEffect } from 'react'
import { Insight } from '@/lib/types'
import { getSeverityFromScore, parseRecommendation, formatScore } from '@/lib/utils'
import { ChevronDown, Zap, Target, TrendingUp, Shield, AlertCircle } from 'lucide-react'


interface Props { insight: Insight; index: number }

const RANK_STYLES: Record<number, { grad: string; glow: string; text: string }> = {
  1: { grad: 'linear-gradient(135deg,#EF4444,#DC2626)', glow: 'rgba(239,68,68,0.12)',   text: '#EF4444' },
  2: { grad: 'linear-gradient(135deg,#F97316,#EA580C)', glow: 'rgba(249,115,22,0.12)',  text: '#F97316' },
  3: { grad: 'linear-gradient(135deg,#F59E0B,#D97706)', glow: 'rgba(245,158,11,0.12)',  text: '#F59E0B' },
  4: { grad: 'linear-gradient(135deg,#34D399,#059669)', glow: 'rgba(52,211,153,0.12)',  text: '#34D399' },
  5: { grad: 'linear-gradient(135deg,#38BDF8,#0284C7)', glow: 'rgba(56,189,248,0.12)', text: '#38BDF8' },
  6: { grad: 'linear-gradient(135deg,#A78BFA,#7C3AED)', glow: 'rgba(167,139,250,0.12)',text: '#A78BFA' },
  7: { grad: 'linear-gradient(135deg,#F472B6,#DB2777)', glow: 'rgba(244,114,182,0.12)',text: '#F472B6' },
}
const DEFAULT_STYLE = {
  grad: 'linear-gradient(135deg,#94A3B8,#64748B)',
  glow: 'transparent',
  text: '#94A3B8'
}

const SEV_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  critical: { bg: 'var(--danger-light)',  text: 'var(--danger)',  border: 'rgba(220,38,38,0.2)' },
  high:     { bg: 'var(--accent-light)',  text: 'var(--accent)',  border: 'rgba(249,115,22,0.2)' },
  medium:   { bg: 'var(--warning-light)', text: 'var(--warning)', border: 'rgba(217,119,6,0.2)' },
  low:      { bg: 'var(--success-light)', text: 'var(--success)', border: 'rgba(22,163,74,0.2)' },
}

const EFFORT_STYLE: Record<string, string> = {
  LOW: 'var(--success)', MEDIUM: 'var(--warning)', HIGH: 'var(--danger)'
}

function ScorePill({
  l, v, icon: Icon,
  lightBg, darkBg,
  lightText, darkText,
  lightBorder, darkBorder
}: any) {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const check = () =>
      setIsDark(document.documentElement.classList.contains('dark'))
    check()
    const obs = new MutationObserver(check)
    obs.observe(document.documentElement, {
      attributes: true, attributeFilter: ['class']
    })
    return () => obs.disconnect()
  }, [])

  const bg     = isDark ? darkBg     : lightBg
  const text   = isDark ? darkText   : lightText
  const border = isDark ? darkBorder : lightBorder

  return (
    <div className="rounded-2xl p-3.5 text-center transition-all duration-300"
      style={{ background: bg, border: `1px solid ${border}` }}>
      <Icon className="w-3.5 h-3.5 mx-auto mb-1.5"
        style={{ color: text, opacity: 0.85 }} />
      <div className="font-display text-base font-bold"
        style={{ color: text }}>
        {Math.round(v * 100)}%
      </div>
      <div className="text-xs mt-0.5 font-medium"
        style={{ color: text, opacity: 0.7 }}>
        {l}
      </div>
    </div>
  )
}

export function InsightCard({ insight, index }: Props) {
  const [open, setOpen] = useState(false)
  const sev   = getSeverityFromScore(insight.severity_score)
  const rec   = parseRecommendation(insight.recommendation || '')
  const style = RANK_STYLES[insight.priority_rank] || DEFAULT_STYLE
  const ss    = SEV_STYLE[sev] || SEV_STYLE.medium

  return (
    <div
      className="anim-fade-up card overflow-hidden"
      style={{
        animationDelay: `${index * 70}ms`,
        boxShadow: insight.priority_rank <= 3
          ? `var(--shadow-sm), 0 0 0 1px var(--border), 0 4px 20px ${style.glow}`
          : undefined
      }}
    >
      {/* Top gradient line */}
      <div className="h-[3px] w-full" style={{ background: style.grad }} />

      <div className="p-6">

        {/* ── Header ── */}
        <div className="flex items-start gap-4">

          {/* Rank badge */}
          <div className="shrink-0 w-11 h-11 rounded-2xl flex items-center
            justify-center text-white font-display font-bold text-sm shadow-md"
            style={{ background: style.grad }}>
            #{insight.priority_rank}
          </div>

          <div className="flex-1 min-w-0">
            {/* Title row */}
            <div className="flex flex-wrap items-center gap-2 mb-2.5">
              <h3 className="font-display text-lg font-semibold"
                style={{ color: 'var(--text-primary)' }}>
                {insight.cluster?.cluster_label}
              </h3>
              {rec.quickWin && (
                <span className="tag" style={{
                  background: 'var(--success-light)',
                  color: 'var(--success)',
                  border: '1px solid rgba(22,163,74,0.2)'
                }}>
                  <Zap className="w-3 h-3" /> Quick Win
                </span>
              )}
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-2">
              <span className="tag" style={{
                background: ss.bg, color: ss.text,
                border: `1px solid ${ss.border}`
              }}>
                <AlertCircle className="w-3 h-3" />
                {sev}
              </span>

              <span className="tag" style={{
                background: 'var(--bg)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border)'
              }}>
                {insight.cluster?.feedback_count} rows
              </span>

              <span className="tag" style={{
                background: 'var(--bg)',
                color: EFFORT_STYLE[rec.effort] || 'var(--text-secondary)',
                border: '1px solid var(--border)'
              }}>
                {rec.effort} effort
              </span>
            </div>
          </div>

          {/* Expand button */}
          <button onClick={() => setOpen(!open)}
            className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center
              transition-all duration-200 hover:scale-105 active:scale-95"
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)'
            }}
          >
            <ChevronDown className={`w-4 h-4 transition-transform duration-300
              ${open ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* ── Score pills ── */}
        <div className="grid grid-cols-3 gap-3 mt-5">
          {[
            {
              l: 'Frequency',
              v: insight.frequency_score,
              icon: TrendingUp,
              bg: 'rgba(14,165,233,0.15)',
              text: '#38BDF8',
              border: 'rgba(56,189,248,0.35)',
            },
            {
              l: 'Severity',
              v: insight.severity_score,
              icon: AlertCircle,
              bg: 'rgba(239,68,68,0.15)',
              text: '#F87171',
              border: 'rgba(248,113,113,0.35)',
            },
            {
              l: 'Confidence',
              v: insight.confidence_score,
              icon: Shield,
              bg: 'rgba(34,197,94,0.15)',
              text: '#4ADE80',
              border: 'rgba(74,222,128,0.35)',
            },
          ].map(s => (
            <div key={s.l}
              className="rounded-2xl p-3.5 text-center transition-all duration-200"
              style={{
                background: s.bg,
                border: `1px solid ${s.border}`,
              }}
            >
              <s.icon className="w-3.5 h-3.5 mx-auto mb-1.5"
                style={{ color: s.text }} />
              <div className="font-display text-base font-bold"
                style={{ color: s.text }}>
                {Math.round(s.v * 100)}%
              </div>
              <div className="text-xs mt-0.5 font-medium"
                style={{ color: s.text, opacity: 0.75 }}>
                {s.l}
              </div>
            </div>
          ))}
        </div>

        {/* ── Root cause ── */}
        <div className="mt-4 p-4 rounded-2xl"
          style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
          <p className="text-xs font-bold uppercase tracking-widest mb-1.5"
            style={{ color: 'var(--accent)' }}>
            Root Cause
          </p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
            {insight.root_cause}
          </p>
        </div>

        {/* ── Expanded ── */}
        {open && (
          <div className="anim-expand mt-5 space-y-5 pt-5"
            style={{ borderTop: '1px solid var(--border)' }}>

            {/* What to fix */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-2"
                style={{ color: 'var(--text-muted)' }}>
                What to Fix
              </p>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                {rec.whatToFix}
              </p>
            </div>

            {/* Actions */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-3"
                style={{ color: 'var(--text-muted)' }}>
                Recommended Actions
              </p>
              <div className="space-y-2.5">
                {rec.actions.map((a, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="shrink-0 w-6 h-6 rounded-lg flex items-center
                      justify-center text-white text-xs font-bold font-display mt-0.5"
                      style={{ background: style.grad }}>
                      {i + 1}
                    </div>
                    <p className="text-sm leading-relaxed flex-1"
                      style={{ color: 'var(--text-primary)' }}>
                      {a}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Success metric */}
            <div className="flex items-start gap-3 p-4 rounded-2xl"
              style={{ background: 'var(--success-light)', border: '1px solid rgba(22,163,74,0.15)' }}>
              <Target className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--success)' }} />
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-1"
                  style={{ color: 'var(--success)' }}>
                  Success Metric
                </p>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                  {rec.successMetric}
                </p>
              </div>
            </div>

            {/* Contributing factors */}
            {insight.evidence && (
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-2.5"
                  style={{ color: 'var(--text-muted)' }}>
                  Contributing Factors
                </p>
                <div className="flex flex-wrap gap-2">
                  {insight.evidence.split(' | ').map((f, i) => (
                    <span key={i} className="tag"
                      style={{
                        background: 'var(--bg)',
                        color: 'var(--text-secondary)',
                        border: '1px solid var(--border)'
                      }}>
                      {f}
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