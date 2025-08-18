import { parse, addMinutes, format } from 'date-fns';

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