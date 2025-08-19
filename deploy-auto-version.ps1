# Script de deploiement avec incrementation automatique de version
Write-Host "🚀 Deploiement avec incrementation automatique de version..." -ForegroundColor Green

# Lire la version actuelle depuis package.json
$packageJson = Get-Content "package.json" | ConvertFrom-Json
$currentVersion = $packageJson.version
Write-Host "📋 Version actuelle: $currentVersion" -ForegroundColor Yellow

# Incrementer automatiquement la version (patch)
$versionParts = $currentVersion -split '\.'
$major = [int]$versionParts[0]
$minor = [int]$versionParts[1]
$patch = [int]$versionParts[2] + 1
$newVersion = "$major.$minor.$patch"

Write-Host "🔄 Incrementation automatique: $currentVersion -> $newVersion" -ForegroundColor Green

# Mettre a jour package.json
Write-Host "📝 Mise a jour package.json..." -ForegroundColor Yellow
$packageJson.version = $newVersion
$packageJson | ConvertTo-Json -Depth 10 | Set-Content "package.json"

# Mettre a jour version.json
Write-Host "📝 Mise a jour version.json..." -ForegroundColor Yellow
$versionInfo = @{
    version = $newVersion
    buildDate = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss.000Z")
    changelog = @(
        "Corrections du systeme de verrouillage collaboratif",
        "Reduction du delai de verrouillage automatique (5min -> 2min)",
        "Amelioration de la verification periodique (10s -> 5s)",
        "Correction du double verrouillage lors du force release",
        "Amelioration du rechargement des donnees apres force release",
        "Ajout de logging pour deboguer les demandes de main",
        "Attente de 3 secondes pour le rechargement des donnees",
        "Verification de l'existence du verrou avant suppression",
        "Systeme de verification automatique de version",
        "Correction de la demande de main avec notification",
        "Reduction du delai de force release (30s -> 10s)",
        "Amelioration du rechargement automatique des donnees"
    )
    features = @(
        "Systeme de verrouillage collaboratif en temps reel",
        "Sauvegarde automatique des modifications",
        "Gestion des conflits d'acces",
        "Notifications de demande de main",
        "Force release en cas de blocage",
        "Verification automatique de version",
        "Incrementation automatique de version"
    )
}

$versionInfo | ConvertTo-Json -Depth 10 | Set-Content "public/version.json"

# Ajouter tous les fichiers modifies
Write-Host "📁 Ajout des fichiers modifies..." -ForegroundColor Yellow
git add .

# Commiter les changements
$commitMessage = "🔧 Fix: Corrections du systeme de verrouillage collaboratif

- Correction de la demande de main avec notification utilisateur
- Reduction du delai de force release (30s -> 10s)
- Amelioration du rechargement automatique des donnees
- Remise de la version dans le copyright (comme avant)
- Incrementation automatique de version lors du deploiement
- Verification plus frequente des demandes de main (3s au lieu de 5s)
- Notification utilisateur pour les demandes de main
- Délai de rechargement des donnees apres reprise de main (2s)

Version: $newVersion"

Write-Host "💾 Commit des modifications..." -ForegroundColor Yellow
git commit -m $commitMessage

# Pousser vers le depot distant
Write-Host "🚀 Push vers le depot distant..." -ForegroundColor Yellow
git push origin main

Write-Host "✅ Deploiement termine !" -ForegroundColor Green
Write-Host "📋 Resume du deploiement :" -ForegroundColor Cyan
Write-Host "   - Version incrementee: $currentVersion -> $newVersion" -ForegroundColor White
Write-Host "   - Version affichee dans le copyright (comme avant)" -ForegroundColor White
Write-Host "   - Correction de la demande de main" -ForegroundColor White
Write-Host "   - Reduction du delai de force release" -ForegroundColor White
Write-Host "   - Amelioration du rechargement des donnees" -ForegroundColor White
