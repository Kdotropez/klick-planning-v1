import React, { useState } from 'react';
import { importCAFromExcel, extractAllData, extractCAData, saveAllData } from '../../utils/excelImportUtils';

const ExcelImportModal = ({ isOpen, onClose, shops, currentShop, selectedMonth, onImportSuccess }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importType, setImportType] = useState('complete'); // 'ca' ou 'complete'

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    setSelectedFile(file);
    setImportResult(null);
  };

  const handleImport = async () => {
    if (!selectedFile || !currentShop) {
      setImportResult({
        success: false,
        message: 'Veuillez sélectionner un fichier et une boutique'
      });
      return;
    }

    setIsLoading(true);
    setImportResult(null);

    try {
      const jsonData = await importCAFromExcel(selectedFile);
      
      if (!jsonData || jsonData.length === 0) {
        setImportResult({
          success: false,
          message: 'Aucune donnée trouvée dans le fichier Excel'
        });
        return;
      }

      let importedData;
      let successMessage;

      if (importType === 'complete') {
        // Import complet de toutes les données
        importedData = extractAllData(jsonData);
        successMessage = `Import complet réussi ! ${importedData.length} jours de données importées avec toutes les colonnes (CA, HT, TVA, moyens de paiement, etc.)`;
      } else {
        // Import CA uniquement (ancienne méthode)
        importedData = extractCAData(jsonData);
        successMessage = `Import CA réussi ! ${importedData.length} jours de CA importés`;
      }

      if (importedData.length === 0) {
        setImportResult({
          success: false,
          message: 'Aucune donnée valide trouvée dans le fichier'
        });
        return;
      }

      // Sauvegarder les données
      const saveSuccess = saveAllData(currentShop, importedData);
      
      if (!saveSuccess) {
        setImportResult({
          success: false,
          message: 'Erreur lors de la sauvegarde des données'
        });
        return;
      }

      setImportResult({
        success: true,
        message: successMessage,
        dataCount: importedData.length
      });

      // Notifier le parent du succès
      if (onImportSuccess) {
        onImportSuccess(currentShop, importedData);
      }

    } catch (error) {
      console.error('Erreur lors de l\'import:', error);
      setImportResult({
        success: false,
        message: `Erreur lors de l'import: ${error.message}`
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setImportResult(null);
    setImportType('complete');
    onClose();
  };

  if (!isOpen) return null;

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
      zIndex: 2000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '30px',
        maxWidth: '600px',
        width: '90%',
        maxHeight: '80vh',
        overflow: 'auto',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '25px',
          borderBottom: '2px solid #f0f0f0',
          paddingBottom: '15px'
        }}>
          <h2 style={{
            margin: 0,
            color: '#333',
            fontSize: '24px',
            fontWeight: 'bold'
          }}>
            📊 Import Excel - Données Complètes
          </h2>
          <button
            onClick={handleClose}
            style={{
              padding: '8px 16px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            ❌
          </button>
        </div>

        {/* Type d'import */}
        <div style={{ marginBottom: '25px' }}>
          <label style={{
            display: 'block',
            marginBottom: '10px',
            fontWeight: 'bold',
            color: '#555',
            fontSize: '16px'
          }}>
            🎯 Type d'import :
          </label>
          <div style={{
            display: 'flex',
            gap: '15px',
            alignItems: 'center'
          }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer'
            }}>
              <input
                type="radio"
                value="complete"
                checked={importType === 'complete'}
                onChange={(e) => setImportType(e.target.value)}
                style={{ transform: 'scale(1.2)' }}
              />
              <span style={{ fontWeight: 'bold', color: '#007bff' }}>
                📋 Import Complet (Recommandé)
              </span>
            </label>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer'
            }}>
              <input
                type="radio"
                value="ca"
                checked={importType === 'ca'}
                onChange={(e) => setImportType(e.target.value)}
                style={{ transform: 'scale(1.2)' }}
              />
              <span style={{ color: '#666' }}>
                💰 CA uniquement
              </span>
            </label>
          </div>
        </div>

        {/* Informations sur l'import complet */}
        {importType === 'complete' && (
          <div style={{
            marginBottom: '25px',
            padding: '15px',
            backgroundColor: '#e3f2fd',
            borderRadius: '8px',
            border: '1px solid #2196f3'
          }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#1976d2' }}>
              📊 Import Complet - Données récupérées :
            </h4>
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: '#1976d2' }}>
              <li><strong>CA TTC et HT</strong> - Chiffre d'affaires complet</li>
              <li><strong>TVA</strong> - Détail par taux (0% et 20%)</li>
              <li><strong>Moyens de paiement</strong> - Espèces, chèques, cartes, virements, etc.</li>
              <li><strong>Encaissements</strong> - Totaux et détails</li>
              <li><strong>Bons de commande</strong> - Montants et gestion</li>
              <li><strong>Avoirs et remises</strong> - Gestion des avoirs</li>
            </ul>
          </div>
        )}

        {/* Sélection de fichier */}
        <div style={{ marginBottom: '25px' }}>
          <label style={{
            display: 'block',
            marginBottom: '10px',
            fontWeight: 'bold',
            color: '#555',
            fontSize: '16px'
          }}>
            📁 Sélectionner le fichier Excel :
          </label>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileSelect}
            style={{
              width: '100%',
              padding: '12px',
              border: '2px dashed #ddd',
              borderRadius: '8px',
              backgroundColor: '#f8f9fa'
            }}
          />
          {selectedFile && (
            <div style={{
              marginTop: '10px',
              padding: '10px',
              backgroundColor: '#d4edda',
              borderRadius: '6px',
              fontSize: '14px',
              color: '#155724'
            }}>
              ✅ Fichier sélectionné : {selectedFile.name}
            </div>
          )}
        </div>

        {/* Boutique sélectionnée */}
        <div style={{ marginBottom: '25px' }}>
          <label style={{
            display: 'block',
            marginBottom: '10px',
            fontWeight: 'bold',
            color: '#555',
            fontSize: '16px'
          }}>
            🏪 Boutique de destination :
          </label>
          <div style={{
            padding: '12px',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            border: '2px solid #e9ecef',
            fontSize: '16px',
            fontWeight: 'bold',
            color: '#333'
          }}>
            {shops.find(s => s.id === currentShop)?.name || 'Aucune boutique sélectionnée'}
          </div>
        </div>

        {/* Bouton d'import */}
        <div style={{ marginBottom: '25px' }}>
          <button
            onClick={handleImport}
            disabled={!selectedFile || isLoading}
            style={{
              width: '100%',
              padding: '15px',
              backgroundColor: selectedFile && !isLoading ? '#007bff' : '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: selectedFile && !isLoading ? 'pointer' : 'not-allowed',
              transition: 'background-color 0.3s'
            }}
          >
            {isLoading ? '⏳ Import en cours...' : '📥 Importer les données'}
          </button>
        </div>

        {/* Résultat de l'import */}
        {importResult && (
          <div style={{
            padding: '15px',
            borderRadius: '8px',
            backgroundColor: importResult.success ? '#d4edda' : '#f8d7da',
            border: `1px solid ${importResult.success ? '#c3e6cb' : '#f5c6cb'}`,
            color: importResult.success ? '#155724' : '#721c24',
            fontSize: '14px'
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
              {importResult.success ? '✅ Succès' : '❌ Erreur'}
            </div>
            <div>{importResult.message}</div>
            {importResult.success && importResult.dataCount && (
              <div style={{ marginTop: '10px', fontSize: '12px', opacity: 0.8 }}>
                {importResult.dataCount} lignes de données traitées
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        <div style={{
          marginTop: '25px',
          padding: '15px',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          fontSize: '13px',
          color: '#666'
        }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#333' }}>📋 Instructions :</h4>
          <ul style={{ margin: 0, paddingLeft: '20px' }}>
            <li>Format attendu : fichier Excel avec dates en colonne A</li>
            <li>Les données sont stockées localement pour cette boutique</li>
            <li>L'import complet récupère toutes les colonnes du fichier</li>
            <li>Les valeurs monétaires sont automatiquement converties (centimes → euros)</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ExcelImportModal; 