# Script de deploiement avec incrementation automatique de la version
Write-Host "🚀 Deploiement avec incrementation de version..." -ForegroundColor Green

# Lire la version actuelle
$packageJson = Get-Content "package.json" | ConvertFrom-Json
$currentVersion = $packageJson.version
Write-Host "📋 Version actuelle: $currentVersion" -ForegroundColor Yellow

# Incrementer la version (patch)
$versionParts = $currentVersion.Split('.')
$newPatch = [int]$versionParts[2] + 1
$newVersion = "$($versionParts[0]).$($versionParts[1]).$newPatch"

Write-Host "📈 Nouvelle version: $newVersion" -ForegroundColor Yellow

# Mettre a jour package.json
$packageJson.version = $newVersion
$packageJson | ConvertTo-Json -Depth 10 | Set-Content "package.json"

# Ajouter tous les fichiers modifies
Write-Host "📁 Ajout des fichiers modifies..." -ForegroundColor Yellow
git add .

# Commiter les changements
Write-Host "💾 Commit des modifications..." -ForegroundColor Yellow
git commit -m "🔧 Fix: Corrections securite et version $newVersion

- Correction: PC sans la main ne peut plus sauvegarder sur Supabase
- Correction: Sauvegarde automatique apres modification seulement si on a la main
- Incrementation automatique de la version: $currentVersion -> $newVersion
- Amelioration de la securite du systeme de verrouillage"

# Pousser vers le depot distant
Write-Host "🚀 Push vers le depot distant..." -ForegroundColor Yellow
git push origin main

Write-Host "✅ Deploiement termine !" -ForegroundColor Green
Write-Host "📋 Resume des corrections :" -ForegroundColor Cyan
Write-Host "   - Version incremente: $currentVersion -> $newVersion" -ForegroundColor White
Write-Host "   - Securite: PC sans main ne peut plus sauvegarder Supabase" -ForegroundColor White
Write-Host "   - Sauvegarde automatique securisee" -ForegroundColor White
