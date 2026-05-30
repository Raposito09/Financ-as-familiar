'use client'

import { useState, useRef, useEffect } from 'react'

interface Msg { role: 'user' | 'model'; text: string }

const SUGGESTIONS = [
  'Quanto gastei em alimentação no último mês?',
  'Qual minha categoria com maior crescimento?',
  'Quando vou atingir minha próxima meta?',
  'Onde posso cortar gastos sem dor?',
]

export default function ChatUI() {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send(text?: string) {
    const q = (text ?? input).trim()
    if (!q || loading) return
    setError(null)
    const newMsgs: Msg[] = [...messages, { role: 'user', text: q }]
    setMessages(newMsgs)
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: newMsgs }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro')
      setMessages(m => [...m, { role: 'model', text: data.reply }])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card flex flex-col h-[calc(100vh-200px)] min-h-[480px]">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="space-y-4 py-8">
            <div className="text-center">
              <div className="text-3xl mb-2">🤖</div>
              <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                Olá! Sou o Finbot, seu assistente financeiro.
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                Tenho acesso aos seus últimos 6 meses. Pergunte algo:
              </p>
            </div>
            <div className="grid gap-2 max-w-md mx-auto">
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => send(s)} disabled={loading}
                  className="text-xs text-left px-3 py-2 rounded-lg border hover:opacity-80 disabled:opacity-40"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-[80%] px-3 py-2 rounded-2xl whitespace-pre-wrap text-sm"
              style={m.role === 'user'
                ? { background: 'var(--accent)', color: '#fff', borderBottomRightRadius: 4 }
                : { background: 'var(--bg-secondary)', color: 'var(--text)', borderBottomLeftRadius: 4 }}>
              {m.text}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="px-3 py-2 rounded-2xl text-sm" style={{ background: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }}>
              digitando…
            </div>
          </div>
        )}

        {error && (
          <div className="text-xs px-3 py-2 rounded-lg" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <form onSubmit={e => { e.preventDefault(); send() }}
        className="border-t p-3 flex gap-2" style={{ borderColor: 'var(--border)' }}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Pergunte algo sobre suas finanças…"
          disabled={loading}
          className="flex-1 px-3 py-2 text-sm rounded-lg border"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-md)', color: 'var(--text)' }} />
        <button type="submit" disabled={loading || !input.trim()}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
          style={{ background: 'var(--accent)' }}>
          Enviar
        </button>
      </form>
    </div>
  )
}
