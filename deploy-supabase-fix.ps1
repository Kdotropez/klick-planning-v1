Write-Host "Deploying Supabase fix v3.6.4..." -ForegroundColor Green
git add .
git commit -m "fix: correct Supabase upsert logic and add verification v3.6.4"
git push origin main
Write-Host "Deployment triggered! Check Vercel for build status." -ForegroundColor Yellow
Read-Host "Press Enter to continue"
