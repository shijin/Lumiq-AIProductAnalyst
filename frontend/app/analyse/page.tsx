'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Navbar } from '@/components/Navbar'
import { ProgressBar } from '@/components/ProgressBar'
import { AnimatedSection } from '@/components/AnimatedSection'
import { startAnalysis } from '@/lib/api'
import { FileSpreadsheet, Play, ArrowLeft, AlertCircle } from 'lucide-react'

type Stage = 'input' | 'running' | 'done'

export default function AnalysePage() {
  const [stage, setStage]       = useState<Stage>('input')
  const [sheetName, setSheetName] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const router = useRouter()

  const handleStart = async () => {
    if (!sheetName.trim()) {
      setError('Please enter your Google Sheet name')
      return
    }
    setError('')
    setLoading(true)
    try {
      await startAnalysis(sheetName.trim())
      setStage('running')
    } catch (e: any) {
      setError(e.message || 'Failed to start analysis')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}
      className="dot-grid">
      <Navbar />

      <main className="max-w-2xl mx-auto px-6 py-12">

        {/* Back button */}
        <AnimatedSection delay={0}>
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-sm mb-8
              transition-colors hover:opacity-70"
            style={{ color: 'var(--text-secondary)' }}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
        </AnimatedSection>

        {/* Header */}
        <AnimatedSection delay={80}>
          <div className="mb-8">
            <h1 className="font-display text-3xl font-bold mb-2"
              style={{ color: 'var(--text-primary)' }}>
              {stage === 'input' ? 'New Analysis' : 'Running Analysis'}
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {stage === 'input'
                ? 'Connect your Google Sheet and let Lumiq do the rest'
                : `Analysing "${sheetName}" — this takes 2-3 minutes`
              }
            </p>
          </div>
        </AnimatedSection>

        {/* Input stage */}
        {stage === 'input' && (
          <AnimatedSection delay={160}>
            <div className="card p-8 space-y-6">

              {/* Sheet name input */}
              <div>
                <label className="block text-sm font-semibold mb-2"
                  style={{ color: 'var(--text-primary)' }}>
                  Google Sheet Name
                </label>
                <div className="relative">
                  <FileSpreadsheet
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
                    style={{ color: 'var(--text-muted)' }}
                  />
                  <input
                    type="text"
                    value={sheetName}
                    onChange={e => {
                      setSheetName(e.target.value)
                      setError('')
                    }}
                    onKeyDown={e => e.key === 'Enter' && handleStart()}
                    placeholder="e.g. product_feedback"
                    className="w-full pl-10 pr-4 py-3 rounded-xl text-sm
                      outline-none transition-all duration-200"
                    style={{
                      background: 'var(--bg)',
                      border: error
                        ? '1.5px solid var(--danger)'
                        : '1.5px solid var(--border)',
                      color: 'var(--text-primary)',
                    }}
                    onFocus={e => {
                      if (!error)
                        e.target.style.borderColor = 'var(--accent)'
                    }}
                    onBlur={e => {
                      if (!error)
                        e.target.style.borderColor = 'var(--border)'
                    }}
                  />
                </div>

                {/* Error */}
                {error && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <AlertCircle className="w-3.5 h-3.5"
                      style={{ color: 'var(--danger)' }} />
                    <p className="text-xs" style={{ color: 'var(--danger)' }}>
                      {error}
                    </p>
                  </div>
                )}

                <p className="text-xs mt-2"
                  style={{ color: 'var(--text-muted)' }}>
                  Enter the exact name of your Google Sheet as it appears
                  in Google Drive
                </p>
              </div>

              {/* What happens next */}
              <div className="p-4 rounded-2xl space-y-2"
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)'
                }}>
                <p className="text-xs font-bold uppercase tracking-widest mb-3"
                  style={{ color: 'var(--text-muted)' }}>
                  What happens next
                </p>
                {[
                  'Feedback is ingested and language-detected',
                  'Text is translated and intent-classified',
                  'Similar feedback is clustered automatically',
                  'AI identifies root causes per cluster',
                  'Insights are scored and prioritized',
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <div className="w-5 h-5 rounded-full flex items-center
                      justify-center text-xs font-bold text-white shrink-0"
                      style={{ background: 'var(--accent)' }}>
                      {i + 1}
                    </div>
                    <p className="text-xs"
                      style={{ color: 'var(--text-secondary)' }}>
                      {step}
                    </p>
                  </div>
                ))}
              </div>

              {/* Run button */}
              <button
                onClick={handleStart}
                disabled={loading || !sheetName.trim()}
                className="w-full flex items-center justify-center gap-2
                  py-3.5 rounded-xl text-sm font-bold text-white
                  transition-all duration-200 hover:opacity-90
                  active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: 'var(--accent)',
                  boxShadow: 'var(--shadow-accent)'
                }}
              >
                <Play className="w-4 h-4 fill-white" />
                {loading ? 'Starting...' : 'Run Analysis'}
              </button>
            </div>
          </AnimatedSection>
        )}

        {/* Running stage */}
        {stage === 'running' && (
          <AnimatedSection delay={0}>
            <div className="card p-8">
              <ProgressBar onComplete={() => setStage('done')} />
            </div>
          </AnimatedSection>
        )}

      </main>
    </div>
  )
}