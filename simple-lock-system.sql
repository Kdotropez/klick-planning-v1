-- Système de verrouillage SIMPLE et ROBUSTE
-- À exécuter dans l'éditeur SQL de Supabase

-- 1. Nettoyer l'existant
DROP FUNCTION IF EXISTS public.emergency_takeover_planning_lock(text, text, text, int, text);
DROP FUNCTION IF EXISTS public.acquire_planning_lock(text, text, int);
DROP FUNCTION IF EXISTS public.renew_planning_lock(text, text, uuid, int);
DROP FUNCTION IF EXISTS public.release_planning_lock(text, text, uuid);
DROP FUNCTION IF EXISTS public._set_search_path();

-- 2. Fonction simple pour acquérir un verrou
CREATE OR REPLACE FUNCTION public.acquire_planning_lock(
  p_resource_id text,
  p_holder text,
  p_ttl_seconds int DEFAULT 30
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_now timestamptz := now();
  v_token uuid := gen_random_uuid();
  v_expires timestamptz := v_now + (p_ttl_seconds || ' seconds')::interval;
BEGIN
  -- Essayer d'insérer ou de mettre à jour
  INSERT INTO public.planning_lock(resource_id, holder, lease_token, expires_at, updated_at)
  VALUES (p_resource_id, p_holder, v_token, v_expires, v_now)
  ON CONFLICT (resource_id) DO UPDATE
  SET holder = CASE 
    WHEN planning_lock.holder IS NULL OR planning_lock.expires_at <= v_now 
    THEN p_holder 
    ELSE planning_lock.holder 
  END,
  lease_token = CASE 
    WHEN planning_lock.holder IS NULL OR planning_lock.expires_at <= v_now 
    THEN v_token 
    ELSE planning_lock.lease_token 
  END,
  expires_at = CASE 
    WHEN planning_lock.holder IS NULL OR planning_lock.expires_at <= v_now 
    THEN v_expires 
    ELSE planning_lock.expires_at 
  END,
  updated_at = CASE 
    WHEN planning_lock.holder IS NULL OR planning_lock.expires_at <= v_now 
    THEN v_now 
    ELSE planning_lock.updated_at 
  END;
  
  -- Vérifier si on a obtenu le verrou
  IF EXISTS (
    SELECT 1 FROM public.planning_lock 
    WHERE resource_id = p_resource_id 
    AND holder = p_holder 
    AND lease_token = v_token
  ) THEN
    RETURN json_build_object(
      'acquired', true,
      'resource_id', p_resource_id,
      'holder', p_holder,
      'lease_token', v_token,
      'expires_at', v_expires
    );
  ELSE
    -- Retourner l'état actuel du verrou
    RETURN (
      SELECT json_build_object(
        'acquired', false,
        'resource_id', resource_id,
        'holder', holder,
        'lease_token', lease_token,
        'expires_at', expires_at
      )
      FROM public.planning_lock 
      WHERE resource_id = p_resource_id
    );
  END IF;
END$$;

-- 3. Fonction simple pour renouveler un verrou
CREATE OR REPLACE FUNCTION public.renew_planning_lock(
  p_resource_id text,
  p_holder text,
  p_lease_token uuid,
  p_ttl_seconds int DEFAULT 30
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_now timestamptz := now();
  v_expires timestamptz := v_now + (p_ttl_seconds || ' seconds')::interval;
BEGIN
  UPDATE public.planning_lock
  SET expires_at = v_expires, updated_at = v_now
  WHERE resource_id = p_resource_id
    AND holder = p_holder
    AND lease_token = p_lease_token
    AND expires_at > v_now;
  
  RETURN FOUND;
END$$;

-- 4. Fonction simple pour libérer un verrou
CREATE OR REPLACE FUNCTION public.release_planning_lock(
  p_resource_id text,
  p_holder text,
  p_lease_token uuid
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.planning_lock
  SET holder = NULL, lease_token = NULL, expires_at = NULL, updated_at = now()
  WHERE resource_id = p_resource_id
    AND holder = p_holder
    AND lease_token = p_lease_token;
  
  RETURN FOUND;
END$$;

-- 5. Fonction simple pour déverrouillage d'urgence
CREATE OR REPLACE FUNCTION public.emergency_takeover_planning_lock(
  p_resource_id text,
  p_new_holder text,
  p_pin text,
  p_ttl_seconds int DEFAULT 30
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_now timestamptz := now();
  v_token uuid := gen_random_uuid();
  v_expires timestamptz := v_now + (p_ttl_seconds || ' seconds')::interval;
  v_expected_pin text := to_char(v_now, 'DDMM');
BEGIN
  -- Vérifier le code PIN
  IF p_pin != v_expected_pin THEN
    RETURN (
      SELECT json_build_object(
        'acquired', false,
        'resource_id', resource_id,
        'holder', holder,
        'lease_token', lease_token,
        'expires_at', expires_at
      )
      FROM public.planning_lock 
      WHERE resource_id = p_resource_id
    );
  END IF;
  
  -- Forcer la prise de contrôle
  INSERT INTO public.planning_lock(resource_id, holder, lease_token, expires_at, updated_at)
  VALUES (p_resource_id, p_new_holder, v_token, v_expires, v_now)
  ON CONFLICT (resource_id) DO UPDATE
  SET holder = p_new_holder,
      lease_token = v_token,
      expires_at = v_expires,
      updated_at = v_now;
  
  RETURN json_build_object(
    'acquired', true,
    'resource_id', p_resource_id,
    'holder', p_new_holder,
    'lease_token', v_token,
    'expires_at', v_expires
  );
END$$;

-- 6. Vérifier que tout fonctionne
SELECT 'Fonctions créées avec succès' as status;
