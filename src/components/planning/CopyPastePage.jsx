import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { format, addDays, parseISO, startOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  saveWeekPlanning,
  listShopWeeksWithData,
  getRawWeekPlanningForShop,
  isEmployeeHidden
} from '../../utils/planningDataManager';
import { dayCellHasPlanningContent, resolveEmployeePlanningSlice } from '../../utils/planningUtils';
import { saveToLocalStorage } from '../../utils/localStorage';

const normalizeWeekKey = (weekKey) => {
  if (!weekKey) return '';
  try {
    const parsed = parseISO(weekKey);
    if (Number.isNaN(parsed.getTime())) return weekKey;
    return format(startOfWeek(parsed, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  } catch {
    return weekKey;
  }
};

const formatWeekLabel = (weekKey) => {
  const monday = parseISO(normalizeWeekKey(weekKey));
  const sunday = addDays(monday, 6);
  const year = format(monday, 'yyyy');
  return `Semaine du ${format(monday, 'EEEE dd/MM', { locale: fr })} au ${format(sunday, 'EEEE dd/MM/yyyy', { locale: fr })} (${year})`;
};

const buildWeekDates = (weekStartKey) => {
  const baseDate = parseISO(normalizeWeekKey(weekStartKey));
  return Array.from({ length: 7 }, (_, index) =>
    format(addDays(baseDate, index), 'yyyy-MM-dd')
  );
};

const CopyPastePage = ({
  planningData,
  setPlanningData,
  selectedShop,
  selectedWeek,
  liveWeekPlanning,
  isEmployeeAssignedToCurrentShop,
  setSelectedWeek,
  setForceRefresh,
  onBack
}) => {
  const [sourceWeek, setSourceWeek] = useState('');
  const [destinationWeek, setDestinationWeek] = useState('');
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [availableEmployees, setAvailableEmployees] = useState([]);
  const [feedback, setFeedback] = useState('');
  const [copiedData, setCopiedData] = useState(null);
  const [sourceDatePick, setSourceDatePick] = useState('');
  const [destinationDatePick, setDestinationDatePick] = useState('');

  const { storedWeeks, calendarWeeks } = useMemo(() => {
    const weekMap = new Map();
    const registerWeek = (weekKey, hasStoredData = false) => {
      const norm = normalizeWeekKey(weekKey);
      if (!norm) return;
      const prev = weekMap.get(norm) || { key: norm, label: formatWeekLabel(norm), hasStoredData: false };
      prev.hasStoredData = prev.hasStoredData || hasStoredData;
      weekMap.set(norm, prev);
    };

    if (planningData && selectedShop) {
      listShopWeeksWithData(planningData, selectedShop).forEach(({ weekKey }) => {
        registerWeek(weekKey, true);
      });
      const shop = planningData.shops?.find((s) => s.id === selectedShop);
      Object.keys(shop?.weeks || {}).forEach((weekKey) => registerWeek(weekKey, true));
    }

    if (selectedWeek) {
      const anchor = parseISO(normalizeWeekKey(selectedWeek));
      for (let i = -52; i <= 52; i += 1) {
        registerWeek(format(addDays(anchor, i * 7), 'yyyy-MM-dd'), false);
      }
    }

    const all = Array.from(weekMap.values()).sort((a, b) => b.key.localeCompare(a.key));
    return {
      storedWeeks: all.filter((w) => w.hasStoredData),
      calendarWeeks: all.filter((w) => !w.hasStoredData)
    };
  }, [planningData, selectedShop, selectedWeek]);

  useEffect(() => {
    if (selectedWeek) {
      const norm = normalizeWeekKey(selectedWeek);
      setSourceWeek(norm);
      setDestinationWeek(format(addDays(parseISO(norm), 7), 'yyyy-MM-dd'));
    }
  }, [selectedWeek]);

  useEffect(() => {
    if (planningData && selectedShop && isEmployeeAssignedToCurrentShop) {
      const shop = planningData.shops?.find((s) => s.id === selectedShop);
      if (shop?.employees) {
        const weekRef = selectedWeek ? addDays(parseISO(normalizeWeekKey(selectedWeek)), 6) : new Date();
        const employees = shop.employees
          .filter((emp) => emp && !isEmployeeHidden(emp, weekRef) && isEmployeeAssignedToCurrentShop(emp))
          .map((emp) => ({
            id: emp.id,
            name: emp.name
          }));
        setAvailableEmployees(employees);
        setSelectedEmployees(employees.map((emp) => emp.id));
      }
    }
  }, [planningData, selectedShop, isEmployeeAssignedToCurrentShop]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('copyPasteBuffer');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.data && parsed?.sourceWeek) {
        setCopiedData(parsed);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const mergeLiveIntoStoredPlanning = (storedPlanning, livePlanning) => {
    if (!livePlanning || typeof livePlanning !== 'object') return storedPlanning;
    const out = { ...storedPlanning };
    Object.keys(livePlanning).forEach((empId) => {
      if (!livePlanning[empId]) return;
      out[empId] = { ...(out[empId] || {}) };
      Object.keys(livePlanning[empId]).forEach((dayKey) => {
        const v = livePlanning[empId][dayKey];
        if (v === undefined || v === null) return;
        out[empId][dayKey] = Array.isArray(v) ? [...v] : v;
      });
    });
    return out;
  };

  const renderWeekOptions = () => (
    <>
      {storedWeeks.length > 0 && (
        <optgroup label="Semaines enregistrées (toutes dates, ex. année dernière)">
          {storedWeeks.map((week) => (
            <option key={`stored-${week.key}`} value={week.key}>
              {week.label}
            </option>
          ))}
        </optgroup>
      )}
      <optgroup label="Calendrier (± 1 an autour de la semaine affichée)">
        {[...storedWeeks, ...calendarWeeks]
          .filter((week, idx, arr) => arr.findIndex((w) => w.key === week.key) === idx)
          .sort((a, b) => b.key.localeCompare(a.key))
          .map((week) => (
            <option key={`cal-${week.key}`} value={week.key}>
              {week.label}
            </option>
          ))}
      </optgroup>
    </>
  );

  const handleCopy = useCallback(() => {
    try {
      setFeedback('🔄 Copie en cours...');

      if (!sourceWeek) {
        setFeedback('❌ Veuillez sélectionner une semaine source');
        return;
      }

      if (selectedEmployees.length === 0) {
        setFeedback('❌ Aucun employé sélectionné — cochez au moins un employé');
        return;
      }

      const normalizedSourceWeek = normalizeWeekKey(sourceWeek);
      const { resolvedWeekKey, planning: rawPlanning } = getRawWeekPlanningForShop(
        planningData,
        selectedShop,
        normalizedSourceWeek
      );

      let planningSource = { ...(rawPlanning || {}) };
      if (liveWeekPlanning && normalizedSourceWeek === normalizeWeekKey(selectedWeek)) {
        planningSource = mergeLiveIntoStoredPlanning(planningSource, liveWeekPlanning);
      }

      const shop = planningData?.shops?.find((s) => s.id === selectedShop);
      const employeesToCopy = (shop?.employees || []).filter(
        (emp) => emp?.id && selectedEmployees.includes(emp.id)
      );

      const dataToCopy = {};
      employeesToCopy.forEach((emp) => {
        const slice = resolveEmployeePlanningSlice(planningSource, emp);
        if (!slice || typeof slice !== 'object') return;
        dataToCopy[emp.id] = {};
        Object.keys(slice).forEach((dayKey) => {
          const cell = slice[dayKey];
          if (!dayCellHasPlanningContent(cell)) return;
          if (Array.isArray(cell)) {
            dataToCopy[emp.id][dayKey] = [...cell];
          } else if (typeof cell === 'string') {
            dataToCopy[emp.id][dayKey] = cell;
          }
        });
      });

      const copiedCells = Object.keys(dataToCopy).reduce(
        (n, empId) => n + Object.keys(dataToCopy[empId] || {}).length,
        0
      );

      if (copiedCells === 0) {
        setFeedback(
          `❌ Aucun horaire trouvé pour la semaine du ${format(parseISO(normalizedSourceWeek), 'dd/MM/yyyy')} ` +
            `(clé en base : ${resolvedWeekKey}). Vérifiez que cette semaine contient bien des créneaux enregistrés.`
        );
        return;
      }

      const copyBuffer = {
        data: dataToCopy,
        sourceWeek: normalizedSourceWeek,
        resolvedSourceWeek: resolvedWeekKey,
        selectedEmployees,
        timestamp: Date.now()
      };

      localStorage.setItem('copyPasteBuffer', JSON.stringify(copyBuffer));
      setCopiedData(copyBuffer);

      const sourceWeekStart = format(parseISO(normalizedSourceWeek), 'dd/MM/yyyy');
      const sourceWeekEnd = format(addDays(parseISO(normalizedSourceWeek), 6), 'dd/MM/yyyy');

      setFeedback(
        `✅ Copie réussie : ${copiedCells} jour(s)-employé, ${employeesToCopy.length} employé(s) — semaine du ${sourceWeekStart} au ${sourceWeekEnd}`
      );
    } catch (error) {
      console.error('Erreur lors de la copie:', error);
      setFeedback('❌ Erreur lors de la copie');
    }
  }, [
    planningData,
    selectedShop,
    sourceWeek,
    selectedWeek,
    selectedEmployees,
    liveWeekPlanning
  ]);

  const handlePaste = useCallback(() => {
    try {
      setFeedback('🔄 Collage en cours...');

      if (!destinationWeek) {
        setFeedback('❌ Veuillez sélectionner une semaine de destination');
        return;
      }

      const normalizedDestinationWeek = normalizeWeekKey(destinationWeek);

      let buffer = copiedData;
      if (!buffer) {
        try {
          const raw = localStorage.getItem('copyPasteBuffer');
          if (raw) buffer = JSON.parse(raw);
        } catch {
          buffer = null;
        }
      }
      if (!buffer?.data || typeof buffer.data !== 'object') {
        setFeedback('❌ Aucune donnée copiée. Cliquez d\'abord sur « Copier ».');
        return;
      }
      if (!copiedData && buffer) {
        setCopiedData(buffer);
      }

      const { planning: currentPlanning, selectedEmployees: destSelectedEmployees } =
        getRawWeekPlanningForShop(planningData, selectedShop, normalizedDestinationWeek);

      const hasExistingData = Object.keys(currentPlanning || {}).some((empId) =>
        Object.keys(currentPlanning[empId] || {}).some((dayKey) =>
          dayCellHasPlanningContent(currentPlanning[empId][dayKey])
        )
      );

      if (hasExistingData) {
        const existingWeekStart = format(parseISO(normalizedDestinationWeek), 'dd/MM/yyyy');
        const existingWeekEnd = format(addDays(parseISO(normalizedDestinationWeek), 6), 'dd/MM/yyyy');
        const confirmOverwrite = window.confirm(
          `⚠️ Des données existent déjà dans la semaine du ${existingWeekStart} au ${existingWeekEnd}.\n\nVoulez-vous les écraser ?`
        );
        if (!confirmOverwrite) {
          setFeedback('❌ Collage annulé');
          return;
        }
      }

      const newPlanning = JSON.parse(JSON.stringify(currentPlanning || {}));
      const sourceDates = buildWeekDates(buffer.sourceWeek);
      const destinationDates = buildWeekDates(normalizedDestinationWeek);

      Object.keys(buffer.data).forEach((empId) => {
        if (!newPlanning[empId]) newPlanning[empId] = {};
        sourceDates.forEach((sourceDate, index) => {
          const destinationDate = destinationDates[index];
          if (!Object.prototype.hasOwnProperty.call(buffer.data[empId], sourceDate)) return;
          const srcVal = buffer.data[empId][sourceDate];
          if (!dayCellHasPlanningContent(srcVal)) return;
          newPlanning[empId][destinationDate] = Array.isArray(srcVal) ? [...srcVal] : srcVal;
        });
      });

      const mergedSelectedEmployees = Array.from(
        new Set([...(destSelectedEmployees || []), ...(buffer.selectedEmployees || [])])
      );

      const updatedPlanningData = saveWeekPlanning(
        planningData,
        selectedShop,
        normalizedDestinationWeek,
        newPlanning,
        mergedSelectedEmployees
      );

      saveToLocalStorage('planningData', updatedPlanningData);
      saveToLocalStorage(`planning_${selectedShop}_${normalizedDestinationWeek}`, newPlanning);
      setPlanningData(updatedPlanningData);

      if (setSelectedWeek) {
        setSelectedWeek(normalizedDestinationWeek);
      }
      if (setForceRefresh) {
        setForceRefresh((prev) => prev + 1);
      }

      const successWeekStart = format(parseISO(normalizedDestinationWeek), 'dd/MM/yyyy');
      const successWeekEnd = format(addDays(parseISO(normalizedDestinationWeek), 6), 'dd/MM/yyyy');

      setFeedback(
        `✅ Collage réussi vers la semaine du ${successWeekStart} au ${successWeekEnd}. ` +
          'Retour au planning pour voir le résultat — pensez à SAUVE SUPABASE.'
      );

      setCopiedData(null);
      localStorage.removeItem('copyPasteBuffer');

      if (onBack) {
        setTimeout(() => onBack(), 800);
      }
    } catch (error) {
      console.error('Erreur lors du collage:', error);
      setFeedback('❌ Erreur lors du collage');
    }
  }, [
    planningData,
    selectedShop,
    destinationWeek,
    copiedData,
    setPlanningData,
    setSelectedWeek,
    setForceRefresh,
    onBack
  ]);

  const clearCopyBuffer = () => {
    setCopiedData(null);
    localStorage.removeItem('copyPasteBuffer');
    setFeedback('🗑️ Buffer de copie vidé');
  };

  return (
    <div style={{
      padding: '20px',
      maxWidth: '800px',
      margin: '0 auto',
      backgroundColor: '#f5f5f5',
      minHeight: '100vh'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ marginBottom: '20px', color: '#333' }}>
          📋 Copier-Coller de Planning
        </h2>

        <p style={{ marginBottom: '16px', color: '#555', fontSize: '14px', lineHeight: 1.5 }}>
          Copiez une semaine passée (même l&apos;année dernière) vers une semaine de cette année.
          Les horaires sont recalés jour par jour (lundi → lundi, mardi → mardi…), y compris congés et maladies.
        </p>

        <div style={{ marginBottom: '30px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
          <h3 style={{ marginBottom: '15px', color: '#495057' }}>📤 COPIE</h3>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Semaine source :
            </label>
            <select
              value={sourceWeek}
              onChange={(e) => setSourceWeek(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #ddd'
              }}
            >
              <option value="">Sélectionner une semaine</option>
              {renderWeekOptions()}
            </select>
            <div style={{ marginTop: '8px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13px', color: '#666' }}>Ou choisir un jour (→ lundi de la semaine) :</span>
              <input
                type="date"
                value={sourceDatePick}
                onChange={(e) => {
                  setSourceDatePick(e.target.value);
                  if (e.target.value) setSourceWeek(normalizeWeekKey(e.target.value));
                }}
                style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ddd' }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Employés à copier ({availableEmployees.length}) :
            </label>
            {availableEmployees.length === 0 ? (
              <p style={{ color: '#b71c1c', fontSize: '13px' }}>Aucun employé visible pour cette boutique.</p>
            ) : (
              <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '4px', padding: '10px' }}>
                {availableEmployees.map((emp) => (
                  <label key={emp.id} style={{ display: 'block', marginBottom: '5px' }}>
                    <input
                      type="checkbox"
                      checked={selectedEmployees.includes(emp.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedEmployees([...selectedEmployees, emp.id]);
                        } else {
                          setSelectedEmployees(selectedEmployees.filter((id) => id !== emp.id));
                        }
                      }}
                      style={{ marginRight: '8px' }}
                    />
                    {emp.name}
                  </label>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleCopy}
            style={{
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '10px 20px',
              fontSize: '14px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            📋 Copier
          </button>
        </div>

        <div style={{ marginBottom: '30px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
          <h3 style={{ marginBottom: '15px', color: '#495057' }}>📥 COLLAGE</h3>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Semaine de destination :
            </label>
            <select
              value={destinationWeek}
              onChange={(e) => setDestinationWeek(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #ddd'
              }}
            >
              <option value="">Sélectionner une semaine</option>
              {renderWeekOptions()}
            </select>
            <div style={{ marginTop: '8px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13px', color: '#666' }}>Ou choisir un jour (→ lundi de la semaine) :</span>
              <input
                type="date"
                value={destinationDatePick}
                onChange={(e) => {
                  setDestinationDatePick(e.target.value);
                  if (e.target.value) setDestinationWeek(normalizeWeekKey(e.target.value));
                }}
                style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ddd' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handlePaste}
              disabled={!copiedData}
              style={{
                backgroundColor: copiedData ? '#28a745' : '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                padding: '10px 20px',
                fontSize: '14px',
                cursor: copiedData ? 'pointer' : 'not-allowed',
                fontWeight: 'bold'
              }}
            >
              📥 Coller
            </button>

            {copiedData && (
              <button
                onClick={clearCopyBuffer}
                style={{
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '10px 20px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                🗑️ Vider
              </button>
            )}
          </div>
        </div>

        {feedback && (
          <div style={{
            padding: '10px',
            borderRadius: '4px',
            backgroundColor: feedback.includes('✅') ? '#d4edda' : feedback.includes('❌') ? '#f8d7da' : '#d1ecf1',
            color: feedback.includes('✅') ? '#155724' : feedback.includes('❌') ? '#721c24' : '#0c5460',
            marginBottom: '20px'
          }}>
            {feedback}
          </div>
        )}

        {copiedData && (
          <div style={{
            padding: '15px',
            backgroundColor: '#e7f3ff',
            borderRadius: '6px',
            marginBottom: '20px'
          }}>
            <h4 style={{ marginBottom: '10px', color: '#0056b3' }}>📋 Données copiées :</h4>
            <p><strong>Semaine source :</strong> {format(parseISO(copiedData.sourceWeek), 'dd/MM/yyyy')}</p>
            <p><strong>Employés :</strong> {copiedData.selectedEmployees.length} employé(s)</p>
            <p><strong>Copié le :</strong> {format(new Date(copiedData.timestamp), 'dd/MM/yyyy à HH:mm')}</p>
          </div>
        )}

        <button
          onClick={onBack}
          style={{
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '10px 20px',
            fontSize: '14px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          ← Retour au planning
        </button>
      </div>
    </div>
  );
};

export default CopyPastePage;
