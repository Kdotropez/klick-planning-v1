import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  isGoogleOAuthEnabled,
  isSecretCodesAuthMode,
  isSupabaseAuthMode,
  getOAuthProviders
} from './authConfig';

describe('authConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('utilise les codes secrets par défaut', () => {
    vi.stubEnv('VITE_AUTH_MODE', '');
    expect(isSecretCodesAuthMode()).toBe(true);
    expect(isSupabaseAuthMode()).toBe(false);
    expect(isGoogleOAuthEnabled()).toBe(false);
  });

  it('active Google OAuth en mode supabase', () => {
    vi.stubEnv('VITE_AUTH_MODE', 'supabase');
    vi.stubEnv('VITE_SUPABASE_OAUTH_PROVIDERS', 'google');
    expect(isSupabaseAuthMode()).toBe(true);
    expect(isGoogleOAuthEnabled()).toBe(true);
    expect(getOAuthProviders()).toEqual(['google']);
  });
});
