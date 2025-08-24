# Script pour appliquer manuellement la migration de verrouillage sur Supabase
# Instructions pour l'utilisateur

Write-Host "=== MIGRATION MANUELLE SUPABASE - SYSTEME DE VERROU ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "ETAPE 1: Ouvrir Supabase Dashboard" -ForegroundColor Yellow
Write-Host "1. Allez sur https://supabase.com/dashboard" -ForegroundColor White
Write-Host "2. Connectez-vous et ouvrez votre projet" -ForegroundColor White
Write-Host "3. Cliquez sur 'SQL Editor' dans le menu de gauche" -ForegroundColor White
Write-Host ""
Write-Host "ETAPE 2: Copier le contenu SQL" -ForegroundColor Yellow
Write-Host "Le contenu SQL sera affiché ci-dessous." -ForegroundColor White
Write-Host "Copiez-le entièrement et collez-le dans l'éditeur SQL de Supabase." -ForegroundColor White
Write-Host ""
Write-Host "ETAPE 3: Exécuter la migration" -ForegroundColor Yellow
Write-Host "1. Cliquez sur 'Run' dans l'éditeur SQL" -ForegroundColor White
Write-Host "2. Vérifiez qu'il n'y a pas d'erreurs" -ForegroundColor White
Write-Host "3. Le système de verrouillage sera alors actif" -ForegroundColor White
Write-Host ""
Write-Host "=== CONTENU SQL A COPIER ===" -ForegroundColor Green
Write-Host ""

# Afficher le contenu du fichier SQL
$sqlContent = Get-Content "supabase/migrations/20250101_planning_lock.sql" -Raw
Write-Host $sqlContent -ForegroundColor White

Write-Host ""
Write-Host "=== FIN DU CONTENU SQL ===" -ForegroundColor Green
Write-Host ""
Write-Host "Une fois la migration appliquée, le système de verrouillage fonctionnera correctement." -ForegroundColor Cyan
Write-Host "Vous pourrez alors utiliser les boutons 'Relâcher la main' et 'Déverrouillage d'urgence'." -ForegroundColor Cyan
Write-Host ""
Write-Host "Appuyez sur une touche pour fermer ce script..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
