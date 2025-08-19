Write-Host "Deploying clicks debug v3.7.6..." -ForegroundColor Green
Write-Host "- Ajout de logs pour diagnostiquer les cliques" -ForegroundColor Yellow
Write-Host "- Vérification de la sauvegarde/restauration des données planning" -ForegroundColor Yellow
Write-Host "- Diagnostic du problème des créneaux horaires vides" -ForegroundColor Yellow
git add .
git commit -m "feat: add clicks debug logs v3.7.6"
git push origin main
Write-Host "Deployment triggered! Check Vercel for build status." -ForegroundColor Yellow
Read-Host "Press Enter to continue"
