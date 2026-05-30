import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Transaction } from '@/types'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('family_id').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Sem perfil' }, { status: 400 })

  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth() + 1
  // Último dia REAL do mês (fix de bug do dia 31 fixo em fev/abr/jun/set/nov)
  const lastDay = new Date(year, month, 0).getDate()
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
  const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const { data: templates = [] } = await supabase
    .from('transactions').select('*')
    .eq('user_id', user.id).eq('is_recurring', true) as { data: Transaction[] }

  if (!templates || templates.length === 0) {
    return NextResponse.json({ created: 0 })
  }

  // Já existe lançamento (não-template) deste mês para este template? identificamos por description+amount+category
  const { data: existing = [] } = await supabase
    .from('transactions').select('description,amount,category,date')
    .eq('user_id', user.id).eq('is_recurring', false)
    .gte('date', monthStart).lte('date', monthEnd)

  const key = (t: { description: string | null; amount: number; category: string }) =>
    `${t.description ?? ''}|${Number(t.amount)}|${t.category}`
  const existingKeys = new Set((existing ?? []).map(key))

  const toInsert = templates
    .filter(t => !existingKeys.has(key(t)))
    .map(t => {
      const day = Math.min(new Date(t.date).getDate(), 28)
      return {
        user_id: t.user_id,
        family_id: profile.family_id,
        type: t.type,
        amount: t.amount,
        category: t.category,
        payment_method: t.payment_method,
        description: t.description,
        date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        is_recurring: false,
      }
    })

  if (toInsert.length === 0) {
    return NextResponse.json({ created: 0, skipped: templates.length })
  }

  const { error } = await supabase.from('transactions').insert(toInsert)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ created: toInsert.length, skipped: templates.length - toInsert.length })
}
