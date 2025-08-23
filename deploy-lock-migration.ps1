# Script de déploiement de la migration du système de verrou à bail
# Usage: .\deploy-lock-migration.ps1

Write-Host "Deploiement de la migration du systeme de verrou a bail..." -ForegroundColor Cyan

# Vérifier que le fichier de migration existe
$migrationFile = "supabase\migrations\20250101_planning_lock.sql"
if (-not (Test-Path $migrationFile)) {
    Write-Host "Fichier de migration introuvable: $migrationFile" -ForegroundColor Red
    exit 1
}

Write-Host "Fichier de migration trouve: $migrationFile" -ForegroundColor Green

# Lire le contenu de la migration
$migrationContent = Get-Content $migrationFile -Raw
Write-Host "Contenu de la migration lu (${migrationContent.Length} caracteres)" -ForegroundColor Green

Write-Host ""
Write-Host "Pour appliquer cette migration, vous devez:" -ForegroundColor Yellow
Write-Host "1. Aller dans votre dashboard Supabase" -ForegroundColor White
Write-Host "2. Naviguer vers SQL Editor" -ForegroundColor White
Write-Host "3. Copier-coller le contenu du fichier $migrationFile" -ForegroundColor White
Write-Host "4. Exécuter le script SQL" -ForegroundColor White
Write-Host ""
Write-Host "Contenu de la migration:" -ForegroundColor Cyan
Write-Host "----------------------------------------" -ForegroundColor Gray
Write-Host $migrationContent -ForegroundColor White
Write-Host "----------------------------------------" -ForegroundColor Gray

Write-Host ""
Write-Host "Migration prete a etre appliquee!" -ForegroundColor Green
Write-Host "Apres l'application, le nouveau systeme de verrou a bail sera actif." -ForegroundColor Cyan
