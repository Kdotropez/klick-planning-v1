import React, { useState, useEffect } from 'react';
import { versionChecker } from '../../utils/versionChecker.js';

const VersionInfo = ({ showDetails = false }) => {
  const [versionInfo, setVersionInfo] = useState(null);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    // Charger les informations de version
    loadVersionInfo();
  }, []);

  const loadVersionInfo = () => {
    const info = versionChecker.getVersionInfo();
    setVersionInfo(info);
  };

  const handleCheckUpdate = async () => {
    setIsChecking(true);
    try {
      await versionChecker.forceCheck();
      loadVersionInfo(); // Recharger les infos après vérification
    } catch (error) {
      console.error('❌ Erreur vérification manuelle:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const handleUpdate = () => {
    window.location.reload();
  };

  if (!versionInfo) {
    return (
      <div className="version-info">
        <span>Version: Chargement...</span>
      </div>
    );
  }

  return (
    <div className="version-info" style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      fontSize: '12px',
      color: '#666',
      fontFamily: 'monospace'
    }}>
      <span>v{versionInfo.current}</span>
      
      {showDetails && (
        <>
          {versionInfo.latest && versionInfo.latest !== versionInfo.current && (
            <span style={{ color: '#ff6b6b' }}>
              → v{versionInfo.latest} disponible
            </span>
          )}
          
          {versionInfo.isUpToDate && (
            <span style={{ color: '#51cf66' }}>
              ✓ À jour
            </span>
          )}
          
          <button
            onClick={handleCheckUpdate}
            disabled={isChecking}
            style={{
              background: 'transparent',
              border: '1px solid #ddd',
              borderRadius: '4px',
              padding: '2px 8px',
              fontSize: '10px',
              cursor: 'pointer',
              color: '#666'
            }}
          >
            {isChecking ? 'Vérification...' : 'Vérifier'}
          </button>
        </>
      )}
      
      {!versionInfo.isUpToDate && versionInfo.latest && (
        <button
          onClick={handleUpdate}
          style={{
            background: '#667eea',
            border: 'none',
            borderRadius: '4px',
            padding: '2px 8px',
            fontSize: '10px',
            cursor: 'pointer',
            color: 'white'
          }}
        >
          Mettre à jour
        </button>
      )}
    </div>
  );
};

export default VersionInfo;
