// Test direct de la visibilité du bouton
console.log('🎯 TEST DIRECT DE LA VISIBILITÉ DU BOUTON');

// Attendre que la page soit chargée
setTimeout(() => {
  console.log('\n🔍 RECHERCHE DU BOUTON "👥 Gestion Masqués":');
  
  // Méthode 1: Recherche par texte
  const buttons = Array.from(document.querySelectorAll('button'));
  const hiddenButton = buttons.find(btn => 
    btn.textContent && btn.textContent.includes('Gestion Masqués')
  );
  
  if (hiddenButton) {
    console.log('✅ BOUTON TROUVÉ !');
    console.log('Texte complet:', hiddenButton.textContent);
    console.log('Position:', hiddenButton.getBoundingClientRect());
    
    // Tester le clic
    console.log('🎯 Test du clic...');
    hiddenButton.click();
    
    // Vérifier que la modale s'ouvre
    setTimeout(() => {
      const modal = document.querySelector('[class*="modal"], [class*="Modal"]');
      if (modal) {
        console.log('✅ MODALE OUVERTE !');
        console.log('Type de modale:', modal.tagName, modal.className);
      } else {
        console.log('❌ MODALE NON TROUVÉE');
      }
    }, 500);
    
  } else {
    console.log('❌ BOUTON NON TROUVÉ !');
    
    // Lister tous les boutons pour debug
    console.log('\n📋 TOUS LES BOUTONS DISPONIBLES:');
    buttons.forEach((btn, index) => {
      if (btn.textContent && btn.textContent.trim()) {
        const text = btn.textContent.trim();
        const rect = btn.getBoundingClientRect();
        console.log(`${index + 1}: "${text}" - Position: ${rect.left},${rect.top} - Visible: ${rect.width > 0 && rect.height > 0}`);
      }
    });
    
    // Chercher par emoji
    console.log('\n🔍 RECHERCHE PAR ÉMOJI 👥:');
    const emojiButtons = buttons.filter(btn => 
      btn.textContent && btn.textContent.includes('👥')
    );
    console.log('Boutons avec 👥:', emojiButtons.length);
    emojiButtons.forEach((btn, index) => {
      console.log(`${index + 1}: "${btn.textContent.trim()}"`);
    });
    
    // Chercher par classe
    console.log('\n🔍 RECHERCHE PAR CLASSE:');
    const primaryButtons = buttons.filter(btn => 
      btn.className && btn.className.includes('primary')
    );
    console.log('Boutons avec classe "primary":', primaryButtons.length);
    
    // Vérifier la structure de la grille
    console.log('\n🏗️ ANALYSE DE LA STRUCTURE:');
    const gridElements = document.querySelectorAll('[style*="grid"]');
    console.log('Éléments avec grid:', gridElements.length);
    
    gridElements.forEach((el, index) => {
      const style = el.style.cssText;
      if (style.includes('grid')) {
        console.log(`Grid ${index + 1}:`, style);
        const gridButtons = el.querySelectorAll('button');
        console.log(`  Boutons dans cette grille: ${gridButtons.length}`);
      }
    });
  }
  
}, 2000);

console.log('🎯 Test en cours...');
