import { requireProfile } from '@/lib/auth'
import CsvImporter from '@/components/import/CsvImporter'

export default async function ImportPage() {
  const { user, profile } = await requireProfile()

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div>
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Importar extrato CSV</h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Suba o CSV do seu banco e revise antes de importar. Categoria sugerida automaticamente pela descrição.
        </p>
      </div>
      <CsvImporter userId={user.id} familyId={profile.family_id} />
    </div>
  )
}
