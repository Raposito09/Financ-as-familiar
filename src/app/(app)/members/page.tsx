import { requireAdmin } from '@/lib/auth'
import MembersManager from '@/components/members/MembersManager'
import type { Profile, FamilyInvite } from '@/types'

export default async function MembersPage() {
  const { supabase, user, profile } = await requireAdmin()

  const { data: members = [] } = await supabase
    .from('profiles').select('*').eq('family_id', profile.family_id).order('name') as { data: Profile[] }

  const { data: invites = [] } = await supabase
    .from('family_invites').select('*').eq('family_id', profile.family_id)
    .order('created_at', { ascending: false }) as { data: FamilyInvite[] }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Membros da família</h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Gerenciar acesso e convites</p>
      </div>
      <MembersManager members={members ?? []} invites={invites ?? []} currentUserId={user.id} />
    </div>
  )
}
