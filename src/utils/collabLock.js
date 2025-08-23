// Simple collaborative lock service with optional Supabase backend
// API:
// - initLockService({ url, key })
// - acquireLock(userId) - Verrou global unique
// - releaseLock(userId) - Libération du verrou global
// - getLock() - Récupération du verrou global
// - heartbeat(userId) - Maintien du verrou global
// - forceRelease(userId) - Force libération du verrou global

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

const globalLockKey = 'global_lock';
const forceReleaseKey = 'global_force_release';

const nowIso = () => new Date().toISOString();

const isExpired = (iso, ttlMs) => {
  try {
    return Date.now() - new Date(iso).getTime() > ttlMs;
  } catch (_) {
    return true;
  }
};

export const getLock = async () => {
  console.log('🔍 getLock appelé (verrou global)');
  
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
      
      console.log('🔍 getLock résultat Supabase:', data);
      return data || null;
    } catch (error) {
      console.error('❌ Exception getLock Supabase:', error);
      return null;
    }
  }
  
  try {
    const raw = localStorage.getItem(globalLockKey);
    const result = raw ? JSON.parse(raw) : null;
    console.log('🔍 getLock résultat localStorage:', result);
    return result;
  } catch (error) {
    console.error('❌ Erreur getLock localStorage:', error);
    return null;
  }
};

export const acquireLock = async (userId, ttlMs = 2 * 60 * 1000) => {
  console.log('🔒 acquireLock appelé (verrou global):', { userId, useSupabase });
  
  const existing = await getLock();
  console.log('🔒 Verrou existant:', existing);
  
  if (existing && !isExpired(existing.updated_at || existing.created_at, ttlMs) && existing.user_id !== userId) {
    console.log('❌ Verrou déjà détenu par:', existing.user_id);
    return { ok: false, lock: existing };
  }
  
  const lock = { 
    shop_id: 'GLOBAL', 
    week_key: 'GLOBAL', 
    user_id: userId, 
    created_at: nowIso(), 
    updated_at: nowIso() 
  };
  console.log('🔒 Nouveau verrou global à créer:', lock);
  
  if (useSupabase) {
    try {
      // Supprimer d'abord l'ancien verrou s'il existe
      await supabase
        .from('planning_locks')
        .delete()
        .eq('shop_id', 'GLOBAL')
        .eq('week_key', 'GLOBAL');
      
      // Insérer le nouveau verrou
      const { error } = await supabase.from('planning_locks').insert(lock);
      if (error) {
        console.error('❌ Erreur acquireLock Supabase:', error);
        return { ok: false, lock: null };
      }
      console.log('✅ Verrou global acquis avec Supabase');
    } catch (error) {
      console.error('❌ Exception acquireLock Supabase:', error);
      return { ok: false, lock: null };
    }
  } else {
    localStorage.setItem(globalLockKey, JSON.stringify(lock));
    console.log('✅ Verrou global acquis avec localStorage');
  }
  
  return { ok: true, lock };
};

export const releaseLock = async (userId) => {
  console.log('🔓 releaseLock appelé (verrou global):', { userId, useSupabase });
  
  const existing = await getLock();
  if (existing && existing.user_id !== userId) {
    console.log('❌ Tentative de libération par un utilisateur non autorisé:', userId);
    return { ok: false };
  }
  
  if (useSupabase) {
    try {
      const { error } = await supabase
        .from('planning_locks')
        .delete()
        .eq('shop_id', 'GLOBAL')
        .eq('week_key', 'GLOBAL');
      
      if (error) {
        console.error('❌ Erreur releaseLock Supabase:', error);
        return { ok: false };
      }
      console.log('✅ Verrou global libéré avec Supabase');
    } catch (error) {
      console.error('❌ Exception releaseLock Supabase:', error);
      return { ok: false };
    }
  } else {
    localStorage.removeItem(globalLockKey);
    console.log('✅ Verrou global libéré avec localStorage');
  }
  
  return { ok: true };
};

export const heartbeat = async (userId) => {
  const existing = await getLock();
  if (!existing || existing.user_id !== userId) return { ok: false };
  
  existing.updated_at = nowIso();
  
  if (useSupabase) {
    try {
      const { error } = await supabase
        .from('planning_locks')
        .update({ updated_at: existing.updated_at })
        .eq('shop_id', 'GLOBAL')
        .eq('week_key', 'GLOBAL');
      
      if (error) {
        console.error('❌ Erreur heartbeat Supabase:', error);
        return { ok: false };
      }
    } catch (error) {
      console.error('❌ Exception heartbeat Supabase:', error);
      return { ok: false };
    }
  } else {
    localStorage.setItem(globalLockKey, JSON.stringify(existing));
  }
  
  return { ok: true };
};

// Fonction pour forcer la libération du verrou global
export const forceRelease = async (userId) => {
  console.log('🔓 forceRelease appelé (verrou global):', { userId, useSupabase });
  
  if (useSupabase) {
    try {
      // Attendre 5 secondes pour laisser le temps à l'utilisateur de sauvegarder
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Supprimer le verrou
      const { error } = await supabase
        .from('planning_locks')
        .delete()
        .eq('shop_id', 'GLOBAL')
        .eq('week_key', 'GLOBAL');
      
      if (error) {
        console.error('❌ Erreur forceRelease Supabase:', error);
        return { ok: false };
      }
      
      console.log('✅ Force release global réussi avec Supabase');
      return { ok: true };
    } catch (error) {
      console.error('❌ Exception forceRelease Supabase:', error);
      return { ok: false };
    }
  } else {
    // Fallback localStorage
    localStorage.removeItem(globalLockKey);
    localStorage.setItem(forceReleaseKey, nowIso());
    console.log('✅ Force release global réussi avec localStorage');
    return { ok: true };
  }
};

// Fonction pour nettoyer les verrous expirés
export const cleanupExpiredLocks = async (ttlMs = 2 * 60 * 1000) => {
  console.log('🧹 cleanupExpiredLocks appelé (verrou global)');
  
  if (useSupabase) {
    try {
      const cutoffTime = new Date(Date.now() - ttlMs).toISOString();
      
      const { data, error } = await supabase
        .from('planning_locks')
        .delete()
        .lt('updated_at', cutoffTime);
      
      if (error) {
        console.error('❌ Erreur cleanupExpiredLocks Supabase:', error);
        return { ok: false, count: 0 };
      }
      
      console.log('✅ Verrous expirés nettoyés avec Supabase');
      return { ok: true, count: data?.length || 0 };
    } catch (error) {
      console.error('❌ Exception cleanupExpiredLocks Supabase:', error);
      return { ok: false, count: 0 };
    }
  } else {
    // Fallback localStorage - nettoyer les clés expirées
    try {
      let cleanedCount = 0;
      const keys = Object.keys(localStorage);
      const lockKeys = keys.filter(key => key.startsWith('lock_') || key === globalLockKey);
      
      for (const key of lockKeys) {
        try {
          const lockData = JSON.parse(localStorage.getItem(key));
          if (lockData && isExpired(lockData.updated_at || lockData.created_at, ttlMs)) {
            localStorage.removeItem(key);
            cleanedCount++;
          }
        } catch (e) {
          // Ignorer les clés corrompues
          localStorage.removeItem(key);
          cleanedCount++;
        }
      }
      
      console.log('✅ Verrous expirés nettoyés avec localStorage:', cleanedCount);
      return { ok: true, count: cleanedCount };
    } catch (error) {
      console.error('❌ Exception cleanupExpiredLocks localStorage:', error);
      return { ok: false, count: 0 };
    }
  }
};

// Fonctions de compatibilité (pour éviter les erreurs)
export const requestMain = async (shopId, weekKey, userId) => {
  console.log('⚠️ requestMain non supporté avec verrou global');
  return { ok: false };
};

export const checkMainRequest = async (shopId, weekKey, userId) => {
  console.log('⚠️ checkMainRequest non supporté avec verrou global');
  return null;
};

export const checkForceReleaseRequest = async (shopId, weekKey, userId) => {
  console.log('⚠️ checkForceReleaseRequest non supporté avec verrou global');
  return null;
};


