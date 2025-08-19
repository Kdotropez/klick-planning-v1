import React, { useState, useEffect } from 'react';

const CopyrightNotice = () => {
  const [version, setVersion] = useState('3.8.6');

  useEffect(() => {
    // Charger la version depuis le fichier version.json
    fetch('/version.json')
      .then(response => response.json())
      .then(data => setVersion(data.version))
      .catch(error => {
        console.error('Erreur chargement version:', error);
        setVersion('3.8.6'); // Version par défaut
      });
  }, []);

  return (
    <div style={{
      position: 'fixed',
      bottom: '10px',
      right: '10px',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      color: 'white',
      padding: '8px 12px',
      borderRadius: '4px',
      fontSize: '11px',
      zIndex: 1000,
      fontFamily: 'monospace'
    }}>
      © 2025 Nicolas Lefevre - Propriétaire — v{version}
    </div>
  );
};

export default CopyrightNotice; 