-- Extensions utiles
CREATE EXTENSION IF NOT EXISTS pgcrypto;      -- pour gen_random_uuid()

-- Table de verrou à bail (un seul écrivain par resource_id)
CREATE TABLE IF NOT EXISTS public.planning_lock (
  resource_id   text PRIMARY KEY,
  holder        text,                -- identifiant logique du poste/utilisateur
  lease_token   uuid,                -- token secret du bail
  expires_at    timestamptz,         -- échéance du bail
  updated_at    timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.planning_lock IS 'Verrou à bail pour un planning (single-writer).';

-- RLS : lecture pour tous, écriture uniquement via RPC (SECURITY DEFINER)
ALTER TABLE public.planning_lock ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='planning_lock' AND policyname='planning_lock_select_all'
  ) THEN
    CREATE POLICY planning_lock_select_all ON public.planning_lock FOR SELECT USING (true);
  END IF;
END$$;

-- Bloque les insert/update/delete directs (on passera par des fonctions SECURITY DEFINER)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='planning_lock' AND policyname='planning_lock_block_writes'
  ) THEN
    CREATE POLICY planning_lock_block_writes ON public.planning_lock FOR ALL TO PUBLIC
      USING (false) WITH CHECK (false);
  END IF;
END$$;

-- Sécurité : figer le search_path dans les fonctions
CREATE OR REPLACE FUNCTION public._set_search_path() RETURNS void
LANGUAGE sql AS $$ SELECT set_config('search_path', 'public', true); $$;

-- Acquire (atomique). Retourne (acquired, resource_id, holder, lease_token, expires_at)
CREATE OR REPLACE FUNCTION public.acquire_planning_lock(
  p_resource_id   text,
  p_holder        text,
  p_ttl_seconds   int DEFAULT 30
) RETURNS TABLE(acquired boolean, resource_id text, holder text, lease_token uuid, expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_now    timestamptz := now();
  v_token  uuid        := gen_random_uuid();
  v_rows   int;
BEGIN
  PERFORM public._set_search_path();
  INSERT INTO public.planning_lock(resource_id, holder, lease_token, expires_at, updated_at)
  VALUES (p_resource_id, p_holder, v_token, v_now + make_interval(secs => p_ttl_seconds), v_now)
  ON CONFLICT (resource_id) DO UPDATE
    SET holder = EXCLUDED.holder,
        lease_token = EXCLUDED.lease_token,
        expires_at = EXCLUDED.expires_at,
        updated_at = EXCLUDED.updated_at
    WHERE public.planning_lock.holder IS NULL
       OR public.planning_lock.expires_at <= v_now;
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows > 0 THEN
    RETURN QUERY SELECT true, p_resource_id, p_holder, v_token, v_now + make_interval(secs => p_ttl_seconds);
  ELSE
    RETURN QUERY SELECT false, l.resource_id, l.holder, l.lease_token, l.expires_at
      FROM public.planning_lock l WHERE l.resource_id = p_resource_id;
  END IF;
END$$;

-- Renew (heartbeat). Nécessite le token
CREATE OR REPLACE FUNCTION public.renew_planning_lock(
  p_resource_id   text,
  p_holder        text,
  p_lease_token   uuid,
  p_ttl_seconds   int DEFAULT 30
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_now timestamptz := now();
BEGIN
  PERFORM public._set_search_path();
  UPDATE public.planning_lock
     SET expires_at = v_now + make_interval(secs => p_ttl_seconds),
         updated_at = v_now
   WHERE resource_id = p_resource_id
     AND holder      = p_holder
     AND lease_token = p_lease_token
     AND expires_at  > v_now;
  RETURN FOUND;
END$$;

-- Release (libération volontaire). Nécessite le token
CREATE OR REPLACE FUNCTION public.release_planning_lock(
  p_resource_id   text,
  p_holder        text,
  p_lease_token   uuid
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM public._set_search_path();
  UPDATE public.planning_lock
     SET holder = NULL, lease_token = NULL, expires_at = NULL, updated_at = now()
   WHERE resource_id = p_resource_id
     AND holder      = p_holder
     AND lease_token = p_lease_token;
  RETURN FOUND;
END$$;

-- Emergency takeover (code JJMM, timezone par défaut Europe/Paris)
CREATE OR REPLACE FUNCTION public.emergency_takeover_planning_lock(
  p_resource_id   text,
  p_new_holder    text,
  p_pin           text,
  p_ttl_seconds   int  DEFAULT 30,
  p_tz            text DEFAULT 'Europe/Paris'
) RETURNS TABLE(acquired boolean, resource_id text, holder text, lease_token uuid, expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_now   timestamptz := now();
  v_ok    boolean;
  v_token uuid := gen_random_uuid();
BEGIN
  PERFORM public._set_search_path();
  v_ok := (to_char((v_now AT TIME ZONE p_tz), 'DDMM') = p_pin);
  IF NOT v_ok THEN
    RETURN QUERY SELECT false, l.resource_id, l.holder, l.lease_token, l.expires_at
      FROM public.planning_lock l WHERE l.resource_id = p_resource_id;
    RETURN;
  END IF;

  UPDATE public.planning_lock
     SET holder = p_new_holder,
         lease_token = v_token,
         expires_at  = v_now + make_interval(secs => p_ttl_seconds),
         updated_at  = v_now
   WHERE resource_id = p_resource_id;
  IF NOT FOUND THEN
    INSERT INTO public.planning_lock(resource_id, holder, lease_token, expires_at, updated_at)
    VALUES (p_resource_id, p_new_holder, v_token, v_now + make_interval(secs => p_ttl_seconds), v_now);
  END IF;
  RETURN QUERY SELECT true, p_resource_id, p_new_holder, v_token, v_now + make_interval(secs => p_ttl_seconds);
END$$;
