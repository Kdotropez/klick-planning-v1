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

export const initLockService = ({ url, key }) => {
  console.log('🔧 initLockService appelé:', { url, key });
  if (url && key) {
    useSupabase = true;
    // Initialisation du client Supabase
    supabase = createClient(url, key);
    console.log('✅ Client Supabase initialisé');
  } else {
    useSupabase = false;
    supabase = null;
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
    const lockTime = new Date(existing.updated_at || existing.created_at);
    const age = now - lockTime;
    
    // Si le verrou appartient déjà à cet utilisateur, le renouveler
    if (existing.user_id === userId) {
      console.log('🔄 Renouvellement du verrou existant pour le même utilisateur');
      if (useSupabase) {
        try {
          const { data, error } = await supabase
            .from('planning_locks')
            .update({ updated_at: nowIso() })
            .eq('shop_id', 'GLOBAL')
            .eq('week_key', 'GLOBAL')
            .eq('user_id', userId)
            .select()
            .single();
          
          if (error) {
            console.error('❌ Erreur renouvellement verrou Supabase:', error);
            return { ok: false, lock: existing };
          }
          console.log('✅ Verrou renouvelé avec Supabase');
          return { ok: true, lock: data };
        } catch (error) {
          console.error('❌ Exception renouvellement verrou Supabase:', error);
          return { ok: false, lock: existing };
        }
      } else {
        existing.updated_at = nowIso();
        localStorage.setItem(globalLockKey, JSON.stringify(existing));
        console.log('✅ Verrou renouvelé avec localStorage');
        return { ok: true, lock: existing };
      }
    }
    
    // Si le verrou est actif et appartient à un autre utilisateur
    if (age < ttlMs) {
      console.log('❌ Verrou actif détenu par un autre utilisateur:', existing.user_id);
      return { ok: false, lock: existing };
    }
    
    // Si le verrou est expiré, le nettoyer avant d'en créer un nouveau
    if (age >= ttlMs) {
      console.log('🔓 Verrou expiré, nettoyage avant acquisition...');
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
      // Utiliser upsert pour éviter les conflits de clé unique
      const { data, error } = await supabase
        .from('planning_locks')
        .upsert(lock, { 
          onConflict: 'shop_id,week_key',
          ignoreDuplicates: false 
        })
        .select()
        .single();
      
      if (error) {
        console.error('❌ Erreur acquireLock Supabase:', error);
        return { ok: false, lock: null };
      }
      console.log('✅ Verrou global acquis avec Supabase:', data);
      return { ok: true, lock: data };
    } catch (error) {
      console.error('❌ Exception acquireLock Supabase:', error);
      return { ok: false, lock: null };
    }
  } else {
    localStorage.setItem(globalLockKey, JSON.stringify(lock));
    console.log('✅ Verrou global acquis avec localStorage');
    return { ok: true, lock };
  }
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

// Fonction de déverrouillage d'urgence avec code de sécurité
export const emergencyUnlock = async (userId, securityCode) => {
  console.log('🚨 emergencyUnlock appelé (verrou global):', { userId, hasSecurityCode: Boolean(securityCode), useSupabase });
  
  const adminOverrideCode = '2111';
  
  console.log('🔐 Vérification du code override admin');
  
  if (securityCode !== adminOverrideCode) {
    console.log('❌ Code de sécurité incorrect');
    return { ok: false, error: 'Code admin incorrect' };
  }
  
  console.log('✅ Code de sécurité valide, déverrouillage d\'urgence...');
  
  if (useSupabase) {
    try {
      // Supprimer directement le verrou sans notification
      const { error } = await supabase
        .from('planning_locks')
        .delete()
        .eq('shop_id', 'GLOBAL')
        .eq('week_key', 'GLOBAL');
      
      if (error) {
        console.error('❌ Erreur emergencyUnlock Supabase:', error);
        return { ok: false, error: 'Erreur lors du déverrouillage' };
      }
      
      console.log('✅ Déverrouillage d\'urgence réussi avec Supabase');

      // Important: ne pas recréer un verrou spécial ici.
      // Le prochain login (normal) reprendra le verrou proprement via acquireLock().
      return { ok: true };
      
    } catch (error) {
      console.error('❌ Exception emergencyUnlock Supabase:', error);
      return { ok: false, error: 'Exception lors du déverrouillage' };
    }
  } else {
    // Fallback localStorage
    localStorage.removeItem(globalLockKey);
    localStorage.removeItem(forceReleaseKey);

    console.log('✅ Déverrouillage d\'urgence réussi avec localStorage');
    return { ok: true };
  }
};

// Fonction pour obtenir le code de sécurité actuel (pour affichage)
export const getCurrentSecurityCode = () => {
  const now = new Date();
  const day = now.getDate().toString().padStart(2, '0');
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  return day + month;
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




