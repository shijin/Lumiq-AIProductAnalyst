import { supabase } from './supabase'
import { Insight, Cluster, CleanedFeedback } from './types'

export async function getInsightsWithClusters(): Promise<Insight[]> {
  const { data, error } = await supabase
    .from('insights')
    .select(`
      *,
      cluster:clusters(*)
    `)
    .order('priority_rank', { ascending: true })

  if (error) throw error
  return data || []
}

export async function getClusterFeedback(
  clusterId: number
): Promise<CleanedFeedback[]> {
  const { data: maps, error: mapError } = await supabase
    .from('feedback_cluster_map')
    .select('cleaned_id')
    .eq('cluster_id', clusterId)

  if (mapError) throw mapError

  const cleanedIds = maps.map((m: any) => m.cleaned_id)

  const { data, error } = await supabase
    .from('cleaned_feedback')
    .select('*')
    .in('id', cleanedIds)

  if (error) throw error
  return data || []
}

export async function getDashboardStats() {
  const [
    { count: totalFeedback },
    { count: totalClusters },
    { data: insights }
  ] = await Promise.all([
    supabase
      .from('raw_feedback')
      .select('*', { count: 'exact', head: true }),
    supabase
      .from('clusters')
      .select('*', { count: 'exact', head: true }),
    supabase
      .from('insights')
      .select('severity_score, quick_win:recommendation')
  ])

  return {
    totalFeedback: totalFeedback || 0,
    totalClusters: totalClusters || 0,
    totalInsights: insights?.length || 0,
  }
}

export async function getSentimentBreakdown() {
  const { data, error } = await supabase
    .from('cleaned_feedback')
    .select('sentiment')

  if (error) throw error

  const counts = { positive: 0, negative: 0, neutral: 0 }
  data?.forEach((row: any) => {
    if (row.sentiment in counts) {
      counts[row.sentiment as keyof typeof counts]++
    }
  })

  return [
    { name: 'Negative', value: counts.negative, color: '#dc2626' },
    { name: 'Neutral', value: counts.neutral, color: '#d97706' },
    { name: 'Positive', value: counts.positive, color: '#059669' },
  ]
}

export async function getIntentBreakdown() {
  const { data, error } = await supabase
    .from('cleaned_feedback')
    .select('intent')

  if (error) throw error

  const counts: Record<string, number> = {}
  data?.forEach((row: any) => {
    counts[row.intent] = (counts[row.intent] || 0) + 1
  })

  return Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
}
export async function getPipelineStatus() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
  try {
    const res = await fetch(`${API_URL}/api/status`)
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}