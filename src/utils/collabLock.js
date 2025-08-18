// Simple collaborative lock service with optional Supabase backend
// API:
// - initLockService({ url, key })
// - acquireLock(shopId, weekKey, userId)
// - releaseLock(shopId, weekKey, userId)
// - getLock(shopId, weekKey)
// - heartbeat(shopId, weekKey, userId)

let supabase = null;
let useSupabase = false;

export const initLockService = async (config) => {
  try {
    if (config && config.url && config.key) {
      const { createClient } = await import('@supabase/supabase-js');
      supabase = createClient(config.url, config.key);
      useSupabase = true;
    } else {
      useSupabase = false;
    }
  } catch (_) {
    useSupabase = false;
  }
};

const localKey = (shopId, weekKey) => `lock_${shopId}_${weekKey}`;

const nowIso = () => new Date().toISOString();

const isExpired = (iso, ttlMs) => {
  try {
    return Date.now() - new Date(iso).getTime() > ttlMs;
  } catch (_) {
    return true;
  }
};

export const getLock = async (shopId, weekKey) => {
  if (useSupabase) {
    const { data } = await supabase
      .from('planning_locks')
      .select('*')
      .eq('shop_id', shopId)
      .eq('week_key', weekKey)
      .maybeSingle();
    return data || null;
  }
  try {
    const raw = localStorage.getItem(localKey(shopId, weekKey));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const acquireLock = async (shopId, weekKey, userId, ttlMs = 5 * 60 * 1000) => {
  const existing = await getLock(shopId, weekKey);
  if (existing && !isExpired(existing.updated_at || existing.created_at, ttlMs) && existing.user_id !== userId) {
    return { ok: false, lock: existing };
  }
  const lock = { shop_id: shopId, week_key: weekKey, user_id: userId, created_at: nowIso(), updated_at: nowIso() };
  if (useSupabase) {
    await supabase.from('planning_locks').upsert(lock, { onConflict: 'shop_id,week_key' });
  } else {
    localStorage.setItem(localKey(shopId, weekKey), JSON.stringify(lock));
  }
  return { ok: true, lock };
};

export const releaseLock = async (shopId, weekKey, userId) => {
  const existing = await getLock(shopId, weekKey);
  if (existing && existing.user_id !== userId) return { ok: false };
  if (useSupabase) {
    await supabase
      .from('planning_locks')
      .delete()
      .eq('shop_id', shopId)
      .eq('week_key', weekKey);
  } else {
    localStorage.removeItem(localKey(shopId, weekKey));
  }
  return { ok: true };
};

export const heartbeat = async (shopId, weekKey, userId) => {
  const existing = await getLock(shopId, weekKey);
  if (!existing || existing.user_id !== userId) return { ok: false };
  existing.updated_at = nowIso();
  if (useSupabase) {
    await supabase.from('planning_locks').upsert(existing, { onConflict: 'shop_id,week_key' });
  } else {
    localStorage.setItem(localKey(shopId, weekKey), JSON.stringify(existing));
  }
  return { ok: true };
};


