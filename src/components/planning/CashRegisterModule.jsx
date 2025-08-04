import React from 'react';

const CashRegisterModule = ({ onClose }) => {
  return (
    <div style={{ textAlign: 'center', padding: '40px' }}>
      <h2 style={{ color: '#333', marginBottom: '20px' }}>💰 Caisse Enregistreuse</h2>
      <p style={{ color: '#666', fontSize: '16px', marginBottom: '30px' }}>
        Module de gestion de caisse enregistreuse.
      </p>
      
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '20px',
        marginBottom: '30px'
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #ffc107 0%, #e0a800 100%)',
          color: 'white',
          padding: '25px',
          borderRadius: '12px',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.3s ease'
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.transform = 'translateY(-5px)';
          e.currentTarget.style.boxShadow = '0 10px 20px rgba(255, 193, 7, 0.3)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = 'none';
        }}
        >
          <h3 style={{ margin: '0 0 15px 0', fontSize: '20px' }}>💳 Paiements</h3>
          <p style={{ margin: '0', opacity: '0.9' }}>Gestion des moyens de paiement</p>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)',
          color: 'white',
          padding: '25px',
          borderRadius: '12px',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.3s ease'
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.transform = 'translateY(-5px)';
          e.currentTarget.style.boxShadow = '0 10px 20px rgba(220, 53, 69, 0.3)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = 'none';
        }}
        >
          <h3 style={{ margin: '0 0 15px 0', fontSize: '20px' }}>📈 Ventes</h3>
          <p style={{ margin: '0', opacity: '0.9' }}>Suivi des ventes en temps réel</p>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #6f42c1 0%, #5a2d91 100%)',
          color: 'white',
          padding: '25px',
          borderRadius: '12px',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.3s ease'
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.transform = 'translateY(-5px)';
          e.currentTarget.style.boxShadow = '0 10px 20px rgba(111, 66, 193, 0.3)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = 'none';
        }}
        >
          <h3 style={{ margin: '0 0 15px 0', fontSize: '20px' }}>🔄 Retours</h3>
          <p style={{ margin: '0', opacity: '0.9' }}>Gestion des retours et remboursements</p>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #20c997 0%, #17a2b8 100%)',
          color: 'white',
          padding: '25px',
          borderRadius: '12px',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.3s ease'
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.transform = 'translateY(-5px)';
          e.currentTarget.style.boxShadow = '0 10px 20px rgba(32, 201, 151, 0.3)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = 'none';
        }}
        >
          <h3 style={{ margin: '0 0 15px 0', fontSize: '20px' }}>📊 Rapports</h3>
          <p style={{ margin: '0', opacity: '0.9' }}>Rapports de caisse détaillés</p>
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

export default CashRegisterModule; 