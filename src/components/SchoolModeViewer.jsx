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

const SchoolModeViewer = ({ onBack }) => {
  const [schoolData, setSchoolData] = useState(null);
  const [fileName, setFileName] = useState('');
  const [message, setMessage] = useState('');
  const [selectedWeek, setSelectedWeek] = useState('');
  const [showWeeklyMatrix, setShowWeeklyMatrix] = useState(false);

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
      setSchoolData(normalizeSchoolDataWeekKeys(parsed));
      setFileName(file.name);
      const weekKeys = new Set();
      (parsed.shops || []).forEach((shop) => {
        Object.keys(shop.weeks || {}).forEach((weekKey) => weekKeys.add(normalizeWeekKey(weekKey)));
      });
      const sortedWeeks = Array.from(weekKeys).sort();
      setSelectedWeek(sortedWeeks[sortedWeeks.length - 1] || '');
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
    const ok = exportPlanningToExcel(schoolData, { monthDate: new Date(), isolatedMode: true });
    setMessage(ok ? 'Export Excel du fichier école généré.' : 'Échec export Excel du fichier école.');
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

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px', alignItems: 'center' }}>
              <button onClick={handleExportJson} style={{ padding: '10px 14px', borderRadius: '8px', border: 'none', background: '#0f766e', color: '#fff', cursor: 'pointer', fontWeight: 800 }}>
                Exporter ce JSON
              </button>
              <button onClick={handleExportExcel} style={{ padding: '10px 14px', borderRadius: '8px', border: 'none', background: '#7c3aed', color: '#fff', cursor: 'pointer', fontWeight: 800 }}>
                Exporter ce contenu en Excel
              </button>
              {summary.weekKeys.length > 0 && (
                <>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#334155' }}>
                    Semaine
                    <select
                      value={selectedWeek}
                      onChange={(event) => setSelectedWeek(event.target.value)}
                      style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', minWidth: '280px' }}
                    >
                      {summary.weekKeys.map((weekKey) => (
                        <option key={weekKey} value={weekKey}>
                          {formatWeekLabel(weekKey)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    onClick={() => setShowWeeklyMatrix(true)}
                    disabled={!selectedWeek}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: 'none',
                      background: selectedWeek ? '#0f4c75' : '#94a3b8',
                      color: '#fff',
                      cursor: selectedWeek ? 'pointer' : 'not-allowed',
                      fontWeight: 800
                    }}
                  >
                    📋 Visualiser les horaires
                  </button>
                </>
              )}
            </div>

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
        selectedWeek={selectedWeek}
        currentShopId={null}
        currentWeekPlanning={{}}
        isolatedMode
      />
    </div>
  );
};

export default SchoolModeViewer;
