'use client'

import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" style={{ background: 'var(--bg-tertiary)' }} />}>
      <LoginInner />
    </Suspense>
  )
}

function LoginInner() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [name, setName] = useState('')
  const router = useRouter()
  const params = useSearchParams()
  const supabase = createClient()

  const inviteToken = params.get('invite')

  useEffect(() => {
    if (inviteToken) setMode('signup')
  }, [inviteToken])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        router.push('/dashboard')
        router.refresh()
      } else {
        // O servidor (trigger handle_new_user) ignora qualquer `role` enviado pelo cliente.
        // Se houver invite_token válido, o trigger consome o convite e cria como member.
        // Sem token, o trigger cria nova família e o novo usuário vira admin dela.
        const metadata: Record<string, string> = { name }
        if (inviteToken) metadata.invite_token = inviteToken

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: metadata },
        })
        if (error) throw error
        if (data.user) router.push('/dashboard')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao autenticar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
         style={{ background: 'var(--bg-tertiary)' }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-3"
               style={{ background: 'var(--accent-bg)' }}>
            <span className="text-2xl">💰</span>
          </div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>
            Finança Familiar
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Controle financeiro da sua família
          </p>
        </div>

        {/* Card */}
        <div className="card p-6">
          {/* Tabs */}
          <div className="flex rounded-lg p-1 mb-6" style={{ background: 'var(--bg-secondary)' }}>
            {(['login', 'signup'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className="flex-1 py-2 text-sm font-medium rounded-md transition-all"
                style={mode === m
                  ? { background: 'var(--bg)', color: 'var(--text)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
                  : { color: 'var(--text-secondary)' }}>
                {m === 'login' ? 'Entrar' : 'Criar conta'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {mode === 'signup' && (
              <div>
                <label className="text-sm font-medium block mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  Seu nome
                </label>
                <input
                  type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder="João Silva" required
                  className="w-full px-3 py-2.5 text-sm rounded-lg border transition-colors"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-md)', color: 'var(--text)' }}
                />
              </div>
            )}

            <div>
              <label className="text-sm font-medium block mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Email
              </label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="joao@email.com" required
                className="w-full px-3 py-2.5 text-sm rounded-lg border transition-colors"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-md)', color: 'var(--text)' }}
              />
            </div>

            <div>
              <label className="text-sm font-medium block mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Senha
              </label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required minLength={6}
                className="w-full px-3 py-2.5 text-sm rounded-lg border transition-colors"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-md)', color: 'var(--text)' }}
              />
            </div>

            {error && (
              <div className="text-sm px-3 py-2 rounded-lg" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 mt-1">
              {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta da família'}
            </button>
          </form>

          {mode === 'signup' && (
            <p className="text-xs text-center mt-4" style={{ color: 'var(--text-tertiary)' }}>
              {inviteToken
                ? 'Você está aceitando um convite e entrará como membro da família.'
                : 'Ao criar, você será o administrador da família. Convide os demais membros depois.'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
