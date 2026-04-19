const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export interface PipelineStatus {
  running: boolean
  current_step: string
  progress: number
  completed_steps: string[]
  error: string | null
  started_at: string | null
  completed_at: string | null
  sheet_name: string | null
}

export async function startAnalysis(sheetName: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/analyse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sheet_name: sheetName })
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || 'Failed to start analysis')
  }
}

export async function getPipelineStatus(): Promise<PipelineStatus> {
  const res = await fetch(`${API_URL}/api/status`)
  if (!res.ok) throw new Error('Failed to get status')
  return res.json()
}

export async function exportInsights(): Promise<void> {
  const res = await fetch(`${API_URL}/api/export`)
  if (!res.ok) throw new Error('Failed to export')
  const blob = await res.blob()
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'lumiq_insights.csv'
  a.click()
  window.URL.revokeObjectURL(url)
}

export async function resetData(): Promise<void> {
  const res = await fetch(`${API_URL}/api/reset`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to reset data')
}