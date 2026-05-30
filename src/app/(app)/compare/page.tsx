import { requireProfile } from '@/lib/auth'
import ComparePicker from '@/components/compare/ComparePicker'
import CompareView from '@/components/compare/CompareView'

interface PageProps {
  searchParams: Promise<{ fromA?: string; toA?: string; fromB?: string; toB?: string }>
}

function fmt(d: Date) { return d.toISOString().split('T')[0] }
function label(from: string, to: string) {
  return `${new Date(from).toLocaleDateString('pt-BR')} – ${new Date(to).toLocaleDateString('pt-BR')}`
}

export default async function ComparePage({ searchParams }: PageProps) {
  const { supabase, user, profile } = await requireProfile()

  const today = new Date()
  const y = today.getFullYear()
  const m = today.getMonth()
  const defaults = {
    fromA: fmt(new Date(y, m, 1)),
    toA: fmt(new Date(y, m + 1, 0)),
    fromB: fmt(new Date(y, m - 1, 1)),
    toB: fmt(new Date(y, m, 0)),
  }

  const sp = await searchParams
  const fromA = sp.fromA ?? defaults.fromA
  const toA = sp.toA ?? defaults.toA
  const fromB = sp.fromB ?? defaults.fromB
  const toB = sp.toB ?? defaults.toB
  const isAdmin = profile.role === 'admin'

  async function fetchRange(from: string, to: string) {
    let q = supabase.from('transactions').select('type,amount,category').gte('date', from).lte('date', to)
    if (!isAdmin) q = q.eq('user_id', user!.id)
    const { data } = await q
    return data ?? []
  }

  const [txA, txB] = await Promise.all([fetchRange(fromA, toA), fetchRange(fromB, toB)])

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div>
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Comparativo entre períodos</h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {isAdmin ? 'Família inteira' : 'Seus lançamentos'}
        </p>
      </div>
      <ComparePicker defaults={defaults} />
      <CompareView txA={txA as never} txB={txB as never} labelA={label(fromA, toA)} labelB={label(fromB, toB)} />
    </div>
  )
}
