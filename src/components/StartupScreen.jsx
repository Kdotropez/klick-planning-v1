import React, { useState, useEffect } from 'react';
import Button from './common/Button';
import { listRemoteShops, listRemoteWeeksForShop, loadRemotePlanning } from '../utils/remoteStore';

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

const StartupScreen = ({ onNewPlanning, onImportPlanning, onExit, onClearLocalStorage, onBackToMain, onStartWithShop }) => {
  const [showLicenseManager, setShowLicenseManager] = useState(false);
  const [availableShops, setAvailableShops] = useState([]);
  const [selectedShopId, setSelectedShopId] = useState('');
  const [remoteShops, setRemoteShops] = useState([]);
  const [selectedRemoteShopId, setSelectedRemoteShopId] = useState('');

  useEffect(() => {
    // Charger les boutiques depuis planningData (localStorage)
    try {
      const saved = localStorage.getItem('planningData');
      if (saved) {
        const data = JSON.parse(saved);
        const shops = Array.isArray(data?.shops) ? data.shops.filter(s => s && s.id && s.name) : [];
        setAvailableShops(shops);
        if (shops.length > 0) setSelectedShopId(shops[0].id);
      }
    } catch (_) {}
  }, []);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      onImportPlanning(file);
    }
  };

  const handleRestoreFromSupabase = async () => {
    try {
      console.log('🔄 Restauration depuis Supabase...');
      
      // Lister les boutiques disponibles
      const shops = await listRemoteShops();
      if (shops.length === 0) {
        alert('Aucune boutique trouvée dans Supabase.');
        return;
      }
      
      // Pour l'instant, on prend la première boutique
      const shopId = shops[0];
      console.log('🏪 Boutique sélectionnée:', shopId);
      
      // Lister les semaines disponibles pour cette boutique
      const weeks = await listRemoteWeeksForShop(shopId);
      if (weeks.length === 0) {
        alert('Aucune semaine trouvée pour cette boutique dans Supabase.');
        return;
      }
      
      // Prendre la semaine la plus récente
      const weekKey = weeks[weeks.length - 1];
      console.log('📅 Semaine sélectionnée:', weekKey);
      
      // Charger les données
      const planningData = await loadRemotePlanning(shopId, weekKey);
      if (!planningData) {
        alert('Impossible de charger les données depuis Supabase.');
        return;
      }
      
      console.log('✅ Données chargées depuis Supabase:', planningData);
      
      // Sauvegarder en local et continuer
      localStorage.setItem('planningData', JSON.stringify(planningData));
      localStorage.setItem('selectedShopId', shopId);
      localStorage.setItem('selectedWeek', weekKey);
      
      // Rediriger vers le planning
      window.location.reload();
      
    } catch (error) {
      console.error('❌ Erreur lors de la restauration depuis Supabase:', error);
      alert('Erreur lors de la restauration depuis Supabase: ' + error.message);
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
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative'
    }}>
      
      {/* Background Pattern */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.3) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.3) 0%, transparent 50%)',
        pointerEvents: 'none'
      }}></div>

      {/* Header */}
      <div style={{
        padding: '30px 40px',
        textAlign: 'center',
        color: 'white',
        position: 'relative',
        zIndex: 1
      }}>


        <h1 style={{
          fontSize: '3.5rem',
          fontWeight: '800',
          margin: '0 0 15px 0',
          textShadow: '0 4px 8px rgba(0,0,0,0.3)',
          letterSpacing: '3px',
          background: 'linear-gradient(45deg, #ffffff, #f0f0f0)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}>
          📅 Klick Planning
        </h1>
        <p style={{
          fontSize: '1.4rem',
          margin: '0',
          opacity: '0.9',
          fontWeight: '400',
          textShadow: '0 2px 4px rgba(0,0,0,0.2)'
        }}>
          Gestion professionnelle de planning multi-boutiques avec employés communs
        </p>
      </div>

      {/* Main Content */}
      <div style={{
        flex: 1,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '40px',
        position: 'relative',
        zIndex: 1
      }}>
        <div style={{
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          padding: '50px 40px',
          borderRadius: '25px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.2)',
          textAlign: 'center',
          maxWidth: '700px',
          width: '100%',
          border: '1px solid rgba(255, 255, 255, 0.3)'
        }}>
          
          <div style={{
            fontSize: '80px',
            marginBottom: '30px',
            filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.2))'
          }}>
            🚀
          </div>
          
          <h2 style={{
            fontSize: '2.2rem',
            fontWeight: '700',
            color: '#333',
            margin: '0 0 20px 0',
            letterSpacing: '1px'
          }}>
            Gestion Multi-Boutiques
          </h2>
          
          <p style={{
            fontSize: '1.1rem',
            color: '#666',
            margin: '0 0 40px 0',
            lineHeight: '1.6'
          }}>
            Créez un nouveau planning multi-boutiques ou importez un planning existant pour gérer vos employés communs
          </p>
          
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            alignItems: 'center'
          }}>
            <Button 
              onClick={onNewPlanning}
              style={{
                padding: '25px 50px',
                fontSize: '1.4rem',
                background: 'linear-gradient(135deg, #28a745 0%, #1e7e34 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '15px',
                cursor: 'pointer',
                fontWeight: '700',
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: '0 8px 25px rgba(40, 167, 69, 0.3)',
                minWidth: '300px',
                position: 'relative',
                overflow: 'hidden'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-5px) scale(1.02)';
                e.currentTarget.style.boxShadow = '0 15px 35px rgba(40, 167, 69, 0.4)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                e.currentTarget.style.boxShadow = '0 8px 25px rgba(40, 167, 69, 0.3)';
              }}
            >
              <span style={{ fontSize: '1.6rem', marginRight: '10px' }}>✨</span>
              Créer un nouveau planning
            </Button>
            
            {/* Démarrer sur une boutique existante */}
            {availableShops.length > 0 && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                alignItems: 'center',
                width: '100%'
              }}>
                <div style={{ color: '#666', fontWeight: 600 }}>Ou démarrer directement sur une boutique existante</div>
                <select
                  value={selectedShopId}
                  onChange={(e) => setSelectedShopId(e.target.value)}
                  style={{
                    padding: '12px 16px',
                    fontSize: '16px',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    minWidth: '260px'
                  }}
                >
                  {availableShops.map(shop => (
                    <option key={shop.id} value={shop.id}>{shop.name}</option>
                  ))}
                </select>
                <Button
                  onClick={() => {
                    if (typeof onStartWithShop === 'function' && selectedShopId) {
                      onStartWithShop(selectedShopId);
                    }
                  }}
                  style={{
                    padding: '14px 28px',
                    fontSize: '1.1rem',
                    background: 'linear-gradient(135deg, #17a2b8 0%, #138496 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontWeight: '700',
                    minWidth: '260px'
                  }}
                >
                  ▶️ Démarrer sur cette boutique
                </Button>
              </div>
            )}

            {/* Restaurer depuis Supabase */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              alignItems: 'center',
              width: '100%'
            }}>
              <div style={{ color: '#666', fontWeight: 600 }}>Restaurer depuis Supabase (centralisé)</div>
              {remoteShops.length === 0 ? (
                <Button
                  onClick={async () => {
                    try {
                      const shops = await listRemoteShops();
                      setRemoteShops(shops);
                      if (shops.length > 0) setSelectedRemoteShopId(shops[0]);
                    } catch (_) {}
                  }}
                  style={{
                    padding: '12px 20px',
                    background: 'linear-gradient(135deg, #20c997 0%, #17a2b8 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '700',
                    minWidth: '260px'
                  }}
                >
                  🔄 Charger les boutiques Supabase
                </Button>
              ) : (
                <>
                  <select
                    value={selectedRemoteShopId}
                    onChange={(e) => setSelectedRemoteShopId(e.target.value)}
                    style={{
                      padding: '12px 16px',
                      fontSize: '16px',
                      border: '1px solid #ddd',
                      borderRadius: '8px',
                      minWidth: '260px'
                    }}
                  >
                    {remoteShops.map(id => (
                      <option key={id} value={id}>{id}</option>
                    ))}
                  </select>
                  <Button
                    onClick={() => {
                      if (typeof onStartWithShop === 'function' && selectedRemoteShopId) {
                        onStartWithShop(selectedRemoteShopId);
                      }
                    }}
                    style={{
                      padding: '12px 20px',
                      background: 'linear-gradient(135deg, #0d6efd 0%, #0b5ed7 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: '700',
                      minWidth: '260px'
                    }}
                  >
                    ☁️ Démarrer sur cette boutique (Supabase)
                  </Button>
                </>
              )}
            </div>


            
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '20px',
              margin: '20px 0'
            }}>
              <div style={{
                flex: 1,
                height: '1px',
                background: 'linear-gradient(90deg, transparent, #ddd, transparent)'
              }}></div>
              <span style={{ 
                color: '#666', 
                fontSize: '1.1rem',
                fontWeight: '500',
                padding: '0 20px'
              }}>ou</span>
              <div style={{
                flex: 1,
                height: '1px',
                background: 'linear-gradient(90deg, transparent, #ddd, transparent)'
              }}></div>
            </div>
            
            <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <label style={{
                padding: '20px 40px',
                fontSize: '1.2rem',
                background: 'linear-gradient(135deg, #6c757d 0%, #495057 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                display: 'inline-block',
                fontWeight: '600',
                transition: 'all 0.3s ease',
                boxShadow: '0 6px 20px rgba(108, 117, 125, 0.3)',
                minWidth: '250px'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-3px)';
                e.currentTarget.style.boxShadow = '0 10px 25px rgba(108, 117, 125, 0.4)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(108, 117, 125, 0.3)';
              }}
              >
                <span style={{ fontSize: '1.4rem', marginRight: '10px' }}>📁</span>
                Importer un planning
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
              </label>
              
              <Button
                onClick={handleRestoreFromSupabase}
                style={{
                  padding: '20px 40px',
                  fontSize: '1.2rem',
                  background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  display: 'inline-block',
                  fontWeight: '600',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 6px 20px rgba(40, 167, 69, 0.3)',
                  minWidth: '250px'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.boxShadow = '0 10px 25px rgba(40, 167, 69, 0.4)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(40, 167, 69, 0.3)';
                }}
              >
                <span style={{ fontSize: '1.4rem', marginRight: '10px' }}>☁️</span>
                Restaurer depuis Supabase
              </Button>
            </div>
          </div>

          <div style={{
            marginTop: '40px',
            paddingTop: '30px',
            borderTop: '1px solid rgba(0,0,0,0.1)',
            display: 'flex',
            justifyContent: 'center',
            gap: '12px',
            flexWrap: 'wrap'
          }}>
            <Button
              onClick={onExit}
              style={{
                padding: '10px 20px',
                fontSize: '0.9rem',
                background: 'rgba(108, 117, 125, 0.1)',
                color: '#666',
                border: '1px solid rgba(108, 117, 125, 0.2)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '500',
                transition: 'all 0.3s ease'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'rgba(108, 117, 125, 0.2)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'rgba(108, 117, 125, 0.1)';
              }}
            >
              🚪 Quitter
            </Button>
            
            <Button
              onClick={onClearLocalStorage}
              style={{
                padding: '10px 20px',
                fontSize: '0.9rem',
                background: 'rgba(220, 53, 69, 0.1)',
                color: '#dc3545',
                border: '1px solid rgba(220, 53, 69, 0.2)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '500',
                transition: 'all 0.3s ease'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'rgba(220, 53, 69, 0.2)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'rgba(220, 53, 69, 0.1)';
              }}
            >
              🗑️ Effacer données
            </Button>

            <Button
              onClick={() => setShowLicenseManager(true)}
              style={{
                padding: '10px 20px',
                fontSize: '0.9rem',
                background: 'rgba(156, 39, 176, 0.1)',
                color: '#9C27B0',
                border: '1px solid rgba(156, 39, 176, 0.2)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '500',
                transition: 'all 0.3s ease'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'rgba(156, 39, 176, 0.2)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'rgba(156, 39, 176, 0.1)';
              }}
            >
              🗝️ Licences
            </Button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        padding: '20px 40px',
        textAlign: 'center',
        color: 'rgba(255,255,255,0.8)',
        fontSize: '0.9rem',
        position: 'relative',
        zIndex: 1
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '30px',
          flexWrap: 'wrap',
          marginBottom: '10px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.9rem'
          }}>
            <span style={{ fontSize: '1rem' }}>⚡</span>
            <span>Performance optimisée</span>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.9rem'
          }}>
            <span style={{ fontSize: '1rem' }}>🔒</span>
            <span>Sécurisé et fiable</span>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.9rem'
          }}>
            <span style={{ fontSize: '1rem' }}>📱</span>
            <span>Interface responsive</span>
          </div>
        </div>
        
        <p style={{
          margin: '0',
          fontSize: '0.85rem',
          opacity: '0.7'
        }}>
          Importez un fichier de sauvegarde (.json) depuis votre clé USB pour restaurer vos données
        </p>
        
        <div style={{
          marginTop: '15px',
          paddingTop: '15px',
          borderTop: '1px solid rgba(255,255,255,0.2)',
          fontSize: '0.8rem',
          opacity: '0.6'
        }}>
          © 2025 Nicolas Lefevre - Tous droits réservés
        </div>
      </div>
    </div>
  );
};

export default StartupScreen; 