# Finança Familiar

Web app de controle financeiro para famílias. **Next.js 14 + Supabase + Tailwind CSS + Gemini AI**.

Permite que cada membro lance gastos individualmente, com visão consolidada para o admin, parcelamentos, divisão de despesas, orçamentos, objetivos, importação CSV, exportação PDF/Excel, email semanal e assistente de IA.

---

## Sumário

1. [Início rápido](#1-início-rápido)
2. [Variáveis de ambiente](#2-variáveis-de-ambiente)
3. [Setup Supabase](#3-setup-supabase)
4. [Setup Resend (email)](#4-setup-resend-email)
5. [Setup Gemini AI](#5-setup-gemini-ai)
6. [Cron de tarefas](#6-cron-de-tarefas)
7. [Rodando o projeto](#7-rodando-o-projeto)
8. [Deploy](#8-deploy)
9. [Estrutura do projeto](#9-estrutura-do-projeto)
10. [Rotas e APIs](#10-rotas-e-apis)
11. [Modificando o projeto](#11-modificando-o-projeto)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Início rápido

```bash
# 1. Instalar dependências
npm install

# 2. Copiar env e preencher
cp .env.local.example .env.local
# (edite .env.local com suas chaves — ver seção 2)

# 3. Rodar Supabase setup (ver seção 3)
# 4. Rodar o projeto
npm run dev
```

Acesse `http://localhost:3000`. No primeiro acesso, clique em **Criar conta** — você será o **admin** da família.

---

## 2. Variáveis de ambiente

Arquivo: `.env.local` (copiar de `.env.local.example`).

| Variável | Obrigatório | Usado por | Como obter |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | tudo | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | tudo | Supabase → Settings → API |
| `RESEND_API_KEY` | só V2 | email semanal | https://resend.com → API Keys |
| `RESEND_FROM` | recomendado | email semanal | endereço verificado no Resend |
| `CRON_SECRET` | só V2 cron | `/api/email/weekly?all=true` | gere com `openssl rand -hex 32` |
| `GEMINI_API_KEY` | só V3 | OCR, insights, chat | https://aistudio.google.com/apikey |
| `GEMINI_MODEL` | opcional | IA | default `gemini-2.5-flash` |

> Variáveis com prefixo `NEXT_PUBLIC_` são expostas ao browser. **Não** prefixe chaves secretas com `NEXT_PUBLIC_`.

---

## 3. Setup Supabase

### 3.1 — Criar projeto
1. Acesse https://supabase.com → **New Project**
2. Escolha região mais próxima (ex.: `South America (São Paulo)`)
3. Anote a senha do banco (gerada pelo painel, não a sua de login)
4. Aguarde ~2 min até o projeto provisionar

### 3.2 — Pegar as chaves
- **Settings → API**
- Copie `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
- Copie `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 3.3 — Executar o schema
1. **SQL Editor → New query**
2. Cole o conteúdo de [`supabase/schema.sql`](supabase/schema.sql)
3. **Run**

Isso cria 7 tabelas (`families`, `profiles`, `transactions`, `budgets`, `goals`, `debt_splits`, `investments`), índices, políticas de RLS e o trigger `handle_new_user` que cria o profile automaticamente após signup.

### 3.4 — Configurar Auth
- **Authentication → Providers → Email**
- Desative "Confirm email" se quiser testar sem caixa de entrada (ou configure SMTP em **Settings → Auth**)
- **Authentication → URL Configuration**:
  - `Site URL`: `http://localhost:3000` (e o domínio de produção quando for deploy)
  - `Redirect URLs`: adicione os mesmos

### 3.5 — Modificar o schema depois

Se precisar **adicionar uma coluna, política RLS, índice ou trigger**:

```sql
-- Exemplo: nova coluna em transactions
ALTER TABLE transactions ADD COLUMN tags TEXT[];

-- Exemplo: nova política RLS
CREATE POLICY "tx_select_shared"
ON transactions FOR SELECT
USING (user_id = auth.uid() OR family_id = my_family_id());
```

> **Importante:** RLS está sempre ativo nas tabelas. Toda nova tabela criada DEVE ter políticas RLS, senão fica inacessível.

Para resetar tudo do zero:

```sql
DROP TABLE IF EXISTS debt_splits, investments, transactions, budgets, goals, profiles, families CASCADE;
DROP FUNCTION IF EXISTS my_family_id, my_role, handle_new_user CASCADE;
```

Depois rode `schema.sql` novamente.

---

## 4. Setup Resend (email)

Necessário para o **email semanal** (V2).

1. Crie conta em https://resend.com
2. **API Keys → Create API Key** → copie para `RESEND_API_KEY`
3. **Domains → Add Domain** (recomendado) ou use o sandbox `onboarding@resend.dev`
4. Preencha `RESEND_FROM` com o remetente

Para testar manualmente: na tela **Membros**, clique no ✉ ao lado de qualquer usuário.

Para automatizar o envio semanal → ver [seção 6 — Cron](#6-cron-de-tarefas).

---

## 5. Setup Gemini AI

Necessário para **V3**: OCR de comprovante, insights, chat assistente.

1. Acesse https://aistudio.google.com/apikey
2. **Create API key** → copie para `GEMINI_API_KEY`
3. Free tier dá ~10 req/min — suficiente para uso familiar
4. (Opcional) ajuste `GEMINI_MODEL`:
   - `gemini-2.5-flash` (default, recomendado)
   - `gemini-2.5-pro` (mais inteligente, mais lento, mais cota gasta)
   - `gemini-2.0-flash` (mais barato)

> **Aviso de privacidade:** no free tier, o Google pode usar suas requisições para treinar modelos. Para uso familiar é aceitável; para produção comercial considere upgrade pago.

---

## 6. Cron de tarefas

Algumas features precisam de execução periódica:

| Tarefa | Endpoint | Frequência sugerida |
|---|---|---|
| Email semanal para todos | `POST /api/email/weekly?all=true` | Domingo às 12h |
| Expandir recorrentes do mês | `POST /api/recurring/expand` (por usuário) | Dia 1 de cada mês |

Como a política Petlove **não permite** Vercel/Netlify/etc., as opções são:

### Opção A — Supabase pg_cron (recomendado)

No Supabase SQL Editor:

```sql
-- Habilitar pg_cron e pg_net (apenas uma vez)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Agendar email semanal todo domingo 12h UTC
SELECT cron.schedule(
  'weekly-email',
  '0 12 * * 0',
  $$
  SELECT net.http_post(
    url := 'https://SEU-DOMINIO/api/email/weekly?all=true',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || 'COLE-AQUI-O-CRON_SECRET',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Para listar/remover crons:
```sql
SELECT * FROM cron.job;
SELECT cron.unschedule('weekly-email');
```

### Opção B — GitHub Actions

Crie `.github/workflows/cron.yml`:
```yaml
on:
  schedule:
    - cron: '0 12 * * 0'
jobs:
  weekly-email:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            "${{ secrets.APP_URL }}/api/email/weekly?all=true"
```

### Opção C — Cron interno Petlove

Trate `/api/email/weekly?all=true` como endpoint público autenticado por Bearer token. Solicite ao time de infra que agende um `curl` mensal/semanal.

---

## 7. Rodando o projeto

```bash
# Dev (hot reload)
npm run dev

# Lint
npm run lint

# Build production
npm run build

# Run production local
npm start
```

Porta padrão: `3000`. Para mudar: `PORT=4000 npm run dev`.

---

## 8. Deploy

> ⚠️ **Política Petlove:** Vercel, Netlify, GitHub Pages, Replit e similares **não são permitidos**. Consultar o time de TI para definir a plataforma de hospedagem.

O app é uma **Next.js 14 standalone**. Funciona em qualquer host que rode Node.js 20+:

- Docker (`Dockerfile` pode ser gerado seguindo https://nextjs.org/docs/app/building-your-application/deploying)
- Kubernetes (com `next start`)
- VPS Linux com PM2

Variáveis de ambiente devem ser injetadas no host. **Nunca** committar `.env.local`.

---

## 9. Estrutura do projeto

```
src/
├── app/
│   ├── (app)/              ← route group autenticado (Sidebar + Topbar)
│   │   ├── layout.tsx
│   │   ├── dashboard/      Dashboard pessoal/familiar + InsightsCard
│   │   ├── transactions/   Lançamentos do mês + filtros
│   │   ├── budgets/        Orçamentos por categoria
│   │   ├── goals/          Objetivos financeiros
│   │   ├── investments/    Aportes e patrimônio
│   │   ├── splits/         Divisão de despesas
│   │   ├── history/        Histórico filtrável + export
│   │   ├── compare/        Comparativo entre períodos
│   │   ├── recurring/      Gastos recorrentes
│   │   ├── import/         Importação CSV
│   │   ├── assistant/      Chat IA
│   │   └── members/        Membros (admin)
│   ├── api/
│   │   ├── recurring/expand/   POST — gera lançamentos do mês
│   │   ├── export/             GET  — xlsx/pdf
│   │   ├── email/weekly/       POST — Resend
│   │   └── ai/
│   │       ├── ocr/            POST — Gemini Vision (comprovante)
│   │       ├── insights/       POST — análise 3 meses
│   │       └── chat/           POST — chat com contexto
│   ├── login/              Cadastro + login + convite
│   ├── layout.tsx          Layout raiz (fontes, manifest)
│   ├── page.tsx            Redirect → /dashboard
│   └── globals.css         Tailwind + variáveis CSS (dark/light)
├── components/
│   ├── dashboard/          Cards, gráfico, alertas, insights
│   ├── forms/              NewTransactionButton (com OCR)
│   ├── transactions/       TransactionList
│   ├── budgets/            BudgetManager
│   ├── goals/              GoalManager
│   ├── investments/        InvestmentManager
│   ├── splits/             SplitsManager
│   ├── history/            HistoryFilters (com export buttons)
│   ├── compare/            ComparePicker + CompareView
│   ├── recurring/          RecurringManager
│   ├── import/             CsvImporter
│   ├── assistant/          ChatUI
│   ├── members/            MembersManager
│   └── layout/             Sidebar + Topbar
├── lib/
│   ├── supabase/           client + server (cookies SSR)
│   ├── ai/                 gemini.ts (helper)
│   ├── email/              weekly-template.ts
│   ├── import-csv.ts       parser + suggestCategory
│   └── utils.ts            CATEGORY_LABELS, formatCurrency, etc.
├── types/
│   └── index.ts            Todos os tipos
└── middleware.ts           Auth guard global
supabase/
└── schema.sql              7 tabelas + RLS + trigger
```

---

## 10. Rotas e APIs

### Páginas

| Rota | Acesso | Função |
|---|---|---|
| `/login` | público | Login + cadastro (admin) + aceitar convite (member) |
| `/dashboard` | autenticado | Resumo do mês + InsightsCard |
| `/transactions` | autenticado | Lançamentos do mês |
| `/budgets` | autenticado | Orçamentos por categoria |
| `/goals` | autenticado | Objetivos |
| `/investments` | autenticado | Aportes |
| `/splits` | autenticado | Divisão de despesas |
| `/history` | autenticado | Histórico + export PDF/Excel |
| `/compare` | autenticado | Comparar 2 períodos |
| `/recurring` | autenticado | Templates recorrentes |
| `/import` | autenticado | Importar CSV |
| `/assistant` | autenticado | Chat IA |
| `/members` | **admin** | Gerenciar família + convites |

### APIs

| Endpoint | Método | Auth | Função |
|---|---|---|---|
| `/api/recurring/expand` | POST | sessão | Gera lançamentos do mês a partir de templates |
| `/api/export?format=xlsx\|pdf&from=&to=` | GET | sessão | Relatório do período |
| `/api/email/weekly?user_id=<id>` | POST | sessão (próprio) ou `Bearer CRON_SECRET` | Resumo semanal |
| `/api/email/weekly?all=true` | POST | `Bearer CRON_SECRET` | Resumo para todos |
| `/api/ai/ocr` | POST | sessão | Extrai dados de foto via Gemini Vision |
| `/api/ai/insights` | POST | sessão | Insights dos últimos 3 meses |
| `/api/ai/chat` | POST | sessão | Chat com contexto agregado |

---

## 11. Modificando o projeto

### Adicionar uma categoria
1. `src/types/index.ts` → tipo `Category`
2. `src/lib/utils.ts` → `CATEGORY_LABELS`, `CATEGORY_COLORS`, `CATEGORY_ICONS`
3. (Opcional) `src/lib/import-csv.ts` → adicione keywords em `KEYWORDS` para sugestão automática

### Adicionar uma forma de pagamento
1. `src/types/index.ts` → tipo `PaymentMethod`
2. `src/lib/utils.ts` → `PAYMENT_LABELS`
3. `supabase/schema.sql` → `CHECK (payment_method IN (...))` na tabela `transactions` (ou rode `ALTER TABLE transactions DROP CONSTRAINT ...; ALTER TABLE transactions ADD CONSTRAINT ...`)

### Adicionar uma rota nova
1. Crie pasta em `src/app/(app)/nome-da-rota/` com `page.tsx` (Server Component)
2. Adicione no Sidebar: `src/components/layout/Sidebar.tsx`
3. Se precisar de API: crie `src/app/api/nome-da-rota/route.ts`

### Mudar tema/cores
- Variáveis CSS em `src/app/globals.css` (`--accent`, `--success`, `--danger`, etc.)
- Cores por categoria em `src/lib/utils.ts` → `CATEGORY_COLORS`

### Trocar modelo Gemini
- `GEMINI_MODEL=gemini-2.5-pro` no `.env.local` — mais inteligente, mais lento, gasta mais cota

### Customizar prompt da IA
- OCR: `src/app/api/ai/ocr/route.ts` (variável `prompt`)
- Insights: `src/app/api/ai/insights/route.ts`
- Chat: `src/app/api/ai/chat/route.ts` (variável `systemPrompt`)

### Customizar template do email
- `src/lib/email/weekly-template.ts` — função `renderWeeklyEmail`

### Aumentar/diminuir contexto enviado para IA
- OCR não recebe contexto extra
- Insights: ajustar período em `route.ts` (atualmente 3 meses)
- Chat: ajustar período (atualmente 6 meses)

---

## 12. Troubleshooting

| Sintoma | Causa provável | Solução |
|---|---|---|
| `redirect /login` em loop | Cookie Supabase não persistindo | Verificar `NEXT_PUBLIC_SUPABASE_URL` e `ANON_KEY`. Limpar cookies. |
| Build falha com `Geist` | Versão antiga | Já corrigido para Inter/JetBrains_Mono |
| `useSearchParams should be wrapped in Suspense` | Página client usando hook sem boundary | Envolver o componente em `<Suspense>` |
| Tabela vazia após login | RLS bloqueando | Verificar política RLS no Supabase. Trigger `handle_new_user` rodou? |
| Trigger não cria profile | Algo errado no `handle_new_user` | Ver Supabase → Database → Functions → testar |
| Email não envia | API key inválida ou remetente não verificado | Confirmar `RESEND_API_KEY`. Para sandbox usar `onboarding@resend.dev` |
| OCR retorna erro | `GEMINI_API_KEY` ausente ou inválida | Conferir em https://aistudio.google.com/apikey |
| OCR retorna JSON quebrado | Modelo divagou | Reduza temperatura ou tente outra foto. Ver `raw` no erro |
| Cron não dispara | pg_cron não habilitado | `CREATE EXTENSION pg_cron` no Supabase |
| Página `/dashboard` lenta | Muitas queries | Considerar criar `view` no Supabase agregando os dados |

---

## Stack

| Camada | Tech |
|---|---|
| Frontend | Next.js 14.2 (App Router), React 18, Tailwind 3.4 |
| Estado/Form | React Hook Form + Zod (no `package.json`, uso opcional) |
| Datas | date-fns, date-fns-tz |
| Charts | Recharts 2.12 |
| Backend | Next.js API Routes |
| DB + Auth | Supabase (PostgreSQL + RLS) |
| Email | Resend 3.4 |
| Export | xlsx 0.18 + jspdf 4 + jspdf-autotable 5 |
| AI | @google/generative-ai (Gemini 2.5 Flash) |

---

## Licença

MIT Uso livre
