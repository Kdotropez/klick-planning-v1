Write-Host "Deploying complete file save v3.6.6..." -ForegroundColor Green
Write-Host "- Sauvegarde du fichier complet (toutes boutiques/semaines)" -ForegroundColor Yellow
Write-Host "- Restauration du fichier complet depuis Supabase" -ForegroundColor Yellow
Write-Host "- Suppression et réinsertion complète des données" -ForegroundColor Yellow
git add .
git commit -m "feat: save and restore complete planning file v3.6.6"
git push origin main
Write-Host "Deployment triggered! Check Vercel for build status." -ForegroundColor Yellow
Read-Host "Press Enter to continue"
