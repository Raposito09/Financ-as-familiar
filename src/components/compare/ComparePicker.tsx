'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

interface Props {
  defaults: { fromA: string; toA: string; fromB: string; toB: string }
}

export default function ComparePicker({ defaults }: Props) {
  const router = useRouter()
  const params = useSearchParams()
  const [fromA, setFromA] = useState(params.get('fromA') ?? defaults.fromA)
  const [toA, setToA] = useState(params.get('toA') ?? defaults.toA)
  const [fromB, setFromB] = useState(params.get('fromB') ?? defaults.fromB)
  const [toB, setToB] = useState(params.get('toB') ?? defaults.toB)

  function apply() {
    const q = new URLSearchParams({ fromA, toA, fromB, toB })
    router.push(`/compare?${q.toString()}`)
  }

  function preset(kind: 'month' | 'quarter' | 'year') {
    const today = new Date()
    const y = today.getFullYear()
    const m = today.getMonth()
    let aFrom: Date, aTo: Date, bFrom: Date, bTo: Date
    if (kind === 'month') {
      aFrom = new Date(y, m, 1); aTo = new Date(y, m + 1, 0)
      bFrom = new Date(y, m - 1, 1); bTo = new Date(y, m, 0)
    } else if (kind === 'quarter') {
      const qIdx = Math.floor(m / 3)
      aFrom = new Date(y, qIdx * 3, 1); aTo = new Date(y, qIdx * 3 + 3, 0)
      bFrom = new Date(y, (qIdx - 1) * 3, 1); bTo = new Date(y, qIdx * 3, 0)
    } else {
      aFrom = new Date(y, 0, 1); aTo = new Date(y, 11, 31)
      bFrom = new Date(y - 1, 0, 1); bTo = new Date(y - 1, 11, 31)
    }
    const fmt = (d: Date) => d.toISOString().split('T')[0]
    const q = new URLSearchParams({ fromA: fmt(aFrom), toA: fmt(aTo), fromB: fmt(bFrom), toB: fmt(bTo) })
    setFromA(fmt(aFrom)); setToA(fmt(aTo)); setFromB(fmt(bFrom)); setToB(fmt(bTo))
    router.push(`/compare?${q.toString()}`)
  }

  return (
    <div className="card p-4 space-y-3">
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--accent)' }}>Período A</p>
          <div className="grid grid-cols-2 gap-2">
            <input type="date" value={fromA} onChange={e => setFromA(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg border"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-md)', color: 'var(--text)' }} />
            <input type="date" value={toA} onChange={e => setToA(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg border"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-md)', color: 'var(--text)' }} />
          </div>
        </div>
        <div>
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Período B (comparação)</p>
          <div className="grid grid-cols-2 gap-2">
            <input type="date" value={fromB} onChange={e => setFromB(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg border"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-md)', color: 'var(--text)' }} />
            <input type="date" value={toB} onChange={e => setToB(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg border"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-md)', color: 'var(--text)' }} />
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={apply} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: 'var(--accent)' }}>Comparar</button>
        <button onClick={() => preset('month')} className="px-3 py-2 text-xs rounded-lg hover:opacity-70" style={{ color: 'var(--text-secondary)', background: 'var(--bg-secondary)' }}>Mês atual vs anterior</button>
        <button onClick={() => preset('quarter')} className="px-3 py-2 text-xs rounded-lg hover:opacity-70" style={{ color: 'var(--text-secondary)', background: 'var(--bg-secondary)' }}>Trim. atual vs anterior</button>
        <button onClick={() => preset('year')} className="px-3 py-2 text-xs rounded-lg hover:opacity-70" style={{ color: 'var(--text-secondary)', background: 'var(--bg-secondary)' }}>Ano atual vs anterior</button>
      </div>
    </div>
  )
}
