// Debug avancé pour analyser la structure HTML
console.log('🔍 DEBUG AVANCÉ - ANALYSE DE LA STRUCTURE HTML');

// Attendre que la page soit chargée
setTimeout(() => {
  console.log('\n1️⃣ ANALYSE DES BOUTONS:');
  
  // Chercher tous les boutons
  const allButtons = document.querySelectorAll('button');
  console.log(`Nombre total de boutons: ${allButtons.length}`);
  
  // Chercher le bouton spécifique
  const hiddenButton = Array.from(allButtons).find(btn => 
    btn.textContent && btn.textContent.includes('Gestion Masqués')
  );
  
  if (hiddenButton) {
    console.log('✅ Bouton trouvé !');
    console.log('Texte:', hiddenButton.textContent);
    console.log('Classes:', hiddenButton.className);
    console.log('Style inline:', hiddenButton.style.cssText);
    
    // Vérifier la position et la visibilité
    const rect = hiddenButton.getBoundingClientRect();
    console.log('Position:', rect);
    console.log('Dimensions:', rect.width, 'x', rect.height);
    
    // Vérifier le CSS calculé
    const computedStyle = window.getComputedStyle(hiddenButton);
    console.log('CSS calculé:');
    console.log('  display:', computedStyle.display);
    console.log('  visibility:', computedStyle.visibility);
    console.log('  opacity:', computedStyle.opacity);
    console.log('  position:', computedStyle.position);
    console.log('  z-index:', computedStyle.zIndex);
    
    // Vérifier le parent
    const parent = hiddenButton.parentElement;
    console.log('Parent:', parent.tagName, parent.className);
    
    // Vérifier si le parent est visible
    const parentStyle = window.getComputedStyle(parent);
    console.log('Parent visible:', parentStyle.display !== 'none' && parentStyle.visibility !== 'hidden');
    
  } else {
    console.log('❌ Bouton NON TROUVÉ !');
    
    // Analyser la structure de la barre de menu
    console.log('\n2️⃣ ANALYSE DE LA BARRE DE MENU:');
    
    // Chercher par classe ou contenu
    const menuBars = document.querySelectorAll('[class*="menu"], [class*="bar"]');
    console.log('Éléments avec "menu" ou "bar":', menuBars.length);
    
    // Chercher par contenu
    const elementsWithButtons = Array.from(document.querySelectorAll('*')).filter(el => 
      el.querySelector && el.querySelectorAll('button').length > 0
    );
    
    console.log('Éléments contenant des boutons:', elementsWithButtons.length);
    
    // Lister les boutons par zone
    elementsWithButtons.forEach((el, index) => {
      const buttons = el.querySelectorAll('button');
      if (buttons.length > 0) {
        console.log(`\nZone ${index + 1} (${el.tagName}.${el.className}):`);
        buttons.forEach((btn, btnIndex) => {
          if (btn.textContent && btn.textContent.trim()) {
            console.log(`  ${btnIndex + 1}: "${btn.textContent.trim()}"`);
          }
        });
      }
    });
  }
  
  console.log('\n3️⃣ RECHERCHE PAR ÉMOJI:');
  const emojiButtons = Array.from(allButtons).filter(btn => 
    btn.textContent && btn.textContent.includes('👥')
  );
  console.log('Boutons avec emoji 👥:', emojiButtons.length);
  emojiButtons.forEach((btn, index) => {
    console.log(`  ${index + 1}: "${btn.textContent.trim()}"`);
  });
  
}, 3000);

console.log('🔍 Debug avancé en cours...');
