// Test simple pour vérifier le bouton Masquer sur la carte de l'employé
console.log('🎯 TEST SIMPLE - BOUTON MASQUER SUR LA CARTE');

setTimeout(() => {
  console.log('\n🔍 RECHERCHE DU BOUTON "🚫 Masquer":');
  
  const buttons = Array.from(document.querySelectorAll('button'));
  const masquerButton = buttons.find(btn => 
    btn.textContent && btn.textContent.includes('🚫 Masquer')
  );
  
  if (masquerButton) {
    console.log('✅ BOUTON "🚫 Masquer" TROUVÉ !');
    console.log('Position:', masquerButton.getBoundingClientRect());
    console.log('Parent:', masquerButton.parentElement?.tagName);
    
    // Tester le clic
    console.log('🎯 Test du clic sur Masquer...');
    masquerButton.click();
    
  } else {
    console.log('❌ BOUTON "🚫 Masquer" NON TROUVÉ !');
    
    // Lister tous les boutons pour debug
    console.log('\n📋 BOUTONS DISPONIBLES:');
    buttons.forEach((btn, index) => {
      if (btn.textContent && btn.textContent.trim()) {
        console.log(`${index + 1}: "${btn.textContent.trim()}"`);
      }
    });
  }
  
  // Vérifier aussi le bouton de réactivation
  console.log('\n🔍 RECHERCHE DU BOUTON "🔓 Réactiver":');
  const reactiverButton = buttons.find(btn => 
    btn.textContent && btn.textContent.includes('🔓 Réactiver')
  );
  
  if (reactiverButton) {
    console.log('✅ BOUTON "🔓 Réactiver" TROUVÉ !');
  } else {
    console.log('❌ BOUTON "🔓 Réactiver" NON TROUVÉ !');
  }
  
}, 2000);

console.log('🎯 Test en cours...');
