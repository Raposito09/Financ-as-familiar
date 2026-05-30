import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// POST — admin cria convite, retorna token
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role,family_id').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Sem perfil' }, { status: 400 })
  if (profile.role !== 'admin') return NextResponse.json({ error: 'Apenas admin' }, { status: 403 })

  let email: string | null = null
  try {
    const body = await req.json().catch(() => ({}))
    if (typeof body.email === 'string' && body.email.trim()) {
      if (!EMAIL_RE.test(body.email.trim())) {
        return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
      }
      email = body.email.trim().toLowerCase()
    }
  } catch {
    // body opcional
  }

  const { data, error } = await supabase
    .from('family_invites')
    .insert({
      family_id: profile.family_id,
      email,
      created_by: user.id,
    })
    .select('token, expires_at, email')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

// DELETE — admin revoga (deleta) convite via ?token=
export async function DELETE(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'token obrigatório' }, { status: 400 })

  const { error } = await supabase.from('family_invites').delete().eq('token', token)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
