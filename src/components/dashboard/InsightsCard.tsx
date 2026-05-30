'use client'

import { useState } from 'react'
import { CATEGORY_LABELS } from '@/lib/utils'
import type { Category } from '@/types'

type Severidade = 'info' | 'atencao' | 'alerta'
interface Insight {
  titulo: string
  descricao: string
  severidade: Severidade
  categoria_relacionada: string | null
}

const SEV_STYLE: Record<Severidade, { color: string; bg: string; icon: string }> = {
  info: { color: 'var(--accent)', bg: 'var(--accent-bg)', icon: '💡' },
  atencao: { color: 'var(--warning)', bg: 'var(--warning-bg)', icon: '⚡' },
  alerta: { color: 'var(--danger)', bg: 'var(--danger-bg)', icon: '⚠️' },
}

export default function InsightsCard() {
  const [loading, setLoading] = useState(false)
  const [insights, setInsights] = useState<Insight[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function generate() {
    setLoading(true); setError(null); setInsights(null)
    try {
      const res = await fetch('/api/ai/insights', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro')
      setInsights(data.insights ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium" style={{ color: 'var(--text)' }}>
          🤖 Insights da IA
        </h3>
        <button onClick={generate} disabled={loading}
          className="text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-50"
          style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}>
          {loading ? 'Analisando…' : insights ? '↻ Gerar de novo' : 'Gerar insights'}
        </button>
      </div>

      {!insights && !loading && !error && (
        <p className="text-sm text-center py-6" style={{ color: 'var(--text-tertiary)' }}>
          Clique em &ldquo;Gerar insights&rdquo; para análise dos últimos 3 meses.
        </p>
      )}

      {loading && (
        <p className="text-sm text-center py-6" style={{ color: 'var(--text-tertiary)' }}>
          Analisando seus dados…
        </p>
      )}

      {error && (
        <p className="text-sm px-3 py-2 rounded-lg" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>
          {error}
        </p>
      )}

      {insights && insights.length === 0 && (
        <p className="text-sm text-center py-6" style={{ color: 'var(--text-tertiary)' }}>
          Sem insights por enquanto. Tente novamente após mais lançamentos.
        </p>
      )}

      {insights && insights.length > 0 && (
        <div className="space-y-3">
          {insights.map((it, i) => {
            const sev = SEV_STYLE[it.severidade] ?? SEV_STYLE.info
            return (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: sev.bg }}>
                <span className="text-base shrink-0">{sev.icon}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: sev.color }}>{it.titulo}</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{it.descricao}</p>
                  {it.categoria_relacionada && (CATEGORY_LABELS as Record<string, string>)[it.categoria_relacionada] && (
                    <p className="text-[10px] mt-1 uppercase font-semibold tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                      {CATEGORY_LABELS[it.categoria_relacionada as Category]}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
