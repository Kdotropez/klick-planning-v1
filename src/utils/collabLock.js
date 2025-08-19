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
      console.log('🔒 Initialisation du service de verrouillage Supabase...');
      const { createClient } = await import('@supabase/supabase-js');
      supabase = createClient(config.url, config.key);
      useSupabase = true;
      console.log('✅ Service de verrouillage Supabase initialisé');
    } else {
      console.log('⚠️ Pas de configuration Supabase, utilisation du localStorage');
      useSupabase = false;
    }
  } catch (error) {
    console.error('❌ Erreur initialisation service verrouillage:', error);
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
  console.log('🔍 getLock appelé:', { shopId, weekKey, useSupabase });
  
  if (useSupabase) {
    try {
      const { data, error } = await supabase
        .from('planning_locks')
        .select('*')
        .eq('shop_id', shopId)
        .eq('week_key', weekKey)
        .maybeSingle();
      
      if (error) {
        console.error('❌ Erreur getLock Supabase:', error);
        return null;
      }
      
      console.log('🔍 getLock résultat Supabase:', data);
      return data || null;
    } catch (error) {
      console.error('❌ Exception getLock Supabase:', error);
      return null;
    }
  }
  
  try {
    const raw = localStorage.getItem(localKey(shopId, weekKey));
    const result = raw ? JSON.parse(raw) : null;
    console.log('🔍 getLock résultat localStorage:', result);
    return result;
  } catch (error) {
    console.error('❌ Erreur getLock localStorage:', error);
    return null;
  }
};

export const acquireLock = async (shopId, weekKey, userId, ttlMs = 5 * 60 * 1000) => {
  console.log('🔒 acquireLock appelé:', { shopId, weekKey, userId, useSupabase });
  
  const existing = await getLock(shopId, weekKey);
  console.log('🔒 Verrou existant:', existing);
  
  if (existing && !isExpired(existing.updated_at || existing.created_at, ttlMs) && existing.user_id !== userId) {
    console.log('❌ Verrou déjà détenu par:', existing.user_id);
    return { ok: false, lock: existing };
  }
  
  const lock = { shop_id: shopId, week_key: weekKey, user_id: userId, created_at: nowIso(), updated_at: nowIso() };
  console.log('🔒 Nouveau verrou à créer:', lock);
  
  if (useSupabase) {
    try {
      const { error } = await supabase.from('planning_locks').upsert(lock, { onConflict: 'shop_id,week_key' });
      if (error) {
        console.error('❌ Erreur acquireLock Supabase:', error);
        return { ok: false, lock: null };
      }
      console.log('✅ Verrou acquis avec Supabase');
    } catch (error) {
      console.error('❌ Exception acquireLock Supabase:', error);
      return { ok: false, lock: null };
    }
  } else {
    localStorage.setItem(localKey(shopId, weekKey), JSON.stringify(lock));
    console.log('✅ Verrou acquis avec localStorage');
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


