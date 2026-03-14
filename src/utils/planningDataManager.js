import { format, startOfWeek, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
// Remplace xlsx standard par xlsx-js-style pour le formatage des cellules
import * as XLSX from 'xlsx-js-style';
import * as XLSXCore from 'xlsx';

// Fonctions utilitaires pour le calcul des heures
const getWorkTimesFromSlots = (timeSlots, intervalMinutes, slots) => {
  if (!Array.isArray(slots) || !Array.isArray(timeSlots) || timeSlots.length === 0) {
    return { entry: null, pause: null, returnTime: null, exit: null, hours: 0 };
  }
  const selected = [];
  for (let i = 0; i < slots.length && i < timeSlots.length; i++) {
    if (slots[i]) selected.push(i);
  }
  if (selected.length === 0) {
    return { entry: null, pause: null, returnTime: null, exit: null, hours: 0 };
  }
  const entry = timeSlots[selected[0]];
  const lastIndex = selected[selected.length - 1];
  const lastStart = timeSlots[lastIndex];
  const exitDate = new Date(`2000-01-01T${lastStart}:00`);
  exitDate.setMinutes(exitDate.getMinutes() + (Number(intervalMinutes) || 30));
  const exit = format(exitDate, 'HH:mm');

  // Pause / Retour: détecter un gap (>1 index)
  let pause = null;
  let returnTime = null;
  for (let i = 0; i < selected.length - 1; i++) {
    const cur = selected[i];
    const nxt = selected[i + 1];
    if (nxt - cur > 1) {
      // Fin du créneau courant: end time of cur slot
      const curStart = timeSlots[cur];
      const curEndDate = new Date(`2000-01-01T${curStart}:00`);
      curEndDate.setMinutes(curEndDate.getMinutes() + (Number(intervalMinutes) || 30));
      pause = format(curEndDate, 'HH:mm');
      returnTime = timeSlots[nxt];
      break;
    }
  }

  const hours = (selected.length * (Number(intervalMinutes) || 30)) / 60;
  return { entry, pause, returnTime, exit, hours: Number(hours.toFixed(1)) };
};

// Fonction pour calculer les heures de nuit (T1 et T2) à partir des slots
const calculateDayNightFromSlots = (timeSlots, intervalMinutes, slots) => {
  if (!Array.isArray(slots) || !Array.isArray(timeSlots) || timeSlots.length === 0) {
    return { t1: 0, t2: 0 };
  }
  const makeDate = (timeStr) => new Date(`2000-01-01T${timeStr}:00`);
  const window21 = makeDate('21:00');
  const window22 = makeDate('22:00');
  const windowEnd = makeDate('23:59');
  let minutesT1 = 0, minutesT2 = 0;
  for (let s = 0; s < Math.min(slots.length, timeSlots.length); s++) {
    if (!slots[s]) continue;
    const startStr = timeSlots[s];
    if (!startStr) continue;
    const slotStart = makeDate(startStr);
    const slotEnd = new Date(slotStart.getTime() + (Number(intervalMinutes) || 30) * 60000);
    const overlapT1 = Math.max(0, Math.min(slotEnd.getTime(), window22.getTime()) - Math.max(slotStart.getTime(), window21.getTime()));
    const overlapT2 = Math.max(0, Math.min(slotEnd.getTime(), windowEnd.getTime()) - Math.max(slotStart.getTime(), window22.getTime()));
    minutesT1 += Math.floor(overlapT1 / 60000);
    minutesT2 += Math.floor(overlapT2 / 60000);
  }
  return { t1: Number((minutesT1 / 60).toFixed(1)), t2: Number((minutesT2 / 60).toFixed(1)) };
};

// Fonctions de gestion des employés masqués
export const hideEmployee = (planningData, employeeId, hideFromDate, shopId = null) => {
  console.log(`🔒 Masquage de l'employé ${employeeId} à partir du ${hideFromDate}${shopId ? ` (boutique: ${shopId})` : ''}`);
  
  const updatedShops = planningData.shops.map(shop => ({
    ...shop,
    employees: shopId && shop.id !== shopId
      ? shop.employees
      : shop.employees.map(emp =>
          emp.id === employeeId
            ? { ...emp, hiddenFrom: hideFromDate }
            : emp
        )
  }));
  
  return {
    ...planningData,
    shops: updatedShops
  };
};

export const showEmployee = (planningData, employeeId, shopId = null) => {
  console.log(`🔓 Affichage de l'employé ${employeeId}${shopId ? ` (boutique: ${shopId})` : ''}`);
  
  const updatedShops = planningData.shops.map(shop => ({
    ...shop,
    employees: shopId && shop.id !== shopId
      ? shop.employees
      : shop.employees.map(emp =>
          emp.id === employeeId
            ? { ...emp, hiddenFrom: null }
            : emp
        )
  }));
  
  return {
    ...planningData,
    shops: updatedShops
  };
};

export const isEmployeeHidden = (employee, weekDate) => {
  // Nouveau comportement demandé:
  // dès qu'un employé est masqué, il reste masqué jusqu'à réactivation explicite.
  // "hiddenFrom" sert de marqueur persistant.
  return !!employee?.hiddenFrom;
};

export const getVisibleEmployees = (planningData, currentDate = new Date()) => {
  const visibleEmployees = [];
  
  planningData.shops.forEach(shop => {
    shop.employees.forEach(emp => {
      if (!isEmployeeHidden(emp, currentDate)) {
        // Vérifier si l'employé n'est pas déjà dans la liste
        if (!visibleEmployees.find(e => e.id === emp.id)) {
          visibleEmployees.push(emp);
        }
      }
    });
  });
  
  return visibleEmployees;
};

export const getHiddenEmployees = (planningData, currentDate = new Date()) => {
  const hiddenEmployees = [];
  
  planningData.shops.forEach(shop => {
    shop.employees.forEach(emp => {
      if (emp.hiddenFrom && isEmployeeHidden(emp, currentDate)) {
        // Vérifier si l'employé n'est pas déjà dans la liste
        if (!hiddenEmployees.find(e => e.id === emp.id)) {
          hiddenEmployees.push(emp);
        }
      }
    });
  });
  
  return hiddenEmployees;
};

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
  console.log('🔧 updateEmployeeShops appelé:', { employeeId, shopId, canWork });
  
  const updatedShops = planningData.shops.map(shop => {
    // Mettre à jour les employés de cette boutique
    const updatedEmployees = shop.employees.map(emp => {
      if (emp.id === employeeId) {
        // Mettre à jour la liste des boutiques autorisées
        let updatedCanWorkIn = [...emp.canWorkIn];
        
        if (canWork && !updatedCanWorkIn.includes(shopId)) {
          updatedCanWorkIn.push(shopId);
          console.log(`✅ Ajouté ${shopId} à canWorkIn de ${emp.name} dans ${shop.name}`);
        } else if (!canWork && updatedCanWorkIn.includes(shopId)) {
          updatedCanWorkIn = updatedCanWorkIn.filter(id => id !== shopId);
          console.log(`❌ Retiré ${shopId} de canWorkIn de ${emp.name} dans ${shop.name}`);
        }
        
        // S'assurer que canWorkIn ne contient que des boutiques valides
        const validShopIds = planningData.shops.map(s => s.id);
        updatedCanWorkIn = updatedCanWorkIn.filter(id => validShopIds.includes(id));
        
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
  
  const result = {
    ...planningData,
    shops: updatedShops
  };
  
  console.log('🔧 updateEmployeeShops - Résultat:', result.shops.map(shop => ({
    name: shop.name,
    employees: shop.employees.filter(emp => emp.id === employeeId).map(emp => ({
      name: emp.name,
      canWorkIn: emp.canWorkIn
    }))
  })));
  
  return result;
};

// Gestion des semaines
export const saveWeekPlanning = (planningData, shopId, weekKey, planning, selectedEmployees) => {
  console.log('🔧 saveWeekPlanning appelé avec:', { shopId, weekKey, planning, selectedEmployees });
  
  // ⚡ NETTOYAGE : Ne sauvegarder que les jours qui ont VRAIMENT des données
  const cleanedPlanning = {};
  Object.keys(planning || {}).forEach(empId => {
    const employeeData = planning[empId];
    if (employeeData && typeof employeeData === 'object') {
      Object.keys(employeeData).forEach(dayKey => {
        const dayData = employeeData[dayKey];
        
        // Garder seulement si :
        // 1. C'est un statut (string comme "Congé ☀️" ou "Maladie 🤒")
        // 2. C'est un tableau avec au moins un `true` (horaire coché)
        const shouldKeep = 
          (typeof dayData === 'string' && dayData.length > 0) || 
          (Array.isArray(dayData) && dayData.some(slot => slot === true));
        
        if (shouldKeep) {
          if (!cleanedPlanning[empId]) {
            cleanedPlanning[empId] = {};
          }
          cleanedPlanning[empId][dayKey] = dayData;
        }
      });
    }
  });
  
  console.log('🧹 Planning nettoyé (jours vides supprimés):', cleanedPlanning);
  
  const result = {
    ...planningData,
    shops: planningData.shops.map(shop => 
      shop.id === shopId 
        ? {
            ...shop,
            weeks: {
              ...shop.weeks,
              [weekKey]: (() => {
                const existingWeek = shop.weeks?.[weekKey] || { planning: {}, selectedEmployees: [] };
                const existingSelected = Array.isArray(existingWeek.selectedEmployees) ? existingWeek.selectedEmployees : [];
                const incomingSelected = Array.isArray(selectedEmployees) ? selectedEmployees : [];
                const shopEmployeeIds = Array.isArray(shop.employees) ? shop.employees.map(e => e.id) : [];
                // Fusionner les listes sans dupliquer
                let mergedSelected = Array.from(new Set([...existingSelected, ...incomingSelected]));
                // Si rien de sélectionné, par défaut: tous les employés de la boutique
                if (mergedSelected.length === 0) mergedSelected = shopEmployeeIds;
                return {
                  planning: cleanedPlanning,
                  selectedEmployees: mergedSelected
                };
              })()
            }
          }
        : shop
    )
  };
  
  console.log('🔧 saveWeekPlanning - Résultat:', result.shops.find(s => s.id === shopId)?.weeks[weekKey]);
  
  return result;
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
    
    // ⚡ REMPLACER complètement les données au lieu de fusionner (fix clics fantômes)
    const mergedPlanning = { ...existingWeekData.planning };
    Object.keys(planning).forEach(empId => {
      if (!mergedPlanning[empId]) {
        mergedPlanning[empId] = {};
      }
      Object.keys(planning[empId]).forEach(day => {
        // ⚡ REMPLACER directement au lieu de fusionner
        mergedPlanning[empId][day] = planning[empId][day];
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

// Export Excel pour analyse détaillée par boutique et mois
export const exportPlanningToExcel = (planningData, opts = {}) => {
  try {
    // Vérifier si XLSX est disponible
    if (typeof XLSX === 'undefined') {
      console.error('XLSX non disponible, annulation de l\'export Excel');
      return false;
    }

    const excelData = [];
    
    // En-têtes principaux
    excelData.push(['EXPORT PLANNING DÉTAILLÉ PAR BOUTIQUE ET MOIS']);
    excelData.push(['Date d\'export:', format(new Date(), 'dd/MM/yyyy HH:mm')]);
    excelData.push([]);
    
    // Semaines du MOIS CHOISI (par défaut: courant) (lundi -> dimanche), bornes de mois pour filtrer hors mois
    const getCurrentMonthWeeks = () => {
      const base = opts?.monthDate ? new Date(opts.monthDate) : new Date();
      const start = new Date(base.getFullYear(), base.getMonth(), 1);
      const end = new Date(base.getFullYear(), base.getMonth() + 1, 0);
      
      const weeks = [];
      const firstMonday = new Date(start);
      firstMonday.setDate(firstMonday.getDate() - ((firstMonday.getDay() + 6) % 7)); // reculer jusqu'au lundi
      
      let current = new Date(firstMonday);
      while (current <= end) {
        weeks.push(new Date(current));
        current.setDate(current.getDate() + 7);
      }
      return { weeks, monthStart: start, monthEnd: end };
    };

    const getWeekRange = (weekStart) => {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      return `Du ${format(weekStart, 'd MMMM', { locale: fr })} au ${format(weekEnd, 'd MMMM yyyy', { locale: fr })}`;
    };

    // Calcule les heures hebdo pour UN employé dans UNE boutique en s'appuyant sur les créneaux booléens
    const calculateEmployeeWeeklyHours = (shop, weekStart, employeeId, monthStart, monthEnd) => {
      try {
        const weekKey = format(weekStart, 'yyyy-MM-dd');
        const weekData = shop.weeks?.[weekKey]?.planning?.[employeeId] || {};
        const intervalMinutes = Number(shop?.config?.interval) || 30;
        let trueSlotsCount = 0;
      
      for (let i = 0; i < 7; i++) {
          const day = new Date(weekStart);
        day.setDate(day.getDate() + i);
        const dayKey = format(day, 'yyyy-MM-dd');
          // Filtrer: ignorer les jours hors du mois courant
          if (day < monthStart || day > monthEnd) continue;
          const daySlots = weekData?.[dayKey];
          
          // Traiter les statuts (maladie, congé, etc.)
          if (typeof daySlots === 'string') {
            continue; // Pas d'heures pour les statuts
          }
          
          if (Array.isArray(daySlots)) {
            trueSlotsCount += daySlots.filter(Boolean).length;
          }
        }

        const hours = (trueSlotsCount * intervalMinutes) / 60;
        return Number.isFinite(hours) ? Number(hours.toFixed(1)) : 0;
      } catch (e) {
        return 0;
      }
    };

    const calculateEmployeeMonthlyHours = (shop, employeeId, monthWeeks, monthStart, monthEnd) => {
      return monthWeeks.reduce((sum, w) => sum + calculateEmployeeWeeklyHours(shop, w, employeeId, monthStart, monthEnd), 0);
    };

    // Heures de nuit: tranche 1 (21:00-22:00) et tranche 2 (>22:00)
    const calculateEmployeeWeeklyNightHours = (shop, weekStart, employeeId, monthStart, monthEnd) => {
      const intervalMinutes = Number(shop?.config?.interval) || 30;
      const timeSlots = Array.isArray(shop?.config?.timeSlots) ? shop.config.timeSlots : [];
      if (timeSlots.length === 0) return { t1: 0, t2: 0 };

      let minutesT1 = 0; // 21:00-22:00
      let minutesT2 = 0; // > 22:00

      const weekKey = format(weekStart, 'yyyy-MM-dd');
      const empWeek = shop.weeks?.[weekKey]?.planning?.[employeeId] || {};

      const makeDate = (timeStr) => new Date(`2000-01-01T${timeStr}:00`);
      const window21 = makeDate('21:00');
      const window22 = makeDate('22:00');
      const windowEnd = makeDate('23:59');

      for (let i = 0; i < 7; i++) {
        const day = new Date(weekStart);
        day.setDate(day.getDate() + i);
        if (day < monthStart || day > monthEnd) continue;
        const dayKey = format(day, 'yyyy-MM-dd');
        const slots = empWeek?.[dayKey];
        if (typeof slots === 'string' || !Array.isArray(slots)) continue;

        for (let s = 0; s < Math.min(slots.length, timeSlots.length); s++) {
          if (!slots[s]) continue;
          const startStr = timeSlots[s];
          if (!startStr) continue;
          const slotStart = makeDate(startStr);
          const slotEnd = new Date(slotStart.getTime() + intervalMinutes * 60000);

          // Overlap with [21:00,22:00)
          const overlapT1 = Math.max(0, Math.min(slotEnd.getTime(), window22.getTime()) - Math.max(slotStart.getTime(), window21.getTime()));
          // Overlap with [22:00,23:59]
          const overlapT2 = Math.max(0, Math.min(slotEnd.getTime(), windowEnd.getTime()) - Math.max(slotStart.getTime(), window22.getTime()));

          minutesT1 += Math.floor(overlapT1 / 60000);
          minutesT2 += Math.floor(overlapT2 / 60000);
        }
      }

      return { t1: Number((minutesT1 / 60).toFixed(1)), t2: Number((minutesT2 / 60).toFixed(1)) };
    };

// ... existing code ...

    // Traitement BOUTIQUE PAR BOUTIQUE sur le MOIS COURANT
    const { weeks: monthWeeks, monthStart, monthEnd } = getCurrentMonthWeeks();
    if (planningData.shops && Array.isArray(planningData.shops)) {
      planningData.shops.forEach(shop => {
        excelData.push([]);
        excelData.push([`=== BOUTIQUE: ${shop.name?.toUpperCase() || shop.id} ===`]);
        excelData.push([]);
        
        // N'inclure que les employés affectés à cette boutique
        const employeesInShop = Array.isArray(shop.employees)
          ? shop.employees.filter(emp => Array.isArray(emp?.canWorkIn) && emp.canWorkIn.includes(shop.id))
          : [];
        const employeeNames = employeesInShop.map(e => e.name || e.id);

        // En-têtes: Semaine | Employé1 | Employé2 | ... | Total semaine | Total T1 | Total T2
        excelData.push(['Semaine', ...employeeNames, 'Total semaine', 'Total T1', 'Total T2']);

        // Lignes par semaine
        monthWeeks.forEach(weekStart => {
          const row = [getWeekRange(weekStart)];
          let weekTotal = 0;
          let weekT1 = 0;
          let weekT2 = 0;
          employeesInShop.forEach(emp => {
            const hours = calculateEmployeeWeeklyHours(shop, weekStart, emp.id, monthStart, monthEnd);
            const nh = calculateEmployeeWeeklyNightHours(shop, weekStart, emp.id, monthStart, monthEnd);
            weekTotal += hours;
            weekT1 += nh.t1;
            weekT2 += nh.t2;
            row.push(hours > 0 ? `${hours.toFixed(1)} H` : '');
          });
          row.push(weekTotal > 0 ? `${weekTotal.toFixed(1)} H` : '', weekT1 > 0 ? `${weekT1.toFixed(1)} H` : '', weekT2 > 0 ? `${weekT2.toFixed(1)} H` : '');
          excelData.push(row);
        });

        // Totaux mensuels par employé + total général + T1/T2 globaux du mois
        const totalsRow = ['Total mois'];
        let grandTotal = 0;
        let grandT1 = 0;
        let grandT2 = 0;
        employeesInShop.forEach(emp => {
          const total = calculateEmployeeMonthlyHours(shop, emp.id, monthWeeks, monthStart, monthEnd);
          grandTotal += total;
          totalsRow.push(total > 0 ? `${total.toFixed(1)} H` : '');
        });
        // Cumuls T1/T2 pour le mois (par boutique)
        monthWeeks.forEach(weekStart => {
          employeesInShop.forEach(emp => {
            const nh = calculateEmployeeWeeklyNightHours(shop, weekStart, emp.id, monthStart, monthEnd);
            grandT1 += nh.t1;
            grandT2 += nh.t2;
          });
        });
        totalsRow.push(
          grandTotal > 0 ? `${grandTotal.toFixed(1)} H` : '',
          grandT1 > 0 ? `${grandT1.toFixed(1)} H` : '',
          grandT2 > 0 ? `${grandT2.toFixed(1)} H` : ''
        );
        excelData.push(totalsRow);

        excelData.push([]);
      });
    }
    
    // Construire la feuille "Résumé global" (totaux par boutique et par semaine + total mois)
    const buildGlobalSummary = () => {
      const shops = Array.isArray(planningData.shops) ? planningData.shops : [];
      const shopNames = shops.map(s => s.name || s.id);
      const header = ['Semaine', ...shopNames, 'Total semaine', 'Total T1', 'Total T2'];
      const rows = [header];

      // Totaux mensuels par boutique
      const monthlyTotalsPerShop = new Array(shopNames.length).fill(0);

      monthWeeks.forEach(weekStart => {
        const row = [getWeekRange(weekStart)];
        let weekTotal = 0;
        let weekT1 = 0;
        let weekT2 = 0;
        shops.forEach((shop, idx) => {
          const employeesInShop = Array.isArray(shop.employees) ? shop.employees : [];
          const shopWeekTotal = employeesInShop.reduce((sum, emp) => sum + calculateEmployeeWeeklyHours(shop, weekStart, emp.id, monthStart, monthEnd), 0);
          const shopWeekNight = employeesInShop.reduce((acc, emp) => {
            const nh = calculateEmployeeWeeklyNightHours(shop, weekStart, emp.id, monthStart, monthEnd);
            acc.t1 += nh.t1; acc.t2 += nh.t2; return acc;
          }, { t1: 0, t2: 0 });
          monthlyTotalsPerShop[idx] += shopWeekTotal;
          weekTotal += shopWeekTotal;
          row.push(shopWeekTotal > 0 ? `${shopWeekTotal.toFixed(1)} H` : '');
          weekT1 += shopWeekNight.t1;
          weekT2 += shopWeekNight.t2;
        });
        row.push(weekTotal > 0 ? `${weekTotal.toFixed(1)} H` : '', weekT1 > 0 ? `${weekT1.toFixed(1)} H` : '', weekT2 > 0 ? `${weekT2.toFixed(1)} H` : '');
        rows.push(row);
      });

      // Ligne total mois
      const grandTotal = monthlyTotalsPerShop.reduce((a, b) => a + b, 0);
      // T1/T2 total mois (tous shops)
      let totalMonthT1 = 0, totalMonthT2 = 0;
      monthWeeks.forEach(weekStart => {
        shops.forEach(shop => {
          (shop.employees || []).forEach(emp => {
            const nh = calculateEmployeeWeeklyNightHours(shop, weekStart, emp.id, monthStart, monthEnd);
            totalMonthT1 += nh.t1; totalMonthT2 += nh.t2;
          });
        });
      });
      rows.push(['Total mois', ...monthlyTotalsPerShop.map(v => (v > 0 ? `${v.toFixed(1)} H` : '')), grandTotal > 0 ? `${grandTotal.toFixed(1)} H` : '', totalMonthT1 > 0 ? `${totalMonthT1.toFixed(1)} H` : '', totalMonthT2 > 0 ? `${totalMonthT2.toFixed(1)} H` : '']);

      return rows;
    };

    const globalSummaryData = buildGlobalSummary();

    // Feuilles par EMPLOYÉ avec détail mensuel (comme la modale détaillée)
    const getCurrentMonthDays = () => {
      const base = opts?.monthDate ? new Date(opts.monthDate) : new Date();
      const start = new Date(base.getFullYear(), base.getMonth(), 1);
      const end = new Date(base.getFullYear(), base.getMonth() + 1, 0);
      const days = [];
      let current = new Date(start);
      while (current <= end) {
        days.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
      return days;
    };

    const getMonday = (date) => {
      const d = new Date(date);
      const day = d.getDay();
      const diff = (day === 0 ? -6 : 1 - day);
      d.setDate(d.getDate() + diff);
      return d;
    };

    const getWeekTitle = (date) => {
      const monday = getMonday(date);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return `Semaine du ${format(monday, 'd MMMM', { locale: fr })} au ${format(sunday, 'd MMMM yyyy', { locale: fr })}`;
    };

// ... existing code ...

    const findDayDataForEmployee = (employeeId, date) => {
      // Retourne { shopName, shopId, slots, interval, timeSlots, status }
      const dayKey = format(date, 'yyyy-MM-dd');
      const monday = getMonday(date);
      const weekKey = format(monday, 'yyyy-MM-dd');
      if (!Array.isArray(planningData.shops)) return null;
      
      // Chercher d'abord les statuts (maladie, congé, etc.)
      for (const shop of planningData.shops) {
        const week = shop.weeks?.[weekKey];
        const empPlanning = week?.planning?.[employeeId];
        const slots = empPlanning?.[dayKey];
        
        if (typeof slots === 'string') {
          // C'est un statut (maladie, congé, etc.)
          return {
            shopName: shop.name || shop.id,
            shopId: shop.id,
            slots: null,
            interval: shop?.config?.interval || 30,
            timeSlots: Array.isArray(shop?.config?.timeSlots) ? shop.config.timeSlots : [],
            status: slots
          };
        }
      }
      
      // Chercher ensuite les créneaux sélectionnés
      for (const shop of planningData.shops) {
        const week = shop.weeks?.[weekKey];
        const empPlanning = week?.planning?.[employeeId];
        const slots = empPlanning?.[dayKey];
        if (Array.isArray(slots) && slots.some(Boolean)) {
          return {
            shopName: shop.name || shop.id,
            shopId: shop.id,
            slots,
            interval: shop?.config?.interval || 30,
            timeSlots: Array.isArray(shop?.config?.timeSlots) ? shop.config.timeSlots : [],
            status: null
          };
        }
      }
      return null;
    };

    const buildEmployeeSheets = () => {
      const sheets = [];
      // Dédupliquer les employés à partir de toutes les boutiques
      const allEmployeesMap = new Map();
      (planningData.shops || []).forEach(shop => {
        (shop.employees || []).forEach(emp => {
          if (emp && emp.id && !allEmployeesMap.has(emp.id)) {
            allEmployeesMap.set(emp.id, emp);
          }
        });
      });

      const allEmployees = Array.from(allEmployeesMap.values());
      const monthDays = getCurrentMonthDays();

      allEmployees.forEach(emp => {
        const empName = emp.name || emp.id;
        const data = [];
        const shopTotals = new Map(); // shopId -> hours
        const shopNightTotals = new Map(); // shopId -> {t1,t2}

        // Grouper par semaines (basées sur les lundis)
        let weekStart = getMonday(monthDays[0]);
        let idx = 0;
        while (weekStart <= monthDays[monthDays.length - 1]) {
          const weekTitle = getWeekTitle(weekStart);
          data.push({ 'Jour': weekTitle, 'BOUTIQUE': '', 'ENTRÉE': '', 'PAUSE': '', 'RETOUR': '', 'SORTIE': '', 'Heures': '', 'T1': '', 'T2': '' });

          let weekHoursTotal = 0;
          let weekT1Total = 0;
          let weekT2Total = 0;
          const weekShopTotals = new Map(); // shopId -> hours for this week
          const weekShopNightTotals = new Map(); // shopId -> {t1,t2}
          for (let d = 0; d < 7; d++) {
            const day = new Date(weekStart);
            day.setDate(weekStart.getDate() + d);
            // Ignorer les jours hors mois courant
            if (day.getMonth() !== monthDays[0].getMonth()) continue;

            const dd = findDayDataForEmployee(emp.id, day);
            const dayLabel = `${format(day, 'EEEE', { locale: fr })} ${format(day, 'dd/MM', { locale: fr })}`;
            
            if (dd) {
              if (dd.status) {
                // C'est un statut (maladie, congé, etc.)
                const isSick = dd.status.toLowerCase().includes('maladie');
                data.push({
                  'Jour': dayLabel,
                  'BOUTIQUE': dd.shopName,
                  'ENTRÉE': isSick ? 'MALADIE' : dd.status,
                  'PAUSE': '-',
                  'RETOUR': '-',
                  'SORTIE': '-',
                  'Heures': '0.0 h',
                  'T1': '0.0 h',
                  'T2': '0.0 h'
                });
              } else if (Array.isArray(dd.timeSlots) && dd.timeSlots.length > 0) {
                // C'est du travail avec des créneaux sélectionnés
                const wt = getWorkTimesFromSlots(dd.timeSlots, dd.interval, dd.slots);
                const dnh = calculateDayNightFromSlots(dd.timeSlots, dd.interval, dd.slots);
                const prev = shopTotals.get(dd.shopId) || 0;
                shopTotals.set(dd.shopId, prev + wt.hours);
                const prevNight = shopNightTotals.get(dd.shopId) || { t1: 0, t2: 0 };
                shopNightTotals.set(dd.shopId, { t1: prevNight.t1 + dnh.t1, t2: prevNight.t2 + dnh.t2 });
                weekShopTotals.set(dd.shopId, (weekShopTotals.get(dd.shopId) || 0) + wt.hours);
                const wsnPrev = weekShopNightTotals.get(dd.shopId) || { t1: 0, t2: 0 };
                weekShopNightTotals.set(dd.shopId, { t1: wsnPrev.t1 + dnh.t1, t2: wsnPrev.t2 + dnh.t2 });
                weekHoursTotal += wt.hours;
                weekT1Total += dnh.t1; weekT2Total += dnh.t2;
                data.push({
                  'Jour': dayLabel,
                  'BOUTIQUE': dd.shopName,
                  'ENTRÉE': wt.entry ? `${wt.entry} H` : '-',
                  'PAUSE': wt.pause ? `${wt.pause} H` : '-',
                  'RETOUR': wt.returnTime ? `${wt.returnTime} H` : '-',
                  'SORTIE': wt.exit ? `${wt.exit} H` : '-',
                  'Heures': `${wt.hours.toFixed(1)} h`,
                  'T1': `${dnh.t1.toFixed(1)} h`,
                  'T2': `${dnh.t2.toFixed(1)} h`
                });
              }
            } else {
              // Aucune donnée pour ce jour (congé par défaut)
              data.push({
                'Jour': dayLabel,
                'BOUTIQUE': '-',
                'ENTRÉE': 'Congé ☀️',
                'PAUSE': '-',
                'RETOUR': '-',
                'SORTIE': '-',
                'Heures': '0.0 h',
                'T1': '0.0 h',
                'T2': '0.0 h'
              });
            }
          }

          // Sous-totaux de la semaine par boutique
          if (weekShopTotals.size > 0) {
            weekShopTotals.forEach((hours, shopId) => {
              const shopName = (planningData.shops || []).find(s => s.id === shopId)?.name || shopId;
              const nh = weekShopNightTotals.get(shopId) || { t1: 0, t2: 0 };
              data.push({ 'Jour': 'Total semaine', 'BOUTIQUE': shopName, 'ENTRÉE': '', 'PAUSE': '', 'RETOUR': '', 'SORTIE': '', 'Heures': `${hours.toFixed(1)} H`, 'T1': `${nh.t1.toFixed(1)} H`, 'T2': `${nh.t2.toFixed(1)} H` });
            });
          }

          // Sous-total de la semaine (global)
          data.push({ 'Jour': 'Total semaine', 'BOUTIQUE': '', 'ENTRÉE': '', 'PAUSE': '', 'RETOUR': '', 'SORTIE': '', 'Heures': `${weekHoursTotal.toFixed(1)} H`, 'T1': `${weekT1Total.toFixed(1)} H`, 'T2': `${weekT2Total.toFixed(1)} H` });

          // Semaine suivante
          const next = new Date(weekStart);
          next.setDate(weekStart.getDate() + 7);
          weekStart = next;
          idx += 1;
        }

        // Totaux par boutique
        if (shopTotals.size > 0) {
          shopTotals.forEach((hours, shopId) => {
            const shopName = (planningData.shops || []).find(s => s.id === shopId)?.name || shopId;
            const nh = shopNightTotals.get(shopId) || { t1: 0, t2: 0 };
            data.push({ 'Jour': `TOTAL ${shopName}`, 'BOUTIQUE': '', 'ENTRÉE': '', 'PAUSE': '', 'RETOUR': '', 'SORTIE': '', 'Heures': `${hours.toFixed(1)} H`, 'T1': `${nh.t1.toFixed(1)} H`, 'T2': `${nh.t2.toFixed(1)} H` });
          });
          const grand = Array.from(shopTotals.values()).reduce((a, b) => a + b, 0);
          const grandNight = Array.from(shopNightTotals.values()).reduce((acc, v) => ({ t1: acc.t1 + v.t1, t2: acc.t2 + v.t2 }), { t1: 0, t2: 0 });
          data.push({ 'Jour': 'Total mois', 'BOUTIQUE': '', 'ENTRÉE': '', 'PAUSE': '', 'RETOUR': '', 'SORTIE': '', 'Heures': `${grand.toFixed(1)} H`, 'T1': `${grandNight.t1.toFixed(1)} H`, 'T2': `${grandNight.t2.toFixed(1)} H` });
        }

        const ws = XLSX.utils.json_to_sheet(data);
        // Limiter le nom de feuille à 31 caractères
        let sheetName = `Employé - ${empName}`;
        if (sheetName.length > 31) sheetName = sheetName.slice(0, 31);
        sheets.push({ name: sheetName, ws });
      });

      return sheets;
    };

    const employeeSheets = buildEmployeeSheets();

    // Construire la feuille "Rapport Hebdomadaire Détaillé" (tous employés par tranche horaire)
    const buildWeeklyDetailedSheet = () => {
      console.log('🔍 Construction de la feuille Rapport Hebdomadaire...');
      const rows = [];
      if (!planningData.shops || !Array.isArray(planningData.shops)) {
        console.warn('❌ Aucune boutique trouvée pour le rapport hebdomadaire');
        return rows;
      }

      // Récupérer tous les employés uniques
      const allEmployeesMap = new Map();
      (planningData.shops || []).forEach(shop => {
        (shop.employees || []).forEach(emp => {
          if (emp && emp.id && !allEmployeesMap.has(emp.id)) {
            allEmployeesMap.set(emp.id, emp);
          }
        });
      });
      const allEmployees = Array.from(allEmployeesMap.values());
      console.log(`🔍 ${allEmployees.length} employés trouvés pour le rapport hebdomadaire`);

      // Pour chaque semaine du mois
      monthWeeks.forEach(weekStart => {
        rows.push([]);
        rows.push([`=== SEMAINE: ${getWeekRange(weekStart)} ===`]);
        rows.push([]);

        // En-têtes: Employé | Lundi | Mardi | Mercredi | Jeudi | Vendredi | Samedi | Dimanche | Total semaine
        const headers = ['Employé'];
        for (let i = 0; i < 7; i++) {
          const day = new Date(weekStart);
          day.setDate(weekStart.getDate() + i);
          const dayName = format(day, 'EEEE', { locale: fr });
          const dayDate = format(day, 'dd/MM', { locale: fr });
          headers.push(`${dayName} ${dayDate}`, `T1 ${dayDate}`, `T2 ${dayDate}`);
        }
        headers.push('Total semaine', 'Total T1', 'Total T2');
        rows.push(headers);

        // Pour chaque employé
        allEmployees.forEach(emp => {
          const row = [emp.name || emp.id];
          let weekTotal = 0;
          let weekT1 = 0;
          let weekT2 = 0;

          // Pour chaque jour de la semaine
          for (let i = 0; i < 7; i++) {
            const day = new Date(weekStart);
            day.setDate(weekStart.getDate() + i);
            const dayKey = format(day, 'yyyy-MM-dd');
            
            // Chercher les données de l'employé pour ce jour
            let dayData = null;
            let dayT1 = 0;
            let dayT2 = 0;
            
            for (const shop of planningData.shops) {
              const week = shop.weeks?.[format(weekStart, 'yyyy-MM-dd')];
              const empPlanning = week?.planning?.[emp.id];
              const slots = empPlanning?.[dayKey];
              
              if (slots) {
                if (typeof slots === 'string') {
                  // C'est un statut (maladie, congé, etc.)
                  dayData = slots;
                  break;
                } else if (Array.isArray(slots) && slots.some(Boolean)) {
                  // C'est du travail avec des créneaux
                  const timeSlots = shop.config?.timeSlots || [];
                  const interval = shop.config?.interval || 30;
                  const workTimes = getWorkTimesFromSlots(timeSlots, interval, slots);
                  
                  // Calculer les heures de nuit pour ce jour
                  const dayNightHours = calculateDayNightFromSlots(timeSlots, interval, slots);
                  dayT1 = dayNightHours.t1;
                  dayT2 = dayNightHours.t2;
                  weekT1 += dayT1;
                  weekT2 += dayT2;
                  
                  dayData = `${workTimes.entry || '-'} - ${workTimes.exit || '-'} (${workTimes.hours.toFixed(1)}h)`;
                  weekTotal += workTimes.hours;
                  break;
                }
              }
            }
            
            row.push(dayData || 'Congé ☀️');
            row.push(dayT1 > 0 ? `${dayT1.toFixed(1)} H` : '0.0 H');
            row.push(dayT2 > 0 ? `${dayT2.toFixed(1)} H` : '0.0 H');
          }
          
          row.push(weekTotal > 0 ? `${weekTotal.toFixed(1)} H` : '0.0 H');
          row.push(weekT1 > 0 ? `${weekT1.toFixed(1)} H` : '0.0 H');
          row.push(weekT2 > 0 ? `${weekT2.toFixed(1)} H` : '0.0 H');
          rows.push(row);
        });

        rows.push([]);
      });

      console.log(`✅ Feuille Rapport Hebdomadaire construite avec ${rows.length} lignes`);
      return rows;
    };

    const weeklyDetailedData = buildWeeklyDetailedSheet();
    console.log('🔍 Données hebdomadaires construites:', weeklyDetailedData.length > 0 ? 'OK' : 'VIDE');

    // Créer le fichier Excel (plusieurs feuilles)
    const wsDetail = XLSX.utils.aoa_to_sheet(excelData);
    const wsGlobal = XLSX.utils.aoa_to_sheet(globalSummaryData);
    const wsWeeklyDetailed = XLSX.utils.aoa_to_sheet(weeklyDetailedData);
    console.log('🔍 Feuilles Excel créées:', {
      detail: !!wsDetail,
      global: !!wsGlobal,
      weekly: !!wsWeeklyDetailed
    });

    // Construire la feuille "Heures de nuit" (par boutique → par semaine → colonnes T1/T2 par employé)
    const buildNightHoursSheet = () => {
      const rows = [];
      if (!planningData.shops || !Array.isArray(planningData.shops)) return rows;

      planningData.shops.forEach(shop => {
        rows.push([]);
        rows.push([`=== BOUTIQUE: ${shop.name?.toUpperCase() || shop.id} ===`]);
        rows.push([]);

        // N'inclure que les employés affectés et ayant des heures de nuit > 0 sur le mois courant
        const assigned = Array.isArray(shop.employees)
          ? shop.employees.filter(emp => Array.isArray(emp?.canWorkIn) && emp.canWorkIn.includes(shop.id))
          : [];
        const employeesInShop = assigned.filter(emp => {
          let hasNight = false;
          for (const weekStart of monthWeeks) {
            const nh = calculateEmployeeWeeklyNightHours(shop, weekStart, emp.id, monthStart, monthEnd);
            if ((nh.t1 || 0) + (nh.t2 || 0) > 0) { hasNight = true; break; }
          }
          return hasNight;
        });
        const header = ['Semaine'];
        employeesInShop.forEach(emp => {
          header.push(`${emp.name || emp.id} T1`, `${emp.name || emp.id} T2`);
        });
        header.push('Total semaine T1', 'Total semaine T2');
        rows.push(header);

        monthWeeks.forEach(weekStart => {
          const row = [getWeekRange(weekStart)];
          let weekT1 = 0, weekT2 = 0;
          employeesInShop.forEach(emp => {
            const nh = calculateEmployeeWeeklyNightHours(shop, weekStart, emp.id, monthStart, monthEnd);
            row.push(nh.t1 > 0 ? `${nh.t1.toFixed(1)} H` : '', nh.t2 > 0 ? `${nh.t2.toFixed(1)} H` : '');
            weekT1 += nh.t1; weekT2 += nh.t2;
          });
          row.push(weekT1 > 0 ? `${weekT1.toFixed(1)} H` : '', weekT2 > 0 ? `${weekT2.toFixed(1)} H` : '');
          rows.push(row);
        });

        // Totaux mois
        const totalRow = ['Total mois'];
        let totalT1 = 0, totalT2 = 0;
        employeesInShop.forEach(emp => {
          let empT1 = 0, empT2 = 0;
          monthWeeks.forEach(weekStart => {
            const nh = calculateEmployeeWeeklyNightHours(shop, weekStart, emp.id, monthStart, monthEnd);
            empT1 += nh.t1; empT2 += nh.t2;
          });
          totalRow.push(empT1 > 0 ? `${empT1.toFixed(1)} H` : '', empT2 > 0 ? `${empT2.toFixed(1)} H` : '');
          totalT1 += empT1; totalT2 += empT2;
        });
        totalRow.push(totalT1 > 0 ? `${totalT1.toFixed(1)} H` : '', totalT2 > 0 ? `${totalT2.toFixed(1)} H` : '');
        rows.push(totalRow);
      });

      return rows;
    };

    const nightHoursData = buildNightHoursSheet();

    // Mise en forme basique: largeurs de colonnes
    // Feuille Planning Détaillé: Semaine + N employés + Total
    wsDetail['!cols'] = [{ wch: 34 }];
    if (planningData?.shops?.length > 0) {
      const anyShop = planningData.shops[0];
      const employeesCount = (anyShop.employees || []).length;
      for (let i = 0; i < employeesCount; i++) wsDetail['!cols'].push({ wch: 12 });
      wsDetail['!cols'].push({ wch: 14 }); // Total
    }

    // Feuille Résumé global: Semaine + N boutiques + Total
    wsGlobal['!cols'] = [{ wch: 34 }];
    const shopsCount = planningData?.shops?.length || 0;
    for (let i = 0; i < shopsCount; i++) wsGlobal['!cols'].push({ wch: 14 });
    wsGlobal['!cols'].push({ wch: 16 });

    // Feuille Rapport Hebdomadaire: Employé + (7 jours × 3 colonnes) + 3 totaux
    wsWeeklyDetailed['!cols'] = [{ wch: 20 }]; // Employé
    for (let i = 0; i < 7; i++) {
      wsWeeklyDetailed['!cols'].push({ wch: 25 }); // Jour
      wsWeeklyDetailed['!cols'].push({ wch: 10 }); // T1 du jour
      wsWeeklyDetailed['!cols'].push({ wch: 10 }); // T2 du jour
    }
    wsWeeklyDetailed['!cols'].push({ wch: 15 }); // Total semaine
    wsWeeklyDetailed['!cols'].push({ wch: 12 }); // Total T1
    wsWeeklyDetailed['!cols'].push({ wch: 12 }); // Total T2

    // Thèmes de styles
    const THEMES = {
      bleu: {
        headerBg: '1E88E5', headerFont: 'FFFFFF',
        sectionBg: 'BBDEFB', sectionFont: '0D47A1',
        band1: 'FFFFFF', band2: 'F7F9FC',
        totalBg: 'E3F2FD', totalFont: '0D47A1',
        border: 'BDBDBD'
      },
      vert: {
        headerBg: '2E7D32', headerFont: 'FFFFFF',
        sectionBg: 'C8E6C9', sectionFont: '1B5E20',
        band1: 'FFFFFF', band2: 'F3F7F3',
        totalBg: 'E8F5E9', totalFont: '1B5E20',
        border: 'A5D6A7'
      },
      orange: {
        headerBg: 'FB8C00', headerFont: 'FFFFFF',
        sectionBg: 'FFE0B2', sectionFont: 'E65100',
        band1: 'FFFFFF', band2: 'FFF8F0',
        totalBg: 'FFEFD5', totalFont: 'E65100',
        border: 'FFCC80'
      }
    };

    const getSelectedThemeName = () => {
      try {
        const stored = localStorage.getItem('excel_theme');
        if (stored && THEMES[stored]) return stored;
      } catch (_) {}
      return 'bleu';
    };
    const THEME = THEMES[getSelectedThemeName()];

    const setCellStyle = (cell, style) => {
      cell.s = { ...(cell.s || {}), ...style };
    };

    const styleRow = (ws, rowIndexZeroBased, colCount, style) => {
      for (let c = 0; c < colCount; c++) {
        const addr = XLSX.utils.encode_cell({ r: rowIndexZeroBased, c });
        if (!ws[addr]) ws[addr] = { t: 's', v: '' };
        setCellStyle(ws[addr], style);
      }
    };

    const applyHeaderStyle = (ws, headerRowOneBased = 1) => {
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      const r = headerRowOneBased - 1;
      const baseStyle = {
        fill: { fgColor: { rgb: THEME.headerBg } },
        font: { color: { rgb: THEME.headerFont }, bold: true },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: {
          top: { style: 'thin', color: { rgb: THEME.border } },
          bottom: { style: 'thin', color: { rgb: THEME.border } },
          left: { style: 'thin', color: { rgb: THEME.border } },
          right: { style: 'thin', color: { rgb: THEME.border } }
        }
      };
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const addr = XLSX.utils.encode_cell({ r, c: C });
        const cell = ws[addr];
        if (cell) setCellStyle(cell, baseStyle);
      }
    };

    const applyBanding = (ws, startRowOneBased, endRowOneBased) => {
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      const colCount = range.e.c - range.s.c + 1;
      for (let r = startRowOneBased - 1; r <= endRowOneBased - 1; r++) {
        const isEven = (r - (startRowOneBased - 1)) % 2 === 0;
        const fillColor = isEven ? THEME.band1 : THEME.band2;
        styleRow(ws, r, colCount, {
          fill: { fgColor: { rgb: fillColor } },
          border: {
            top: { style: 'thin', color: { rgb: THEME.border } },
            bottom: { style: 'thin', color: { rgb: THEME.border } },
            left: { style: 'thin', color: { rgb: THEME.border } },
            right: { style: 'thin', color: { rgb: THEME.border } }
          },
          alignment: { vertical: 'center' }
        });
      }
    };

    const applySectionHeaderStyle = (ws, rowOneBased) => {
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      const colCount = range.e.c - range.s.c + 1;
      styleRow(ws, rowOneBased - 1, colCount, {
        fill: { fgColor: { rgb: THEME.sectionBg } },
        font: { color: { rgb: THEME.sectionFont }, bold: true },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: {
          top: { style: 'medium', color: { rgb: THEME.border } },
          bottom: { style: 'medium', color: { rgb: THEME.border } },
          left: { style: 'thin', color: { rgb: THEME.border } },
          right: { style: 'thin', color: { rgb: THEME.border } }
        }
      });
      // Fusionner la ligne entière pour le titre de section
      ws['!merges'] = ws['!merges'] || [];
      ws['!merges'].push({ s: { r: rowOneBased - 1, c: 0 }, e: { r: rowOneBased - 1, c: colCount - 1 } });
    };

    const applyTotalRowStyle = (ws, rowOneBased) => {
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      const colCount = range.e.c - range.s.c + 1;
      styleRow(ws, rowOneBased - 1, colCount, {
        fill: { fgColor: { rgb: THEME.totalBg } },
        font: { color: { rgb: THEME.totalFont }, bold: true },
        alignment: { vertical: 'center' },
        border: {
          top: { style: 'medium', color: { rgb: THEME.border } },
          bottom: { style: 'medium', color: { rgb: THEME.border } },
          left: { style: 'thin', color: { rgb: THEME.border } },
          right: { style: 'thin', color: { rgb: THEME.border } }
        }
      });
    };

    // Appliquer style d'entête par défaut sur première ligne si applicable (tolérant aux erreurs)
    try { applyHeaderStyle(wsDetail, 1); } catch (e) { console.warn('Style header wsDetail ignoré:', e); }
    try { applyHeaderStyle(wsGlobal, 1); } catch (e) { console.warn('Style header wsGlobal ignoré:', e); }
    // Construire et styliser la feuille Heures de nuit
    let wsNight = null;
    if (nightHoursData && nightHoursData.length > 0) {
      wsNight = XLSX.utils.aoa_to_sheet(nightHoursData);
      // Largeurs colonnes dynamiques en fonction du nombre réel de colonnes
      try {
        const rangeN = XLSX.utils.decode_range(wsNight['!ref'] || 'A1');
        const colCountN = rangeN.e.c - rangeN.s.c + 1;
        wsNight['!cols'] = [];
        for (let c = 0; c < colCountN; c++) {
          wsNight['!cols'].push({ wch: c === 0 ? 34 : 12 });
        }
      } catch (_) {}
      // Sections et banding: appliquer par bloc pour ne pas écraser les entêtes/sections/totaux
      try {
        const rangeN = XLSX.utils.decode_range(wsNight['!ref'] || 'A1');
        const numRowsN = rangeN.e.r - rangeN.s.r + 1;
        const colCountN = rangeN.e.c - rangeN.s.c + 1;
        let bandIndex = 0; // reset après chaque entête "Semaine"
        for (let r = 0; r < numRowsN; r++) {
          const addrA = XLSX.utils.encode_cell({ r, c: 0 });
          const v = wsNight[addrA]?.v;
          if (typeof v !== 'string') {
            // Ligne vide: sauter sans banding
            continue;
          }
          if (v.startsWith('=== BOUTIQUE:')) {
            applySectionHeaderStyle(wsNight, r + 1);
            continue;
          }
          if (v === 'Semaine') {
            applyHeaderStyle(wsNight, r + 1);
            bandIndex = 0; // redémarrer le banding après cet header
            continue;
          }
          if (v.startsWith('Total mois')) {
            applyTotalRowStyle(wsNight, r + 1);
            continue;
          }
          // Lignes données: appliquer banding alterné + bordures
          const isEven = bandIndex % 2 === 0;
          const fillColor = isEven ? THEME.band1 : THEME.band2;
          styleRow(wsNight, r, colCountN, {
            fill: { fgColor: { rgb: fillColor } },
            border: {
              top: { style: 'thin', color: { rgb: THEME.border } },
              bottom: { style: 'thin', color: { rgb: THEME.border } },
              left: { style: 'thin', color: { rgb: THEME.border } },
              right: { style: 'thin', color: { rgb: THEME.border } }
            },
            alignment: { vertical: 'center' }
          });
          bandIndex += 1;
        }
      } catch (e) { console.warn('Style Heures de nuit ignoré:', e); }
    }

    // Styling avancé pour Planning Détaillé: sections boutique, entêtes, banding et totaux
    const stylePlanningDetailSheet = () => {
      const range = XLSX.utils.decode_range(wsDetail['!ref'] || 'A1');
      const numRows = range.e.r - range.s.r + 1;
      const colCount = range.e.c - range.s.c + 1;
      let dataStartRow = null;
      for (let r = 0; r < numRows; r++) {
        const cellA = wsDetail[XLSX.utils.encode_cell({ r, c: 0 })];
        const v = cellA?.v;
        if (typeof v === 'string') {
          if (v.startsWith('=== BOUTIQUE:')) {
            applySectionHeaderStyle(wsDetail, r + 1);
          }
          if (v === 'Semaine') {
            applyHeaderStyle(wsDetail, r + 1);
            dataStartRow = r + 2;
          }
          if (v.startsWith('Total mois') || v.startsWith('TOTAL GÉNÉRAL')) {
            applyTotalRowStyle(wsDetail, r + 1);
          }
        }
      }
      if (dataStartRow) {
        // Trouver dernière ligne de données avant la prochaine section ou fin
        let dataEndRow = numRows;
        // Banding naïf sur tout, styles de totaux/sections écrasent si chevauchent
        applyBanding(wsDetail, dataStartRow, dataEndRow);
      }
    };
    try { stylePlanningDetailSheet(); } catch (e) { console.warn('Style Planning Détaillé ignoré:', e); }

    // Styling avancé pour Résumé global: header, banding, total
    const styleGlobalSummarySheet = () => {
      const range = XLSX.utils.decode_range(wsGlobal['!ref'] || 'A1');
      const numRows = range.e.r - range.s.r + 1;
      applyBanding(wsGlobal, 2, numRows);
      for (let r = 0; r < numRows; r++) {
        const cellA = wsGlobal[XLSX.utils.encode_cell({ r, c: 0 })];
        const v = cellA?.v;
        if (typeof v === 'string' && v === 'Total mois') {
          applyTotalRowStyle(wsGlobal, r + 1);
        }
      }
    };
    try { styleGlobalSummarySheet(); } catch (e) { console.warn('Style Résumé global ignoré:', e); }
    const wb = XLSX.utils.book_new();
    // Encapsuler l'ajout de feuilles dans des try/catch pour éviter les erreurs bloquantes
    try { XLSX.utils.book_append_sheet(wb, wsDetail, 'Planning Détaillé'); } catch (e) { console.warn('Ajout feuille Planning Détaillé ignoré:', e); }
    try { XLSX.utils.book_append_sheet(wb, wsGlobal, 'Résumé global'); } catch (e) { console.warn('Ajout feuille Résumé global ignoré:', e); }
    try { XLSX.utils.book_append_sheet(wb, wsWeeklyDetailed, 'Rapport Hebdomadaire'); } catch (e) { console.warn('Ajout feuille Rapport Hebdomadaire ignoré:', e); }
    
    // Construire la feuille "Vue Mensuelle Horizontale"
    const monthlyHorizontalData = buildMonthlyHorizontalSheet(planningData, monthStart, monthEnd);
    const wsMonthlyHorizontal = XLSX.utils.aoa_to_sheet(monthlyHorizontalData);
    
    // Ajouter la feuille "Vue Mensuelle Horizontale" au workbook principal
    try { XLSX.utils.book_append_sheet(wb, wsMonthlyHorizontal, 'Vue Mensuelle Horizontale'); } catch (e) { console.warn('Ajout feuille Vue Mensuelle Horizontale ignoré:', e); }
    
    // Configuration des colonnes et style pour la feuille "Vue Mensuelle Horizontale"
    try {
      // Configuration des largeurs de colonnes
      const monthDaysCount = monthlyHorizontalData.length > 0 ? monthlyHorizontalData[0].length - 3 : 31; // -3 pour Type, Plage, Total
      wsMonthlyHorizontal['!cols'] = [
        { wch: 15 }, // Type (jour, t1, t2)
        { wch: 12 }, // Plage horaire
        ...new Array(monthDaysCount).fill({ wch: 8 }), // Colonnes des jours
        { wch: 15 }  // Total
      ];
      
      // Appliquer le style professionnel
      const styleMonthlyHorizontalSheet = () => {
        console.log('🎨 Application du style pour Vue Mensuelle Horizontale...');
        const rangeRef = wsMonthlyHorizontal['!ref'] || 'A1';
        const range = XLSX.utils.decode_range(rangeRef);
        console.log('🎨 Plage de la feuille:', rangeRef, 'Range:', range);
        
        // Style des en-têtes des jours (ligne 3)
        for (let C = 2; C <= range.e.c - 1; ++C) { // À partir de la colonne C (jours)
          const cellAddress = XLSX.utils.encode_cell({ r: 2, c: C });
          const cell = wsMonthlyHorizontal[cellAddress];
          if (cell) {
            cell.s = {
              fill: { fgColor: { rgb: THEME.headerBg } },
              font: { color: { rgb: THEME.headerFont }, bold: true, size: 10 },
              alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
              border: {
                top: { style: 'thin', color: { rgb: THEME.border } },
                bottom: { style: 'thin', color: { rgb: THEME.border } },
                left: { style: 'thin', color: { rgb: THEME.border } },
                right: { style: 'thin', color: { rgb: THEME.border } }
              }
            };
          }
        }
        
        // Style des noms d'employés (lignes avec le nom de l'employé)
        for (let r = 0; r < range.e.r; r++) {
          const cellA = wsMonthlyHorizontal[XLSX.utils.encode_cell({ r, c: 0 })];
          const cellValue = cellA?.v || '';
          
          if (typeof cellValue === 'string' && cellValue.length > 0 && !['jour', 't1', 't2', ''].includes(cellValue)) {
            // C'est un nom d'employé
            for (let c = 0; c < range.e.c; c++) {
              const addr = XLSX.utils.encode_cell({ r, c });
              const cell = wsMonthlyHorizontal[addr] || (wsMonthlyHorizontal[addr] = { t: 's', v: '' });
              cell.s = {
                ...(cell.s || {}),
                fill: { fgColor: { rgb: THEME.sectionBg } },
                font: { color: { rgb: THEME.sectionFont }, bold: true, size: 12 },
                border: {
                  top: { style: 'medium', color: { rgb: THEME.border } },
                  bottom: { style: 'thin', color: { rgb: THEME.border } },
                  left: { style: 'thin', color: { rgb: THEME.border } },
                  right: { style: 'thin', color: { rgb: THEME.border } }
                },
                alignment: { horizontal: 'center', vertical: 'center' }
              };
            }
          }
        }
        
        // Style des lignes de données (jour, t1, t2) avec alternance de couleurs
        for (let r = 0; r < range.e.r; r++) {
          const cellA = wsMonthlyHorizontal[XLSX.utils.encode_cell({ r, c: 0 })];
          const cellValue = cellA?.v || '';
          
          if (['jour', 't1', 't2'].includes(cellValue)) {
            const isEven = Math.floor(r / 4) % 2 === 0; // Alternance par groupe d'employé
            const fillColor = isEven ? THEME.band1 : THEME.band2;
            
            for (let c = 0; c < range.e.c; c++) {
              const addr = XLSX.utils.encode_cell({ r, c });
              const cell = wsMonthlyHorizontal[addr] || (wsMonthlyHorizontal[addr] = { t: 's', v: '' });
              
              // Couleur spéciale pour les colonnes T1 et T2
              let cellFillColor = fillColor;
              let cellFontColor = '000000'; // Noir par défaut
              
              if (cellValue === 't1' || cellValue === 't2') {
                // Couleur spéciale pour T1/T2 : fond plus clair avec texte bleu
                cellFillColor = 'E8F4FD'; // Bleu très clair
                cellFontColor = '0066CC'; // Bleu
              }
              
              cell.s = {
                ...(cell.s || {}),
                fill: { fgColor: { rgb: cellFillColor } },
                font: { color: { rgb: cellFontColor }, size: 10 },
                border: {
                  top: { style: 'thin', color: { rgb: THEME.border } },
                  bottom: { style: 'thin', color: { rgb: THEME.border } },
                  left: { style: 'thin', color: { rgb: THEME.border } },
                  right: { style: 'thin', color: { rgb: THEME.border } }
                },
                alignment: { 
                  horizontal: cellValue === 'jour' ? 'left' : 'center', 
                  vertical: 'center',
                  wrapText: true 
                }
              };
            }
          }
        }
        
        // Style des lignes de totaux
        for (let r = 0; r < range.e.r; r++) {
          const cellA = wsMonthlyHorizontal[XLSX.utils.encode_cell({ r, c: 0 })];
          const cellValue = cellA?.v || '';
          
          if (cellValue === '') {
            // Ligne vide avant le total
            const nextRow = r + 1;
            if (nextRow < range.e.r) {
              const nextCellA = wsMonthlyHorizontal[XLSX.utils.encode_cell({ r: nextRow, c: 0 })];
              const nextCellValue = nextCellA?.v || '';
              
              if (nextCellValue === '') {
                // C'est la ligne de total général
                for (let c = 0; c < range.e.c; c++) {
                  const addr = XLSX.utils.encode_cell({ r: nextRow, c });
                  const cell = wsMonthlyHorizontal[addr] || (wsMonthlyHorizontal[addr] = { t: 's', v: '' });
                  cell.s = {
                    ...(cell.s || {}),
                    fill: { fgColor: { rgb: THEME.totalBg } },
                    font: { color: { rgb: THEME.totalFont }, bold: true, size: 11 },
                    border: {
                      top: { style: 'medium', color: { rgb: THEME.border } },
                      bottom: { style: 'medium', color: { rgb: THEME.border } },
                      left: { style: 'thin', color: { rgb: THEME.border } },
                      right: { style: 'thin', color: { rgb: THEME.border } }
                    },
                    alignment: { horizontal: 'center', vertical: 'center' }
                  };
                }
              }
            }
          }
        }
        
        // Style des colonnes de type et plage horaire
        for (let r = 0; r < range.e.r; r++) {
          for (let c = 0; c < 2; c++) { // Colonnes A et B
            const addr = XLSX.utils.encode_cell({ r, c });
            const cell = wsMonthlyHorizontal[addr];
            if (cell) {
              cell.s = {
                ...(cell.s || {}),
                font: { bold: true, size: 10 },
                border: {
                  top: { style: 'thin', color: { rgb: THEME.border } },
                  bottom: { style: 'thin', color: { rgb: THEME.border } },
                  left: { style: 'thin', color: { rgb: THEME.border } },
                  right: { style: 'thin', color: { rgb: THEME.border } }
                },
                alignment: { 
                  horizontal: c === 0 ? 'left' : 'center', 
                  vertical: 'center' 
                }
              };
            }
          }
        }
      };
      console.log('🎨 Style appliqué avec succès pour Vue Mensuelle Horizontale');
      styleMonthlyHorizontalSheet();
    } catch (e) { console.warn('Styles Vue Mensuelle Horizontale ignorés:', e); }
    
    // Appliquer les styles à la feuille Rapport Hebdomadaire
    try {
      const styleWeeklySheet = () => {
        const rangeRef = wsWeeklyDetailed['!ref'] || 'A1';
        const range = XLSX.utils.decode_range(rangeRef);
        
        // Style des en-têtes
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddress = XLSX.utils.encode_cell({ r: 0, c: C });
          const cell = wsWeeklyDetailed[cellAddress];
          if (cell) {
            cell.s = {
              fill: { fgColor: { rgb: THEME.headerBg } },
              font: { color: { rgb: THEME.headerFont }, bold: true },
              alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
              border: {
                top: { style: 'thin', color: { rgb: THEME.border } },
                bottom: { style: 'thin', color: { rgb: THEME.border } },
                left: { style: 'thin', color: { rgb: THEME.border } },
                right: { style: 'thin', color: { rgb: THEME.border } }
              }
            };
          }
        }
        
                 // Style des lignes de données avec alternance de couleurs et couleur spéciale pour T1/T2
         const numRows = range.e.r - range.s.r + 1;
         if (numRows > 1) {
           for (let r = 1; r < numRows; r++) {
             const isEven = (r - 1) % 2 === 0;
             const fillColor = isEven ? THEME.band1 : THEME.band2;
             
             for (let c = range.s.c; c <= range.e.c; c++) {
               const addr = XLSX.utils.encode_cell({ r, c });
               const cell = wsWeeklyDetailed[addr] || (wsWeeklyDetailed[addr] = { t: 's', v: '' });
               
               // Déterminer si c'est une colonne T1 ou T2 (colonnes 2, 5, 8, 11, 14, 17, 20 pour chaque jour)
               const isT1T2Column = (c - 1) % 3 === 1 || (c - 1) % 3 === 2; // Colonnes T1 et T2 de chaque jour
               const isTotalT1T2Column = c >= range.e.c - 1; // Dernières colonnes (Total T1, Total T2)
               
               let cellFillColor = fillColor;
               let cellFontColor = '000000'; // Noir par défaut
               
               if (isT1T2Column || isTotalT1T2Column) {
                 // Couleur spéciale pour T1/T2 : fond plus clair avec texte bleu
                 cellFillColor = 'E8F4FD'; // Bleu très clair
                 cellFontColor = '0066CC'; // Bleu
               }
               
               cell.s = {
                 ...(cell.s || {}),
                 fill: { fgColor: { rgb: cellFillColor } },
                 font: { color: { rgb: cellFontColor } },
                 border: {
                   top: { style: 'thin', color: { rgb: THEME.border } },
                   bottom: { style: 'thin', color: { rgb: THEME.border } },
                   left: { style: 'thin', color: { rgb: THEME.border } },
                   right: { style: 'thin', color: { rgb: THEME.border } }
                 },
                 alignment: { vertical: 'center', wrapText: true }
               };
             }
           }
         }
        
        // Style spécial pour les titres de semaine
        for (let r = 1; r < numRows; r++) {
          const cellA = wsWeeklyDetailed[XLSX.utils.encode_cell({ r, c: 0 })];
          const v = cellA?.v || '';
          if (typeof v === 'string' && v.startsWith('=== SEMAINE:')) {
            for (let c = range.s.c; c <= range.e.c; c++) {
              const addr = XLSX.utils.encode_cell({ r, c });
              const cell = wsWeeklyDetailed[addr] || (wsWeeklyDetailed[addr] = { t: 's', v: '' });
              cell.s = {
                ...(cell.s || {}),
                fill: { fgColor: { rgb: THEME.sectionBg } },
                font: { color: { rgb: THEME.sectionFont }, bold: true },
                border: {
                  top: { style: 'medium', color: { rgb: THEME.border } },
                  bottom: { style: 'medium', color: { rgb: THEME.border } },
                  left: { style: 'thin', color: { rgb: THEME.border } },
                  right: { style: 'thin', color: { rgb: THEME.border } }
                },
                alignment: { horizontal: 'center', vertical: 'center' }
              };
            }
          }
        }
      };
      styleWeeklySheet();
    } catch (e) { console.warn('Styles Rapport Hebdomadaire ignorés:', e); }
    if (wsNight) {
      XLSX.utils.book_append_sheet(wb, wsNight, 'Heures de nuit');
    }
    // Largeurs colonnes + style entête + banding + totaux pour les feuilles employé
    employeeSheets.forEach(s => {
      // colonnes: Jour, BOUTIQUE, ENTRÉE, PAUSE, RETOUR, SORTIE, Heures, T1, T2
      try {
        s.ws['!cols'] = [
          { wch: 36 },
          { wch: 18 },
          { wch: 10 },
          { wch: 10 },
          { wch: 10 },
          { wch: 10 },
          { wch: 12 },
          { wch: 10 },
          { wch: 10 }
        ];
        const rangeRef = s.ws['!ref'] || 'A1';
        const range = XLSX.utils.decode_range(rangeRef);
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddress = XLSX.utils.encode_cell({ r: 0, c: C });
          const cell = s.ws[cellAddress];
          if (cell) {
            cell.s = {
              fill: { fgColor: { rgb: THEME.headerBg } },
              font: { color: { rgb: THEME.headerFont }, bold: true },
              alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
              border: {
                top: { style: 'thin', color: { rgb: THEME.border } },
                bottom: { style: 'thin', color: { rgb: THEME.border } },
                left: { style: 'thin', color: { rgb: THEME.border } },
                right: { style: 'thin', color: { rgb: THEME.border } }
              }
            };
          }
        }
        const numRows = range.e.r - range.s.r + 1;
        if (numRows > 1) {
          for (let r = 1; r < numRows; r++) {
            const isEven = (r - 1) % 2 === 0;
            const fillColor = isEven ? THEME.band1 : THEME.band2;
            for (let c = range.s.c; c <= range.e.c; c++) {
              const addr = XLSX.utils.encode_cell({ r, c });
              const cell = s.ws[addr] || (s.ws[addr] = { t: 's', v: '' });
              
              // Déterminer si c'est une colonne T1 ou T2 (colonnes 7 et 8 dans les feuilles employé)
              const isT1T2Column = c === 7 || c === 8; // Colonnes T1 et T2
              
              let cellFillColor = fillColor;
              let cellFontColor = '000000'; // Noir par défaut
              
              if (isT1T2Column) {
                // Couleur spéciale pour T1/T2 : fond plus clair avec texte bleu
                cellFillColor = 'E8F4FD'; // Bleu très clair
                cellFontColor = '0066CC'; // Bleu
              }
              
              cell.s = {
                ...(cell.s || {}),
                fill: { fgColor: { rgb: cellFillColor } },
                font: { color: { rgb: cellFontColor } },
                border: {
                  top: { style: 'thin', color: { rgb: THEME.border } },
                  bottom: { style: 'thin', color: { rgb: THEME.border } },
                  left: { style: 'thin', color: { rgb: THEME.border } },
                  right: { style: 'thin', color: { rgb: THEME.border } }
                },
                alignment: { vertical: 'center', wrapText: true }
              };
            }
          }
        }
        for (let r = 1; r < numRows; r++) {
          const cellA = s.ws[XLSX.utils.encode_cell({ r, c: 0 })];
          const v = cellA?.v || '';
          if (typeof v === 'string' && v.startsWith('Semaine du')) {
            for (let c = range.s.c; c <= range.e.c; c++) {
              const addr = XLSX.utils.encode_cell({ r, c });
              const cell = s.ws[addr] || (s.ws[addr] = { t: 's', v: '' });
              cell.s = {
                ...(cell.s || {}),
                fill: { fgColor: { rgb: THEME.sectionBg } },
                font: { color: { rgb: THEME.sectionFont }, bold: true },
                border: {
                  top: { style: 'medium', color: { rgb: THEME.border } },
                  bottom: { style: 'medium', color: { rgb: THEME.border } },
                  left: { style: 'thin', color: { rgb: THEME.border } },
                  right: { style: 'thin', color: { rgb: THEME.border } }
                },
                alignment: { horizontal: 'center', vertical: 'center' }
              };
            }
          }
          if (typeof v === 'string' && (v === 'Total mois' || v.startsWith('TOTAL '))) {
            for (let c = range.s.c; c <= range.e.c; c++) {
              const addr = XLSX.utils.encode_cell({ r, c });
              const cell = s.ws[addr] || (s.ws[addr] = { t: 's', v: '' });
              cell.s = {
                ...(cell.s || {}),
                fill: { fgColor: { rgb: THEME.totalBg } },
                font: { color: { rgb: THEME.totalFont }, bold: true },
                border: {
                  top: { style: 'medium', color: { rgb: THEME.border } },
                  bottom: { style: 'medium', color: { rgb: THEME.border } },
                  left: { style: 'thin', color: { rgb: THEME.border } },
                  right: { style: 'thin', color: { rgb: THEME.border } }
                },
                alignment: { vertical: 'center' }
              };
            }
          }
          if (typeof v === 'string' && v === 'Total semaine') {
            for (let c = range.s.c; c <= range.e.c; c++) {
              const addr = XLSX.utils.encode_cell({ r, c });
              const cell = s.ws[addr] || (s.ws[addr] = { t: 's', v: '' });
              cell.s = {
                ...(cell.s || {}),
                fill: { fgColor: { rgb: THEME.totalBg } },
                font: { color: { rgb: THEME.totalFont }, bold: true },
                border: {
                  top: { style: 'medium', color: { rgb: THEME.border } },
                  bottom: { style: 'medium', color: { rgb: THEME.border } },
                  left: { style: 'thin', color: { rgb: THEME.border } },
                  right: { style: 'thin', color: { rgb: THEME.border } }
                },
                alignment: { vertical: 'center' }
              };
            }
          }
        }
      } catch (e) {
        console.warn(`Styles ignorés pour la feuille ${s.name}:`, e);
      }
      try { XLSX.utils.book_append_sheet(wb, s.ws, s.name); } catch (e) { console.warn(`Ajout feuille ${s.name} ignoré:`, e); }
    });
    
    // Exporter le fichier (tolérant aux erreurs liées au style)
    try {
    XLSX.writeFile(wb, `planning_detaille_${format(new Date(), 'yyyy-MM-dd_HHmm')}.xlsx`);
    } catch (e) {
      console.warn('writeFile (xlsx-js-style) a échoué, tentative fallback simple (xlsx):', e);
      try {
        // Fallback minimal via librairie xlsx (sans styles avancés)
        const wb2 = XLSXCore.utils.book_new();
        const wsDetail2 = XLSXCore.utils.aoa_to_sheet(excelData);
        const wsGlobal2 = XLSXCore.utils.aoa_to_sheet(globalSummaryData);
        const wsWeeklyDetailed2 = XLSXCore.utils.aoa_to_sheet(weeklyDetailedData);
        const wsMonthlyHorizontal2 = XLSXCore.utils.aoa_to_sheet(monthlyHorizontalData);
        XLSXCore.utils.book_append_sheet(wb2, wsDetail2, 'Planning Détaillé');
        XLSXCore.utils.book_append_sheet(wb2, wsGlobal2, 'Résumé global');
        XLSXCore.utils.book_append_sheet(wb2, wsWeeklyDetailed2, 'Rapport Hebdomadaire');
        XLSXCore.utils.book_append_sheet(wb2, wsMonthlyHorizontal2, 'Vue Mensuelle Horizontale');
        // Inclure Heures de nuit si dispo
        if (nightHoursData && nightHoursData.length > 0) {
          const wsNight2 = XLSXCore.utils.aoa_to_sheet(nightHoursData);
          XLSXCore.utils.book_append_sheet(wb2, wsNight2, 'Heures de nuit');
        }
        // Inclure feuilles employé (données sans styles)
        employeeSheets.forEach(s => {
          try {
            const raw = XLSXCore.utils.sheet_to_json(s.ws, { header: 1 });
            const wsEmp2 = XLSXCore.utils.aoa_to_sheet(raw);
            XLSXCore.utils.book_append_sheet(wb2, wsEmp2, s.name);
          } catch (_) {}
        });
        XLSXCore.writeFile(wb2, `planning_detaille_${format(new Date(), 'yyyy-MM-dd_HHmm')}.xlsx`);
      } catch (e2) {
        console.error('Échec export Excel (fallback xlsx):', e2);
        return false;
      }
    }
    
    console.log('📊 Export Excel détaillé réussi');
    return true;
  } catch (error) {
    console.error('Erreur lors de l\'export Excel:', error);
    return false;
  }
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

export const getAllEmployees = (planningData, currentDate = new Date()) => {
  const employeesMap = new Map();
  
  planningData.shops.forEach(shop => {
    shop.employees.forEach(emp => {
      // Vérifier si l'employé n'est pas masqué pour la date actuelle
      if (!isEmployeeHidden(emp, currentDate)) {
        if (!employeesMap.has(emp.id)) {
          employeesMap.set(emp.id, emp);
        } else {
          // Fusionner les boutiques autorisées et garder la boutique principale
          const existing = employeesMap.get(emp.id);
          const mergedCanWorkIn = [...new Set([...existing.canWorkIn, ...emp.canWorkIn])];
          const mainShop = existing.mainShop || emp.mainShop; // Garder la première boutique principale trouvée
          employeesMap.set(emp.id, { ...existing, canWorkIn: mergedCanWorkIn, mainShop });
        }
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
    const initializedPlanning = {};
    const shopEmployees = shop.employees || [];
    const timeSlots = shop.config?.timeSlots || [];
    
    // Créer les 7 jours de la semaine avec des clés de dates
    const weekStart = new Date(weekKey);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const dayDate = addDays(weekStart, i);
      days.push(format(dayDate, 'yyyy-MM-dd'));
    }
    
    shopEmployees.forEach(employee => {
      if (employee && employee.id) {
        initializedPlanning[employee.id] = {};

        days.forEach(dayKey => {
          // Vérifier si on a des données existantes pour ce jour et cet employé
          const existingData = weekData.planning?.[employee.id]?.[dayKey];

          if (existingData !== undefined && existingData !== null) {
            // 1) Nouveau format: statut sentinelle directement en chaîne ('Maladie 🤒' / 'Congé ☀️')
            if (typeof existingData === 'string') {
              initializedPlanning[employee.id][dayKey] = existingData;
              return;
            }

            // 2) Ancien format: tableau contenant des marqueurs texte ('M', 'C', 'Maladie', 'Congé')
            if (Array.isArray(existingData)) {
              const hasLegacyMaladie = existingData.some(v => v === 'M' || (typeof v === 'string' && v.toLowerCase().includes('maladie')));
              const hasLegacyConge = existingData.some(v => v === 'C' || (typeof v === 'string' && (v.toLowerCase().includes('congé') || v.toLowerCase().includes('conge'))));
              if (hasLegacyMaladie) {
                initializedPlanning[employee.id][dayKey] = 'Maladie 🤒';
                return;
              }
              if (hasLegacyConge) {
                initializedPlanning[employee.id][dayKey] = 'Congé ☀️';
                return;
              }

              // 3) Tableau booléen standard: copier/ajuster la longueur
              if (existingData.length === timeSlots.length) {
                initializedPlanning[employee.id][dayKey] = [...existingData];
              } else {
                if (existingData.length < timeSlots.length) {
                  initializedPlanning[employee.id][dayKey] = [
                    ...existingData,
                    ...new Array(timeSlots.length - existingData.length).fill(false)
                  ];
                } else {
                  initializedPlanning[employee.id][dayKey] = existingData.slice(0, timeSlots.length);
                }
              }
            } else {
              // Format inattendu: NE PAS initialiser automatiquement
              // Laisser undefined pour ne pas créer de données fantômes
            }
          } else {
            // ⚡ NE PLUS INITIALISER AUTOMATIQUEMENT
            // Si pas de données existantes, ne rien créer pour éviter les données parasites
            // Le jour reste undefined et ne sera pas affiché ni sauvegardé
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

// Fonction pour construire la feuille "Vue Mensuelle Horizontale"
const buildMonthlyHorizontalSheet = (planningData, monthStart, monthEnd) => {
  try {
    console.log('🔍 buildMonthlyHorizontalSheet - Début construction');
    console.log('🔍 buildMonthlyHorizontalSheet - planningData:', planningData);
    console.log('🔍 buildMonthlyHorizontalSheet - monthStart:', monthStart);
    console.log('🔍 buildMonthlyHorizontalSheet - monthEnd:', monthEnd);
    
    const allEmployees = getAllEmployees(planningData);
    console.log('🔍 buildMonthlyHorizontalSheet - allEmployees:', allEmployees);
    
    const monthDays = [];
    const currentDate = new Date(monthStart);
    
    // Générer tous les jours du mois
    while (currentDate <= monthEnd) {
      monthDays.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    console.log('🔍 buildMonthlyHorizontalSheet - Jours du mois:', monthDays.length);
    console.log('🔍 buildMonthlyHorizontalSheet - Premier jour:', monthDays[0]);
    console.log('🔍 buildMonthlyHorizontalSheet - Dernier jour:', monthDays[monthDays.length - 1]);
    
    const rows = [];
    
    // Pour chaque employé
    allEmployees.forEach(emp => {
      const empName = emp.name || emp.id;
      console.log(`🔍 buildMonthlyHorizontalSheet - Traitement employé: ${empName}`);
      
      // Titre de l'employé (ligne vide + nom)
      rows.push([]);
      rows.push([empName]);
      
      // En-têtes des jours (ligne vide + jours)
      const dayHeaders = ['', ''];
      monthDays.forEach(day => {
        const dayName = format(day, 'EEEE', { locale: fr }).toUpperCase();
        const dayDate = format(day, 'd/M', { locale: fr });
        dayHeaders.push(`${dayName}\t${dayDate}`);
      });
      rows.push(dayHeaders);
      
      // Ligne vide
      rows.push([]);
      
      // Ligne vide
      rows.push([]);
      
      // Ligne "jour 7H/21H"
      const jourRow = ['jour', '7H/21H'];
      let totalJour = 0;
      
      monthDays.forEach(day => {
        const dayKey = format(day, 'yyyy-MM-dd');
        let dayHours = 0;
        let dayData = null;
        
        // Chercher les données de l'employé pour ce jour
        for (const shop of planningData.shops) {
          // Utiliser la fonction getWeekKeyFromDate correctement
          const weekKey = getWeekKeyFromDate(dayKey);
          const week = shop.weeks?.[weekKey];
          const empPlanning = week?.planning?.[emp.id];
          const slots = empPlanning?.[dayKey];
          
          if (slots) {
            if (typeof slots === 'string') {
              // C'est un statut (maladie, congé, etc.)
              dayData = slots;
              break;
            } else if (Array.isArray(slots) && slots.some(Boolean)) {
              // C'est du travail avec des créneaux
              const timeSlots = shop.config?.timeSlots || [];
              const interval = shop.config?.interval || 30;
              const workTimes = getWorkTimesFromSlots(timeSlots, interval, slots);
              dayHours = workTimes.hours;
              totalJour += dayHours;
              break;
            }
          }
        }
        
        if (dayData) {
          jourRow.push(dayData);
        } else if (dayHours > 0) {
          jourRow.push(formatHours(dayHours));
        } else {
          jourRow.push('');
        }
      });
      
      // Total jour
      jourRow.push(formatTotalHours(totalJour));
      rows.push(jourRow);
      
      // Ligne "t1 21H/22H"
      const t1Row = ['t1', '21H/22H'];
      let totalT1 = 0;
      
      monthDays.forEach(day => {
        const dayKey = format(day, 'yyyy-MM-dd');
        let dayT1 = 0;
        
        // Chercher les données de l'employé pour ce jour
        for (const shop of planningData.shops) {
          const weekKey = getWeekKeyFromDate(dayKey);
          const week = shop.weeks?.[weekKey];
          const empPlanning = week?.planning?.[emp.id];
          const slots = empPlanning?.[dayKey];
          
          if (slots && Array.isArray(slots) && slots.some(Boolean)) {
            const timeSlots = shop.config?.timeSlots || [];
            const interval = shop.config?.interval || 30;
            const dayNightHours = calculateDayNightFromSlots(timeSlots, interval, slots);
            dayT1 = dayNightHours.t1;
            totalT1 += dayT1;
            break;
          }
        }
        
        if (dayT1 > 0) {
          t1Row.push(formatHours(dayT1));
        } else {
          t1Row.push('');
        }
      });
      
      // Total t1
      t1Row.push(formatTotalHours(totalT1));
      rows.push(t1Row);
      
      // Ligne "t2 NUIT"
      const t2Row = ['t2', 'NUIT'];
      let totalT2 = 0;
      
      monthDays.forEach(day => {
        const dayKey = format(day, 'yyyy-MM-dd');
        let dayT2 = 0;
        
        // Chercher les données de l'employé pour ce jour
        for (const shop of planningData.shops) {
          const weekKey = getWeekKeyFromDate(dayKey);
          const week = shop.weeks?.[weekKey];
          const empPlanning = week?.planning?.[emp.id];
          const slots = empPlanning?.[dayKey];
          
          if (slots && Array.isArray(slots) && slots.some(Boolean)) {
            const timeSlots = shop.config?.timeSlots || [];
            const interval = shop.config?.interval || 30;
            const dayNightHours = calculateDayNightFromSlots(timeSlots, interval, slots);
            dayT2 = dayNightHours.t2;
            totalT2 += dayT2;
            break;
          }
        }
        
        if (dayT2 > 0) {
          t2Row.push(formatHours(dayT2));
        } else {
          t2Row.push('');
        }
      });
      
      // Total t2
      t2Row.push(formatTotalHours(totalT2));
      rows.push(t2Row);
      
      // Ligne vide
      rows.push([]);
      
      // Total général
      const totalGeneral = totalJour + totalT1 + totalT2;
      const totalRow = ['', '', ...new Array(monthDays.length).fill(''), formatTotalHours(totalGeneral)];
      rows.push(totalRow);
      
      // Ligne vide
      rows.push([]);
    });
    
    console.log('🔍 buildMonthlyHorizontalSheet - Construction terminée, lignes:', rows.length);
    console.log('🔍 buildMonthlyHorizontalSheet - Première ligne:', rows[0]);
    return rows;
    
  } catch (error) {
    console.error('Erreur dans buildMonthlyHorizontalSheet:', error);
    return [];
  }
};

// Fonction utilitaire pour formater les heures
const formatHours = (hours) => {
  if (hours === 0) return '';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h.toString().padStart(2, '0')}:00`;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

// Fonction utilitaire pour formater les totaux d'heures
const formatTotalHours = (hours) => {
  if (hours === 0) return '';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}:${m.toString().padStart(2, '0')}:00`;
}; 