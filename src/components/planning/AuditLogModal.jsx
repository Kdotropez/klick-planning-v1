import React from 'react';

const AuditLogModal = ({ isOpen, onClose, entries = [], onRefresh, onClear }) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        zIndex: 65000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 'min(1400px, 96vw)',
          height: 'min(860px, 94vh)',
          background: '#fff',
          borderRadius: '12px',
          boxShadow: '0 20px 80px rgba(0,0,0,0.35)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '14px 16px',
            background: 'linear-gradient(90deg, #0d47a1 0%, #1976d2 100%)',
            color: '#fff'
          }}
        >
          <div style={{ fontWeight: 700, fontSize: '18px' }}>📋 Journal d audit (acces 2111)</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={onRefresh}
              style={{
                border: 'none',
                background: '#fff',
                color: '#0d47a1',
                borderRadius: '6px',
                padding: '8px 10px',
                cursor: 'pointer',
                fontWeight: 700
              }}
            >
              Rafraichir
            </button>
            <button
              type="button"
              onClick={onClear}
              style={{
                border: 'none',
                background: '#ffc107',
                color: '#212529',
                borderRadius: '6px',
                padding: '8px 10px',
                cursor: 'pointer',
                fontWeight: 700
              }}
            >
              Vider
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                border: 'none',
                background: '#fff',
                color: '#d32f2f',
                borderRadius: '6px',
                padding: '8px 10px',
                cursor: 'pointer',
                fontWeight: 700
              }}
            >
              Fermer
            </button>
          </div>
        </div>

        <div style={{ padding: '10px 14px', borderBottom: '1px solid #e0e0e0', fontSize: '13px', color: '#455a64' }}>
          {entries.length} evenement(s) affiches
        </div>

        <div style={{ overflow: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: '#eceff1' }}>
              <tr>
                <th style={{ textAlign: 'left', padding: '10px', borderBottom: '1px solid #cfd8dc' }}>Date</th>
                <th style={{ textAlign: 'left', padding: '10px', borderBottom: '1px solid #cfd8dc' }}>Utilisateur</th>
                <th style={{ textAlign: 'left', padding: '10px', borderBottom: '1px solid #cfd8dc' }}>Action</th>
                <th style={{ textAlign: 'left', padding: '10px', borderBottom: '1px solid #cfd8dc' }}>Boutique</th>
                <th style={{ textAlign: 'left', padding: '10px', borderBottom: '1px solid #cfd8dc' }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '14px', color: '#78909c' }}>
                    Aucun evenement pour le moment.
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id}>
                    <td style={{ padding: '10px', borderBottom: '1px solid #eceff1', whiteSpace: 'nowrap' }}>
                      {entry.timestamp ? new Date(entry.timestamp).toLocaleString('fr-FR') : '-'}
                    </td>
                    <td style={{ padding: '10px', borderBottom: '1px solid #eceff1' }}>
                      {entry.userName || '-'} ({entry.userCode || '-'})
                    </td>
                    <td style={{ padding: '10px', borderBottom: '1px solid #eceff1', fontWeight: 600 }}>
                      {entry.action || '-'}
                    </td>
                    <td style={{ padding: '10px', borderBottom: '1px solid #eceff1' }}>
                      {entry.shopName || entry.shopId || '-'}
                    </td>
                    <td style={{ padding: '10px', borderBottom: '1px solid #eceff1' }}>
                      {entry.details || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AuditLogModal;
