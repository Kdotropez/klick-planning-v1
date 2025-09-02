// Script de test pour vérifier le bouton de gestion des employés masqués
console.log('🔍 TEST DU BOUTON DE GESTION DES EMPLOYÉS MASQUÉS');
console.log('==================================================');

// Vérifier que le bouton est visible dans l'interface
console.log('\n1️⃣ VÉRIFICATION DE L\'INTERFACE:');
console.log('Recherchez le bouton "👥 Gestion Masqués" dans la barre de menu principale');
console.log('Il devrait être visible en haut de l\'écran, dans la grille de boutons');

// Vérifier les données dans localStorage
console.log('\n2️⃣ VÉRIFICATION DES DONNÉES:');
const planningData = JSON.parse(localStorage.getItem('planningData') || '{}');
console.log('planningData existe:', !!planningData);
console.log('Nombre de boutiques:', planningData.shops?.length || 0);

// Vérifier les employés et leur statut hiddenFrom
if (planningData.shops) {
  planningData.shops.forEach((shop, shopIndex) => {
    console.log(`\n🏪 Boutique ${shopIndex + 1}: ${shop.name}`);
    if (shop.employees) {
      shop.employees.forEach((emp, empIndex) => {
        const hiddenStatus = emp.hiddenFrom ? `🚫 Masqué depuis ${emp.hiddenFrom}` : '✅ Visible';
        console.log(`  ${empIndex + 1}. ${emp.name}: ${hiddenStatus}`);
      });
    }
  });
}

// Vérifier les fonctions de gestion
console.log('\n3️⃣ VÉRIFICATION DES FONCTIONS:');
console.log('getHiddenEmployees existe:', typeof getHiddenEmployees === 'function');
console.log('getAllEmployees existe:', typeof getAllEmployees === 'function');

// Instructions de test
console.log('\n4️⃣ INSTRUCTIONS DE TEST:');
console.log('1. Cliquez sur le bouton "👥 Gestion Masqués"');
console.log('2. Une modale devrait s\'ouvrir avec la liste des employés');
console.log('3. Testez le masquage d\'un employé');
console.log('4. Testez la réactivation d\'un employé masqué');
console.log('5. Vérifiez que le statut persiste après changement de semaine');

console.log('\n🎯 TEST TERMINÉ - Vérifiez l\'interface maintenant');
