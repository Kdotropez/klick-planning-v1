import React, { useState, useEffect } from 'react';
import Button from './common/Button';

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

// Composant LicenseManager intégré
const LicenseManager = () => {
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [licenseType, setLicenseType] = useState('provisional');
  const [duration, setDuration] = useState(7);
  const [generatedKey, setGeneratedKey] = useState('');
  const [currentLicense, setCurrentLicense] = useState(null);
  const [usedKeys, setUsedKeys] = useState([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const license = loadLicense();
    if (license) {
      setCurrentLicense(license);
    }
    setUsedKeys(getUsedKeys());
  }, []);

  const createNewLicense = () => {
    if (!clientName || !clientEmail) {
      setMessage('Veuillez remplir tous les champs');
      return;
    }

    const license = createLicense(licenseType, duration, clientName, clientEmail);
    if (saveLicense(license)) {
      setCurrentLicense(license);
      setMessage('Licence créée avec succès !');
      setClientName('');
      setClientEmail('');
    } else {
      setMessage('Erreur lors de la création de la licence');
    }
  };

  const generateKey = () => {
    const key = generateLicenseKey(licenseType, duration);
    setGeneratedKey(key);
    setMessage('Clé générée avec succès !');
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setMessage('Copié dans le presse-papiers !');
  };

  const clearUsedKeys = () => {
    if (resetUsedKeys()) {
      setUsedKeys([]);
      setMessage('Clés utilisées réinitialisées !');
    }
  };

  const createNicolasLicenseAdmin = () => {
    const license = createLicense(
      LICENSE_TYPES.UNLIMITED,
      36500,
      'Nicolas Lefevre',
      'nicolas.lefevre@example.com'
    );
    if (saveLicense(license)) {
      setCurrentLicense(license);
      setMessage('Licence Nicolas créée avec succès !');
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ marginBottom: '20px' }}>
        <h3>📋 Créer une nouvelle licence</h3>
        <div style={{ marginBottom: '10px' }}>
          <input
            type="text"
            placeholder="Nom du client"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            style={{ width: '100%', padding: '8px', marginBottom: '5px' }}
          />
        </div>
        <div style={{ marginBottom: '10px' }}>
          <input
            type="email"
            placeholder="Email du client"
            value={clientEmail}
            onChange={(e) => setClientEmail(e.target.value)}
            style={{ width: '100%', padding: '8px', marginBottom: '5px' }}
          />
        </div>
        <div style={{ marginBottom: '10px' }}>
          <select
            value={licenseType}
            onChange={(e) => setLicenseType(e.target.value)}
            style={{ width: '100%', padding: '8px', marginBottom: '5px' }}
          >
            <option value="provisional">Provisoire</option>
            <option value="unlimited">Illimitée</option>
          </select>
        </div>
        <div style={{ marginBottom: '10px' }}>
          <input
            type="number"
            placeholder="Durée en jours"
            value={duration}
            onChange={(e) => setDuration(parseInt(e.target.value) || 7)}
            style={{ width: '100%', padding: '8px', marginBottom: '5px' }}
          />
        </div>
        <button
          onClick={createNewLicense}
          style={{
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '5px',
            cursor: 'pointer',
            marginRight: '10px'
          }}
        >
          Créer licence
        </button>
        <button
          onClick={generateKey}
          style={{
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          Générer clé
        </button>
      </div>

      {generatedKey && (
        <div style={{ marginBottom: '20px' }}>
          <h3>🔑 Clé générée</h3>
          <div style={{ 
            backgroundColor: '#f8f9fa', 
            padding: '10px', 
            borderRadius: '5px',
            fontFamily: 'monospace',
            marginBottom: '10px'
          }}>
            {generatedKey}
          </div>
          <button
            onClick={() => copyToClipboard(generatedKey)}
            style={{
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            Copier
          </button>
        </div>
      )}

      {currentLicense && (
        <div style={{ marginBottom: '20px' }}>
          <h3>📄 Licence actuelle</h3>
          <div style={{ 
            backgroundColor: '#e9ecef', 
            padding: '15px', 
            borderRadius: '5px',
            fontSize: '14px'
          }}>
            <p><strong>Client:</strong> {currentLicense.clientName}</p>
            <p><strong>Email:</strong> {currentLicense.email}</p>
            <p><strong>Type:</strong> {currentLicense.type}</p>
            <p><strong>Expire le:</strong> {new Date(currentLicense.expiryDate).toLocaleDateString()}</p>
            <p><strong>Statut:</strong> {currentLicense.isActive ? '✅ Actif' : '❌ Inactif'}</p>
          </div>
        </div>
      )}

      <div style={{ marginBottom: '20px' }}>
        <h3>🗑️ Clés utilisées ({usedKeys.length})</h3>
        <button
          onClick={clearUsedKeys}
          style={{
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          Réinitialiser
        </button>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3>👑 Admin</h3>
        <button
          onClick={createNicolasLicenseAdmin}
          style={{
            backgroundColor: '#ffc107',
            color: 'black',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          Créer licence Nicolas
        </button>
      </div>

      {message && (
        <div style={{
          backgroundColor: '#d4edda',
          color: '#155724',
          padding: '10px',
          borderRadius: '5px',
          marginTop: '10px'
        }}>
          {message}
        </div>
      )}
    </div>
  );
};

const StartupScreen = ({ onNewPlanning, onImportPlanning, onExit, onClearLocalStorage }) => {
  const [showLicenseManager, setShowLicenseManager] = useState(false);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      onImportPlanning(file);
    }
  };

  // Si le gestionnaire de licences est affiché
  if (showLicenseManager) {
    console.log('Affichage du gestionnaire de licences');
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        zIndex: 10000,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '20px'
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '10px',
          maxWidth: '800px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          position: 'relative'
        }}>
          <button
            onClick={() => setShowLicenseManager(false)}
            style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              background: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '30px',
              height: '30px',
              cursor: 'pointer',
              fontSize: '16px',
              zIndex: 10001
            }}
          >
            ×
          </button>
          <div style={{ padding: '20px' }}>
            <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>
              🗝️ Gestionnaire de Licences
            </h2>
            <p style={{ textAlign: 'center', marginBottom: '20px' }}>
              Le gestionnaire se charge...
            </p>
            <LicenseManager />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="startup-screen" style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: '#f5f5f5',
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '10px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        textAlign: 'center',
        maxWidth: '500px',
        width: '100%'
      }}>
        <h1 style={{
          color: '#333',
          marginBottom: '30px',
          fontSize: '2.5rem'
        }}>
          Planning App
        </h1>
        
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>
          <Button 
            onClick={onNewPlanning}
            style={{
              padding: '15px 30px',
              fontSize: '1.1rem',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            Nouveau planning
          </Button>
          
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '10px'
          }}>
            <span style={{ color: '#666' }}>ou</span>
            
            <label style={{
              padding: '15px 30px',
              fontSize: '1.1rem',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              display: 'inline-block'
            }}>
              Importer planning
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        </div>
        
        <p style={{
          marginTop: '30px',
          color: '#666',
          fontSize: '0.9rem'
        }}>
          Importez un fichier de sauvegarde (.json) depuis votre clé USB
        </p>

        <div style={{
          marginTop: '30px',
          paddingTop: '20px',
          borderTop: '1px solid #eee',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <Button
            onClick={onExit}
            style={{
              padding: '10px 20px',
              fontSize: '1rem',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            Quitter l'application
          </Button>
          
          <Button
            onClick={onClearLocalStorage}
            style={{
              padding: '10px 20px',
              fontSize: '1rem',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            🗑️ Effacer toutes les données
          </Button>

          {/* Bouton secret pour accéder au gestionnaire de licences */}
          <Button
            onClick={() => setShowLicenseManager(true)}
            style={{
              padding: '10px 20px',
              fontSize: '1rem',
              backgroundColor: '#9C27B0',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              opacity: '0.8'
            }}
          >
            🗝️ Gestionnaire de Licences
          </Button>
        </div>
      </div>
    </div>
  );
};

export default StartupScreen; 