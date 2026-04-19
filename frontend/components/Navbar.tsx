'use client'
import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import {
  LayoutDashboard, MessageSquare, Layers,
  Sun, Moon, Download, Zap, Plus, Menu, X
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
  const [menuOpen, setMenuOpen] = useState(false)

  const handleExport = async () => {
    try { await exportInsights() }
    catch (e) { console.error('Export failed:', e) }
  }

  const navigate = (href: string) => {
    router.push(href)
    setMenuOpen(false)
  }

  return (
    <>
      <header className="anim-slide-down sticky top-0 z-50 w-full glass">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 h-16
          flex items-center gap-4">

          {/* Logo */}
          <div className="flex items-center gap-2 shrink-0 cursor-pointer"
            onClick={() => navigate('/')}>
            <div className="w-8 h-8 rounded-xl flex items-center
              justify-center shadow-md"
              style={{ background: 'var(--accent)' }}>
              <Zap className="w-4 h-4 text-white fill-white" />
            </div>
            <span className="font-display text-lg font-bold"
              style={{ color: 'var(--text-primary)' }}>
              Lumiq
            </span>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1 flex-1">
            {NAV.map(item => (
              <div key={item.label}
                className={`nav-pill ${pathname === item.href ? 'active' : ''}`}
                onClick={() => navigate(item.href)}>
                <item.icon className="w-3.5 h-3.5" />
                {item.label}
              </div>
            ))}
          </nav>

          {/* Desktop right actions */}
          <div className="hidden md:flex items-center gap-3 ml-auto">
            <button onClick={() => navigate('/analyse')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl
                text-sm font-semibold transition-all hover:opacity-90"
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)'
              }}>
              <Plus className="w-3.5 h-3.5" />
              New Analysis
            </button>
            <button onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 rounded-xl
                text-sm font-semibold text-white transition-all hover:opacity-90"
              style={{ background: 'var(--accent)' }}>
              <Download className="w-3.5 h-3.5" />
              Export
            </button>
            <button onClick={toggle}
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)'
              }}>
              {theme === 'dark'
                ? <Sun className="w-4 h-4" />
                : <Moon className="w-4 h-4" />}
            </button>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center
              text-white text-xs font-bold"
              style={{ background: 'var(--purple)' }}>
              PM
            </div>
          </div>

          {/* Mobile right — only essential actions */}
          <div className="flex md:hidden items-center gap-2 ml-auto">
            <button onClick={() => navigate('/analyse')}
              className="flex items-center justify-center w-9 h-9
                rounded-xl transition-all"
              style={{
                background: 'var(--accent)',
                color: 'white'
              }}>
              <Plus className="w-4 h-4" />
            </button>
            <button onClick={toggle}
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)'
              }}>
              {theme === 'dark'
                ? <Sun className="w-4 h-4" />
                : <Moon className="w-4 h-4" />}
            </button>
            {/* Hamburger */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)'
              }}>
              {menuOpen
                ? <X className="w-4 h-4" />
                : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div className="md:hidden fixed top-16 left-0 right-0 z-40
          border-b shadow-lg"
          style={{
            background: 'var(--bg-card)',
            borderColor: 'var(--border)'
          }}>
          <div className="px-4 py-3 space-y-1">

            {/* Nav links */}
            {NAV.map(item => (
              <div key={item.label}
                onClick={() => navigate(item.href)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl
                  cursor-pointer transition-all"
                style={{
                  background: pathname === item.href
                    ? 'var(--accent-light)' : 'transparent',
                  color: pathname === item.href
                    ? 'var(--accent)' : 'var(--text-primary)'
                }}>
                <item.icon className="w-4 h-4" />
                <span className="text-sm font-semibold">{item.label}</span>
              </div>
            ))}

            {/* Divider */}
            <div className="h-px my-2"
              style={{ background: 'var(--border)' }} />

            {/* Export */}
            <div onClick={handleExport}
              className="flex items-center gap-3 px-4 py-3 rounded-xl
                cursor-pointer transition-all"
              style={{ color: 'var(--text-primary)' }}>
              <Download className="w-4 h-4" />
              <span className="text-sm font-semibold">Export Insights</span>
            </div>

            {/* PM badge */}
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-8 h-8 rounded-xl flex items-center
                justify-center text-white text-xs font-bold"
                style={{ background: 'var(--purple)' }}>
                PM
              </div>
              <span className="text-sm font-semibold"
                style={{ color: 'var(--text-primary)' }}>
                Product Manager
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}