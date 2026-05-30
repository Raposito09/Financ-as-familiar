import { requireProfile } from '@/lib/auth'
import RecurringManager from '@/components/recurring/RecurringManager'
import type { Transaction } from '@/types'

export default async function RecurringPage() {
  const { supabase, user, profile } = await requireProfile()

  const { data: recurring = [] } = await supabase
    .from('transactions').select('*')
    .eq('user_id', user.id).eq('is_recurring', true)
    .order('category') as { data: Transaction[] }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Gastos recorrentes</h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Templates que se repetem todo mês — aluguel, streaming, plano de saúde
        </p>
      </div>
      <RecurringManager recurring={recurring ?? []} userId={user.id} familyId={profile.family_id} />
    </div>
  )
}
