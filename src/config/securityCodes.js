/**
 * Codes de sécurité côté client (fallback).
 * En production, préférer VITE_SUPERVISOR_OVERRIDE_CODE dans les variables Vercel.
 * Note : un secret 100 % sûr nécessite une Edge Function / RPC Supabase (voir emergency_unlock_global_lock).
 */
export const getSupervisorOverrideCode = () =>
  String(import.meta.env.VITE_SUPERVISOR_OVERRIDE_CODE || '2111').trim();

export const isSupervisorOverrideCode = (code) =>
  String(code ?? '').trim() === getSupervisorOverrideCode();
