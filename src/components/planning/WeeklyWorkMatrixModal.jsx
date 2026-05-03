import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { addDays, eachDayOfInterval, endOfMonth, format, parseISO, startOfMonth, startOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import 'jspdf-autotable';
import { loadFromLocalStorage } from '../../utils/localStorage';
import { isEmployeeVisibleForRecap } from '../../utils/planningDataManager';
import { calculateEmployeeDailyHours, formatWorkedHoursForDisplay } from '../../utils/planningUtils';

const normalizeSlot = (value) => value === true || value === 1 || value === '1' || value === 'true';
const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

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
  recapShopKey,
  weekKey
) => {
  let total = 0;
  (planningData.shops || []).forEach((shop) => {
    if (recapShopKey !== 'all' && String(shop.id) !== String(recapShopKey)) return;
    if (!isEmployeeVisibleForRecap(planningData, employeeId, shop.id)) return;
    const wk = resolvePlanningForShop(shop, weekKey);
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
const getWeekKeyForDate = (date) => format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd');

const WeeklyWorkMatrixModal = ({
  isOpen,
  onClose,
  planningData,
  selectedWeek,
  currentShopId,
  currentWeekPlanning = {}
}) => {
  const [recapShopKey, setRecapShopKey] = useState('all');
  /** 'week' = semaine affichée ; 'month' = mois de la semaine affichée. */
  const [periodMode, setPeriodMode] = useState('week');
  /** 'employees' = une ligne par employé ; 'shops' = une ligne par boutique, 1ʳᵉ col. = boutique. */
  const [tableView, setTableView] = useState('shops');
  const [modalSize, setModalSize] = useState({ width: 1280, height: 820 });
  const wasModalOpen = useRef(false);
  const pdfCaptureRef = useRef(null);

  const getModalResizeBounds = useCallback(() => {
    const viewportW = Math.max(320, window.innerWidth - 24);
    const viewportH = Math.max(320, window.innerHeight - 24);
    return {
      minWidth: Math.min(760, viewportW),
      minHeight: Math.min(520, viewportH),
      maxWidth: viewportW,
      maxHeight: viewportH
    };
  }, []);

  const clampModalSize = useCallback((size) => {
    const bounds = getModalResizeBounds();
    return {
      width: Math.min(bounds.maxWidth, Math.max(bounds.minWidth, size.width)),
      height: Math.min(bounds.maxHeight, Math.max(bounds.minHeight, size.height))
    };
  }, [getModalResizeBounds]);

  /** À l'ouverture : vue globale de toutes les boutiques pour voir la semaine d'un coup. */
  useEffect(() => {
    if (isOpen && !wasModalOpen.current) {
      setRecapShopKey('all');
      setPeriodMode('week');
      setTableView('shops');
      setModalSize((size) => clampModalSize(size));
    }
    wasModalOpen.current = isOpen;
  }, [clampModalSize, isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onWindowResize = () => setModalSize((size) => clampModalSize(size));
    window.addEventListener('resize', onWindowResize);
    return () => window.removeEventListener('resize', onWindowResize);
  }, [clampModalSize, isOpen]);

  const startResizeModal = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    const pointer = event.touches?.[0] || event;
    const startX = pointer.clientX;
    const startY = pointer.clientY;
    const startSize = { ...modalSize };

    const move = (moveEvent) => {
      moveEvent.preventDefault();
      const movePointer = moveEvent.touches?.[0] || moveEvent;
      setModalSize(clampModalSize({
        width: startSize.width + (movePointer.clientX - startX),
        height: startSize.height + (movePointer.clientY - startY)
      }));
    };

    const stop = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', stop);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', stop);
    };

    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', stop);
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', stop);
  }, [clampModalSize, modalSize]);

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

  const monthDays = useMemo(() => {
    if (!selectedWeek) return [];
    const anchor = parseISO(selectedWeek);
    return eachDayOfInterval({
      start: startOfMonth(anchor),
      end: endOfMonth(anchor)
    });
  }, [selectedWeek]);

  const monthLabel = useMemo(() => {
    if (!selectedWeek) return '';
    return format(parseISO(selectedWeek), 'MMMM yyyy', { locale: fr });
  }, [selectedWeek]);

  const dayColumns = periodMode === 'month' ? monthDays : weekDays;
  const periodLabel = periodMode === 'month' ? monthLabel : weekLabel;

  const resolvePlanningForShop = useCallback(
    (shop, weekKey = selectedWeek) => {
      if (
        currentShopId &&
        shop.id === currentShopId &&
        weekKey === selectedWeek &&
        currentWeekPlanning &&
        Object.keys(currentWeekPlanning).length
      ) {
        return currentWeekPlanning;
      }
      const w = shop.weeks?.[weekKey];
      const inline = w?.planning;
      if (inline && typeof inline === 'object' && Object.keys(inline).length > 0) {
        return inline;
      }
      return loadFromLocalStorage(`planning_${shop.id}_${weekKey}`, {});
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
      dayColumns.forEach((dayDate) => {
        const weekPlanning = resolvePlanningForShop(shop, getWeekKeyForDate(dayDate));
        if (!weekPlanning || typeof weekPlanning !== 'object') return;
        Object.keys(weekPlanning).forEach((id) => {
          if (isEmployeeVisibleForRecap(planningData, id, shop.id)) {
            employeeIdsSet.add(id);
          }
        });
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
        const dayCells = dayColumns.map((dayDate) => {
          const dayKey = format(dayDate, 'yyyy-MM-dd');
          const weekKey = getWeekKeyForDate(dayDate);
          const dayLabel = `${format(dayDate, 'EEE', { locale: fr })} ${format(dayDate, 'dd/MM')}`;
          const entries = [];
            (planningData.shops || []).forEach((shop) => {
            if (recapShopKey !== 'all' && String(shop.id) !== String(recapShopKey)) return;
            if (!isEmployeeVisibleForRecap(planningData, employeeId, shop.id)) return;
            const wk = resolvePlanningForShop(shop, weekKey);
            const ep = wk?.[employeeId];
            if (!ep) return;
            const dayValue = ep[dayKey];
            if (dayValue === undefined || dayValue === null) return;
            if (typeof dayValue === 'string') {
              entries.push({ shopName: shop.name || shop.id, value: dayValue, h: 0 });
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
                const slice = { [employeeId]: ep };
                const h = calculateEmployeeDailyHours(employeeId, dayKey, slice, cfg);
                entries.push({ shopName: shop.name || shop.id, value: ranges.join(', '), h });
              }
            }
          });

          if (entries.length === 0) {
            const hoursH = sumHoursDayForScope(
              planningData,
              resolvePlanningForShop,
              employeeId,
              dayKey,
              recapShopKey,
              weekKey
            );
            return { dayLabel, display: '—', hoursH };
          }
          const block = entries
            .map((e) => `${e.shopName} : ${e.value}`)
            .join('\n');
          const hoursH = entries.reduce((sum, entry) => sum + (entry.h || 0), 0);
          return { dayLabel, display: block, hoursH };
        });
        const weekHours = dayCells.reduce((s, c) => s + (typeof c.hoursH === 'number' ? c.hoursH : 0), 0);
        return { employeeId, name, dayCells, weekHours };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));

    return { rows };
  }, [isOpen, selectedWeek, planningData, dayColumns, resolvePlanningForShop, recapShopKey]);

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
        const eligible = new Set();
        dayColumns.forEach((dayDate) => {
          const wk = resolvePlanningForShop(shop, getWeekKeyForDate(dayDate)) || {};
          Object.keys(wk).forEach((id) => {
            if (isEmployeeVisibleForRecap(planningData, id, shop.id)) {
              if (!employeeMap.has(id)) employeeMap.set(id, id);
              eligible.add(id);
            }
          });
        });

        const dayCells = dayColumns.map((dayDate) => {
          const dayKey = format(dayDate, 'yyyy-MM-dd');
          const weekKey = getWeekKeyForDate(dayDate);
          const dayLabel = `${format(dayDate, 'EEE', { locale: fr })} ${format(dayDate, 'dd/MM')}`;
          const parts = [];
          let dayHoursSum = 0;
          const wk = resolvePlanningForShop(shop, weekKey) || {};

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
                parts.push({ text: `${name} — Congé`, employeeId, name, type: 'conge', h: 0 });
                return;
              }
              if (isMaladieStatus(dayValue)) {
                parts.push({ text: `${name} — Maladie`, employeeId, name, type: 'maladie', h: 0 });
                return;
              }
              parts.push({ text: `${name} — ${dayValue}`, employeeId, name, type: 'status', h: 0 });
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
                text: h > 0.001 ? `${name} : ${tranche} (${formatWorkedHoursForDisplay(h)})` : `${name} : ${tranche}`,
                employeeId,
                name,
                type: 'work',
                ranges,
                h
              });
            }
          });

          const display = parts.length === 0 ? '—' : parts.map((p) => p.text).join('\n');
          return { dayKey, dayLabel, display, parts, hoursH: dayHoursSum };
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
  }, [isOpen, selectedWeek, planningData, dayColumns, resolvePlanningForShop, recapShopKey]);

  const summary = useMemo(() => {
    const workEmployees = new Set();
    const leaveEmployees = new Set();
    const sickEmployees = new Set();
    let staffedDays = 0;
    let totalHours = 0;

    shopMatrix.rows.forEach((shopRow) => {
      totalHours += shopRow.weekTotal || 0;
      shopRow.dayCells.forEach((cell) => {
        if ((cell.hoursH || 0) > 0.001) staffedDays += 1;
        (cell.parts || []).forEach((part) => {
          if (part.type === 'work' && part.employeeId) workEmployees.add(part.employeeId);
          if (part.type === 'conge' && part.employeeId) leaveEmployees.add(part.employeeId);
          if (part.type === 'maladie' && part.employeeId) sickEmployees.add(part.employeeId);
        });
      });
    });

    return {
      shopCount: shopMatrix.rows.length,
      workEmployeeCount: workEmployees.size,
      leaveEmployeeCount: leaveEmployees.size,
      sickEmployeeCount: sickEmployees.size,
      staffedDays,
      totalHours
    };
  }, [shopMatrix]);

  const renderShopDayCell = (cell) => {
    const parts = cell.parts || [];
    if (!parts.length) {
      return <span style={{ color: '#94a3b8', fontWeight: 700 }}>—</span>;
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {parts.map((part, idx) => {
          const isWork = part.type === 'work';
          const isLeave = part.type === 'conge';
          const isSick = part.type === 'maladie';
          const bg = isWork ? '#ecfdf5' : isLeave ? '#fff7ed' : isSick ? '#fef2f2' : '#f8fafc';
          const border = isWork ? '#99f6e4' : isLeave ? '#fed7aa' : isSick ? '#fecaca' : '#cbd5e1';
          const color = isWork ? '#115e59' : isLeave ? '#9a3412' : isSick ? '#991b1b' : '#334155';
          const label = isWork
            ? (part.ranges || []).join(', ')
            : isLeave
              ? 'Congé'
              : isSick
                ? 'Maladie'
                : part.text.replace(`${part.name} — `, '');

          return (
            <div
              key={`${part.employeeId || part.name}-${idx}`}
              style={{
                padding: '7px 8px',
                borderRadius: '9px',
                border: `1px solid ${border}`,
                background: bg,
                color,
                boxShadow: isWork ? '0 1px 4px rgba(15,118,110,0.08)' : 'none'
              }}
            >
              <div style={{ fontWeight: 850, fontSize: '12px', marginBottom: '2px' }}>
                {part.name}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 700 }}>{label}</span>
                {isWork && part.h > 0.001 && (
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 900,
                      background: '#0f766e',
                      color: '#fff',
                      borderRadius: '999px',
                      padding: '2px 6px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {formatWorkedHoursForDisplay(part.h)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const printSheet = () => {
    const printedRows = tableView === 'shops' ? shopMatrix.rows : matrix.rows;
    if (!printedRows.length) return;

    const title = tableView === 'shops'
      ? `Planning ${periodMode === 'month' ? 'mois' : 'semaine'} par boutique`
      : `Planning global multi-boutiques ${periodMode === 'month' ? 'mois' : 'semaine'} par employé`;
    const firstHeader = tableView === 'shops' ? 'Boutique' : 'Employé';
    const htmlRows = printedRows.map((row) => {
      const firstCell = tableView === 'shops' ? row.shopName : row.name;
      const total = tableView === 'shops' ? row.weekTotal : row.weekHours;
      return `
        <tr>
          <th>${escapeHtml(firstCell)}</th>
          ${row.dayCells.map((cell) => `<td>${escapeHtml(cell.display).replace(/\n/g, '<br>')}</td>`).join('')}
          <td class="total">${escapeHtml(formatWorkedHoursForDisplay(total || 0))}</td>
        </tr>
      `;
    }).join('');

    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(title)} - ${escapeHtml(periodLabel)}</title>
          <style>
            @page { size: A4 landscape; margin: 8mm; }
            body { font-family: Arial, sans-serif; color: #0f172a; margin: 0; }
            .header { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; margin-bottom: 10px; }
            h1 { margin: 0; font-size: 20px; color: #12395b; }
            .meta { font-size: 12px; color: #475569; text-align: right; }
            .cards { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin: 8px 0 10px; }
            .card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 7px; background: #f8fafc; }
            .card strong { display: block; font-size: 15px; color: #0f4c75; }
            .card span { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: .04em; }
            table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 9px; }
            th, td { border: 1px solid #cbd5e1; padding: 5px; vertical-align: top; white-space: normal; word-break: break-word; }
            thead th { background: #0f4c75; color: #fff; text-align: left; }
            tbody th { background: #e8f0f7; color: #12395b; text-align: left; width: 13%; }
            tbody tr:nth-child(even) td, tbody tr:nth-child(even) th { background: #f8fafc; }
            .total { font-weight: 800; text-align: right; background: #e0f2fe; color: #075985; }
            .legend { margin-top: 8px; font-size: 10px; color: #64748b; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>${escapeHtml(title)}</h1>
              <div class="legend">${escapeHtml(recapShopKey === 'all' ? 'Toutes les boutiques' : `Boutique : ${selectedShopName || String(recapShopKey)}`)}</div>
            </div>
            <div class="meta">
              <div>Période : ${escapeHtml(periodLabel)}</div>
              <div>Édité le ${escapeHtml(format(new Date(), 'dd/MM/yyyy HH:mm', { locale: fr }))}</div>
            </div>
          </div>
          <div class="cards">
            <div class="card"><strong>${summary.shopCount}</strong><span>Boutiques</span></div>
            <div class="card"><strong>${summary.workEmployeeCount}</strong><span>Employés au planning</span></div>
            <div class="card"><strong>${formatWorkedHoursForDisplay(summary.totalHours)}</strong><span>Total période</span></div>
            <div class="card"><strong>${summary.leaveEmployeeCount}</strong><span>En congé</span></div>
            <div class="card"><strong>${summary.sickEmployeeCount}</strong><span>Maladie</span></div>
          </div>
          <table>
            <thead>
              <tr>
                <th>${escapeHtml(firstHeader)}</th>
                ${dayColumns.map((d) => `<th>${escapeHtml(format(d, 'EEE dd/MM', { locale: fr }))}</th>`).join('')}
                <th>Total h</th>
              </tr>
            </thead>
            <tbody>${htmlRows}</tbody>
          </table>
          <div class="legend">Les congés et maladies sont listés dans la case du jour concerné. Les totaux ne comptent que les heures travaillées.</div>
        </body>
      </html>
    `);
    w.document.close();
    w.focus();
    w.print();
  };

  const exportPdf = async () => {
    const periodSlug = periodMode === 'month' ? format(parseISO(selectedWeek), 'yyyy-MM') : selectedWeek;
    const captureTarget = pdfCaptureRef.current;
    if (!captureTarget) return;
    const scopeSlug = recapShopKey === 'all' ? 'toutes' : String(recapShopKey).replace(/[^\w-]+/g, '_');
    const captureElements = [
      captureTarget,
      ...Array.from(captureTarget.querySelectorAll('[data-pdf-expand="true"], table'))
    ];
    const captureWidth = Math.ceil(
      Math.max(
        ...captureElements.map((element) => element.scrollWidth || element.getBoundingClientRect().width || 0)
      )
    );
    const captureHeight = Math.ceil(
      Math.max(
        captureTarget.scrollHeight,
        ...captureElements.map((element) => element.scrollHeight || element.getBoundingClientRect().height || 0)
      )
    );
    const canvas = await html2canvas(captureTarget, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#f1f5f9',
      width: captureWidth,
      height: captureHeight,
      windowWidth: captureWidth,
      windowHeight: captureHeight,
      scrollX: 0,
      scrollY: 0,
      onclone: (clonedDocument) => {
        const clonedRoot = clonedDocument.querySelector('[data-pdf-root="true"]');
        if (clonedRoot) {
          clonedRoot.style.width = `${captureWidth}px`;
          clonedRoot.style.maxWidth = 'none';
          clonedRoot.style.maxHeight = 'none';
          clonedRoot.style.height = 'auto';
          clonedRoot.style.overflow = 'visible';
        }
        clonedDocument.querySelectorAll('[data-pdf-expand="true"]').forEach((element) => {
          element.style.width = 'auto';
          element.style.minWidth = '100%';
          element.style.maxHeight = 'none';
          element.style.height = 'auto';
          element.style.overflow = 'visible';
        });
      }
    });

    const imgData = canvas.toDataURL('image/png');
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 6;
    const maxW = pageW - margin * 2;
    const maxH = pageH - margin * 2;
    const widthRatio = maxW / canvas.width;
    const heightRatio = maxH / canvas.height;
    const fitRatio = Math.min(widthRatio, heightRatio);
    const imgW = canvas.width * fitRatio;
    const imgH = canvas.height * fitRatio;
    const x = (pageW - imgW) / 2;
    const y = (pageH - imgH) / 2;

    doc.addImage(imgData, 'PNG', x, y, imgW, imgH);

    doc.save(`recap_${periodMode}_${tableView === 'shops' ? 'par_boutique' : 'global_multi_boutiques'}_${scopeSlug}_${periodSlug}.pdf`);
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
        ref={pdfCaptureRef}
        data-pdf-root="true"
        data-pdf-expand="true"
        style={{
          width: `${modalSize.width}px`,
          height: `${modalSize.height}px`,
          maxWidth: 'calc(100vw - 24px)',
          maxHeight: 'calc(100vh - 24px)',
          background: '#fff',
          borderRadius: '10px',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          overflow: 'hidden',
          position: 'relative',
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
            gap: '10px',
            flexShrink: 0
          }}
        >
          <div>
            <div style={{ fontSize: '18px', fontWeight: 800 }}>
              Planning {periodMode === 'month' ? 'mois' : 'semaine'} — boutiques, horaires et congés
            </div>
            <div style={{ fontSize: '13px', opacity: 0.92, marginTop: '4px' }}>
              {recapShopKey === 'all'
                ? 'Toutes les boutiques'
                : `Boutique : ${selectedShopName || String(recapShopKey)}`}{' '}
              · {periodLabel}
              <span style={{ opacity: 0.85 }}> · Redimensionnable par le coin inférieur droit</span>
            </div>
          </div>
          <div data-html2canvas-ignore="true" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
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
              onClick={printSheet}
              disabled={!canExport}
              style={{
                padding: '8px 14px',
                borderRadius: '6px',
                border: 'none',
                background: canExport ? '#f97316' : '#94a3b8',
                color: '#fff',
                cursor: canExport ? 'pointer' : 'not-allowed',
                fontWeight: 700
              }}
            >
              Imprimer
            </button>
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
            flexWrap: 'wrap',
            flexShrink: 0
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Période :</span>
          <button
            type="button"
            onClick={() => setPeriodMode('week')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: periodMode === 'week' ? '2px solid #0f766e' : '1px solid #94a3b8',
              background: periodMode === 'week' ? '#0f766e' : '#fff',
              color: periodMode === 'week' ? '#fff' : '#334155',
              cursor: 'pointer',
              fontWeight: 800,
              fontSize: '12px'
            }}
          >
            Semaine
          </button>
          <button
            type="button"
            onClick={() => {
              setPeriodMode('month');
              setTableView('employees');
              setRecapShopKey('all');
            }}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: periodMode === 'month' ? '2px solid #7c3aed' : '1px solid #94a3b8',
              background: periodMode === 'month' ? '#7c3aed' : '#fff',
              color: periodMode === 'month' ? '#fff' : '#334155',
              cursor: 'pointer',
              fontWeight: 800,
              fontSize: '12px'
            }}
          >
            Mois global
          </button>
          <span style={{ fontSize: '12px', fontWeight: 800, color: '#334155', marginLeft: '8px' }}>Organisation :</span>
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
            Global multi-boutiques — par employé
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
            Par boutique
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '10px',
            padding: '12px 16px',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            flexShrink: 0
          }}
        >
          {[
            { label: 'Boutiques affichées', value: summary.shopCount, color: '#0f4c75' },
            { label: 'Employés au planning', value: summary.workEmployeeCount, color: '#0f766e' },
            { label: 'Total période', value: formatWorkedHoursForDisplay(summary.totalHours), color: '#7c3aed' },
            { label: 'Employés en congé', value: summary.leaveEmployeeCount, color: '#ea580c' },
            { label: 'Maladie', value: summary.sickEmployeeCount, color: '#dc2626' }
          ].map((card) => (
            <div
              key={card.label}
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '10px 12px',
                boxShadow: '0 4px 14px rgba(15,23,42,0.06)'
              }}
            >
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>
                {card.label}
              </div>
              <div style={{ fontSize: '21px', color: card.color, fontWeight: 900, marginTop: '4px' }}>
                {card.value}
              </div>
            </div>
          ))}
        </div>

        <div
          data-pdf-expand="true"
          style={{
            padding: '12px 16px',
            overflow: 'auto',
            flex: '1 1 auto',
            minHeight: 0,
            background: '#f1f5f9'
          }}
        >
          {showEmpty ? (
            <div style={{ textAlign: 'center', color: '#64748b', padding: '32px' }}>
              {tableView === 'employees'
                ? `Aucun horaire enregistré sur ${periodMode === 'month' ? 'ce mois' : 'cette semaine'} pour les employés du périmètre.`
                : 'Aucune donnée pour les boutiques du périmètre.'}
            </div>
          ) : tableView === 'employees' ? (
            <div data-pdf-expand="true" style={{ overflow: 'auto', borderRadius: '8px', border: '1px solid #e2e8f0', minHeight: 0 }}>
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
                    {dayColumns.map((d) => (
                      <th
                        key={format(d, 'yyyy-MM-dd')}
                        style={{
                          textAlign: 'left',
                          padding: '10px 10px',
                          minWidth: periodMode === 'month' ? '92px' : '120px',
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
                                {formatWorkedHoursForDisplay(h)}
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
                        {formatWorkedHoursForDisplay(row.weekHours)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div data-pdf-expand="true" style={{ overflow: 'auto', borderRadius: '8px', border: '1px solid #e2e8f0', minHeight: 0 }}>
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
                    {dayColumns.map((d) => (
                      <th
                        key={format(d, 'yyyy-MM-dd')}
                        style={{
                          textAlign: 'left',
                          padding: '10px 10px',
                          minWidth: periodMode === 'month' ? '96px' : '140px',
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
                          {renderShopDayCell(cell)}
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
                        {formatWorkedHoursForDisplay(row.weekTotal)}
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
            background: '#fff',
            flexShrink: 0
          }}
        >
          {tableView === 'employees' ? (
            <>
              Heures = somme des durees sur le périmètre sélectionné (uniquement les employés actifs, non masqués, et
              affectés à la boutique). Congé / maladie = 0 h. La colonne Total est la somme de la période.
            </>
          ) : (
            <>
              Chaque case liste les employés éligibles (non masqués, affectés à la boutique) avec créneaux ou statut
              (congé, maladie). Total = somme des heures travaillées de la période pour la boutique.
            </>
          )}
        </div>
        <div
          data-html2canvas-ignore="true"
          onMouseDown={startResizeModal}
          onTouchStart={startResizeModal}
          title="Redimensionner la fenêtre"
          style={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            width: '28px',
            height: '28px',
            cursor: 'nwse-resize',
            borderBottomRightRadius: '10px',
            background: 'linear-gradient(135deg, transparent 0 45%, rgba(15,76,117,0.22) 45% 55%, transparent 55% 63%, rgba(15,76,117,0.36) 63% 73%, transparent 73%)',
            zIndex: 5
          }}
        />
      </div>
    </div>
  );
};

export default WeeklyWorkMatrixModal;
