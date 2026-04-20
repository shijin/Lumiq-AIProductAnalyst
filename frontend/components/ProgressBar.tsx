'use client'
import { useEffect, useState } from 'react'
import { getPipelineStatus, PipelineStatus } from '@/lib/api'
import { CheckCircle2, XCircle, Loader2, ChevronRight } from 'lucide-react'
import { useRouter } from 'next/navigation'

const STEPS = [
  'Clearing existing data...',
  'Ingesting feedback...',
  'Detecting languages and translating...',
  'Cleaning feedback and detecting sentiment...',
  'Clustering similar feedback...',
  'Analyzing root causes with AI...',
  'Scoring and prioritizing insights...',
  'Generating actionable recommendations...',
  'Analysis complete',
]

interface Props {
  onComplete?: () => void
}

export function ProgressBar({ onComplete }: Props) {
  const [status, setStatus] = useState<PipelineStatus | null>(null)
  const [stuckTimer, setStuckTimer] = useState(0)
  const [lastStep, setLastStep] = useState('')
  const router = useRouter()

  useEffect(() => {
    const poll = async () => {
      try {
        const s = await getPipelineStatus()
        setStatus(s)
        if (!s.running && s.progress === 100) {
          onComplete?.()
        }
      } catch (e) {
        console.error('Polling failed:', e)
      }
    }

    poll()
    const interval = setInterval(poll, 3000)
    return () => clearInterval(interval)
  }, [onComplete])

  // Track if stuck on same step
  useEffect(() => {
    if (!status) return
    if (status.current_step === lastStep) {
      setStuckTimer(prev => prev + 3)
    } else {
      setStuckTimer(0)
      setLastStep(status.current_step)
    }
  }, [status, lastStep])

  if (!status) return null

  return (
    <div className="w-full space-y-6">

      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold"
            style={{ color: 'var(--text-primary)' }}>
            {status.current_step}
          </span>
          <span className="text-sm font-bold"
            style={{ color: 'var(--accent)' }}>
            {status.progress}%
          </span>
        </div>
        <div className="h-2 rounded-full overflow-hidden"
          style={{ background: 'var(--border)' }}>
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${status.progress}%`,
              background: status.error
                ? 'var(--danger)'
                : 'linear-gradient(90deg, var(--accent), #FBBF24)'
            }}
          />
        </div>
      </div>

      {/* Step list */}
      <div className="space-y-2">
        {STEPS.map((step, i) => {
          const completed = status.completed_steps.includes(step)
          const current = status.current_step === step && status.running
          const pending = !completed && !current

          return (
            <div key={step}
              className="flex items-center gap-3 transition-all duration-300"
              style={{ opacity: pending ? 0.35 : 1 }}
            >
              {completed ? (
                <CheckCircle2 className="w-4 h-4 shrink-0"
                  style={{ color: 'var(--success)' }} />
              ) : current ? (
                <Loader2 className="w-4 h-4 shrink-0 animate-spin"
                  style={{ color: 'var(--accent)' }} />
              ) : status.error ? (
                <XCircle className="w-4 h-4 shrink-0"
                  style={{ color: 'var(--danger)' }} />
              ) : (
                <div className="w-4 h-4 shrink-0 rounded-full border-2"
                  style={{ borderColor: 'var(--border)' }} />
              )}
              <span className="text-sm"
                style={{
                  color: completed
                    ? 'var(--success)'
                    : current
                    ? 'var(--accent)'
                    : 'var(--text-secondary)'
                }}>
                {step}
              </span>
            </div>
          )
        })}
      </div>

      {/* Stuck warning */}
      {stuckTimer > 180 && status.running && (
        <div className="p-3 rounded-xl text-xs"
          style={{
            background: 'var(--warning-light)',
            border: '1px solid rgba(217,119,6,0.2)',
            color: 'var(--warning)'
          }}>
          ⏳ This step is taking longer than usual.
          On first run, AI models need to download.
          Please wait — do not close this page.
        </div>
      )}

      {/* Server restart error */}
      {status.error && status.error.includes('restarted') && (
        <div className="p-4 rounded-2xl"
          style={{
            background: 'var(--warning-light)',
            border: '1px solid rgba(217,119,6,0.2)'
          }}>
          <p className="text-sm font-semibold mb-1"
            style={{ color: 'var(--warning)' }}>
            ⚠️ Server Restarted
          </p>
          <p className="text-xs mb-3"
            style={{ color: 'var(--text-secondary)' }}>
            The server restarted during analysis due to memory limits.
            This happens on first run while models download.
            Please try again — it will be faster now.
          </p>
          <button
            onClick={() => router.push('/analyse')}
            className="px-4 py-2 rounded-xl text-xs font-semibold
              text-white transition-all hover:opacity-90"
            style={{ background: 'var(--warning)' }}>
            Try Again
          </button>
        </div>
      )}

      {/* Generic error */}
      {status.error && !status.error.includes('restarted') && (
        <div className="p-4 rounded-2xl"
          style={{
            background: 'var(--danger-light)',
            border: '1px solid rgba(220,38,38,0.2)'
          }}>
          <p className="text-sm font-semibold"
            style={{ color: 'var(--danger)' }}>
            Pipeline Error
          </p>
          <p className="text-xs mt-1"
            style={{ color: 'var(--text-secondary)' }}>
            {status.error}
          </p>
        </div>
      )}

      {/* Success */}
      {!status.running && status.progress === 100 && !status.error && (
        <div className="p-4 rounded-2xl text-center"
          style={{
            background: 'var(--success-light)',
            border: '1px solid rgba(22,163,74,0.2)'
          }}>
          <p className="text-sm font-semibold mb-3"
            style={{ color: 'var(--success)' }}>
            ✅ Analysis Complete!
          </p>
          <button
            onClick={() => router.push('/')}
            className="inline-flex items-center gap-2 px-5 py-2.5
              rounded-xl text-sm font-semibold text-white
              transition-all hover:opacity-90 active:scale-95"
            style={{ background: 'var(--accent)' }}
          >
            View Insights
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}