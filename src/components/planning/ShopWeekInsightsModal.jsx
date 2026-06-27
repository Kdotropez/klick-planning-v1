import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  addDays,
  format,
  parse,
  parseISO,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  startOfMonth,
  endOfMonth
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { calculateEmployeeDailyHours, formatWorkedHoursForDisplay } from '../../utils/planningUtils';
import { buildSlotRangeLines, getSlotEndTimeFormatted } from '../../utils/slotDurationUtils';
import { isEmployeeOnLeave } from '../../utils/planningDataManager';
import WeeklyPlanningPrint from '../dashboard/WeeklyPlanningPrint';

const normSlot = (v) => v === true || v === 1 || v === '1' || v === 'true';

const describeCellForDay = (empId, dayKey, planning, config) => {
  const ep = planning?.[empId]?.[dayKey];
  if (ep === undefined || ep === null) return null;
  if (typeof ep === 'string') {
    return { type: 'status', text: ep };
  }
  if (Array.isArray(ep) && ep.some(normSlot)) {
    const ranges = buildSlotRangeLines(ep, config.timeSlots || [], {
      interval: config.interval || 30,
      endTime: config.endTime,
    });
    const h = calculateEmployeeDailyHours(empId, dayKey, { [empId]: planning[empId] }, config);
    return { type: 'slots', text: ranges.join(', ') || '—', h };
  }
  return null;
};

const DetailLayer = ({ title, onClose, children }) => (
  <div
    style={{
      position: 'fixed',
      inset: 0,
      zIndex: 51000,
      background: 'rgba(15,23,42,0.45)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20
    }}
    onClick={(e) => {
      e.stopPropagation();
      onClose();
    }}
  >
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.stopPropagation()}
      style={{
        width: 'min(560px, 100%)',
        maxHeight: 'min(80vh, 700px)',
        background: '#fff',
        borderRadius: 12,
        boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
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
          alignItems: 'center',
          gap: 12
        }}
      >
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{title}</h3>
        <button
          type="button"
          onClick={onClose}
          style={{
            border: '1px solid rgba(255,255,255,0.45)',
            background: 'rgba(255,255,255,0.12)',
            color: '#fff',
            borderRadius: 8,
            padding: '6px 12px',
            cursor: 'pointer',
            fontWeight: 600
          }}
        >
          Fermer
        </button>
      </div>
      <div style={{ padding: 16, overflow: 'auto', flex: 1, fontSize: 13, color: '#334155', lineHeight: 1.5 }}>
        {children}
      </div>
    </div>
  </div>
);

/**
 * Pilotage semaine (boutique courante) : couverture horaire, effectifs, absences.
 * Remplace l’ancienne « vue globale par jour » + le tableau de bord congés (une seule entrée).
 */
const ShopWeekInsightsModal = ({
  isOpen,
  onClose,
  planningData,
  selectedShop,
  selectedWeek,
  planning = {},
  config = {},
  currentShopEmployees = [],
  selectedEmployees = [],
  shops = [],
  changeShop,
  changeMonth,
  changeToSpecificWeek
}) => {
  const [tab, setTab] = useState('synthese');
  const [showPrint, setShowPrint] = useState(false);
  const [printAutoAction, setPrintAutoAction] = useState(null);
  /** '' = toute l'équipe (visible sur le planning) ; sinon un id employé */
  const [scopeEmployeeId, setScopeEmployeeId] = useState('');

  useEffect(() => {
    if (isOpen) {
      setTab('synthese');
      setScopeEmployeeId('');
    }
  }, [isOpen]);

  const timeSlots = config.timeSlots || [];
  const days = config.days || [
    { name: 'Lundi', short: 'Lun' },
    { name: 'Mardi', short: 'Mar' },
    { name: 'Mercredi', short: 'Mer' },
    { name: 'Jeudi', short: 'Jeu' },
    { name: 'Vendredi', short: 'Ven' },
    { name: 'Samedi', short: 'Sam' },
    { name: 'Dimanche', short: 'Dim' }
  ];

  const shopLabel = useMemo(() => {
    const s = shops.find((x) => x.id === selectedShop);
    return s?.name || selectedShop;
  }, [shops, selectedShop]);

  const visibleIds = useMemo(() => {
    const ids = (currentShopEmployees || []).map((e) => e.id);
    if (selectedEmployees?.length) {
      return selectedEmployees.filter((id) => ids.includes(id));
    }
    return ids;
  }, [currentShopEmployees, selectedEmployees]);

  useEffect(() => {
    if (scopeEmployeeId && !visibleIds.includes(scopeEmployeeId)) {
      setScopeEmployeeId('');
    }
  }, [visibleIds, scopeEmployeeId]);

  const scopedVisibleIds = useMemo(() => {
    if (!scopeEmployeeId) return visibleIds;
    return visibleIds.includes(scopeEmployeeId) ? [scopeEmployeeId] : [];
  }, [visibleIds, scopeEmployeeId]);

  const weekRangeLabel = useMemo(() => {
    if (!selectedWeek) return '';
    const a = startOfWeek(parseISO(selectedWeek), { weekStartsOn: 1 });
    const b = endOfWeek(parseISO(selectedWeek), { weekStartsOn: 1 });
    return `${format(a, 'd MMM', { locale: fr })} – ${format(b, 'd MMM yyyy', { locale: fr })}`;
  }, [selectedWeek]);

  const kpis = useMemo(() => {
    if (!isOpen || !selectedWeek) return null;
    let totalH = 0;
    const weekStart = startOfWeek(parseISO(selectedWeek), { weekStartsOn: 1 });
    const wDays = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) });
    const perDayHours = wDays.map((d) => format(d, 'yyyy-MM-dd')).map((dayKey) => {
      let h = 0;
      scopedVisibleIds.forEach((empId) => {
        h += calculateEmployeeDailyHours(empId, dayKey, planning, config);
      });
      return { dayKey, h };
    });
    perDayHours.forEach(({ h }) => {
      totalH += h;
    });
    const active = scopedVisibleIds.filter((empId) =>
      wDays.some((d) => {
        const dk = format(d, 'yyyy-MM-dd');
        return calculateEmployeeDailyHours(empId, dk, planning, config) > 0.001;
      })
    ).length;
    const openDays = perDayHours.filter((x) => x.h > 0.001).length;
    return { totalH, active, openDays, perDayHours, wDays };
  }, [isOpen, selectedWeek, planning, config, scopedVisibleIds]);

  const dayDetails = useMemo(() => {
    if (!isOpen || !selectedWeek) return [];
    return days.map((d, index) => {
      const dayKey = format(addDays(parseISO(selectedWeek), index), 'yyyy-MM-dd');
      const dayDate = addDays(parseISO(selectedWeek), index);
      let hours = 0;
      scopedVisibleIds.forEach((empId) => {
        hours += calculateEmployeeDailyHours(empId, dayKey, planning, config);
      });
      const slotData = timeSlots.map((slot, slotIndex) => {
        const c = scopedVisibleIds.filter(
          (empId) => normSlot(planning[empId]?.[dayKey]?.[slotIndex])
        ).length;
        return { time: slot, count: c };
      });
      let openT = null;
      let closeT = null;
      for (let i = 0; i < slotData.length; i += 1) {
        if (slotData[i].count > 0 && !openT) openT = slotData[i].time;
        if (slotData[i].count > 0) {
          closeT = getSlotEndTimeFormatted(timeSlots, i, config);
        }
      }
      const maxEmp = Math.max(0, ...slotData.map((s) => s.count));
      return {
        name: d.name,
        short: d.short,
        dayKey,
        dayDate,
        hours,
        openT: openT || null,
        closeT: closeT || null,
        maxEmp,
        hasWork: hours > 0.001
      };
    });
  }, [isOpen, selectedWeek, days, timeSlots, planning, config, scopedVisibleIds]);

  const absenceData = useMemo(() => {
    if (!isOpen || !planningData || !selectedWeek || !scopedVisibleIds.length) {
      return { employees: [], dayRows: [], monthLeaveTotal: 0, weekLeaveTotal: 0 };
    }
    const w0 = startOfWeek(parseISO(selectedWeek), { weekStartsOn: 1 });
    const wDays = eachDayOfInterval({ start: w0, end: addDays(w0, 6) });
    const m0 = startOfMonth(parseISO(selectedWeek));
    const m1 = endOfMonth(parseISO(selectedWeek));
    const mDays = eachDayOfInterval({ start: m0, end: m1 });

    const nameOf = (id) => currentShopEmployees.find((e) => e.id === id)?.name || id;
    const employees = [];
    scopedVisibleIds.forEach((empId) => {
      let wk = 0;
      let mo = 0;
      wDays.forEach((d) => {
        if (isEmployeeOnLeave(empId, format(d, 'yyyy-MM-dd'), planningData)) wk += 1;
      });
      mDays.forEach((d) => {
        if (isEmployeeOnLeave(empId, format(d, 'yyyy-MM-dd'), planningData)) mo += 1;
      });
      if (wk > 0 || mo > 0) {
        employees.push({ id: empId, name: nameOf(empId), week: wk, month: mo });
      }
    });
    employees.sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));

    const dayRows = wDays.map((d) => {
      const dk = format(d, 'yyyy-MM-dd');
      const names = [];
      scopedVisibleIds.forEach((empId) => {
        if (isEmployeeOnLeave(empId, dk, planningData)) names.push(nameOf(empId));
      });
      return {
        date: d,
        label: `${format(d, 'EEEE d MMM', { locale: fr })}`,
        count: names.length,
        names
      };
    });
    const monthLeaveTotal = employees.reduce((s, e) => s + e.month, 0);
    const weekLeaveTotal = employees.reduce((s, e) => s + e.week, 0);
    return { employees, dayRows, monthLeaveTotal, weekLeaveTotal };
  }, [isOpen, planningData, selectedWeek, scopedVisibleIds, currentShopEmployees]);

  const employeeWeekBreakdown = useMemo(() => {
    if (!isOpen || !selectedWeek) return [];
    const w0 = startOfWeek(parseISO(selectedWeek), { weekStartsOn: 1 });
    const wDays = eachDayOfInterval({ start: w0, end: addDays(w0, 6) });
    return scopedVisibleIds
      .map((empId) => {
        const name = currentShopEmployees.find((e) => e.id === empId)?.name || empId;
        let total = 0;
        const perDay = [];
        wDays.forEach((d) => {
          const dk = format(d, 'yyyy-MM-dd');
          const h = calculateEmployeeDailyHours(empId, dk, planning, config);
          total += h;
          if (h > 0.001) {
            perDay.push({ dk, label: format(d, 'EEE d MMM', { locale: fr }), h });
          }
        });
        return { id: empId, name, total, perDay };
      })
      .filter((x) => x.total > 0.001)
      .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
  }, [isOpen, selectedWeek, scopedVisibleIds, planning, config, currentShopEmployees]);

  const monthAbsenceDetailList = useMemo(() => {
    if (!isOpen || !planningData || !selectedWeek) return [];
    const m0 = startOfMonth(parseISO(selectedWeek));
    const m1 = endOfMonth(parseISO(selectedWeek));
    const mDays = eachDayOfInterval({ start: m0, end: m1 });
    return scopedVisibleIds
      .map((empId) => {
        const name = currentShopEmployees.find((e) => e.id === empId)?.name || empId;
        const dates = mDays
          .filter((d) => isEmployeeOnLeave(empId, format(d, 'yyyy-MM-dd'), planningData))
          .map((d) => format(d, 'EEEE d MMM', { locale: fr }));
        return { id: empId, name, dates, count: dates.length };
      })
      .filter((x) => x.count > 0)
      .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
  }, [isOpen, planningData, selectedWeek, scopedVisibleIds, currentShopEmployees]);

  const [detail, setDetail] = useState(null);

  const cardStyle = {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: 10,
    padding: '14px 16px',
    minWidth: 0
  };
  const valStyle = { fontSize: 22, fontWeight: 800, color: '#0f172a', margin: '4px 0 0' };
  const labelStyle = { fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' };

  const onWeekSelect = useCallback(
    (e) => {
      if (changeToSpecificWeek) changeToSpecificWeek(e.target.value);
    },
    [changeToSpecificWeek]
  );

  useEffect(() => {
    if (!isOpen) setDetail(null);
  }, [isOpen]);

  const tableSmall = { width: '100%', borderCollapse: 'collapse', fontSize: 12, background: '#fff', border: '1px solid #e2e8f0' };
  const thSmall = { textAlign: 'left', padding: '8px 10px', background: '#f1f5f9', fontWeight: 700, color: '#0f172a' };
  const tdSmall = { padding: '8px 10px', borderTop: '1px solid #e2e8f0' };

  const renderDetailBody = () => {
    if (!detail) return null;
    const k = detail.kind;
    if (k === 'heures-semaine' && kpis) {
      return (
        <div>
          <p style={{ marginTop: 0, color: '#64748b' }}>Boutique : {shopLabel}. Somme des durées sur la grille (employés listés sur le planning).</p>
          <h4 style={{ margin: '12px 0 8px', fontSize: 13 }}>Répartition par jour</h4>
          <table style={tableSmall}>
            <thead>
              <tr>
                <th style={thSmall}>Jour</th>
                <th style={{ ...thSmall, textAlign: 'right' }}>Heures</th>
              </tr>
            </thead>
            <tbody>
              {kpis.wDays.map((d, i) => {
                const dayKey = format(d, 'yyyy-MM-dd');
                const r = kpis.perDayHours[i];
                return (
                  <tr key={dayKey}>
                    <td style={tdSmall}>{format(d, 'EEEE d MMM', { locale: fr })}</td>
                    <td style={{ ...tdSmall, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {r.h.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <h4 style={{ margin: '16px 0 8px', fontSize: 13 }}>Répartition par employé</h4>
          {employeeWeekBreakdown.length === 0 ? (
            <p style={{ color: '#94a3b8' }}>Aucune heure comptée.</p>
          ) : (
            <table style={tableSmall}>
              <thead>
                <tr>
                  <th style={thSmall}>Employé</th>
                  <th style={{ ...thSmall, textAlign: 'right' }}>Total semaine</th>
                </tr>
              </thead>
              <tbody>
                {employeeWeekBreakdown.map((r) => (
                  <tr key={r.id}>
                    <td style={tdSmall}>{r.name}</td>
                    <td style={{ ...tdSmall, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {r.total.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      );
    }
    if (k === 'employes-actif' && kpis) {
      return (
        <div>
          <p style={{ marginTop: 0, color: '#64748b' }}>Employés avec au moins un créneau comptant des heures sur la semaine.</p>
          {employeeWeekBreakdown.length === 0 ? (
            <p style={{ color: '#94a3b8' }}>Aucun.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {employeeWeekBreakdown.map((r) => (
                <li key={r.id} style={{ marginBottom: 8 }}>
                  <strong>{r.name}</strong> — {formatWorkedHoursForDisplay(r.total)} sur la semaine
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                    {r.perDay.map((p) => p.label + ` (${formatWorkedHoursForDisplay(p.h)})`).join(' · ')}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    }
    if (k === 'jours-avec-heures' && kpis) {
      const open = kpis.wDays
        .map((d, i) => ({ d, h: kpis.perDayHours[i].h }))
        .filter((x) => x.h > 0.001);
      return (
        <div>
          <p style={{ marginTop: 0, color: '#64748b' }}>Jours où le total d’heures planifiées est &gt; 0.</p>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {open.map((x) => (
              <li key={x.d.toISOString()}>
                {format(x.d, 'EEEE d MMM yyyy', { locale: fr })} — {formatWorkedHoursForDisplay(x.h)}
              </li>
            ))}
          </ul>
        </div>
      );
    }
    if (k === 'conges-semaine-cumul' && absenceData) {
      return (
        <div>
          <p style={{ marginTop: 0, color: '#64748b' }}>Cumul « jours·personne » : chaque personne comptée chaque jour de congé sur la semaine affichée.</p>
          <h4 style={{ margin: '12px 0 8px', fontSize: 13 }}>Par jour</h4>
          <table style={tableSmall}>
            <thead>
              <tr>
                <th style={thSmall}>Jour</th>
                <th style={{ ...thSmall, textAlign: 'center', width: 48 }}>Nb</th>
                <th style={thSmall}>Personnes</th>
              </tr>
            </thead>
            <tbody>
              {absenceData.dayRows.map((r) => (
                <tr key={r.label}>
                  <td style={tdSmall}>{r.label}</td>
                  <td style={{ ...tdSmall, textAlign: 'center' }}>{r.count}</td>
                  <td style={tdSmall}>{r.names.length ? r.names.join(', ') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    if (k === 'conges-effectifs' && absenceData) {
      return (
        <div>
          <p style={{ marginTop: 0, color: '#64748b' }}>Employés du planning avec au moins un jour de congé détecté (semaine ou mois).</p>
          {absenceData.employees.length === 0 ? (
            <p style={{ color: '#94a3b8' }}>Aucun.</p>
          ) : (
            <table style={tableSmall}>
              <thead>
                <tr>
                  <th style={thSmall}>Employé</th>
                  <th style={{ ...thSmall, textAlign: 'right' }}>J. congé (semaine)</th>
                  <th style={{ ...thSmall, textAlign: 'right' }}>J. congé (mois)</th>
                </tr>
              </thead>
              <tbody>
                {absenceData.employees.map((e) => (
                  <tr key={e.id}>
                    <td style={tdSmall}>{e.name}</td>
                    <td style={{ ...tdSmall, textAlign: 'right' }}>{e.week}</td>
                    <td style={{ ...tdSmall, textAlign: 'right' }}>{e.month}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      );
    }
    if (k === 'conges-mois-cumul') {
      return (
        <div>
          <p style={{ marginTop: 0, color: '#64748b' }}>
            Mois : {format(parseISO(selectedWeek), 'MMMM yyyy', { locale: fr })}. Liste des jours reconnus en congé.
          </p>
          {monthAbsenceDetailList.length === 0 ? (
            <p style={{ color: '#94a3b8' }}>Aucun jour de congé sur le mois.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {monthAbsenceDetailList.map((e) => (
                <li key={e.id} style={{ marginBottom: 10 }}>
                  <strong>{e.name}</strong> — {e.count} j.
                  <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>{e.dates.join(' · ')}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    }
    if (k === 'jour' && detail.d) {
      const d = detail.d;
      const rows = [];
      scopedVisibleIds.forEach((empId) => {
        const name = currentShopEmployees.find((e) => e.id === empId)?.name || empId;
        const h = calculateEmployeeDailyHours(empId, d.dayKey, planning, config);
        const desc = describeCellForDay(empId, d.dayKey, planning, config);
        if (h > 0.001 || (desc && desc.type === 'status')) {
          let detailLine = '—';
          if (desc?.type === 'status') detailLine = desc.text;
          else if (desc?.type === 'slots') {
            detailLine = `${desc.text} — ${formatWorkedHoursForDisplay(h)}`;
          } else if (h > 0.001) detailLine = formatWorkedHoursForDisplay(h);
          rows.push({ name, detailLine, h });
        }
      });
      rows.sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
      return (
        <div>
          <p style={{ marginTop: 0, color: '#64748b' }}>{d.name} — {format(d.dayDate, 'dd/MM/yyyy', { locale: fr })}</p>
          <p>
            <strong>Total jour :</strong>{' '}
            {d.hours.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h
            {d.hasWork && (
              <>
                {' '}
                · <strong>Couverture :</strong> {d.openT} – {d.closeT} · <strong>Pic :</strong> {d.maxEmp} pers.
              </>
            )}
          </p>
          {rows.length === 0 ? (
            <p style={{ color: '#94a3b8' }}>Aucun créneau horaire (ou uniquement congé/maladie sans tranches).</p>
          ) : (
            <table style={tableSmall}>
              <thead>
                <tr>
                  <th style={thSmall}>Employé</th>
                  <th style={thSmall}>Détail</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={`${r.name}-${idx}`}>
                    <td style={{ ...tdSmall, fontWeight: 600 }}>{r.name}</td>
                    <td style={tdSmall}>{r.detailLine}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      );
    }
    if (k === 'absence-jour' && detail.row) {
      const r = detail.row;
      return (
        <div>
          <p style={{ marginTop: 0, color: '#64748b' }}>{r.label}</p>
          <p>
            <strong>{r.count}</strong> personne{r.count > 1 ? 's' : ''} en congé.
          </p>
          {r.names.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {r.names.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          ) : (
            <p style={{ color: '#94a3b8' }}>Aucun nom.</p>
          )}
        </div>
      );
    }
    if (k === 'absence-emp' && detail.emp) {
      const e = detail.emp;
      const w0 = startOfWeek(parseISO(selectedWeek), { weekStartsOn: 1 });
      const wDays = eachDayOfInterval({ start: w0, end: addDays(w0, 6) });
      const wLabels = wDays
        .filter((d) => isEmployeeOnLeave(e.id, format(d, 'yyyy-MM-dd'), planningData))
        .map((d) => format(d, 'EEEE d MMM', { locale: fr }));
      const m0 = startOfMonth(parseISO(selectedWeek));
      const m1 = endOfMonth(parseISO(selectedWeek));
      const mDays = eachDayOfInterval({ start: m0, end: m1 });
      const mLabels = mDays
        .filter((d) => isEmployeeOnLeave(e.id, format(d, 'yyyy-MM-dd'), planningData))
        .map((d) => format(d, 'EEEE d MMM', { locale: fr }));
      return (
        <div>
          <p style={{ marginTop: 0, color: '#64748b' }}>Congés détectés (aucun créneau travaillé sur toutes les boutiques d&apos;affectation pour ce jour).</p>
          <h4 style={{ margin: '12px 0 6px', fontSize: 13 }}>Jours sur la semaine affichée ({e.week} j. au total comptage)</h4>
          {wLabels.length ? <p style={{ fontSize: 12 }}>{wLabels.join(' · ')}</p> : <p style={{ color: '#94a3b8' }}>Aucun sur la semaine.</p>}
          <h4 style={{ margin: '14px 0 6px', fontSize: 13 }}>Jours sur le mois ({e.month} j. au total comptage)</h4>
          {mLabels.length ? (
            <p style={{ fontSize: 12, lineHeight: 1.6 }}>{mLabels.join(' · ')}</p>
          ) : (
            <p style={{ color: '#94a3b8' }}>Aucun sur le mois.</p>
          )}
        </div>
      );
    }
    return <p>—</p>;
  };

  const cardStyleClick = {
    ...cardStyle,
    cursor: 'pointer',
    transition: 'background 0.12s, border-color 0.12s'
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.55)',
        zIndex: 50000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 'min(1024px, 100%)',
          maxHeight: 'min(92vh, 900px)',
          background: '#fff',
          borderRadius: 12,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 48px rgba(0,0,0,0.18)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <header
          style={{
            padding: '16px 20px',
            background: 'linear-gradient(135deg, #0f4c75 0%, #1b4964 100%)',
            color: '#fff'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Pilotage de la semaine</h2>
              <p style={{ margin: '6px 0 0', fontSize: 13, opacity: 0.9, maxWidth: 640 }}>
                Indicateurs sur la <strong>boutique affichée</strong> (planning en cours) : heures planifiées, pointes
                d’effectif et absences détectées (aucun créneau sur les boutiques d’affectation = congé). Utilisez le
                menu <strong>Employé</strong> pour filtrer les cartes, les onglets et l’impression sur une seule
                personne.
              </p>
              <p style={{ margin: '6px 0 0', fontSize: 14, fontWeight: 600 }}>
                {shopLabel} · {weekRangeLabel}
                {scopeEmployeeId ? (
                  <span style={{ fontWeight: 500 }}>
                    {' '}
                    · {currentShopEmployees.find((e) => e.id === scopeEmployeeId)?.name || scopeEmployeeId}
                  </span>
                ) : null}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                border: '1px solid rgba(255,255,255,0.4)',
                background: 'rgba(255,255,255,0.1)',
                color: '#fff',
                borderRadius: 8,
                padding: '8px 16px',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              Fermer
            </button>
          </div>

          {planningData?.shops?.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 10,
                marginTop: 14,
                alignItems: 'center',
                fontSize: 13
              }}
            >
              {changeShop && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ opacity: 0.85 }}>Boutique</span>
                  <select
                    value={selectedShop}
                    onChange={(e) => changeShop(e.target.value)}
                    style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #94a3b8', minWidth: 160 }}
                  >
                    {planningData.shops.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name || s.id}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {changeMonth && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ opacity: 0.85 }}>Mois</span>
                  <select
                    value={format(parseISO(selectedWeek), 'yyyy-MM')}
                    onChange={(e) => changeMonth(e.target.value)}
                    style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #94a3b8' }}
                  >
                    {Array.from({ length: 24 }, (_, i) => {
                      const cur = parseISO(selectedWeek);
                      const d = new Date(cur.getFullYear(), cur.getMonth() - 6 + i, 1);
                      const key = format(d, 'yyyy-MM');
                      return (
                        <option key={key} value={key}>
                          {format(d, 'MMMM yyyy', { locale: fr })}
                        </option>
                      );
                    })}
                  </select>
                </label>
              )}
              {changeToSpecificWeek && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ opacity: 0.85 }}>Semaine</span>
                  <select
                    value={selectedWeek}
                    onChange={onWeekSelect}
                    style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #94a3b8', minWidth: 200 }}
                  >
                    {(() => {
                      const cur = parseISO(selectedWeek);
                      const mStart = startOfMonth(cur);
                      const mEnd = endOfMonth(cur);
                      const wks = [];
                      let w = startOfWeek(mStart, { weekStartsOn: 1 });
                      while (w <= mEnd) {
                        const key = format(w, 'yyyy-MM-dd');
                        const wEnd = endOfWeek(w, { weekStartsOn: 1 });
                        wks.push(
                          <option key={key} value={key}>
                            {format(w, 'd', { locale: fr })} – {format(wEnd, 'd MMM', { locale: fr })}
                          </option>
                        );
                        w = addDays(w, 7);
                      }
                      return wks;
                    })()}
                  </select>
                </label>
              )}
              {visibleIds.length > 0 && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ opacity: 0.85 }}>Employé</span>
                  <select
                    value={scopeEmployeeId}
                    onChange={(e) => setScopeEmployeeId(e.target.value)}
                    style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #94a3b8', minWidth: 200, maxWidth: 280 }}
                    title="Filtrer indicateurs, absences et impression sur un employé"
                  >
                    <option value="">Tous (équipe)</option>
                    {visibleIds.map((id) => {
                      const n = currentShopEmployees.find((e) => e.id === id)?.name || id;
                      return (
                        <option key={id} value={id}>
                          {n}
                        </option>
                      );
                    })}
                  </select>
                </label>
              )}
            </div>
          )}

          <nav style={{ display: 'flex', gap: 4, marginTop: 16, borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
            {[
              { id: 'synthese', label: 'Synthèse' },
              { id: 'jour', label: 'Jour par jour' },
              { id: 'absences', label: 'Absences' }
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                style={{
                  padding: '10px 16px',
                  border: 'none',
                  background: tab === t.id ? 'rgba(255,255,255,0.2)' : 'transparent',
                  color: '#fff',
                  fontWeight: tab === t.id ? 800 : 500,
                  cursor: 'pointer',
                  borderRadius: '8px 8px 0 0',
                  borderBottom: tab === t.id ? '3px solid #fff' : '3px solid transparent',
                  marginBottom: -1
                }}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </header>

        <div style={{ padding: 18, overflow: 'auto', flex: 1, background: '#f1f5f9' }}>
          {tab === 'synthese' && kpis && (
            <div>
              {scopeEmployeeId && (
                <p style={{ fontSize: 12, color: '#0f4c75', margin: '0 0 8px', fontWeight: 600 }}>
                  Périmètre : {currentShopEmployees.find((e) => e.id === scopeEmployeeId)?.name || scopeEmployeeId} — totaux, effectifs
                  et absences concernent uniquement cette personne.
                </p>
              )}
              <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 10px' }}>
                Cliquez sur une carte pour afficher le détail.
              </p>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: 12
                }}
              >
                <div
                  style={cardStyleClick}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setDetail({ kind: 'heures-semaine', title: 'Détail — heures planifiées (semaine)' });
                    }
                  }}
                  onClick={() => setDetail({ kind: 'heures-semaine', title: 'Détail — heures planifiées (semaine)' })}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f1f5f9';
                    e.currentTarget.style.borderColor = '#94a3b8';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#f8fafc';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                  }}
                >
                  <div style={labelStyle}>Heures planifiées (semaine)</div>
                  <div style={valStyle}>
                    {kpis.totalH.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>Somme des durées sur la grille (boutique actuelle)</div>
                </div>
                <div
                  style={cardStyleClick}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setDetail({ kind: 'employes-actif', title: "Détail — employés en activité" });
                    }
                  }}
                  onClick={() => setDetail({ kind: 'employes-actif', title: "Détail — employés en activité" })}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f1f5f9';
                    e.currentTarget.style.borderColor = '#94a3b8';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#f8fafc';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                  }}
                >
                  <div style={labelStyle}>Employés en activité</div>
                  <div style={valStyle}>{kpis.active}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
                    Au moins un créneau sur la semaine{scopeEmployeeId ? ' (employé filtré)' : ' (liste affichée)'}
                  </div>
                </div>
                <div
                  style={cardStyleClick}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setDetail({ kind: 'jours-avec-heures', title: 'Détail — jours avec heures' });
                    }
                  }}
                  onClick={() => setDetail({ kind: 'jours-avec-heures', title: 'Détail — jours avec heures' })}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f1f5f9';
                    e.currentTarget.style.borderColor = '#94a3b8';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#f8fafc';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                  }}
                >
                  <div style={labelStyle}>Jours avec heures</div>
                  <div style={valStyle}>
                    {kpis.openDays} / 7
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>Jours où le total &gt; 0 h</div>
                </div>
                <div
                  style={cardStyleClick}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setDetail({ kind: 'conges-semaine-cumul', title: "Détail — jours d'absence (semaine)" });
                    }
                  }}
                  onClick={() => setDetail({ kind: 'conges-semaine-cumul', title: "Détail — jours d'absence (semaine)" })}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f1f5f9';
                    e.currentTarget.style.borderColor = '#94a3b8';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#f8fafc';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                  }}
                >
                  <div style={labelStyle}>Jours d’absence (congé)</div>
                  <div style={valStyle}>{absenceData.weekLeaveTotal}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>Cumul sur la semaine (jours·personne)</div>
                </div>
                <div
                  style={cardStyleClick}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setDetail({ kind: 'conges-effectifs', title: "Détail — effectifs concernés (absence)" });
                    }
                  }}
                  onClick={() => setDetail({ kind: 'conges-effectifs', title: "Détail — effectifs concernés (absence)" })}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f1f5f9';
                    e.currentTarget.style.borderColor = '#94a3b8';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#f8fafc';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                  }}
                >
                  <div style={labelStyle}>Effectifs concernés (absence)</div>
                  <div style={valStyle}>{absenceData.employees.length}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>Avec au moins un jour congé (semaine ou mois)</div>
                </div>
                <div
                  style={cardStyleClick}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setDetail({ kind: 'conges-mois-cumul', title: "Détail — jours d'absence (mois)" });
                    }
                  }}
                  onClick={() => setDetail({ kind: 'conges-mois-cumul', title: "Détail — jours d'absence (mois)" })}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f1f5f9';
                    e.currentTarget.style.borderColor = '#94a3b8';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#f8fafc';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                  }}
                >
                  <div style={labelStyle}>Jours d’absence (mois)</div>
                  <div style={valStyle}>{absenceData.monthLeaveTotal}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>Calendaire {format(parseISO(selectedWeek), 'MMMM yyyy', { locale: fr })}</div>
                </div>
              </div>
            </div>
          )}

          {tab === 'jour' && (
            <div>
              <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 10px' }}>
                Cliquez sur un jour pour le détail par employé (créneaux / statut).
              </p>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: 12
                }}
              >
                {dayDetails.map((d) => (
                  <div
                    key={d.dayKey}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setDetail({ kind: 'jour', title: `Détail — ${d.name} ${format(d.dayDate, 'dd/MM', { locale: fr })}`, d });
                      }
                    }}
                    onClick={() => setDetail({ kind: 'jour', title: `Détail — ${d.name} ${format(d.dayDate, 'dd/MM', { locale: fr })}`, d })}
                    style={{
                      ...cardStyleClick,
                      borderColor: d.hasWork ? '#94a3b8' : '#e2e8f0',
                      opacity: d.hasWork ? 1 : 0.88
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f1f5f9';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#f8fafc';
                    }}
                  >
                    <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 15 }}>
                      {d.name} {format(d.dayDate, 'dd/MM', { locale: fr })}
                    </div>
                    <div style={{ marginTop: 10, fontSize: 20, fontWeight: 800, color: '#0d9488' }}>
                      {d.hours.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h
                    </div>
                    <div style={{ fontSize: 12, color: '#475569', marginTop: 8 }}>
                      {d.hasWork ? (
                        <>
                          Couverture : {d.openT} – {d.closeT}
                          <br />
                          Pic simultané : {d.maxEmp} pers.
                        </>
                      ) : (
                        'Aucune heure planifiée'
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'absences' && (
            <div style={{ maxWidth: 900 }}>
              <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 12px' }}>
                Cliquez sur une ligne pour le détail (jour ou personne).
              </p>
              <h3 style={{ fontSize: 15, color: '#0f172a', margin: '0 0 10px' }}>Par jour (semaine)</h3>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  background: '#fff',
                  fontSize: 13,
                  marginBottom: 20,
                  border: '1px solid #e2e8f0'
                }}
              >
                <thead>
                  <tr style={{ background: '#0f4c75', color: '#fff' }}>
                    <th style={{ textAlign: 'left', padding: 8 }}>Jour</th>
                    <th style={{ textAlign: 'center', padding: 8, width: 72 }}>Nb</th>
                    <th style={{ textAlign: 'left', padding: 8 }}>Personnes</th>
                  </tr>
                </thead>
                <tbody>
                  {absenceData.dayRows.map((r) => (
                    <tr
                      key={r.label}
                      style={{ borderTop: '1px solid #e2e8f0', cursor: 'pointer' }}
                      onClick={() => setDetail({ kind: 'absence-jour', title: r.label, row: r })}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f8fafc';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <td style={{ padding: 8 }}>{r.label}</td>
                      <td style={{ textAlign: 'center', padding: 8 }}>{r.count}</td>
                      <td style={{ padding: 8, color: r.names.length ? '#334155' : '#94a3b8' }}>
                        {r.names.length ? r.names.join(', ') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h3 style={{ fontSize: 15, color: '#0f172a', margin: '0 0 10px' }}>Par personne</h3>
              <table
                style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', fontSize: 13, border: '1px solid #e2e8f0' }}
              >
                <thead>
                  <tr style={{ background: '#0f4c75', color: '#fff' }}>
                    <th style={{ textAlign: 'left', padding: 8 }}>Employé</th>
                    <th style={{ textAlign: 'right', padding: 8, width: 100 }}>J. congé (semaine)</th>
                    <th style={{ textAlign: 'right', padding: 8, width: 100 }}>J. congé (mois)</th>
                  </tr>
                </thead>
                <tbody>
                  {absenceData.employees.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ padding: 16, textAlign: 'center', color: '#64748b' }}>
                        Aucune absence de ce type sur la période affichée.
                      </td>
                    </tr>
                  ) : (
                    absenceData.employees.map((e) => (
                      <tr
                        key={e.id}
                        style={{ borderTop: '1px solid #e2e8f0', cursor: 'pointer' }}
                        onClick={() => setDetail({ kind: 'absence-emp', title: e.name, emp: e })}
                        onMouseEnter={(ev) => {
                          ev.currentTarget.style.background = '#f8fafc';
                        }}
                        onMouseLeave={(ev) => {
                          ev.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <td style={{ padding: 8, fontWeight: 600 }}>{e.name}</td>
                        <td style={{ textAlign: 'right', padding: 8 }}>{e.week}</td>
                        <td style={{ textAlign: 'right', padding: 8 }}>{e.month}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <footer
          style={{
            padding: '12px 18px',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#fff'
          }}
        >
          <span style={{ fontSize: 11, color: '#64748b' }}>Klick — pilotage (données issues du planning en mémoire)</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => {
                setPrintAutoAction('pdf');
                setShowPrint(true);
              }}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                background: '#fff',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              📕 PDF planning
            </button>
            <button
              type="button"
              onClick={() => {
                setPrintAutoAction('html');
                setShowPrint(true);
              }}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                border: 'none',
                background: '#0f766e',
                color: '#fff',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              📱 HTML (paysage)
            </button>
          </div>
        </footer>
      </div>

      {detail && (
        <DetailLayer title={detail.title} onClose={() => setDetail(null)}>
          {renderDetailBody()}
        </DetailLayer>
      )}

      {showPrint && (
        <WeeklyPlanningPrint
          selectedShop={selectedShop}
          selectedWeek={selectedWeek}
          planningData={planningData}
          shops={shops}
          employees={
            scopeEmployeeId
              ? currentShopEmployees.filter((e) => e.id === scopeEmployeeId)
              : currentShopEmployees
          }
          config={config}
          autoAction={printAutoAction}
          onClose={() => {
            setShowPrint(false);
            setPrintAutoAction(null);
          }}
        />
      )}
    </div>
  );
};

export default ShopWeekInsightsModal;
