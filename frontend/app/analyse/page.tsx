'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Navbar } from '@/components/Navbar'
import { ProgressBar } from '@/components/ProgressBar'
import { AnimatedSection } from '@/components/AnimatedSection'
import {
  startAnalysis, startAnalysisCSV,
  startAnalysisSheetURL
} from '@/lib/api'
import {
  FileSpreadsheet, Play, ArrowLeft,
  AlertCircle, Upload, Link, Sheet
} from 'lucide-react'
import { AgentChat } from '@/components/AgentChat'

type Stage = 'input' | 'running'
type InputMethod = 'csv' | 'sheet_url' | 'sheet_name'

export default function AnalysePage() {
  const [stage, setStage]         = useState<Stage>('input')
  const [method, setMethod]       = useState<InputMethod>('csv')
  const [sheetName, setSheetName] = useState('')
  const [sheetUrl, setSheetUrl]   = useState('')
  const [csvFile, setCsvFile]     = useState<File | null>(null)
  const [error, setError]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [dragOver, setDragOver]   = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const handleStart = async () => {
    setError('')
    setLoading(true)
    try {
      if (method === 'csv') {
        if (!csvFile) { setError('Please select a CSV file'); return }
        await startAnalysisCSV(csvFile)
      } else if (method === 'sheet_url') {
        if (!sheetUrl.trim()) {
          setError('Please enter a Google Sheet URL'); return
        }
        if (!sheetUrl.includes('docs.google.com/spreadsheets')) {
          setError('Please enter a valid Google Sheets URL'); return
        }
        await startAnalysisSheetURL(sheetUrl.trim())
      } else {
        if (!sheetName.trim()) {
          setError('Please enter the sheet name'); return
        }
        await startAnalysis(sheetName.trim())
      }
      setStage('running')
    } catch (e: any) {
      setError(e.message || 'Failed to start analysis')
    } finally {
      setLoading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file?.name.endsWith('.csv')) {
      setCsvFile(file)
      setError('')
    } else {
      setError('Only CSV files are supported')
    }
  }

  const TAB_METHODS = [
    { id: 'csv' as InputMethod, label: 'Upload CSV',
      icon: Upload, desc: 'Works with any tool' },
    { id: 'sheet_url' as InputMethod, label: 'Sheet URL',
      icon: Link, desc: 'Public Google Sheet' },
    { id: 'sheet_name' as InputMethod, label: 'Sheet Name',
      icon: Sheet, desc: 'Your connected sheet' },
  ]

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}
      className="dot-grid">
      <Navbar />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12">

        {/* Back */}
        <AnimatedSection delay={0}>
          <button onClick={() => router.push('/')}
            className="flex items-center gap-2 text-sm mb-8
              transition-colors hover:opacity-70"
            style={{ color: 'var(--text-secondary)' }}>
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
            <p className="text-sm"
              style={{ color: 'var(--text-secondary)' }}>
              {stage === 'input'
                ? 'Choose how to import your feedback data'
                : 'AI is analyzing your feedback — this takes 2-4 minutes'
              }
            </p>
          </div>
        </AnimatedSection>

        {/* Input stage */}
        {stage === 'input' && (
          <AnimatedSection delay={160}>
            <div className="card p-6 sm:p-8 space-y-6">

              {/* Method tabs */}
              <div className="grid grid-cols-3 gap-2">
                {TAB_METHODS.map(m => (
                  <button key={m.id}
                    onClick={() => { setMethod(m.id); setError('') }}
                    className="flex flex-col items-center gap-1.5 p-3
                      rounded-xl transition-all duration-200 text-center"
                    style={{
                      background: method === m.id
                        ? 'var(--accent-light)' : 'var(--bg)',
                      border: method === m.id
                        ? '1.5px solid var(--accent)'
                        : '1.5px solid var(--border)',
                      color: method === m.id
                        ? 'var(--accent)' : 'var(--text-secondary)'
                    }}>
                    <m.icon className="w-4 h-4" />
                    <span className="text-xs font-semibold">{m.label}</span>
                    <span className="text-xs opacity-60 hidden sm:block">
                      {m.desc}
                    </span>
                  </button>
                ))}
              </div>

              {/* CSV Upload */}
              {method === 'csv' && (
                <div>
                  <label className="block text-sm font-semibold mb-2"
                    style={{ color: 'var(--text-primary)' }}>
                    Upload CSV File
                  </label>
                  <div
                    onClick={() => fileRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    className="w-full p-8 rounded-xl text-center
                      cursor-pointer transition-all duration-200"
                    style={{
                      border: `2px dashed ${dragOver
                        ? 'var(--accent)' : 'var(--border)'}`,
                      background: dragOver
                        ? 'var(--accent-light)' : 'var(--bg)',
                    }}>
                    <Upload className="w-8 h-8 mx-auto mb-3"
                      style={{ color: csvFile
                        ? 'var(--accent)' : 'var(--text-muted)' }} />
                    {csvFile ? (
                      <div>
                        <p className="text-sm font-semibold"
                          style={{ color: 'var(--accent)' }}>
                          {csvFile.name}
                        </p>
                        <p className="text-xs mt-1"
                          style={{ color: 'var(--text-muted)' }}>
                          {(csvFile.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm font-semibold"
                          style={{ color: 'var(--text-primary)' }}>
                          Drop CSV here or click to browse
                        </p>
                        <p className="text-xs mt-1"
                          style={{ color: 'var(--text-muted)' }}>
                          Must have a "feedback_text" column
                        </p>
                      </div>
                    )}
                  </div>
                  <input
                    ref={fileRef} type="file" accept=".csv"
                    className="hidden"
                    onChange={e => {
                      const f = e.target.files?.[0]
                      if (f) { setCsvFile(f); setError('') }
                    }}
                  />
                  <p className="text-xs mt-2"
                    style={{ color: 'var(--text-muted)' }}>
                    Required column: <code>feedback_text</code>
                    &nbsp;· Optional: <code>submitted_at</code>,
                    <code>source</code>
                  </p>
                </div>
              )}

              {/* Sheet URL */}
              {method === 'sheet_url' && (
                <div>
                  <label className="block text-sm font-semibold mb-2"
                    style={{ color: 'var(--text-primary)' }}>
                    Public Google Sheet URL
                  </label>
                  <div className="relative">
                    <Link className="absolute left-3.5 top-1/2
                      -translate-y-1/2 w-4 h-4"
                      style={{ color: 'var(--text-muted)' }} />
                    <input type="text" value={sheetUrl}
                      onChange={e => {
                        setSheetUrl(e.target.value); setError('')
                      }}
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      className="w-full pl-10 pr-4 py-3 rounded-xl
                        text-sm outline-none"
                      style={{
                        background: 'var(--bg)',
                        border: `1.5px solid ${error
                          ? 'var(--danger)' : 'var(--border)'}`,
                        color: 'var(--text-primary)',
                      }} />
                  </div>
                  <div className="mt-3 p-3 rounded-xl"
                    style={{
                      background: 'var(--info-light)',
                      border: '1px solid rgba(96,165,250,0.2)'
                    }}>
                    <p className="text-xs font-semibold mb-1"
                      style={{ color: 'var(--info)' }}>
                      How to share your sheet
                    </p>
                    <p className="text-xs"
                      style={{ color: 'var(--text-secondary)' }}>
                      In Google Sheets → Share → Anyone with the link →
                      Viewer → Copy link
                    </p>
                  </div>
                </div>
              )}

              {/* Sheet name */}
              {method === 'sheet_name' && (
                <div>
                  <label className="block text-sm font-semibold mb-2"
                    style={{ color: 'var(--text-primary)' }}>
                    Google Sheet Name
                  </label>
                  <div className="relative">
                    <FileSpreadsheet className="absolute left-3.5
                      top-1/2 -translate-y-1/2 w-4 h-4"
                      style={{ color: 'var(--text-muted)' }} />
                    <input type="text" value={sheetName}
                      onChange={e => {
                        setSheetName(e.target.value); setError('')
                      }}
                      onKeyDown={e => e.key === 'Enter' && handleStart()}
                      placeholder="e.g. product_feedback"
                      className="w-full pl-10 pr-4 py-3 rounded-xl
                        text-sm outline-none"
                      style={{
                        background: 'var(--bg)',
                        border: `1.5px solid ${error
                          ? 'var(--danger)' : 'var(--border)'}`,
                        color: 'var(--text-primary)',
                      }} />
                  </div>
                  <p className="text-xs mt-2"
                    style={{ color: 'var(--text-muted)' }}>
                    Sheet must be shared with the Lumiq service account
                  </p>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0"
                    style={{ color: 'var(--danger)' }} />
                  <p className="text-sm"
                    style={{ color: 'var(--danger)' }}>
                    {error}
                  </p>
                </div>
              )}

              {/* What happens */}
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
                  'Feedback ingested and language detected',
                  'Text translated and intent classified',
                  'Similar feedback clustered automatically',
                  'AI identifies root causes per cluster',
                  'Insights scored and prioritized',
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
              <button onClick={handleStart}
                disabled={loading || (
                  method === 'csv' ? !csvFile :
                  method === 'sheet_url' ? !sheetUrl.trim() :
                  !sheetName.trim()
                )}
                className="w-full flex items-center justify-center gap-2
                  py-3.5 rounded-xl text-sm font-bold text-white
                  transition-all hover:opacity-90 active:scale-95
                  disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: 'var(--accent)',
                  boxShadow: 'var(--shadow-accent)'
                }}>
                <Play className="w-4 h-4 fill-white" />
                {loading ? 'Starting...' : 'Run Analysis'}
              </button>
            </div>
          </AnimatedSection>
        )}

        {/* Running stage */}
        {stage === 'running' && (
          <AnimatedSection delay={0}>
            <div className="card p-6 sm:p-8">
              <ProgressBar onComplete={() => {}} />
            </div>
          </AnimatedSection>
        )}

      </main>
      <AgentChat />
    </div>
  )
}