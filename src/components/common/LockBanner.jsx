// src/components/common/LockBanner.jsx
import React from 'react';

export default function LockBanner({ status, lockInfo, onRelease, onEmergency }) {
  const getStatusColor = () => {
    switch (status) {
      case 'owner': return '#4CAF50';
      case 'readonly': return '#FF9800';
      case 'lost': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'owner': return 'Contrôle complet';
      case 'readonly': return 'Lecture seule';
      case 'lost': return 'Verrou perdu';
      default: return 'Chargement...';
    }
  };

  return (
    <div style={{
      padding: '12px 16px',
      border: `2px solid ${getStatusColor()}`,
      borderRadius: '8px',
      marginBottom: '16px',
      backgroundColor: `${getStatusColor()}10`,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: '12px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          backgroundColor: getStatusColor(),
          flexShrink: 0
        }} />
        <div>
          <strong style={{ color: getStatusColor() }}>{getStatusText()}</strong>
          {status === 'owner' && (
            <span style={{ marginLeft: '8px', fontSize: '0.9em', color: '#666' }}>
              — Vous éditez ce planning
            </span>
          )}
          {status === 'readonly' && lockInfo?.holder && (
            <span style={{ marginLeft: '8px', fontSize: '0.9em', color: '#666' }}>
              — Utilisé par <em>{lockInfo.holder}</em>
            </span>
          )}
          {status === 'lost' && (
            <span style={{ marginLeft: '8px', fontSize: '0.9em', color: '#666' }}>
              — Tentative de récupération automatique...
            </span>
          )}
        </div>
      </div>
      
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {status === 'owner' && (
          <button
            onClick={onRelease}
            style={{
              padding: '6px 12px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              backgroundColor: '#fff',
              cursor: 'pointer',
              fontSize: '0.9em'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#f5f5f5'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#fff'}
          >
            Relâcher la main
          </button>
        )}
        
        {status !== 'owner' && (
          <button
            onClick={() => {
              const pin = prompt('Code JJMM pour déverrouillage d\'urgence :');
              if (pin) onEmergency(pin);
            }}
            style={{
              padding: '6px 12px',
              border: '1px solid #F44336',
              borderRadius: '4px',
              backgroundColor: '#F44336',
              color: 'white',
              cursor: 'pointer',
              fontSize: '0.9em'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#D32F2F'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#F44336'}
          >
            🚨 Déverrouillage d'urgence
          </button>
        )}
      </div>
    </div>
  );
}
