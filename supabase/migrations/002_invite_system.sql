-- ============================================================
-- Migration 002 — Sistema de convite com token
-- ============================================================
-- Aplique no SQL Editor do Supabase APÓS migration 001.
--
-- Mudanças:
--   • Tabela family_invites (token assinado por UUID, validade 7d)
--   • Policies RLS (admin gerencia, anônimos não veem)
--   • handle_new_user passa a EXIGIR invite_token para entrar em família existente
--     (signup sem token continua criando família nova e virando admin)
--
-- Esta migration é idempotente.
-- ============================================================

-- ============================================================
-- 1. Tabela family_invites
-- ============================================================
CREATE TABLE IF NOT EXISTS family_invites (
  token       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id   UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  email       TEXT,                                                       -- opcional: pré-vincula a um email
  created_by  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  used_at     TIMESTAMPTZ,
  used_by     UUID REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_invites_family    ON family_invites(family_id);
CREATE INDEX IF NOT EXISTS idx_invites_active    ON family_invites(token) WHERE used_at IS NULL;

ALTER TABLE family_invites ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. Policies RLS
-- ============================================================
-- Admin vê e gerencia convites da própria família.
-- Não há policy pública: o trigger handle_new_user (SECURITY DEFINER) consome.

DROP POLICY IF EXISTS "invites_select_admin" ON family_invites;
CREATE POLICY "invites_select_admin" ON family_invites
  FOR SELECT
  USING (my_role() = 'admin' AND family_id = my_family_id());

DROP POLICY IF EXISTS "invites_insert_admin" ON family_invites;
CREATE POLICY "invites_insert_admin" ON family_invites
  FOR INSERT
  WITH CHECK (my_role() = 'admin' AND family_id = my_family_id() AND created_by = auth.uid());

DROP POLICY IF EXISTS "invites_delete_admin" ON family_invites;
CREATE POLICY "invites_delete_admin" ON family_invites
  FOR DELETE
  USING (my_role() = 'admin' AND family_id = my_family_id());

-- ============================================================
-- 3. handle_new_user — agora exige invite_token para família existente
-- ============================================================
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
    -- Convite via token: validar + consumir
    SELECT * INTO v_invite
    FROM public.family_invites
    WHERE token = v_invite_token
      AND used_at IS NULL
      AND expires_at > NOW();

    IF v_invite IS NULL THEN
      RAISE EXCEPTION 'Convite inválido ou expirado';
    END IF;

    -- Se o convite for restrito a um email específico, validar
    IF v_invite.email IS NOT NULL AND lower(v_invite.email) <> lower(NEW.email) THEN
      RAISE EXCEPTION 'Convite emitido para outro email';
    END IF;

    v_family_id := v_invite.family_id;
    v_role := 'member';

    UPDATE public.family_invites
    SET used_at = NOW(), used_by = NEW.id
    WHERE token = v_invite_token;

  ELSE
    -- Sem token: cria nova família, vira admin
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

-- ============================================================
-- FIM. Auditar:
--   SELECT * FROM pg_policies WHERE tablename = 'family_invites';
--   SELECT * FROM family_invites ORDER BY created_at DESC LIMIT 10;
-- ============================================================
