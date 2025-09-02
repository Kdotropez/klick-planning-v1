import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getAllData, calculateCompleteStats } from '../../utils/excelImportUtils';
import ExcelImportModal from './ExcelImportModal';
import ShopDetailPage from './ShopDetailPage';

const CAManagementPage = ({ shops, onClose }) => {
  const [selectedShop, setSelectedShop] = useState(shops[0]?.id || '');
  const [shopAllData, setShopAllData] = useState({});
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [showAllData, setShowAllData] = useState(false);
  const [selectedShopForDetail, setSelectedShopForDetail] = useState(null);

  // Charger les données complètes existantes pour toutes les boutiques
  useEffect(() => {
    const loadAllData = () => {
      const allData = {};
      shops.forEach(shop => {
        const completeData = getAllData(shop.id);
        allData[shop.id] = completeData;
      });
      setShopAllData(allData);
    };

    loadAllData();
  }, [shops]);

  const handleImportSuccess = (shopId, importedData) => {
    setShopAllData(prev => ({
      ...prev,
      [shopId]: importedData
    }));
  };

  const getShopCompleteStats = (shopId) => {
    const completeData = shopAllData[shopId] || [];
    if (completeData.length === 0) return null;

    const currentDate = new Date(selectedMonth);
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    return calculateCompleteStats(completeData, year, month);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return format(new Date(dateString), 'dd/MM/yyyy', { locale: fr });
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '30px',
        maxWidth: '1400px',
        width: '95%',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '30px',
          borderBottom: '2px solid #f0f0f0',
          paddingBottom: '20px'
        }}>
          <h1 style={{
            margin: 0,
            color: '#333',
            fontSize: '28px',
            fontWeight: 'bold'
          }}>
            📊 Gestion des Données Complètes
          </h1>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'background-color 0.3s'
            }}
          >
            ❌ Fermer
          </button>
        </div>

        {/* Month Selection */}
        <div style={{ marginBottom: '30px' }}>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            fontWeight: 'bold',
            color: '#555',
            fontSize: '16px'
          }}>
            📅 Mois de référence :
          </label>
          <input
            type="month"
            value={format(selectedMonth, 'yyyy-MM')}
            onChange={(e) => setSelectedMonth(new Date(e.target.value + '-01'))}
            style={{
              padding: '12px',
              borderRadius: '8px',
              border: '2px solid #ddd',
              fontSize: '16px',
              backgroundColor: 'white'
            }}
          />
        </div>

        {/* Shop Selection and Import Button */}
        <div style={{
          display: 'flex',
          gap: '20px',
          alignItems: 'center',
          marginBottom: '30px',
          padding: '20px',
          backgroundColor: '#f8f9fa',
          borderRadius: '12px'
        }}>
          <div style={{ flex: 1 }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: 'bold',
              color: '#555'
            }}>
              🏪 Boutique :
            </label>
            <select
              value={selectedShop}
              onChange={(e) => setSelectedShop(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '2px solid #ddd',
                fontSize: '16px',
                backgroundColor: 'white'
              }}
            >
              {shops.map(shop => (
                <option key={shop.id} value={shop.id}>
                  {shop.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setShowImportModal(true)}
            style={{
              padding: '15px 30px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'background-color 0.3s',
              whiteSpace: 'nowrap'
            }}
          >
            📥 Importer Excel Complet
          </button>
        </div>

        {/* Complete Data Overview */}
        <div style={{ marginBottom: '30px' }}>
          <h2 style={{
            margin: '0 0 20px 0',
            color: '#333',
            fontSize: '22px',
            fontWeight: 'bold'
          }}>
            📋 Aperçu des données complètes par boutique
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
            gap: '20px'
          }}>
            {shops.map(shop => {
              const completeData = shopAllData[shop.id] || [];
              const stats = getShopCompleteStats(shop.id);

              return (
                <div key={shop.id} style={{
                  border: '2px solid #e9ecef',
                  borderRadius: '12px',
                  padding: '20px',
                  backgroundColor: shop.id === selectedShop ? '#f8f9fa' : 'white',
                  transition: 'all 0.3s',
                  cursor: 'pointer',
                  ':hover': {
                    borderColor: '#007bff',
                    boxShadow: '0 4px 12px rgba(0, 123, 255, 0.15)'
                  }
                }}
                onClick={() => setSelectedShopForDetail(shop)}
                onMouseEnter={(e) => {
                  e.target.style.borderColor = '#007bff';
                  e.target.style.boxShadow = '0 4px 12px rgba(0, 123, 255, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.borderColor = '#e9ecef';
                  e.target.style.boxShadow = 'none';
                }}
                >
                  <h3 style={{
                    margin: '0 0 15px 0',
                    color: '#333',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}>
                    🏪 {shop.name}
                    <span style={{
                      fontSize: '12px',
                      color: '#007bff',
                      fontWeight: 'normal',
                      marginLeft: 'auto'
                    }}>
                      👆 Cliquer pour détails
                    </span>
                  </h3>

                  {completeData.length > 0 ? (
                    <div>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: '10px',
                        padding: '8px',
                        backgroundColor: '#e9ecef',
                        borderRadius: '6px'
                      }}>
                        <span style={{ fontWeight: 'bold' }}>Jours de données :</span>
                        <span>{completeData.length}</span>
                      </div>

                      {stats && (
                        <>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            marginBottom: '10px',
                            padding: '8px',
                            backgroundColor: '#d4edda',
                            borderRadius: '6px'
                          }}>
                            <span style={{ fontWeight: 'bold' }}>CA TTC du mois :</span>
                            <span style={{ fontWeight: 'bold', color: '#155724' }}>
                              {formatCurrency(parseFloat(stats.totalCA))}
                            </span>
                          </div>

                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            marginBottom: '10px',
                            padding: '8px',
                            backgroundColor: '#cce5ff',
                            borderRadius: '6px'
                          }}>
                            <span style={{ fontWeight: 'bold' }}>CA HT du mois :</span>
                            <span style={{ fontWeight: 'bold', color: '#004085' }}>
                              {formatCurrency(parseFloat(stats.totalCAHT))}
                            </span>
                          </div>

                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            marginBottom: '10px',
                            padding: '8px',
                            backgroundColor: '#fff3cd',
                            borderRadius: '6px'
                          }}>
                            <span style={{ fontWeight: 'bold' }}>TVA totale :</span>
                            <span style={{ fontWeight: 'bold', color: '#856404' }}>
                              {formatCurrency(parseFloat(stats.totalTVA))}
                            </span>
                          </div>

                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            marginBottom: '10px',
                            padding: '8px',
                            backgroundColor: '#f8d7da',
                            borderRadius: '6px'
                          }}>
                            <span style={{ fontWeight: 'bold' }}>Encaissements :</span>
                            <span style={{ fontWeight: 'bold', color: '#721c24' }}>
                              {formatCurrency(parseFloat(stats.totalEncaissement))}
                            </span>
                          </div>
                        </>
                      )}

                      <div style={{
                        marginTop: '15px',
                        fontSize: '14px',
                        color: '#666'
                      }}>
                        <strong>Période :</strong> {completeData.length > 0 && (
                          <>
                            {formatDate(completeData[0].date)} - {formatDate(completeData[completeData.length - 1].date)}
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      padding: '20px',
                      textAlign: 'center',
                      color: '#666',
                      fontStyle: 'italic',
                      backgroundColor: '#f8f9fa',
                      borderRadius: '8px'
                    }}>
                      Aucune donnée complète importée
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Instructions */}
        <div style={{
          marginTop: '30px',
          padding: '20px',
          backgroundColor: '#f8f9fa',
          borderRadius: '12px',
          fontSize: '14px',
          color: '#666'
        }}>
          <h4 style={{ margin: '0 0 15px 0', color: '#333' }}>📋 Instructions :</h4>
          <ul style={{ margin: '0', paddingLeft: '20px' }}>
            <li>Sélectionnez une boutique et cliquez sur "Importer Excel Complet" pour ajouter toutes les données</li>
            <li>L'import complet récupère : CA TTC/HT, TVA, moyens de paiement, encaissements, etc.</li>
            <li>Les données sont stockées localement et persistent entre les sessions</li>
            <li>Chaque boutique peut avoir ses propres données importées</li>
            <li>Les statistiques sont calculées automatiquement pour le mois sélectionné</li>
            <li>Format attendu : fichier Excel avec dates en colonne A, toutes les colonnes sont récupérées</li>
            <li><strong>Cliquez sur une carte de boutique pour voir les détails complets et les totaux</strong></li>
          </ul>
        </div>

        {/* Excel Import Modal */}
        <ExcelImportModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          shops={shops}
          currentShop={selectedShop}
          selectedMonth={selectedMonth}
          onImportSuccess={handleImportSuccess}
        />

        {/* Shop Detail Page */}
        {selectedShopForDetail && (
          <ShopDetailPage
            shop={selectedShopForDetail}
            onClose={() => setSelectedShopForDetail(null)}
          />
        )}
      </div>
    </div>
  );
};

export default CAManagementPage; 
