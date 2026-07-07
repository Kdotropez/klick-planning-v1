import React, { useMemo, useState } from 'react';
import { addDays, format, parseISO, startOfWeek, endOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import Button from '../common/Button';
import { exportShopWeeklyHtmlReport, collectShopReportEmployees } from '../../utils/shopWeeklyHtmlReport';

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
  const [busy, setBusy] = useState(false);

  const shopOptions = useMemo(
    () =>
      (shops || []).map((shop) => ({
        id: shop.id,
        label: shop.name?.replace(/[-_]/g, ' ') || shop.id
      })),
    [shops]
  );

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

  if (!isOpen) return null;

  const handleExport = async () => {
    if (!targetShopId || !selectedWeek) return;
    setBusy(true);
    try {
      const result = exportShopWeeklyHtmlReport({
        planningData,
        shopId: targetShopId,
        selectedWeek,
        openPreview: true
      });
      if (result?.ok) {
        onFeedback?.('✅ Rapport HTML boutique généré (téléchargement + aperçu).');
        onClose?.();
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
          width: 'min(520px, 100%)',
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
          overflow: 'hidden'
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
            style={{
              width: '100%',
              padding: '10px 12px',
              fontSize: 14,
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              marginBottom: 16
            }}
          >
            {shopOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>

          <div
            style={{
              background: '#f0fdfa',
              border: '1px solid #99f6e4',
              borderRadius: 8,
              padding: '12px 14px',
              fontSize: 13,
              color: '#134e4a',
              lineHeight: 1.5,
              marginBottom: 16
            }}
          >
            <strong>Contenu du rapport :</strong>
            <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
              <li>Tableau synthèse : qui travaille chaque jour + total semaine</li>
              <li>Détail par jour : entrée, pause, sortie, heures</li>
              <li>Bandeau « Présents » pour voir l'équipe en un coup d'œil</li>
            </ul>
            {previewStats && (
              <p style={{ margin: '10px 0 0' }}>
                {previewStats.teamSize} employé(s) affecté(s) · {previewStats.withHours} avec horaires cette semaine
              </p>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <Button className="button-retour" onClick={onClose} disabled={busy}>
              Annuler
            </Button>
            <Button
              className="button-primary"
              onClick={handleExport}
              disabled={busy || !targetShopId}
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
