/**
 * Configuration auth — mode actuel : codes secrets locaux.
 * Futur : VITE_AUTH_MODE=supabase + Supabase Auth (migration progressive).
 */
export const AUTH_MODE = String(import.meta.env.VITE_AUTH_MODE || 'secret_codes').trim();

export const isSupabaseAuthMode = () => AUTH_MODE === 'supabase';

export const isSecretCodesAuthMode = () => !isSupabaseAuthMode();
