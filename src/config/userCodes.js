// Configuration des codes utilisateurs
// Vous pouvez modifier ces codes selon vos besoins

export const VALID_USER_CODES = {
  // Administrateurs
  'ADMIN001': { name: 'Administrateur Principal', role: 'admin' },
  'ADMIN002': { name: 'Administrateur Système', role: 'admin' },
  
  // Managers
  'MANAGER001': { name: 'Manager Boutique 1', role: 'manager' },
  'MANAGER002': { name: 'Manager Boutique 2', role: 'manager' },
  'MANAGER003': { name: 'Manager Boutique 3', role: 'manager' },
  
  // Employés
  'EMPLOYEE001': { name: 'Employé Boutique 1', role: 'employee' },
  'EMPLOYEE002': { name: 'Employé Boutique 2', role: 'employee' },
  'EMPLOYEE003': { name: 'Employé Boutique 3', role: 'employee' },
  'EMPLOYEE004': { name: 'Employé Polyvalent', role: 'employee' },
  
  // Superviseurs
  'SUPERVISOR001': { name: 'Superviseur Régional', role: 'supervisor' },
  'SUPERVISOR002': { name: 'Superviseur Zone Nord', role: 'supervisor' },
  'SUPERVISOR003': { name: 'Superviseur Zone Sud', role: 'supervisor' },
  
  // Direction
  'DIRECTOR001': { name: 'Directeur Commercial', role: 'director' },
  'DIRECTOR002': { name: 'Directeur RH', role: 'director' },
  'DIRECTOR003': { name: 'Directeur Financier', role: 'director' },
  
  // Assistants
  'ASSISTANT001': { name: 'Assistant RH', role: 'assistant' },
  'ASSISTANT002': { name: 'Assistant Commercial', role: 'assistant' },
  'ASSISTANT003': { name: 'Assistant Direction', role: 'assistant' },
  
  // Stagiaires
  'TRAINEE001': { name: 'Stagiaire Commercial', role: 'trainee' },
  'TRAINEE002': { name: 'Stagiaire RH', role: 'trainee' },
  'TRAINEE003': { name: 'Stagiaire Marketing', role: 'trainee' },
  
  // Consultants
  'CONSULTANT001': { name: 'Consultant Externe', role: 'consultant' },
  'CONSULTANT002': { name: 'Consultant IT', role: 'consultant' },
  'CONSULTANT003': { name: 'Consultant Formation', role: 'consultant' },
  
  // Codes de test (à supprimer en production)
  'TEST001': { name: 'Utilisateur Test', role: 'test' },
  'DEMO001': { name: 'Démonstration', role: 'demo' }
};

// Rôles et leurs permissions
export const ROLE_PERMISSIONS = {
  admin: {
    canManageUsers: true,
    canAccessAllData: true,
    canModifySystem: true,
    canExportAll: true,
    canImportData: true
  },
  director: {
    canManageUsers: false,
    canAccessAllData: true,
    canModifySystem: false,
    canExportAll: true,
    canImportData: true
  },
  supervisor: {
    canManageUsers: false,
    canAccessAllData: true,
    canModifySystem: false,
    canExportAll: true,
    canImportData: false
  },
  manager: {
    canManageUsers: false,
    canAccessAllData: false,
    canModifySystem: false,
    canExportAll: false,
    canImportData: false
  },
  employee: {
    canManageUsers: false,
    canAccessAllData: false,
    canModifySystem: false,
    canExportAll: false,
    canImportData: false
  },
  assistant: {
    canManageUsers: false,
    canAccessAllData: false,
    canModifySystem: false,
    canExportAll: false,
    canImportData: false
  },
  trainee: {
    canManageUsers: false,
    canAccessAllData: false,
    canModifySystem: false,
    canExportAll: false,
    canImportData: false
  },
  consultant: {
    canManageUsers: false,
    canAccessAllData: false,
    canModifySystem: false,
    canExportAll: false,
    canImportData: false
  },
  test: {
    canManageUsers: false,
    canAccessAllData: true,
    canModifySystem: false,
    canExportAll: true,
    canImportData: true
  },
  demo: {
    canManageUsers: false,
    canAccessAllData: true,
    canModifySystem: false,
    canExportAll: true,
    canImportData: true
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

// Fonction pour obtenir les informations d'un utilisateur
export const getUserInfo = (userCode) => {
  return VALID_USER_CODES[userCode] || null;
};

// Fonction pour lister tous les codes utilisateurs
export const getAllUserCodes = () => {
  return Object.keys(VALID_USER_CODES);
};

// Fonction pour lister les utilisateurs par rôle
export const getUsersByRole = (role) => {
  return Object.entries(VALID_USER_CODES)
    .filter(([code, info]) => info.role === role)
    .map(([code, info]) => ({ code, ...info }));
};
