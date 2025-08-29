// src/utils/lockService.js
import { supabase } from './supabaseClient';

export async function acquireLock(resourceId, holder, ttlSeconds = 30) {
  console.log('🔒 acquireLock appelé avec:', { resourceId, holder, ttlSeconds });
  const { data, error } = await supabase.rpc('acquire_planning_lock', {
    p_resource_id: resourceId,
    p_holder: holder,
    p_ttl_seconds: ttlSeconds,
  });
  if (error) {
    console.error('❌ acquireLock erreur Supabase:', error);
    throw error;
  }
  console.log('🔒 acquireLock réponse Supabase:', data);
  return data; // Retourne directement l'objet JSON
}

export async function renewLock(resourceId, holder, leaseToken, ttlSeconds = 30) {
  console.log('🔄 renewLock appelé avec:', { resourceId, holder, leaseToken: leaseToken?.substring(0, 8) + '...', ttlSeconds });
  const { data, error } = await supabase.rpc('renew_planning_lock', {
    p_resource_id: resourceId,
    p_holder: holder,
    p_lease_token: leaseToken,
    p_ttl_seconds: ttlSeconds,
  });
  if (error) {
    console.error('❌ renewLock erreur Supabase:', error);
    throw error;
  }
  console.log('🔄 renewLock réponse Supabase:', data);
  return data === true;
}

export async function releaseLock(resourceId, holder, leaseToken) {
  console.log('🔓 releaseLock appelé avec:', { resourceId, holder, leaseToken: leaseToken?.substring(0, 8) + '...' });
  const { data, error } = await supabase.rpc('release_planning_lock', {
    p_resource_id: resourceId,
    p_holder: holder,
    p_lease_token: leaseToken,
  });
  if (error) {
    console.error('❌ releaseLock erreur Supabase:', error);
    throw error;
  }
  console.log('🔓 releaseLock réponse Supabase:', data);
  return data === true;
}

export async function emergencyTakeover(resourceId, newHolder, pin, ttlSeconds = 30) {
  console.log('🚨 emergencyTakeover appelé avec:', { resourceId, newHolder, pin, ttlSeconds });
  const { data, error } = await supabase.rpc('emergency_takeover_planning_lock', {
    p_resource_id: resourceId,
    p_new_holder: newHolder,
    p_pin: pin,
    p_ttl_seconds: ttlSeconds,
  });
  if (error) {
    console.error('❌ emergencyTakeover erreur Supabase:', error);
    throw error;
  }
  console.log('🚨 emergencyTakeover réponse Supabase:', data);
  return data; // Retourne directement l'objet JSON
}

export function subscribeLock(resourceId, onChange) {
  console.log('👀 subscribeLock appelé pour:', resourceId);
  const channel = supabase
    .channel(`lock:${resourceId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'planning_lock',
      filter: `resource_id=eq.${resourceId}`,
    }, (payload) => {
      console.log('🔔 Changement détecté sur le verrou:', payload);
      onChange?.(payload);
    })
    .subscribe();
  return () => { 
    console.log('👀 Désabonnement du verrou pour:', resourceId);
    supabase.removeChannel(channel); 
  };
}
