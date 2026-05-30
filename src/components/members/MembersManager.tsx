'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getInitials, AVATAR_COLORS } from '@/lib/utils'
import type { Profile, UserRole, FamilyInvite } from '@/types'

interface Props {
  members: Profile[]
  invites: FamilyInvite[]
  currentUserId: string
}

export default function MembersManager({ members, invites, currentUserId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [pending, startTransition] = useTransition()
  const [sending, setSending] = useState<string | null>(null)
  const [emailMsg, setEmailMsg] = useState<string | null>(null)
  const [creatingInvite, setCreatingInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [newInviteLink, setNewInviteLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)

  async function sendWeekly(userId: string) {
    setSending(userId)
    setEmailMsg(null)
    try {
      const res = await fetch(`/api/email/weekly?user_id=${userId}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro')
      const r = data.results?.[0]
      setEmailMsg(r?.ok ? `✓ Resumo enviado para ${r.email}` : `Falhou: ${r?.error ?? data.error}`)
    } catch (e) {
      setEmailMsg(e instanceof Error ? e.message : 'Erro')
    } finally {
      setSending(null)
    }
  }

  async function createInvite(e: React.FormEvent) {
    e.preventDefault()
    setCreatingInvite(true)
    setInviteError(null)
    setNewInviteLink(null)
    try {
      const res = await fetch('/api/invites', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(inviteEmail ? { email: inviteEmail } : {}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro')
      const link = `${window.location.origin}/login?invite=${data.token}`
      setNewInviteLink(link)
      setInviteEmail('')
      router.refresh()
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Erro')
    } finally {
      setCreatingInvite(false)
    }
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  async function revokeInvite(token: string) {
    if (!confirm('Revogar este convite?')) return
    startTransition(async () => {
      const res = await fetch(`/api/invites?token=${token}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.error ?? 'Erro')
      }
      router.refresh()
    })
  }

  async function toggleRole(m: Profile) {
    if (m.id === currentUserId) {
      alert('Você não pode alterar seu próprio papel')
      return
    }
    const newRole: UserRole = m.role === 'admin' ? 'member' : 'admin'
    if (!confirm(`Alterar ${m.name} para ${newRole}?`)) return
    startTransition(async () => {
      const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', m.id)
      if (error) alert(error.message)
      else router.refresh()
    })
  }

  const activeInvites = invites.filter(i => !i.used_at && new Date(i.expires_at) > new Date())

  return (
    <>
      {/* Bloco: Convidar */}
      <div className="card p-4 space-y-3">
        <div>
          <h3 className="text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>Convidar novo membro</h3>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Gere um link único de convite. Válido por 7 dias e descartado após o primeiro uso.
          </p>
        </div>
        <form onSubmit={createInvite} className="flex flex-col sm:flex-row gap-2">
          <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
            placeholder="Email (opcional — restringe a este endereço)"
            className="flex-1 px-3 py-2 text-sm rounded-lg border"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-md)', color: 'var(--text)' }} />
          <button type="submit" disabled={creatingInvite}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
            style={{ background: 'var(--accent)' }}>
            {creatingInvite ? 'Gerando…' : 'Gerar convite'}
          </button>
        </form>
        {inviteError && (
          <div className="text-xs px-3 py-2 rounded-lg" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>
            {inviteError}
          </div>
        )}
        {newInviteLink && (
          <div className="space-y-2">
            <p className="text-xs" style={{ color: 'var(--success)' }}>
              ✓ Convite criado. Copie o link abaixo e envie ao novo membro.
            </p>
            <div className="flex gap-2">
              <input type="text" readOnly value={newInviteLink}
                className="flex-1 px-3 py-2 text-xs rounded-lg border font-mono"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-md)', color: 'var(--text)' }} />
              <button onClick={() => copy(newInviteLink)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white"
                style={{ background: 'var(--accent)' }}>
                {copied ? '✓ Copiado' : 'Copiar'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bloco: Convites ativos */}
      {activeInvites.length > 0 && (
        <div className="card p-4">
          <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--text)' }}>
            Convites pendentes ({activeInvites.length})
          </h3>
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {activeInvites.map(inv => {
              const link = typeof window !== 'undefined' ? `${window.location.origin}/login?invite=${inv.token}` : ''
              const expiresIn = Math.ceil((new Date(inv.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              return (
                <div key={inv.token} className="flex items-center gap-3 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                      {inv.email ?? 'Convite genérico'}
                    </p>
                    <p className="text-xs font-mono truncate" style={{ color: 'var(--text-tertiary)' }}>
                      …{inv.token.slice(-12)}
                    </p>
                    <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                      expira em {expiresIn}d
                    </p>
                  </div>
                  <button onClick={() => copy(link)}
                    className="text-xs px-2 py-1 rounded hover:opacity-70"
                    style={{ color: 'var(--accent)' }}>
                    Copiar link
                  </button>
                  <button onClick={() => revokeInvite(inv.token)} disabled={pending}
                    className="text-xs px-2 py-1 rounded hover:opacity-70 disabled:opacity-30"
                    style={{ color: 'var(--danger)' }}>
                    Revogar
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {emailMsg && (
        <div className="card p-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{emailMsg}</div>
      )}

      {/* Bloco: Membros */}
      <div className="card p-4">
        <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--text)' }}>Membros da família ({members.length})</h3>
        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {members.map(m => {
            const idx = parseInt(m.avatar_color || '0') % AVATAR_COLORS.length
            const ac = AVATAR_COLORS[idx]
            const isMe = m.id === currentUserId
            return (
              <div key={m.id} className="flex items-center gap-3 py-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${ac.bg} ${ac.text}`}>
                  {getInitials(m.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                    {m.name} {isMe && <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>(você)</span>}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{m.email}</p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full font-medium"
                  style={{
                    background: m.role === 'admin' ? 'var(--accent-bg)' : 'var(--success-bg)',
                    color: m.role === 'admin' ? 'var(--accent)' : 'var(--success)'
                  }}>
                  {m.role === 'admin' ? 'Admin' : 'Membro'}
                </span>
                <button onClick={() => sendWeekly(m.id)} disabled={sending === m.id}
                  className="text-xs px-2 py-1 rounded hover:opacity-70 disabled:opacity-30"
                  style={{ color: 'var(--accent)' }} title="Enviar resumo semanal por email">
                  {sending === m.id ? '...' : '✉'}
                </button>
                {!isMe && (
                  <button onClick={() => toggleRole(m)} disabled={pending}
                    className="text-xs px-2 py-1 rounded hover:opacity-70 disabled:opacity-30"
                    style={{ color: 'var(--text-secondary)' }}>
                    Alterar papel
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
