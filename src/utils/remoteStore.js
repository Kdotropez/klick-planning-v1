import { supabase } from './supabaseClient';

const isReady = () => !!supabase;

export const loadRemotePlanning = async (shopId, weekKey) => {
  if (!isReady() || !shopId || !weekKey) return null;
  const { data, error } = await supabase
    .from('plannings')
    .select('*')
    .eq('shop_id', shopId)
    .eq('week_key', weekKey)
    .maybeSingle();
  if (error) {
    console.warn('Supabase load error:', error.message);
    return null;
  }
  return data?.data || null;
};

export const saveRemotePlanning = async (planningData, shopId, weekKey) => {
  if (!isReady() || !planningData || !shopId || !weekKey) return false;
  const row = {
    shop_id: shopId,
    week_key: weekKey,
    data: planningData,
    version: 1
  };
  const { error } = await supabase
    .from('plannings')
    .upsert(row, { onConflict: 'shop_id,week_key' });
  if (error) {
    console.warn('Supabase save error:', error.message);
    return false;
  }
  return true;
};

export const listRemoteShops = async () => {
  if (!isReady()) return [];
  const { data, error } = await supabase
    .from('plannings')
    .select('shop_id')
    .order('shop_id', { ascending: true });
  if (error) return [];
  const ids = [...new Set((data || []).map(r => r.shop_id).filter(Boolean))];
  return ids;
};

export const listRemoteWeeksForShop = async (shopId) => {
  if (!isReady() || !shopId) return [];
  const { data, error } = await supabase
    .from('plannings')
    .select('week_key')
    .eq('shop_id', shopId)
    .order('week_key', { ascending: true });
  if (error) return [];
  const weeks = [...new Set((data || []).map(r => r.week_key).filter(Boolean))];
  return weeks;
};


