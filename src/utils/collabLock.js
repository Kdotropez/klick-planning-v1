// API:
// - initLockService({ url, key })
// - acquireLock(userId) - Verrou global unique
// - releaseLock(userId) - Libération du verrou global
// - getLock() - Récupération du verrou global
// - heartbeat(userId) - Maintien du verrou global
// - forceRelease(userId) - Force libération du verrou global avec notification
// - checkForceReleaseRequest() - Vérifier les demandes de force libération

let supabase = null;
let useSupabase = false;

export const initLockService = ({ url, key }) => {
  console.log('🔧 initLockService appelé:', { url, key });
  if (url && key) {
    useSupabase = true;
    // Initialisation Supabase si nécessaire
  } else {
    useSupabase = false;
  }
};

const globalLockKey = 'global_lock';
const forceReleaseKey = 'global_force_release';

const nowIso = () => new Date().toISOString();

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
      return data;
    } catch (error) {
      console.error('❌ Exception getLock Supabase:', error);
      return null;
    }
  } else {
    try {
      const raw = localStorage.getItem(globalLockKey);
      const result = raw ? JSON.parse(raw) : null;
      console.log('🔍 getLock résultat localStorage:', result);
      return result;
    } catch (error) {
      console.error('❌ Erreur getLock localStorage:', error);
      return null;
    }
  }
};

export const acquireLock = async (userId, ttlMs = 2 * 60 * 1000) => {
  console.log('🔒 acquireLock appelé (verrou global):', { userId, useSupabase });
  
  const existing = await getLock();
  console.log('🔒 Verrou existant:', existing);
  
  if (existing) {
    const now = new Date();
    const lockTime = new Date(existing.updated_at);
    const age = now - lockTime;
    
    if (age < ttlMs && existing.user_id !== userId) {
      console.log('❌ Verrou actif détenu par un autre utilisateur');
      return { ok: false, lock: existing };
    }
    
    if (age >= ttlMs) {
      console.log('🔓 Verrou expiré, nettoyage...');
      await cleanupExpiredLocks(ttlMs);
    }
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
      // Supprimer les anciens verrous
      const { error: deleteError } = await supabase
        .from('planning_locks')
        .delete()
        .eq('shop_id', 'GLOBAL')
        .eq('week_key', 'GLOBAL');
      
      // Insérer le nouveau verrou
      const { data, error } = await supabase
        .from('planning_locks')
        .insert(lock)
        .select()
        .single();
      
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

// Fonction pour forcer la libération du verrou global avec notification
export const forceRelease = async (userId) => {
  console.log('🔓 forceRelease appelé (verrou global):', { userId, useSupabase });
  
  if (useSupabase) {
    try {
      // Créer une notification de force release
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
      
      console.log('✅ Notification de force release envoyée');
      return { ok: true };
    } catch (error) {
      console.error('❌ Exception forceRelease Supabase:', error);
      return { ok: false };
    }
  } else {
    // Fallback localStorage
    localStorage.setItem(forceReleaseKey, nowIso());
    console.log('✅ Notification de force release envoyée avec localStorage');
    return { ok: true };
  }
};

// Fonction pour vérifier les demandes de force release
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
        console.log('🔓 Demande de force release détectée:', data.force_release_request);
        
        // Supprimer la notification après l'avoir lue
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
  } else {
    // Fallback localStorage
    const requestTime = localStorage.getItem(forceReleaseKey);
    if (requestTime) {
      localStorage.removeItem(forceReleaseKey);
      return requestTime;
    }
    return null;
  }
};

// Fonction pour nettoyer les verrous expirés
export const cleanupExpiredLocks = async (ttlMs = 2 * 60 * 1000) => {
  console.log('🧹 cleanupExpiredLocks appelé (verrou global)');
  
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
      } else {
        console.log('✅ Nettoyage des verrous expirés Supabase terminé');
      }
    } catch (error) {
      console.error('❌ Exception cleanupExpiredLocks Supabase:', error);
    }
  } else {
    try {
      let cleanedCount = 0;
      const keys = Object.keys(localStorage);
      const lockKeys = keys.filter(key => key.startsWith('lock_') || key === globalLockKey);
      
      for (const key of lockKeys) {
        const raw = localStorage.getItem(key);
        if (raw) {
          try {
            const lock = JSON.parse(raw);
            const lockTime = new Date(lock.updated_at);
            const age = Date.now() - lockTime.getTime();
            
            if (age >= ttlMs) {
              localStorage.removeItem(key);
              cleanedCount++;
            }
          } catch (e) {
            localStorage.removeItem(key);
            cleanedCount++;
          }
        }
      }
      
      if (cleanedCount > 0) {
        console.log(`✅ Nettoyage localStorage: ${cleanedCount} verrous expirés supprimés`);
      }
    } catch (error) {
      console.error('❌ Erreur cleanupExpiredLocks localStorage:', error);
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


