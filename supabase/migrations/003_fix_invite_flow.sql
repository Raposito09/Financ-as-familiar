-- ============================================================
-- Migration 003 — Corrigir fluxo de convite (FK violation)
-- ============================================================
-- Problema: o trigger handle_new_user tentava fazer
--   UPDATE family_invites SET used_by = NEW.id
-- ANTES de inserir o profile em profiles(id).
-- Como used_by REFERENCES profiles(id), isso causava FK violation
-- e retornava "Database error saving new user".
--
-- Correção: inserir o profile PRIMEIRO, depois consumir o convite.
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
  -- Tentar extrair invite_token do metadata (com proteção contra UUID inválido)
  BEGIN
    v_invite_token := NULLIF(NEW.raw_user_meta_data->>'invite_token', '')::UUID;
  EXCEPTION WHEN invalid_text_representation THEN
    v_invite_token := NULL;
  END;

  IF v_invite_token IS NOT NULL THEN
    -- Convite via token: validar
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
  ELSE
    -- Sem token: cria nova família, vira admin
    INSERT INTO public.families (name)
    VALUES (COALESCE(NEW.raw_user_meta_data->>'family_name', 'Minha família'))
    RETURNING id INTO v_family_id;
    v_role := 'admin';
  END IF;

  -- ★ CRIAR O PROFILE PRIMEIRO (antes de consumir o convite)
  -- Necessário porque family_invites.used_by REFERENCES profiles(id)
  INSERT INTO public.profiles (id, family_id, name, email, role)
  VALUES (
    NEW.id,
    v_family_id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    v_role
  );

  -- ★ AGORA consumir o convite (profile já existe, FK satisfeita)
  IF v_invite_token IS NOT NULL THEN
    UPDATE public.family_invites
    SET used_at = NOW(), used_by = NEW.id
    WHERE token = v_invite_token;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- FIM. Testar:
--   1. Admin gera convite no app
--   2. Novo membro abre link ?invite=<token> e cria conta
--   3. Verificar: SELECT * FROM profiles ORDER BY created_at DESC LIMIT 5;
--   4. Verificar: SELECT * FROM family_invites WHERE used_at IS NOT NULL;
-- ============================================================
