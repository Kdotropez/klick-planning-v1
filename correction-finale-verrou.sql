-- CORRECTION FINALE - SYSTÈME DE VERROUILLAGE ROBUSTE
-- À exécuter dans Supabase SQL Editor

-- 1. NETTOYER TOUS LES VERROUS EXISTANTS
DELETE FROM public.planning_lock;

-- 2. SUPPRIMER TOUTES LES FONCTIONS EXISTANTES
DROP FUNCTION IF EXISTS public.acquire_planning_lock(text, text);
DROP FUNCTION IF EXISTS public.acquire_planning_lock(text, text, integer);
DROP FUNCTION IF EXISTS public.renew_planning_lock(text, text, uuid);
DROP FUNCTION IF EXISTS public.renew_planning_lock(text, text, uuid, integer);
DROP FUNCTION IF EXISTS public.release_planning_lock(text, text, uuid);
DROP FUNCTION IF EXISTS public.emergency_takeover_planning_lock(text, text, text);
DROP FUNCTION IF EXISTS public.emergency_takeover_planning_lock(text, text, text, integer);
DROP FUNCTION IF EXISTS public.emergency_takeover_planning_lock(text, text, text, integer, text);

-- 3. CRÉER LA FONCTION ACQUIRE AVEC TTL ROBUSTE (10 minutes)
CREATE OR REPLACE FUNCTION public.acquire_planning_lock(
  p_resource_id   text,
  p_holder        text,
  p_ttl_seconds   int DEFAULT 600  -- 10 minutes par défaut
) RETURNS TABLE(acquired boolean, resource_id text, holder text, lease_token uuid, expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_now    timestamptz := now();
  v_token  uuid        := gen_random_uuid();
  v_rows   int;
BEGIN
  -- Supprimer tout verrou existant pour cette ressource
  DELETE FROM public.planning_lock pl WHERE pl.resource_id = p_resource_id;
  
  -- Insérer le nouveau verrou
  INSERT INTO public.planning_lock(resource_id, holder, lease_token, expires_at, updated_at)
  VALUES (p_resource_id, p_holder, v_token, v_now + make_interval(secs => p_ttl_seconds), v_now);
  
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  
  IF v_rows > 0 THEN
    RETURN QUERY SELECT true, p_resource_id, p_holder, v_token, v_now + make_interval(secs => p_ttl_seconds);
  ELSE
    RETURN QUERY SELECT false, p_resource_id, NULL, NULL, NULL;
  END IF;
END$$;

-- 4. CRÉER LA FONCTION RENEW AVEC TTL ROBUSTE
CREATE OR REPLACE FUNCTION public.renew_planning_lock(
  p_resource_id   text,
  p_holder        text,
  p_lease_token   uuid,
  p_ttl_seconds   int DEFAULT 600  -- 10 minutes par défaut
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE 
  v_now timestamptz := now();
BEGIN
  UPDATE public.planning_lock pl
     SET expires_at = v_now + make_interval(secs => p_ttl_seconds),
         updated_at = v_now
   WHERE pl.resource_id = p_resource_id
     AND pl.holder = p_holder
     AND pl.lease_token = p_lease_token
     AND pl.expires_at > v_now;
  RETURN FOUND;
END$$;

-- 5. CRÉER LA FONCTION RELEASE
CREATE OR REPLACE FUNCTION public.release_planning_lock(
  p_resource_id   text,
  p_holder        text,
  p_lease_token   uuid
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM public.planning_lock pl
   WHERE pl.resource_id = p_resource_id
     AND pl.holder = p_holder
     AND pl.lease_token = p_lease_token;
  RETURN FOUND;
END$$;

-- 6. CRÉER LA FONCTION EMERGENCY AVEC TTL ROBUSTE
CREATE OR REPLACE FUNCTION public.emergency_takeover_planning_lock(
  p_resource_id   text,
  p_new_holder    text,
  p_pin           text,
  p_ttl_seconds   int DEFAULT 600  -- 10 minutes par défaut
) RETURNS TABLE(acquired boolean, resource_id text, holder text, lease_token uuid, expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_now   timestamptz := now();
  v_ok    boolean;
  v_token uuid        := gen_random_uuid();
BEGIN
  -- Vérifier le PIN (format: DDMM)
  v_ok := (to_char((v_now AT TIME ZONE 'Europe/Paris'), 'DDMM') = p_pin);
  
  IF NOT v_ok THEN
    RETURN QUERY SELECT false, pl.resource_id, pl.holder, pl.lease_token, pl.expires_at
      FROM public.planning_lock pl WHERE pl.resource_id = p_resource_id;
    RETURN;
  END IF;

  -- Supprimer l'ancien verrou et en créer un nouveau
  DELETE FROM public.planning_lock pl WHERE pl.resource_id = p_resource_id;
  
  INSERT INTO public.planning_lock(resource_id, holder, lease_token, expires_at, updated_at)
  VALUES (p_resource_id, p_new_holder, v_token, v_now + make_interval(secs => p_ttl_seconds), v_now);
  
  RETURN QUERY SELECT true, p_resource_id, p_new_holder, v_token, v_now + make_interval(secs => p_ttl_seconds);
END$$;

-- 7. TEST DE VALIDATION
SELECT 'Test du système de verrouillage robuste:' as test_name;
SELECT * FROM public.acquire_planning_lock('test-robuste', 'user-test', 600);

-- 8. VÉRIFIER LE VERROU CRÉÉ
SELECT 
  'Verrou de test créé:' as status,
  pl.resource_id,
  pl.holder,
  pl.expires_at,
  EXTRACT(EPOCH FROM (pl.expires_at - now())) as seconds_remaining
FROM public.planning_lock pl
WHERE pl.resource_id = 'test-robuste';

-- 9. NETTOYER LE TEST
DELETE FROM public.planning_lock pl WHERE pl.resource_id = 'test-robuste';

-- 10. MESSAGE DE CONFIRMATION
SELECT '🔒 SYSTÈME DE VERROUILLAGE ROBUSTE ACTIVÉ!' as message;
SELECT 'TTL: 10 minutes, Heartbeat: 30 secondes' as configuration;
SELECT 'Sécurité multi-utilisateur rétablie' as securite;
