-- Script pour corriger les valeurs par défaut de TTL dans les fonctions de verrouillage
-- Problème identifié: les fonctions utilisent TTL_SEC = 30 par défaut au lieu de 300

-- 0. Supprimer d'abord les fonctions existantes pour éviter les conflits
DROP FUNCTION IF EXISTS public.acquire_planning_lock(text, text, integer);
DROP FUNCTION IF EXISTS public.renew_planning_lock(text, text, uuid, integer);
DROP FUNCTION IF EXISTS public.release_planning_lock(text, text, uuid);
DROP FUNCTION IF EXISTS public.emergency_takeover_planning_lock(text, text, text, integer, text);

-- 1. Recréer la fonction acquire_planning_lock avec TTL corrigé
CREATE OR REPLACE FUNCTION public.acquire_planning_lock(
  p_resource_id   text,
  p_holder        text,
  p_ttl_seconds   int DEFAULT 300  -- Changé de 30 à 300 (5 minutes)
) RETURNS TABLE(acquired boolean, resource_id text, holder text, lease_token uuid, expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_now    timestamptz := now();
  v_token  uuid        := gen_random_uuid();
  v_rows   int;
BEGIN
  INSERT INTO public.planning_lock(public.planning_lock.resource_id, public.planning_lock.holder, public.planning_lock.lease_token, public.planning_lock.expires_at, public.planning_lock.updated_at)
  VALUES (p_resource_id, p_holder, v_token, v_now + make_interval(secs => p_ttl_seconds), v_now)
  ON CONFLICT (public.planning_lock.resource_id) DO UPDATE
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

-- 2. Recréer la fonction renew_planning_lock avec TTL corrigé
CREATE OR REPLACE FUNCTION public.renew_planning_lock(
  p_resource_id   text,
  p_holder        text,
  p_lease_token   uuid,
  p_ttl_seconds   int DEFAULT 300  -- Changé de 30 à 300 (5 minutes)
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_now timestamptz := now();
BEGIN
  UPDATE public.planning_lock
     SET expires_at = v_now + make_interval(secs => p_ttl_seconds),
         updated_at = v_now
   WHERE public.planning_lock.resource_id = p_resource_id
     AND public.planning_lock.holder = p_holder
     AND public.planning_lock.lease_token = p_lease_token
     AND public.planning_lock.expires_at > v_now;
  RETURN FOUND;
END$$;

-- 3. Recréer la fonction release_planning_lock
CREATE OR REPLACE FUNCTION public.release_planning_lock(
  p_resource_id   text,
  p_holder        text,
  p_lease_token   uuid
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.planning_lock
     SET holder = NULL, lease_token = NULL, expires_at = NULL, updated_at = now()
   WHERE public.planning_lock.resource_id = p_resource_id
     AND public.planning_lock.holder = p_holder
     AND public.planning_lock.lease_token = p_lease_token;
  RETURN FOUND;
END$$;

-- 4. Recréer la fonction emergency_takeover_planning_lock avec TTL corrigé
CREATE OR REPLACE FUNCTION public.emergency_takeover_planning_lock(
  p_resource_id   text,
  p_new_holder    text,
  p_pin           text,
  p_ttl_seconds   int  DEFAULT 300,  -- Changé de 30 à 300 (5 minutes)
  p_tz            text DEFAULT 'Europe/Paris'
) RETURNS TABLE(acquired boolean, resource_id text, holder text, lease_token uuid, expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_now   timestamptz := now();
  v_ok    boolean;
  v_token uuid := gen_random_uuid();
BEGIN
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
   WHERE public.planning_lock.resource_id = p_resource_id;
  IF NOT FOUND THEN
    INSERT INTO public.planning_lock(public.planning_lock.resource_id, public.planning_lock.holder, public.planning_lock.lease_token, public.planning_lock.expires_at, public.planning_lock.updated_at)
    VALUES (p_resource_id, p_new_holder, v_token, v_now + make_interval(secs => p_ttl_seconds), v_now);
  END IF;
  RETURN QUERY SELECT true, p_resource_id, p_new_holder, v_token, v_now + make_interval(secs => p_ttl_seconds);
END$$;

-- 5. Vérifier que les fonctions ont été mises à jour
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN ('acquire_planning_lock', 'renew_planning_lock', 'emergency_takeover_planning_lock')
ORDER BY routine_name;

-- 6. Test de la fonction corrigée
SELECT 'Test acquire_planning_lock avec TTL par défaut' as test_name;
SELECT * FROM public.acquire_planning_lock('test-ttl-fix', 'test-user');

-- 7. Vérifier le verrou créé
SELECT 
  resource_id,
  holder,
  expires_at,
  EXTRACT(EPOCH FROM (expires_at - now())) as seconds_remaining
FROM public.planning_lock 
WHERE resource_id = 'test-ttl-fix';

-- 8. Nettoyer le test
DELETE FROM public.planning_lock WHERE resource_id = 'test-ttl-fix';

-- 9. Message de confirmation
SELECT '✅ Correction TTL appliquée avec succès!' as status;
