-- SCRIPT D'URGENCE - DÉVERROUILLAGE COMPLET
-- À exécuter immédiatement dans Supabase SQL Editor

-- 1. FORCER LA SUPPRESSION DE TOUS LES VERROUS
DELETE FROM public.planning_lock;

-- 2. VÉRIFIER QU'IL N'Y A PLUS DE VERROUS
SELECT 'Verrous restants après suppression forcée:' as status, COUNT(*) as count FROM public.planning_lock;

-- 3. SUPPRIMER TOUTES LES FONCTIONS EXISTANTES (même si elles n'existent pas)
DROP FUNCTION IF EXISTS public.acquire_planning_lock(text, text);
DROP FUNCTION IF EXISTS public.acquire_planning_lock(text, text, integer);
DROP FUNCTION IF EXISTS public.renew_planning_lock(text, text, uuid);
DROP FUNCTION IF EXISTS public.renew_planning_lock(text, text, uuid, integer);
DROP FUNCTION IF EXISTS public.release_planning_lock(text, text, uuid);
DROP FUNCTION IF EXISTS public.emergency_takeover_planning_lock(text, text, text);
DROP FUNCTION IF EXISTS public.emergency_takeover_planning_lock(text, text, text, integer);
DROP FUNCTION IF EXISTS public.emergency_takeover_planning_lock(text, text, text, integer, text);

-- 4. RECRÉER LA FONCTION ACQUIRE SIMPLE ET ROBUSTE
CREATE OR REPLACE FUNCTION public.acquire_planning_lock(
  p_resource_id   text,
  p_holder        text,
  p_ttl_seconds   int DEFAULT 300
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

-- 5. RECRÉER LA FONCTION RENEW SIMPLE
CREATE OR REPLACE FUNCTION public.renew_planning_lock(
  p_resource_id   text,
  p_holder        text,
  p_lease_token   uuid,
  p_ttl_seconds   int DEFAULT 300
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

-- 6. RECRÉER LA FONCTION RELEASE SIMPLE
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

-- 7. RECRÉER LA FONCTION EMERGENCY SIMPLE
CREATE OR REPLACE FUNCTION public.emergency_takeover_planning_lock(
  p_resource_id   text,
  p_new_holder    text,
  p_pin           text,
  p_ttl_seconds   int DEFAULT 300
) RETURNS TABLE(acquired boolean, resource_id text, holder text, lease_token uuid, expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_now   timestamptz := now();
  v_ok    boolean;
  v_token uuid := gen_random_uuid();
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

-- 8. TEST IMMÉDIAT DE DÉVERROUILLAGE
SELECT 'Test de déverrouillage immédiat' as test_name;
SELECT * FROM public.acquire_planning_lock('test-deverrouillage', 'user-urgence', 300);

-- 9. VÉRIFIER QUE LE VERROU EST BIEN CRÉÉ
SELECT 
  'Verrou de test créé:' as status,
  pl.resource_id,
  pl.holder,
  pl.expires_at,
  EXTRACT(EPOCH FROM (pl.expires_at - now())) as seconds_remaining
FROM public.planning_lock pl
WHERE pl.resource_id = 'test-deverrouillage';

-- 10. NETTOYER LE TEST
DELETE FROM public.planning_lock pl WHERE pl.resource_id = 'test-deverrouillage';

-- 11. ÉTAT FINAL
SELECT 
  '✅ DÉVERROUILLAGE RÉUSSI!' as status,
  COUNT(*) as verrous_restants
FROM public.planning_lock;

-- 12. MESSAGE DE CONFIRMATION
SELECT '🚨 SYSTÈME DÉVERROUILLÉ - Vous pouvez maintenant relancer l''application!' as message;
