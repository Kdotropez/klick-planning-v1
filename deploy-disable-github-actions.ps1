Write-Host "Deploying disable GitHub Actions v3.8.1..." -ForegroundColor Green
Write-Host "- Désactivation du workflow GitHub Actions" -ForegroundColor Yellow
Write-Host "- Éviter les conflits avec Vercel" -ForegroundColor Yellow
Write-Host "- Réduction des 85 workflow runs" -ForegroundColor Yellow
git add .
git commit -m "fix: disable GitHub Actions workflow to avoid conflicts with Vercel v3.8.1"
git push origin main
Write-Host "Deployment triggered! Check Vercel for build status." -ForegroundColor Yellow
Read-Host "Press Enter to continue"
