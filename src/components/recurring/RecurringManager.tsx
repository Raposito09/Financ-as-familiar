'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, CATEGORY_LABELS, PAYMENT_LABELS, CATEGORY_ICONS } from '@/lib/utils'
import type { Transaction, Category, PaymentMethod, TransactionType } from '@/types'

const CATEGORIES = Object.keys(CATEGORY_LABELS) as Category[]
const PAYMENTS = Object.keys(PAYMENT_LABELS) as PaymentMethod[]

interface Props {
  recurring: Transaction[]
  userId: string
  familyId: string
}

export default function RecurringManager({ recurring, userId, familyId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [type, setType] = useState<TransactionType>('expense')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<Category>('assinaturas')
  const [payment, setPayment] = useState<PaymentMethod>('credit_card')
  const [description, setDescription] = useState('')
  const [dayOfMonth, setDayOfMonth] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [expanding, setExpanding] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  function openNew() {
    setEditing(null)
    setType('expense'); setAmount(''); setDescription(''); setDayOfMonth(1)
    setCategory('assinaturas'); setPayment('credit_card')
    setError(null); setOpen(true)
  }

  function openEdit(t: Transaction) {
    setEditing(t)
    setType(t.type); setAmount(String(t.amount)); setDescription(t.description ?? '')
    setCategory(t.category as Category); setPayment(t.payment_method as PaymentMethod)
    setDayOfMonth(new Date(t.date).getDate())
    setError(null); setOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const v = parseFloat(amount.replace(',', '.'))
    if (isNaN(v) || v <= 0) { setError('Valor inválido'); return }

    const today = new Date()
    const day = Math.min(Math.max(dayOfMonth, 1), 28)
    const date = new Date(today.getFullYear(), today.getMonth(), day).toISOString().split('T')[0]

    startTransition(async () => {
      const payload = {
        user_id: userId, family_id: familyId,
        type, amount: v, category, payment_method: payment,
        description: description || null, date,
        is_recurring: true,
      }
      const { error } = editing
        ? await supabase.from('transactions').update(payload).eq('id', editing.id)
        : await supabase.from('transactions').insert(payload)
      if (error) setError(error.message)
      else { setOpen(false); router.refresh() }
    })
  }

  async function handleDelete(t: Transaction) {
    if (!confirm('Remover este recorrente?')) return
    startTransition(async () => {
      const { error } = await supabase.from('transactions').update({ is_recurring: false }).eq('id', t.id)
      if (error) alert(error.message)
      else router.refresh()
    })
  }

  async function expand() {
    setExpanding(true)
    setMsg(null)
    try {
      const res = await fetch('/api/recurring/expand', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro')
      setMsg(`${data.created} lançamentos gerados para este mês.`)
      router.refresh()
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Erro')
    } finally {
      setExpanding(false)
    }
  }

  const totalMonthly = recurring.filter(r => r.type === 'expense').reduce((s, r) => s + Number(r.amount), 0)

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="card-secondary p-4 flex-1">
          <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Compromisso mensal recorrente</p>
          <p className="text-xl font-semibold" style={{ color: 'var(--text)' }}>{formatCurrency(totalMonthly)}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={expand} disabled={expanding}
            className="px-4 py-2 rounded-xl text-sm font-medium border disabled:opacity-50"
            style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>
            {expanding ? 'Gerando…' : '↻ Gerar do mês'}
          </button>
          <button onClick={openNew}
            className="px-4 py-2 rounded-xl text-sm font-medium text-white"
            style={{ background: 'var(--accent)' }}>
            + Novo recorrente
          </button>
        </div>
      </div>

      {msg && (
        <div className="card p-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{msg}</div>
      )}

      <div className="card p-4">
        <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--text)' }}>Templates recorrentes</h3>
        {recurring.length === 0 && (
          <p className="text-sm text-center py-8" style={{ color: 'var(--text-tertiary)' }}>
            Nenhum gasto recorrente. Cadastre aluguel, streaming, plano de saúde para gerar automaticamente todo mês.
          </p>
        )}
        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {recurring.map(t => {
            const isIncome = t.type === 'income'
            return (
              <div key={t.id} className="flex items-center gap-3 py-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center text-base shrink-0"
                  style={{ background: isIncome ? 'var(--success-bg)' : 'var(--danger-bg)' }}>
                  {CATEGORY_ICONS[t.category as never] ?? '🔁'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                    {t.description || CATEGORY_LABELS[t.category as never]}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    Dia {new Date(t.date).getDate()} · {CATEGORY_LABELS[t.category as never]} · {PAYMENT_LABELS[t.payment_method as never]}
                  </p>
                </div>
                <span className="text-sm font-medium shrink-0" style={{ color: isIncome ? 'var(--success)' : 'var(--danger)' }}>
                  {isIncome ? '+' : '-'}{formatCurrency(t.amount)}
                </span>
                <button onClick={() => openEdit(t)} className="text-xs px-2 py-1 rounded hover:opacity-70" style={{ color: 'var(--text-secondary)' }}>Editar</button>
                <button onClick={() => handleDelete(t)} disabled={pending} className="text-xs px-2 py-1 rounded hover:opacity-70 disabled:opacity-30" style={{ color: 'var(--text-tertiary)' }}>✕</button>
              </div>
            )
          })}
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ background: 'var(--bg)' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>{editing ? 'Editar recorrente' : 'Novo recorrente'}</h2>
              <button onClick={() => setOpen(false)} className="text-xl" style={{ color: 'var(--text-secondary)' }}>×</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex rounded-lg p-1" style={{ background: 'var(--bg-secondary)' }}>
                {(['expense', 'income'] as TransactionType[]).map(t => (
                  <button type="button" key={t} onClick={() => setType(t)}
                    className="flex-1 py-2 text-sm font-medium rounded-md"
                    style={type === t
                      ? { background: t === 'income' ? 'var(--success-bg)' : 'var(--danger-bg)', color: t === 'income' ? 'var(--success)' : 'var(--danger)' }
                      : { color: 'var(--text-secondary)' }}>
                    {t === 'expense' ? 'Gasto' : 'Receita'}
                  </button>
                ))}
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>Valor (R$)</label>
                <input type="number" inputMode="decimal" step="0.01" min="0.01"
                  value={amount} onChange={e => setAmount(e.target.value)} placeholder="0,00" required
                  className="w-full px-3 py-3 text-lg font-semibold rounded-xl border"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-md)', color: 'var(--text)' }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>Categoria</label>
                  <select value={category} onChange={e => setCategory(e.target.value as Category)}
                    className="w-full px-3 py-2.5 text-sm rounded-lg border"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-md)', color: 'var(--text)' }}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>Pagamento</label>
                  <select value={payment} onChange={e => setPayment(e.target.value as PaymentMethod)}
                    className="w-full px-3 py-2.5 text-sm rounded-lg border"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-md)', color: 'var(--text)' }}>
                    {PAYMENTS.map(p => <option key={p} value={p}>{PAYMENT_LABELS[p]}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>Dia do mês (1–28)</label>
                <input type="number" min="1" max="28" value={dayOfMonth} onChange={e => setDayOfMonth(Number(e.target.value))} required
                  className="w-full px-3 py-2.5 text-sm rounded-lg border"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-md)', color: 'var(--text)' }} />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>Descrição</label>
                <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex: Netflix"
                  className="w-full px-3 py-2.5 text-sm rounded-lg border"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-md)', color: 'var(--text)' }} />
              </div>
              {error && <div className="text-sm px-3 py-2 rounded-lg" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>{error}</div>}
              <button type="submit" disabled={pending}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: 'var(--accent)' }}>
                {pending ? 'Salvando…' : 'Salvar'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
