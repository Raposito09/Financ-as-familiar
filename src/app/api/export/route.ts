import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { CATEGORY_LABELS, PAYMENT_LABELS } from '@/lib/utils'
import type { Transaction, Category, PaymentMethod } from '@/types'

interface Row {
  Data: string
  Tipo: string
  Categoria: string
  Pagamento: string
  Descricao: string
  Pessoa: string
  Valor: number
  Parcela: string
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MAX_RANGE_DAYS = 366 * 5 // 5 anos
const ALLOWED_FORMATS = new Set(['xlsx', 'pdf'])

/** Bloqueia CSV/Excel formula injection: =, +, -, @, |, TAB, CR no início. */
function safeCell(value: string): string {
  if (!value) return ''
  return /^[=+\-@|\t\r]/.test(value) ? "'" + value : value
}

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Sem perfil' }, { status: 400 })

  const url = new URL(req.url)
  const format = (url.searchParams.get('format') ?? 'xlsx').toLowerCase()
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')

  if (!ALLOWED_FORMATS.has(format)) {
    return NextResponse.json({ error: 'Formato inválido (use xlsx ou pdf)' }, { status: 400 })
  }
  if (!from || !to || !DATE_RE.test(from) || !DATE_RE.test(to)) {
    return NextResponse.json({ error: 'from/to obrigatórios no formato YYYY-MM-DD' }, { status: 400 })
  }
  const fromDate = new Date(from)
  const toDate = new Date(to)
  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    return NextResponse.json({ error: 'Datas inválidas' }, { status: 400 })
  }
  if (fromDate > toDate) {
    return NextResponse.json({ error: '"from" deve ser anterior a "to"' }, { status: 400 })
  }
  const rangeDays = (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)
  if (rangeDays > MAX_RANGE_DAYS) {
    return NextResponse.json({ error: `Período máximo: ${MAX_RANGE_DAYS} dias` }, { status: 400 })
  }

  const isAdmin = profile.role === 'admin'

  // Defense-in-depth: além do RLS, força filtro no servidor.
  let q = supabase
    .from('transactions')
    .select('*, profile:profiles(name)')
    .gte('date', from).lte('date', to)
    .eq('family_id', profile.family_id)
    .order('date', { ascending: false })
  if (!isAdmin) q = q.eq('user_id', user.id)

  const { data: txs = [] } = await q as { data: (Transaction & { profile?: { name: string } })[] }

  const rows: Row[] = (txs ?? []).map(t => ({
    Data: new Date(t.date).toLocaleDateString('pt-BR'),
    Tipo: t.type === 'income' ? 'Receita' : 'Despesa',
    Categoria: CATEGORY_LABELS[t.category as Category] ?? t.category,
    Pagamento: PAYMENT_LABELS[t.payment_method as PaymentMethod] ?? t.payment_method,
    Descricao: safeCell(t.description ?? ''),
    Pessoa: safeCell(t.profile?.name ?? ''),
    Valor: t.type === 'expense' ? -Number(t.amount) : Number(t.amount),
    Parcela: t.installment_total ? `${t.installment_current}/${t.installment_total}` : '',
  }))

  const income = rows.filter(r => r.Valor > 0).reduce((s, r) => s + r.Valor, 0)
  const expense = rows.filter(r => r.Valor < 0).reduce((s, r) => s + Math.abs(r.Valor), 0)
  const balance = income - expense

  const filename = `financa-familiar_${from}_${to}`

  if (format === 'xlsx') {
    const ws = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.sheet_add_aoa(ws, [
      [],
      ['Receita total', income],
      ['Despesa total', expense],
      ['Saldo', balance],
    ], { origin: -1 })
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Lançamentos')
    const buf: ArrayBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
    return new NextResponse(buf, {
      headers: {
        'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'content-disposition': `attachment; filename="${filename}.xlsx"`,
      },
    })
  }

  // PDF
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt' })
  doc.setFontSize(14)
  doc.text('Finança Familiar — Relatório', 40, 40)
  doc.setFontSize(10)
  doc.text(`Período: ${new Date(from).toLocaleDateString('pt-BR')} a ${new Date(to).toLocaleDateString('pt-BR')}`, 40, 58)
  doc.text(`Receita: R$ ${income.toFixed(2)}  ·  Despesa: R$ ${expense.toFixed(2)}  ·  Saldo: R$ ${balance.toFixed(2)}`, 40, 74)

  autoTable(doc, {
    startY: 90,
    head: [['Data', 'Tipo', 'Categoria', 'Pagamento', 'Descrição', 'Pessoa', 'Parcela', 'Valor (R$)']],
    body: rows.map(r => [r.Data, r.Tipo, r.Categoria, r.Pagamento, r.Descricao, r.Pessoa, r.Parcela, r.Valor.toFixed(2)]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [55, 138, 221] },
  })

  const buf = doc.output('arraybuffer')
  return new NextResponse(buf, {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${filename}.pdf"`,
    },
  })
}
