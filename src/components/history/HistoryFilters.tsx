'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function HistoryFilters({ defaultFrom, defaultTo }: { defaultFrom: string; defaultTo: string }) {
  const router = useRouter()
  const params = useSearchParams()
  const [from, setFrom] = useState(params.get('from') ?? defaultFrom)
  const [to, setTo] = useState(params.get('to') ?? defaultTo)

  function apply() {
    const q = new URLSearchParams()
    if (from) q.set('from', from)
    if (to) q.set('to', to)
    router.push(`/history?${q.toString()}`)
  }

  function quickRange(months: number) {
    const today = new Date()
    const start = new Date(today.getFullYear(), today.getMonth() - months + 1, 1)
    const startStr = start.toISOString().split('T')[0]
    const endStr = today.toISOString().split('T')[0]
    setFrom(startStr)
    setTo(endStr)
    const q = new URLSearchParams()
    q.set('from', startStr)
    q.set('to', endStr)
    router.push(`/history?${q.toString()}`)
  }

  function exportFile(format: 'xlsx' | 'pdf') {
    const q = new URLSearchParams({ from, to, format })
    window.open(`/api/export?${q.toString()}`, '_blank')
  }

  return (
    <div className="card p-3 flex flex-wrap items-end gap-2">
      <div>
        <label className="text-xs block mb-1" style={{ color: 'var(--text-secondary)' }}>De</label>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-md)', color: 'var(--text)' }} />
      </div>
      <div>
        <label className="text-xs block mb-1" style={{ color: 'var(--text-secondary)' }}>Até</label>
        <input type="date" value={to} onChange={e => setTo(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-md)', color: 'var(--text)' }} />
      </div>
      <button onClick={apply}
        className="px-4 py-2 rounded-lg text-sm font-medium text-white"
        style={{ background: 'var(--accent)' }}>
        Aplicar
      </button>
      <div className="flex flex-wrap gap-1 ml-auto items-center">
        <button onClick={() => quickRange(1)} className="px-2 py-1 text-xs rounded hover:opacity-70" style={{ color: 'var(--text-secondary)' }}>Mês</button>
        <button onClick={() => quickRange(3)} className="px-2 py-1 text-xs rounded hover:opacity-70" style={{ color: 'var(--text-secondary)' }}>3m</button>
        <button onClick={() => quickRange(6)} className="px-2 py-1 text-xs rounded hover:opacity-70" style={{ color: 'var(--text-secondary)' }}>6m</button>
        <button onClick={() => quickRange(12)} className="px-2 py-1 text-xs rounded hover:opacity-70" style={{ color: 'var(--text-secondary)' }}>12m</button>
        <span className="w-px h-5 mx-1" style={{ background: 'var(--border)' }} />
        <button onClick={() => exportFile('xlsx')} className="px-2 py-1 text-xs rounded hover:opacity-70 font-medium" style={{ color: 'var(--accent)' }}>⬇ Excel</button>
        <button onClick={() => exportFile('pdf')} className="px-2 py-1 text-xs rounded hover:opacity-70 font-medium" style={{ color: 'var(--accent)' }}>⬇ PDF</button>
      </div>
    </div>
  )
}
