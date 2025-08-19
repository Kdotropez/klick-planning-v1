Write-Host "Deploying force release feature v3.7.9..." -ForegroundColor Green
Write-Host "- Ajout du bouton 'Forcer la libération'" -ForegroundColor Yellow
Write-Host "- Notification à l'utilisateur distant" -ForegroundColor Yellow
Write-Host "- Indicateurs visuels améliorés" -ForegroundColor Yellow
Write-Host "- Gestion des verrous oubliés" -ForegroundColor Yellow
git add .
git commit -m "feat: add force release and notifications v3.7.9"
git push origin main
Write-Host "Deployment triggered! Check Vercel for build status." -ForegroundColor Yellow
Read-Host "Press Enter to continue"
