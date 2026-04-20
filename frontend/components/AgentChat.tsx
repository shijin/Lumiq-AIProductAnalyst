'use client'
import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Loader2, X, MessageSquare } from 'lucide-react'

interface Message {
  role: 'user' | 'agent'
  content: string
  timestamp: Date
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export function AgentChat() {
  const [open, setOpen]       = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'agent',
      content: "Hi! I am Lumiq, your AI Product Analyst. Ask me anything about your feedback data. Try: \"What are the top 3 problems?\" or \"Why is payment ranked first?\"",
      timestamp: new Date()
    }
  ])
  const [input, setInput]     = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || loading) return
    const userMsg = input.trim()
    setInput('')
    setMessages(prev => [...prev, {
      role: 'user', content: userMsg, timestamp: new Date()
    }])
    setLoading(true)

    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg })
      })
      const data = await res.json()
      setMessages(prev => [...prev, {
        role: 'agent',
        content: data.response,
        timestamp: new Date()
      }])
    } catch {
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
      {/* Chat bubble */}
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
        <div className="fixed bottom-6 right-6 z-50 w-80 sm:w-96
          rounded-2xl overflow-hidden shadow-2xl flex flex-col"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            height: '500px'
          }}>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3
            border-b"
            style={{
              borderColor: 'var(--border)',
              background: 'var(--accent)'
            }}>
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-white" />
              <span className="text-sm font-bold text-white">
                Lumiq Agent
              </span>
            </div>
            <button onClick={() => setOpen(false)}
              className="text-white opacity-70 hover:opacity-100">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg, i) => (
              <div key={i}
                className={`flex items-start gap-2
                  ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-7 h-7 rounded-xl flex items-center
                  justify-center shrink-0
                  ${msg.role === 'agent'
                    ? 'bg-[var(--accent)]'
                    : 'bg-[var(--purple)]'}`}>
                  {msg.role === 'agent'
                    ? <Bot className="w-3.5 h-3.5 text-white" />
                    : <User className="w-3.5 h-3.5 text-white" />}
                </div>
                <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-xs
                  leading-relaxed
                  ${msg.role === 'agent'
                    ? 'rounded-tl-none'
                    : 'rounded-tr-none'}`}
                  style={{
                    background: msg.role === 'agent'
                      ? 'var(--bg)' : 'var(--accent)',
                    color: msg.role === 'agent'
                      ? 'var(--text-primary)' : 'white',
                    border: msg.role === 'agent'
                      ? '1px solid var(--border)' : 'none'
                  }}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-[var(--accent)]
                  flex items-center justify-center">
                  <Bot className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="px-3 py-2 rounded-2xl rounded-tl-none"
                  style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--border)'
                  }}>
                  <Loader2 className="w-3.5 h-3.5 animate-spin"
                    style={{ color: 'var(--accent)' }} />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t"
            style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder="Ask about your feedback..."
                className="flex-1 px-3 py-2 rounded-xl text-xs outline-none"
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)'
                }}
              />
              <button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className="w-8 h-8 rounded-xl flex items-center
                  justify-center transition-all hover:opacity-90
                  disabled:opacity-50"
                style={{ background: 'var(--accent)' }}>
                <Send className="w-3.5 h-3.5 text-white" />
              </button>
            </div>

            {/* Quick prompts */}
            <div className="flex flex-wrap gap-1 mt-2">
              {[
                "Top 3 problems",
                "Feedback summary",
                "Show only bugs"
              ].map(prompt => (
                <button key={prompt}
                  onClick={() => setInput(prompt)}
                  className="text-xs px-2 py-1 rounded-lg transition-all"
                  style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-secondary)'
                  }}>
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}