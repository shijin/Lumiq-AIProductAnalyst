'use client'
import { useEffect, useState } from 'react'
import { Navbar } from '@/components/Navbar'
import { AnimatedSection } from '@/components/AnimatedSection'
import { supabase } from '@/lib/supabase'
import {
  PieChart, Pie, Cell, Tooltip,
  ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, CartesianGrid
} from 'recharts'
import { Layers, ChevronDown, MessageSquare } from 'lucide-react'

interface ClusterRow {
  id: number
  cluster_label: string
  representative_text: string
  feedback_count: number
  feedback?: string[]
  insight?: {
    priority_rank: number
    severity_score: number
    root_cause: string
  }
}

const CLUSTER_COLORS = [
  '#F97316', '#EF4444', '#F59E0B', '#34D399',
  '#38BDF8', '#A78BFA', '#F472B6', '#60A5FA', '#4ADE80'
]

const SEVERITY_LABEL: Record<number, string> = {
  1.0: 'Critical', 0.75: 'High', 0.5: 'Medium', 0.25: 'Low'
}

export default function ClustersPage() {
  const [clusters, setClusters] = useState<ClusterRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [expanded, setExpanded] = useState<number | null>(null)

  useEffect(() => {
    async function fetchAll() {
      // Fetch clusters
      const { data: clusterData } = await supabase
        .from('clusters')
        .select('*')
        .order('feedback_count', { ascending: false })

      if (!clusterData) { setLoading(false); return }

      // Fetch insights for each cluster
      const { data: insightData } = await supabase
        .from('insights')
        .select('cluster_id, priority_rank, severity_score, root_cause')

      // Fetch feedback samples for each cluster
      const enriched = await Promise.all(
        clusterData.map(async (cluster) => {
          const { data: maps } = await supabase
            .from('feedback_cluster_map')
            .select('cleaned_id')
            .eq('cluster_id', cluster.id)
            .limit(5)

          const cleanedIds = (maps || []).map((m: any) => m.cleaned_id)

          let samples: string[] = []
          if (cleanedIds.length > 0) {
            const { data: feedback } = await supabase
              .from('cleaned_feedback')
              .select('cleaned_text')
              .in('id', cleanedIds)
            samples = [...new Set(
              (feedback || []).map((f: any) => f.cleaned_text)
            )]
          }

          const insight = insightData?.find(
            i => i.cluster_id === cluster.id
          )

          return { ...cluster, feedback: samples, insight }
        })
      )

      setClusters(enriched)
      setLoading(false)
    }
    fetchAll()
  }, [])

  // Pie chart data
  const pieData = clusters.map((c, i) => ({
    name: c.cluster_label,
    value: c.feedback_count,
    color: CLUSTER_COLORS[i % CLUSTER_COLORS.length]
  }))

  // Bar chart data
  const barData = clusters.map((c, i) => ({
    name: c.cluster_label.length > 20
      ? c.cluster_label.substring(0, 20) + '...'
      : c.cluster_label,
    count: c.feedback_count,
    color: CLUSTER_COLORS[i % CLUSTER_COLORS.length]
  }))

  const totalFeedback = clusters.reduce(
    (sum, c) => sum + c.feedback_count, 0
  )

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}
      className="dot-grid">
      <Navbar />

      <main className="max-w-screen-xl mx-auto px-6 py-8 space-y-8">

        {/* Header */}
        <AnimatedSection delay={0}>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="font-display text-3xl font-bold"
                style={{ color: 'var(--text-primary)' }}>
                Clusters
              </h1>
              <p className="text-sm mt-1.5"
                style={{ color: 'var(--text-secondary)' }}>
                Similar feedback grouped by AI into problem themes
              </p>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl card">
              <Layers className="w-4 h-4"
                style={{ color: 'var(--accent)' }} />
              <span className="font-display text-lg font-bold"
                style={{ color: 'var(--text-primary)' }}>
                {clusters.length}
              </span>
              <span className="text-sm"
                style={{ color: 'var(--text-secondary)' }}>
                clusters
              </span>
            </div>
          </div>
        </AnimatedSection>

        {/* Charts row */}
        {!loading && (
          <AnimatedSection delay={100}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Pie chart */}
              <div className="card p-6">
                <h3 className="font-display text-base font-semibold mb-1"
                  style={{ color: 'var(--text-primary)' }}>
                  Feedback Distribution
                </h3>
                <p className="text-xs mb-4"
                  style={{ color: 'var(--text-muted)' }}>
                  Share of feedback per cluster
                </p>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%"
                      innerRadius={60} outerRadius={90}
                      paddingAngle={2} dataKey="value"
                      animationBegin={200} animationDuration={800}
                    >
                      {pieData.map((e, i) => (
                        <Cell key={i} fill={e.color} stroke="transparent" />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border)',
                        borderRadius: 10,
                        fontSize: 12,
                        color: 'var(--text-primary)'
                      }}
                      formatter={(v: number) => [
                        `${v} rows (${Math.round((v/totalFeedback)*100)}%)`,
                        ''
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Bar chart */}
              <div className="card p-6">
                <h3 className="font-display text-base font-semibold mb-1"
                  style={{ color: 'var(--text-primary)' }}>
                  Cluster Size Comparison
                </h3>
                <p className="text-xs mb-4"
                  style={{ color: 'var(--text-muted)' }}>
                  Number of feedback rows per cluster
                </p>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={barData}
                    margin={{ left: 0, right: 8, top: 4, bottom: 40 }}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--border)"
                      vertical={false}
                    />
                    <XAxis dataKey="name"
                      tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                      angle={-35} textAnchor="end"
                      axisLine={false} tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                      axisLine={false} tickLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: 'var(--bg-card-hover)', radius: 6 }}
                      contentStyle={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border)',
                        borderRadius: 10,
                        fontSize: 12,
                        color: 'var(--text-primary)'
                      }}
                      formatter={(v: number) => [v, 'Feedback rows']}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}
                      animationBegin={300} animationDuration={800}>
                      {barData.map((e, i) => (
                        <Cell key={i} fill={e.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </AnimatedSection>
        )}

        {/* Cluster cards */}
        <AnimatedSection delay={200}>
          <h2 className="font-display text-xl font-semibold mb-4"
            style={{ color: 'var(--text-primary)' }}>
            Cluster Breakdown
          </h2>

          {loading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="skel h-24" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {clusters.map((cluster, i) => (
                <AnimatedSection key={cluster.id} delay={i * 60}>
                  <div className="card overflow-hidden">

                    {/* Accent bar */}
                    <div className="h-[3px]"
                      style={{
                        background: CLUSTER_COLORS[i % CLUSTER_COLORS.length]
                      }}
                    />

                    <div className="p-5">

                      {/* Header */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1">

                          {/* Color dot */}
                          <div className="w-3 h-3 rounded-full mt-1.5 shrink-0"
                            style={{
                              background: CLUSTER_COLORS[i % CLUSTER_COLORS.length]
                            }}
                          />

                          <div className="flex-1">
                            <h3 className="font-display text-base font-semibold mb-2"
                              style={{ color: 'var(--text-primary)' }}>
                              {cluster.cluster_label}
                            </h3>

                            <div className="flex flex-wrap gap-2">
                              {/* Feedback count */}
                              <span className="tag"
                                style={{
                                  background: 'var(--bg)',
                                  color: 'var(--text-secondary)',
                                  border: '1px solid var(--border)'
                                }}>
                                <MessageSquare className="w-3 h-3" />
                                {cluster.feedback_count} rows
                                ({Math.round(
                                  (cluster.feedback_count / totalFeedback) * 100
                                )}%)
                              </span>

                              {/* Priority rank */}
                              {cluster.insight && (
                                <span className="tag"
                                  style={{
                                    background: 'var(--accent-light)',
                                    color: 'var(--accent)',
                                    border: '1px solid rgba(249,115,22,0.2)'
                                  }}>
                                  Priority #{cluster.insight.priority_rank}
                                </span>
                              )}

                              {/* Severity */}
                              {cluster.insight && (
                                <span className="tag"
                                  style={{
                                    background: 'var(--danger-light)',
                                    color: 'var(--danger)',
                                    border: '1px solid rgba(220,38,38,0.2)'
                                  }}>
                                  {SEVERITY_LABEL[
                                    cluster.insight.severity_score
                                  ] || 'Medium'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Expand */}
                        <button
                          onClick={() => setExpanded(
                            expanded === cluster.id ? null : cluster.id
                          )}
                          className="shrink-0 w-9 h-9 rounded-xl
                            flex items-center justify-center
                            transition-all duration-200"
                          style={{
                            background: 'var(--bg)',
                            border: '1px solid var(--border)',
                            color: 'var(--text-secondary)'
                          }}
                        >
                          <ChevronDown
                            className={`w-4 h-4 transition-transform duration-300
                              ${expanded === cluster.id ? 'rotate-180' : ''}`}
                          />
                        </button>
                      </div>

                      {/* Expanded content */}
                      {expanded === cluster.id && (
                        <div className="mt-5 space-y-4 pt-4 anim-expand"
                          style={{
                            borderTop: '1px solid var(--border)'
                          }}>

                          {/* Root cause */}
                          {cluster.insight?.root_cause && (
                            <div className="p-4 rounded-2xl"
                              style={{
                                background: 'var(--bg)',
                                border: '1px solid var(--border)'
                              }}>
                              <p className="text-xs font-bold uppercase
                                tracking-widest mb-2"
                                style={{ color: 'var(--accent)' }}>
                                Root Cause
                              </p>
                              <p className="text-sm leading-relaxed"
                                style={{ color: 'var(--text-primary)' }}>
                                {cluster.insight.root_cause}
                              </p>
                            </div>
                          )}

                          {/* Sample feedback */}
                          {cluster.feedback && cluster.feedback.length > 0 && (
                            <div>
                              <p className="text-xs font-bold uppercase
                                tracking-widest mb-3"
                                style={{ color: 'var(--text-muted)' }}>
                                Sample Feedback
                              </p>
                              <div className="space-y-2">
                                {cluster.feedback.map((f, fi) => (
                                  <div key={fi}
                                    className="flex items-start gap-2.5
                                      p-3 rounded-xl"
                                    style={{
                                      background: 'var(--bg)',
                                      border: '1px solid var(--border)'
                                    }}>
                                    <div className="w-1.5 h-1.5 rounded-full
                                      mt-1.5 shrink-0"
                                      style={{
                                        background: CLUSTER_COLORS[
                                          i % CLUSTER_COLORS.length
                                        ]
                                      }}
                                    />
                                    <p className="text-sm leading-relaxed"
                                      style={{ color: 'var(--text-primary)' }}>
                                      {f}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </AnimatedSection>
              ))}
            </div>
          )}
        </AnimatedSection>

      </main>
    </div>
  )
}