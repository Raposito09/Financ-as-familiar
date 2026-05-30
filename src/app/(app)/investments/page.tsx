import { requireProfile } from '@/lib/auth'
import InvestmentManager from '@/components/investments/InvestmentManager'
import type { Investment } from '@/types'

export default async function InvestmentsPage() {
  const { supabase, user } = await requireProfile()

  const { data: investments = [] } = await supabase
    .from('investments').select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: false }) as { data: Investment[] }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div>
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Investimentos</h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Aportes, rendimentos e evolução do patrimônio</p>
      </div>
      <InvestmentManager investments={investments ?? []} userId={user.id} />
    </div>
  )
}
