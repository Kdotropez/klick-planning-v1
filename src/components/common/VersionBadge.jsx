import React from 'react';
import { getAppVersion } from '../../utils/versionManager';

const VersionBadge = () => {
  const version = getAppVersion();
  
  return (
    <div
      style={{
        position: 'fixed',
        bottom: '10px',
        right: '10px',
        backgroundColor: 'rgba(30, 136, 229, 0.9)',
        color: 'white',
        padding: '4px 12px',
        borderRadius: '12px',
        fontSize: '11px',
        fontWeight: '600',
        zIndex: 9999,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        fontFamily: 'monospace',
        userSelect: 'none',
        cursor: 'help',
        transition: 'all 0.3s ease'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(30, 136, 229, 1)';
        e.currentTarget.style.transform = 'scale(1.05)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(30, 136, 229, 0.9)';
        e.currentTarget.style.transform = 'scale(1)';
      }}
      title={`Version de l'application\nClic pour voir les détails`}
      onClick={() => {
        alert(
          `📦 Klick Planning\n\n` +
          `Version: ${version}\n\n` +
          `Le système de versioning automatique garantit que vous utilisez toujours la dernière version.\n\n` +
          `En cas de nouvelle version, le cache sera automatiquement vidé.`
        );
      }}
    >
      v{version}
    </div>
  );
};

export default VersionBadge;

