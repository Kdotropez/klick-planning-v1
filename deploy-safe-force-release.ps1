Write-Host "Deploying safe force release v3.8.0..." -ForegroundColor Green
Write-Host "- Sauvegarde automatique avant force release" -ForegroundColor Yellow
Write-Host "- Demande de confirmation à l'utilisateur distant" -ForegroundColor Yellow
Write-Host "- Délai de 10 secondes pour sauvegarder" -ForegroundColor Yellow
Write-Host "- Indicateur visuel d'urgence" -ForegroundColor Yellow
git add .
git commit -m "feat: add safe force release with auto-save v3.8.0"
git push origin main
Write-Host "Deployment triggered! Check Vercel for build status." -ForegroundColor Yellow
Read-Host "Press Enter to continue"
