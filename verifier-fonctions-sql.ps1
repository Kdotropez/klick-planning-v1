# Script pour vérifier les fonctions SQL de verrouillage
Write-Host "=== VERIFICATION DES FONCTIONS SQL DE VERROUILLAGE ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. Ouvrez votre projet Supabase dans le navigateur" -ForegroundColor Yellow
Write-Host "2. Allez dans l'onglet 'SQL Editor'" -ForegroundColor Yellow
Write-Host "3. Copiez et collez le contenu du fichier 'check-sql-functions.sql'" -ForegroundColor Yellow
Write-Host "4. Exécutez le script" -ForegroundColor Yellow
Write-Host ""

Write-Host "Ce script va vérifier:" -ForegroundColor Green
Write-Host "- L'existence de la table planning_lock" -ForegroundColor White
Write-Host "- La structure de la table" -ForegroundColor White
Write-Host "- L'existence des fonctions de verrouillage" -ForegroundColor White
Write-Host "- Les politiques RLS" -ForegroundColor White
Write-Host "- Les verrous actuels" -ForegroundColor White
Write-Host "- Un test de la fonction acquire_planning_lock" -ForegroundColor White
Write-Host ""

Write-Host "Si les fonctions n'existent pas ou ont des problèmes, vous devrez:" -ForegroundColor Red
Write-Host "1. Exécuter le script de migration 'supabase/migrations/20250101_planning_lock.sql'" -ForegroundColor White
Write-Host "2. Ou utiliser le script 'simple-lock-system.sql' si disponible" -ForegroundColor White
Write-Host ""

Write-Host "Appuyez sur une touche pour ouvrir le fichier SQL de vérification..." -ForegroundColor Magenta
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Ouvrir le fichier SQL
if (Test-Path "check-sql-functions.sql") {
    Start-Process "check-sql-functions.sql"
} else {
    Write-Host "Fichier check-sql-functions.sql non trouvé!" -ForegroundColor Red
}

Write-Host ""
Write-Host "Une fois la vérification terminée, revenez ici pour les prochaines étapes." -ForegroundColor Cyan
