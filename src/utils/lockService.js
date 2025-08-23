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
  const { data, error } = await supabase.rpc('emergency_takeover_planning_lock', {
    p_resource_id: resourceId,
    p_new_holder: newHolder,
    p_pin: pin,
    p_ttl_seconds: ttlSeconds,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row; // { acquired, resource_id, holder, lease_token, expires_at }
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
