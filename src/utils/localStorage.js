export const saveToLocalStorage = (key, value) => {
  try {
    console.log(`Saving to localStorage: ${key}`, value);
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error saving to localStorage for key ${key}:`, error);
  }
};

export const loadFromLocalStorage = (key, defaultValue) => {
  try {
    const value = localStorage.getItem(key);
    if (value === null || value === undefined) {
      console.log(`No data in localStorage for key: ${key}, returning default:`, defaultValue);
      return defaultValue;
    }
    const parsed = JSON.parse(value);
    console.log(`Loaded from localStorage: ${key}`, parsed);
    return parsed;
  } catch (error) {
    console.error(`Error loading from localStorage for key ${key}:`, error);
    return defaultValue;
  }
};

export const clearLocalStorage = () => {
  try {
    console.log('Clearing localStorage');
    localStorage.clear();
  } catch (error) {
    console.error('Error clearing localStorage:', error);
  }
};

// Fonction pour sauvegarder avec rotation (garder seulement les 2 plus récentes)
export const saveWithRotation = (key, value, maxBackups = 2) => {
  try {
    const timestamp = new Date().toISOString();
    const backupKey = `${key}_backup_${timestamp}`;
    
    // Sauvegarder la nouvelle version
    localStorage.setItem(backupKey, JSON.stringify(value));
    console.log(`✅ Sauvegarde créée: ${backupKey}`);
    
    // Récupérer toutes les sauvegardes existantes
    const allKeys = Object.keys(localStorage);
    const backupKeys = allKeys
      .filter(k => k.startsWith(`${key}_backup_`))
      .sort()
      .reverse(); // Plus récent en premier
    
    // Supprimer les anciennes sauvegardes (garder seulement maxBackups)
    if (backupKeys.length > maxBackups) {
      const keysToDelete = backupKeys.slice(maxBackups);
      keysToDelete.forEach(k => {
        localStorage.removeItem(k);
        console.log(`🗑️ Ancienne sauvegarde supprimée: ${k}`);
      });
    }
    
    // Sauvegarder aussi la version actuelle
    saveToLocalStorage(key, value);
    
    return true;
  } catch (error) {
    console.error(`Error in saveWithRotation for key ${key}:`, error);
    return false;
  }
};

// Fonction pour lister les sauvegardes disponibles
export const listBackups = (key) => {
  try {
    const allKeys = Object.keys(localStorage);
    const backupKeys = allKeys
      .filter(k => k.startsWith(`${key}_backup_`))
      .sort()
      .reverse();
    
    return backupKeys.map(k => ({
      key: k,
      timestamp: k.replace(`${key}_backup_`, ''),
      date: new Date(k.replace(`${key}_backup_`, ''))
    }));
  } catch (error) {
    console.error(`Error listing backups for key ${key}:`, error);
    return [];
  }
};

// Fonction pour restaurer une sauvegarde spécifique
export const restoreBackup = (backupKey) => {
  try {
    const data = localStorage.getItem(backupKey);
    if (data) {
      const parsed = JSON.parse(data);
      console.log(`✅ Restauration depuis: ${backupKey}`);
      return parsed;
    }
    return null;
  } catch (error) {
    console.error(`Error restoring backup ${backupKey}:`, error);
    return null;
  }
};