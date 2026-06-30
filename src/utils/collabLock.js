import { createClient } from '@supabase/supabase-js';

// API:
// - initLockService({ url, key })
// - acquireLock(userId) - Verrou global unique
// - releaseLock(userId) - Libération du verrou global
// - getLock() - Récupération du verrou global
// - heartbeat(userId) - Maintien du verrou global
// - forceRelease(userId) - Force libération du verrou global avec notification
// - checkForceReleaseRequest() - Vérifier les demandes de force libération
// - emergencyUnlock(userId, securityCode) - Déverrouillage d'urgence

let supabase = null;
let useSupabase = false;
let rpcAvailable = null; // null = inconnu, true/false après premier appel

export const initLockService = ({ url, key }) => {
  if (url && key) {
    useSupabase = true;
    supabase = createClient(url, key);
    rpcAvailable = null;
  } else {
    useSupabase = false;
    supabase = null;
    rpcAvailable = false;
  }
};

const globalLockKey = 'global_lock';
const forceReleaseKey = 'global_force_release';

const nowIso = () => new Date().toISOString();

const toTtlSeconds = (ttlMs) => Math.max(1, Math.ceil(Number(ttlMs || 0) / 1000));

const rowToLock = (row) => {
  if (!row) return null;
  return {
    shop_id: row.shop_id || 'GLOBAL',
    week_key: row.week_key || 'GLOBAL',
    user_id: row.user_id,
    updated_at: row.updated_at,
    created_at: row.created_at
  };
};

const isRpcMissingError = (error) => {
  const message = String(error?.message || error?.code || '').toLowerCase();
  return (
    message.includes('could not find the function') ||
    message.includes('function public.acquire_global_lock') ||
    message.includes('schema cache') ||
    error?.code === 'PGRST202'
  );
};

const acquireLockViaRpc = async (userId, ttlMs) => {
  const { data, error } = await supabase.rpc('acquire_global_lock', {
    p_user_id: userId,
    p_ttl_seconds: toTtlSeconds(ttlMs)
  });
  if (error) return { error };
  const row = Array.isArray(data) ? data[0] : data;
  return {
    ok: !!row?.acquired,
    lock: rowToLock(row)
  };
};

const renewLockViaRpc = async (userId, ttlMs) => {
  const { data, error } = await supabase.rpc('renew_global_lock', {
    p_user_id: userId,
    p_ttl_seconds: toTtlSeconds(ttlMs)
  });
  if (error) return { error, ok: false };
  return { ok: !!data };
};

const releaseLockViaRpc = async (userId) => {
  const { data, error } = await supabase.rpc('release_global_lock', {
    p_user_id: userId
  });
  if (error) return { error, ok: false };
  return { ok: !!data };
};

export const getLock = async () => {
  if (useSupabase) {
    try {
      const { data, error } = await supabase
        .from('planning_locks')
        .select('*')
        .eq('shop_id', 'GLOBAL')
        .eq('week_key', 'GLOBAL')
        .maybeSingle();

      if (error) {
        console.error('❌ Erreur getLock Supabase:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('❌ Exception getLock Supabase:', error);
      return null;
    }
  }

  try {
    const raw = localStorage.getItem(globalLockKey);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.error('❌ Erreur getLock localStorage:', error);
    return null;
  }
};

const acquireLockLegacy = async (userId, ttlMs = 2 * 60 * 1000) => {
  const existing = await getLock();

  if (existing) {
    const now = new Date();
    const lockTime = new Date(existing.updated_at || existing.created_at);
    const age = now - lockTime;

    if (existing.user_id === userId) {
      if (useSupabase) {
        const { data, error } = await supabase
          .from('planning_locks')
          .update({ updated_at: nowIso() })
          .eq('shop_id', 'GLOBAL')
          .eq('week_key', 'GLOBAL')
          .eq('user_id', userId)
          .select()
          .single();

        if (error) return { ok: false, lock: existing };
        return { ok: true, lock: data };
      }

      existing.updated_at = nowIso();
      localStorage.setItem(globalLockKey, JSON.stringify(existing));
      return { ok: true, lock: existing };
    }

    if (age < ttlMs) {
      return { ok: false, lock: existing };
    }

    await cleanupExpiredLocks(ttlMs);
  }

  const lock = {
    shop_id: 'GLOBAL',
    week_key: 'GLOBAL',
    user_id: userId,
    created_at: nowIso(),
    updated_at: nowIso()
  };

  if (useSupabase) {
    const { data, error } = await supabase
      .from('planning_locks')
      .upsert(lock, { onConflict: 'shop_id,week_key', ignoreDuplicates: false })
      .select()
      .single();

    if (error) return { ok: false, lock: null };
    return { ok: true, lock: data };
  }

  localStorage.setItem(globalLockKey, JSON.stringify(lock));
  return { ok: true, lock };
};

export const acquireLock = async (userId, ttlMs = 2 * 60 * 1000) => {
  if (useSupabase && rpcAvailable !== false) {
    try {
      const rpcResult = await acquireLockViaRpc(userId, ttlMs);
      if (rpcResult.error) {
        if (isRpcMissingError(rpcResult.error)) {
          rpcAvailable = false;
          console.warn('⚠️ RPC acquire_global_lock indisponible, fallback legacy.');
        } else {
          console.error('❌ Erreur acquire_global_lock RPC:', rpcResult.error);
          return { ok: false, lock: null };
        }
      } else {
        rpcAvailable = true;
        return { ok: rpcResult.ok, lock: rpcResult.lock };
      }
    } catch (error) {
      if (isRpcMissingError(error)) {
        rpcAvailable = false;
        console.warn('⚠️ RPC acquire_global_lock indisponible, fallback legacy.');
      } else {
        console.error('❌ Exception acquire_global_lock RPC:', error);
        return { ok: false, lock: null };
      }
    }
  }

  return acquireLockLegacy(userId, ttlMs);
};

export const releaseLock = async (userId) => {
  if (useSupabase && rpcAvailable !== false) {
    try {
      const rpcResult = await releaseLockViaRpc(userId);
      if (rpcResult.error) {
        if (isRpcMissingError(rpcResult.error)) {
          rpcAvailable = false;
        } else {
          console.error('❌ Erreur release_global_lock RPC:', rpcResult.error);
          return { ok: false };
        }
      } else {
        rpcAvailable = true;
        return { ok: rpcResult.ok || true };
      }
    } catch (error) {
      if (!isRpcMissingError(error)) {
        console.error('❌ Exception release_global_lock RPC:', error);
        return { ok: false };
      }
      rpcAvailable = false;
    }
  }

  const existing = await getLock();
  if (existing && existing.user_id !== userId) {
    return { ok: false };
  }

  if (useSupabase) {
    const { error } = await supabase
      .from('planning_locks')
      .delete()
      .eq('shop_id', 'GLOBAL')
      .eq('week_key', 'GLOBAL');

    if (error) {
      console.error('❌ Erreur releaseLock Supabase:', error);
      return { ok: false };
    }
  } else {
    localStorage.removeItem(globalLockKey);
  }

  return { ok: true };
};

export const heartbeat = async (userId, ttlMs = 2 * 60 * 1000) => {
  if (useSupabase && rpcAvailable !== false) {
    try {
      const rpcResult = await renewLockViaRpc(userId, ttlMs);
      if (rpcResult.error) {
        if (isRpcMissingError(rpcResult.error)) {
          rpcAvailable = false;
        } else {
          console.error('❌ Erreur renew_global_lock RPC:', rpcResult.error);
          return { ok: false };
        }
      } else {
        rpcAvailable = true;
        return { ok: rpcResult.ok };
      }
    } catch (error) {
      if (!isRpcMissingError(error)) {
        console.error('❌ Exception renew_global_lock RPC:', error);
        return { ok: false };
      }
      rpcAvailable = false;
    }
  }

  const existing = await getLock();
  if (!existing || existing.user_id !== userId) return { ok: false };

  existing.updated_at = nowIso();

  if (useSupabase) {
    const { error } = await supabase
      .from('planning_locks')
      .update({ updated_at: existing.updated_at })
      .eq('shop_id', 'GLOBAL')
      .eq('week_key', 'GLOBAL')
      .eq('user_id', userId);

    if (error) {
      console.error('❌ Erreur heartbeat Supabase:', error);
      return { ok: false };
    }
  } else {
    localStorage.setItem(globalLockKey, JSON.stringify(existing));
  }

  return { ok: true };
};

export const forceRelease = async (userId) => {
  if (useSupabase) {
    try {
      const { error: notifyError } = await supabase
        .from('planning_locks')
        .upsert({
          shop_id: 'GLOBAL',
          week_key: 'GLOBAL',
          user_id: userId,
          force_release_request: nowIso(),
          created_at: nowIso(),
          updated_at: nowIso()
        }, { onConflict: 'shop_id,week_key' });

      if (notifyError) {
        console.error('❌ Erreur notification force release Supabase:', notifyError);
      }

      return { ok: true };
    } catch (error) {
      console.error('❌ Exception forceRelease Supabase:', error);
      return { ok: false };
    }
  }

  localStorage.setItem(forceReleaseKey, nowIso());
  return { ok: true };
};

export const emergencyUnlock = async (userId, securityCode) => {
  const adminOverrideCode = '2111';

  if (securityCode !== adminOverrideCode) {
    return { ok: false, error: 'Code admin incorrect' };
  }

  if (useSupabase) {
    try {
      const { error } = await supabase
        .from('planning_locks')
        .delete()
        .eq('shop_id', 'GLOBAL')
        .eq('week_key', 'GLOBAL');

      if (error) {
        console.error('❌ Erreur emergencyUnlock Supabase:', error);
        return { ok: false, error: 'Erreur lors du déverrouillage' };
      }

      return { ok: true };
    } catch (error) {
      console.error('❌ Exception emergencyUnlock Supabase:', error);
      return { ok: false, error: 'Exception lors du déverrouillage' };
    }
  }

  localStorage.removeItem(globalLockKey);
  localStorage.removeItem(forceReleaseKey);
  return { ok: true };
};

export const getCurrentSecurityCode = () => {
  const now = new Date();
  const day = now.getDate().toString().padStart(2, '0');
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  return day + month;
};

export const checkForceReleaseRequest = async (userId) => {
  if (useSupabase) {
    try {
      const { data, error } = await supabase
        .from('planning_locks')
        .select('force_release_request')
        .eq('shop_id', 'GLOBAL')
        .eq('week_key', 'GLOBAL')
        .not('force_release_request', 'is', null)
        .maybeSingle();

      if (error) {
        console.error('❌ Erreur checkForceReleaseRequest Supabase:', error);
        return null;
      }

      if (data && data.force_release_request) {
        await supabase
          .from('planning_locks')
          .update({ force_release_request: null })
          .eq('shop_id', 'GLOBAL')
          .eq('week_key', 'GLOBAL');

        return data.force_release_request;
      }

      return null;
    } catch (error) {
      console.error('❌ Exception checkForceReleaseRequest Supabase:', error);
      return null;
    }
  }

  const requestTime = localStorage.getItem(forceReleaseKey);
  if (requestTime) {
    localStorage.removeItem(forceReleaseKey);
    return requestTime;
  }
  return null;
};

export const cleanupExpiredLocks = async (ttlMs = 2 * 60 * 1000) => {
  if (useSupabase) {
    try {
      const cutoff = new Date(Date.now() - ttlMs).toISOString();
      const { error } = await supabase
        .from('planning_locks')
        .delete()
        .eq('shop_id', 'GLOBAL')
        .eq('week_key', 'GLOBAL')
        .lt('updated_at', cutoff);

      if (error) {
        console.error('❌ Erreur cleanupExpiredLocks Supabase:', error);
      }
    } catch (error) {
      console.error('❌ Exception cleanupExpiredLocks Supabase:', error);
    }
    return;
  }

  try {
    const keys = Object.keys(localStorage).filter((key) => key.startsWith('lock_') || key === globalLockKey);
    for (const key of keys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const lock = JSON.parse(raw);
        const age = Date.now() - new Date(lock.updated_at).getTime();
        if (age >= ttlMs) localStorage.removeItem(key);
      } catch {
        localStorage.removeItem(key);
      }
    }
  } catch (error) {
    console.error('❌ Erreur cleanupExpiredLocks localStorage:', error);
  }
};
