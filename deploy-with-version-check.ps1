# Script de deploiement avec verification de version automatique
Write-Host "🚀 Deploiement avec verification de version automatique..." -ForegroundColor Green

# Lire la version actuelle
$packageJson = Get-Content "package.json" | ConvertFrom-Json
$currentVersion = $packageJson.version
Write-Host "📋 Version actuelle: $currentVersion" -ForegroundColor Yellow

# Demander le type de mise a jour
Write-Host "`n🔧 Type de mise a jour:" -ForegroundColor Cyan
Write-Host "1. Patch (bug fixes) - $($currentVersion -replace '(\d+)\.(\d+)\.(\d+)', '$1.$2.' + ([int]$3 + 1))" -ForegroundColor White
Write-Host "2. Minor (nouvelles fonctionnalites) - $($currentVersion -replace '(\d+)\.(\d+)\.(\d+)', '$1.' + ([int]$2 + 1) + '.0')" -ForegroundColor White
Write-Host "3. Major (changements majeurs) - $($currentVersion -replace '(\d+)\.(\d+)\.(\d+)', ([int]$1 + 1) + '.0.0')" -ForegroundColor White
Write-Host "4. Pas de changement de version" -ForegroundColor White

$choice = Read-Host "`nVotre choix (1-4)"

$newVersion = $currentVersion

switch ($choice) {
    "1" { 
        $newVersion = $currentVersion -replace '(\d+)\.(\d+)\.(\d+)', '$1.$2.' + ([int]$3 + 1)
        Write-Host "🔄 Mise a jour Patch: $currentVersion -> $newVersion" -ForegroundColor Green
    }
    "2" { 
        $newVersion = $currentVersion -replace '(\d+)\.(\d+)\.(\d+)', '$1.' + ([int]$2 + 1) + '.0'
        Write-Host "🔄 Mise a jour Minor: $currentVersion -> $newVersion" -ForegroundColor Green
    }
    "3" { 
        $newVersion = $currentVersion -replace '(\d+)\.(\d+)\.(\d+)', ([int]$1 + 1) + '.0.0'
        Write-Host "🔄 Mise a jour Major: $currentVersion -> $newVersion" -ForegroundColor Green
    }
    "4" { 
        Write-Host "✅ Pas de changement de version" -ForegroundColor Yellow
    }
    default { 
        Write-Host "❌ Choix invalide, pas de changement de version" -ForegroundColor Red
    }
}

# Mettre a jour package.json si necessaire
if ($newVersion -ne $currentVersion) {
    Write-Host "📝 Mise a jour package.json..." -ForegroundColor Yellow
    $packageJson.version = $newVersion
    $packageJson | ConvertTo-Json -Depth 10 | Set-Content "package.json"
}

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
        "Systeme de verification automatique de version"
    )
    features = @(
        "Systeme de verrouillage collaboratif en temps reel",
        "Sauvegarde automatique des modifications",
        "Gestion des conflits d'acces",
        "Notifications de demande de main",
        "Force release en cas de blocage",
        "Verification automatique de version"
    )
}

$versionInfo | ConvertTo-Json -Depth 10 | Set-Content "public/version.json"

# Ajouter tous les fichiers modifies
Write-Host "📁 Ajout des fichiers modifies..." -ForegroundColor Yellow
git add .

# Commiter les changements
$commitMessage = "🆕 Feat: Systeme de verification automatique de version

- Ajout du service VersionChecker pour verification automatique
- Notification de mise a jour avec interface utilisateur
- Affichage de la version dans l'interface
- Verification toutes les 24 heures
- Fichier version.json pour la gestion des versions
- Composant VersionInfo pour l'affichage des informations
- Integration dans le Header du planning

Version: $newVersion"

Write-Host "💾 Commit des modifications..." -ForegroundColor Yellow
git commit -m $commitMessage

# Pousser vers le depot distant
Write-Host "🚀 Push vers le depot distant..." -ForegroundColor Yellow
git push origin main

Write-Host "✅ Deploiement termine !" -ForegroundColor Green
Write-Host "📋 Resume du deploiement :" -ForegroundColor Cyan
Write-Host "   - Version: $newVersion" -ForegroundColor White
Write-Host "   - Verification automatique de version" -ForegroundColor White
Write-Host "   - Notification de mise a jour" -ForegroundColor White
Write-Host "   - Affichage de la version dans l'interface" -ForegroundColor White
Write-Host "   - Fichier version.json mis a jour" -ForegroundColor White
