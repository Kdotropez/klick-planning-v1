Write-Host "Deploying Supabase cleanup v3.7.0..." -ForegroundColor Green
Write-Host "- Ajout fonction de nettoyage Supabase" -ForegroundColor Yellow
Write-Host "- Bouton 'Nettoyer Supabase' dans le menu Outils" -ForegroundColor Yellow
Write-Host "- Suppression de toutes les données pour corriger la structure" -ForegroundColor Yellow
git add .
git commit -m "feat: add Supabase cleanup function v3.7.0"
git push origin main
Write-Host "Deployment triggered! Check Vercel for build status." -ForegroundColor Yellow
Read-Host "Press Enter to continue"
