-- Correction complète de toutes les fonctions de verrouillage
-- À exécuter dans l'éditeur SQL de Supabase

-- 1. Supprimer toutes les anciennes fonctions
DROP FUNCTION IF EXISTS public.emergency_takeover_planning_lock(text, text, text, int, text);
DROP FUNCTION IF EXISTS public.acquire_planning_lock(text, text, int);
DROP FUNCTION IF EXISTS public.renew_planning_lock(text, text, uuid, int);
DROP FUNCTION IF EXISTS public.release_planning_lock(text, text, uuid);

-- 2. Recréer la fonction acquire_planning_lock corrigée
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

-- 3. Recréer la fonction renew_planning_lock corrigée
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

-- 4. Recréer la fonction release_planning_lock corrigée
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

-- 5. Recréer la fonction emergency_takeover_planning_lock corrigée
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

-- 6. Vérifier que toutes les fonctions sont créées
SELECT 
  proname as function_name,
  proargtypes::regtype[] as parameters
FROM pg_proc 
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND proname LIKE '%planning_lock%'
ORDER BY proname;
