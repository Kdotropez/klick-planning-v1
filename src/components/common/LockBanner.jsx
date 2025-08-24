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

  // Fonction pour nettoyer le verrou d'urgence
  const handleEmergencyCleanup = async () => {
    try {
      // Code du jour au format JJMM
      const today = new Date();
      const day = String(today.getDate()).padStart(2, '0');
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const pin = day + month;
      
      console.log('Tentative de nettoyage d\'urgence avec PIN:', pin);
      
      // Appeler la fonction d'urgence avec le code du jour
      const success = await onEmergency(pin);
      
      if (success) {
        console.log('Nettoyage d\'urgence réussi');
        alert('✅ Verrou libéré avec succès ! Vous avez maintenant le contrôle.');
      } else {
        console.log('Nettoyage d\'urgence échoué');
        alert('❌ Échec du nettoyage d\'urgence. Vérifiez que le code du jour est correct.');
      }
    } catch (error) {
      console.error('Erreur lors du nettoyage d\'urgence:', error);
      alert('❌ Erreur lors du nettoyage d\'urgence: ' + error.message);
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
          <>
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
            
            <button
              onClick={handleEmergencyCleanup}
              style={{
                padding: '6px 12px',
                border: '1px solid #FF5722',
                borderRadius: '4px',
                backgroundColor: '#FF5722',
                color: 'white',
                cursor: 'pointer',
                fontSize: '0.9em'
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = '#E64A19'}
              onMouseOut={(e) => e.target.style.backgroundColor = '#FF5722'}
            >
              🔧 Nettoyage auto
            </button>
          </>
        )}
      </div>
    </div>
  );
}
