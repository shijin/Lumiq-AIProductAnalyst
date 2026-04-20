'use client'
import { useEffect, useState } from 'react'
import {
  getInsightsWithClusters, getDashboardStats,
  getSentimentBreakdown, getIntentBreakdown,
  getPipelineStatus
} from '@/lib/data'
import { Insight } from '@/lib/types'
import { InsightCard } from '@/components/InsightCard'
import { StatsBar } from '@/components/StatsBar'
import { SentimentChart } from '@/components/SentimentChart'
import { IntentChart } from '@/components/IntentChart'
import { Navbar } from '@/components/Navbar'
import { AnimatedSection } from '@/components/AnimatedSection'
import { FileSpreadsheet } from 'lucide-react'
import { AgentChat } from '@/components/AgentChat'

export default function Dashboard() {
  const [insights, setInsights]   = useState<Insight[]>([])
  const [stats, setStats]         = useState<any>(null)
  const [sentiment, setSentiment] = useState<any[]>([])
  const [intents, setIntents]     = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [pipelineStatus, setPipelineStatus] = useState<any>(null)

  useEffect(() => {
  Promise.all([
    getInsightsWithClusters(),
    getDashboardStats(),
    getSentimentBreakdown(),
    getIntentBreakdown(),
    getPipelineStatus(),
  ]).then(([i, s, sent, int, ps]) => {
    setInsights(i)
    setStats(s)
    setSentiment(sent)
    setIntents(int)
    setPipelineStatus(ps)
  }).catch(console.error)
    .finally(() => setLoading(false))
}, [])

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}
      className="dot-grid">
      <Navbar />

      <main className="max-w-screen-xl mx-auto px-6 py-8 space-y-8">

        {/* Page header — immediate */}
        <AnimatedSection delay={0}>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="font-display text-3xl font-bold"
                style={{ color: 'var(--text-primary)' }}>
                Product Insights
              </h1>
              <p className="text-sm mt-1.5"
                style={{ color: 'var(--text-secondary)' }}>
                AI-analyzed feedback - prioritized for your next sprint
              </p>
            </div>
            {pipelineStatus?.sheet_name && (
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl card">
                  <FileSpreadsheet className="w-3.5 h-3.5"
                    style={{ color: 'var(--accent)' }} />
                  <span className="text-xs font-semibold"
                    style={{ color: 'var(--accent)' }}>
                    {/* Clean up the display name */}
                    {pipelineStatus.sheet_name
                      .replace('Google Sheet URL', 'Google Sheet')
                      .replace('.csv', '')
                      .trim()
                    }
                  </span>
                </div>
                {pipelineStatus.completed_at && (
                  <span className="text-xs"
                    style={{ color: 'var(--text-muted)' }}>
                    Last analyzed:{' '}
                    {new Date(pipelineStatus.completed_at).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                )}
              </div>
            )}
          </div>
        </AnimatedSection>

        {/* Stats — staggered */}
        <AnimatedSection delay={100}>
          {loading
            ? <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="skel h-32" />
                ))}
              </div>
            : <StatsBar stats={stats} insights={insights} />
          }
        </AnimatedSection>

        {/* Charts */}
        <AnimatedSection delay={200}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {loading
              ? <>
                  <div className="skel h-72" />
                  <div className="skel h-72" />
                </>
              : <>
                  <SentimentChart data={sentiment} />
                  <IntentChart data={intents} />
                </>
            }
          </div>
        </AnimatedSection>

        {/* Insights header */}
        <AnimatedSection delay={300}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-semibold"
                style={{ color: 'var(--text-primary)' }}>
                Prioritized Insights
              </h2>
              <p className="text-xs mt-0.5"
                style={{ color: 'var(--text-muted)' }}>
                Ranked by impact × frequency × severity
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="live-dot" />
              <span className="text-xs font-semibold"
                style={{ color: 'var(--success)' }}>
                Live
              </span>
            </div>
          </div>
        </AnimatedSection>

        {/* Insight cards — each animates individually */}
        {loading
          ? <div className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="skel h-48" />
              ))}
            </div>
          : <div className="space-y-4 pb-12">
              {insights.map((ins, i) => (
                <AnimatedSection key={ins.id} delay={i * 80}>
                  <InsightCard insight={ins} index={i} />
                </AnimatedSection>
              ))}
            </div>
        }

      </main>
      <AgentChat />
    </div>
  )
}