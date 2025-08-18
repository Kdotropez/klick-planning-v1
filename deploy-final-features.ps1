Write-Host "Deploying final features v3.6.5..." -ForegroundColor Green
Write-Host "- Rotation des sauvegardes locales (2 max)" -ForegroundColor Yellow
Write-Host "- Bouton Restaurer depuis Supabase" -ForegroundColor Yellow
Write-Host "- Fonctions de gestion des sauvegardes" -ForegroundColor Yellow
git add .
git commit -m "feat: add backup rotation and Supabase restore button v3.6.5"
git push origin main
Write-Host "Deployment triggered! Check Vercel for build status." -ForegroundColor Yellow
Read-Host "Press Enter to continue"
