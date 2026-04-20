'use client'
import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Loader2, X, MessageSquare } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

interface Message {
  role: 'user' | 'agent'
  content: string
  timestamp: Date
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const QUICK_PROMPTS = [
  "Give me a summary",
  "Top 3 problems",
  "Show only bugs",
  "Next sprint priorities",
]

export function AgentChat() {
  const [open, setOpen]         = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'agent',
      content: "Hi! I am Lumiq, your AI Product Analyst. Ask me anything about your feedback data.\n\nTry asking:\n- **What are the top 3 problems?**\n- **Give me a summary of the feedback**\n- **Show me only bug reports**",
      timestamp: new Date()
    }
  ])
  const [input, setInput]   = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

const sendMessage = async (text?: string) => {
  const userMsg = (text || input).trim()
  if (!userMsg || loading) return
  setInput('')

  setMessages(prev => [...prev, {
    role: 'user',
    content: userMsg,
    timestamp: new Date()
  }])
  setLoading(true)

  try {
    const res = await fetch(`${API_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userMsg })
    })

    if (!res.ok) throw new Error(`Server error: ${res.status}`)

    const data = await res.json()

    // Handle both string and array response formats
    let responseText = ''
    if (typeof data.response === 'string') {
      responseText = data.response
    } else if (Array.isArray(data.response)) {
      responseText = data.response
        .map((item: any) =>
          typeof item === 'string' ? item : item?.text || ''
        )
        .join('\n')
    } else if (data.response?.text) {
      responseText = data.response.text
    } else {
      responseText = JSON.stringify(data.response)
    }

    setMessages(prev => [...prev, {
      role: 'agent',
      content: responseText.trim(),
      timestamp: new Date()
    }])

  } catch (e: any) {
    setMessages(prev => [...prev, {
      role: 'agent',
      content: "Sorry, I encountered an error. Please try again.",
      timestamp: new Date()
    }])
  } finally {
    setLoading(false)
  }
}
  return (
    <>
      {/* Chat bubble button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-2xl
            flex items-center justify-center shadow-lg
            transition-all hover:scale-105 active:scale-95"
          style={{ background: 'var(--accent)' }}
        >
          <MessageSquare className="w-6 h-6 text-white" />
        </button>
      )}

      {/* Chat window */}
      {open && (
        <div
          className="fixed bottom-6 right-6 z-50 rounded-2xl
            overflow-hidden shadow-2xl flex flex-col
            w-[90vw] sm:w-96"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            height: '560px',
            maxHeight: '80vh'
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 shrink-0"
            style={{ background: 'var(--accent)' }}
          >
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-white" />
              <span className="text-sm font-bold text-white">
                Lumiq Agent
              </span>
              <div className="w-1.5 h-1.5 rounded-full bg-white
                opacity-70 animate-pulse" />
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-white opacity-70 hover:opacity-100
                transition-opacity"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, i) => (
              <div key={i}
                className={`flex items-start gap-2
                  ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                {/* Avatar */}
                <div
                  className="w-7 h-7 rounded-xl flex items-center
                    justify-center shrink-0 mt-0.5"
                  style={{
                    background: msg.role === 'agent'
                      ? 'var(--accent)' : 'var(--purple)'
                  }}
                >
                  {msg.role === 'agent'
                    ? <Bot className="w-3.5 h-3.5 text-white" />
                    : <User className="w-3.5 h-3.5 text-white" />
                  }
                </div>

                {/* Bubble */}
                <div
                  className={`max-w-[82%] px-3 py-2.5 rounded-2xl
                    text-xs leading-relaxed
                    ${msg.role === 'agent'
                      ? 'rounded-tl-none' : 'rounded-tr-none'}`}
                  style={{
                    background: msg.role === 'agent'
                      ? 'var(--bg)' : 'var(--accent)',
                    color: msg.role === 'agent'
                      ? 'var(--text-primary)' : 'white',
                    border: msg.role === 'agent'
                      ? '1px solid var(--border)' : 'none'
                  }}
                >
                  {msg.role === 'agent' ? (
                    <div className="prose prose-xs max-w-none
                      prose-headings:text-xs prose-headings:font-bold
                      prose-p:text-xs prose-p:my-1
                      prose-ul:text-xs prose-ul:my-1
                      prose-li:my-0.5
                      prose-strong:font-bold
                      prose-table:text-xs
                      prose-td:p-1 prose-th:p-1"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p>{msg.content}</p>
                  )}
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {loading && (
              <div className="flex items-start gap-2">
                <div className="w-7 h-7 rounded-xl flex items-center
                  justify-center shrink-0"
                  style={{ background: 'var(--accent)' }}>
                  <Bot className="w-3.5 h-3.5 text-white" />
                </div>
                <div
                  className="px-3 py-2.5 rounded-2xl rounded-tl-none
                    flex items-center gap-2"
                  style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--border)'
                  }}
                >
                  <Loader2 className="w-3.5 h-3.5 animate-spin"
                    style={{ color: 'var(--accent)' }} />
                  <span className="text-xs"
                    style={{ color: 'var(--text-muted)' }}>
                    Thinking...
                  </span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick prompts */}
          <div className="px-3 pt-2 shrink-0 flex flex-wrap gap-1.5"
            style={{ borderTop: '1px solid var(--border)' }}>
            {QUICK_PROMPTS.map(prompt => (
              <button
                key={prompt}
                onClick={() => sendMessage(prompt)}
                disabled={loading}
                className="text-xs px-2.5 py-1 rounded-lg
                  transition-all hover:opacity-80 disabled:opacity-40"
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-secondary)'
                }}
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="p-3 shrink-0">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder="Ask about your feedback..."
                className="flex-1 px-3 py-2 rounded-xl text-xs
                  outline-none transition-all"
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)'
                }}
              />
              <button
                onClick={() => sendMessage()}
                disabled={loading || !input.trim()}
                className="w-8 h-8 rounded-xl flex items-center
                  justify-center transition-all hover:opacity-90
                  disabled:opacity-40 active:scale-95"
                style={{ background: 'var(--accent)' }}
              >
                <Send className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}