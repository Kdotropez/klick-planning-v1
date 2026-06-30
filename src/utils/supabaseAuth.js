import { supabase } from './supabaseClient';
import { getValidUserCodes } from '../config/userCodes';
import { isGoogleOAuthEnabled } from '../config/authConfig';

const normalizeToken = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

export const isSupabaseAuthReady = () => !!supabase;

/**
 * Convertit un utilisateur Supabase Auth en objet session Klick-Planning.
 * @param {import('@supabase/supabase-js').User} supabaseUser
 * @param {Record<string, { name?: string, role?: string, email?: string }>|null} [codesOverride]
 */
export const mapSupabaseUserToAppUser = (supabaseUser, codesOverride = null) => {
  if (!supabaseUser) return null;

  const email = String(supabaseUser.email || '').trim();
  const meta = supabaseUser.user_metadata || {};
  const appMeta = supabaseUser.app_metadata || {};
  const displayName =
    meta.full_name ||
    meta.name ||
    meta.user_name ||
    (email ? email.split('@')[0] : '') ||
    'Utilisateur';

  const codes = codesOverride || getValidUserCodes();
  let matchedCode = null;
  let matchedInfo = null;

  for (const [code, info] of Object.entries(codes)) {
    const nameMatch = normalizeToken(info?.name) === normalizeToken(displayName);
    const emailMatch =
      info?.email && String(info.email).toLowerCase() === email.toLowerCase();
    if (nameMatch || emailMatch) {
      matchedCode = code;
      matchedInfo = info;
      break;
    }
  }

  const code =
    appMeta.app_code ||
    meta.app_code ||
    matchedCode ||
    (email ? email.split('@')[0] : supabaseUser.id.slice(0, 12));

  const role =
    matchedInfo?.role ||
    (appMeta.role === 'supervisor' || meta.role === 'supervisor' ? 'supervisor' : 'employee');

  return {
    code,
    name: matchedInfo?.name || displayName,
    role,
    email: email || null,
    authProvider: 'supabase',
    supabaseUserId: supabaseUser.id,
    loginTime: new Date().toISOString(),
    sessionId: `oauth_${supabaseUser.id}_${Date.now()}`
  };
};

export async function getAppUserFromSession() {
  if (!supabase) return null;
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.user) return null;
  return mapSupabaseUserToAppUser(session.user);
}

/** Reprend la session après redirection OAuth (Google, etc.). */
export async function recoverOAuthSession() {
  if (!supabase) return null;

  const hash = window.location.hash || '';
  const hasOAuthFragment =
    hash.includes('access_token') ||
    hash.includes('error=') ||
    hash.includes('type=recovery');

  if (hasOAuthFragment) {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Erreur récupération session OAuth:', error);
      return null;
    }
    window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
    return session?.user ? mapSupabaseUserToAppUser(session.user) : null;
  }

  return getAppUserFromSession();
}

export async function signInWithGoogle() {
  if (!supabase) throw new Error('Supabase non configuré');
  if (!isGoogleOAuthEnabled()) throw new Error('Google OAuth non activé');

  const redirectTo = `${window.location.origin}${window.location.pathname}`;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo }
  });
  if (error) throw error;
}

export async function signOutSupabaseAuth() {
  if (!supabase) return;
  try {
    await supabase.auth.signOut();
  } catch (error) {
    console.warn('signOut Supabase:', error);
  }
}
