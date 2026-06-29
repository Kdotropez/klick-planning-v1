import React, { useMemo } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { calculateEmployeeDailyHours, formatWorkedHoursForDisplay } from '../../utils/planningUtils';
import { determineEmployeeMainShop, getEmployeeById } from '../../utils/planningDataManager';

const normalizeSlotSelected = (value) =>
  value === true || value === 1 || value === '1' || value === 'true';

const dayHasWorkedHours = (employeeId, dayKey, shop, weekPlanning, shopConfig) => {
  const dayData = weekPlanning?.[employeeId]?.[dayKey];
  if (!Array.isArray(dayData) || !dayData.some(normalizeSlotSelected)) return false;
  if (!shopConfig?.timeSlots?.length) return false;
  return calculateEmployeeDailyHours(
    employeeId,
    dayKey,
    { [employeeId]: weekPlanning[employeeId] },
    shopConfig
  ) > 0;
};

const isCongeDayValue = (dayData) => {
  if (dayData == null) return false;
  if (Array.isArray(dayData) && dayData.some(normalizeSlotSelected)) return false;
  if (typeof dayData === 'string') {
    const normalized = dayData.toLowerCase();
    return (normalized.includes('congé') || normalized.includes('conge')) && !normalized.includes('maladie');
  }
  if (Array.isArray(dayData)) {
    const hasMaladie = dayData.some(
      (value) => value === 'M' || (typeof value === 'string' && value.toLowerCase().includes('maladie'))
    );
    if (hasMaladie) return false;
    return dayData.some(
      (value) =>
        value === 'C' ||
        (typeof value === 'string' &&
          (value.toLowerCase().includes('congé') || value.toLowerCase().includes('conge')))
    );
  }
  return false;
};

const isMaladieDayValue = (dayData) => {
  if (dayData == null) return false;
  if (Array.isArray(dayData) && dayData.some(normalizeSlotSelected)) return false;
  if (typeof dayData === 'string') {
    return dayData.toLowerCase().includes('maladie');
  }
  if (Array.isArray(dayData)) {
    return dayData.some(
      (value) => value === 'M' || (typeof value === 'string' && value.toLowerCase().includes('maladie'))
    );
  }
  return false;
};

const EmployeeRecapCompact = ({
  show,
  onToggle,
  employeeIds = [],
  currentShopEmployees = [],
  planningData,
  planning,
  selectedShop,
  validWeek,
  mondayOfWeek,
  config,
  deviceInfo,
  onOpenWeeklyRecap,
  onOpenMonthlyDetail,
  onOpenMonthlyRecap,
  onHideEmployee,
  onReactivateEmployee,
  onRenameEmployee,
  isEmployeeHiddenInShop
}) => {
  const monthlyHoursByEmployee = useMemo(() => {
    const map = new Map();
    if (!validWeek || !planningData) return map;
    const anchor = parseISO(validWeek);
    const year = anchor.getFullYear();
    const month = anchor.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();

    employeeIds.forEach((employeeId) => {
      let totalHours = 0;
      for (let day = 1; day <= lastDay; day += 1) {
        const dayKey = format(new Date(year, month, day), 'yyyy-MM-dd');
        (planningData.shops || []).forEach((shop) => {
          const weekKeys = shop.weeks ? Object.keys(shop.weeks) : [];
          weekKeys.forEach((weekKey) => {
            const weekPlanning = shop.weeks[weekKey]?.planning;
            const dayData = weekPlanning?.[employeeId]?.[dayKey];
            if (!Array.isArray(dayData) || !dayData.some((slot) => slot === true)) return;
            const shopConfig = shop.config;
            if (!shopConfig?.timeSlots?.length) return;
            totalHours += calculateEmployeeDailyHours(
              employeeId,
              dayKey,
              { [employeeId]: weekPlanning[employeeId] },
              shopConfig
            );
          });
        });
      }
      map.set(employeeId, totalHours);
    });
    return map;
  }, [employeeIds, planningData, validWeek]);

  const weeklyHoursByEmployee = useMemo(() => {
    const map = new Map();
    if (!validWeek || !planningData) return map;

    employeeIds.forEach((employeeId) => {
      let totalHours = 0;
      (planningData.shops || []).forEach((shop) => {
        const weekPlanning =
          shop.id === selectedShop && planning
            ? planning
            : shop.weeks?.[validWeek]?.planning;
        if (!weekPlanning?.[employeeId]) return;
        const shopConfig = shop.id === selectedShop ? config : shop.config;
        if (!shopConfig?.timeSlots?.length) return;
        for (let i = 0; i < 7; i += 1) {
          const dayKey = format(addDays(mondayOfWeek, i), 'yyyy-MM-dd');
          const dayData = weekPlanning[employeeId][dayKey];
          if (!Array.isArray(dayData) || !dayData.some((slot) => slot === true)) continue;
          totalHours += calculateEmployeeDailyHours(
            employeeId,
            dayKey,
            { [employeeId]: weekPlanning[employeeId] },
            shopConfig
          );
        }
      });
      map.set(employeeId, totalHours);
    });
    return map;
  }, [employeeIds, planningData, planning, selectedShop, validWeek, mondayOfWeek, config]);

  const weekAbsenceDaysByEmployee = useMemo(() => {
    const map = new Map();
    if (!validWeek || !planningData) return map;

    employeeIds.forEach((employeeId) => {
      const congeDays = [];
      const maladieDays = [];

      for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
        const dayDate = addDays(mondayOfWeek, dayIndex);
        const dayKey = format(dayDate, 'yyyy-MM-dd');
        const dayInfo = {
          key: dayKey,
          weekday: format(dayDate, 'EEEE', { locale: fr }),
          date: format(dayDate, 'dd/MM/yyyy')
        };
        let hasConge = false;
        let hasMaladie = false;

        // Horaires travaillés ce jour (toutes boutiques) : priorité sur congé/maladie affiché ailleurs
        let workedThisDay = false;
        (planningData.shops || []).forEach((shop) => {
          const weekPlanning =
            shop.id === selectedShop && planning
              ? planning
              : shop.weeks?.[validWeek]?.planning;
          const shopConfig = shop.id === selectedShop ? config : shop.config;
          if (dayHasWorkedHours(employeeId, dayKey, shop, weekPlanning, shopConfig)) {
            workedThisDay = true;
          }
        });

        if (!workedThisDay) {
          // Congés/maladies : boutique maîtresse uniquement
          const employee = getEmployeeById(planningData, employeeId);
          const mainShopId =
            employee?.mainShop || determineEmployeeMainShop(planningData, employeeId) || selectedShop;
          const shopForAbsence = (planningData.shops || []).find(
            (s) => String(s.id) === String(mainShopId)
          );
          if (shopForAbsence) {
            const weekPlanning =
              shopForAbsence.id === selectedShop && planning && Object.keys(planning).length > 0
                ? planning
                : shopForAbsence.weeks?.[validWeek]?.planning;
            const dayData = weekPlanning?.[employeeId]?.[dayKey];
            if (isCongeDayValue(dayData)) hasConge = true;
            if (isMaladieDayValue(dayData)) hasMaladie = true;
          }
        }

        if (hasConge) congeDays.push(dayInfo);
        if (hasMaladie) maladieDays.push(dayInfo);
      }

      map.set(employeeId, { congeDays, maladieDays });
    });

    return map;
  }, [employeeIds, planningData, planning, selectedShop, validWeek, mondayOfWeek, config]);

  if (!employeeIds.length) return null;

  return (
    <div style={{ width: '100%', marginTop: '12px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          background: '#f8fafc',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          marginBottom: show ? '10px' : 0
        }}
      >
        <span style={{ fontSize: '14px', fontWeight: 800, color: '#334155' }}>📊 Récap employés (optionnel)</span>
        <button
          type="button"
          onClick={onToggle}
          style={{
            backgroundColor: show ? '#ff9800' : '#4caf50',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            padding: '6px 12px',
            fontSize: '13px',
            cursor: 'pointer',
            fontWeight: 700
          }}
        >
          {show ? 'Masquer' : 'Afficher'}
        </button>
      </div>

      {show && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: deviceInfo?.isTablet
              ? 'repeat(auto-fill, minmax(300px, 1fr))'
              : 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: '8px',
            padding: '10px',
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            maxHeight: '340px',
            overflowY: 'auto'
          }}
        >
          {employeeIds.map((employeeId) => {
            const employee = currentShopEmployees.find((emp) => emp.id === employeeId);
            const employeeName = employee?.name || employeeId;
            const weekHours = weeklyHoursByEmployee.get(employeeId) || 0;
            const monthHours = monthlyHoursByEmployee.get(employeeId) || 0;
            const absences = weekAbsenceDaysByEmployee.get(employeeId) || { congeDays: [], maladieDays: [] };
            const hidden = isEmployeeHiddenInShop?.(employeeId);

            return (
              <div
                key={employeeId}
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '8px 10px',
                  background: '#f8fafc'
                }}
              >
                <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '13px', marginBottom: '4px' }}>
                  {employeeName}
                </div>
                <HoursSummaryFrame weekHours={weekHours} monthHours={monthHours} />
                {absences.congeDays.length > 0 && (
                  <AbsenceDaysFrame
                    title="Congés"
                    icon="☀️"
                    days={absences.congeDays}
                    tone="conge"
                  />
                )}
                {absences.maladieDays.length > 0 && (
                  <AbsenceDaysFrame
                    title="Maladie"
                    icon="🤒"
                    days={absences.maladieDays}
                    tone="maladie"
                  />
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={() => onOpenWeeklyRecap(employeeId)}
                    style={actionBtnStyle('#2e7d32')}
                  >
                    Semaine
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenMonthlyDetail(employeeId)}
                    style={actionBtnStyle('#1e88e5')}
                  >
                    Mois
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenMonthlyRecap(employeeId)}
                    style={actionBtnStyle('#ff9800')}
                  >
                    Détail boutique
                  </button>
                  {onRenameEmployee && (
                    <button
                      type="button"
                      onClick={() => onRenameEmployee(employeeId)}
                      style={actionBtnStyle('#007bff')}
                      title="Renommer l'employé (toutes les boutiques)"
                    >
                      Renommer
                    </button>
                  )}
                  {hidden ? (
                    <button type="button" onClick={() => onReactivateEmployee?.(employeeId)} style={actionBtnStyle('#28a745')}>
                      Réactiver
                    </button>
                  ) : (
                    <button type="button" onClick={() => onHideEmployee?.(employeeId)} style={actionBtnStyle('#dc3545')}>
                      Masquer
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const HoursSummaryFrame = ({ weekHours, monthHours }) => (
  <div
    style={{
      marginBottom: '6px',
      padding: '6px',
      borderRadius: '8px',
      border: '1px solid #93c5fd',
      background: '#eff6ff'
    }}
  >
    <div style={{ fontSize: '11px', fontWeight: 800, color: '#1d4ed8', marginBottom: '6px' }}>
      ⏱️ Heures
    </div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
      <div style={hoursChipStyle('#dcfce7', '#22c55e')}>
        <div style={hoursChipLabelStyle('#166534')}>Semaine</div>
        <div style={hoursChipValueStyle('#14532d')}>{formatWorkedHoursForDisplay(weekHours)}</div>
      </div>
      <div style={hoursChipStyle('#dbeafe', '#3b82f6')}>
        <div style={hoursChipLabelStyle('#1e40af')}>Cumul mois</div>
        <div style={hoursChipValueStyle('#1e3a8a')}>{formatWorkedHoursForDisplay(monthHours)}</div>
      </div>
    </div>
  </div>
);

const hoursChipStyle = (bg, border) => ({
  flex: '1 1 100px',
  minWidth: '100px',
  padding: '6px 8px',
  borderRadius: '6px',
  border: `1px solid ${border}`,
  background: bg,
  textAlign: 'center',
  lineHeight: 1.2
});

const hoursChipLabelStyle = (color) => ({
  fontSize: '10px',
  fontWeight: 800,
  color,
  textTransform: 'uppercase',
  letterSpacing: '0.3px'
});

const hoursChipValueStyle = (color) => ({
  fontSize: '15px',
  fontWeight: 900,
  color,
  marginTop: '3px'
});

const absenceToneStyles = {
  conge: {
    frameBg: '#fffbeb',
    frameBorder: '#fcd34d',
    titleColor: '#b45309',
    chipBg: '#fef3c7',
    chipBorder: '#f59e0b',
    chipText: '#92400e'
  },
  maladie: {
    frameBg: '#fef2f2',
    frameBorder: '#fca5a5',
    titleColor: '#b91c1c',
    chipBg: '#fee2e2',
    chipBorder: '#ef4444',
    chipText: '#991b1b'
  }
};

const AbsenceDaysFrame = ({ title, icon, days, tone }) => {
  const palette = absenceToneStyles[tone] || absenceToneStyles.conge;
  return (
    <div
      style={{
        marginBottom: '6px',
        padding: '6px',
        borderRadius: '8px',
        border: `1px solid ${palette.frameBorder}`,
        background: palette.frameBg
      }}
    >
      <div style={{ fontSize: '11px', fontWeight: 800, color: palette.titleColor, marginBottom: '6px' }}>
        {icon} {title}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {days.map((day) => (
          <div
            key={day.key}
            style={{
              minWidth: '72px',
              padding: '5px 6px',
              borderRadius: '6px',
              border: `1px solid ${palette.chipBorder}`,
              background: palette.chipBg,
              textAlign: 'center',
              lineHeight: 1.2
            }}
          >
            <div
              style={{
                fontSize: '10px',
                fontWeight: 800,
                color: palette.chipText,
                textTransform: 'capitalize'
              }}
            >
              {day.weekday}
            </div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: palette.chipText, marginTop: '2px' }}>
              {day.date}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const actionBtnStyle = (bg) => ({
  backgroundColor: bg,
  color: '#fff',
  border: 'none',
  borderRadius: '5px',
  padding: '4px 8px',
  fontSize: '11px',
  cursor: 'pointer',
  fontWeight: 700
});

export default EmployeeRecapCompact;
