Write-Host "Ouverture des diagrammes visuels du système de verrouillage..." -ForegroundColor Green
Write-Host ""

# Obtenir le chemin absolu du fichier HTML
$htmlPath = Join-Path $PSScriptRoot "diagrammes_verrouillage.html"

# Vérifier que le fichier existe
if (Test-Path $htmlPath) {
    Write-Host "✅ Fichier trouvé : $htmlPath" -ForegroundColor Green
    
    # Ouvrir le fichier dans le navigateur par défaut
    Start-Process $htmlPath
    
    Write-Host ""
    Write-Host "🎨 Diagrammes visuels ouverts dans le navigateur !" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "📋 Caractéristiques des nouveaux diagrammes :" -ForegroundColor Cyan
    Write-Host "   • Diagrammes visuels avec flèches animées" -ForegroundColor White
    Write-Host "   • Nœuds colorés pour PC1, PC2 et Supabase" -ForegroundColor White
    Write-Host "   • Étapes détaillées avec numérotation" -ForegroundColor White
    Write-Host "   • Indicateurs de statut colorés" -ForegroundColor White
    Write-Host "   • Texte explicatif pour chaque étape" -ForegroundColor White
    Write-Host ""
    Write-Host "📄 Pour convertir en PDF :" -ForegroundColor Cyan
    Write-Host "   1. Appuyez sur Ctrl+P dans le navigateur" -ForegroundColor White
    Write-Host "   2. Choisissez 'Enregistrer en PDF'" -ForegroundColor White
    Write-Host "   3. Sélectionnez l'emplacement de sauvegarde" -ForegroundColor White
    Write-Host ""
    Write-Host "💡 Conseil : Utilisez l'orientation 'Paysage' pour une meilleure lisibilité" -ForegroundColor Magenta
} else {
    Write-Host "❌ Erreur : Fichier diagrammes_verrouillage.html non trouvé" -ForegroundColor Red
    Write-Host "Vérifiez que le script generate_diagrams.js a été exécuté avec succès." -ForegroundColor Yellow
}

Write-Host ""
Read-Host "Appuyez sur Entrée pour fermer"

