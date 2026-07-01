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
  },
  Cannes: {
    name: 'Cannes',
    role: 'employee',
    secretCode: 'Cannes'
  },
  Maxime: {
    name: 'Maxime',
    role: 'employee',
    secretCode: 'Maxime'
  },
  Tropez: {
    name: 'Tropez',
    role: 'employee',
    secretCode: 'Tropez'
  }
};

// Compat: certains composants lisent encore cet objet directement.
// Il est synchronisé automatiquement avec le stockage persistant.
export const VALID_USER_CODES = {};

const isValidRole = (role) => role === 'supervisor' || role === 'employee';

const normalizeToken = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

const normalizeShopIds = (raw) => {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map((id) => String(id || '').trim()).filter(Boolean))];
};

const normalizeFeatureOverrides = (raw) => {
  if (!raw || typeof raw !== 'object') return {};
  const normalized = {};
  Object.entries(raw).forEach(([key, value]) => {
    if (typeof value === 'boolean') normalized[key] = value;
  });
  return normalized;
};

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
    const allowedShopIds = normalizeShopIds(rawInfo.allowedShopIds);
    const featureOverrides = normalizeFeatureOverrides(rawInfo.featureOverrides);

    if (!name) return;
    normalized[code] = { name, role, secretCode, allowedShopIds, featureOverrides };
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
        ...(stored[PRIMARY_ADMIN_CODE] ? {} : { [PRIMARY_ADMIN_CODE]: DEFAULT_USER_CODES[PRIMARY_ADMIN_CODE] }),
        ...(stored.Cannes ? {} : { Cannes: DEFAULT_USER_CODES.Cannes }),
        ...(stored.Maxime ? {} : { Maxime: DEFAULT_USER_CODES.Maxime }),
        ...(stored.Tropez ? {} : { Tropez: DEFAULT_USER_CODES.Tropez })
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
  if (!normalized.Cannes) normalized.Cannes = DEFAULT_USER_CODES.Cannes;
  if (!normalized.Maxime) normalized.Maxime = DEFAULT_USER_CODES.Maxime;
  if (!normalized.Tropez) normalized.Tropez = DEFAULT_USER_CODES.Tropez;
  saveCodesToStorage(normalized);
  syncValidCodesObject(normalized);
  return normalized;
};

export const getValidUserCodes = () => getCodes();

export const pullUserCodesFromSupabase = async () => {
  if (!supabase) return getCodes();

  const fetchRemote = async () => {
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
  };

  try {
    return await Promise.race([
      fetchRemote(),
      new Promise((resolve) => {
        setTimeout(() => {
          console.warn('⚠️ Timeout sync codes Supabase — codes locaux utilisés.');
          resolve(getCodes());
        }, 4000);
      })
    ]);
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

// Rôles et leurs permissions par défaut
export const ROLE_PERMISSIONS = {
  supervisor: {
    canManageUsers: true,
    canAccessAllData: true,
    canAccessAllShops: true,
    canModifySystem: true,
    canExportAll: true,
    canImportData: true,
    canViewSecretCodes: true,
    canModifySecretCodes: true,
    canRestoreSupabase: true,
    canResetData: true,
    canViewAuditLog: true,
    canViewShopStats: true,
    canViewCA: true,
    canViewLabourInspection: true,
    canManageHiddenEmployees: true,
    canCopyWeek: true,
    canViewWeeklyMatrix: true,
    canViewPresenceMap: true,
    canViewSchoolMode: true,
    canViewNotes: true,
    canViewWeekInsights: true,
    canEditPlanning: true
  },
  employee: {
    canManageUsers: false,
    canAccessAllData: false,
    canAccessAllShops: false,
    canModifySystem: false,
    canExportAll: false,
    canImportData: false,
    canViewSecretCodes: false,
    canModifySecretCodes: false,
    canRestoreSupabase: false,
    canResetData: false,
    canViewAuditLog: false,
    canViewShopStats: false,
    canViewCA: false,
    canViewLabourInspection: false,
    canManageHiddenEmployees: true,
    canCopyWeek: true,
    canViewWeeklyMatrix: true,
    canViewPresenceMap: true,
    canViewSchoolMode: false,
    canViewNotes: true,
    canViewWeekInsights: true,
    canEditPlanning: true
  }
};

export const FEATURE_CATALOG = [
  { key: 'canAccessAllShops', label: 'Toutes les boutiques', group: 'Boutiques' },
  { key: 'canEditPlanning', label: 'Modifier le planning', group: 'Planning' },
  { key: 'canCopyWeek', label: 'Copier semaine → semaine+1', group: 'Planning' },
  { key: 'canViewWeeklyMatrix', label: 'Planning boutiques semaine/mois', group: 'Planning' },
  { key: 'canViewPresenceMap', label: 'Cartographie présence', group: 'Planning' },
  { key: 'canViewWeekInsights', label: 'Pilotage semaine', group: 'Planning' },
  { key: 'canManageHiddenEmployees', label: 'Employés masqués', group: 'Planning' },
  { key: 'canExportAll', label: 'Export Excel global', group: 'Exports' },
  { key: 'canViewLabourInspection', label: 'Inspection du travail', group: 'Exports' },
  { key: 'canImportData', label: 'Importer des données', group: 'Données' },
  { key: 'canRestoreSupabase', label: 'Restaurer Supabase', group: 'Données' },
  { key: 'canResetData', label: 'Effacer / réinitialiser', group: 'Données' },
  { key: 'canViewAuditLog', label: 'Journal d\'audit', group: 'Administration' },
  { key: 'canManageUsers', label: 'Gérer les codes utilisateurs', group: 'Administration' },
  { key: 'canModifySystem', label: 'Config boutiques / employés', group: 'Administration' },
  { key: 'canViewShopStats', label: 'Statistiques boutique', group: 'Modules' },
  { key: 'canViewCA', label: 'Gestion CA', group: 'Modules' },
  { key: 'canViewNotes', label: 'Notes', group: 'Modules' },
  { key: 'canViewSchoolMode', label: 'Mode école', group: 'Modules' }
];

const resolveRolePermission = (rolePermissions, permission) => {
  if (!rolePermissions) return false;
  if (permission === 'canAccessAllShops') {
    return rolePermissions.canAccessAllShops ?? rolePermissions.canAccessAllData ?? false;
  }
  if (permission === 'canAccessAllData') {
    return rolePermissions.canAccessAllData ?? rolePermissions.canAccessAllShops ?? false;
  }
  return rolePermissions[permission] || false;
};

// Fonction pour vérifier les permissions d'un utilisateur (rôle + dérogations individuelles)
export const checkUserPermission = (userCode, permission) => {
  const userInfo = getCodes()[userCode];
  if (!userInfo) return false;

  if (userInfo.featureOverrides && typeof userInfo.featureOverrides[permission] === 'boolean') {
    return userInfo.featureOverrides[permission];
  }

  const rolePermissions = ROLE_PERMISSIONS[userInfo.role];
  return resolveRolePermission(rolePermissions, permission);
};

export const getUserFeatureOverrides = (userCode) => {
  const userInfo = getCodes()[userCode];
  return userInfo?.featureOverrides || {};
};

export const canUserAccessAllShops = (userCode) =>
  checkUserPermission(userCode, 'canAccessAllShops');

const matchShopsByUserIdentity = (userInfo, userCode, shops = []) => {
  const userName = normalizeToken(userInfo?.name);
  const codeToken = normalizeToken(userCode);
  return shops.filter((shop) => {
    const idToken = normalizeToken(shop?.id);
    const nameToken = normalizeToken(shop?.name);
    return (
      (userName && (idToken.includes(userName) || nameToken.includes(userName) || userName.includes(nameToken))) ||
      (codeToken && (idToken.includes(codeToken) || nameToken.includes(codeToken) || codeToken.includes(nameToken)))
    );
  });
};

export const getAllowedShopIdsForUser = (userCode, shops = []) => {
  const userInfo = getCodes()[userCode];
  if (!userInfo) return [];

  if (canUserAccessAllShops(userCode)) {
    return shops.map((shop) => shop.id);
  }

  const explicit = normalizeShopIds(userInfo.allowedShopIds);
  if (explicit.length > 0) {
    const shopIdSet = new Set(shops.map((shop) => shop.id));
    return explicit.filter((id) => shopIdSet.has(id));
  }

  const inferred = matchShopsByUserIdentity(userInfo, userCode, shops);
  if (inferred.length > 0) {
    return inferred.map((shop) => shop.id);
  }

  return shops.map((shop) => shop.id);
};

export const filterShopsForUser = (userCode, shops = []) => {
  const allowedIds = new Set(getAllowedShopIdsForUser(userCode, shops));
  return shops.filter((shop) => allowedIds.has(shop.id));
};

export const canUserAccessShop = (userCode, shopId, shops = []) => {
  if (!shopId) return false;
  return getAllowedShopIdsForUser(userCode, shops).includes(shopId);
};

export const enrichUserSession = (user, shops = []) => {
  if (!user?.code) return user;
  const allowedShopIds = getAllowedShopIdsForUser(user.code, shops);
  return {
    ...user,
    allowedShopIds,
    permissions: FEATURE_CATALOG.reduce((acc, feature) => {
      acc[feature.key] = checkUserPermission(user.code, feature.key);
      return acc;
    }, {})
  };
};

/** Planning limité aux boutiques autorisées (exports Excel/PDF, vues multi-boutiques). */
export const filterPlanningDataForUser = (userCode, planningData) => {
  if (!planningData || !userCode) return planningData;
  const allShops = planningData.shops || [];
  const allowedShops = filterShopsForUser(userCode, allShops);
  if (allowedShops.length === allShops.length) return planningData;
  return {
    ...planningData,
    shops: allowedShops
  };
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
    secretCode: info.secretCode,
    allowedShopIds: info.allowedShopIds || [],
    featureOverrides: info.featureOverrides || {}
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
    secretCode: normalizedCode,
    allowedShopIds: [],
    featureOverrides: {}
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

export const updateUserAccessSettings = (
  userCode,
  { allowedShopIds, featureOverrides },
  requestingUserRole
) => {
  if (requestingUserRole !== 'supervisor') {
    throw new Error('Accès non autorisé à la modification des droits utilisateur');
  }

  const codes = getCodes();
  if (!codes[userCode]) {
    throw new Error('Utilisateur non trouvé');
  }

  const nextAllowedShopIds = allowedShopIds === undefined
    ? (codes[userCode].allowedShopIds || [])
    : normalizeShopIds(allowedShopIds);

  const nextFeatureOverrides = featureOverrides === undefined
    ? (codes[userCode].featureOverrides || {})
    : normalizeFeatureOverrides(featureOverrides);

  codes[userCode] = {
    ...codes[userCode],
    allowedShopIds: nextAllowedShopIds,
    featureOverrides: nextFeatureOverrides
  };
  setCodes(codes);

  return {
    success: true,
    message: `Droits mis à jour pour ${codes[userCode].name}`
  };
};
