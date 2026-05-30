import { requireProfile } from '@/lib/auth'
import { getCurrentMonthYear, monthBounds } from '@/lib/utils'
import TransactionList from '@/components/transactions/TransactionList'
import NewTransactionButton from '@/components/forms/NewTransactionButton'
import type { Transaction } from '@/types'

export default async function TransactionsPage() {
  const { supabase, user, profile } = await requireProfile()

  const { month, year } = getCurrentMonthYear()
  const { start: monthStart, end: monthEnd } = monthBounds(year, month)
  const isAdmin = profile.role === 'admin'

  let query = supabase
    .from('transactions')
    .select('*, profile:profiles(id,name,avatar_color)')
    .gte('date', monthStart)
    .lte('date', monthEnd)
    .order('date', { ascending: false })

  if (!isAdmin) query = query.eq('user_id', user.id)

  const { data: transactions = [] } = await query as { data: Transaction[] }

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Lançamentos</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            {isAdmin ? ' · Família inteira' : ' · Seus lançamentos'}
          </p>
        </div>
        <NewTransactionButton />
      </div>
      <TransactionList transactions={transactions ?? []} showOwner={isAdmin} />
    </div>
  )
}
