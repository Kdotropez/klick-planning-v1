import { useState, useEffect, useRef } from 'react';
import { format, startOfWeek } from 'date-fns';
import { saveToLocalStorage } from './utils/localStorage';
import { checkVersion, logVersionInfo, showVersionHighlightsOnce } from './utils/versionManager';
import ErrorBoundary from './components/common/ErrorBoundary';
import CopyrightNotice from './components/common/CopyrightNotice';
import VersionBadge from './components/common/VersionBadge';

// import LicenseManager from './components/admin/LicenseManager';
// import { enableProtection } from './utils/protection';
// import { loadLicense, isLicenseValid, checkLicenseLimits } from './utils/licenseManagerVercel';
// import './utils/createFullLicense';
// import './utils/licenseKeyGenerator';
// import './utils/licenseCreator';
import MainStartupScreen from './components/MainStartupScreen';
import StartupScreen from './components/StartupScreen';
import UserIdentificationModal from './components/UserIdentificationModal';
import SchoolModeViewer from './components/SchoolModeViewer';

import ShopCreation from './components/steps/ShopCreation';
import ShopConfig from './components/steps/ShopConfig';
import EmployeeManagement from './components/steps/EmployeeManagement';
import EmployeeAssignment from './components/steps/EmployeeAssignment';
import WeekSelection from './components/steps/WeekSelection';
import PlanningDisplay from './components/planning/PlanningDisplay';
import { 
  createNewPlanningData, 
  addShop, 
  updateShopConfig, 
  addEmployee, 
  updateEmployeeShops,
  exportPlanningData,
  exportPlanningToExcel,
  importPlanningData
} from './utils/planningDataManager.js';
import './App.css';
import {
  loadRemotePlanning,
  saveCompletePlanningData,
  listCompletePlanningBackups,
  loadCompletePlanningBackupByWeekKey,
  getCurrentCompleteBackupInfo,
  loadCompletePlanningData
} from './utils/remoteStore';
import { addAuditLog } from './utils/auditLog';
import { versionChecker } from './utils/versionChecker';
import {
  initLockService,
  acquireLock,
  releaseLock,
  heartbeat,
  cleanupExpiredLocks,
  emergencyUnlock
} from './utils/collabLock';
import { PRIMARY_ADMIN_CODE, pullUserCodesFromSupabase } from './config/userCodes';

const USER_DEFAULT_SHOP_ALIASES = {
  ANGELIQUE: 'SAINT TROPEZ',
  EVELYNE: 'SAINTE MAXIME',
  CHRISTELLE: 'CANNES'
};

const getCurrentWeekKey = () => format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

const normalizeToken = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

const App = () => {
  const isRestoringSupabaseRef = useRef(false);
  // TTL court pour récupérer rapidement la main après fermeture/coupure d'un autre poste
  const GLOBAL_LOCK_TTL_MS = 90 * 1000;
  const GLOBAL_HEARTBEAT_MS = 20 * 1000;
  const INACTIVITY_TIMEOUT_MS = 3 * 60 * 1000;

  // Fonctions de licence intégrées (Vercel-compatible)
  const loadLicense = () => {
    try {
      const stored = localStorage.getItem('planning_license');
      if (stored) {
        return JSON.parse(stored);
      }
      return null;
    } catch (error) {
      console.error('Erreur lors du chargement de la licence:', error);
      return null;
    }
  };

  const isLicenseValid = (license) => {
    if (!license) return false;
    
    try {
      const now = new Date();
      const expiryDate = new Date(license.expiryDate);
      
      return license.isActive && expiryDate > now;
    } catch (error) {
      console.error('Erreur lors de la vérification de la licence:', error);
      return false;
    }
  };

  const checkLicenseLimits = (license, currentData) => {
    if (!license) {
      return { valid: false, message: 'Aucune licence trouvée' };
    }
    
    try {
      // Limites simplifiées
      const maxShops = license.type === 'unlimited' ? 999 : 3;
      const maxEmployees = license.type === 'unlimited' ? 999 : 10;
      
      const currentShops = currentData.shops?.length || 0;
      const currentEmployees = currentData.shops?.reduce((total, shop) => 
        total + (shop.employees?.length || 0), 0) || 0;
      
      if (currentShops > maxShops) {
        return { valid: false, message: `Limite de boutiques atteinte (${maxShops})` };
      }
      
      if (currentEmployees > maxEmployees) {
        return { valid: false, message: `Limite d'employés atteinte (${maxEmployees})` };
      }
      
      return { valid: true, message: 'Limites respectées' };
    } catch (error) {
      console.error('Erreur lors de la vérification des limites:', error);
      return { valid: false, message: 'Erreur de vérification des limites' };
    }
  };

  // États de l'application
  const [mode, setMode] = useState('identification'); // 'identification', 'main-startup', 'startup', 'school-mode', 'new', 'imported', 'week-selection', 'planning', 'cash-register'
  const [planningData, setPlanningData] = useState(createNewPlanningData());
  const [currentStep, setCurrentStep] = useState(1); // 1: création boutiques, 2: config, 3: employés, 4: affectation
  const [currentShopIndex, setCurrentShopIndex] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [restoredInfo, setRestoredInfo] = useState('');

  // États pour le planning (quand on est en mode planning)
  const [selectedShop, setSelectedShop] = useState('');
  const [selectedWeek, setSelectedWeek] = useState('');
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [planning, setPlanning] = useState({});

  // États pour la gestion des licences
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [licenseError, setLicenseError] = useState('');
  const [showLicenseManager, setShowLicenseManager] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [hasGlobalLock, setHasGlobalLock] = useState(false);
  const [lockCountdownSeconds, setLockCountdownSeconds] = useState(0);
  const [lockOwnerText, setLockOwnerText] = useState('');
  const [inactivityRemainingSeconds, setInactivityRemainingSeconds] = useState(
    Math.ceil(INACTIVITY_TIMEOUT_MS / 1000)
  );
  const [showInactivityCounter, setShowInactivityCounter] = useState(false);
  const [isSupabaseStartupReady, setIsSupabaseStartupReady] = useState(false);
  const [inactivityCounterPosition, setInactivityCounterPosition] = useState(() => {
    try {
      const raw = localStorage.getItem('ui_inactivity_counter_position');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') {
        return { x: parsed.x, y: parsed.y };
      }
      return null;
    } catch {
      return null;
    }
  });
  const [highContrastMode, setHighContrastMode] = useState(() => {
    try {
      return localStorage.getItem('ui_high_contrast_mode') === 'true';
    } catch {
      return false;
    }
  });
  const lastActivityRef = useRef(Date.now());
  const inactivityCounterRef = useRef(null);
  const inactivityDragRef = useRef({ dragging: false, offsetX: 0, offsetY: 0 });
  const interactionThrottleRef = useRef({ key: '', ts: 0 });

  // Vérification centralisée pour les fonctions sensibles (protégées par le code administrateur)
  const isPrimaryAdmin = currentUser && currentUser.code === PRIMARY_ADMIN_CODE;

  const requirePrimaryAdmin = (actionLabel = 'cette fonction') => {
    if (!isPrimaryAdmin) {
      alert(
        `Accès réservé au superviseur (code ${PRIMARY_ADMIN_CODE}) pour ${actionLabel}.\n\n` +
        `Veuillez vous identifier avec le code ${PRIMARY_ADMIN_CODE} pour continuer.`
      );
      return false;
    }
    return true;
  };

  const resolvePreferredShopId = (user, data) => {
    const shops = data?.shops || [];
    if (!shops.length) return '';

    const userName = normalizeToken(user?.name);
    const userCode = normalizeToken(user?.code);

    const preferredAlias = Object.entries(USER_DEFAULT_SHOP_ALIASES).find(([alias]) =>
      userName.includes(alias) || userCode.includes(alias)
    )?.[1];

    if (!preferredAlias) return shops[0]?.id || '';

    const target = normalizeToken(preferredAlias);
    const match = shops.find((shop) => {
      const idToken = normalizeToken(shop?.id);
      const nameToken = normalizeToken(shop?.name);
      return idToken === target || nameToken === target || idToken.includes(target) || nameToken.includes(target);
    });

    return match?.id || shops[0]?.id || '';
  };

  const getShopNameById = (shopId, data = planningData) =>
    data?.shops?.find((shop) => shop.id === shopId)?.name || shopId || '';

  const writeAudit = ({
    action,
    details = '',
    shopId = selectedShop,
    user = currentUser,
    data = planningData
  }) => {
    addAuditLog({
      action,
      details,
      userCode: user?.code,
      userName: user?.name,
      shopId: shopId || '',
      shopName: getShopNameById(shopId || '', data)
    });
  };

  const initGlobalLock = () => {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_KEY;

    if (!url || !key) {
      console.error('❌ Configuration Supabase manquante pour le verrou global');
      return false;
    }

    initLockService({ url, key });
    return true;
  };

  const formatLockOwner = (lock) => {
    if (!lock || !lock.user_id) return 'un autre poste';
    const [ownerCode] = String(lock.user_id).split('::');
    return `l'utilisateur ${ownerCode || lock.user_id}`;
  };

  const getLockRemainingSeconds = (lock) => {
    if (!lock?.updated_at && !lock?.created_at) return null;
    const lockDate = new Date(lock.updated_at || lock.created_at);
    const ageMs = Date.now() - lockDate.getTime();
    const remainingMs = Math.max(0, GLOBAL_LOCK_TTL_MS - ageMs);
    return Math.ceil(remainingMs / 1000);
  };

  const startLockCountdown = (seconds, ownerText) => {
    setLockCountdownSeconds(Math.max(0, seconds || 0));
    setLockOwnerText(ownerText || 'un autre poste');
  };

  const resetInactivityTimer = () => {
    lastActivityRef.current = Date.now();
    setInactivityRemainingSeconds(Math.ceil(INACTIVITY_TIMEOUT_MS / 1000));
  };

  const getLockHolderId = (user) => {
    if (!user) return '';
    const code = user.code || 'unknown';
    const sessionId = user.sessionId || user.loginTime || `fallback-${Date.now()}`;
    return `${code}::${sessionId}`;
  };

  const acquireGlobalLockForUser = async (user) => {
    if (!user?.code) {
      return { ok: false, reason: 'invalid-user' };
    }

    if (!initGlobalLock()) {
      return { ok: false, reason: 'supabase-config' };
    }

    try {
      await cleanupExpiredLocks(GLOBAL_LOCK_TTL_MS);
      const result = await acquireLock(getLockHolderId(user), GLOBAL_LOCK_TTL_MS);
      return result?.ok
        ? { ok: true }
        : { ok: false, reason: 'locked-by-other', lock: result?.lock || null };
    } catch (error) {
      console.error('❌ Erreur acquisition verrou global:', error);
      return { ok: false, reason: 'lock-error' };
    }
  };

  // Charger la version commune depuis Supabase au démarrage
  useEffect(() => {
    const bootstrapFromSupabase = async () => {
      try {
      // Précharger les codes utilisateurs partagés pour l'écran de connexion
      pullUserCodesFromSupabase().catch((error) => {
        console.warn('⚠️ Préchargement des codes utilisateurs impossible:', error);
      });

      // ⚡ VÉRIFICATION DE VERSION - FORCE LE VIDAGE DU CACHE SI NOUVELLE VERSION
      const versionChanged = checkVersion();
      logVersionInfo();
      
      // Si la version a changé, on arrête ici car la page va se recharger
      if (versionChanged) {
        return;
      }

      showVersionHighlightsOnce();
      
      // Initialiser le vérificateur de version
      versionChecker.init().catch(error => {
        console.error('❌ Erreur initialisation VersionChecker:', error);
      });

      // Au lancement/rechargement, forcer une nouvelle identification.
      localStorage.removeItem('current_user');
      localStorage.removeItem('user_id');
      setCurrentUser(null);
      setHasGlobalLock(false);
      setIsSupabaseStartupReady(false);

      // Source de vérité obligatoire: Supabase au lancement.
      const remoteData = await loadCompletePlanningData();
      const isRemoteValid = !!(
        remoteData &&
        remoteData.version === '2.0' &&
        Array.isArray(remoteData.shops) &&
        remoteData.shops.length > 0
      );

      if (isRemoteValid) {
        setPlanningData(remoteData);
        localStorage.setItem('planningData', JSON.stringify(remoteData));
        setIsSupabaseStartupReady(true);
        setMode('identification');
        setRestoredInfo('☁️ Version commune Supabase chargée au démarrage.');
        console.log('✅ Bootstrap Supabase réussi: version commune appliquée.');
      } else {
        // Sécurité: ne jamais partir d'une copie locale potentiellement obsolète.
        localStorage.removeItem('planningData');
        setPlanningData(createNewPlanningData());
        setIsSupabaseStartupReady(false);
        setMode('identification');
        setRestoredInfo('⚠️ Aucune version commune Supabase disponible au lancement.');
        setFeedback('❌ Connexion bloquée: impossible de charger la version commune Supabase.');
        console.warn('⚠️ Bootstrap Supabase invalide/vide. Connexion bloquée.');
      }
      } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
      // Sécurité: empêcher l'utilisation d'une copie locale non synchronisée.
      localStorage.removeItem('planningData');
      setPlanningData(createNewPlanningData());
      setIsSupabaseStartupReady(false);
      setMode('identification');
      setRestoredInfo('⚠️ Supabase indisponible au démarrage.');
      setFeedback('❌ Connexion bloquée: Supabase indisponible au lancement.');
      }
    };

    bootstrapFromSupabase();
  }, []);

  // Sauvegarder les données dans localStorage
  useEffect(() => {
    // Sauvegarder les données dans localStorage
    if (mode !== 'startup') {
      saveToLocalStorage('planningData', planningData);
    }
  }, [planningData, mode]);

  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  useEffect(() => {
    if (!currentUser?.code) return undefined;

    const cleanText = (value = '') =>
      String(value || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 80);

    const getElementDescriptor = (target) => {
      const el = target instanceof Element ? target : null;
      if (!el) return null;

      const actionable =
        el.closest('button') ||
        el.closest('a') ||
        el.closest('[role="button"]') ||
        el.closest('input') ||
        el.closest('select') ||
        el.closest('textarea');

      if (!actionable) return null;

      const tag = actionable.tagName?.toLowerCase() || 'element';
      const type = actionable.getAttribute?.('type') || '';
      const aria = actionable.getAttribute?.('aria-label') || '';
      const title = actionable.getAttribute?.('title') || '';
      const id = actionable.id ? `#${actionable.id}` : '';
      const name = actionable.getAttribute?.('name') || '';
      const text = cleanText(actionable.textContent || actionable.value || '');
      const label = cleanText([aria, title, name, text].filter(Boolean)[0] || '');

      return {
        key: `${tag}|${type}|${id}|${label}`.toLowerCase(),
        tag,
        type,
        label: label || '(sans libelle)'
      };
    };

    const shouldSkip = (key) => {
      const now = Date.now();
      const isDuplicate = interactionThrottleRef.current.key === key && now - interactionThrottleRef.current.ts < 1200;
      if (isDuplicate) return true;
      interactionThrottleRef.current = { key, ts: now };
      return false;
    };

    const onClickCapture = (event) => {
      const descriptor = getElementDescriptor(event.target);
      if (!descriptor) return;
      const key = `click:${descriptor.key}`;
      if (shouldSkip(key)) return;
      writeAudit({
        action: 'Interaction UI',
        details: `Clic ${descriptor.tag}${descriptor.type ? `(${descriptor.type})` : ''}: ${descriptor.label}`
      });
    };

    const onChangeCapture = (event) => {
      const descriptor = getElementDescriptor(event.target);
      if (!descriptor) return;

      const target = event.target;
      const valuePreview =
        target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement
          ? target.type === 'password'
            ? '[masque]'
            : cleanText(String(target.value || '')).slice(0, 40)
          : '';

      const key = `change:${descriptor.key}:${valuePreview}`;
      if (shouldSkip(key)) return;
      writeAudit({
        action: 'Interaction UI',
        details: `Modification ${descriptor.tag}${descriptor.type ? `(${descriptor.type})` : ''}: ${descriptor.label}${valuePreview ? ` -> ${valuePreview}` : ''}`
      });
    };

    document.addEventListener('click', onClickCapture, true);
    document.addEventListener('change', onChangeCapture, true);

    return () => {
      document.removeEventListener('click', onClickCapture, true);
      document.removeEventListener('change', onChangeCapture, true);
    };
  }, [currentUser, selectedShop, planningData]);

  const previousModeRef = useRef(mode);
  useEffect(() => {
    if (!currentUser?.code) {
      previousModeRef.current = mode;
      return;
    }
    if (previousModeRef.current !== mode) {
      writeAudit({
        action: 'Navigation',
        details: `Changement d ecran: ${previousModeRef.current} -> ${mode}`
      });
      previousModeRef.current = mode;
    }
  }, [mode, currentUser]);

  useEffect(() => {
    if (!currentUser || !hasGlobalLock) {
      setShowInactivityCounter(false);
      return undefined;
    }

    setShowInactivityCounter(true);
    resetInactivityTimer();

    const activityEvents = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    const onActivity = () => {
      lastActivityRef.current = Date.now();
    };

    activityEvents.forEach((evt) => window.addEventListener(evt, onActivity, { passive: true }));

    const intervalId = setInterval(async () => {
      const elapsedMs = Date.now() - lastActivityRef.current;
      const remainingMs = Math.max(0, INACTIVITY_TIMEOUT_MS - elapsedMs);
      const remainingSeconds = Math.ceil(remainingMs / 1000);
      setInactivityRemainingSeconds(remainingSeconds);

      if (remainingMs > 0) return;

      clearInterval(intervalId);
      setShowInactivityCounter(false);

      let saveSucceeded = false;
      try {
        saveSucceeded = await saveCompletePlanningData(planningData);
      } catch (error) {
        console.error('❌ Erreur sauvegarde auto avant déconnexion:', error);
      }

      try {
        await releaseLock(getLockHolderId(currentUser));
      } catch (error) {
        console.error('❌ Erreur release lock après inactivité:', error);
      }

      localStorage.removeItem('current_user');
      localStorage.removeItem('user_id');
      setCurrentUser(null);
      setHasGlobalLock(false);
      setMode('identification');
      setFeedback(
        saveSucceeded
          ? '⏳ Déconnexion automatique (3 min d’inactivité). Sauvegarde Supabase effectuée.'
          : '⏳ Déconnexion automatique (3 min d’inactivité). Sauvegarde Supabase non confirmée.'
      );
    }, 1000);

    return () => {
      clearInterval(intervalId);
      activityEvents.forEach((evt) => window.removeEventListener(evt, onActivity));
    };
  }, [currentUser, hasGlobalLock, planningData]);

  useEffect(() => {
    if (lockCountdownSeconds <= 0) return undefined;

    const timerId = setInterval(() => {
      setLockCountdownSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timerId);
  }, [lockCountdownSeconds]);

  useEffect(() => {
    let cancelled = false;

    const ensureGlobalLock = async () => {
      if (!currentUser || hasGlobalLock) return;

      const lockResult = await acquireGlobalLockForUser(currentUser);
      if (cancelled) return;

      if (!lockResult.ok) {
        const ownerText = formatLockOwner(lockResult.lock);
        const remainingSeconds = getLockRemainingSeconds(lockResult.lock);
        startLockCountdown(remainingSeconds ?? Math.ceil(GLOBAL_LOCK_TTL_MS / 1000), ownerText);
        localStorage.removeItem('current_user');
        localStorage.removeItem('user_id');
        setCurrentUser(null);
        setHasGlobalLock(false);
        setMode('identification');
        setFeedback('❌ Accès refusé : planning déjà ouvert sur un autre poste.');
        return;
      }

      setHasGlobalLock(true);
      setLockCountdownSeconds(0);
      setLockOwnerText('');
    };

    ensureGlobalLock();
    return () => {
      cancelled = true;
    };
  }, [currentUser, hasGlobalLock]);

  useEffect(() => {
    if (!currentUser || !hasGlobalLock) return undefined;

    const intervalId = setInterval(async () => {
      const hbResult = await heartbeat(getLockHolderId(currentUser));
      if (hbResult?.ok) return;

      alert(
        'La session a perdu le verrou global (ou un autre poste a repris la main).\n\n' +
        'Vous allez être redirigé vers l’identification.'
      );
      localStorage.removeItem('current_user');
      localStorage.removeItem('user_id');
      setCurrentUser(null);
      setHasGlobalLock(false);
      setMode('identification');
      setFeedback('❌ Session verrouillée perdue. Veuillez vous reconnecter.');
    }, GLOBAL_HEARTBEAT_MS);

    return () => clearInterval(intervalId);
  }, [currentUser, hasGlobalLock]);

  useEffect(() => {
    document.body.classList.toggle('high-contrast-mode', highContrastMode);
    try {
      localStorage.setItem('ui_high_contrast_mode', String(highContrastMode));
    } catch (error) {
      console.warn('⚠️ Impossible de sauvegarder le mode contraste:', error);
    }
  }, [highContrastMode]);

  useEffect(() => {
    try {
      if (inactivityCounterPosition && typeof inactivityCounterPosition.x === 'number' && typeof inactivityCounterPosition.y === 'number') {
        localStorage.setItem('ui_inactivity_counter_position', JSON.stringify(inactivityCounterPosition));
      }
    } catch (error) {
      console.warn('⚠️ Impossible de sauvegarder la position du compteur inactivité:', error);
    }
  }, [inactivityCounterPosition]);

  useEffect(() => {
    if (!currentUser || !hasGlobalLock) return undefined;

    const onBeforeUnload = () => {
      releaseLock(getLockHolderId(currentUser)).catch(() => {});
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [currentUser, hasGlobalLock]);

  // Protection désactivée
  // useEffect(() => {
  //   enableProtection();
  // }, []);

  // Vérification de licence désactivée
  // useEffect(() => { ... }, [planningData]);

  // Gestion de l'identification
  const handleUserIdentification = async (user) => {
    console.log('🆔 Utilisateur identifié:', user);

    if (!isSupabaseStartupReady) {
      alert(
        '❌ Connexion bloquée.\n\n' +
        'La version commune Supabase n a pas été chargée au démarrage.\n' +
        'Relancez lorsque Supabase est disponible.'
      );
      setFeedback('❌ Connexion bloquée: version commune Supabase non chargée.');
      return;
    }

    const lockResult = await acquireGlobalLockForUser(user);
    if (!lockResult.ok) {
      // Nettoyage défensif: aucune session locale ne doit rester si le verrou est refusé
      localStorage.removeItem('current_user');
      localStorage.removeItem('user_id');
      const ownerText = formatLockOwner(lockResult.lock);
      const remainingSeconds = getLockRemainingSeconds(lockResult.lock);
      startLockCountdown(remainingSeconds ?? Math.ceil(GLOBAL_LOCK_TTL_MS / 1000), ownerText);
      return;
    }

    // Session locale persistée uniquement après validation du verrou global
    localStorage.setItem('current_user', JSON.stringify(user));
    localStorage.setItem('user_id', `user_${user.code}_${Date.now()}`);

    setCurrentUser(user);
    setHasGlobalLock(true);
    resetInactivityTimer();
    setLockCountdownSeconds(0);
    setLockOwnerText('');
    const preferredShopId = resolvePreferredShopId(user, planningData);
    if (preferredShopId) {
      setSelectedShop(preferredShopId);
    }
    setSelectedWeek(getCurrentWeekKey());
    setMode(planningData?.shops?.length > 0 ? 'planning' : 'main-startup');
    setFeedback(`👋 Bienvenue ${user.name} !`);
    addAuditLog({
      action: 'Connexion',
      details: 'Connexion utilisateur validee.',
      userCode: user?.code,
      userName: user?.name,
      shopId: preferredShopId,
      shopName: getShopNameById(preferredShopId, planningData)
    });
  };

  const handleEmergencyUnlock = async () => {
    if (!initGlobalLock()) {
      alert('Configuration Supabase manquante pour le déverrouillage d’urgence.');
      return false;
    }

    const unlockCode = window.prompt('Code de validation déverrouillage (admin):');
    if (!unlockCode) return false;
    if (unlockCode.trim() !== '2111') {
      alert('❌ Code admin invalide. Déverrouillage annulé.');
      return false;
    }

    const result = await emergencyUnlock(PRIMARY_ADMIN_CODE, unlockCode.trim());
    if (result?.ok) {
      setLockCountdownSeconds(0);
      setLockOwnerText('');
      alert('✅ Déverrouillage d’urgence effectué. Vous pouvez vous reconnecter.');
      return true;
    }

    alert(`❌ Déverrouillage impossible : ${result?.error || 'erreur inconnue'}`);
    return false;
  };

  const handleIdentificationCancel = () => {
    // Optionnel : rediriger vers une page d'erreur ou fermer l'app
    alert('Identification requise pour accéder à l\'application.');
    // Ou simplement rester sur l'écran d'identification
  };

  // Gestion du démarrage
  const handleNewPlanning = () => {
    // Création / reconfiguration complète du planning → fonction sensible
    if (!requirePrimaryAdmin('créer ou reconfigurer le planning (boutiques, employés, configuration)')) {
      return;
    }

    // Réinitialiser complètement les données pour éviter l'accumulation
    setPlanningData(createNewPlanningData());
    setSelectedShop('');
    setSelectedWeek('');
    setSelectedEmployees([]);
    setPlanning({});
    setMode('new');
    setCurrentStep(1);
    setCurrentShopIndex(0);
    setFeedback('');
  };



  // Aller directement au planning après restauration depuis Supabase
  // Continuer avec les données locales
  const handleContinueWithLocalData = () => {
    if (planningData && planningData.shops && planningData.shops.length > 0) {
      setSelectedShop(resolvePreferredShopId(currentUser, planningData));
      setSelectedWeek(getCurrentWeekKey());
      setMode('planning');
      setFeedback('✅ Ouverture du planning sur la semaine actuelle');
    } else {
      setFeedback('❌ Aucune donnée locale disponible');
    }
  };

  const handleRestoreFromSupabase = async () => {
    if (isRestoringSupabaseRef.current) {
      setFeedback('⏳ Restauration déjà en cours...');
      return;
    }

    isRestoringSupabaseRef.current = true;
    console.log('🔄 handleRestoreFromSupabase appelé dans App.jsx');
    
    setFeedback('⏳ Chargement depuis Supabase...');
    const showStartupAlert = mode === 'startup';
    
    try {
      if (showStartupAlert) {
        const currentInfo = await getCurrentCompleteBackupInfo();
        if (!currentInfo?.updatedAt) {
          alert(
            `ℹ️ Impossible d'identifier la sauvegarde courante (date/poste).\n\n` +
            `Ouverture de l'historique Supabase pour choisir la version a restaurer.`
          );
          isRestoringSupabaseRef.current = false;
          await handleRestoreBackupFromHistory({ bypassBusyGuard: true });
          return;
        }

        const infoText =
          `Date: ${new Date(currentInfo.updatedAt).toLocaleString('fr-FR')}\n` +
          `Poste: ${currentInfo.savedByDevice || 'PC inconnu'}\n` +
          `Utilisateur: ${currentInfo.savedByUser || 'Utilisateur inconnu'}\n` +
          `Boutiques: ${currentInfo.shopsCount || 0}`;

        const restoreCurrent = window.confirm(
          `☁️ Sauvegarde Supabase détectée:\n\n${infoText}\n\n` +
          `OK = Restaurer cette version\n` +
          `Annuler = Voir l'historique des sauvegardes`
        );

        if (!restoreCurrent) {
          isRestoringSupabaseRef.current = false;
          await handleRestoreBackupFromHistory({ bypassBusyGuard: true });
          return;
        }
      }

      // Initialiser Supabase
      const { createClient } = await import('@supabase/supabase-js');
      const url = import.meta.env.VITE_SUPABASE_URL;
      const key = import.meta.env.VITE_SUPABASE_KEY;
      
      if (!url || !key) {
        const message = '❌ Configuration Supabase manquante.';
        setFeedback(message);
        if (showStartupAlert) alert(message);
        return;
      }
      
      const supabase = createClient(url, key);
      
      // Charger les données depuis Supabase avec fallback
      const { loadCompletePlanningData } = await import('./utils/remoteStore');
      
      // Initialiser le service Supabase pour loadCompletePlanningData
      initLockService({ url, key });
      
      const restoredData = await loadCompletePlanningData();
      
      if (!restoredData) {
        const message = '❌ Aucune donnée trouvée sur Supabase.';
        setFeedback(message);
        if (showStartupAlert) alert(message);
        return;
      }
      
      if (!restoredData.shops || restoredData.shops.length === 0) {
        const message = '❌ Aucune boutique trouvée dans les données.';
        setFeedback(message);
        if (showStartupAlert) alert(message);
        return;
      }
      
      // ⚡ CLEAR TOTAL DE TOUT LE LOCALSTORAGE (sauf l'utilisateur connecté)
      console.log('🧹 NETTOYAGE COMPLET du localStorage avant restauration...');
      const currentUser = localStorage.getItem('current_user'); // Sauvegarder l'utilisateur
      const userId = localStorage.getItem('user_id'); // Sauvegarder l'ID utilisateur
      
      // Supprimer TOUTES les clés du localStorage
      localStorage.clear();
      
      // Restaurer uniquement l'utilisateur et son ID
      if (currentUser) localStorage.setItem('current_user', currentUser);
      if (userId) localStorage.setItem('user_id', userId);
      
      console.log('✅ localStorage nettoyé - Seul l\'utilisateur est préservé');
      
      // Mettre à jour les données avec les données Supabase FRAÎCHES
      setPlanningData(restoredData);
      localStorage.setItem('planningData', JSON.stringify(restoredData));
      
      console.log('💾 Données Supabase restaurées dans localStorage:', {
        shops: restoredData.shops.length,
        version: restoredData.version
      });
      
      // Sélectionner la première boutique
      setSelectedShop(resolvePreferredShopId(currentUser, restoredData));
      setSelectedWeek(getCurrentWeekKey());
      
      // Aller directement au planning de la semaine actuelle
      setMode('planning');
      {
        const message = '✅ Planning restauré depuis Supabase avec nettoyage complet ! Ouverture sur la semaine actuelle.';
        setFeedback(message);
        if (showStartupAlert) alert('✅ Restauration Supabase réussie.');
        addAuditLog({
          action: 'Restauration Supabase',
          details: 'Version courante Supabase restauree.',
          userCode: currentUser?.code,
          userName: currentUser?.name,
          shopId: selectedShop || restoredData?.shops?.[0]?.id || '',
          shopName: getShopNameById(selectedShop || restoredData?.shops?.[0]?.id || '', restoredData)
        });
      }
      
    } catch (error) {
      console.error('❌ Erreur restauration:', error);
      const message = '❌ Erreur: ' + error.message;
      setFeedback(message);
      if (showStartupAlert) alert(message);
    } finally {
      isRestoringSupabaseRef.current = false;
    }
  };

  const handleRestoreBackupFromHistory = async ({ bypassBusyGuard = false } = {}) => {
    if (!bypassBusyGuard && isRestoringSupabaseRef.current) {
      setFeedback('⏳ Une restauration est déjà en cours...');
      return;
    }

    if (!bypassBusyGuard) {
      isRestoringSupabaseRef.current = true;
    }
    setFeedback('⏳ Chargement de l’historique Supabase...');

    try {
      const backups = await listCompletePlanningBackups(15);
      if (!backups || backups.length === 0) {
        alert('❌ Aucun historique de sauvegarde trouvé sur Supabase.');
        setFeedback('❌ Aucun historique de sauvegarde trouvé.');
        return;
      }

      const lines = backups.map((item, idx) => {
        const dateText = item.updatedAt ? new Date(item.updatedAt).toLocaleString('fr-FR') : 'date inconnue';
        const sourceLabel = item.weekKey === 'current_complete_file'
          ? 'actuelle'
          : item.weekKey.startsWith('legacy_row::')
            ? 'legacy'
            : 'snapshot';
        return `${idx + 1}. ${dateText} (${item.shopsCount || 0} boutique(s), ${sourceLabel}, ${item.savedByDevice || 'PC inconnu'}, ${item.savedByUser || 'Utilisateur inconnu'})`;
      });

      const selected = window.prompt(
        `Historique Supabase (1-${backups.length}) :\n${lines.join('\n')}\n\nEntrez le numero a restaurer:`
      );

      if (!selected) {
        setFeedback('ℹ️ Restauration historique annulée.');
        return;
      }

      const parsedIndex = Number.parseInt(selected, 10) - 1;
      if (Number.isNaN(parsedIndex) || parsedIndex < 0 || parsedIndex >= backups.length) {
        alert('❌ Numero invalide.');
        setFeedback('❌ Numero de sauvegarde invalide.');
        return;
      }

      const chosen = backups[parsedIndex];
      const restoredData = await loadCompletePlanningBackupByWeekKey(chosen.weekKey);
      if (!restoredData || !restoredData.shops || restoredData.shops.length === 0) {
        alert('❌ Sauvegarde historique invalide ou vide.');
        setFeedback('❌ Sauvegarde historique invalide.');
        return;
      }

      const currentUser = localStorage.getItem('current_user');
      const userId = localStorage.getItem('user_id');
      localStorage.clear();
      if (currentUser) localStorage.setItem('current_user', currentUser);
      if (userId) localStorage.setItem('user_id', userId);

      setPlanningData(restoredData);
      localStorage.setItem('planningData', JSON.stringify(restoredData));

      setSelectedShop(resolvePreferredShopId(currentUser, restoredData));
      setSelectedWeek(getCurrentWeekKey());
      setMode('planning');

      const restoredAt = chosen.updatedAt ? new Date(chosen.updatedAt).toLocaleString('fr-FR') : 'date inconnue';
      setFeedback(`✅ Historique restauré (${restoredAt}).`);
      alert(`✅ Historique restauré (${restoredAt}).`);
      addAuditLog({
        action: 'Restauration Historique Supabase',
        details: `Sauvegarde restauree: ${restoredAt}`,
        userCode: currentUser?.code,
        userName: currentUser?.name,
        shopId: firstShop?.id || '',
        shopName: getShopNameById(firstShop?.id || '', restoredData)
      });
    } catch (error) {
      console.error('❌ Erreur restauration historique:', error);
      setFeedback(`❌ Erreur restauration historique: ${error.message}`);
      alert(`❌ Erreur restauration historique: ${error.message}`);
    } finally {
      if (!bypassBusyGuard) {
        isRestoringSupabaseRef.current = false;
      }
    }
  };

  // Gestion de la licence
  const handleLicenseValid = () => {
    setShowLicenseModal(false);
    setLicenseError('');
  };

  const handleImportPlanning = async (file) => {
    try {
      const importedData = await importPlanningData(file);
      setPlanningData(importedData);
      

      
      // Sélectionner la première boutique par défaut
      if (importedData.shops && importedData.shops.length > 0) {
        setSelectedShop(resolvePreferredShopId(currentUser, importedData));
      }
      
      // Aller à la sélection de semaine (comportement d'origine qui fonctionnait)
      setMode('week-selection');
      setFeedback('Import réussi ! Veuillez sélectionner une semaine.');
      

    } catch (error) {
      setFeedback(`Erreur d'import : ${error.message}`);
    }
  };

  // Alias pour handleImportData (utilisé dans certains composants)
  const handleImportData = handleImportPlanning;

  const handleExit = async () => {
    if (!window.confirm('Êtes-vous sûr de vouloir quitter l\'application ?')) return;

    try {
      if (currentUser?.code && hasGlobalLock) {
        await saveCompletePlanningData(planningData);
        await releaseLock(getLockHolderId(currentUser));
      }
    } catch (error) {
      console.error('❌ Erreur pendant la fermeture sécurisée:', error);
    } finally {
      addAuditLog({
        action: 'Fermeture Session',
        details: 'Fermeture application demandee.',
        userCode: currentUser?.code,
        userName: currentUser?.name,
        shopId: selectedShop || '',
        shopName: getShopNameById(selectedShop || '')
      });
      // Nettoyage session même si la fermeture de fenêtre est bloquée
      localStorage.removeItem('current_user');
      localStorage.removeItem('user_id');
      setCurrentUser(null);
      setHasGlobalLock(false);
      setMode('identification');
      setFeedback('👋 Session fermée.');

      window.close();
      setTimeout(() => {
        if (!window.closed) {
          // Fallback navigateur si fermeture onglet interdite
          window.location.href = 'about:blank';
        }
      }, 300);
    }
  };

  const formatMmSs = (seconds) => {
    const safe = Math.max(0, seconds || 0);
    const mm = String(Math.floor(safe / 60)).padStart(2, '0');
    const ss = String(safe % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  };

  const startInactivityCounterDrag = (clientX, clientY) => {
    const node = inactivityCounterRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    inactivityDragRef.current = {
      dragging: true,
      offsetX: clientX - rect.left,
      offsetY: clientY - rect.top
    };
  };

  useEffect(() => {
    const handleMove = (clientX, clientY) => {
      if (!inactivityDragRef.current.dragging) return;
      const node = inactivityCounterRef.current;
      if (!node) return;

      const rect = node.getBoundingClientRect();
      const maxX = Math.max(0, window.innerWidth - rect.width);
      const maxY = Math.max(0, window.innerHeight - rect.height);
      const nextX = Math.max(0, Math.min(clientX - inactivityDragRef.current.offsetX, maxX));
      const nextY = Math.max(0, Math.min(clientY - inactivityDragRef.current.offsetY, maxY));

      setInactivityCounterPosition({ x: nextX, y: nextY });
    };

    const onMouseMove = (event) => handleMove(event.clientX, event.clientY);
    const onTouchMove = (event) => {
      const touch = event.touches?.[0];
      if (!touch) return;
      handleMove(touch.clientX, touch.clientY);
    };
    const endDrag = () => {
      inactivityDragRef.current.dragging = false;
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', endDrag);
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', endDrag);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', endDrag);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', endDrag);
    };
  }, []);

  const renderInactivityCounter = () => {
    if (!showInactivityCounter || !currentUser || !hasGlobalLock || mode === 'identification') return null;

    const isWarning = inactivityRemainingSeconds <= 60;
    return (
      <div
        ref={inactivityCounterRef}
        onMouseDown={(event) => startInactivityCounterDrag(event.clientX, event.clientY)}
        onTouchStart={(event) => {
          const touch = event.touches?.[0];
          if (!touch) return;
          startInactivityCounterDrag(touch.clientX, touch.clientY);
        }}
        style={{
          position: 'fixed',
          top: `${inactivityCounterPosition?.y ?? 12}px`,
          ...(typeof inactivityCounterPosition?.x === 'number'
            ? { left: `${inactivityCounterPosition.x}px` }
            : { right: '12px' }),
          zIndex: 9000,
          backgroundColor: isWarning ? 'rgba(220, 53, 69, 0.95)' : 'rgba(23, 162, 184, 0.95)',
          color: '#fff',
          borderRadius: '10px',
          padding: '10px 14px',
          fontFamily: 'Roboto, sans-serif',
          fontSize: '13px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
          minWidth: '220px',
          textAlign: 'center',
          cursor: 'move',
          userSelect: 'none'
        }}
      >
        <div style={{ fontWeight: '700', marginBottom: '4px' }}>
          {isWarning ? '⚠️ Déconnexion imminente' : '🕒 Inactivité'}
        </div>
        <div style={{ fontSize: '12px', opacity: 0.95 }}>
          Déconnexion auto + sauvegarde dans
        </div>
        <div style={{ fontSize: '20px', fontWeight: '800', letterSpacing: '1px' }}>
          {formatMmSs(inactivityRemainingSeconds)}
        </div>
      </div>
    );
  };

  const renderContrastToggle = () => (
    <button
      type="button"
      className={`contrast-toggle-button ${highContrastMode ? 'is-active' : ''}`}
      onClick={() => setHighContrastMode((prev) => !prev)}
      title={highContrastMode ? 'Désactiver le contraste élevé' : 'Activer le contraste élevé'}
    >
      {highContrastMode ? '🎨 Contraste: Fort' : '🎨 Contraste: Normal'}
    </button>
  );

  const handleClearLocalStorage = () => {
    if (window.confirm('Êtes-vous sûr de vouloir effacer toutes les données ? Cette action ne peut pas être annulée.')) {
      localStorage.clear();
      setPlanningData(createNewPlanningData());
      setMode('startup');
      setCurrentStep(1);
      setCurrentShopIndex(0);
      setSelectedShop('');
      setSelectedWeek('');
      setSelectedEmployees([]);
      setPlanning({});
      setFeedback('Données effacées avec succès !');
    }
  };

  // Gestion de la création de boutiques
  const handleShopsCreated = (shops) => {
    let newPlanningData = planningData;
    shops.forEach(shop => {
      newPlanningData = addShop(newPlanningData, shop);
    });
    setPlanningData(newPlanningData);
    setCurrentStep(2);
  };

  // Gestion de la configuration des boutiques
  const handleShopConfigUpdate = (shopId, config) => {
    setPlanningData(prev => updateShopConfig(prev, shopId, config));
  };

  const handleShopConfigNext = () => {
    if (currentShopIndex < planningData.shops.length - 1) {
      setCurrentShopIndex(currentShopIndex + 1);
    } else {
      setCurrentStep(3);
    }
  };

  const handleShopConfigBack = () => {
    if (currentShopIndex > 0) {
      setCurrentShopIndex(currentShopIndex - 1);
    } else {
      setCurrentStep(1);
    }
  };

  const handleBackToStartup = () => {
    if (window.confirm('⚠️ ATTENTION : Retour à l\'écran de démarrage\n\nUne sauvegarde automatique sera effectuée avant le reset.\n\nÊtes-vous sûr de vouloir continuer ?')) {
      try {
        // Sauvegarde automatique avant reset
        if (planningData && Object.keys(planningData.shops || {}).length > 0) {
          const exportData = {
            ...planningData,
            exportDate: new Date().toISOString(),
            autoBackup: true
          };
          
          const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: 'application/json'
          });
          
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `planning_backup_${format(new Date(), 'yyyy-MM-dd_HHmmss')}.json`;
          a.click();
          
          URL.revokeObjectURL(url);
          setFeedback('Sauvegarde automatique effectuée avant reset !');
        }
        
        // Réinitialiser les données
        setPlanningData(createNewPlanningData());
        setSelectedShop('');
        setSelectedWeek('');
        setSelectedEmployees([]);
        setPlanning({});
        setMode('startup');
        setCurrentStep(1);
        setCurrentShopIndex(0);
        setFeedback('Application réinitialisée avec sauvegarde automatique !');
      } catch (error) {
        console.error('Erreur lors de la sauvegarde automatique:', error);
        setFeedback('Erreur lors de la sauvegarde automatique, mais reset effectué.');
      }
    }
  };

  // Nouvelles fonctions de navigation pour les modules
  const handleSelectPlanning = () => {
    if (!selectedShop && planningData?.shops?.length > 0) {
      setSelectedShop(resolvePreferredShopId(currentUser, planningData));
    }
    setMode('startup'); // Retour à l'écran de démarrage du planning
  };

  const [schoolModeReturnMode, setSchoolModeReturnMode] = useState('main-startup');

  const handleOpenSchoolMode = () => {
    setSchoolModeReturnMode(mode);
    setMode('school-mode');
  };



  const handleBackToMain = () => {
    setMode('main-startup');
  };

  // Gestion des employés
  const handleEmployeeUpdate = (employeeData) => {
    if (employeeData.type === 'updateShops') {
      setPlanningData(prev => {
        const updated = updateEmployeeShops(prev, employeeData.employeeId, employeeData.shopId, employeeData.canWork);
        console.log('Updated planning data:', updated);
        return updated;
      });
    } else if (employeeData.type === 'deleteEmployee') {
      // Supprimer un employé de toutes les boutiques
      setPlanningData(prev => {
        const updated = {
          ...prev,
          shops: prev.shops.map(shop => ({
            ...shop,
            employees: shop.employees.filter(emp => emp.id !== employeeData.employeeId)
          }))
        };
        console.log('Deleted employee, updated data:', updated);
        return updated;
      });
    } else if (employeeData.type === 'deleteAllEmployees') {
      // Supprimer tous les employés de toutes les boutiques
      setPlanningData(prev => {
        const updated = {
          ...prev,
          shops: prev.shops.map(shop => ({
            ...shop,
            employees: []
          }))
        };
        console.log('Deleted all employees, updated data:', updated);
        return updated;
      });
    } else {
      setPlanningData(prev => {
        const updated = addEmployee(prev, employeeData);
        console.log('Added employee, updated data:', updated);
        return updated;
      });
    }
  };

  const handleEmployeeManagementNext = (selectedEmployees) => {
    // Stocker les employés sélectionnés pour l'étape d'affectation
    setSelectedEmployees(selectedEmployees);
    setCurrentStep(4); // Passer à l'étape d'affectation
  };

  const handleEmployeeAssignmentNext = () => {
    console.log('handleEmployeeAssignmentNext - planningData:', planningData);
    
    try {
      // Initialiser les valeurs par défaut pour le planning
      if (planningData.shops && planningData.shops.length > 0) {
        const firstShop = planningData.shops.find((shop) => shop.id === resolvePreferredShopId(currentUser, planningData)) || planningData.shops[0];
        console.log('Première boutique:', firstShop);
        
        if (firstShop && firstShop.id) {
          setSelectedShop(firstShop.id);
        }
        
        if (firstShop && firstShop.config) {
          console.log('Configuration de la boutique:', firstShop.config);
          console.log('TimeSlots de la boutique:', firstShop.config.timeSlots);
          console.log('Longueur des timeSlots:', firstShop.config.timeSlots?.length);
        }
      }
      
      // Initialiser la semaine courante
      const currentWeek = getCurrentWeekKey();
      setSelectedWeek(currentWeek);
      
      // Initialiser les employés sélectionnés (employés affectés à la première boutique)
      const preferredShop = planningData.shops?.find((shop) => shop.id === resolvePreferredShopId(currentUser, planningData))
        || planningData.shops?.[0];
      if (preferredShop && preferredShop.employees && preferredShop.employees.length > 0) {
        const firstShop = preferredShop;
        console.log('Boutique par défaut utilisateur:', firstShop);
        console.log('Tous les employés de la boutique par défaut:', firstShop.employees);
        
        const firstShopEmployees = firstShop.employees
          .filter(emp => emp && emp.id && emp.canWorkIn && emp.canWorkIn.includes(firstShop.id)) // Filtrer les employés affectés à cette boutique
          .map(emp => emp.id);
        console.log('Employés affectés à la première boutique:', firstShopEmployees);
        
        // Si aucun employé n'est affecté, prendre tous les employés (fallback)
        if (firstShopEmployees.length === 0) {
          console.log('Aucun employé affecté, prise de tous les employés comme fallback');
          const allEmployees = firstShop.employees
            .filter(emp => emp && emp.id)
            .map(emp => emp.id);
          setSelectedEmployees(allEmployees);
        } else {
          setSelectedEmployees(firstShopEmployees);
        }
      } else {
        setSelectedEmployees([]); // Initialiser avec un tableau vide si pas d'employés
      }
      
      setMode('week-selection');
      setFeedback('Configuration terminée ! Veuillez sélectionner une semaine pour commencer votre planning.');
    } catch (error) {
      console.error('Erreur dans handleEmployeeAssignmentNext:', error);
      setFeedback('Erreur lors de la configuration. Veuillez réessayer.');
    }
  };

  // Gestion du planning
  const handleExport = (exportContext = {}) => {
    try {
      const exportMonthDefault =
        selectedWeek && /^\d{4}-\d{2}-\d{2}$/.test(selectedWeek)
          ? selectedWeek.slice(0, 7)
          : format(new Date(), 'yyyy-MM');
      // Ouvrir un sélecteur de mois via une petite modale
      const containerId = 'export-month-modal';
      let container = document.getElementById(containerId);
      if (container) container.remove();
      container = document.createElement('div');
      container.id = containerId;
      container.style.position = 'fixed';
      container.style.inset = '0';
      container.style.background = 'rgba(0,0,0,0.4)';
      container.style.display = 'flex';
      container.style.alignItems = 'center';
      container.style.justifyContent = 'center';
      container.innerHTML = `
        <div style="background:#fff;padding:16px 20px;border-radius:8px;min-width:340px;font-family:Roboto, sans-serif">
          <div style="font-weight:700;margin-bottom:6px;font-size:14px">Excel planning global</div>
          <div style="font-size:11px;color:#546e7a;line-height:1.45;margin-bottom:12px">
            Export séparé du bouton « Exporter en Excel » dans une fiche employé (mensuel détaillé).
            Celui-ci génère le fichier « planning_detaille_mois_<année>-<mois>_… », avec toutes les boutiques et plusieurs feuilles.
          </div>
          <div style="display:flex;gap:10px;align-items:center">
            <label for="export-month-input" style="min-width:90px;font-size:12px">Mois:</label>
            <input id="export-month-input" type="month" style="flex:1;padding:6px 8px;font-size:12px" value="${exportMonthDefault}" />
          </div>
          <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
            <button id="export-month-cancel" style="padding:6px 10px;font-size:12px;background:#eee;border:1px solid #ccc;border-radius:4px;cursor:pointer">Annuler</button>
            <button id="export-month-ok" style="padding:6px 10px;font-size:12px;background:#1e88e5;color:#fff;border:1px solid #1565c0;border-radius:4px;cursor:pointer">Exporter</button>
          </div>
        </div>`;
      document.body.appendChild(container);

      const cleanup = () => {
        const el = document.getElementById(containerId);
        if (el) el.remove();
      };

      document.getElementById('export-month-cancel').onclick = cleanup;
      document.getElementById('export-month-ok').onclick = () => {
        const value = /** @type {HTMLInputElement} */(document.getElementById('export-month-input')).value;
        if (!value) { cleanup(); return; }
        const [y, m] = value.split('-').map(Number);
        const monthDate = new Date(y, m - 1, 1);
        cleanup();
        const ok = exportPlanningToExcel(planningData, {
          monthDate,
          currentShopId: exportContext.currentShopId || selectedShop,
          currentWeekKey: exportContext.currentWeekKey || selectedWeek,
          currentWeekPlanning: exportContext.currentWeekPlanning || planning,
          currentEmployees: exportContext.currentEmployees || selectedEmployees,
        });
        if (ok === true) {
          setFeedback('📊 Export Excel planning global téléchargé (toutes boutiques, fichier planning_detaille_mois…). Pour un employé : utiliser Exporter en Excel dans le récap mensuel détaillé.');
        } else {
          setFeedback('❌ Échec export Excel');
        }
      };
    } catch (error) {
      console.error('Erreur lors de l\'export Excel:', error);
      setFeedback('❌ Échec export Excel');
    }
  };

  const handleReset = () => {
    // ⚡ CLEAR TOTAL DE TOUT LE LOCALSTORAGE (sauf l'utilisateur connecté)
    console.log('🧹 CLEAR TOTAL - Nettoyage complet du localStorage...');
    const currentUser = localStorage.getItem('current_user'); // Sauvegarder l'utilisateur
    const userId = localStorage.getItem('user_id'); // Sauvegarder l'ID utilisateur
    
    // Supprimer TOUTES les clés du localStorage
    localStorage.clear();
    
    // Restaurer uniquement l'utilisateur et son ID
    if (currentUser) localStorage.setItem('current_user', currentUser);
    if (userId) localStorage.setItem('user_id', userId);
    
    console.log('✅ localStorage nettoyé - Seul l\'utilisateur est préservé');
    
    // Réinitialiser l'application
    setPlanningData(createNewPlanningData());
    setMode('startup');
    setCurrentStep(1);
    setCurrentShopIndex(0);
    setFeedback('Application réinitialisée avec nettoyage complet du localStorage');
  };

  // Fonctions de navigation pour PlanningDisplay
  const handleBackToEmployees = () => {
    // Accès direct à la gestion des employés depuis le planning → réservé au code administrateur
    if (!requirePrimaryAdmin('accéder à la gestion des employés')) {
      return;
    }
    setMode('new');
    setCurrentStep(4); // Étape de gestion des employés
  };

  const handleBackToShopSelection = () => {
    // Rediriger vers la création de boutiques pour permettre l'ajout de nouvelles boutiques
    setMode('new');
    setCurrentStep(1); // Étape de création des boutiques
  };

  const handleBackToShopManagement = () => {
    // Rediriger vers la sélection de boutiques existantes
    setMode('startup');
  };

  const handleBackToWeekSelection = () => {
    // S'assurer qu'une boutique est sélectionnée
    if (!selectedShop && planningData.shops && planningData.shops.length > 0) {
      setSelectedShop(resolvePreferredShopId(currentUser, planningData));
    }
    setMode('week-selection');
  };

  const handleBackToConfig = () => {
    // Accès direct à la configuration des boutiques → réservé au code administrateur
    if (!requirePrimaryAdmin('accéder à la configuration des boutiques')) {
      return;
    }
    setMode('new');
    setCurrentStep(2); // Étape de configuration des boutiques
  };



  // Rendu conditionnel
  if (mode === 'main-startup') {
    return (
      <ErrorBoundary>
        {renderContrastToggle()}
        {renderInactivityCounter()}
        <MainStartupScreen 
          onSelectPlanning={handleSelectPlanning}
          onOpenSchoolMode={handleOpenSchoolMode}
        />
        <CopyrightNotice />
        <VersionBadge />
      </ErrorBoundary>
    );
  }

  if (mode === 'school-mode') {
    return (
      <ErrorBoundary>
        {renderContrastToggle()}
        <SchoolModeViewer onBack={() => setMode(schoolModeReturnMode || 'main-startup')} />
        <VersionBadge />
      </ErrorBoundary>
    );
  }

  if (mode === 'startup') {
    return (
      <ErrorBoundary>
        {renderContrastToggle()}
        {renderInactivityCounter()}
                  <StartupScreen
            onNewPlanning={handleNewPlanning}
            onImportPlanning={handleImportPlanning}
            onExit={handleExit}
            onClearLocalStorage={handleClearLocalStorage}
            onRestoreFromSupabase={handleRestoreFromSupabase}
            onRestoreBackupFromHistory={handleRestoreBackupFromHistory}
            onContinueWithLocalData={handleContinueWithLocalData}
            onOpenSchoolMode={handleOpenSchoolMode}
            hasLocalData={planningData && planningData.shops && planningData.shops.length > 0}
          />
        <CopyrightNotice />
        <VersionBadge />
        {/* <LicenseModal
          isOpen={showLicenseModal}
          onClose={() => setShowLicenseModal(false)}
          error={licenseError}
          onLicenseValid={handleLicenseValid}
        /> */}
      </ErrorBoundary>
    );
  }

  if (mode === 'new') {
    return (
      <ErrorBoundary>
        {renderContrastToggle()}
        {renderInactivityCounter()}
        <div className="app-container">
          {feedback && (
            <p style={{ 
              fontFamily: 'Roboto, sans-serif', 
              textAlign: 'center', 
              color: feedback.includes('Succès') ? '#4caf50' : '#e53935', 
              marginBottom: '10px' 
            }}>
              {feedback}
            </p>
          )}
          
          {currentStep === 1 && (
            <ShopCreation 
              onShopsCreated={handleShopsCreated}
              onBack={handleBackToStartup}
            />
          )}
          
          {currentStep === 2 && planningData.shops[currentShopIndex] && (
            <ShopConfig
              shop={planningData.shops[currentShopIndex]}
              onConfigUpdate={handleShopConfigUpdate}
              onNext={handleShopConfigNext}
              onBack={handleBackToStartup}
            />
          )}
          
          {currentStep === 3 && (
            <EmployeeManagement
              planningData={planningData}
              onEmployeeUpdate={handleEmployeeUpdate}
              onNext={handleEmployeeManagementNext}
              onBack={handleBackToStartup}
            />
          )}
          
          {currentStep === 4 && (
            <EmployeeAssignment
              planningData={planningData}
              onEmployeeUpdate={handleEmployeeUpdate}
              onNext={handleEmployeeAssignmentNext}
              onBack={() => setCurrentStep(3)}
              selectedEmployeesFromPrevious={selectedEmployees}
            />
          )}
          <CopyrightNotice />
        </div>
        {/* <LicenseModal
          isOpen={showLicenseModal}
          onClose={() => setShowLicenseModal(false)}
          error={licenseError}
          onLicenseValid={handleLicenseValid}
        /> */}
      </ErrorBoundary>
    );
  }

  if (mode === 'week-selection') {
    return (
      <ErrorBoundary>
        {renderContrastToggle()}
        {renderInactivityCounter()}
        <div className="app-container">
          {feedback && (
            <p style={{ 
              fontFamily: 'Roboto, sans-serif', 
              textAlign: 'center', 
              color: feedback.includes('Succès') ? '#4caf50' : '#e53935', 
              marginBottom: '10px' 
            }}>
              {feedback}
            </p>
          )}
          {restoredInfo && (
            <div style={{
              margin: '0 0 10px 0',
              padding: '10px 14px',
              backgroundColor: '#e3f2fd',
              color: '#0d47a1',
              border: '1px solid #90caf9',
              borderRadius: '6px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontFamily: 'Roboto, sans-serif'
            }}>
              <span>{restoredInfo}</span>
              <button onClick={() => setRestoredInfo('')} style={{
                background: 'transparent',
                border: 'none',
                color: '#0d47a1',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}>✕</button>
            </div>
          )}
          
          <WeekSelection
            onNext={(week) => {
              setSelectedWeek(week);
              
              // DÉSACTIVÉ : Charger les données de la semaine sélectionnée (ÉVITE L'ÉCRASEMENT)
              // if (planningData && selectedShop) {
              //   (async () => {
              //     // Tentative de chargement distant
              //     const remote = await loadRemotePlanning(selectedShop, week);
              //     
              //     // Récupérer les données locales
              //     const shop = planningData.shops.find(s => s.id === selectedShop);
              //     const localWeekData = shop && shop.weeks && shop.weeks[week] ? shop.weeks[week] : null;
              //     
              //     // Comparer les timestamps pour choisir les données les plus récentes
              //     if (remote && remote.planning && localWeekData && localWeekData.planning) {
              //       const remoteTimestamp = remote.updated_at || remote.created_at || 0;
              //       const localTimestamp = localWeekData.updated_at || localWeekData.created_at || 0;
              //       
              //       if (localTimestamp > remoteTimestamp) {
              //         console.log('📊 Données locales plus récentes, utilisation des données locales');
              //         setPlanning(localWeekData.planning);
              //         if (localWeekData.selectedEmployees) setSelectedEmployees(localWeekData.selectedEmployees);
              //       } else {
              //         console.log('📊 Données distantes plus récentes, utilisation des données distantes');
              //         setPlanning(remote.planning);
              //         if (remote.selectedEmployees) setSelectedEmployees(remote.selectedEmployees);
              //       }
              //     } else if (remote && remote.planning) {
              //       console.log('📊 Utilisation des données distantes (pas de données locales)');
              //       setPlanning(remote.planning);
              //       if (remote.selectedEmployees) setSelectedEmployees(remote.selectedEmployees);
              //     } else if (localWeekData && localWeekData.planning) {
              //       console.log('📊 Utilisation des données locales (pas de données distantes)');
              //       setPlanning(localWeekData.planning);
              //       if (localWeekData.selectedEmployees) setSelectedEmployees(localWeekData.selectedEmployees);
              //     }
              //   })();
              // }
              
              setMode('planning');
            }}
            onBack={handleBackToStartup}
            onReset={() => {
              setSelectedWeek('');
              setSelectedEmployees([]);
              setPlanning({});
            }}
            selectedWeek={selectedWeek}
            selectedShop={selectedShop}
            planningData={planningData}
            onChangeShop={(shopId) => {
              setSelectedShop(shopId);
            }}
          />
          <CopyrightNotice />
        </div>
        {/* <LicenseModal
          isOpen={showLicenseModal}
          onClose={() => setShowLicenseModal(false)}
          error={licenseError}
          onLicenseValid={handleLicenseValid}
        /> */}
      </ErrorBoundary>
    );
  }



  if (mode === 'planning') {
    return (
      <ErrorBoundary>
        {renderContrastToggle()}
        {renderInactivityCounter()}
        <div className="app-container">
          {feedback && (
            <p style={{ 
              fontFamily: 'Roboto, sans-serif', 
              textAlign: 'center', 
              color: feedback.includes('Succès') ? '#4caf50' : '#e53935', 
              marginBottom: '10px' 
            }}>
              {feedback}
            </p>
          )}
          {restoredInfo && (
            <div style={{
              margin: '0 0 10px 0',
              padding: '10px 14px',
              backgroundColor: '#e3f2fd',
              color: '#0d47a1',
              border: '1px solid #90caf9',
              borderRadius: '6px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontFamily: 'Roboto, sans-serif'
            }}>
              <span>{restoredInfo}</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => { setMode('week-selection'); }} style={{
                  backgroundColor: '#1976d2',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '6px 10px',
                  cursor: 'pointer'
                }}>Revenir à la sélection</button>
                <button onClick={() => setRestoredInfo('')} style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#0d47a1',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}>✕</button>
              </div>
            </div>
          )}
          
                      <PlanningDisplay
              planningData={planningData}
              setPlanningData={setPlanningData}
              selectedShop={selectedShop}
              setSelectedShop={setSelectedShop}
              selectedWeek={selectedWeek}
              setSelectedWeek={setSelectedWeek}
              selectedEmployees={selectedEmployees}
              setSelectedEmployees={setSelectedEmployees}
              planning={planning}
              setPlanning={setPlanning}
              onExport={handleExport}
              onImport={handleImportPlanning}
              onReset={handleReset}
              onBackToStartup={handleBackToStartup}
              onBackToEmployees={handleBackToEmployees}
              onBackToShopSelection={handleBackToShopSelection}
              onBackToShopManagement={handleBackToShopManagement}
              onBackToWeekSelection={handleBackToWeekSelection}
              onBackToConfig={handleBackToConfig}
              onOpenSchoolMode={handleOpenSchoolMode}
              setFeedback={setFeedback}
              onRestoreFromSupabase={handleRestoreFromSupabase}
              onRestoreBackupFromHistory={handleRestoreBackupFromHistory}
              onExitApplication={handleExit}
            />
          <CopyrightNotice />
        </div>
        {/* <LicenseModal
          isOpen={showLicenseModal}
          onClose={() => setShowLicenseModal(false)}
          error={licenseError}
          onLicenseValid={handleLicenseValid}
        /> */}
      </ErrorBoundary>
    );
  }

  // Mode gestionnaire de licences
  if (showLicenseManager) {
    return (
      <ErrorBoundary>
        {renderContrastToggle()}
        <LicenseManager />
        <CopyrightNotice />
      </ErrorBoundary>
    );
  }

  // Mode identification
  if (mode === 'identification') {
    return (
      <ErrorBoundary>
        {renderContrastToggle()}
        <UserIdentificationModal 
          onIdentification={handleUserIdentification}
          onCancel={handleIdentificationCancel}
          lockCountdownSeconds={lockCountdownSeconds}
          lockOwnerText={lockOwnerText}
          onEmergencyUnlock={handleEmergencyUnlock}
        />
      </ErrorBoundary>
    );
  }

  return null;
};

export default App;
