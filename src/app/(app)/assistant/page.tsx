import { requireProfile } from '@/lib/auth'
import ChatUI from '@/components/assistant/ChatUI'

export default async function AssistantPage() {
  await requireProfile()

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Assistente financeiro</h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Chat com IA — perguntas sobre seus dados dos últimos 6 meses
        </p>
      </div>
      <ChatUI />
    </div>
  )
}
