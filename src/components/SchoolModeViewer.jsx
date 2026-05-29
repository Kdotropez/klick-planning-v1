import React, { useMemo, useState } from 'react';
import { addDays, format, parseISO, startOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import { exportPlanningToExcel } from '../utils/planningDataManager';
import WeeklyWorkMatrixModal from './planning/WeeklyWorkMatrixModal';

const readJsonFile = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result || '{}')));
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });

const downloadJson = (data, fileName) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
};

const safeName = (value) => String(value || 'sauvegarde').replace(/[^\w-]+/g, '_');

const normalizeWeekKey = (weekKey) => {
  try {
    return format(startOfWeek(parseISO(weekKey), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  } catch {
    return weekKey;
  }
};

const formatWeekLabel = (weekKey) => {
  try {
    const monday = parseISO(normalizeWeekKey(weekKey));
    return `Du ${format(monday, 'd MMMM', { locale: fr })} au ${format(addDays(monday, 6), 'd MMMM yyyy', { locale: fr })}`;
  } catch {
    return weekKey;
  }
};

const normalizeSchoolDataWeekKeys = (data) => {
  const shops = (data?.shops || []).map((shop) => {
    const weeks = {};
    Object.entries(shop.weeks || {}).forEach(([weekKey, weekData]) => {
      const normalizedKey = normalizeWeekKey(weekKey);
      const existing = weeks[normalizedKey] || {};
      weeks[normalizedKey] = {
        ...existing,
        ...weekData,
        planning: {
          ...(existing.planning || {}),
          ...(weekData?.planning || {})
        },
        selectedEmployees: weekData?.selectedEmployees || existing.selectedEmployees
      };
    });
    return { ...shop, weeks };
  });
  return { ...data, shops };
};

const collectDateBounds = (data) => {
  const dayKeys = new Set();
  (data?.shops || []).forEach((shop) => {
    Object.entries(shop.weeks || {}).forEach(([weekKey, weekData]) => {
      try {
        const monday = parseISO(normalizeWeekKey(weekKey));
        for (let index = 0; index < 7; index += 1) {
          dayKeys.add(format(addDays(monday, index), 'yyyy-MM-dd'));
        }
      } catch {
        // ignore invalid week keys
      }
      Object.values(weekData?.planning || {}).forEach((employeePlanning) => {
        if (!employeePlanning || typeof employeePlanning !== 'object') return;
        Object.keys(employeePlanning).forEach((dayKey) => {
          if (/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) dayKeys.add(dayKey);
        });
      });
    });
  });
  const sorted = Array.from(dayKeys).sort();
  return {
    min: sorted[0] || '',
    max: sorted[sorted.length - 1] || format(new Date(), 'yyyy-MM-dd')
  };
};

const SchoolModeViewer = ({ onBack }) => {
  const [schoolData, setSchoolData] = useState(null);
  const [fileName, setFileName] = useState('');
  const [message, setMessage] = useState('');
  const [selectedWeek, setSelectedWeek] = useState('');
  const [showWeeklyMatrix, setShowWeeklyMatrix] = useState(false);
  const [viewPeriodType, setViewPeriodType] = useState('week');
  const [referenceDate, setReferenceDate] = useState('');
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [dateBounds, setDateBounds] = useState({ min: '', max: '' });

  const summary = useMemo(() => {
    const shops = Array.isArray(schoolData?.shops) ? schoolData.shops : [];
    const employeeIds = new Set();
    const weekKeys = new Set();
    let planningEntries = 0;

    shops.forEach((shop) => {
      (shop.employees || []).forEach((employee) => {
        if (employee?.id || employee?.name) employeeIds.add(employee.id || employee.name);
      });
      Object.entries(shop.weeks || {}).forEach(([weekKey, weekData]) => {
        weekKeys.add(weekKey);
        const planning = weekData?.planning || {};
        Object.values(planning).forEach((employeePlanning) => {
          if (employeePlanning && typeof employeePlanning === 'object') {
            planningEntries += Object.keys(employeePlanning).length;
          }
        });
      });
    });

    return {
      shopCount: shops.length,
      employeeCount: employeeIds.size,
      weekCount: weekKeys.size,
      planningEntries,
      shops,
      weekKeys: Array.from(weekKeys).sort().map(normalizeWeekKey).filter((value, index, array) => array.indexOf(value) === index)
    };
  }, [schoolData]);

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = await readJsonFile(file);
      if (!Array.isArray(parsed?.shops)) {
        setMessage('Fichier invalide : aucune liste de boutiques trouvée.');
        return;
      }
      const normalized = normalizeSchoolDataWeekKeys(parsed);
      const bounds = collectDateBounds(normalized);
      setSchoolData(normalized);
      setFileName(file.name);
      setDateBounds(bounds);
      const weekKeys = new Set();
      (normalized.shops || []).forEach((shop) => {
        Object.keys(shop.weeks || {}).forEach((weekKey) => weekKeys.add(normalizeWeekKey(weekKey)));
      });
      const sortedWeeks = Array.from(weekKeys).sort();
      const defaultDate = bounds.max || sortedWeeks[sortedWeeks.length - 1] || format(new Date(), 'yyyy-MM-dd');
      setReferenceDate(defaultDate);
      setRangeStart(bounds.min || defaultDate);
      setRangeEnd(bounds.max || defaultDate);
      setSelectedWeek(sortedWeeks[sortedWeeks.length - 1] || normalizeWeekKey(defaultDate));
      setViewPeriodType('week');
      setShowWeeklyMatrix(false);
      setMessage('Fichier chargé en mode école : aucune donnée active n’a été remplacée.');
    } catch (error) {
      console.error('Erreur mode école:', error);
      setMessage('Impossible de lire ce fichier JSON.');
    } finally {
      event.target.value = '';
    }
  };

  const handleExportJson = () => {
    if (!schoolData) return;
    downloadJson(schoolData, `mode_ecole_${safeName(fileName)}_${format(new Date(), 'yyyy-MM-dd_HHmm')}.json`);
  };

  const handleExportExcel = () => {
    if (!schoolData) return;
    const monthDate = referenceDate ? parseISO(referenceDate) : new Date();
    const ok = exportPlanningToExcel(schoolData, { monthDate, isolatedMode: true });
    setMessage(ok ? 'Export Excel du fichier école généré.' : 'Échec export Excel du fichier école.');
  };

  const viewerAnchorWeek = useMemo(() => {
    if (viewPeriodType === 'range') return rangeStart;
    if (viewPeriodType === 'week') return normalizeWeekKey(referenceDate || selectedWeek);
    return referenceDate || selectedWeek;
  }, [viewPeriodType, rangeStart, referenceDate, selectedWeek]);

  const handleQuickWeekSelect = (weekKey) => {
    setSelectedWeek(weekKey);
    setReferenceDate(weekKey);
    setViewPeriodType('week');
  };

  const handleVisualize = () => {
    if (viewPeriodType === 'range') {
      if (!rangeStart || !rangeEnd) {
        setMessage('Choisissez une date de début et une date de fin.');
        return;
      }
      if (rangeStart > rangeEnd) {
        setMessage('La date de début doit être antérieure ou égale à la date de fin.');
        return;
      }
    } else if (!referenceDate) {
      setMessage('Choisissez une date à visualiser.');
      return;
    }
    setShowWeeklyMatrix(true);
  };

  const periodButtonStyle = (active) => ({
    padding: '8px 14px',
    borderRadius: '8px',
    border: active ? '2px solid #2563eb' : '1px solid #cbd5e1',
    background: active ? '#2563eb' : '#fff',
    color: active ? '#fff' : '#334155',
    cursor: 'pointer',
    fontWeight: 800
  });

  const dateInputStyle = {
    padding: '8px 10px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    minWidth: '160px'
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', padding: '24px', fontFamily: 'Roboto, sans-serif' }}>
      <div style={{ maxWidth: '1180px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginBottom: '18px' }}>
          <div>
            <h1 style={{ margin: 0, color: '#0f172a' }}>Mode école - lecture d’une sauvegarde</h1>
            <p style={{ margin: '6px 0 0', color: '#475569' }}>
              Ouvrir un ancien fichier sans remplacer le planning actuel, puis exporter son contenu.
            </p>
          </div>
          <button onClick={onBack} style={{ padding: '10px 16px', borderRadius: '8px', border: 'none', background: '#334155', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>
            Retour
          </button>
        </div>

        <div style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: '14px', padding: '18px', marginBottom: '16px' }}>
          <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>Sécurité</div>
          <div style={{ color: '#475569', lineHeight: 1.5 }}>
            Ce mode ne restaure pas le fichier, ne l’enregistre pas dans le planning actif et ne modifie pas Supabase.
            Il sert uniquement à contrôler une sauvegarde.
          </div>
        </div>

        <label style={{ display: 'inline-block', padding: '14px 18px', borderRadius: '10px', background: '#2563eb', color: '#fff', fontWeight: 800, cursor: 'pointer', marginBottom: '14px' }}>
          Choisir un fichier JSON de sauvegarde
          <input type="file" accept=".json,application/json" onChange={handleFileChange} style={{ display: 'none' }} />
        </label>

        {message && (
          <div style={{ padding: '12px 14px', borderRadius: '10px', background: '#e0f2fe', color: '#075985', marginBottom: '14px', fontWeight: 700 }}>
            {message}
          </div>
        )}

        {schoolData && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '16px' }}>
              {[
                ['Fichier', fileName],
                ['Boutiques', summary.shopCount],
                ['Employés', summary.employeeCount],
                ['Semaines', summary.weekCount],
                ['Jours planning', summary.planningEntries]
              ].map(([label, value]) => (
                <div key={label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px' }}>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 800 }}>{label}</div>
                  <div style={{ marginTop: '6px', fontSize: '18px', fontWeight: 900, color: '#0f172a', wordBreak: 'break-word' }}>{value}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
              <button onClick={handleExportJson} style={{ padding: '10px 14px', borderRadius: '8px', border: 'none', background: '#0f766e', color: '#fff', cursor: 'pointer', fontWeight: 800 }}>
                Exporter ce JSON
              </button>
              <button onClick={handleExportExcel} style={{ padding: '10px 14px', borderRadius: '8px', border: 'none', background: '#7c3aed', color: '#fff', cursor: 'pointer', fontWeight: 800 }}>
                Exporter ce contenu en Excel
              </button>
            </div>

            {summary.weekKeys.length > 0 && (
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '18px', marginBottom: '16px' }}>
                <div style={{ fontWeight: 900, color: '#0f172a', marginBottom: '12px', fontSize: '16px' }}>
                  Période à visualiser
                </div>
                {dateBounds.min && dateBounds.max && (
                  <div style={{ color: '#64748b', marginBottom: '12px', fontSize: '13px' }}>
                    Données disponibles du {format(parseISO(dateBounds.min), 'dd/MM/yyyy', { locale: fr })} au {format(parseISO(dateBounds.max), 'dd/MM/yyyy', { locale: fr })}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
                  <button type="button" onClick={() => setViewPeriodType('week')} style={periodButtonStyle(viewPeriodType === 'week')}>
                    Semaine
                  </button>
                  <button type="button" onClick={() => setViewPeriodType('month')} style={periodButtonStyle(viewPeriodType === 'month')}>
                    Mois calendaire
                  </button>
                  <button type="button" onClick={() => setViewPeriodType('range')} style={periodButtonStyle(viewPeriodType === 'range')}>
                    Plage personnalisée
                  </button>
                </div>

                {viewPeriodType === 'range' ? (
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '14px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#334155' }}>
                      Du
                      <input
                        type="date"
                        value={rangeStart}
                        min={dateBounds.min || undefined}
                        max={dateBounds.max || undefined}
                        onChange={(event) => setRangeStart(event.target.value)}
                        style={dateInputStyle}
                      />
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#334155' }}>
                      au
                      <input
                        type="date"
                        value={rangeEnd}
                        min={dateBounds.min || undefined}
                        max={dateBounds.max || undefined}
                        onChange={(event) => setRangeEnd(event.target.value)}
                        style={dateInputStyle}
                      />
                    </label>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '14px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#334155' }}>
                      {viewPeriodType === 'week' ? 'Date dans la semaine' : 'Date dans le mois'}
                      <input
                        type="date"
                        value={referenceDate}
                        min={dateBounds.min || undefined}
                        max={dateBounds.max || undefined}
                        onChange={(event) => {
                          setReferenceDate(event.target.value);
                          if (viewPeriodType === 'week') {
                            setSelectedWeek(normalizeWeekKey(event.target.value));
                          }
                        }}
                        style={dateInputStyle}
                      />
                    </label>
                    {viewPeriodType === 'week' && referenceDate && (
                      <span style={{ color: '#475569', fontWeight: 600, fontSize: '13px' }}>
                        {formatWeekLabel(normalizeWeekKey(referenceDate))}
                      </span>
                    )}
                    {viewPeriodType === 'month' && referenceDate && (
                      <span style={{ color: '#475569', fontWeight: 600, fontSize: '13px' }}>
                        {format(parseISO(referenceDate), 'MMMM yyyy', { locale: fr })}
                      </span>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#334155' }}>
                    Accès rapide semaine
                    <select
                      value={selectedWeek}
                      onChange={(event) => handleQuickWeekSelect(event.target.value)}
                      style={{ ...dateInputStyle, minWidth: '280px' }}
                    >
                      {summary.weekKeys.map((weekKey) => (
                        <option key={weekKey} value={weekKey}>
                          {formatWeekLabel(weekKey)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    onClick={handleVisualize}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: 'none',
                      background: '#0f4c75',
                      color: '#fff',
                      cursor: 'pointer',
                      fontWeight: 800
                    }}
                  >
                    📋 Visualiser les horaires
                  </button>
                </div>
              </div>
            )}

            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', overflow: 'hidden' }}>
              <div style={{ padding: '12px 14px', background: '#0f4c75', color: '#fff', fontWeight: 900 }}>
                Contenu du fichier
              </div>
              <div style={{ overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#e8f0f7' }}>
                      <th style={{ textAlign: 'left', padding: '10px', border: '1px solid #cbd5e1' }}>Boutique</th>
                      <th style={{ textAlign: 'right', padding: '10px', border: '1px solid #cbd5e1' }}>Employés</th>
                      <th style={{ textAlign: 'right', padding: '10px', border: '1px solid #cbd5e1' }}>Semaines</th>
                      <th style={{ textAlign: 'left', padding: '10px', border: '1px solid #cbd5e1' }}>Premières semaines</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.shops.map((shop) => {
                      const weeks = Object.keys(shop.weeks || {}).sort();
                      return (
                        <tr key={shop.id || shop.name}>
                          <td style={{ padding: '10px', border: '1px solid #e2e8f0', fontWeight: 800 }}>{shop.name || shop.id}</td>
                          <td style={{ padding: '10px', border: '1px solid #e2e8f0', textAlign: 'right' }}>{(shop.employees || []).length}</td>
                          <td style={{ padding: '10px', border: '1px solid #e2e8f0', textAlign: 'right' }}>{weeks.length}</td>
                          <td style={{ padding: '10px', border: '1px solid #e2e8f0' }}>{weeks.slice(0, 6).join(', ')}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      <WeeklyWorkMatrixModal
        isOpen={showWeeklyMatrix}
        onClose={() => setShowWeeklyMatrix(false)}
        planningData={schoolData}
        selectedWeek={viewerAnchorWeek}
        currentShopId={null}
        currentWeekPlanning={{}}
        isolatedMode
        viewerPeriodMode={viewPeriodType}
        viewerRangeEnd={viewPeriodType === 'range' ? rangeEnd : null}
      />
    </div>
  );
};

export default SchoolModeViewer;
