// Système de gestion de version pour forcer le vidage du cache
import { version } from '../../package.json';

const VERSION_KEY = 'app_version';

/**
 * Vérifie si la version de l'application a changé
 * Si oui, vide le localStorage (sauf l'utilisateur) et force un rechargement
 */
export const checkVersion = () => {
  try {
    const currentVersion = version;
    const storedVersion = localStorage.getItem(VERSION_KEY);
    
    console.log('🔍 Vérification de version:', {
      currentVersion,
      storedVersion,
      hasChanged: storedVersion !== currentVersion
    });
    
    // Si la version a changé
    if (storedVersion && storedVersion !== currentVersion) {
      console.log('🔄 NOUVELLE VERSION DÉTECTÉE !');
      console.log(`   Ancienne: ${storedVersion}`);
      console.log(`   Nouvelle: ${currentVersion}`);
      console.log('🧹 Nettoyage du cache et localStorage...');
      
      // Sauvegarder les données importantes avant le clear
      const currentUser = localStorage.getItem('current_user');
      const userId = localStorage.getItem('user_id');
      
      // Vider TOUT le localStorage
      localStorage.clear();
      
      // Restaurer uniquement l'utilisateur
      if (currentUser) localStorage.setItem('current_user', currentUser);
      if (userId) localStorage.setItem('user_id', userId);
      
      // Enregistrer la nouvelle version
      localStorage.setItem(VERSION_KEY, currentVersion);
      
      // Afficher un message à l'utilisateur
      alert(
        `🎉 Nouvelle version installée !\n\n` +
        `Version ${currentVersion}\n\n` +
        `Le cache a été vidé pour garantir le bon fonctionnement.\n` +
        `La page va se recharger automatiquement.`
      );
      
      // Forcer le rechargement complet de la page (sans cache)
      window.location.reload(true);
      
      return true; // Version a changé
    }
    
    // Si c'est la première visite (pas de version stockée)
    if (!storedVersion) {
      console.log('🆕 Première visite - Enregistrement de la version:', currentVersion);
      localStorage.setItem(VERSION_KEY, currentVersion);
    }
    
    return false; // Version identique
  } catch (error) {
    console.error('❌ Erreur lors de la vérification de version:', error);
    return false;
  }
};

/**
 * Obtient la version actuelle de l'application
 */
export const getAppVersion = () => {
  return version;
};

/**
 * Force la mise à jour manuelle (pour debug)
 */
export const forceVersionUpdate = () => {
  console.log('🔧 Forçage de la mise à jour de version...');
  localStorage.removeItem(VERSION_KEY);
  checkVersion();
};

/**
 * Affiche les informations de version dans la console
 */
export const logVersionInfo = () => {
  const currentVersion = version;
  const storedVersion = localStorage.getItem(VERSION_KEY);
  
  console.log('%c📦 VERSION DE L\'APPLICATION', 'font-size: 16px; font-weight: bold; color: #1e88e5;');
  console.log(`   Version actuelle: ${currentVersion}`);
  console.log(`   Version en cache: ${storedVersion || 'Aucune'}`);
  console.log(`   Status: ${storedVersion === currentVersion ? '✅ À jour' : '⚠️ Mise à jour nécessaire'}`);
};

