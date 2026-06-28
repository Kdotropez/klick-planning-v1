import { addDays, format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getSlotEndTimeFormatted, buildSlotRangeLines } from './slotDurationUtils';
import { buildLandscapeHtmlDocument, deliverLandscapeHtmlExport, escapeHtml } from './htmlLandscapeExport';

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
      rangesLabel: status === 'maladie' ? 'Maladie' : 'Congé'
    };
  }
  if (!Array.isArray(dayData)) {
    return { type: 'repos', ranges: [], rangesLabel: 'Repos' };
  }
  const ranges = buildSlotRangeLines(
    dayData,
    config?.timeSlots || [],
    slotDurationCfg(config)
  );
  if (!ranges.length) {
    return { type: 'repos', ranges: [], rangesLabel: 'Repos' };
  }
  return { type: 'work', ranges, rangesLabel: ranges.join(' · ') };
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
  .empty-day {
    padding: 16px 14px;
    color: #64748b;
    font-size: 13px;
    text-align: center;
  }
`;

export const buildReadablePresenceHtml = ({ readableDays, shopName, weekLabel }) => {
  const cards = readableDays
    .map(({ day, roster, workingCount, teamMoments }) => {
      const palette = day.palette;
      const rosterRows = roster
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
          return `<tr>
            <td class="emp-name-cell">${escapeHtml(entry.name)}</td>
            <td class="${hoursClass}">${label}</td>
          </tr>`;
        })
        .join('');

      const teamHtml =
        teamMoments.length > 0
          ? `<div class="team-block">
              <h3>En boutique en même temps</h3>
              ${teamMoments
                .map(
                  (m) =>
                    `<div class="team-line"><strong>${escapeHtml(m.timeLabel)}</strong> — ${escapeHtml(m.names.join(', '))}</div>`
                )
                .join('')}
            </div>`
          : '';

      const body =
        workingCount === 0 && roster.every((r) => r.type === 'repos')
          ? '<div class="empty-day">Personne planifiée ce jour.</div>'
          : `<table class="roster-table">
              <thead><tr><th>Prénom</th><th>Horaires</th></tr></thead>
              <tbody>${rosterRows}</tbody>
            </table>${teamHtml}`;

      return `<article class="day-card" style="border-color:${palette.border}">
        <header class="day-card-head" style="background:${palette.header};color:${palette.text}">
          <h2>${escapeHtml(day.weekday)} ${escapeHtml(format(parseISO(day.dayKey), 'dd/MM/yyyy'))}</h2>
          <span class="day-badge">${workingCount} en boutique</span>
        </header>
        ${body}
      </article>`;
    })
    .join('');

  return `<div class="schedule-sheet readable-presence">
    <style>${READABLE_STYLES}</style>
    ${cards}
    <p class="presence-note">Vue équipe : une carte par jour, prénom + plages horaires. Section verte = moments où plusieurs personnes se croisent.</p>
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
  shopName = '',
  selectedWeek = '',
  mondayOfWeek,
  planning = {},
  config = {},
  employeeIds = [],
  employeeNameById = new Map(),
  currentDay = 0
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

  if (mode === 'readable') {
    const daysFilter =
      readableScope === 'day'
        ? readableDaysAll.filter((d) => d.day.index === currentDay)
        : readableDaysAll;
    const bodyHtml = buildReadablePresenceHtml({ readableDays: daysFilter, shopName, weekLabel });
    const day = weekDays[currentDay] || weekDays[0];
    const title =
      readableScope === 'day'
        ? `Équipe — ${shopName} — ${day.weekday} ${format(parseISO(day.dayKey), 'dd/MM/yyyy')}`
        : `Équipe — ${shopName} — semaine ${weekLabel}`;
    const doc = buildLandscapeHtmlDocument({
      title,
      metaLines: [
        `Boutique : ${shopName}`,
        readableScope === 'day'
          ? `Jour : ${day.weekday} ${format(parseISO(day.dayKey), 'dd/MM/yyyy')}`
          : `Semaine : ${weekLabel}`,
        'Vue lisible : prénom et horaires par jour.'
      ],
      bodyHtml
    });
    deliverLandscapeHtmlExport(doc, {
      filename:
        readableScope === 'day'
          ? `equipe_${shopPart}_${day.dayKey}.html`
          : `equipe_${shopPart}_${weekPart}.html`,
      openPreview: true
    });
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
