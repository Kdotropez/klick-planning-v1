Write-Host "Deploying data structure fix v3.6.9..." -ForegroundColor Green
Write-Host "- Correction structure des données Supabase" -ForegroundColor Yellow
Write-Host "- Sauvegarde du fichier complet en une ligne" -ForegroundColor Yellow
Write-Host "- Restauration de la structure correcte" -ForegroundColor Yellow
git add .
git commit -m "fix: correct Supabase data structure for complete file v3.6.9"
git push origin main
Write-Host "Deployment triggered! Check Vercel for build status." -ForegroundColor Yellow
Read-Host "Press Enter to continue"
