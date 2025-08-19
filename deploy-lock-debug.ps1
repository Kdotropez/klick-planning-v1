Write-Host "Deploying lock debug v3.8.2..." -ForegroundColor Green
Write-Host "- Logs détaillés pour le système de verrouillage" -ForegroundColor Yellow
Write-Host "- Diagnostic Supabase vs localStorage" -ForegroundColor Yellow
Write-Host "- Vérification de l'initialisation du service" -ForegroundColor Yellow
git add .
git commit -m "feat: add detailed lock system debug logs v3.8.2"
git push origin main
Write-Host "Deployment triggered! Check Vercel for build status." -ForegroundColor Yellow
Read-Host "Press Enter to continue"
