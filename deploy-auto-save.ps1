# Script de deploiement pour la sauvegarde automatique lors des demandes de main
Write-Host "🚀 Deploiement de la sauvegarde automatique lors des demandes de main..." -ForegroundColor Green

# Ajouter tous les fichiers modifies
Write-Host "📁 Ajout des fichiers modifies..." -ForegroundColor Yellow
git add .

# Commiter les changements
Write-Host "💾 Commit des modifications..." -ForegroundColor Yellow
git commit -m "🤝 Feature: Sauvegarde automatique lors des demandes de main

- Ajout des fonctions requestMain et checkMainRequest
- Sauvegarde automatique des modifications quand quelqu'un demande la main
- Notification en temps reel via Supabase pour les demandes de main
- Ajout du champ main_request dans le schema Supabase
- Flux complet: PC1 modifie -> PC2 demande main -> PC1 sauvegarde auto -> PC2 obtient main avec modifs
- Timeout de 30 secondes pour les demandes de main
- Vérification périodique toutes les 2 secondes"

# Pousser vers le depot distant
Write-Host "🚀 Push vers le depot distant..." -ForegroundColor Yellow
git push origin main

Write-Host "✅ Deploiement termine !" -ForegroundColor Green
Write-Host "📋 Resume des nouvelles fonctionnalites :" -ForegroundColor Cyan
Write-Host "   - Sauvegarde automatique quand quelqu'un demande la main" -ForegroundColor White
Write-Host "   - Notifications en temps reel via Supabase" -ForegroundColor White
Write-Host "   - Flux complet de transfert de main avec sauvegarde" -ForegroundColor White
Write-Host "   - Timeout et vérification périodique" -ForegroundColor White
