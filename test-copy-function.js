// Script de test pour la fonction de copie de semaine
console.log('🧪 Test de la fonction de copie de semaine');

// Simuler les données de test
const testPlanning = {
  'emp_1': {
    '2025-07-28': [true, false, true, false, true],
    '2025-07-29': [false, true, false, true, false],
    '2025-07-30': [true, true, false, false, true]
  },
  'emp_2': {
    '2025-07-28': [false, true, false, true, false],
    '2025-07-29': [true, false, true, false, true],
    '2025-07-30': [false, false, true, true, false]
  }
};

const testSelectedEmployees = ['emp_1', 'emp_2'];
const testShop = 'shop_1';
const sourceWeek = '2025-07-28';
const destinationWeek = '2025-08-04';

console.log('📊 Données de test:');
console.log('- Planning source:', testPlanning);
console.log('- Employés sélectionnés:', testSelectedEmployees);
console.log('- Boutique:', testShop);
console.log('- Semaine source:', sourceWeek);
console.log('- Semaine destination:', destinationWeek);

// Simuler la sauvegarde dans localStorage
localStorage.setItem(`planning_${testShop}_${destinationWeek}`, JSON.stringify(testPlanning));
localStorage.setItem(`selected_employees_${testShop}_${destinationWeek}`, JSON.stringify(testSelectedEmployees));

// Vérifier la sauvegarde
const savedPlanning = localStorage.getItem(`planning_${testShop}_${destinationWeek}`);
const savedEmployees = localStorage.getItem(`selected_employees_${testShop}_${destinationWeek}`);

console.log('✅ Vérification de la sauvegarde:');
console.log('- Planning sauvegardé:', savedPlanning ? 'OK' : 'ERREUR');
console.log('- Employés sauvegardés:', savedEmployees ? 'OK' : 'ERREUR');

if (savedPlanning) {
  const parsedPlanning = JSON.parse(savedPlanning);
  console.log('- Données du planning sauvegardé:', parsedPlanning);
}

if (savedEmployees) {
  const parsedEmployees = JSON.parse(savedEmployees);
  console.log('- Données des employés sauvegardés:', parsedEmployees);
}

console.log('🎯 Test terminé - Vérifiez la console pour les résultats'); 