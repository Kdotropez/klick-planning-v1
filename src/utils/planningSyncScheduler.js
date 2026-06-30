import { saveRemotePlanning, saveCompletePlanningData } from './remoteStore';
import { getShopById } from './planningDataManager';

const WEEK_DEBOUNCE_MS = 3000;
const COMPLETE_DEBOUNCE_MS = 5 * 60 * 1000;

let weekTimer = null;
let completeTimer = null;
let pendingWeek = null;
let pendingComplete = null;
let weekSyncInFlight = null;

const extractWeekPayload = (planningData, shopId, weekKey) => {
  const shop = getShopById(planningData, shopId);
  const weekData = shop?.weeks?.[weekKey];
  if (!weekData) return null;
  return {
    planning: weekData.planning || {},
    selectedEmployees: Array.isArray(weekData.selectedEmployees) ? weekData.selectedEmployees : []
  };
};

const runWeekSync = async () => {
  if (!pendingWeek) return { ok: false, skipped: true };
  const { planningData, shopId, weekKey } = pendingWeek;
  pendingWeek = null;

  const weekPayload = extractWeekPayload(planningData, shopId, weekKey);
  if (!weekPayload) return { ok: false, reason: 'missing-week' };

  const ok = await saveRemotePlanning(weekPayload, shopId, weekKey);
  if (ok) {
    scheduleIncrementalCompleteSync(planningData);
  }
  return { ok, shopId, weekKey };
};

/**
 * Sync incrémentale debouncée : une ligne shop_id + week_key (léger).
 */
export const scheduleIncrementalWeekSync = (planningData, shopId, weekKey) => {
  if (!planningData || !shopId || !weekKey) return;
  pendingWeek = { planningData, shopId, weekKey };
  if (weekTimer) clearTimeout(weekTimer);
  weekTimer = setTimeout(async () => {
    weekTimer = null;
    weekSyncInFlight = runWeekSync();
    try {
      await weekSyncInFlight;
    } finally {
      weekSyncInFlight = null;
    }
  }, WEEK_DEBOUNCE_MS);
};

/**
 * Snapshot complete_file debouncé (backup global, moins fréquent).
 */
export const scheduleIncrementalCompleteSync = (planningData) => {
  if (!planningData) return;
  pendingComplete = planningData;
  if (completeTimer) clearTimeout(completeTimer);
  completeTimer = setTimeout(async () => {
    completeTimer = null;
    if (!pendingComplete) return;
    const data = pendingComplete;
    pendingComplete = null;
    await saveCompletePlanningData(data);
  }, COMPLETE_DEBOUNCE_MS);
};

/**
 * Snapshot complete_file immédiat (renommage, masquage, réactivation employé).
 */
export const pushCompleteSyncNow = async (planningData) => {
  if (!planningData) return { ok: false };
  if (completeTimer) {
    clearTimeout(completeTimer);
    completeTimer = null;
  }
  pendingComplete = null;
  return saveCompletePlanningData(planningData);
};

/** Flush immédiat (fermeture session, SAUVE SUPABASE, inactivité). */
export const flushAllIncrementalSyncs = async () => {
  if (weekTimer) {
    clearTimeout(weekTimer);
    weekTimer = null;
  }
  if (completeTimer) {
    clearTimeout(completeTimer);
    completeTimer = null;
  }

  if (weekSyncInFlight) {
    try {
      await weekSyncInFlight;
    } catch (_) {
      /* ignore */
    }
  }

  const weekResult = await runWeekSync();
  let completeResult = { ok: false, skipped: true };

  if (pendingComplete) {
    const data = pendingComplete;
    pendingComplete = null;
    completeResult = await saveCompletePlanningData(data);
  }

  return { week: weekResult, complete: completeResult };
};

export const __testing = {
  WEEK_DEBOUNCE_MS,
  COMPLETE_DEBOUNCE_MS,
  extractWeekPayload,
  resetSchedulerState: () => {
    if (weekTimer) clearTimeout(weekTimer);
    if (completeTimer) clearTimeout(completeTimer);
    weekTimer = null;
    completeTimer = null;
    pendingWeek = null;
    pendingComplete = null;
    weekSyncInFlight = null;
  }
};
