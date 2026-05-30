'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/types'
import {
  LayoutDashboard, ArrowDownUp, Users, Target, Star, TrendingUp,
  Handshake, Clock, Scale, RotateCw, Upload, Bot,
  type LucideIcon,
} from 'lucide-react'

interface NavItem {
  href: string
  label: string
  Icon: LucideIcon
  roles: UserRole[]
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard',    label: 'Dashboard',    Icon: LayoutDashboard, roles: ['admin','member'] },
  { href: '/transactions', label: 'Lançamentos',  Icon: ArrowDownUp,     roles: ['admin','member'] },
  { href: '/members',      label: 'Membros',      Icon: Users,           roles: ['admin'] },
  { href: '/budgets',      label: 'Orçamentos',   Icon: Target,          roles: ['admin','member'] },
  { href: '/goals',        label: 'Objetivos',    Icon: Star,            roles: ['admin','member'] },
  { href: '/investments',  label: 'Investimentos',Icon: TrendingUp,      roles: ['admin','member'] },
  { href: '/splits',       label: 'Divisões',     Icon: Handshake,       roles: ['admin','member'] },
  { href: '/history',      label: 'Histórico',    Icon: Clock,           roles: ['admin','member'] },
  { href: '/compare',      label: 'Comparativo',  Icon: Scale,           roles: ['admin','member'] },
  { href: '/recurring',    label: 'Recorrentes',  Icon: RotateCw,        roles: ['admin','member'] },
  { href: '/import',       label: 'Importar',     Icon: Upload,          roles: ['admin','member'] },
  { href: '/assistant',    label: 'Assistente IA',Icon: Bot,             roles: ['admin','member'] },
]

export default function Sidebar({ role }: { role: UserRole }) {
  const pathname = usePathname()
  const items = NAV_ITEMS.filter(i => i.roles.includes(role))

  return (
    <aside className="hidden md:flex flex-col w-52 shrink-0 border-r"
           style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
      <div className="h-14 flex items-center gap-2 px-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <span className="text-lg">💰</span>
        <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Finança Familiar</span>
      </div>

      <nav className="flex-1 py-3 px-2 flex flex-col gap-0.5 overflow-y-auto">
        {items.map(({ href, label, Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link key={href} href={href}
              className={cn('flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                active ? 'font-medium' : 'hover:bg-[var(--bg-secondary)]'
              )}
              style={active
                ? { background: 'var(--accent-bg)', color: 'var(--accent)' }
                : { color: 'var(--text-secondary)' }
              }>
              <Icon size={16} className="shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
