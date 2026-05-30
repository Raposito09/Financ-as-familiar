'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { parseCSV, type ParsedRow } from '@/lib/import-csv'
import { CATEGORY_LABELS, PAYMENT_LABELS, formatCurrency } from '@/lib/utils'
import type { Category, PaymentMethod, TransactionType } from '@/types'

const CATEGORIES = Object.keys(CATEGORY_LABELS) as Category[]
const PAYMENTS = Object.keys(PAYMENT_LABELS) as PaymentMethod[]

interface Props { userId: string; familyId: string }

export default function CsvImporter({ userId, familyId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [pending, startTransition] = useTransition()
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [filename, setFilename] = useState('')
  const [defaultPayment, setDefaultPayment] = useState<PaymentMethod>('credit_card')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null); setSuccess(null)
    setFilename(file.name)
    const reader = new FileReader()
    reader.onload = ev => {
      const text = String(ev.target?.result ?? '')
      const parsed = parseCSV(text)
      if (parsed.length === 0) setError('Nenhuma linha reconhecida no CSV')
      setRows(parsed)
    }
    reader.readAsText(file, 'utf-8')
  }

  function updateRow(i: number, patch: Partial<ParsedRow>) {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r))
  }

  function toggleAll(checked: boolean) {
    setRows(prev => prev.map(r => ({ ...r, selected: checked && !r.error })))
  }

  async function importRows() {
    const valid = rows.filter(r => r.selected && !r.error)
    if (valid.length === 0) {
      setError('Selecione ao menos uma linha válida')
      return
    }
    setError(null); setSuccess(null)
    startTransition(async () => {
      const payload = valid.map(r => ({
        user_id: userId,
        family_id: familyId,
        type: r.type,
        amount: r.amount,
        category: r.category,
        payment_method: defaultPayment,
        description: r.description || null,
        date: r.date,
        is_recurring: false,
      }))
      const { error } = await supabase.from('transactions').insert(payload)
      if (error) setError(error.message)
      else {
        setSuccess(`${valid.length} lançamentos importados.`)
        setRows([])
        setFilename('')
        router.refresh()
      }
    })
  }

  const validCount = rows.filter(r => !r.error).length
  const selectedCount = rows.filter(r => r.selected && !r.error).length

  return (
    <div className="space-y-4">
      <div className="card p-4 space-y-3">
        <div>
          <label className="text-xs font-medium block mb-2" style={{ color: 'var(--text-secondary)' }}>Arquivo CSV</label>
          <input type="file" accept=".csv,text/csv" onChange={handleFile}
            className="block w-full text-sm" style={{ color: 'var(--text)' }} />
          {filename && (
            <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
              {filename} · {rows.length} linhas · {validCount} válidas
            </p>
          )}
        </div>
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>Forma de pagamento (padrão para todos)</label>
          <select value={defaultPayment} onChange={e => setDefaultPayment(e.target.value as PaymentMethod)}
            className="px-3 py-2 text-sm rounded-lg border"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-md)', color: 'var(--text)' }}>
            {PAYMENTS.map(p => <option key={p} value={p}>{PAYMENT_LABELS[p]}</option>)}
          </select>
        </div>
        <div className="text-xs space-y-1" style={{ color: 'var(--text-tertiary)' }}>
          <p>📌 Formato esperado: 3 colunas — <strong>data</strong>, <strong>descrição</strong>, <strong>valor</strong>. Valor negativo = despesa.</p>
          <p>📌 Datas aceitas: <code>dd/mm/yyyy</code>, <code>dd-mm-yyyy</code>, <code>yyyy-mm-dd</code>. Separador: vírgula ou ponto e vírgula.</p>
        </div>
      </div>

      {error && <div className="card p-3 text-sm" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>{error}</div>}
      {success && <div className="card p-3 text-sm" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>{success}</div>}

      {rows.length > 0 && (
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input type="checkbox"
                checked={selectedCount === validCount && validCount > 0}
                onChange={e => toggleAll(e.target.checked)} />
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {selectedCount} / {validCount} selecionados
              </span>
            </div>
            <button onClick={importRows} disabled={pending || selectedCount === 0}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
              style={{ background: 'var(--accent)' }}>
              {pending ? 'Importando…' : `Importar ${selectedCount}`}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead style={{ color: 'var(--text-secondary)' }}>
                <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                  <th className="p-2 w-8"></th>
                  <th className="p-2 text-left">Data</th>
                  <th className="p-2 text-left">Descrição</th>
                  <th className="p-2 text-left">Tipo</th>
                  <th className="p-2 text-left">Categoria sugerida</th>
                  <th className="p-2 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b" style={{ borderColor: 'var(--border)', opacity: r.error ? 0.5 : 1 }}>
                    <td className="p-2">
                      <input type="checkbox" checked={r.selected} disabled={!!r.error}
                        onChange={e => updateRow(i, { selected: e.target.checked })} />
                    </td>
                    <td className="p-2" style={{ color: r.error ? 'var(--danger)' : 'var(--text)' }}>
                      {r.date || '—'}
                    </td>
                    <td className="p-2 max-w-xs truncate" style={{ color: 'var(--text)' }}>
                      {r.description || '—'}
                      {r.error && <span className="ml-2 text-[10px]" style={{ color: 'var(--danger)' }}>({r.error})</span>}
                    </td>
                    <td className="p-2">
                      <select value={r.type} onChange={e => updateRow(i, { type: e.target.value as TransactionType })}
                        className="px-1 py-0.5 text-xs rounded border" disabled={!!r.error}
                        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-md)', color: 'var(--text)' }}>
                        <option value="expense">Despesa</option>
                        <option value="income">Receita</option>
                      </select>
                    </td>
                    <td className="p-2">
                      <select value={r.category} onChange={e => updateRow(i, { category: e.target.value as Category })}
                        className="px-1 py-0.5 text-xs rounded border" disabled={!!r.error}
                        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-md)', color: 'var(--text)' }}>
                        {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                      </select>
                    </td>
                    <td className="p-2 text-right font-medium"
                      style={{ color: r.error ? 'var(--text-tertiary)' : r.type === 'income' ? 'var(--success)' : 'var(--danger)' }}>
                      {r.type === 'expense' ? '-' : '+'}{formatCurrency(r.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
