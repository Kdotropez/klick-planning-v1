import { addDays, format, startOfWeek } from 'date-fns';

/** Boutiques éligibles au module test braderie (extensible). */
export const BRADERIE_TEST_SHOP_IDS = ['PORT_GRIMAUD', 'CAVALAIRE'];

export const BRADERIE_TEST_SHOP_LABELS = {
  PORT_GRIMAUD: 'Port Grimaud',
  CAVALAIRE: 'Cavalaire',
};

/** Lundi de la semaine prochaine (clé semaine planning). */
export const getBraderieTestWeekKey = (referenceDate = new Date()) => {
  const mondayThisWeek = startOfWeek(referenceDate, { weekStartsOn: 1 });
  return format(addDays(mondayThisWeek, 7), 'yyyy-MM-dd');
};

export const clonePlanningDataForBraderieTest = (planningData) =>
  JSON.parse(JSON.stringify(planningData || { version: '2.0', shops: [] }));

export const resolveBraderieTestShopId = (planningData, preferredId = null) => {
  const shopIds = new Set((planningData?.shops || []).map((shop) => String(shop.id)));
  const preferred = preferredId ? String(preferredId) : null;
  if (preferred && BRADERIE_TEST_SHOP_IDS.includes(preferred) && shopIds.has(preferred)) {
    return preferred;
  }
  return BRADERIE_TEST_SHOP_IDS.find((id) => shopIds.has(id)) || BRADERIE_TEST_SHOP_IDS[0];
};

export const getAvailableBraderieTestShops = (planningData) =>
  (planningData?.shops || []).filter((shop) => BRADERIE_TEST_SHOP_IDS.includes(String(shop.id)));

export const isBraderieTestShopId = (shopId) =>
  shopId != null && BRADERIE_TEST_SHOP_IDS.includes(String(shopId));

export const promptBraderieTestShop = (planningData) => {
  const available = getAvailableBraderieTestShops(planningData);
  if (!available.length) {
    alert(
      '❌ Aucune boutique braderie disponible (Port Grimaud / Cavalaire).\n\n' +
        'Chargez d\'abord le planning Supabase.'
    );
    return null;
  }
  if (available.length === 1) return available[0].id;

  const options = available
    .map((shop, index) => `${index + 1}. ${shop.name || shop.id}`)
    .join('\n');
  const raw = window.prompt(
    `🧪 Test braderie — choisissez la boutique :\n\n${options}\n\n` +
      'Entrez 1 ou 2 (annuler = abandon).',
    '1'
  );
  if (raw == null || !String(raw).trim()) return null;
  const choice = Number.parseInt(String(raw).trim(), 10);
  if (!Number.isFinite(choice) || choice < 1 || choice > available.length) {
    alert('❌ Choix invalide.');
    return null;
  }
  return available[choice - 1].id;
};
