import React from 'react';

const CAStatsModule = ({ onClose, onImportCA, onImportCompleteData, onCAManagement }) => {
  return (
    <div style={{ textAlign: 'center', padding: '40px' }}>
      <h2 style={{ color: '#333', marginBottom: '20px' }}>📊 Statistiques CA</h2>
      <p style={{ color: '#666', fontSize: '16px', marginBottom: '30px' }}>
        Module de gestion des données CA et import Excel.
      </p>
      
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '20px',
        marginBottom: '30px'
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #28a745 0%, #1e7e34 100%)',
          color: 'white',
          padding: '25px',
          borderRadius: '12px',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.3s ease'
        }}
        onClick={onImportCA}
        onMouseOver={(e) => {
          e.currentTarget.style.transform = 'translateY(-5px)';
          e.currentTarget.style.boxShadow = '0 10px 20px rgba(40, 167, 69, 0.3)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = 'none';
        }}
        >
          <h3 style={{ margin: '0 0 15px 0', fontSize: '20px' }}>📊 Import CA</h3>
          <p style={{ margin: '0', opacity: '0.9' }}>Importer les données CA depuis Excel</p>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #17a2b8 0%, #138496 100%)',
          color: 'white',
          padding: '25px',
          borderRadius: '12px',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.3s ease'
        }}
        onClick={onImportCompleteData}
        onMouseOver={(e) => {
          e.currentTarget.style.transform = 'translateY(-5px)';
          e.currentTarget.style.boxShadow = '0 10px 20px rgba(23, 162, 184, 0.3)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = 'none';
        }}
        >
          <h3 style={{ margin: '0 0 15px 0', fontSize: '20px' }}>📋 Import Données Complètes</h3>
          <p style={{ margin: '0', opacity: '0.9' }}>Importer toutes les données financières</p>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #007bff 0%, #0056b3 100%)',
          color: 'white',
          padding: '25px',
          borderRadius: '12px',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.3s ease'
        }}
        onClick={onCAManagement}
        onMouseOver={(e) => {
          e.currentTarget.style.transform = 'translateY(-5px)';
          e.currentTarget.style.boxShadow = '0 10px 20px rgba(0, 123, 255, 0.3)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = 'none';
        }}
        >
          <h3 style={{ margin: '0 0 15px 0', fontSize: '20px' }}>🏪 Gestion CA</h3>
          <p style={{ margin: '0', opacity: '0.9' }}>Gérer les données de toutes les boutiques</p>
        </div>
      </div>

      <button
        onClick={onClose}
        style={{
          background: 'linear-gradient(135deg, #6c757d 0%, #495057 100%)',
          color: 'white',
          padding: '12px 24px',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontWeight: '600',
          fontSize: '14px',
          transition: 'all 0.3s ease'
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.background = 'linear-gradient(135deg, #495057 0%, #343a40 100%)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.background = 'linear-gradient(135deg, #6c757d 0%, #495057 100%)';
        }}
      >
        ← Retour
      </button>
    </div>
  );
};

export default CAStatsModule; 