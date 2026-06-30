/** Détection d'une RPC Supabase absente (PostgREST schema cache). */
export const isPlanningUpsertRpcMissingError = (error) => {
  const message = String(error?.message || error?.code || '').toLowerCase();
  return (
    message.includes('could not find the function') ||
    message.includes('function public.upsert_planning_row') ||
    message.includes('schema cache') ||
    error?.code === 'PGRST202'
  );
};

let planningUpsertRpcAvailable = null;

export const resetPlanningUpsertRpcAvailability = () => {
  planningUpsertRpcAvailable = null;
};

/**
 * Upsert une ligne plannings — RPC SECURITY DEFINER avec repli upsert direct.
 * @param {import('@supabase/supabase-js').SupabaseClient|null} client
 */
export const upsertPlanningRow = async (client, row) => {
  if (!client) {
    return { ok: false, error: new Error('Supabase client unavailable') };
  }

  const payload = {
    shop_id: row.shop_id,
    week_key: row.week_key,
    data: row.data,
    version: row.version ?? 1,
    updated_at: row.updated_at || new Date().toISOString()
  };

  if (planningUpsertRpcAvailable !== false) {
    try {
      const { data, error } = await client.rpc('upsert_planning_row', {
        p_shop_id: payload.shop_id,
        p_week_key: payload.week_key,
        p_data: payload.data,
        p_version: payload.version
      });
      if (!error) {
        planningUpsertRpcAvailable = true;
        return { ok: data !== false, error: null, viaRpc: true };
      }
      if (isPlanningUpsertRpcMissingError(error)) {
        planningUpsertRpcAvailable = false;
      } else {
        return { ok: false, error, viaRpc: true };
      }
    } catch (error) {
      if (!isPlanningUpsertRpcMissingError(error)) {
        return { ok: false, error, viaRpc: true };
      }
      planningUpsertRpcAvailable = false;
    }
  }

  const { error } = await client
    .from('plannings')
    .upsert(payload, { onConflict: 'shop_id,week_key' });

  return { ok: !error, error: error || null, viaRpc: false };
};
