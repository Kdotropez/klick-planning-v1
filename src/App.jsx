import { useState, useEffect, useRef } from 'react';
import { format, startOfWeek, addDays, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
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
  importPlanningData,
  mergeShopWeekFromBackup,
  mergeShopFromBackup,
  listShopWeeksWithData,
  getPlanningDataStats,
  validateTargetedMergeSafe,
  getShopWeekBrief,
  getShopWeekBriefWithAliases,
  normalizeCompletePlanningData
} from './utils/planningDataManager.js';
import './App.css';
import {
  loadRemotePlanning,
  saveCompletePlanningData,
  listCompletePlanningBackups,
  loadCompletePlanningBackupByWeekKey,
  getCurrentCompleteBackupInfo,
  loadCompletePlanningData,
  probeSupabaseDatabaseHealth,
  findHistoricalBackupsWithShopWeek,
  getGlobalBackupTimeline,
  inspectShopWeekInventory,
  getSupabaseBackupDiagnostics,
  listShopWeekArchiveEntries,
  listRemoteShops,
  getLastCompleteFileLoadStats,
  COMPLETE_FILE_PAYLOAD_WARN_BYTES
} from './utils/remoteStore';
import { addAuditLog } from './utils/auditLog';
import { versionChecker } from './utils/versionChecker';
import {
  initLockService,
  acquireLock,
  releaseLock,
  heartbeat,
  getLock,
  cleanupExpiredLocks,
  emergencyUnlock
} from './utils/collabLock';
import {
  PRIMARY_ADMIN_CODE,
  pullUserCodesFromSupabase,
  enrichUserSession,
  filterShopsForUser,
  canUserAccessShop,
  getSaveMergeOptionsForUser,
  checkUserPermission
} from './config/userCodes';

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
  const mergeShopJsonInputRef = useRef(null);
  const heartbeatFailCountRef = useRef(0);
  const bootstrapBackgroundSyncRef = useRef(false);
  const retrySupabaseStartupSyncRef = useRef(null);
  const BOOTSTRAP_REMOTE_TIMEOUT_MS = 5000;
  const BOOTSTRAP_PER_ATTEMPT_TIMEOUT_MS = 70000;
  const BOOTSTRAP_LOAD_ATTEMPTS = 3;
  // TTL verrou global (allongé pour limiter les déconnexions pendant SAUVE SUPABASE)
  const GLOBAL_LOCK_TTL_MS = 3 * 60 * 1000;
  const GLOBAL_HEARTBEAT_MS = 25 * 1000;
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
  const [isBootstrapComplete, setIsBootstrapComplete] = useState(false);
  const [supabaseSessionOffline, setSupabaseSessionOffline] = useState(false);
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
    const allowedShops = filterShopsForUser(user?.code, data?.shops || []);
    if (!allowedShops.length) return '';

    const userName = normalizeToken(user?.name);
    const userCode = normalizeToken(user?.code);

    const preferredAlias = Object.entries(USER_DEFAULT_SHOP_ALIASES).find(([alias]) =>
      userName.includes(alias) || userCode.includes(alias)
    )?.[1];

    if (!preferredAlias) return allowedShops[0]?.id || '';

    const target = normalizeToken(preferredAlias);
    const match = allowedShops.find((shop) => {
      const idToken = normalizeToken(shop?.id);
      const nameToken = normalizeToken(shop?.name);
      return idToken === target || nameToken === target || idToken.includes(target) || nameToken.includes(target);
    });

    return match?.id || allowedShops[0]?.id || '';
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

    const holderId = getLockHolderId(user);
    const hasSupabaseConfig = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_KEY);

    if (hasSupabaseConfig) {
      initGlobalLock();
      try {
        await withTimeout(cleanupExpiredLocks(GLOBAL_LOCK_TTL_MS), 5000, 'Nettoyage verrous Supabase');
        const result = await withTimeout(
          acquireLock(holderId, GLOBAL_LOCK_TTL_MS),
          8000,
          'Acquisition verrou Supabase'
        );
        if (result?.ok) {
          return { ok: true, offline: false };
        }
        if (result?.lock && result.lock.user_id !== holderId) {
          return { ok: false, reason: 'locked-by-other', lock: result.lock };
        }
        return { ok: false, reason: 'supabase-lock-unavailable' };
      } catch (error) {
        console.warn('⚠️ Verrou Supabase indisponible:', error);
        return { ok: false, reason: 'supabase-lock-unavailable' };
      }
    }

    initLockService({ url: null, key: null });
    try {
      const localResult = await acquireLock(holderId, GLOBAL_LOCK_TTL_MS);
      if (localResult?.ok) {
        return { ok: true, offline: true };
      }
      if (localResult?.lock && localResult.lock.user_id !== holderId) {
        return { ok: false, reason: 'locked-by-other', lock: localResult.lock };
      }
    } catch (error) {
      console.error('❌ Erreur verrou local:', error);
    }

    return { ok: false, reason: 'lock-error' };
  };

  const isValidPlanningPayload = (data) =>
    !!(data && Array.isArray(data.shops) && data.shops.length > 0);

  const loadLocalPlanningFallback = () => {
    try {
      const stored = JSON.parse(localStorage.getItem('planningData') || 'null');
      if (!isValidPlanningPayload(stored)) return null;
      return normalizeCompletePlanningData(stored);
    } catch (_) {
      return null;
    }
  };

  const withTimeout = (promise, ms, label = 'operation') =>
    Promise.race([
      promise,
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`${label} timeout (${ms}ms)`)), ms);
      })
    ]);

  // Charger la version commune depuis Supabase au démarrage
  useEffect(() => {
    const applyPlanningPayload = (payload, { persist = true } = {}) => {
      const normalized = normalizeCompletePlanningData(payload);
      setPlanningData(normalized);
      if (persist) {
        localStorage.setItem('planningData', JSON.stringify(normalized));
      }
      return normalized;
    };

    const syncRemotePlanningInBackground = () => {
      if (bootstrapBackgroundSyncRef.current) return;
      bootstrapBackgroundSyncRef.current = true;

      const finishBackgroundSync = async (remoteData, ok, failureHint = '') => {
        if (ok && isValidPlanningPayload(remoteData)) {
          applyPlanningPayload(remoteData);
          try {
            localStorage.removeItem('planning_prefer_local_until_save');
          } catch (_) {}
          setRestoredInfo('☁️ Version commune Supabase chargée — connexion autorisée.');
          const loadStats = getLastCompleteFileLoadStats();
          const sizeNote =
            loadStats?.bytes > COMPLETE_FILE_PAYLOAD_WARN_BYTES
              ? ` ⚠️ Fichier cloud lourd (~${(loadStats.bytes / (1024 * 1024)).toFixed(1)} Mo) — privilégiez une sauvegarde à la fois si Supabase ralentit.`
              : '';
          setFeedback(`✅ Planning synchronisé depuis le cloud (même version que les autres postes).${sizeNote}`);
          console.log('✅ Sync Supabase arrière-plan terminée.');
          setIsSupabaseStartupReady(true);
          return;
        }

        const hasConfig = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_KEY);
        let detail = failureHint;
        if (!detail) {
          if (!hasConfig) {
            detail = 'Configuration Supabase absente sur ce déploiement (VITE_SUPABASE_URL / VITE_SUPABASE_KEY).';
          } else if (!remoteData) {
            detail =
              'Aucune réponse valide du cloud (réseau, timeout, ou table plannings vide / RLS).';
          } else {
            detail = 'Données cloud reçues mais invalides (aucune boutique).';
          }
        }
        if (hasConfig) {
          const probe = await probeSupabaseDatabaseHealth(25000);
          if (!probe.ok && probe.hint) {
            detail = probe.hint;
          }
        }
        if (!loadLocalPlanningFallback()) {
          detail += ' Pas de copie locale (fréquent juste après une mise à jour qui vide le cache).';
        }

        setRestoredInfo(`❌ Supabase inaccessible — ${detail} Utilisez « Réessayer Supabase » après avoir réactivé le projet.`);
        setFeedback('⚠️ Connexion bloquée tant que le cloud ne charge pas.');
        console.warn('⚠️ Sync Supabase arrière-plan: pas de version cloud valide.', detail);
        setIsSupabaseStartupReady(false);
      };

      const loadPlanningWithPerAttemptRetries = async () => {
        let lastResult = null;
        let lastError = null;
        for (let attempt = 1; attempt <= BOOTSTRAP_LOAD_ATTEMPTS; attempt += 1) {
          try {
            lastResult = await withTimeout(
              loadCompletePlanningData({ skipNormalize: true }),
              BOOTSTRAP_PER_ATTEMPT_TIMEOUT_MS,
              `Sync Supabase (tentative ${attempt}/${BOOTSTRAP_LOAD_ATTEMPTS})`
            );
            if (isValidPlanningPayload(lastResult)) {
              return lastResult;
            }
          } catch (error) {
            lastError = error;
            console.warn(`⚠️ Tentative ${attempt}/${BOOTSTRAP_LOAD_ATTEMPTS} échouée:`, error);
          }
          if (attempt < BOOTSTRAP_LOAD_ATTEMPTS) {
            await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
          }
        }
        if (lastError) throw lastError;
        return lastResult;
      };

      loadPlanningWithPerAttemptRetries()
        .then((remoteData) => {
          finishBackgroundSync(remoteData, isValidPlanningPayload(remoteData));
        })
        .catch((error) => {
          console.warn('⚠️ Sync Supabase arrière-plan impossible:', error);
          const hint = String(error?.message || '').includes('timeout')
            ? 'Délai dépassé — la base Supabase met trop de temps à répondre (souvent projet en pause ou erreur 522).'
            : '';
          finishBackgroundSync(null, false, hint);
        });
    };

    retrySupabaseStartupSyncRef.current = () => {
      bootstrapBackgroundSyncRef.current = false;
      syncRemotePlanningInBackground();
    };

    const bootstrapFromSupabase = async () => {
      try {
      pullUserCodesFromSupabase().catch((error) => {
        console.warn('⚠️ Préchargement des codes utilisateurs impossible:', error);
      });

      const versionChanged = checkVersion();
      logVersionInfo();
      
      if (versionChanged) {
        return;
      }

      versionChecker.init().catch(error => {
        console.error('❌ Erreur initialisation VersionChecker:', error);
      });

      localStorage.removeItem('current_user');
      localStorage.removeItem('user_id');
      setCurrentUser(null);
      setHasGlobalLock(false);
      setIsSupabaseStartupReady(false);
      setMode('identification');

      const localFallback = loadLocalPlanningFallback();
      try {
        localStorage.removeItem('planning_prefer_local_until_save');
      } catch (_) {}

      const openReady = (info, feedback, ready = true) => {
        setIsSupabaseStartupReady(ready);
        setIsBootstrapComplete(true);
        setRestoredInfo(info);
        if (feedback) setFeedback(feedback);
      };

      // Supabase = vérité commune : toujours synchroniser avant connexion (la copie locale n'est pas affichée comme source).
      setIsBootstrapComplete(true);
      openReady(
        '⏳ Chargement de la version commune Supabase…',
        localFallback
          ? 'ℹ️ La copie de ce navigateur est ignorée au démarrage — attente du cloud (comme sur les autres postes).'
          : 'ℹ️ Patientez avant de vous connecter.',
        false
      );
      if (localFallback) {
        console.log('ℹ️ Copie locale présente mais non utilisée au démarrage — sync Supabase obligatoire.');
      }
      const hasSupabaseConfig = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_KEY);
      if (!hasSupabaseConfig) {
        openReady(
          '❌ Supabase non configuré sur ce déploiement (VITE_SUPABASE_URL / VITE_SUPABASE_KEY).',
          'Connexion bloquée — vérifiez les variables sur Vercel.',
          false
        );
        return;
      }
      syncRemotePlanningInBackground();
      } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
        setIsBootstrapComplete(true);
        setIsSupabaseStartupReady(false);
        setMode('identification');
        setRestoredInfo('⚠️ Erreur au démarrage — nouvelle tentative de sync Supabase…');
        setFeedback('ℹ️ Connexion bloquée tant que le cloud n’est pas chargé.');
        syncRemotePlanningInBackground();
      } finally {
        setIsBootstrapComplete(true);
      }
    };

    bootstrapFromSupabase();
  }, []);

  useEffect(() => {
    if (!isBootstrapComplete) return;
    const timer = setTimeout(() => {
      try {
        showVersionHighlightsOnce();
      } catch (error) {
        console.warn('Nouveautés version:', error);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [isBootstrapComplete]);

  // Sauvegarder les données dans localStorage (après bootstrap Supabase, jamais avec un planning vide)
  useEffect(() => {
    if (!isBootstrapComplete) return;
    if (mode !== 'startup') {
      if (!Array.isArray(planningData?.shops) || planningData.shops.length === 0) return;
      saveToLocalStorage('planningData', planningData);
    }
  }, [planningData, mode, isBootstrapComplete]);

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
        const saveResult = await saveCompletePlanningData(
          planningData,
          getSaveMergeOptionsForUser(currentUser)
        );
        saveSucceeded = !!saveResult?.ok;
        if (saveResult?.ok && saveResult.preservedShopIds?.length && saveResult.planningData) {
          setPlanningData(saveResult.planningData);
          localStorage.setItem('planningData', JSON.stringify(saveResult.planningData));
        }
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
    if (!currentUser || !hasGlobalLock || supabaseSessionOffline) return undefined;

    const holderId = getLockHolderId(currentUser);

    const intervalId = setInterval(async () => {
      try {
        const lock = await getLock();

        if (lock?.user_id && lock.user_id !== holderId) {
          heartbeatFailCountRef.current = 0;
          alert(
            'La session a perdu le verrou global (un autre poste a repris la main).\n\n' +
            'Vous allez être redirigé vers l’identification.'
          );
          localStorage.removeItem('current_user');
          localStorage.removeItem('user_id');
          setCurrentUser(null);
          setHasGlobalLock(false);
          setMode('identification');
          setFeedback('❌ Session verrouillée perdue. Veuillez vous reconnecter.');
          return;
        }

        const hbResult = await heartbeat(holderId);
        if (hbResult?.ok) {
          heartbeatFailCountRef.current = 0;
          return;
        }

        initGlobalLock();
        const renew = await acquireLock(holderId, GLOBAL_LOCK_TTL_MS);
        if (renew?.ok) {
          heartbeatFailCountRef.current = 0;
          return;
        }

        if (renew?.lock?.user_id && renew.lock.user_id !== holderId) {
          heartbeatFailCountRef.current = 0;
          alert(
            'La session a perdu le verrou global (un autre poste a repris la main).\n\n' +
            'Vous allez être redirigé vers l’identification.'
          );
          localStorage.removeItem('current_user');
          localStorage.removeItem('user_id');
          setCurrentUser(null);
          setHasGlobalLock(false);
          setMode('identification');
          setFeedback('❌ Session verrouillée perdue. Veuillez vous reconnecter.');
          return;
        }

        heartbeatFailCountRef.current += 1;
        if (heartbeatFailCountRef.current < 4) {
          console.warn(
            `⚠️ Heartbeat verrou en échec (${heartbeatFailCountRef.current}/3) — nouvel essai…`
          );
          return;
        }

        alert(
          'Impossible de maintenir le verrou global (Supabase instable).\n\n' +
          'Vos données locales sont conservées. Reconnectez-vous et réessayez SAUVE SUPABASE.\n\n' +
          'Fermez les autres onglets Klick-planning avant de vous reconnecter.'
        );
        localStorage.removeItem('current_user');
        localStorage.removeItem('user_id');
        setCurrentUser(null);
        setHasGlobalLock(false);
        setMode('identification');
        setFeedback('❌ Verrou global perdu (réseau). Reconnectez-vous.');
        heartbeatFailCountRef.current = 0;
      } catch (error) {
        heartbeatFailCountRef.current += 1;
        console.warn('⚠️ Erreur heartbeat verrou:', error);
        if (heartbeatFailCountRef.current >= 4) {
          setFeedback('⚠️ Supabase instable — verrou non confirmé. Évitez SAUVE SUPABASE ou reconnectez-vous.');
          heartbeatFailCountRef.current = 0;
        }
      }
    }, GLOBAL_HEARTBEAT_MS);

    return () => clearInterval(intervalId);
  }, [currentUser, hasGlobalLock, supabaseSessionOffline]);

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
  const handleRetrySupabaseStartup = () => {
    setIsSupabaseStartupReady(false);
    setRestoredInfo('⏳ Nouvelle tentative de chargement Supabase…');
    setFeedback('ℹ️ Patientez — le cloud doit répondre avant connexion.');
    retrySupabaseStartupSyncRef.current?.();
  };

  const handleUserIdentification = async (user) => {
    console.log('🆔 Utilisateur identifié:', user);

    if (!isSupabaseStartupReady) {
      const message =
        'La version commune Supabase n a pas été chargée au démarrage.\n' +
        'Relancez lorsque Supabase est disponible.';
      alert(`❌ Connexion bloquée.\n\n${message}`);
      setFeedback('❌ Connexion bloquée: version commune Supabase non chargée.');
      return { ok: false, message: '❌ Connexion bloquée (données non prêtes).' };
    }

    const lockResult = await acquireGlobalLockForUser(user);
    if (!lockResult.ok) {
      if (lockResult.reason === 'locked-by-other') {
        localStorage.removeItem('current_user');
        localStorage.removeItem('user_id');
        const ownerText = formatLockOwner(lockResult.lock);
        const remainingSeconds = getLockRemainingSeconds(lockResult.lock);
        startLockCountdown(remainingSeconds ?? Math.ceil(GLOBAL_LOCK_TTL_MS / 1000), ownerText);
        return {
          ok: false,
          message: `⛔ Planning utilisé sur ${ownerText || 'un autre poste'}. Attendez ${remainingSeconds ?? '?'} s.`
        };
      }
      if (lockResult.reason === 'supabase-lock-unavailable') {
        const probe = await probeSupabaseDatabaseHealth(20000);
        const failMsg = probe.hint
          || 'Impossible d’acquérir le verrou sur Supabase (base injoignable ou table planning_locks). Réessayez dans 1 minute.';
        alert(`❌ Connexion impossible.\n\n${failMsg}`);
        setFeedback('❌ Verrou Supabase indisponible — vérifiez l’état du projet Supabase.');
        return { ok: false, message: `❌ ${failMsg}` };
      }
      const failMsg =
        'Fermez les autres onglets Klick-planning sur ce poste et réessayez.';
      alert(`❌ Connexion impossible.\n\n${failMsg}`);
      setFeedback('❌ Connexion interrompue — réessayez.');
      return { ok: false, message: `❌ ${failMsg}` };
    }

    const enrichedUser = enrichUserSession(user, planningData?.shops || []);

    localStorage.setItem('current_user', JSON.stringify(enrichedUser));
    localStorage.setItem('user_id', `user_${enrichedUser.code}_${Date.now()}`);

    setCurrentUser(enrichedUser);
    setHasGlobalLock(true);
    setSupabaseSessionOffline(!!lockResult.offline);
    resetInactivityTimer();
    setLockCountdownSeconds(0);
    setLockOwnerText('');
    const preferredShopId = resolvePreferredShopId(enrichedUser, planningData);
    if (preferredShopId) {
      setSelectedShop(preferredShopId);
    }
    setSelectedWeek(getCurrentWeekKey());
    const hasPlanning = (planningData?.shops?.length || 0) > 0;
    setMode(hasPlanning ? 'planning' : 'startup');
    setFeedback(
      lockResult.offline
        ? `👋 Bienvenue ${enrichedUser.name} ! Mode hors ligne — 📁 Importer un planning ou 🔄 Restaurer JSON.`
        : `👋 Bienvenue ${enrichedUser.name} !`
    );
    addAuditLog({
      action: 'Connexion',
      details: `Connexion utilisateur validee. Boutiques autorisees: ${(enrichedUser.allowedShopIds || []).join(', ') || 'aucune'}.`,
      userCode: enrichedUser?.code,
      userName: enrichedUser?.name,
      shopId: preferredShopId,
      shopName: getShopNameById(preferredShopId, planningData)
    });
    return { ok: true };
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

      const currentBeforeRestore = await loadCompleteBasePlanningData();
      if (currentBeforeRestore && !confirmIfPartialRestoreWillEraseShops(currentBeforeRestore, restoredData)) {
        setFeedback('ℹ️ Restauration annulée — vos boutiques actuelles sont conservées.');
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
      const backups = await listCompletePlanningBackups(120);
      if (!backups || backups.length === 0) {
        alert('❌ Aucun historique de sauvegarde trouvé sur Supabase.');
        setFeedback('❌ Aucun historique de sauvegarde trouvé.');
        return;
      }

      const restorableBackups = backups.filter((item) => item.isRestorable !== false);
      const listForRestore = restorableBackups.length > 0 ? restorableBackups : backups;
      const snapshotCount = listForRestore.filter((item) => item.isSnapshot || item.weekKey === 'current_complete_file').length;
      const archiveCount = listForRestore.filter((item) => item.isLegacyRow).length;

      const displayCount = Math.min(listForRestore.length, 35);
      const lines = listForRestore.slice(0, displayCount).map((item, idx) => {
        const dateText = item.updatedAt ? new Date(item.updatedAt).toLocaleString('fr-FR') : 'date inconnue';
        const sourceLabel = item.isLegacyRow
          ? `📁 archive ${item.legacyShopId || item.savedByUser} — sem. enregistrée ${item.legacyWeekKey || '?'}`
          : item.weekKey === 'current_complete_file'
          ? '★ VERSION ACTUELLE'
          : '📦 snapshot historique complet';
        const shopsLabel = item.shopsCount != null ? `${item.shopsCount} boutique(s)` : '—';
        const authorLabel = item.savedByUser || 'auteur inconnu';
        const deviceLabel = item.savedByDevice && item.savedByDevice !== 'poste inconnu'
          ? item.savedByDevice
          : '';
        const whoLine = deviceLabel ? `👤 ${authorLabel} · ${deviceLabel}` : `👤 ${authorLabel}`;
        return `${idx + 1}. ${whoLine}\n   ${dateText} — ${shopsLabel} — ${sourceLabel}`;
      });

      const legacyNote = archiveCount > 0
        ? `\n\n📁 ${archiveCount} archive(s) boutique/semaine (💾 SAUVE SUPABASE) — vos sauvegardes personnelles plus anciennes sont souvent ici, pas dans les snapshots récents.`
        : '';

      const retentionNote =
        `\n\nℹ️ Les snapshots globaux récents (${snapshotCount} entrée(s) ci-dessus) ne conservent que les ~300 dernières sauvegardes complètes. ` +
        `Les sauvegardes de Maxime/Cannes d'hier ont pu remplacer les snapshots plus anciens.`;

      const moreNote = listForRestore.length > displayCount
        ? `\n\n… et ${listForRestore.length - displayCount} autre(s) entrée(s). Entrez le numéro exact (1-${listForRestore.length}).`
        : '';

      const selected = window.prompt(
        `Historique Supabase (${listForRestore.length} entrée(s) récupérable(s)) :\n` +
        `(auteur et poste indiqués — inclut archives boutique/semaine)\n\n` +
        `${lines.join('\n\n')}${moreNote}${legacyNote}${retentionNote}\n\n` +
        `Utilisez aussi 📋 ARCHIVES SAUVE SUPABASE pour parcourir toutes les sauvegardes par boutique.\n\n` +
        `Entrez le numéro à restaurer :`
      );

      if (!selected) {
        setFeedback('ℹ️ Restauration historique annulée.');
        return;
      }

      const parsedIndex = Number.parseInt(selected, 10) - 1;
      if (Number.isNaN(parsedIndex) || parsedIndex < 0 || parsedIndex >= listForRestore.length) {
        alert('❌ Numero invalide.');
        setFeedback('❌ Numero de sauvegarde invalide.');
        return;
      }

      const chosen = listForRestore[parsedIndex];
      if (chosen.isRestorable === false) {
        alert('❌ Cette entrée ne contient pas de fichier planning complet.\n\nUtilisez 📋 ARCHIVES SAUVE SUPABASE ou 🎯 RESTAURATION CIBLÉE.');
        setFeedback('❌ Sauvegarde non restaurable en mode complet.');
        return;
      }
      const restoredData = await loadCompletePlanningBackupByWeekKey(chosen.weekKey);
      if (!restoredData || !restoredData.shops || restoredData.shops.length === 0) {
        alert('❌ Sauvegarde historique invalide ou vide.');
        setFeedback('❌ Sauvegarde historique invalide.');
        return;
      }

      const currentBeforeRestore = await loadCompleteBasePlanningData();
      if (currentBeforeRestore && !confirmIfPartialRestoreWillEraseShops(currentBeforeRestore, restoredData)) {
        setFeedback('ℹ️ Restauration historique annulée — boutiques conservées.');
        return;
      }

      const currentUser = localStorage.getItem('current_user');
      const userId = localStorage.getItem('user_id');
      localStorage.clear();
      if (currentUser) localStorage.setItem('current_user', currentUser);
      if (userId) localStorage.setItem('user_id', userId);

      setPlanningData(restoredData);
      localStorage.setItem('planningData', JSON.stringify(restoredData));

      const parsedUser = currentUser ? JSON.parse(currentUser) : null;
      const restoredShopId = resolvePreferredShopId(parsedUser, restoredData);
      setSelectedShop(restoredShopId);
      setSelectedWeek(getCurrentWeekKey());
      setMode('planning');

      const restoredAt = chosen.updatedAt ? new Date(chosen.updatedAt).toLocaleString('fr-FR') : 'date inconnue';
      setFeedback(`✅ Historique restauré (${restoredAt}).`);
      alert(`✅ Historique restauré (${restoredAt}).`);
      addAuditLog({
        action: 'Restauration Historique Supabase',
        details: `Sauvegarde restauree: ${restoredAt}`,
        userCode: parsedUser?.code,
        userName: parsedUser?.name,
        shopId: restoredShopId || restoredData?.shops?.[0]?.id || '',
        shopName: getShopNameById(restoredShopId || restoredData?.shops?.[0]?.id || '', restoredData)
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

  const formatWeekRangeLabel = (weekKey) => {
    try {
      const start = parseISO(weekKey);
      const end = addDays(start, 6);
      return `${format(start, 'dd/MM/yyyy', { locale: fr })} → ${format(end, 'dd/MM/yyyy', { locale: fr })}`;
    } catch {
      return weekKey;
    }
  };

  const parseWeekKeyInput = (input) => {
    const trimmed = String(input || '').trim();
    if (!trimmed) return null;
    try {
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return format(startOfWeek(parseISO(trimmed), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      }
      const frMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (frMatch) {
        const [, d, m, y] = frMatch;
        const date = new Date(Number(y), Number(m) - 1, Number(d));
        if (Number.isNaN(date.getTime())) return null;
        return format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      }
    } catch {
      return null;
    }
    return null;
  };

  const loadCompleteBasePlanningData = async () => {
    let baseData = await loadCompletePlanningData();
    if (!baseData?.shops?.length) {
      try {
        const stored = JSON.parse(localStorage.getItem('planningData') || 'null');
        if (stored?.shops?.length) baseData = stored;
      } catch (_) {
        /* ignore */
      }
    }
    if (!baseData?.shops?.length) baseData = planningData;
    return baseData?.shops?.length ? baseData : null;
  };

  const confirmIfPartialRestoreWillEraseShops = (currentData, restoredData) => {
    if (!currentData?.shops?.length || !restoredData?.shops?.length) return true;

    const before = getPlanningDataStats(currentData);
    const after = getPlanningDataStats(restoredData);
    if (after.shopsCount >= before.shopsCount) return true;

    const restoredIds = new Set(restoredData.shops.map((s) => String(s.id)));
    const lostShops = (currentData.shops || [])
      .filter((s) => s?.id && !restoredIds.has(String(s.id)))
      .map((s) => s.name || s.id);

    if (lostShops.length === 0) return true;

    return window.confirm(
      `⚠️ ATTENTION — restauration COMPLÈTE dangereuse\n\n` +
        `Cette sauvegarde ne contient que ${after.shopsCount} boutique(s) ` +
        `(vous en avez ${before.shopsCount} actuellement).\n\n` +
        `Boutiques qui DISPARAÎTRONT :\n${lostShops.map((n) => `• ${n}`).join('\n')}\n\n` +
        `Pour ajouter UNE boutique sans effacer les autres :\n` +
        `→ 🏪 FUSIONNER BOUTIQUE (fichier JSON ou export 💾 JSON)\n` +
        `→ 🎯 RESTAURATION CIBLÉE (semaine par semaine)\n\n` +
        `OK = remplacer TOUT quand même\nAnnuler = garder vos boutiques actuelles`
    );
  };

  const formatBackupMatchLine = (match, idx) => {
    const dateText = match.backup.updatedAt
      ? new Date(match.backup.updatedAt).toLocaleString('fr-FR')
      : 'date inconnue';
    let sourceTag = '';
    if (match.isCurrent) sourceTag = ' [VERSION ACTUELLE]';
    else if (match.isRemoteWeekRow) sourceTag = ` [SAUVEGARDE SEMAINE — enregistrée depuis sem. ${match.savedOnWeekKey || '?'}]`;
    return (
      `${idx + 1}. ${dateText}${sourceTag} — ${match.entryCount} jour(s), ${match.employeeCount} employé(s) ` +
      `(semaine trouvée : ${formatWeekRangeLabel(match.weekKey)}, ${match.backup.savedByUser || '?'})`
    );
  };

  const formatGlobalTimelineLine = (item) => {
    const dateText = item.updatedAt ? new Date(item.updatedAt).toLocaleString('fr-FR') : 'date inconnue';
    let kind = 'snapshot';
    if (item.isCurrent) kind = 'VERSION ACTUELLE';
    else if (item.isLegacy) kind = 'boutique/semaine';
    const device = item.savedByDevice && item.savedByDevice !== 'poste inconnu'
      ? ` · ${item.savedByDevice}`
      : '';
    return `• ${dateText} — ${kind}, ${item.shopsCount ?? '—'} boutique(s) — 👤 ${item.savedByUser || '?'}${device}`;
  };

  const pickShopAndWeekForHistory = async (baseData) => {
    const shops = (baseData.shops || []).filter((s) => s?.id);
    if (!shops.length) return null;

    const shopLines = shops.map((s, idx) => `${idx + 1}. ${s.name || s.id}`);
    const shopPick = window.prompt(
      `Quelle boutique ?\n\n${shopLines.join('\n')}\n\nNuméro (ou vide pour annuler) :`
    );
    if (!shopPick) return null;

    const shopIdx = Number.parseInt(shopPick, 10) - 1;
    if (Number.isNaN(shopIdx) || shopIdx < 0 || shopIdx >= shops.length) {
      alert('❌ Numéro de boutique invalide.');
      return null;
    }

    const pickedShop = shops[shopIdx];
    const weeksInCurrent = listShopWeeksWithData(baseData, pickedShop.id);
    let weekKey = null;

    if (weeksInCurrent.length > 0) {
      const weekLines = weeksInCurrent.map(
        (w, idx) => `${idx + 1}. ${formatWeekRangeLabel(w.weekKey)} (${w.entryCount} jour(s) actuellement)`
      );
      weekLines.push(`${weeksInCurrent.length + 1}. Autre date (saisie manuelle)`);
      const weekPick = window.prompt(
        `Quelle semaine pour ${pickedShop.name} ?\n\n${weekLines.join('\n')}\n\nNuméro :`
      );
      if (!weekPick) return null;

      const weekIdx = Number.parseInt(weekPick, 10) - 1;
      if (weekIdx === weeksInCurrent.length) {
        const dateInput = window.prompt('Date dans la semaine (JJ/MM/AAAA ou AAAA-MM-JJ) :');
        weekKey = parseWeekKeyInput(dateInput);
      } else if (!Number.isNaN(weekIdx) && weekIdx >= 0 && weekIdx < weeksInCurrent.length) {
        weekKey = weeksInCurrent[weekIdx].weekKey;
      }
    } else {
      const dateInput = window.prompt(
        `Aucune semaine avec horaires actuellement pour ${pickedShop.name}.\n\n` +
          `Date dans la semaine recherchée (JJ/MM/AAAA ou AAAA-MM-JJ) :`
      );
      weekKey = parseWeekKeyInput(dateInput);
    }

    if (!weekKey) {
      alert('❌ Date ou semaine invalide.');
      return null;
    }

    return {
      shopId: pickedShop.id,
      shopName: pickedShop.name || pickedShop.id,
      weekKey
    };
  };

  const scanHistoricalBackupsForTarget = async (shopId, weekKey) => {
    setFeedback('⏳ Analyse complète (version actuelle + snapshots + sauvegardes semaine boutique)…');
    return findHistoricalBackupsWithShopWeek(shopId, weekKey, {
      limit: 100,
      excludeCurrent: false,
      onProgress: (current, total) => setFeedback(`⏳ Analyse des sauvegardes… ${current}/${total}`)
    });
  };

  const formatDiagnosticsBlock = (diag) => {
    if (!diag) return '';
    const fmt = (iso) => (iso ? new Date(iso).toLocaleString('fr-FR') : 'inconnue');
    return (
      `\n\n── État réel Supabase (sans filtre) ──\n` +
      `Version actuelle (complete_file) : ${fmt(diag.currentCompleteUpdatedAt)} (${diag.currentShopsCount || 0} boutique(s))\n` +
      `Dernière écriture Supabase (toute table) : ${fmt(diag.latestAnyUpdatedAt)} [${diag.latestAnyLabel || '?'}]\n` +
      `Dernière ligne boutique/semaine : ${fmt(diag.latestShopRowUpdatedAt)} (${diag.latestShopRowId || '?'})\n` +
      `Snapshots historiques en base : ${diag.historySnapshotCount ?? '?'}`
    );
  };

  const buildShopInventoryMessage = (shopName, inventory) => {
    if (!inventory) return '';
    const currentCount = inventory.weeksInCurrent?.length || 0;
    const remoteCount = inventory.remoteWeekKeys?.length || 0;
    const currentLines = currentCount
      ? inventory.weeksInCurrent
          .map((w) => `  • ${formatWeekRangeLabel(w.weekKey)} (${w.entryCount} j.)`)
          .join('\n')
      : '  • (aucune semaine avec horaires)';
    const remoteLines = remoteCount
      ? inventory.remoteWeekKeys
          .map((wk) => `  • ligne Supabase semaine ${wk}`)
          .join('\n')
      : '  • (aucune ligne boutique/semaine enregistrée sur Supabase)';
    return (
      `\n\n── Inventaire ${shopName} (${currentCount} semaine(s) actuelle, ${remoteCount} ligne(s) Supabase) ──\n` +
      `Semaines avec horaires (version actuelle) :\n${currentLines}\n\n` +
      `Lignes Supabase boutique/semaine (💾 SAUVE SUPABASE) :\n${remoteLines}`
    );
  };

  const handleExploreBackupHistory = async () => {
    if (isRestoringSupabaseRef.current) {
      setFeedback('⏳ Une opération historique est déjà en cours...');
      return;
    }

    isRestoringSupabaseRef.current = true;
    setFeedback('⏳ Préparation de la recherche dans l\'historique...');

    try {
      const baseData = await loadCompleteBasePlanningData();
      if (!baseData) {
        alert('❌ Planning complet introuvable.');
        setFeedback('❌ Planning complet introuvable.');
        return;
      }

      const target = await pickShopAndWeekForHistory(baseData);
      if (!target) {
        setFeedback('ℹ️ Recherche annulée.');
        return;
      }

      const timeline = await getGlobalBackupTimeline(25);
      const timelineBlock = timeline.length
        ? `\n\n── Dernières sauvegardes GLOBALES (${timeline.length} entrées analysées) ──\n${timeline.map(formatGlobalTimelineLine).join('\n')}`
        : '';

      const diagnostics = await getSupabaseBackupDiagnostics();
      const diagnosticsBlock = formatDiagnosticsBlock(diagnostics);

      setFeedback('⏳ Inventaire des semaines enregistrées pour cette boutique…');
      const inventory = await inspectShopWeekInventory(target.shopId);
      const inventoryBlock = buildShopInventoryMessage(target.shopName, inventory);

      const matches = await scanHistoricalBackupsForTarget(target.shopId, target.weekKey);
      const currentBrief = getShopWeekBriefWithAliases(baseData, target.shopId, target.weekKey);
      const currentLine = currentBrief
        ? `Version ACTUELLE en mémoire : ${currentBrief.entryCount} jour(s), ${currentBrief.employeeCount} employé(s).`
        : 'Version ACTUELLE en mémoire : aucun horaire pour cette semaine.';

      if (!matches.length) {
        alert(
          `❌ Aucune sauvegarde avec horaires pour :\n\n` +
            `Boutique : ${target.shopName}\n` +
            `Semaine : ${formatWeekRangeLabel(target.weekKey)}\n\n` +
            currentLine +
            diagnosticsBlock +
            timelineBlock +
            inventoryBlock +
            `\n\nSi la VERSION ACTUELLE est récente mais sans ces horaires, cherchez un snapshot plus ancien qui les contient encore.`
        );
        setFeedback('ℹ️ Aucune sauvegarde trouvée pour cette boutique/semaine.');
        return;
      }

      const lines = matches.map((m, idx) => formatBackupMatchLine(m, idx));
      alert(
        `🔍 Sauvegardes contenant des horaires\n\n` +
          `Boutique : ${target.shopName}\n` +
          `Semaine : ${formatWeekRangeLabel(target.weekKey)}\n\n` +
          `(Triées de la plus récente à la plus ancienne — ${matches.length} source(s) contenant cette semaine)\n\n` +
          `${lines.join('\n')}\n\n` +
          currentLine +
          diagnosticsBlock +
          timelineBlock +
          inventoryBlock +
          `\n\nUtilisez 🎯 RESTAURATION CIBLÉE pour fusionner une de ces sauvegardes.`
      );
      setFeedback(
        `✅ ${matches.length} sauvegarde(s) trouvée(s) pour ${target.shopName} (${formatWeekRangeLabel(target.weekKey)}).`
      );
    } catch (error) {
      console.error('❌ Erreur exploration historique:', error);
      setFeedback(`❌ Erreur exploration historique: ${error.message}`);
      alert(`❌ Erreur exploration historique: ${error.message}`);
    } finally {
      isRestoringSupabaseRef.current = false;
    }
  };

  const handleBrowseShopWeekArchives = async () => {
    if (isRestoringSupabaseRef.current) {
      setFeedback('⏳ Une opération est déjà en cours...');
      return;
    }

    isRestoringSupabaseRef.current = true;
    setFeedback('⏳ Chargement des archives SAUVE SUPABASE (boutique/semaine)...');

    try {
      const remoteShopIds = await listRemoteShops();
      const archiveShopIds = remoteShopIds.filter(
        (id) => id !== 'complete_file' && id !== 'backup_history' && id !== 'system_config'
      );
      const shopHint = archiveShopIds.length
        ? `\n\nIDs boutique connus sur Supabase :\n${archiveShopIds.slice(0, 12).join(', ')}`
        : '\n\n(Aucune ligne boutique/semaine enregistrée sur Supabase pour l’instant.)';

      const shopFilter = window.prompt(
        'Filtrer par boutique (ID exact, ex. CANNES ou PORT_GRIMAUD) ?\n\n' +
          'Laissez VIDE pour TOUTES les boutiques.' +
          shopHint,
        ''
      );
      if (shopFilter === null) {
        setFeedback('ℹ️ Parcours des archives annulé.');
        return;
      }

      const trimmedFilter = String(shopFilter || '').trim();
      let entries = await listShopWeekArchiveEntries({
        shopId: trimmedFilter || null,
        limit: 400
      });

      if (!entries.length && trimmedFilter) {
        const retryAll = window.confirm(
          `❌ Aucune archive pour le filtre « ${trimmedFilter} ».\n\n` +
            `Essayer sans filtre (toutes les boutiques) ?`
        );
        if (retryAll) {
          entries = await listShopWeekArchiveEntries({ shopId: null, limit: 400 });
        }
      }

      if (!entries.length) {
        const diagnostics = await getSupabaseBackupDiagnostics();
        const diagnosticsBlock = formatDiagnosticsBlock(diagnostics);
        alert(
          '❌ Aucune archive boutique/semaine sur Supabase.\n\n' +
            'Ce n’est pas forcément une perte totale : beaucoup de postes n’enregistrent que des ' +
            'snapshots globaux (historique), pas des lignes par boutique.\n\n' +
            '➡️ Utilisez plutôt 🕘 HISTORIQUE SUPABASE : chaque 💾 SAUVE SUPABASE y crée un snapshot complet.\n' +
            'Cherchez une entrée d’HIER avec le nom de Maxime (avant votre restauration JSON).\n\n' +
            'Si vous aviez filtré une boutique, vérifiez l’ID exact (souvent CANNES en majuscules).' +
            diagnosticsBlock
        );
        setFeedback('❌ Pas d’archives boutique/semaine — essayez 🕘 HISTORIQUE SUPABASE.');
        return;
      }

      const displayCount = Math.min(entries.length, 40);
      const lines = entries.slice(0, displayCount).map((item, idx) => {
        const dateText = item.updatedAt ? new Date(item.updatedAt).toLocaleString('fr-FR') : '?';
        const who = `${item.savedByUser || '?'} · ${item.savedByDevice || '?'}`;
        const completeTag = item.isCompleteSnapshot ? `${item.shopsCount} boutique(s)` : 'format partiel';
        return `${idx + 1}. ${dateText}\n   👤 ${who}\n   🏪 ${item.shopId} — sem. ${item.weekKey} — ${completeTag}`;
      });

      const moreNote = entries.length > displayCount
        ? `\n\n… et ${entries.length - displayCount} autre(s) archive(s). Numéro 1-${entries.length}.`
        : '';

      const pick = window.prompt(
        `📋 Archives 💾 SAUVE SUPABASE (${entries.length} entrée(s))\n` +
          `Ce sont vos sauvegardes manuelles — souvent les seules traces des plannings d'il y a plusieurs jours.\n\n` +
          `${lines.join('\n\n')}${moreNote}\n\nEntrez le numéro à restaurer (fichier complet) :`
      );
      if (!pick) {
        setFeedback('ℹ️ Restauration archive annulée.');
        return;
      }

      const pickIndex = Number.parseInt(pick, 10) - 1;
      if (Number.isNaN(pickIndex) || pickIndex < 0 || pickIndex >= entries.length) {
        alert('❌ Numéro invalide.');
        return;
      }

      const chosen = entries[pickIndex];
      const restoredData = await loadCompletePlanningBackupByWeekKey(chosen.restoreKey);
      if (!restoredData?.shops?.length) {
        alert('❌ Archive invalide ou vide.');
        setFeedback('❌ Archive invalide.');
        return;
      }

      const dateText = chosen.updatedAt ? new Date(chosen.updatedAt).toLocaleString('fr-FR') : '?';
      const ok = window.confirm(
        `Restaurer cette archive ?\n\n` +
          `Date : ${dateText}\n` +
          `Auteur : ${chosen.savedByUser} (${chosen.savedByDevice})\n` +
          `Boutique enregistrée : ${chosen.shopId}\n` +
          `Semaine tag : ${chosen.weekKey}\n` +
          `Contenu : ${restoredData.shops.length} boutique(s)\n\n` +
          `⚠️ Remplace le planning complet en mémoire. Ne cliquez pas SAUVE SUPABASE avant d'avoir vérifié vos semaines.`
      );
      if (!ok) {
        setFeedback('ℹ️ Restauration archive annulée.');
        return;
      }

      const currentBeforeRestore = await loadCompleteBasePlanningData();
      if (currentBeforeRestore && !confirmIfPartialRestoreWillEraseShops(currentBeforeRestore, restoredData)) {
        setFeedback('ℹ️ Restauration archive annulée — boutiques conservées.');
        return;
      }

      const currentUser = localStorage.getItem('current_user');
      const userId = localStorage.getItem('user_id');
      localStorage.clear();
      if (currentUser) localStorage.setItem('current_user', currentUser);
      if (userId) localStorage.setItem('user_id', userId);

      setPlanningData(restoredData);
      localStorage.setItem('planningData', JSON.stringify(restoredData));

      const parsedUser = currentUser ? JSON.parse(currentUser) : null;
      const restoredShopId = resolvePreferredShopId(parsedUser, restoredData);
      setSelectedShop(restoredShopId);
      setSelectedWeek(getCurrentWeekKey());
      setMode('planning');

      setFeedback(`✅ Archive restaurée (${dateText}) — vérifiez Port Grimaud / Saint-Tropez avant SAUVE SUPABASE.`);
      alert(`✅ Archive restaurée (${dateText}).\n\nVérifiez vos semaines jusqu'au 5 juillet AVANT de sauvegarder.`);
    } catch (error) {
      console.error('❌ Erreur parcours archives:', error);
      setFeedback(`❌ Erreur archives: ${error.message}`);
      alert(`❌ Erreur archives: ${error.message}`);
    } finally {
      isRestoringSupabaseRef.current = false;
    }
  };

  const handleRestoreShopWeekFromHistory = async () => {
    if (isRestoringSupabaseRef.current) {
      setFeedback('⏳ Une restauration est déjà en cours...');
      return;
    }

    isRestoringSupabaseRef.current = true;
    setFeedback('⏳ Préparation de la restauration ciblée...');

    try {
      const baseData = await loadCompleteBasePlanningData();
      if (!baseData) {
        alert('❌ Impossible de charger le planning complet actuel. Abandon pour éviter toute perte de données.');
        setFeedback('❌ Planning complet introuvable — restauration annulée.');
        return;
      }

      const target = await pickShopAndWeekForHistory(baseData);
      if (!target) {
        setFeedback('ℹ️ Restauration ciblée annulée.');
        return;
      }

      const inventory = await inspectShopWeekInventory(target.shopId);
      const inventoryBlock = buildShopInventoryMessage(target.shopName, inventory);

      const matches = await scanHistoricalBackupsForTarget(target.shopId, target.weekKey);
      const currentBrief = getShopWeekBriefWithAliases(baseData, target.shopId, target.weekKey);

      if (!matches.length) {
        alert(
          `❌ Aucune sauvegarde historique avec horaires pour :\n\n` +
            `Boutique : ${target.shopName}\n` +
            `Semaine : ${formatWeekRangeLabel(target.weekKey)}\n\n` +
            inventoryBlock +
            `\n\nUtilisez 🔍 CHERCHER HISTORIQUE pour voir le détail complet.`
        );
        setFeedback('ℹ️ Aucune sauvegarde source trouvée.');
        return;
      }

      const matchLines = matches.map((m, idx) => formatBackupMatchLine(m, idx));
      const currentHint = currentBrief
        ? `\n\nActuellement : ${currentBrief.entryCount} jour(s), ${currentBrief.employeeCount} employé(s).`
        : '\n\nActuellement : aucun horaire pour cette semaine.';

      const backupPick = window.prompt(
        `Restauration CIBLÉE — ${target.shopName}\n` +
          `Semaine : ${formatWeekRangeLabel(target.weekKey)}\n\n` +
          `Sauvegardes contenant ces horaires :\n${matchLines.join('\n')}` +
          currentHint +
          `\n\nEntrez le numéro de la sauvegarde à fusionner :`
      );
      if (!backupPick) {
        setFeedback('ℹ️ Restauration ciblée annulée.');
        return;
      }

      const matchIndex = Number.parseInt(backupPick, 10) - 1;
      if (Number.isNaN(matchIndex) || matchIndex < 0 || matchIndex >= matches.length) {
        alert('❌ Numéro de sauvegarde invalide.');
        return;
      }

      const chosenMatch = matches[matchIndex];
      const chosenBackup = chosenMatch.backup;
      const backupData = await loadCompletePlanningBackupByWeekKey(chosenBackup.weekKey);
      if (!backupData?.shops?.length) {
        alert('❌ Sauvegarde source invalide ou vide.');
        return;
      }

      const beforeStats = getPlanningDataStats(baseData);
      const weekKey = target.weekKey;
      const confirmMsg =
        `Confirmer la fusion ciblée ?\n\n` +
        `Base : version complète Supabase (${beforeStats.shopsCount} boutique(s), ${beforeStats.totalWeeks} semaine(s) avec horaires)\n` +
        `Boutique : ${target.shopName}\n` +
        `Semaine : ${formatWeekRangeLabel(weekKey)}\n` +
        `Source : ${chosenMatch.entryCount} jour(s), ${chosenMatch.employeeCount} employé(s) — sauvegarde du ` +
        `${chosenBackup.updatedAt ? new Date(chosenBackup.updatedAt).toLocaleString('fr-FR') : '?'}\n\n` +
        `Les autres boutiques et semaines ne seront PAS modifiées.`;

      if (!window.confirm(confirmMsg)) {
        setFeedback('ℹ️ Restauration ciblée annulée.');
        return;
      }

      const mergedData = mergeShopWeekFromBackup(baseData, backupData, target.shopId, weekKey);
      const afterStats = getPlanningDataStats(mergedData);
      const shrinkWarnings = validateTargetedMergeSafe(beforeStats, afterStats, target.shopId);

      if (shrinkWarnings.length > 0) {
        alert(
          '❌ Fusion refusée : des données seraient perdues.\n\n' +
            shrinkWarnings.join('\n') +
            '\n\nAucune modification enregistrée. Utilisez 🕘 HISTORIQUE SUPABASE pour une restauration complète.'
        );
        setFeedback('❌ Restauration ciblée annulée (perte de données détectée).');
        return;
      }

      setPlanningData(mergedData);
      localStorage.setItem('planningData', JSON.stringify(mergedData));
      setSelectedShop(target.shopId);
      setSelectedWeek(weekKey);
      setMode('planning');

      const pushNow = window.confirm(
        '✅ Semaine fusionnée dans le planning complet actuel.\n\n' +
          `Après fusion : ${afterStats.shopsCount} boutique(s), ${afterStats.totalWeeks} semaine(s) avec horaires.\n\n` +
          'Enregistrer immédiatement sur Supabase ?'
      );

      if (pushNow) {
        setFeedback('⏳ Enregistrement Supabase en cours...');
        const saved = await saveCompletePlanningData(mergedData);
        if (saved?.ok && saved.planningData) {
          setPlanningData(saved.planningData);
          localStorage.setItem('planningData', JSON.stringify(saved.planningData));
        }
        setFeedback(saved?.ok ? '✅ Restauration ciblée enregistrée sur Supabase.' : '⚠️ Fusion locale OK, échec Supabase.');
      } else {
        setFeedback('✅ Restauration ciblée appliquée localement. Pensez à SAUVE SUPABASE.');
      }

      writeAudit({
        action: 'Restauration ciblee',
        details: `Boutique ${target.shopName}, semaine ${weekKey}, source ${chosenBackup.updatedAt || chosenBackup.weekKey}`,
        shopId: target.shopId,
        data: mergedData
      });
    } catch (error) {
      console.error('❌ Erreur restauration ciblée:', error);
      setFeedback(`❌ Erreur restauration ciblée: ${error.message}`);
      alert(`❌ Erreur restauration ciblée: ${error.message}`);
    } finally {
      isRestoringSupabaseRef.current = false;
    }
  };

  // Gestion de la licence
  const handleLicenseValid = () => {
    setShowLicenseModal(false);
    setLicenseError('');
  };

  const handleImportPlanning = async (file, options = {}) => {
    const restoreInPlace = options?.restoreInPlace === true;
    try {
      setFeedback('⏳ Import du fichier JSON en cours...');
      const importedData = await importPlanningData(file);

      const shopCount = importedData.shops?.length || 0;
      if (shopCount === 0) {
        throw new Error('Le fichier ne contient aucune boutique.');
      }

      const confirmMsg = restoreInPlace
        ? `Restaurer ce fichier JSON ?\n\n${shopCount} boutique(s) — ${file.name}\n\n⚠️ Remplace le planning actuel.`
        : `Importer ${file.name} ?\n\n${shopCount} boutique(s) trouvée(s).`;
      if (!window.confirm(confirmMsg)) {
        setFeedback('ℹ️ Import annulé.');
        return;
      }

      setPlanningData(importedData);
      localStorage.setItem('planningData', JSON.stringify(importedData));
      localStorage.removeItem('planning_prefer_local_until_save');

      const shopId = resolvePreferredShopId(currentUser, importedData);
      if (shopId) setSelectedShop(shopId);

      if (restoreInPlace) {
        setSelectedWeek(getCurrentWeekKey());
        setMode('planning');
        setFeedback(`✅ JSON restauré : ${shopCount} boutique(s) — ${file.name}`);
        alert(`✅ Planning restauré depuis ${file.name}\n\n${shopCount} boutique(s).\n\n⚠️ Faites « SAUVE SUPABASE » tout de suite pour mettre à jour le cloud.\nAu prochain démarrage, c’est toujours Supabase qui fait foi.`);
      } else {
        setMode('week-selection');
        setFeedback('✅ Import réussi — sélectionnez une semaine.');
        alert(`✅ Import réussi (${shopCount} boutique(s)). Sélectionnez une semaine.`);
      }
    } catch (error) {
      const message = error?.message || String(error);
      setFeedback(`❌ Erreur d'import : ${message}`);
      alert(`❌ Impossible de restaurer le JSON :\n\n${message}`);
    }
  };

  // Alias pour handleImportData (utilisé dans certains composants)
  const handleImportData = handleImportPlanning;

  const handleMergeShopFromJson = () => {
    mergeShopJsonInputRef.current?.click();
  };

  const handleMergeShopJsonFileSelected = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      setFeedback('⏳ Lecture du fichier source...');
      const sourceData = await importPlanningData(file);
      const sourceShops = (sourceData.shops || []).filter((s) => s?.id);
      if (!sourceShops.length) {
        throw new Error('Le fichier ne contient aucune boutique.');
      }

      const baseData = await loadCompleteBasePlanningData();
      if (!baseData) {
        throw new Error('Planning actuel introuvable. Importez d’abord vos boutiques principales (🔄 Restaurer JSON).');
      }

      const shopLines = sourceShops.map((s, idx) => {
        const weekCount = listShopWeeksWithData(sourceData, s.id).length;
        return `${idx + 1}. ${s.name || s.id} (${weekCount} semaine(s) avec horaires)`;
      });

      const shopPick = window.prompt(
        `🏪 Fusionner UNE boutique depuis ${file.name}\n\n` +
          `Votre planning actuel : ${baseData.shops.length} boutique(s).\n` +
          `Les autres boutiques ne seront PAS modifiées.\n\n` +
          `${shopLines.join('\n')}\n\nNuméro de la boutique à fusionner :`
      );
      if (!shopPick) {
        setFeedback('ℹ️ Fusion boutique annulée.');
        return;
      }

      const shopIdx = Number.parseInt(shopPick, 10) - 1;
      if (Number.isNaN(shopIdx) || shopIdx < 0 || shopIdx >= sourceShops.length) {
        alert('❌ Numéro de boutique invalide.');
        return;
      }

      const pickedShop = sourceShops[shopIdx];
      const sourceWeeks = listShopWeeksWithData(sourceData, pickedShop.id);
      const confirmMsg =
        `Confirmer la fusion ?\n\n` +
        `Source : ${file.name}\n` +
        `Boutique : ${pickedShop.name || pickedShop.id}\n` +
        `Semaines avec horaires : ${sourceWeeks.length}\n\n` +
        `Vos autres boutiques (Port Grimaud, Saint-Tropez, etc.) restent intactes.`;

      if (!window.confirm(confirmMsg)) {
        setFeedback('ℹ️ Fusion boutique annulée.');
        return;
      }

      const beforeStats = getPlanningDataStats(baseData);
      const mergedData = mergeShopFromBackup(baseData, sourceData, pickedShop.id);
      const afterStats = getPlanningDataStats(mergedData);
      const shrinkWarnings = validateTargetedMergeSafe(beforeStats, afterStats, pickedShop.id);

      if (shrinkWarnings.length > 0) {
        alert(
          '❌ Fusion refusée : des données seraient perdues.\n\n' +
            shrinkWarnings.join('\n') +
            '\n\nAucune modification enregistrée.'
        );
        setFeedback('❌ Fusion boutique annulée (perte de données détectée).');
        return;
      }

      setPlanningData(mergedData);
      localStorage.setItem('planningData', JSON.stringify(mergedData));
      setSelectedShop(pickedShop.id);
      if (sourceWeeks.length > 0) {
        setSelectedWeek(sourceWeeks[sourceWeeks.length - 1].weekKey);
      }
      setMode('planning');

      setFeedback(
        `✅ ${pickedShop.name || pickedShop.id} fusionnée (${sourceWeeks.length} semaine(s)). ` +
          `Exportez un JSON de secours avant SAUVE SUPABASE.`
      );
      alert(
        `✅ Boutique « ${pickedShop.name || pickedShop.id} » fusionnée.\n\n` +
          `${afterStats.shopsCount} boutique(s) au total, ${afterStats.weeksByShop[String(pickedShop.id)] || 0} semaine(s) pour cette boutique.\n\n` +
          `Vérifiez le planning puis exportez un JSON de secours (💾 JSON).`
      );

      addAuditLog({
        action: 'Fusion boutique JSON',
        details: `Boutique ${pickedShop.name || pickedShop.id} depuis ${file.name}`,
        userCode: currentUser?.code,
        userName: currentUser?.name,
        shopId: pickedShop.id,
        shopName: pickedShop.name || pickedShop.id
      });
    } catch (error) {
      const message = error?.message || String(error);
      console.error('❌ Erreur fusion boutique:', error);
      setFeedback(`❌ Erreur fusion boutique: ${message}`);
      alert(`❌ Erreur fusion boutique:\n\n${message}`);
    }
  };

  const handleExit = async () => {
    if (!window.confirm('Êtes-vous sûr de vouloir quitter l\'application ?')) return;

    try {
      if (currentUser?.code && hasGlobalLock) {
        const saveResult = await saveCompletePlanningData(
          planningData,
          getSaveMergeOptionsForUser(currentUser)
        );
        if (saveResult?.ok && saveResult.preservedShopIds?.length && saveResult.planningData) {
          setPlanningData(saveResult.planningData);
          localStorage.setItem('planningData', JSON.stringify(saveResult.planningData));
        }
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
          <div style="display:flex;gap:10px;align-items:center;margin-top:10px">
            <label for="export-include-hidden" style="font-size:12px;display:flex;align-items:center;gap:6px;cursor:pointer">
              <input id="export-include-hidden" type="checkbox" />
              Inclure les employés masqués (déconseillé)
            </label>
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
        const includeHiddenEmployees =
          /** @type {HTMLInputElement} */ (document.getElementById('export-include-hidden'))?.checked === true;
        cleanup();
        const exportUserCode = exportContext.userCode || currentUser?.code;
        const ok = exportPlanningToExcel(planningData, {
          monthDate,
          userCode: exportUserCode,
          includeHiddenEmployees,
          currentShopId: exportContext.currentShopId || selectedShop,
          currentWeekKey: exportContext.currentWeekKey || selectedWeek,
          currentWeekPlanning: exportContext.currentWeekPlanning || planning,
          currentEmployees: exportContext.currentEmployees || selectedEmployees,
        });
        if (ok === true) {
          const shopScopeLabel = exportUserCode && !checkUserPermission(exportUserCode, 'canAccessAllShops')
            ? 'boutiques autorisees'
            : 'toutes boutiques';
          setFeedback(`📊 Export Excel planning global téléchargé (${shopScopeLabel}, fichier planning_detaille_mois…). Pour un employé : utiliser Exporter en Excel dans le récap mensuel détaillé.`);
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
            onBrowseShopWeekArchives={handleBrowseShopWeekArchives}
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
              onBrowseShopWeekArchives={handleBrowseShopWeekArchives}
              onRestoreShopWeekFromHistory={handleRestoreShopWeekFromHistory}
              onExploreBackupHistory={handleExploreBackupHistory}
              onMergeShopFromJson={handleMergeShopFromJson}
              onExitApplication={handleExit}
            />
          <input
            ref={mergeShopJsonInputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={handleMergeShopJsonFileSelected}
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
          isSupabaseStartupReady={isSupabaseStartupReady}
          isBootstrapComplete={isBootstrapComplete}
          startupInfo={restoredInfo}
          onRetrySupabaseStartup={handleRetrySupabaseStartup}
        />
      </ErrorBoundary>
    );
  }

  return null;
};

export default App;
