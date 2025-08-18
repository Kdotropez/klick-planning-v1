import React from 'react';

const APP_VERSION = `v${(typeof __APP_VERSION__ !== 'undefined' && __APP_VERSION__) || import.meta.env?.VITE_APP_VERSION || '3.0.0'}`;

const CopyrightNotice = () => {
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
      © 2025 Nicolas Lefevre - Propriétaire — {APP_VERSION}
    </div>
  );
};

export default CopyrightNotice; 