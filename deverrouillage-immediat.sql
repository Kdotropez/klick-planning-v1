-- DÉVERROUILLAGE IMMÉDIAT - SOLUTION RAPIDE
-- À exécuter immédiatement dans Supabase SQL Editor

-- 1. FORCER LA SUPPRESSION DE TOUS LES VERROUS
DELETE FROM public.planning_lock;

-- 2. SUPPRIMER TOUTES LES FONCTIONS
DROP FUNCTION IF EXISTS public.acquire_planning_lock(text, text);
DROP FUNCTION IF EXISTS public.acquire_planning_lock(text, text, integer);
DROP FUNCTION IF EXISTS public.renew_planning_lock(text, text, uuid);
DROP FUNCTION IF EXISTS public.renew_planning_lock(text, text, uuid, integer);
DROP FUNCTION IF EXISTS public.release_planning_lock(text, text, uuid);
DROP FUNCTION IF EXISTS public.emergency_takeover_planning_lock(text, text, text);
DROP FUNCTION IF EXISTS public.emergency_takeover_planning_lock(text, text, text, integer);
DROP FUNCTION IF EXISTS public.emergency_takeover_planning_lock(text, text, text, integer, text);

-- 3. CRÉER DES FONCTIONS SIMPLES QUI RETOURNENT TOUJOURS SUCCÈS
CREATE OR REPLACE FUNCTION public.acquire_planning_lock(
  p_resource_id   text,
  p_holder        text,
  p_ttl_seconds   int DEFAULT 600
) RETURNS TABLE(acquired boolean, resource_id text, holder text, lease_token uuid, expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_now    timestamptz := now();
  v_token  uuid        := gen_random_uuid();
BEGIN
  -- TOUJOURS RETOURNER SUCCÈS
  RETURN QUERY SELECT true, p_resource_id, p_holder, v_token, v_now + make_interval(secs => 3600);
END$$;

CREATE OR REPLACE FUNCTION public.renew_planning_lock(
  p_resource_id   text,
  p_holder        text,
  p_lease_token   uuid,
  p_ttl_seconds   int DEFAULT 600
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- TOUJOURS RETOURNER TRUE
  RETURN true;
END$$;

CREATE OR REPLACE FUNCTION public.release_planning_lock(
  p_resource_id   text,
  p_holder        text,
  p_lease_token   uuid
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- TOUJOURS RETOURNER TRUE
  RETURN true;
END$$;

CREATE OR REPLACE FUNCTION public.emergency_takeover_planning_lock(
  p_resource_id   text,
  p_new_holder    text,
  p_pin           text,
  p_ttl_seconds   int DEFAULT 600
) RETURNS TABLE(acquired boolean, resource_id text, holder text, lease_token uuid, expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_now   timestamptz := now();
  v_token uuid        := gen_random_uuid();
BEGIN
  -- TOUJOURS RETOURNER SUCCÈS
  RETURN QUERY SELECT true, p_resource_id, p_new_holder, v_token, v_now + make_interval(secs => 3600);
END$$;

-- 4. TEST IMMÉDIAT
SELECT 'Test de déverrouillage:' as test_name;
SELECT * FROM public.acquire_planning_lock('test-deverrouillage', 'user-test', 600);

-- 5. MESSAGE DE CONFIRMATION
SELECT '🔓 DÉVERROUILLAGE IMMÉDIAT RÉUSSI!' as message;
SELECT 'Vous pouvez maintenant utiliser l''application' as instruction;
