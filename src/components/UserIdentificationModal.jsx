import React, { useState, useEffect } from 'react';
import { getValidUserCodes, pullUserCodesFromSupabase } from '../config/userCodes';

const UserIdentificationModal = ({
  onIdentification,
  onCancel,
  lockCountdownSeconds = 0,
  lockOwnerText = ''
}) => {
  const [userCode, setUserCode] = useState('');
  const [userName, setUserName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncingCodes, setIsSyncingCodes] = useState(false);
  const [codesStatus, setCodesStatus] = useState('');

  const syncCodesFromCloud = async (showSuccess = false) => {
    setIsSyncingCodes(true);
    try {
      await pullUserCodesFromSupabase();
      if (showSuccess) {
        setCodesStatus('✅ Codes synchronisés depuis Supabase.');
      } else {
        setCodesStatus('');
      }
    } catch (syncError) {
      setCodesStatus('⚠️ Impossible de synchroniser les codes cloud (utilisation locale).');
      console.warn('Synchronisation codes cloud impossible:', syncError);
    } finally {
      setIsSyncingCodes(false);
    }
  };

  useEffect(() => {
    syncCodesFromCloud(false);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Charger les codes partagés Supabase avant vérification
      await syncCodesFromCloud(false);

      if (lockCountdownSeconds > 0) {
        setError(
          `⛔ Planning déjà utilisé sur ${lockOwnerText || 'un autre poste'}. ` +
          `Réessayez dans ${lockCountdownSeconds} seconde(s).`
        );
        setIsLoading(false);
        return;
      }

      // Vérifier le code secret utilisateur
      const userCodes = getValidUserCodes();
      const userInfo = userCodes[userCode];
      
      if (!userInfo) {
        setError('❌ Code secret invalide. Veuillez vérifier votre code.');
        setIsLoading(false);
        return;
      }

      // Créer l'objet utilisateur
      const user = {
        code: userCode,
        name: userInfo.name,
        role: userInfo.role,
        loginTime: new Date().toISOString(),
        sessionId: 'session_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9)
      };

      console.log('🆔 Utilisateur identifié:', user);

      // Appeler la fonction de callback (la persistance est gérée dans App après validation du verrou)
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
              Identification Secrète
            </h1>
            <p style={{
              fontSize: '1.1rem',
              color: '#ffffff',
              margin: '0',
              opacity: '0.9',
              textShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}>
              Veuillez saisir votre code secret
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
                Code Secret :
              </label>
              <input
                type="password"
                value={userCode}
                onChange={(e) => setUserCode(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Entrez votre code secret..."
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

            {/* Blocage temporaire multi-postes */}
            {lockCountdownSeconds > 0 && (
              <div style={{
                padding: '12px 16px',
                backgroundColor: 'rgba(255, 193, 7, 0.95)',
                color: '#212529',
                borderRadius: '8px',
                marginBottom: '20px',
                fontSize: '1rem',
                fontWeight: '700',
                textAlign: 'center',
                boxShadow: '0 4px 12px rgba(255, 193, 7, 0.35)'
              }}>
                ⏳ Planning occupé sur {lockOwnerText || 'un autre poste'}.
                <br />
                Reconnexion possible dans {lockCountdownSeconds} seconde(s).
              </div>
            )}

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

            {codesStatus && (
              <div style={{
                padding: '10px 14px',
                backgroundColor: 'rgba(40, 167, 69, 0.9)',
                color: '#ffffff',
                borderRadius: '8px',
                marginBottom: '20px',
                fontSize: '0.95rem',
                fontWeight: '500',
                textAlign: 'center',
                boxShadow: '0 4px 12px rgba(40, 167, 69, 0.3)'
              }}>
                {codesStatus}
              </div>
            )}

            <div style={{ marginBottom: '16px', textAlign: 'center' }}>
              <button
                type="button"
                disabled={isLoading || isSyncingCodes}
                onClick={() => syncCodesFromCloud(true)}
                style={{
                  padding: '10px 16px',
                  fontSize: '0.95rem',
                  background: (isLoading || isSyncingCodes) ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.85)',
                  color: (isLoading || isSyncingCodes) ? 'rgba(255, 255, 255, 0.7)' : '#333',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: (isLoading || isSyncingCodes) ? 'not-allowed' : 'pointer',
                  fontWeight: '600'
                }}
              >
                {isSyncingCodes ? '⏳ Synchronisation des codes...' : '🔄 Synchroniser les codes cloud'}
              </button>
            </div>

            {/* Boutons */}
            <div style={{
              display: 'flex',
              gap: '15px',
              justifyContent: 'center'
            }}>
              <button
                type="submit"
                disabled={isLoading || !userCode.trim() || lockCountdownSeconds > 0}
                style={{
                  padding: '15px 30px',
                  fontSize: '1.1rem',
                  background: (isLoading || lockCountdownSeconds > 0)
                    ? 'rgba(255, 255, 255, 0.3)'
                    : 'rgba(255, 255, 255, 0.9)',
                  color: (isLoading || lockCountdownSeconds > 0)
                    ? 'rgba(255, 255, 255, 0.7)'
                    : '#333',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: (isLoading || lockCountdownSeconds > 0) ? 'not-allowed' : 'pointer',
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
                {isLoading
                  ? '⏳ Connexion...'
                  : lockCountdownSeconds > 0
                    ? `🔒 Attendre ${lockCountdownSeconds}s`
                    : '🚀 Se connecter'}
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


        </div>
      </div>
    </div>
  );
};

export default UserIdentificationModal;
