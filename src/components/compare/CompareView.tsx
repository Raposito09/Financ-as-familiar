'use client'

import { formatCurrency, CATEGORY_LABELS, CATEGORY_COLORS } from '@/lib/utils'
import type { Category } from '@/types'

interface Tx { type: 'income' | 'expense'; amount: number; category: string }

interface Props {
  txA: Tx[]
  txB: Tx[]
  labelA: string
  labelB: string
}

function aggregate(list: Tx[]) {
  const income = list.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const expense = list.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  const byCat = list.filter(t => t.type === 'expense').reduce((acc: Record<string, number>, t) => {
    acc[t.category] = (acc[t.category] || 0) + Number(t.amount)
    return acc
  }, {})
  return { income, expense, balance: income - expense, byCat }
}

function delta(a: number, b: number) {
  if (b === 0) return a === 0 ? 0 : 1
  return (a - b) / b
}

function DeltaBadge({ value, invert = false }: { value: number; invert?: boolean }) {
  if (Math.abs(value) < 0.001) {
    return <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }}>=</span>
  }
  const positive = value > 0
  const isGood = invert ? !positive : positive
  const color = isGood ? 'var(--success)' : 'var(--danger)'
  const bg = isGood ? 'var(--success-bg)' : 'var(--danger-bg)'
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: bg, color }}>
      {positive ? '↑' : '↓'} {Math.abs(value * 100).toFixed(1)}%
    </span>
  )
}

export default function CompareView({ txA, txB, labelA, labelB }: Props) {
  const A = aggregate(txA)
  const B = aggregate(txB)

  const cats = Array.from(new Set([...Object.keys(A.byCat), ...Object.keys(B.byCat)]))
    .map(cat => ({ cat, a: A.byCat[cat] || 0, b: B.byCat[cat] || 0 }))
    .sort((x, y) => Math.max(y.a, y.b) - Math.max(x.a, x.b))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Metric label="Receita" labelA={labelA} labelB={labelB} a={A.income} b={B.income} invert />
        <Metric label="Despesa" labelA={labelA} labelB={labelB} a={A.expense} b={B.expense} />
        <Metric label="Saldo" labelA={labelA} labelB={labelB} a={A.balance} b={B.balance} invert />
      </div>

      <div className="card p-4">
        <h3 className="text-sm font-medium mb-4" style={{ color: 'var(--text)' }}>Despesas por categoria</h3>
        {cats.length === 0 && (
          <p className="text-sm text-center py-6" style={{ color: 'var(--text-tertiary)' }}>Sem dados para comparar</p>
        )}
        <div className="space-y-3">
          {cats.map(({ cat, a, b }) => {
            const d = delta(a, b)
            const color = CATEGORY_COLORS[cat as Category] ?? '#888'
            const max = Math.max(a, b, 1)
            return (
              <div key={cat} className="space-y-1">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="font-medium" style={{ color: 'var(--text)' }}>
                    {CATEGORY_LABELS[cat as Category] ?? cat}
                  </span>
                  <DeltaBadge value={d} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs w-16 text-right shrink-0" style={{ color: 'var(--accent)' }}>{formatCurrency(a)}</span>
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                    <div className="h-full" style={{ width: `${(a / max) * 100}%`, background: color }} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs w-16 text-right shrink-0" style={{ color: 'var(--text-tertiary)' }}>{formatCurrency(b)}</span>
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden opacity-60" style={{ background: 'var(--border)' }}>
                    <div className="h-full" style={{ width: `${(b / max) * 100}%`, background: color }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Metric({ label, labelA, labelB, a, b, invert }: { label: string; labelA: string; labelB: string; a: number; b: number; invert?: boolean }) {
  const d = delta(a, b)
  return (
    <div className="card p-4 space-y-2">
      <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</p>
      <div>
        <p className="text-xs" style={{ color: 'var(--accent)' }}>{labelA}</p>
        <p className="text-base font-semibold" style={{ color: 'var(--text)' }}>{formatCurrency(a)}</p>
      </div>
      <div>
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{labelB}</p>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(b)}</p>
      </div>
      <DeltaBadge value={d} invert={invert} />
    </div>
  )
}
