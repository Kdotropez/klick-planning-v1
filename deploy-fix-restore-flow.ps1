Write-Host "Deploying fix restore flow v3.8.3..." -ForegroundColor Green
Write-Host "- Correction du flux de restauration Supabase" -ForegroundColor Yellow
Write-Host "- Passage par la sélection de semaine" -ForegroundColor Yellow
Write-Host "- Chargement correct des cliques" -ForegroundColor Yellow
git add .
git commit -m "fix: correct restore flow to go through week selection v3.8.3"
git push origin main
Write-Host "Deployment triggered! Check Vercel for build status." -ForegroundColor Yellow
Read-Host "Press Enter to continue"
