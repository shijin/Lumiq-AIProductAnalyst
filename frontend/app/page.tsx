'use client'

import { useEffect, useState } from 'react'
import { getInsightsWithClusters, getDashboardStats, getSentimentBreakdown, getIntentBreakdown } from '@/lib/data'
import { Insight } from '@/lib/types'
import { InsightCard } from '@/components/InsightCard'
import { StatsBar } from '@/components/StatsBar'
import { SentimentChart } from '@/components/SentimentChart'
import { IntentChart } from '@/components/IntentChart'
import { Header } from '@/components/Header'
import { Skeleton } from '@/components/ui/skeleton'

export default function Dashboard() {
  const [insights, setInsights] = useState<Insight[]>([])
  const [stats, setStats] = useState<any>(null)
  const [sentiment, setSentiment] = useState<any[]>([])
  const [intents, setIntents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchAll() {
      try {
        const [insightsData, statsData, sentimentData, intentData] = await Promise.all([
          getInsightsWithClusters(),
          getDashboardStats(),
          getSentimentBreakdown(),
          getIntentBreakdown()
        ])
        setInsights(insightsData)
        setStats(statsData)
        setSentiment(sentimentData)
        setIntents(intentData)
      } catch (err) {
        console.error('Failed to fetch data:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  return (
    <div className="min-h-screen bg-[#fafaf8]">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Page title */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">
            Product Insights
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            AI-analyzed feedback — prioritized for your next sprint
          </p>
        </div>

        {/* Stats bar */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
        ) : (
          <StatsBar stats={stats} insights={insights} />
        )}

        {/* Charts row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {loading ? (
            <>
              <Skeleton className="h-64 rounded-2xl" />
              <Skeleton className="h-64 rounded-2xl" />
            </>
          ) : (
            <>
              <SentimentChart data={sentiment} />
              <IntentChart data={intents} />
            </>
          )}
        </div>

        {/* Insights list */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">
            Prioritized Insights
          </h2>
          <span className="text-xs text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
            Ranked by impact × frequency × severity
          </span>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {insights.map((insight, index) => (
              <InsightCard key={insight.id} insight={insight} index={index}/>
            ))}
          </div>
        )}

      </main>
    </div>
  )
}