import { clsx, type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function getSeverityFromScore(score: number): string {
  if (score >= 1.0) return 'critical'
  if (score >= 0.75) return 'high'
  if (score >= 0.5) return 'medium'
  return 'low'
}

export function getSeverityColor(score: number): string {
  if (score >= 1.0) return 'bg-red-100 text-red-700 border-red-200'
  if (score >= 0.75) return 'bg-orange-100 text-orange-700 border-orange-200'
  if (score >= 0.5) return 'bg-yellow-100 text-yellow-700 border-yellow-200'
  return 'bg-green-100 text-green-700 border-green-200'
}

export function getPriorityColor(rank: number): string {
  if (rank === 1) return 'bg-red-500'
  if (rank === 2) return 'bg-orange-500'
  if (rank === 3) return 'bg-yellow-500'
  return 'bg-blue-500'
}

export function getSentimentColor(sentiment: string): string {
  if (sentiment === 'positive') return 'text-emerald-600 bg-emerald-50'
  if (sentiment === 'negative') return 'text-red-600 bg-red-50'
  return 'text-yellow-600 bg-yellow-50'
}

export function getIntentColor(intent: string): string {
  const map: Record<string, string> = {
    bug: 'bg-red-100 text-red-700',
    complaint: 'bg-orange-100 text-orange-700',
    feature_request: 'bg-blue-100 text-blue-700',
    churn_signal: 'bg-purple-100 text-purple-700',
    pricing_feedback: 'bg-yellow-100 text-yellow-700',
    praise: 'bg-green-100 text-green-700',
    question: 'bg-slate-100 text-slate-700',
  }
  return map[intent] || 'bg-slate-100 text-slate-700'
}

export function parseRecommendation(rec: string) {
  const parts = rec.split(' | ')
  const get = (prefix: string) =>
    parts.find(p => p.startsWith(prefix))
      ?.replace(prefix, '')
      .trim() || ''

  return {
    whatToFix: get('WHAT TO FIX:'),
    actions: get('ACTIONS:').split(' | '),
    successMetric: get('SUCCESS METRIC:'),
    effort: get('EFFORT:'),
    quickWin: get('QUICK WIN:') === 'Yes'
  }
}

export function formatScore(score: number): string {
  return `${Math.round(score * 100)}%`
}