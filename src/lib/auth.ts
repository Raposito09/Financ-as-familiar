import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/types'

/**
 * Garante que existe sessão + profile e retorna ambos.
 * Usar em Server Components do route group (app).
 * Redireciona para /login se ausente.
 */
export async function requireProfile(): Promise<{
  supabase: Awaited<ReturnType<typeof createClient>>
  user: { id: string }
  profile: Profile
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')

  return { supabase, user, profile: profile as Profile }
}

/** Mesmo que requireProfile, mas redireciona para /dashboard se não-admin. */
export async function requireAdmin() {
  const ctx = await requireProfile()
  if (ctx.profile.role !== 'admin') redirect('/dashboard')
  return ctx
}
