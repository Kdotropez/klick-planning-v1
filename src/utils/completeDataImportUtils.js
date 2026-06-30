import { loadXlsx } from './xlsxLoader';

// Convertir une date Excel en objet Date
const convertExcelDate = (excelDate) => {
  if (!excelDate || typeof excelDate !== 'number') {
    return null;
  }
  
  // Les dates Excel sont le nombre de jours depuis le 1er janvier 1900
  // On ajoute 25569 pour convertir en timestamp Unix (1er janvier 1970)
  const timestamp = (excelDate - 25569) * 24 * 60 * 60 * 1000;
  return new Date(timestamp);
};

// Convertir un montant en centimes en euros
const convertToEuros = (amount) => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return 0;
  }
  
  // Si le montant est > 1000, on suppose que c'est en centimes
  if (Math.abs(amount) > 1000) {
    return amount / 100;
  }
  
  return amount;
};

// Valider et nettoyer une ligne de données
const validateAndCleanRow = (row, headers) => {
  const cleanedRow = {};
  
  headers.forEach((header, index) => {
    const value = row[index];
    
    switch (header) {
      case 'Id':
        cleanedRow.id = value || null;
        break;
        
      case 'Date':
        cleanedRow.date = convertExcelDate(value);
        break;
        
      case 'Boutique':
        cleanedRow.boutique = value || '';
        break;
        
      case 'Caisse':
        cleanedRow.caisse = value || '';
        break;
        
      case 'Caissier':
        cleanedRow.caissier = value || '';
        break;
        
      case 'Client':
        cleanedRow.client = value || '';
        break;
        
      case 'Entreprise':
        cleanedRow.entreprise = value || '';
        break;
        
      case 'TVA intra':
        cleanedRow.tvaIntra = value || '';
        break;
        
      case 'Commande':
        cleanedRow.commande = value || null;
        break;
        
      case 'HT 0':
        cleanedRow.ht0 = convertToEuros(value);
        break;
        
      case 'TVA 0':
        cleanedRow.tva0 = convertToEuros(value);
        break;
        
      case 'HT 20':
        cleanedRow.ht20 = convertToEuros(value);
        break;
        
      case 'TVA 20':
        cleanedRow.tva20 = convertToEuros(value);
        break;
        
      case 'CA':
        cleanedRow.ca = convertToEuros(value);
        break;
        
      case 'BC':
        cleanedRow.bc = convertToEuros(value);
        break;
        
      case 'Encaissement':
        cleanedRow.encaissement = convertToEuros(value);
        break;
        
      case 'Espèces':
        cleanedRow.especes = convertToEuros(value);
        break;
        
      case 'Chèque':
        cleanedRow.cheque = convertToEuros(value);
        break;
        
      case 'Carte bancaire':
        cleanedRow.carteBancaire = convertToEuros(value);
        break;
        
      case 'Virement bancaire':
        cleanedRow.virementBancaire = convertToEuros(value);
        break;
        
      case 'Avoir':
        cleanedRow.avoir = convertToEuros(value);
        break;
        
      case 'Compte client':
        cleanedRow.compteClient = convertToEuros(value);
        break;
        
      case 'Paiement en N fois':
        cleanedRow.paiementNFois = convertToEuros(value);
        break;
        
      case 'Summup':
        cleanedRow.summup = convertToEuros(value);
        break;
        
      case 'Card via Stripe':
        cleanedRow.cardViaStripe = convertToEuros(value);
        break;
        
      case 'PayPal':
        cleanedRow.paypal = convertToEuros(value);
        break;
        
      case 'Klarna via Stripe':
        cleanedRow.klarnaViaStripe = convertToEuros(value);
        break;
        
      case 'Link via Stripe':
        cleanedRow.linkViaStripe = convertToEuros(value);
        break;
        
      case 'Bancontact via Stripe':
        cleanedRow.bancontactViaStripe = convertToEuros(value);
        break;
        
      case 'Carte cadeau':
        cleanedRow.carteCadeau = convertToEuros(value);
        break;
        
      case 'Différé':
        cleanedRow.differe = convertToEuros(value);
        break;
        
      case 'Attente':
        cleanedRow.attente = convertToEuros(value);
        break;
        
      case 'Facture':
        cleanedRow.facture = value || '';
        break;
        
      default:
        // Pour les colonnes non reconnues, on les garde telles quelles
        cleanedRow[header.toLowerCase().replace(/\s+/g, '_')] = value;
        break;
    }
  });
  
  return cleanedRow;
};

// Analyser les données importées pour générer des statistiques
const analyzeImportedData = (data) => {
  if (!data || data.length === 0) {
    return null;
  }
  
  const shops = [...new Set(data.map(item => item.boutique).filter(Boolean))];
  const dates = data.map(item => item.date).filter(Boolean).sort();
  const totalCA = data.reduce((sum, item) => sum + (item.ca || 0), 0);
  
  const dateRange = dates.length > 0 
    ? `${new Date(dates[0]).toLocaleDateString('fr-FR')} - ${new Date(dates[dates.length - 1]).toLocaleDateString('fr-FR')}`
    : 'Non disponible';
  
  return {
    shops,
    dateRange,
    totalCA: new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(totalCA),
    totalTransactions: data.length
  };
};

// Fonction principale d'import
export const importCompleteDataFromExcel = async (file) => {
  try {
    console.log('📁 Début de l\'import du fichier:', file.name);
    
    // Lire le fichier Excel
    const arrayBuffer = await file.arrayBuffer();
    const XLSX = await loadXlsx();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    // Obtenir la première feuille
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    console.log('📋 Feuille analysée:', sheetName);
    
    // Convertir en JSON avec en-têtes
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    if (jsonData.length < 2) {
      return {
        success: false,
        error: 'Le fichier ne contient pas assez de données (minimum 2 lignes : en-têtes + données)'
      };
    }
    
    // Extraire les en-têtes (première ligne)
    const headers = jsonData[0];
    console.log('📊 En-têtes détectés:', headers);
    
    // Valider que les colonnes essentielles sont présentes
    const requiredColumns = ['Date', 'Boutique', 'CA'];
    const missingColumns = requiredColumns.filter(col => !headers.includes(col));
    
    if (missingColumns.length > 0) {
      return {
        success: false,
        error: `Colonnes manquantes : ${missingColumns.join(', ')}`
      };
    }
    
    // Traiter les lignes de données (à partir de la ligne 2)
    const processedData = [];
    let validRows = 0;
    let invalidRows = 0;
    
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      
      try {
        const cleanedRow = validateAndCleanRow(row, headers);
        
        // Vérifier que la ligne contient des données valides
        if (cleanedRow.date && cleanedRow.boutique && cleanedRow.ca !== null) {
          processedData.push(cleanedRow);
          validRows++;
        } else {
          invalidRows++;
          console.warn('⚠️ Ligne ignorée (données manquantes):', row);
        }
      } catch (error) {
        invalidRows++;
        console.error('❌ Erreur lors du traitement de la ligne:', i + 1, error);
      }
    }
    
    console.log(`✅ Import terminé: ${validRows} lignes valides, ${invalidRows} lignes ignorées`);
    
    if (processedData.length === 0) {
      return {
        success: false,
        error: 'Aucune donnée valide trouvée dans le fichier'
      };
    }
    
    // Analyser les données importées
    const analysis = analyzeImportedData(processedData);
    
    return {
      success: true,
      data: processedData,
      details: analysis,
      stats: {
        totalRows: jsonData.length - 1,
        validRows,
        invalidRows
      }
    };
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'import:', error);
    return {
      success: false,
      error: `Erreur lors de la lecture du fichier: ${error.message}`
    };
  }
};

// Sauvegarder les données dans localStorage
export const saveCompleteData = (data) => {
  try {
    localStorage.setItem('completeData', JSON.stringify(data));
    console.log('💾 Données sauvegardées:', data.length, 'transactions');
    return true;
  } catch (error) {
    console.error('❌ Erreur lors de la sauvegarde:', error);
    return false;
  }
};

// Récupérer les données depuis localStorage
export const getCompleteData = () => {
  try {
    const data = localStorage.getItem('completeData');
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des données:', error);
    return [];
  }
};

// Obtenir les données pour une boutique spécifique
export const getCompleteDataForShop = (shopName) => {
  const allData = getCompleteData();
  return allData.filter(item => item.boutique === shopName);
};

// Obtenir les données pour une période spécifique
export const getCompleteDataForPeriod = (startDate, endDate) => {
  const allData = getCompleteData();
  return allData.filter(item => {
    const itemDate = new Date(item.date);
    return itemDate >= startDate && itemDate <= endDate;
  });
};

// Calculer les statistiques pour une boutique
export const calculateShopStats = (shopName, startDate = null, endDate = null) => {
  let data = getCompleteDataForShop(shopName);
  
  if (startDate && endDate) {
    data = data.filter(item => {
      const itemDate = new Date(item.date);
      return itemDate >= startDate && itemDate <= endDate;
    });
  }
  
  if (data.length === 0) {
    return null;
  }
  
  const stats = {
    totalTransactions: data.length,
    totalCA: data.reduce((sum, item) => sum + (item.ca || 0), 0),
    totalEncaissement: data.reduce((sum, item) => sum + (item.encaissement || 0), 0),
    totalEspeces: data.reduce((sum, item) => sum + (item.especes || 0), 0),
    totalCartes: data.reduce((sum, item) => sum + (item.carteBancaire || 0), 0),
    totalCheques: data.reduce((sum, item) => sum + (item.cheque || 0), 0),
    totalVirements: data.reduce((sum, item) => sum + (item.virementBancaire || 0), 0),
    totalAvoirs: data.reduce((sum, item) => sum + (item.avoir || 0), 0),
    totalCompteClient: data.reduce((sum, item) => sum + (item.compteClient || 0), 0),
    totalPaiementNFois: data.reduce((sum, item) => sum + (item.paiementNFois || 0), 0),
    totalSummup: data.reduce((sum, item) => sum + (item.summup || 0), 0),
    totalCarteCadeau: data.reduce((sum, item) => sum + (item.carteCadeau || 0), 0),
    totalDiffere: data.reduce((sum, item) => sum + (item.differe || 0), 0),
    totalAttente: data.reduce((sum, item) => sum + (item.attente || 0), 0),
    caissiers: [...new Set(data.map(item => item.caissier).filter(Boolean))],
    dateRange: {
      start: new Date(Math.min(...data.map(item => new Date(item.date)))),
      end: new Date(Math.max(...data.map(item => new Date(item.date))))
    }
  };
  
  return stats;
}; 