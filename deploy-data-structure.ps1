Write-Host "Deploying data structure debug v3.7.5..." -ForegroundColor Green
Write-Host "- Ajout de logs pour diagnostiquer la structure des données" -ForegroundColor Yellow
Write-Host "- Vérification du format des données localStorage" -ForegroundColor Yellow
Write-Host "- Diagnostic du problème de nettoyage automatique" -ForegroundColor Yellow
git add .
git commit -m "feat: add data structure debug logs v3.7.5"
git push origin main
Write-Host "Deployment triggered! Check Vercel for build status." -ForegroundColor Yellow
Read-Host "Press Enter to continue"
