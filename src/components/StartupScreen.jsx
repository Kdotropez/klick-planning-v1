import React, { useState } from 'react';
import Button from './common/Button';
import LicenseManager from './admin/LicenseManager';

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