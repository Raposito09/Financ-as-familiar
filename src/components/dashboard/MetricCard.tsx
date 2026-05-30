type Variant = 'income' | 'expense' | 'neutral'

interface Props {
  label: string
  value: string
  sub?: string
  variant?: Variant
}

const variantStyle: Record<Variant, { color: string }> = {
  income:  { color: 'var(--success)' },
  expense: { color: 'var(--danger)' },
  neutral: { color: 'var(--text)' },
}

export default function MetricCard({ label, value, sub, variant = 'neutral' }: Props) {
  return (
    <div className="card-secondary p-4">
      <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </p>
      <p className="text-xl font-semibold" style={variantStyle[variant]}>
        {value}
      </p>
      {sub && (
        <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>{sub}</p>
      )}
    </div>
  )
}
