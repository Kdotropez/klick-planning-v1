const fs = require('fs');
const path = require('path');

// Lire la version depuis package.json
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const versionJsonPath = path.join(__dirname, '..', 'public', 'version.json');

try {
  // Lire package.json
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const newVersion = packageJson.version;
  
  console.log(`🔄 Mise à jour de la version vers: ${newVersion}`);
  
  // Lire version.json existant
  const versionJson = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'));
  
  // Mettre à jour la version
  versionJson.version = newVersion;
  versionJson.lastUpdate = new Date().toISOString().split('T')[0];
  
  // Ajouter la nouvelle version au changelog si elle n'existe pas déjà
  const existingVersion = versionJson.changelog.find(item => item.version === newVersion);
  if (!existingVersion) {
    versionJson.changelog.unshift({
      version: newVersion,
      date: new Date().toISOString().split('T')[0],
      changes: [
        "🔄 Mise à jour automatique de la version",
        "📝 Changelog à compléter manuellement"
      ]
    });
  }
  
  // Écrire le fichier mis à jour
  fs.writeFileSync(versionJsonPath, JSON.stringify(versionJson, null, 2));
  
  console.log(`✅ Fichier version.json mis à jour vers ${newVersion}`);
  console.log(`📅 Date de mise à jour: ${versionJson.lastUpdate}`);
  
} catch (error) {
  console.error('❌ Erreur lors de la mise à jour du fichier version.json:', error);
  process.exit(1);
}
