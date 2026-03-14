import React, { useMemo, useState } from 'react';

const AuditLogModal = ({ isOpen, onClose, entries = [], onRefresh, onClear }) => {
  const [viewMode, setViewMode] = useState('summary');
  const [selectedSummaryKey, setSelectedSummaryKey] = useState('');
  const [detailFilterText, setDetailFilterText] = useState('');

  const normalize = (value = '') => String(value || '').toLowerCase().trim();

  const summaryRows = useMemo(() => {
    const buckets = new Map();

    entries.forEach((entry) => {
      const action = entry.action || '-';
      const userName = entry.userName || '-';
      const userCode = entry.userCode || '-';
      const shopName = entry.shopName || entry.shopId || '-';
      const key = `${action}__${userCode}__${shopName}`;
      const ts = entry.timestamp ? new Date(entry.timestamp).getTime() : 0;

      if (!buckets.has(key)) {
        buckets.set(key, {
          key,
          action,
          userName,
          userCode,
          shopName,
          count: 0,
          firstTs: ts || Date.now(),
          lastTs: ts || 0
        });
      }

      const bucket = buckets.get(key);
      bucket.count += 1;
      bucket.firstTs = Math.min(bucket.firstTs, ts || bucket.firstTs);
      bucket.lastTs = Math.max(bucket.lastTs, ts || bucket.lastTs);
    });

    return Array.from(buckets.values()).sort((a, b) => {
      if (b.lastTs !== a.lastTs) return b.lastTs - a.lastTs;
      return b.count - a.count;
    });
  }, [entries]);

  const detailRows = useMemo(() => {
    const text = normalize(detailFilterText);
    return entries.filter((entry) => {
      const action = entry.action || '-';
      const userName = entry.userName || '-';
      const userCode = entry.userCode || '-';
      const shopName = entry.shopName || entry.shopId || '-';

      const summaryKey = `${action}__${userCode}__${shopName}`;
      const keyMatch = !selectedSummaryKey || summaryKey === selectedSummaryKey;
      if (!keyMatch) return false;

      if (!text) return true;

      const haystack = normalize(
        `${entry.timestamp || ''} ${action} ${entry.details || ''} ${userName} ${userCode} ${shopName}`
      );
      return haystack.includes(text);
    });
  }, [entries, selectedSummaryKey, detailFilterText]);

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
          <div style={{ fontWeight: 700, fontSize: '18px' }}>📋 Journal d audit (acces superviseur)</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => setViewMode('summary')}
              style={{
                border: 'none',
                background: viewMode === 'summary' ? '#004ba0' : '#ffffff',
                color: viewMode === 'summary' ? '#ffffff' : '#0d47a1',
                borderRadius: '6px',
                padding: '8px 10px',
                cursor: 'pointer',
                fontWeight: 700
              }}
            >
              Resume
            </button>
            <button
              type="button"
              onClick={() => setViewMode('detail')}
              style={{
                border: 'none',
                background: viewMode === 'detail' ? '#004ba0' : '#ffffff',
                color: viewMode === 'detail' ? '#ffffff' : '#0d47a1',
                borderRadius: '6px',
                padding: '8px 10px',
                cursor: 'pointer',
                fontWeight: 700
              }}
            >
              Detail
            </button>
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
          {viewMode === 'summary'
            ? `${summaryRows.length} ligne(s) resumees (${entries.length} evenement(s))`
            : `${detailRows.length} evenement(s) detaille(s) affiches`}
          {selectedSummaryKey ? ' - filtre resume actif' : ''}
        </div>

        {viewMode === 'detail' && (
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #eceff1', display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={detailFilterText}
              onChange={(event) => setDetailFilterText(event.target.value)}
              placeholder="Recherche detail (action, utilisateur, boutique, texte...)"
              style={{
                flex: 1,
                border: '1px solid #b0bec5',
                borderRadius: '6px',
                padding: '8px 10px',
                fontSize: '13px'
              }}
            />
            {selectedSummaryKey && (
              <button
                type="button"
                onClick={() => setSelectedSummaryKey('')}
                style={{
                  border: '1px solid #90a4ae',
                  background: '#ffffff',
                  color: '#263238',
                  borderRadius: '6px',
                  padding: '8px 10px',
                  cursor: 'pointer',
                  fontWeight: 700
                }}
              >
                Retirer filtre
              </button>
            )}
          </div>
        )}

        <div style={{ overflow: 'auto', flex: 1 }}>
          {viewMode === 'summary' ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: '#eceff1' }}>
                <tr>
                  <th style={{ textAlign: 'left', padding: '10px', borderBottom: '1px solid #cfd8dc' }}>Dernier evenement</th>
                  <th style={{ textAlign: 'left', padding: '10px', borderBottom: '1px solid #cfd8dc' }}>Utilisateur</th>
                  <th style={{ textAlign: 'left', padding: '10px', borderBottom: '1px solid #cfd8dc' }}>Action</th>
                  <th style={{ textAlign: 'left', padding: '10px', borderBottom: '1px solid #cfd8dc' }}>Boutique</th>
                  <th style={{ textAlign: 'left', padding: '10px', borderBottom: '1px solid #cfd8dc' }}>Occurrences</th>
                  <th style={{ textAlign: 'left', padding: '10px', borderBottom: '1px solid #cfd8dc' }}>Detail</th>
                </tr>
              </thead>
              <tbody>
                {summaryRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '14px', color: '#78909c' }}>
                      Aucun evenement pour le moment.
                    </td>
                  </tr>
                ) : (
                  summaryRows.map((row) => (
                    <tr key={row.key}>
                      <td style={{ padding: '10px', borderBottom: '1px solid #eceff1', whiteSpace: 'nowrap' }}>
                        {row.lastTs ? new Date(row.lastTs).toLocaleString('fr-FR') : '-'}
                      </td>
                      <td style={{ padding: '10px', borderBottom: '1px solid #eceff1' }}>
                        {row.userName || '-'} ({row.userCode || '-'})
                      </td>
                      <td style={{ padding: '10px', borderBottom: '1px solid #eceff1', fontWeight: 600 }}>
                        {row.action || '-'}
                      </td>
                      <td style={{ padding: '10px', borderBottom: '1px solid #eceff1' }}>
                        {row.shopName || '-'}
                      </td>
                      <td style={{ padding: '10px', borderBottom: '1px solid #eceff1' }}>
                        {row.count}
                      </td>
                      <td style={{ padding: '10px', borderBottom: '1px solid #eceff1' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSummaryKey(row.key);
                            setViewMode('detail');
                          }}
                          style={{
                            border: '1px solid #90caf9',
                            background: '#e3f2fd',
                            color: '#0d47a1',
                            borderRadius: '6px',
                            padding: '6px 8px',
                            cursor: 'pointer',
                            fontWeight: 700
                          }}
                        >
                          Ouvrir detail
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
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
                {detailRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '14px', color: '#78909c' }}>
                      Aucun evenement correspondant.
                    </td>
                  </tr>
                ) : (
                  detailRows.map((entry) => (
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
          )}
        </div>
      </div>
    </div>
  );
};

export default AuditLogModal;
