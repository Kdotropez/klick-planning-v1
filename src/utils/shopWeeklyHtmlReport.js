import { format, parseISO, startOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  buildLandscapeHtmlDocument,
  deliverLandscapeHtmlExport,
  escapeHtml
} from './htmlLandscapeExport';
import {
  buildEmployeeDaySchedule,
  buildPresenceWeekDays,
  getDayColor
} from './presenceMapExport';
import { getSlotEndTimeFormatted } from './slotDurationUtils';
import {
  calculateEmployeeDailyHours,
  formatWorkedHoursForDisplay,
  formatWorkedHoursNbNotation
} from './planningUtils';
import { isEmployeeAssignedToShop, isEmployeeHidden } from './planningDataManager';

const normSlot = (v) => v === true || v === 1 || v === '1' || v === 'true';

const sanitizeFilePart = (value) =>
  String(value || 'boutique')
    .replace(/[^\w.-]+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 60);

const computeWorkTimes = (dayPlanning, config) => {
  const timeSlots = config?.timeSlots || [];
  if (typeof dayPlanning === 'string') {
    return { status: dayPlanning, entry: null, pause: null, returnTime: null, exit: null };
  }
  if (!Array.isArray(dayPlanning) || !timeSlots.length || dayPlanning.every((s) => !normSlot(s))) {
    return null;
  }
  const selected = [];
  for (let i = 0; i < dayPlanning.length; i += 1) {
    if (normSlot(dayPlanning[i]) && timeSlots[i]) {
      selected.push({ index: i, time: timeSlots[i] });
    }
  }
  if (!selected.length) return null;
  selected.sort((a, b) => a.index - b.index);
  const entry = selected[0].time;
  const lastIdx = selected[selected.length - 1].index;
  const exit = getSlotEndTimeFormatted(timeSlots, lastIdx, config);
  let pause = null;
  let returnTime = null;
  for (let i = 0; i < selected.length - 1; i += 1) {
    const cur = selected[i].index;
    const next = selected[i + 1].index;
    if (next > cur + 1) {
      pause = getSlotEndTimeFormatted(timeSlots, cur, config);
      returnTime = timeSlots[next];
      break;
    }
  }
  return { status: null, entry, pause, returnTime, exit };
};

const SHOP_REPORT_EXTRA_STYLES = `
  .shop-report .overview-table th.day-col { text-align: center; min-width: 72px; }
  .shop-report .overview-table td.day-cell { text-align: center; font-size: 12px; line-height: 1.35; }
  .shop-report .overview-table td.name-col { font-weight: 700; white-space: nowrap; }
  .shop-report .overview-table td.total-col { font-weight: 800; text-align: center; background: #ecfdf5 !important; }
  .shop-report .cell-work { color: #0f766e; font-weight: 600; }
  .shop-report .cell-conge { color: #b45309; font-weight: 600; }
  .shop-report .cell-maladie { color: #dc2626; font-weight: 600; }
  .shop-report .cell-repos { color: #94a3b8; }
  .shop-report .day-block {
    margin-top: 18px;
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid #e2e8f0;
  }
  .shop-report .day-block-header {
    padding: 10px 14px;
    font-weight: 800;
    font-size: 14px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px 16px;
    align-items: center;
  }
  .shop-report .day-block-header .badge {
    font-size: 12px;
    font-weight: 700;
    padding: 3px 10px;
    border-radius: 999px;
    background: rgba(255,255,255,0.65);
  }
  .shop-report .day-detail-table { margin: 0; min-width: 0 !important; width: 100% !important; }
  .shop-report .day-detail-table th { font-size: 12px; }
  .shop-report .day-detail-table td { font-size: 13px; }
  .shop-report .day-empty {
    padding: 12px 14px;
    color: #64748b;
    font-style: italic;
    background: #f8fafc;
  }
  .shop-report .team-strip {
    padding: 8px 14px 12px;
    background: #f8fafc;
    border-top: 1px solid #e2e8f0;
    font-size: 13px;
    line-height: 1.5;
  }
  .shop-report .team-strip strong { color: #0f172a; }
`;

export const collectShopReportEmployees = (shop, planningData, weekDate) => {
  if (!shop) return [];
  const seen = new Map();
  (shop.employees || []).forEach((emp) => {
    if (!emp?.id) return;
    if (isEmployeeHidden(emp, weekDate)) return;
    if (!isEmployeeAssignedToShop(emp, shop)) return;
    seen.set(emp.id, { id: emp.id, name: emp.name || emp.id });
  });
  return Array.from(seen.values()).sort((a, b) =>
    a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' })
  );
};

export const buildShopWeeklyReportBodyHtml = ({
  shopName = '',
  weekDays = [],
  planning = {},
  config = {},
  employees = []
}) => {
  const employeeIds = employees.map((e) => e.id);
  const nameById = new Map(employees.map((e) => [e.id, e.name]));

  const overviewHead = weekDays
    .map(
      (day) =>
        `<th class="day-col" style="background:${getDayColor(day.index).header}">${escapeHtml(day.shortLabel)}</th>`
    )
    .join('');

  const overviewRows = [];
  const weekTotalsByEmployee = new Map();

  employeeIds.forEach((empId) => {
    let weekTotal = 0;
    const dayCells = weekDays.map((day) => {
      const schedule = buildEmployeeDaySchedule(planning, empId, day, config);
      if (schedule.type === 'work') {
        weekTotal += schedule.hours;
        return `<td class="day-cell cell-work"><div>${escapeHtml(schedule.rangesLabel)}</div><div>${escapeHtml(schedule.hoursLabel)}</div></td>`;
      }
      if (schedule.type === 'conge') {
        return `<td class="day-cell cell-conge">Congé</td>`;
      }
      if (schedule.type === 'maladie') {
        return `<td class="day-cell cell-maladie">Maladie</td>`;
      }
      return `<td class="day-cell cell-repos">—</td>`;
    });
    weekTotalsByEmployee.set(empId, weekTotal);
    if (weekTotal > 0.001) {
      overviewRows.push(`<tr>
        <td class="name-col">${escapeHtml(nameById.get(empId) || empId)}</td>
        ${dayCells.join('')}
        <td class="total-col">${escapeHtml(formatWorkedHoursForDisplay(weekTotal))}</td>
      </tr>`);
    }
  });

  const dayBlocks = weekDays.map((day) => {
    const palette = getDayColor(day.index);
    const workers = [];
    let dayTotalHours = 0;

    employeeIds.forEach((empId) => {
      const schedule = buildEmployeeDaySchedule(planning, empId, day, config);
      const dayPlanning = planning?.[empId]?.[day.dayKey];
      const times = computeWorkTimes(dayPlanning, config);
      if (schedule.type === 'work') {
        dayTotalHours += schedule.hours;
        workers.push({
          id: empId,
          name: nameById.get(empId) || empId,
          schedule,
          times,
          sortKey: times?.entry || '99:99'
        });
      } else if (schedule.type === 'conge' || schedule.type === 'maladie') {
        workers.push({
          id: empId,
          name: nameById.get(empId) || empId,
          schedule,
          times: null,
          sortKey: schedule.type
        });
      }
    });

    workers.sort((a, b) => {
      const order = { work: 0, conge: 1, maladie: 2 };
      const ta = order[a.schedule.type] ?? 9;
      const tb = order[b.schedule.type] ?? 9;
      if (ta !== tb) return ta - tb;
      return String(a.sortKey).localeCompare(String(b.sortKey), 'fr');
    });

    const workingCount = workers.filter((w) => w.schedule.type === 'work').length;
    const namesStrip = workers
      .filter((w) => w.schedule.type === 'work')
      .map((w) => `<strong>${escapeHtml(w.name)}</strong> (${escapeHtml(w.schedule.rangesLabel)})`)
      .join(' · ');

    let bodyHtml;
    if (!workers.length) {
      bodyHtml = `<div class="day-empty">Personne planifiée dans cette boutique ce jour.</div>`;
    } else {
      const rows = workers
        .map((w) => {
          if (w.schedule.type === 'conge') {
            return `<tr><td>${escapeHtml(w.name)}</td><td colspan="5" class="cell-conge">Congé ☀️</td></tr>`;
          }
          if (w.schedule.type === 'maladie') {
            return `<tr><td>${escapeHtml(w.name)}</td><td colspan="5" class="cell-maladie">Maladie 🤒</td></tr>`;
          }
          const t = w.times || {};
          return `<tr>
            <td class="name-col">${escapeHtml(w.name)}</td>
            <td>${escapeHtml(t.entry ? `${t.entry} H` : '—')}</td>
            <td>${escapeHtml(t.pause ? `${t.pause} H` : '—')}</td>
            <td>${escapeHtml(t.returnTime ? `${t.returnTime} H` : '—')}</td>
            <td>${escapeHtml(t.exit ? `${t.exit} H` : '—')}</td>
            <td style="font-weight:700;text-align:center">${escapeHtml(w.schedule.hoursLabel)}</td>
          </tr>`;
        })
        .join('');
      bodyHtml = `<table class="day-detail-table">
        <thead><tr>
          <th>Employé</th><th>Entrée</th><th>Pause</th><th>Retour</th><th>Sortie</th><th>Heures</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
      if (namesStrip) {
        bodyHtml += `<div class="team-strip">Présents : ${namesStrip}</div>`;
      }
    }

    return `<section class="day-block">
      <div class="day-block-header" style="background:${palette.header};color:${palette.text};border-bottom:2px solid ${palette.border}">
        <span>${escapeHtml(day.weekday)} ${escapeHtml(format(parseISO(day.dayKey), 'd MMMM yyyy', { locale: fr }))}</span>
        <span class="badge">${workingCount} en boutique</span>
        <span class="badge">${escapeHtml(formatWorkedHoursForDisplay(dayTotalHours))} au total</span>
      </div>
      ${bodyHtml}
    </section>`;
  });

  const shopWeekTotal = Array.from(weekTotalsByEmployee.values()).reduce((s, h) => s + h, 0);
  const activeCount = overviewRows.length;

  return `<div class="schedule-sheet readable-presence shop-report">
    <style>${SHOP_REPORT_EXTRA_STYLES}</style>
    <h2 class="section-title">Vue d'ensemble — qui travaille et combien d'heures</h2>
    <p style="margin:0 0 10px;color:#64748b;font-size:13px">
      ${activeCount} employé(s) avec des heures cette semaine · Total boutique : <strong>${escapeHtml(formatWorkedHoursForDisplay(shopWeekTotal))}</strong>
    </p>
    <table class="overview-table">
      <thead>
        <tr>
          <th>Employé</th>
          ${overviewHead}
          <th class="day-col">Total semaine</th>
        </tr>
      </thead>
      <tbody>
        ${overviewRows.length ? overviewRows.join('') : '<tr><td colspan="9" style="text-align:center;color:#94a3b8;padding:16px">Aucune heure enregistrée cette semaine dans cette boutique.</td></tr>'}
      </tbody>
    </table>
    <h2 class="section-title">Détail jour par jour — horaires et présence</h2>
    ${dayBlocks.join('')}
  </div>`;
};

export const exportShopWeeklyHtmlReport = ({
  planningData,
  shopId,
  selectedWeek,
  openPreview = true
}) => {
  if (!planningData?.shops?.length || !shopId || !selectedWeek) {
    return { ok: false, reason: 'missing-data' };
  }
  const shop = planningData.shops.find((s) => String(s.id) === String(shopId));
  if (!shop) return { ok: false, reason: 'shop-not-found' };

  const weekDate = parseISO(selectedWeek);
  const monday = startOfWeek(weekDate, { weekStartsOn: 1 });
  const weekKey = format(monday, 'yyyy-MM-dd');
  const weekDays = buildPresenceWeekDays(monday, weekKey);
  const config = shop.config || {};
  const planning = shop.weeks?.[weekKey]?.planning || shop.weeks?.[selectedWeek]?.planning || {};
  const employees = collectShopReportEmployees(shop, planningData, weekDate);
  const shopName = shop.name || shopId;
  const weekLabel = `${format(weekDays[0].dayKey, 'd MMMM', { locale: fr })} → ${format(weekDays[6].dayKey, 'd MMMM yyyy', { locale: fr })}`;

  const bodyHtml = buildShopWeeklyReportBodyHtml({
    shopName,
    weekDays,
    planning,
    config,
    employees
  });

  const title = `Équipe — ${shopName} — semaine du ${weekLabel}`;
  const doc = buildLandscapeHtmlDocument({
    title,
    bodyHtml,
    allowPortrait: true,
    metaLines: [
      `Boutique : ${shopName}`,
      `Semaine : ${weekLabel}`,
      `Généré le : ${new Date().toLocaleString('fr-FR')}`,
      'Lecture optimale en mode paysage sur téléphone.'
    ]
  });

  const filename = `equipe_${sanitizeFilePart(shopName)}_${weekKey}.html`;
  return deliverLandscapeHtmlExport(doc, { filename, openPreview });
};
