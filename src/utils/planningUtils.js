import { loadFromLocalStorage } from './localStorage';
import { parse, differenceInMinutes, format, addDays, addMinutes, startOfMonth, endOfMonth, isMonday } from 'date-fns';
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

/**
 * Affichage des heures planifiées (grilles au quart d’heure / mixtes).
 * Évite les valeurs trompeuses du type « 8,8 h » pour 8 h 45 (8,75 h décimal).
 */
export function formatWorkedHoursForDisplay(hours) {
  if (hours == null || !Number.isFinite(hours) || hours <= 0) return '0 h';
  const totalMin = Math.round(hours * 60);
  if (totalMin <= 0) return '0 h';
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (m === 0) return `${h} h`;
  return `${h} h ${String(m).padStart(2, '0')}`;
}

/** Heures décimales (2 décimales max) pour colonnes Excel / calculs numériques purs. */
export function workedHoursNumericForExport(hours) {
  if (hours == null || !Number.isFinite(hours) || hours <= 0) return 0;
  return Math.round(hours * 100) / 100;
}

/**
 * Format « Nb (h) » lisible : minutes après le point (ex. 9.30 = 9 h 30), pas des décimales d’heures (évite 9,5 pour une demi-heure).
 */
export function formatWorkedHoursNbNotation(hours) {
  if (hours == null || !Number.isFinite(hours) || hours <= 0) return '0';
  const totalMin = Math.round(hours * 60);
  if (totalMin <= 0) return '0';
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (m === 0) return String(h);
  return `${h}.${String(m).padStart(2, '0')}`;
}

/** Indique si une date yyyy-MM-dd tombe dans le mois calendaire de selectedWeekAnchor. */
export function isCalendarDayKeyInMonth(dayKey, selectedWeekAnchor) {
  const start = format(startOfMonth(new Date(selectedWeekAnchor)), 'yyyy-MM-dd');
  const end = format(endOfMonth(new Date(selectedWeekAnchor)), 'yyyy-MM-dd');
  return dayKey >= start && dayKey <= end;
}

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
  const monthAnchor = new Date(selectedWeek);
  const monthStart = startOfMonth(monthAnchor);
  const monthEnd = endOfMonth(monthAnchor);
  const monthStartStr = format(monthStart, 'yyyy-MM-dd');
  const monthEndStr = format(monthEnd, 'yyyy-MM-dd');
  let monthlyTotal = 0;
  const weeklySummaries = [];

  const shopsToProcess = currentShopId ? shops.filter((shop) => shop.id === currentShopId) : shops;

  shopsToProcess.forEach((shop) => {
    const storageKeys = Object.keys(localStorage).filter((key) => key.startsWith(`planning_${shop.id}_`));
    storageKeys.forEach((key) => {
      const weekKey = key.replace(`planning_${shop.id}_`, '');
      const weekStart = new Date(`${weekKey}T12:00:00`);
      if (!Number.isFinite(weekStart.getTime()) || !isMonday(weekStart)) return;

      const weekEnd = addDays(weekStart, 6);
      if (weekEnd < monthStart || weekStart > monthEnd) return;

      const weekPlanning = loadFromLocalStorage(`planning_${shop.id}_${weekKey}`, {});
      let weekTotalInMonth = 0;
      let weekTotalFull = 0;
      for (let i = 0; i < 7; i += 1) {
        const dayKey = format(addDays(weekStart, i), 'yyyy-MM-dd');
        const hours = calculateEmployeeDailyHours(employee, dayKey, weekPlanning, config);
        weekTotalFull += hours;
        if (dayKey >= monthStartStr && dayKey <= monthEndStr) {
          weekTotalInMonth += hours;
        }
      }
      if (weekTotalInMonth > 0.001) {
        weeklySummaries.push({
          week: `Semaine du ${format(weekStart, 'd MMMM', { locale: fr })} au ${format(addDays(weekStart, 6), 'd MMMM yyyy', { locale: fr })}`,
          shop: shop.name,
          hours: formatWorkedHoursForDisplay(weekTotalInMonth),
          hoursFullWeek:
            weekTotalFull > weekTotalInMonth + 0.001 ? formatWorkedHoursForDisplay(weekTotalFull) : null
        });
        monthlyTotal += weekTotalInMonth;
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