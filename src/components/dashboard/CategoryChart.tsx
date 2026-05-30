'use client'

import { CATEGORY_LABELS, CATEGORY_COLORS, formatCurrency } from '@/lib/utils'
import type { Category } from '@/types'

interface Props {
  data: { category: Category; total: number }[]
}

export default function CategoryChart({ data }: Props) {
  const max = data[0]?.total || 1

  return (
    <div className="card p-4">
      <h3 className="text-sm font-medium mb-4" style={{ color: 'var(--text)' }}>
        Gastos por categoria
      </h3>
      {data.length === 0 && (
        <p className="text-sm text-center py-6" style={{ color: 'var(--text-tertiary)' }}>
          Nenhum gasto registrado este mês
        </p>
      )}
      <div className="space-y-2.5">
        {data.map(({ category, total }) => {
          const pct = (total / max) * 100
          const color = CATEGORY_COLORS[category] ?? '#888'
          return (
            <div key={category} className="flex items-center gap-3">
              <span className="text-xs w-28 shrink-0 truncate" style={{ color: 'var(--text-secondary)' }}>
                {CATEGORY_LABELS[category] ?? category}
              </span>
              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                <div className="h-full rounded-full transition-all duration-500"
                     style={{ width: `${pct}%`, background: color }} />
              </div>
              <span className="text-xs w-20 text-right shrink-0 font-medium" style={{ color: 'var(--text)' }}>
                {formatCurrency(total)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
