'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { CATEGORY_LABELS, PAYMENT_LABELS } from '@/lib/utils'
import type { Category, PaymentMethod, TransactionType } from '@/types'

const CATEGORIES = Object.keys(CATEGORY_LABELS) as Category[]
const PAYMENTS   = Object.keys(PAYMENT_LABELS)  as PaymentMethod[]

export default function NewTransactionButton() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [type, setType] = useState<TransactionType>('expense')
  const [amount, setAmount]       = useState('')
  const [category, setCategory]   = useState<Category>('alimentacao')
  const [payment, setPayment]     = useState<PaymentMethod>('pix')
  const [description, setDesc]    = useState('')
  const [date, setDate]           = useState(new Date().toISOString().split('T')[0])
  const [installments, setInstallments] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrInfo, setOcrInfo] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  async function handleOcr(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setOcrLoading(true); setOcrInfo(null); setError(null)
    try {
      const form = new FormData()
      form.append('image', file)
      const res = await fetch('/api/ai/ocr', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha na IA')
      if (data.amount) setAmount(String(data.amount))
      if (data.date) setDate(data.date)
      if (data.description) setDesc(data.description)
      if (data.suggested_category && (CATEGORY_LABELS as Record<string, string>)[data.suggested_category]) {
        setCategory(data.suggested_category as Category)
      }
      const conf = data.confidence ? ` (confiança ${Math.round(data.confidence * 100)}%)` : ''
      setOcrInfo(`Campos preenchidos pela IA${conf}. Revise antes de salvar.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro OCR')
    } finally {
      setOcrLoading(false)
      e.target.value = ''
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Não autenticado')
      const { data: profile } = await supabase.from('profiles').select('family_id').eq('id', user.id).single()
      if (!profile) throw new Error('Perfil não encontrado')

      const amountNum = parseFloat(amount.replace(',', '.'))
      if (isNaN(amountNum) || amountNum <= 0) throw new Error('Valor inválido')

      if (installments > 1) {
        const groupId = crypto.randomUUID()
        const installmentAmount = amountNum / installments
        const records = Array.from({ length: installments }, (_, i) => {
          const d = new Date(date)
          d.setMonth(d.getMonth() + i)
          return {
            user_id: user.id, family_id: profile.family_id,
            type, amount: parseFloat(installmentAmount.toFixed(2)),
            category, payment_method: payment,
            description: description || null,
            date: d.toISOString().split('T')[0],
            installment_total: installments, installment_current: i + 1,
            installment_group_id: groupId, is_recurring: false,
          }
        })
        const { error } = await supabase.from('transactions').insert(records)
        if (error) throw error
      } else {
        const { error } = await supabase.from('transactions').insert({
          user_id: user.id, family_id: profile.family_id,
          type, amount: amountNum, category,
          payment_method: payment, description: description || null,
          date, is_recurring: false,
        })
        if (error) throw error
      }

      setOpen(false)
      setAmount(''); setDesc(''); setInstallments(1)
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
        style={{ background: 'var(--accent)' }}>
        + Novo lançamento
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4"
             style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ background: 'var(--bg)' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Novo lançamento</h2>
              <button onClick={() => setOpen(false)} className="text-xl" style={{ color: 'var(--text-secondary)' }}>×</button>
            </div>

            {/* OCR */}
            <label className="block mb-4 px-3 py-2.5 rounded-lg text-sm font-medium text-center cursor-pointer border-dashed border"
              style={{ borderColor: 'var(--accent)', color: 'var(--accent)', background: 'var(--accent-bg)' }}>
              {ocrLoading ? 'Analisando imagem…' : '📷 Tirar foto do comprovante (IA)'}
              <input type="file" accept="image/*" capture="environment" className="hidden"
                onChange={handleOcr} disabled={ocrLoading} />
            </label>
            {ocrInfo && (
              <div className="mb-4 text-xs px-3 py-2 rounded-lg" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
                ✓ {ocrInfo}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Tipo */}
              <div className="flex rounded-lg p-1" style={{ background: 'var(--bg-secondary)' }}>
                {(['expense','income'] as TransactionType[]).map(t => (
                  <button type="button" key={t} onClick={() => setType(t)}
                    className="flex-1 py-2 text-sm font-medium rounded-md transition-all"
                    style={type === t
                      ? { background: t === 'income' ? 'var(--success-bg)' : 'var(--danger-bg)',
                          color: t === 'income' ? 'var(--success)' : 'var(--danger)' }
                      : { color: 'var(--text-secondary)' }}>
                    {t === 'expense' ? 'Gasto' : 'Receita'}
                  </button>
                ))}
              </div>

              {/* Valor */}
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>Valor (R$)</label>
                <input type="number" inputMode="decimal" step="0.01" min="0.01"
                  value={amount} onChange={e => setAmount(e.target.value)}
                  placeholder="0,00" required
                  className="w-full px-3 py-3 text-lg font-semibold rounded-xl border"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-md)', color: 'var(--text)' }} />
              </div>

              {/* Categoria + Pagamento */}
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

              {/* Data + Parcelas */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>Data</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} required
                    className="w-full px-3 py-2.5 text-sm rounded-lg border"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-md)', color: 'var(--text)' }} />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>Parcelas</label>
                  <select value={installments} onChange={e => setInstallments(Number(e.target.value))}
                    className="w-full px-3 py-2.5 text-sm rounded-lg border"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-md)', color: 'var(--text)' }}>
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(n =>
                      <option key={n} value={n}>{n === 1 ? 'À vista' : `${n}x`}</option>)}
                  </select>
                </div>
              </div>

              {/* Descrição */}
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>Descrição (opcional)</label>
                <input type="text" value={description} onChange={e => setDesc(e.target.value)}
                  placeholder="Ex: Supermercado Extra"
                  className="w-full px-3 py-2.5 text-sm rounded-lg border"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-md)', color: 'var(--text)' }} />
              </div>

              {error && (
                <div className="text-sm px-3 py-2 rounded-lg" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: 'var(--accent)' }}>
                {loading ? 'Salvando...' : installments > 1 ? `Salvar ${installments}x de R$ ${(parseFloat(amount||'0')/installments).toFixed(2)}` : 'Salvar lançamento'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
