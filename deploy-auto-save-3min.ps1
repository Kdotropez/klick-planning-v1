# Script de deploiement pour la sauvegarde automatique toutes les 3 minutes
Write-Host "🚀 Deploiement de la sauvegarde automatique toutes les 3 minutes..." -ForegroundColor Green

# Ajouter tous les fichiers modifies
Write-Host "📁 Ajout des fichiers modifies..." -ForegroundColor Yellow
git add .

# Commiter les changements
Write-Host "💾 Commit des modifications..." -ForegroundColor Yellow
git commit -m "💾 Feature: Sauvegarde automatique toutes les 3 minutes

- Ajout de la sauvegarde automatique toutes les 3 minutes pour le PC qui a la main
- Sauvegarde locale + Supabase automatique
- Demarrage automatique quand on obtient la main
- Arret automatique quand on perd la main
- Messages d'etat pour informer l'utilisateur
- Gestion des erreurs de sauvegarde automatique"

# Pousser vers le depot distant
Write-Host "🚀 Push vers le depot distant..." -ForegroundColor Yellow
git push origin main

Write-Host "✅ Deploiement termine !" -ForegroundColor Green
Write-Host "📋 Resume de la fonctionnalite :" -ForegroundColor Cyan
Write-Host "   - Sauvegarde automatique toutes les 3 minutes" -ForegroundColor White
Write-Host "   - Sauvegarde locale + Supabase" -ForegroundColor White
Write-Host "   - Demarrage/arret automatique selon la possession de la main" -ForegroundColor White
