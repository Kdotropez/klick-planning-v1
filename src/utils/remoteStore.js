import { supabase } from './supabaseClient';

const isReady = () => {
  const ready = !!supabase;
  console.log('🔍 Supabase ready check:', ready, {
    url: import.meta.env?.VITE_SUPABASE_URL ? '✅' : '❌',
    key: import.meta.env?.VITE_SUPABASE_KEY ? '✅' : '❌'
  });
  return ready;
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
    dataKeys: completePlanningData ? Object.keys(completePlanningData) : []
  });
  
  if (!isReady() || !completePlanningData) {
    console.log('❌ saveCompletePlanningData: not ready or missing data');
    return false;
  }
  
  try {
    // Supprimer toutes les données existantes
    console.log('🗑️ Suppression des données existantes...');
    const { error: deleteError } = await supabase
      .from('plannings')
      .delete()
      .neq('shop_id', ''); // Supprimer toutes les lignes
    
    if (deleteError) {
      console.error('❌ Erreur lors de la suppression:', deleteError);
      return false;
    }
    
    // Sauvegarder le fichier complet en une seule ligne
    const row = {
      shop_id: 'complete_file',
      week_key: 'all_data',
      data: completePlanningData,
      version: 1
    };
    
    console.log('📦 Sauvegarde du fichier complet...');
    
    // Insérer le fichier complet
    const { data, error } = await supabase
      .from('plannings')
      .insert(row);
    
    if (error) {
      console.error('❌ Erreur lors de l\'insertion:', error);
      return false;
    }
    
    console.log('✅ saveCompletePlanningData success:', { 
      shops: completePlanningData.shops?.length || 0,
      version: completePlanningData.version,
      dataKeys: Object.keys(completePlanningData),
      hasPlanning: !!completePlanningData.planning,
      planningKeys: completePlanningData.planning ? Object.keys(completePlanningData.planning) : []
    });
    
    return true;
  } catch (error) {
    console.error('❌ Exception dans saveCompletePlanningData:', error);
    return false;
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
    const { data, error } = await supabase
      .from('plannings')
      .select('*')
      .order('shop_id', { ascending: true });
    
    if (error) {
      console.error('❌ Erreur lors du chargement:', error);
      return null;
    }
    
    if (!data || data.length === 0) {
      console.log('❌ Aucune donnée trouvée dans Supabase');
      return null;
    }
    
    // Prendre la première ligne pour récupérer la structure complète
    const firstRow = data[0];
    const planningData = firstRow.data;
    
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

export const saveRemotePlanning = async (planningData, shopId, weekKey) => {
  console.log('🔍 saveRemotePlanning called with:', { 
    shopId, 
    weekKey, 
    hasData: !!planningData,
    dataKeys: planningData ? Object.keys(planningData) : []
  });
  
  if (!isReady() || !planningData || !shopId || !weekKey) {
    console.log('❌ saveRemotePlanning: not ready or missing params');
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


