Write-Host "Deploying version 3.6.3 with Supabase debugging..." -ForegroundColor Green
git add .
git commit -m "fix: correct async/await in handleManualSave v3.6.3"
git push origin main
Write-Host "Deployment triggered! Check Vercel for build status." -ForegroundColor Yellow
Read-Host "Press Enter to continue"
