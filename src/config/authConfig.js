/**
 * Configuration auth — mode actuel : codes secrets locaux.
 * Migration : VITE_AUTH_MODE=supabase + OAuth Google (Supabase Auth).
 */
export const getAuthMode = () =>
  String(import.meta.env.VITE_AUTH_MODE || 'secret_codes').trim();

/** @deprecated Préférer getAuthMode() — conservé pour compatibilité. */
export const AUTH_MODE = getAuthMode();

export const isSupabaseAuthMode = () => getAuthMode() === 'supabase';

export const isSecretCodesAuthMode = () => !isSupabaseAuthMode();

export const getOAuthProviders = () =>
  String(import.meta.env.VITE_SUPABASE_OAUTH_PROVIDERS || 'google')
    .split(',')
    .map((provider) => provider.trim().toLowerCase())
    .filter(Boolean);

export const isGoogleOAuthEnabled = () =>
  isSupabaseAuthMode() && getOAuthProviders().includes('google');
