import { supabase } from './supabaseClient';

export const testSupabaseConnection = async () => {
  console.log('🧪 Test de connexion Supabase...');
  
  // Vérifier les variables d'environnement
  const url = import.meta.env?.VITE_SUPABASE_URL;
  const key = import.meta.env?.VITE_SUPABASE_KEY;
  
  console.log('🔍 Variables d\'environnement:', {
    url: url ? '✅ Présente' : '❌ Manquante',
    key: key ? '✅ Présente' : '❌ Manquante',
    urlLength: url?.length || 0,
    keyLength: key?.length || 0
  });
  
  if (!supabase) {
    console.error('❌ Client Supabase non initialisé');
    return false;
  }
  
  try {
    // Test simple de connexion
    const { data, error } = await supabase
      .from('plannings')
      .select('count')
      .limit(1);
      
    if (error) {
      console.error('❌ Erreur de connexion Supabase:', error);
      return false;
    }
    
    console.log('✅ Connexion Supabase réussie');
    return true;
  } catch (error) {
    console.error('❌ Exception lors du test Supabase:', error);
    return false;
  }
};

export const testSupabaseTables = async () => {
  console.log('🧪 Test des tables Supabase...');
  
  if (!supabase) {
    console.error('❌ Client Supabase non initialisé');
    return false;
  }
  
  try {
    // Test de la table plannings
    const { data: planningsData, error: planningsError } = await supabase
      .from('plannings')
      .select('*')
      .limit(1);
      
    if (planningsError) {
      console.error('❌ Erreur table plannings:', planningsError);
      return false;
    }
    
    console.log('✅ Table plannings accessible');
    
    // Test de la table planning_locks
    const { data: locksData, error: locksError } = await supabase
      .from('planning_locks')
      .select('*')
      .limit(1);
      
    if (locksError) {
      console.error('❌ Erreur table planning_locks:', locksError);
      return false;
    }
    
    console.log('✅ Table planning_locks accessible');
    return true;
  } catch (error) {
    console.error('❌ Exception lors du test des tables:', error);
    return false;
  }
};
