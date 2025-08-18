import * as XLSX from 'xlsx';

// Fonction pour lire un fichier Excel et retourner les données JSON brutes
export const importCAFromExcel = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Prendre la première feuille
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convertir en JSON avec en-têtes
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        console.log('Données Excel converties en JSON:', jsonData);
        resolve(jsonData);
      } catch (error) {
        console.error('Erreur lors de la lecture du fichier Excel:', error);
        reject(error);
      }
    };
    
    reader.onerror = (error) => {
      console.error('Erreur lors de la lecture du fichier:', error);
      reject(error);
    };
    
    reader.readAsArrayBuffer(file);
  });
};

// Fonction pour valider une date
const isValidDate = (date) => {
  if (typeof date === 'string') {
    const dateObj = new Date(date);
    return !isNaN(dateObj.getTime());
  }
  if (typeof date === 'number') {
    // Les dates Excel sont stockées comme des nombres (jours depuis le 1er janvier 1900)
    // Convertir en objet Date
    const excelDate = new Date((date - 25569) * 86400 * 1000);
    return !isNaN(excelDate.getTime());
  }
  return false;
};

// Fonction pour valider un nombre
const isValidNumber = (value) => {
  if (typeof value === 'number') return true;
  if (typeof value === 'string') {
    // Convertir les virgules en points et vérifier
    const converted = convertToNumber(value);
    return !isNaN(parseFloat(converted));
  }
  return false;
};

// Fonction pour convertir les nombres (virgules vers points et centimes vers euros)
const convertToNumber = (value) => {
  // Si la valeur est null, undefined ou vide, retourner 0
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  
  if (typeof value === 'string') {
    // Remplacer les virgules par des points pour les décimaux
    const cleaned = value.replace(',', '.');
    const num = parseFloat(cleaned);
    // Si c'est un nombre valide et qu'il est grand (probablement en centimes), diviser par 100
    if (!isNaN(num) && num > 1000) {
      return num / 100;
    }
    return isNaN(num) ? 0 : num;
  }
  if (typeof value === 'number') {
    // Les valeurs sont stockées en centimes, diviser par 100 pour obtenir les euros
    return value / 100;
  }
  return 0;
};

// Fonction pour formater la date
const formatDate = (date) => {
  if (typeof date === 'string') {
    // Si c'est déjà au format YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
    }
    
    // Sinon, essayer de parser et reformater
    const dateObj = new Date(date);
    if (!isNaN(dateObj.getTime())) {
      return dateObj.toISOString().split('T')[0];
    }
  }
  
  if (typeof date === 'number') {
    // Les dates Excel sont stockées comme des nombres (jours depuis le 1er janvier 1900)
    // Convertir en objet Date
    const excelDate = new Date((date - 25569) * 86400 * 1000);
    if (!isNaN(excelDate.getTime())) {
      return excelDate.toISOString().split('T')[0];
    }
  }
  
  // Si c'est un objet Date
  if (date instanceof Date) {
    return date.toISOString().split('T')[0];
  }
  
  return date;
};

// Fonction pour extraire les données CA du fichier Excel
export const extractCAData = (jsonData) => {
  const caData = [];
  
  console.log('Données JSON brutes du fichier Excel:', jsonData);
  console.log('Nombre de lignes:', jsonData.length);

  // Ignorer la première ligne (en-têtes)
  for (let i = 1; i < jsonData.length; i++) {
    const row = jsonData[i];
    console.log(`Ligne ${i}:`, row);

    if (row && row.length >= 10) {
      const date = row[0]; // Colonne A (Id)
      const ca = row[9];   // Colonne J (CA)
      
      console.log(`Ligne ${i} - Date (col A):`, date, 'Type:', typeof date);
      console.log(`Ligne ${i} - CA (col J):`, ca, 'Type:', typeof ca);

      // Vérifier que la date et le CA sont valides
      if (date && ca && isValidDate(date) && isValidNumber(ca)) {
        const formattedDate = formatDate(date);
        const convertedCA = parseFloat(convertToNumber(ca));
        
        console.log(`Ligne ${i} - Données valides trouvées:`, {
          originalDate: date,
          formattedDate: formattedDate,
          originalCA: ca,
          convertedCA: convertedCA
        });
        
        caData.push({
          date: formattedDate,
          ca: convertedCA,
          originalDate: date,
          originalCA: ca
        });
      } else {
        console.log(`Ligne ${i} - Données invalides:`, {
          hasDate: !!date,
          hasCA: !!ca,
          isValidDate: isValidDate(date),
          isValidNumber: isValidNumber(ca)
        });
      }
    } else {
      console.log(`Ligne ${i} - Colonnes insuffisantes:`, row ? row.length : 'null/undefined');
    }
  }
  
  console.log('Données CA finales extraites:', caData);
  return caData;
};

// Fonction pour sauvegarder les données CA dans localStorage
export const saveCAData = (shopId, caData) => {
  try {
    const key = `ca_data_${shopId}`;
    localStorage.setItem(key, JSON.stringify(caData));
    console.log(`Données CA sauvegardées pour la boutique ${shopId}:`, caData);
    return true;
  } catch (error) {
    console.error('Erreur lors de la sauvegarde des données CA:', error);
    return false;
  }
};

// Fonction pour récupérer les données CA depuis localStorage
export const getCAData = (shopId) => {
  try {
    const key = `ca_data_${shopId}`;
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Erreur lors de la récupération des données CA:', error);
    return [];
  }
};

// Fonction pour calculer le CA total d'un mois
export const calculateMonthlyCA = (caData, year, month) => {
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);
  
  let totalCA = 0;
  let daysWithCA = 0;
  
  caData.forEach(item => {
    const itemDate = new Date(item.date);
    if (itemDate >= monthStart && itemDate <= monthEnd) {
      totalCA += item.ca;
      daysWithCA++;
    }
  });
  
  return {
    totalCA: totalCA.toFixed(2),
    daysWithCA,
    averageCA: daysWithCA > 0 ? (totalCA / daysWithCA).toFixed(2) : '0.00'
  };
};

// Fonction pour obtenir le CA d'un jour spécifique
export const getCADay = (caData, date) => {
  const targetDate = typeof date === 'string' ? date : date.toISOString().split('T')[0];
  const dayData = caData.find(item => item.date === targetDate);
  return dayData ? dayData.ca : 0;
};

// Nouvelle fonction pour extraire toutes les données du fichier Excel
export const extractAllData = (jsonData) => {
  console.log('Données JSON brutes du fichier Excel:', jsonData);
  console.log('Nombre de lignes:', jsonData.length);

  const allData = [];
  
  // Ignorer la première ligne (en-têtes)
  for (let i = 1; i < jsonData.length; i++) {
    const row = jsonData[i];
    console.log(`Ligne ${i}:`, row);
    
    if (row.length < 34) {
      console.log(`Ligne ${i} ignorée - nombre de colonnes insuffisant`);
      continue;
    }

    const date = row[0]; // Colonne A - Date
    const ht0C = row[1]; // Colonne B - HT 0% Crédit
    const ht0D = row[2]; // Colonne C - HT 0% Débit
    const tva0C = row[3]; // Colonne D - TVA 0% Crédit
    const tva0D = row[4]; // Colonne E - TVA 0% Débit
    const ht20C = row[5]; // Colonne F - HT 20% Crédit
    const ht20D = row[6]; // Colonne G - HT 20% Débit
    const tva20C = row[7]; // Colonne H - TVA 20% Crédit
    const tva20D = row[8]; // Colonne I - TVA 20% Débit
    const ca = row[9]; // Colonne J - CA TTC
    const bc = row[10]; // Colonne K - Bon de Commande
    const encaissement = row[11]; // Colonne L - Encaissement
    const especesC = row[12]; // Colonne M - Espèces Crédit
    const especesD = row[13]; // Colonne N - Espèces Débit
    const chequeC = row[14]; // Colonne O - Chèque Crédit
    const chequeD = row[15]; // Colonne P - Chèque Débit
    const carteC = row[16]; // Colonne Q - Carte bancaire Crédit
    const carteD = row[17]; // Colonne R - Carte bancaire Débit
    const virementC = row[18]; // Colonne S - Virement bancaire Crédit
    const virementD = row[19]; // Colonne T - Virement bancaire Débit
    const avoirC = row[20]; // Colonne U - Avoir Crédit
    const avoirD = row[21]; // Colonne V - Avoir Débit
    const compteClientC = row[22]; // Colonne W - Compte client Crédit
    const compteClientD = row[23]; // Colonne X - Compte client Débit
    const paiementNFoisC = row[24]; // Colonne Y - Paiement en N fois Crédit
    const paiementNFoisD = row[25]; // Colonne Z - Paiement en N fois Débit
    const summupC = row[26]; // Colonne AA - Summup Crédit
    const summupD = row[27]; // Colonne BB - Summup Débit
    const carteCadeauC = row[28]; // Colonne CC - Carte cadeau Crédit
    const carteCadeauD = row[29]; // Colonne DD - Carte cadeau Débit
    const differeC = row[30]; // Colonne EE - Différé Crédit
    const differeD = row[31]; // Colonne FF - Différé Débit
    const attenteC = row[32]; // Colonne GG - Attente Crédit
    const attenteD = row[33]; // Colonne HH - Attente Débit

    // Validation de la date
    if (!isValidDate(date)) {
      console.log(`Ligne ${i} - Date invalide:`, date);
      continue;
    }

    // Créer l'objet avec toutes les données
    const dataRow = {
      date: formatDate(date),
      ht0C: convertToNumber(ht0C),
      ht0D: convertToNumber(ht0D),
      tva0C: convertToNumber(tva0C),
      tva0D: convertToNumber(tva0D),
      ht20C: convertToNumber(ht20C),
      ht20D: convertToNumber(ht20D),
      tva20C: convertToNumber(tva20C),
      tva20D: convertToNumber(tva20D),
      ca: convertToNumber(ca),
      bc: convertToNumber(bc),
      encaissement: convertToNumber(encaissement),
      especesC: convertToNumber(especesC),
      especesD: convertToNumber(especesD),
      chequeC: convertToNumber(chequeC),
      chequeD: convertToNumber(chequeD),
      carteC: convertToNumber(carteC),
      carteD: convertToNumber(carteD),
      virementC: convertToNumber(virementC),
      virementD: convertToNumber(virementD),
      avoirC: convertToNumber(avoirC),
      avoirD: convertToNumber(avoirD),
      compteClientC: convertToNumber(compteClientC),
      compteClientD: convertToNumber(compteClientD),
      paiementNFoisC: convertToNumber(paiementNFoisC),
      paiementNFoisD: convertToNumber(paiementNFoisD),
      summupC: convertToNumber(summupC),
      summupD: convertToNumber(summupD),
      carteCadeauC: convertToNumber(carteCadeauC),
      carteCadeauD: convertToNumber(carteCadeauD),
      differeC: convertToNumber(differeC),
      differeD: convertToNumber(differeD),
      attenteC: convertToNumber(attenteC),
      attenteD: convertToNumber(attenteD)
    };

    // Calculs dérivés
    dataRow.caHT = dataRow.ht0C + dataRow.ht20C - dataRow.ht0D - dataRow.ht20D;
    dataRow.tvaTotale = dataRow.tva0C + dataRow.tva20C - dataRow.tva0D - dataRow.tva20D;
    dataRow.totalPaiements = dataRow.especesC + dataRow.chequeC + dataRow.carteC + dataRow.virementC + 
                            dataRow.avoirC + dataRow.compteClientC + dataRow.paiementNFoisC + 
                            dataRow.summupC + dataRow.carteCadeauC + dataRow.differeC + dataRow.attenteC;

    // Debug des valeurs importantes
    console.log(`Ligne ${i} - Valeurs importantes:`, {
      date: dataRow.date,
      ca: dataRow.ca,
      caHT: dataRow.caHT,
      tvaTotale: dataRow.tvaTotale,
      bc: dataRow.bc,
      encaissement: dataRow.encaissement,
      especes: (dataRow.especesC || 0) - (dataRow.especesD || 0),
      cartes: (dataRow.carteC || 0) - (dataRow.carteD || 0),
      cheques: (dataRow.chequeC || 0) - (dataRow.chequeD || 0),
      virements: (dataRow.virementC || 0) - (dataRow.virementD || 0),
      comptesClients: (dataRow.compteClientC || 0) - (dataRow.compteClientD || 0),
      nFois: (dataRow.paiementNFoisC || 0) - (dataRow.paiementNFoisD || 0),
      cartesCadeaux: (dataRow.carteCadeauC || 0) - (dataRow.carteCadeauD || 0),
      differes: (dataRow.differeC || 0) - (dataRow.differeD || 0)
    });

    allData.push(dataRow);
    console.log(`Ligne ${i} - Données extraites:`, dataRow);
  }

  console.log('Données complètes extraites:', allData);
  return allData;
};

// Fonction pour sauvegarder toutes les données
export const saveAllData = (shopId, data) => {
  try {
    const key = `shop_all_data_${shopId}`;
    localStorage.setItem(key, JSON.stringify(data));
    console.log(`Données complètes sauvegardées pour la boutique ${shopId}:`, data.length, 'lignes');
    return true;
  } catch (error) {
    console.error('Erreur lors de la sauvegarde des données complètes:', error);
    return false;
  }
};

// Fonction pour récupérer toutes les données
export const getAllData = (shopId) => {
  try {
    const key = `shop_all_data_${shopId}`;
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Erreur lors de la récupération des données complètes:', error);
    return [];
  }
};

// Fonction pour calculer les statistiques complètes
export const calculateCompleteStats = (data, year, month) => {
  if (!data || data.length === 0) return null;

  const filteredData = data.filter(item => {
    const itemDate = new Date(item.date);
    return itemDate.getFullYear() === year && itemDate.getMonth() === month;
  });

  if (filteredData.length === 0) return null;

  const stats = {
    totalDays: filteredData.length,
    totalCA: 0,
    totalCAHT: 0,
    totalTVA: 0,
    totalEncaissement: 0,
    totalBC: 0,
    paiements: {
      especes: 0,
      cheques: 0,
      cartes: 0,
      virements: 0,
      avoirs: 0,
      comptesClients: 0,
      paiementsNFois: 0,
      summup: 0,
      cartesCadeaux: 0,
      differes: 0,
      attentes: 0
    },
    averageCA: 0,
    averageCAHT: 0,
    averageEncaissement: 0
  };

  filteredData.forEach(item => {
    stats.totalCA += item.ca || 0;
    stats.totalCAHT += item.caHT || 0;
    stats.totalTVA += item.tvaTotale || 0;
    stats.totalEncaissement += item.encaissement || 0;
    stats.totalBC += item.bc || 0;
    
    // Paiements
    stats.paiements.especes += (item.especesC || 0) - (item.especesD || 0);
    stats.paiements.cheques += (item.chequeC || 0) - (item.chequeD || 0);
    stats.paiements.cartes += (item.carteC || 0) - (item.carteD || 0);
    stats.paiements.virements += (item.virementC || 0) - (item.virementD || 0);
    stats.paiements.avoirs += (item.avoirC || 0) - (item.avoirD || 0);
    stats.paiements.comptesClients += (item.compteClientC || 0) - (item.compteClientD || 0);
    stats.paiements.paiementsNFois += (item.paiementNFoisC || 0) - (item.paiementNFoisD || 0);
    stats.paiements.summup += (item.summupC || 0) - (item.summupD || 0);
    stats.paiements.cartesCadeaux += (item.carteCadeauC || 0) - (item.carteCadeauD || 0);
    stats.paiements.differes += (item.differeC || 0) - (item.differeD || 0);
    stats.paiements.attentes += (item.attenteC || 0) - (item.attenteD || 0);
  });

  // Moyennes
  stats.averageCA = stats.totalCA / stats.totalDays;
  stats.averageCAHT = stats.totalCAHT / stats.totalDays;
  stats.averageEncaissement = stats.totalEncaissement / stats.totalDays;

  return stats;
};

// Fonction pour obtenir les données d'une journée spécifique
export const getDayData = (shopId, date) => {
  const allData = getAllData(shopId);
  return allData.find(item => item.date === date) || null;
}; 