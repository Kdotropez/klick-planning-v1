Write-Host "Deploying direct planning navigation v3.6.8..." -ForegroundColor Green
Write-Host "- Correction navigation après restauration Supabase" -ForegroundColor Yellow
Write-Host "- Aller directement au planning au lieu de création de boutique" -ForegroundColor Yellow
Write-Host "- Nouvelle fonction handleRestoreFromSupabase" -ForegroundColor Yellow
git add .
git commit -m "fix: go directly to planning after Supabase restore v3.6.8"
git push origin main
Write-Host "Deployment triggered! Check Vercel for build status." -ForegroundColor Yellow
Read-Host "Press Enter to continue"
