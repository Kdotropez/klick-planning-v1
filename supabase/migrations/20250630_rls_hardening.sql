-- Durcissement RLS : verrous globaux modifiables uniquement via RPC SECURITY DEFINER
-- Exécuter après 20250630_global_lock_atomic.sql

-- 1. Retirer les écritures directes anon sur planning_locks
DROP POLICY IF EXISTS locks_insert_all ON public.planning_locks;
DROP POLICY IF EXISTS locks_update_all ON public.planning_locks;
DROP POLICY IF EXISTS locks_delete_all ON public.planning_locks;

-- Lecture seule pour le client (état du verrou)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'planning_locks' AND policyname = 'locks_select_all'
  ) THEN
    CREATE POLICY locks_select_all ON public.planning_locks FOR SELECT USING (true);
  END IF;
END $$;

-- 2. Déverrouillage d'urgence côté serveur (évite delete direct depuis le client)
CREATE OR REPLACE FUNCTION public.emergency_unlock_global_lock(
  p_security_code text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._set_search_path();

  IF trim(coalesce(p_security_code, '')) <> '2111' THEN
    RETURN false;
  END IF;

  DELETE FROM public.planning_locks
   WHERE shop_id = 'GLOBAL' AND week_key = 'GLOBAL';

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.emergency_unlock_global_lock(text) TO anon, authenticated;

-- 3. Force release notification via RPC (évite upsert direct)
CREATE OR REPLACE FUNCTION public.force_release_global_lock(
  p_user_id text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
BEGIN
  PERFORM public._set_search_path();

  INSERT INTO public.planning_locks (shop_id, week_key, user_id, force_release_request, created_at, updated_at)
  VALUES ('GLOBAL', 'GLOBAL', coalesce(p_user_id, 'unknown'), v_now, v_now, v_now)
  ON CONFLICT (shop_id, week_key) DO UPDATE
    SET force_release_request = v_now,
        user_id = coalesce(excluded.user_id, public.planning_locks.user_id),
        updated_at = v_now;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.force_release_global_lock(text) TO anon, authenticated;

-- NOTE plannings : policies permissives conservées (sync complete_file).
-- Pour durcir : migrer vers Supabase Auth + policies auth.uid() ou service role backend.
