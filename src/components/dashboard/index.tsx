'use client'

import { formatCurrency, getInitials, AVATAR_COLORS, CATEGORY_LABELS } from '@/lib/utils'
import type { Profile, Budget, Transaction, Goal } from '@/types'

// ── MemberComparison ────────────────────────────────────────
interface MemberProps { members: { profile: Profile; total: number }[] }

export function MemberComparison({ members }: MemberProps) {
  const max = members[0]?.total || 1
  return (
    <div className="card p-4 h-full">
      <h3 className="text-sm font-medium mb-4" style={{ color: 'var(--text)' }}>
        Gastos por membro
      </h3>
      {members.length === 0 && (
        <p className="text-sm text-center py-6" style={{ color: 'var(--text-tertiary)' }}>Nenhum membro</p>
      )}
      <div className="space-y-3">
        {members.map(({ profile: p, total }) => {
          const idx = parseInt(p.avatar_color || '0') % AVATAR_COLORS.length
          const colors = AVATAR_COLORS[idx]
          const pct = (total / max) * 100
          return (
            <div key={p.id} className="flex items-center gap-2.5">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${colors.bg} ${colors.text}`}>
                {getInitials(p.name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate" style={{ color: 'var(--text)' }}>{p.name}</p>
                <div className="mt-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                  <div className="h-full rounded-full bg-blue-400 transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
              </div>
              <span className="text-xs font-medium shrink-0" style={{ color: 'var(--danger)' }}>
                {formatCurrency(total)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── BudgetAlerts ─────────────────────────────────────────────
interface AlertsProps { alerts: { budget: Budget; spent: number; pct: number }[] }

export function BudgetAlerts({ alerts }: AlertsProps) {
  return (
    <div className="card p-4">
      <h3 className="text-sm font-medium mb-4" style={{ color: 'var(--text)' }}>
        Alertas de orçamento
      </h3>
      {alerts.length === 0 && (
        <p className="text-sm text-center py-4" style={{ color: 'var(--text-tertiary)' }}>
          Nenhum orçamento definido
        </p>
      )}
      <div className="space-y-3">
        {alerts.map(({ budget: b, spent, pct }) => {
          const over = pct >= 1
          const warn = pct >= 0.8 && pct < 1
          const color = over ? 'var(--danger)' : warn ? 'var(--warning)' : 'var(--success)'
          const bgColor = over ? 'var(--danger-bg)' : warn ? 'var(--warning-bg)' : 'var(--success-bg)'
          const icon = over ? '⚠️' : warn ? '⚡' : '✓'
          return (
            <div key={b.id} className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0"
                   style={{ background: bgColor }}>
                {icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium" style={{ color: 'var(--text)' }}>
                  {CATEGORY_LABELS[b.category as never] ?? b.category}
                  {' '}
                  <span style={{ color }}>{(pct * 100).toFixed(0)}%</span>
                </p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {formatCurrency(spent)} / {formatCurrency(b.limit_amount)}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── RecentTransactions ───────────────────────────────────────
interface TxProps { transactions: Transaction[] }

export function RecentTransactions({ transactions }: TxProps) {
  return (
    <div className="card p-4">
      <h3 className="text-sm font-medium mb-4" style={{ color: 'var(--text)' }}>
        Lançamentos recentes
      </h3>
      {transactions.length === 0 && (
        <p className="text-sm text-center py-6" style={{ color: 'var(--text-tertiary)' }}>
          Nenhum lançamento este mês
        </p>
      )}
      <div className="space-y-0 divide-y" style={{ borderColor: 'var(--border)' }}>
        {transactions.map(t => {
          const isIncome = t.type === 'income'
          return (
            <div key={t.id} className="flex items-center gap-3 py-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
                   style={{ background: isIncome ? 'var(--success-bg)' : 'var(--danger-bg)' }}>
                {isIncome ? '↑' : '↓'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate" style={{ color: 'var(--text)' }}>
                  {t.description || CATEGORY_LABELS[t.category as never] || t.category}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {CATEGORY_LABELS[t.category as never] ?? t.category} ·{' '}
                  {new Date(t.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                  {t.installment_total && ` · ${t.installment_current}/${t.installment_total}x`}
                </p>
              </div>
              <span className="text-sm font-medium shrink-0"
                    style={{ color: isIncome ? 'var(--success)' : 'var(--danger)' }}>
                {isIncome ? '+' : '-'}{formatCurrency(t.amount)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── GoalsList ────────────────────────────────────────────────
interface GoalsProps { goals: Goal[] }

export function GoalsList({ goals }: GoalsProps) {
  return (
    <div className="card p-4">
      <h3 className="text-sm font-medium mb-4" style={{ color: 'var(--text)' }}>
        Objetivos
      </h3>
      {goals.length === 0 && (
        <p className="text-sm text-center py-4" style={{ color: 'var(--text-tertiary)' }}>
          Nenhum objetivo ativo
        </p>
      )}
      <div className="space-y-3">
        {goals.slice(0, 4).map(g => {
          const pct = Math.min((g.saved_amount / g.target_amount) * 100, 100)
          return (
            <div key={g.id} className="flex items-center gap-2.5">
              <span className="text-lg shrink-0">{g.icon || '⭐'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate" style={{ color: 'var(--text)' }}>{g.title}</p>
                <div className="mt-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                  <div className="h-full rounded-full bg-emerald-400 transition-all duration-500"
                       style={{ width: `${pct}%` }} />
                </div>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                  {formatCurrency(g.saved_amount)} / {formatCurrency(g.target_amount)}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

