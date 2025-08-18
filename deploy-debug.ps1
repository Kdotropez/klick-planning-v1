Write-Host "Deploying debug logs v3.7.4..." -ForegroundColor Green
Write-Host "- Ajout de logs de débogage détaillés" -ForegroundColor Yellow
Write-Host "- Diagnostic du problème de navigation" -ForegroundColor Yellow
Write-Host "- Vérification des fonctions et données" -ForegroundColor Yellow
git add .
git commit -m "feat: add detailed debug logs v3.7.4"
git push origin main
Write-Host "Deployment triggered! Check Vercel for build status." -ForegroundColor Yellow
Read-Host "Press Enter to continue"
