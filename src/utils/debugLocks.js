// Utilitaire de debug pour les verrous
import { supabase } from './supabaseClient.js';
import { cleanupExpiredLocks } from './collabLock.js';

// Fonction pour diagnostiquer tous les verrous
export const diagnoseAllLocks = async () => {
  console.log('🔍 Diagnostic complet des verrous...');
  
  if (!supabase) {
    console.log('❌ Supabase non configuré, utilisation du localStorage');
    return diagnoseLocalStorageLocks();
  }
  
  try {
    // Récupérer tous les verrous
    const { data: locks, error } = await supabase
      .from('planning_locks')
      .select('*')
      .order('updated_at', { ascending: false });
    
    if (error) {
      console.error('❌ Erreur lors de la récupération des verrous:', error);
      return;
    }
    
    console.log(`📋 ${locks?.length || 0} verrou(s) trouvé(s) dans Supabase:`);
    
    if (locks && locks.length > 0) {
      locks.forEach((lock, index) => {
        const updatedAt = new Date(lock.updated_at);
        const isExpired = Date.now() - updatedAt.getTime() > 2 * 60 * 1000; // 2 minutes
        console.log(`${index + 1}. Boutique: ${lock.shop_id}, Semaine: ${lock.week_key}, Utilisateur: ${lock.user_id}, Expiré: ${isExpired ? 'OUI' : 'NON'}, Mis à jour: ${updatedAt.toLocaleString()}`);
      });
    } else {
      console.log('✅ Aucun verrou trouvé dans Supabase');
    }
    
    // Nettoyer les verrous expirés
    console.log('\n🧹 Nettoyage des verrous expirés...');
    const cleanupResult = await cleanupExpiredLocks();
    console.log('Résultat du nettoyage:', cleanupResult);
    
    // Vérification finale
    const { data: finalLocks, error: finalError } = await supabase
      .from('planning_locks')
      .select('*');
    
    if (finalError) {
      console.error('❌ Erreur lors de la vérification finale:', finalError);
    } else {
      console.log(`✅ ${finalLocks?.length || 0} verrou(x) restant(s) après nettoyage`);
    }
    
  } catch (error) {
    console.error('❌ Erreur générale:', error);
  }
};

// Fonction pour diagnostiquer les verrous localStorage
const diagnoseLocalStorageLocks = () => {
  console.log('🔍 Diagnostic des verrous localStorage...');
  
  try {
    const keys = Object.keys(localStorage);
    const lockKeys = keys.filter(key => key.startsWith('lock_'));
    
    console.log(`📋 ${lockKeys.length} verrou(s) trouvé(s) dans localStorage:`);
    
    lockKeys.forEach((key, index) => {
      try {
        const lockData = JSON.parse(localStorage.getItem(key));
        const updatedAt = new Date(lockData.updated_at || lockData.created_at);
        const isExpired = Date.now() - updatedAt.getTime() > 2 * 60 * 1000;
        console.log(`${index + 1}. Clé: ${key}, Utilisateur: ${lockData.user_id}, Expiré: ${isExpired ? 'OUI' : 'NON'}, Mis à jour: ${updatedAt.toLocaleString()}`);
      } catch (e) {
        console.log(`${index + 1}. Clé: ${key}, Données corrompues`);
      }
    });
    
    // Nettoyer les verrous expirés
    console.log('\n🧹 Nettoyage des verrous expirés localStorage...');
    let cleanedCount = 0;
    
    lockKeys.forEach(key => {
      try {
        const lockData = JSON.parse(localStorage.getItem(key));
        const updatedAt = new Date(lockData.updated_at || lockData.created_at);
        const isExpired = Date.now() - updatedAt.getTime() > 2 * 60 * 1000;
        
        if (isExpired) {
          localStorage.removeItem(key);
          cleanedCount++;
        }
      } catch (e) {
        localStorage.removeItem(key);
        cleanedCount++;
      }
    });
    
    console.log(`✅ ${cleanedCount} verrou(x) expiré(s) supprimé(s) de localStorage`);
    
  } catch (error) {
    console.error('❌ Erreur lors du diagnostic localStorage:', error);
  }
};

// Fonction pour forcer la libération d'un verrou spécifique
export const forceUnlockSpecificUser = async (userId) => {
  console.log(`🔓 Force libération des verrous de l'utilisateur: ${userId}`);
  
  if (!supabase) {
    console.log('❌ Supabase non configuré, nettoyage localStorage uniquement');
    return forceUnlockLocalStorage(userId);
  }
  
  try {
    // Supprimer tous les verrous de cet utilisateur dans Supabase
    const { data: deletedLocks, error } = await supabase
      .from('planning_locks')
      .delete()
      .eq('user_id', userId)
      .select();
    
    if (error) {
      console.error('❌ Erreur lors de la force libération Supabase:', error);
    } else {
      console.log(`✅ ${deletedLocks?.length || 0} verrou(x) de ${userId} supprimé(s) de Supabase`);
    }
    
    // Nettoyer aussi localStorage
    forceUnlockLocalStorage(userId);
    
  } catch (error) {
    console.error('❌ Erreur générale force libération:', error);
  }
};

// Fonction pour forcer la libération localStorage
const forceUnlockLocalStorage = (userId) => {
  try {
    const keys = Object.keys(localStorage);
    const lockKeys = keys.filter(key => key.startsWith('lock_'));
    let cleanedCount = 0;
    
    lockKeys.forEach(key => {
      try {
        const lockData = JSON.parse(localStorage.getItem(key));
        if (lockData.user_id === userId) {
          localStorage.removeItem(key);
          cleanedCount++;
        }
      } catch (e) {
        // Ignorer les clés corrompues
      }
    });
    
    console.log(`✅ ${cleanedCount} verrou(x) de ${userId} supprimé(s) de localStorage`);
    
  } catch (error) {
    console.error('❌ Erreur lors du nettoyage localStorage:', error);
  }
};

// Fonction pour nettoyer tous les verrous (utilisateur unique)
export const clearAllLocks = async () => {
  console.log('🧹 Nettoyage complet de tous les verrous...');
  
  if (!supabase) {
    console.log('❌ Supabase non configuré, nettoyage localStorage uniquement');
    return clearAllLocalStorageLocks();
  }
  
  try {
    // Supprimer tous les verrous dans Supabase
    const { data: deletedLocks, error } = await supabase
      .from('planning_locks')
      .delete()
      .neq('shop_id', '') // Supprimer tous les verrous
      .select();
    
    if (error) {
      console.error('❌ Erreur lors du nettoyage Supabase:', error);
    } else {
      console.log(`✅ ${deletedLocks?.length || 0} verrou(x) supprimé(s) de Supabase`);
    }
    
    // Nettoyer aussi localStorage
    clearAllLocalStorageLocks();
    
  } catch (error) {
    console.error('❌ Erreur générale nettoyage:', error);
  }
};

// Fonction pour nettoyer tous les verrous localStorage
const clearAllLocalStorageLocks = () => {
  try {
    const keys = Object.keys(localStorage);
    const lockKeys = keys.filter(key => key.startsWith('lock_'));
    let cleanedCount = 0;
    
    lockKeys.forEach(key => {
      localStorage.removeItem(key);
      cleanedCount++;
    });
    
    console.log(`✅ ${cleanedCount} verrou(x) supprimé(s) de localStorage`);
    
  } catch (error) {
    console.error('❌ Erreur lors du nettoyage localStorage:', error);
  }
};
