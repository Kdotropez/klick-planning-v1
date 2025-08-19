# Script de deploiement pour les corrections du systeme de verrouillage V2
Write-Host "🚀 Deploiement des corrections du systeme de verrouillage V2..." -ForegroundColor Green

# Incrementer la version
$packageJson = Get-Content "package.json" | ConvertFrom-Json
$currentVersion = $packageJson.version
$versionParts = $currentVersion -split '\.'
$major = [int]$versionParts[0]
$minor = [int]$versionParts[1]
$patch = [int]$versionParts[2] + 1
$newVersion = "$major.$minor.$patch"

Write-Host "🔄 Incrementation automatique: $currentVersion -> $newVersion" -ForegroundColor Green

# Mettre a jour package.json
$packageJson.version = $newVersion
$packageJson | ConvertTo-Json -Depth 10 | Set-Content "package.json"

# Mettre a jour version.json
$versionInfo = @{
    version = $newVersion
    buildDate = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss.000Z")
    changelog = @(
        "Corrections du systeme de verrouillage collaboratif",
        "Reduction du delai de verrouillage automatique (5min -> 2min)",
        "Amelioration de la verification periodique (10s -> 3s)",
        "Correction du double verrouillage lors du force release",
        "Amelioration du rechargement des donnees apres force release",
        "Ajout de logging pour deboguer les demandes de main",
        "Attente de 5 secondes pour le rechargement des donnees",
        "Verification de l'existence du verrou avant suppression",
        "Systeme de verification automatique de version",
        "Correction de la demande de main avec notification",
        "Reduction du delai de force release (30s -> 10s)",
        "Amelioration du rechargement automatique des donnees",
        "Version remise dans le copyright (comme avant)",
        "Incrementation automatique de version lors du deploiement",
        "Verification plus frequente des demandes de main (3s au lieu de 10s)",
        "Notification utilisateur pour les demandes de main",
        "Delai de rechargement des donnees apres reprise de main (2s)",
        "Amelioration du logging pour debugger les demandes de main",
        "Augmentation du delai de rechargement apres force release (3s -> 5s)"
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
$commitMessage = "Fix: Corrections du systeme de verrouillage collaboratif V2

- Verification plus frequente des demandes de main (10s -> 3s)
- Amelioration du logging pour debugger les demandes de main
- Augmentation du delai de rechargement apres force release (3s -> 5s)
- Ajout de logs detailles pour le rechargement des donnees
- Correction de la demande de main avec notification utilisateur
- Reduction du delai de force release (30s -> 10s)
- Amelioration du rechargement automatique des donnees
- Version remise dans le copyright (comme avant)
- Incrementation automatique de version lors du deploiement
- Verification plus frequente des demandes de main (3s au lieu de 10s)
- Notification utilisateur pour les demandes de main
- Delai de rechargement des donnees apres reprise de main (2s)

Version: $newVersion"

Write-Host "💾 Commit des modifications..." -ForegroundColor Yellow
git commit -m $commitMessage

# Pousser vers le depot distant
Write-Host "🚀 Push vers le depot distant..." -ForegroundColor Yellow
git push origin main

Write-Host "✅ Deploiement termine !" -ForegroundColor Green
Write-Host "📋 Resume des corrections :" -ForegroundColor Cyan
Write-Host "   - Version incrementee: $currentVersion -> $newVersion" -ForegroundColor White
Write-Host "   - Verification plus frequente des demandes de main (3s)" -ForegroundColor White
Write-Host "   - Amelioration du logging pour debugger" -ForegroundColor White
Write-Host "   - Augmentation du delai de rechargement (5s)" -ForegroundColor White
Write-Host "   - Correction de la demande de main" -ForegroundColor White
