// Debug simple pour vérifier le bouton de gestion des employés masqués
console.log('🔍 DEBUG BOUTON GESTION EMPLOYÉS MASQUÉS');

// Vérifier que le bouton existe dans le DOM
setTimeout(() => {
  const buttons = document.querySelectorAll('button');
  const hiddenButton = Array.from(buttons).find(btn => 
    btn.textContent && btn.textContent.includes('Gestion Masqués')
  );
  
  if (hiddenButton) {
    console.log('✅ Bouton "👥 Gestion Masqués" trouvé !');
    console.log('Position:', hiddenButton.getBoundingClientRect());
    console.log('Style:', window.getComputedStyle(hiddenButton));
    
    // Vérifier s'il est visible
    const style = window.getComputedStyle(hiddenButton);
    console.log('Visible:', style.display !== 'none' && style.visibility !== 'hidden');
    
    // Tester le clic
    console.log('🎯 Test du clic sur le bouton...');
    hiddenButton.click();
  } else {
    console.log('❌ Bouton "👥 Gestion Masqués" NON TROUVÉ !');
    console.log('Boutons disponibles:', buttons.length);
    
    // Lister tous les boutons pour debug
    buttons.forEach((btn, index) => {
      if (btn.textContent && btn.textContent.trim()) {
        console.log(`${index}: "${btn.textContent.trim()}"`);
      }
    });
  }
}, 2000);

console.log('🔍 Recherche en cours...');
