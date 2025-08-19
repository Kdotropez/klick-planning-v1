// Service de vérification de version automatique
// Vérifie si l'application est à jour au démarrage

const VERSION_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 heures
const VERSION_FILE_URL = '/version.json';

export class VersionChecker {
  constructor() {
    this.currentVersion = null;
    this.latestVersion = null;
    this.lastCheck = null;
    this.isChecking = false;
  }

  // Initialiser le vérificateur de version
  async init() {
    try {
      // Récupérer la version actuelle depuis package.json
      this.currentVersion = await this.getCurrentVersion();
      console.log('🔍 Version actuelle:', this.currentVersion);
      
      // Vérifier si on doit faire une vérification
      if (this.shouldCheckVersion()) {
        await this.checkForUpdates();
      }
    } catch (error) {
      console.error('❌ Erreur initialisation VersionChecker:', error);
    }
  }

  // Récupérer la version actuelle
  async getCurrentVersion() {
    try {
      // Utiliser le fichier version.json local
      const response = await fetch('/version.json');
      if (response.ok) {
        const versionInfo = await response.json();
        return versionInfo.version;
      }
      return '3.8.4'; // Version par défaut
    } catch (error) {
      console.error('❌ Erreur récupération version actuelle:', error);
      return '3.8.4'; // Version par défaut
    }
  }

  // Vérifier si on doit faire une vérification de version
  shouldCheckVersion() {
    const lastCheck = localStorage.getItem('lastVersionCheck');
    if (!lastCheck) return true;
    
    const timeSinceLastCheck = Date.now() - parseInt(lastCheck);
    return timeSinceLastCheck > VERSION_CHECK_INTERVAL;
  }

  // Vérifier les mises à jour disponibles
  async checkForUpdates() {
    if (this.isChecking) return;
    
    this.isChecking = true;
    console.log('🔍 Vérification des mises à jour...');
    
    try {
      // Récupérer la version la plus récente depuis GitHub
      const latestVersion = await this.getLatestVersion();
      this.latestVersion = latestVersion;
      
      console.log('🔍 Version la plus récente:', latestVersion);
      
      // Comparer les versions
      if (this.isUpdateAvailable(this.currentVersion, latestVersion)) {
        console.log('🔄 Mise à jour disponible:', this.currentVersion, '->', latestVersion);
        this.showUpdateNotification();
      } else {
        console.log('✅ Application à jour');
      }
      
      // Sauvegarder la date de vérification
      localStorage.setItem('lastVersionCheck', Date.now().toString());
      
    } catch (error) {
      console.error('❌ Erreur vérification mises à jour:', error);
    } finally {
      this.isChecking = false;
    }
  }

  // Récupérer la version la plus récente depuis GitHub
  async getLatestVersion() {
    try {
      const response = await fetch(VERSION_FILE_URL, {
        cache: 'no-cache', // Éviter le cache
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (response.ok) {
        const packageJson = await response.json();
        return packageJson.version;
      }
      
      throw new Error('Impossible de récupérer la version distante');
    } catch (error) {
      console.error('❌ Erreur récupération version distante:', error);
      // Fallback: utiliser la version locale
      return this.currentVersion;
    }
  }

  // Comparer les versions (format semver: x.y.z)
  isUpdateAvailable(currentVersion, latestVersion) {
    if (!currentVersion || !latestVersion) return false;
    
    const current = this.parseVersion(currentVersion);
    const latest = this.parseVersion(latestVersion);
    
    // Comparer les versions
    for (let i = 0; i < 3; i++) {
      if (latest[i] > current[i]) return true;
      if (latest[i] < current[i]) return false;
    }
    
    return false; // Versions identiques
  }

  // Parser une version semver
  parseVersion(version) {
    return version.split('.').map(v => parseInt(v) || 0);
  }

  // Afficher la notification de mise à jour
  showUpdateNotification() {
    const notification = document.createElement('div');
    notification.id = 'version-update-notification';
    notification.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 20px;
        border-radius: 10px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        z-index: 10000;
        max-width: 350px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        animation: slideIn 0.5s ease-out;
      ">
        <div style="display: flex; align-items: center; margin-bottom: 10px;">
          <span style="font-size: 24px; margin-right: 10px;">🔄</span>
          <h3 style="margin: 0; font-size: 16px;">Mise à jour disponible</h3>
        </div>
        <p style="margin: 10px 0; font-size: 14px; opacity: 0.9;">
          Une nouvelle version (${this.latestVersion}) est disponible.
          Votre version actuelle: ${this.currentVersion}
        </p>
        <div style="display: flex; gap: 10px; margin-top: 15px;">
          <button onclick="window.location.reload()" style="
            background: rgba(255,255,255,0.2);
            border: 1px solid rgba(255,255,255,0.3);
            color: white;
            padding: 8px 16px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.3s ease;
          " onmouseover="this.style.background='rgba(255,255,255,0.3)'" 
             onmouseout="this.style.background='rgba(255,255,255,0.2)'">
            Mettre à jour
          </button>
          <button onclick="this.parentElement.parentElement.remove()" style="
            background: transparent;
            border: 1px solid rgba(255,255,255,0.3);
            color: white;
            padding: 8px 16px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.3s ease;
          " onmouseover="this.style.background='rgba(255,255,255,0.1)'" 
             onmouseout="this.style.background='transparent'">
            Plus tard
          </button>
        </div>
      </div>
      <style>
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      </style>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-suppression après 30 secondes
    setTimeout(() => {
      const existing = document.getElementById('version-update-notification');
      if (existing) {
        existing.remove();
      }
    }, 30000);
  }

  // Forcer une vérification de version
  async forceCheck() {
    await this.checkForUpdates();
  }

  // Obtenir les informations de version
  getVersionInfo() {
    return {
      current: this.currentVersion,
      latest: this.latestVersion,
      isUpToDate: !this.isUpdateAvailable(this.currentVersion, this.latestVersion),
      lastCheck: this.lastCheck
    };
  }
}

// Instance singleton
export const versionChecker = new VersionChecker();
