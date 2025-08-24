-- Correction de la fonction emergency_takeover_planning_lock
-- À exécuter dans l'éditeur SQL de Supabase

-- Supprimer l'ancienne fonction
DROP FUNCTION IF EXISTS public.emergency_takeover_planning_lock(text, text, text, int, text);

-- Recréer la fonction corrigée
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
