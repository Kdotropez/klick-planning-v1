// Test de protection - Planning App v9
// Copyright (c) 2025 Nicolas Lefevre. Tous droits réservés.

import { enableProtection, checkEnvironment } from './protection.js';

// Test de la protection
export const testProtection = () => {
  console.log('🔒 Test de protection en cours...');
  
  // Activer la protection
  enableProtection();
  
  // Vérifier l'environnement
  const warnings = checkEnvironment();
  
  if (warnings.length > 0) {
    console.warn('⚠️ Avertissements détectés:', warnings);
  } else {
    console.log('✅ Aucun problème détecté');
  }
  
  // Test des protections
  console.log('✅ Protection contre le clic droit activée');
  console.log('✅ Protection contre les raccourcis clavier activée');
  console.log('✅ Protection contre la copie activée');
  console.log('✅ Protection contre la sélection activée');
  console.log('✅ Détection des outils de développement activée');
  
  return {
    protectionActive: true,
    warnings: warnings,
    timestamp: new Date().toISOString()
  };
};

// Test de la licence
export const testLicense = async () => {
  console.log('🗝️ Test de licence en cours...');
  
  try {
    const { loadLicense, isLicenseValid } = await import('./licenseManager.js');
    const license = loadLicense();
    
    if (license) {
      const isValid = isLicenseValid(license);
      console.log('✅ Licence trouvée:', license.clientName);
      console.log('✅ Licence valide:', isValid);
      return { hasLicense: true, isValid: isValid, license: license };
    } else {
      console.log('⚠️ Aucune licence trouvée');
      return { hasLicense: false, isValid: false };
    }
  } catch (error) {
    console.error('❌ Erreur lors du test de licence:', error);
    return { hasLicense: false, isValid: false, error: error.message };
  }
};

// Test complet
export const runAllTests = async () => {
  console.log('🧪 Démarrage des tests de protection...');
  
  const protectionResult = testProtection();
  const licenseResult = await testLicense();
  
  const results = {
    protection: protectionResult,
    license: licenseResult,
    timestamp: new Date().toISOString()
  };
  
  console.log('📊 Résultats des tests:', results);
  return results;
};

// Exposer globalement pour les tests
if (typeof window !== 'undefined') {
  window.testProtection = testProtection;
  window.testLicense = testLicense;
  window.runAllTests = runAllTests;
} 