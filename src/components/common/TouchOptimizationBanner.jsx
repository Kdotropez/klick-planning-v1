import React from 'react';
import { useDeviceDetection } from '../../hooks/useDeviceDetection';

export default function TouchOptimizationBanner() {
  const { isTouchDevice, isTablet, isMobile } = useDeviceDetection();

  if (!isTouchDevice) {
    return null;
  }

  return (
    <div className="touch-optimization-banner">
      <div className="banner-content">
        <div className="banner-icon">📱</div>
        <div className="banner-text">
          <strong>Mode tactile activé</strong>
          <br />
          {isTablet && "Tablette détectée - Zones de clic optimisées"}
          {isMobile && "Mobile détecté - Interface adaptée"}
          <br />
          <small>💡 Conseil : Utilisez votre doigt pour cliquer sur les tranches horaires</small>
        </div>
      </div>
      <style jsx>{`
        .touch-optimization-banner {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 8px 12px;
          border-radius: 8px;
          margin: 8px 0;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          animation: slideIn 0.3s ease-out;
        }
        
        .banner-content {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .banner-icon {
          font-size: 20px;
          flex-shrink: 0;
        }
        
        .banner-text {
          font-size: 14px;
          line-height: 1.4;
        }
        
        .banner-text strong {
          font-weight: 600;
        }
        
        .banner-text small {
          opacity: 0.9;
          font-size: 12px;
        }
        
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @media (max-width: 768px) {
          .touch-optimization-banner {
            padding: 6px 10px;
            margin: 6px 0;
          }
          
          .banner-text {
            font-size: 13px;
          }
          
          .banner-text small {
            font-size: 11px;
          }
        }
      `}</style>
    </div>
  );
}
