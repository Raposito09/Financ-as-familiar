import { CATEGORY_LABELS } from '@/lib/utils'
import type { Category } from '@/types'

export interface WeeklyData {
  name: string
  weekFrom: string
  weekTo: string
  totalIncome: number
  totalExpense: number
  topCategories: { category: Category; total: number }[]
  goals: { title: string; saved: number; target: number; icon: string | null }[]
  budgetAlerts: { category: Category; spent: number; limit: number; pct: number }[]
}

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function pt(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export function renderWeeklyEmail(d: WeeklyData): { html: string; subject: string } {
  const balance = d.totalIncome - d.totalExpense
  const subject = `Resumo financeiro: ${pt(d.weekFrom)} a ${pt(d.weekTo)}`

  const categoryRows = d.topCategories.slice(0, 5).map(c => `
    <tr>
      <td style="padding:8px 0;color:#555;font-size:14px;">${CATEGORY_LABELS[c.category] ?? c.category}</td>
      <td style="padding:8px 0;color:#222;font-size:14px;text-align:right;font-weight:600;">${fmt(c.total)}</td>
    </tr>
  `).join('')

  const goalRows = d.goals.slice(0, 4).map(g => {
    const pct = g.target > 0 ? Math.min((g.saved / g.target) * 100, 100) : 0
    return `
      <tr><td style="padding:6px 0;">
        <div style="font-size:13px;color:#555;">${g.icon ?? '⭐'} ${g.title}</div>
        <div style="background:#eee;height:6px;border-radius:3px;margin-top:4px;overflow:hidden;">
          <div style="width:${pct.toFixed(0)}%;height:100%;background:#10b981;"></div>
        </div>
        <div style="font-size:11px;color:#888;margin-top:2px;">${fmt(g.saved)} de ${fmt(g.target)} · ${pct.toFixed(0)}%</div>
      </td></tr>
    `
  }).join('')

  const alertRows = d.budgetAlerts.slice(0, 5).map(a => {
    const color = a.pct >= 1 ? '#dc2626' : '#f59e0b'
    return `
      <tr><td style="padding:4px 0;font-size:13px;">
        <span style="color:${color};font-weight:600;">${a.pct >= 1 ? '⚠️' : '⚡'} ${CATEGORY_LABELS[a.category] ?? a.category}</span>
        <span style="color:#666;"> · ${fmt(a.spent)} / ${fmt(a.limit)} (${(a.pct * 100).toFixed(0)}%)</span>
      </td></tr>
    `
  }).join('')

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>${subject}</title></head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f6f6f6;color:#222;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f6;padding:24px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;">
        <tr><td style="padding:24px 28px;border-bottom:1px solid #eee;">
          <div style="font-size:20px;">💰 Finança Familiar</div>
          <div style="font-size:13px;color:#888;margin-top:4px;">Resumo semanal — ${pt(d.weekFrom)} a ${pt(d.weekTo)}</div>
        </td></tr>

        <tr><td style="padding:20px 28px;">
          <div style="font-size:15px;color:#444;">Olá, <strong>${d.name}</strong>.</div>
          <div style="font-size:13px;color:#666;margin-top:4px;">Veja como foi sua semana:</div>
        </td></tr>

        <tr><td style="padding:0 28px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:8px;padding:16px;">
            <tr>
              <td>
                <div style="font-size:11px;color:#888;text-transform:uppercase;">Receita</div>
                <div style="font-size:18px;color:#10b981;font-weight:700;">${fmt(d.totalIncome)}</div>
              </td>
              <td>
                <div style="font-size:11px;color:#888;text-transform:uppercase;">Despesa</div>
                <div style="font-size:18px;color:#dc2626;font-weight:700;">${fmt(d.totalExpense)}</div>
              </td>
              <td>
                <div style="font-size:11px;color:#888;text-transform:uppercase;">Saldo</div>
                <div style="font-size:18px;color:${balance >= 0 ? '#10b981' : '#dc2626'};font-weight:700;">${fmt(balance)}</div>
              </td>
            </tr>
          </table>
        </td></tr>

        ${categoryRows ? `
        <tr><td style="padding:20px 28px 0;">
          <div style="font-size:13px;font-weight:600;color:#333;margin-bottom:8px;">Categorias que mais pesaram</div>
          <table width="100%" cellpadding="0" cellspacing="0">${categoryRows}</table>
        </td></tr>` : ''}

        ${alertRows ? `
        <tr><td style="padding:20px 28px 0;">
          <div style="font-size:13px;font-weight:600;color:#333;margin-bottom:8px;">Alertas de orçamento</div>
          <table width="100%" cellpadding="0" cellspacing="0">${alertRows}</table>
        </td></tr>` : ''}

        ${goalRows ? `
        <tr><td style="padding:20px 28px 0;">
          <div style="font-size:13px;font-weight:600;color:#333;margin-bottom:8px;">Progresso dos objetivos</div>
          <table width="100%" cellpadding="0" cellspacing="0">${goalRows}</table>
        </td></tr>` : ''}

        <tr><td style="padding:24px 28px;color:#888;font-size:11px;text-align:center;border-top:1px solid #eee;margin-top:24px;">
          Você recebe este email porque tem conta na Finança Familiar.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`

  return { html, subject }
}
