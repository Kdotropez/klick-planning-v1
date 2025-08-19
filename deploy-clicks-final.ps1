Write-Host "Deploying clicks final debug v3.7.7..." -ForegroundColor Green
Write-Host "- Logs détaillés pour getWeekPlanning" -ForegroundColor Yellow
Write-Host "- Diagnostic de la structure planningData" -ForegroundColor Yellow
Write-Host "- Vérification des données de planning après restauration" -ForegroundColor Yellow
git add .
git commit -m "feat: add detailed getWeekPlanning debug logs v3.7.7"
git push origin main
Write-Host "Deployment triggered! Check Vercel for build status." -ForegroundColor Yellow
Read-Host "Press Enter to continue"
