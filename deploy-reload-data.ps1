# Script de deploiement pour le rechargement automatique des données
Write-Host "🚀 Deploiement du rechargement automatique des donnees..." -ForegroundColor Green

# Ajouter tous les fichiers modifies
Write-Host "📁 Ajout des fichiers modifies..." -ForegroundColor Yellow
git add .

# Commiter les changements
Write-Host "💾 Commit des modifications..." -ForegroundColor Yellow
git commit -m "🔄 Fix: Rechargement automatique des donnees lors de l'obtention de la main

- Ajout du rechargement automatique depuis Supabase quand on obtient la main
- Rechargement pour 'Demander la main' et 'Forcer la liberation'
- Mise a jour du planning avec les modifications de l'autre utilisateur
- Messages d'etat pour indiquer le rechargement en cours
- Import de loadCompletePlanningData pour le rechargement"

# Pousser vers le depot distant
Write-Host "🚀 Push vers le depot distant..." -ForegroundColor Yellow
git push origin main

Write-Host "✅ Deploiement termine !" -ForegroundColor Green
Write-Host "📋 Resume de la correction :" -ForegroundColor Cyan
Write-Host "   - Rechargement automatique des donnees quand on obtient la main" -ForegroundColor White
Write-Host "   - Mise a jour du planning avec les modifications de l'autre PC" -ForegroundColor White
Write-Host "   - Messages d'etat pour indiquer le rechargement" -ForegroundColor White
