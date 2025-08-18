import React from 'react';

const MainStartupScreen = ({ onSelectPlanning }) => {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      
      {/* Header */}
      <div style={{
        padding: '30px 40px',
        textAlign: 'center',
        color: 'white'
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
          🚀 Klick Management
        </h1>
        <p style={{
          fontSize: '1.4rem',
          margin: '0',
          opacity: '0.9',
          fontWeight: '400',
          textShadow: '0 2px 4px rgba(0,0,0,0.2)'
        }}>
          Plateforme de gestion intégrée
        </p>
        <div style={{
          marginTop: '20px',
          padding: '15px 30px',
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '25px',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.2)',
          display: 'inline-block'
        }}>
          <span style={{ fontSize: '1.1rem', fontWeight: '500' }}>
            Choisissez votre module de travail
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div style={{
        flex: 1,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '40px'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
          gap: '40px',
          maxWidth: '1200px',
          width: '100%'
        }}>
          
          {/* Module Klick Planning */}
          <div style={{
            background: 'linear-gradient(135deg, #28a745 0%, #1e7e34 100%)',
            borderRadius: '25px',
            padding: '50px 40px',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '0 20px 60px rgba(40, 167, 69, 0.3)',
            border: '3px solid rgba(255,255,255,0.2)',
            position: 'relative',
            overflow: 'hidden'
          }}
          onClick={onSelectPlanning}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-15px) scale(1.02)';
            e.currentTarget.style.boxShadow = '0 30px 80px rgba(40, 167, 69, 0.5)';
            e.currentTarget.style.border = '3px solid rgba(255,255,255,0.4)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
            e.currentTarget.style.boxShadow = '0 20px 60px rgba(40, 167, 69, 0.3)';
            e.currentTarget.style.border = '3px solid rgba(255,255,255,0.2)';
          }}
          >
            {/* Background Pattern */}
            <div style={{
              position: 'absolute',
              top: '-50%',
              right: '-50%',
              width: '200%',
              height: '200%',
              background: 'radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px)',
              backgroundSize: '20px 20px',
              opacity: '0.3'
            }}></div>
            
            <div style={{
              fontSize: '100px',
              marginBottom: '30px',
              filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))'
            }}>
              🏪
            </div>
            
            <h2 style={{
              fontSize: '2.5rem',
              fontWeight: '700',
              color: '#ffffff',
              margin: '0 0 20px 0',
              textShadow: '0 4px 8px rgba(0,0,0,0.3)',
              letterSpacing: '1px'
            }}>
              Klick Planning
            </h2>
            
            <p style={{
              fontSize: '1.2rem',
              color: '#ffffff',
              margin: '0 0 30px 0',
              opacity: '0.95',
              lineHeight: '1.6',
              fontWeight: '400'
            }}>
              Gestion complète des plannings, employés, boutiques et analyses statistiques avancées
            </p>
            
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '20px',
              flexWrap: 'wrap',
              marginBottom: '30px'
            }}>
              <span style={{
                background: 'rgba(255,255,255,0.2)',
                padding: '8px 16px',
                borderRadius: '20px',
                fontSize: '0.9rem',
                fontWeight: '500',
                backdropFilter: 'blur(10px)'
              }}>
                📅 Planning
              </span>
              <span style={{
                background: 'rgba(255,255,255,0.2)',
                padding: '8px 16px',
                borderRadius: '20px',
                fontSize: '0.9rem',
                fontWeight: '500',
                backdropFilter: 'blur(10px)'
              }}>
                👥 Employés
              </span>
              <span style={{
                background: 'rgba(255,255,255,0.2)',
                padding: '8px 16px',
                borderRadius: '20px',
                fontSize: '0.9rem',
                fontWeight: '500',
                backdropFilter: 'blur(10px)'
              }}>
                📊 Statistiques
              </span>
              <span style={{
                background: 'rgba(255,255,255,0.2)',
                padding: '8px 16px',
                borderRadius: '20px',
                fontSize: '0.9rem',
                fontWeight: '500',
                backdropFilter: 'blur(10px)'
              }}>
                🏪 Boutiques
              </span>
            </div>
            
            <div style={{
              background: 'rgba(255,255,255,0.15)',
              padding: '15px',
              borderRadius: '15px',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.2)'
            }}>
              <span style={{
                fontSize: '1rem',
                fontWeight: '600',
                color: '#ffffff'
              }}>
                Cliquez pour accéder →
              </span>
            </div>
          </div>


        </div>
      </div>

      {/* Footer */}
      <div style={{
        padding: '30px 40px',
        textAlign: 'center',
        color: '#ffffff',
        opacity: '0.8'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '30px',
          flexWrap: 'wrap'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '1rem'
          }}>
            <span style={{ fontSize: '1.2rem' }}>⚡</span>
            <span>Performance optimisée</span>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '1rem'
          }}>
            <span style={{ fontSize: '1.2rem' }}>🔒</span>
            <span>Sécurisé et fiable</span>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '1rem'
          }}>
            <span style={{ fontSize: '1.2rem' }}>📱</span>
            <span>Interface responsive</span>
          </div>
        </div>
        
        <p style={{
          marginTop: '20px',
          fontSize: '1.1rem',
          fontWeight: '500',
          textShadow: '0 2px 4px rgba(0,0,0,0.2)'
        }}>
          Sélectionnez le module que vous souhaitez utiliser pour commencer
        </p>
        
        <div style={{
          marginTop: '20px',
          paddingTop: '20px',
          borderTop: '1px solid rgba(255,255,255,0.2)',
          fontSize: '0.9rem',
          opacity: '0.7'
        }}>
          © 2025 Nicolas Lefevre - Tous droits réservés
        </div>
      </div>
    </div>
  );
};

export default MainStartupScreen; 