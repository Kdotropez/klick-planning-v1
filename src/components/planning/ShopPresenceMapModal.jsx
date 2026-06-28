import React, { useMemo, useState, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import HtmlExportButton from '../common/HtmlExportButton';
import {
  buildPresenceWeekDays,
  buildPresenceMatrix,
  buildPresenceDayStatuses,
  buildPresenceWeekLabel,
  buildReadablePresenceDays,
  buildDayPlanningGridHtml,
  exportPresenceMapHtml
} from '../../utils/presenceMapExport';

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
  const [layoutMode, setLayoutMode] = useState('readable');
  const [scopeMode, setScopeMode] = useState('week');
  const [onlyOverlaps, setOnlyOverlaps] = useState(false);

  const weekDays = useMemo(
    () => buildPresenceWeekDays(mondayOfWeek, selectedWeek),
    [selectedWeek, mondayOfWeek]
  );

  const weekLabel = useMemo(() => buildPresenceWeekLabel(weekDays), [weekDays]);

  const matrix = useMemo(() => {
    if (!isOpen) return [];
    return buildPresenceMatrix({
      planning,
      config,
      employeeIds,
      employeeNameById,
      weekDays
    });
  }, [isOpen, config, weekDays, employeeIds, planning, employeeNameById]);

  const dayStatuses = useMemo(
    () => buildPresenceDayStatuses({ planning, employeeIds, employeeNameById, weekDays }),
    [weekDays, employeeIds, planning, employeeNameById]
  );

  const readableDays = useMemo(() => {
    if (!isOpen) return [];
    return buildReadablePresenceDays({
      planning,
      config,
      employeeIds,
      employeeNameById,
      weekDays,
      matrix
    });
  }, [isOpen, planning, config, employeeIds, employeeNameById, weekDays, matrix]);

  const visibleReadableDays = useMemo(() => {
    if (scopeMode === 'day') {
      return readableDays.filter((d) => d.day.index === currentDay);
    }
    return readableDays;
  }, [readableDays, scopeMode, currentDay]);

  const visibleRows = useMemo(() => {
    let rows = matrix;
    if (scopeMode === 'day') {
      rows = matrix.map((row) => ({
        ...row,
        dayCells: row.dayCells.filter((cell) => cell.index === currentDay)
      }));
    }
    if (onlyOverlaps) {
      rows = rows.filter((row) => {
        const maxCount = Math.max(0, ...row.dayCells.map((cell) => cell.count));
        return maxCount >= 2;
      });
    }
    return rows;
  }, [matrix, scopeMode, currentDay, onlyOverlaps]);

  const overlapStats = useMemo(() => {
    let slotsWithOverlap = 0;
    matrix.forEach((row) => {
      row.dayCells.forEach((cell) => {
        if (cell.count >= 2) slotsWithOverlap += 1;
      });
    });
    return { slotsWithOverlap };
  }, [matrix]);

  const exportArgs = useMemo(
    () => ({
      shopName,
      selectedWeek,
      mondayOfWeek,
      planning,
      config,
      employeeIds,
      employeeNameById,
      currentDay,
      readableScope: scopeMode
    }),
    [shopName, selectedWeek, mondayOfWeek, planning, config, employeeIds, employeeNameById, currentDay, scopeMode]
  );

  const handleExportShop = useCallback(() => {
    exportPresenceMapHtml({ ...exportArgs, mode: 'readable', exportTarget: 'shop' });
  }, [exportArgs]);

  const handleExportEmployees = useCallback(() => {
    exportPresenceMapHtml({
      ...exportArgs,
      mode: 'readable',
      exportTarget: 'employees'
    });
  }, [exportArgs]);

  if (!isOpen) return null;

  const columns =
    scopeMode === 'day' ? weekDays.filter((day) => day.index === currentDay) : weekDays;

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

  const currentDayInfo = weekDays[currentDay];

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
            background: 'linear-gradient(90deg, #0f766e 0%, #134e4a 100%)',
            color: '#fff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 12,
            flexShrink: 0
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Cartographie équipe boutique</h2>
            <div style={{ marginTop: 4, fontSize: 13, opacity: 0.95 }}>
              {shopName} · {weekLabel}
            </div>
            <div style={{ marginTop: 4, fontSize: 12, opacity: 0.85 }}>
              {layoutMode === 'readable'
                ? 'Vue par jour : prénom + horaires. Plus simple à lire qu’une grille créneau par créneau.'
                : 'Vue grille détaillée : qui est présente à chaque créneau horaire.'}
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
            onClick={() => setLayoutMode('readable')}
            style={toggleBtnStyle(layoutMode === 'readable', '#0f766e')}
          >
            Vue équipe (recommandée)
          </button>
          <button
            type="button"
            onClick={() => setLayoutMode('grid')}
            style={toggleBtnStyle(layoutMode === 'grid', '#0f4c75')}
          >
            Grille détaillée
          </button>
          <span style={{ width: 1, height: 24, background: '#cbd5e1', margin: '0 4px' }} />
          <button
            type="button"
            onClick={() => setScopeMode('week')}
            style={toggleBtnStyle(scopeMode === 'week', layoutMode === 'readable' ? '#0f766e' : '#0f4c75')}
          >
            Semaine
          </button>
          <button
            type="button"
            onClick={() => setScopeMode('day')}
            style={toggleBtnStyle(scopeMode === 'day', layoutMode === 'readable' ? '#0f766e' : '#0f4c75')}
          >
            Jour ({currentDayInfo?.shortLabel || '—'})
          </button>
          {layoutMode === 'grid' && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#334155' }}>
              <input
                type="checkbox"
                checked={onlyOverlaps}
                onChange={(event) => setOnlyOverlaps(event.target.checked)}
              />
              Chevauchements seulement (2+)
            </label>
          )}
          {layoutMode === 'grid' && (
            <span style={{ fontSize: 12, color: '#64748b', marginLeft: 'auto' }}>
              {overlapStats.slotsWithOverlap} créneau(x) à plusieurs
            </span>
          )}
        </div>

        <div
          style={{
            padding: '10px 16px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            alignItems: 'center',
            background: '#fff',
            flexShrink: 0
          }}
        >
          <HtmlExportButton
            label={scopeMode === 'day' ? '📱 HTML boutique (jour)' : '📱 HTML boutique (semaine)'}
            onClick={handleExportShop}
          />
          <HtmlExportButton
            label="📱 HTML 1 fichier / employée"
            onClick={handleExportEmployees}
          />
          {layoutMode === 'grid' && (
            <HtmlExportButton
              label="📱 HTML grille"
              onClick={() => exportPresenceMapHtml({ ...exportArgs, mode: 'week' })}
            />
          )}
        </div>

        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '12px 16px 16px',
            position: 'relative',
            background: layoutMode === 'readable' ? '#f1f5f9' : '#fff'
          }}
        >
          {layoutMode === 'readable' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {visibleReadableDays.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>Aucune donnée à afficher.</div>
              ) : (
                visibleReadableDays.map(({ day, roster, workingCount, teamMoments }, dayIndex) => (
                  <article
                    key={day.dayKey}
                    style={{
                      borderRadius: 12,
                      border: `2px solid ${day.palette.border}`,
                      overflow: 'hidden',
                      background: '#fff',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                    }}
                  >
                    <header
                      style={{
                        padding: '12px 16px',
                        background: day.palette.header,
                        color: day.palette.text,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 8,
                        flexWrap: 'wrap'
                      }}
                    >
                      <h3
                        style={{
                          margin: 0,
                          fontSize: 16,
                          fontWeight: 800,
                          textTransform: 'capitalize'
                        }}
                      >
                        {day.weekday} {format(parseISO(day.dayKey), 'dd/MM/yyyy')}
                        <span style={{ fontWeight: 600, opacity: 0.85, marginLeft: 6, fontSize: 13 }}>
                          (jour {dayIndex + 1})
                        </span>
                      </h3>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          padding: '4px 12px',
                          borderRadius: 999,
                          background: 'rgba(255,255,255,0.55)'
                        }}
                      >
                        {workingCount} en boutique
                      </span>
                    </header>

                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                      <thead>
                        <tr>
                          <th
                            style={{
                              textAlign: 'left',
                              padding: '8px 16px',
                              background: '#f8fafc',
                              color: '#64748b',
                              fontSize: 11,
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em'
                            }}
                          >
                            Prénom
                          </th>
                          <th
                            style={{
                              textAlign: 'left',
                              padding: '8px 16px',
                              background: '#f8fafc',
                              color: '#64748b',
                              fontSize: 11,
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em'
                            }}
                          >
                            Horaires
                          </th>
                          <th
                            style={{
                              textAlign: 'center',
                              padding: '8px 16px',
                              background: '#f8fafc',
                              color: '#64748b',
                              fontSize: 11,
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                              width: 72
                            }}
                          >
                            Durée (h)
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {roster.map((entry) => {
                          const highlighted = entry.id === highlightEmployeeId;
                          let hoursStyle = { color: '#0f766e', fontWeight: 600 };
                          let label = entry.rangesLabel;
                          let duration = entry.type === 'work' ? entry.hoursLabel || '—' : '—';
                          if (entry.type === 'conge') {
                            hoursStyle = { color: '#c2410c', fontWeight: 700 };
                            label = 'Congé ☀️';
                          } else if (entry.type === 'maladie') {
                            hoursStyle = { color: '#dc2626', fontWeight: 700 };
                            label = 'Maladie 🤒';
                          } else if (entry.type === 'repos') {
                            hoursStyle = { color: '#94a3b8', fontStyle: 'italic' };
                          }
                          return (
                            <tr key={entry.id}>
                              <td
                                style={{
                                  padding: '10px 16px',
                                  borderTop: '1px solid #e2e8f0',
                                  fontWeight: highlighted ? 800 : 700,
                                  color: '#0f172a'
                                }}
                              >
                                {entry.name}
                              </td>
                              <td style={{ padding: '10px 16px', borderTop: '1px solid #e2e8f0', ...hoursStyle }}>
                                {label}
                              </td>
                              <td
                                style={{
                                  padding: '10px 16px',
                                  borderTop: '1px solid #e2e8f0',
                                  textAlign: 'center',
                                  fontWeight: 700,
                                  color: '#0f172a'
                                }}
                              >
                                {duration}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {teamMoments.length > 0 && (
                      <div
                        style={{
                          margin: '0 16px 14px',
                          padding: '10px 12px',
                          borderRadius: 8,
                          background: '#ecfdf5',
                          border: '1px solid #6ee7b7'
                        }}
                      >
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            color: '#065f46',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            marginBottom: 8
                          }}
                        >
                          En boutique en même temps
                        </div>
                        {teamMoments.map((moment) => (
                          <div
                            key={`${day.dayKey}-${moment.ids}-${moment.start}`}
                            style={{ fontSize: 13, color: '#14532d', marginBottom: 4, lineHeight: 1.45 }}
                          >
                            <strong style={{ color: '#047857' }}>{moment.timeLabel}</strong>
                            {' — '}
                            {moment.names.join(', ')}
                          </div>
                        ))}
                      </div>
                    )}

                    <div
                      style={{ margin: '0 16px 14px', overflowX: 'auto' }}
                      dangerouslySetInnerHTML={{
                        __html: buildDayPlanningGridHtml({
                          day,
                          planning,
                          config,
                          employeeIds,
                          employeeNameById,
                          highlightEmployeeId
                        })
                      }}
                    />
                  </article>
                ))
              )}
            </div>
          ) : (
            <table
              style={{
                width: '100%',
                borderCollapse: 'separate',
                borderSpacing: 0,
                fontSize: 12,
                minWidth: scopeMode === 'week' ? 980 : 420
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
                          minWidth: scopeMode === 'day' ? 220 : 120,
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
                        .filter((cell) => scopeMode === 'week' || cell.index === currentDay)
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
          )}
        </div>
      </div>
    </div>
  );
};

const toggleBtnStyle = (active, accent = '#0f4c75') => ({
  padding: '6px 12px',
  borderRadius: 8,
  border: active ? `2px solid ${accent}` : '1px solid #cbd5e1',
  background: active ? accent : '#fff',
  color: active ? '#fff' : '#334155',
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: 12
});

export default ShopPresenceMapModal;
