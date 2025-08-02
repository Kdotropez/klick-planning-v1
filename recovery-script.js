// Script de récupération d'urgence pour Klick-planning
// À exécuter dans la console du navigateur

console.log('🚨 SCRIPT DE RÉCUPÉRATION D\'URGENCE 🚨');

// 1. Lister toutes les données disponibles
console.log('📋 RECHERCHE DES DONNÉES DISPONIBLES...');

const allKeys = Object.keys(localStorage);
const planningKeys = allKeys.filter(key => key.includes('planning'));
const employeeKeys = allKeys.filter(key => key.includes('selected_employees'));
const validationKeys = allKeys.filter(key => key.includes('validation'));

console.log('🔑 Clés de planning trouvées:', planningKeys);
console.log('👥 Clés d\'employés trouvées:', employeeKeys);
console.log('🔒 Clés de validation trouvées:', validationKeys);

// 2. Afficher le contenu de chaque clé
console.log('\n📊 CONTENU DES DONNÉES:');

planningKeys.forEach(key => {
  try {
    const data = JSON.parse(localStorage.getItem(key));
    console.log(`\n📅 ${key}:`, data);
  } catch (error) {
    console.log(`\n❌ Erreur pour ${key}:`, error);
  }
});

employeeKeys.forEach(key => {
  try {
    const data = JSON.parse(localStorage.getItem(key));
    console.log(`\n👥 ${key}:`, data);
  } catch (error) {
    console.log(`\n❌ Erreur pour ${key}:`, error);
  }
});

// 3. Fonction de restauration
function restoreData() {
  console.log('\n🔄 TENTATIVE DE RESTAURATION...');
  
  // Essayer de restaurer les données de planningData
  const planningDataKey = 'planningData';
  const planningData = localStorage.getItem(planningDataKey);
  
  if (planningData) {
    try {
      const parsedData = JSON.parse(planningData);
      console.log('✅ Données planningData trouvées:', parsedData);
      
      // Restaurer dans l'application
      if (window.setPlanningData) {
        window.setPlanningData(parsedData);
        console.log('✅ Données restaurées dans l\'application');
      } else {
        console.log('⚠️ Fonction setPlanningData non disponible');
      }
    } catch (error) {
      console.log('❌ Erreur lors de la restauration:', error);
    }
  } else {
    console.log('❌ Aucune donnée planningData trouvée');
  }
}

// 4. Exécuter la restauration
restoreData();

console.log('\n🎯 INSTRUCTIONS:');
console.log('1. Copiez toutes les données affichées ci-dessus');
console.log('2. Envoyez-les à l\'assistant pour restauration manuelle');
console.log('3. Ou utilisez la fonction restoreData() si disponible'); 