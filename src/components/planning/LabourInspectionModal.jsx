import React, { useEffect, useMemo, useRef, useState } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { buildSlotRangeLines, sumSelectedSlotsMinutes } from '../../utils/slotDurationUtils';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const STORAGE_PREFIX = 'labour_inspection_meta_v1_';
const STORAGE_MAP_KEY = 'labour_inspection_meta_by_shop_v2';

const normalizeKey = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const buildShopKeys = (selectedShop, shop) => {
  const keys = [];
  const id = String(selectedShop || shop?.id || '').trim();
  const name = String(shop?.name || '').trim();
  const normalizedId = normalizeKey(id);
  const normalizedName = normalizeKey(name);
  if (id) keys.push(`id:${id}`);
  if (name) keys.push(`name:${name}`);
  if (normalizedId) keys.push(`nid:${normalizedId}`);
  if (normalizedName) keys.push(`nname:${normalizedName}`);
  return Array.from(new Set(keys));
};

const readMetaMap = () => {
  try {
    const raw = localStorage.getItem(STORAGE_MAP_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const writeMetaMap = (metaMap) => {
  localStorage.setItem(STORAGE_MAP_KEY, JSON.stringify(metaMap || {}));
};

const normalizeSlot = (value) => value === true || value === 1 || value === '1' || value === 'true';

const REPOS_LABEL = 'Repos';
const EXTERIEUR_LABEL = 'Extérieur';

const RAISON_SOCIALE_FIXE = 'Relais des coches boutique';
const ACTIVITE_FIXE = 'Commerce de détail de boissons en magasin spécialisé - 4725Z';
const SIRET_DEFAUT = '81853491900019';
const SIRET_CANNES = '81853491900076';

const isCannesShop = (shop, selectedShopId) => {
  const name = String(shop?.name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const id = String(selectedShopId || shop?.id || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return name.includes('cannes') || id.includes('cannes');
};

const getSiretForShop = (shop, selectedShopId) =>
  isCannesShop(shop, selectedShopId) ? SIRET_CANNES : SIRET_DEFAUT;

const normalizeShopId = (shop, selectedShopId) =>
  String(selectedShopId || shop?.id || shop?.name || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const VAR_INSPECTION_CONTACT =
  'DDETS du Var - Inspection du travail - 177 boulevard Docteur Charles Barnier, 83070 Toulon Cedex - 04 94 09 64 00 - ddets-uc3@var.gouv.fr (section à confirmer selon adresse)';

const ALPES_MARITIMES_INSPECTION_CONTACT =
  "DDETS des Alpes-Maritimes - Inspection du travail - Immeuble Porte de l'Arenas, 455 promenade des Anglais, CS 43311, 06206 Nice Cedex 3 - 04 93 72 76 00";

const COMMON_CONVENTION =
  'Convention collective nationale des commerces de gros - IDCC 2216';

const PREVIOUS_DEFAULT_CONVENTIONS = [
  'Convention collective nationale des vins, cidres, jus de fruits, sirops, spiritueux et liqueurs de France - IDCC 493 / Brochure 3029 (à confirmer avec le bulletin de paie)',
  'Convention collective nationale des métiers du commerce de détail alimentaire spécialisé - IDCC 3237 (à confirmer avec le bulletin de paie)'
];

const COMMON_SECOURS =
  'Urgence européenne : 112 - SAMU : 15 - Pompiers : 18 - Police/Gendarmerie : 17 - SMS urgence : 114. En cas d accident : protéger, alerter, secourir.';

const SHOP_INSPECTION_DEFAULTS = {
  PORT_GRIMAUD: {
    adresseEtablissement: '14 Place du Marché, Port Grimaud, 83310 Grimaud',
    medecineTravail:
      'Odalia Santé (ex AIST 83) - Centre de Cogolin, 64 rue Carnot, 83310 Cogolin - www.odaliasante.fr'
  },
  CAVALAIRE: {
    adresseEtablissement: '',
    medecineTravail:
      'Odalia Santé (ex AIST 83) - Centre de Cavalaire, Résidence Le Turquoise, 25 rue Alphonse Daudet, 83240 Cavalaire-sur-Mer - www.odaliasante.fr'
  },
  SAINT_TROPEZ: {
    adresseEtablissement: '9 rue Général Allard, 83990 Saint-Tropez',
    medecineTravail:
      'Odalia Santé (ex AIST 83) - Centre de Saint-Tropez, Espace des Lices, 7 boulevard Louis Blanc, 83990 Saint-Tropez - www.odaliasante.fr'
  },
  SAINTE_MAXIME: {
    adresseEtablissement: '98 avenue Charles de Gaulle, 83120 Sainte-Maxime',
    medecineTravail:
      'Odalia Santé (ex AIST 83) - Centre de Sainte-Maxime, 185 route du Plan de la Tour, Immeuble Le Mathias 1, 83120 Sainte-Maxime - www.odaliasante.fr'
  },
  CANNES: {
    adresseEtablissement: '',
    inspecteurTravail: ALPES_MARITIMES_INSPECTION_CONTACT,
    medecineTravail:
      'AMETRA06 - Service de prévention et de santé au travail - Centre Cannes Maria, 4 place du Commandant Maria, 06400 Cannes - 04 97 06 93 06'
  }
};

export const getDefaultInspectionMetaForShop = (shop, selectedShopId, referenceDate = new Date()) => {
  const shopId = normalizeShopId(shop, selectedShopId);
  const shopDefaults = SHOP_INSPECTION_DEFAULTS[shopId] || {};
  const shopName = shop?.name || selectedShopId || '';

  return {
    raisonSociale: RAISON_SOCIALE_FIXE,
    adresseEtablissement: shopDefaults.adresseEtablissement || '',
    siret: getSiretForShop(shop, selectedShopId),
    activite: ACTIVITE_FIXE,
    conventionCollective: COMMON_CONVENTION,
    responsable: 'Angélique',
    inspecteurTravail: shopDefaults.inspecteurTravail || VAR_INSPECTION_CONTACT,
    medecineTravail: shopDefaults.medecineTravail || '',
    secoursUrgence: COMMON_SECOURS,
    horairesCollectifs: 'Horaires individualisés selon planning hebdomadaire affiché ci-dessous',
    pauseCollective: 'Pause/coupure selon planning affiché. Pause minimale de 20 minutes dès 6 heures de travail effectif.',
    datePublication: format(referenceDate, 'yyyy-MM-dd'),
    heureEdition: format(referenceDate, 'HH:mm'),
    dateSignature: '',
    boutiqueAffichee: shopName
  };
};

export const mergeInspectionMetaDefaults = (defaults, savedMeta = {}) => {
  const merged = { ...defaults };
  Object.keys(savedMeta || {}).forEach((key) => {
    if (key === 'selectedEmployeeIds') {
      merged[key] = savedMeta[key];
      return;
    }
    if (key === 'conventionCollective' && PREVIOUS_DEFAULT_CONVENTIONS.includes(savedMeta[key])) {
      return;
    }
    if (savedMeta[key] !== undefined && savedMeta[key] !== null && savedMeta[key] !== '') {
      merged[key] = savedMeta[key];
    }
  });
  return merged;
};

const CONTRAT_TYPES = [
  { id: 'cdi_35', label: 'CDI — 35 h / semaine', hours: 35 },
  { id: 'cdi_39', label: 'CDI — 39 h / semaine', hours: 39 },
  { id: 'cdd_35', label: 'CDD — 35 h / semaine', hours: 35 },
  { id: 'tp_30', label: 'Temps partiel — 30 h / semaine', hours: 30 },
  { id: 'tp_24', label: 'Temps partiel — 24 h / semaine', hours: 24 },
  { id: 'tp_20', label: 'Temps partiel — 20 h / semaine', hours: 20 },
  { id: 'autre', label: 'Autre (saisir les heures ci-dessous)', hours: null }
];

const hoursForTypeContrat = (typeId) => {
  const found = CONTRAT_TYPES.find((t) => t.id === typeId);
  return found && found.hours != null ? String(found.hours) : '';
};

const defaultMeta = (shopName = '') => ({
  raisonSociale: RAISON_SOCIALE_FIXE,
  adresseEtablissement: '',
  siret: SIRET_DEFAUT,
  activite: ACTIVITE_FIXE,
  conventionCollective: '',
  responsable: '',
  inspecteurTravail: '',
  medecineTravail: '',
  secoursUrgence: '',
  horairesCollectifs: '',
  pauseCollective: '',
  datePublication: '',
  heureEdition: '',
  dateSignature: '',
  boutiqueAffichee: shopName
});

const toDateInputValue = (value) => {
  if (!value) return '';
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  return format(parsed, 'yyyy-MM-dd');
};

const formatContractDuration = (entryDateValue, referenceDate = new Date()) => {
  const input = toDateInputValue(entryDateValue);
  if (!input) return '-';
  const start = parseISO(input);
  if (Number.isNaN(start.getTime())) return '-';
  const ref = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const begin = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  if (begin > ref) return '0 jour';

  let years = ref.getFullYear() - begin.getFullYear();
  let months = ref.getMonth() - begin.getMonth();
  let days = ref.getDate() - begin.getDate();

  if (days < 0) {
    const prevMonthDays = new Date(ref.getFullYear(), ref.getMonth(), 0).getDate();
    days += prevMonthDays;
    months -= 1;
  }
  if (months < 0) {
    months += 12;
    years -= 1;
  }

  const parts = [];
  if (years > 0) parts.push(`${years} an${years > 1 ? 's' : ''}`);
  if (months > 0) parts.push(`${months} mois`);
  if (days > 0 || !parts.length) parts.push(`${days} jour${days > 1 ? 's' : ''}`);
  return parts.join(' ');
};

const getCanonicalContractFields = (planningData, employee) => {
  if (!employee?.id || !planningData?.shops) {
    return {
      dateEntree: toDateInputValue(employee?.dateEntree),
      typeContrat: employee?.typeContrat || '',
      contratHours: employee?.contratHours ?? ''
    };
  }
  const id = employee.id;
  const shops = planningData.shops;
  const mainShop = employee.mainShop ? shops.find((s) => s.id === employee.mainShop) : null;
  const fromMain = mainShop?.employees?.find((e) => e.id === id);
  if (fromMain) {
    return {
      dateEntree:
        toDateInputValue(fromMain.dateEntree) ||
        toDateInputValue(employee?.dateEntree) ||
        '',
      typeContrat: fromMain.typeContrat || employee?.typeContrat || '',
      contratHours: fromMain.contratHours ?? employee?.contratHours ?? ''
    };
  }
  let merged = { dateEntree: '', typeContrat: '', contratHours: '' };
  for (const s of shops) {
    const e = s.employees?.find((x) => x.id === id);
    if (!e) continue;
    if (e.dateEntree) merged.dateEntree = toDateInputValue(e.dateEntree);
    if (e.typeContrat) merged.typeContrat = e.typeContrat;
    if (e.contratHours != null && e.contratHours !== '') merged.contratHours = e.contratHours;
  }
  return {
    dateEntree: merged.dateEntree || toDateInputValue(employee?.dateEntree) || '',
    typeContrat: merged.typeContrat || employee?.typeContrat || '',
    contratHours: merged.contratHours || employee?.contratHours || ''
  };
};

const getShopPlanningForDay = (shop, selectedWeek, employeeId, dayKey) =>
  shop?.weeks?.[selectedWeek]?.planning?.[employeeId]?.[dayKey];

const hasWorkedSlots = (dayValue) => Array.isArray(dayValue) && dayValue.some(normalizeSlot);

const formatMinutesAsHours = (minutes) => {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (mins === 0) return `${hours} h`;
  return `${hours} h ${String(mins).padStart(2, '0')}`;
};

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const worksInAnotherShop = (planningData, selectedShop, selectedWeek, employeeId, dayKey) => {
  if (!planningData?.shops || !selectedWeek || !employeeId || !dayKey) return false;
  return planningData.shops.some((otherShop) => {
    if (!otherShop || otherShop.id === selectedShop) return false;
    const otherDayValue = getShopPlanningForDay(otherShop, selectedWeek, employeeId, dayKey);
    return hasWorkedSlots(otherDayValue);
  });
};

const dedupeEmployees = (employees) => {
  const seen = new Set();
  return (employees || []).filter((emp, idx) => {
    const id = emp?.id || `fallback_${idx}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

const LabourInspectionModal = ({
  isOpen,
  onClose,
  planningData,
  selectedShop,
  selectedWeek,
  currentPlanning = {},
  currentConfig = {},
  activeEmployees = [],
  savedMetaByShop = {},
  onSaveMeta,
  onSaveEmployeeContractData
}) => {
  const [meta, setMeta] = useState(defaultMeta(''));
  const [contractDataByEmployee, setContractDataByEmployee] = useState({});
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState(null);
  const metaHydrationKeyRef = useRef('');

  const shop = useMemo(
    () => planningData?.shops?.find((entry) => entry.id === selectedShop) || null,
    [planningData, selectedShop]
  );

  const weekDays = useMemo(() => {
    if (!selectedWeek) return [];
    const base = parseISO(selectedWeek);
    return Array.from({ length: 7 }, (_, idx) => addDays(base, idx));
  }, [selectedWeek]);

  const employeeChoices = useMemo(() => {
    const sourceEmployees = Array.isArray(activeEmployees) && activeEmployees.length
      ? activeEmployees
      : (shop?.employees || []);
    return dedupeEmployees(sourceEmployees);
  }, [activeEmployees, shop]);

  const scheduleRows = useMemo(() => {
    if (!shop || !selectedWeek) return [];
    const week = shop.weeks?.[selectedWeek];
    const persistedPlanning = week?.planning || {};
    const planning = currentPlanning && Object.keys(currentPlanning).length ? currentPlanning : persistedPlanning;
    const selectedSet = Array.isArray(selectedEmployeeIds) ? new Set(selectedEmployeeIds) : null;
    const employees = selectedSet
      ? employeeChoices.filter((employee) => selectedSet.has(employee.id))
      : employeeChoices;
    const interval = currentConfig?.interval || shop.config?.interval || 30;
    const endTime = currentConfig?.endTime ?? shop.config?.endTime;
    const timeSlots = currentConfig?.timeSlots || shop.config?.timeSlots || [];
    const slotDurationCfg = { interval, endTime };

    return employees.map((employee) => {
      const canonical = getCanonicalContractFields(planningData, employee);
      const payload = contractDataByEmployee?.[employee.id] || {};
      const customEntryDate = toDateInputValue(payload?.dateEntree);
      const customType = payload?.typeContrat;
      const customHours = payload?.contratHours;
      const entryDate = customEntryDate || canonical.dateEntree || '';
      const typeContrat =
        customType !== undefined && customType !== null ? customType : canonical.typeContrat || '';
      let contractHours;
      if (typeContrat && typeContrat !== 'autre') {
        const h = hoursForTypeContrat(typeContrat);
        contractHours = h || String(customHours ?? canonical.contratHours ?? '');
      } else {
        contractHours =
          customHours !== undefined && customHours !== null && customHours !== ''
            ? String(customHours)
            : String(canonical.contratHours || '');
      }
      const row = {
        employeeId: employee.id,
        employeeName: employee.name || employee.id,
        entryDate,
        typeContrat: typeContrat || '',
        contractHours,
        contractDuration: formatContractDuration(entryDate),
        weeklyMinutes: 0,
        weeklyHoursLabel: '0 h',
        cells: []
      };
      weekDays.forEach((dayDate) => {
        const dayKey = format(dayDate, 'yyyy-MM-dd');
        const dayValue = planning?.[employee.id]?.[dayKey];
        const hasExternalWork = worksInAnotherShop(planningData, selectedShop, selectedWeek, employee.id, dayKey);
        if (typeof dayValue === 'string') {
          if (/maladie/i.test(dayValue)) {
            row.cells.push('Maladie');
          } else if (hasExternalWork) {
            row.cells.push(EXTERIEUR_LABEL);
          } else if (/cong[eé]/i.test(dayValue)) {
            row.cells.push(REPOS_LABEL);
          } else {
            row.cells.push(dayValue);
          }
        } else if (hasWorkedSlots(dayValue)) {
          const ranges = buildSlotRangeLines(dayValue, timeSlots, slotDurationCfg);
          row.weeklyMinutes += sumSelectedSlotsMinutes(dayValue, timeSlots, slotDurationCfg);
          row.cells.push(ranges.length ? ranges.join(', ') : REPOS_LABEL);
        } else if (hasExternalWork) {
          row.cells.push(EXTERIEUR_LABEL);
        } else {
          row.cells.push(REPOS_LABEL);
        }
      });
      row.weeklyHoursLabel = formatMinutesAsHours(row.weeklyMinutes);
      return row;
    });
  }, [
    shop,
    selectedShop,
    selectedWeek,
    weekDays,
    currentPlanning,
    currentConfig,
    employeeChoices,
    selectedEmployeeIds,
    contractDataByEmployee,
    planningData
  ]);

  useEffect(() => {
    if (!isOpen || !selectedShop) return;
    const employeeKey = employeeChoices.map((employee) => employee.id).filter(Boolean).join('|');
    const hydrationKey = `${selectedShop}:${shop?.name || ''}:${employeeKey}`;
    if (metaHydrationKeyRef.current === hydrationKey) return;
    metaHydrationKeyRef.current = hydrationKey;
    const dataMeta = savedMetaByShop?.[selectedShop] || null;
    const shopKeys = buildShopKeys(selectedShop, shop);
    const metaMap = readMetaMap();
    try {
      let parsed = dataMeta;

      if (!parsed) {
        for (const key of shopKeys) {
          if (metaMap[key]) {
            parsed = metaMap[key];
            break;
          }
        }
      }

      if (!parsed) {
        const oldRaw = localStorage.getItem(`${STORAGE_PREFIX}${selectedShop}`);
        parsed = oldRaw ? JSON.parse(oldRaw) : null;
      }

      const defaults = getDefaultInspectionMetaForShop(shop, selectedShop);
      setMeta(mergeInspectionMetaDefaults(defaults, parsed || {}));
      setSelectedEmployeeIds(
        Array.isArray(parsed?.selectedEmployeeIds)
          ? parsed.selectedEmployeeIds
          : employeeChoices.map((employee) => employee.id).filter(Boolean)
      );
    } catch {
      setMeta(getDefaultInspectionMetaForShop(shop, selectedShop));
      setSelectedEmployeeIds(employeeChoices.map((employee) => employee.id).filter(Boolean));
    }
  }, [isOpen, selectedShop, shop, savedMetaByShop, employeeChoices]);

  useEffect(() => {
    if (!isOpen) {
      metaHydrationKeyRef.current = '';
      setSelectedEmployeeIds(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const sourceEmployees = Array.isArray(activeEmployees) && activeEmployees.length
      ? activeEmployees
      : (shop?.employees || []);
    const next = {};
    sourceEmployees.forEach((emp) => {
      if (emp?.id) {
        const c = getCanonicalContractFields(planningData, emp);
        next[emp.id] = {
          dateEntree: c.dateEntree,
          typeContrat: c.typeContrat || '',
          contratHours: c.contratHours
        };
      }
    });
    setContractDataByEmployee(next);
  }, [isOpen, activeEmployees, shop, planningData]);

  if (!isOpen) return null;

  const saveMeta = () => {
    try {
      const shopKeys = buildShopKeys(selectedShop, shop);
      const metaMap = readMetaMap();
      const payload = {
        ...meta,
        selectedEmployeeIds: Array.isArray(selectedEmployeeIds) ? selectedEmployeeIds : [],
        raisonSociale: RAISON_SOCIALE_FIXE,
        siret: getSiretForShop(shop, selectedShop),
        activite: ACTIVITE_FIXE,
        boutiqueAffichee: shop?.name || selectedShop
      };
      shopKeys.forEach((key) => {
        metaMap[key] = payload;
      });
      writeMetaMap(metaMap);
      // Compatibilite ancien format
      localStorage.setItem(`${STORAGE_PREFIX}${selectedShop}`, JSON.stringify(payload));
      if (typeof onSaveMeta === 'function') {
        onSaveMeta(selectedShop, shop?.name || selectedShop, payload);
      }
      if (typeof onSaveEmployeeContractData === 'function') {
        onSaveEmployeeContractData(selectedShop, contractDataByEmployee);
      }
      alert('✅ Mentions et employés sélectionnés enregistrés pour cette boutique.');
    } catch (error) {
      console.error('Erreur sauvegarde mentions inspection:', error);
      alert('❌ Impossible d enregistrer les mentions.');
    }
  };

  const labelTypeContrat = (id) => CONTRAT_TYPES.find((t) => t.id === id)?.label || id || '—';

  const printSheet = () => {
    const metaRows = [
      ['Boutique', meta.boutiqueAffichee || '-'],
      ['Raison sociale', RAISON_SOCIALE_FIXE],
      ['Adresse établissement', meta.adresseEtablissement || '-'],
      ['SIRET', getSiretForShop(shop, selectedShop)],
      ['Activité (NAF/APE)', ACTIVITE_FIXE],
      ['Convention collective', meta.conventionCollective || '-'],
      ['Responsable', meta.responsable || '-'],
      ['Semaine affichée', selectedWeek || '-'],
      ['Horaires collectifs de référence', meta.horairesCollectifs || '-'],
      ['Pause / coupure collective', meta.pauseCollective || '-'],
      ['Date d affichage / publication', meta.datePublication || '-'],
      ['Heure d édition', meta.heureEdition || '-'],
      ['Inspection du travail', meta.inspecteurTravail || '-'],
      ['Médecine du travail', meta.medecineTravail || '-'],
      ['Secours urgence', meta.secoursUrgence || '-'],
      ['Date/signature employeur', meta.dateSignature || '-']
    ];
    const rowsHtml = scheduleRows
      .map((row) => {
        const dayCells = row.cells.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('');
        const duration = formatContractDuration(row.entryDate);
        return `<tr><td><b>${escapeHtml(row.employeeName)}</b></td><td>${escapeHtml(row.entryDate || '-')}</td><td>${escapeHtml(labelTypeContrat(row.typeContrat))}</td><td>${escapeHtml(row.contractHours || '-')}</td><td>${escapeHtml(duration)}</td><td class="hours">${escapeHtml(row.weeklyHoursLabel)}</td>${dayCells}</tr>`;
      })
      .join('');
    const dayHeaders = weekDays
      .map((dayDate) => `<th>${escapeHtml(format(dayDate, 'EEE dd/MM', { locale: fr }))}</th>`)
      .join('');
    const metaRowsHtml = metaRows
      .map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`)
      .join('');
    const html = `
      <html><head><title>Affichage inspection travail</title>
      <style>
      @page{size:A4 landscape;margin:10mm;}
      *{box-sizing:border-box;}
      body{font-family:Arial,sans-serif;padding:0;color:#111;font-size:11px;}
      h1{margin:0 0 6px 0;font-size:18px;color:#0f4c81;}
      .subtitle{margin:0 0 10px 0;color:#455a64;}
      table{width:100%;border-collapse:collapse;}
      .meta-table{margin:8px 0 12px 0;font-size:10px;}
      .meta-table th{width:22%;text-align:left;background:#eaf2f8;color:#123;border:1px solid #b0bec5;padding:4px 6px;}
      .meta-table td{border:1px solid #b0bec5;padding:4px 6px;}
      .schedule{font-size:9px;table-layout:fixed;}
      .schedule th{background:#0f4c81;color:#fff;border:1px solid #345;padding:5px 4px;}
      .schedule td{border:1px solid #9e9e9e;padding:5px 4px;vertical-align:top;word-break:break-word;}
      .schedule tbody tr:nth-child(even){background:#f7fafc;}
      .hours{font-weight:bold;text-align:center;white-space:nowrap;}
      .footer{margin-top:10px;font-size:10px;color:#455a64;}
      </style></head><body>
      <h1>Affichage des horaires - Inspection du travail</h1>
      <p class="subtitle">Document d affichage collectif date et signe par l employeur.</p>
      <table class="meta-table"><tbody>${metaRowsHtml}</tbody></table>
      <table class="schedule">
      <thead><tr><th>Employe</th><th>Date entree</th><th>Type contrat</th><th>H contrat</th><th>Duree contrat</th><th>Heures semaine</th>${dayHeaders}</tr></thead>
      <tbody>${rowsHtml}</tbody>
      </table>
      <div class="footer">Repos = non planifie dans cette boutique. Exterieur = horaires planifies dans une autre boutique le meme jour.</div>
      </body></html>`;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  };

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(15, 76, 129);
    doc.text('Affichage des horaires - Inspection du travail', 14, 12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(8);
    doc.text('Document d affichage collectif date et signe par l employeur.', 14, 17);

    const metaBody = [
      ['Boutique', meta.boutiqueAffichee || '-', 'Semaine', selectedWeek || '-'],
      ['Raison sociale', RAISON_SOCIALE_FIXE, 'SIRET', getSiretForShop(shop, selectedShop)],
      ['Adresse', meta.adresseEtablissement || '-', 'Activite', ACTIVITE_FIXE],
      ['Convention', meta.conventionCollective || '-', 'Responsable', meta.responsable || '-'],
      ['Horaires collectifs', meta.horairesCollectifs || '-', 'Pause / coupure', meta.pauseCollective || '-'],
      ['Date affichage', meta.datePublication || '-', 'Heure edition', meta.heureEdition || '-'],
      ['Inspection du travail', meta.inspecteurTravail || '-', 'Medecine du travail', meta.medecineTravail || '-'],
      ['Secours urgence', meta.secoursUrgence || '-', 'Signature employeur', meta.dateSignature || '-']
    ];

    doc.autoTable({
      startY: 21,
      body: metaBody,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 1.2, overflow: 'linebreak', valign: 'top' },
      columnStyles: {
        0: { fontStyle: 'bold', fillColor: [234, 242, 248], cellWidth: 32 },
        1: { cellWidth: 88 },
        2: { fontStyle: 'bold', fillColor: [234, 242, 248], cellWidth: 30 },
        3: { cellWidth: 119 }
      },
      margin: { left: 14, right: 14 }
    });

    const head = [['Employe', 'Date entree', 'Type contrat', 'H contrat', 'Duree contrat', 'Heures semaine', ...weekDays.map((dayDate) => format(dayDate, 'EEE dd/MM', { locale: fr }))]];
    const body = scheduleRows.map((row) => [
      row.employeeName,
      row.entryDate || '-',
      labelTypeContrat(row.typeContrat),
      row.contractHours || '-',
      row.contractDuration,
      row.weeklyHoursLabel,
      ...row.cells
    ]);

    doc.autoTable({
      startY: (doc.lastAutoTable?.finalY || 60) + 5,
      head,
      body,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 1.2, overflow: 'linebreak', valign: 'top' },
      headStyles: { fillColor: [15, 76, 129], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [247, 250, 252] },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 24 },
        1: { cellWidth: 20 },
        2: { cellWidth: 34 },
        3: { cellWidth: 16, halign: 'center' },
        4: { cellWidth: 22 },
        5: { cellWidth: 20, halign: 'center', fontStyle: 'bold' }
      },
      margin: { left: 8, right: 8 },
      didDrawPage: () => {
        const pageHeight = doc.internal.pageSize.height;
        doc.setFontSize(7);
        doc.setTextColor(90, 90, 90);
        doc.text('Repos = non planifie dans cette boutique. Exterieur = horaires planifies dans une autre boutique le meme jour.', 8, pageHeight - 6);
      }
    });

    doc.save(`inspection_travail_${selectedShop}_${selectedWeek}.pdf`);
  };

  const field = (key, label, options = {}) => {
    const multiline = options.multiline || String(meta[key] || '').length > 45;
    return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px' }}>
      <span style={{ fontWeight: 700 }}>{label}</span>
      {multiline ? (
        <textarea
          value={meta[key] || ''}
          rows={options.rows || 2}
          onChange={(event) => setMeta((prev) => ({ ...prev, [key]: event.target.value }))}
          style={{
            border: '1px solid #cfd8dc',
            borderRadius: '6px',
            padding: '8px 10px',
            resize: 'vertical',
            minHeight: options.minHeight || '58px',
            lineHeight: 1.35
          }}
        />
      ) : (
        <input
          type="text"
          value={meta[key] || ''}
          onChange={(event) => setMeta((prev) => ({ ...prev, [key]: event.target.value }))}
          style={{ border: '1px solid #cfd8dc', borderRadius: '6px', padding: '8px 10px' }}
        />
      )}
    </label>
    );
  };

  const allEmployeeIds = employeeChoices.map((employee) => employee.id).filter(Boolean);
  const checkedEmployeeIds = Array.isArray(selectedEmployeeIds) ? selectedEmployeeIds : allEmployeeIds;
  const checkedEmployeeSet = new Set(checkedEmployeeIds);
  const allEmployeesChecked = allEmployeeIds.length > 0 && allEmployeeIds.every((id) => checkedEmployeeSet.has(id));

  const toggleEmployeeSelection = (employeeId) => {
    setSelectedEmployeeIds((prev) => {
      const current = new Set(Array.isArray(prev) ? prev : allEmployeeIds);
      if (current.has(employeeId)) {
        current.delete(employeeId);
      } else {
        current.add(employeeId);
      }
      return allEmployeeIds.filter((id) => current.has(id));
    });
  };

  const selectAllEmployees = () => setSelectedEmployeeIds(allEmployeeIds);
  const clearAllEmployees = () => setSelectedEmployeeIds([]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 70000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 'min(1500px, 98vw)',
          height: 'min(920px, 96vh)',
          background: '#fff',
          borderRadius: '10px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={{ padding: '12px 14px', background: '#0f4c81', color: '#fff', fontWeight: 700, fontSize: '18px' }}>
          🧾 Affichage Inspection du travail
        </div>

        <div
          style={{
            padding: '10px 14px',
            borderBottom: '1px solid #e0e0e0',
            background: '#f8fafc',
            fontSize: '13px',
            lineHeight: 1.5
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: '6px' }}>Entreprise (champs imposés, identiques partout)</div>
          <div>
            <b>Raison sociale :</b> {RAISON_SOCIALE_FIXE}
          </div>
          <div>
            <b>SIRET :</b> {getSiretForShop(shop, selectedShop)}
          </div>
          <div>
            <b>Activité (NAF/APE) :</b> {ACTIVITE_FIXE}
          </div>
        </div>

        <div style={{ padding: '12px 14px', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px', borderBottom: '1px solid #e0e0e0', maxHeight: '260px', overflow: 'auto' }}>
          {field('adresseEtablissement', 'Adresse etablissement')}
          {field('conventionCollective', 'Convention collective (remplir une fois, mémorisé par boutique)', { multiline: true })}
          {field('responsable', 'Responsable')}
          {field('boutiqueAffichee', 'Boutique affichee')}
          {field('inspecteurTravail', 'Inspection du travail (nom/contact)', { multiline: true })}
          {field('medecineTravail', 'Medecine du travail (contact)', { multiline: true })}
          {field('secoursUrgence', 'Secours urgence (15/18/112 + consignes)', { multiline: true })}
          {field('horairesCollectifs', 'Horaires collectifs de reference', { multiline: true })}
          {field('pauseCollective', 'Pause/coupure collective', { multiline: true })}
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px' }}>
            <span style={{ fontWeight: 700 }}>Date d affichage / publication (mémorisé)</span>
            <input
              type="date"
              value={toDateInputValue(meta.datePublication)}
              onChange={(event) => setMeta((prev) => ({ ...prev, datePublication: event.target.value }))}
              style={{ border: '1px solid #cfd8dc', borderRadius: '6px', padding: '8px 10px' }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px' }}>
            <span style={{ fontWeight: 700 }}>Heure d édition (mémorisée)</span>
            <input
              type="time"
              value={meta.heureEdition || ''}
              onChange={(event) => setMeta((prev) => ({ ...prev, heureEdition: event.target.value }))}
              style={{ border: '1px solid #cfd8dc', borderRadius: '6px', padding: '8px 10px' }}
            />
          </label>
          {field('dateSignature', 'Date et signature employeur')}
        </div>

        <div style={{ padding: '8px 14px', display: 'flex', gap: '8px', borderBottom: '1px solid #e0e0e0' }}>
          <button type="button" onClick={saveMeta}>💾 Enregistrer mentions</button>
          <button type="button" onClick={printSheet}>🖨️ Imprimer affichage</button>
          <button type="button" onClick={exportPdf}>📄 Exporter PDF</button>
          <button type="button" onClick={onClose}>Fermer</button>
        </div>

        <div style={{ padding: '10px 14px', borderBottom: '1px solid #e0e0e0', background: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginBottom: '8px' }}>
            <div>
              <div style={{ fontWeight: 700 }}>Employés à faire figurer sur l’affichage de cette boutique</div>
              <div style={{ fontSize: '12px', color: '#546e7a' }}>
                Coche uniquement les employés à imprimer/exporter pour {shop?.name || selectedShop}. Cette sélection est mémorisée par boutique avec le bouton Enregistrer.
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
              <button type="button" onClick={selectAllEmployees} disabled={allEmployeesChecked}>Tout cocher</button>
              <button type="button" onClick={clearAllEmployees} disabled={checkedEmployeeIds.length === 0}>Tout décocher</button>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {employeeChoices.map((employee) => (
              <label
                key={employee.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  border: '1px solid #cfd8dc',
                  borderRadius: '999px',
                  padding: '6px 10px',
                  background: checkedEmployeeSet.has(employee.id) ? '#e0f2fe' : '#fff',
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                <input
                  type="checkbox"
                  checked={checkedEmployeeSet.has(employee.id)}
                  onChange={() => toggleEmployeeSelection(employee.id)}
                />
                <span>{employee.name || employee.id}</span>
              </label>
            ))}
            {employeeChoices.length === 0 && (
              <span style={{ color: '#78909c', fontSize: '13px' }}>Aucun employé disponible pour cette boutique.</span>
            )}
          </div>
        </div>

        <div style={{ padding: '10px 14px', overflow: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead style={{ position: 'sticky', top: 0, background: '#eceff1' }}>
              <tr>
                <th style={{ border: '1px solid #cfd8dc', padding: '8px' }}>Employe</th>
                <th style={{ border: '1px solid #cfd8dc', padding: '8px' }}>Date entree</th>
                <th style={{ border: '1px solid #cfd8dc', padding: '8px' }}>Type de contrat</th>
                <th style={{ border: '1px solid #cfd8dc', padding: '8px' }}>Heures contrat</th>
                <th style={{ border: '1px solid #cfd8dc', padding: '8px' }}>Duree contrat</th>
                <th style={{ border: '1px solid #cfd8dc', padding: '8px', background: '#dbeafe' }}>Heures semaine</th>
                {weekDays.map((dayDate) => (
                  <th key={format(dayDate, 'yyyy-MM-dd')} style={{ border: '1px solid #cfd8dc', padding: '8px' }}>
                    {format(dayDate, 'EEEE dd/MM', { locale: fr })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scheduleRows.map((row) => (
                <tr key={row.employeeId}>
                  <td style={{ border: '1px solid #eceff1', padding: '8px', fontWeight: 700 }}>{row.employeeName}</td>
                  <td style={{ border: '1px solid #eceff1', padding: '8px' }}>
                    <input
                      type="date"
                      value={row.entryDate || ''}
                      onChange={(event) =>
                        setContractDataByEmployee((prev) => ({
                          ...prev,
                          [row.employeeId]: {
                            ...(prev[row.employeeId] || {}),
                            dateEntree: event.target.value
                          }
                        }))
                      }
                      style={{ border: '1px solid #cfd8dc', borderRadius: '6px', padding: '6px 8px', width: '150px' }}
                    />
                  </td>
                  <td style={{ border: '1px solid #eceff1', padding: '8px' }}>
                    <select
                      value={row.typeContrat || ''}
                      onChange={(event) => {
                        const v = event.target.value;
                        setContractDataByEmployee((prev) => {
                          const next = { ...(prev[row.employeeId] || {}), typeContrat: v };
                          if (v && v !== 'autre') {
                            const h = hoursForTypeContrat(v);
                            if (h) next.contratHours = h;
                          }
                          return { ...prev, [row.employeeId]: next };
                        });
                      }}
                      style={{ border: '1px solid #cfd8dc', borderRadius: '6px', padding: '6px 8px', maxWidth: '260px' }}
                    >
                      <option value="">—</option>
                      {CONTRAT_TYPES.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ border: '1px solid #eceff1', padding: '8px' }}>
                    {row.typeContrat === 'autre' ? (
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={row.contractHours}
                        onChange={(event) =>
                          setContractDataByEmployee((prev) => ({
                            ...prev,
                            [row.employeeId]: {
                              ...(prev[row.employeeId] || {}),
                              contratHours: event.target.value
                            }
                          }))
                        }
                        style={{ border: '1px solid #cfd8dc', borderRadius: '6px', padding: '6px 8px', width: '110px' }}
                      />
                    ) : (
                      <span style={{ fontWeight: 600 }}>{row.contractHours || '—'}</span>
                    )}
                  </td>
                  <td style={{ border: '1px solid #eceff1', padding: '8px', fontWeight: 600 }}>{row.contractDuration}</td>
                  <td style={{ border: '1px solid #eceff1', padding: '8px', fontWeight: 700, textAlign: 'center', background: '#eff6ff', whiteSpace: 'nowrap' }}>{row.weeklyHoursLabel}</td>
                  {row.cells.map((cell, idx) => (
                    <td key={`${row.employeeId}_${idx}`} style={{ border: '1px solid #eceff1', padding: '8px' }}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default LabourInspectionModal;
