import { requireProfile } from '@/lib/auth'
import GoalManager from '@/components/goals/GoalManager'
import type { Goal } from '@/types'

export default async function GoalsPage() {
  const { supabase, user } = await requireProfile()

  const { data: goals = [] } = await supabase
    .from('goals').select('*').eq('user_id', user.id).order('created_at', { ascending: false }) as { data: Goal[] }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div>
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Objetivos financeiros</h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Seus sonhos e metas</p>
      </div>
      <GoalManager goals={goals ?? []} userId={user.id} />
    </div>
  )
}
