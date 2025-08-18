Write-Host "Deploying navigation fix v3.6.7..." -ForegroundColor Green
Write-Host "- Correction navigation après restauration Supabase" -ForegroundColor Yellow
Write-Host "- Ajout de logs pour diagnostiquer les boutiques" -ForegroundColor Yellow
Write-Host "- Utilisation des props de navigation au lieu de reload" -ForegroundColor Yellow
git add .
git commit -m "fix: correct navigation after Supabase restore v3.6.7"
git push origin main
Write-Host "Deployment triggered! Check Vercel for build status." -ForegroundColor Yellow
Read-Host "Press Enter to continue"
