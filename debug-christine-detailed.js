// Script de debug détaillé pour analyser le problème de Christine
console.log('🔍 DEBUG DÉTAILLÉ - Analyse du problème de Christine');

// Récupérer les données du localStorage
const planningData = JSON.parse(localStorage.getItem('planningData') || '{}');

if (!planningData || !planningData.shops) {
  console.log('❌ Aucune donnée de planning trouvée');
} else {
  console.log('📊 Données de planning récupérées:', planningData);

  // Simuler la fonction getAllEmployees
  const getAllEmployees = (planningData) => {
    const employeesMap = new Map();
    
    planningData.shops.forEach(shop => {
      shop.employees.forEach(emp => {
        if (!employeesMap.has(emp.id)) {
          employeesMap.set(emp.id, emp);
        } else {
          // Fusionner les boutiques autorisées et garder la boutique principale
          const existing = employeesMap.get(emp.id);
          const mergedCanWorkIn = [...new Set([...existing.canWorkIn, ...emp.canWorkIn])];
          const mainShop = existing.mainShop || emp.mainShop;
          employeesMap.set(emp.id, { ...existing, canWorkIn: mergedCanWorkIn, mainShop });
        }
      });
    });
    
    return Array.from(employeesMap.values());
  };

  // Simuler le filtrage de PlanningDisplay.jsx
  const selectedShop = 'saint-tropez';
  const allEmployees = getAllEmployees(planningData);

  console.log('🔍 Tous les employés après fusion:', allEmployees.map(emp => ({
    id: emp.id,
    name: emp.name,
    canWorkIn: emp.canWorkIn,
    mainShop: emp.mainShop
  })));

  // Chercher Christine spécifiquement
  const christine = allEmployees.find(emp => emp.name === 'CHRISTINE');
  console.log('🔍 Christine trouvée dans allEmployees:', christine);

  if (christine) {
    console.log('🔍 Analyse de Christine:');
    console.log('  - ID:', christine.id);
    console.log('  - Nom:', christine.name);
    console.log('  - canWorkIn:', christine.canWorkIn);
    console.log('  - mainShop:', christine.mainShop);
    console.log('  - selectedShop:', selectedShop);
    console.log('  - canWorkIn.includes(selectedShop):', christine.canWorkIn && christine.canWorkIn.includes(selectedShop));
    
    // Test du filtre
    const employeesForThisShop = allEmployees.filter(emp => 
      emp.canWorkIn && emp.canWorkIn.includes(selectedShop)
    );
    
    console.log('🔍 Employés filtrés pour saint-tropez:', employeesForThisShop.map(emp => emp.name));
    
    const christineInFiltered = employeesForThisShop.find(emp => emp.name === 'CHRISTINE');
    console.log('🔍 Christine dans les employés filtrés:', christineInFiltered ? 'OUI' : 'NON');
    
    if (!christineInFiltered) {
      console.log('❌ PROBLÈME DÉTECTÉ: Christine n\'est pas dans les employés filtrés');
      console.log('🔍 Vérification détaillée du filtre:');
      console.log('  - christine.canWorkIn:', christine.canWorkIn);
      console.log('  - selectedShop:', selectedShop);
      console.log('  - christine.canWorkIn.includes(selectedShop):', christine.canWorkIn.includes(selectedShop));
      console.log('  - Type de canWorkIn:', typeof christine.canWorkIn);
      console.log('  - canWorkIn est un array:', Array.isArray(christine.canWorkIn));
      
      // Vérifier chaque élément de canWorkIn
      if (Array.isArray(christine.canWorkIn)) {
        christine.canWorkIn.forEach((shop, index) => {
          console.log(`  - canWorkIn[${index}]: "${shop}" (type: ${typeof shop})`);
          console.log(`  - shop === selectedShop: ${shop === selectedShop}`);
          console.log(`  - shop.includes(selectedShop): ${shop.includes(selectedShop)}`);
        });
      }
    } else {
      console.log('✅ Christine est correctement filtrée');
    }
  } else {
    console.log('❌ Christine non trouvée dans allEmployees');
  }

  // Vérifier les données brutes de chaque boutique
  console.log('🔍 Vérification des données brutes par boutique:');
  planningData.shops.forEach(shop => {
    const christineInShop = shop.employees.find(emp => emp.name === 'CHRISTINE');
    if (christineInShop) {
      console.log(`  - ${shop.name} (${shop.id}):`, {
        name: christineInShop.name,
        canWorkIn: christineInShop.canWorkIn,
        mainShop: christineInShop.mainShop
      });
    }
  });
}
