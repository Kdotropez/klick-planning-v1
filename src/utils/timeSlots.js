import { parse, addMinutes, format } from 'date-fns';

const REF = new Date(2025, 0, 1);

/**
 * Grille « marché ambulant » : 5h–17h, quart d’heure hors plage centrale,
 * tranches d’1 h entre 8h et 13h (8→9→…→12), puis quart d’heure jusqu’à 17h.
 */
export function generateMarcheAmbulantTimeSlots() {
  const slots = [];
  let t = parse('05:00', 'HH:mm', REF);
  const until8 = parse('08:00', 'HH:mm', REF);
  while (t < until8) {
    slots.push(format(t, 'HH:mm'));
    t = addMinutes(t, 15);
  }
  let h = parse('08:00', 'HH:mm', REF);
  const until13 = parse('13:00', 'HH:mm', REF);
  while (h < until13) {
    slots.push(format(h, 'HH:mm'));
    h = addMinutes(h, 60);
  }
  let t2 = parse('13:00', 'HH:mm', REF);
  const until17 = parse('17:00', 'HH:mm', REF);
  while (t2 < until17) {
    slots.push(format(t2, 'HH:mm'));
    t2 = addMinutes(t2, 15);
  }
  return slots;
}

/**
 * Grille encore « tout quart d’heure » alors que la boutique est un marché ambulant :
 * déclenche une resynchronisation vers la grille mixte + migration des coches.
 */
export function looksLikeUniformMarchePlanningGrid(config, shopName) {
  if (!shopName || typeof shopName !== 'string' || !config?.timeSlots?.length) return false;
  const compact = shopName.toUpperCase().replace(/\s+/g, ' ').trim();
  const nameOk =
    (compact.includes('MARCHE') && compact.includes('AMBULANT')) ||
    /march[eé]\s*ambulant/i.test(shopName.trim());
  if (!nameOk) return false;
  if (Number(config.interval) !== 15) return false;
  const slots = config.timeSlots;
  if (slots[0] !== '05:00') return false;
  const i8 = slots.indexOf('08:00');
  if (i8 < 0 || slots[i8 + 1] !== '08:15') return false;
  if (config.mixedSlotProfile === 'marcheAmbulant') return false;
  return true;
}

export const generateTimeSlots = (startTime, endTime, interval) => {
    const slots = [];
    const referenceDate = new Date(2025, 0, 1); // Date de référence : 1er janvier 2025
    let current = parse(startTime, 'HH:mm', referenceDate);
    const normalizedEnd = endTime === '24:00' ? '23:59' : endTime;
    const end = ['00:00', '01:00', '02:00', '03:00'].includes(normalizedEnd)
        ? parse(normalizedEnd === '00:00' ? '00:00' : normalizedEnd, 'HH:mm', new Date(2025, 0, 2))
        : parse(normalizedEnd, 'HH:mm', referenceDate);

    while (current < end) {
        const next = addMinutes(current, interval);
        slots.push({
            start: format(current, 'HH:mm'),
            end: format(next, 'HH:mm'),
        });
        current = next;
    }

    return slots;
};