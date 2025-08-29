# Script pour appliquer la correction TTL des fonctions de verrouillage
Write-Host "=== CORRECTION TTL DES FONCTIONS DE VERROUILLAGE ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "PROBLÈME IDENTIFIÉ:" -ForegroundColor Red
Write-Host "Les fonctions SQL utilisent TTL_SEC = 30 par défaut au lieu de 300" -ForegroundColor Yellow
Write-Host "Cela explique pourquoi le verrou est perdu toutes les 30 secondes!" -ForegroundColor Yellow
Write-Host ""

Write-Host "SOLUTION:" -ForegroundColor Green
Write-Host "Nous allons corriger les valeurs par défaut dans les fonctions SQL" -ForegroundColor White
Write-Host ""

Write-Host "ÉTAPES:" -ForegroundColor Yellow
Write-Host "1. Ouvrez votre projet Supabase dans le navigateur" -ForegroundColor White
Write-Host "2. Allez dans l'onglet 'SQL Editor'" -ForegroundColor White
Write-Host "3. Copiez et collez le contenu du fichier 'fix-lock-ttl.sql'" -ForegroundColor White
Write-Host "4. Exécutez le script" -ForegroundColor White
Write-Host ""

Write-Host "Ce script va:" -ForegroundColor Green
Write-Host "- Corriger acquire_planning_lock (TTL par défaut: 30 → 300)" -ForegroundColor White
Write-Host "- Corriger renew_planning_lock (TTL par défaut: 30 → 300)" -ForegroundColor White
Write-Host "- Corriger emergency_takeover_planning_lock (TTL par défaut: 30 → 300)" -ForegroundColor White
Write-Host "- Tester les fonctions corrigées" -ForegroundColor White
Write-Host ""

Write-Host "Après l'exécution, le verrou devrait durer 5 minutes au lieu de 30 secondes!" -ForegroundColor Green
Write-Host ""

Write-Host "Appuyez sur une touche pour ouvrir le fichier SQL de correction..." -ForegroundColor Magenta
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Ouvrir le fichier SQL
if (Test-Path "fix-lock-ttl.sql") {
    Start-Process "fix-lock-ttl.sql"
} else {
    Write-Host "Fichier fix-lock-ttl.sql non trouvé!" -ForegroundColor Red
}

Write-Host ""
Write-Host "Une fois la correction appliquée:" -ForegroundColor Cyan
Write-Host "1. Revenez à l'application" -ForegroundColor White
Write-Host "2. Ouvrez la console du navigateur (F12)" -ForegroundColor White
Write-Host "3. Observez les logs de verrouillage" -ForegroundColor White
Write-Host "4. Le verrou devrait maintenant durer 5 minutes" -ForegroundColor White
Write-Host ""

Write-Host "Appuyez sur une touche pour continuer..." -ForegroundColor Magenta
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
