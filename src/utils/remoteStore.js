import { supabase } from './supabaseClient';

const isReady = () => {
  const ready = !!supabase;
  console.log('🔍 Supabase ready check:', ready, {
    url: import.meta.env?.VITE_SUPABASE_URL ? '✅' : '❌',
    key: import.meta.env?.VITE_SUPABASE_KEY ? '✅' : '❌'
  });
  return ready;
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


