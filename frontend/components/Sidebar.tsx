'use client'

import { useState } from 'react'
import {
  LayoutDashboard, MessageSquare, Layers,
  Settings, ChevronLeft, ChevronRight,
  Zap, Moon, Sun, TrendingUp
} from 'lucide-react'
import { useTheme } from './ThemeProvider'

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard', active: true },
  { icon: MessageSquare, label: 'Feedback', active: false },
  { icon: Layers, label: 'Clusters', active: false },
  { icon: TrendingUp, label: 'Insights', active: false },
  { icon: Settings, label: 'Settings', active: false },
]

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const { theme, toggleTheme } = useTheme()

  return (
    <aside
      className={`animate-slide-left fixed left-0 top-0 h-screen z-40 flex flex-col
        transition-all duration-300 ease-in-out
        ${collapsed ? 'w-16' : 'w-56'}
        border-r border-[var(--border)]`}
      style={{ background: 'var(--bg-sidebar)' }}
    >
      {/* Logo */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
        {!collapsed && (
          <div className="flex items-center gap-2 animate-fade-in">
            <div className="w-7 h-7 bg-gradient-to-br from-amber-400 to-orange-500
              rounded-lg flex items-center justify-center accent-glow">
              <Zap className="w-3.5 h-3.5 text-white fill-white" />
            </div>
            <span className="font-serif text-lg text-[var(--accent)]">
              Lumiq
            </span>
          </div>
        )}
        {collapsed && (
          <div className="w-7 h-7 bg-gradient-to-br from-amber-400 to-orange-500
            rounded-lg flex items-center justify-center mx-auto accent-glow">
            <Zap className="w-3.5 h-3.5 text-white fill-white" />
          </div>
        )}
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="text-[var(--text-secondary)] hover:text-[var(--accent)]
              transition-colors p-1 rounded-lg"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Expand button when collapsed */}
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="mx-auto mt-2 text-[var(--text-secondary)]
            hover:text-[var(--accent)] transition-colors p-1"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      {/* Nav items */}
      <nav className="flex-1 p-3 space-y-1 mt-2">
        {NAV_ITEMS.map((item, i) => (
          <div
            key={item.label}
            className={`sidebar-item animate-slide-left flex items-center gap-3 px-3 py-2.5
              ${item.active ? 'active' : 'text-[var(--text-secondary)]'}
              ${collapsed ? 'justify-center' : ''}`}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <item.icon className="w-4 h-4 shrink-0" />
            {!collapsed && (
              <span className="text-sm font-medium">{item.label}</span>
            )}
          </div>
        ))}
      </nav>

      {/* Bottom section */}
      <div className="p-3 border-t border-[var(--border)] space-y-2">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className={`sidebar-item w-full flex items-center gap-3 px-3 py-2.5
            text-[var(--text-secondary)] ${collapsed ? 'justify-center' : ''}`}
        >
          {theme === 'dark'
            ? <Sun className="w-4 h-4 shrink-0" />
            : <Moon className="w-4 h-4 shrink-0" />
          }
          {!collapsed && (
            <span className="text-sm font-medium">
              {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </span>
          )}
        </button>

        {/* User */}
        {!collapsed && (
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="w-7 h-7 bg-gradient-to-br from-violet-500 to-indigo-600
              rounded-full flex items-center justify-center text-white text-xs font-bold">
              PM
            </div>
            <div>
              <p className="text-xs font-medium text-[var(--text-primary)]">
                Product Manager
              </p>
              <p className="text-xs text-[var(--text-secondary)]">Lumiq</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}