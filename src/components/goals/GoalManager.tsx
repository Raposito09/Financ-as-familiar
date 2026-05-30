'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import type { Goal } from '@/types'

const ICONS = ['⭐', '✈️', '🚗', '🏠', '🎓', '💍', '👶', '🏖️', '🎯', '💼']

interface Props {
  goals: Goal[]
  userId: string
}

export default function GoalManager({ goals, userId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Goal | null>(null)
  const [title, setTitle] = useState('')
  const [target, setTarget] = useState('')
  const [saved, setSaved] = useState('')
  const [date, setDate] = useState('')
  const [icon, setIcon] = useState('⭐')
  const [error, setError] = useState<string | null>(null)

  function openNew() {
    setEditing(null)
    setTitle(''); setTarget(''); setSaved(''); setDate(''); setIcon('⭐')
    setError(null); setOpen(true)
  }

  function openEdit(g: Goal) {
    setEditing(g)
    setTitle(g.title); setTarget(String(g.target_amount)); setSaved(String(g.saved_amount))
    setDate(g.target_date ?? ''); setIcon(g.icon ?? '⭐')
    setError(null); setOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const t = parseFloat(target.replace(',', '.'))
    const s = parseFloat((saved || '0').replace(',', '.'))
    if (isNaN(t) || t <= 0) { setError('Valor-alvo inválido'); return }
    if (isNaN(s) || s < 0) { setError('Valor guardado inválido'); return }

    startTransition(async () => {
      const payload = {
        user_id: userId, title, target_amount: t, saved_amount: s,
        target_date: date || null, icon, status: 'active' as const,
      }
      const { error } = editing
        ? await supabase.from('goals').update(payload).eq('id', editing.id)
        : await supabase.from('goals').insert(payload)
      if (error) setError(error.message)
      else { setOpen(false); router.refresh() }
    })
  }

  async function handleDelete(g: Goal) {
    if (!confirm(`Excluir objetivo "${g.title}"?`)) return
    startTransition(async () => {
      const { error } = await supabase.from('goals').delete().eq('id', g.id)
      if (error) alert(error.message)
      else router.refresh()
    })
  }

  async function handleComplete(g: Goal) {
    startTransition(async () => {
      const { error } = await supabase.from('goals').update({ status: 'completed' }).eq('id', g.id)
      if (error) alert(error.message)
      else router.refresh()
    })
  }

  return (
    <>
      <div className="flex items-center justify-end">
        <button onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ background: 'var(--accent)' }}>
          + Novo objetivo
        </button>
      </div>

      {goals.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
            Nenhum objetivo. Crie um para começar a guardar com propósito.
          </p>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {goals.map(g => {
          const pct = Math.min((g.saved_amount / g.target_amount) * 100, 100)
          const done = pct >= 100
          return (
            <div key={g.id} className="card p-4 space-y-3">
              <div className="flex items-start gap-3">
                <span className="text-2xl shrink-0">{g.icon || '⭐'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{g.title}</p>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {formatCurrency(g.saved_amount)} / {formatCurrency(g.target_amount)} · {pct.toFixed(0)}%
                  </p>
                  {g.target_date && (
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      Prazo: {new Date(g.target_date).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}
                    </p>
                  )}
                </div>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                <div className="h-full rounded-full bg-emerald-400 transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex gap-2 text-xs">
                <button onClick={() => openEdit(g)} className="px-2 py-1 rounded hover:opacity-70" style={{ color: 'var(--text-secondary)' }}>Editar</button>
                {done && g.status === 'active' && (
                  <button onClick={() => handleComplete(g)} className="px-2 py-1 rounded hover:opacity-70" style={{ color: 'var(--success)' }}>✓ Concluir</button>
                )}
                <button onClick={() => handleDelete(g)} disabled={pending} className="px-2 py-1 rounded hover:opacity-70 disabled:opacity-30 ml-auto" style={{ color: 'var(--text-tertiary)' }}>✕</button>
              </div>
            </div>
          )
        })}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ background: 'var(--bg)' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>{editing ? 'Editar objetivo' : 'Novo objetivo'}</h2>
              <button onClick={() => setOpen(false)} className="text-xl" style={{ color: 'var(--text-secondary)' }}>×</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>Título</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} required placeholder="Viagem para Europa"
                  className="w-full px-3 py-2.5 text-sm rounded-lg border"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-md)', color: 'var(--text)' }} />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>Ícone</label>
                <div className="flex flex-wrap gap-1">
                  {ICONS.map(i => (
                    <button type="button" key={i} onClick={() => setIcon(i)}
                      className="w-9 h-9 rounded-lg text-lg transition-all"
                      style={icon === i
                        ? { background: 'var(--accent-bg)', border: '1px solid var(--accent)' }
                        : { background: 'var(--bg-secondary)' }}>{i}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>Valor-alvo (R$)</label>
                  <input type="number" inputMode="decimal" step="0.01" min="0.01"
                    value={target} onChange={e => setTarget(e.target.value)} required placeholder="0,00"
                    className="w-full px-3 py-2.5 text-sm rounded-lg border"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-md)', color: 'var(--text)' }} />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>Já guardado (R$)</label>
                  <input type="number" inputMode="decimal" step="0.01" min="0"
                    value={saved} onChange={e => setSaved(e.target.value)} placeholder="0,00"
                    className="w-full px-3 py-2.5 text-sm rounded-lg border"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-md)', color: 'var(--text)' }} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>Prazo (opcional)</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm rounded-lg border"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-md)', color: 'var(--text)' }} />
              </div>
              {error && <div className="text-sm px-3 py-2 rounded-lg" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>{error}</div>}
              <button type="submit" disabled={pending}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ background: 'var(--accent)' }}>
                {pending ? 'Salvando...' : 'Salvar'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
