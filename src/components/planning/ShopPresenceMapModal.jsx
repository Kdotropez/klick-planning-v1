import React, { useMemo, useState } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getSlotEndTimeFormatted } from '../../utils/slotDurationUtils';

const normSlot = (value) => value === true || value === 1 || value === '1' || value === 'true';

const DAY_PASTEL_COLORS = [
  { header: '#fce7f3', cell: '#fdf2f8', border: '#f9a8d4', text: '#831843' },
  { header: '#dbeafe', cell: '#eff6ff', border: '#93c5fd', text: '#1e3a8a' },
  { header: '#d1fae5', cell: '#ecfdf5', border: '#6ee7b7', text: '#065f46' },
  { header: '#fef3c7', cell: '#fffbeb', border: '#fcd34d', text: '#78350f' },
  { header: '#e9d5ff', cell: '#f5f3ff', border: '#c4b5fd', text: '#5b21b6' },
  { header: '#ffedd5', cell: '#fff7ed', border: '#fdba74', text: '#9a3412' },
  { header: '#ccfbf1', cell: '#f0fdfa', border: '#5eead4', text: '#115e59' }
];

const getDayColor = (dayIndex) => DAY_PASTEL_COLORS[dayIndex % DAY_PASTEL_COLORS.length];

const isStatusDay = (dayData) => {
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

const ShopPresenceMapModal = ({
  isOpen,
  onClose,
  shopName,
  selectedWeek,
  mondayOfWeek,
  planning = {},
  config = {},
  employeeIds = [],
  employeeNameById = new Map(),
  currentDay = 0,
  highlightEmployeeId = ''
}) => {
  const [viewMode, setViewMode] = useState('week');
  const [onlyOverlaps, setOnlyOverlaps] = useState(false);

  const timeSlots = config?.timeSlots || [];
  const durationCfg = { interval: config?.interval || 30, endTime: config?.endTime };

  const weekDays = useMemo(() => {
    if (!selectedWeek) return [];
    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(mondayOfWeek || parseISO(selectedWeek), index);
      const palette = getDayColor(index);
      return {
        index,
        dayKey: format(date, 'yyyy-MM-dd'),
        weekday: format(date, 'EEEE', { locale: fr }),
        shortLabel: format(date, 'EEE dd/MM', { locale: fr }),
        palette
      };
    });
  }, [selectedWeek, mondayOfWeek]);

  const weekLabel = useMemo(() => {
    if (!weekDays.length) return '';
    const start = weekDays[0].dayKey;
    const end = weekDays[6].dayKey;
    return `${format(parseISO(start), 'd MMMM', { locale: fr })} → ${format(parseISO(end), 'd MMMM yyyy', { locale: fr })}`;
  }, [weekDays]);

  const matrix = useMemo(() => {
    if (!isOpen || !timeSlots.length || !weekDays.length) return [];

    return timeSlots.map((slot, slotIndex) => {
      const slotEnd = getSlotEndTimeFormatted(timeSlots, slotIndex, durationCfg);
      const slotLabel = `${slot} – ${slotEnd}`;
      const dayCells = weekDays.map((day) => {
        const present = employeeIds
          .filter((employeeId) => {
            const dayData = planning?.[employeeId]?.[day.dayKey];
            const status = isStatusDay(dayData);
            if (status) return false;
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

      const maxCount = Math.max(0, ...dayCells.map((cell) => cell.count));
      return { slotIndex, slotLabel, dayCells, maxCount };
    });
  }, [isOpen, timeSlots, weekDays, employeeIds, planning, employeeNameById, durationCfg]);

  const dayStatuses = useMemo(() => {
    return weekDays.map((day) => {
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
  }, [weekDays, employeeIds, planning, employeeNameById]);

  const visibleRows = useMemo(() => {
    let rows = matrix;
    if (viewMode === 'day') {
      rows = matrix.map((row) => ({
        ...row,
        dayCells: row.dayCells.filter((cell) => cell.index === currentDay)
      }));
    }
    if (onlyOverlaps) {
      rows = rows.filter((row) => row.maxCount >= 2);
    }
    return rows;
  }, [matrix, viewMode, currentDay, onlyOverlaps]);

  const overlapStats = useMemo(() => {
    let slotsWithOverlap = 0;
    matrix.forEach((row) => {
      row.dayCells.forEach((cell) => {
        if (cell.count >= 2) slotsWithOverlap += 1;
      });
    });
    return { slotsWithOverlap };
  }, [matrix]);

  if (!isOpen) return null;

  const columns = viewMode === 'day'
    ? weekDays.filter((day) => day.index === currentDay)
    : weekDays;

  const hourColStyle = {
    position: 'sticky',
    left: 0,
    zIndex: 2,
    background: '#f8fafc',
    border: '1px solid #cbd5e1',
    padding: '6px 8px',
    fontWeight: 700,
    color: '#334155',
    whiteSpace: 'nowrap',
    minWidth: 110
  };

  const hourHeaderStyle = {
    ...hourColStyle,
    position: 'sticky',
    top: 0,
    left: 0,
    zIndex: 6,
    textAlign: 'left',
    padding: '8px 10px',
    boxShadow: '2px 2px 4px rgba(0,0,0,0.06)'
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 52000,
        background: 'rgba(15, 23, 42, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
        style={{
          width: 'min(1280px, 100%)',
          maxHeight: 'min(92vh, 900px)',
          background: '#fff',
          borderRadius: 14,
          boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            padding: '14px 18px',
            background: 'linear-gradient(90deg, #0f4c75 0%, #1b4964 100%)',
            color: '#fff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 12,
            flexShrink: 0
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Cartographie présence boutique</h2>
            <div style={{ marginTop: 4, fontSize: 13, opacity: 0.95 }}>
              {shopName} · {weekLabel}
            </div>
            <div style={{ marginTop: 4, fontSize: 12, opacity: 0.85 }}>
              Qui est présent en même temps, créneau par créneau (jour × heure).
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: '1px solid rgba(255,255,255,0.45)',
              background: 'rgba(255,255,255,0.12)',
              color: '#fff',
              borderRadius: 8,
              padding: '8px 14px',
              cursor: 'pointer',
              fontWeight: 700
            }}
          >
            Fermer
          </button>
        </div>

        <div
          style={{
            padding: '10px 16px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            alignItems: 'center',
            background: '#f8fafc',
            flexShrink: 0
          }}
        >
          <button
            type="button"
            onClick={() => setViewMode('week')}
            style={toggleBtnStyle(viewMode === 'week')}
          >
            Semaine complète
          </button>
          <button
            type="button"
            onClick={() => setViewMode('day')}
            style={toggleBtnStyle(viewMode === 'day')}
          >
            Jour affiché ({weekDays[currentDay]?.shortLabel || '—'})
          </button>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#334155' }}>
            <input
              type="checkbox"
              checked={onlyOverlaps}
              onChange={(event) => setOnlyOverlaps(event.target.checked)}
            />
            Uniquement les chevauchements (2+ personnes)
          </label>
          <span style={{ fontSize: 12, color: '#64748b', marginLeft: 'auto' }}>
            {overlapStats.slotsWithOverlap} créneau(x) avec chevauchement sur la semaine
          </span>
        </div>

        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '0 16px 16px',
            position: 'relative'
          }}
        >
          <table
            style={{
              width: '100%',
              borderCollapse: 'separate',
              borderSpacing: 0,
              fontSize: 12,
              minWidth: viewMode === 'week' ? 980 : 420
            }}
          >
            <thead>
              <tr>
                <th style={hourHeaderStyle}>Heure</th>
                {columns.map((day) => {
                  const isCurrent = day.index === currentDay;
                  return (
                    <th
                      key={day.dayKey}
                      style={{
                        position: 'sticky',
                        top: 0,
                        zIndex: 5,
                        border: `1px solid ${day.palette.border}`,
                        padding: '8px 6px',
                        background: day.palette.header,
                        textAlign: 'center',
                        minWidth: viewMode === 'day' ? 220 : 120,
                        textTransform: 'capitalize',
                        color: day.palette.text,
                        boxShadow: isCurrent
                          ? 'inset 0 -3px 0 #0f4c75, 0 2px 4px rgba(0,0,0,0.06)'
                          : '0 2px 4px rgba(0,0,0,0.06)'
                      }}
                    >
                      <div style={{ fontWeight: 800 }}>{day.weekday}</div>
                      <div style={{ fontSize: 11, opacity: 0.85 }}>{format(parseISO(day.dayKey), 'dd/MM')}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 1} style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>
                    Aucun créneau à afficher avec les filtres actuels.
                  </td>
                </tr>
              ) : (
                visibleRows.map((row) => (
                  <tr key={row.slotIndex}>
                    <td style={hourColStyle}>{row.slotLabel}</td>
                    {row.dayCells
                      .filter((cell) => viewMode === 'week' || cell.index === currentDay)
                      .map((cell) => {
                        const palette = cell.palette;
                        const highlights = highlightEmployeeId
                          ? cell.employees.some((employee) => employee.id === highlightEmployeeId)
                          : false;
                        return (
                          <td
                            key={`${row.slotIndex}-${cell.dayKey}`}
                            style={{
                              border: `1px solid ${highlights ? '#2563eb' : palette.border}`,
                              background: palette.cell,
                              padding: '5px 6px',
                              verticalAlign: 'top',
                              minHeight: 36
                            }}
                          >
                            {cell.employees.length === 0 ? (
                              <span style={{ color: '#94a3b8' }}>—</span>
                            ) : (
                              cell.employees.map((employee) => (
                                <div
                                  key={employee.id}
                                  style={{
                                    fontSize: 11,
                                    fontWeight: employee.id === highlightEmployeeId ? 800 : 600,
                                    color: palette.text,
                                    lineHeight: 1.35,
                                    marginBottom: 2
                                  }}
                                >
                                  {employee.name}
                                </div>
                              ))
                            )}
                          </td>
                        );
                      })}
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr>
                <td
                  style={{
                    ...hourColStyle,
                    fontWeight: 800,
                    color: '#9a3412'
                  }}
                >
                  Congés / maladie
                </td>
                {columns.map((day) => {
                  const statusDay = dayStatuses.find((entry) => entry.dayKey === day.dayKey);
                  return (
                    <td
                      key={`status-${day.dayKey}`}
                      style={{
                        border: `1px solid ${day.palette.border}`,
                        background: day.palette.header,
                        padding: '6px',
                        verticalAlign: 'top',
                        fontSize: 11,
                        color: day.palette.text
                      }}
                    >
                      {!statusDay?.entries?.length ? (
                        <span style={{ color: '#94a3b8' }}>—</span>
                      ) : (
                        statusDay.entries.map((entry) => (
                          <div key={entry.id} style={{ marginBottom: 3 }}>
                            {entry.name} ({entry.status === 'maladie' ? '🤒' : '☀️'})
                          </div>
                        ))
                      )}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};

const toggleBtnStyle = (active) => ({
  padding: '6px 12px',
  borderRadius: 8,
  border: active ? '2px solid #0f4c75' : '1px solid #cbd5e1',
  background: active ? '#0f4c75' : '#fff',
  color: active ? '#fff' : '#334155',
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: 12
});

export default ShopPresenceMapModal;
