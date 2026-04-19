'use client'
import { useRouter, usePathname } from 'next/navigation'
import {
  LayoutDashboard, MessageSquare, Layers,
  TrendingUp, Sun, Moon, Download,
  Zap, Plus
} from 'lucide-react'
import { useTheme } from './ThemeProvider'
import { exportInsights } from '@/lib/api'

const NAV = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/' },
  { icon: MessageSquare,   label: 'Feedback',  href: '/feedback' },
  { icon: Layers,          label: 'Clusters',  href: '/clusters' },
]

export function Navbar() {
  const { theme, toggle } = useTheme()
  const router = useRouter()
  const pathname = usePathname()

  const handleExport = async () => {
    try {
      await exportInsights()
    } catch (e) {
      console.error('Export failed:', e)
    }
  }

  return (
    <header className="anim-slide-down sticky top-0 z-50 w-full glass">
      <div className="max-w-screen-xl mx-auto px-6 h-16 flex items-center gap-6">

        {/* Logo */}
        <div
          className="flex items-center gap-2.5 shrink-0 cursor-pointer"
          onClick={() => router.push('/')}
        >
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shadow-md"
            style={{ background: 'var(--accent)' }}>
            <Zap className="w-4 h-4 text-white fill-white" />
          </div>
          <span className="font-display text-lg font-bold"
            style={{ color: 'var(--text-primary)' }}>
            Lumiq
          </span>
        </div>

        {/* Nav pills */}
        <nav className="flex items-center gap-1 flex-1">
          {NAV.map(item => (
            <div
              key={item.label}
              className={`nav-pill ${pathname === item.href ? 'active' : ''}`}
              onClick={() => router.push(item.href)}
            >
              <item.icon className="w-3.5 h-3.5" />
              {item.label}
            </div>
          ))}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-3">

          {/* New Analysis */}
          <button
            onClick={() => router.push('/analyse')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl
              text-sm font-semibold transition-all duration-200
              hover:opacity-90 active:scale-95"
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)'
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            New Analysis
          </button>

          {/* Export */}
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 rounded-xl
              text-sm font-semibold text-white transition-all duration-200
              hover:opacity-90 active:scale-95"
            style={{
              background: 'var(--accent)',
              boxShadow: 'var(--shadow-accent)'
            }}
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggle}
            className="w-9 h-9 rounded-xl flex items-center justify-center
              transition-all duration-200"
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)'
            }}
          >
            {theme === 'dark'
              ? <Sun className="w-4 h-4" />
              : <Moon className="w-4 h-4" />
            }
          </button>

          {/* Avatar */}
          <div className="w-9 h-9 rounded-xl flex items-center justify-center
            text-white text-xs font-bold font-display"
            style={{ background: 'var(--purple)' }}>
            PM
          </div>
        </div>
      </div>
    </header>
  )
}