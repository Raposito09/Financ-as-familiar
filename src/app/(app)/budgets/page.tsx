import { requireProfile } from '@/lib/auth'
import { getCurrentMonthYear, monthBounds } from '@/lib/utils'
import BudgetManager from '@/components/budgets/BudgetManager'
import type { Budget, Transaction } from '@/types'

export default async function BudgetsPage() {
  const { supabase, user } = await requireProfile()

  const { month, year } = getCurrentMonthYear()
  const { start: monthStart, end: monthEnd } = monthBounds(year, month)

  const { data: budgets = [] } = await supabase
    .from('budgets').select('*')
    .eq('user_id', user.id).eq('month', month).eq('year', year)
    .order('category') as { data: Budget[] }

  const { data: txs = [] } = await supabase
    .from('transactions').select('category,amount,type')
    .eq('user_id', user.id).eq('type', 'expense')
    .gte('date', monthStart).lte('date', monthEnd) as { data: Pick<Transaction, 'category' | 'amount' | 'type'>[] }

  const items = (budgets ?? []).map(b => {
    const spent = (txs ?? [])
      .filter(t => t.category === b.category)
      .reduce((s, t) => s + Number(t.amount), 0)
    return { budget: b, spent }
  })

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Orçamentos</h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })} · Limites por categoria
        </p>
      </div>
      <BudgetManager items={items} month={month} year={year} userId={user.id} />
    </div>
  )
}
