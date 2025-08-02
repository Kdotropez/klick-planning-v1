// Script pour créer une licence complète - Nicolas Lefevre
// Copyright (c) 2025 Nicolas Lefevre. Tous droits réservés.

import { createLicense, saveLicense, LICENSE_TYPES } from './licenseManager.js';

// Créer une licence complète illimitée pour Nicolas Lefevre
const createFullLicense = () => {
  const fullLicense = createLicense(
    LICENSE_TYPES.UNLIMITED,    // Type illimité
    36500,                 // 100 ans (pratiquement illimité)
    'Nicolas Lefevre',     // Votre nom
    'nicolas@planning-app.com'  // Votre email
  );

  if (saveLicense(fullLicense)) {
    console.log('✅ Licence complète créée avec succès !');
    console.log('ID:', fullLicense.id);
    console.log('Type:', fullLicense.type);
    console.log('Expire le:', new Date(fullLicense.expiryDate).toLocaleDateString('fr-FR'));
    console.log('Fonctionnalités:', fullLicense.features);
    
    // Recharger la page pour appliquer la licence
    setTimeout(() => {
      window.location.reload();
    }, 2000);
  } else {
    console.error('❌ Erreur lors de la création de la licence');
  }
};

// Exposer la fonction globalement pour l'utiliser dans la console
window.createFullLicense = createFullLicense;

// Instructions d'utilisation
console.log('🗝️ Pour créer votre licence complète :');
console.log('1. Ouvrez la console du navigateur (F12)');
console.log('2. Tapez : createFullLicense()');
console.log('3. La licence sera créée et la page rechargée automatiquement');

export { createFullLicense }; 