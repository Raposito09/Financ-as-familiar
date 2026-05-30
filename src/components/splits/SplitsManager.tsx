'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, getInitials, AVATAR_COLORS, CATEGORY_LABELS } from '@/lib/utils'
import type { DebtSplit, Profile, Transaction } from '@/types'

interface Props {
  splits: DebtSplit[]
  members: Profile[]
  transactions: Transaction[]
  userId: string
}

export default function SplitsManager({ splits, members, transactions, userId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [txId, setTxId] = useState<string>('')
  const [debtors, setDebtors] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)

  const ownExpenses = transactions.filter(t => t.user_id === userId && t.type === 'expense')

  function openNew() {
    setTxId(ownExpenses[0]?.id ?? '')
    setDebtors({})
    setError(null)
    setOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const tx = ownExpenses.find(t => t.id === txId)
    if (!tx) { setError('Selecione uma despesa'); return }
    const selected = Object.entries(debtors).filter(([, v]) => v).map(([id]) => id)
    if (selected.length === 0) { setError('Selecione ao menos um devedor'); return }

    const parts = selected.length + 1
    const each = parseFloat((tx.amount / parts).toFixed(2))

    startTransition(async () => {
      const rows = selected.map(debtor_id => ({
        transaction_id: tx.id,
        payer_id: userId,
        debtor_id,
        amount: each,
        settled: false,
      }))
      const { error } = await supabase.from('debt_splits').insert(rows)
      if (error) setError(error.message)
      else { setOpen(false); router.refresh() }
    })
  }

  async function toggleSettled(s: DebtSplit) {
    startTransition(async () => {
      const { error } = await supabase.from('debt_splits')
        .update({ settled: !s.settled, settled_at: !s.settled ? new Date().toISOString() : null })
        .eq('id', s.id)
      if (error) alert(error.message)
      else router.refresh()
    })
  }

  async function handleDelete(s: DebtSplit) {
    if (!confirm('Excluir esta divisão?')) return
    startTransition(async () => {
      const { error } = await supabase.from('debt_splits').delete().eq('id', s.id)
      if (error) alert(error.message)
      else router.refresh()
    })
  }

  const youOwe = splits.filter(s => s.debtor_id === userId && !s.settled)
  const theyOweYou = splits.filter(s => s.payer_id === userId && !s.settled)
  const settled = splits.filter(s => s.settled)

  const totalYouOwe = youOwe.reduce((acc, s) => acc + Number(s.amount), 0)
  const totalTheyOwe = theyOweYou.reduce((acc, s) => acc + Number(s.amount), 0)

  function renderSplit(s: DebtSplit, role: 'payer' | 'debtor' | 'settled') {
    const other = role === 'payer' ? s.debtor : s.payer
    if (!other) return null
    const idx = parseInt(other.avatar_color || '0') % AVATAR_COLORS.length
    const ac = AVATAR_COLORS[idx]
    const color = s.settled ? 'var(--text-tertiary)' : role === 'payer' ? 'var(--success)' : 'var(--danger)'
    const desc = s.transaction?.description || CATEGORY_LABELS[s.transaction?.category as never] || 'Divisão'

    return (
      <div key={s.id} className="flex items-center gap-3 py-3">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${ac.bg} ${ac.text}`}>
          {getInitials(other.name)}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium truncate ${s.settled ? 'line-through' : ''}`} style={{ color: 'var(--text)' }}>
            {role === 'payer' ? `${other.name} te deve` : `Você deve a ${other.name}`}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {desc} · {s.transaction?.date && new Date(s.transaction.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
          </p>
        </div>
        <span className="text-sm font-medium shrink-0" style={{ color }}>
          {formatCurrency(s.amount)}
        </span>
        <button onClick={() => toggleSettled(s)} disabled={pending}
          className="text-xs px-2 py-1 rounded hover:opacity-70 disabled:opacity-30"
          style={{ color: s.settled ? 'var(--text-tertiary)' : 'var(--accent)' }}>
          {s.settled ? '↩ Reabrir' : '✓ Liquidar'}
        </button>
        <button onClick={() => handleDelete(s)} disabled={pending} className="text-xs px-2 py-1 rounded hover:opacity-70 disabled:opacity-30" style={{ color: 'var(--text-tertiary)' }}>✕</button>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="card-secondary p-4">
          <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Você deve</p>
          <p className="text-xl font-semibold" style={{ color: 'var(--danger)' }}>{formatCurrency(totalYouOwe)}</p>
        </div>
        <div className="card-secondary p-4">
          <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Te devem</p>
          <p className="text-xl font-semibold" style={{ color: 'var(--success)' }}>{formatCurrency(totalTheyOwe)}</p>
        </div>
      </div>

      <div className="flex items-center justify-end">
        <button onClick={openNew} disabled={ownExpenses.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ background: 'var(--accent)' }}>
          + Nova divisão
        </button>
      </div>

      <div className="card p-4">
        <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>Pendentes</h3>
        {youOwe.length === 0 && theyOweYou.length === 0 && (
          <p className="text-sm text-center py-6" style={{ color: 'var(--text-tertiary)' }}>Nada pendente</p>
        )}
        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {theyOweYou.map(s => renderSplit(s, 'payer'))}
          {youOwe.map(s => renderSplit(s, 'debtor'))}
        </div>
      </div>

      {settled.length > 0 && (
        <div className="card p-4">
          <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Liquidadas</h3>
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {settled.map(s => renderSplit(s, 'settled'))}
          </div>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ background: 'var(--bg)' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Nova divisão</h2>
              <button onClick={() => setOpen(false)} className="text-xl" style={{ color: 'var(--text-secondary)' }}>×</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>Despesa que você pagou</label>
                <select value={txId} onChange={e => setTxId(e.target.value)} required
                  className="w-full px-3 py-2.5 text-sm rounded-lg border"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-md)', color: 'var(--text)' }}>
                  {ownExpenses.map(t => (
                    <option key={t.id} value={t.id}>
                      {new Date(t.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} · {t.description || CATEGORY_LABELS[t.category as never]} · {formatCurrency(t.amount)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium block mb-2" style={{ color: 'var(--text-secondary)' }}>Dividir com</label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {members.filter(m => m.id !== userId).map(m => (
                    <label key={m.id} className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer"
                      style={{ background: 'var(--bg-secondary)' }}>
                      <input type="checkbox" checked={!!debtors[m.id]}
                        onChange={e => setDebtors(d => ({ ...d, [m.id]: e.target.checked }))} />
                      <span className="text-sm" style={{ color: 'var(--text)' }}>{m.name}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
                  Você + selecionados dividem em partes iguais.
                </p>
              </div>
              {error && <div className="text-sm px-3 py-2 rounded-lg" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>{error}</div>}
              <button type="submit" disabled={pending}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ background: 'var(--accent)' }}>
                {pending ? 'Salvando...' : 'Criar divisão'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
