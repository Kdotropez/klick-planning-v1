import { parse, differenceInMinutes, addMinutes, format } from 'date-fns';

const REF = new Date(2000, 0, 1);

/**
 * Durée en minutes entre deux bornes HH:mm (prise en charge fin de journée après minuit).
 */
export function minutesBetweenHHmm(startStr, endStr) {
  if (!startStr || !endStr) return 0;
  const start = parse(startStr, 'HH:mm', REF);
  const normalizedEnd = endStr === '24:00' ? '23:59' : endStr;
  let end;
  if (['00:00', '01:00', '02:00', '03:00'].includes(normalizedEnd)) {
    end = parse(normalizedEnd === '00:00' ? '00:00' : normalizedEnd, 'HH:mm', new Date(2000, 0, 2));
  } else {
    end = parse(normalizedEnd, 'HH:mm', REF);
  }
  let mins = differenceInMinutes(end, start);
  if (mins <= 0) mins += 24 * 60;
  return mins;
}

/**
 * Durée du créneau à l'index `index` : écart jusqu'au créneau suivant,
 * ou jusqu'à `config.endTime` pour le dernier créneau ; repli sur `config.interval`.
 * @param {string[]} timeSlots
 * @param {number} index
 * @param {{ interval?: number, endTime?: string, timeSlots?: string[] }} config
 */
export function getSlotDurationMinutes(timeSlots, index, config = {}) {
  if (!Array.isArray(timeSlots) || index < 0 || index >= timeSlots.length) {
    return Number(config.interval) || 30;
  }
  const fallback = Number(config.interval) || 30;
  const curStr = timeSlots[index];
  if (!curStr || typeof curStr !== 'string') return fallback;

  if (index < timeSlots.length - 1) {
    const nextStr = timeSlots[index + 1];
    if (!nextStr) return fallback;
    const mins = minutesBetweenHHmm(curStr, nextStr);
    return mins > 0 ? mins : fallback;
  }

  const endStr = config.endTime;
  if (endStr && typeof endStr === 'string') {
    const mins = minutesBetweenHHmm(curStr, endStr);
    if (mins > 0) return mins;
  }
  return fallback;
}

export function getSlotEndTimeFormatted(timeSlots, index, config = {}) {
  const start = timeSlots[index];
  if (!start) return '-';
  const mins = getSlotDurationMinutes(timeSlots, index, config);
  const d = parse(start, 'HH:mm', REF);
  return format(addMinutes(d, mins), 'HH:mm');
}

/** Intervalle semi-ouvert [startMin, endMin) en minutes depuis minuit (même jour). */
function slotOpenIntervalMinutes(timeSlots, index, config = {}) {
  if (!Array.isArray(timeSlots) || index < 0 || index >= timeSlots.length) return null;
  const startStr = timeSlots[index];
  if (!startStr || typeof startStr !== 'string') return null;
  const start = parse(startStr, 'HH:mm', REF);
  let startMin = start.getHours() * 60 + start.getMinutes();

  let endStr;
  if (index < timeSlots.length - 1) {
    endStr = timeSlots[index + 1];
  } else {
    endStr = config.endTime || '23:59';
  }
  const normalizedEnd = endStr === '24:00' ? '23:59' : endStr;
  const end = ['00:00', '01:00', '02:00', '03:00'].includes(normalizedEnd)
    ? parse(normalizedEnd === '00:00' ? '00:00' : normalizedEnd, 'HH:mm', new Date(2000, 0, 2))
    : parse(normalizedEnd, 'HH:mm', REF);
  let endMin = end.getHours() * 60 + end.getMinutes();
  if (endMin <= startMin) endMin += 24 * 60;
  return { startMin, endMin };
}

/**
 * Recalcule les cases cochées lorsque la grille horaire change (ex. passage quart d’heure → marché ambulant).
 */
export function migrateSelectionsToNewTimeSlots(oldTimeSlots, oldSelections, oldConfig, newTimeSlots, newConfig) {
  if (!Array.isArray(newTimeSlots) || newTimeSlots.length === 0) return [];
  const out = Array(newTimeSlots.length).fill(false);
  if (!Array.isArray(oldTimeSlots) || !Array.isArray(oldSelections)) return out;

  for (let j = 0; j < newTimeSlots.length; j++) {
    const nInt = slotOpenIntervalMinutes(newTimeSlots, j, newConfig);
    if (!nInt) continue;
    const { startMin: ns, endMin: ne } = nInt;
    for (let i = 0; i < oldTimeSlots.length && i < oldSelections.length; i++) {
      if (!oldSelections[i]) continue;
      const oInt = slotOpenIntervalMinutes(oldTimeSlots, i, oldConfig);
      if (!oInt) continue;
      const { startMin: os, endMin: oe } = oInt;
      if (os < ne && oe > ns) {
        out[j] = true;
        break;
      }
    }
  }
  return out;
}

export function sumSelectedSlotsMinutes(slots, timeSlots, config = {}) {
  if (!Array.isArray(slots) || !Array.isArray(timeSlots)) return 0;
  const isSel = (v) => v === true || v === 1 || v === '1' || v === 'true';
  let total = 0;
  for (let i = 0; i < Math.min(slots.length, timeSlots.length); i++) {
    if (isSel(slots[i])) total += getSlotDurationMinutes(timeSlots, i, config);
  }
  return total;
}

/**
 * Plages horaires affichées / export (créneaux variables).
 */
export function buildSlotRangeLines(slots, timeSlots, config = {}) {
  if (!Array.isArray(slots) || !Array.isArray(timeSlots) || !timeSlots.length) return [];
  const ranges = [];
  let startIndex = null;
  const norm = (v) => v === true || v === 1 || v === '1' || v === 'true';

  for (let i = 0; i < slots.length; i += 1) {
    const selected = norm(slots[i]);
    if (selected && startIndex === null) startIndex = i;
    if (!selected && startIndex !== null) {
      const start = timeSlots[startIndex];
      const lastIdx = Math.max(0, i - 1);
      const endLabel = getSlotEndTimeFormatted(timeSlots, lastIdx, config);
      if (start && endLabel) ranges.push(`${start}-${endLabel}`);
      startIndex = null;
    }
  }
  if (startIndex !== null) {
    let lastSel = startIndex;
    for (let j = startIndex; j < Math.min(slots.length, timeSlots.length); j++) {
      if (norm(slots[j])) lastSel = j;
    }
    const start = timeSlots[startIndex];
    const endLabel = getSlotEndTimeFormatted(timeSlots, lastSel, config);
    if (start && endLabel) ranges.push(`${start}-${endLabel}`);
  }
  return ranges;
}
