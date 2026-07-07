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
  buildPresenceMatrix,
  buildReadablePresenceDays,
  buildDayPlanningGridHtml,
  getDayColor,
  PLANNING_GRID_EXPORT_CSS
} from './presenceMapExport';
import { buildSlotRangeLines, getSlotEndTimeFormatted } from './slotDurationUtils';
import {
  formatWorkedHoursForDisplay
} from './planningUtils';
import { isEmployeeAssignedToShop, isEmployeeHidden } from './planningDataManager';

const normSlot = (v) => v === true || v === 1 || v === '1' || v === 'true';

const BAR_COLORS = [
  '#2563eb', '#059669', '#d97706', '#7c3aed', '#db2777', '#0891b2', '#65a30d', '#ea580c'
];

export const DEFAULT_SHOP_REPORT_ALERT = {
  minStaff: 2,
  alertFrom: '18:00',
  alertTo: '21:00'
};

export const SHOP_REPORT_ALERT_STORAGE_KEY = 'shopHtmlReportAlertPrefs';
export const SHOP_REPORT_SECTIONS_STORAGE_KEY = 'shopHtmlReportSectionPrefs';

export const SHOP_REPORT_SECTION_DEFS = [
  { id: 'legend', label: 'Légende des couleurs', group: 'Synthèse' },
  { id: 'alerts', label: 'Panneau alertes sous-effectif', group: 'Synthèse' },
  { id: 'weekPanorama', label: 'Panorama semaine (7 jours côte à côte)', group: 'Vue semaine' },
  { id: 'weekMatrix', label: 'Matrice effectif (créneau × jour)', group: 'Vue semaine' },
  { id: 'overview', label: 'Tableau synthèse par employé', group: 'Vue semaine' },
  { id: 'dayBlocks', label: 'Détail jour par jour (en-têtes + badges)', group: 'Détail par jour' },
  { id: 'dayGantt', label: 'Cartographie Gantt (barres horaires)', group: 'Détail par jour', nested: true },
  { id: 'dayHeatmap', label: 'Heatmap effectif du jour', group: 'Détail par jour', nested: true },
  { id: 'dayTeamOverlap', label: 'Qui se croise en même temps', group: 'Détail par jour', nested: true },
  { id: 'dayPlanningGrid', label: 'Grille planning (cases vertes)', group: 'Détail par jour', nested: true },
  { id: 'dayTable', label: 'Tableau horaire détaillé', group: 'Détail par jour', nested: true }
];

export const DEFAULT_SHOP_REPORT_SECTIONS = SHOP_REPORT_SECTION_DEFS.reduce(
  (acc, def) => ({ ...acc, [def.id]: true }),
  {}
);

export const loadShopReportSectionPrefs = () => {
  try {
    const raw = localStorage.getItem(SHOP_REPORT_SECTIONS_STORAGE_KEY);
    if (raw) return { ...DEFAULT_SHOP_REPORT_SECTIONS, ...JSON.parse(raw) };
  } catch (_) {
    /* ignore */
  }
  return { ...DEFAULT_SHOP_REPORT_SECTIONS };
};

export const saveShopReportSectionPrefs = (sections) => {
  try {
    localStorage.setItem(SHOP_REPORT_SECTIONS_STORAGE_KEY, JSON.stringify(sections));
  } catch (_) {
    /* ignore */
  }
};

const normalizeSectionOptions = (sectionOptions = {}) => {
  const merged = { ...DEFAULT_SHOP_REPORT_SECTIONS, ...sectionOptions };
  if (!merged.dayBlocks) {
    merged.dayGantt = false;
    merged.dayHeatmap = false;
    merged.dayTeamOverlap = false;
    merged.dayPlanningGrid = false;
    merged.dayTable = false;
  }
  return merged;
};

export const hasAnyShopReportSection = (sectionOptions) =>
  Object.values(normalizeSectionOptions(sectionOptions)).some(Boolean);

export const loadShopReportAlertPrefs = () => {
  try {
    const raw = localStorage.getItem(SHOP_REPORT_ALERT_STORAGE_KEY);
    if (raw) return { ...DEFAULT_SHOP_REPORT_ALERT, ...JSON.parse(raw) };
  } catch (_) {
    /* ignore */
  }
  return { ...DEFAULT_SHOP_REPORT_ALERT };
};

export const saveShopReportAlertPrefs = (prefs) => {
  try {
    localStorage.setItem(SHOP_REPORT_ALERT_STORAGE_KEY, JSON.stringify(prefs));
  } catch (_) {
    /* ignore */
  }
};

const normalizeAlertOptions = (alertOptions = {}) => ({
  minStaff: Math.max(1, parseInt(alertOptions.minStaff, 10) || DEFAULT_SHOP_REPORT_ALERT.minStaff),
  alertFrom: alertOptions.alertFrom || DEFAULT_SHOP_REPORT_ALERT.alertFrom,
  alertTo: alertOptions.alertTo || DEFAULT_SHOP_REPORT_ALERT.alertTo
});

const slotOverlapsWindow = (slotStartMin, slotEndMin, windowStartMin, windowEndMin) =>
  slotStartMin < windowEndMin && slotEndMin > windowStartMin;

const isCoverageCellUnderStaffed = (cell, alertOptions) => {
  const opts = normalizeAlertOptions(alertOptions);
  const fromMin = timeToMinutes(opts.alertFrom);
  const toMin = timeToMinutes(opts.alertTo);
  const startMin = timeToMinutes(cell.slot);
  const endMin = timeToMinutes(cell.slotEnd);
  if (fromMin == null || toMin == null || startMin == null || endMin == null) return false;
  if (!slotOverlapsWindow(startMin, endMin, fromMin, toMin)) return false;
  return cell.count > 0 && cell.count < opts.minStaff;
};

const sanitizeFilePart = (value) =>
  String(value || 'boutique')
    .replace(/[^\w.-]+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 60);

const timeToMinutes = (hhmm) => {
  if (!hhmm || typeof hhmm !== 'string') return null;
  const [h, m] = hhmm.split(':').map((v) => parseInt(v, 10) || 0);
  return h * 60 + m;
};

const slotDurationCfg = (config) => ({
  interval: config?.interval || 30,
  endTime: config?.endTime
});

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

const coverageLevelClass = (count) => {
  if (count <= 0) return 'cov-0';
  if (count === 1) return 'cov-1';
  if (count === 2) return 'cov-2';
  return 'cov-3';
};

const buildDayCoverageCells = (day, planning, config, employeeIds, nameById) => {
  const timeSlots = config?.timeSlots || [];
  const durationCfg = slotDurationCfg(config);
  if (!timeSlots.length) return [];

  return timeSlots.map((slot, slotIndex) => {
    const presentIds = employeeIds.filter((id) =>
      normSlot(planning?.[id]?.[day.dayKey]?.[slotIndex])
    );
    const slotEnd = getSlotEndTimeFormatted(timeSlots, slotIndex, durationCfg);
    return {
      slot,
      slotEnd,
      label: `${slot}–${slotEnd}`,
      count: presentIds.length,
      names: presentIds.map((id) => nameById.get(id) || id)
    };
  });
};

const buildDayGanttHtml = (day, planning, config, employeeIds, nameById) => {
  const durationCfg = slotDurationCfg(config);
  const rows = [];

  employeeIds.forEach((empId, colorIdx) => {
    const dayPlanning = planning?.[empId]?.[day.dayKey];
    const schedule = buildEmployeeDaySchedule(planning, empId, day, config);
    if (schedule.type !== 'work') return;

    const ranges = buildSlotRangeLines(dayPlanning, config?.timeSlots || [], durationCfg);
    const segments = ranges
      .map((range) => {
        const [start, end] = range.split('-').map((s) => s.trim());
        const startMin = timeToMinutes(start);
        const endMin = timeToMinutes(end);
        if (startMin == null || endMin == null) return null;
        return { start, end, startMin, endMin: endMin <= startMin ? endMin + 24 * 60 : endMin };
      })
      .filter(Boolean);

    if (!segments.length) return;
    rows.push({
      id: empId,
      name: nameById.get(empId) || empId,
      color: BAR_COLORS[colorIdx % BAR_COLORS.length],
      segments,
      hoursLabel: schedule.hoursLabel
    });
  });

  if (!rows.length) {
    return '<p class="carto-empty">Aucun horaire de travail ce jour — pas de cartographie possible.</p>';
  }

  let axisMin = Infinity;
  let axisMax = -Infinity;
  rows.forEach((row) => {
    row.segments.forEach((seg) => {
      axisMin = Math.min(axisMin, seg.startMin);
      axisMax = Math.max(axisMax, seg.endMin);
    });
  });
  if (!Number.isFinite(axisMin) || !Number.isFinite(axisMax) || axisMax <= axisMin) {
    axisMin = 9 * 60;
    axisMax = 20 * 60;
  }
  const span = axisMax - axisMin;

  const axisMarks = [];
  const firstHour = Math.floor(axisMin / 60);
  const lastHour = Math.ceil(axisMax / 60);
  for (let h = firstHour; h <= lastHour; h += 1) {
    const min = h * 60;
    const left = ((min - axisMin) / span) * 100;
    if (left >= -2 && left <= 102) {
      axisMarks.push(`<span class="gantt-tick" style="left:${left.toFixed(2)}%">${String(h).padStart(2, '0')}h</span>`);
    }
  }

  const rowHtml = rows
    .map((row) => {
      const bars = row.segments
        .map((seg) => {
          const left = ((seg.startMin - axisMin) / span) * 100;
          const width = Math.max(((seg.endMin - seg.startMin) / span) * 100, 1.5);
          return `<div class="gantt-bar" style="left:${left.toFixed(2)}%;width:${width.toFixed(2)}%;background:${row.color}" title="${escapeHtml(`${seg.start} → ${seg.end}`)}">
            <span class="gantt-bar-label">${escapeHtml(seg.start)}–${escapeHtml(seg.end)}</span>
          </div>`;
        })
        .join('');
      return `<div class="gantt-row">
        <div class="gantt-name" style="border-left:4px solid ${row.color}">${escapeHtml(row.name)}</div>
        <div class="gantt-track">${bars}</div>
        <div class="gantt-hours">${escapeHtml(row.hoursLabel)}</div>
      </div>`;
    })
    .join('');

  return `<div class="gantt-wrap">
    <div class="gantt-axis">${axisMarks.join('')}</div>
    ${rowHtml}
    <p class="gantt-hint">Les barres qui se superposent verticalement = personnes présentes en même time.</p>
  </div>`;
};

const buildCoverageHeatmapHtml = (coverageCells, alertOptions = null) => {
  const activeCells = coverageCells.filter((c) => c.count > 0);
  if (!activeCells.length) {
    return '<p class="carto-empty">Aucun créneau couvert ce jour.</p>';
  }

  const weakSlots = activeCells.filter((c) => c.count === 1);
  const cellsHtml = coverageCells
    .map((cell) => {
      if (cell.count === 0) return '';
      const title = cell.names.length ? `${cell.label} : ${cell.names.join(', ')}` : cell.label;
      const alertClass =
        alertOptions && isCoverageCellUnderStaffed(cell, alertOptions) ? ' cov-alert' : '';
      return `<div class="cov-cell ${coverageLevelClass(cell.count)}${alertClass}" title="${escapeHtml(title)}">
        <span class="cov-time">${escapeHtml(cell.slot)}</span>
        <span class="cov-count">${cell.count}</span>
      </div>`;
    })
    .join('');

  const weakHtml =
    weakSlots.length > 0
      ? `<div class="weak-slots">
          <strong>⚠️ Créneaux seul(e) en boutique (${weakSlots.length}) :</strong>
          ${weakSlots
            .map(
              (c) =>
                `<span class="weak-chip">${escapeHtml(c.label)} — ${escapeHtml(c.names[0] || '?')}</span>`
            )
            .join('')}
        </div>`
      : '';

  return `<div class="coverage-heatmap">${cellsHtml}</div>${weakHtml}`;
};

const buildTeamMomentsHtml = (teamMoments) => {
  if (!teamMoments?.length) {
    return '<p class="carto-muted">Pas de chevauchement (2+ personnes) enregistré ce jour.</p>';
  }
  return `<div class="team-block">
    <h3>👥 En boutique en même temps</h3>
    ${teamMoments
      .map(
        (m) =>
          `<div class="team-line"><strong>${escapeHtml(m.timeLabel)}</strong> — ${escapeHtml(m.names.join(' · '))} <span class="team-count">(${m.count} pers.)</span></div>`
      )
      .join('')}
  </div>`;
};

const collectWeekAlerts = (weekDays, planning, config, employeeIds, nameById, alertOptions) => {
  const alerts = [];
  weekDays.forEach((day) => {
    buildDayCoverageCells(day, planning, config, employeeIds, nameById).forEach((cell) => {
      if (!isCoverageCellUnderStaffed(cell, alertOptions)) return;
      alerts.push({
        dayKey: day.dayKey,
        dayShort: day.shortLabel,
        dayWeekday: day.weekday,
        ...cell
      });
    });
  });
  return alerts;
};

const buildAlertsPanelHtml = (alerts, alertOptions, shopName) => {
  const opts = normalizeAlertOptions(alertOptions);
  if (!alerts.length) {
    return `<div class="alert-panel alert-panel-ok">
      <h3>✅ Effectif — fenêtre ${escapeHtml(opts.alertFrom)} → ${escapeHtml(opts.alertTo)}</h3>
      <p>Aucun créneau actif sous ${opts.minStaff} personne(s) dans cette plage pour <strong>${escapeHtml(shopName)}</strong>.</p>
    </div>`;
  }
  const rows = alerts
    .map(
      (a) =>
        `<tr class="alert-row">
          <td>${escapeHtml(a.dayWeekday)} ${escapeHtml(format(parseISO(a.dayKey), 'dd/MM'))}</td>
          <td><strong>${escapeHtml(a.label)}</strong></td>
          <td class="alert-count">${a.count} pers.</td>
          <td>${escapeHtml(a.names.join(' · ') || '—')}</td>
        </tr>`
    )
    .join('');
  return `<div class="alert-panel alert-panel-warn">
    <h3>⚠️ Sous-effectif — moins de ${opts.minStaff} personne(s) entre ${escapeHtml(opts.alertFrom)} et ${escapeHtml(opts.alertTo)}</h3>
    <p>${alerts.length} créneau(x) à surveiller cette semaine.</p>
    <table class="alert-table">
      <thead><tr><th>Jour</th><th>Créneau</th><th>Effectif</th><th>Présents</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
};

const buildWeekEmployeePanoramaHtml = (weekDays, planning, config, employeeIds, nameById) => {
  const headDays = weekDays
    .map((day) => {
      const palette = getDayColor(day.index);
      return `<div class="wp-day-head" style="background:${palette.header};color:${palette.text};border-color:${palette.border}">${escapeHtml(day.shortLabel)}</div>`;
    })
    .join('');

  const rows = employeeIds
    .map((empId) => {
      let hasWork = false;
      const cells = weekDays.map((day) => {
        const schedule = buildEmployeeDaySchedule(planning, empId, day, config);
        const palette = getDayColor(day.index);
        if (schedule.type === 'work') {
          hasWork = true;
          return `<div class="wp-cell wp-work" style="background:${palette.cell};border-color:${palette.border}">
            <span class="wp-ranges">${escapeHtml(schedule.rangesLabel)}</span>
            <span class="wp-hours">${escapeHtml(schedule.hoursLabel)}</span>
          </div>`;
        }
        if (schedule.type === 'conge') {
          return `<div class="wp-cell wp-conge">Congé</div>`;
        }
        if (schedule.type === 'maladie') {
          return `<div class="wp-cell wp-maladie">Mal.</div>`;
        }
        return `<div class="wp-cell wp-off">—</div>`;
      });
      if (!hasWork) return '';
      const color = BAR_COLORS[employeeIds.indexOf(empId) % BAR_COLORS.length];
      return `<div class="wp-row">
        <div class="wp-name" style="border-left:4px solid ${color}">${escapeHtml(nameById.get(empId) || empId)}</div>
        ${cells.join('')}
      </div>`;
    })
    .filter(Boolean)
    .join('');

  if (!rows) {
    return '<p class="carto-empty">Aucun horaire sur la semaine.</p>';
  }

  return `<div class="week-panorama">
    <div class="wp-row wp-head">
      <div class="wp-name">Employé</div>
      ${headDays}
    </div>
    ${rows}
  </div>`;
};

const buildWeekCoverageMatrixHtml = (weekDays, planning, config, employeeIds, nameById, alertOptions) => {
  const timeSlots = config?.timeSlots || [];
  if (!timeSlots.length) return '';

  const dayCoverage = weekDays.map((day) =>
    buildDayCoverageCells(day, planning, config, employeeIds, nameById)
  );

  const activeSlotIndexes = new Set();
  dayCoverage.forEach((cells) => {
    cells.forEach((cell, idx) => {
      if (cell.count > 0) activeSlotIndexes.add(idx);
    });
  });

  const slotIndexes = [...activeSlotIndexes].sort((a, b) => a - b);
  if (!slotIndexes.length) {
    return '<p class="carto-empty">Aucun créneau couvert sur la semaine.</p>';
  }

  const headDays = weekDays
    .map((day) => {
      const palette = getDayColor(day.index);
      return `<th style="background:${palette.header} !important;color:${palette.text} !important">${escapeHtml(day.shortLabel)}</th>`;
    })
    .join('');

  const bodyRows = slotIndexes
    .map((slotIdx) => {
      const sample = dayCoverage[0][slotIdx];
      const timeLabel = sample?.label || timeSlots[slotIdx];
      const cells = dayCoverage
        .map((dayCells, dayIndex) => {
          const cell = dayCells[slotIdx];
          if (!cell || cell.count === 0) {
            return `<td class="wcm-empty">·</td>`;
          }
          const alertClass =
            isCoverageCellUnderStaffed(cell, alertOptions) ? ' wcm-alert' : '';
          const title = cell.names.join(', ');
          return `<td class="wcm-cell ${coverageLevelClass(cell.count)}${alertClass}" title="${escapeHtml(title)}">
            <span class="wcm-count">${cell.count}</span>
          </td>`;
        })
        .join('');
      return `<tr><td class="wcm-time">${escapeHtml(timeLabel)}</td>${cells}</tr>`;
    })
    .join('');

  return `<div class="week-matrix-wrap">
    <table class="week-coverage-matrix">
      <thead><tr><th>Horaire</th>${headDays}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>
    <p class="carto-muted" style="margin:8px 0 0">Lecture : chiffre = personnes en boutique · bordure rouge = sous-effectif (alerte)</p>
  </div>`;
};

const SHOP_REPORT_EXTRA_STYLES = `
  ${PLANNING_GRID_EXPORT_CSS}
  .shop-report .legend {
    display: flex; flex-wrap: wrap; gap: 8px 14px; margin: 0 0 14px;
    padding: 10px 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;
    font-size: 12px; color: #334155;
  }
  .shop-report .legend-item { display: inline-flex; align-items: center; gap: 6px; }
  .shop-report .legend-swatch { width: 14px; height: 14px; border-radius: 3px; border: 1px solid rgba(0,0,0,0.12); }
  .shop-report .overview-table th {
    background: #0f766e !important;
    color: #fff !important;
  }
  .shop-report .overview-table th.day-col {
    text-align: center; min-width: 72px;
    font-size: 11px !important;
  }
  .shop-report .overview-table td.day-cell { text-align: center; font-size: 12px; line-height: 1.35; }
  .shop-report .overview-table td.name-col { font-weight: 700; white-space: nowrap; }
  .shop-report .overview-table td.total-col { font-weight: 800; text-align: center; background: #ecfdf5 !important; }
  .shop-report .cell-work { color: #0f766e; font-weight: 600; }
  .shop-report .cell-conge { color: #b45309; font-weight: 600; }
  .shop-report .cell-maladie { color: #dc2626; font-weight: 600; }
  .shop-report .cell-repos { color: #94a3b8; }
  .shop-report .day-block {
    margin-top: 20px;
    border-radius: 12px;
    overflow: hidden;
    border: 2px solid #cbd5e1;
    background: #fff;
    page-break-inside: avoid;
  }
  .shop-report .day-block-header {
    padding: 12px 16px;
    font-weight: 800;
    font-size: 15px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px 12px;
    align-items: center;
    border-bottom: 3px solid;
  }
  .shop-report .day-block-header .badge {
    font-size: 11px;
    font-weight: 700;
    padding: 4px 11px;
    border-radius: 999px;
    background: #fff;
    border: 1px solid rgba(0,0,0,0.12);
    color: #0f172a;
  }
  .shop-report .day-block-header .badge-warn {
    background: #fff7ed;
    border-color: #fdba74;
    color: #9a3412;
  }
  .shop-report .day-block-header .badge-info {
    background: #eff6ff;
    border-color: #93c5fd;
    color: #1e40af;
  }
  .shop-report .carto-section {
    padding: 12px 14px 14px;
    border-top: 1px solid #e2e8f0;
  }
  .shop-report .carto-section:first-of-type { border-top: none; }
  .shop-report .carto-title {
    margin: 0 0 10px;
    font-size: 12px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #0f766e;
  }
  .shop-report .carto-empty, .shop-report .carto-muted {
    margin: 0; font-size: 12px; color: #64748b; font-style: italic;
  }
  .shop-report .gantt-wrap {
    background: #f8fafc;
    border-radius: 8px;
    padding: 8px 8px 6px;
    border: 1px solid #e2e8f0;
  }
  .shop-report .gantt-axis {
    position: relative;
    height: 18px;
    margin: 0 0 4px 108px;
    border-bottom: 1px dashed #cbd5e1;
  }
  .shop-report .gantt-tick {
    position: absolute;
    transform: translateX(-50%);
    font-size: 9px;
    color: #64748b;
    font-weight: 600;
  }
  .shop-report .gantt-row {
    display: grid;
    grid-template-columns: 100px 1fr 44px;
    gap: 6px;
    align-items: center;
    margin-bottom: 6px;
  }
  .shop-report .gantt-name {
    font-size: 11px;
    font-weight: 700;
    color: #0f172a;
    padding: 4px 6px 4px 8px;
    background: #fff;
    border-radius: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .shop-report .gantt-track {
    position: relative;
    height: 28px;
    background: repeating-linear-gradient(90deg, #fff 0, #fff 8px, #f1f5f9 8px, #f1f5f9 9px);
    border-radius: 6px;
    border: 1px solid #e2e8f0;
  }
  .shop-report .gantt-bar {
    position: absolute;
    top: 3px;
    height: 22px;
    border-radius: 5px;
    min-width: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    box-shadow: 0 1px 2px rgba(0,0,0,0.15);
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .shop-report .gantt-bar-label {
    font-size: 8px;
    font-weight: 800;
    color: #fff;
    white-space: nowrap;
    padding: 0 3px;
    text-shadow: 0 1px 1px rgba(0,0,0,0.35);
  }
  .shop-report .gantt-hours {
    font-size: 10px;
    font-weight: 700;
    text-align: center;
    color: #0f766e;
  }
  .shop-report .gantt-hint {
    margin: 6px 0 0;
    font-size: 10px;
    color: #64748b;
    text-align: center;
  }
  .shop-report .coverage-heatmap {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .shop-report .cov-cell {
    min-width: 52px;
    padding: 6px 4px;
    border-radius: 6px;
    text-align: center;
    border: 1px solid rgba(0,0,0,0.08);
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .shop-report .cov-cell.cov-0 { background: #fecaca; color: #991b1b; }
  .shop-report .cov-cell.cov-1 { background: #fed7aa; color: #9a3412; }
  .shop-report .cov-cell.cov-2 { background: #bbf7d0; color: #166534; }
  .shop-report .cov-cell.cov-3 { background: #86efac; color: #14532d; font-weight: 800; }
  .shop-report .cov-time { display: block; font-size: 9px; font-weight: 600; }
  .shop-report .cov-count { display: block; font-size: 14px; font-weight: 800; line-height: 1.1; }
  .shop-report .weak-slots {
    margin-top: 10px;
    padding: 8px 10px;
    background: #fff7ed;
    border: 1px solid #fdba74;
    border-radius: 8px;
    font-size: 11px;
    color: #9a3412;
    line-height: 1.5;
  }
  .shop-report .weak-chip {
    display: inline-block;
    margin: 4px 6px 0 0;
    padding: 2px 8px;
    background: #fff;
    border-radius: 999px;
    border: 1px solid #fdba74;
    font-weight: 600;
  }
  .shop-report .team-block {
    margin: 0;
    padding: 10px 12px;
    border-radius: 8px;
    background: #ecfdf5;
    border: 1px solid #6ee7b7;
  }
  .shop-report .team-block h3 {
    margin: 0 0 8px;
    font-size: 12px;
    color: #065f46;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .shop-report .team-line {
    font-size: 12px;
    color: #14532d;
    margin-bottom: 4px;
    line-height: 1.45;
  }
  .shop-report .team-line strong { color: #047857; }
  .shop-report .team-count { color: #059669; font-weight: 700; font-size: 11px; }
  .shop-report .day-detail-table { margin: 0; min-width: 0 !important; width: 100% !important; }
  .shop-report .day-detail-table th {
    background: #f1f5f9 !important;
    color: #334155 !important;
    font-size: 11px !important;
  }
  .shop-report .day-detail-table td { font-size: 12px; }
  .shop-report .day-empty {
    padding: 12px 14px;
    color: #64748b;
    font-style: italic;
    background: #f8fafc;
  }
  .shop-report .status-list {
    display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 10px;
  }
  .shop-report .status-chip {
    font-size: 11px; font-weight: 600;
    padding: 4px 10px; border-radius: 999px;
  }
  .shop-report .status-chip.conge { background: #ffedd5; color: #c2410c; }
  .shop-report .status-chip.maladie { background: #fee2e2; color: #dc2626; }
  .shop-report .cov-cell.cov-alert {
    box-shadow: 0 0 0 2px #dc2626 inset;
    animation: pulse-alert 1.5s ease-in-out infinite;
  }
  @keyframes pulse-alert {
    0%, 100% { box-shadow: 0 0 0 2px #dc2626 inset; }
    50% { box-shadow: 0 0 0 3px #ef4444 inset; }
  }
  .shop-report .alert-panel {
    margin: 0 0 16px;
    padding: 12px 14px;
    border-radius: 10px;
    page-break-inside: avoid;
  }
  .shop-report .alert-panel-ok {
    background: #ecfdf5;
    border: 2px solid #6ee7b7;
    color: #065f46;
  }
  .shop-report .alert-panel-warn {
    background: #fef2f2;
    border: 2px solid #fca5a5;
    color: #991b1b;
  }
  .shop-report .alert-panel h3 { margin: 0 0 6px; font-size: 14px; }
  .shop-report .alert-panel p { margin: 0 0 8px; font-size: 12px; }
  .shop-report .alert-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
    background: #fff;
    border-radius: 6px;
    overflow: hidden;
  }
  .shop-report .alert-table th {
    background: #fee2e2 !important;
    color: #991b1b !important;
    padding: 6px 8px !important;
    text-align: left;
  }
  .shop-report .alert-table td {
    padding: 6px 8px;
    border-top: 1px solid #fecaca;
    vertical-align: top;
  }
  .shop-report .alert-count { font-weight: 800; white-space: nowrap; }
  .shop-report .week-panorama {
    border: 1px solid #cbd5e1;
    border-radius: 10px;
    overflow: hidden;
    background: #fff;
  }
  .shop-report .wp-row {
    display: grid;
    grid-template-columns: 108px repeat(7, minmax(0, 1fr));
    gap: 0;
    border-top: 1px solid #e2e8f0;
  }
  .shop-report .wp-row.wp-head { border-top: none; background: #f8fafc; }
  .shop-report .wp-name {
    padding: 8px 10px;
    font-size: 11px;
    font-weight: 700;
    color: #0f172a;
    background: #fff;
    display: flex;
    align-items: center;
    border-right: 1px solid #e2e8f0;
  }
  .shop-report .wp-day-head {
    padding: 8px 4px;
    font-size: 10px;
    font-weight: 800;
    text-align: center;
    border-right: 1px solid rgba(0,0,0,0.06);
    border-bottom: 2px solid;
  }
  .shop-report .wp-cell {
    padding: 6px 4px;
    min-height: 44px;
    font-size: 9px;
    line-height: 1.25;
    border-right: 1px solid #e2e8f0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
  }
  .shop-report .wp-ranges { font-weight: 700; color: #0f766e; }
  .shop-report .wp-hours { font-size: 8px; color: #64748b; margin-top: 2px; }
  .shop-report .wp-conge { background: #fff7ed; color: #c2410c; font-weight: 700; }
  .shop-report .wp-maladie { background: #fef2f2; color: #dc2626; font-weight: 700; }
  .shop-report .wp-off { background: #f8fafc; color: #cbd5e1; }
  .shop-report .week-matrix-wrap {
    overflow-x: auto;
    border: 1px solid #cbd5e1;
    border-radius: 10px;
    background: #fff;
    padding: 4px;
  }
  .shop-report .week-coverage-matrix {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
    min-width: 520px;
  }
  .shop-report .week-coverage-matrix th {
    padding: 8px 6px !important;
    text-align: center !important;
    font-size: 10px !important;
  }
  .shop-report .week-coverage-matrix .wcm-time {
    font-weight: 700;
    white-space: nowrap;
    background: #f1f5f9 !important;
    color: #334155 !important;
    padding: 6px 8px !important;
    font-size: 10px !important;
  }
  .shop-report .week-coverage-matrix .wcm-cell {
    text-align: center;
    padding: 6px 4px !important;
    min-width: 36px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .shop-report .week-coverage-matrix .wcm-empty {
    text-align: center;
    color: #cbd5e1;
    background: #fafafa !important;
  }
  .shop-report .week-coverage-matrix .wcm-count {
    font-weight: 800;
    font-size: 13px;
  }
  .shop-report .week-coverage-matrix .wcm-alert {
    box-shadow: inset 0 0 0 2px #dc2626;
  }
  .shop-report .week-section {
    margin: 18px 0;
    padding: 12px 14px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    page-break-inside: avoid;
  }
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
  employees = [],
  alertOptions = DEFAULT_SHOP_REPORT_ALERT,
  sectionOptions = DEFAULT_SHOP_REPORT_SECTIONS
}) => {
  const opts = normalizeAlertOptions(alertOptions);
  const sections = normalizeSectionOptions(sectionOptions);
  const employeeIds = employees.map((e) => e.id);
  const nameById = new Map(employees.map((e) => [e.id, e.name]));
  const matrix = buildPresenceMatrix({
    planning,
    config,
    employeeIds,
    employeeNameById: nameById,
    weekDays
  });
  const readableDays = buildReadablePresenceDays({
    planning,
    config,
    employeeIds,
    employeeNameById: nameById,
    weekDays,
    matrix
  });

  const overviewHead = weekDays
    .map((day) => {
      const palette = getDayColor(day.index);
      return `<th class="day-col" style="background:${palette.header} !important;color:${palette.text} !important;border-bottom:2px solid ${palette.border} !important">${escapeHtml(day.shortLabel)}</th>`;
    })
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

  const dayBlocks = sections.dayBlocks
    ? readableDays.map(({ day, roster, workingCount, teamMoments }, dayIndex) => {
    const palette = getDayColor(day.index);
    const congeCount = roster.filter((r) => r.type === 'conge').length;
    const maladieCount = roster.filter((r) => r.type === 'maladie').length;
    const dayTotalHours = roster
      .filter((r) => r.type === 'work')
      .reduce((s, r) => s + (r.hours || 0), 0);

    const coverageCells = buildDayCoverageCells(day, planning, config, employeeIds, nameById);
    const maxCoverage = Math.max(0, ...coverageCells.map((c) => c.count));
    const soloSlots = coverageCells.filter((c) => c.count === 1).length;

    const statusChips = roster
      .filter((r) => r.type === 'conge' || r.type === 'maladie')
      .map(
        (r) =>
          `<span class="status-chip ${r.type === 'maladie' ? 'maladie' : 'conge'}">${escapeHtml(r.name)} — ${r.type === 'maladie' ? 'Maladie 🤒' : 'Congé ☀️'}</span>`
      )
      .join('');

    const ganttHtml = sections.dayGantt
      ? `<div class="carto-section">
        <h3 class="carto-title">🗺️ Cartographie horaire — qui est là quand</h3>
        ${buildDayGanttHtml(day, planning, config, employeeIds, nameById)}
      </div>`
      : '';

    const heatmapHtml = sections.dayHeatmap
      ? `<div class="carto-section">
        <h3 class="carto-title">📊 Effectif par créneau</h3>
        <p class="carto-muted" style="margin:0 0 8px">Orange = 1 personne seule · Vert = 2+ personnes ensemble</p>
        ${buildCoverageHeatmapHtml(coverageCells, opts)}
      </div>`
      : '';

    const teamHtml = sections.dayTeamOverlap
      ? `<div class="carto-section">${buildTeamMomentsHtml(teamMoments)}</div>`
      : '';

    const gridHtml = sections.dayPlanningGrid
      ? buildDayPlanningGridHtml({
          day,
          planning,
          config,
          employeeIds,
          employeeNameById: nameById,
          useFullNames: true
        })
      : '';

    const detailRows = roster
      .filter((r) => r.type === 'work')
      .map((r) => {
        const dayPlanning = planning?.[r.id]?.[day.dayKey];
        const times = computeWorkTimes(dayPlanning, config) || {};
        return `<tr>
          <td class="name-col">${escapeHtml(r.name)}</td>
          <td>${escapeHtml(times.entry ? `${times.entry} H` : '—')}</td>
          <td>${escapeHtml(times.pause ? `${times.pause} H` : '—')}</td>
          <td>${escapeHtml(times.returnTime ? `${times.returnTime} H` : '—')}</td>
          <td>${escapeHtml(times.exit ? `${times.exit} H` : '—')}</td>
          <td style="font-weight:700;text-align:center">${escapeHtml(r.hoursLabel)}</td>
        </tr>`;
      })
      .join('');

    const detailTable = sections.dayTable
      ? detailRows.length > 0
        ? `<table class="day-detail-table">
            <thead><tr><th>Employé</th><th>Entrée</th><th>Pause</th><th>Retour</th><th>Sortie</th><th>Heures</th></tr></thead>
            <tbody>${detailRows}</tbody>
          </table>`
        : '<div class="day-empty">Personne en horaires de travail ce jour.</div>'
      : '';

    const detailSection = sections.dayTable
      ? `<div class="carto-section">
          <h3 class="carto-title">📝 Tableau horaire détaillé</h3>
          ${detailTable}
        </div>`
      : '';

    return `<section class="day-block" id="jour-${dayIndex + 1}">
      <div class="day-block-header" style="background:${palette.header};color:${palette.text};border-color:${palette.border}">
        <span>Jour ${dayIndex + 1} — ${escapeHtml(day.weekday)} ${escapeHtml(format(parseISO(day.dayKey), 'd MMMM yyyy', { locale: fr }))}</span>
        <span class="badge badge-info">${workingCount} en boutique</span>
        ${congeCount ? `<span class="badge badge-warn">${congeCount} congé(s)</span>` : ''}
        ${maladieCount ? `<span class="badge badge-warn">${maladieCount} maladie(s)</span>` : ''}
        <span class="badge">Effectif max ${maxCoverage} · ${escapeHtml(formatWorkedHoursForDisplay(dayTotalHours))}</span>
        ${soloSlots ? `<span class="badge badge-warn">${soloSlots} créneau(x) seul(e)</span>` : ''}
      </div>

      ${statusChips ? `<div class="carto-section"><div class="status-list">${statusChips}</div></div>` : ''}
      ${ganttHtml}
      ${heatmapHtml}
      ${teamHtml}
      ${gridHtml ? `<div class="carto-section">${gridHtml}</div>` : ''}
      ${detailSection}
    </section>`;
  })
    : [];

  const shopWeekTotal = Array.from(weekTotalsByEmployee.values()).reduce((s, h) => s + h, 0);
  const activeCount = overviewRows.length;

  const weekAlerts = collectWeekAlerts(weekDays, planning, config, employeeIds, nameById, opts);
  const alertsPanelHtml = buildAlertsPanelHtml(weekAlerts, opts, shopName);
  const weekPanoramaHtml = buildWeekEmployeePanoramaHtml(
    weekDays,
    planning,
    config,
    employeeIds,
    nameById
  );
  const weekMatrixHtml = buildWeekCoverageMatrixHtml(
    weekDays,
    planning,
    config,
    employeeIds,
    nameById,
    opts
  );

  const legendHtml = sections.legend
    ? `<div class="legend">
      <span class="legend-item"><span class="legend-swatch" style="background:#fed7aa"></span> 1 seul(e) — créneau à surveiller</span>
      <span class="legend-item"><span class="legend-swatch" style="background:#bbf7d0"></span> 2 personnes</span>
      <span class="legend-item"><span class="legend-swatch" style="background:#86efac"></span> 3+ personnes</span>
      <span class="legend-item"><span class="legend-swatch" style="background:#2563eb"></span> Barre horaire employé (Gantt)</span>
      <span class="legend-item"><span class="legend-swatch" style="background:#fef2f2;border:2px solid #dc2626"></span> Alerte sous-effectif</span>
    </div>`
    : '';

  const alertsHtml = sections.alerts ? alertsPanelHtml : '';

  const panoramaSection = sections.weekPanorama
    ? `<div class="week-section">
      <h2 class="section-title">🗓️ Panorama semaine — 7 jours côte à côte</h2>
      <p style="margin:0 0 10px;color:#64748b;font-size:13px">
        Une ligne par employé : horaires de chaque jour en un coup d'œil.
      </p>
      ${weekPanoramaHtml}
    </div>`
    : '';

  const matrixSection = sections.weekMatrix
    ? `<div class="week-section">
      <h2 class="section-title">📊 Matrice effectif semaine (créneau × jour)</h2>
      <p style="margin:0 0 10px;color:#64748b;font-size:13px">
        Alerte si effectif &lt; ${opts.minStaff} entre ${escapeHtml(opts.alertFrom)} et ${escapeHtml(opts.alertTo)} (bordure rouge).
      </p>
      ${weekMatrixHtml}
    </div>`
    : '';

  const overviewSection = sections.overview
    ? `<h2 class="section-title">Vue d'ensemble — ${escapeHtml(shopName)}</h2>
    <p style="margin:0 0 10px;color:#64748b;font-size:13px">
      ${activeCount} employé(s) avec des heures · Total semaine : <strong>${escapeHtml(formatWorkedHoursForDisplay(shopWeekTotal))}</strong>
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
        ${overviewRows.length ? overviewRows.join('') : '<tr><td colspan="9" style="text-align:center;color:#94a3b8;padding:16px">Aucune heure enregistrée cette semaine.</td></tr>'}
      </tbody>
    </table>`
    : '';

  const dayBlocksSection =
    sections.dayBlocks && dayBlocks.length
      ? `<h2 class="section-title">Cartographie semaine — présence et chevauchements</h2>
    <p style="margin:0 0 12px;color:#64748b;font-size:13px">
      Détail jour par jour selon les options cochées à l'export.
    </p>
    ${dayBlocks.join('')}`
      : '';

  return `<div class="schedule-sheet readable-presence shop-report">
    <style>${SHOP_REPORT_EXTRA_STYLES}</style>
    ${legendHtml}
    ${alertsHtml}
    ${panoramaSection}
    ${matrixSection}
    ${overviewSection}
    ${dayBlocksSection}
  </div>`;
};

export const exportShopWeeklyHtmlReport = ({
  planningData,
  shopId,
  selectedWeek,
  openPreview = true,
  alertOptions = DEFAULT_SHOP_REPORT_ALERT,
  sectionOptions = DEFAULT_SHOP_REPORT_SECTIONS
}) => {
  if (!planningData?.shops?.length || !shopId || !selectedWeek) {
    return { ok: false, reason: 'missing-data' };
  }
  const sections = normalizeSectionOptions(sectionOptions);
  if (!hasAnyShopReportSection(sections)) {
    return { ok: false, reason: 'no-sections' };
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
    employees,
    alertOptions: normalizeAlertOptions(alertOptions),
    sectionOptions: sections
  });

  const opts = normalizeAlertOptions(alertOptions);
  const title = `Équipe — ${shopName} — semaine du ${weekLabel}`;
  const doc = buildLandscapeHtmlDocument({
    title,
    bodyHtml,
    allowPortrait: true,
    metaLines: [
      `Boutique : ${shopName}`,
      `Semaine : ${weekLabel}`,
      `Alerte : moins de ${opts.minStaff} pers. entre ${opts.alertFrom} et ${opts.alertTo}`,
      `Généré le : ${new Date().toLocaleString('fr-FR')}`
    ]
  });

  const filename = `equipe_${sanitizeFilePart(shopName)}_${weekKey}.html`;
  return deliverLandscapeHtmlExport(doc, { filename, openPreview });
};
