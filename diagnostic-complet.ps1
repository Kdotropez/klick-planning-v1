# Script pour diagnostiquer l'état actuel de la base de données
Write-Host "=== DIAGNOSTIC COMPLET DE LA BASE DE DONNÉES ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "OBJECTIF:" -ForegroundColor Yellow
Write-Host "Vérifier l'état actuel des tables et fonctions avant d'appliquer la correction" -ForegroundColor White
Write-Host ""

Write-Host "ÉTAPES:" -ForegroundColor Green
Write-Host "1. Ouvrez votre projet Supabase dans le navigateur" -ForegroundColor White
Write-Host "2. Allez dans l'onglet 'SQL Editor'" -ForegroundColor White
Write-Host "3. Copiez et collez le contenu du fichier 'diagnostic-tables.sql'" -ForegroundColor White
Write-Host "4. Exécutez le script" -ForegroundColor White
Write-Host ""

Write-Host "Ce diagnostic va vérifier:" -ForegroundColor Green
Write-Host "- Toutes les tables existantes" -ForegroundColor White
Write-Host "- La structure de la table planning_lock" -ForegroundColor White
Write-Host "- Les fonctions de verrouillage existantes" -ForegroundColor White
Write-Host "- Les politiques RLS" -ForegroundColor White
Write-Host "- Les verrous actifs" -ForegroundColor White
Write-Host "- Les extensions installées" -ForegroundColor White
Write-Host ""

Write-Host "Appuyez sur une touche pour ouvrir le fichier de diagnostic..." -ForegroundColor Magenta
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Ouvrir le fichier SQL
if (Test-Path "diagnostic-tables.sql") {
    Start-Process "diagnostic-tables.sql"
} else {
    Write-Host "Fichier diagnostic-tables.sql non trouvé!" -ForegroundColor Red
}

Write-Host ""
Write-Host "Une fois le diagnostic terminé:" -ForegroundColor Cyan
Write-Host "1. Notez les résultats" -ForegroundColor White
Write-Host "2. Revenez ici pour les prochaines étapes" -ForegroundColor White
Write-Host "3. Nous adapterons la correction selon l'état actuel" -ForegroundColor White
Write-Host ""

Write-Host "Appuyez sur une touche pour continuer..." -ForegroundColor Magenta
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
