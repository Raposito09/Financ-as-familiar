export type UserRole = 'admin' | 'member'

export type PaymentMethod = 'pix' | 'credit_card' | 'debit_card' | 'cash' | 'transfer'

export type TransactionType = 'income' | 'expense'

export type GoalStatus = 'active' | 'completed' | 'cancelled'

export type Category =
  | 'alimentacao'
  | 'transporte'
  | 'moradia'
  | 'saude'
  | 'educacao'
  | 'lazer'
  | 'vestuario'
  | 'assinaturas'
  | 'pets'
  | 'investimentos'
  | 'compras_online'
  | 'outros'

export interface Family {
  id: string
  name: string
  created_at: string
}

export interface Profile {
  id: string
  family_id: string
  name: string
  email: string
  role: UserRole
  avatar_color: string
  created_at: string
}

export interface Transaction {
  id: string
  user_id: string
  family_id: string
  type: TransactionType
  amount: number
  category: Category
  payment_method: PaymentMethod
  description: string | null
  date: string
  installment_total: number | null
  installment_current: number | null
  installment_group_id: string | null
  is_recurring: boolean
  created_at: string
  profile?: Profile
}

export interface Budget {
  id: string
  user_id: string
  category: Category
  limit_amount: number
  month: number
  year: number
}

export interface Goal {
  id: string
  user_id: string
  title: string
  target_amount: number
  saved_amount: number
  target_date: string | null
  status: GoalStatus
  icon: string | null
  created_at: string
}

export interface DebtSplit {
  id: string
  transaction_id: string
  payer_id: string
  debtor_id: string
  amount: number
  settled: boolean
  settled_at: string | null
  transaction?: Transaction
  payer?: Profile
  debtor?: Profile
}

export interface Investment {
  id: string
  user_id: string
  type: string
  amount: number
  date: string
  description: string | null
  created_at: string
}

export interface FamilyInvite {
  token: string
  family_id: string
  email: string | null
  created_by: string
  created_at: string
  expires_at: string
  used_at: string | null
  used_by: string | null
}

export interface DashboardMetrics {
  totalIncome: number
  totalExpenses: number
  balance: number
  savingsRate: number
  futureInstallments: number
  byCategory: { category: Category; total: number }[]
  byMember?: { profile: Profile; total: number }[]
  budgetAlerts: { budget: Budget; spent: number; pct: number }[]
  recentTransactions: Transaction[]
}
