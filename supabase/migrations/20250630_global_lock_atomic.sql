-- Verrou global atomique (planning_locks shop_id=GLOBAL, week_key=GLOBAL)
-- À exécuter dans l'éditeur SQL Supabase si la migration n'est pas appliquée automatiquement.

CREATE OR REPLACE FUNCTION public._set_search_path() RETURNS void
LANGUAGE sql AS $$ SELECT set_config('search_path', 'public', true); $$;

-- Acquisition atomique : insert ou update uniquement si même utilisateur ou verrou expiré
CREATE OR REPLACE FUNCTION public.acquire_global_lock(
  p_user_id text,
  p_ttl_seconds int DEFAULT 90
) RETURNS TABLE(
  acquired boolean,
  shop_id text,
  week_key text,
  user_id text,
  updated_at timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_cutoff timestamptz := v_now - make_interval(secs => GREATEST(p_ttl_seconds, 1));
  v_rows int;
BEGIN
  PERFORM public._set_search_path();

  INSERT INTO public.planning_locks (shop_id, week_key, user_id, created_at, updated_at)
  VALUES ('GLOBAL', 'GLOBAL', p_user_id, v_now, v_now)
  ON CONFLICT (shop_id, week_key) DO UPDATE
    SET user_id = EXCLUDED.user_id,
        updated_at = v_now
    WHERE public.planning_locks.user_id = p_user_id
       OR public.planning_locks.updated_at <= v_cutoff;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows > 0 THEN
    RETURN QUERY
      SELECT true, l.shop_id, l.week_key, l.user_id, l.updated_at, l.created_at
      FROM public.planning_locks l
      WHERE l.shop_id = 'GLOBAL' AND l.week_key = 'GLOBAL';
  ELSE
    RETURN QUERY
      SELECT false, l.shop_id, l.week_key, l.user_id, l.updated_at, l.created_at
      FROM public.planning_locks l
      WHERE l.shop_id = 'GLOBAL' AND l.week_key = 'GLOBAL';
  END IF;
END;
$$;

-- Heartbeat : renouvelle updated_at si le verrou appartient à l'utilisateur et n'est pas expiré
CREATE OR REPLACE FUNCTION public.renew_global_lock(
  p_user_id text,
  p_ttl_seconds int DEFAULT 90
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_cutoff timestamptz := v_now - make_interval(secs => GREATEST(p_ttl_seconds, 1));
BEGIN
  PERFORM public._set_search_path();

  UPDATE public.planning_locks
     SET updated_at = v_now
   WHERE shop_id = 'GLOBAL'
     AND week_key = 'GLOBAL'
     AND user_id = p_user_id
     AND updated_at > v_cutoff;

  RETURN FOUND;
END;
$$;

-- Libération volontaire (uniquement par le détenteur)
CREATE OR REPLACE FUNCTION public.release_global_lock(
  p_user_id text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._set_search_path();

  DELETE FROM public.planning_locks
   WHERE shop_id = 'GLOBAL'
     AND week_key = 'GLOBAL'
     AND user_id = p_user_id;

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.acquire_global_lock(text, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.renew_global_lock(text, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_global_lock(text) TO anon, authenticated;
