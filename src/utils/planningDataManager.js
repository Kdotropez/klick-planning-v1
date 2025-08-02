import { format, startOfWeek } from 'date-fns';

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
    canWorkIn: employee.canWorkIn || [],
    mainShop: employee.mainShop || null // Boutique principale
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
        // Fusionner les boutiques autorisées et garder la boutique principale
        const existing = employeesMap.get(emp.id);
        const mergedCanWorkIn = [...new Set([...existing.canWorkIn, ...emp.canWorkIn])];
        const mainShop = existing.mainShop || emp.mainShop; // Garder la première boutique principale trouvée
        employeesMap.set(emp.id, { ...existing, canWorkIn: mergedCanWorkIn, mainShop });
      }
    });
  });
  
  return Array.from(employeesMap.values());
};

// Fonction utilitaire pour vérifier si un employé est en congés
export const isEmployeeOnLeave = (employeeId, dateString, planningData) => {
  // Trouver l'employé et ses boutiques assignées
  const employee = getEmployeeById(planningData, employeeId);
  if (!employee || !employee.canWorkIn || employee.canWorkIn.length === 0) {
    console.log(`❌ ${employeeId}: Pas d'employé ou pas de boutiques assignées`);
    return false;
  }

  console.log(`🔍 Vérification congé pour ${employeeId} le ${dateString} dans les boutiques:`, employee.canWorkIn);

  // Vérifier si l'employé a des créneaux dans AUCUNE de ses boutiques assignées
  let hasAnySlots = false;
  
  for (const shopId of employee.canWorkIn) {
    // Charger le planning de cette boutique pour cette semaine
    const weekKey = getWeekKeyFromDate(dateString);
    const weekData = getWeekPlanning(planningData, shopId, weekKey);
    const shopPlanning = weekData.planning;
    
    console.log(`📊 ${employeeId} - Boutique ${shopId} - Semaine ${weekKey}:`, {
      hasWeekData: !!weekData,
      hasPlanning: !!shopPlanning,
      hasEmployeeData: !!(shopPlanning && shopPlanning[employeeId])
    });
    
    if (shopPlanning && shopPlanning[employeeId]) {
      const dayKey = getDayKeyFromDate(dateString);
      const daySlots = shopPlanning[employeeId][dayKey];
      
      console.log(`📅 ${employeeId} - Jour ${dayKey}:`, {
        daySlots,
        isArray: Array.isArray(daySlots),
        hasSlots: !!(daySlots && Array.isArray(daySlots) && daySlots.some(slot => slot))
      });
      
      if (daySlots && Array.isArray(daySlots) && daySlots.some(slot => slot)) {
        // L'employé a des créneaux dans cette boutique
        console.log(`✅ ${employeeId} a des créneaux dans ${shopId} le ${dateString}`);
        hasAnySlots = true;
        break;
      }
    }
  }
  
  // L'employé est en congés s'il n'a aucun créneau dans aucune de ses boutiques
  const isOnLeave = !hasAnySlots;
  console.log(`🏖️ ${employeeId} le ${dateString}: ${isOnLeave ? 'EN CONGÉ' : 'A DES CRÉNEAUX'}`);
  return isOnLeave;
};

// Fonction utilitaire pour obtenir la clé de semaine à partir d'une date
const getWeekKeyFromDate = (dateString) => {
  const date = new Date(dateString);
  const monday = startOfWeek(date, { weekStartsOn: 1 }); // Lundi
  return format(monday, 'yyyy-MM-dd');
};

// Fonction utilitaire pour obtenir la clé de jour à partir d'une date
const getDayKeyFromDate = (dateString) => {
  const date = new Date(dateString);
  return format(date, 'yyyy-MM-dd');
};

// Fonction pour obtenir les employés d'une boutique principale
export const getEmployeesByMainShop = (planningData, shopId) => {
  return getAllEmployees(planningData).filter(emp => emp.mainShop === shopId);
};

// Fonction pour déterminer automatiquement la boutique principale d'un employé
export const determineEmployeeMainShop = (planningData, employeeId) => {
  const employee = getEmployeeById(planningData, employeeId);
  if (!employee || !employee.canWorkIn || employee.canWorkIn.length === 0) {
    return null;
  }

  // Si l'employé n'a qu'une seule boutique, c'est sa boutique principale
  if (employee.canWorkIn.length === 1) {
    return employee.canWorkIn[0];
  }

  // Analyser la présence de l'employé dans chaque boutique
  const shopPresence = {};
  
  employee.canWorkIn.forEach(shopId => {
    shopPresence[shopId] = {
      shopId,
      totalDays: 0,
      totalSlots: 0,
      weeksWithData: 0
    };
  });

  // Parcourir toutes les semaines de toutes les boutiques
  planningData.shops.forEach(shop => {
    if (employee.canWorkIn.includes(shop.id)) {
      Object.keys(shop.weeks || {}).forEach(weekKey => {
        const weekData = shop.weeks[weekKey];
        if (weekData && weekData.planning && weekData.planning[employeeId]) {
          const employeePlanning = weekData.planning[employeeId];
          let weekHasData = false;
          let weekSlots = 0;
          
          // Compter les créneaux pour cette semaine
          Object.keys(employeePlanning).forEach(dayKey => {
            const daySlots = employeePlanning[dayKey];
            if (Array.isArray(daySlots)) {
              const daySlotsCount = daySlots.filter(slot => slot).length;
              if (daySlotsCount > 0) {
                weekHasData = true;
                weekSlots += daySlotsCount;
              }
            }
          });
          
          if (weekHasData) {
            shopPresence[shop.id].weeksWithData += 1;
            shopPresence[shop.id].totalSlots += weekSlots;
            shopPresence[shop.id].totalDays += Object.keys(employeePlanning).length;
          }
        }
      });
    }
  });

  // Déterminer la boutique principale basée sur la présence
  let mainShop = null;
  let maxPresence = 0;

  Object.values(shopPresence).forEach(presence => {
    // Score basé sur le nombre de semaines avec données ET le nombre total de créneaux
    const score = (presence.weeksWithData * 10) + presence.totalSlots;
    
    if (score > maxPresence) {
      maxPresence = score;
      mainShop = presence.shopId;
    }
  });

  return mainShop;
};

// Fonction pour mettre à jour la boutique principale d'un employé
export const updateEmployeeMainShop = (planningData, employeeId, mainShopId) => {
  return {
    ...planningData,
    shops: planningData.shops.map(shop => ({
      ...shop,
      employees: shop.employees.map(emp => 
        emp.id === employeeId 
          ? { ...emp, mainShop: mainShopId }
          : emp
      )
    }))
  };
};

// Fonction pour mettre à jour automatiquement toutes les boutiques principales
export const updateAllMainShops = (planningData) => {
  const allEmployees = getAllEmployees(planningData);
  let updatedPlanningData = { ...planningData };

  allEmployees.forEach(employee => {
    const mainShop = determineEmployeeMainShop(planningData, employee.id);
    if (mainShop && mainShop !== employee.mainShop) {
      updatedPlanningData = updateEmployeeMainShop(updatedPlanningData, employee.id, mainShop);
    }
  });

  return updatedPlanningData;
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