// Système de gestion de version pour forcer le vidage du cache
import { version } from '../../package.json';

const VERSION_KEY = 'app_version';
const VERSION_HIGHLIGHTS_SEEN_KEY = 'app_version_highlights_seen';

const VERSION_HIGHLIGHTS = {
  '3.10.49': [
    'Deverrouillage d urgence simplifie et securise.',
    'Mode contraste eleve activable pour ameliorer la lisibilite sur PC plus faibles.',
    'Historique Supabase integre avec restauration de versions (date, source, poste/utilisateur si disponible).',
    'Compteur de sauvegarde JSON automatique affiche en secondes et plus fiable visuellement.',
    'Masquage employe persistant jusqu a reactivation manuelle.'
  ],
  '3.10.50': [
    'Restauration Supabase au demarrage amelioree: affichage date, poste et utilisateur de la derniere sauvegarde.',
    'Bascule automatique vers l historique Supabase si la sauvegarde courante ne contient pas de metadonnees exploitables.',
    'Fermeture application renforcee: sauvegarde puis liberation du verrou avant fermeture de session.',
    'Recap employe reamenage: cartes par employe plus lisibles et actions essentielles regroupees sous le nom.',
    'Affichage des elements de recap adapte pour gagner de la place tout en gardant les donnees importantes accessibles.'
  ],
  '3.10.51': [
    'Masquage et reactivation des employes corriges par boutique, sans fuite entre boutiques.',
    'Filtrage strict des employes: seuls les employes reellement affectes a la boutique sont affiches.',
    'La version commune Supabase devient la source obligatoire au demarrage pour eviter les ecrasements.',
    'Popup Nouveautes passe en plein ecran pour une lecture confortable.',
    'Affichage des nouveautes/historique au lancement maintenu avec historique complet des versions.'
  ]
,
  '3.10.52': [
    'Mise a jour version 3.10.52.',
    'Historique a completer.'
  ],
  '3.10.53': [
    'Ajout du bouton "Journal d audit" dans le menu planning.',
    'Acces protege par code superviseur avant affichage du journal.',
    'Nouvel ecran lisible avec date, utilisateur, action, boutique et details.',
    'Trace locale des actions principales (connexion, restauration, sauvegarde manuelle, masquage/reactivation employe, fermeture session).'
  ],
  '3.10.54': [
    'Correction de la copie semaine vers semaine+1 (mapping des dates fiabilise en timezone locale).',
    'Correction de la copie des statuts journaliers (conge/maladie) lors du report a la semaine suivante.',
    'Stabilisation du Journal d audit (ordre des hooks React) et reduction des logs techniques bruyants.'
  ],
  '3.10.55': [
    'Correction de la copie des conges/maladies vers semaine+1 quand la semaine source est en cours de modification.',
    'La copie utilise maintenant les donnees en memoire de la semaine affichee (sans exiger une sauvegarde manuelle prealable).'
  ],
  '3.10.56': [
    'Correction des totaux heures (jours + employes) sur poste distant avec gestion timezone-safe.',
    'Uniformisation des calculs de dates de semaine via parseISO pour eviter les decalages de jour.'
  ]
};

const parseSemver = (v) => String(v || '0.0.0').split('.').map((n) => Number.parseInt(n, 10) || 0);
const compareSemver = (a, b) => {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  const max = Math.max(pa.length, pb.length);
  for (let i = 0; i < max; i += 1) {
    const da = pa[i] || 0;
    const db = pb[i] || 0;
    if (da > db) return 1;
    if (da < db) return -1;
  }
  return 0;
};

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const showLargeVersionHighlightsModal = ({ currentVersion, newChangesText, fullHistoryText }) => {
  const existing = document.getElementById('version-highlights-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'version-highlights-overlay';
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.zIndex = '99999';
  overlay.style.background = 'rgba(0,0,0,0.55)';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.padding = '0';

  const modal = document.createElement('div');
  modal.style.width = '100vw';
  modal.style.height = '100vh';
  modal.style.background = '#ffffff';
  modal.style.borderRadius = '0';
  modal.style.boxShadow = 'none';
  modal.style.display = 'flex';
  modal.style.flexDirection = 'column';
  modal.style.overflow = 'hidden';
  modal.style.border = 'none';

  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.alignItems = 'center';
  header.style.justifyContent = 'space-between';
  header.style.padding = '14px 18px';
  header.style.background = 'linear-gradient(90deg, #1e88e5 0%, #1565c0 100%)';
  header.style.color = '#ffffff';
  header.innerHTML = `
    <div style="font-size:18px;font-weight:700;letter-spacing:.3px;">
      Nouveautes et historique des modifications (v${escapeHtml(currentVersion)})
    </div>
    <button id="version-highlights-close-btn" style="background:#ffffff;color:#1565c0;border:none;border-radius:8px;padding:8px 12px;cursor:pointer;font-weight:700;">
      Fermer
    </button>
  `;

  const body = document.createElement('div');
  body.style.padding = '16px 18px';
  body.style.overflow = 'auto';
  body.style.whiteSpace = 'pre-wrap';
  body.style.fontSize = '14px';
  body.style.lineHeight = '1.5';
  body.style.color = '#1f2937';
  body.textContent =
    `Nouveautes depuis votre derniere version:\n\n${newChangesText}\n\n` +
    `----------------------------------------\n` +
    `Historique complet jusqu'a v${currentVersion}:\n\n${fullHistoryText}`;

  modal.appendChild(header);
  modal.appendChild(body);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });
  const closeBtn = header.querySelector('#version-highlights-close-btn');
  if (closeBtn) closeBtn.addEventListener('click', close);
};

/**
 * Vérifie si la version de l'application a changé
 * Si oui, vide le localStorage (sauf l'utilisateur) et force un rechargement
 */
export const checkVersion = () => {
  try {
    const currentVersion = version;
    const storedVersion = localStorage.getItem(VERSION_KEY);
    
    console.log('🔍 Vérification de version:', {
      currentVersion,
      storedVersion,
      hasChanged: storedVersion !== currentVersion
    });
    
    // Si la version a changé
    if (storedVersion && storedVersion !== currentVersion) {
      console.log('🔄 NOUVELLE VERSION DÉTECTÉE !');
      console.log(`   Ancienne: ${storedVersion}`);
      console.log(`   Nouvelle: ${currentVersion}`);
      console.log('🧹 Nettoyage du cache et localStorage...');
      
      // Sauvegarder les données importantes avant le clear
      const currentUser = localStorage.getItem('current_user');
      const userId = localStorage.getItem('user_id');
      
      // Vider TOUT le localStorage
      localStorage.clear();
      
      // Restaurer uniquement l'utilisateur
      if (currentUser) localStorage.setItem('current_user', currentUser);
      if (userId) localStorage.setItem('user_id', userId);
      
      // Enregistrer la nouvelle version
      localStorage.setItem(VERSION_KEY, currentVersion);
      
      // Afficher un message à l'utilisateur
      alert(
        `🎉 Nouvelle version installée !\n\n` +
        `Version ${currentVersion}\n\n` +
        `Le cache a été vidé pour garantir le bon fonctionnement.\n` +
        `La page va se recharger automatiquement.`
      );
      
      // Forcer le rechargement complet de la page (sans cache)
      window.location.reload(true);
      
      return true; // Version a changé
    }
    
    // Si c'est la première visite (pas de version stockée)
    if (!storedVersion) {
      console.log('🆕 Première visite - Enregistrement de la version:', currentVersion);
      localStorage.setItem(VERSION_KEY, currentVersion);
    }
    
    return false; // Version identique
  } catch (error) {
    console.error('❌ Erreur lors de la vérification de version:', error);
    return false;
  }
};

/**
 * Obtient la version actuelle de l'application
 */
export const getAppVersion = () => {
  return version;
};

/**
 * Force la mise à jour manuelle (pour debug)
 */
export const forceVersionUpdate = () => {
  console.log('🔧 Forçage de la mise à jour de version...');
  localStorage.removeItem(VERSION_KEY);
  checkVersion();
};

/**
 * Affiche les informations de version dans la console
 */
export const logVersionInfo = () => {
  const currentVersion = version;
  const storedVersion = localStorage.getItem(VERSION_KEY);
  
  console.log('%c📦 VERSION DE L\'APPLICATION', 'font-size: 16px; font-weight: bold; color: #1e88e5;');
  console.log(`   Version actuelle: ${currentVersion}`);
  console.log(`   Version en cache: ${storedVersion || 'Aucune'}`);
  console.log(`   Status: ${storedVersion === currentVersion ? '✅ À jour' : '⚠️ Mise à jour nécessaire'}`);
};

export const showVersionHighlightsOnce = () => {
  try {
    const currentVersion = version;
    const seenVersion = localStorage.getItem(VERSION_HIGHLIGHTS_SEEN_KEY);

    const versionsUpToCurrent = Object.keys(VERSION_HIGHLIGHTS)
      .filter((v) => compareSemver(v, currentVersion) <= 0)
      .sort(compareSemver);

    const versionsToShow = versionsUpToCurrent
      .filter((v) => !seenVersion || compareSemver(v, seenVersion) > 0)

    const shouldShow = window.confirm(
      `🆕 Informations version (v${currentVersion}).\n\n` +
      `Souhaitez-vous voir les dernieres modifications et l'historique des versions au lancement ?`
    );

    if (shouldShow) {
      const newChangesText = versionsToShow.length > 0
        ? versionsToShow
            .map((v) => {
              const items = VERSION_HIGHLIGHTS[v] || [];
              return `Version ${v}\n${items.map((item, idx) => `  ${idx + 1}. ${item}`).join('\n')}`;
            })
            .join('\n\n')
        : 'Aucune nouvelle modification depuis votre derniere version.';

      const fullHistoryText = versionsUpToCurrent
        .map((v) => {
          const items = VERSION_HIGHLIGHTS[v] || [];
          return `Version ${v}\n${items.map((item, idx) => `  ${idx + 1}. ${item}`).join('\n')}`;
        })
        .join('\n\n');

      showLargeVersionHighlightsModal({
        currentVersion,
        newChangesText,
        fullHistoryText
      });
    }

    localStorage.setItem(VERSION_HIGHLIGHTS_SEEN_KEY, currentVersion);
  } catch (error) {
    console.error('❌ Erreur affichage nouveautes version:', error);
  }
};

