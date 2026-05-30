import type { Category } from '@/types'

const KEYWORDS: { kws: string[]; cat: Category }[] = [
  { kws: ['mercado', 'supermerc', 'extra', 'pão de açúcar', 'pao de acucar', 'carrefour', 'assai', 'atacad', 'feira'], cat: 'alimentacao' },
  { kws: ['restaurante', 'lanchonete', 'ifood', 'rappi', 'delivery', 'pizza', 'burger', 'mc donalds', 'mcdonalds'], cat: 'alimentacao' },
  { kws: ['uber', '99', 'posto', 'combustivel', 'combustível', 'gasolina', 'alcool', 'etanol', 'metro', 'metrô', 'onibus', 'ônibus', 'estaciona', 'ipva', 'oficina'], cat: 'transporte' },
  { kws: ['aluguel', 'condominio', 'condomínio', 'iptu', 'agua', 'água', 'luz', 'energia', 'gas', 'gás', 'internet', 'aluguel'], cat: 'moradia' },
  { kws: ['netflix', 'spotify', 'amazon prime', 'disney', 'globoplay', 'apple', 'youtube prem', 'hbo', 'paramount'], cat: 'assinaturas' },
  { kws: ['farmacia', 'farmácia', 'drogaria', 'consulta', 'clinica', 'clínica', 'hospital', 'plano de saude', 'plano de saúde', 'academia'], cat: 'saude' },
  { kws: ['escola', 'colegio', 'colégio', 'curso', 'faculdade', 'universidade', 'livraria'], cat: 'educacao' },
  { kws: ['cinema', 'show', 'bar ', 'pub', 'parque', 'ingresso', 'viagem', 'hotel', 'airbnb', 'booking'], cat: 'lazer' },
  { kws: ['roupa', 'calcado', 'calçado', 'sapato', 'zara', 'renner', 'riachuelo', 'c&a'], cat: 'vestuario' },
  { kws: ['pet ', 'veterin', 'racao', 'ração', 'cobasi', 'petz', 'petlove'], cat: 'pets' },
  { kws: ['shopee', 'mercado livre', 'mercadolivre', 'aliexpress', 'amazon.com', 'magalu', 'magazine luiza', 'americanas'], cat: 'compras_online' },
  { kws: ['tesouro', 'cdb', 'lci', 'lca', 'b3', 'corretora', 'xp invest', 'rico', 'nuinvest'], cat: 'investimentos' },
]

export function suggestCategory(description: string): Category {
  const desc = description.toLowerCase()
  for (const { kws, cat } of KEYWORDS) {
    if (kws.some(k => desc.includes(k))) return cat
  }
  return 'outros'
}

export interface ParsedRow {
  date: string
  description: string
  amount: number
  type: 'income' | 'expense'
  category: Category
  selected: boolean
  error?: string
}

function parseDate(input: string): string | null {
  const s = input.trim().replace(/"/g, '')
  // dd/mm/yyyy or dd/mm/yy
  let m = s.match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/)
  if (m) {
    let [, d, mo, y] = m
    if (y.length === 2) y = '20' + y
    return `${y}-${mo}-${d}`
  }
  // yyyy-mm-dd
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  // dd-mm-yyyy
  m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  return null
}

function parseAmount(input: string): number | null {
  const s = input.trim().replace(/"/g, '').replace(/R\$\s*/i, '')
  // Brazilian format "1.234,56" or "-1.234,56"
  const neg = s.startsWith('-')
  const clean = s.replace('-', '').replace(/\./g, '').replace(',', '.')
  const v = parseFloat(clean)
  if (isNaN(v)) return null
  return neg ? -v : v
}

export const MAX_CSV_ROWS = 5000
export const MAX_DESCRIPTION_LEN = 200

/**
 * Sanitiza prefixos perigosos para CSV/Excel (formula injection).
 * Células iniciadas com =, +, -, @, |, \t, \r quebram em planilhas.
 */
function sanitizeDescription(input: string): string {
  const trimmed = input.trim().replace(/^"|"$/g, '').slice(0, MAX_DESCRIPTION_LEN)
  if (/^[=+\-@|\t\r]/.test(trimmed)) return "'" + trimmed
  return trimmed
}

export function parseCSV(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length === 0) return []

  // Detect delimiter: ; or ,
  const delim = (lines[0].match(/;/g)?.length ?? 0) > (lines[0].match(/,/g)?.length ?? 0) ? ';' : ','

  // Try to detect header
  const firstCells = lines[0].split(delim).map(c => c.trim().toLowerCase())
  const hasHeader = firstCells.some(c => /data|date|valor|amount|descric|descript/.test(c))

  // Resolve column indices
  let dateIdx = 0, descIdx = 1, amountIdx = 2
  if (hasHeader) {
    firstCells.forEach((c, i) => {
      if (/^data|^date/.test(c)) dateIdx = i
      else if (/descric|descript|histor/.test(c)) descIdx = i
      else if (/valor|amount|montante/.test(c)) amountIdx = i
    })
  }

  // Limita o número de linhas processadas para evitar DoS no cliente
  const dataLines = (hasHeader ? lines.slice(1) : lines).slice(0, MAX_CSV_ROWS)
  const rows: ParsedRow[] = []

  for (const line of dataLines) {
    const cells = line.split(delim)
    if (cells.length < Math.max(dateIdx, descIdx, amountIdx) + 1) continue

    const date = parseDate(cells[dateIdx] ?? '')
    const description = sanitizeDescription(cells[descIdx] ?? '')
    const amount = parseAmount(cells[amountIdx] ?? '')

    const row: ParsedRow = {
      date: date ?? '',
      description,
      amount: Math.abs(amount ?? 0),
      type: (amount ?? 0) < 0 ? 'expense' : 'income',
      category: suggestCategory(description),
      selected: true,
    }
    if (!date) row.error = 'Data inválida'
    else if (amount === null) row.error = 'Valor inválido'
    rows.push(row)
  }
  return rows
}
