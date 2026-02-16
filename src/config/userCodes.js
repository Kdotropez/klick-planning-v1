// Configuration des codes utilisateurs - CODES SECRETS
// ATTENTION: Ces codes ne doivent pas être visibles dans l'interface utilisateur normale
// Seuls les superviseurs peuvent les visualiser et modifier
import { supabase } from '../utils/supabaseClient';

const USER_CODES_STORAGE_KEY = 'custom_user_codes_v1';
export const PRIMARY_ADMIN_CODE = 'Nicolas';
const USER_CODES_REMOTE_SHOP_ID = 'system_config';
const USER_CODES_REMOTE_WEEK_KEY = 'user_codes';

const DEFAULT_USER_CODES = {
  // Administrateur principal unique
  [PRIMARY_ADMIN_CODE]: {
    name: 'Nicolas',
    role: 'supervisor',
    secretCode: PRIMARY_ADMIN_CODE
  }
};

// Compat: certains composants lisent encore cet objet directement.
// Il est synchronisé automatiquement avec le stockage persistant.
export const VALID_USER_CODES = {};

const isValidRole = (role) => role === 'supervisor' || role === 'employee';

const normalizeCodes = (codesObj) => {
  const normalized = {};
  if (!codesObj || typeof codesObj !== 'object') return normalized;

  Object.entries(codesObj).forEach(([rawCode, rawInfo]) => {
    const code = String(rawCode || '').trim();
    if (!code) return;
    if (!rawInfo || typeof rawInfo !== 'object') return;

    const name = String(rawInfo.name || '').trim();
    const role = isValidRole(rawInfo.role) ? rawInfo.role : 'employee';
    const secretCode = String(rawInfo.secretCode || code).trim();

    if (!name) return;
    normalized[code] = { name, role, secretCode };
  });

  return normalized;
};

const migrateLegacyDefaultCodes = (codesObj) => {
  const migrated = { ...(codesObj || {}) };

  // Migration legacy: 2111 devient Nicolas, anciens codes supprimés.
  if (migrated['2111'] && !migrated[PRIMARY_ADMIN_CODE]) {
    migrated[PRIMARY_ADMIN_CODE] = {
      ...migrated['2111'],
      secretCode: PRIMARY_ADMIN_CODE
    };
  }

  delete migrated['2111'];
  delete migrated['0000'];
  delete migrated['2025'];
  delete migrated['2006'];

  return migrated;
};

const saveCodesToStorage = (codesObj) => {
  try {
    localStorage.setItem(USER_CODES_STORAGE_KEY, JSON.stringify(codesObj));
  } catch (error) {
    console.error('Erreur sauvegarde des codes utilisateurs:', error);
  }
};

const readCodesFromStorage = () => {
  try {
    const raw = localStorage.getItem(USER_CODES_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    console.error('Erreur lecture des codes utilisateurs:', error);
    return null;
  }
};

const syncValidCodesObject = (codesObj) => {
  Object.keys(VALID_USER_CODES).forEach((key) => delete VALID_USER_CODES[key]);
  Object.entries(codesObj).forEach(([key, value]) => {
    VALID_USER_CODES[key] = value;
  });
};

const getCodes = () => {
  const stored = migrateLegacyDefaultCodes(normalizeCodes(readCodesFromStorage()));
  const hasStoredCodes = Object.keys(stored).length > 0;

  // On conserve au minimum le superviseur principal.
  const merged = hasStoredCodes
    ? {
        ...stored,
        ...(stored[PRIMARY_ADMIN_CODE] ? {} : { [PRIMARY_ADMIN_CODE]: DEFAULT_USER_CODES[PRIMARY_ADMIN_CODE] })
      }
    : { ...DEFAULT_USER_CODES };

  syncValidCodesObject(merged);
  return merged;
};

const setCodes = (codesObj) => {
  const normalized = normalizeCodes(codesObj);
  // Sécurité : ne jamais perdre le superviseur principal
  if (!normalized[PRIMARY_ADMIN_CODE]) {
    normalized[PRIMARY_ADMIN_CODE] = DEFAULT_USER_CODES[PRIMARY_ADMIN_CODE];
  }
  saveCodesToStorage(normalized);
  syncValidCodesObject(normalized);
  return normalized;
};

export const getValidUserCodes = () => getCodes();

export const pullUserCodesFromSupabase = async () => {
  if (!supabase) return getCodes();

  try {
    const { data, error } = await supabase
      .from('plannings')
      .select('data')
      .eq('shop_id', USER_CODES_REMOTE_SHOP_ID)
      .eq('week_key', USER_CODES_REMOTE_WEEK_KEY)
      .maybeSingle();

    if (error) {
      console.warn('⚠️ Impossible de charger les codes depuis Supabase:', error.message);
      return getCodes();
    }

    const remoteCodes = migrateLegacyDefaultCodes(normalizeCodes(data?.data?.codes));
    if (Object.keys(remoteCodes).length === 0) {
      return getCodes();
    }

    return setCodes(remoteCodes);
  } catch (error) {
    console.warn('⚠️ Erreur pullUserCodesFromSupabase:', error);
    return getCodes();
  }
};

export const pushUserCodesToSupabase = async () => {
  if (!supabase) return false;

  try {
    const payload = {
      shop_id: USER_CODES_REMOTE_SHOP_ID,
      week_key: USER_CODES_REMOTE_WEEK_KEY,
      data: {
        codes: getCodes(),
        updatedAt: new Date().toISOString()
      },
      version: 1,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('plannings')
      .upsert(payload, { onConflict: 'shop_id,week_key' });

    if (error) {
      console.warn('⚠️ Impossible de sauvegarder les codes sur Supabase:', error.message);
      return false;
    }

    return true;
  } catch (error) {
    console.warn('⚠️ Erreur pushUserCodesToSupabase:', error);
    return false;
  }
};

// Initialisation au chargement du module
getCodes();

// Rôles et leurs permissions
export const ROLE_PERMISSIONS = {
  supervisor: {
    canManageUsers: true,
    canAccessAllData: true,
    canModifySystem: true,
    canExportAll: true,
    canImportData: true,
    canViewSecretCodes: true,
    canModifySecretCodes: true
  },
  employee: {
    canManageUsers: false,
    canAccessAllData: false,
    canModifySystem: false,
    canExportAll: false,
    canImportData: false,
    canViewSecretCodes: false,
    canModifySecretCodes: false
  }
};

// Fonction pour vérifier les permissions d'un utilisateur
export const checkUserPermission = (userCode, permission) => {
  const userInfo = getCodes()[userCode];
  if (!userInfo) return false;
  
  const rolePermissions = ROLE_PERMISSIONS[userInfo.role];
  if (!rolePermissions) return false;
  
  return rolePermissions[permission] || false;
};

// Fonction pour obtenir les informations d'un utilisateur (sans le code secret)
export const getUserInfo = (userCode) => {
  const userInfo = getCodes()[userCode];
  if (!userInfo) return null;
  
  // Retourner les infos sans le code secret pour les non-superviseurs
  return {
    name: userInfo.name,
    role: userInfo.role
  };
};

// Fonction pour obtenir les informations complètes (avec code secret) - SUPERVISEURS SEULEMENT
export const getUserInfoWithSecret = (userCode, requestingUserRole) => {
  if (requestingUserRole !== 'supervisor') {
    throw new Error('Accès non autorisé aux codes secrets');
  }
  
  return getCodes()[userCode] || null;
};

// Fonction pour lister tous les utilisateurs (sans codes secrets)
export const getAllUsers = () => {
  return Object.entries(getCodes()).map(([code, info]) => ({
    code: code,
    name: info.name,
    role: info.role
  }));
};

// Fonction pour lister tous les utilisateurs avec codes secrets - SUPERVISEURS SEULEMENT
export const getAllUsersWithSecrets = (requestingUserRole) => {
  if (requestingUserRole !== 'supervisor') {
    throw new Error('Accès non autorisé aux codes secrets');
  }
  
  return Object.entries(getCodes()).map(([code, info]) => ({
    code: code,
    name: info.name,
    role: info.role,
    secretCode: info.secretCode
  }));
};

// Fonction pour modifier un code secret - SUPERVISEURS SEULEMENT
export const updateSecretCode = (userCode, newSecretCode, requestingUserRole) => {
  if (requestingUserRole !== 'supervisor') {
    throw new Error('Accès non autorisé à la modification des codes secrets');
  }
  
  const codes = getCodes();
  if (!codes[userCode]) {
    throw new Error('Utilisateur non trouvé');
  }

  const targetCode = String(newSecretCode || '').trim();
  if (!targetCode) {
    throw new Error('Le nouveau code secret ne peut pas être vide');
  }

  // Vérifier que le nouveau code n'est pas déjà utilisé
  const existingUser = Object.entries(codes).find(([code, info]) =>
    (code === targetCode || info.secretCode === targetCode) && code !== userCode
  );
  
  if (existingUser) {
    throw new Error(`Le code ${newSecretCode} est déjà utilisé par ${existingUser[1].name}`);
  }
  
  // Changer le code de connexion (clé) et synchroniser secretCode
  const updatedUser = { ...codes[userCode], secretCode: targetCode };
  delete codes[userCode];
  codes[targetCode] = updatedUser;
  setCodes(codes);
  
  return {
    success: true,
    message: `Code secret mis à jour pour ${updatedUser.name}`
  };
};

// Fonction pour ajouter un nouvel utilisateur - SUPERVISEURS SEULEMENT
export const addNewUser = (secretCode, name, role, requestingUserRole) => {
  if (requestingUserRole !== 'supervisor') {
    throw new Error('Accès non autorisé à l\'ajout d\'utilisateurs');
  }
  
  const codes = getCodes();
  const normalizedCode = String(secretCode || '').trim();
  const normalizedName = String(name || '').trim();
  const normalizedRole = isValidRole(role) ? role : 'employee';

  if (!normalizedCode) {
    throw new Error('Le code secret est requis');
  }
  if (!normalizedName) {
    throw new Error('Le nom est requis');
  }

  if (codes[normalizedCode]) {
    throw new Error('Ce code secret est déjà utilisé');
  }

  codes[normalizedCode] = {
    name: normalizedName,
    role: normalizedRole,
    secretCode: normalizedCode
  };
  setCodes(codes);
  
  return {
    success: true,
    message: `Utilisateur ${name} ajouté avec succès`
  };
};

// Fonction pour supprimer un utilisateur - SUPERVISEURS SEULEMENT
export const removeUser = (userCode, requestingUserRole) => {
  if (requestingUserRole !== 'supervisor') {
    throw new Error('Accès non autorisé à la suppression d\'utilisateurs');
  }
  
  const codes = getCodes();
  if (!codes[userCode]) {
    throw new Error('Utilisateur non trouvé');
  }

  if (userCode === PRIMARY_ADMIN_CODE) {
    throw new Error(`Le compte superviseur principal ${PRIMARY_ADMIN_CODE} ne peut pas être supprimé`);
  }

  const userName = codes[userCode].name;
  delete codes[userCode];
  setCodes(codes);
  
  return {
    success: true,
    message: `Utilisateur ${userName} supprimé avec succès`
  };
};
