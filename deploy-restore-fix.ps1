Write-Host "Deploying restore fix v3.7.3..." -ForegroundColor Green
Write-Host "- Correction fonction handleRestoreFromSupabase" -ForegroundColor Yellow
Write-Host "- Chargement depuis localStorage avant navigation" -ForegroundColor Yellow
Write-Host "- Logs de diagnostic pour le débogage" -ForegroundColor Yellow
git add .
git commit -m "fix: correct handleRestoreFromSupabase function v3.7.3"
git push origin main
Write-Host "Deployment triggered! Check Vercel for build status." -ForegroundColor Yellow
Read-Host "Press Enter to continue"
