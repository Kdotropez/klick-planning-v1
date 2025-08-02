import { format } from 'date-fns';

// Structure de données v2.0
export const createNewPlanningData = () => ({
  version: "2.0",
  exportDate: new Date().toISOString(),
  shops: []
});

// Gestion des boutiques
export const addShop = (planningData, shop) => {
  const newShop = {
    id: shop.id,
    name: shop.name,
    config: {
      timeSlots: [],
      interval: 30,
      startTime: "08:00",
      endTime: "18:00"
    },
    employees: [],
    weeks: {}
  };
  
  return {
    ...planningData,
    shops: [...planningData.shops, newShop]
  };
};

export const updateShopConfig = (planningData, shopId, config) => {
  return {
    ...planningData,
    shops: planningData.shops.map(shop => 
      shop.id === shopId 
        ? { 
            ...shop, 
            config: { 
              ...shop.config, 
              ...config,
              // Générer automatiquement les timeSlots si interval, startTime et endTime sont présents
              timeSlots: (config.interval && config.startTime && config.endTime) 
                ? generateTimeSlots(config.interval, config.startTime, config.endTime)
                : (config.timeSlots || shop.config.timeSlots || [])
            } 
          }
        : shop
    )
  };
};

// Fonction utilitaire pour générer les créneaux horaires
const generateTimeSlots = (interval, startTime, endTime) => {
  console.log('generateTimeSlots appelée avec:', { interval, startTime, endTime });
  const slots = [];
  const start = new Date(`2000-01-01T${startTime}`);
  const end = new Date(`2000-01-01T${endTime}`);
  
  let current = new Date(start);
  while (current < end) {
    slots.push(current.toTimeString().slice(0, 5));
    current.setMinutes(current.getMinutes() + interval);
  }
  
  console.log('generateTimeSlots généré:', slots);
  return slots;
};

// Gestion des employés
export const addEmployee = (planningData, employee) => {
  const newEmployee = {
    id: `emp_${Date.now()}`,
    name: employee.name,
    canWorkIn: employee.canWorkIn || []
  };
  
  // Ajouter l'employé à toutes les boutiques (l'affectation se fera plus tard)
  const updatedShops = planningData.shops.map(shop => ({
    ...shop,
    employees: [...shop.employees, newEmployee]
  }));
  
  return {
    ...planningData,
    shops: updatedShops
  };
};

export const updateEmployeeShops = (planningData, employeeId, shopId, canWork) => {
  const updatedShops = planningData.shops.map(shop => {
    // Mettre à jour les employés de cette boutique
    const updatedEmployees = shop.employees.map(emp => {
      if (emp.id === employeeId) {
        // Mettre à jour la liste des boutiques autorisées
        let updatedCanWorkIn = [...emp.canWorkIn];
        
        if (canWork && !updatedCanWorkIn.includes(shopId)) {
          updatedCanWorkIn.push(shopId);
        } else if (!canWork && updatedCanWorkIn.includes(shopId)) {
          updatedCanWorkIn = updatedCanWorkIn.filter(id => id !== shopId);
        }
        
        return {
          ...emp,
          canWorkIn: updatedCanWorkIn
        };
      }
      return emp;
    });
    
    return {
      ...shop,
      employees: updatedEmployees
    };
  });
  
  return {
    ...planningData,
    shops: updatedShops
  };
};

// Gestion des semaines
export const saveWeekPlanning = (planningData, shopId, weekKey, planning, selectedEmployees) => {
  return {
    ...planningData,
    shops: planningData.shops.map(shop => 
      shop.id === shopId 
        ? {
            ...shop,
            weeks: {
              ...shop.weeks,
              [weekKey]: {
                planning,
                selectedEmployees
              }
            }
          }
        : shop
    )
  };
};

// Sauvegarder le planning pour la boutique actuelle seulement
export const saveWeekPlanningForEmployee = (planningData, employeeId, weekKey, planning, selectedEmployees, currentShopId) => {
  // Sauvegarder seulement dans la boutique actuelle
  const employeeShops = [currentShopId];
  
  console.log(`Sauvegarde pour employé ${employeeId} dans la boutique actuelle:`, currentShopId);
  console.log(`Données de planning à sauvegarder:`, planning);
  
  console.log(`Sauvegarde pour employé ${employeeId} dans les boutiques:`, employeeShops);
  
  // Sauvegarder pour chaque boutique en fusionnant les données existantes
  let updatedPlanningData = planningData;
  employeeShops.forEach(shopId => {
    // Récupérer les données existantes pour cette boutique
    const existingShop = updatedPlanningData.shops.find(s => s.id === shopId);
    const existingWeekData = existingShop?.weeks?.[weekKey] || { planning: {}, selectedEmployees: [] };
    
    // Fusionner les données de planning
    const mergedPlanning = { ...existingWeekData.planning };
    Object.keys(planning).forEach(empId => {
      if (!mergedPlanning[empId]) {
        mergedPlanning[empId] = {};
      }
      Object.keys(planning[empId]).forEach(day => {
        if (!mergedPlanning[empId][day]) {
          mergedPlanning[empId][day] = [];
        }
        // Fusionner les créneaux horaires
        const existingSlots = mergedPlanning[empId][day];
        const newSlots = planning[empId][day];
        const maxLength = Math.max(existingSlots.length, newSlots.length);
        
        mergedPlanning[empId][day] = new Array(maxLength).fill(false).map((_, index) => {
          // Si les nouvelles données ont des créneaux cochés, les utiliser
          if (newSlots[index]) {
            return true;
          }
          // Sinon, garder les créneaux existants
          return existingSlots[index] || false;
        });
      });
    });
    
    // Fusionner les employés sélectionnés
    const mergedSelectedEmployees = [...new Set([...existingWeekData.selectedEmployees, ...selectedEmployees])];
    
    // Sauvegarder avec les données fusionnées
    updatedPlanningData = saveWeekPlanning(updatedPlanningData, shopId, weekKey, mergedPlanning, mergedSelectedEmployees);
    console.log(`Données sauvegardées pour boutique ${shopId}, semaine ${weekKey}:`, mergedPlanning);
  });
  
  return updatedPlanningData;
};

// Export/Import
export const exportPlanningData = (planningData) => {
  // Diagnostic avant export
  console.log('🔍 Diagnostic avant export:');
  diagnoseDataState(planningData);
  
  // Créer une copie profonde des données pour éviter les modifications
  const exportData = JSON.parse(JSON.stringify(planningData));
  
  // Ajouter la date d'export
  exportData.exportDate = new Date().toISOString();
  
  // Vérifier et nettoyer les données avant export
  if (exportData.shops && Array.isArray(exportData.shops)) {
    exportData.shops = exportData.shops.map(shop => {
      // S'assurer que chaque boutique a une structure weeks valide
      if (!shop.weeks || typeof shop.weeks !== 'object') {
        shop.weeks = {};
      }
      
      // Nettoyer les semaines vides ou invalides
      const cleanedWeeks = {};
      Object.keys(shop.weeks).forEach(weekKey => {
        const weekData = shop.weeks[weekKey];
        if (weekData && typeof weekData === 'object') {
          // Vérifier que la semaine a des données valides
          if (weekData.planning && typeof weekData.planning === 'object' && 
              Object.keys(weekData.planning).length > 0) {
            cleanedWeeks[weekKey] = weekData;
          }
        }
      });
      shop.weeks = cleanedWeeks;
      
      return shop;
    });
  }
  
  console.log('📤 Export des données:', exportData);
  
  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: 'application/json'
  });
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `planning_${format(new Date(), 'yyyy-MM-dd_HHmm')}.json`;
  a.click();
  
  URL.revokeObjectURL(url);
  
  return exportData;
};

// Fonction de sauvegarde forcée qui récupère toutes les données du localStorage
export const forceSaveAllData = (planningData) => {
  let updatedPlanningData = { ...planningData };
  
  // Récupérer toutes les clés du localStorage qui contiennent des données de planning
  const localStorageKeys = Object.keys(localStorage);
  const planningKeys = localStorageKeys.filter(key => key.startsWith('planning_'));
  const employeeKeys = localStorageKeys.filter(key => key.startsWith('selected_employees_'));
  
  console.log('Clés de planning trouvées:', planningKeys);
  console.log('Clés d\'employés trouvées:', employeeKeys);
  
  // Traiter chaque clé de planning
  planningKeys.forEach(planningKey => {
    try {
      // Extraire shop et week de la clé (format: planning_SHOP_WEEK)
      const parts = planningKey.split('_');
      if (parts.length >= 3) {
        const shopId = parts[1];
        const weekKey = parts.slice(2).join('_'); // En cas de date avec underscore
        
        // Récupérer les données de planning
        const planningData = JSON.parse(localStorage.getItem(planningKey) || '{}');
        
        // Récupérer les employés sélectionnés
        const employeeKey = `selected_employees_${shopId}_${weekKey}`;
        const selectedEmployees = JSON.parse(localStorage.getItem(employeeKey) || '[]');
        
        // Sauvegarder dans planningData
        updatedPlanningData = saveWeekPlanning(
          updatedPlanningData, 
          shopId, 
          weekKey, 
          planningData, 
          selectedEmployees
        );
        
        console.log(`Données sauvegardées pour ${shopId} - ${weekKey}:`, planningData);
      }
    } catch (error) {
      console.error(`Erreur lors du traitement de la clé ${planningKey}:`, error);
    }
  });
  
  return updatedPlanningData;
};

// Fonction de diagnostic pour vérifier l'état des données
export const diagnoseDataState = (planningData) => {
  const diagnosis = {
    totalShops: planningData.shops?.length || 0,
    shopsWithWeeks: 0,
    totalWeeks: 0,
    localStorageKeys: [],
    localStorageData: {}
  };
  
  // Analyser les boutiques et leurs semaines
  if (planningData.shops && Array.isArray(planningData.shops)) {
    planningData.shops.forEach(shop => {
      const weekCount = shop.weeks ? Object.keys(shop.weeks).length : 0;
      if (weekCount > 0) {
        diagnosis.shopsWithWeeks++;
        diagnosis.totalWeeks += weekCount;
      }
    });
  }
  
  // Analyser le localStorage
  const localStorageKeys = Object.keys(localStorage);
  const planningKeys = localStorageKeys.filter(key => key.startsWith('planning_'));
  const employeeKeys = localStorageKeys.filter(key => key.startsWith('selected_employees_'));
  
  diagnosis.localStorageKeys = {
    planning: planningKeys,
    employees: employeeKeys,
    total: planningKeys.length + employeeKeys.length
  };
  
  // Analyser les données du localStorage
  planningKeys.forEach(key => {
    try {
      const data = JSON.parse(localStorage.getItem(key) || '{}');
      diagnosis.localStorageData[key] = {
        hasData: Object.keys(data).length > 0,
        employeeCount: Object.keys(data).length,
        totalSlots: Object.values(data).reduce((total, empData) => {
          return total + Object.values(empData).reduce((empTotal, daySlots) => {
            return empTotal + (Array.isArray(daySlots) ? daySlots.length : 0);
          }, 0);
        }, 0)
      };
    } catch (error) {
      diagnosis.localStorageData[key] = { error: error.message };
    }
  });
  
  console.log('🔍 Diagnostic des données:', diagnosis);
  return diagnosis;
};

export const importPlanningData = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        
        // Validation de la structure
        if (!data.version || !data.shops || !Array.isArray(data.shops)) {
          throw new Error('Format de fichier invalide');
        }
        
        // Migration si nécessaire
        const migratedData = migrateDataIfNeeded(data);
        
        // Nettoyer et valider les données
        const cleanedData = cleanAndValidateData(migratedData);
        
        resolve(cleanedData);
      } catch (error) {
        reject(new Error(`Erreur d'import : ${error.message}`));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Erreur de lecture du fichier'));
    };
    
    reader.readAsText(file);
  });
};

// Fonction de nettoyage et validation des données
const cleanAndValidateData = (data) => {
  const cleanedData = { ...data };
  
  // Nettoyer les boutiques
  if (cleanedData.shops && Array.isArray(cleanedData.shops)) {
    cleanedData.shops = cleanedData.shops
      .filter(shop => shop && typeof shop === 'object' && shop.id && shop.name)
      .map(shop => ({
        id: String(shop.id),
        name: String(shop.name),
        canWorkIn: Array.isArray(shop.canWorkIn) ? shop.canWorkIn.map(String) : [],
        employees: Array.isArray(shop.employees) ? shop.employees
          .filter(emp => emp && typeof emp === 'object' && emp.id && emp.name)
          .map(emp => ({
            id: String(emp.id),
            name: String(emp.name),
            canWorkIn: Array.isArray(emp.canWorkIn) ? emp.canWorkIn.map(String) : [],
            // Autres propriétés d'employé si elles existent
            ...(emp.color && { color: String(emp.color) }),
            ...(emp.role && { role: String(emp.role) })
          })) : [],
        weeks: shop.weeks && typeof shop.weeks === 'object' ? shop.weeks : {},
        config: shop.config && typeof shop.config === 'object' ? shop.config : {}
      }));
  }
  
  // Nettoyer les employés globaux si ils existent
  if (cleanedData.employees && Array.isArray(cleanedData.employees)) {
    cleanedData.employees = cleanedData.employees
      .filter(emp => emp && typeof emp === 'object' && emp.id && emp.name)
      .map(emp => ({
        id: String(emp.id),
        name: String(emp.name),
        canWorkIn: Array.isArray(emp.canWorkIn) ? emp.canWorkIn.map(String) : [],
        // Autres propriétés d'employé si elles existent
        ...(emp.color && { color: String(emp.color) }),
        ...(emp.role && { role: String(emp.role) })
      }));
  }
  
  return cleanedData;
};

// Migration des données
const migrateDataIfNeeded = (data) => {
  if (data.version === "1.0" || !data.version) {
    // Migration depuis l'ancien format
    return migrateFromV1(data);
  }
  
  return data;
};

const migrateFromV1 = (oldData) => {
  // Logique de migration depuis l'ancien format
  // À implémenter selon l'ancienne structure
  return {
    version: "2.0",
    exportDate: new Date().toISOString(),
    shops: []
  };
};

// Utilitaires
export const getShopById = (planningData, shopId) => {
  return planningData.shops.find(shop => shop.id === shopId);
};

export const getEmployeeById = (planningData, employeeId) => {
  for (const shop of planningData.shops) {
    const employee = shop.employees.find(emp => emp.id === employeeId);
    if (employee) return employee;
  }
  return null;
};

export const getAllEmployees = (planningData) => {
  const employeesMap = new Map();
  
  planningData.shops.forEach(shop => {
    shop.employees.forEach(emp => {
      if (!employeesMap.has(emp.id)) {
        employeesMap.set(emp.id, emp);
      } else {
        // Fusionner les boutiques autorisées
        const existing = employeesMap.get(emp.id);
        const mergedCanWorkIn = [...new Set([...existing.canWorkIn, ...emp.canWorkIn])];
        employeesMap.set(emp.id, { ...existing, canWorkIn: mergedCanWorkIn });
      }
    });
  });
  
  return Array.from(employeesMap.values());
};

export const getWeekPlanning = (planningData, shopId, weekKey) => {
  try {
    if (!planningData || !shopId || !weekKey) {
      console.warn('getWeekPlanning: Paramètres manquants', { planningData, shopId, weekKey });
      return { planning: {}, selectedEmployees: [] };
    }
    
    const shop = getShopById(planningData, shopId);
    if (!shop) {
      console.warn('getWeekPlanning: Boutique non trouvée', shopId);
      return { planning: {}, selectedEmployees: [] };
    }
    
    const weekData = shop.weeks?.[weekKey] || { planning: {}, selectedEmployees: [] };
    
    // Initialiser les données de planning pour tous les employés de la boutique
    const initializedPlanning = { ...weekData.planning };
    const shopEmployees = shop.employees || [];
    const timeSlots = shop.config?.timeSlots || [];
    
    // Créer les 7 jours de la semaine
    const days = ['0', '1', '2', '3', '4', '5', '6'];
    
    shopEmployees.forEach(employee => {
      if (employee && employee.id) {
        if (!initializedPlanning[employee.id]) {
          initializedPlanning[employee.id] = {};
        }
        
        days.forEach(day => {
          if (!initializedPlanning[employee.id][day]) {
            // Initialiser avec un tableau de la bonne longueur selon les créneaux horaires
            initializedPlanning[employee.id][day] = new Array(timeSlots.length).fill(false);
          } else if (initializedPlanning[employee.id][day].length !== timeSlots.length) {
            // Si la longueur ne correspond pas, ajuster
            const currentSlots = initializedPlanning[employee.id][day];
            if (currentSlots.length < timeSlots.length) {
              // Ajouter des créneaux manquants
              initializedPlanning[employee.id][day] = [
                ...currentSlots,
                ...new Array(timeSlots.length - currentSlots.length).fill(false)
              ];
            } else {
              // Tronquer si trop long
              initializedPlanning[employee.id][day] = currentSlots.slice(0, timeSlots.length);
            }
          }
        });
      }
    });
    
    return {
      planning: initializedPlanning,
      selectedEmployees: weekData.selectedEmployees || []
    };
  } catch (error) {
    console.error('Erreur dans getWeekPlanning:', error);
    return { planning: {}, selectedEmployees: [] };
  }
}; 