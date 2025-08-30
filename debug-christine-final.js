// Script de debug complet pour Christine
// Problème : Christine est dans les employés mais n'a pas ses boutons séparés

console.log('🔍 DEBUG COMPLET - POURQUOI CHRISTINE N\'A PAS SES BOUTONS SÉPARÉS');
console.log('================================================================');

// Récupérer les données du localStorage
const planningData = JSON.parse(localStorage.getItem('planningData') || '{}');

console.log('📊 Données de planning disponibles:', Object.keys(planningData));

// 1. Vérifier Christine dans les employés
const allEmployees = planningData.shops?.flatMap(shop => shop.employees || []) || [];
const christine = allEmployees.find(emp => emp.name === 'CHRISTINE');

console.log('👤 Christine dans les employés:', christine);

if (!christine) {
  console.log('❌ Christine n\'est pas dans les employés - PROBLÈME IDENTIFIÉ');
} else {
  // 2. Simuler la fonction getAllEmployees
  function getAllEmployees(planningData) {
    const employeesMap = new Map();
    
    planningData.shops.forEach(shop => {
      shop.employees.forEach(emp => {
        if (!employeesMap.has(emp.id)) {
          employeesMap.set(emp.id, emp);
        } else {
          const existing = employeesMap.get(emp.id);
          const mergedCanWorkIn = [...new Set([...existing.canWorkIn, ...emp.canWorkIn])];
          const mainShop = existing.mainShop || emp.mainShop;
          employeesMap.set(emp.id, { ...existing, canWorkIn: mergedCanWorkIn, mainShop });
        }
      });
    });
    
    return Array.from(employeesMap.values());
  }

  const allEmployeesFromFunction = getAllEmployees(planningData);
  const christineInAllEmployees = allEmployeesFromFunction.find(emp => emp.name === 'CHRISTINE');

  console.log('👤 Christine dans getAllEmployees:', christineInAllEmployees);

  // 3. Simuler la fonction getEmployeeShops
  function calculateEmployeeDailyHours(employee, dayKey, planning, config) {
    if (!planning || !planning[employee] || !planning[employee][dayKey]) return 0;
    
    const daySlots = planning[employee][dayKey];
    if (!Array.isArray(daySlots)) return 0;
    
    const trueSlots = daySlots.filter(slot => slot === true).length;
    const slotDuration = config?.slotDuration || 0.5;
    return trueSlots * slotDuration;
  }

  function getEmployeeShops(employee, planningData, currentWeek) {
    if (!planningData || !currentWeek) return [];
    
    console.log(`DEBUG - getEmployeeShops appelé avec employee: "${employee}"`);
    
    const shopsWithHours = [];
    
    planningData.shops.forEach(shop => {
      let hasDataInShop = false;
      let totalShopHours = 0;
      
      Object.keys(shop.weeks || {}).forEach(weekKey => {
        const weekData = shop.weeks[weekKey];
        if (weekData && weekData.planning && weekData.planning[employee]) {
          hasDataInShop = true;
          
          let weekHours = 0;
          for (let i = 0; i < 7; i++) {
            const dayDate = new Date(weekKey);
            dayDate.setDate(dayDate.getDate() + i);
            const dayKey = dayDate.toISOString().split('T')[0];
            
            const hours = calculateEmployeeDailyHours(employee, dayKey, weekData.planning, shop.config);
            weekHours += hours;
          }
          totalShopHours += weekHours;
        }
      });
      
      if (hasDataInShop && totalShopHours > 0) {
        console.log(`DEBUG - ${employee} dans ${shop.name}: ${totalShopHours.toFixed(1)}h (toutes semaines)`);
        shopsWithHours.push({
          id: shop.id,
          name: shop.name,
          hours: totalShopHours.toFixed(1)
        });
      }
    });
    
    console.log(`Boutiques avec heures pour ${employee}:`, shopsWithHours);
    return shopsWithHours;
  }

  // 4. Tester avec la semaine actuelle
  const currentWeek = '2025-09-01'; // Semaine du 1er septembre
  const employeeShops = getEmployeeShops('CHRISTINE', planningData, currentWeek);

  console.log('🏪 Boutiques où Christine a des heures:', employeeShops);
  console.log('📊 Nombre de boutiques avec heures:', employeeShops.length);

  // 5. Vérifier la condition dans RecapButtons
  const shouldShowSeparateButtons = employeeShops.length > 1;
  console.log('🔍 Condition pour boutons séparés (employeeShops.length > 1):', shouldShowSeparateButtons);

  // 6. Vérifier les données de planning de Christine
  console.log('📅 Données de planning de Christine:');
  planningData.shops.forEach(shop => {
    if (shop.weeks) {
      Object.keys(shop.weeks).forEach(weekKey => {
        const weekData = shop.weeks[weekKey];
        if (weekData.planning && weekData.planning.CHRISTINE) {
          console.log(`  ${shop.name} - Semaine ${weekKey}:`, weekData.planning.CHRISTINE);
        }
      });
    }
  });

  // 7. Comparer avec Valou et Angelique
  const valou = allEmployees.find(emp => emp.name === 'VALOU');
  const angelique = allEmployees.find(emp => emp.name === 'ANGELIQUE');

  console.log('👥 Comparaison avec les autres employés multi-boutiques:');
  console.log('  Valou:', valou);
  console.log('  Angelique:', angelique);

  if (valou) {
    const valouShops = getEmployeeShops('VALOU', planningData, currentWeek);
    console.log('  Valou boutiques avec heures:', valouShops);
    console.log('  Valou devrait avoir boutons séparés:', valouShops.length > 1);
  }

  if (angelique) {
    const angeliqueShops = getEmployeeShops('ANGELIQUE', planningData, currentWeek);
    console.log('  Angelique boutiques avec heures:', angeliqueShops);
    console.log('  Angelique devrait avoir boutons séparés:', angeliqueShops.length > 1);
  }
}

console.log('🎯 DIAGNOSTIC TERMINÉ');
