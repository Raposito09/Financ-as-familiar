import { requireProfile } from '@/lib/auth'
import { formatCurrency, getCurrentMonthYear, monthBounds, monthRangeAhead } from '@/lib/utils'
import MetricCard from '@/components/dashboard/MetricCard'
import CategoryChart from '@/components/dashboard/CategoryChart'
import { BudgetAlerts, RecentTransactions, MemberComparison, GoalsList } from '@/components/dashboard'
import InsightsCard from '@/components/dashboard/InsightsCard'
import NewTransactionButton from '@/components/forms/NewTransactionButton'
import type { Transaction, Budget, Profile } from '@/types'

export default async function DashboardPage() {
  const { supabase, user, profile } = await requireProfile()

  const { month, year } = getCurrentMonthYear()
  const { start: monthStart, end: monthEnd } = monthBounds(year, month)
  const isAdmin = profile.role === 'admin'

  // Transações do mês
  let txQuery = supabase
    .from('transactions')
    .select('*, profile:profiles(id,name,avatar_color)')
    .gte('date', monthStart)
    .lte('date', monthEnd)
    .order('date', { ascending: false })

  if (!isAdmin) txQuery = txQuery.eq('user_id', user.id)

  const { data: transactions = [] } = await txQuery as { data: Transaction[] }

  // Calcular métricas
  const totalIncome   = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const balance       = totalIncome - totalExpenses
  const savingsRate   = totalIncome > 0 ? balance / totalIncome : 0

  // Parcelas futuras (próximos 3 meses) — usa range correto que respeita ano/último dia real
  const { start: futureStart, end: futureEnd } = monthRangeAhead(year, month, 3)
  let futureQuery = supabase
    .from('transactions')
    .select('amount')
    .not('installment_group_id', 'is', null)
    .gte('date', futureStart)
    .lte('date', futureEnd)
    .eq('family_id', profile.family_id)
  if (!isAdmin) futureQuery = futureQuery.eq('user_id', user.id)
  const { data: futureInstallments } = await futureQuery
  const futureTotal = (futureInstallments ?? []).reduce((s: number, t: { amount: number }) => s + Number(t.amount), 0)

  // Por categoria
  const byCategory = Object.entries(
    transactions
      .filter(t => t.type === 'expense')
      .reduce((acc: Record<string, number>, t) => {
        acc[t.category] = (acc[t.category] || 0) + t.amount
        return acc
      }, {})
  )
  .map(([category, total]) => ({ category: category as never, total }))
  .sort((a, b) => b.total - a.total)

  // Orçamentos do mês
  let budgetQuery = supabase.from('budgets').select('*').eq('month', month).eq('year', year)
  if (!isAdmin) budgetQuery = budgetQuery.eq('user_id', user.id)
  const { data: budgets = [] } = await budgetQuery as { data: Budget[] }

  const budgetAlerts = budgets.map((b: Budget) => {
    const spent = transactions
      .filter(t => t.category === b.category && t.user_id === b.user_id && t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0)
    return { budget: b, spent, pct: b.limit_amount > 0 ? spent / b.limit_amount : 0 }
  }).sort((a, b) => b.pct - a.pct)

  // Membros (admin)
  let memberData: { profile: Profile; total: number }[] = []
  if (isAdmin) {
    const { data: members } = await supabase
      .from('profiles').select('*').eq('family_id', profile.family_id)
    if (members) {
      memberData = members.map((m: Profile) => ({
        profile: m,
        total: transactions.filter(t => t.user_id === m.id && t.type === 'expense').reduce((s, t) => s + t.amount, 0)
      })).sort((a, b) => b.total - a.total)
    }
  }

  // Objetivos
  let goalQuery = supabase.from('goals').select('*').eq('status', 'active').order('created_at')
  if (!isAdmin) goalQuery = goalQuery.eq('user_id', user.id)
  const { data: goals = [] } = await goalQuery

  const recentTx = transactions.slice(0, 5)

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
            {isAdmin ? 'Visão familiar' : `Olá, ${profile.name.split(' ')[0]}`}
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            {isAdmin ? ' · Consolidado da família' : ' · Seu painel pessoal'}
          </p>
        </div>
        <NewTransactionButton />
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Receita total" value={formatCurrency(totalIncome)} variant="income" />
        <MetricCard label="Despesas" value={formatCurrency(totalExpenses)} variant="expense" />
        <MetricCard label="Saldo do mês" value={formatCurrency(balance)}
          sub={`${(savingsRate * 100).toFixed(1)}% da renda`} variant={balance >= 0 ? 'neutral' : 'expense'} />
        <MetricCard label="Parcelas futuras" value={formatCurrency(futureTotal)}
          sub="próximos 3 meses" variant="neutral" />
      </div>

      {/* Gráficos + Membros */}
      <div className="grid md:grid-cols-5 gap-4">
        <div className="md:col-span-3">
          <CategoryChart data={byCategory} />
        </div>
        <div className="md:col-span-2">
          {isAdmin
            ? <MemberComparison members={memberData} />
            : <BudgetAlerts alerts={budgetAlerts} />
          }
        </div>
      </div>

      {/* Transações + Objetivos + Alertas */}
      <div className="grid md:grid-cols-2 gap-4">
        <RecentTransactions transactions={recentTx} />
        <div className="space-y-4">
          {isAdmin && <BudgetAlerts alerts={budgetAlerts} />}
          <GoalsList goals={goals ?? []} />
        </div>
      </div>

      {/* IA — Insights */}
      <InsightsCard />
    </div>
  )
}
