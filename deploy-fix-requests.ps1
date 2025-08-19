# Script de deploiement pour les corrections des demandes de main
Write-Host "🚀 Deploiement des corrections des demandes de main..." -ForegroundColor Green

# Ajouter tous les fichiers modifies
Write-Host "📁 Ajout des fichiers modifies..." -ForegroundColor Yellow
git add .

# Commiter les changements
Write-Host "💾 Commit des modifications..." -ForegroundColor Yellow
git commit -m "🔧 Fix: Corrections des demandes de main et force release

- Correction de la logique requestMain pour notifier l'utilisateur qui a la main
- Amelioration de checkMainRequest avec plus de logging
- Augmentation du delai pour force release (10s au lieu de 5s)
- Ajout de logging pour deboguer les demandes de main
- Correction du flux de notification entre utilisateurs"

# Pousser vers le depot distant
Write-Host "🚀 Push vers le depot distant..." -ForegroundColor Yellow
git push origin main

Write-Host "✅ Deploiement termine !" -ForegroundColor Green
Write-Host "📋 Resume des corrections :" -ForegroundColor Cyan
Write-Host "   - Correction de la notification des demandes de main" -ForegroundColor White
Write-Host "   - Amelioration du delai pour force release" -ForegroundColor White
Write-Host "   - Ajout de logging pour le debug" -ForegroundColor White
