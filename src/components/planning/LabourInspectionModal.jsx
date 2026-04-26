import React, { useEffect, useMemo, useState } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
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

const getRanges = (slots, timeSlots = [], interval = 30) => {
  if (!Array.isArray(slots) || !Array.isArray(timeSlots) || !timeSlots.length) return [];
  const ranges = [];
  let startIdx = null;
  for (let i = 0; i < slots.length; i += 1) {
    const selected = normalizeSlot(slots[i]);
    if (selected && startIdx === null) startIdx = i;
    if (!selected && startIdx !== null) {
      const start = timeSlots[startIdx];
      const endBase = timeSlots[Math.max(0, i - 1)];
      if (start && endBase) {
        const [eh, em] = String(endBase).split(':').map((n) => Number.parseInt(n, 10) || 0);
        const endDate = new Date(2000, 0, 1, eh, em + interval, 0);
        ranges.push(`${start}-${format(endDate, 'HH:mm')}`);
      }
      startIdx = null;
    }
  }
  if (startIdx !== null) {
    const start = timeSlots[startIdx];
    const endBase = timeSlots[Math.max(0, Math.min(timeSlots.length, slots.length) - 1)];
    if (start && endBase) {
      const [eh, em] = String(endBase).split(':').map((n) => Number.parseInt(n, 10) || 0);
      const endDate = new Date(2000, 0, 1, eh, em + interval, 0);
      ranges.push(`${start}-${format(endDate, 'HH:mm')}`);
    }
  }
  return ranges;
};

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

  const shop = useMemo(
    () => planningData?.shops?.find((entry) => entry.id === selectedShop) || null,
    [planningData, selectedShop]
  );

  const weekDays = useMemo(() => {
    if (!selectedWeek) return [];
    const base = parseISO(selectedWeek);
    return Array.from({ length: 7 }, (_, idx) => addDays(base, idx));
  }, [selectedWeek]);

  const scheduleRows = useMemo(() => {
    if (!shop || !selectedWeek) return [];
    const week = shop.weeks?.[selectedWeek];
    const persistedPlanning = week?.planning || {};
    const planning = currentPlanning && Object.keys(currentPlanning).length ? currentPlanning : persistedPlanning;
    const sourceEmployees = Array.isArray(activeEmployees) && activeEmployees.length
      ? activeEmployees
      : (shop.employees || []);
    const employees = sourceEmployees.filter((emp, idx, arr) => {
      const id = emp?.id || `fallback_${idx}`;
      return arr.findIndex((x) => (x?.id || '') === id) === idx;
    });
    const interval = currentConfig?.interval || shop.config?.interval || 30;
    const timeSlots = currentConfig?.timeSlots || shop.config?.timeSlots || [];

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
        cells: []
      };
      weekDays.forEach((dayDate) => {
        const dayKey = format(dayDate, 'yyyy-MM-dd');
        const dayValue = planning?.[employee.id]?.[dayKey];
        if (typeof dayValue === 'string') {
          if (/cong[eé]/i.test(dayValue)) {
            row.cells.push('Congé');
          } else if (/maladie/i.test(dayValue)) {
            row.cells.push('Maladie');
          } else {
            row.cells.push(dayValue);
          }
        } else if (Array.isArray(dayValue) && dayValue.some(normalizeSlot)) {
          const ranges = getRanges(dayValue, timeSlots, interval);
          row.cells.push(ranges.length ? ranges.join(', ') : 'Repos');
        } else {
          row.cells.push('Repos');
        }
      });
      return row;
    });
  }, [
    shop,
    selectedWeek,
    weekDays,
    currentPlanning,
    currentConfig,
    activeEmployees,
    contractDataByEmployee,
    planningData
  ]);

  useEffect(() => {
    if (!isOpen || !selectedShop) return;
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

      setMeta({
        ...defaultMeta(shop?.name || selectedShop),
        ...(parsed || {}),
        raisonSociale: RAISON_SOCIALE_FIXE,
        siret: getSiretForShop(shop, selectedShop),
        activite: ACTIVITE_FIXE,
        boutiqueAffichee: shop?.name || selectedShop
      });
    } catch {
      setMeta(defaultMeta(shop?.name || selectedShop));
    }
  }, [isOpen, selectedShop, shop, savedMetaByShop]);

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
      alert('✅ Mentions enregistrees pour cette boutique.');
    } catch (error) {
      console.error('Erreur sauvegarde mentions inspection:', error);
      alert('❌ Impossible d enregistrer les mentions.');
    }
  };

  const labelTypeContrat = (id) => CONTRAT_TYPES.find((t) => t.id === id)?.label || id || '—';

  const printSheet = () => {
    const rowsHtml = scheduleRows
      .map((row) => {
        const dayCells = row.cells.map((cell) => `<td>${cell}</td>`).join('');
        const duration = formatContractDuration(row.entryDate);
        return `<tr><td><b>${row.employeeName}</b></td><td>${row.entryDate || '-'}</td><td>${labelTypeContrat(row.typeContrat)}</td><td>${row.contractHours || '-'}</td><td>${duration}</td>${dayCells}</tr>`;
      })
      .join('');
    const dayHeaders = weekDays
      .map((dayDate) => `<th>${format(dayDate, 'EEE dd/MM', { locale: fr })}</th>`)
      .join('');
    const html = `
      <html><head><title>Affichage inspection travail</title>
      <style>
      body{font-family:Arial,sans-serif;padding:18px;color:#111;}
      h1,h2{margin:0 0 10px 0;}
      .meta{margin:6px 0;}
      table{width:100%;border-collapse:collapse;margin-top:16px;font-size:12px;}
      th,td{border:1px solid #333;padding:6px;vertical-align:top;}
      th{background:#f1f3f5}
      </style></head><body>
      <h1>Affichage des horaires - Inspection du travail</h1>
      <div class="meta"><b>Boutique:</b> ${meta.boutiqueAffichee || '-'}</div>
      <div class="meta"><b>Raison sociale:</b> ${RAISON_SOCIALE_FIXE}</div>
      <div class="meta"><b>Adresse etablissement:</b> ${meta.adresseEtablissement || '-'}</div>
      <div class="meta"><b>SIRET:</b> ${getSiretForShop(shop, selectedShop)}</div>
      <div class="meta"><b>Activite (NAF/APE):</b> ${ACTIVITE_FIXE}</div>
      <div class="meta"><b>Convention collective:</b> ${meta.conventionCollective || '-'}</div>
      <div class="meta"><b>Responsable:</b> ${meta.responsable || '-'}</div>
      <div class="meta"><b>Semaine affichee:</b> ${selectedWeek || '-'}</div>
      <div class="meta"><b>Horaires collectifs de reference:</b> ${meta.horairesCollectifs || '-'}</div>
      <div class="meta"><b>Pause / coupure collective:</b> ${meta.pauseCollective || '-'}</div>
      <div class="meta"><b>Date d affichage / publication:</b> ${meta.datePublication || '-'}</div>
      <div class="meta"><b>Heure d edition (affichage):</b> ${meta.heureEdition || '-'}</div>
      <div class="meta"><b>Inspection du travail:</b> ${meta.inspecteurTravail || '-'}</div>
      <div class="meta"><b>Medecine du travail:</b> ${meta.medecineTravail || '-'}</div>
      <div class="meta"><b>Secours urgence:</b> ${meta.secoursUrgence || '-'}</div>
      <div class="meta"><b>Date/signature employeur:</b> ${meta.dateSignature || '-'}</div>
      <div class="meta"><i>Document d affichage collectif date et signe par l employeur.</i></div>
      <table>
      <thead><tr><th>Employe</th><th>Date entree</th><th>Type de contrat</th><th>Heures contrat</th><th>Duree contrat</th>${dayHeaders}</tr></thead>
      <tbody>${rowsHtml}</tbody>
      </table>
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
    doc.setFontSize(14);
    doc.text('Affichage des horaires - Inspection du travail', 14, 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Boutique: ${meta.boutiqueAffichee || '-'}`, 14, 18);
    doc.text(`Raison sociale: ${RAISON_SOCIALE_FIXE}`, 14, 23);
    doc.text(`Adresse: ${meta.adresseEtablissement || '-'}`, 14, 28);
    doc.text(`SIRET: ${getSiretForShop(shop, selectedShop)} | Activite: ${ACTIVITE_FIXE}`, 14, 33);
    doc.text(`Convention: ${meta.conventionCollective || '-'} | Responsable: ${meta.responsable || '-'}`, 14, 38);
    doc.text(`Horaires collectifs: ${meta.horairesCollectifs || '-'} | Pause: ${meta.pauseCollective || '-'}`, 14, 43);
    doc.text(`Date affichage: ${meta.datePublication || '-'} | Heure edition: ${meta.heureEdition || '-'} | Signatures: ${meta.dateSignature || '-'}`, 14, 48);
    doc.text(`Inspection: ${meta.inspecteurTravail || '-'} | Medecine: ${meta.medecineTravail || '-'}`, 14, 53);
    doc.text(`Secours: ${meta.secoursUrgence || '-'} | Semaine: ${selectedWeek || '-'}`, 14, 58);

    const head = [['Employe', 'Date entree', 'Type contrat', 'Heures contrat', 'Duree contrat', ...weekDays.map((dayDate) => format(dayDate, 'EEE dd/MM', { locale: fr }))]];
    const body = scheduleRows.map((row) => [
      row.employeeName,
      row.entryDate || '-',
      labelTypeContrat(row.typeContrat),
      row.contractHours || '-',
      row.contractDuration,
      ...row.cells
    ]);

    doc.autoTable({
      startY: 63,
      head,
      body,
      styles: { fontSize: 8, cellPadding: 1.6 },
      headStyles: { fillColor: [33, 37, 41], textColor: [255, 255, 255] }
    });

    doc.save(`inspection_travail_${selectedShop}_${selectedWeek}.pdf`);
  };

  const field = (key, label) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px' }}>
      <span style={{ fontWeight: 700 }}>{label}</span>
      <input
        type="text"
        value={meta[key] || ''}
        onChange={(event) => setMeta((prev) => ({ ...prev, [key]: event.target.value }))}
        style={{ border: '1px solid #cfd8dc', borderRadius: '6px', padding: '8px 10px' }}
      />
    </label>
  );

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

        <div style={{ padding: '12px 14px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', borderBottom: '1px solid #e0e0e0' }}>
          {field('adresseEtablissement', 'Adresse etablissement')}
          {field('conventionCollective', 'Convention collective (remplir une fois, mémorisé par boutique)')}
          {field('responsable', 'Responsable')}
          {field('boutiqueAffichee', 'Boutique affichee')}
          {field('inspecteurTravail', 'Inspection du travail (nom/contact)')}
          {field('medecineTravail', 'Medecine du travail (contact)')}
          {field('secoursUrgence', 'Secours urgence (15/18/112 + consignes)')}
          {field('horairesCollectifs', 'Horaires collectifs de reference')}
          {field('pauseCollective', 'Pause/coupure collective')}
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

        <div style={{ padding: '10px 14px', overflow: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead style={{ position: 'sticky', top: 0, background: '#eceff1' }}>
              <tr>
                <th style={{ border: '1px solid #cfd8dc', padding: '8px' }}>Employe</th>
                <th style={{ border: '1px solid #cfd8dc', padding: '8px' }}>Date entree</th>
                <th style={{ border: '1px solid #cfd8dc', padding: '8px' }}>Type de contrat</th>
                <th style={{ border: '1px solid #cfd8dc', padding: '8px' }}>Heures contrat</th>
                <th style={{ border: '1px solid #cfd8dc', padding: '8px' }}>Duree contrat</th>
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
