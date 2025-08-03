import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getAllData, calculateCompleteStats } from '../../utils/excelImportUtils';

const ShopDetailPage = ({ shop, onClose }) => {
  const [shopData, setShopData] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [showAllData, setShowAllData] = useState(false);
  const [stats, setStats] = useState(null);
  const [selectedStats, setSelectedStats] = useState({
    caTTC: true,
    caHT: true,
    tva: true,
    encaissement: true,
    joursDonnees: true,
    caMoyen: true,
    bc: true,
    especes: true,
    cartes: true,
    cheques: true,
    virements: true,
    avoirs: true,
    compteClient: true,
    paiementNFois: true,
    summup: true,
    carteCadeau: true,
    differe: true,
    attente: true
  });

  // Charger les données de la boutique
  useEffect(() => {
    const loadShopData = () => {
      const completeData = getAllData(shop.id);
      setShopData(completeData);
      
      // Calculer les statistiques pour le mois sélectionné
      if (completeData.length > 0) {
        const currentDate = new Date(selectedMonth);
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const shopStats = calculateCompleteStats(completeData, year, month);
        setStats(shopStats);
      }
    };

    loadShopData();
  }, [shop.id, selectedMonth]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return format(new Date(dateString), 'dd/MM/yyyy', { locale: fr });
  };

  // Filtrer les données pour le mois sélectionné
  const getFilteredData = () => {
    if (shopData.length === 0) return [];
    
    const currentDate = new Date(selectedMonth);
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    return shopData.filter(item => {
      const itemDate = new Date(item.date);
      return itemDate.getFullYear() === year && itemDate.getMonth() === month;
    });
  };

  const filteredData = getFilteredData();

  const handleToggleStat = (statKey) => {
    setSelectedStats(prev => ({
      ...prev,
      [statKey]: !prev[statKey]
    }));
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
        maxWidth: '1600px',
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
            🏪 {shop.name} - Détail des Données
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

        

        {/* Statistics Summary */}
        {stats && (
          <div style={{ marginBottom: '30px' }}>
            <h2 style={{
              margin: '0 0 20px 0',
              color: '#333',
              fontSize: '22px',
              fontWeight: 'bold'
            }}>
              📊 Résumé du mois - {format(selectedMonth, 'MMMM yyyy', { locale: fr })}
            </h2>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '15px'
            }}>
                             <div style={{
                 padding: '15px',
                 backgroundColor: '#d4edda',
                 borderRadius: '8px',
                 border: '2px solid #c3e6cb',
                 transition: 'all 0.3s',
                 cursor: 'pointer'
               }}
               onClick={() => handleToggleStat('caTTC')}
               >
                 <div style={{ 
                   display: 'flex', 
                   justifyContent: 'space-between', 
                   alignItems: 'center',
                   marginBottom: selectedStats.caTTC ? '5px' : '0'
                 }}>
                   <div style={{ fontWeight: 'bold', color: '#155724' }}>
                     CA TTC Total
                   </div>
                   <button
                     style={{
                       padding: '2px 8px',
                       backgroundColor: selectedStats.caTTC ? '#28a745' : '#6c757d',
                       color: 'white',
                       border: 'none',
                       borderRadius: '4px',
                       fontSize: '10px',
                       fontWeight: 'bold',
                       cursor: 'pointer'
                     }}
                   >
                     {selectedStats.caTTC ? 'ON' : 'OFF'}
                   </button>
                 </div>
                 {selectedStats.caTTC && (
                   <div style={{ 
                     fontSize: '18px', 
                     fontWeight: 'bold', 
                     color: '#155724',
                     transition: 'all 0.3s'
                   }}>
                     {formatCurrency(parseFloat(stats.totalCA))}
                   </div>
                 )}
               </div>

                             <div style={{
                 padding: '15px',
                 backgroundColor: '#cce5ff',
                 borderRadius: '8px',
                 border: '2px solid #b3d7ff',
                 transition: 'all 0.3s',
                 cursor: 'pointer'
               }}
               onClick={() => handleToggleStat('caHT')}
               >
                 <div style={{ 
                   display: 'flex', 
                   justifyContent: 'space-between', 
                   alignItems: 'center',
                   marginBottom: selectedStats.caHT ? '5px' : '0'
                 }}>
                   <div style={{ fontWeight: 'bold', color: '#004085' }}>
                     CA HT Total
                   </div>
                   <button
                     style={{
                       padding: '2px 8px',
                       backgroundColor: selectedStats.caHT ? '#28a745' : '#6c757d',
                       color: 'white',
                       border: 'none',
                       borderRadius: '4px',
                       fontSize: '10px',
                       fontWeight: 'bold',
                       cursor: 'pointer'
                     }}
                   >
                     {selectedStats.caHT ? 'ON' : 'OFF'}
                   </button>
                 </div>
                 {selectedStats.caHT && (
                   <div style={{ 
                     fontSize: '18px', 
                     fontWeight: 'bold', 
                     color: '#004085',
                     transition: 'all 0.3s'
                   }}>
                     {formatCurrency(parseFloat(stats.totalCAHT))}
                   </div>
                 )}
               </div>

               <div style={{
                 padding: '15px',
                 backgroundColor: '#fff3cd',
                 borderRadius: '8px',
                 border: '2px solid #ffeaa7',
                 transition: 'all 0.3s',
                 cursor: 'pointer'
               }}
               onClick={() => handleToggleStat('tva')}
               >
                 <div style={{ 
                   display: 'flex', 
                   justifyContent: 'space-between', 
                   alignItems: 'center',
                   marginBottom: selectedStats.tva ? '5px' : '0'
                 }}>
                   <div style={{ fontWeight: 'bold', color: '#856404' }}>
                     TVA Totale
                   </div>
                   <button
                     style={{
                       padding: '2px 8px',
                       backgroundColor: selectedStats.tva ? '#28a745' : '#6c757d',
                       color: 'white',
                       border: 'none',
                       borderRadius: '4px',
                       fontSize: '10px',
                       fontWeight: 'bold',
                       cursor: 'pointer'
                     }}
                   >
                     {selectedStats.tva ? 'ON' : 'OFF'}
                   </button>
                 </div>
                 {selectedStats.tva && (
                   <div style={{ 
                     fontSize: '18px', 
                     fontWeight: 'bold', 
                     color: '#856404',
                     transition: 'all 0.3s'
                   }}>
                     {formatCurrency(parseFloat(stats.totalTVA))}
                   </div>
                 )}
               </div>

               <div style={{
                 padding: '15px',
                 backgroundColor: '#f8d7da',
                 borderRadius: '8px',
                 border: '2px solid #f5c6cb',
                 transition: 'all 0.3s',
                 cursor: 'pointer'
               }}
               onClick={() => handleToggleStat('encaissement')}
               >
                 <div style={{ 
                   display: 'flex', 
                   justifyContent: 'space-between', 
                   alignItems: 'center',
                   marginBottom: selectedStats.encaissement ? '5px' : '0'
                 }}>
                   <div style={{ fontWeight: 'bold', color: '#721c24' }}>
                     Encaissements
                   </div>
                   <button
                     style={{
                       padding: '2px 8px',
                       backgroundColor: selectedStats.encaissement ? '#28a745' : '#6c757d',
                       color: 'white',
                       border: 'none',
                       borderRadius: '4px',
                       fontSize: '10px',
                       fontWeight: 'bold',
                       cursor: 'pointer'
                     }}
                   >
                     {selectedStats.encaissement ? 'ON' : 'OFF'}
                   </button>
                 </div>
                 {selectedStats.encaissement && (
                   <div style={{ 
                     fontSize: '18px', 
                     fontWeight: 'bold', 
                     color: '#721c24',
                     transition: 'all 0.3s'
                   }}>
                     {formatCurrency(parseFloat(stats.totalEncaissement))}
                   </div>
                 )}
               </div>

               <div style={{
                 padding: '15px',
                 backgroundColor: '#e2e3e5',
                 borderRadius: '8px',
                 border: '2px solid #d6d8db',
                 transition: 'all 0.3s',
                 cursor: 'pointer'
               }}
               onClick={() => handleToggleStat('joursDonnees')}
               >
                 <div style={{ 
                   display: 'flex', 
                   justifyContent: 'space-between', 
                   alignItems: 'center',
                   marginBottom: selectedStats.joursDonnees ? '5px' : '0'
                 }}>
                   <div style={{ fontWeight: 'bold', color: '#383d41' }}>
                     Jours de données
                   </div>
                   <button
                     style={{
                       padding: '2px 8px',
                       backgroundColor: selectedStats.joursDonnees ? '#28a745' : '#6c757d',
                       color: 'white',
                       border: 'none',
                       borderRadius: '4px',
                       fontSize: '10px',
                       fontWeight: 'bold',
                       cursor: 'pointer'
                     }}
                   >
                     {selectedStats.joursDonnees ? 'ON' : 'OFF'}
                   </button>
                 </div>
                 {selectedStats.joursDonnees && (
                   <div style={{ 
                     fontSize: '18px', 
                     fontWeight: 'bold', 
                     color: '#383d41',
                     transition: 'all 0.3s'
                   }}>
                     {filteredData.length}
                   </div>
                 )}
               </div>

               <div style={{
                 padding: '15px',
                 backgroundColor: '#d1ecf1',
                 borderRadius: '8px',
                 border: '2px solid #bee5eb',
                 transition: 'all 0.3s',
                 cursor: 'pointer'
               }}
               onClick={() => handleToggleStat('caMoyen')}
               >
                 <div style={{ 
                   display: 'flex', 
                   justifyContent: 'space-between', 
                   alignItems: 'center',
                   marginBottom: selectedStats.caMoyen ? '5px' : '0'
                 }}>
                   <div style={{ fontWeight: 'bold', color: '#0c5460' }}>
                     CA Moyen/Jour
                   </div>
                   <button
                     style={{
                       padding: '2px 8px',
                       backgroundColor: selectedStats.caMoyen ? '#28a745' : '#6c757d',
                       color: 'white',
                       border: 'none',
                       borderRadius: '4px',
                       fontSize: '10px',
                       fontWeight: 'bold',
                       cursor: 'pointer'
                     }}
                   >
                     {selectedStats.caMoyen ? 'ON' : 'OFF'}
                   </button>
                 </div>
                 {selectedStats.caMoyen && (
                   <div style={{ 
                     fontSize: '18px', 
                     fontWeight: 'bold', 
                     color: '#0c5460',
                     transition: 'all 0.3s'
                   }}>
                     {filteredData.length > 0 ? formatCurrency(parseFloat(stats.totalCA) / filteredData.length) : '0,00 €'}
                   </div>
                 )}
               </div>

               {/* Moyens de paiement */}
               <div style={{
                 padding: '15px',
                 backgroundColor: '#e8f5e8',
                 borderRadius: '8px',
                 border: '2px solid #c8e6c9',
                 transition: 'all 0.3s',
                 cursor: 'pointer'
               }}
               onClick={() => handleToggleStat('bc')}
               >
                 <div style={{ 
                   display: 'flex', 
                   justifyContent: 'space-between', 
                   alignItems: 'center',
                   marginBottom: selectedStats.bc ? '5px' : '0'
                 }}>
                   <div style={{ fontWeight: 'bold', color: '#2e7d32' }}>
                     BC (Bons de commande)
                   </div>
                   <button
                     style={{
                       padding: '2px 8px',
                       backgroundColor: selectedStats.bc ? '#28a745' : '#6c757d',
                       color: 'white',
                       border: 'none',
                       borderRadius: '4px',
                       fontSize: '10px',
                       fontWeight: 'bold',
                       cursor: 'pointer'
                     }}
                   >
                     {selectedStats.bc ? 'ON' : 'OFF'}
                   </button>
                 </div>
                 {selectedStats.bc && (
                   <div style={{ 
                     fontSize: '18px', 
                     fontWeight: 'bold', 
                     color: '#2e7d32',
                     transition: 'all 0.3s'
                   }}>
                     {formatCurrency(filteredData.reduce((sum, item) => sum + (parseFloat(item.bc) || 0), 0))}
                   </div>
                 )}
               </div>

               <div style={{
                 padding: '15px',
                 backgroundColor: '#fff8e1',
                 borderRadius: '8px',
                 border: '2px solid #ffecb3',
                 transition: 'all 0.3s',
                 cursor: 'pointer'
               }}
               onClick={() => handleToggleStat('especes')}
               >
                 <div style={{ 
                   display: 'flex', 
                   justifyContent: 'space-between', 
                   alignItems: 'center',
                   marginBottom: selectedStats.especes ? '5px' : '0'
                 }}>
                   <div style={{ fontWeight: 'bold', color: '#f57c00' }}>
                     Espèces (Total réel)
                   </div>
                   <button
                     style={{
                       padding: '2px 8px',
                       backgroundColor: selectedStats.especes ? '#28a745' : '#6c757d',
                       color: 'white',
                       border: 'none',
                       borderRadius: '4px',
                       fontSize: '10px',
                       fontWeight: 'bold',
                       cursor: 'pointer'
                     }}
                   >
                     {selectedStats.especes ? 'ON' : 'OFF'}
                   </button>
                 </div>
                 {selectedStats.especes && (
                   <div style={{ 
                     fontSize: '18px', 
                     fontWeight: 'bold', 
                     color: '#f57c00',
                     transition: 'all 0.3s'
                   }}>
                     {formatCurrency(filteredData.reduce((sum, item) => {
                       const especes = (parseFloat(item.especesC) || 0) - (parseFloat(item.especesD) || 0);
                       const attente = (parseFloat(item.attenteC) || 0) - (parseFloat(item.attenteD) || 0);
                       return sum + especes + attente;
                     }, 0))}
                   </div>
                 )}
               </div>

               <div style={{
                 padding: '15px',
                 backgroundColor: '#e3f2fd',
                 borderRadius: '8px',
                 border: '2px solid #bbdefb',
                 transition: 'all 0.3s',
                 cursor: 'pointer'
               }}
               onClick={() => handleToggleStat('cartes')}
               >
                 <div style={{ 
                   display: 'flex', 
                   justifyContent: 'space-between', 
                   alignItems: 'center',
                   marginBottom: selectedStats.cartes ? '5px' : '0'
                 }}>
                   <div style={{ fontWeight: 'bold', color: '#1976d2' }}>
                     Cartes bancaires
                   </div>
                   <button
                     style={{
                       padding: '2px 8px',
                       backgroundColor: selectedStats.cartes ? '#28a745' : '#6c757d',
                       color: 'white',
                       border: 'none',
                       borderRadius: '4px',
                       fontSize: '10px',
                       fontWeight: 'bold',
                       cursor: 'pointer'
                     }}
                   >
                     {selectedStats.cartes ? 'ON' : 'OFF'}
                   </button>
                 </div>
                 {selectedStats.cartes && (
                   <div style={{ 
                     fontSize: '18px', 
                     fontWeight: 'bold', 
                     color: '#1976d2',
                     transition: 'all 0.3s'
                   }}>
                     {formatCurrency(filteredData.reduce((sum, item) => sum + ((parseFloat(item.carteC) || 0) - (parseFloat(item.carteD) || 0)), 0))}
                   </div>
                 )}
               </div>

               <div style={{
                 padding: '15px',
                 backgroundColor: '#f3e5f5',
                 borderRadius: '8px',
                 border: '2px solid #e1bee7',
                 transition: 'all 0.3s',
                 cursor: 'pointer'
               }}
               onClick={() => handleToggleStat('cheques')}
               >
                 <div style={{ 
                   display: 'flex', 
                   justifyContent: 'space-between', 
                   alignItems: 'center',
                   marginBottom: selectedStats.cheques ? '5px' : '0'
                 }}>
                   <div style={{ fontWeight: 'bold', color: '#7b1fa2' }}>
                     Chèques
                   </div>
                   <button
                     style={{
                       padding: '2px 8px',
                       backgroundColor: selectedStats.cheques ? '#28a745' : '#6c757d',
                       color: 'white',
                       border: 'none',
                       borderRadius: '4px',
                       fontSize: '10px',
                       fontWeight: 'bold',
                       cursor: 'pointer'
                     }}
                   >
                     {selectedStats.cheques ? 'ON' : 'OFF'}
                   </button>
                 </div>
                 {selectedStats.cheques && (
                   <div style={{ 
                     fontSize: '18px', 
                     fontWeight: 'bold', 
                     color: '#7b1fa2',
                     transition: 'all 0.3s'
                   }}>
                     {formatCurrency(filteredData.reduce((sum, item) => sum + ((parseFloat(item.chequeC) || 0) - (parseFloat(item.chequeD) || 0)), 0))}
                   </div>
                 )}
               </div>

               <div style={{
                 padding: '15px',
                 backgroundColor: '#e8f5e8',
                 borderRadius: '8px',
                 border: '2px solid #c8e6c9',
                 transition: 'all 0.3s',
                 cursor: 'pointer'
               }}
               onClick={() => handleToggleStat('virements')}
               >
                 <div style={{ 
                   display: 'flex', 
                   justifyContent: 'space-between', 
                   alignItems: 'center',
                   marginBottom: selectedStats.virements ? '5px' : '0'
                 }}>
                   <div style={{ fontWeight: 'bold', color: '#388e3c' }}>
                     Virements
                   </div>
                   <button
                     style={{
                       padding: '2px 8px',
                       backgroundColor: selectedStats.virements ? '#28a745' : '#6c757d',
                       color: 'white',
                       border: 'none',
                       borderRadius: '4px',
                       fontSize: '10px',
                       fontWeight: 'bold',
                       cursor: 'pointer'
                     }}
                   >
                     {selectedStats.virements ? 'ON' : 'OFF'}
                   </button>
                 </div>
                 {selectedStats.virements && (
                   <div style={{ 
                     fontSize: '18px', 
                     fontWeight: 'bold', 
                     color: '#388e3c',
                     transition: 'all 0.3s'
                   }}>
                     {formatCurrency(filteredData.reduce((sum, item) => sum + ((parseFloat(item.virementC) || 0) - (parseFloat(item.virementD) || 0)), 0))}
                   </div>
                 )}
               </div>

               <div style={{
                 padding: '15px',
                 backgroundColor: '#fff3e0',
                 borderRadius: '8px',
                 border: '2px solid #ffcc80',
                 transition: 'all 0.3s',
                 cursor: 'pointer'
               }}
               onClick={() => handleToggleStat('avoirs')}
               >
                 <div style={{ 
                   display: 'flex', 
                   justifyContent: 'space-between', 
                   alignItems: 'center',
                   marginBottom: selectedStats.avoirs ? '5px' : '0'
                 }}>
                   <div style={{ fontWeight: 'bold', color: '#ef6c00' }}>
                     Avoirs
                   </div>
                   <button
                     style={{
                       padding: '2px 8px',
                       backgroundColor: selectedStats.avoirs ? '#28a745' : '#6c757d',
                       color: 'white',
                       border: 'none',
                       borderRadius: '4px',
                       fontSize: '10px',
                       fontWeight: 'bold',
                       cursor: 'pointer'
                     }}
                   >
                     {selectedStats.avoirs ? 'ON' : 'OFF'}
                   </button>
                 </div>
                 {selectedStats.avoirs && (
                   <div style={{ 
                     fontSize: '18px', 
                     fontWeight: 'bold', 
                     color: '#ef6c00',
                     transition: 'all 0.3s'
                   }}>
                     {formatCurrency(filteredData.reduce((sum, item) => sum + ((parseFloat(item.avoirC) || 0) - (parseFloat(item.avoirD) || 0)), 0))}
                   </div>
                 )}
               </div>

               <div style={{
                 padding: '15px',
                 backgroundColor: '#fce4ec',
                 borderRadius: '8px',
                 border: '2px solid #f8bbd9',
                 transition: 'all 0.3s',
                 cursor: 'pointer'
               }}
               onClick={() => handleToggleStat('compteClient')}
               >
                 <div style={{ 
                   display: 'flex', 
                   justifyContent: 'space-between', 
                   alignItems: 'center',
                   marginBottom: selectedStats.compteClient ? '5px' : '0'
                 }}>
                   <div style={{ fontWeight: 'bold', color: '#c2185b' }}>
                     Compte Client
                   </div>
                   <button
                     style={{
                       padding: '2px 8px',
                       backgroundColor: selectedStats.compteClient ? '#28a745' : '#6c757d',
                       color: 'white',
                       border: 'none',
                       borderRadius: '4px',
                       fontSize: '10px',
                       fontWeight: 'bold',
                       cursor: 'pointer'
                     }}
                   >
                     {selectedStats.compteClient ? 'ON' : 'OFF'}
                   </button>
                 </div>
                 {selectedStats.compteClient && (
                   <div style={{ 
                     fontSize: '18px', 
                     fontWeight: 'bold', 
                     color: '#c2185b',
                     transition: 'all 0.3s'
                   }}>
                     {formatCurrency(filteredData.reduce((sum, item) => sum + ((parseFloat(item.compteClientC) || 0) - (parseFloat(item.compteClientD) || 0)), 0))}
                   </div>
                 )}
               </div>

               <div style={{
                 padding: '15px',
                 backgroundColor: '#e0f2f1',
                 borderRadius: '8px',
                 border: '2px solid #b2dfdb',
                 transition: 'all 0.3s',
                 cursor: 'pointer'
               }}
               onClick={() => handleToggleStat('paiementNFois')}
               >
                 <div style={{ 
                   display: 'flex', 
                   justifyContent: 'space-between', 
                   alignItems: 'center',
                   marginBottom: selectedStats.paiementNFois ? '5px' : '0'
                 }}>
                   <div style={{ fontWeight: 'bold', color: '#00695c' }}>
                     Paiement N fois
                   </div>
                   <button
                     style={{
                       padding: '2px 8px',
                       backgroundColor: selectedStats.paiementNFois ? '#28a745' : '#6c757d',
                       color: 'white',
                       border: 'none',
                       borderRadius: '4px',
                       fontSize: '10px',
                       fontWeight: 'bold',
                       cursor: 'pointer'
                     }}
                   >
                     {selectedStats.paiementNFois ? 'ON' : 'OFF'}
                   </button>
                 </div>
                 {selectedStats.paiementNFois && (
                   <div style={{ 
                     fontSize: '18px', 
                     fontWeight: 'bold', 
                     color: '#00695c',
                     transition: 'all 0.3s'
                   }}>
                     {formatCurrency(filteredData.reduce((sum, item) => sum + ((parseFloat(item.paiementNFoisC) || 0) - (parseFloat(item.paiementNFoisD) || 0)), 0))}
                   </div>
                 )}
               </div>

               <div style={{
                 padding: '15px',
                 backgroundColor: '#f1f8e9',
                 borderRadius: '8px',
                 border: '2px solid #dcedc8',
                 transition: 'all 0.3s',
                 cursor: 'pointer'
               }}
               onClick={() => handleToggleStat('summup')}
               >
                 <div style={{ 
                   display: 'flex', 
                   justifyContent: 'space-between', 
                   alignItems: 'center',
                   marginBottom: selectedStats.summup ? '5px' : '0'
                 }}>
                   <div style={{ fontWeight: 'bold', color: '#689f38' }}>
                     Summup
                   </div>
                   <button
                     style={{
                       padding: '2px 8px',
                       backgroundColor: selectedStats.summup ? '#28a745' : '#6c757d',
                       color: 'white',
                       border: 'none',
                       borderRadius: '4px',
                       fontSize: '10px',
                       fontWeight: 'bold',
                       cursor: 'pointer'
                     }}
                   >
                     {selectedStats.summup ? 'ON' : 'OFF'}
                   </button>
                 </div>
                 {selectedStats.summup && (
                   <div style={{ 
                     fontSize: '18px', 
                     fontWeight: 'bold', 
                     color: '#689f38',
                     transition: 'all 0.3s'
                   }}>
                     {formatCurrency(filteredData.reduce((sum, item) => sum + ((parseFloat(item.summupC) || 0) - (parseFloat(item.summupD) || 0)), 0))}
                   </div>
                 )}
               </div>

               <div style={{
                 padding: '15px',
                 backgroundColor: '#fff8e1',
                 borderRadius: '8px',
                 border: '2px solid #ffecb3',
                 transition: 'all 0.3s',
                 cursor: 'pointer'
               }}
               onClick={() => handleToggleStat('carteCadeau')}
               >
                 <div style={{ 
                   display: 'flex', 
                   justifyContent: 'space-between', 
                   alignItems: 'center',
                   marginBottom: selectedStats.carteCadeau ? '5px' : '0'
                 }}>
                   <div style={{ fontWeight: 'bold', color: '#f57f17' }}>
                     Cartes Cadeaux
                   </div>
                   <button
                     style={{
                       padding: '2px 8px',
                       backgroundColor: selectedStats.carteCadeau ? '#28a745' : '#6c757d',
                       color: 'white',
                       border: 'none',
                       borderRadius: '4px',
                       fontSize: '10px',
                       fontWeight: 'bold',
                       cursor: 'pointer'
                     }}
                   >
                     {selectedStats.carteCadeau ? 'ON' : 'OFF'}
                   </button>
                 </div>
                 {selectedStats.carteCadeau && (
                   <div style={{ 
                     fontSize: '18px', 
                     fontWeight: 'bold', 
                     color: '#f57f17',
                     transition: 'all 0.3s'
                   }}>
                     {formatCurrency(filteredData.reduce((sum, item) => sum + ((parseFloat(item.carteCadeauC) || 0) - (parseFloat(item.carteCadeauD) || 0)), 0))}
                   </div>
                 )}
               </div>

               <div style={{
                 padding: '15px',
                 backgroundColor: '#fafafa',
                 borderRadius: '8px',
                 border: '2px solid #e0e0e0',
                 transition: 'all 0.3s',
                 cursor: 'pointer'
               }}
               onClick={() => handleToggleStat('differe')}
               >
                 <div style={{ 
                   display: 'flex', 
                   justifyContent: 'space-between', 
                   alignItems: 'center',
                   marginBottom: selectedStats.differe ? '5px' : '0'
                 }}>
                   <div style={{ fontWeight: 'bold', color: '#424242' }}>
                     Différé
                   </div>
                   <button
                     style={{
                       padding: '2px 8px',
                       backgroundColor: selectedStats.differe ? '#28a745' : '#6c757d',
                       color: 'white',
                       border: 'none',
                       borderRadius: '4px',
                       fontSize: '10px',
                       fontWeight: 'bold',
                       cursor: 'pointer'
                     }}
                   >
                     {selectedStats.differe ? 'ON' : 'OFF'}
                   </button>
                 </div>
                 {selectedStats.differe && (
                   <div style={{ 
                     fontSize: '18px', 
                     fontWeight: 'bold', 
                     color: '#424242',
                     transition: 'all 0.3s'
                   }}>
                     {formatCurrency(filteredData.reduce((sum, item) => sum + ((parseFloat(item.differeC) || 0) - (parseFloat(item.differeD) || 0)), 0))}
                   </div>
                 )}
               </div>

               <div style={{
                 padding: '15px',
                 backgroundColor: '#ffebee',
                 borderRadius: '8px',
                 border: '2px solid #ffcdd2',
                 transition: 'all 0.3s',
                 cursor: 'pointer'
               }}
               onClick={() => handleToggleStat('attente')}
               >
                 <div style={{ 
                   display: 'flex', 
                   justifyContent: 'space-between', 
                   alignItems: 'center',
                   marginBottom: selectedStats.attente ? '5px' : '0'
                 }}>
                   <div style={{ fontWeight: 'bold', color: '#d32f2f' }}>
                     Attente
                   </div>
                   <button
                     style={{
                       padding: '2px 8px',
                       backgroundColor: selectedStats.attente ? '#28a745' : '#6c757d',
                       color: 'white',
                       border: 'none',
                       borderRadius: '4px',
                       fontSize: '10px',
                       fontWeight: 'bold',
                       cursor: 'pointer'
                     }}
                   >
                     {selectedStats.attente ? 'ON' : 'OFF'}
                   </button>
                 </div>
                 {selectedStats.attente && (
                   <div style={{ 
                     fontSize: '18px', 
                     fontWeight: 'bold', 
                     color: '#d32f2f',
                     transition: 'all 0.3s'
                   }}>
                     {formatCurrency(filteredData.reduce((sum, item) => sum + ((parseFloat(item.attenteC) || 0) - (parseFloat(item.attenteD) || 0)), 0))}
                   </div>
                 )}
               </div>
             </div>
           </div>
         )}

        {/* Detailed Data Table */}
        {filteredData.length > 0 && (
          <div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <h3 style={{
                margin: 0,
                color: '#333',
                fontSize: '20px',
                fontWeight: 'bold'
              }}>
                📋 Détail des données - {filteredData.length} jours
              </h3>
              <button
                onClick={() => setShowAllData(!showAllData)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: showAllData ? '#dc3545' : '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'background-color 0.3s'
                }}
              >
                {showAllData ? '📋 Voir moins' : '📋 Voir tout'}
              </button>
            </div>

            <div style={{
              maxHeight: showAllData ? '600px' : '400px',
              overflow: 'auto',
              border: '1px solid #ddd',
              borderRadius: '8px'
            }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '12px'
              }}>
                <thead>
                  <tr style={{
                    backgroundColor: '#f8f9fa',
                    fontWeight: 'bold',
                    position: 'sticky',
                    top: 0
                  }}>
                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>
                      Date
                    </th>
                    <th style={{ padding: '8px', textAlign: 'right', borderBottom: '2px solid #ddd' }}>
                      CA TTC
                    </th>
                    <th style={{ padding: '8px', textAlign: 'right', borderBottom: '2px solid #ddd' }}>
                      CA HT
                    </th>
                    <th style={{ padding: '8px', textAlign: 'right', borderBottom: '2px solid #ddd' }}>
                      TVA
                    </th>
                    <th style={{ padding: '8px', textAlign: 'right', borderBottom: '2px solid #ddd' }}>
                      Encaiss.
                    </th>
                    <th style={{ padding: '8px', textAlign: 'right', borderBottom: '2px solid #ddd' }}>
                      BC
                    </th>
                    <th style={{ padding: '8px', textAlign: 'right', borderBottom: '2px solid #ddd' }}>
                      Espèces
                    </th>
                    <th style={{ padding: '8px', textAlign: 'right', borderBottom: '2px solid #ddd' }}>
                      Cartes
                    </th>
                    <th style={{ padding: '8px', textAlign: 'right', borderBottom: '2px solid #ddd' }}>
                      Chèques
                    </th>
                    <th style={{ padding: '8px', textAlign: 'right', borderBottom: '2px solid #ddd' }}>
                      Virements
                    </th>
                    <th style={{ padding: '8px', textAlign: 'right', borderBottom: '2px solid #ddd' }}>
                      Avoirs
                    </th>
                    <th style={{ padding: '8px', textAlign: 'right', borderBottom: '2px solid #ddd' }}>
                      Compte Client
                    </th>
                    <th style={{ padding: '8px', textAlign: 'right', borderBottom: '2px solid #ddd' }}>
                      N fois
                    </th>
                    <th style={{ padding: '8px', textAlign: 'right', borderBottom: '2px solid #ddd' }}>
                      Summup
                    </th>
                    <th style={{ padding: '8px', textAlign: 'right', borderBottom: '2px solid #ddd' }}>
                      Carte Cadeau
                    </th>
                    <th style={{ padding: '8px', textAlign: 'right', borderBottom: '2px solid #ddd' }}>
                      Différé
                    </th>
                    <th style={{ padding: '8px', textAlign: 'right', borderBottom: '2px solid #ddd' }}>
                      Attente
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(showAllData ? filteredData : filteredData.slice(0, 15)).map((item, index) => (
                    <tr key={index} style={{
                      borderBottom: '1px solid #eee',
                      backgroundColor: index % 2 === 0 ? 'white' : '#f8f9fa'
                    }}>
                      <td style={{ padding: '8px' }}>
                        {formatDate(item.date)}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>
                        {formatCurrency(item.ca)}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>
                        {formatCurrency(item.caHT)}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>
                        {formatCurrency(item.tvaTotale)}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>
                        {formatCurrency(item.encaissement)}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>
                        {formatCurrency(item.bc)}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>
                        {formatCurrency((item.especesC || 0) - (item.especesD || 0))}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>
                        {formatCurrency((item.carteC || 0) - (item.carteD || 0))}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>
                        {formatCurrency((item.chequeC || 0) - (item.chequeD || 0))}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>
                        {formatCurrency((item.virementC || 0) - (item.virementD || 0))}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>
                        {formatCurrency((item.avoirC || 0) - (item.avoirD || 0))}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>
                        {formatCurrency((item.compteClientC || 0) - (item.compteClientD || 0))}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>
                        {formatCurrency((item.paiementNFoisC || 0) - (item.paiementNFoisD || 0))}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>
                        {formatCurrency((item.summupC || 0) - (item.summupD || 0))}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>
                        {formatCurrency((item.carteCadeauC || 0) - (item.carteCadeauD || 0))}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>
                        {formatCurrency((item.differeC || 0) - (item.differeD || 0))}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>
                        {formatCurrency((item.attenteC || 0) - (item.attenteD || 0))}
                      </td>
                    </tr>
                  ))}
                  {!showAllData && filteredData.length > 15 && (
                    <tr>
                      <td colSpan="17" style={{
                        padding: '8px',
                        textAlign: 'center',
                        color: '#666',
                        fontStyle: 'italic',
                        backgroundColor: '#f8f9fa'
                      }}>
                        ... et {filteredData.length - 15} autres jours
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* No Data Message */}
        {filteredData.length === 0 && (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            color: '#666',
            fontStyle: 'italic',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            marginTop: '20px'
          }}>
            Aucune donnée disponible pour {format(selectedMonth, 'MMMM yyyy', { locale: fr })}
          </div>
        )}

        {/* Footer */}
        <div style={{
          marginTop: '30px',
          padding: '20px',
          backgroundColor: '#f8f9fa',
          borderRadius: '12px',
          fontSize: '14px',
          color: '#666',
          textAlign: 'center'
        }}>
          <strong>© Nicolas Lefevre</strong> - Données détaillées pour {shop.name}
        </div>
      </div>
    </div>
  );
};

export default ShopDetailPage; 