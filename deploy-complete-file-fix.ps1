Write-Host "Deploying complete file fix v3.7.2..." -ForegroundColor Green
Write-Host "- Correction gestion du fichier complet" -ForegroundColor Yellow
Write-Host "- Bouton adaptatif selon la sélection" -ForegroundColor Yellow
Write-Host "- Affichage clair du fichier complet" -ForegroundColor Yellow
git add .
git commit -m "fix: correct complete file handling v3.7.2"
git push origin main
Write-Host "Deployment triggered! Check Vercel for build status." -ForegroundColor Yellow
Read-Host "Press Enter to continue"
