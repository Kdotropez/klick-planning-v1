// Script de test pour vérifier les fonctions de verrouillage
import { createClient } from '@supabase/supabase-js';

// Configuration Supabase (à adapter selon votre configuration)
const supabaseUrl = 'https://your-project.supabase.co';
const supabaseKey = 'your-anon-key';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testLockFunctions() {
  console.log('🧪 Test des fonctions de verrouillage...');
  
  const resourceId = 'test-boutique:2025-01-20';
  const holder = 'test-user';
  const ttlSeconds = 300; // 5 minutes
  
  try {
    // Test 1: Acquisition du verrou
    console.log('\n1️⃣ Test d\'acquisition du verrou...');
    const { data: acquireData, error: acquireError } = await supabase.rpc('acquire_planning_lock', {
      p_resource_id: resourceId,
      p_holder: holder,
      p_ttl_seconds: ttlSeconds,
    });
    
    if (acquireError) {
      console.error('❌ Erreur acquisition:', acquireError);
      return;
    }
    
    console.log('✅ Acquisition réussie:', acquireData);
    
    if (!acquireData?.acquired) {
      console.log('⚠️ Verrou non acquis, détenu par:', acquireData?.holder);
      return;
    }
    
    const leaseToken = acquireData.lease_token;
    
    // Test 2: Renouvellement du verrou
    console.log('\n2️⃣ Test de renouvellement du verrou...');
    const { data: renewData, error: renewError } = await supabase.rpc('renew_planning_lock', {
      p_resource_id: resourceId,
      p_holder: holder,
      p_lease_token: leaseToken,
      p_ttl_seconds: ttlSeconds,
    });
    
    if (renewError) {
      console.error('❌ Erreur renouvellement:', renewError);
    } else {
      console.log('✅ Renouvellement réussi:', renewData);
    }
    
    // Test 3: Vérification de l'état du verrou
    console.log('\n3️⃣ Vérification de l\'état du verrou...');
    const { data: lockData, error: lockError } = await supabase
      .from('planning_lock')
      .select('*')
      .eq('resource_id', resourceId)
      .single();
    
    if (lockError) {
      console.error('❌ Erreur lecture verrou:', lockError);
    } else {
      console.log('📋 État du verrou:', lockData);
      const expiresAt = new Date(lockData.expires_at);
      const now = new Date();
      const timeLeft = Math.floor((expiresAt - now) / 1000);
      console.log(`⏰ Temps restant: ${timeLeft} secondes`);
    }
    
    // Test 4: Libération du verrou
    console.log('\n4️⃣ Test de libération du verrou...');
    const { data: releaseData, error: releaseError } = await supabase.rpc('release_planning_lock', {
      p_resource_id: resourceId,
      p_holder: holder,
      p_lease_token: leaseToken,
    });
    
    if (releaseError) {
      console.error('❌ Erreur libération:', releaseError);
    } else {
      console.log('✅ Libération réussie:', releaseData);
    }
    
  } catch (error) {
    console.error('❌ Erreur générale:', error);
  }
}

// Exécution du test
testLockFunctions().then(() => {
  console.log('\n🏁 Test terminé');
}).catch(console.error);
