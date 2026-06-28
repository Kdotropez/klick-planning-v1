import { addDays, format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getSlotEndTimeFormatted, buildSlotRangeLines } from './slotDurationUtils';
import { buildLandscapeHtmlDocument, deliverLandscapeHtmlExport, downloadLandscapeHtmlFile, escapeHtml } from './htmlLandscapeExport';
import { calculateEmployeeDailyHours, formatWorkedHoursNbNotation } from './planningUtils';

const normSlot = (value) => value === true || value === 1 || value === '1' || value === 'true';

export const DAY_PASTEL_COLORS = [
  { header: '#fce7f3', cell: '#fdf2f8', border: '#f9a8d4', text: '#831843' },
  { header: '#dbeafe', cell: '#eff6ff', border: '#93c5fd', text: '#1e3a8a' },
  { header: '#d1fae5', cell: '#ecfdf5', border: '#6ee7b7', text: '#065f46' },
  { header: '#fef3c7', cell: '#fffbeb', border: '#fcd34d', text: '#78350f' },
  { header: '#e9d5ff', cell: '#f5f3ff', border: '#c4b5fd', text: '#5b21b6' },
  { header: '#ffedd5', cell: '#fff7ed', border: '#fdba74', text: '#9a3412' },
  { header: '#ccfbf1', cell: '#f0fdfa', border: '#5eead4', text: '#115e59' }
];

export const getDayColor = (dayIndex) => DAY_PASTEL_COLORS[dayIndex % DAY_PASTEL_COLORS.length];

export const isStatusDay = (dayData) => {
  if (dayData == null) return null;
  if (typeof dayData === 'string') {
    const normalized = dayData.toLowerCase();
    if (normalized.includes('maladie')) return 'maladie';
    if (normalized.includes('congé') || normalized.includes('conge')) return 'conge';
    return 'status';
  }
  if (Array.isArray(dayData)) {
    if (dayData.some((v) => v === 'M' || (typeof v === 'string' && v.toLowerCase().includes('maladie')))) {
      return 'maladie';
    }
    if (
      dayData.some(
        (v) =>
          v === 'C' ||
          (typeof v === 'string' && (v.toLowerCase().includes('congé') || v.toLowerCase().includes('conge')))
      )
    ) {
      return 'conge';
    }
  }
  return null;
};

export const buildPresenceWeekDays = (mondayOfWeek, selectedWeek) => {
  if (!selectedWeek) return [];
  const anchor = mondayOfWeek || parseISO(selectedWeek);
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(anchor, index);
    const palette = getDayColor(index);
    return {
      index,
      dayKey: format(date, 'yyyy-MM-dd'),
      weekday: format(date, 'EEEE', { locale: fr }),
      shortLabel: format(date, 'EEE dd/MM', { locale: fr }),
      palette
    };
  });
};

export const buildPresenceMatrix = ({
  planning = {},
  config = {},
  employeeIds = [],
  employeeNameById = new Map(),
  weekDays = []
}) => {
  const timeSlots = config?.timeSlots || [];
  const durationCfg = { interval: config?.interval || 30, endTime: config?.endTime };
  if (!timeSlots.length || !weekDays.length) return [];

  return timeSlots.map((slot, slotIndex) => {
    const slotEnd = getSlotEndTimeFormatted(timeSlots, slotIndex, durationCfg);
    const slotLabel = `${slot} – ${slotEnd}`;
    const dayCells = weekDays.map((day) => {
      const present = employeeIds
        .filter((employeeId) => {
          const dayData = planning?.[employeeId]?.[day.dayKey];
          if (isStatusDay(dayData)) return false;
          return normSlot(dayData?.[slotIndex]);
        })
        .map((employeeId) => ({
          id: employeeId,
          name: employeeNameById.get(employeeId) || employeeId
        }));

      return {
        ...day,
        employees: present,
        count: present.length
      };
    });

    return { slotIndex, slotLabel, dayCells };
  });
};

export const buildPresenceDayStatuses = ({
  planning = {},
  employeeIds = [],
  employeeNameById = new Map(),
  weekDays = []
}) =>
  weekDays.map((day) => {
    const entries = employeeIds
      .map((employeeId) => {
        const status = isStatusDay(planning?.[employeeId]?.[day.dayKey]);
        if (!status) return null;
        return {
          id: employeeId,
          name: employeeNameById.get(employeeId) || employeeId,
          status
        };
      })
      .filter(Boolean);
    return { ...day, entries };
  });

const slotDurationCfg = (config) => ({
  interval: config?.interval || 30,
  endTime: config?.endTime
});

export const buildEmployeeDaySchedule = (planning, employeeId, day, config) => {
  const dayData = planning?.[employeeId]?.[day.dayKey];
  const status = isStatusDay(dayData);
  if (status) {
    return {
      type: status === 'maladie' ? 'maladie' : 'conge',
      ranges: [],
      rangesLabel: status === 'maladie' ? 'Maladie' : 'Congé',
      hours: 0,
      hoursLabel: '—'
    };
  }
  if (!Array.isArray(dayData)) {
    return { type: 'repos', ranges: [], rangesLabel: 'Repos', hours: 0, hoursLabel: '—' };
  }
  const ranges = buildSlotRangeLines(
    dayData,
    config?.timeSlots || [],
    slotDurationCfg(config)
  );
  if (!ranges.length) {
    return { type: 'repos', ranges: [], rangesLabel: 'Repos', hours: 0, hoursLabel: '—' };
  }
  const hours = calculateEmployeeDailyHours(
    employeeId,
    day.dayKey,
    { [employeeId]: planning[employeeId] },
    config
  );
  return {
    type: 'work',
    ranges,
    rangesLabel: ranges.join(' · '),
    hours,
    hoursLabel: formatWorkedHoursNbNotation(hours)
  };
};

/** Moments où 2+ personnes sont présentes (plages fusionnées). */
export const buildTeamMomentsForDay = (matrix, dayKey) => {
  const moments = [];
  let current = null;

  const flush = () => {
    if (current && current.count >= 2) moments.push(current);
    current = null;
  };

  matrix.forEach((row) => {
    const cell = row.dayCells.find((c) => c.dayKey === dayKey);
    const people = cell?.employees || [];
    if (!people.length) {
      flush();
      return;
    }
    const ids = people
      .map((p) => p.id)
      .sort()
      .join('|');
    const [slotStart] = String(row.slotLabel).split('–').map((s) => s.trim());
    const slotEnd = String(row.slotLabel).split('–').pop()?.trim() || slotStart;

    if (current && current.ids === ids) {
      current.end = slotEnd;
      current.timeLabel = `${current.start} → ${current.end}`;
    } else {
      flush();
      current = {
        ids,
        employeeIds: people.map((p) => p.id),
        names: people.map((p) => p.name),
        count: people.length,
        start: slotStart,
        end: slotEnd,
        timeLabel: `${slotStart} → ${slotEnd}`
      };
    }
  });
  flush();
  return moments;
};

export const buildReadablePresenceDays = ({
  planning = {},
  config = {},
  employeeIds = [],
  employeeNameById = new Map(),
  weekDays = [],
  matrix = []
}) =>
  weekDays.map((day) => {
    const roster = employeeIds
      .map((employeeId) => {
        const name = employeeNameById.get(employeeId) || employeeId;
        const schedule = buildEmployeeDaySchedule(planning, employeeId, day, config);
        return { id: employeeId, name, ...schedule };
      })
      .sort((a, b) => {
        const order = { work: 0, conge: 1, maladie: 2, repos: 3 };
        const da = order[a.type] ?? 9;
        const db = order[b.type] ?? 9;
        if (da !== db) return da - db;
        return a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' });
      });

    const workingCount = roster.filter((r) => r.type === 'work').length;
    const teamMoments = buildTeamMomentsForDay(matrix, day.dayKey);

    return {
      day,
      roster,
      workingCount,
      teamMoments
    };
  });

const EMPLOYEE_ROW_COLORS = [
  '#e6f0fa',
  '#e6ffed',
  '#ffe6e6',
  '#d0f0fa',
  '#f0e6fa',
  '#fffde6',
  '#d6e6ff'
];

const getDayStatusLabel = (dayData) => {
  if (dayData == null) return null;
  if (typeof dayData === 'string') return dayData;
  if (Array.isArray(dayData)) {
    if (dayData.some((v) => v === 'M' || (typeof v === 'string' && v.toLowerCase().includes('maladie')))) {
      return 'Maladie 🤒';
    }
    if (
      dayData.some(
        (v) =>
          v === 'C' ||
          (typeof v === 'string' && (v.toLowerCase().includes('congé') || v.toLowerCase().includes('conge')))
      )
    ) {
      return 'Congé ☀️';
    }
  }
  return null;
};

/** Grille type planning drag & drop pour un jour (employés × créneaux). */
export const buildDayPlanningGridHtml = ({
  day,
  planning = {},
  config = {},
  employeeIds = [],
  employeeNameById = new Map(),
  highlightEmployeeId = null
}) => {
  const timeSlots = config?.timeSlots || [];
  if (!timeSlots.length || !employeeIds.length) return '';

  const durationCfg = slotDurationCfg(config);
  const slotHeadersDe = timeSlots.map((slot) => escapeHtml(typeof slot === 'string' ? slot : slot?.start || ''));
  const slotHeadersA = timeSlots.map((slot, index) => {
    if (index < timeSlots.length - 1) {
      const next = timeSlots[index + 1];
      return escapeHtml(typeof next === 'string' ? next : next?.start || '');
    }
    return escapeHtml(getSlotEndTimeFormatted(timeSlots, index, durationCfg));
  });

  const rows = employeeIds
    .map((employeeId, employeeIndex) => {
      const name = employeeNameById.get(employeeId) || employeeId;
      const dayData = planning?.[employeeId]?.[day.dayKey];
      const statusLabel = getDayStatusLabel(dayData);
      const rowBg = EMPLOYEE_ROW_COLORS[employeeIndex % EMPLOYEE_ROW_COLORS.length];
      const highlighted = highlightEmployeeId && String(highlightEmployeeId) === String(employeeId);
      const rowStyle = highlighted ? 'outline:3px solid #2563eb;outline-offset:-2px;' : '';

      if (statusLabel) {
        const isMaladie = statusLabel.toLowerCase().includes('maladie');
        const statusBg = isMaladie ? '#fde8e8' : '#fff3e0';
        return `<tr style="${rowStyle}">
          <td class="pg-name" style="background:${rowBg}">${escapeHtml(name)}</td>
          <td class="pg-status" colspan="${timeSlots.length}" style="background:${statusBg};font-weight:700;text-align:center">
            ${escapeHtml(statusLabel)}
          </td>
        </tr>`;
      }

      const slots = Array.isArray(dayData) ? dayData : Array(timeSlots.length).fill(false);
      const cells = timeSlots
        .map((_, slotIndex) => {
          const on = normSlot(slots[slotIndex]);
          return `<td class="pg-slot${on ? ' pg-slot-on' : ''}">${on ? '✓' : ''}</td>`;
        })
        .join('');

      return `<tr style="${rowStyle}">
        <td class="pg-name" style="background:${rowBg}">${escapeHtml(name)}</td>
        ${cells}
      </tr>`;
    })
    .join('');

  return `<div class="planning-grid-block">
    <style>
      .planning-grid-block .pg-title { margin: 0 0 8px; font-size: 12px; font-weight: 800; color: #334155; text-transform: uppercase; letter-spacing: 0.04em; }
      .planning-grid-block .pg-scroll { overflow-x: auto; }
      .planning-grid-block .planning-grid-export { width: 100%; border-collapse: collapse; font-size: 9px; min-width: 640px; table-layout: fixed; }
      .planning-grid-block .planning-grid-export th, .planning-grid-block .planning-grid-export td { border: 1px solid #cbd5e1; padding: 3px 2px; text-align: center; vertical-align: middle; }
      .planning-grid-block .pg-corner { background: #f1f5f9; font-weight: 700; color: #475569; min-width: 72px; font-size: 9px; }
      .planning-grid-block .pg-time { background: #e2e8f0; font-weight: 600; color: #334155; font-size: 8px; }
      .planning-grid-block .pg-name { text-align: left; font-weight: 700; font-size: 10px; padding: 4px 6px; min-width: 72px; }
      .planning-grid-block .pg-slot { background: #fff; color: #cbd5e1; }
      .planning-grid-block .pg-slot-on { background: #22c55e; color: #fff; font-weight: 800; font-size: 10px; }
      .planning-grid-block .pg-status { font-size: 11px; }
    </style>
    <h3 class="pg-title">Planning du jour (grille horaires)</h3>
    <div class="pg-scroll">
      <table class="planning-grid-export">
        <thead>
          <tr>
            <th class="pg-corner">DE →</th>
            ${slotHeadersDe.map((h) => `<th class="pg-time">${h}</th>`).join('')}
          </tr>
          <tr>
            <th class="pg-corner">À →</th>
            ${slotHeadersA.map((h) => `<th class="pg-time">${h}</th>`).join('')}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>`;
};

const READABLE_STYLES = `
  .readable-presence { display: flex; flex-direction: column; gap: 14px; }
  .day-card {
    border-radius: 12px;
    border: 2px solid #cbd5e1;
    overflow: hidden;
    background: #fff;
    page-break-inside: avoid;
  }
  .day-card-head {
    padding: 10px 14px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .day-card-head h2 {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 800;
    text-transform: capitalize;
  }
  .day-badge {
    font-size: 11px;
    font-weight: 700;
    padding: 4px 10px;
    border-radius: 999px;
    background: rgba(255,255,255,0.65);
  }
  .roster-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  .roster-table th {
    text-align: left;
    padding: 8px 14px;
    background: #f1f5f9;
    color: #475569;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .roster-table td {
    padding: 9px 14px;
    border-top: 1px solid #e2e8f0;
    vertical-align: middle;
  }
  .roster-table tr:nth-child(even) td { background: #fafafa; }
  .emp-name-cell { font-weight: 700; color: #0f172a; min-width: 120px; }
  .hours-cell { color: #0f766e; font-weight: 600; }
  .status-conge { color: #c2410c; font-weight: 700; }
  .status-maladie { color: #dc2626; font-weight: 700; }
  .status-repos { color: #94a3b8; font-style: italic; }
  .team-block {
    margin: 0 14px 12px;
    padding: 10px 12px;
    border-radius: 8px;
    background: #ecfdf5;
    border: 1px solid #6ee7b7;
  }
  .team-block h3 {
    margin: 0 0 8px;
    font-size: 12px;
    color: #065f46;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .team-line {
    font-size: 12px;
    color: #14532d;
    margin-bottom: 4px;
    line-height: 1.4;
  }
  .team-line strong { color: #047857; }
  .duration-cell { color: #0f172a; font-weight: 700; text-align: center; white-space: nowrap; }
  .planning-grid-block {
    margin: 0 14px 14px;
    padding-top: 4px;
  }
  .pg-title {
    margin: 0 0 8px;
    font-size: 12px;
    font-weight: 800;
    color: #334155;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .pg-scroll { overflow-x: auto; }
  .planning-grid-export {
    width: 100%;
    border-collapse: collapse;
    font-size: 9px;
    min-width: 640px;
    table-layout: fixed;
  }
  .planning-grid-export th,
  .planning-grid-export td {
    border: 1px solid #cbd5e1;
    padding: 3px 2px;
    text-align: center;
    vertical-align: middle;
  }
  .planning-grid-export .pg-corner {
    background: #f1f5f9;
    font-weight: 700;
    color: #475569;
    min-width: 72px;
    font-size: 9px;
    position: sticky;
    left: 0;
    z-index: 1;
  }
  .planning-grid-export .pg-time {
    background: #e2e8f0;
    font-weight: 600;
    color: #334155;
    font-size: 8px;
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    height: 52px;
    padding: 2px;
  }
  .planning-grid-export .pg-name {
    text-align: left;
    font-weight: 700;
    font-size: 10px;
    padding: 4px 6px;
    min-width: 72px;
    position: sticky;
    left: 0;
    z-index: 1;
  }
  .planning-grid-export .pg-slot { background: #fff; color: #cbd5e1; }
  .planning-grid-export .pg-slot-on {
    background: #22c55e;
    color: #fff;
    font-weight: 800;
    font-size: 10px;
  }
  .planning-grid-export .pg-status { font-size: 11px; }
  .empty-day {
    padding: 16px 14px;
    color: #64748b;
    font-size: 13px;
    text-align: center;
  }
`;

export const buildReadablePresenceHtml = ({
  readableDays,
  shopName,
  weekLabel,
  planning = {},
  config = {},
  employeeIds = [],
  employeeNameById = new Map(),
  filterRosterEmployeeId = null,
  highlightEmployeeId = null
}) => {
  const cards = readableDays
    .map(({ day, roster, workingCount, teamMoments }, dayIndex) => {
      const palette = day.palette;
      const visibleRoster = filterRosterEmployeeId
        ? roster.filter((entry) => String(entry.id) === String(filterRosterEmployeeId))
        : roster;

      const rosterRows = visibleRoster
        .map((entry) => {
          let hoursClass = 'hours-cell';
          let label = escapeHtml(entry.rangesLabel);
          if (entry.type === 'conge') {
            hoursClass = 'status-conge';
            label = 'Congé ☀️';
          } else if (entry.type === 'maladie') {
            hoursClass = 'status-maladie';
            label = 'Maladie 🤒';
          } else if (entry.type === 'repos') {
            hoursClass = 'status-repos';
          }
          const duration =
            entry.type === 'work' ? escapeHtml(entry.hoursLabel || '—') : '—';
          return `<tr>
            <td class="emp-name-cell">${escapeHtml(entry.name)}</td>
            <td class="${hoursClass}">${label}</td>
            <td class="duration-cell">${duration}</td>
          </tr>`;
        })
        .join('');

      const visibleTeamMoments = filterRosterEmployeeId
        ? teamMoments.filter((m) =>
            (m.employeeIds || []).some((id) => String(id) === String(filterRosterEmployeeId))
          )
        : teamMoments;

      const teamHtml =
        visibleTeamMoments.length > 0
          ? `<div class="team-block">
              <h3>En boutique en même temps</h3>
              ${visibleTeamMoments
                .map(
                  (m) =>
                    `<div class="team-line"><strong>${escapeHtml(m.timeLabel)}</strong> — ${escapeHtml(m.names.join(', '))}</div>`
                )
                .join('')}
            </div>`
          : '';

      const planningGridHtml = buildDayPlanningGridHtml({
        day,
        planning,
        config,
        employeeIds,
        employeeNameById,
        highlightEmployeeId: highlightEmployeeId || filterRosterEmployeeId
      });

      const body =
        visibleRoster.length === 0
          ? '<div class="empty-day">Personne planifiée ce jour.</div>'
          : `<table class="roster-table">
              <thead><tr><th>Prénom</th><th>Horaires</th><th>Durée (h)</th></tr></thead>
              <tbody>${rosterRows}</tbody>
            </table>${teamHtml}${planningGridHtml}`;

      return `<article class="day-card" style="border-color:${palette.border}">
        <header class="day-card-head" style="background:${palette.header};color:${palette.text}">
          <h2>Jour ${dayIndex + 1} — ${escapeHtml(day.weekday)} ${escapeHtml(format(parseISO(day.dayKey), 'dd/MM/yyyy'))}</h2>
          <span class="day-badge">${workingCount} en boutique</span>
        </header>
        ${body}
      </article>`;
    })
    .join('');

  return `<div class="schedule-sheet readable-presence">
    <style>${READABLE_STYLES}</style>
    ${cards}
    <p class="presence-note">Par jour : équipe (prénom, horaires, durée), croisements simultanés, puis grille horaires type planning.</p>
  </div>`;
};

const PRESENCE_MAP_STYLES = `
  .presence-export { margin-bottom: 16px; }
  .presence-export table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
    min-width: 720px;
  }
  .presence-export th, .presence-export td {
    border: 1px solid #cbd5e1;
    padding: 5px 6px;
    vertical-align: top;
  }
  .presence-export .hour-col {
    background: #f8fafc;
    font-weight: 700;
    color: #334155;
    white-space: nowrap;
    min-width: 100px;
  }
  .presence-export .day-title {
    margin: 18px 0 8px;
    font-size: 1rem;
    font-weight: 800;
    color: #0f4c75;
    border-bottom: 2px solid #cbd5e1;
    padding-bottom: 4px;
    text-transform: capitalize;
  }
  .presence-export .day-title:first-child { margin-top: 0; }
  .presence-export .status-foot td { font-size: 10px; }
  .presence-export .empty { color: #94a3b8; }
  .presence-export .emp-name { line-height: 1.35; margin-bottom: 2px; }
  .presence-note {
    font-size: 11px;
    color: #64748b;
    margin-top: 10px;
    line-height: 1.45;
  }
`;

const sanitizeFilePart = (value) =>
  String(value || 'boutique')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_.]+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 40);

const renderEmployeesCell = (employees) => {
  if (!employees?.length) return '<span class="empty">—</span>';
  return employees.map((e) => `<div class="emp-name">${escapeHtml(e.name)}</div>`).join('');
};

const renderStatusFoot = (dayStatuses, columns) => {
  const rows = columns
    .map((day) => {
      const statusDay = dayStatuses.find((entry) => entry.dayKey === day.dayKey);
      const content = !statusDay?.entries?.length
        ? '<span class="empty">—</span>'
        : statusDay.entries
            .map(
              (entry) =>
                `<div>${escapeHtml(entry.name)} (${entry.status === 'maladie' ? 'Maladie' : 'Congé'})</div>`
            )
            .join('');
      return `<td style="background:${day.palette.header};color:${day.palette.text};border-color:${day.palette.border}">${content}</td>`;
    })
    .join('');
  return `<tr class="status-foot"><th class="hour-col" style="color:#9a3412">Congés / maladie</th>${rows}</tr>`;
};

export const buildPresenceWeekMatrixHtml = ({ matrix, dayStatuses, weekDays, viewDays = null }) => {
  const columns = viewDays || weekDays;
  const visibleMatrix = viewDays
    ? matrix.map((row) => ({
        ...row,
        dayCells: row.dayCells.filter((cell) => viewDays.some((d) => d.dayKey === cell.dayKey))
      }))
    : matrix;

  const headerCells = columns
    .map(
      (day) =>
        `<th style="background:${day.palette.header};color:${day.palette.text};border-color:${day.palette.border};text-align:center;text-transform:capitalize">
          <div style="font-weight:800">${escapeHtml(day.weekday)}</div>
          <div style="font-size:10px;opacity:0.85">${escapeHtml(format(parseISO(day.dayKey), 'dd/MM'))}</div>
        </th>`
    )
    .join('');

  const bodyRows = visibleMatrix
    .map((row) => {
      const cells = row.dayCells
        .filter((cell) => columns.some((d) => d.dayKey === cell.dayKey))
        .map((cell) => {
          const palette = cell.palette;
          return `<td style="background:${palette.cell};border-color:${palette.border};color:${palette.text}">${renderEmployeesCell(cell.employees)}</td>`;
        })
        .join('');
      return `<tr><th class="hour-col">${escapeHtml(row.slotLabel)}</th>${cells}</tr>`;
    })
    .join('');

  return `<div class="schedule-sheet presence-export">
    <style>${PRESENCE_MAP_STYLES}</style>
    <table>
      <thead><tr><th class="hour-col">Heure</th>${headerCells}</tr></thead>
      <tbody>${bodyRows}${renderStatusFoot(dayStatuses, columns)}</tbody>
    </table>
  </div>`;
};

export const buildPresenceDailySectionsHtml = ({ matrix, dayStatuses, weekDays }) => {
  const sections = weekDays
    .map((day) => {
      const statusDay = dayStatuses.find((entry) => entry.dayKey === day.dayKey);
      const statusHtml = !statusDay?.entries?.length
        ? '<span class="empty">—</span>'
        : statusDay.entries
            .map(
              (entry) =>
                `<div>${escapeHtml(entry.name)} — ${entry.status === 'maladie' ? 'Maladie' : 'Congé'}</div>`
            )
            .join('');

      const rows = matrix
        .map((row) => {
          const cell = row.dayCells.find((c) => c.dayKey === day.dayKey);
          const hasPeople = cell?.employees?.length > 0;
          if (!hasPeople) return '';
          return `<tr>
            <th class="hour-col">${escapeHtml(row.slotLabel)}</th>
            <td style="background:${day.palette.cell};border-color:${day.palette.border};color:${day.palette.text}">
              ${renderEmployeesCell(cell.employees)}
            </td>
          </tr>`;
        })
        .filter(Boolean)
        .join('');

      const tableBody =
        rows ||
        '<tr><td colspan="2" style="text-align:center;color:#64748b;padding:16px">Aucun créneau planifié ce jour.</td></tr>';

      return `<section>
        <h2 class="day-title" style="border-color:${day.palette.border};color:${day.palette.text}">
          ${escapeHtml(day.weekday)} ${escapeHtml(format(parseISO(day.dayKey), 'dd/MM/yyyy'))}
        </h2>
        <table>
          <thead>
            <tr>
              <th class="hour-col">Heure</th>
              <th style="background:${day.palette.header};color:${day.palette.text};border-color:${day.palette.border}">Qui travaille</th>
            </tr>
          </thead>
          <tbody>${tableBody}</tbody>
          <tfoot>
            <tr class="status-foot">
              <th class="hour-col" style="color:#9a3412">Congés / maladie</th>
              <td style="background:${day.palette.header};color:${day.palette.text};border-color:${day.palette.border}">${statusHtml}</td>
            </tr>
          </tfoot>
        </table>
      </section>`;
    })
    .join('');

  return `<div class="schedule-sheet presence-export">
    <style>${PRESENCE_MAP_STYLES}</style>
    ${sections}
    <p class="presence-note">Une section par jour : qui est présente, créneau par créneau. Les lignes vides (personne) sont masquées pour une lecture plus rapide.</p>
  </div>`;
};

export const buildPresenceWeekLabel = (weekDays) => {
  if (!weekDays.length) return '';
  const start = weekDays[0].dayKey;
  const end = weekDays[6].dayKey;
  return `${format(parseISO(start), 'd MMMM', { locale: fr })} → ${format(parseISO(end), 'd MMMM yyyy', { locale: fr })}`;
};

export const exportPresenceMapHtml = ({
  mode = 'week',
  readableScope = 'week',
  exportTarget = 'shop',
  shopName = '',
  selectedWeek = '',
  mondayOfWeek,
  planning = {},
  config = {},
  employeeIds = [],
  employeeNameById = new Map(),
  currentDay = 0,
  onChainComplete = null
}) => {
  const weekDays = buildPresenceWeekDays(mondayOfWeek, selectedWeek);
  if (!weekDays.length) return { ok: false, reason: 'no-week' };

  const matrix = buildPresenceMatrix({ planning, config, employeeIds, employeeNameById, weekDays });
  const dayStatuses = buildPresenceDayStatuses({ planning, employeeIds, employeeNameById, weekDays });
  const weekLabel = buildPresenceWeekLabel(weekDays);
  const shopPart = sanitizeFilePart(shopName);
  const weekPart = selectedWeek || weekDays[0].dayKey;

  const readableDaysAll = buildReadablePresenceDays({
    planning,
    config,
    employeeIds,
    employeeNameById,
    weekDays,
    matrix
  });

  const buildReadableDoc = ({
    daysFilter,
    filterRosterEmployeeId = null,
    highlightEmployeeId = null,
    title,
    metaLines,
    filename
  }) => {
    const bodyHtml = buildReadablePresenceHtml({
      readableDays: daysFilter,
      shopName,
      weekLabel,
      planning,
      config,
      employeeIds,
      employeeNameById,
      filterRosterEmployeeId,
      highlightEmployeeId
    });
    return {
      doc: buildLandscapeHtmlDocument({ title, metaLines, bodyHtml }),
      filename
    };
  };

  if (mode === 'readable') {
    const daysFilter =
      readableScope === 'day'
        ? readableDaysAll.filter((d) => d.day.index === currentDay)
        : readableDaysAll;
    const day = weekDays[currentDay] || weekDays[0];

    if (exportTarget === 'employees') {
      const targets = employeeIds.filter(Boolean);
      if (!targets.length) return { ok: false, reason: 'no-employees' };

      const runChain = (idx) => {
        if (idx >= targets.length) {
          if (typeof onChainComplete === 'function') {
            onChainComplete(targets.length);
          }
          return;
        }
        const employeeId = targets[idx];
        const empName = employeeNameById.get(employeeId) || employeeId;
        const empPart = sanitizeFilePart(empName);
        const { doc, filename } = buildReadableDoc({
          daysFilter,
          filterRosterEmployeeId: employeeId,
          highlightEmployeeId: employeeId,
          title: `Équipe — ${empName} — ${shopName} — ${readableScope === 'day' ? day.weekday : `semaine ${weekLabel}`}`,
          metaLines: [
            `Employée : ${empName}`,
            `Boutique : ${shopName}`,
            readableScope === 'day'
              ? `Jour : ${day.weekday} ${format(parseISO(day.dayKey), 'dd/MM/yyyy')}`
              : `Semaine : ${weekLabel}`,
            'Votre ligne est surlignée dans la grille horaires.'
          ],
          filename:
            readableScope === 'day'
              ? `equipe_${empPart}_${shopPart}_${day.dayKey}.html`
              : `equipe_${empPart}_${shopPart}_${weekPart}.html`
        });
        if (idx === 0) {
          deliverLandscapeHtmlExport(doc, { filename, openPreview: true });
        } else {
          downloadLandscapeHtmlFile(doc, filename);
        }
        setTimeout(() => runChain(idx + 1), 450);
      };
      runChain(0);
      return { ok: true, mode: 'employees-chain', count: targets.length };
    }

    const { doc, filename } = buildReadableDoc({
      daysFilter,
      title:
        readableScope === 'day'
          ? `Équipe — ${shopName} — ${day.weekday} ${format(parseISO(day.dayKey), 'dd/MM/yyyy')}`
          : `Équipe — ${shopName} — semaine ${weekLabel}`,
      metaLines: [
        `Boutique : ${shopName}`,
        readableScope === 'day'
          ? `Jour : ${day.weekday} ${format(parseISO(day.dayKey), 'dd/MM/yyyy')}`
          : `Semaine : ${weekLabel}`,
        'Vue équipe complète : récap, croisements et grille horaires par jour.'
      ],
      filename:
        readableScope === 'day'
          ? `equipe_boutique_${shopPart}_${day.dayKey}.html`
          : `equipe_boutique_${shopPart}_${weekPart}.html`
    });
    deliverLandscapeHtmlExport(doc, { filename, openPreview: true });
    return { ok: true };
  }

  if (mode === 'day') {
    const day = weekDays[currentDay] || weekDays[0];
    const bodyHtml = buildPresenceWeekMatrixHtml({
      matrix,
      dayStatuses,
      weekDays,
      viewDays: [day]
    });
    const doc = buildLandscapeHtmlDocument({
      title: `Cartographie — ${shopName} — ${day.weekday} ${format(parseISO(day.dayKey), 'dd/MM/yyyy')}`,
      metaLines: [
        `Boutique : ${shopName}`,
        `Jour : ${day.weekday} ${format(parseISO(day.dayKey), 'dd/MM/yyyy')}`,
        'Grille horaire : qui est présente à chaque créneau.'
      ],
      bodyHtml
    });
    deliverLandscapeHtmlExport(doc, {
      filename: `cartographie_${shopPart}_${day.dayKey}.html`,
      openPreview: true
    });
    return { ok: true };
  }

  if (mode === 'days') {
    const bodyHtml = buildPresenceDailySectionsHtml({ matrix, dayStatuses, weekDays });
    const doc = buildLandscapeHtmlDocument({
      title: `Cartographie journalière — ${shopName} — semaine ${weekLabel}`,
      metaLines: [
        `Boutique : ${shopName}`,
        `Semaine : ${weekLabel}`,
        '7 sections (une par jour) avec la présence horaire.'
      ],
      bodyHtml
    });
    deliverLandscapeHtmlExport(doc, {
      filename: `cartographie_jours_${shopPart}_${weekPart}.html`,
      openPreview: true
    });
    return { ok: true };
  }

  const bodyHtml = buildPresenceWeekMatrixHtml({ matrix, dayStatuses, weekDays });
  const doc = buildLandscapeHtmlDocument({
    title: `Cartographie semaine — ${shopName} — ${weekLabel}`,
    metaLines: [
      `Boutique : ${shopName}`,
      `Semaine : ${weekLabel}`,
      'Grille jour × heure : qui est présente simultanément.'
    ],
    bodyHtml
  });
  deliverLandscapeHtmlExport(doc, {
    filename: `cartographie_semaine_${shopPart}_${weekPart}.html`,
    openPreview: true
  });
  return { ok: true };
};
