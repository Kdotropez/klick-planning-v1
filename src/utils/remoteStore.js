import { supabase } from './supabaseClient';
import { getShopWeekBrief, getShopWeekBriefWithAliases, listShopWeeksWithData, mergeCompletePlanningWithRemote, normalizeCompletePlanningData, restrictLocalDataForMerge } from './planningDataManager';

// Outbox locale pour mode hybride (sauvegardes différées)
const OUTBOX_KEY = 'remote_outbox_v1';
const generateId = () => {
  try {
    // Navigateurs modernes
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch (_) {}
  // Fallback simple RFC4122 v4-like
  const hex = [...Array(256)].map((_, i) => (i + 0x100).toString(16).slice(1));
  const rnd = () => Math.random() * 0xffffffff >>> 0;
  const r = [rnd(), rnd(), rnd(), rnd()];
  return (
    hex[r[0] & 0xff] + hex[r[0] >> 8 & 0xff] + hex[r[0] >> 16 & 0xff] + hex[r[0] >> 24 & 0xff] + '-' +
    hex[r[1] & 0xff] + hex[r[1] >> 8 & 0xff] + '-' +
    ((r[1] >> 16 & 0x0f) | 0x40).toString(16) + hex[r[1] >> 24 & 0xff] + '-' +
    ((r[2] & 0x3f) | 0x80).toString(16) + hex[r[2] >> 8 & 0xff] + '-' +
    hex[r[2] >> 16 & 0xff] + hex[r[2] >> 24 & 0xff] + hex[r[3] & 0xff] + hex[r[3] >> 8 & 0xff] + hex[r[3] >> 16 & 0xff] + hex[r[3] >> 24 & 0xff]
  );
};
const readOutbox = () => {
  try { return JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]'); } catch (_) { return []; }
};
const writeOutbox = (items) => {
  try { localStorage.setItem(OUTBOX_KEY, JSON.stringify(items || [])); } catch (_) {}
};
const enqueue = (item) => { const items = readOutbox(); items.push(item); writeOutbox(items); };
const dequeueIf = (pred) => { const items = readOutbox().filter(i => !pred(i)); writeOutbox(items); };

let flushTimer = null;
const backoffFor = (attempt) => Math.min(30000, 2000 * Math.pow(2, Math.max(0, attempt - 1))); // 2s,4s,8s,...<=30s

export const initRemoteOutbox = () => {
  if (flushTimer) return;
  const flush = async () => {
    const items = readOutbox();
    if (!items.length) return;
    for (const it of items) {
      // Respecter le backoff
      const now = Date.now();
      if (it.nextTryAt && now < it.nextTryAt) continue;
      // Vérifier disponibilité basique
      if (!supabase) { it.attempt = (it.attempt || 0) + 1; it.nextTryAt = now + backoffFor(it.attempt); writeOutbox(items); continue; }
      try {
        // Optionnel: vérifier le verrou ailleurs avant flush (côté appelant)
        const ok = await saveRemotePlanning(it.data, it.shopId, it.weekKey, true);
        if (ok) {
          dequeueIf(x => x.id === it.id);
        } else {
          it.attempt = (it.attempt || 0) + 1; it.nextTryAt = now + backoffFor(it.attempt); writeOutbox(items);
        }
      } catch (_) {
        it.attempt = (it.attempt || 0) + 1; it.nextTryAt = now + backoffFor(it.attempt); writeOutbox(items);
      }
    }
  };
  flushTimer = setInterval(flush, 5000);
  window.addEventListener('online', flush);
};

const isReady = () => {
  const ready = !!supabase;
  console.log('🔍 Supabase ready check:', ready, {
    url: import.meta.env?.VITE_SUPABASE_URL ? '✅' : '❌',
    key: import.meta.env?.VITE_SUPABASE_KEY ? '✅' : '❌'
  });
  return ready;
};

const isCompletePlanningData = (data) => {
  return !!(
    data &&
    typeof data === 'object' &&
    Array.isArray(data.shops) &&
    data.shops.length > 0
  );
};

const HISTORY_SHOP_ID = 'backup_history';
const HISTORY_WEEK_PREFIX = 'h_';
const LEGACY_HISTORY_WEEK_PREFIX = 'snapshot_';
const HISTORY_MAX_ITEMS = 300;
const CURRENT_COMPLETE_SENTINEL = 'current_complete_file';
const LEGACY_PREFIX = 'legacy_row::';
const DEVICE_ID_STORAGE_KEY = 'client_device_id';
const DEVICE_LABEL_STORAGE_KEY = 'client_device_label';

const getOrCreateDeviceId = () => {
  try {
    const existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (existing) return existing;
    const created = generateId().slice(0, 8);
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, created);
    return created;
  } catch (_) {
    return generateId().slice(0, 8);
  }
};

const getOrCreateDeviceLabel = () => {
  try {
    const existingLabel = localStorage.getItem(DEVICE_LABEL_STORAGE_KEY);
    if (existingLabel) return existingLabel;
    const id = getOrCreateDeviceId();
    const createdLabel = `PC-${id.toUpperCase()}`;
    localStorage.setItem(DEVICE_LABEL_STORAGE_KEY, createdLabel);
    return createdLabel;
  } catch (_) {
    return `PC-${getOrCreateDeviceId().toUpperCase()}`;
  }
};

const getCurrentUserLabel = () => {
  try {
    const rawUser = localStorage.getItem('current_user');
    if (!rawUser) return 'Inconnu';
    const parsed = JSON.parse(rawUser);
    return parsed?.name || parsed?.code || 'Inconnu';
  } catch (_) {
    return 'Inconnu';
  }
};

const buildBackupMeta = (completePlanningData = null) => ({
  savedAt: new Date().toISOString(),
  savedByDevice: getOrCreateDeviceLabel(),
  savedByUser: getCurrentUserLabel(),
  shopsCount: Array.isArray(completePlanningData?.shops) ? completePlanningData.shops.length : null
});

const createHistoryWeekKey = () => {
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 5);
  return `${HISTORY_WEEK_PREFIX}${ts}${rnd}`;
};

const extractBackupMetaFromData = (data) => {
  if (!data || typeof data !== 'object') {
    return { savedByUser: null, savedByDevice: null, shopsCount: null };
  }
  const meta = data._backupMeta && typeof data._backupMeta === 'object' ? data._backupMeta : {};
  return {
    savedByUser: meta.savedByUser || null,
    savedByDevice: meta.savedByDevice || null,
    shopsCount:
      meta.shopsCount ??
      (Array.isArray(data.shops) ? data.shops.length : null)
  };
};

/** Charge les snapshots historiques avec auteur/poste (requête légère + repli si besoin). */
const fetchHistorySnapshotRowsWithMeta = async (safeLimit) => {
  const historyMetaSelect = `
    week_key,
    updated_at,
    savedByUser:data->"_backupMeta"->>savedByUser,
    savedByDevice:data->"_backupMeta"->>savedByDevice,
    shopsCountText:data->"_backupMeta"->>shopsCount
  `;

  const { data: lightRows, error: lightError } = await supabase
    .from('plannings')
    .select(historyMetaSelect)
    .eq('shop_id', HISTORY_SHOP_ID)
    .order('updated_at', { ascending: false })
    .limit(safeLimit);

  if (!lightError && Array.isArray(lightRows) && lightRows.length > 0) {
    const normalized = lightRows.map((row) => ({
      week_key: row.week_key,
      updated_at: row.updated_at,
      savedByUser: row.savedByUser || null,
      savedByDevice: row.savedByDevice || null,
      shopsCount: row.shopsCountText != null && row.shopsCountText !== ''
        ? Number.parseInt(row.shopsCountText, 10)
        : null
    }));
    if (normalized.some((row) => row.savedByUser)) {
      return normalized;
    }
  }

  if (lightError) {
    console.warn('⚠️ fetchHistorySnapshotRowsWithMeta (léger):', lightError.message);
  }

  const fallbackLimit = Math.min(safeLimit, 15);
  console.warn(`⚠️ Repli metadata historique: chargement de ${fallbackLimit} snapshot(s) complets`);
  const { data: fullRows, error: fullError } = await supabase
    .from('plannings')
    .select('week_key,updated_at,data')
    .eq('shop_id', HISTORY_SHOP_ID)
    .order('updated_at', { ascending: false })
    .limit(fallbackLimit);

  if (fullError || !Array.isArray(fullRows)) {
    console.error('❌ fetchHistorySnapshotRowsWithMeta (repli):', fullError?.message || 'aucune ligne');
    return [];
  }

  return fullRows.map((row) => {
    const meta = extractBackupMetaFromData(row.data);
    return {
      week_key: row.week_key,
      updated_at: row.updated_at,
      savedByUser: meta.savedByUser,
      savedByDevice: meta.savedByDevice,
      shopsCount: meta.shopsCount
    };
  });
};

const saveHistorySnapshot = async (completePlanningData) => {
  if (!isCompletePlanningData(completePlanningData)) return false;

  const snapshotRow = {
    shop_id: HISTORY_SHOP_ID,
    week_key: createHistoryWeekKey(),
    data: completePlanningData,
    version: 1,
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from('plannings')
    .insert(snapshotRow);

  if (error) {
    console.warn('⚠️ Impossible de sauvegarder le snapshot historique:', {
      message: error.message,
      code: error.code,
      details: error.details
    });
    return false;
  }

  try {
    const { data: historyRows, error: listError } = await supabase
      .from('plannings')
      .select('week_key,updated_at')
      .eq('shop_id', HISTORY_SHOP_ID)
      .order('updated_at', { ascending: false })
      .limit(200);

    if (!listError && Array.isArray(historyRows) && historyRows.length > HISTORY_MAX_ITEMS) {
      const toDelete = historyRows.slice(HISTORY_MAX_ITEMS).map((row) => row.week_key).filter(Boolean);
      if (toDelete.length > 0) {
        await supabase
          .from('plannings')
          .delete()
          .eq('shop_id', HISTORY_SHOP_ID)
          .in('week_key', toDelete);
      }
    }
  } catch (cleanupError) {
    console.warn('⚠️ Nettoyage historique impossible:', cleanupError?.message || cleanupError);
  }

  return true;
};

const fetchRowData = async (shopId, weekKey) => {
  const { data, error } = await supabase
    .from('plannings')
    .select('data')
    .eq('shop_id', shopId)
    .eq('week_key', weekKey)
    .maybeSingle();

  if (error) {
    console.warn(`⚠️ Impossible de charger la ligne ${shopId}/${weekKey}:`, error.message);
    return null;
  }

  return data?.data || null;
};

const fetchCompleteRemoteWithRetry = async (attempts = 3) => {
  for (let i = 0; i < attempts; i += 1) {
    const remoteRow = await fetchRowData('complete_file', 'all_data');
    if (remoteRow && isCompletePlanningData(remoteRow)) {
      return remoteRow;
    }
    if (i < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, 600 * (i + 1)));
    }
  }
  return null;
};

// Fonction pour nettoyer et resauvegarder les données avec la bonne structure
export const cleanAndResaveData = async () => {
  console.log('🧹 Nettoyage et resauvegarde des données...');
  
  if (!isReady()) {
    console.log('❌ cleanAndResaveData: not ready');
    return false;
  }
  
  try {
    // Supprimer toutes les données existantes
    console.log('🗑️ Suppression de toutes les données existantes...');
    const { error: deleteError } = await supabase
      .from('plannings')
      .delete()
      .neq('shop_id', '');
    
    if (deleteError) {
      console.error('❌ Erreur lors de la suppression:', deleteError);
      return false;
    }
    
    console.log('✅ Toutes les données supprimées');
    return true;
  } catch (error) {
    console.error('❌ Exception dans cleanAndResaveData:', error);
    return false;
  }
};

// Fonction pour sauvegarder le fichier complet de planning
export const saveCompletePlanningData = async (completePlanningData, options = {}) => {
  const { replaceEntirely = false, allowedShopIds = null } = options;

  console.log('🔍 saveCompletePlanningData called with:', { 
    hasData: !!completePlanningData,
    dataKeys: completePlanningData ? Object.keys(completePlanningData) : [],
    shopsCount: completePlanningData?.shops?.length || 0,
    replaceEntirely,
    allowedShopIds
  });
  
  if (!isReady() || !completePlanningData) {
    console.log('❌ saveCompletePlanningData: not ready or missing data');
    return { ok: false, reason: 'not_ready' };
  }
  
  try {
    let dataToSave = normalizeCompletePlanningData(completePlanningData);
    let preservedShopIds = [];
    let mergeApplied = false;

    if (!replaceEntirely) {
      const remoteRow = await fetchCompleteRemoteWithRetry(3);
      if (!remoteRow) {
        console.error('❌ Fusion Supabase impossible : version cloud introuvable.');
        return {
          ok: false,
          reason: 'remote_unavailable',
          message:
            'Impossible de lire le planning sur Supabase. Sauvegarde ANNULÉE pour protéger Port Grimaud, Saint-Tropez et les autres boutiques. Réessayez dans quelques minutes ou exportez un JSON local.'
        };
      }

      const localForMerge = Array.isArray(allowedShopIds) && allowedShopIds.length > 0
        ? restrictLocalDataForMerge(dataToSave, allowedShopIds)
        : dataToSave;

      const merged = mergeCompletePlanningWithRemote(localForMerge, remoteRow);
      preservedShopIds = merged._mergeReport?.preservedShopIds || [];
      const { _mergeReport, ...withoutReport } = merged;
      dataToSave = normalizeCompletePlanningData(withoutReport);
      mergeApplied = true;

      if (preservedShopIds.length > 0) {
        console.warn(
          `🛡️ Fusion Supabase: ${preservedShopIds.length} boutique(s) conservée(s) depuis le cloud:`,
          preservedShopIds.join(', ')
        );
      }
      if (allowedShopIds?.length) {
        console.log(
          `🛡️ Sauvegarde limitée aux boutique(s) autorisée(s): ${allowedShopIds.join(', ')}`
        );
      }
    }

    const backupMeta = {
      ...buildBackupMeta(dataToSave),
      mergeApplied: mergeApplied || !replaceEntirely,
      preservedShopIds,
      allowedShopIds: allowedShopIds || [],
      localShopsCount: completePlanningData?.shops?.length || 0,
      mergedShopsCount: dataToSave?.shops?.length || 0
    };
    const dataWithMeta = {
      ...dataToSave,
      _backupMeta: backupMeta
    };

    // Sauvegarder le fichier complet en une seule ligne, sans supprimer les semaines
    const row = {
      shop_id: 'complete_file',
      week_key: 'all_data',
      data: dataWithMeta,
      version: 1
    };
    console.log('📦 Upsert du fichier complet (complete_file)...');
    console.log('📦 Données à sauvegarder:', {
      shop_id: row.shop_id,
      week_key: row.week_key,
      dataShops: dataWithMeta.shops?.length || 0,
      dataVersion: dataWithMeta.version,
      preservedShopIds
    });
    
    // Debug détaillé des boutiques et semaines
    if (dataWithMeta.shops) {
      dataWithMeta.shops.forEach((shop, index) => {
        console.log(`🏪 Boutique ${index + 1}: ${shop.name} (${shop.id})`);
        if (shop.weeks) {
          const weekKeys = Object.keys(shop.weeks);
          console.log(`   📅 Semaines: ${weekKeys.length} semaines (${weekKeys.slice(0, 3).join(', ')}${weekKeys.length > 3 ? '...' : ''})`);
        }
      });
    }
    
    // Forcer la mise à jour du timestamp en ajoutant updated_at explicitement
    const rowWithTimestamp = {
      ...row,
      updated_at: new Date().toISOString()
    };
    
    const { data, error } = await supabase
      .from('plannings')
      .upsert(rowWithTimestamp, { onConflict: 'shop_id,week_key' });
    
    if (error) {
      console.error('❌ Erreur lors de l\'insertion:', error);
      return { ok: false };
    }
    
    console.log('✅ saveCompletePlanningData success:', { 
      shops: dataToSave.shops?.length || 0,
      version: dataToSave.version,
      preservedShopIds,
      upsertResult: data
    });

    const snapshotOk = await saveHistorySnapshot(dataWithMeta);
    if (!snapshotOk) {
      console.warn(
        '⚠️ Version actuelle enregistrée, mais snapshot historique non créé. ' +
          'Seule la ligne complete_file a été mise à jour.'
      );
    }

    try {
      localStorage.removeItem('planning_prefer_local_until_save');
    } catch (_) {}

    const preservedShopNames = preservedShopIds.map((shopId) => {
      const shop = dataToSave.shops?.find((s) => String(s.id) === String(shopId));
      return shop?.name || shopId;
    });
    
    return {
      ok: true,
      planningData: dataToSave,
      preservedShopIds,
      preservedShopNames,
      mergedShopsCount: dataToSave.shops?.length || 0
    };
  } catch (error) {
    console.error('❌ Exception dans saveCompletePlanningData:', error);
    return { ok: false };
  }
};

/** Enregistre un snapshot historique ; retourne { ok, error? }. */
export const saveHistorySnapshotWithStatus = async (completePlanningData) => {
  if (!isCompletePlanningData(completePlanningData)) {
    return { ok: false, error: 'Données invalides' };
  }
  const ok = await saveHistorySnapshot(completePlanningData);
  return ok ? { ok: true } : { ok: false, error: 'Insertion snapshot refusée (voir console)' };
};

export const listCompletePlanningBackups = async (limit = 100) => {
  if (!isReady()) return [];

  try {
    const safeLimit = Math.max(1, Math.min(200, Number(limit) || 100));
    const items = [];
    const seen = new Set();
    const pushItem = (item) => {
      const key = `${item.weekKey}|${item.updatedAt || ''}`;
      if (!item?.weekKey || seen.has(key)) return;
      seen.add(key);
      items.push(item);
    };

    // 1) Version actuelle — une seule ligne (léger)
    const { data: currentRow, error: currentError } = await supabase
      .from('plannings')
      .select('updated_at,data')
      .eq('shop_id', 'complete_file')
      .eq('week_key', 'all_data')
      .maybeSingle();

    if (!currentError && currentRow) {
      const valid = isCompletePlanningData(currentRow?.data);
        pushItem({
          weekKey: CURRENT_COMPLETE_SENTINEL,
          updatedAt: currentRow.updated_at,
          shopsCount: valid ? currentRow.data.shops.length : 0,
          savedByDevice: currentRow?.data?._backupMeta?.savedByDevice || 'PC inconnu',
          savedByUser: currentRow?.data?._backupMeta?.savedByUser || 'Utilisateur inconnu',
          isCurrent: true,
          isValid: valid,
          isRestorable: valid
        });
    }

    // 2) Snapshots historiques — auteur/poste via _backupMeta (léger + repli)
    const historyRows = await fetchHistorySnapshotRowsWithMeta(safeLimit);
    historyRows.forEach((row) => {
      if (!row?.week_key) return;
      pushItem({
        weekKey: row.week_key,
        updatedAt: row.updated_at,
        shopsCount: Number.isFinite(row.shopsCount) ? row.shopsCount : null,
        savedByDevice: row.savedByDevice || 'poste inconnu',
        savedByUser: row.savedByUser || 'auteur inconnu (ancienne sauvegarde)',
        isSnapshot: true,
        isRestorable: true
      });
    });

    // 3) Archives boutique/semaine (💾 SAUVE SUPABASE) — souvent les seules traces des sauvegardes anciennes
    const legacyLimit = Math.max(50, safeLimit);
    const { data: legacyRows, error: legacyError } = await supabase
      .from('plannings')
      .select('shop_id,week_key,updated_at,data')
      .neq('shop_id', 'system_config')
      .neq('shop_id', HISTORY_SHOP_ID)
      .neq('shop_id', 'complete_file')
      .order('updated_at', { ascending: false })
      .limit(legacyLimit);

    if (legacyError) {
      console.warn('⚠️ listCompletePlanningBackups legacy error:', legacyError.message);
    } else {
      (legacyRows || []).forEach((row) => {
        if (!row?.shop_id || !row?.week_key) return;
        const meta = extractBackupMetaFromData(row.data);
        const shopsCount = Array.isArray(row.data?.shops) ? row.data.shops.length : null;
        const isComplete = isCompletePlanningData(row.data);
        pushItem({
          weekKey: `${LEGACY_PREFIX}${row.shop_id}::${row.week_key}`,
          updatedAt: row.updated_at,
          shopsCount,
          savedByDevice: meta.savedByDevice || 'Sauvegarde semaine Supabase',
          savedByUser: meta.savedByUser || row.shop_id,
          isLegacyRow: true,
          isRestorable: isComplete,
          legacyShopId: row.shop_id,
          legacyWeekKey: row.week_key
        });
      });
    }

    items.sort((a, b) => {
      const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return tb - ta;
    });

    return items.slice(0, Math.max(safeLimit, legacyLimit));
  } catch (error) {
    console.error('❌ Exception listCompletePlanningBackups:', error);
    return [];
  }
};

/** Toutes les archives 💾 SAUVE SUPABASE (boutique + semaine) — hors snapshots globaux. */
export const listShopWeekArchiveEntries = async ({ shopId = null, limit = 400 } = {}) => {
  if (!isReady()) return [];

  const safeLimit = Math.max(1, Math.min(500, Number(limit) || 400));
  try {
    let query = supabase
      .from('plannings')
      .select('shop_id,week_key,updated_at,data')
      .neq('shop_id', 'system_config')
      .neq('shop_id', HISTORY_SHOP_ID)
      .neq('shop_id', 'complete_file')
      .order('updated_at', { ascending: false })
      .limit(safeLimit);

    if (shopId) {
      query = query.eq('shop_id', shopId);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('⚠️ listShopWeekArchiveEntries:', error.message);
      return [];
    }

    return (data || []).map((row) => {
      const meta = extractBackupMetaFromData(row.data);
      const shopsCount = Array.isArray(row.data?.shops) ? row.data.shops.length : 0;
      const isComplete = isCompletePlanningData(row.data);
      return {
        shopId: row.shop_id,
        weekKey: row.week_key,
        updatedAt: row.updated_at,
        savedByUser: meta.savedByUser || '?',
        savedByDevice: meta.savedByDevice || '?',
        shopsCount,
        isCompleteSnapshot: isComplete,
        restoreKey: `${LEGACY_PREFIX}${row.shop_id}::${row.week_key}`
      };
    });
  } catch (error) {
    console.error('❌ listShopWeekArchiveEntries:', error);
    return [];
  }
};

export const getCurrentCompleteBackupInfo = async () => {
  if (!isReady()) return null;

  try {
    const { data, error } = await supabase
      .from('plannings')
      .select('updated_at,data')
      .eq('shop_id', 'complete_file')
      .eq('week_key', 'all_data')
      .maybeSingle();

    if (error || !data || !isCompletePlanningData(data?.data)) return null;

    return {
      updatedAt: data.updated_at || data?.data?._backupMeta?.savedAt || null,
      savedByDevice: data?.data?._backupMeta?.savedByDevice || 'PC inconnu',
      savedByUser: data?.data?._backupMeta?.savedByUser || 'Utilisateur inconnu',
      shopsCount: Array.isArray(data?.data?.shops) ? data.data.shops.length : 0
    };
  } catch (error) {
    console.error('❌ getCurrentCompleteBackupInfo error:', error);
    return null;
  }
};

export const loadCompletePlanningBackupByWeekKey = async (weekKey) => {
  if (!isReady() || !weekKey) return null;

  try {
    if (weekKey === CURRENT_COMPLETE_SENTINEL) {
      const { data: currentData, error: currentError } = await supabase
        .from('plannings')
        .select('data')
        .eq('shop_id', 'complete_file')
        .eq('week_key', 'all_data')
        .maybeSingle();

      if (currentError) {
        console.error('❌ load current complete backup error:', currentError.message);
        return null;
      }

      return isCompletePlanningData(currentData?.data) ? currentData.data : null;
    }

    if (weekKey.startsWith(LEGACY_PREFIX)) {
      const payload = weekKey.replace(LEGACY_PREFIX, '');
      const [shopId, ...rest] = payload.split('::');
      const legacyWeekKey = rest.join('::');
      if (!shopId || !legacyWeekKey) return null;

      const { data: legacyData, error: legacyError } = await supabase
        .from('plannings')
        .select('data')
        .eq('shop_id', shopId)
        .eq('week_key', legacyWeekKey)
        .maybeSingle();

      if (legacyError) {
        console.error('❌ load legacy backup error:', legacyError.message);
        return null;
      }

      return isCompletePlanningData(legacyData?.data) ? legacyData.data : null;
    }

    const { data, error } = await supabase
      .from('plannings')
      .select('data')
      .eq('shop_id', HISTORY_SHOP_ID)
      .eq('week_key', weekKey)
      .maybeSingle();

    if (error) {
      console.error('❌ loadCompletePlanningBackupByWeekKey error:', error.message);
      return null;
    }

    return isCompletePlanningData(data?.data) ? data.data : null;
  } catch (error) {
    console.error('❌ Exception loadCompletePlanningBackupByWeekKey:', error);
    return null;
  }
};

/** Lignes Supabase SAINT_TROPEZ / semaine (💾 SAUVE SUPABASE par boutique). */
export const findRemoteShopWeekRowBackups = async (shopId, weekKey, onProgress) => {
  if (!isReady() || !shopId || !weekKey) return [];

  const { data: rows, error } = await supabase
    .from('plannings')
    .select('shop_id,week_key,updated_at,data')
    .eq('shop_id', shopId)
    .order('updated_at', { ascending: false })
    .limit(300);

  if (error || !Array.isArray(rows)) {
    console.warn('⚠️ findRemoteShopWeekRowBackups:', error?.message || 'aucune ligne');
    return [];
  }

  const matches = [];
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (onProgress) onProgress(i + 1, rows.length, row);
    if (!row?.data || !isCompletePlanningData(row.data)) continue;

    const brief = getShopWeekBriefWithAliases(row.data, shopId, weekKey);
    if (!brief) continue;

    matches.push({
      backup: {
        weekKey: `${LEGACY_PREFIX}${shopId}::${row.week_key}`,
        updatedAt: row.updated_at,
        shopsCount: Array.isArray(row.data?.shops) ? row.data.shops.length : 0,
        savedByDevice: row.data?._backupMeta?.savedByDevice || 'Sauvegarde semaine Supabase',
        savedByUser: row.data?._backupMeta?.savedByUser || 'Utilisateur inconnu'
      },
      ...brief,
      isRemoteWeekRow: true,
      savedOnWeekKey: row.week_key
    });
  }
  return matches;
};

/** Inventaire des semaines avec horaires pour une boutique (version actuelle + lignes Supabase). */
export const inspectShopWeekInventory = async (shopId) => {
  const current = await loadCompletePlanningData();
  const weeksInCurrent = listShopWeeksWithData(current, shopId);
  const remoteWeekKeys = await listRemoteWeeksForShop(shopId);

  const remoteWeeksWithData = [];
  for (const rowWeekKey of remoteWeekKeys.slice(0, 80)) {
    const data = await loadCompletePlanningBackupByWeekKey(`${LEGACY_PREFIX}${shopId}::${rowWeekKey}`);
    const weeks = listShopWeeksWithData(data, shopId);
    const target = weeks.find((w) => w.weekKey === rowWeekKey) || weeks[0];
    if (target) {
      remoteWeeksWithData.push({
        rowWeekKey,
        ...target
      });
    }
  }

  return {
    weeksInCurrent,
    remoteWeekKeys,
    remoteWeeksWithData
  };
};

/** Parcourt l'historique et retourne les sauvegardes contenant une boutique + semaine avec horaires. */
export const findHistoricalBackupsWithShopWeek = async (shopId, weekKey, options = {}) => {
  const { limit = 100, excludeCurrent = false, onProgress } = options;
  if (!shopId || !weekKey) return [];

  let backups = await listCompletePlanningBackups(limit);
  if (excludeCurrent) {
    backups = backups.filter((item) => item.weekKey !== CURRENT_COMPLETE_SENTINEL);
  }

  const matches = [];
  const seen = new Set();
  const addMatch = (match) => {
    const dedupe = `${match.backup?.weekKey}|${match.backup?.updatedAt}|${match.weekKey}|${match.entryCount}`;
    if (seen.has(dedupe)) return;
    seen.add(dedupe);
    matches.push(match);
  };

  for (let i = 0; i < backups.length; i += 1) {
    const item = backups[i];
    if (onProgress) onProgress(i + 1, backups.length, item);
    const data = await loadCompletePlanningBackupByWeekKey(item.weekKey);
    const brief = getShopWeekBriefWithAliases(data, shopId, weekKey);
    if (brief) {
      addMatch({
        backup: item,
        ...brief,
        isCurrent: item.weekKey === CURRENT_COMPLETE_SENTINEL
      });
    }
  }

  const remoteMatches = await findRemoteShopWeekRowBackups(shopId, weekKey, onProgress);
  remoteMatches.forEach(addMatch);

  return matches.sort((a, b) => {
    const ta = a.backup?.updatedAt ? new Date(a.backup.updatedAt).getTime() : 0;
    const tb = b.backup?.updatedAt ? new Date(b.backup.updatedAt).getTime() : 0;
    return tb - ta;
  });
};

/** Dates des dernières sauvegardes globales (version actuelle + snapshots). */
export const getGlobalBackupTimeline = async (limit = 30) => {
  const backups = await listCompletePlanningBackups(Math.max(limit, 50));
  return backups.map((item, idx) => ({
    rank: idx + 1,
    weekKey: item.weekKey,
    updatedAt: item.updatedAt,
    shopsCount: item.shopsCount,
    savedByUser: item.savedByUser,
    savedByDevice: item.savedByDevice,
    isCurrent: item.weekKey === CURRENT_COMPLETE_SENTINEL,
    isLegacy: String(item.weekKey || '').startsWith(LEGACY_PREFIX)
  }));
};

/** Diagnostic : dates réelles sur Supabase (sans filtre boutique/semaine). */
export const getSupabaseBackupDiagnostics = async () => {
  if (!isReady()) return null;

  try {
    const currentInfo = await getCurrentCompleteBackupInfo();

    const { data: latestRows, error: latestError } = await supabase
      .from('plannings')
      .select('shop_id,week_key,updated_at')
      .order('updated_at', { ascending: false })
      .limit(1);

    const { count: historyCount, error: historyCountError } = await supabase
      .from('plannings')
      .select('*', { count: 'exact', head: true })
      .eq('shop_id', HISTORY_SHOP_ID);

    const { data: shopRowSample, error: shopRowError } = await supabase
      .from('plannings')
      .select('shop_id,updated_at')
      .neq('shop_id', 'complete_file')
      .neq('shop_id', HISTORY_SHOP_ID)
      .neq('shop_id', 'system_config')
      .order('updated_at', { ascending: false })
      .limit(1);

    const latestAny = latestRows?.[0] || null;
    const latestShopRow = shopRowSample?.[0] || null;

    return {
      currentCompleteUpdatedAt: currentInfo?.updatedAt || null,
      currentShopsCount: currentInfo?.shopsCount || 0,
      latestAnyUpdatedAt: latestAny?.updated_at || null,
      latestAnyLabel: latestAny ? `${latestAny.shop_id}/${latestAny.week_key}` : null,
      latestShopRowUpdatedAt: latestShopRow?.updated_at || null,
      latestShopRowId: latestShopRow?.shop_id || null,
      historySnapshotCount: historyCountError ? null : (historyCount ?? 0)
    };
  } catch (error) {
    console.error('❌ getSupabaseBackupDiagnostics error:', error);
    return null;
  }
};

// Fonction pour charger le fichier complet de planning
export const loadCompletePlanningData = async (options = {}) => {
  const { skipNormalize = false } = options;
  console.log('🔍 loadCompletePlanningData called');
  
  if (!isReady()) {
    console.log('❌ loadCompletePlanningData: not ready');
    return null;
  }
  
  try {
    const { data: completeRow, error: completeErr } = await supabase
      .from('plannings')
      .select('data,updated_at')
      .eq('shop_id', 'complete_file')
      .eq('week_key', 'all_data')
      .maybeSingle();
    if (completeErr) {
      console.warn('⚠️ loadCompletePlanningData: échec lecture complete_file, on tente le fallback:', completeErr);
    }
    if (completeRow && isCompletePlanningData(completeRow.data)) {
      const planningData = skipNormalize
        ? completeRow.data
        : normalizeCompletePlanningData(completeRow.data);
      console.log('✅ loadCompletePlanningData (complete_file) OK:', {
        shops: planningData.shops?.length || 0,
        version: planningData.version,
        updatedAt: completeRow.updated_at
      });
      return planningData;
    }
    if (completeRow && completeRow.data && !isCompletePlanningData(completeRow.data)) {
      console.warn('⚠️ complete_file trouvé mais invalide (pas de shops), fallback multi-lignes...');
    }
    const { data: latestRows, error: latestErr } = await supabase
      .from('plannings')
      .select('shop_id,week_key,updated_at')
      .neq('shop_id', 'system_config')
      .order('updated_at', { ascending: false })
      .limit(8);
    if (latestErr) {
      console.error('❌ Erreur lors du chargement (fallback):', latestErr);
      return null;
    }
    if (!latestRows || latestRows.length === 0) {
      console.log('❌ Aucune donnée trouvée dans Supabase');
      return null;
    }
    // Prioriser les candidats les plus probables
    const prioritizedRows = [
      ...latestRows.filter((r) => r.shop_id === 'complete_file' || r.week_key === 'all_data'),
      ...latestRows.filter((r) => !(r.shop_id === 'complete_file' || r.week_key === 'all_data'))
    ];

    let planningData = null;
    for (const row of prioritizedRows) {
      const rowData = await fetchRowData(row.shop_id, row.week_key);
      if (isCompletePlanningData(rowData)) {
        planningData = rowData;
        break;
      }
    }

    if (!planningData) {
      console.warn('⚠️ Aucune ligne Supabase avec un backup complet valide (shops) trouvée.');
      return null;
    }

    return skipNormalize ? planningData : normalizeCompletePlanningData(planningData);
  } catch (error) {
    console.error('❌ Exception dans loadCompletePlanningData:', error);
    return null;
  }
};

export const loadRemotePlanning = async (shopId, weekKey) => {
  console.log('🔍 loadRemotePlanning called with:', { shopId, weekKey });
  if (!isReady() || !shopId || !weekKey) {
    console.log('❌ loadRemotePlanning: not ready or missing params');
    return null;
  }
  const { data, error } = await supabase
    .from('plannings')
    .select('*')
    .eq('shop_id', shopId)
    .eq('week_key', weekKey)
    .maybeSingle();
  if (error) {
    console.warn('❌ Supabase load error:', error.message);
    return null;
  }
  console.log('✅ loadRemotePlanning success:', !!data);
  return data?.data || null;
};

export const saveRemotePlanning = async (planningData, shopId, weekKey, isOutboxFlush = false) => {
  console.log('🔍 saveRemotePlanning called with:', { 
    shopId, 
    weekKey, 
    hasData: !!planningData,
    dataKeys: planningData ? Object.keys(planningData) : []
  });
  
  if (!isReady() || !planningData || !shopId || !weekKey) {
    console.log('❌ saveRemotePlanning: not ready or missing params');
    // Enqueue si manque Supabase seulement
    if (!isReady() && planningData && shopId && weekKey && !isOutboxFlush) {
      enqueue({ id: generateId(), type: 'saveWeek', shopId, weekKey, data: planningData, attempt: 0, nextTryAt: 0, ts: Date.now() });
    }
    return false;
  }
  
  const row = {
    shop_id: shopId,
    week_key: weekKey,
    data: {
      ...planningData,
      _backupMeta: {
        ...buildBackupMeta(),
        shopId,
        weekKey,
        saveType: 'shop_week'
      }
    },
    version: 1
  };
  
  console.log('🔍 Attempting to save to Supabase:', row);
  
  // First, try to check if the record exists
  const { data: existingData, error: checkError } = await supabase
    .from('plannings')
    .select('shop_id, week_key')
    .eq('shop_id', shopId)
    .eq('week_key', weekKey)
    .maybeSingle();
    
  console.log('🔍 Existing data check:', { existingData, checkError });
  
  let result;
  if (existingData) {
    // Update existing record
    console.log('🔄 Updating existing record...');
    result = await supabase
      .from('plannings')
      .update({
        data: {
          ...planningData,
          _backupMeta: {
            ...buildBackupMeta(),
            shopId,
            weekKey,
            saveType: 'shop_week'
          }
        },
        version: 1
      })
      .eq('shop_id', shopId)
      .eq('week_key', weekKey);
  } else {
    // Insert new record
    console.log('➕ Inserting new record...');
    result = await supabase
      .from('plannings')
      .insert(row);
  }
  
  const { data, error } = result;
  
  if (error) {
    console.error('❌ Supabase save error:', error.message, error);
    return false;
  }
  
  console.log('✅ saveRemotePlanning success, result:', { data, error });
  
  // Verify the save by reading back
  const { data: verifyData, error: verifyError } = await supabase
    .from('plannings')
    .select('*')
    .eq('shop_id', shopId)
    .eq('week_key', weekKey)
    .maybeSingle();
    
  console.log('🔍 Verification read:', { verifyData, verifyError });
  
  return true;
};

export const listRemoteShops = async () => {
  console.log('🔍 listRemoteShops called');
  if (!isReady()) {
    console.log('❌ listRemoteShops: not ready');
    return [];
  }
  const { data, error } = await supabase
    .from('plannings')
    .select('shop_id')
    .order('shop_id', { ascending: true });
  if (error) {
    console.error('❌ listRemoteShops error:', error);
    return [];
  }
  const ids = [...new Set((data || []).map(r => r.shop_id).filter(Boolean))];
  console.log('✅ listRemoteShops success:', ids);
  return ids;
};

export const listRemoteWeeksForShop = async (shopId) => {
  console.log('🔍 listRemoteWeeksForShop called with:', shopId);
  if (!isReady() || !shopId) {
    console.log('❌ listRemoteWeeksForShop: not ready or missing shopId');
    return [];
  }
  const { data, error } = await supabase
    .from('plannings')
    .select('week_key')
    .eq('shop_id', shopId)
    .order('week_key', { ascending: true });
  if (error) {
    console.error('❌ listRemoteWeeksForShop error:', error);
    return [];
  }
  const weeks = [...new Set((data || []).map(r => r.week_key).filter(Boolean))];
  console.log('✅ listRemoteWeeksForShop success:', weeks);
  return weeks;
};

// Fonction de diagnostic pour vérifier l'état de Supabase
export const diagnoseSupabase = async () => {
  console.log('🔍 Diagnostic Supabase...');
  
  if (!isReady()) {
    console.log('❌ Supabase not ready');
    return null;
  }
  
  try {
    // Vérifier toutes les entrées
    const { data: allData, error: allError } = await supabase
      .from('plannings')
      .select('*')
      .order('updated_at', { ascending: false });
    
    if (allError) {
      console.error('❌ Erreur diagnostic:', allError);
      return null;
    }
    
    console.log('📊 Diagnostic Supabase - Toutes les entrées:', allData?.map(row => ({
      shop_id: row.shop_id,
      week_key: row.week_key,
      updated_at: row.updated_at,
      dataShops: row.data?.shops?.length || 0,
      dataVersion: row.data?.version
    })));
    
    // Vérifier spécifiquement le fichier complet
    const { data: completeData, error: completeError } = await supabase
      .from('plannings')
      .select('*')
      .eq('shop_id', 'complete_file')
      .eq('week_key', 'all_data')
      .maybeSingle();
    
    if (completeError) {
      console.error('❌ Erreur lecture complete_file:', completeError);
    } else if (completeData) {
      console.log('✅ Fichier complet trouvé:', {
        updated_at: completeData.updated_at,
        dataShops: completeData.data?.shops?.length || 0,
        dataVersion: completeData.data?.version
      });
    } else {
      console.log('❌ Fichier complet non trouvé');
    }
    
    return allData;
  } catch (error) {
    console.error('❌ Exception diagnostic:', error);
    return null;
  }
};


