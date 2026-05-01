import { loadFromLocalStorage } from './localStorage';
import { parse, differenceInMinutes, format, addDays, addMinutes, startOfMonth, endOfMonth, isMonday, isWithinInterval } from 'date-fns';
import { minutesBetweenHHmm, getSlotEndTimeFormatted } from './slotDurationUtils';
import { fr } from 'date-fns/locale';

/**
 * Heures travaillées sur un jour — même convention pour toutes les boutiques :
 * début = ligne du haut (DE) du premier créneau coché du bloc ;
 * fin = ligne du bas (À) du dernier créneau coché (= borne de fin du créneau, durées variables prises en compte).
 * Plusieurs blocs séparés par des cases vides sont additionnés.
 */
export const calculateEmployeeDailyHours = (employee, dayKey, planning, config) => {
  const employeeId = typeof employee === 'object' && employee !== null ? employee.id || employee.name : employee;
  const isSelectedSlot = (value) => value === true || value === 1 || value === '1' || value === 'true';

  if (!planning || !config?.timeSlots || !Array.isArray(config.timeSlots)) {
    console.warn(`calculateEmployeeDailyHours: Invalid config for ${employeeId} on ${dayKey}`, { planning, config });
    return 0;
  }

  if (config.timeSlots.length === 0) {
    console.warn(`calculateEmployeeDailyHours: Configuration des tranches horaires vide pour ${employeeId} on ${dayKey}`, { config });
    return 0;
  }

  const employeeData = planning[employeeId];
  if (!employeeData || !employeeData[dayKey]) {
    return 0;
  }

  const slots = employeeData[dayKey];

  if (!Array.isArray(slots)) {
    if (typeof slots === 'string') {
      const normalized = slots.toLowerCase();
      if (normalized.includes('congé') || normalized.includes('conge') || normalized.includes('maladie')) {
        return 0;
      }
    }
    console.warn(`calculateEmployeeDailyHours: Invalid slots for ${employeeId} on ${dayKey}`, { slots });
    return 0;
  }

  if (!slots.some(isSelectedSlot)) {
    return 0;
  }

  const timeSlots = config.timeSlots;
  const n = Math.min(slots.length, timeSlots.length);
  let totalMinutes = 0;

  const slotHeaderOk = (idx) =>
    idx >= 0 &&
    idx < timeSlots.length &&
    timeSlots[idx] &&
    typeof timeSlots[idx] === 'string';

  let i = 0;
  while (i < n) {
    while (i < n && (!isSelectedSlot(slots[i]) || !slotHeaderOk(i))) {
      i += 1;
    }
    if (i >= n) break;

    const startIdx = i;
    while (i < n && isSelectedSlot(slots[i])) {
      i += 1;
    }
    const endIdx = i - 1;

    if (!slotHeaderOk(startIdx) || !slotHeaderOk(endIdx)) continue;

    const startStr = timeSlots[startIdx];
    const endStr = getSlotEndTimeFormatted(timeSlots, endIdx, config);
    if (!startStr || !endStr || endStr === '-') continue;

    totalMinutes += minutesBetweenHHmm(startStr, endStr);
  }

  return totalMinutes / 60;
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