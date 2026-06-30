import { describe, expect, it } from 'vitest';
import { mapSupabaseUserToAppUser } from '../utils/supabaseAuth';

describe('mapSupabaseUserToAppUser', () => {
  it('associe un utilisateur Google à un code existant par nom', () => {
    const user = mapSupabaseUserToAppUser(
      {
        id: 'uuid-123',
        email: 'cannes@example.com',
        user_metadata: { full_name: 'Cannes' },
        app_metadata: {}
      },
      {
        Cannes: { name: 'Cannes', role: 'employee' }
      }
    );

    expect(user.code).toBe('Cannes');
    expect(user.name).toBe('Cannes');
    expect(user.role).toBe('employee');
    expect(user.authProvider).toBe('supabase');
  });

  it('crée un utilisateur employee par défaut si aucune correspondance', () => {
    const user = mapSupabaseUserToAppUser(
      {
        id: 'uuid-456',
        email: 'nouveau@example.com',
        user_metadata: { full_name: 'Nouveau User' },
        app_metadata: {}
      },
      {}
    );

    expect(user.code).toBe('nouveau');
    expect(user.name).toBe('Nouveau User');
    expect(user.role).toBe('employee');
    expect(user.supabaseUserId).toBe('uuid-456');
  });

  it('respecte le rôle supervisor dans app_metadata', () => {
    const user = mapSupabaseUserToAppUser(
      {
        id: 'uuid-789',
        email: 'admin@example.com',
        user_metadata: {},
        app_metadata: { role: 'supervisor', app_code: 'Nicolas' }
      },
      {}
    );

    expect(user.code).toBe('Nicolas');
    expect(user.role).toBe('supervisor');
  });
});
