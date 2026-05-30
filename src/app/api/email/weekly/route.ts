import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { renderWeeklyEmail, type WeeklyData } from '@/lib/email/weekly-template'
import type { Category, Goal, Budget } from '@/types'

interface ProfileRow { id: string; name: string; email: string; family_id: string }

const MAX_PROFILES_PER_CALL = 500
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function lastWeekRange() {
  const today = new Date()
  const to = new Date(today)
  const from = new Date(today); from.setDate(from.getDate() - 6)
  return { from: from.toISOString().split('T')[0], to: to.toISOString().split('T')[0] }
}

async function buildWeeklyData(supabase: Awaited<ReturnType<typeof createClient>>, profile: ProfileRow): Promise<WeeklyData> {
  const { from, to } = lastWeekRange()

  const { data: txs = [] } = await supabase
    .from('transactions').select('type,amount,category')
    .eq('user_id', profile.id).gte('date', from).lte('date', to)

  const totalIncome = (txs ?? []).filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const totalExpense = (txs ?? []).filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  const byCat = (txs ?? []).filter(t => t.type === 'expense').reduce((acc: Record<string, number>, t) => {
    acc[t.category] = (acc[t.category] || 0) + Number(t.amount)
    return acc
  }, {})
  const topCategories = Object.entries(byCat)
    .map(([c, v]) => ({ category: c as Category, total: v }))
    .sort((a, b) => b.total - a.total)

  const { data: goals = [] } = await supabase
    .from('goals').select('title,saved_amount,target_amount,icon')
    .eq('user_id', profile.id).eq('status', 'active').order('created_at') as { data: Pick<Goal, 'title' | 'saved_amount' | 'target_amount' | 'icon'>[] }

  const today = new Date()
  const m = today.getMonth() + 1, y = today.getFullYear()
  const monthStart = `${y}-${String(m).padStart(2, '0')}-01`
  const lastDay = new Date(y, m, 0).getDate()
  const monthEnd = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const { data: budgets = [] } = await supabase
    .from('budgets').select('category,limit_amount').eq('user_id', profile.id).eq('month', m).eq('year', y) as { data: Pick<Budget, 'category' | 'limit_amount'>[] }

  const { data: monthTxs = [] } = await supabase
    .from('transactions').select('category,amount').eq('user_id', profile.id).eq('type', 'expense').gte('date', monthStart).lte('date', monthEnd)

  const budgetAlerts = (budgets ?? [])
    .map(b => {
      const spent = (monthTxs ?? [])
        .filter(t => t.category === b.category)
        .reduce((s, t) => s + Number(t.amount), 0)
      const pct = b.limit_amount > 0 ? spent / Number(b.limit_amount) : 0
      return { category: b.category as Category, spent, limit: Number(b.limit_amount), pct }
    })
    .filter(a => a.pct >= 0.8)
    .sort((a, b) => b.pct - a.pct)

  return {
    name: profile.name,
    weekFrom: from,
    weekTo: to,
    totalIncome,
    totalExpense,
    topCategories,
    goals: (goals ?? []).map(g => ({ title: g.title, saved: Number(g.saved_amount), target: Number(g.target_amount), icon: g.icon })),
    budgetAlerts,
  }
}

/**
 * POST /api/email/weekly
 *
 * Modos:
 *   • ?user_id=<uuid>     — envia para 1 usuário. Auth: o próprio user OU Bearer CRON_SECRET.
 *   • ?family_id=<uuid>   — envia para todos da família. Auth: Bearer CRON_SECRET.
 *   • ?all=true           — envia para TODOS (cuidado!). Auth: Bearer CRON_SECRET.
 *
 * Observação: a query ?all=true depende de RLS — em contexto de cron sem sessão de usuário,
 * apenas service_role enxergaria todos os perfis. Para uso real do cron, prefira
 * disparar por família via pg_cron (que roda dentro do Postgres com bypass de RLS).
 */
export async function POST(req: Request) {
  const supabase = await createClient()
  const url = new URL(req.url)
  const targetUserId = url.searchParams.get('user_id')
  const targetFamilyId = url.searchParams.get('family_id')
  const sendAll = url.searchParams.get('all') === 'true'

  const hasCronAuth = !!process.env.CRON_SECRET && req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`

  // Validação de UUID
  if (targetUserId && !UUID_RE.test(targetUserId)) {
    return NextResponse.json({ error: 'user_id inválido' }, { status: 400 })
  }
  if (targetFamilyId && !UUID_RE.test(targetFamilyId)) {
    return NextResponse.json({ error: 'family_id inválido' }, { status: 400 })
  }

  // Auth por modo
  if (sendAll || targetFamilyId) {
    if (!hasCronAuth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  } else {
    if (!hasCronAuth) {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      if (!targetUserId || user.id !== targetUserId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }
  }

  const apiKey = process.env.RESEND_API_KEY
  const fromAddr = process.env.RESEND_FROM ?? 'Finança Familiar <onboarding@resend.dev>'
  if (!apiKey) return NextResponse.json({ error: 'RESEND_API_KEY ausente no servidor' }, { status: 500 })

  const resend = new Resend(apiKey)

  // Carrega perfis-alvo
  let profiles: ProfileRow[] = []
  if (sendAll) {
    const { data } = await supabase
      .from('profiles').select('id,name,email,family_id')
      .limit(MAX_PROFILES_PER_CALL) as { data: ProfileRow[] | null }
    profiles = data ?? []
  } else if (targetFamilyId) {
    const { data } = await supabase
      .from('profiles').select('id,name,email,family_id')
      .eq('family_id', targetFamilyId)
      .limit(MAX_PROFILES_PER_CALL) as { data: ProfileRow[] | null }
    profiles = data ?? []
  } else if (targetUserId) {
    const { data } = await supabase
      .from('profiles').select('id,name,email,family_id')
      .eq('id', targetUserId).single() as { data: ProfileRow | null }
    if (data) profiles = [data]
  }

  const results: { email: string; ok: boolean; error?: string }[] = []
  for (const p of profiles) {
    try {
      const data = await buildWeeklyData(supabase, p)
      const { html, subject } = renderWeeklyEmail(data)
      const { error } = await resend.emails.send({ from: fromAddr, to: p.email, subject, html })
      results.push({ email: p.email, ok: !error, error: error?.message })
    } catch (e) {
      results.push({ email: p.email, ok: false, error: e instanceof Error ? e.message : String(e) })
    }
  }

  return NextResponse.json({ sent: results.filter(r => r.ok).length, total: results.length, results })
}
