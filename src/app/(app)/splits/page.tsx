import { requireProfile } from '@/lib/auth'
import SplitsManager from '@/components/splits/SplitsManager'
import type { DebtSplit, Profile, Transaction } from '@/types'

export default async function SplitsPage() {
  const { supabase, user, profile } = await requireProfile()

  const { data: splits = [] } = await supabase
    .from('debt_splits')
    .select(`
      *,
      transaction:transactions(id,description,category,date,amount),
      payer:profiles!debt_splits_payer_id_fkey(id,name,avatar_color),
      debtor:profiles!debt_splits_debtor_id_fkey(id,name,avatar_color)
    `)
    .order('created_at', { ascending: false }) as { data: DebtSplit[] }

  const { data: members = [] } = await supabase
    .from('profiles').select('*').eq('family_id', profile.family_id).order('name') as { data: Profile[] }

  const { data: txs = [] } = await supabase
    .from('transactions').select('*')
    .eq('user_id', user.id).eq('type', 'expense')
    .order('date', { ascending: false }).limit(50) as { data: Transaction[] }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Divisão de despesas</h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Quem pagou e quem deve</p>
      </div>
      <SplitsManager splits={splits ?? []} members={members ?? []} transactions={txs ?? []} userId={user.id} />
    </div>
  )
}
