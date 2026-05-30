'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, CATEGORY_LABELS, CATEGORY_COLORS } from '@/lib/utils'
import type { Budget, Category } from '@/types'

const CATEGORIES = Object.keys(CATEGORY_LABELS) as Category[]

interface Item {
  budget: Budget
  spent: number
}

interface Props {
  items: Item[]
  month: number
  year: number
  userId: string
}

export default function BudgetManager({ items, month, year, userId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Budget | null>(null)
  const [category, setCategory] = useState<Category>('alimentacao')
  const [limit, setLimit] = useState('')
  const [error, setError] = useState<string | null>(null)

  function openNew() {
    setEditing(null)
    setCategory('alimentacao')
    setLimit('')
    setError(null)
    setOpen(true)
  }

  function openEdit(b: Budget) {
    setEditing(b)
    setCategory(b.category as Category)
    setLimit(String(b.limit_amount))
    setError(null)
    setOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const amount = parseFloat(limit.replace(',', '.'))
    if (isNaN(amount) || amount <= 0) {
      setError('Valor inválido')
      return
    }

    startTransition(async () => {
      const payload = { user_id: userId, category, limit_amount: amount, month, year }
      const { error } = editing
        ? await supabase.from('budgets').update(payload).eq('id', editing.id)
        : await supabase.from('budgets').upsert(payload, { onConflict: 'user_id,category,month,year' })
      if (error) setError(error.message)
      else {
        setOpen(false)
        router.refresh()
      }
    })
  }

  async function handleDelete(b: Budget) {
    if (!confirm(`Excluir orçamento de ${CATEGORY_LABELS[b.category as Category]}?`)) return
    startTransition(async () => {
      const { error } = await supabase.from('budgets').delete().eq('id', b.id)
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
          + Novo orçamento
        </button>
      </div>

      <div className="card p-4">
        {items.length === 0 && (
          <p className="text-sm text-center py-8" style={{ color: 'var(--text-tertiary)' }}>
            Nenhum orçamento definido. Crie um para acompanhar seus limites mensais.
          </p>
        )}
        <div className="space-y-4">
          {items.map(({ budget: b, spent }) => {
            const pct = b.limit_amount > 0 ? spent / b.limit_amount : 0
            const over = pct >= 1
            const warn = pct >= 0.8 && pct < 1
            const barColor = over ? 'var(--danger)' : warn ? 'var(--warning)' : CATEGORY_COLORS[b.category as Category]
            const labelColor = over ? 'var(--danger)' : warn ? 'var(--warning)' : 'var(--text-secondary)'

            return (
              <div key={b.id} className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                      {CATEGORY_LABELS[b.category as Category]}
                    </p>
                    <p className="text-xs" style={{ color: labelColor }}>
                      {formatCurrency(spent)} / {formatCurrency(b.limit_amount)} · {(pct * 100).toFixed(0)}%
                    </p>
                  </div>
                  <button onClick={() => openEdit(b)} className="text-xs px-2 py-1 rounded hover:opacity-70" style={{ color: 'var(--text-secondary)' }}>Editar</button>
                  <button onClick={() => handleDelete(b)} disabled={pending} className="text-xs px-2 py-1 rounded hover:opacity-70 disabled:opacity-30" style={{ color: 'var(--text-tertiary)' }}>✕</button>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(pct * 100, 100)}%`, background: barColor }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ background: 'var(--bg)' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>
                {editing ? 'Editar orçamento' : 'Novo orçamento'}
              </h2>
              <button onClick={() => setOpen(false)} className="text-xl" style={{ color: 'var(--text-secondary)' }}>×</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>Categoria</label>
                <select value={category} onChange={e => setCategory(e.target.value as Category)}
                  disabled={!!editing}
                  className="w-full px-3 py-2.5 text-sm rounded-lg border disabled:opacity-60"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-md)', color: 'var(--text)' }}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>Limite mensal (R$)</label>
                <input type="number" inputMode="decimal" step="0.01" min="0.01"
                  value={limit} onChange={e => setLimit(e.target.value)} placeholder="0,00" required
                  className="w-full px-3 py-3 text-lg font-semibold rounded-xl border"
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
