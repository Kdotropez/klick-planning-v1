import React, { useState, useRef } from 'react';
import { importCompleteDataFromExcel, saveCompleteData, getCompleteData } from '../../utils/completeDataImportUtils';

const CompleteDataImportPage = ({ onClose }) => {
  const [importResult, setImportResult] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importedData, setImportedData] = useState([]);
  const fileInputRef = useRef(null);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      console.log('📁 Fichier sélectionné:', file.name, 'Taille:', file.size);
    }
  };

  const handleImport = async () => {
    const file = fileInputRef.current?.files[0];
    if (!file) {
      setImportResult({ success: false, message: '❌ Veuillez sélectionner un fichier Excel' });
      return;
    }

    setIsImporting(true);
    setImportResult(null);

    try {
      console.log('🚀 Début de l\'import du fichier:', file.name);
      
      const result = await importCompleteDataFromExcel(file);
      
      if (result.success) {
        setImportedData(result.data);
        setImportResult({
          success: true,
          message: `✅ Import réussi ! ${result.data.length} transactions importées`,
          details: result.details
        });
        
        // Sauvegarder les données
        saveCompleteData(result.data);
        console.log('💾 Données sauvegardées dans localStorage');
        
      } else {
        setImportResult({
          success: false,
          message: `❌ Erreur lors de l'import: ${result.error}`
        });
      }
    } catch (error) {
      console.error('❌ Erreur lors de l\'import:', error);
      setImportResult({
        success: false,
        message: `❌ Erreur inattendue: ${error.message}`
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleClearData = () => {
    if (window.confirm('⚠️ Êtes-vous sûr de vouloir supprimer toutes les données importées ?')) {
      localStorage.removeItem('completeData');
      setImportedData([]);
      setImportResult({ success: true, message: '🗑️ Données supprimées avec succès' });
    }
  };

  const loadExistingData = () => {
    const existingData = getCompleteData();
    if (existingData.length > 0) {
      setImportedData(existingData);
      setImportResult({
        success: true,
        message: `📊 Données existantes chargées: ${existingData.length} transactions`
      });
    } else {
      setImportResult({
        success: false,
        message: 'ℹ️ Aucune donnée existante trouvée'
      });
    }
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
        maxWidth: '800px',
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
            📊 Import Données Complètes
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

        {/* Instructions */}
        <div style={{
          backgroundColor: '#f8f9fa',
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '30px',
          border: '1px solid #e9ecef'
        }}>
          <h3 style={{ margin: '0 0 15px 0', color: '#333' }}>
            📋 Instructions d'import
          </h3>
          <ul style={{ margin: 0, paddingLeft: '20px', color: '#555' }}>
            <li>Format supporté : <strong>.xls</strong> ou <strong>.xlsx</strong></li>
            <li>Le fichier doit contenir les colonnes : Id, Date, Boutique, CA, etc.</li>
            <li>Les dates seront automatiquement converties</li>
            <li>Les montants seront traités (centimes → euros)</li>
            <li>Les données existantes seront remplacées</li>
          </ul>
        </div>

        {/* File Selection */}
        <div style={{ marginBottom: '30px' }}>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            fontWeight: 'bold',
            color: '#555',
            fontSize: '16px'
          }}>
            📁 Sélectionner le fichier Excel :
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xls,.xlsx"
            onChange={handleFileSelect}
            style={{
              padding: '12px',
              borderRadius: '8px',
              border: '2px solid #ddd',
              fontSize: '16px',
              backgroundColor: 'white',
              width: '100%'
            }}
          />
        </div>

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: '15px',
          marginBottom: '30px',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={handleImport}
            disabled={isImporting}
            style={{
              padding: '15px 30px',
              backgroundColor: isImporting ? '#6c757d' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: isImporting ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.3s',
              flex: '1',
              minWidth: '200px'
            }}
          >
            {isImporting ? '⏳ Import en cours...' : '🚀 Importer les données'}
          </button>

          <button
            onClick={loadExistingData}
            style={{
              padding: '15px 30px',
              backgroundColor: '#17a2b8',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'background-color 0.3s',
              flex: '1',
              minWidth: '200px'
            }}
          >
            📊 Charger données existantes
          </button>

          <button
            onClick={handleClearData}
            style={{
              padding: '15px 30px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'background-color 0.3s',
              flex: '1',
              minWidth: '200px'
            }}
          >
            🗑️ Supprimer toutes les données
          </button>
        </div>

        {/* Import Result */}
        {importResult && (
          <div style={{
            padding: '20px',
            backgroundColor: importResult.success ? '#d4edda' : '#f8d7da',
            borderRadius: '8px',
            border: `2px solid ${importResult.success ? '#c3e6cb' : '#f5c6cb'}`,
            marginBottom: '30px'
          }}>
            <div style={{
              color: importResult.success ? '#155724' : '#721c24',
              fontWeight: 'bold',
              marginBottom: '10px'
            }}>
              {importResult.message}
            </div>
            
            {importResult.details && (
              <div style={{
                fontSize: '14px',
                color: importResult.success ? '#155724' : '#721c24',
                marginTop: '10px'
              }}>
                <div><strong>Boutiques détectées :</strong> {importResult.details.shops.join(', ')}</div>
                <div><strong>Période :</strong> {importResult.details.dateRange}</div>
                <div><strong>Total CA :</strong> {importResult.details.totalCA} €</div>
              </div>
            )}
          </div>
        )}

        {/* Data Preview */}
        {importedData.length > 0 && (
          <div>
            <h3 style={{
              margin: '0 0 20px 0',
              color: '#333',
              fontSize: '20px',
              fontWeight: 'bold'
            }}>
              📋 Aperçu des données ({importedData.length} transactions)
            </h3>
            
            <div style={{
              maxHeight: '400px',
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
                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>
                      Boutique
                    </th>
                    <th style={{ padding: '8px', textAlign: 'right', borderBottom: '2px solid #ddd' }}>
                      CA
                    </th>
                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>
                      Caissier
                    </th>
                    <th style={{ padding: '8px', textAlign: 'right', borderBottom: '2px solid #ddd' }}>
                      Espèces
                    </th>
                    <th style={{ padding: '8px', textAlign: 'right', borderBottom: '2px solid #ddd' }}>
                      Cartes
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {importedData.slice(0, 10).map((item, index) => (
                    <tr key={index} style={{
                      borderBottom: '1px solid #eee',
                      backgroundColor: index % 2 === 0 ? 'white' : '#f8f9fa'
                    }}>
                      <td style={{ padding: '8px' }}>
                        {new Date(item.date).toLocaleDateString('fr-FR')}
                      </td>
                      <td style={{ padding: '8px' }}>
                        {item.boutique}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>
                        {new Intl.NumberFormat('fr-FR', {
                          style: 'currency',
                          currency: 'EUR'
                        }).format(item.ca)}
                      </td>
                      <td style={{ padding: '8px' }}>
                        {item.caissier}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>
                        {new Intl.NumberFormat('fr-FR', {
                          style: 'currency',
                          currency: 'EUR'
                        }).format(item.especes || 0)}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>
                        {new Intl.NumberFormat('fr-FR', {
                          style: 'currency',
                          currency: 'EUR'
                        }).format(item.carteBancaire || 0)}
                      </td>
                    </tr>
                  ))}
                  {importedData.length > 10 && (
                    <tr>
                      <td colSpan="6" style={{
                        padding: '8px',
                        textAlign: 'center',
                        color: '#666',
                        fontStyle: 'italic',
                        backgroundColor: '#f8f9fa'
                      }}>
                        ... et {importedData.length - 10} autres transactions
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
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
          <strong>© Nicolas Lefevre</strong> - Import de données complètes
        </div>
      </div>
    </div>
  );
};

export default CompleteDataImportPage; 