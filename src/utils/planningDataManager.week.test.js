import { describe, it, expect } from 'vitest';
import { saveWeekPlanning, createEmployeeId } from './planningDataManager.js';

const basePlanningData = () => ({
  version: '2.0',
  shops: [
    {
      id: 'shop_a',
      name: 'Cannes',
      config: { interval: 30, timeSlots: ['09:00', '09:30'] },
      employees: [{ id: 'emp_1', name: 'Alice' }],
      weeks: {
        '2025-06-02': {
          planning: {
            emp_1: { '2025-06-02': [true, false] }
          },
          selectedEmployees: ['emp_1']
        }
      }
    }
  ]
});

describe('saveWeekPlanning', () => {
  it('fusionne un snapshot partiel sans écraser les autres employés', () => {
    const data = basePlanningData();
    const partial = {
      emp_2: { '2025-06-03': [true, true] }
    };

    const result = saveWeekPlanning(data, 'shop_a', '2025-06-02', partial, ['emp_1', 'emp_2']);

    const week = result.shops[0].weeks['2025-06-02'];
    expect(week.planning.emp_1['2025-06-02']).toEqual([true, false]);
    expect(week.planning.emp_2['2025-06-03']).toEqual([true, true]);
    expect(week.selectedEmployees).toContain('emp_1');
    expect(week.selectedEmployees).toContain('emp_2');
  });
});

describe('createEmployeeId', () => {
  it('génère des identifiants uniques', () => {
    const a = createEmployeeId();
    const b = createEmployeeId();
    expect(a).toMatch(/^emp_/);
    expect(b).toMatch(/^emp_/);
    expect(a).not.toBe(b);
  });
});
