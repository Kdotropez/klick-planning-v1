import React, { useState, useEffect } from 'react';

// Types de licences
const LICENSE_TYPES = {
  PROVISIONAL: 'provisional',
  UNLIMITED: 'unlimited'
};

// Fonctions simplifiées intégrées
const generateLicenseKey = (type, duration = 7) => {
  const prefix = type === LICENSE_TYPES.UNLIMITED ? 'UNLIMITED' : 'PROVISIONAL';
  const durationCode = duration.toString().padStart(3, '0');
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.random().toString().slice(2, 6);
  return `${prefix}-${durationCode}-${timestamp}-${random}`.toUpperCase();
};

const createLicense = (type, duration, clientName, email) => {
  const now = new Date();
  const expiryDate = new Date(now.getTime() + (duration * 24 * 60 * 60 * 1000));
  
  return {
    id: `LIC-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 5)}`.toUpperCase(),
    type: type,
    clientName: clientName,
    email: email,
    issuedDate: now.toISOString(),
    expiryDate: expiryDate.toISOString(),
    isActive: true
  };
};

const saveLicense = (license) => {
  try {
    localStorage.setItem('currentLicense', JSON.stringify(license));
    return true;
  } catch (error) {
    console.error('Erreur lors de la sauvegarde de la licence:', error);
    return false;
  }
};

const loadLicense = () => {
  try {
    const saved = localStorage.getItem('currentLicense');
    return saved ? JSON.parse(saved) : null;
  } catch (error) {
    console.error('Erreur lors du chargement de la licence:', error);
    return null;
  }
};

const getUsedKeys = () => {
  try {
    const saved = localStorage.getItem('usedKeys');
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.error('Erreur lors du chargement des clés utilisées:', error);
    return [];
  }
};

const saveUsedKey = (key) => {
  try {
    const usedKeys = getUsedKeys();
    if (!usedKeys.includes(key)) {
      usedKeys.push(key);
      localStorage.setItem('usedKeys', JSON.stringify(usedKeys));
    }
    return true;
  } catch (error) {
    console.error('Erreur lors de la sauvegarde de la clé:', error);
    return false;
  }
};

const resetUsedKeys = () => {
  try {
    localStorage.removeItem('usedKeys');
    return true;
  } catch (error) {
    console.error('Erreur lors de la réinitialisation des clés:', error);
    return false;
  }
};

const createNicolasLicense = () => {
  const license = createLicense(
    LICENSE_TYPES.UNLIMITED,
    36500,
    'Nicolas Lefevre',
    'nicolas.lefevre@example.com'
  );
  return saveLicense(license) ? license : null;
};

const LicenseManager = () => {
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [licenseType, setLicenseType] = useState('provisional');
  const [message, setMessage] = useState('');
  const [currentLicense, setCurrentLicense] = useState(null);
  const [usedKeys, setUsedKeys] = useState([]);
  const [generatedKey, setGeneratedKey] = useState('');

  useEffect(() => {
    console.log('LicenseManager chargé');
    // Charger la licence actuelle
    const license = loadLicense();
    if (license) {
      setCurrentLicense(license);
    }

    // Charger les clés utilisées
    const keys = getUsedKeys();
    setUsedKeys(keys);
  }, []);

  const createNewLicense = () => {
    console.log('Création de licence...');
    if (!clientName || !clientEmail) {
      setMessage('❌ Veuillez remplir le nom et l\'email');
      return;
    }

    const duration = licenseType === 'provisional' ? 7 : 36500;
    const license = createLicense(licenseType, duration, clientName, clientEmail);

    if (saveLicense(license)) {
      setMessage('✅ Licence créée avec succès !');
      setCurrentLicense(license);
      setClientName('');
      setClientEmail('');
    } else {
      setMessage('❌ Erreur lors de la création de la licence');
    }
  };

  const generateKey = () => {
    console.log('Génération de clé...');
    const duration = licenseType === 'provisional' ? 7 : 36500;
    const key = generateLicenseKey(licenseType, duration);
    setGeneratedKey(key);
    setMessage('🗝️ Clé générée ! Copiez-la pour l\'envoyer au client.');
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setMessage('📋 Clé copiée dans le presse-papiers !');
    });
  };

  const clearUsedKeys = () => {
    if (window.confirm('Êtes-vous sûr de vouloir effacer toutes les clés utilisées ?')) {
      resetUsedKeys();
      setUsedKeys([]);
      setMessage('✅ Clés utilisées effacées');
    }
  };

  const createNicolasLicenseAdmin = () => {
    console.log('Création licence Nicolas...');
    const nicolasLicense = createNicolasLicense();
    if (nicolasLicense) {
      setMessage('✅ Licence Nicolas Lefevre créée avec succès !');
      setCurrentLicense(nicolasLicense);
    } else {
      setMessage('❌ Erreur lors de la création de la licence Nicolas');
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '20px', color: '#333' }}>
        🗝️ Gestionnaire de Licences
      </h1>

      {/* Message */}
      {message && (
        <div style={{
          padding: '10px',
          borderRadius: '5px',
          marginBottom: '20px',
          textAlign: 'center',
          backgroundColor: message.includes('✅') ? '#d4edda' : '#f8d7da',
          color: message.includes('✅') ? '#155724' : '#721c24',
          border: `1px solid ${message.includes('✅') ? '#c3e6cb' : '#f5c6cb'}`
        }}>
          {message}
        </div>
      )}

      {/* Licence actuelle */}
      {currentLicense && (
        <div style={{
          padding: '15px',
          backgroundColor: '#e9ecef',
          borderRadius: '5px',
          marginBottom: '20px'
        }}>
          <h3>📋 Licence Actuelle</h3>
          <p><strong>Client:</strong> {currentLicense.clientName}</p>
          <p><strong>Email:</strong> {currentLicense.email}</p>
          <p><strong>Type:</strong> {currentLicense.type}</p>
          <p><strong>Expire le:</strong> {new Date(currentLicense.expiryDate).toLocaleDateString()}</p>
          <p><strong>Statut:</strong> {currentLicense.isActive ? '✅ Active' : '❌ Inactive'}</p>
        </div>
      )}

      {/* Formulaire de création */}
      <div style={{
        padding: '20px',
        backgroundColor: '#f8f9fa',
        borderRadius: '5px',
        marginBottom: '20px'
      }}>
        <h3>🆕 Créer une nouvelle licence</h3>
        
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>Nom du client:</label>
          <input
            type="text"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ddd',
              borderRadius: '4px'
            }}
            placeholder="Nom du client"
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>Email:</label>
          <input
            type="email"
            value={clientEmail}
            onChange={(e) => setClientEmail(e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ddd',
              borderRadius: '4px'
            }}
            placeholder="email@example.com"
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>Type de licence:</label>
          <select
            value={licenseType}
            onChange={(e) => setLicenseType(e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ddd',
              borderRadius: '4px'
            }}
          >
            <option value="provisional">Provisoire (7 jours)</option>
            <option value="unlimited">Illimitée</option>
          </select>
        </div>

        <button
          onClick={createNewLicense}
          style={{
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '4px',
            cursor: 'pointer',
            marginRight: '10px'
          }}
        >
          🆕 Créer la licence
        </button>

        <button
          onClick={generateKey}
          style={{
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          🗝️ Générer une clé
        </button>
      </div>

      {/* Clé générée */}
      {generatedKey && (
        <div style={{
          padding: '15px',
          backgroundColor: '#d1ecf1',
          borderRadius: '5px',
          marginBottom: '20px'
        }}>
          <h3>🗝️ Clé générée</h3>
          <div style={{
            padding: '10px',
            backgroundColor: 'white',
            border: '1px solid #bee5eb',
            borderRadius: '4px',
            fontFamily: 'monospace',
            fontSize: '14px',
            wordBreak: 'break-all'
          }}>
            {generatedKey}
          </div>
          <button
            onClick={() => copyToClipboard(generatedKey)}
            style={{
              backgroundColor: '#17a2b8',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
              marginTop: '10px'
            }}
          >
            📋 Copier
          </button>
        </div>
      )}

      {/* Clés utilisées */}
      <div style={{
        padding: '20px',
        backgroundColor: '#fff3cd',
        borderRadius: '5px',
        marginBottom: '20px'
      }}>
        <h3>📋 Clés utilisées ({usedKeys.length})</h3>
        {usedKeys.length > 0 ? (
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {usedKeys.map((key, index) => (
              <div key={index} style={{
                padding: '5px',
                backgroundColor: 'white',
                margin: '5px 0',
                borderRadius: '3px',
                fontFamily: 'monospace',
                fontSize: '12px'
              }}>
                {key}
              </div>
            ))}
          </div>
        ) : (
          <p>Aucune clé utilisée</p>
        )}
        <button
          onClick={clearUsedKeys}
          style={{
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer',
            marginTop: '10px'
          }}
        >
          🗑️ Effacer toutes les clés
        </button>
      </div>

      {/* Actions spéciales */}
      <div style={{
        padding: '20px',
        backgroundColor: '#d4edda',
        borderRadius: '5px'
      }}>
        <h3>⚙️ Actions spéciales</h3>
        <button
          onClick={createNicolasLicenseAdmin}
          style={{
            backgroundColor: '#6f42c1',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          👑 Créer licence Nicolas Lefevre
        </button>
      </div>
    </div>
  );
};

export default LicenseManager; 