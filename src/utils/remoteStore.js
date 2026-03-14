import { supabase } from './supabaseClient';

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
const HISTORY_MAX_ITEMS = 30;
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

const buildBackupMeta = () => ({
  savedAt: new Date().toISOString(),
  savedByDevice: getOrCreateDeviceLabel(),
  savedByUser: getCurrentUserLabel()
});

const createHistoryWeekKey = () => {
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 5);
  return `${HISTORY_WEEK_PREFIX}${ts}${rnd}`;
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
export const saveCompletePlanningData = async (completePlanningData) => {
  console.log('🔍 saveCompletePlanningData called with:', { 
    hasData: !!completePlanningData,
    dataKeys: completePlanningData ? Object.keys(completePlanningData) : [],
    shopsCount: completePlanningData?.shops?.length || 0
  });
  
  if (!isReady() || !completePlanningData) {
    console.log('❌ saveCompletePlanningData: not ready or missing data');
    return false;
  }
  
  try {
    const backupMeta = buildBackupMeta();
    const dataWithMeta = {
      ...completePlanningData,
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
      dataVersion: dataWithMeta.version
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
      return false;
    }
    
    console.log('✅ saveCompletePlanningData success:', { 
      shops: completePlanningData.shops?.length || 0,
      version: completePlanningData.version,
      dataKeys: Object.keys(completePlanningData),
      hasPlanning: !!completePlanningData.planning,
      planningKeys: completePlanningData.planning ? Object.keys(completePlanningData.planning) : [],
      upsertResult: data
    });

    await saveHistorySnapshot(dataWithMeta);
    
    return true;
  } catch (error) {
    console.error('❌ Exception dans saveCompletePlanningData:', error);
    return false;
  }
};

export const listCompletePlanningBackups = async (limit = 15) => {
  if (!isReady()) return [];

  try {
    const safeLimit = Math.max(1, Math.min(50, Number(limit) || 15));
    const { data, error } = await supabase
      .from('plannings')
      .select('week_key,updated_at,data')
      .eq('shop_id', HISTORY_SHOP_ID)
      .or(`week_key.like.${HISTORY_WEEK_PREFIX}%,week_key.like.${LEGACY_HISTORY_WEEK_PREFIX}%`)
      .order('updated_at', { ascending: false })
      .limit(safeLimit);

    if (error) {
      console.error('❌ listCompletePlanningBackups error:', error.message);
      return [];
    }

    const historyItems = (data || [])
      .filter((row) => isCompletePlanningData(row?.data))
      .map((row) => ({
        weekKey: row.week_key,
        updatedAt: row.updated_at,
        shopsCount: Array.isArray(row?.data?.shops) ? row.data.shops.length : 0,
        savedByDevice: row?.data?._backupMeta?.savedByDevice || 'PC inconnu',
        savedByUser: row?.data?._backupMeta?.savedByUser || 'Utilisateur inconnu'
      }));

    // Compatibilité avec les sauvegardes historiques "pré-feature":
    // même sans snapshots, on expose la sauvegarde complète courante.
    const { data: currentComplete, error: currentError } = await supabase
      .from('plannings')
      .select('updated_at,data')
      .eq('shop_id', 'complete_file')
      .eq('week_key', 'all_data')
      .maybeSingle();

    if (!currentError && isCompletePlanningData(currentComplete?.data)) {
      const currentItem = {
        weekKey: CURRENT_COMPLETE_SENTINEL,
        updatedAt: currentComplete.updated_at,
        shopsCount: Array.isArray(currentComplete?.data?.shops) ? currentComplete.data.shops.length : 0,
        savedByDevice: currentComplete?.data?._backupMeta?.savedByDevice || 'PC inconnu',
        savedByUser: currentComplete?.data?._backupMeta?.savedByUser || 'Utilisateur inconnu'
      };
      const merged = [currentItem, ...historyItems];

      // Fallback legacy: exposer aussi les anciennes lignes "shop/week" valides
      // qui contiennent des données complètes.
      if (merged.length < safeLimit) {
        const remaining = safeLimit - merged.length;
        const { data: legacyRows, error: legacyError } = await supabase
          .from('plannings')
          .select('shop_id,week_key,updated_at,data')
          .neq('shop_id', 'system_config')
          .neq('shop_id', HISTORY_SHOP_ID)
          .order('updated_at', { ascending: false })
          .limit(60);

        if (!legacyError && Array.isArray(legacyRows)) {
          const legacyItems = legacyRows
            .filter((row) => row.shop_id !== 'complete_file')
            .filter((row) => isCompletePlanningData(row?.data))
            .map((row) => ({
              weekKey: `${LEGACY_PREFIX}${row.shop_id}::${row.week_key}`,
              updatedAt: row.updated_at,
              shopsCount: Array.isArray(row?.data?.shops) ? row.data.shops.length : 0,
              savedByDevice: row?.data?._backupMeta?.savedByDevice || 'PC legacy',
              savedByUser: row?.data?._backupMeta?.savedByUser || 'Utilisateur legacy'
            }));

          return [...merged, ...legacyItems].slice(0, safeLimit);
        }
      }

      return merged.slice(0, safeLimit);
    }

    if (historyItems.length >= safeLimit) {
      return historyItems.slice(0, safeLimit);
    }

    const { data: legacyRowsNoCurrent, error: legacyNoCurrentError } = await supabase
      .from('plannings')
      .select('shop_id,week_key,updated_at,data')
      .neq('shop_id', 'system_config')
      .neq('shop_id', HISTORY_SHOP_ID)
      .order('updated_at', { ascending: false })
      .limit(60);

    if (!legacyNoCurrentError && Array.isArray(legacyRowsNoCurrent)) {
      const legacyItems = legacyRowsNoCurrent
        .filter((row) => row.shop_id !== 'complete_file')
        .filter((row) => isCompletePlanningData(row?.data))
        .map((row) => ({
          weekKey: `${LEGACY_PREFIX}${row.shop_id}::${row.week_key}`,
          updatedAt: row.updated_at,
          shopsCount: Array.isArray(row?.data?.shops) ? row.data.shops.length : 0,
          savedByDevice: row?.data?._backupMeta?.savedByDevice || 'PC legacy',
          savedByUser: row?.data?._backupMeta?.savedByUser || 'Utilisateur legacy'
        }));
      return [...historyItems, ...legacyItems].slice(0, safeLimit);
    }

    return historyItems.slice(0, safeLimit);
  } catch (error) {
    console.error('❌ Exception listCompletePlanningBackups:', error);
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

// Fonction pour charger le fichier complet de planning
export const loadCompletePlanningData = async () => {
  console.log('🔍 loadCompletePlanningData called');
  
  if (!isReady()) {
    console.log('❌ loadCompletePlanningData: not ready');
    return null;
  }
  
  try {
    // 1) Essayer de charger la ligne de backup complète dédiée
    const { data: completeRow, error: completeErr } = await supabase
      .from('plannings')
      .select('*')
      .eq('shop_id', 'complete_file')
      .eq('week_key', 'all_data')
      .maybeSingle();
    if (completeErr) {
      console.warn('⚠️ loadCompletePlanningData: échec lecture complete_file, on tente le fallback:', completeErr);
    }
    if (completeRow && isCompletePlanningData(completeRow.data)) {
      const planningData = completeRow.data;
      console.log('✅ loadCompletePlanningData (complete_file) OK:', {
        shops: planningData.shops?.length || 0,
        version: planningData.version,
        dataKeys: Object.keys(planningData),
        hasPlanning: !!planningData.planning,
        planningKeys: planningData.planning ? Object.keys(planningData.planning) : []
      });
      return planningData;
    }
    if (completeRow && completeRow.data && !isCompletePlanningData(completeRow.data)) {
      console.warn('⚠️ complete_file trouvé mais invalide (pas de shops), fallback multi-lignes...');
    }
    // 2) Fallback léger: récupérer seulement les métadonnées (évite timeout JSON volumineux)
    const { data: latestRows, error: latestErr } = await supabase
      .from('plannings')
      .select('shop_id,week_key,updated_at')
      .neq('shop_id', 'system_config')
      .order('updated_at', { ascending: false })
      .limit(25);
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
    
    console.log('✅ loadCompletePlanningData success:', {
      shops: planningData.shops?.length || 0,
      version: planningData.version,
      dataKeys: Object.keys(planningData),
      hasPlanning: !!planningData.planning,
      planningKeys: planningData.planning ? Object.keys(planningData.planning) : []
    });
    
    return planningData;
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
    data: planningData,
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
      .update({ data: planningData, version: 1 })
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


