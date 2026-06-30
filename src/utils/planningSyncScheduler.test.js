import { describe, it, expect, beforeEach } from 'vitest';
import {
  normalizeEmployeeNameToken,
  getEmployeeStoredNameVariants,
  employeeStoredNamesMatch,
  renameEmployeeInPlanningData
} from './planningDataManager.js';
import { __testing } from './planningSyncScheduler.js';

beforeEach(() => {
  __testing.resetSchedulerState();
});

const samplePlanningData = () => ({
  version: '2.0',
  shops: [
    {
      id: 'shop_a',
      name: 'Cannes',
      employees: [
        { id: 'emp_1', name: 'Valérie', canWorkIn: ['shop_a'] },
        { id: 'emp_2', name: 'Jean', canWorkIn: ['shop_a'] }
      ],
      weeks: {}
    },
    {
      id: 'shop_b',
      name: 'Tropez',
      employees: [
        { id: 'emp_1', name: 'VALEUR', canWorkIn: ['shop_b'] },
        { id: 'emp_2', name: 'Jean', canWorkIn: ['shop_b'] }
      ],
      weeks: {
        '2025-06-02': {
          planning: { emp_1: { '2025-06-02': [true, false] } },
          selectedEmployees: ['emp_1']
        }
      }
    }
  ]
});

describe('normalizeEmployeeNameToken', () => {
  it('retire les accents et la casse', () => {
    expect(normalizeEmployeeNameToken('Valérie')).toBe('VALERIE');
    expect(normalizeEmployeeNameToken('  élodie  ')).toBe('ELODIE');
  });

  it('retire espaces et ponctuation', () => {
    expect(normalizeEmployeeNameToken('Jean-Pierre')).toBe('JEANPIERRE');
  });
});

describe('employeeStoredNamesMatch', () => {
  it('retourne true si tous les noms stockés correspondent (accents ignorés)', () => {
    const data = samplePlanningData();
    expect(employeeStoredNamesMatch(data, 'emp_1', 'Valerie')).toBe(false);
    expect(employeeStoredNamesMatch(data, 'emp_2', 'Jean')).toBe(true);
  });

  it('retourne true quand le nom cible unifie les variantes', () => {
    const data = renameEmployeeInPlanningData(samplePlanningData(), 'emp_1', 'Valou');
    expect(employeeStoredNamesMatch(data, 'emp_1', 'Valou')).toBe(true);
  });
});

describe('renameEmployeeInPlanningData', () => {
  it('renomme un employé dans toutes les boutiques', () => {
    const renamed = renameEmployeeInPlanningData(samplePlanningData(), 'emp_1', 'Valou');
    expect(getEmployeeStoredNameVariants(renamed, 'emp_1')).toEqual(['Valou']);
  });
});

describe('planningSyncScheduler.extractWeekPayload', () => {
  it('extrait uniquement planning + selectedEmployees de la semaine', () => {
    const data = samplePlanningData();
    const payload = __testing.extractWeekPayload(data, 'shop_b', '2025-06-02');
    expect(payload).toEqual({
      planning: { emp_1: { '2025-06-02': [true, false] } },
      selectedEmployees: ['emp_1']
    });
  });

  it('retourne null si semaine absente', () => {
    expect(__testing.extractWeekPayload(samplePlanningData(), 'shop_a', '2025-06-02')).toBeNull();
  });
});
