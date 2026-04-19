export interface Cluster {
  id: number
  cluster_label: string
  representative_text: string
  feedback_count: number
  created_at: string
}

export interface Insight {
  id: number
  cluster_id: number
  root_cause: string
  recommendation: string
  impact_score: number
  frequency_score: number
  severity_score: number
  confidence_score: number
  priority_rank: number
  evidence: string
  generated_at: string
  cluster?: Cluster
}

export interface RawFeedback {
  id: number
  source: string
  raw_text: string
  language: string
  submitted_at: string
}

export interface CleanedFeedback {
  id: number
  raw_id: number
  cleaned_text: string
  sentiment: string
  intent: string
  original_language: string
}

export type Severity = 'critical' | 'high' | 'medium' | 'low'
export type Sentiment = 'positive' | 'negative' | 'neutral'