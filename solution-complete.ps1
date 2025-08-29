# Script pour appliquer la solution complète
Write-Host "=== SOLUTION COMPLÈTE : NETTOYAGE + CORRECTION TTL ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "PROBLÈME IDENTIFIÉ:" -ForegroundColor Red
Write-Host "6 verrous actifs qui se battent entre eux!" -ForegroundColor Yellow
Write-Host "Cela explique pourquoi le verrou est perdu toutes les 15-30 secondes!" -ForegroundColor Yellow
Write-Host ""

Write-Host "SOLUTION:" -ForegroundColor Green
Write-Host "1. Nettoyer tous les verrous existants" -ForegroundColor White
Write-Host "2. Recréer les fonctions avec TTL = 300 secondes" -ForegroundColor White
Write-Host "3. Tester la correction" -ForegroundColor White
Write-Host ""

Write-Host "ÉTAPES:" -ForegroundColor Yellow
Write-Host "1. Ouvrez votre projet Supabase dans le navigateur" -ForegroundColor White
Write-Host "2. Allez dans l'onglet 'SQL Editor'" -ForegroundColor White
Write-Host "3. Copiez et collez le contenu du fichier 'nettoyer-et-corriger.sql'" -ForegroundColor White
Write-Host "4. Exécutez le script" -ForegroundColor White
Write-Host ""

Write-Host "Ce script va:" -ForegroundColor Green
Write-Host "- Supprimer tous les verrous existants (6 verrous actifs)" -ForegroundColor White
Write-Host "- Recréer les fonctions avec TTL = 300 secondes (5 minutes)" -ForegroundColor White
Write-Host "- Tester la correction" -ForegroundColor White
Write-Host "- Vérifier que tout fonctionne" -ForegroundColor White
Write-Host ""

Write-Host "⚠️ ATTENTION: Ce script va supprimer tous les verrous existants!" -ForegroundColor Red
Write-Host "C'est nécessaire pour résoudre le problème de conflit." -ForegroundColor White
Write-Host ""

Write-Host "Appuyez sur une touche pour ouvrir le fichier SQL de solution..." -ForegroundColor Magenta
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Ouvrir le fichier SQL
if (Test-Path "nettoyer-et-corriger.sql") {
    Start-Process "nettoyer-et-corriger.sql"
} else {
    Write-Host "Fichier nettoyer-et-corriger.sql non trouvé!" -ForegroundColor Red
}

Write-Host ""
Write-Host "Une fois la solution appliquée:" -ForegroundColor Cyan
Write-Host "1. Revenez à votre application" -ForegroundColor White
Write-Host "2. Ouvrez la console du navigateur (F12)" -ForegroundColor White
Write-Host "3. Observez les logs de verrouillage" -ForegroundColor White
Write-Host "4. Le verrou devrait maintenant durer 5 minutes sans conflit!" -ForegroundColor White
Write-Host ""

Write-Host "Appuyez sur une touche pour continuer..." -ForegroundColor Magenta
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
