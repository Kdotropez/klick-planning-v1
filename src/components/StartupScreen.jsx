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
      setMessage('Clés utilisées effacées !');
    } else {
      setMessage('Erreur lors de l\'effacement');
    }
  };

  const createNicolasLicenseAdmin = () => {
    const adminLicense = createLicense('unlimited', 365, 'Nicolas Admin', 'admin@klick.com');
    if (saveLicense(adminLicense)) {
      setCurrentLicense(adminLicense);
      setMessage('Licence admin créée avec succès !');
    } else {
      setMessage('Erreur lors de la création de la licence admin');
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>
        🗝️ Gestionnaire de Licences
      </h2>
      
      {message && (
        <div style={{
          padding: '10px',
          marginBottom: '20px',
          backgroundColor: message.includes('succès') ? '#d4edda' : '#f8d7da',
          color: message.includes('succès') ? '#155724' : '#721c24',
          borderRadius: '5px',
          textAlign: 'center'
        }}>
          {message}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Création de licence */}
        <div style={{
          padding: '20px',
          border: '1px solid #ddd',
          borderRadius: '8px',
          backgroundColor: '#f8f9fa'
        }}>
          <h3 style={{ marginBottom: '15px' }}>Créer une nouvelle licence</h3>
          
          <div style={{ marginBottom: '10px' }}>
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
            />
          </div>
          
          <div style={{ marginBottom: '10px' }}>
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
            />
          </div>
          
          <div style={{ marginBottom: '10px' }}>
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
              <option value="provisional">Provisoire</option>
              <option value="unlimited">Illimitée</option>
            </select>
          </div>
          
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Durée (jours):</label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value))}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
            />
          </div>
          
          <button
            onClick={createNewLicense}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Créer la licence
          </button>
        </div>

        {/* Génération de clé */}
        <div style={{
          padding: '20px',
          border: '1px solid #ddd',
          borderRadius: '8px',
          backgroundColor: '#f8f9fa'
        }}>
          <h3 style={{ marginBottom: '15px' }}>Générer une clé</h3>
          
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Type:</label>
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
              <option value="provisional">Provisoire</option>
              <option value="unlimited">Illimitée</option>
            </select>
          </div>
          
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Durée (jours):</label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value))}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
            />
          </div>
          
          <button
            onClick={generateKey}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginBottom: '10px'
            }}
          >
            Générer la clé
          </button>
          
          {generatedKey && (
            <div>
              <p style={{ marginBottom: '5px' }}>Clé générée:</p>
              <div style={{
                padding: '8px',
                backgroundColor: '#e9ecef',
                borderRadius: '4px',
                fontFamily: 'monospace',
                fontSize: '12px',
                wordBreak: 'break-all'
              }}>
                {generatedKey}
              </div>
              <button
                onClick={() => copyToClipboard(generatedKey)}
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  marginTop: '10px'
                }}
              >
                Copier
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Licence actuelle */}
      {currentLicense && (
        <div style={{
          marginTop: '20px',
          padding: '20px',
          border: '1px solid #28a745',
          borderRadius: '8px',
          backgroundColor: '#d4edda'
        }}>
          <h3 style={{ marginBottom: '15px' }}>Licence actuelle</h3>
          <p><strong>Client:</strong> {currentLicense.clientName}</p>
          <p><strong>Email:</strong> {currentLicense.email}</p>
          <p><strong>Type:</strong> {currentLicense.type}</p>
          <p><strong>Expire le:</strong> {new Date(currentLicense.expiryDate).toLocaleDateString()}</p>
          <p><strong>Statut:</strong> {currentLicense.isActive ? 'Active' : 'Inactive'}</p>
        </div>
      )}

      {/* Clés utilisées */}
      <div style={{
        marginTop: '20px',
        padding: '20px',
        border: '1px solid #ddd',
        borderRadius: '8px',
        backgroundColor: '#f8f9fa'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h3 style={{ margin: '0' }}>Clés utilisées ({usedKeys.length})</h3>
          <button
            onClick={clearUsedKeys}
            style={{
              padding: '5px 10px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Effacer
          </button>
        </div>
        
        {usedKeys.length > 0 ? (
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {usedKeys.map((key, index) => (
              <div key={index} style={{
                padding: '5px',
                backgroundColor: '#e9ecef',
                marginBottom: '5px',
                borderRadius: '4px',
                fontFamily: 'monospace',
                fontSize: '12px'
              }}>
                {key}
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: '#666', fontStyle: 'italic' }}>Aucune clé utilisée</p>
        )}
      </div>

      {/* Bouton admin */}
      <div style={{ marginTop: '20px', textAlign: 'center' }}>
        <button
          onClick={createNicolasLicenseAdmin}
          style={{
            padding: '10px 20px',
            backgroundColor: '#9C27B0',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Créer licence admin Nicolas
        </button>
      </div>
    </div>
  );
};

const StartupScreen = ({ onNewPlanning, onImportPlanning, onExit, onClearLocalStorage, onBackToMain }) => {
  const [showLicenseManager, setShowLicenseManager] = useState(false);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      onImportPlanning(file);
    }
  };

  // Si le gestionnaire de licences est affiché
  if (showLicenseManager) {
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
          <LicenseManager />
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f5f5f5',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: 'white',
        padding: '20px 30px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <button
          onClick={onBackToMain}
          style={{
            background: 'linear-gradient(135deg, #6c757d 0%, #495057 100%)',
            color: 'white',
            padding: '12px 24px',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '14px',
            transition: 'all 0.3s ease'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #495057 0%, #343a40 100%)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #6c757d 0%, #495057 100%)';
          }}
        >
          ⬅️ Retour
        </button>
        
        <h1 style={{
          color: '#333',
          fontSize: '2.2rem',
          margin: '0',
          fontWeight: '700'
        }}>
          Planning App
        </h1>
        
        <div style={{ width: '100px' }}></div>
      </div>

      {/* Main Content */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '40px 20px'
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '40px',
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          textAlign: 'center',
          maxWidth: '600px',
          width: '100%'
        }}>
          
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '15px'
          }}>
            <Button 
              onClick={onNewPlanning}
              style={{
                padding: '20px 40px',
                fontSize: '1.3rem',
                background: 'linear-gradient(135deg, #007bff 0%, #0056b3 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer',
                fontWeight: '600',
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 15px rgba(0, 123, 255, 0.3)'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 123, 255, 0.4)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 15px rgba(0, 123, 255, 0.3)';
              }}
            >
              🆕 Nouveau planning
            </Button>
            

            
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px'
            }}>
              <span style={{ color: '#666' }}>ou</span>
              
              <label style={{
                padding: '20px 40px',
                fontSize: '1.3rem',
                background: 'linear-gradient(135deg, #28a745 0%, #1e7e34 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer',
                display: 'inline-block',
                fontWeight: '600',
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 15px rgba(40, 167, 69, 0.3)'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(40, 167, 69, 0.4)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 15px rgba(40, 167, 69, 0.3)';
              }}
              >
                📁 Importer planning
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
          </div>

          <div style={{
            marginTop: '30px',
            paddingTop: '20px',
            borderTop: '1px solid #eee',
            display: 'flex',
            justifyContent: 'center',
            gap: '15px',
            flexWrap: 'wrap'
          }}>
            <Button
              onClick={onExit}
              style={{
                padding: '12px 24px',
                fontSize: '1rem',
                background: 'linear-gradient(135deg, #6c757d 0%, #495057 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '500',
                transition: 'all 0.3s ease'
              }}
            >
              🚪 Quitter
            </Button>
            
            <Button
              onClick={onClearLocalStorage}
              style={{
                padding: '12px 24px',
                fontSize: '1rem',
                background: 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '500',
                transition: 'all 0.3s ease'
              }}
            >
              🗑️ Effacer données
            </Button>

            <Button
              onClick={() => setShowLicenseManager(true)}
              style={{
                padding: '12px 24px',
                fontSize: '1rem',
                background: 'linear-gradient(135deg, #9C27B0 0%, #7B1FA2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '500',
                transition: 'all 0.3s ease',
                opacity: '0.8'
              }}
            >
              🗝️ Licences
            </Button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        backgroundColor: 'white',
        padding: '15px 30px',
        borderTop: '1px solid #eee',
        textAlign: 'center',
        color: '#666',
        fontSize: '0.9rem'
      }}>
        <p style={{ margin: '0' }}>
          Importez un fichier de sauvegarde (.json) depuis votre clé USB
        </p>
      </div>
    </div>
  );
};

export default StartupScreen; 