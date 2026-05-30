import { type Category, type PaymentMethod } from '@/types'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export const CATEGORY_LABELS: Record<Category, string> = {
  alimentacao:   'Alimentação',
  transporte:    'Transporte',
  moradia:       'Moradia',
  saude:         'Saúde',
  educacao:      'Educação',
  lazer:         'Lazer',
  vestuario:     'Vestuário',
  assinaturas:   'Assinaturas',
  pets:          'Pets',
  investimentos: 'Investimentos',
  compras_online:'Compras online',
  outros:        'Outros',
}

export const CATEGORY_COLORS: Record<Category, string> = {
  alimentacao:   '#E24B4A',
  transporte:    '#BA7517',
  moradia:       '#378ADD',
  saude:         '#7F77DD',
  educacao:      '#1D9E75',
  lazer:         '#D4537E',
  vestuario:     '#D85A30',
  assinaturas:   '#888780',
  pets:          '#0F6E56',
  investimentos: '#3B6D11',
  compras_online:'#993C1D',
  outros:        '#5F5E5A',
}

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  pix:         'Pix',
  credit_card: 'Cartão de crédito',
  debit_card:  'Cartão de débito',
  cash:        'Dinheiro',
  transfer:    'Transferência',
}

export const CATEGORY_ICONS: Record<Category, string> = {
  alimentacao:   '🛒',
  transporte:    '🚗',
  moradia:       '🏠',
  saude:         '❤️',
  educacao:      '📚',
  lazer:         '🎉',
  vestuario:     '👕',
  assinaturas:   '📱',
  pets:          '🐾',
  investimentos: '📈',
  compras_online:'📦',
  outros:        '💡',
}

export const AVATAR_COLORS = [
  { bg: 'bg-blue-100 dark:bg-blue-900', text: 'text-blue-700 dark:text-blue-200' },
  { bg: 'bg-emerald-100 dark:bg-emerald-900', text: 'text-emerald-700 dark:text-emerald-200' },
  { bg: 'bg-amber-100 dark:bg-amber-900', text: 'text-amber-700 dark:text-amber-200' },
  { bg: 'bg-purple-100 dark:bg-purple-900', text: 'text-purple-700 dark:text-purple-200' },
  { bg: 'bg-rose-100 dark:bg-rose-900', text: 'text-rose-700 dark:text-rose-200' },
  { bg: 'bg-cyan-100 dark:bg-cyan-900', text: 'text-cyan-700 dark:text-cyan-200' },
]

export function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

export function getCurrentMonthYear() {
  const now = new Date()
  return { month: now.getMonth() + 1, year: now.getFullYear() }
}

/** Retorna o último dia REAL do mês 1-12 (trata fev, anos bissextos, etc.) */
export function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

/** Retorna { start, end } no formato YYYY-MM-DD respeitando o último dia real do mês. */
export function monthBounds(year: number, month: number) {
  const m = String(month).padStart(2, '0')
  const last = String(lastDayOfMonth(year, month)).padStart(2, '0')
  return { start: `${year}-${m}-01`, end: `${year}-${m}-${last}` }
}

/** Retorna início e fim para um intervalo de N meses futuros a partir de (year, month) inclusive. */
export function monthRangeAhead(year: number, month: number, ahead: number) {
  const start = new Date(year, month - 1 + 1, 1) // 1º dia do mês seguinte
  const end = new Date(year, month - 1 + ahead + 1, 0) // último dia do mês `ahead` à frente
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { start: fmt(start), end: fmt(end) }
}
