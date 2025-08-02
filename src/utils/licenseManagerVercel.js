// Système de gestion des licences simplifié - Planning App v9
// Copyright (c) 2025 Nicolas Lefevre. Tous droits réservés.
// Version Vercel-compatible

// Types de licences
export const LICENSE_TYPES = {
  PROVISIONAL: 'provisional',
  UNLIMITED: 'unlimited'
};

// Fonction simplifiée pour charger une licence
export const loadLicense = () => {
  try {
    const stored = localStorage.getItem('planning_license');
    if (stored) {
      return JSON.parse(stored);
    }
    return null;
  } catch (error) {
    console.error('Erreur lors du chargement de la licence:', error);
    return null;
  }
};

// Fonction simplifiée pour sauvegarder une licence
export const saveLicense = (license) => {
  try {
    localStorage.setItem('planning_license', JSON.stringify(license));
    return true;
  } catch (error) {
    console.error('Erreur lors de la sauvegarde de la licence:', error);
    return false;
  }
};

// Fonction simplifiée pour vérifier la validité d'une licence
export const isLicenseValid = (license) => {
  if (!license) return false;
  
  try {
    const now = new Date();
    const expiryDate = new Date(license.expiryDate);
    
    return license.isActive && expiryDate > now;
  } catch (error) {
    console.error('Erreur lors de la vérification de la licence:', error);
    return false;
  }
};

// Fonction simplifiée pour vérifier les limites
export const checkLicenseLimits = (license, currentData) => {
  if (!license) {
    return { valid: false, message: 'Aucune licence trouvée' };
  }
  
  try {
    // Limites simplifiées
    const maxShops = license.type === LICENSE_TYPES.UNLIMITED ? 999 : 3;
    const maxEmployees = license.type === LICENSE_TYPES.UNLIMITED ? 999 : 10;
    
    const currentShops = currentData.shops?.length || 0;
    const currentEmployees = currentData.shops?.reduce((total, shop) => 
      total + (shop.employees?.length || 0), 0) || 0;
    
    if (currentShops > maxShops) {
      return { valid: false, message: `Limite de boutiques atteinte (${maxShops})` };
    }
    
    if (currentEmployees > maxEmployees) {
      return { valid: false, message: `Limite d'employés atteinte (${maxEmployees})` };
    }
    
    return { valid: true, message: 'Limites respectées' };
  } catch (error) {
    console.error('Erreur lors de la vérification des limites:', error);
    return { valid: false, message: 'Erreur de vérification des limites' };
  }
};

// Fonction pour créer une licence de démonstration
export const createDemoLicense = () => {
  const now = new Date();
  const expiryDate = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000)); // 7 jours
  
  return {
    id: 'DEMO-LICENSE',
    type: LICENSE_TYPES.PROVISIONAL,
    clientName: 'Utilisateur Démo',
    email: 'demo@planning-app.com',
    issuedDate: now.toISOString(),
    expiryDate: expiryDate.toISOString(),
    isActive: true,
    features: ['planning', 'export', 'basic']
  };
};

// Fonction pour créer une licence complète
export const createFullLicense = () => {
  const now = new Date();
  const expiryDate = new Date(now.getTime() + (36500 * 24 * 60 * 60 * 1000)); // 100 ans
  
  return {
    id: 'FULL-LICENSE',
    type: LICENSE_TYPES.UNLIMITED,
    clientName: 'Nicolas Lefevre',
    email: 'nicolas@planning-app.com',
    issuedDate: now.toISOString(),
    expiryDate: expiryDate.toISOString(),
    isActive: true,
    features: ['planning', 'export', 'advanced', 'unlimited']
  };
};

// Fonction pour supprimer une licence
export const removeLicense = () => {
  try {
    localStorage.removeItem('planning_license');
    return true;
  } catch (error) {
    console.error('Erreur lors de la suppression de la licence:', error);
    return false;
  }
};

// Fonction pour obtenir les informations de la licence
export const getLicenseInfo = (license) => {
  if (!license) return 'Aucune licence';
  
  const expiryDate = new Date(license.expiryDate);
  const daysLeft = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));
  
  return {
    type: license.type,
    clientName: license.clientName,
    expiryDate: expiryDate.toLocaleDateString('fr-FR'),
    daysLeft: daysLeft,
    isActive: license.isActive
  };
}; 