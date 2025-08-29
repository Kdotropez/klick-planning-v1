-- Script pour nettoyer les verrous existants et corriger le TTL
-- Problème: 6 verrous actifs qui se battent entre eux

-- 1. Nettoyer tous les verrous existants
DELETE FROM public.planning_lock;

-- 2. Vérifier que le nettoyage a fonctionné
SELECT 'Verrous après nettoyage' as status, COUNT(*) as count FROM public.planning_lock;

-- 3. Supprimer TOUTES les versions des fonctions existantes pour éviter les ambiguïtés
DROP FUNCTION IF EXISTS public.acquire_planning_lock(text, text);
DROP FUNCTION IF EXISTS public.acquire_planning_lock(text, text, integer);
DROP FUNCTION IF EXISTS public.renew_planning_lock(text, text, uuid);
DROP FUNCTION IF EXISTS public.renew_planning_lock(text, text, uuid, integer);
DROP FUNCTION IF EXISTS public.release_planning_lock(text, text, uuid);
DROP FUNCTION IF EXISTS public.emergency_takeover_planning_lock(text, text, text);
DROP FUNCTION IF EXISTS public.emergency_takeover_planning_lock(text, text, text, integer);
DROP FUNCTION IF EXISTS public.emergency_takeover_planning_lock(text, text, text, integer, text);

-- 4. Recréer la fonction acquire_planning_lock avec TTL corrigé
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
  v_target_resource_id text := p_resource_id;
  v_existing_lock record;
BEGIN
  -- Vérifier s'il existe déjà un verrou pour cette ressource
  SELECT * INTO v_existing_lock 
  FROM public.planning_lock pl
  WHERE pl.resource_id = v_target_resource_id;
  
  -- Si pas de verrou existant ou verrou expiré, on peut acquérir
  IF v_existing_lock IS NULL OR v_existing_lock.expires_at <= v_now THEN
    -- Supprimer l'ancien verrou s'il existe
    DELETE FROM public.planning_lock pl WHERE pl.resource_id = v_target_resource_id;
    
    -- Insérer le nouveau verrou
    INSERT INTO public.planning_lock(resource_id, holder, lease_token, expires_at, updated_at)
    VALUES (v_target_resource_id, p_holder, v_token, v_now + make_interval(secs => p_ttl_seconds), v_now);
    
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    
    IF v_rows > 0 THEN
      RETURN QUERY SELECT true, v_target_resource_id, p_holder, v_token, v_now + make_interval(secs => p_ttl_seconds);
    ELSE
      RETURN QUERY SELECT false, v_target_resource_id, NULL, NULL, NULL;
    END IF;
  ELSE
    -- Verrou existant et valide, retourner les infos
    RETURN QUERY SELECT false, v_existing_lock.resource_id, v_existing_lock.holder, v_existing_lock.lease_token, v_existing_lock.expires_at;
  END IF;
END$$;

-- 5. Recréer la fonction renew_planning_lock avec TTL corrigé
CREATE OR REPLACE FUNCTION public.renew_planning_lock(
  p_resource_id   text,
  p_holder        text,
  p_lease_token   uuid,
  p_ttl_seconds   int DEFAULT 300  -- Changé de 30 à 300 (5 minutes)
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE 
  v_now timestamptz := now();
  v_target_resource_id text := p_resource_id;
BEGIN
  UPDATE public.planning_lock pl
     SET expires_at = v_now + make_interval(secs => p_ttl_seconds),
         updated_at = v_now
   WHERE pl.resource_id = v_target_resource_id
     AND pl.holder = p_holder
     AND pl.lease_token = p_lease_token
     AND pl.expires_at > v_now;
  RETURN FOUND;
END$$;

-- 6. Recréer la fonction release_planning_lock
CREATE OR REPLACE FUNCTION public.release_planning_lock(
  p_resource_id   text,
  p_holder        text,
  p_lease_token   uuid
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_target_resource_id text := p_resource_id;
BEGIN
  UPDATE public.planning_lock pl
     SET holder = NULL, lease_token = NULL, expires_at = NULL, updated_at = now()
   WHERE pl.resource_id = v_target_resource_id
     AND pl.holder = p_holder
     AND pl.lease_token = p_lease_token;
  RETURN FOUND;
END$$;

-- 7. Recréer la fonction emergency_takeover_planning_lock avec TTL corrigé
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
  v_target_resource_id text := p_resource_id;
BEGIN
  v_ok := (to_char((v_now AT TIME ZONE p_tz), 'DDMM') = p_pin);
  IF NOT v_ok THEN
    RETURN QUERY SELECT false, l.resource_id, l.holder, l.lease_token, l.expires_at
      FROM public.planning_lock l WHERE l.resource_id = v_target_resource_id;
    RETURN;
  END IF;

  -- Supprimer l'ancien verrou et en créer un nouveau
  DELETE FROM public.planning_lock pl WHERE pl.resource_id = v_target_resource_id;
  
  INSERT INTO public.planning_lock(resource_id, holder, lease_token, expires_at, updated_at)
  VALUES (v_target_resource_id, p_new_holder, v_token, v_now + make_interval(secs => p_ttl_seconds), v_now);
  
  RETURN QUERY SELECT true, v_target_resource_id, p_new_holder, v_token, v_now + make_interval(secs => p_ttl_seconds);
END$$;

-- 8. Test de la fonction corrigée
SELECT 'Test acquire_planning_lock avec TTL par défaut' as test_name;
SELECT * FROM public.acquire_planning_lock('test-ttl-fix', 'test-user');

-- 9. Vérifier le verrou créé
SELECT 
  resource_id,
  holder,
  expires_at,
  EXTRACT(EPOCH FROM (expires_at - now())) as seconds_remaining
FROM public.planning_lock 
WHERE resource_id = 'test-ttl-fix';

-- 10. Nettoyer le test
DELETE FROM public.planning_lock WHERE resource_id = 'test-ttl-fix';

-- 11. Vérification finale
SELECT 
  'État final' as status,
  COUNT(*) as verrous_actifs
FROM public.planning_lock;

-- 12. Message de confirmation
SELECT '✅ Nettoyage et correction TTL appliqués avec succès!' as status;
