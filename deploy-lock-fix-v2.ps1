# Script de deploiement pour les corrections du systeme de verrouillage collaboratif
Write-Host "🚀 Deploiement des corrections du systeme de verrouillage collaboratif..." -ForegroundColor Green

# Ajouter tous les fichiers modifies
Write-Host "📁 Ajout des fichiers modifies..." -ForegroundColor Yellow
git add .

# Commiter les changements
Write-Host "💾 Commit des modifications..." -ForegroundColor Yellow
git commit -m "🔒 Fix: Amelioration du systeme de verrouillage collaboratif

- Ajout des fonctions forceRelease et checkForceReleaseRequest
- Utilisation de Supabase pour les notifications en temps reel
- Correction de la logique d'acquisition de verrou (delete + insert)
- Amelioration de la gestion des erreurs et logging
- Ajout du champ force_release_request dans le schema Supabase
- Suppression du systeme de notification localStorage inefficace
- Correction des problemes de verrouillage simultane"

# Pousser vers le depot distant
Write-Host "🚀 Push vers le depot distant..." -ForegroundColor Yellow
git push origin main

Write-Host "✅ Deploiement termine !" -ForegroundColor Green
Write-Host "📋 Resume des corrections :" -ForegroundColor Cyan
Write-Host "   - Systeme de notification via Supabase au lieu de localStorage" -ForegroundColor White
Write-Host "   - Correction de la logique d'acquisition de verrou" -ForegroundColor White
Write-Host "   - Amelioration de la gestion des erreurs" -ForegroundColor White
Write-Host "   - Ajout du champ force_release_request dans la base de donnees" -ForegroundColor White
