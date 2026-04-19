'use client'

import { Zap } from 'lucide-react'
import { useEffect, useState } from 'react'

export function Header() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header className={`sticky top-0 z-50 transition-all duration-300
      ${scrolled
        ? 'bg-white/90 backdrop-blur-md shadow-sm border-b border-[#ede8df]'
        : 'bg-[#faf7f2] border-b border-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <div className="flex items-center gap-2.5 animate-fade-in">
            <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-sm">
              <Zap className="w-4 h-4 text-white fill-white" />
            </div>
            <span className="font-serif text-xl text-[#1a1714] tracking-tight">
              Lumiq
            </span>
            <span className="hidden sm:inline text-xs bg-amber-100 text-amber-700 px-2.5 py-0.5 rounded-full font-medium border border-amber-200">
              AI Analyst
            </span>
          </div>

          {/* Right */}
          <div className="flex items-center gap-3 animate-fade-in delay-200">
            <span className="text-xs text-[#6b6560] hidden sm:block">
              Powered by Claude
            </span>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-xs text-emerald-600 font-medium hidden sm:block">Live</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}