import React, { useEffect, useMemo, useState } from 'react';
import { addDays, format, parseISO, startOfWeek, endOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import Button from '../common/Button';
import {
  exportShopWeeklyHtmlReport,
  collectShopReportEmployees,
  loadShopReportAlertPrefs,
  saveShopReportAlertPrefs,
  loadShopReportSectionPrefs,
  saveShopReportSectionPrefs,
  SHOP_REPORT_SECTION_DEFS,
  DEFAULT_SHOP_REPORT_ALERT,
  DEFAULT_SHOP_REPORT_SECTIONS,
  hasAnyShopReportSection
} from '../../utils/shopWeeklyHtmlReport';

const NESTED_DAY_KEYS = ['dayGantt', 'dayHeatmap', 'dayTeamOverlap', 'dayPlanningGrid', 'dayTable'];

const ShopWeeklyHtmlReportModal = ({
  isOpen,
  onClose,
  planningData,
  shops = [],
  selectedShop,
  selectedWeek,
  onFeedback
}) => {
  const [targetShopId, setTargetShopId] = useState(selectedShop || '');
  const [minStaff, setMinStaff] = useState(String(DEFAULT_SHOP_REPORT_ALERT.minStaff));
  const [alertFrom, setAlertFrom] = useState(DEFAULT_SHOP_REPORT_ALERT.alertFrom);
  const [alertTo, setAlertTo] = useState(DEFAULT_SHOP_REPORT_ALERT.alertTo);
  const [sections, setSections] = useState({ ...DEFAULT_SHOP_REPORT_SECTIONS });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const alertPrefs = loadShopReportAlertPrefs();
    setMinStaff(String(alertPrefs.minStaff));
    setAlertFrom(alertPrefs.alertFrom);
    setAlertTo(alertPrefs.alertTo);
    setSections(loadShopReportSectionPrefs());
    if (selectedShop) setTargetShopId(selectedShop);
  }, [isOpen, selectedShop]);

  const shopOptions = useMemo(
    () =>
      (shops || []).map((shop) => ({
        id: shop.id,
        label: shop.name?.replace(/[-_]/g, ' ') || shop.id
      })),
    [shops]
  );

  const sectionGroups = useMemo(() => {
    const groups = new Map();
    SHOP_REPORT_SECTION_DEFS.forEach((def) => {
      if (!groups.has(def.group)) groups.set(def.group, []);
      groups.get(def.group).push(def);
    });
    return [...groups.entries()];
  }, []);

  const weekLabel = useMemo(() => {
    if (!selectedWeek) return '';
    const start = startOfWeek(parseISO(selectedWeek), { weekStartsOn: 1 });
    const end = endOfWeek(parseISO(selectedWeek), { weekStartsOn: 1 });
    return `${format(start, 'd MMMM', { locale: fr })} au ${format(end, 'd MMMM yyyy', { locale: fr })}`;
  }, [selectedWeek]);

  const previewStats = useMemo(() => {
    const shop = planningData?.shops?.find((s) => String(s.id) === String(targetShopId));
    if (!shop || !selectedWeek) return null;
    const weekDate = parseISO(selectedWeek);
    const weekStart = startOfWeek(weekDate, { weekStartsOn: 1 });
    const employees = collectShopReportEmployees(shop, planningData, weekDate);
    const weekKey = format(weekStart, 'yyyy-MM-dd');
    const planning = shop.weeks?.[weekKey]?.planning || {};
    let withHours = 0;
    employees.forEach((emp) => {
      for (let i = 0; i < 7; i += 1) {
        const dayKey = format(addDays(weekStart, i), 'yyyy-MM-dd');
        const dayData = planning?.[emp.id]?.[dayKey];
        if (Array.isArray(dayData) && dayData.some((v) => v === true || v === 1 || v === '1')) {
          withHours += 1;
          break;
        }
      }
    });
    return { teamSize: employees.length, withHours };
  }, [planningData, targetShopId, selectedWeek]);

  const selectedCount = useMemo(
    () => SHOP_REPORT_SECTION_DEFS.filter((def) => sections[def.id]).length,
    [sections]
  );

  const toggleSection = (id, checked) => {
    setSections((prev) => {
      const next = { ...prev, [id]: checked };
      if (id === 'dayBlocks' && !checked) {
        NESTED_DAY_KEYS.forEach((key) => {
          next[key] = false;
        });
      }
      const def = SHOP_REPORT_SECTION_DEFS.find((d) => d.id === id);
      if (def?.nested && checked) {
        next.dayBlocks = true;
      }
      return next;
    });
  };

  const setAllSections = (value) => {
    setSections(
      SHOP_REPORT_SECTION_DEFS.reduce((acc, def) => ({ ...acc, [def.id]: value }), {})
    );
  };

  if (!isOpen) return null;

  const handleExport = async () => {
    if (!targetShopId || !selectedWeek) return;
    if (!hasAnyShopReportSection(sections)) {
      onFeedback?.('❌ Cochez au moins une section à inclure dans le HTML.');
      return;
    }
    const alertOptions = {
      minStaff: parseInt(minStaff, 10) || DEFAULT_SHOP_REPORT_ALERT.minStaff,
      alertFrom,
      alertTo
    };
    saveShopReportAlertPrefs(alertOptions);
    saveShopReportSectionPrefs(sections);
    setBusy(true);
    try {
      const result = exportShopWeeklyHtmlReport({
        planningData,
        shopId: targetShopId,
        selectedWeek,
        openPreview: true,
        alertOptions,
        sectionOptions: sections
      });
      if (result?.ok) {
        onFeedback?.(`✅ Rapport HTML généré (${selectedCount} section(s)).`);
        onClose?.();
      } else if (result?.reason === 'no-sections') {
        onFeedback?.('❌ Aucune section sélectionnée.');
      } else {
        onFeedback?.('❌ Impossible de générer le rapport (données manquantes).');
      }
    } catch (error) {
      console.error('ShopWeeklyHtmlReportModal:', error);
      onFeedback?.('❌ Erreur lors de la génération du rapport HTML.');
    } finally {
      setBusy(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '8px 10px',
    fontSize: 14,
    borderRadius: 8,
    border: '1px solid #cbd5e1',
    boxSizing: 'border-box'
  };

  const checkboxLabelStyle = (nested) => ({
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    fontSize: nested ? 12 : 13,
    marginBottom: 6,
    marginLeft: nested ? 16 : 0,
    color: nested && !sections.dayBlocks ? '#94a3b8' : '#334155',
    cursor: 'pointer'
  });

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50000,
        background: 'rgba(15,23,42,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16
      }}
      onClick={onClose}
    >
      <div
        className="modal-content"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(600px, 100%)',
          maxHeight: '92vh',
          overflow: 'auto',
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 20px 50px rgba(0,0,0,0.2)'
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            background: 'linear-gradient(90deg, #0f766e 0%, #115e59 100%)',
            color: '#fff'
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18 }}>📋 Rapport équipe par boutique (HTML)</h2>
          <p style={{ margin: '8px 0 0', fontSize: 13, opacity: 0.92 }}>
            Semaine du {weekLabel}
          </p>
        </div>

        <div style={{ padding: 20 }}>
          <label style={{ display: 'block', fontWeight: 700, marginBottom: 8, fontSize: 14 }}>
            Boutique
          </label>
          <select
            value={targetShopId}
            onChange={(e) => setTargetShopId(e.target.value)}
            style={{ ...inputStyle, marginBottom: 16 }}
          >
            {shopOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>

          <fieldset
            style={{
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              padding: '12px 14px',
              margin: '0 0 16px'
            }}
          >
            <legend style={{ fontWeight: 700, fontSize: 13, padding: '0 6px' }}>
              📄 Sections à inclure dans le HTML ({selectedCount}/{SHOP_REPORT_SECTION_DEFS.length})
            </legend>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setAllSections(true)}
                style={{
                  fontSize: 11,
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: '1px solid #99f6e4',
                  background: '#f0fdfa',
                  cursor: 'pointer'
                }}
              >
                Tout cocher
              </button>
              <button
                type="button"
                onClick={() => setAllSections(false)}
                style={{
                  fontSize: 11,
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  cursor: 'pointer'
                }}
              >
                Tout décocher
              </button>
            </div>
            {sectionGroups.map(([groupName, defs]) => (
              <div key={groupName} style={{ marginBottom: 12 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: '#0f766e',
                    marginBottom: 6
                  }}
                >
                  {groupName}
                </div>
                {defs.map((def) => (
                  <label key={def.id} style={checkboxLabelStyle(def.nested)}>
                    <input
                      type="checkbox"
                      checked={!!sections[def.id]}
                      disabled={def.nested && !sections.dayBlocks && def.id !== 'dayBlocks'}
                      onChange={(e) => toggleSection(def.id, e.target.checked)}
                      style={{ marginTop: 2 }}
                    />
                    <span>{def.label}</span>
                  </label>
                ))}
              </div>
            ))}
          </fieldset>

          <fieldset
            style={{
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              padding: '12px 14px',
              margin: '0 0 16px'
            }}
          >
            <legend style={{ fontWeight: 700, fontSize: 13, padding: '0 6px' }}>
              ⚠️ Alerte sous-effectif
            </legend>
            <p style={{ margin: '0 0 10px', fontSize: 12, color: '#64748b', lineHeight: 1.45 }}>
              Utilisée si panneau alertes, matrice semaine ou heatmap jour est coché.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <label style={{ fontSize: 12 }}>
                Minimum requis
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={minStaff}
                  onChange={(e) => setMinStaff(e.target.value)}
                  style={{ ...inputStyle, marginTop: 4 }}
                />
              </label>
              <label style={{ fontSize: 12 }}>
                De (heure)
                <input
                  type="time"
                  value={alertFrom}
                  onChange={(e) => setAlertFrom(e.target.value)}
                  style={{ ...inputStyle, marginTop: 4 }}
                />
              </label>
              <label style={{ fontSize: 12 }}>
                À (heure)
                <input
                  type="time"
                  value={alertTo}
                  onChange={(e) => setAlertTo(e.target.value)}
                  style={{ ...inputStyle, marginTop: 4 }}
                />
              </label>
            </div>
          </fieldset>

          {previewStats && (
            <p style={{ margin: '0 0 16px', fontSize: 12, color: '#64748b' }}>
              {previewStats.teamSize} employé(s) affecté(s) · {previewStats.withHours} avec horaires cette semaine
            </p>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <Button className="button-retour" onClick={onClose} disabled={busy}>
              Annuler
            </Button>
            <Button
              className="button-primary"
              onClick={handleExport}
              disabled={busy || !targetShopId || selectedCount === 0}
              style={{ backgroundColor: '#0f766e' }}
            >
              {busy ? 'Génération…' : '📱 Générer le HTML'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShopWeeklyHtmlReportModal;
