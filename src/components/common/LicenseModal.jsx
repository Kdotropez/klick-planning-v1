import React, { useState } from 'react';
import { 
  loadLicense, 
  isLicenseValid, 
  getLicenseInfo,
  createLicense,
  saveLicense,
  createLicenseFromKey,
  validateLicenseKeyWithMessage,
  renewProvisionalLicense,
  revokeUnlimitedLicense,
  LICENSE_TYPES 
} from '../../utils/licenseManager';

const LicenseModal = ({ isOpen, onClose, error, onLicenseValid }) => {
  const [licenseKey, setLicenseKey] = useState('');
  const [message, setMessage] = useState('');
  const [showKeyActivation, setShowKeyActivation] = useState(false);

  const handleActivateWithKey = () => {
    if (!licenseKey.trim()) {
      setMessage('Veuillez saisir une clé de licence');
      return;
    }

    console.log('🔍 Validation de la clé:', licenseKey);

    // Valider la clé avec message détaillé
    const validation = validateLicenseKeyWithMessage(licenseKey);
    console.log('🔍 Résultat validation:', validation);
    
    if (!validation.valid) {
      setMessage(`❌ ${validation.message}`);
      return;
    }

    console.log('🔍 Création de licence à partir de la clé...');

    // Créer la licence à partir de la clé (sans nom/email)
    const license = createLicenseFromKey(licenseKey, 'Client', 'client@planning-app.com');
    console.log('🔍 Licence créée:', license);
    
    if (!license) {
      setMessage('Erreur lors de la création de la licence');
      return;
    }

    if (saveLicense(license)) {
      setMessage(`✅ Licence activée avec succès ! (${validation.duration} jours)`);
      setTimeout(() => {
        onLicenseValid();
        onClose();
      }, 2000);
    } else {
      setMessage('Erreur lors de l\'activation de la licence');
    }
  };

  const handleDemoMode = () => {
    // Créer une licence démo de 30 jours
    const demoLicense = createLicense(
      LICENSE_TYPES.PROVISIONAL,
      30,
      'Utilisateur Démo',
      'demo@planning-app.com'
    );

    if (saveLicense(demoLicense)) {
      setMessage('✅ Mode démo activé ! (30 jours)');
      setTimeout(() => {
        onLicenseValid();
        onClose();
      }, 2000);
    } else {
      setMessage('❌ Erreur lors de l\'activation du mode démo');
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 10000
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '30px',
        borderRadius: '10px',
        maxWidth: '500px',
        width: '90%',
        maxHeight: '80vh',
        overflowY: 'auto'
      }}>
        <h2 style={{ 
          color: '#333', 
          marginBottom: '20px',
          textAlign: 'center'
        }}>
          🗝️ Vérification de Licence
        </h2>

        {error && (
          <div style={{
            backgroundColor: '#f8d7da',
            color: '#721c24',
            padding: '15px',
            borderRadius: '5px',
            marginBottom: '20px',
            border: '1px solid #f5c6cb'
          }}>
            <strong>⚠️ Attention :</strong> {error}
          </div>
        )}

         <div style={{ marginBottom: '20px' }}>
            <h3>Activer une Licence</h3>
            <p style={{ color: '#666', marginBottom: '15px' }}>
              Pour utiliser l'application complète, saisissez votre clé de licence :
            </p>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Clé de licence :
              </label>
              <input
                type="text"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '5px',
                  border: '1px solid #ddd',
                  fontSize: '14px',
                  fontFamily: 'monospace',
                  letterSpacing: '1px'
                }}
                placeholder="XXXX-XXX-XXXXXX-XXXX"
              />
            </div>

            <button
              onClick={handleActivateWithKey}
              style={{
                backgroundColor: '#9b59b6',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
                width: '100%',
                marginBottom: '10px'
              }}
            >
              🔑 Activer avec la Clé
            </button>
         </div>

         <div style={{ 
           borderTop: '1px solid #ddd', 
           paddingTop: '20px',
           marginBottom: '20px'
         }}>
           <h3>Mode Démo</h3>
           <p style={{ color: '#666', marginBottom: '15px' }}>
             Testez l'application gratuitement pendant 30 jours :
           </p>
           <button
             onClick={handleDemoMode}
             style={{
               backgroundColor: '#3498db',
               color: 'white',
               border: 'none',
               padding: '12px 24px',
               borderRadius: '5px',
               cursor: 'pointer',
               fontSize: '14px',
               fontWeight: 'bold',
               width: '100%'
             }}
           >
             🎯 Mode Démo (30 jours)
           </button>
         </div>

        {message && (
          <div style={{
            backgroundColor: message.includes('succès') ? '#d4edda' : '#f8d7da',
            color: message.includes('succès') ? '#155724' : '#721c24',
            padding: '10px',
            borderRadius: '5px',
            marginTop: '15px',
            textAlign: 'center'
          }}>
            {message}
          </div>
        )}

        <div style={{ 
          marginTop: '20px',
          textAlign: 'center',
          fontSize: '12px',
          color: '#666'
        }}>
          <p>© 2025 Nicolas Lefevre - Logiciel Propriétaire</p>
          <p>Tous droits réservés</p>
        </div>
      </div>
    </div>
  );
};

export default LicenseModal; 
