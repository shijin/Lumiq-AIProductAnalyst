'use client'
import { useEffect, useState, useMemo } from 'react'
import { Navbar } from '@/components/Navbar'
import { AnimatedSection } from '@/components/AnimatedSection'
import { supabase } from '@/lib/supabase'
import { getSentimentColor, getIntentColor } from '@/lib/utils'
import { Search, Filter, X, MessageSquare } from 'lucide-react'

interface FeedbackRow {
  id: number
  cleaned_text: string
  sentiment: string
  intent: string
  original_language: string
  translated_text: string | null
}

const SENTIMENT_OPTIONS = ['all', 'positive', 'negative', 'neutral']
const INTENT_OPTIONS = [
  'all', 'bug', 'complaint', 'feature_request',
  'churn_signal', 'pricing_feedback', 'praise', 'question'
]
const LANGUAGE_OPTIONS = ['all', 'en', 'hi', 'hinglish']

export default function FeedbackPage() {
  const [rows, setRows]           = useState<FeedbackRow[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [sentiment, setSentiment] = useState('all')
  const [intent, setIntent]       = useState('all')
  const [language, setLanguage]   = useState('all')

  useEffect(() => {
    async function fetch() {
      const { data, error } = await supabase
        .from('cleaned_feedback')
        .select('*')
        .order('id', { ascending: true })
      if (!error) setRows(data || [])
      setLoading(false)
    }
    fetch()
  }, [])

  const filtered = useMemo(() => {
    return rows.filter(r => {
      const matchSearch = !search ||
        r.cleaned_text.toLowerCase().includes(search.toLowerCase())
      const matchSentiment = sentiment === 'all' || r.sentiment === sentiment
      const matchIntent = intent === 'all' || r.intent === intent
      const matchLang = language === 'all' || r.original_language === language
      return matchSearch && matchSentiment && matchIntent && matchLang
    })
  }, [rows, search, sentiment, intent, language])

  const clearFilters = () => {
    setSearch('')
    setSentiment('all')
    setIntent('all')
    setLanguage('all')
  }

  const hasFilters = search || sentiment !== 'all' ||
    intent !== 'all' || language !== 'all'

  const sentimentCounts = useMemo(() => ({
    positive: rows.filter(r => r.sentiment === 'positive').length,
    negative: rows.filter(r => r.sentiment === 'negative').length,
    neutral:  rows.filter(r => r.sentiment === 'neutral').length,
  }), [rows])

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}
      className="dot-grid">
      <Navbar />

      <main className="max-w-screen-xl mx-auto px-6 py-8 space-y-6">

        {/* Header */}
        <AnimatedSection delay={0}>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="font-display text-3xl font-bold"
                style={{ color: 'var(--text-primary)' }}>
                Feedback
              </h1>
              <p className="text-sm mt-1.5"
                style={{ color: 'var(--text-secondary)' }}>
                All cleaned and processed feedback rows
              </p>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl card">
              <MessageSquare className="w-4 h-4"
                style={{ color: 'var(--accent)' }} />
              <span className="font-display text-lg font-bold"
                style={{ color: 'var(--text-primary)' }}>
                {rows.length}
              </span>
              <span className="text-sm"
                style={{ color: 'var(--text-secondary)' }}>
                total rows
              </span>
            </div>
          </div>
        </AnimatedSection>

        {/* Sentiment summary pills */}
        <AnimatedSection delay={80}>
          <div className="flex flex-wrap gap-3">
            {[
              { label: 'Negative', count: sentimentCounts.negative,
                bg: 'var(--danger-light)', text: 'var(--danger)',
                border: 'rgba(220,38,38,0.2)' },
              { label: 'Neutral',  count: sentimentCounts.neutral,
                bg: 'var(--warning-light)', text: 'var(--warning)',
                border: 'rgba(217,119,6,0.2)' },
              { label: 'Positive', count: sentimentCounts.positive,
                bg: 'var(--success-light)', text: 'var(--success)',
                border: 'rgba(22,163,74,0.2)' },
            ].map(s => (
              <div key={s.label}
                className="flex items-center gap-2 px-4 py-2 rounded-xl
                  cursor-pointer transition-all duration-200 hover:opacity-80"
                style={{
                  background: s.bg,
                  border: `1px solid ${s.border}`
                }}
                onClick={() => setSentiment(
                  sentiment === s.label.toLowerCase()
                    ? 'all'
                    : s.label.toLowerCase()
                )}
              >
                <span className="font-display text-lg font-bold"
                  style={{ color: s.text }}>
                  {s.count}
                </span>
                <span className="text-xs font-semibold"
                  style={{ color: s.text }}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </AnimatedSection>

        {/* Filters */}
        <AnimatedSection delay={160}>
          <div className="card p-4 space-y-3">

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
                style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search feedback..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none"
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                }}
              />
              {search && (
                <button onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="w-4 h-4"
                    style={{ color: 'var(--text-muted)' }} />
                </button>
              )}
            </div>

            {/* Filter row */}
            <div className="flex flex-wrap items-center gap-3">
              <Filter className="w-4 h-4 shrink-0"
                style={{ color: 'var(--text-muted)' }} />

              {/* Sentiment filter */}
              <select
                value={sentiment}
                onChange={e => setSentiment(e.target.value)}
                className="px-3 py-2 rounded-xl text-xs font-medium
                  outline-none cursor-pointer"
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                }}
              >
                {SENTIMENT_OPTIONS.map(o => (
                  <option key={o} value={o}>
                    {o === 'all' ? 'All Sentiments' : o}
                  </option>
                ))}
              </select>

              {/* Intent filter */}
              <select
                value={intent}
                onChange={e => setIntent(e.target.value)}
                className="px-3 py-2 rounded-xl text-xs font-medium
                  outline-none cursor-pointer"
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                }}
              >
                {INTENT_OPTIONS.map(o => (
                  <option key={o} value={o}>
                    {o === 'all' ? 'All Intents' : o.replace('_', ' ')}
                  </option>
                ))}
              </select>

              {/* Language filter */}
              <select
                value={language}
                onChange={e => setLanguage(e.target.value)}
                className="px-3 py-2 rounded-xl text-xs font-medium
                  outline-none cursor-pointer"
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                }}
              >
                {LANGUAGE_OPTIONS.map(o => (
                  <option key={o} value={o}>
                    {o === 'all' ? 'All Languages' : o.toUpperCase()}
                  </option>
                ))}
              </select>

              {/* Clear filters */}
              {hasFilters && (
                <button onClick={clearFilters}
                  className="flex items-center gap-1.5 px-3 py-2
                    rounded-xl text-xs font-medium transition-all
                    hover:opacity-80"
                  style={{
                    background: 'var(--danger-light)',
                    color: 'var(--danger)',
                    border: '1px solid rgba(220,38,38,0.2)'
                  }}
                >
                  <X className="w-3 h-3" />
                  Clear filters
                </button>
              )}

              {/* Result count */}
              <span className="ml-auto text-xs"
                style={{ color: 'var(--text-muted)' }}>
                Showing {filtered.length} of {rows.length} rows
              </span>
            </div>
          </div>
        </AnimatedSection>

        {/* Table */}
        <AnimatedSection delay={240}>
          <div className="card overflow-hidden">
            {loading ? (
              <div className="p-8 space-y-3">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="skel h-12" />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{
                      borderBottom: '1px solid var(--border)',
                      background: 'var(--bg)'
                    }}>
                      {['#', 'Feedback', 'Sentiment',
                        'Intent', 'Language'].map(h => (
                        <th key={h}
                          className="px-5 py-3.5 text-left text-xs
                            font-bold uppercase tracking-widest"
                          style={{ color: 'var(--text-muted)' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row, i) => (
                      <tr key={row.id}
                        className="transition-colors duration-150"
                        style={{
                          borderBottom: '1px solid var(--border)',
                        }}
                        onMouseEnter={e =>
                          (e.currentTarget as HTMLElement)
                            .style.background = 'var(--bg-card-hover)'
                        }
                        onMouseLeave={e =>
                          (e.currentTarget as HTMLElement)
                            .style.background = 'transparent'
                        }
                      >
                        {/* Row number */}
                        <td className="px-5 py-4 text-xs"
                          style={{ color: 'var(--text-muted)', width: '48px' }}>
                          {i + 1}
                        </td>

                        {/* Feedback text */}
                        <td className="px-5 py-4" style={{ maxWidth: '480px' }}>
                          <p className="text-sm leading-relaxed"
                            style={{ color: 'var(--text-primary)' }}>
                            {row.cleaned_text}
                          </p>
                          {row.translated_text && (
                            <p className="text-xs mt-1"
                              style={{ color: 'var(--text-muted)' }}>
                              Original: {row.translated_text}
                            </p>
                          )}
                        </td>

                        {/* Sentiment */}
                        <td className="px-5 py-4">
                          <span className="tag"
                            style={getSentimentStyle(row.sentiment)}>
                            {row.sentiment}
                          </span>
                        </td>

                        {/* Intent */}
                        <td className="px-5 py-4">
                          <span className="tag"
                            style={getIntentStyle(row.intent)}>
                            {row.intent?.replace('_', ' ')}
                          </span>
                        </td>

                        {/* Language */}
                        <td className="px-5 py-4">
                          <span className="tag"
                            style={{
                              background: 'var(--bg)',
                              color: 'var(--text-secondary)',
                              border: '1px solid var(--border)'
                            }}>
                            {row.original_language?.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Empty state */}
                {filtered.length === 0 && (
                  <div className="py-16 text-center">
                    <p className="font-display text-lg font-semibold mb-2"
                      style={{ color: 'var(--text-primary)' }}>
                      No results found
                    </p>
                    <p className="text-sm"
                      style={{ color: 'var(--text-secondary)' }}>
                      Try adjusting your filters
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </AnimatedSection>

      </main>
    </div>
  )
}

// Style helpers
function getSentimentStyle(s: string) {
  const map: Record<string, any> = {
    positive: { background: 'var(--success-light)', color: 'var(--success)',
      border: '1px solid rgba(22,163,74,0.2)' },
    negative: { background: 'var(--danger-light)',  color: 'var(--danger)',
      border: '1px solid rgba(220,38,38,0.2)' },
    neutral:  { background: 'var(--warning-light)', color: 'var(--warning)',
      border: '1px solid rgba(217,119,6,0.2)' },
  }
  return map[s] || { background: 'var(--bg)', color: 'var(--text-secondary)',
    border: '1px solid var(--border)' }
}

function getIntentStyle(intent: string) {
  const map: Record<string, any> = {
    bug:              { background: 'rgba(239,68,68,0.1)',   color: '#F87171',
      border: '1px solid rgba(248,113,113,0.25)' },
    complaint:        { background: 'rgba(249,115,22,0.1)',  color: '#FB923C',
      border: '1px solid rgba(251,146,60,0.25)' },
    feature_request:  { background: 'rgba(59,130,246,0.1)',  color: '#60A5FA',
      border: '1px solid rgba(96,165,250,0.25)' },
    churn_signal:     { background: 'rgba(139,92,246,0.1)',  color: '#A78BFA',
      border: '1px solid rgba(167,139,250,0.25)' },
    pricing_feedback: { background: 'rgba(245,158,11,0.1)',  color: '#FBB42A',
      border: '1px solid rgba(251,180,42,0.25)' },
    praise:           { background: 'rgba(34,197,94,0.1)',   color: '#4ADE80',
      border: '1px solid rgba(74,222,128,0.25)' },
    question:         { background: 'rgba(148,163,184,0.1)', color: '#94A3B8',
      border: '1px solid rgba(148,163,184,0.25)' },
  }
  return map[intent] || { background: 'var(--bg)',
    color: 'var(--text-secondary)', border: '1px solid var(--border)' }
}