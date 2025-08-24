// src/utils/lockService.js
import { supabase } from './supabaseClient';

export async function acquireLock(resourceId, holder, ttlSeconds = 30) {
  const { data, error } = await supabase.rpc('acquire_planning_lock', {
    p_resource_id: resourceId,
    p_holder: holder,
    p_ttl_seconds: ttlSeconds,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row; // { acquired, resource_id, holder, lease_token, expires_at }
}

export async function renewLock(resourceId, holder, leaseToken, ttlSeconds = 30) {
  const { data, error } = await supabase.rpc('renew_planning_lock', {
    p_resource_id: resourceId,
    p_holder: holder,
    p_lease_token: leaseToken,
    p_ttl_seconds: ttlSeconds,
  });
  if (error) throw error;
  return data === true;
}

export async function releaseLock(resourceId, holder, leaseToken) {
  const { data, error } = await supabase.rpc('release_planning_lock', {
    p_resource_id: resourceId,
    p_holder: holder,
    p_lease_token: leaseToken,
  });
  if (error) throw error;
  return data === true;
}

export async function emergencyTakeover(resourceId, newHolder, pin, ttlSeconds = 30) {
  try {
    const { data, error } = await supabase.rpc('emergency_takeover_planning_lock', {
      p_resource_id: resourceId,
      p_new_holder: newHolder,
      p_pin: pin,
      p_ttl_seconds: ttlSeconds,
    });
    if (error) {
      console.error('Emergency takeover error:', error);
      // Si l'erreur est liée à la fonction SQL, essayer une approche alternative
      if (error.message.includes('ambiguous') || error.message.includes('resource_id')) {
        console.log('Tentative de nettoyage manuel du verrou...');
        return await manualEmergencyCleanup(resourceId, newHolder, pin, ttlSeconds);
      }
      throw error;
    }
    const row = Array.isArray(data) ? data[0] : data;
    return row; // { acquired, resource_id, holder, lease_token, expires_at }
  } catch (error) {
    console.error('Emergency takeover failed:', error);
    // En cas d'échec, essayer le nettoyage manuel
    return await manualEmergencyCleanup(resourceId, newHolder, pin, ttlSeconds);
  }
}

// Fonction de nettoyage manuel en cas d'échec de la fonction SQL
async function manualEmergencyCleanup(resourceId, newHolder, pin, ttlSeconds = 30) {
  try {
    // Vérifier le code PIN
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const expectedPin = day + month;
    
    if (pin !== expectedPin) {
      console.log('Code PIN incorrect:', pin, 'attendu:', expectedPin);
      return { acquired: false, resource_id: resourceId, holder: null, lease_token: null, expires_at: null };
    }

    console.log('Code PIN correct, tentative de nettoyage...');

    // Au lieu d'écrire directement, on va essayer d'acquérir le verrou normalement
    // après avoir attendu un peu pour que les verrous expirés soient nettoyés
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Essayer d'acquérir le verrou normalement
    const result = await acquireLock(resourceId, newHolder, ttlSeconds);
    
    if (result && result.acquired) {
      console.log('Nettoyage manuel réussi via acquireLock');
      return result;
    } else {
      console.log('Acquisition normale échouée, tentative de force...');
      
      // Si ça ne marche pas, on va essayer de libérer le verrou avec un token factice
      try {
        await supabase.rpc('release_planning_lock', {
          p_resource_id: resourceId,
          p_holder: 'force_cleanup',
          p_lease_token: '00000000-0000-0000-0000-000000000000'
        });
      } catch (e) {
        console.log('Tentative de libération forcée ignorée:', e.message);
      }

      // Attendre un peu plus
      await new Promise(resolve => setTimeout(resolve, 500));

      // Réessayer l'acquisition
      const retryResult = await acquireLock(resourceId, newHolder, ttlSeconds);
      
      if (retryResult && retryResult.acquired) {
        console.log('Nettoyage manuel réussi après retry');
        return retryResult;
      } else {
        console.log('Échec du nettoyage manuel');
        return { acquired: false, resource_id: resourceId, holder: null, lease_token: null, expires_at: null };
      }
    }

  } catch (error) {
    console.error('Nettoyage manuel échoué:', error);
    throw error;
  }
}

export function subscribeLock(resourceId, onChange) {
  const channel = supabase
    .channel(`lock:${resourceId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'planning_lock',
      filter: `resource_id=eq.${resourceId}`,
    }, (payload) => {
      onChange?.(payload);
    })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
