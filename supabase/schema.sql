-- ============================================================
-- FINANÇA FAMILIAR — Schema completo (setup inicial)
-- ============================================================
-- Para projetos NOVOS: rode este arquivo no SQL Editor do Supabase.
-- Para projetos EXISTENTES: use os arquivos em supabase/migrations/.
-- ============================================================

-- ============================================================
-- 1. TABELAS
-- ============================================================

CREATE TABLE families (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  family_id    UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  email        TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member')),
  avatar_color TEXT NOT NULL DEFAULT '0',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE transactions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  family_id            UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  type                 TEXT NOT NULL CHECK (type IN ('income','expense')),
  amount               NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  category             TEXT NOT NULL,
  payment_method       TEXT NOT NULL CHECK (payment_method IN ('pix','credit_card','debit_card','cash','transfer')),
  description          TEXT,
  date                 DATE NOT NULL,
  installment_total    INTEGER,
  installment_current  INTEGER,
  installment_group_id UUID,
  is_recurring         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE budgets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category     TEXT NOT NULL,
  limit_amount NUMERIC(10,2) NOT NULL CHECK (limit_amount > 0),
  month        INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year         INTEGER NOT NULL,
  UNIQUE(user_id, category, month, year)
);

CREATE TABLE goals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  target_amount NUMERIC(10,2) NOT NULL CHECK (target_amount > 0),
  saved_amount  NUMERIC(10,2) NOT NULL DEFAULT 0,
  target_date   DATE,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','cancelled')),
  icon          TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE debt_splits (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  payer_id       UUID NOT NULL REFERENCES profiles(id),
  debtor_id      UUID NOT NULL REFERENCES profiles(id),
  amount         NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  settled        BOOLEAN NOT NULL DEFAULT FALSE,
  settled_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE investments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  amount      NUMERIC(10,2) NOT NULL,
  date        DATE NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE family_invites (
  token       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id   UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  email       TEXT,
  created_by  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  used_at     TIMESTAMPTZ,
  used_by     UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- ============================================================
-- 2. ÍNDICES
-- ============================================================
CREATE INDEX idx_transactions_user     ON transactions(user_id);
CREATE INDEX idx_transactions_family   ON transactions(family_id);
CREATE INDEX idx_transactions_date     ON transactions(date DESC);
CREATE INDEX idx_transactions_category ON transactions(category);
CREATE INDEX idx_budgets_user          ON budgets(user_id, month, year);
CREATE INDEX idx_goals_user            ON goals(user_id);
CREATE INDEX idx_splits_payer          ON debt_splits(payer_id);
CREATE INDEX idx_splits_debtor         ON debt_splits(debtor_id);
CREATE INDEX idx_splits_tx             ON debt_splits(transaction_id);
CREATE INDEX idx_investments_user      ON investments(user_id);
CREATE INDEX idx_invites_family        ON family_invites(family_id);
CREATE INDEX idx_invites_active        ON family_invites(token) WHERE used_at IS NULL;

-- ============================================================
-- 3. ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE families     ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets      ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals        ENABLE ROW LEVEL SECURITY;
ALTER TABLE debt_splits  ENABLE ROW LEVEL SECURITY;
ALTER TABLE investments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_invites ENABLE ROW LEVEL SECURITY;

-- Helpers
CREATE OR REPLACE FUNCTION my_family_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT family_id FROM profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION my_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$;

-- ============================================================
-- 4. POLÍTICAS RLS
-- ============================================================

-- FAMILIES: vê apenas a própria família
CREATE POLICY "families_select" ON families FOR SELECT USING (id = my_family_id());

-- PROFILES
CREATE POLICY "profiles_select_own"   ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "profiles_select_admin" ON profiles FOR SELECT USING (my_role() = 'admin' AND family_id = my_family_id());

-- INSERT só permitido a si mesmo (trigger handle_new_user usa SECURITY DEFINER, então bypassa)
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (id = auth.uid());

-- Membro pode atualizar APENAS o próprio perfil, e não pode mudar role/family_id/id.
-- Bloqueio é feito via trigger prevent_profile_escalation (abaixo) que valida em todos os UPDATEs.
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Admin pode atualizar role de OUTROS membros da mesma família (não pode editar o próprio role).
CREATE POLICY "profiles_update_admin" ON profiles
  FOR UPDATE
  USING (my_role() = 'admin' AND family_id = my_family_id() AND id <> auth.uid())
  WITH CHECK (my_role() = 'admin' AND family_id = my_family_id() AND id <> auth.uid());

-- TRANSACTIONS
CREATE POLICY "tx_select_own"   ON transactions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "tx_select_admin" ON transactions FOR SELECT USING (my_role() = 'admin' AND family_id = my_family_id());
CREATE POLICY "tx_insert"       ON transactions FOR INSERT WITH CHECK (user_id = auth.uid() AND family_id = my_family_id());
CREATE POLICY "tx_update"       ON transactions FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND family_id = my_family_id());
CREATE POLICY "tx_delete"       ON transactions FOR DELETE USING (user_id = auth.uid());

-- BUDGETS
CREATE POLICY "budget_select_own"   ON budgets FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "budget_select_admin" ON budgets FOR SELECT USING (
  my_role() = 'admin' AND user_id IN (SELECT id FROM profiles WHERE family_id = my_family_id())
);
CREATE POLICY "budget_insert" ON budgets FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "budget_update" ON budgets FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "budget_delete" ON budgets FOR DELETE USING (user_id = auth.uid());

-- GOALS
CREATE POLICY "goal_select_own"   ON goals FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "goal_select_admin" ON goals FOR SELECT USING (
  my_role() = 'admin' AND user_id IN (SELECT id FROM profiles WHERE family_id = my_family_id())
);
CREATE POLICY "goal_insert" ON goals FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "goal_update" ON goals FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "goal_delete" ON goals FOR DELETE USING (user_id = auth.uid());

-- DEBT_SPLITS
CREATE POLICY "split_select" ON debt_splits FOR SELECT USING (
  payer_id = auth.uid()
  OR debtor_id = auth.uid()
  OR (my_role() = 'admin' AND EXISTS (
    SELECT 1 FROM transactions t WHERE t.id = transaction_id AND t.family_id = my_family_id()
  ))
);
CREATE POLICY "split_insert" ON debt_splits FOR INSERT
  WITH CHECK (payer_id = auth.uid());
CREATE POLICY "split_update" ON debt_splits FOR UPDATE
  USING (payer_id = auth.uid() OR debtor_id = auth.uid())
  WITH CHECK (payer_id = auth.uid() OR debtor_id = auth.uid());
CREATE POLICY "split_delete" ON debt_splits FOR DELETE
  USING (payer_id = auth.uid());

-- INVESTMENTS
CREATE POLICY "inv_select_own"   ON investments FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "inv_select_admin" ON investments FOR SELECT USING (
  my_role() = 'admin' AND user_id IN (SELECT id FROM profiles WHERE family_id = my_family_id())
);
CREATE POLICY "inv_insert" ON investments FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "inv_update" ON investments FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "inv_delete" ON investments FOR DELETE USING (user_id = auth.uid());

-- FAMILY_INVITES (sem SELECT/INSERT públicos — trigger handle_new_user é SECURITY DEFINER)
CREATE POLICY "invites_select_admin" ON family_invites FOR SELECT
  USING (my_role() = 'admin' AND family_id = my_family_id());
CREATE POLICY "invites_insert_admin" ON family_invites FOR INSERT
  WITH CHECK (my_role() = 'admin' AND family_id = my_family_id() AND created_by = auth.uid());
CREATE POLICY "invites_delete_admin" ON family_invites FOR DELETE
  USING (my_role() = 'admin' AND family_id = my_family_id());

-- ============================================================
-- 5. TRIGGERS DE SEGURANÇA
-- ============================================================

-- Bloqueia escalação de privilégio: impede que qualquer UPDATE em profiles
-- altere id, family_id (exceto para o trigger SECURITY DEFINER de signup) ou
-- role (a não ser via política admin que valida quem está executando).
CREATE OR REPLACE FUNCTION prevent_profile_escalation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Cannot change profile id';
  END IF;
  IF NEW.family_id IS DISTINCT FROM OLD.family_id THEN
    RAISE EXCEPTION 'Cannot change family_id via UPDATE';
  END IF;
  -- Auto-promote bloqueado: usuário não pode alterar próprio role
  IF NEW.role IS DISTINCT FROM OLD.role AND NEW.id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot change own role';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_profile_escalation_trigger ON profiles;
CREATE TRIGGER prevent_profile_escalation_trigger
BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION prevent_profile_escalation();

-- Cria profile + family automaticamente após signup.
-- IGNORA `role` vindo do client — segurança.
-- Regra:
--   • Veio `invite_token` válido → consome convite e vira MEMBER da família.
--   • Sem token → cria nova família e vira ADMIN dela.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_family_id    UUID;
  v_role         TEXT;
  v_invite_token UUID;
  v_invite       RECORD;
BEGIN
  v_invite_token := NULLIF(NEW.raw_user_meta_data->>'invite_token', '')::UUID;

  IF v_invite_token IS NOT NULL THEN
    SELECT * INTO v_invite
    FROM public.family_invites
    WHERE token = v_invite_token
      AND used_at IS NULL
      AND expires_at > NOW();

    IF v_invite IS NULL THEN
      RAISE EXCEPTION 'Convite inválido ou expirado';
    END IF;

    IF v_invite.email IS NOT NULL AND lower(v_invite.email) <> lower(NEW.email) THEN
      RAISE EXCEPTION 'Convite emitido para outro email';
    END IF;

    v_family_id := v_invite.family_id;
    v_role := 'member';

    UPDATE public.family_invites
    SET used_at = NOW(), used_by = NEW.id
    WHERE token = v_invite_token;
  ELSE
    INSERT INTO public.families (name)
    VALUES (COALESCE(NEW.raw_user_meta_data->>'family_name', 'Minha família'))
    RETURNING id INTO v_family_id;
    v_role := 'admin';
  END IF;

  INSERT INTO public.profiles (id, family_id, name, email, role)
  VALUES (
    NEW.id,
    v_family_id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    v_role
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
