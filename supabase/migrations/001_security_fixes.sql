-- ============================================================
-- Migration 001 — Correções de segurança (A.1)
-- ============================================================
-- Aplique no SQL Editor do Supabase em projetos QUE JÁ EXISTEM.
-- Para projetos novos, use o schema.sql completo (já incorpora tudo isto).
--
-- Mudanças:
--   • WITH CHECK em todas as policies UPDATE
--   • Policy DELETE em debt_splits
--   • Admin pode editar role de outros membros (policy nova)
--   • Trigger prevent_profile_escalation bloqueia auto-promote e mudança de family_id
--   • handle_new_user reescrito: IGNORA 'role' do raw_user_meta_data
--   • families órfãs (criadas só em profiles, sem registro) corrigidas no novo trigger
--
-- Esta migration é idempotente: pode ser rodada mais de uma vez.
-- ============================================================

-- ============================================================
-- 1. Backfill: criar registros faltantes em families
-- ============================================================
-- O trigger antigo gerava UUIDs em profiles.family_id sem inserir em families.
-- Isso deixava famílias órfãs. Vamos corrigir.
INSERT INTO families (id, name)
SELECT DISTINCT p.family_id, 'Família ' || split_part(p.email,'@',1)
FROM profiles p
LEFT JOIN families f ON f.id = p.family_id
WHERE f.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. Reescrever policies UPDATE com WITH CHECK
-- ============================================================

-- PROFILES
DROP POLICY IF EXISTS "profiles_update"       ON profiles;
DROP POLICY IF EXISTS "profiles_update_own"   ON profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON profiles;

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_admin" ON profiles
  FOR UPDATE
  USING (my_role() = 'admin' AND family_id = my_family_id() AND id <> auth.uid())
  WITH CHECK (my_role() = 'admin' AND family_id = my_family_id() AND id <> auth.uid());

-- TRANSACTIONS
DROP POLICY IF EXISTS "tx_update" ON transactions;
CREATE POLICY "tx_update" ON transactions FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND family_id = my_family_id());

-- BUDGETS
DROP POLICY IF EXISTS "budget_update" ON budgets;
CREATE POLICY "budget_update" ON budgets FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- GOALS
DROP POLICY IF EXISTS "goal_update" ON goals;
CREATE POLICY "goal_update" ON goals FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- INVESTMENTS
DROP POLICY IF EXISTS "inv_update" ON investments;
CREATE POLICY "inv_update" ON investments FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- DEBT_SPLITS — SELECT mais restritivo + UPDATE com CHECK + DELETE novo
DROP POLICY IF EXISTS "split_select" ON debt_splits;
DROP POLICY IF EXISTS "split_update" ON debt_splits;
DROP POLICY IF EXISTS "split_delete" ON debt_splits;

CREATE POLICY "split_select" ON debt_splits FOR SELECT USING (
  payer_id = auth.uid()
  OR debtor_id = auth.uid()
  OR (my_role() = 'admin' AND EXISTS (
    SELECT 1 FROM transactions t WHERE t.id = transaction_id AND t.family_id = my_family_id()
  ))
);

CREATE POLICY "split_update" ON debt_splits FOR UPDATE
  USING (payer_id = auth.uid() OR debtor_id = auth.uid())
  WITH CHECK (payer_id = auth.uid() OR debtor_id = auth.uid());

CREATE POLICY "split_delete" ON debt_splits FOR DELETE
  USING (payer_id = auth.uid());

-- ============================================================
-- 3. Trigger anti-escalação em profiles
-- ============================================================
CREATE OR REPLACE FUNCTION prevent_profile_escalation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Cannot change profile id';
  END IF;
  IF NEW.family_id IS DISTINCT FROM OLD.family_id THEN
    RAISE EXCEPTION 'Cannot change family_id via UPDATE';
  END IF;
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

-- ============================================================
-- 4. handle_new_user seguro — IGNORA role do client
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_family_id UUID;
  v_role TEXT;
  v_meta_family UUID;
BEGIN
  v_meta_family := NULLIF(NEW.raw_user_meta_data->>'family_id', '')::UUID;

  IF v_meta_family IS NOT NULL AND EXISTS (SELECT 1 FROM public.families WHERE id = v_meta_family) THEN
    v_family_id := v_meta_family;
    v_role := 'member';
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

-- Trigger já existe (on_auth_user_created); apenas atualizar a função basta.

-- ============================================================
-- 5. Hardening helpers (search_path)
-- ============================================================
CREATE OR REPLACE FUNCTION my_family_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT family_id FROM profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION my_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$;

-- ============================================================
-- 6. Índice complementar
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_splits_tx ON debt_splits(transaction_id);

-- ============================================================
-- FIM. Para auditar, rode:
--   SELECT * FROM pg_policies WHERE schemaname = 'public';
--   SELECT tgname, tgrelid::regclass FROM pg_trigger WHERE NOT tgisinternal;
-- ============================================================
