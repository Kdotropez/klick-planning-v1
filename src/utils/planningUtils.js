import { loadFromLocalStorage } from './localStorage';
import { parse, differenceInMinutes, format, addDays, addMinutes, startOfMonth, endOfMonth, isMonday, isWithinInterval } from 'date-fns';
import { getSlotDurationMinutes } from './slotDurationUtils';
import { fr } from 'date-fns/locale';

export const calculateEmployeeDailyHours = (employee, dayKey, planning, config) => {
  // S'assurer que employee est une chaîne (ID) et non un objet
  const employeeId = typeof employee === 'object' && employee !== null ? employee.id || employee.name : employee;
  const isSelectedSlot = (value) => value === true || value === 1 || value === '1' || value === 'true';
  
  // Vérifier si les données sont valides
  if (!planning || !config?.timeSlots || !Array.isArray(config.timeSlots)) {
    console.warn(`calculateEmployeeDailyHours: Invalid config for ${employeeId} on ${dayKey}`, { planning, config });
    return 0;
  }
  
  // Validation supplémentaire de la configuration des tranches horaires
  if (config.timeSlots.length === 0) {
    console.warn(`calculateEmployeeDailyHours: Configuration des tranches horaires vide pour ${employeeId} on ${dayKey}`, { config });
    return 0;
  }
  
  // Chercher les données de l'employé dans le planning
  const employeeData = planning[employeeId];
  if (!employeeData || !employeeData[dayKey]) {
    // console.warn(`calculateEmployeeDailyHours: No data for ${employeeId} on ${dayKey}`, { planning });
    return 0;
  }
  
  const slots = employeeData[dayKey];
  
  // Vérifier que les slots sont un tableau valide ou un statut spécial
  if (!Array.isArray(slots)) {
    // Support des statuts sentinelles: Congé / Maladie
    if (typeof slots === 'string') {
      const normalized = slots.toLowerCase();
      if (normalized.includes('congé') || normalized.includes('conge') || normalized.includes('maladie')) {
        return 0;
      }
    }
    console.warn(`calculateEmployeeDailyHours: Invalid slots for ${employeeId} on ${dayKey}`, { slots });
    return 0;
  }
  
  // Vérifier s'il y a au moins un créneau sélectionné
  if (!slots.some(isSelectedSlot)) {
    return 0;
  }
  
  let totalMinutes = 0;
  let inShift = false;
  let shiftStartIndex = null;

  for (let i = 0; i < slots.length && i < config.timeSlots.length; i++) {
    // Validation de chaque tranche horaire
    if (!config.timeSlots[i] || typeof config.timeSlots[i] !== 'string') {
      console.warn(`calculateEmployeeDailyHours: timeSlots[${i}] invalide pour ${employeeId} on ${dayKey}`, { 
        timeSlot: config.timeSlots[i], 
        timeSlotType: typeof config.timeSlots[i] 
      });
      continue;
    }
    
    if (isSelectedSlot(slots[i]) && !inShift) {
      inShift = true;
      shiftStartIndex = i;
    } else if (!isSelectedSlot(slots[i]) && inShift) {
      inShift = false;
      const startTime = config.timeSlots[shiftStartIndex];
      const endTime = config.timeSlots[i];
      if (startTime && endTime) {
        try {
          const start = parse(startTime, 'HH:mm', new Date());
          const end = parse(endTime, 'HH:mm', new Date());
          totalMinutes += differenceInMinutes(end, start);
        } catch (e) {
          console.warn(`calculateEmployeeDailyHours: Error parsing times for ${employeeId} on ${dayKey}`, { startTime, endTime, error: e });
        }
      }
      shiftStartIndex = null;
    }
  }

  if (inShift && shiftStartIndex !== null) {
    let lastSel = shiftStartIndex;
    for (let i = shiftStartIndex; i < Math.min(slots.length, config.timeSlots.length); i++) {
      if (isSelectedSlot(slots[i])) lastSel = i;
    }
    const startTime = config.timeSlots[shiftStartIndex];
    const lastStartTime = config.timeSlots[lastSel];
    if (startTime && lastStartTime) {
      try {
        const start = parse(startTime, 'HH:mm', new Date());
        const dur = getSlotDurationMinutes(config.timeSlots, lastSel, config);
        const end = addMinutes(parse(lastStartTime, 'HH:mm', new Date()), dur);
        totalMinutes += differenceInMinutes(end, start);
      } catch (e) {
        console.warn(`calculateEmployeeDailyHours: Error parsing times for ${employeeId} on ${dayKey}`, { startTime, lastStartTime, error: e });
      }
    }
  }

  const hours = totalMinutes / 60;
  console.log(`calculateEmployeeDailyHours: Result for ${employeeId} on ${dayKey}:`, { slots, hours });
  return hours;
};

export const getTimeSlotsWithBreaks = (employee, dayKey, weekPlanning, config) => {
  console.log(`getTimeSlotsWithBreaks for ${employee} on ${dayKey}`, { weekPlanning, config });
  
  // Chercher les données de l'employé dans le planning
  const employeeData = weekPlanning[employee];
  const slots = employeeData?.[dayKey] || [];
  console.log(`getTimeSlotsWithBreaks: Slots for ${employee} on ${dayKey}`, JSON.stringify(slots, null, 2));
  
  // Validation robuste de la configuration des tranches horaires
  const timeSlots = config?.timeSlots || [];
  if (!Array.isArray(timeSlots) || timeSlots.length === 0) {
    console.warn(`getTimeSlotsWithBreaks: Configuration des tranches horaires invalide pour ${employee} on ${dayKey}`, { config, timeSlots });
    return { status: 'Configuration invalide ⚠️', ranges: [], breaks: [], hours: 0, columns: ['ENTRÉE'], values: ['Configuration invalide ⚠️'] };
  }
  
  const ranges = [];
  let currentRange = null;
  let breaks = [];

  if (!slots.some(slot => slot)) {
    return { status: 'Congé ☀️', ranges: [], breaks: [], hours: 0, columns: ['ENTRÉE'], values: ['Congé ☀️'] };
  }

  for (let i = 0; i < slots.length && i < timeSlots.length; i++) {
    // Validation robuste de chaque tranche horaire
    if (!timeSlots[i] || typeof timeSlots[i] !== 'string') {
      console.warn(`getTimeSlotsWithBreaks: timeSlots[${i}] est invalide pour ${employee} on ${dayKey}`, { 
        timeSlot: timeSlots[i], 
        timeSlotType: typeof timeSlots[i],
        timeSlotsLength: timeSlots.length,
        slotsLength: slots.length
      });
      continue;
    }
    
    if (slots[i]) {
      if (!currentRange) {
        currentRange = { 
          start: timeSlots[i],
          end: timeSlots[i]
        };
      } else {
        currentRange.end = timeSlots[i];
      }
    } else if (currentRange && breaks.length < 1) {
      ranges.push(currentRange);
      if (i < slots.length) {
        breaks.push({ 
          start: currentRange.end, 
          end: timeSlots[i] || '-' 
        });
      }
      currentRange = null;
    }
  }
  if (currentRange) {
    ranges.push(currentRange);
  }

  const columns = breaks.length === 0 ? ['ENTRÉE', 'SORTIE'] : ['ENTRÉE', 'PAUSE', 'RETOUR', 'SORTIE'];
  const values = [];

  if (breaks.length === 0 && ranges[0]) {
    values.push(ranges[0].start, ranges[0].end);
  } else if (ranges[0] && breaks[0]) {
    values.push(ranges[0].start, breaks[0].start, ranges[1]?.start || '-', ranges[ranges.length - 1]?.end || '-');
  }

  const hours = calculateEmployeeDailyHours(employee, dayKey, weekPlanning, config);
  console.log(`getTimeSlotsWithBreaks: Result for ${employee} on ${dayKey}:`, JSON.stringify({ slots, ranges, breaks, hours, columns, values }, null, 2));
  return { status: null, ranges, breaks, hours, columns, values };
};

export const getEmployeeMonthlySummaryData = (employee, selectedWeek, shops, config, currentShopId = null) => {
  console.log(`getEmployeeMonthlySummaryData for ${employee}`, { selectedWeek, shops, currentShopId });
  const start = startOfMonth(new Date(selectedWeek));
  const end = endOfMonth(new Date(selectedWeek));
  let monthlyTotal = 0;
  const weeklySummaries = [];

  // Si currentShopId est spécifié, ne calculer que pour cette boutique
  const shopsToProcess = currentShopId ? shops.filter(shop => shop.id === currentShopId) : shops;
  
  shopsToProcess.forEach(shop => {
    const storageKeys = Object.keys(localStorage).filter(key => key.startsWith(`planning_${shop.id}_`));
    storageKeys.forEach(key => {
      const weekKey = key.replace(`planning_${shop.id}_`, '');
      const weekStart = new Date(weekKey);
      if (isWithinInterval(weekStart, { start, end }) && isMonday(weekStart)) {
        const weekPlanning = loadFromLocalStorage(`planning_${shop.id}_${weekKey}`, {});
        let weekTotal = 0;
        for (let i = 0; i < 7; i++) {
          const dayKey = format(addDays(weekStart, i), 'yyyy-MM-dd');
          const hours = calculateEmployeeDailyHours(employee, dayKey, weekPlanning, config);
          weekTotal += hours;
        }
        if (weekTotal > 0) {
          weeklySummaries.push({
            week: `Semaine du ${format(weekStart, 'd MMMM', { locale: fr })} au ${format(addDays(weekStart, 6), 'd MMMM yyyy', { locale: fr })}`,
            shop: shop.name,
            hours: weekTotal.toFixed(1)
          });
          monthlyTotal += weekTotal;
        }
      }
    });
  });

  console.log(`getEmployeeMonthlySummaryData: Result for ${employee}:`, { monthlyTotal, weeklySummaries });
  return { monthlyTotal, weeklySummaries };
};

/** Indique si une cellule jour (créneaux ou statut) contient autre chose que du vide / grille neutre. */
export const dayCellHasPlanningContent = (value) => {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) {
    return value.some((slot) => {
      if (slot === true || slot === 1 || slot === '1' || slot === 'true') return true;
      if (typeof slot === 'string') {
        const s = slot.toLowerCase();
        return s.includes('maladie') || s.includes('cong') || slot === 'M' || slot === 'C';
      }
      return false;
    });
  }
  return false;
};