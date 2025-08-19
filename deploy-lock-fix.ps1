Write-Host "Deploying lock system fix v3.7.8..." -ForegroundColor Green
Write-Host "- Correction du système de verrouillage collaboratif" -ForegroundColor Yellow
Write-Host "- Vérification périodique du verrou (10s)" -ForegroundColor Yellow
Write-Host "- Heartbeat plus fréquent (30s)" -ForegroundColor Yellow
Write-Host "- Logs détaillés pour le diagnostic" -ForegroundColor Yellow
git add .
git commit -m "fix: improve collaborative locking system v3.7.8"
git push origin main
Write-Host "Deployment triggered! Check Vercel for build status." -ForegroundColor Yellow
Read-Host "Press Enter to continue"
