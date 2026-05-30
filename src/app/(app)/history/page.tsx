import { requireProfile } from '@/lib/auth'
import TransactionList from '@/components/transactions/TransactionList'
import HistoryFilters from '@/components/history/HistoryFilters'
import type { Transaction } from '@/types'

interface PageProps {
  searchParams: Promise<{ from?: string; to?: string }>
}

export default async function HistoryPage({ searchParams }: PageProps) {
  const { supabase, user, profile } = await requireProfile()

  const { from, to } = await searchParams
  const today = new Date()
  const defaultFrom = new Date(today.getFullYear(), today.getMonth() - 2, 1).toISOString().split('T')[0]
  const defaultTo = today.toISOString().split('T')[0]
  const dateFrom = from ?? defaultFrom
  const dateTo = to ?? defaultTo

  const isAdmin = profile.role === 'admin'

  let query = supabase
    .from('transactions')
    .select('*, profile:profiles(id,name,avatar_color)')
    .gte('date', dateFrom)
    .lte('date', dateTo)
    .order('date', { ascending: false })

  if (!isAdmin) query = query.eq('user_id', user.id)

  const { data: transactions = [] } = await query as { data: Transaction[] }

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div>
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Histórico</h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {new Date(dateFrom).toLocaleDateString('pt-BR')} até {new Date(dateTo).toLocaleDateString('pt-BR')}
          {isAdmin ? ' · Família inteira' : ' · Seus lançamentos'}
        </p>
      </div>
      <HistoryFilters defaultFrom={defaultFrom} defaultTo={defaultTo} />
      <TransactionList transactions={transactions ?? []} showOwner={isAdmin} />
    </div>
  )
}
