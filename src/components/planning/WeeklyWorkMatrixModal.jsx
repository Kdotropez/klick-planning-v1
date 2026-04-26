import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { loadFromLocalStorage } from '../../utils/localStorage';
import { isEmployeeVisibleForRecap } from '../../utils/planningDataManager';
import { calculateEmployeeDailyHours } from '../../utils/planningUtils';

const normalizeSlot = (value) => value === true || value === 1 || value === '1' || value === 'true';

const slotRanges = (slots, timeSlots = [], interval = 30) => {
  const ranges = [];
  let startIndex = null;
  for (let i = 0; i < slots.length; i += 1) {
    const selected = normalizeSlot(slots[i]);
    if (selected && startIndex === null) startIndex = i;
    if (!selected && startIndex !== null) {
      const start = timeSlots[startIndex];
      const endBase = timeSlots[Math.max(0, i - 1)];
      if (start && endBase) {
        const [eh, em] = String(endBase).split(':').map((n) => Number.parseInt(n, 10) || 0);
        const endDate = new Date(2000, 0, 1, eh, em + interval, 0);
        ranges.push(`${start}-${format(endDate, 'HH:mm')}`);
      }
      startIndex = null;
    }
  }
  if (startIndex !== null) {
    const start = timeSlots[startIndex];
    const last = timeSlots[Math.max(0, timeSlots.length - 1)];
    if (start && last) {
      const [eh, em] = String(last).split(':').map((n) => Number.parseInt(n, 10) || 0);
      const endDate = new Date(2000, 0, 1, eh, em + interval, 0);
      ranges.push(`${start}-${format(endDate, 'HH:mm')}`);
    }
  }
  return ranges;
};

const sumHoursDayForScope = (
  planningData,
  resolvePlanningForShop,
  employeeId,
  dayKey,
  recapShopKey
) => {
  let total = 0;
  (planningData.shops || []).forEach((shop) => {
    if (recapShopKey !== 'all' && String(shop.id) !== String(recapShopKey)) return;
    if (!isEmployeeVisibleForRecap(planningData, employeeId, shop.id)) return;
    const wk = resolvePlanningForShop(shop);
    if (!wk?.[employeeId]) return;
    const cfg = shop.config;
    if (!cfg?.timeSlots?.length) return;
    const slice = { [employeeId]: wk[employeeId] };
    total += calculateEmployeeDailyHours(employeeId, dayKey, slice, cfg);
  });
  return total;
};

const isCongeStatus = (value) => /cong[eé]/i.test(String(value ?? ''));
const isMaladieStatus = (value) => /maladie/i.test(String(value ?? ''));

const WeeklyWorkMatrixModal = ({
  isOpen,
  onClose,
  planningData,
  selectedWeek,
  currentShopId,
  currentWeekPlanning = {}
}) => {
  const [recapShopKey, setRecapShopKey] = useState('all');
  /** 'employees' = une ligne par employé ; 'shops' = une ligne par boutique, 1ʳᵉ col. = boutique. */
  const [tableView, setTableView] = useState('employees');
  const wasModalOpen = useRef(false);

  /** À l'ouverture : périmètre = boutique affichée dans le planning (ou « toutes » si aucune). */
  useEffect(() => {
    if (isOpen && !wasModalOpen.current) {
      setRecapShopKey(currentShopId ? String(currentShopId) : 'all');
    }
    wasModalOpen.current = isOpen;
  }, [isOpen, currentShopId]);

  const weekLabel = useMemo(() => {
    if (!selectedWeek) return '';
    const start = parseISO(selectedWeek);
    const end = addDays(start, 6);
    return `${format(start, 'dd/MM/yyyy', { locale: fr })} → ${format(end, 'dd/MM/yyyy', { locale: fr })}`;
  }, [selectedWeek]);

  const weekDays = useMemo(() => {
    if (!selectedWeek) return [];
    const base = parseISO(selectedWeek);
    return Array.from({ length: 7 }, (_, i) => addDays(base, i));
  }, [selectedWeek]);

  const resolvePlanningForShop = useCallback(
    (shop) => {
      if (currentShopId && shop.id === currentShopId && currentWeekPlanning && Object.keys(currentWeekPlanning).length) {
        return currentWeekPlanning;
      }
      const w = shop.weeks?.[selectedWeek];
      const inline = w?.planning;
      if (inline && typeof inline === 'object' && Object.keys(inline).length > 0) {
        return inline;
      }
      return loadFromLocalStorage(`planning_${shop.id}_${selectedWeek}`, {});
    },
    [currentShopId, currentWeekPlanning, selectedWeek]
  );

  const selectedShopName = useMemo(() => {
    if (recapShopKey === 'all') return null;
    return (planningData?.shops || []).find((s) => String(s.id) === String(recapShopKey))?.name;
  }, [recapShopKey, planningData?.shops]);

  const matrix = useMemo(() => {
    if (!isOpen || !selectedWeek || !planningData?.shops?.length) {
      return { rows: [] };
    }

    const employeeMap = new Map();
    (planningData.shops || []).forEach((shop) => {
      (shop.employees || []).forEach((emp) => {
        if (!employeeMap.has(emp.id)) employeeMap.set(emp.id, emp.name || emp.id);
      });
    });

    const employeeIdsSet = new Set();
    (planningData.shops || []).forEach((shop) => {
      if (recapShopKey !== 'all' && String(shop.id) !== String(recapShopKey)) return;
      const weekPlanning = resolvePlanningForShop(shop);
      if (!weekPlanning || typeof weekPlanning !== 'object') return;
      Object.keys(weekPlanning).forEach((id) => {
        if (isEmployeeVisibleForRecap(planningData, id, shop.id)) {
          employeeIdsSet.add(id);
        }
      });
    });

    const uniqueEmpIds = Array.from(employeeIdsSet).filter((id) => {
      if (recapShopKey === 'all') {
        return isEmployeeVisibleForRecap(planningData, id, null);
      }
      return isEmployeeVisibleForRecap(planningData, id, recapShopKey);
    });
    uniqueEmpIds.forEach((id) => {
      if (!employeeMap.has(id)) employeeMap.set(id, id);
    });

    const rows = uniqueEmpIds
      .map((employeeId) => {
        const name = employeeMap.get(employeeId) || employeeId;
        const dayCells = weekDays.map((dayDate) => {
          const dayKey = format(dayDate, 'yyyy-MM-dd');
          const dayLabel = `${format(dayDate, 'EEE', { locale: fr })} ${format(dayDate, 'dd/MM')}`;
          const entries = [];
            (planningData.shops || []).forEach((shop) => {
            if (recapShopKey !== 'all' && String(shop.id) !== String(recapShopKey)) return;
            if (!isEmployeeVisibleForRecap(planningData, employeeId, shop.id)) return;
            const wk = resolvePlanningForShop(shop);
            const ep = wk?.[employeeId];
            if (!ep) return;
            const dayValue = ep[dayKey];
            if (dayValue === undefined || dayValue === null) return;
            if (typeof dayValue === 'string') {
              entries.push({ shopName: shop.name || shop.id, value: dayValue });
              return;
            }
            if (Array.isArray(dayValue) && dayValue.some(normalizeSlot)) {
              const cfg = shop.config || {};
              const ranges = slotRanges(
                dayValue,
                cfg.timeSlots || [],
                cfg.interval || 30
              );
              if (ranges.length > 0) {
                entries.push({ shopName: shop.name || shop.id, value: ranges.join(', ') });
              }
            }
          });

          if (entries.some((e) => isCongeStatus(e.value))) {
            return { dayLabel, display: 'Congé', hoursH: 0 };
          }
          if (entries.some((e) => isMaladieStatus(e.value))) {
            return { dayLabel, display: 'Maladie', hoursH: 0 };
          }
          if (entries.length === 0) {
            const hoursH = sumHoursDayForScope(
              planningData,
              resolvePlanningForShop,
              employeeId,
              dayKey,
              recapShopKey
            );
            return { dayLabel, display: '—', hoursH };
          }
          const block = entries
            .map((e) => `${e.shopName} : ${e.value}`)
            .join('\n');
          const hoursH = sumHoursDayForScope(
            planningData,
            resolvePlanningForShop,
            employeeId,
            dayKey,
            recapShopKey
          );
          return { dayLabel, display: block, hoursH };
        });
        const weekHours = dayCells.reduce((s, c) => s + (typeof c.hoursH === 'number' ? c.hoursH : 0), 0);
        return { employeeId, name, dayCells, weekHours };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));

    return { rows };
  }, [isOpen, selectedWeek, planningData, weekDays, resolvePlanningForShop, recapShopKey]);

  const shopMatrix = useMemo(() => {
    if (!isOpen || !selectedWeek || !planningData?.shops?.length) {
      return { rows: [] };
    }

    const employeeMap = new Map();
    (planningData.shops || []).forEach((shop) => {
      (shop.employees || []).forEach((emp) => {
        if (!employeeMap.has(emp.id)) employeeMap.set(emp.id, emp.name || emp.id);
      });
    });

    const shopsInScope = (planningData.shops || []).filter((shop) => {
      if (recapShopKey !== 'all' && String(shop.id) !== String(recapShopKey)) return false;
      return true;
    });

    const rows = shopsInScope
      .map((shop) => {
        const wk = resolvePlanningForShop(shop) || {};
        const eligible = new Set();
        Object.keys(wk).forEach((id) => {
          if (isEmployeeVisibleForRecap(planningData, id, shop.id)) {
            if (!employeeMap.has(id)) employeeMap.set(id, id);
            eligible.add(id);
          }
        });

        const dayCells = weekDays.map((dayDate) => {
          const dayKey = format(dayDate, 'yyyy-MM-dd');
          const dayLabel = `${format(dayDate, 'EEE', { locale: fr })} ${format(dayDate, 'dd/MM')}`;
          const parts = [];
          let dayHoursSum = 0;

          const sortedIds = Array.from(eligible).sort((a, b) => {
            const na = employeeMap.get(a) || a;
            const nb = employeeMap.get(b) || b;
            return na.localeCompare(nb, 'fr', { sensitivity: 'base' });
          });

          sortedIds.forEach((employeeId) => {
            const name = employeeMap.get(employeeId) || employeeId;
            const ep = wk[employeeId];
            if (!ep) return;
            const dayValue = ep[dayKey];
            if (dayValue === undefined || dayValue === null) return;

            if (typeof dayValue === 'string') {
              if (isCongeStatus(dayValue)) {
                parts.push({ text: `${name} — Congé`, h: 0 });
                return;
              }
              if (isMaladieStatus(dayValue)) {
                parts.push({ text: `${name} — Maladie`, h: 0 });
                return;
              }
              parts.push({ text: `${name} — ${dayValue}`, h: 0 });
              return;
            }

            if (Array.isArray(dayValue) && dayValue.some(normalizeSlot)) {
              const cfg = shop.config || {};
              const ranges = slotRanges(
                dayValue,
                cfg.timeSlots || [],
                cfg.interval || 30
              );
              const slice = { [employeeId]: ep };
              const h = calculateEmployeeDailyHours(employeeId, dayKey, slice, cfg);
              dayHoursSum += h;
              const tranche = ranges.length ? ranges.join(', ') : '—';
              parts.push({
                text: h > 0.001 ? `${name} : ${tranche} (${h.toFixed(1)} h)` : `${name} : ${tranche}`,
                h
              });
            }
          });

          const display = parts.length === 0 ? '—' : parts.map((p) => p.text).join('\n');
          return { dayKey, dayLabel, display, hoursH: dayHoursSum };
        });

        const weekTotal = dayCells.reduce((s, c) => s + (typeof c.hoursH === 'number' ? c.hoursH : 0), 0);
        return {
          shopId: shop.id,
          shopName: shop.name || String(shop.id),
          dayCells,
          weekTotal
        };
      })
      .sort((a, b) => a.shopName.localeCompare(b.shopName, 'fr', { sensitivity: 'base' }));

    return { rows };
  }, [isOpen, selectedWeek, planningData, weekDays, resolvePlanningForShop, recapShopKey]);

  const exportPdf = () => {
    if (tableView === 'shops') {
      const { rows: shopRows } = shopMatrix;
      if (!shopRows.length) return;
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text('Par boutique — qui est present (semaine)', pageW / 2, 12, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(
        recapShopKey === 'all'
          ? 'Perimetre : toutes les boutiques'
          : `Perimetre : ${selectedShopName || String(recapShopKey)}`,
        pageW / 2,
        18,
        { align: 'center' }
      );
      doc.setFontSize(9);
      doc.text(weekLabel, pageW / 2, 24, { align: 'center' });
      doc.text(`Genere le ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: fr })}`, pageW / 2, 29, { align: 'center' });

      const head = [
        [
          'Boutique',
          ...weekDays.map((d) => `${format(d, 'EEE', { locale: fr })} ${format(d, 'dd/MM')}`),
          'Total h'
        ]
      ];
      const body = shopRows.map((r) => [
        r.shopName,
        ...r.dayCells.map((c) => c.display.replace(/\n/g, ' | ')),
        `${r.weekTotal.toFixed(1)} h`
      ]);

      doc.autoTable({
        startY: 35,
        head,
        body,
        styles: { fontSize: 6.5, cellPadding: 1.2, lineColor: [200, 200, 200], lineWidth: 0.1 },
        headStyles: { fillColor: [33, 80, 130], textColor: 255, fontStyle: 'bold', halign: 'center' },
        bodyStyles: { valign: 'top' },
        columnStyles: {
          0: { cellWidth: 26, fontStyle: 'bold' },
          8: { cellWidth: 14, fontStyle: 'bold', halign: 'right' }
        }
      });
      const scopeSlug = recapShopKey === 'all' ? 'toutes' : String(recapShopKey).replace(/[^\w-]+/g, '_');
      doc.save(`recap_semaine_par_boutique_${scopeSlug}_${selectedWeek}.pdf`);
      return;
    }

    const { rows } = matrix;
    if (!rows.length) return;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('Qui travaille ou — semaine', pageW / 2, 12, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(
      recapShopKey === 'all'
        ? 'Perimetre : toutes les boutiques'
        : `Perimetre : ${selectedShopName || String(recapShopKey)}`,
      pageW / 2,
      18,
      { align: 'center' }
    );
    doc.setFontSize(9);
    doc.text(weekLabel, pageW / 2, 24, { align: 'center' });
    doc.text(`Genere le ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: fr })}`, pageW / 2, 29, { align: 'center' });

    const head = [
      [
        'Employe',
        ...weekDays.map((d) => `${format(d, 'EEE', { locale: fr })} ${format(d, 'dd/MM')}`),
        'Total h'
      ]
    ];
    const body = rows.map((r) => [
      r.name,
      ...r.dayCells.map((c) => {
        const t = c.display.replace(/\n/g, ' | ');
        const h = typeof c.hoursH === 'number' ? c.hoursH : 0;
        return h > 0.001 ? `${t}  (${h.toFixed(1)} h)` : t;
      }),
      `${r.weekHours.toFixed(1)} h`
    ]);

    doc.autoTable({
      startY: 35,
      head,
      body,
      styles: { fontSize: 7, cellPadding: 1.4, lineColor: [200, 200, 200], lineWidth: 0.1 },
      headStyles: { fillColor: [33, 80, 130], textColor: 255, fontStyle: 'bold', halign: 'center' },
      bodyStyles: { valign: 'top' },
      columnStyles: {
        0: { cellWidth: 28, fontStyle: 'bold' },
        8: { cellWidth: 16, fontStyle: 'bold', halign: 'right' }
      }
    });
    const scopeSlug = recapShopKey === 'all' ? 'toutes' : String(recapShopKey).replace(/[^\w-]+/g, '_');
    doc.save(`recap_semaine_qui_ou_${scopeSlug}_${selectedWeek}.pdf`);
  };

  if (!isOpen) return null;

  const { rows } = matrix;
  const { rows: shopRows } = shopMatrix;
  const canExport =
    tableView === 'employees' ? rows.length > 0 : shopRows.length > 0;
  const showEmpty =
    tableView === 'employees' ? !rows.length : !shopRows.length;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 60000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px',
        boxSizing: 'border-box'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 'min(1280px, 100%)',
          maxHeight: 'min(90vh, 900px)',
          background: '#fff',
          borderRadius: '10px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 12px 40px rgba(0,0,0,0.2)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '14px 18px',
            background: 'linear-gradient(90deg, #1a5276 0%, #215a7a 100%)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px'
          }}
        >
          <div>
            <div style={{ fontSize: '18px', fontWeight: 800 }}>Récapitulatif semaine — qui travaille où</div>
            <div style={{ fontSize: '13px', opacity: 0.92, marginTop: '4px' }}>
              {recapShopKey === 'all'
                ? 'Toutes les boutiques'
                : `Boutique : ${selectedShopName || String(recapShopKey)}`}{' '}
              · {weekLabel}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                color: 'rgba(255,255,255,0.95)',
                fontSize: '13px',
                fontWeight: 600
              }}
            >
              Boutique (récap)
              <select
                value={recapShopKey}
                onChange={(e) => setRecapShopKey(e.target.value)}
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255,255,255,0.4)',
                  background: 'rgba(255,255,255,0.15)',
                  color: '#0f172a',
                  maxWidth: '220px',
                  fontWeight: 600
                }}
              >
                <option value="all">Toutes les boutiques</option>
                {(planningData?.shops || []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name || s.id}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={exportPdf}
              disabled={!canExport}
              style={{
                padding: '8px 14px',
                borderRadius: '6px',
                border: 'none',
                background: canExport ? '#0d9488' : '#94a3b8',
                color: '#fff',
                cursor: canExport ? 'pointer' : 'not-allowed',
                fontWeight: 600
              }}
            >
              Exporter PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 14px',
                borderRadius: '6px',
                border: '1px solid rgba(255,255,255,0.4)',
                background: 'transparent',
                color: '#fff',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              Fermer
            </button>
          </div>
        </div>

        <div
          style={{
            padding: '10px 16px',
            background: '#e8eef4',
            borderBottom: '1px solid #cbd5e1',
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
            flexWrap: 'wrap'
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Organisation du tableau :</span>
          <button
            type="button"
            onClick={() => setTableView('employees')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: tableView === 'employees' ? '2px solid #1a5276' : '1px solid #94a3b8',
              background: tableView === 'employees' ? '#1a5276' : '#fff',
              color: tableView === 'employees' ? '#fff' : '#334155',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '12px'
            }}
          >
            Par employé — 1re colonne : employé
          </button>
          <button
            type="button"
            onClick={() => setTableView('shops')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: tableView === 'shops' ? '2px solid #1a5276' : '1px solid #94a3b8',
              background: tableView === 'shops' ? '#1a5276' : '#fff',
              color: tableView === 'shops' ? '#fff' : '#334155',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '12px'
            }}
          >
            Par boutique — 1re colonne : boutique
          </button>
        </div>

        <div style={{ padding: '12px 16px', overflow: 'auto', flex: 1, background: '#f1f5f9' }}>
          {showEmpty ? (
            <div style={{ textAlign: 'center', color: '#64748b', padding: '32px' }}>
              {tableView === 'employees'
                ? 'Aucun horaire enregistré sur cette semaine pour les employés du périmètre.'
                : 'Aucune donnée pour les boutiques du périmètre.'}
            </div>
          ) : tableView === 'employees' ? (
            <div style={{ overflow: 'auto', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '12px',
                  background: '#fff'
                }}
              >
                <thead>
                  <tr style={{ background: '#0f4c75', color: '#fff' }}>
                    <th
                      style={{
                        textAlign: 'left',
                        padding: '10px 12px',
                        position: 'sticky',
                        left: 0,
                        zIndex: 2,
                        minWidth: '140px',
                        border: '1px solid #0a3d5c'
                      }}
                    >
                      Employé
                    </th>
                    {weekDays.map((d) => (
                      <th
                        key={format(d, 'yyyy-MM-dd')}
                        style={{
                          textAlign: 'left',
                          padding: '10px 10px',
                          minWidth: '120px',
                          border: '1px solid #0a3d5c',
                          fontWeight: 700
                        }}
                      >
                        {format(d, 'EEE', { locale: fr })}{' '}
                        <span style={{ fontWeight: 500, opacity: 0.9 }}>{format(d, 'dd/MM')}</span>
                      </th>
                    ))}
                    <th
                      style={{
                        textAlign: 'right',
                        padding: '10px 12px',
                        minWidth: '72px',
                        border: '1px solid #0a3d5c',
                        fontWeight: 800,
                        background: '#0a3d5c',
                        color: '#fff'
                      }}
                    >
                      Total h
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rIdx) => (
                    <tr
                      key={row.employeeId}
                      style={{ background: rIdx % 2 === 0 ? '#ffffff' : '#f8fafc' }}
                    >
                      <td
                        style={{
                          fontWeight: 700,
                          padding: '10px 12px',
                          border: '1px solid #e2e8f0',
                          position: 'sticky',
                          left: 0,
                          background: rIdx % 2 === 0 ? '#fff' : '#f8fafc',
                          zIndex: 1,
                          boxShadow: '2px 0 6px rgba(0,0,0,0.04)',
                          color: '#0f172a'
                        }}
                      >
                        {row.name}
                      </td>
                      {row.dayCells.map((cell) => {
                        const h = typeof cell.hoursH === 'number' ? cell.hoursH : 0;
                        const showH = h > 0.001;
                        return (
                          <td
                            key={cell.dayLabel}
                            style={{
                              verticalAlign: 'top',
                              padding: '8px 10px',
                              border: '1px solid #e2e8f0',
                              color: '#334155',
                              lineHeight: 1.45,
                              whiteSpace: 'pre-line'
                            }}
                          >
                            {cell.display}
                            {showH && (
                              <div
                                style={{
                                  marginTop: '8px',
                                  fontSize: '12px',
                                  fontWeight: 800,
                                  color: '#0f766e',
                                  fontVariantNumeric: 'tabular-nums'
                                }}
                              >
                                {h.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h
                              </div>
                            )}
                          </td>
                        );
                      })}
                      <td
                        style={{
                          textAlign: 'right',
                          verticalAlign: 'middle',
                          padding: '10px 12px',
                          border: '1px solid #e2e8f0',
                          fontWeight: 800,
                          fontSize: '13px',
                          color: '#0f4c75',
                          background: rIdx % 2 === 0 ? 'rgba(15,76,117,0.06)' : 'rgba(15,76,117,0.1)',
                          fontVariantNumeric: 'tabular-nums'
                        }}
                      >
                        {row.weekHours.toLocaleString('fr-FR', {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1
                        })}{' '}
                        h
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ overflow: 'auto', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '12px',
                  background: '#fff'
                }}
              >
                <thead>
                  <tr style={{ background: '#0f4c75', color: '#fff' }}>
                    <th
                      style={{
                        textAlign: 'left',
                        padding: '10px 12px',
                        position: 'sticky',
                        left: 0,
                        zIndex: 2,
                        minWidth: '150px',
                        border: '1px solid #0a3d5c'
                      }}
                    >
                      Boutique
                    </th>
                    {weekDays.map((d) => (
                      <th
                        key={format(d, 'yyyy-MM-dd')}
                        style={{
                          textAlign: 'left',
                          padding: '10px 10px',
                          minWidth: '140px',
                          border: '1px solid #0a3d5c',
                          fontWeight: 700
                        }}
                      >
                        {format(d, 'EEE', { locale: fr })}{' '}
                        <span style={{ fontWeight: 500, opacity: 0.9 }}>{format(d, 'dd/MM')}</span>
                      </th>
                    ))}
                    <th
                      style={{
                        textAlign: 'right',
                        padding: '10px 12px',
                        minWidth: '72px',
                        border: '1px solid #0a3d5c',
                        fontWeight: 800,
                        background: '#0a3d5c',
                        color: '#fff'
                      }}
                    >
                      Total h
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shopRows.map((row, rIdx) => (
                    <tr
                      key={row.shopId}
                      style={{ background: rIdx % 2 === 0 ? '#ffffff' : '#f8fafc' }}
                    >
                      <td
                        style={{
                          fontWeight: 700,
                          padding: '10px 12px',
                          border: '1px solid #e2e8f0',
                          position: 'sticky',
                          left: 0,
                          background: rIdx % 2 === 0 ? '#fff' : '#f8fafc',
                          zIndex: 1,
                          boxShadow: '2px 0 6px rgba(0,0,0,0.04)',
                          color: '#0f172a'
                        }}
                      >
                        {row.shopName}
                      </td>
                      {row.dayCells.map((cell) => (
                        <td
                          key={cell.dayKey}
                          style={{
                            verticalAlign: 'top',
                            padding: '8px 10px',
                            border: '1px solid #e2e8f0',
                            color: '#334155',
                            lineHeight: 1.45,
                            whiteSpace: 'pre-line'
                          }}
                        >
                          {cell.display}
                        </td>
                      ))}
                      <td
                        style={{
                          textAlign: 'right',
                          verticalAlign: 'middle',
                          padding: '10px 12px',
                          border: '1px solid #e2e8f0',
                          fontWeight: 800,
                          fontSize: '13px',
                          color: '#0f4c75',
                          background: rIdx % 2 === 0 ? 'rgba(15,76,117,0.06)' : 'rgba(15,76,117,0.1)',
                          fontVariantNumeric: 'tabular-nums'
                        }}
                      >
                        {row.weekTotal.toLocaleString('fr-FR', {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1
                        })}{' '}
                        h
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div
          style={{
            padding: '8px 16px 12px',
            fontSize: '11px',
            color: '#64748b',
            borderTop: '1px solid #e2e8f0',
            background: '#fff'
          }}
        >
          {tableView === 'employees' ? (
            <>
              Heures = somme des durees sur le périmètre sélectionné (uniquement les employés actifs, non masqués, et
              affectés à la boutique). Congé / maladie = 0 h. La colonne Total est la somme de la semaine.
            </>
          ) : (
            <>
              Chaque case liste les employés éligibles (non masqués, affectés à la boutique) avec créneaux ou statut
              (congé, maladie). Total = somme des heures travaillées de la semaine pour la boutique.
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default WeeklyWorkMatrixModal;
