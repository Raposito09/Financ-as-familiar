'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { getInitials } from '@/lib/utils'
import type { Profile } from '@/types'

export default function Topbar({ profile }: { profile: Profile & { families?: { name: string } } }) {
  const [dark, setDark] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const stored = localStorage.getItem('theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const isDark = stored === 'dark' || (!stored && prefersDark)
    setDark(isDark)
    document.documentElement.classList.toggle('dark', isDark)
  }, [])

  function toggleTheme() {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = getInitials(profile.name)
  const isAdmin = profile.role === 'admin'

  return (
    <header className="h-14 flex items-center justify-between px-4 md:px-6 border-b shrink-0"
            style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
      <div className="flex items-center gap-2">
        <h1 className="text-sm font-medium" style={{ color: 'var(--text)' }}>
          {profile.name}
        </h1>
        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={isAdmin
                ? { background: 'var(--accent-bg)', color: 'var(--accent)' }
                : { background: 'var(--success-bg)', color: 'var(--success)' }}>
          {isAdmin ? 'Admin' : 'Membro'}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {/* Dark mode toggle */}
        <button onClick={toggleTheme}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-base transition-colors hover:bg-[var(--bg-secondary)]"
          style={{ color: 'var(--text-secondary)' }}
          aria-label="Alternar tema">
          {dark ? '☀️' : '🌙'}
        </button>

        {/* Avatar + menu */}
        <div className="relative">
          <button onClick={() => setMenuOpen(v => !v)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-opacity hover:opacity-80"
            style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}>
            {initials}
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-10 w-48 rounded-xl border overflow-hidden z-50"
                 style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
              <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{profile.name}</p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{profile.email}</p>
              </div>
              <button onClick={signOut}
                className="w-full px-4 py-2.5 text-sm text-left transition-colors hover:bg-[var(--bg-secondary)]"
                style={{ color: 'var(--danger)' }}>
                Sair
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
