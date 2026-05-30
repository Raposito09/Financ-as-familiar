'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, CATEGORY_LABELS, PAYMENT_LABELS, CATEGORY_ICONS, getInitials, AVATAR_COLORS } from '@/lib/utils'
import type { Transaction, Category, PaymentMethod, TransactionType } from '@/types'

interface Props {
  transactions: Transaction[]
  showOwner?: boolean
  canDelete?: boolean
}

type Filters = {
  type: TransactionType | 'all'
  category: Category | 'all'
  payment: PaymentMethod | 'all'
  q: string
}

const CATEGORIES = Object.keys(CATEGORY_LABELS) as Category[]
const PAYMENTS = Object.keys(PAYMENT_LABELS) as PaymentMethod[]

export default function TransactionList({ transactions, showOwner = false, canDelete = true }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [pending, startTransition] = useTransition()
  const [filters, setFilters] = useState<Filters>({ type: 'all', category: 'all', payment: 'all', q: '' })

  const filtered = transactions.filter(t => {
    if (filters.type !== 'all' && t.type !== filters.type) return false
    if (filters.category !== 'all' && t.category !== filters.category) return false
    if (filters.payment !== 'all' && t.payment_method !== filters.payment) return false
    if (filters.q) {
      const q = filters.q.toLowerCase()
      const hay = `${t.description ?? ''} ${CATEGORY_LABELS[t.category as never] ?? ''}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })

  async function handleDelete(t: Transaction) {
    const msg = t.installment_group_id
      ? `Excluir todas as ${t.installment_total} parcelas?`
      : 'Excluir este lançamento?'
    if (!confirm(msg)) return

    startTransition(async () => {
      const query = supabase.from('transactions').delete()
      const { error } = t.installment_group_id
        ? await query.eq('installment_group_id', t.installment_group_id)
        : await query.eq('id', t.id)
      if (error) alert('Erro ao excluir: ' + error.message)
      else router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="card p-3 grid grid-cols-2 md:grid-cols-4 gap-2">
        <select value={filters.type} onChange={e => setFilters(f => ({ ...f, type: e.target.value as never }))}
          className="px-3 py-2 text-sm rounded-lg border"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-md)', color: 'var(--text)' }}>
          <option value="all">Todos os tipos</option>
          <option value="income">Receitas</option>
          <option value="expense">Despesas</option>
        </select>
        <select value={filters.category} onChange={e => setFilters(f => ({ ...f, category: e.target.value as never }))}
          className="px-3 py-2 text-sm rounded-lg border"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-md)', color: 'var(--text)' }}>
          <option value="all">Todas categorias</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
        </select>
        <select value={filters.payment} onChange={e => setFilters(f => ({ ...f, payment: e.target.value as never }))}
          className="px-3 py-2 text-sm rounded-lg border"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-md)', color: 'var(--text)' }}>
          <option value="all">Toda forma</option>
          {PAYMENTS.map(p => <option key={p} value={p}>{PAYMENT_LABELS[p]}</option>)}
        </select>
        <input type="search" placeholder="Buscar..."
          value={filters.q} onChange={e => setFilters(f => ({ ...f, q: e.target.value }))}
          className="px-3 py-2 text-sm rounded-lg border"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-md)', color: 'var(--text)' }} />
      </div>

      {/* Lista */}
      <div className="card p-4">
        {filtered.length === 0 && (
          <p className="text-sm text-center py-8" style={{ color: 'var(--text-tertiary)' }}>
            Nenhum lançamento encontrado
          </p>
        )}
        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {filtered.map(t => {
            const isIncome = t.type === 'income'
            const owner = t.profile
            const avatarIdx = owner ? parseInt(owner.avatar_color || '0') % AVATAR_COLORS.length : 0
            const ac = AVATAR_COLORS[avatarIdx]
            return (
              <div key={t.id} className="flex items-center gap-3 py-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center text-base shrink-0"
                  style={{ background: isIncome ? 'var(--success-bg)' : 'var(--danger-bg)' }}>
                  {CATEGORY_ICONS[t.category as never] ?? (isIncome ? '↑' : '↓')}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate font-medium" style={{ color: 'var(--text)' }}>
                    {t.description || CATEGORY_LABELS[t.category as never] || t.category}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {CATEGORY_LABELS[t.category as never]} · {PAYMENT_LABELS[t.payment_method as never]} ·{' '}
                    {new Date(t.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                    {t.installment_total && ` · ${t.installment_current}/${t.installment_total}x`}
                  </p>
                </div>
                {showOwner && owner && (
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0 ${ac.bg} ${ac.text}`}
                    title={owner.name}>
                    {getInitials(owner.name)}
                  </div>
                )}
                <span className="text-sm font-medium shrink-0"
                  style={{ color: isIncome ? 'var(--success)' : 'var(--danger)' }}>
                  {isIncome ? '+' : '-'}{formatCurrency(t.amount)}
                </span>
                {canDelete && (
                  <button onClick={() => handleDelete(t)} disabled={pending}
                    className="text-xs px-2 py-1 rounded hover:opacity-70 disabled:opacity-30"
                    style={{ color: 'var(--text-tertiary)' }} title="Excluir">
                    ✕
                  </button>
                )}
              </div>
            )
          })}
        </div>
        {filtered.length > 0 && (
          <p className="text-xs mt-3 pt-3 border-t" style={{ color: 'var(--text-tertiary)', borderColor: 'var(--border)' }}>
            {filtered.length} lançamento{filtered.length !== 1 ? 's' : ''} · Total: {formatCurrency(filtered.reduce((s, t) => s + (t.type === 'expense' ? -t.amount : t.amount), 0))}
          </p>
        )}
      </div>
    </div>
  )
}
