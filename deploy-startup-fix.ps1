Write-Host "Deploying startup fix v3.7.1..." -ForegroundColor Green
Write-Host "- Correction démarrage sur boutique depuis Supabase" -ForegroundColor Yellow
Write-Host "- Chargement automatique depuis localStorage" -ForegroundColor Yellow
Write-Host "- Logs de diagnostic pour le débogage" -ForegroundColor Yellow
git add .
git commit -m "fix: correct startup with shop from Supabase v3.7.1"
git push origin main
Write-Host "Deployment triggered! Check Vercel for build status." -ForegroundColor Yellow
Read-Host "Press Enter to continue"
