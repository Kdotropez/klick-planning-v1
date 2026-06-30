-- Upsert planning atomique via RPC SECURITY DEFINER
-- Exécuter après 20250630_rls_hardening.sql
-- Permet de retirer plus tard les policies INSERT/UPDATE directes sur plannings.

CREATE OR REPLACE FUNCTION public.upsert_planning_row(
  p_shop_id text,
  p_week_key text,
  p_data jsonb,
  p_version integer DEFAULT 1
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._set_search_path();

  IF trim(coalesce(p_shop_id, '')) = '' OR trim(coalesce(p_week_key, '')) = '' THEN
    RETURN false;
  END IF;

  INSERT INTO public.plannings (shop_id, week_key, data, version, updated_at)
  VALUES (
    p_shop_id,
    p_week_key,
    coalesce(p_data, '{}'::jsonb),
    coalesce(p_version, 1),
    now()
  )
  ON CONFLICT (shop_id, week_key) DO UPDATE
    SET data = EXCLUDED.data,
        version = EXCLUDED.version,
        updated_at = now();

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_planning_row(text, text, jsonb, integer) TO anon, authenticated;

-- Durcissement optionnel (décommenter après validation en prod) :
-- DROP POLICY IF EXISTS plannings_insert_all ON public.plannings;
-- DROP POLICY IF EXISTS plannings_update_all ON public.plannings;
