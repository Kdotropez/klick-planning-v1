import { describe, expect, it, vi, afterEach } from 'vitest';
import { getSupervisorOverrideCode, isSupervisorOverrideCode } from './securityCodes';

describe('securityCodes', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('utilise 2111 par défaut sans variable Vercel', () => {
    vi.stubEnv('VITE_SUPERVISOR_OVERRIDE_CODE', '');
    expect(getSupervisorOverrideCode()).toBe('2111');
    expect(isSupervisorOverrideCode('2111')).toBe(true);
    expect(isSupervisorOverrideCode('0000')).toBe(false);
  });

  it('accepte le code configuré via VITE_SUPERVISOR_OVERRIDE_CODE', () => {
    vi.stubEnv('VITE_SUPERVISOR_OVERRIDE_CODE', '9876');
    expect(getSupervisorOverrideCode()).toBe('9876');
    expect(isSupervisorOverrideCode('9876')).toBe(true);
    expect(isSupervisorOverrideCode('2111')).toBe(false);
  });

  it('ignore les espaces autour du code saisi', () => {
    vi.stubEnv('VITE_SUPERVISOR_OVERRIDE_CODE', '4321');
    expect(isSupervisorOverrideCode(' 4321 ')).toBe(true);
  });
});
