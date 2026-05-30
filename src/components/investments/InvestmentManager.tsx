'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import type { Investment } from '@/types'

const TYPES = ['Renda fixa', 'Tesouro Direto', 'CDB', 'LCI/LCA', 'Ações', 'FIIs', 'Poupança', 'Cripto', 'Outros']

interface Props {
  investments: Investment[]
  userId: string
}

export default function InvestmentManager({ investments, userId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Investment | null>(null)
  const [type, setType] = useState('Renda fixa')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)

  function openNew() {
    setEditing(null)
    setType('Renda fixa'); setAmount(''); setDescription('')
    setDate(new Date().toISOString().split('T')[0])
    setError(null); setOpen(true)
  }

  function openEdit(inv: Investment) {
    setEditing(inv)
    setType(inv.type); setAmount(String(inv.amount))
    setDate(inv.date); setDescription(inv.description ?? '')
    setError(null); setOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const v = parseFloat(amount.replace(',', '.'))
    if (isNaN(v)) { setError('Valor inválido'); return }

    startTransition(async () => {
      const payload = { user_id: userId, type, amount: v, date, description: description || null }
      const { error } = editing
        ? await supabase.from('investments').update(payload).eq('id', editing.id)
        : await supabase.from('investments').insert(payload)
      if (error) setError(error.message)
      else { setOpen(false); router.refresh() }
    })
  }

  async function handleDelete(inv: Investment) {
    if (!confirm('Excluir este aporte?')) return
    startTransition(async () => {
      const { error } = await supabase.from('investments').delete().eq('id', inv.id)
      if (error) alert(error.message)
      else router.refresh()
    })
  }

  const total = investments.reduce((s, i) => s + Number(i.amount), 0)
  const byType = investments.reduce((acc: Record<string, number>, i) => {
    acc[i.type] = (acc[i.type] || 0) + Number(i.amount)
    return acc
  }, {})

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="card-secondary p-4 flex-1 mr-3">
          <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Patrimônio aportado</p>
          <p className="text-xl font-semibold" style={{ color: 'var(--text)' }}>{formatCurrency(total)}</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90 shrink-0"
          style={{ background: 'var(--accent)' }}>
          + Novo aporte
        </button>
      </div>

      {Object.keys(byType).length > 0 && (
        <div className="card p-4">
          <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--text)' }}>Por tipo</h3>
          <div className="space-y-2">
            {Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([t, v]) => {
              const pct = total > 0 ? (v / total) * 100 : 0
              return (
                <div key={t} className="flex items-center gap-3">
                  <span className="text-xs w-32 shrink-0 truncate" style={{ color: 'var(--text-secondary)' }}>{t}</span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                    <div className="h-full rounded-full bg-emerald-400" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs w-24 text-right shrink-0 font-medium" style={{ color: 'var(--text)' }}>
                    {formatCurrency(v)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="card p-4">
        <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--text)' }}>Histórico de aportes</h3>
        {investments.length === 0 && (
          <p className="text-sm text-center py-8" style={{ color: 'var(--text-tertiary)' }}>
            Nenhum aporte registrado
          </p>
        )}
        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {investments.map(inv => (
            <div key={inv.id} className="flex items-center gap-3 py-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0"
                style={{ background: 'var(--success-bg)' }}>📈</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                  {inv.type}{inv.description ? ` — ${inv.description}` : ''}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {new Date(inv.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <span className="text-sm font-medium shrink-0" style={{ color: inv.amount >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {inv.amount >= 0 ? '+' : ''}{formatCurrency(inv.amount)}
              </span>
              <button onClick={() => openEdit(inv)} className="text-xs px-2 py-1 rounded hover:opacity-70" style={{ color: 'var(--text-secondary)' }}>Editar</button>
              <button onClick={() => handleDelete(inv)} disabled={pending} className="text-xs px-2 py-1 rounded hover:opacity-70 disabled:opacity-30" style={{ color: 'var(--text-tertiary)' }}>✕</button>
            </div>
          ))}
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ background: 'var(--bg)' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>{editing ? 'Editar aporte' : 'Novo aporte'}</h2>
              <button onClick={() => setOpen(false)} className="text-xl" style={{ color: 'var(--text-secondary)' }}>×</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>Tipo</label>
                <select value={type} onChange={e => setType(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm rounded-lg border"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-md)', color: 'var(--text)' }}>
                  {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>Valor (R$)</label>
                <input type="number" inputMode="decimal" step="0.01"
                  value={amount} onChange={e => setAmount(e.target.value)} required placeholder="0,00"
                  className="w-full px-3 py-3 text-lg font-semibold rounded-xl border"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-md)', color: 'var(--text)' }} />
                <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                  Use valor negativo para registrar resgate.
                </p>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>Data</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} required
                  className="w-full px-3 py-2.5 text-sm rounded-lg border"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-md)', color: 'var(--text)' }} />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>Descrição (opcional)</label>
                <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex: Tesouro IPCA+ 2030"
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
