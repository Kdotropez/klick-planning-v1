import React, { useState, useEffect } from 'react';
import { VALID_USER_CODES } from '../config/userCodes';

const UserIdentificationModal = ({ onIdentification, onCancel }) => {
  const [userCode, setUserCode] = useState('');
  const [userName, setUserName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Vérifier le code utilisateur
      const userInfo = VALID_USER_CODES[userCode.toUpperCase()];
      
      if (!userInfo) {
        setError('❌ Code utilisateur invalide. Veuillez vérifier votre code.');
        setIsLoading(false);
        return;
      }

      // Créer l'objet utilisateur
      const user = {
        code: userCode.toUpperCase(),
        name: userInfo.name,
        role: userInfo.role,
        loginTime: new Date().toISOString(),
        sessionId: 'session_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9)
      };

      // Sauvegarder l'utilisateur dans localStorage
      localStorage.setItem('current_user', JSON.stringify(user));
      localStorage.setItem('user_id', `user_${user.code}_${Date.now()}`);

      console.log('🆔 Utilisateur identifié:', user);

      // Appeler la fonction de callback
      onIdentification(user);

    } catch (error) {
      console.error('Erreur lors de l\'identification:', error);
      setError('❌ Erreur lors de l\'identification. Veuillez réessayer.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSubmit(e);
    }
  };

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
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '20px',
        padding: '40px',
        maxWidth: '500px',
        width: '100%',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        
        {/* Background Pattern */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'radial-gradient(circle at 20% 80%, rgba(255,255,255,0.1) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.1) 0%, transparent 50%)',
          pointerEvents: 'none'
        }}></div>

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <div style={{
              fontSize: '60px',
              marginBottom: '20px',
              filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))'
            }}>
              🔐
            </div>
            <h1 style={{
              fontSize: '2.5rem',
              fontWeight: '700',
              color: '#ffffff',
              margin: '0 0 10px 0',
              textShadow: '0 4px 8px rgba(0,0,0,0.3)',
              letterSpacing: '2px'
            }}>
              Identification
            </h1>
            <p style={{
              fontSize: '1.1rem',
              color: '#ffffff',
              margin: '0',
              opacity: '0.9',
              textShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}>
              Veuillez saisir votre code d'accès
            </p>
          </div>

          {/* Formulaire */}
          <form onSubmit={handleSubmit} style={{ marginBottom: '30px' }}>
            <div style={{ marginBottom: '25px' }}>
              <label style={{
                display: 'block',
                marginBottom: '10px',
                color: '#ffffff',
                fontSize: '1.1rem',
                fontWeight: '600',
                textShadow: '0 2px 4px rgba(0,0,0,0.2)'
              }}>
                Code Utilisateur :
              </label>
              <input
                type="text"
                value={userCode}
                onChange={(e) => setUserCode(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ex: ADMIN001, MANAGER001..."
                style={{
                  width: '100%',
                  padding: '15px 20px',
                  fontSize: '1.2rem',
                  border: 'none',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  color: '#333',
                  fontWeight: '500',
                  boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
                  transition: 'all 0.3s ease'
                }}
                autoFocus
                disabled={isLoading}
              />
            </div>

            {/* Message d'erreur */}
            {error && (
              <div style={{
                padding: '12px 16px',
                backgroundColor: 'rgba(220, 53, 69, 0.9)',
                color: '#ffffff',
                borderRadius: '8px',
                marginBottom: '20px',
                fontSize: '1rem',
                fontWeight: '500',
                textAlign: 'center',
                boxShadow: '0 4px 12px rgba(220, 53, 69, 0.3)'
              }}>
                {error}
              </div>
            )}

            {/* Boutons */}
            <div style={{
              display: 'flex',
              gap: '15px',
              justifyContent: 'center'
            }}>
              <button
                type="submit"
                disabled={isLoading || !userCode.trim()}
                style={{
                  padding: '15px 30px',
                  fontSize: '1.1rem',
                  background: isLoading ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.9)',
                  color: isLoading ? 'rgba(255, 255, 255, 0.7)' : '#333',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  fontWeight: '600',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
                  minWidth: '120px'
                }}
                onMouseOver={(e) => {
                  if (!isLoading) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.3)';
                  }
                }}
                onMouseOut={(e) => {
                  if (!isLoading) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.2)';
                  }
                }}
              >
                {isLoading ? '⏳ Connexion...' : '🚀 Se connecter'}
              </button>

              <button
                type="button"
                onClick={onCancel}
                disabled={isLoading}
                style={{
                  padding: '15px 30px',
                  fontSize: '1.1rem',
                  background: 'rgba(255, 255, 255, 0.2)',
                  color: '#ffffff',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '12px',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  fontWeight: '600',
                  transition: 'all 0.3s ease',
                  minWidth: '120px'
                }}
                onMouseOver={(e) => {
                  if (!isLoading) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
                    e.currentTarget.style.border = '2px solid rgba(255, 255, 255, 0.5)';
                  }
                }}
                onMouseOut={(e) => {
                  if (!isLoading) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                    e.currentTarget.style.border = '2px solid rgba(255, 255, 255, 0.3)';
                  }
                }}
              >
                ❌ Annuler
              </button>
            </div>
          </form>

          {/* Codes disponibles (pour le développement) */}
          <div style={{
            marginTop: '30px',
            padding: '20px',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }}>
            <h3 style={{
              color: '#ffffff',
              fontSize: '1.1rem',
              margin: '0 0 15px 0',
              textAlign: 'center',
              fontWeight: '600',
              textShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}>
              📋 Codes disponibles (Développement)
            </h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '10px',
              fontSize: '0.9rem'
            }}>
              {Object.entries(VALID_USER_CODES).map(([code, info]) => (
                <div key={code} style={{
                  padding: '8px 12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '6px',
                  color: '#ffffff',
                  fontSize: '0.85rem'
                }}>
                  <strong>{code}</strong> - {info.name}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserIdentificationModal;
