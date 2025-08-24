// Configuration des codes utilisateurs - CODES SECRETS
// ATTENTION: Ces codes ne doivent pas être visibles dans l'interface utilisateur normale
// Seuls les superviseurs peuvent les visualiser et modifier

export const VALID_USER_CODES = {
  // Utilisateurs principaux avec codes secrets
  '2111': { name: 'Nicolas', role: 'supervisor', secretCode: '2111' },
  '0000': { name: 'Evelyne', role: 'employee', secretCode: '0000' },
  '2025': { name: 'Angelique', role: 'employee', secretCode: '2025' },
  '2006': { name: 'Titoune', role: 'employee', secretCode: '2006' }
};

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
  const userInfo = VALID_USER_CODES[userCode];
  if (!userInfo) return false;
  
  const rolePermissions = ROLE_PERMISSIONS[userInfo.role];
  if (!rolePermissions) return false;
  
  return rolePermissions[permission] || false;
};

// Fonction pour obtenir les informations d'un utilisateur (sans le code secret)
export const getUserInfo = (userCode) => {
  const userInfo = VALID_USER_CODES[userCode];
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
  
  return VALID_USER_CODES[userCode] || null;
};

// Fonction pour lister tous les utilisateurs (sans codes secrets)
export const getAllUsers = () => {
  return Object.entries(VALID_USER_CODES).map(([code, info]) => ({
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
  
  return Object.entries(VALID_USER_CODES).map(([code, info]) => ({
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
  
  if (!VALID_USER_CODES[userCode]) {
    throw new Error('Utilisateur non trouvé');
  }
  
  // Vérifier que le nouveau code n'est pas déjà utilisé
  const existingUser = Object.entries(VALID_USER_CODES).find(([code, info]) => 
    info.secretCode === newSecretCode && code !== userCode
  );
  
  if (existingUser) {
    throw new Error(`Le code ${newSecretCode} est déjà utilisé par ${existingUser[1].name}`);
  }
  
  // Mettre à jour le code secret
  VALID_USER_CODES[userCode].secretCode = newSecretCode;
  
  return {
    success: true,
    message: `Code secret mis à jour pour ${VALID_USER_CODES[userCode].name}`
  };
};

// Fonction pour ajouter un nouvel utilisateur - SUPERVISEURS SEULEMENT
export const addNewUser = (secretCode, name, role, requestingUserRole) => {
  if (requestingUserRole !== 'supervisor') {
    throw new Error('Accès non autorisé à l\'ajout d\'utilisateurs');
  }
  
  if (VALID_USER_CODES[secretCode]) {
    throw new Error('Ce code secret est déjà utilisé');
  }
  
  VALID_USER_CODES[secretCode] = {
    name: name,
    role: role,
    secretCode: secretCode
  };
  
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
  
  if (!VALID_USER_CODES[userCode]) {
    throw new Error('Utilisateur non trouvé');
  }
  
  const userName = VALID_USER_CODES[userCode].name;
  delete VALID_USER_CODES[userCode];
  
  return {
    success: true,
    message: `Utilisateur ${userName} supprimé avec succès`
  };
};
