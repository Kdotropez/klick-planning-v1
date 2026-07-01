import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { format, addDays, startOfWeek, parseISO, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { fr } from 'date-fns/locale';
import { FaDownload, FaChevronDown, FaChevronUp, FaCog, FaChartBar, FaArrowLeft } from 'react-icons/fa';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { loadFromLocalStorage, saveToLocalStorage } from '../../utils/localStorage';
import PlanningMenuBar from './PlanningMenuBar';
import DayButtons from './DayButtons';
import PlanningTable from './PlanningTable';
import ResetModal from './ResetModal';
import RecapModal from './RecapModal';
import ShopWeekInsightsModal from './ShopWeekInsightsModal';
import ShopPresenceMapModal from './ShopPresenceMapModal';
import WeeklyWorkMatrixModal from './WeeklyWorkMatrixModal';
import EmployeeRecapCompact from './EmployeeRecapCompact';
import MonthlyRecapModals from './MonthlyRecapModals';
import MonthlyDetailModal from './MonthlyDetailModal';
import ValidationManager from './ValidationManager';

import EmployeeMonthlyWeeklyModal from './EmployeeMonthlyWeeklyModal';
import EmployeeMonthlyRecapModal from './EmployeeMonthlyRecapModal';
import EmployeeWeeklyRecapModal from './EmployeeWeeklyRecapModal';
import EmployeeMonthlyDetailModal from './EmployeeMonthlyDetailModal';
import CopyPastePage from './CopyPastePage';
import NotesModal from './NotesModal';
import ShopStatsPage from './ShopStatsPage';
import RecapButtonsModule from './RecapButtonsModule';
import LabourInspectionModal from './LabourInspectionModal';
import { getShopById, getWeekPlanning, saveWeekPlanning, saveWeekPlanningForEmployee, getAllEmployees, isEmployeeVisibleForRecap, resyncShopMarcheAmbulantGrid, getEmployeeMainShopId, determineEmployeeMainShop, renameEmployeeInPlanningData, syncEmployeeNamesAcrossShops, getEmployeeStoredNameVariants, employeeStoredNamesMatch, hideEmployee, archiveEmployee, unarchiveEmployee } from '../../utils/planningDataManager';
import { calculateEmployeeDailyHours, dayCellHasPlanningContent, formatWorkedHoursForDisplay, formatWorkedHoursNbNotation, isAbsenceDayValue } from '../../utils/planningUtils';
import { buildSlotRangeLines } from '../../utils/slotDurationUtils';
import { useDeviceDetection } from '../../hooks/useDeviceDetection';
import { usePlanningLock } from '../../hooks/usePlanningLock';

import TouchOptimizationBanner from '../common/TouchOptimizationBanner';
import { saveRemotePlanning, saveCompletePlanningData, cleanAndResaveData, loadCompletePlanningData, initRemoteOutbox } from '@/utils/remoteStore';
import { heartbeat } from '../../utils/collabLock';
import { testSupabaseConnection, testSupabaseTables } from '@/utils/testSupabase';
import { addAuditLog } from '@/utils/auditLog';
import {
  checkUserPermission,
  filterShopsForUser,
  canUserAccessShop,
  filterPlanningDataForUser,
  getSaveMergeOptionsForUser
} from '../../config/userCodes';
import {
  buildLandscapeHtmlDocument,
  escapeHtml,
  openOrDownloadLandscapeHtml,
  downloadLandscapeHtmlFile,
} from '../../utils/htmlLandscapeExport';
import '@/assets/styles.css';

const normalizeWeekKey = (dateString) => {
  const parsed = dateString && !isNaN(parseISO(dateString).getTime())
    ? parseISO(dateString)
    : new Date();
  return format(startOfWeek(parsed, { weekStartsOn: 1 }), 'yyyy-MM-dd');
};
const SUPERVISOR_WEEK_UNLOCK_CODE = ['2', '1', '1', '1'].join('');

const PlanningDisplay = ({ 
  planningData, 
  setPlanningData,
  selectedShop, 
  setSelectedShop,
  selectedWeek, 
  setSelectedWeek,
  selectedEmployees, 
  setSelectedEmployees,
  planning: initialPlanning, 
  setPlanning: setGlobalPlanning,
  onExport,
  onImport,
  onReset,
  onBackToStartup,
  onBackToEmployees,
  onBackToShopSelection,
  onBackToShopManagement,
  onBackToWeekSelection,
  onBackToConfig,
  onOpenSchoolMode,
  setFeedback,
  onDeleteEmployee,
  onRestoreFromSupabase,
  onRestoreBackupFromHistory,
  onBrowseShopWeekArchives,
  onRestoreShopWeekFromHistory,
  onExploreBackupHistory,
  onMergeShopFromJson,
  onExitApplication
}) => {
  const [currentDay, setCurrentDay] = useState(0);
  const [showShopWeekInsights, setShowShopWeekInsights] = useState(false);
  const [showPresenceMap, setShowPresenceMap] = useState(false);
  const [showWeeklyWorkMatrix, setShowWeeklyWorkMatrix] = useState(false);

  const [showResetModal, setShowResetModal] = useState(false);
  const [showRecapModal, setShowRecapModal] = useState(null);
  const [showMonthlyRecapModal, setShowMonthlyRecapModal] = useState(false);
  const [showEmployeeMonthlyRecap, setShowEmployeeMonthlyRecap] = useState(false);
  const [showEmployeeWeeklyRecap, setShowEmployeeWeeklyRecap] = useState(false);
  const [showMonthlyDetailModal, setShowMonthlyDetailModal] = useState(false);

  const [showEmployeeMonthlyWeeklyModal, setShowEmployeeMonthlyWeeklyModal] = useState(false);
  const [selectedEmployeeForMonthlyRecap, setSelectedEmployeeForMonthlyRecap] = useState('');
  const [selectedEmployeeForWeeklyRecap, setSelectedEmployeeForWeeklyRecap] = useState('');
  const [showEmployeeMonthlyDetail, setShowEmployeeMonthlyDetail] = useState(false);
  const [selectedEmployeeForMonthlyDetail, setSelectedEmployeeForMonthlyDetail] = useState('');

  
  // État pour la page copier-coller avancé
  const [showCopyPastePage, setShowCopyPastePage] = useState(false);
  
  // État pour la modale de notes
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showLabourInspectionModal, setShowLabourInspectionModal] = useState(false);
  
  // État pour la page des statistiques de la boutique
  const [showShopStatsPage, setShowShopStatsPage] = useState(false);
  
  // État pour la page de gestion boutique
  const [showGestionBoutique, setShowGestionBoutique] = useState(false);

  const handleSaveInspectionMeta = useCallback((shopId, shopName, metaPayload) => {
    if (!shopId || !metaPayload) return;
    setPlanningData((prev) => {
      const next = {
        ...prev,
        inspectionMetaByShop: {
          ...(prev?.inspectionMetaByShop || {}),
          [shopId]: {
            ...(metaPayload || {}),
            boutiqueAffichee: shopName || metaPayload?.boutiqueAffichee || shopId,
            updatedAt: new Date().toISOString()
          }
        }
      };
      saveToLocalStorage('planningData', next);
      return next;
    });
  }, [setPlanningData]);

  const handleSaveInspectionEmployeeContractData = useCallback((shopId, contractDataByEmployee) => {
    if (!shopId || !contractDataByEmployee || typeof contractDataByEmployee !== 'object') return;
    setPlanningData((prev) => {
      const nextShops = (prev?.shops || []).map((shop) => ({
        ...shop,
        employees: (shop.employees || []).map((emp) => {
          const payload = contractDataByEmployee?.[emp.id];
          if (!payload) return emp;
          return {
            ...emp,
            dateEntree: payload.dateEntree || '',
            typeContrat: payload.typeContrat || '',
            contratHours: payload.contratHours ?? '',
            dateSortie: null
          };
        })
      }));
      const next = { ...prev, shops: nextShops };
      saveToLocalStorage('planningData', next);
      return next;
    });
  }, [setPlanningData]);

  // Nouveau système de verrou à bail avec identification personnalisée
  const currentUserIdRef = useRef(null);
  if (!currentUserIdRef.current) {
    try {
      // Vérifier d'abord s'il y a un utilisateur identifié
      const currentUser = localStorage.getItem('current_user');
      if (currentUser) {
        const user = JSON.parse(currentUser);
        currentUserIdRef.current = `user_${user.code}_${Date.now()}`;
        console.log('🆔 Utilisation de l\'identifiant utilisateur personnalisé:', currentUserIdRef.current);
      } else {
        // Fallback vers l'ancien système si pas d'utilisateur identifié
      const stored = localStorage.getItem('user_id');
      if (stored) {
        currentUserIdRef.current = stored;
      } else {
          // Génération d'un ID plus spécifique à la machine
          const generateMachineSpecificId = () => {
            // Informations disponibles dans le navigateur
            const userAgent = navigator.userAgent;
            const platform = navigator.platform;
            const language = navigator.language;
            const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const screenRes = `${screen.width}x${screen.height}`;
            const colorDepth = screen.colorDepth;
            
            // Créer une "empreinte" de la machine
            const machineFingerprint = `${platform}_${language}_${timezone}_${screenRes}_${colorDepth}`;
            
            // Hash simple de l'empreinte + timestamp
            let hash = 0;
            for (let i = 0; i < machineFingerprint.length; i++) {
              const char = machineFingerprint.charCodeAt(i);
              hash = ((hash << 5) - hash) + char;
              hash = hash & hash; // Convert to 32bit integer
            }
            
            // Ajouter un timestamp pour l'unicité
            const timestamp = Date.now().toString(36);
            const random = Math.random().toString(36).slice(2, 5);
            
            return `user_${Math.abs(hash).toString(36)}_${timestamp}_${random}`;
          };
          
          const gen = generateMachineSpecificId();
        localStorage.setItem('user_id', gen);
        currentUserIdRef.current = gen;
          
          console.log('🆔 Nouvel identifiant utilisateur généré (fallback):', gen);
        }
      }
    } catch (_) {
      currentUserIdRef.current = 'user_local';
      console.warn('⚠️ Erreur lors de la génération de l\'ID utilisateur, utilisation du fallback');
    }
  }
  const currentUserId = currentUserIdRef.current;
  
  // Récupérer les informations de l'utilisateur connecté
  const currentUser = useMemo(() => {
    try {
      const stored = localStorage.getItem('current_user');
      return stored ? JSON.parse(stored) : null;
    } catch (_) {
      return null;
    }
  }, []);

  // Identifiant de ressource pour le verrou (boutique + semaine)
  const validWeek = normalizeWeekKey(selectedWeek);
  const resourceId = `${selectedShop || 'unknown'}:${validWeek}`;
  
  // Hook de gestion du verrou
  const { status, isOwner, readOnly: lockReadOnly, lockInfo, release, emergency } = usePlanningLock(resourceId, currentUserId);
  const canEditPlanning = !currentUser?.code || checkUserPermission(currentUser.code, 'canEditPlanning');
  const readOnly = lockReadOnly || !canEditPlanning;
  
  // Fonction wrapper pour la sauvegarde qui respecte le verrou
  const safeSaveWeekPlanning = useCallback((planningData, shop, week, planning, employees) => {
    if (readOnly) {
      console.warn('Tentative de sauvegarde en mode lecture seule - ignorée');
      return planningData;
    }
    return saveWeekPlanning(planningData, shop, week, planning, employees);
  }, [readOnly]);
  
  // Récap employés affiché par défaut; le bouton "Masquer" le replie à la demande.
  const [showEmployeeRecap, setShowEmployeeRecap] = useState(true);
  const [showPlanningMenuBar, setShowPlanningMenuBar] = useState(() => {
    try {
      const stored = localStorage.getItem('planning_menu_bar_visible');
      return stored === null ? true : stored === 'true';
    } catch {
      return true;
    }
  });
  const [activeMenu, setActiveMenu] = useState(null);

  const [showCalendarTotals, setShowCalendarTotals] = useState(false);
  const [localFeedback, setLocalFeedback] = useState('');
  
  // État local pour les employés sélectionnés
  const [localSelectedEmployees, setLocalSelectedEmployees] = useState(() => {
    return Array.isArray(selectedEmployees) && selectedEmployees.length > 0
      ? selectedEmployees
      : [];
  });
  
  // Démarrer la file d'attente de synchro distante (mode hybride)
  useEffect(() => {
    try { initRemoteOutbox(); } catch (e) { console.warn('initRemoteOutbox failed', e); }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('planning_menu_bar_visible', String(showPlanningMenuBar));
    } catch {
      // ignore storage errors
    }
  }, [showPlanningMenuBar]);
  
  // États pour la protection des données validées
  const [validatedData, setValidatedData] = useState({});
  const [showValidationWarning, setShowValidationWarning] = useState(false);
  const [pendingModification, setPendingModification] = useState(null);
  
  // État pour forcer le rafraîchissement de la modale mensuelle
  const [modalForceRefresh, setModalForceRefresh] = useState(0);
  
  // État pour suivre les modifications non sauvegardées
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // État de validation globale
  const [validationState, setValidationState] = useState({
    isWeekValidated: false,
    validatedEmployees: [],
    lockedEmployees: []
  });

  // État pour le verrouillage automatique
  const [autoLockEnabled, setAutoLockEnabled] = useState(true);
  const [lastModifiedDay, setLastModifiedDay] = useState(null);
  const [sessionEditableWeeks, setSessionEditableWeeks] = useState(() => new Set());
  const [sessionAllHistoricalUnlocked, setSessionAllHistoricalUnlocked] = useState(false);
  const [latestVisitedWeek, setLatestVisitedWeek] = useState(validWeek);
  
  // État pour forcer le rafraîchissement
  const [forceRefresh, setForceRefresh] = useState(0);
  
  // États pour le déverrouillage d'urgence (maintenant géré par le hook usePlanningLock)




  


  // États pour les menus et l'import
  const [openMenus, setOpenMenus] = useState({
    retour: false
  });
  const fileInputRef = useRef(null);

  // Détection automatique de l'appareil
  const deviceInfo = useDeviceDetection();

  // Toutes les semaines sont stockées sous la clé du lundi.
  useEffect(() => {
    if (selectedWeek && selectedWeek !== validWeek) {
      setSelectedWeek(validWeek);
    }
  }, [selectedWeek, validWeek, setSelectedWeek]);

  useEffect(() => {
    setLatestVisitedWeek((previousWeek) => (validWeek > previousWeek ? validWeek : previousWeek));
  }, [validWeek]);

  const todayKey = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const weekEndKey = useMemo(() => format(addDays(parseISO(validWeek), 6), 'yyyy-MM-dd'), [validWeek]);
  const isHistoricalWeek = validWeek < todayKey;
  const isBeforeLatestVisitedWeek = validWeek < latestVisitedWeek;
  const isWeekFullyHistorical = weekEndKey < todayKey || isBeforeLatestVisitedWeek;
  const isHistoricalWeekEditable = sessionAllHistoricalUnlocked || sessionEditableWeeks.has(validWeek);
  const isWeekEditingLocked = (isHistoricalWeek || isBeforeLatestVisitedWeek) && !isHistoricalWeekEditable;
  const isWeekFullyLocked = isWeekFullyHistorical && !isHistoricalWeekEditable;
  const isPlanningDateLocked = useCallback((dayIndex) => {
    if (sessionAllHistoricalUnlocked) return false;
    const dayKey = format(addDays(parseISO(validWeek), dayIndex), 'yyyy-MM-dd');
    return (isBeforeLatestVisitedWeek || dayKey < todayKey) && !sessionEditableWeeks.has(validWeek);
  }, [isBeforeLatestVisitedWeek, sessionAllHistoricalUnlocked, sessionEditableWeeks, validWeek]);
  const requestHistoricalWeekUnlock = useCallback(() => {
    const code = window.prompt('Code superviseur requis pour modifier les semaines passées :');
    if (code?.trim() !== SUPERVISOR_WEEK_UNLOCK_CODE) {
      setLocalFeedback('🔒 Code incorrect : les semaines passées restent verrouillées.');
      return;
    }
    setSessionAllHistoricalUnlocked(true);
    setSessionEditableWeeks((prev) => {
      const next = new Set(prev);
      next.add(validWeek);
      return next;
    });
    setLocalFeedback('🔓 Toutes les semaines passées sont modifiables pour cette session.');
  }, [validWeek]);

  const relockHistoricalWeek = useCallback(() => {
    setSessionAllHistoricalUnlocked(false);
    setSessionEditableWeeks(new Set());
    setLocalFeedback('🔒 Semaines passées reverrouillées pour cette session.');
  }, []);

  // Marché ambulant : corrige grille uniforme persistée + migre les coches (une fois au changement de boutique)
  useEffect(() => {
    if (!selectedShop) return;
    setPlanningData((prev) => {
      const next = resyncShopMarcheAmbulantGrid(prev, selectedShop);
      if (next === prev) return prev;
      try {
        saveToLocalStorage('planningData', next);
      } catch (_) {
        /* ignore */
      }
      return next;
    });
  }, [selectedShop, setPlanningData]);

  // Fonction pour calculer le total des heures de la boutique pour le mois
  const calculateShopMonthlyTotal = () => {
    let totalHours = 0;
    const currentDate = parseISO(validWeek);
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // Dernier jour du mois
    const lastDayOfMonth = new Date(year, month + 1, 0);
    
    // Parcourir tous les jours du mois (1er au dernier jour)
    for (let day = 1; day <= lastDayOfMonth.getDate(); day++) {
      const dayKey = format(new Date(year, month, day), 'yyyy-MM-dd');
      
      // Trouver la semaine qui contient ce jour
      const dayDate = new Date(year, month, day);
      const weekStart = startOfWeek(dayDate, { weekStartsOn: 1 });
      const weekKey = format(weekStart, 'yyyy-MM-dd');
      
      // Utiliser getWeekPlanning pour normaliser les données
      const weekData = getWeekPlanning(planningData, selectedShop, weekKey);
      const selectedEmployeesForShop = weekData.selectedEmployees || [];
      const weekPlanning = weekData.planning || {};
      
      // Calculer les heures pour chaque employé
      selectedEmployeesForShop.forEach(employee => {
        const hours = calculateEmployeeDailyHours(employee, dayKey, weekPlanning, config);
        totalHours += hours;
      });
    }
    
    return totalHours;
  };

  // Fonctions pour les menus
  const toggleMenu = (menuName) => {
    console.log('Toggle menu:', menuName);
    setOpenMenus(prev => {
      const newState = {
        ...prev,
        [menuName]: !prev[menuName]
      };
      console.log('New menu state:', newState);
      return newState;
    });
  };

  const closeAllMenus = () => {
    setActiveMenu(null);
  };

  const handleImportClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.style.display = 'none';
    input.onchange = (event) => {
      const file = event.target.files?.[0];
      if (file && onImport) {
        onImport(file);
      }
      setTimeout(() => input.remove(), 0);
    };
    document.body.appendChild(input);
    input.click();
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file && onImport) {
      onImport(file);
    }
    // Reset the input
    event.target.value = '';
  };

  const handleExport = () => {
    console.log('Export simple appelé');
    onExport({
      currentShopId: selectedShop,
      currentWeekKey: validWeek,
      currentWeekPlanning: planning,
      currentEmployees: [...(currentShopEmployees || []), ...(allEmployees || [])],
      userCode: currentUser?.code,
    });
  };

  // Récupérer la boutique actuelle et sa configuration
  const currentShopData = getShopById(planningData, selectedShop);
  const defaultConfig = {
    timeSlots: [
      '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
      '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
      '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30',
      '20:00', '20:30', '21:00', '21:30'
    ],
    interval: 30,
    startTime: '08:00',
    endTime: '21:30'
  };
  
  // Validation et nettoyage de la configuration
  let config = currentShopData?.config || defaultConfig;
  
  // S'assurer que la configuration est valide
  if (!config || !Array.isArray(config.timeSlots) || config.timeSlots.length === 0) {
    console.log('Configuration des tranches horaires invalide, utilisation de la configuration par défaut:', { 
      currentShopData, 
      originalConfig: config 
    });
    config = defaultConfig;
  }
  
  // Nettoyer les tranches horaires pour s'assurer qu'elles sont toutes des chaînes valides
  if (config.timeSlots) {
    config.timeSlots = config.timeSlots.filter(slot => 
      slot && typeof slot === 'string' && slot.match(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    );
    
    // Si après nettoyage il n'y a plus de tranches, utiliser la configuration par défaut
    if (config.timeSlots.length === 0) {
      console.log('Aucune tranche horaire valide trouvée, utilisation de la configuration par défaut');
      config = defaultConfig;
    }
  }



  // Charger l'état de validation depuis le localStorage
  useEffect(() => {
    if (selectedShop && validWeek) {
      const savedValidation = localStorage.getItem(`validation_${selectedShop}_${validWeek}`);
      if (savedValidation) {
        try {
          const parsedValidation = JSON.parse(savedValidation);
          setValidationState(parsedValidation);
        } catch (error) {
          console.error('Erreur lors du chargement de la validation:', error);
        }
      } else {
        // Si pas d'état sauvegardé, ne pas verrouiller automatiquement
        console.log('✅ Aucun verrouillage automatique - employés libres');
      }
    }
  }, [selectedShop, validWeek, localSelectedEmployees]);

  // Gestionnaire pour fermer les menus quand on clique ailleurs
  useEffect(() => {
    const handleClickOutside = (event) => {
      const target = event.target;
      if (target && typeof target.closest === 'function' && !target.closest('.menu-button') && !target.closest('.retour-menu')) {
        closeAllMenus();
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);
  
  // Validation et nettoyage des données shops
  const shops = React.useMemo(() => {
    if (!planningData?.shops || !Array.isArray(planningData.shops)) {
      return [];
    }
    
    return planningData.shops
      .filter(shop => shop && typeof shop === 'object' && shop.id && shop.name)
      .map(shop => ({
        id: String(shop.id),
        name: String(shop.name),
        canWorkIn: Array.isArray(shop.canWorkIn) ? shop.canWorkIn.map(String) : [],
        employees: Array.isArray(shop.employees) ? shop.employees
          .filter(emp => emp && typeof emp === 'object' && emp.id && emp.name)
          .map(emp => ({
            id: String(emp.id),
            name: String(emp.name),
            canWorkIn: Array.isArray(emp.canWorkIn) ? emp.canWorkIn.map(String) : [],
            ...(emp.color && { color: String(emp.color) }),
            ...(emp.role && { role: String(emp.role) })
          })) : [],
        weeks: shop.weeks && typeof shop.weeks === 'object' ? shop.weeks : {},
        config: shop.config && typeof shop.config === 'object' ? shop.config : {}
      }));
  }, [planningData?.shops]);

  const accessibleShops = useMemo(() => {
    if (!currentUser?.code) return shops;
    return filterShopsForUser(currentUser.code, shops);
  }, [currentUser, shops]);

  const userScopedPlanningData = useMemo(() => {
    if (!currentUser?.code) return planningData;
    return filterPlanningDataForUser(currentUser.code, planningData);
  }, [currentUser, planningData]);

  useEffect(() => {
    if (!accessibleShops.length || !setSelectedShop) return;
    const isAllowed = accessibleShops.some((shop) => shop.id === selectedShop);
    if (!isAllowed) {
      setSelectedShop(accessibleShops[0].id);
    }
  }, [accessibleShops, selectedShop, setSelectedShop]);
  
  // État pour les employés de la boutique actuelle
  const [currentShopEmployees, setCurrentShopEmployees] = useState([]);
  
  // État pour tous les employés de toutes les boutiques
  const [allEmployees, setAllEmployees] = useState([]);

  const isEmployeeAssignedToCurrentShop = useCallback((employee) => {
    if (!employee || !selectedShop) return false;
    const canWorkIn = Array.isArray(employee.canWorkIn)
      ? employee.canWorkIn.map((s) => String(s))
      : [];
    if (canWorkIn.length > 0) return canWorkIn.includes(selectedShop);
    if (employee.mainShop) return String(employee.mainShop) === selectedShop;
    // Filtrage strict pour éviter les employés hors boutique.
    return false;
  }, [selectedShop]);

  // Mettre à jour les employés visibles (noms canoniques multi-boutiques)
  useEffect(() => {
    if (!planningData || !selectedShop) {
      setCurrentShopEmployees([]);
      setAllEmployees([]);
      return;
    }

    const weekDate = validWeek ? parseISO(validWeek) : new Date();
    const syncedPlanningData = syncEmployeeNamesAcrossShops(planningData, weekDate);
    if (syncedPlanningData !== planningData) {
      try {
        saveToLocalStorage('planningData', syncedPlanningData);
      } catch (_) {
        /* ignore */
      }
    }

    const currentShopData = syncedPlanningData.shops?.find((shop) => shop.id === selectedShop);
    const visibleEmployeesInCurrentShop = (currentShopData?.employees || []).filter((emp) =>
      !!emp && !emp.hiddenFrom && isEmployeeAssignedToCurrentShop(emp)
    );

    const deduped = [];
    const seen = new Set();
    visibleEmployeesInCurrentShop.forEach((emp) => {
      if (!emp?.id || seen.has(emp.id)) return;
      seen.add(emp.id);
      deduped.push(emp);
    });

    const allEmployeesData = getAllEmployees(syncedPlanningData, weekDate);
    const canonicalNameById = new Map(allEmployeesData.map((emp) => [emp.id, emp.name]));
    const dedupedWithCanonicalNames = deduped.map((emp) => ({
      ...emp,
      name: canonicalNameById.get(emp.id) || emp.name,
    }));

    setAllEmployees(allEmployeesData);
    setCurrentShopEmployees(dedupedWithCanonicalNames);
    console.log(`Employés visibles pour ${selectedShop} (semaine ${selectedWeek}):`, dedupedWithCanonicalNames.map((emp) => emp.name));
  }, [planningData, selectedShop, selectedWeek, validWeek, isEmployeeAssignedToCurrentShop]);

  // Récupérer le planning de la semaine actuelle
  const weekData = selectedShop && validWeek ? getWeekPlanning(planningData, selectedShop, validWeek) : { planning: {}, selectedEmployees: [] };
  const [planning, setPlanning] = useState(weekData.planning || {});
  const initialPlanningSyncKeyRef = useRef('');
  const jsonRestoreInputRef = useRef(null);

  const getPlanningEntryCount = useCallback((weekPlanning) => {
    if (!weekPlanning || typeof weekPlanning !== 'object') return 0;
    return Object.values(weekPlanning).reduce((total, employeePlanning) => {
      if (!employeePlanning || typeof employeePlanning !== 'object') return total;
      return total + Object.keys(employeePlanning).length;
    }, 0);
  }, []);

  const filterPlanningForShopEmployees = useCallback((weekPlanning, allowedEmployeeIds) => {
    if (!weekPlanning || typeof weekPlanning !== 'object') return {};
    const allowed = new Set(allowedEmployeeIds || []);
    const filtered = {};
    Object.entries(weekPlanning).forEach(([empId, days]) => {
      if (allowed.has(empId)) filtered[empId] = days;
    });
    return filtered;
  }, []);
  
  // Fonction de verrouillage automatique lors du changement de jour
  const autoLockPreviousDay = useCallback((newDay) => {
    console.log('🔍 autoLockPreviousDay appelé:', { 
      autoLockEnabled, 
      selectedEmployees, 
      localSelectedEmployees,
      lastModifiedDay, 
      newDay,
      validationState 
    });
    
    // Utiliser localSelectedEmployees si selectedEmployees est vide
    const employeesToLock = selectedEmployees && selectedEmployees.length > 0 ? selectedEmployees : localSelectedEmployees;
    
    if (!autoLockEnabled || !employeesToLock || employeesToLock.length === 0) {
      console.log('❌ Verrouillage automatique ignoré:', { 
        autoLockEnabled, 
        selectedEmployeesLength: selectedEmployees?.length,
        localSelectedEmployeesLength: localSelectedEmployees?.length,
        employeesToLockLength: employeesToLock?.length
      });
      return;
    }
    
    // Si on a modifié un jour précédent, le verrouiller
    if (lastModifiedDay !== null && lastModifiedDay < newDay) {
      const updatedValidationState = {
        ...validationState,
        isWeekValidated: true,
        lockedEmployees: [...new Set([...validationState.lockedEmployees, ...employeesToLock])]
      };
      
      setValidationState(updatedValidationState);
      
      // Sauvegarder l'état de validation
      if (selectedShop && validWeek) {
        localStorage.setItem(`validation_${selectedShop}_${validWeek}`, JSON.stringify(updatedValidationState));
      }
      
      console.log(`🔒 Verrouillage automatique du jour ${lastModifiedDay} lors du passage au jour ${newDay}`);
      console.log('📊 État de validation mis à jour:', updatedValidationState);
    } else {
      console.log('❌ Conditions non remplies pour le verrouillage:', { lastModifiedDay, newDay });
    }
  }, [autoLockEnabled, selectedEmployees, localSelectedEmployees, lastModifiedDay, validationState, selectedShop, validWeek]);

  // Fonction pour changer de jour avec verrouillage automatique
  const handleDayChange = useCallback((newDay) => {
    console.log('🔍 handleDayChange appelé:', { currentDay, newDay, lastModifiedDay });
    
    // Sauvegarde silencieuse du planning actuel avant le changement de jour
    if (selectedShop && validWeek && Object.keys(planning).length > 0) {
      try {
        setPlanningData((prev) => safeSaveWeekPlanning(prev, selectedShop, validWeek, planning, localSelectedEmployees));
        console.log('💾 Sauvegarde silencieuse lors du changement de jour');
      } catch (error) {
        console.error('Erreur lors de la sauvegarde silencieuse:', error);
      }
    }
    
    // Verrouiller le jour précédent si nécessaire
    if (currentDay !== null && lastModifiedDay !== null && currentDay < newDay) {
      console.log('🔒 Verrouillage automatique lors du changement de jour:', { currentDay, newDay, lastModifiedDay });
      autoLockPreviousDay(newDay);
    } else {
      console.log('❌ Conditions non remplies pour le verrouillage lors du changement de jour:', { 
        currentDay, 
        lastModifiedDay, 
        newDay,
        condition1: currentDay !== null,
        condition2: lastModifiedDay !== null,
        condition3: currentDay < newDay
      });
    }
    setCurrentDay(newDay);
  }, [currentDay, lastModifiedDay, autoLockPreviousDay, selectedShop, validWeek, planning, localSelectedEmployees, setPlanningData, safeSaveWeekPlanning]);

  // Mettre à jour les employés sélectionnés globalement
  useEffect(() => {
    setSelectedEmployees(localSelectedEmployees);
  }, [localSelectedEmployees, setSelectedEmployees]);

  // Le nouveau système de verrou à bail gère automatiquement tout cela

  // Le nouveau système de verrou à bail gère automatiquement tout cela
  // Le nouveau système de verrou à bail gère automatiquement tout cela
    
  // Le nouveau système de verrou à bail gère automatiquement tout cela

  // Inclure automatiquement tout nouvel employé de la boutique dans la sélection locale
  useEffect(() => {
    if (!currentShopEmployees || currentShopEmployees.length === 0) return;

    const currentIds = currentShopEmployees.map((emp) => emp.id);
    const allowed = new Set(currentIds);
    const sanitized = localSelectedEmployees.filter((id) => allowed.has(id));
    const missing = currentIds.filter((id) => !sanitized.includes(id));

    if (missing.length > 0 || sanitized.length !== localSelectedEmployees.length) {
      setLocalSelectedEmployees([...sanitized, ...missing]);
    }
  }, [currentShopEmployees, localSelectedEmployees]);

  // Mettre à jour localSelectedEmployees quand selectedEmployees change (pour la première initialisation)
  useEffect(() => {
    if (!currentShopEmployees || currentShopEmployees.length === 0) return;
    
    const allIds = currentShopEmployees.map(e => e.id);
    
    // Si selectedEmployees est vide ou ne contient pas d'employés de la boutique actuelle
    if (!Array.isArray(selectedEmployees) || selectedEmployees.length === 0) {
      console.log('🔧 Initialisation avec tous les employés de la boutique:', allIds);
      setLocalSelectedEmployees(allIds);
        } else {
      // Filtrer selectedEmployees pour ne garder que ceux de la boutique actuelle
      const validEmployees = selectedEmployees.filter(id => allIds.includes(id));
      if (validEmployees.length !== selectedEmployees.length) {
        console.log('🔧 Filtrage des employés sélectionnés:', selectedEmployees, '→', validEmployees);
        setLocalSelectedEmployees(validEmployees);
      } else if (JSON.stringify(validEmployees.sort()) !== JSON.stringify(localSelectedEmployees.sort())) {
        console.log('🔧 Mise à jour des employés sélectionnés:', localSelectedEmployees, '→', validEmployees);
        setLocalSelectedEmployees(validEmployees);
      }
    }
  }, [selectedEmployees, currentShopEmployees]);

  // Suppression employé désactivée: handler retiré

  const handleRenameEmployeeClick = useCallback(async (employeeId) => {
    if (!employeeId) return;
    if (readOnly) {
      setLocalFeedback('🔒 Lecture seule — renommage impossible');
      return;
    }
    const storedNames = getEmployeeStoredNameVariants(planningData, employeeId);
    const fallbackName = getAllEmployees(planningData).find((emp) => emp.id === employeeId)?.name || '';
    const promptDefault = storedNames.length === 1 ? storedNames[0] : storedNames[0] || fallbackName;
    const promptMessage = storedNames.length > 1
      ? `Noms enregistrés (par boutique) : ${storedNames.join(' / ')}\n\nNouveau nom unique pour toutes les boutiques :`
      : "Nouveau nom de l'employé:";
    const newName = window.prompt(promptMessage, promptDefault);
    const trimmed = String(newName || '').trim();
    if (!trimmed) return;
    if (employeeStoredNamesMatch(planningData, employeeId, trimmed)) {
      setLocalFeedback(`ℹ️ « ${trimmed} » est déjà enregistré partout en base.`);
      return;
    }
    try {
      let updatedSnapshot = null;
      setPlanningData((prev) => {
        updatedSnapshot = renameEmployeeInPlanningData(prev, employeeId, trimmed);
        try {
          saveToLocalStorage('planningData', updatedSnapshot);
        } catch (_) {
          /* ignore */
        }
        return updatedSnapshot;
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
      const payload = updatedSnapshot || renameEmployeeInPlanningData(planningData, employeeId, trimmed);
      try {
        const remoteResult = await saveCompletePlanningData(payload);
        if (remoteResult?.ok) {
          if (remoteResult.planningData) {
            setPlanningData(remoteResult.planningData);
            saveToLocalStorage('planningData', remoteResult.planningData);
          }
          setLocalFeedback(`✏️ Nom mis à jour partout : ${trimmed} — sauvegardé dans Supabase`);
        } else {
          setLocalFeedback(`✏️ Nom mis à jour localement : ${trimmed} — échec Supabase, refaites SAUVE SUPABASE`);
        }
      } catch (saveError) {
        console.error('Erreur sauvegarde Supabase du renommage:', saveError);
        setLocalFeedback(`✏️ Nom mis à jour localement : ${trimmed} — échec Supabase, refaites SAUVE SUPABASE`);
      }
      setForceRefresh((prev) => prev + 1);
    } catch (e) {
      console.error('Erreur renommage employé:', e);
      setLocalFeedback('❌ Erreur lors du renommage');
    }
  }, [planningData, readOnly, setPlanningData]);

  const HIDE_EMPLOYEE_SINCE_DATE = '2026-01-01';

  const persistEmployeeStatusChange = useCallback(async (updatedData, successMessage, auditAction, auditDetails) => {
    setPlanningData(updatedData);
    localStorage.setItem('planningData', JSON.stringify(updatedData));
    addAuditLog({
      action: auditAction,
      details: auditDetails,
      userCode: currentUser?.code,
      userName: currentUser?.name,
      shopId: selectedShop,
      shopName: planningData?.shops?.find((s) => s.id === selectedShop)?.name || selectedShop
    });
    try {
      const remoteResult = await saveCompletePlanningData(updatedData);
      if (remoteResult?.ok) {
        if (remoteResult.planningData) {
          setPlanningData(remoteResult.planningData);
          saveToLocalStorage('planningData', remoteResult.planningData);
        }
        const preservedNote = remoteResult.preservedShopNames?.length
          ? ` — boutiques conservées: ${remoteResult.preservedShopNames.join(', ')}`
          : '';
        setLocalFeedback(`${successMessage}${preservedNote}`);
      } else {
        setLocalFeedback(`${successMessage} (local seulement — échec Supabase)`);
      }
    } catch (error) {
      console.error('Erreur sauvegarde Supabase employé:', error);
      setLocalFeedback(`${successMessage} (local seulement — échec Supabase)`);
    }
  }, [setPlanningData, selectedShop, planningData, currentUser]);

  // Fonction pour masquer un employé (toutes les boutiques)
  const handleHideEmployee = useCallback(async (employeeId) => {
    if (!employeeId || !selectedShop) return;

    const currentShopData = planningData?.shops?.find((shop) => shop.id === selectedShop);
    const employee = currentShopData?.employees?.find((emp) => emp.id === employeeId);
    const employeeName = employee?.name || employeeId;

    const confirmHide = window.confirm(
      `Masquer « ${employeeName} » sur TOUTES les boutiques ?\n\n` +
      `Il restera invisible jusqu'à réactivation manuelle.\n\n` +
      `Pour une suppression définitive (ne revient plus après sync), utilisez « Archiver ».`
    );
    if (!confirmHide) return;

    const hideFromDate = HIDE_EMPLOYEE_SINCE_DATE;
    try {
      const updatedData = hideEmployee(planningData, employeeId, hideFromDate, null);
      await persistEmployeeStatusChange(
        updatedData,
        `🚫 Employé « ${employeeName} » masqué (toutes boutiques)`,
        'Masquage Employe',
        `Employe ${employeeName} masque sur toutes les boutiques (reference ${HIDE_EMPLOYEE_SINCE_DATE}).`
      );
    } catch (e) {
      console.error('Erreur masquage employé:', e);
      setLocalFeedback('❌ Erreur lors du masquage');
    }
  }, [planningData, selectedShop, persistEmployeeStatusChange]);

  const handleArchiveEmployee = useCallback(async (employeeId) => {
    if (!employeeId || !selectedShop) return;

    const currentShopData = planningData?.shops?.find((shop) => shop.id === selectedShop);
    const employee = currentShopData?.employees?.find((emp) => emp.id === employeeId);
    const employeeName = employee?.name || employeeId;

    const confirmArchive = window.confirm(
      `Archiver définitivement « ${employeeName} » ?\n\n` +
      `✅ Masqué sur toutes les boutiques\n` +
      `✅ Ne sera plus réintroduit depuis Supabase\n` +
      `✅ Les plannings passés restent consultables\n\n` +
      `Réactivation possible via « Employés masqués ».`
    );
    if (!confirmArchive) return;

    try {
      const updatedData = archiveEmployee(planningData, employeeId, HIDE_EMPLOYEE_SINCE_DATE);
      await persistEmployeeStatusChange(
        updatedData,
        `📦 Employé « ${employeeName} » archivé définitivement`,
        'Archivage Employe',
        `Employe ${employeeName} archive definitivement.`
      );
    } catch (e) {
      console.error('Erreur archivage employé:', e);
      setLocalFeedback('❌ Erreur lors de l\'archivage');
    }
  }, [planningData, selectedShop, persistEmployeeStatusChange]);

  // Fonction pour réactiver un employé (toutes les boutiques)
  const handleShowEmployee = useCallback(async (employeeId) => {
    if (!employeeId || !selectedShop) return;

    const currentShopData = planningData?.shops?.find((shop) => shop.id === selectedShop);
    const employee = currentShopData?.employees?.find((emp) => emp.id === employeeId);
    const employeeName = employee?.name || employeeId;

    try {
      const updatedData = unarchiveEmployee(planningData, employeeId);
      await persistEmployeeStatusChange(
        updatedData,
        `🔓 Employé « ${employeeName} » réactivé (toutes boutiques)`,
        'Reactivation Employe',
        `Employe ${employeeName} reactive sur toutes les boutiques.`
      );
    } catch (e) {
      console.error('Erreur réactivation employé:', e);
      setLocalFeedback('❌ Erreur lors de la réactivation');
    }
  }, [planningData, selectedShop, persistEmployeeStatusChange]);
  
  // Mettre à jour le planning global
  useEffect(() => {
    setGlobalPlanning(planning);
  }, [planning, setGlobalPlanning]);

  // Charger les données validées
  useEffect(() => {
    const savedValidatedData = localStorage.getItem(`validated_${selectedShop}_${validWeek}`);
    if (savedValidatedData) {
      try {
        setValidatedData(JSON.parse(savedValidatedData));
      } catch (error) {
        console.error('Erreur lors du chargement des données validées:', error);
      }
    } else {
      setValidatedData({});
    }
  }, [selectedShop, validWeek]);

  // Sauvegarder les données validées
  useEffect(() => {
    if (Object.keys(validatedData).length > 0) {
      localStorage.setItem(`validated_${selectedShop}_${validWeek}`, JSON.stringify(validatedData));
    }
  }, [validatedData, selectedShop, validWeek]);

  // S'assurer que la semaine commence par lundi
  const getMondayOfWeek = (dateString) => {
    const date = parseISO(dateString);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Ajuster pour que lundi = 1
    return new Date(date.setDate(diff));
  };
  
  const mondayOfWeek = getMondayOfWeek(validWeek);
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(mondayOfWeek, i);
    return {
      name: format(date, 'EEEE', { locale: fr }),
      date: format(date, 'd MMMM', { locale: fr }),
    };
  });

  const employeeNameById = useMemo(() => {
    const map = new Map();
    (currentShopEmployees || []).forEach((employee) => {
      if (employee?.id) {
        map.set(employee.id, employee.name || employee.id);
      }
    });
    return map;
  }, [currentShopEmployees]);

  const currentShopLabel = currentShopData?.name || selectedShop;

  // Formater le titre de la semaine
  const getWeekTitle = () => {
    const monday = format(mondayOfWeek, 'd MMMM', { locale: fr });
    const sunday = format(addDays(mondayOfWeek, 6), 'd MMMM yyyy', { locale: fr });
    return `Semaine du ${monday} au ${sunday}`;
  };

  useEffect(() => {
    setLocalFeedback('');
    // Réinitialiser toutes les modales pour éviter l'ouverture automatique
    setShowMonthlyRecapModal(false);
    setShowEmployeeMonthlyRecap(false);
    setShowEmployeeMonthlyWeeklyModal(false);
    setShowMonthlyDetailModal(false);
    setShowEmployeeWeeklyRecap(false);
    

    
    setShowEmployeeMonthlyDetail(false);
    setShowRecapModal(null);
    setShowResetModal(false);
    setSelectedEmployeeForMonthlyRecap('');
    setSelectedEmployeeForWeeklyRecap('');
    setSelectedEmployeeForMonthlyDetail('');
  }, [selectedShop, selectedWeek]);

  // Gérer le changement de boutique et de semaine de manière unifiée
  useEffect(() => {
    console.log('🔄 useEffect déclenché - Changement de boutique/semaine:', {
      selectedShop,
      selectedWeek,
      forceRefresh,
      planningDataKeys: planningData ? Object.keys(planningData) : 'null'
    });

    if (selectedShop && validWeek && planningData?.shops?.length) {
      const syncKey = `${selectedShop}:${validWeek}`;
      initialPlanningSyncKeyRef.current = syncKey;

      const weekDate = parseISO(validWeek);
      const freshPlanningData = syncEmployeeNamesAcrossShops(planningData, weekDate);

      const currentShopData = freshPlanningData.shops?.find((shop) => shop.id === selectedShop);
      const visibleShopEmployees = (currentShopData?.employees || []).filter((emp) =>
        !!emp && !emp.hiddenFrom && isEmployeeAssignedToCurrentShop(emp)
      );
      const currentShopEmployeeIds = Array.from(
        new Set(visibleShopEmployees.map((emp) => emp.id).filter(Boolean))
      );

      const weekData = getWeekPlanning(freshPlanningData, selectedShop, validWeek);
      console.log('🔍 Résultat getWeekPlanning:', weekData);

      const filteredPlanning = filterPlanningForShopEmployees(
        weekData.planning || {},
        currentShopEmployeeIds
      );
      setPlanning(filteredPlanning);

      if (weekData.selectedEmployees && weekData.selectedEmployees.length > 0) {
        const validEmployees = weekData.selectedEmployees.filter((empId) => currentShopEmployeeIds.includes(empId));
        setLocalSelectedEmployees(validEmployees);
        setSelectedEmployees(validEmployees);
      } else if (currentShopEmployeeIds.length > 0) {
        setLocalSelectedEmployees(currentShopEmployeeIds);
        setSelectedEmployees(currentShopEmployeeIds);
      } else {
        setLocalSelectedEmployees([]);
        setSelectedEmployees([]);
      }
    }
  }, [
    selectedShop,
    selectedWeek,
    validWeek,
    forceRefresh,
    planningData,
    isEmployeeAssignedToCurrentShop,
    filterPlanningForShopEmployees,
    setSelectedEmployees
  ]);

  useEffect(() => {
    if (!selectedShop || !validWeek || !planningData?.shops?.length) return;
    const syncKey = `${selectedShop}:${validWeek}`;
    if (initialPlanningSyncKeyRef.current === syncKey) return;

    const weekDataFromLoadedState = getWeekPlanning(planningData, selectedShop, validWeek);
    const loadedPlanning = weekDataFromLoadedState?.planning || {};
    if (getPlanningEntryCount(loadedPlanning) === 0) return;

    const currentShopData = planningData.shops?.find((shop) => shop.id === selectedShop);
    const visibleShopEmployees = (currentShopData?.employees || []).filter((emp) =>
      !!emp && !emp.hiddenFrom && isEmployeeAssignedToCurrentShop(emp)
    );
    const currentShopEmployeeIds = Array.from(new Set(visibleShopEmployees.map((emp) => emp.id).filter(Boolean)));
    const validSelectedEmployees = (weekDataFromLoadedState.selectedEmployees || [])
      .filter((empId) => currentShopEmployeeIds.includes(empId));

    setPlanning(filterPlanningForShopEmployees(loadedPlanning, currentShopEmployeeIds));
    initialPlanningSyncKeyRef.current = syncKey;
    if (validSelectedEmployees.length > 0) {
      setLocalSelectedEmployees(validSelectedEmployees);
      setSelectedEmployees(validSelectedEmployees);
    }
    console.log('📥 Planning resynchronisé après chargement initial des données');
  }, [
    selectedShop,
    validWeek,
    planningData,
    getPlanningEntryCount,
    isEmployeeAssignedToCurrentShop,
    filterPlanningForShopEmployees,
    setSelectedEmployees
  ]);

  const toggleSlot = useCallback((employee, slotIndex, dayIndex, forceValue = null) => {
    if (isPlanningDateLocked(dayIndex)) {
      setLocalFeedback('🔒 Date antérieure verrouillée. Code superviseur requis pour la modifier pendant cette session.');
      return;
    }
    if (readOnly) {
      return;
    }
    // SAUVEGARDE DE SÉCURITÉ AVANT TOUTE MODIFICATION
    if (selectedShop && validWeek && planning && Object.keys(planning).length > 0) {
      try {
        const backupKey = `backup_${selectedShop}_${validWeek}_${Date.now()}`;
        localStorage.setItem(backupKey, JSON.stringify(planning));
        console.log('🛡️ Sauvegarde de sécurité créée:', backupKey);
        try {
          const prefix = `backup_${selectedShop}_${validWeek}_`;
          const keys = Object.keys(localStorage).filter(k => k.startsWith(prefix)).sort();
          while (keys.length > 2) {
            const oldest = keys.shift();
            if (oldest) localStorage.removeItem(oldest);
          }
        } catch (_) {}
      } catch (error) {
        console.error('Erreur lors de la sauvegarde de sécurité:', error);
      }
    }
    
    // Validation robuste de la configuration des tranches horaires
    if (!config || !Array.isArray(config.timeSlots) || config.timeSlots.length === 0) {
      setLocalFeedback('Erreur: Configuration des tranches horaires non valide. Veuillez reconfigurer la boutique.');
      console.error('toggleSlot: Configuration invalide:', { config, timeSlots: config?.timeSlots });
      return;
    }
    
    // Validation de l'index du slot
    if (slotIndex < 0 || slotIndex >= config.timeSlots.length) {
      setLocalFeedback(`Erreur: Index de créneau invalide (${slotIndex}). Configuration: ${config.timeSlots.length} créneaux.`);
      console.error('toggleSlot: Index de slot invalide:', { slotIndex, timeSlotsLength: config.timeSlots.length });
      return;
    }
    
    console.log('Debug toggleSlot:', {
      employee,
      validationState,
      lockedEmployees: validationState.lockedEmployees,
      isLocked: validationState.lockedEmployees.includes(employee),
      forceValue,
      validationStateType: typeof validationState,
      lockedEmployeesType: typeof validationState.lockedEmployees,
      config: { timeSlotsLength: config.timeSlots.length, interval: config.interval }
    });
    
    // Vérifier si l'employé est verrouillé
    if (validationState.lockedEmployees && validationState.lockedEmployees.includes(employee) && forceValue === null) {
      console.log('EMPLOYÉ BLOQUÉ - Modification refusée');
      setLocalFeedback(`⚠️ L'employé ${employee} est verrouillé. Utilisez le bouton "Débloquer employé" pour le modifier.`);
      return;
    }
    
    const dayKey = format(addDays(mondayOfWeek, dayIndex), 'yyyy-MM-dd');
    const validationKey = `${employee}_${dayKey}`;
    const isSlotValidated = validatedData[validationKey]?.[slotIndex];
    
    if (isSlotValidated && forceValue === null) {
      setShowValidationWarning(true);
      setPendingModification({ employee, slotIndex, dayIndex });
      return;
    }
    
    // Verrouillage automatique : enregistrer le jour modifié
    if (forceValue === null) {
      console.log('📝 Mise à jour lastModifiedDay:', { dayIndex, previousLastModifiedDay: lastModifiedDay });
      setLastModifiedDay(dayIndex);
      console.log('✅ lastModifiedDay mis à jour vers:', dayIndex);
      
      // Vérifier si l'employé est maintenant verrouillé
      setTimeout(() => {
        console.log('🔍 Vérification du verrouillage après modification:', {
          employee,
          lockedEmployees: validationState.lockedEmployees,
          isLocked: validationState.lockedEmployees.includes(employee)
        });
      }, 100);
    }
    
    setPlanning(prev => {
      const updatedPlanning = { ...prev };
      if (!updatedPlanning[employee]) {
        updatedPlanning[employee] = {};
      }
      if (!Array.isArray(updatedPlanning[employee][dayKey])) {
        updatedPlanning[employee][dayKey] = Array(config.timeSlots.length).fill(false);
      }
      
      // S'assurer que le tableau a la bonne taille
      if (updatedPlanning[employee][dayKey].length !== config.timeSlots.length) {
        console.warn('Redimensionnement du tableau de slots:', {
          oldLength: updatedPlanning[employee][dayKey].length,
          newLength: config.timeSlots.length,
          employee,
          dayKey
        });
        const newSlots = Array(config.timeSlots.length).fill(false);
        for (let i = 0; i < Math.min(updatedPlanning[employee][dayKey].length, config.timeSlots.length); i++) {
          newSlots[i] = updatedPlanning[employee][dayKey][i];
        }
        updatedPlanning[employee][dayKey] = newSlots;
      }
      
      updatedPlanning[employee][dayKey] = updatedPlanning[employee][dayKey].map((val, idx) =>
        idx === slotIndex ? (forceValue !== null ? forceValue : !val) : val
      );
      
      // SAUVEGARDE AUTOMATIQUE IMMÉDIATE (seulement si on a la main)
      if (selectedShop && validWeek && !readOnly) {
        try {
          // Toujours partir du planningData le plus récent (évite d'écraser d'autres boutiques avec un snapshot périmé)
          setPlanningData((prevData) =>
            saveWeekPlanning(prevData, selectedShop, validWeek, updatedPlanning, localSelectedEmployees)
          );
          setHasUnsavedChanges(false); // Réinitialiser l'indicateur après sauvegarde
          console.log('💾 Sauvegarde automatique après modification');
        } catch (error) {
          console.error('Erreur lors de la sauvegarde automatique:', error);
          setHasUnsavedChanges(true); // Marquer comme non sauvegardé en cas d'erreur
        }
      } else {
        setHasUnsavedChanges(true); // Marquer comme non sauvegardé si pas de sauvegarde automatique
      }
      
      return updatedPlanning;
    });
  }, [config, mondayOfWeek, validatedData, validationState.lockedEmployees, lastModifiedDay, setPlanningData, selectedShop, validWeek, localSelectedEmployees, readOnly, isPlanningDateLocked]);

  // Fonction pour marquer un créneau comme validé
  const markAsValidated = useCallback((employee, dayKey, slotIndex) => {
    const validationKey = `${employee}_${dayKey}`;
    setValidatedData(prev => ({
      ...prev,
      [validationKey]: {
        ...prev[validationKey],
        [slotIndex]: true
      }
    }));
  }, []);

  // Fonction pour forcer la modification d'un créneau validé
  const forceModification = useCallback(() => {
    if (pendingModification) {
      const { employee, slotIndex, dayIndex } = pendingModification;
      toggleSlot(employee, slotIndex, dayIndex, null);
      setPendingModification(null);
    }
    setShowValidationWarning(false);
  }, [pendingModification, toggleSlot]);

  // Fonction pour annuler la modification
  const cancelModification = useCallback(() => {
    setPendingModification(null);
    setShowValidationWarning(false);
  }, []);

  // Fonction de sauvegarde forcée
  const handleManualSave = useCallback(async () => {
          if (readOnly) {
      return;
    }
    try {
      if (selectedShop && validWeek) {
        if (currentUser?.code) {
          const holderId = `${currentUser.code}::${currentUser.sessionId || currentUser.loginTime || 'local'}`;
          try {
            await heartbeat(holderId);
          } catch (lockError) {
            console.warn('⚠️ Renouvellement verrou avant sauvegarde:', lockError);
          }
        }

        // Forcer la sauvegarde des données actuelles en mémoire
        let updatedSnapshot;
        setPlanningData((prev) => {
          updatedSnapshot = saveWeekPlanning(prev, selectedShop, validWeek, planning, localSelectedEmployees);
          return updatedSnapshot;
        });
        if (updatedSnapshot) {
          saveToLocalStorage('planningData', updatedSnapshot);
        }
        
        // Attendre un peu pour s'assurer que le state est mis à jour
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Sauvegarder d'abord la semaine courante (enregistrement visible par boutique/semaine)
        try {
          const weekSaved = await saveRemotePlanning(updatedSnapshot, selectedShop, validWeek);
          if (weekSaved) {
            console.log('✅ Sauvegarde semaine Supabase réussie');
            setLocalFeedback('💾 Semaine sauvegardée (Supabase)');
          } else {
            console.log('❌ Échec sauvegarde semaine Supabase');
          }
        } catch (error) {
          console.error('❌ Erreur sauvegarde semaine Supabase:', error);
        }

        // Puis sauvegarde du fichier complet (backup) avec les données fraîches
        try { 
          console.log('🔄 Sauvegarde complète avec données fraîches...');
          const remoteResult = await saveCompletePlanningData(
            updatedSnapshot,
            getSaveMergeOptionsForUser(currentUser)
          );
          if (remoteResult?.ok) {
            if (remoteResult.planningData) {
              setPlanningData(remoteResult.planningData);
              saveToLocalStorage('planningData', remoteResult.planningData);
            }
            console.log('✅ Sauvegarde complète Supabase réussie');
            const preservedNote = remoteResult.preservedShopNames?.length
              ? ` — boutiques conservées depuis Supabase: ${remoteResult.preservedShopNames.join(', ')}`
              : '';
            setLocalFeedback(`💾 Sauvegarde complète réussie (${remoteResult.mergedShopsCount || 0} boutique(s))${preservedNote}`);
            addAuditLog({
              action: 'Sauvegarde Manuelle',
              details: `Sauvegarde complete validee pour la semaine ${validWeek}.`,
              userCode: currentUser?.code,
              userName: currentUser?.name,
              shopId: selectedShop,
              shopName: shops.find((shop) => shop.id === selectedShop)?.name || selectedShop
            });
          } else {
            console.log('❌ Échec sauvegarde complète Supabase');
            const failMsg = remoteResult?.message || 'Échec sauvegarde complète — vos autres boutiques n\'ont pas été modifiées sur Supabase.';
            setLocalFeedback(`❌ ${failMsg}`);
            if (remoteResult?.reason === 'remote_unavailable') {
              alert(`❌ ${failMsg}`);
            }
          }
        } catch (error) {
          console.error('❌ Erreur sauvegarde complète Supabase:', error);
          setLocalFeedback('❌ Erreur sauvegarde complète');
        }
        
        setHasUnsavedChanges(false); // Réinitialiser l'indicateur après sauvegarde manuelle
      } else {
        setLocalFeedback('❌ Sélectionnez une boutique et une semaine avant de sauvegarder');
      }
    } catch (error) {
      console.error('Erreur sauvegarde manuelle:', error);
      setLocalFeedback('❌ Erreur lors de la sauvegarde');
    }
  }, [planning, localSelectedEmployees, selectedShop, validWeek, setPlanningData, setLocalFeedback, setHasUnsavedChanges, readOnly, shops, currentUser?.code, currentUser?.name]);

  const handleCloseApplication = useCallback(async () => {
    if (!window.confirm('Voulez-vous fermer l’application ?')) return;
    try {
      if (typeof onExitApplication === 'function') {
        await Promise.resolve(onExitApplication());
        return;
      }
      await handleManualSave();
      window.close();
      setTimeout(() => {
        if (!window.closed) {
          window.location.href = 'about:blank';
        }
      }, 250);
    } catch (_) {
      window.location.href = 'about:blank';
    }
  }, [onExitApplication, handleManualSave]);

  // Fonction de test de connexion Supabase
  const testSupabase = useCallback(async () => {
    console.log('🧪 Test Supabase...');
    const connectionOk = await testSupabaseConnection();
    const tablesOk = await testSupabaseTables();
    setLocalFeedback(`🧪 Test Supabase: ${connectionOk ? '✅' : '❌'} Connexion, ${tablesOk ? '✅' : '❌'} Tables`);
  }, []);

  // Fonction de diagnostic Supabase
  const diagnoseSupabase = useCallback(async () => {
    try {
      console.log('🔍 Diagnostic Supabase...');
      const { diagnoseSupabase: diagnoseFn } = await import('@/utils/remoteStore');
      const result = await diagnoseFn();
      if (result) {
        setLocalFeedback(`🔍 Diagnostic: ${result.length} entrées trouvées dans Supabase`);
      } else {
        setLocalFeedback('❌ Erreur diagnostic Supabase');
      }
    } catch (error) {
      console.error('❌ Erreur diagnostic:', error);
      setLocalFeedback('❌ Erreur diagnostic Supabase');
    }
  }, []);



  // Fonction pour diagnostiquer et nettoyer les verrous
  const diagnoseAndCleanLocks = useCallback(async () => {
    try {
      console.log('🔍 Diagnostic et nettoyage des verrous...');
      const { diagnoseAllLocks, forceUnlockSpecificUser, clearAllLocks } = await import('@/utils/debugLocks');
      
      // Diagnostiquer tous les verrous
      await diagnoseAllLocks();
      
      // Demander à l'utilisateur quelle action effectuer
      const action = window.prompt(
        '🔍 Diagnostic des verrous terminé.\n\n' +
        'Choisissez une action:\n' +
        '1. Forcer la libération de user_1p4ddz9\n' +
        '2. Nettoyer tous les verrous (utilisateur unique)\n' +
        '3. Annuler\n\n' +
        'Entrez 1, 2 ou 3:'
      );
      
      if (action === '1') {
        await forceUnlockSpecificUser('user_1p4ddz9');
        setLocalFeedback('🔓 Verrous de user_1p4ddz9 supprimés');
        // Recharger la page pour appliquer les changements
        setTimeout(() => window.location.reload(), 1000);
      } else if (action === '2') {
        if (window.confirm('⚠️ ATTENTION : Nettoyer TOUS les verrous ?\n\nCette action va supprimer tous les verrous actifs.\n\nÊtes-vous sûr de vouloir continuer ?')) {
          await clearAllLocks();
          setLocalFeedback('🧹 Tous les verrous supprimés');
          // Recharger la page pour appliquer les changements
          setTimeout(() => window.location.reload(), 1000);
        }
      } else {
        setLocalFeedback('❌ Action annulée');
      }
    } catch (error) {
      console.error('❌ Erreur diagnostic verrous:', error);
      setLocalFeedback('❌ Erreur diagnostic verrous');
    }
  }, []);

  // Fonction pour nettoyer Supabase
  const cleanSupabaseData = useCallback(async () => {
    if (window.confirm('⚠️ ATTENTION : Nettoyer Supabase\n\nCette action va supprimer toutes les données dans Supabase.\n\nÊtes-vous sûr de vouloir continuer ?')) {
      try {
        console.log('🧹 Nettoyage Supabase...');
        const result = await cleanAndResaveData();
        if (result) {
          setLocalFeedback('✅ Supabase nettoyé avec succès');
        } else {
          setLocalFeedback('❌ Erreur lors du nettoyage Supabase');
        }
      } catch (error) {
        console.error('❌ Erreur nettoyage Supabase:', error);
        setLocalFeedback('❌ Erreur lors du nettoyage Supabase');
      }
    }
  }, []);

  const handleJsonRestoreFile = useCallback(async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!onImport) {
      alert('❌ Restauration JSON indisponible.');
      setLocalFeedback('❌ Restauration JSON indisponible.');
      return;
    }
    try {
      await onImport(file, { restoreInPlace: true });
    } catch (error) {
      console.error('Erreur restauration JSON:', error);
      setLocalFeedback(`❌ ${error?.message || 'Erreur restauration JSON'}`);
    }
  }, [onImport]);

  const restoreFromBackup = useCallback(() => {
    const localJsonKeys = Object.keys(localStorage).filter((key) =>
      key.startsWith('json_manualbackup_') ||
      key.startsWith('json_autobackup_') ||
      key.startsWith('planning_auto_backup_') ||
      key.startsWith('planning_manual_backup_')
    );

    if (localJsonKeys.length > 0) {
      const useLocal = window.confirm(
        `Restaurer un fichier JSON depuis votre ordinateur ?\n\n` +
          `OK = choisir un fichier .json\n` +
          `Annuler = utiliser la dernière sauvegarde JSON locale (${localJsonKeys.length} trouvée(s) dans le navigateur)`
      );
      if (!useLocal) {
        const latestKey = localJsonKeys.sort().pop();
        try {
          const raw = localStorage.getItem(latestKey);
          const parsed = JSON.parse(raw || '{}');
          if (!parsed?.shops?.length) {
            throw new Error('Sauvegarde locale vide ou invalide');
          }
          if (!window.confirm(`Restaurer la sauvegarde locale « ${latestKey} » ?\n\n${parsed.shops.length} boutique(s)`)) {
            return;
          }
          setPlanningData(parsed);
          localStorage.setItem('planningData', JSON.stringify(parsed));
          setForceRefresh((prev) => prev + 1);
          setLocalFeedback(`✅ JSON local restauré (${latestKey})`);
          alert(`✅ Planning restauré depuis la sauvegarde locale.\n\n${parsed.shops.length} boutique(s).`);
          return;
        } catch (error) {
          alert(`❌ Sauvegarde locale invalide : ${error.message}`);
        }
      }
    }

    if (jsonRestoreInputRef.current) {
      jsonRestoreInputRef.current.click();
    } else {
      alert('❌ Sélecteur de fichier indisponible. Utilisez 📥 Importer les données.');
    }
  }, [setPlanningData]);

  // Fonction de sauvegarde automatique JSON
  const createAutoBackupJSON = useCallback((type = 'auto') => {
    if (readOnly) {
      return;
    }
    if (planningData && Object.keys(planningData.shops || {}).length > 0) {
      try {
        const exportData = {
          ...planningData,
          exportDate: new Date().toISOString(),
          autoBackup: type !== 'manual',
          backupType: type === 'manual' ? 'manual' : 'periodic',
          selectedShop: selectedShop,
          selectedWeek: validWeek,
          currentPlanning: planning
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
          type: 'application/json'
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `planning_${type === 'manual' ? 'manual' : 'auto'}_backup_${format(new Date(), 'yyyy-MM-dd_HHmmss')}.json`;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
        try {
          const prefix = type === 'manual' ? 'json_manualbackup_' : 'json_autobackup_';
          const key = `${prefix}${Date.now()}`;
          localStorage.setItem(key, JSON.stringify(exportData));
          const keys = Object.keys(localStorage).filter(k => k.startsWith(prefix)).sort();
          while (keys.length > 2) {
            const oldest = keys.shift();
            if (oldest) localStorage.removeItem(oldest);
          }
        } catch (_) {}

        const msg = type === 'manual' ? '📦 Sauvegarde JSON manuelle créée' : '💾 Sauvegarde JSON automatique créée';
        console.log(msg);
        setLocalFeedback(msg);
      } catch (error) {
        console.error('Erreur lors de la sauvegarde JSON:', error);
        setLocalFeedback('❌ Erreur lors de la sauvegarde JSON');
      }
    }
  }, [planningData, selectedShop, validWeek, planning, readOnly]);

  // État pour la prochaine sauvegarde automatique
  const [nextAutoBackup, setNextAutoBackup] = useState(null);
  const [autoBackupNowMs, setAutoBackupNowMs] = useState(Date.now());

  // Sauvegarde automatique JSON toutes les 5 minutes
  useEffect(() => {
    if (!readOnly && planningData && Object.keys(planningData.shops || {}).length > 0) {
      // Calculer la prochaine sauvegarde
      const now = new Date();
      const nextBackup = new Date(now.getTime() + 5 * 60 * 1000); // +5 minutes
      setNextAutoBackup(nextBackup);
      
      const autoBackupInterval = setInterval(() => {
        createAutoBackupJSON();
        // Mettre à jour la prochaine sauvegarde
        const newNextBackup = new Date(new Date().getTime() + 5 * 60 * 1000);
        setNextAutoBackup(newNextBackup);
      }, 5 * 60 * 1000); // 5 minutes

      return () => clearInterval(autoBackupInterval);
    }
  }, [planningData, createAutoBackupJSON, readOnly]);

  useEffect(() => {
    const countdownId = setInterval(() => {
      setAutoBackupNowMs(Date.now());
    }, 1000);
    return () => clearInterval(countdownId);
  }, []);

  const changeWeek = (direction) => {
    // Sauvegarder les modifications actuelles avant de changer de semaine
    if (!readOnly && !isWeekFullyLocked && selectedShop && validWeek && planning && Object.keys(planning).length > 0) {
      try {
        // ⚡ STEP 1: RELOAD planningData from localStorage to get the LATEST version
        const latestPlanningData = JSON.parse(localStorage.getItem('planningData') || '{}');
        
        let updatedPlanningData = latestPlanningData.shops ? latestPlanningData : planningData;
        
        // ⚡ STEP 2: SAVE for all employees (including multi-shop employees)
        localSelectedEmployees.forEach(employeeId => {
          updatedPlanningData = saveWeekPlanningForEmployee(
            updatedPlanningData,
            employeeId,
            validWeek,
            planning,
            localSelectedEmployees,
            selectedShop
          );
        });
        
        // ⚡ STEP 3: UPDATE both memory AND localStorage
        setPlanningData(updatedPlanningData);
        localStorage.setItem('planningData', JSON.stringify(updatedPlanningData));
        console.log('💾 Sauvegarde complète automatique avant changement de semaine (avec rechargement depuis localStorage)');
      } catch (error) {
        console.error('Erreur lors de la sauvegarde avant changement de semaine:', error);
      }
    }
    
    const currentDate = parseISO(validWeek);
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7));
    const newWeek = format(newDate, 'yyyy-MM-dd');
    setSelectedWeek(newWeek);
    
    // Réinitialiser le jour modifié
    setLastModifiedDay(null);
  };

  const changeMonth = (monthKey) => {
    // monthKey est au format 'yyyy-MM'
    const [year, month] = monthKey.split('-');
    // Aller au premier lundi du mois sélectionné
    const firstDayOfMonth = new Date(parseInt(year), parseInt(month) - 1, 1);
    const dayOfWeek = firstDayOfMonth.getDay();
    const daysToAdd = dayOfWeek === 0 ? 1 : (dayOfWeek === 1 ? 0 : 8 - dayOfWeek);
    const firstMondayOfMonth = new Date(firstDayOfMonth);
    firstMondayOfMonth.setDate(firstDayOfMonth.getDate() + daysToAdd);
    
    const newWeek = format(firstMondayOfMonth, 'yyyy-MM-dd');
    setSelectedWeek(newWeek);
  };

  const changeToSpecificWeek = (weekDate) => {
    // Sauvegarder les modifications actuelles avant de changer de semaine
    if (!readOnly && !isWeekFullyLocked && selectedShop && validWeek && planning && Object.keys(planning).length > 0) {
      try {
        setPlanningData((prev) =>
          saveWeekPlanning(prev, selectedShop, validWeek, planning, localSelectedEmployees)
        );
        console.log('💾 Sauvegarde automatique avant changement vers semaine spécifique');
      } catch (error) {
        console.error('Erreur lors de la sauvegarde avant changement vers semaine spécifique:', error);
      }
    }
    
    setSelectedWeek(weekDate);
    
    // Réinitialiser le jour modifié
    setLastModifiedDay(null);
  };

  const changeShop = (newShop) => {
    try {
      if (currentUser?.code && !canUserAccessShop(currentUser.code, newShop, shops)) {
        alert('Vous n\'avez pas accès à cette boutique.');
        return;
      }
      // Sauvegarder le planning actuel avant de changer de boutique
      if (!isWeekFullyLocked && selectedShop && validWeek && Object.keys(planning).length > 0) {
        console.log('Sauvegarde avant changement de boutique:', { selectedShop, selectedWeek: validWeek, planning, localSelectedEmployees });
        
        // ⚡ STEP 1: RELOAD planningData from localStorage to get the LATEST version
        const latestPlanningData = JSON.parse(localStorage.getItem('planningData') || '{}');
        
        let updatedPlanningData = latestPlanningData.shops ? latestPlanningData : planningData;
        
        // ⚡ STEP 2: SAVE for all employees (including multi-shop employees)
        localSelectedEmployees.forEach(employeeId => {
          updatedPlanningData = saveWeekPlanningForEmployee(
            updatedPlanningData,
            employeeId,
            validWeek,
            planning,
            localSelectedEmployees,
            selectedShop // on sauvegarde dans la boutique qu'on quitte
          );
        });
        
        // ⚡ STEP 3: UPDATE both memory AND localStorage
        setPlanningData(updatedPlanningData);
        localStorage.setItem('planningData', JSON.stringify(updatedPlanningData));
        console.log('💾 Sauvegarde complète automatique avant changement de boutique (avec rechargement depuis localStorage)');
      }
    } catch (e) {
      console.error("Erreur lors de la sauvegarde du planning avant changement de boutique :", e);
    }
    setSelectedShop(newShop);

    setShowMonthlyRecapModal(false);
    setShowEmployeeMonthlyRecap(false);
    setShowEmployeeWeeklyRecap(false);
    setShowEmployeeMonthlyWeeklyModal(false);
    setShowMonthlyDetailModal(false);
    setShowEmployeeMonthlyDetail(false);
    setShowRecapModal(null);
    setShowResetModal(false);
    setSelectedEmployeeForMonthlyRecap('');
    setSelectedEmployeeForWeeklyRecap('');
    setSelectedEmployeeForMonthlyDetail('');
    // Réinitialiser le feedback
    setLocalFeedback('');
    
    // Réinitialiser le jour modifié
    setLastModifiedDay(null);
  };

  const handleEmployeeToggle = (employee) => {
    if (isWeekFullyLocked) {
      setLocalFeedback('🔒 Semaine entièrement antérieure verrouillée. Code superviseur requis pour modifier les employés.');
      return;
    }
    setLocalSelectedEmployees(prev => {
      const isSelected = prev.includes(employee);
      if (isSelected) {
        return prev.filter(emp => emp !== employee);
      } else {
        return [...prev, employee];
      }
    });
  };

  const handleReset = (resetType, employeeName = null) => {
    if (isWeekEditingLocked) {
      setFeedback('🔒 Des dates antérieures sont verrouillées. Code superviseur requis pour réinitialiser cette semaine.');
      return;
    }
    try {
    if (resetType === 'all') {
        // Effacer tous les clics de la semaine
        const emptyPlanning = {};
        const updatedPlanningData = saveWeekPlanning(
          planningData,
          selectedShop,
          validWeek,
          emptyPlanning,
          []
        );
        setPlanningData(updatedPlanningData);
        setPlanning(emptyPlanning);
        setLocalSelectedEmployees([]);
        setFeedback('✅ Tous les clics de la semaine ont été effacés');
    } else if (resetType === 'employee' && employeeName) {
      // Effacer les clics d'un employé spécifique
        const currentWeekData = getWeekPlanning(planningData, selectedShop, validWeek);
        const newPlanning = { ...currentWeekData.planning };
        
      // Supprimer toutes les entrées pour cet employé
        if (newPlanning[employeeName]) {
          delete newPlanning[employeeName];
        }
        
        const updatedPlanningData = saveWeekPlanning(
          planningData,
          selectedShop,
          validWeek,
          newPlanning,
          currentWeekData.selectedEmployees || []
        );
        setPlanningData(updatedPlanningData);
      setPlanning(newPlanning);
        setFeedback(`✅ Clics de ${employeeName} ont été effacés`);
    } else if (resetType === 'week') {
        const emptyPlanning = {};
        const updatedPlanningData = saveWeekPlanning(
          planningData,
          selectedShop,
          validWeek,
          emptyPlanning,
          []
        );
        setPlanningData(updatedPlanningData);
        setPlanning(emptyPlanning);
      setLocalSelectedEmployees([]);
        setFeedback('✅ Semaine réinitialisée');
    } else if (resetType === 'clicks') {
        const emptyPlanning = {};
        const updatedPlanningData = saveWeekPlanning(
          planningData,
          selectedShop,
          validWeek,
          emptyPlanning,
          localSelectedEmployees
        );
        setPlanningData(updatedPlanningData);
        setPlanning(emptyPlanning);
        setFeedback('✅ Clics réinitialisés');
      }
    } catch (error) {
      console.error('Erreur lors de la réinitialisation:', error);
      setFeedback('❌ Erreur lors de la réinitialisation');
    }
  };

  // Fonction pour copier les données d'une semaine vers une autre semaine
  const copyWeekToWeek = useCallback((sourceWeek, destinationWeek) => {
    try {
      console.log(`🔄 Début de la copie de semaine ${sourceWeek} vers ${destinationWeek}`);
      
      // Vérifier que les semaines sont valides
      if (!sourceWeek || !destinationWeek) {
        setLocalFeedback('❌ Veuillez spécifier les semaines source et destination');
        return;
      }
      
      // VÉRIFIER SI LA SEMAINE DESTINATION CONTIENT DÉJÀ DES DONNÉES
      const destinationWeekData = planningData?.shops?.find(shop => shop.id === selectedShop)?.weeks?.[destinationWeek];
      const existingDestinationPlanning = destinationWeekData?.planning || {};
      
      // Compter les jours-employés déjà planifiés (créneaux, congé, maladie, etc.)
      let existingCellsCount = 0;
      Object.keys(existingDestinationPlanning).forEach(empId => {
        Object.keys(existingDestinationPlanning[empId] || {}).forEach(dayKey => {
          if (dayCellHasPlanningContent(existingDestinationPlanning[empId][dayKey])) {
            existingCellsCount += 1;
          }
        });
      });
      
      console.log(`🔍 Semaine destination (${destinationWeek}) contient ${existingCellsCount} cellule(s) déjà remplies`);
      
      // Si la semaine destination contient des données, demander confirmation
      if (existingCellsCount > 0) {
        const destinationWeekStart = format(new Date(destinationWeek), 'dd/MM');
        const destinationWeekEnd = format(new Date(new Date(destinationWeek).getTime() + 6 * 24 * 60 * 60 * 1000), 'dd/MM');
        const confirmMessage = `⚠️ La semaine du ${destinationWeekStart} au ${destinationWeekEnd} contient déjà ${existingCellsCount} jour(s)-employé planifié(s) (créneaux ou statuts).\n\nVoulez-vous vraiment écraser ces données ?\n\nCette action ne peut pas être annulée.`;
        
        if (!window.confirm(confirmMessage)) {
          console.log('❌ Copie annulée par l\'utilisateur');
          setLocalFeedback('❌ Copie annulée. Les données existantes sont préservées.');
        return;
      }
      
        console.log('✅ Utilisateur a confirmé l\'écrasement des données existantes');
      }
      
      // Récupérer les données de la semaine source depuis planningData.
      // Si la semaine source est la semaine actuellement affichée, utiliser
      // l'état local en mémoire pour inclure les modifications non encore sauvegardées
      // (notamment statuts Congé/Maladie).
      const sourceWeekData = planningData?.shops?.find(shop => shop.id === selectedShop)?.weeks?.[sourceWeek];
      const isSourceCurrentWeek = sourceWeek === validWeek;
      const sourcePlanning = isSourceCurrentWeek ? (planning || {}) : (sourceWeekData?.planning || {});
      const sourceSelectedEmployees = isSourceCurrentWeek
        ? (localSelectedEmployees || [])
        : (sourceWeekData?.selectedEmployees || []);
      
      console.log('📊 Planning source à copier (semaine 28/07):', sourcePlanning);
      console.log('📊 Structure détaillée du planning source:', JSON.stringify(sourcePlanning, null, 2));
      
      // Afficher les clés des employés et des jours
      if (sourcePlanning) {
        Object.keys(sourcePlanning).forEach(empId => {
          console.log(`👤 Employé ${empId}:`, Object.keys(sourcePlanning[empId]));
          Object.keys(sourcePlanning[empId]).forEach(dayKey => {
            console.log(`  📅 Jour ${dayKey}:`, sourcePlanning[empId][dayKey]);
          });
        });
      }
      
      if (!sourcePlanning || Object.keys(sourcePlanning).length === 0) {
        console.log('⚠️ Aucun planning source à copier');
        const sourceWeekStart = format(new Date(sourceWeek), 'dd/MM');
        const sourceWeekEnd = format(new Date(new Date(sourceWeek).getTime() + 6 * 24 * 60 * 60 * 1000), 'dd/MM');
        setLocalFeedback(`⚠️ Aucun planning à copier. Assurez-vous d'avoir des cliques sur la semaine du ${sourceWeekStart} au ${sourceWeekEnd}.`);
        return;
      }
      
      // TRANSFORMATION DES CLÉS DE DATES : Créer un nouveau planning avec les clés de la semaine destination
      const transformedPlanning = {};
      
      const buildWeekDates = (weekStartKey) => {
        const baseDate = parseISO(weekStartKey);
        return Array.from({ length: 7 }, (_, index) =>
          format(addDays(baseDate, index), 'yyyy-MM-dd')
        );
      };

      // IMPORTANT: utiliser format() (timezone locale) et pas toISOString() pour eviter
      // les decalages de jour qui cassent la copie semaine -> semaine+1.
      const destinationDates = buildWeekDates(destinationWeek);
      const sourceDates = buildWeekDates(sourceWeek);
      
      console.log('📅 Dates source:', sourceDates);
      console.log('📅 Dates destination:', destinationDates);
      
      // Transformer le planning en remplaçant les clés de dates
      Object.keys(sourcePlanning).forEach(empId => {
        transformedPlanning[empId] = {};
        
        // Copier les données de chaque jour en transformant les clés
        sourceDates.forEach((sourceDate, index) => {
          const destinationDate = destinationDates[index];
          if (Object.prototype.hasOwnProperty.call(sourcePlanning[empId], sourceDate)) {
            const sourceDayValue = sourcePlanning[empId][sourceDate];
            transformedPlanning[empId][destinationDate] = Array.isArray(sourceDayValue)
              ? [...sourceDayValue]
              : sourceDayValue;
            console.log(`🔄 Copie ${sourceDate} → ${destinationDate} pour ${empId}`);
          }
        });
      });
      
      console.log('🔄 Planning transformé:', transformedPlanning);
      
      // 1. Copier le planning transformé vers localStorage
      localStorage.setItem(`planning_${selectedShop}_${destinationWeek}`, JSON.stringify(transformedPlanning));
      
      // 2. Copier aussi les employés sélectionnés de la semaine source
      if (sourceSelectedEmployees && sourceSelectedEmployees.length > 0) {
        localStorage.setItem(`selected_employees_${selectedShop}_${destinationWeek}`, JSON.stringify(sourceSelectedEmployees));
        console.log('👥 Employés sélectionnés copiés:', sourceSelectedEmployees);
      }
      
      // 3. IMPORTANT : Mettre à jour la structure planningData pour que getWeekPlanning puisse la lire
      console.log('🔧 Avant saveWeekPlanning - planningData:', planningData);
      console.log('🔧 Paramètres saveWeekPlanning:', {
        selectedShop,
        destinationWeek,
        transformedPlanning,
        sourceSelectedEmployees
      });
      
      const updatedPlanningData = saveWeekPlanning(planningData, selectedShop, destinationWeek, transformedPlanning, sourceSelectedEmployees);
      console.log('🔧 Après saveWeekPlanning - updatedPlanningData:', updatedPlanningData);
      
      setPlanningData(updatedPlanningData);
      
      console.log('✅ Planning transformé copié vers localStorage ET planningData');
      
      // Vérifier que la copie a bien fonctionné
      const verifyCopy = localStorage.getItem(`planning_${selectedShop}_${destinationWeek}`);
      if (verifyCopy) {
        const copiedData = JSON.parse(verifyCopy);
        console.log('🔍 Vérification de la copie - données copiées:', copiedData);
        
        // Naviguer vers la semaine de destination
        console.log('🔄 Navigation vers la semaine:', destinationWeek);
        setSelectedWeek(destinationWeek);
        
        // Forcer le rafraîchissement pour déclencher le useEffect qui charge le planning
        setForceRefresh(prev => prev + 1);
        
        setLocalFeedback(`✅ Planning copié vers la semaine du ${format(new Date(destinationWeek), 'dd/MM')} au ${format(new Date(new Date(destinationWeek).getTime() + 6 * 24 * 60 * 60 * 1000), 'dd/MM')}. Navigation automatique en cours...`);
      } else {
        console.log('❌ Échec de la copie - données non trouvées dans localStorage');
        setLocalFeedback('❌ Échec de la copie. Veuillez réessayer.');
      }
      
    } catch (error) {
      console.error('❌ Erreur lors de la copie:', error);
      setLocalFeedback('❌ Erreur lors de la copie des données');
    }
  }, [selectedShop, setSelectedWeek, planningData, setPlanningData, planning, localSelectedEmployees, validWeek]);



  // Fonction pour copier vers la semaine suivante (compatibilité)
  const copyWeekToNextWeek = useCallback(() => {
    const sourceWeek = validWeek;
    const destinationWeek = format(addDays(parseISO(validWeek), 7), 'yyyy-MM-dd');
    copyWeekToWeek(sourceWeek, destinationWeek);
  }, [validWeek, copyWeekToWeek]);

  const exportReadableSchedules = useCallback((forcedExportMode = null) => {
    const planningData = userScopedPlanningData;
    try {
      if (!validWeek || !planningData?.shops?.length) {
        setLocalFeedback('❌ Export impossible: semaine ou donnees indisponibles.');
        return;
      }

      const scopeRaw = window.prompt(
        "Perimetre:\n1 = Semaine affichee\n2 = Mois calendaire (mois de la semaine selectionnee)\n\nEntrez 1 ou 2:"
      );
      if (!scopeRaw) return;
      const scopeTrim = scopeRaw.trim();
      if (scopeTrim !== '1' && scopeTrim !== '2') {
        setLocalFeedback('❌ Perimetre invalide. Utilisez 1 ou 2.');
        return;
      }
      const exportScopeMonth = scopeTrim === '2';

      let normalizedExportMode =
        forcedExportMode != null ? String(forcedExportMode).trim() : null;
      if (!normalizedExportMode) {
        const exportMode = window.prompt(
          'Format export:\n1 = TXT lisible\n2 = PDF presente\n3 = HTML (mobile paysage)\n\nEntrez 1, 2 ou 3:'
        );
        if (!exportMode) return;
        normalizedExportMode = exportMode.trim();
      }
      if (normalizedExportMode !== '1' && normalizedExportMode !== '2' && normalizedExportMode !== '3') {
        setLocalFeedback('❌ Format invalide. Utilisez 1, 2 ou 3.');
        return;
      }

      const audienceMode = window.prompt(
        "Cible de l'export:\n" +
          '1 = Collectif (tous les employes) — un seul fichier\n' +
          '2 = Un seul employe (choisir le numero) — un fichier\n' +
          "3 = Tous : un fichier par employe (telechargements a la chaine, envoi mail)\n\n" +
          'Entrez 1, 2 ou 3:'
      );
      if (!audienceMode) return;
      const audienceTrim = audienceMode.trim();
      if (audienceTrim !== '1' && audienceTrim !== '2' && audienceTrim !== '3') {
        setLocalFeedback('❌ Choix invalide. Utilisez 1, 2 ou 3.');
        return;
      }

      const weekStart = parseISO(validWeek);
      const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
      const weekLabel = `${format(weekStart, 'dd/MM/yyyy')} - ${format(addDays(weekStart, 6), 'dd/MM/yyyy')}`;

      const monthAnchor = parseISO(validWeek);
      const monthLabel = format(monthAnchor, 'MMMM yyyy', { locale: fr });
      const monthTagFile = format(monthAnchor, 'yyyy-MM');
      const monthDaysFlat = eachDayOfInterval({
        start: startOfMonth(monthAnchor),
        end: endOfMonth(monthAnchor),
      });

      const normalizeSlot = (value) => value === true || value === 1 || value === '1' || value === 'true';

      const employeeMap = new Map();
      (planningData.shops || []).forEach((shop) => {
        (shop.employees || []).forEach((emp) => {
          if (emp?.id && !employeeMap.has(emp.id)) employeeMap.set(emp.id, emp.name || emp.id);
        });
      });

      /**
       * Même logique que le récap semaine (WeeklyWorkMatrix) : priorité planning en mémoire
       * pour la boutique + semaine affichée, sinon planningData, sinon localStorage.
       */
      const resolveExportWeekPlanning = (shop) => {
        if (
          selectedShop != null &&
          String(shop.id) === String(selectedShop) &&
          planning &&
          typeof planning === 'object' &&
          Object.keys(planning).length > 0
        ) {
          return planning;
        }
        const w = shop.weeks?.[validWeek];
        const inline = w?.planning;
        if (inline && typeof inline === 'object' && Object.keys(inline).length > 0) {
          return inline;
        }
        return loadFromLocalStorage(`planning_${shop.id}_${validWeek}`, {});
      };

      const getMonthWeeksForSelectedMonth = () => {
        const start = startOfMonth(parseISO(validWeek));
        const end = endOfMonth(parseISO(validWeek));
        const weeks = [];
        let current = startOfWeek(start, { weekStartsOn: 1 });
        while (current <= end) {
          weeks.push(current);
          current = addDays(current, 7);
        }
        return weeks;
      };

      const resolveWeekPlanningForShop = (shop, weekKey) => {
        if (
          selectedShop != null &&
          String(shop.id) === String(selectedShop) &&
          weekKey === validWeek &&
          planning &&
          typeof planning === 'object' &&
          Object.keys(planning).length > 0
        ) {
          return planning;
        }
        const w = shop.weeks?.[weekKey];
        const inline = w?.planning;
        if (inline && typeof inline === 'object' && Object.keys(inline).length > 0) {
          return inline;
        }
        return loadFromLocalStorage(`planning_${shop.id}_${weekKey}`, {});
      };

      const discoverEmployeesFromWeek = () => {
        const ids = new Set();
        (planningData.shops || []).forEach((shop) => {
          const weekPlan = resolveExportWeekPlanning(shop);
          Object.keys(weekPlan).forEach((employeeId) => {
            if (!isEmployeeVisibleForRecap(planningData, employeeId, shop.id)) return;
            ids.add(employeeId);
          });
        });
        return Array.from(ids);
      };

      const discoverEmployeesFromMonth = () => {
        const ids = new Set();
        const monthWeeksList = getMonthWeeksForSelectedMonth();
        (planningData.shops || []).forEach((shop) => {
          monthWeeksList.forEach((weekMonday) => {
            const weekKey = format(weekMonday, 'yyyy-MM-dd');
            const wp = resolveWeekPlanningForShop(shop, weekKey);
            Object.keys(wp || {}).forEach((employeeId) => {
              if (!isEmployeeVisibleForRecap(planningData, employeeId, shop.id)) return;
              ids.add(employeeId);
            });
          });
        });
        return Array.from(ids);
      };

      const allEmployeeIds = exportScopeMonth ? discoverEmployeesFromMonth() : discoverEmployeesFromWeek();
      if (!allEmployeeIds.length) {
        setLocalFeedback(
          exportScopeMonth
            ? '⚠️ Aucun horaire trouve pour le mois selectionne.'
            : '⚠️ Aucun horaire trouve pour la semaine selectionnee.'
        );
        return;
      }

      let targetEmployeeIds = allEmployeeIds;
      if (audienceTrim === '2') {
        const list = allEmployeeIds
          .map((id, idx) => `${idx + 1}. ${employeeMap.get(id) || id}`)
          .join('\n');
        const pick = window.prompt(`Choisissez un employe:\n${list}\n\nEntrez le numero:`);
        if (!pick) return;
        const index = Number.parseInt(pick, 10) - 1;
        if (Number.isNaN(index) || index < 0 || index >= allEmployeeIds.length) {
          setLocalFeedback('❌ Numero employe invalide.');
          return;
        }
        targetEmployeeIds = [allEmployeeIds[index]];
      }

      const sumEmployeeHoursForCalendarDay = (employeeId, dayDate) => {
        const dayKey = format(dayDate, 'yyyy-MM-dd');
        let total = 0;
        (planningData.shops || []).forEach((shop) => {
          if (!isEmployeeVisibleForRecap(planningData, employeeId, shop.id)) return;
          const monday = startOfWeek(dayDate, { weekStartsOn: 1 });
          const weekKey = format(monday, 'yyyy-MM-dd');
          const weekPlanning = resolveWeekPlanningForShop(shop, weekKey);
          const slicePlanning = { [employeeId]: weekPlanning[employeeId] || {} };
          total += calculateEmployeeDailyHours(employeeId, dayKey, slicePlanning, shop.config || config);
        });
        return total;
      };

      const sumEmployeeHoursForExportedWeek = (employeeId) =>
        weekDays.reduce((acc, dayDate) => acc + sumEmployeeHoursForCalendarDay(employeeId, dayDate), 0);

      const sumEmployeeHoursForShopWeek = (employeeId, shopId) => {
        if (shopId == null) return 0;
        const shop = (planningData.shops || []).find((s) => String(s.id) === String(shopId));
        if (!shop || !isEmployeeVisibleForRecap(planningData, employeeId, shop.id)) return 0;
        let total = 0;
        weekDays.forEach((dayDate) => {
          const dayKey = format(dayDate, 'yyyy-MM-dd');
          const monday = startOfWeek(dayDate, { weekStartsOn: 1 });
          const weekKey = format(monday, 'yyyy-MM-dd');
          const weekPlanning = resolveWeekPlanningForShop(shop, weekKey);
          const slicePlanning = { [employeeId]: weekPlanning[employeeId] || {} };
          total += calculateEmployeeDailyHours(employeeId, dayKey, slicePlanning, shop.config || config);
        });
        return total;
      };

      const sumEmployeeHoursForExportedMonth = (employeeId) =>
        monthDaysFlat.reduce((acc, dayDate) => acc + sumEmployeeHoursForCalendarDay(employeeId, dayDate), 0);

      const sumEmployeeHoursForShopMonth = (employeeId, shopId) => {
        if (shopId == null) return 0;
        const shop = (planningData.shops || []).find((s) => String(s.id) === String(shopId));
        if (!shop || !isEmployeeVisibleForRecap(planningData, employeeId, shop.id)) return 0;
        let total = 0;
        monthDaysFlat.forEach((dayDate) => {
          const dayKey = format(dayDate, 'yyyy-MM-dd');
          const monday = startOfWeek(dayDate, { weekStartsOn: 1 });
          const weekKey = format(monday, 'yyyy-MM-dd');
          const weekPlanning = resolveWeekPlanningForShop(shop, weekKey);
          const slicePlanning = { [employeeId]: weekPlanning[employeeId] || {} };
          total += calculateEmployeeDailyHours(employeeId, dayKey, slicePlanning, shop.config || config);
        });
        return total;
      };

      const sumEmployeeHoursForDay = (employeeId, dayDate) =>
        sumEmployeeHoursForCalendarDay(employeeId, dayDate);

      const getEmployeeMonthlyHoursByShop = (employeeId) => {
        const mAnchor = parseISO(validWeek);
        const monthStartStr = format(startOfMonth(mAnchor), 'yyyy-MM-dd');
        const monthEndStr = format(endOfMonth(mAnchor), 'yyyy-MM-dd');
        const monthWeeks = getMonthWeeksForSelectedMonth();
        const rows = [];
        let monthGrand = 0;
        (planningData.shops || []).forEach((shop) => {
          if (!isEmployeeVisibleForRecap(planningData, employeeId, shop.id)) return;
          const cfg = shop.config || config;
          let shopMonth = 0;
          monthWeeks.forEach((wStart) => {
            const weekKey = format(wStart, 'yyyy-MM-dd');
            const weekPlanning = resolveWeekPlanningForShop(shop, weekKey);
            for (let i = 0; i < 7; i += 1) {
              const dayKey = format(addDays(wStart, i), 'yyyy-MM-dd');
              if (dayKey < monthStartStr || dayKey > monthEndStr) continue;
              shopMonth += calculateEmployeeDailyHours(employeeId, dayKey, weekPlanning, cfg);
            }
          });
          if (shopMonth > 0) {
            monthGrand += shopMonth;
            rows.push({ shopName: shop.name || shop.id, hours: shopMonth });
          }
        });
        return { rows, monthGrand };
      };

      const selectedShopLabelName =
        (planningData.shops || []).find((s) => String(s.id) === String(selectedShop))?.name || selectedShop;

      const collectDayEntriesForEmployee = (employeeId, dayDate) => {
        const dayKey = format(dayDate, 'yyyy-MM-dd');
        const dayLabel = `${format(dayDate, 'EEEE', { locale: fr })} ${format(dayDate, 'dd/MM')}`;
        const entries = [];
        const mainShopId = getEmployeeMainShopId(planningData, employeeId);
        const shopRows = [];

        (planningData.shops || []).forEach((shop) => {
          if (!isEmployeeVisibleForRecap(planningData, employeeId, shop.id)) return;
          const monday = startOfWeek(dayDate, { weekStartsOn: 1 });
          const weekKey = format(monday, 'yyyy-MM-dd');
          const weekPlanning = resolveWeekPlanningForShop(shop, weekKey);
          const employeePlanning = weekPlanning[employeeId] || {};
          const dayValue = employeePlanning[dayKey];
          if (dayValue === undefined || dayValue === null) return;
          const cfg = shop.config || {};
          shopRows.push({ shop, dayValue, cfg });
        });

        const workedThisDay = shopRows.some(({ shop, dayValue, cfg }) => {
          if (typeof dayValue === 'string' && isAbsenceDayValue(dayValue)) return false;
          if (!Array.isArray(dayValue) || !dayValue.some(normalizeSlot)) return false;
          const ranges = buildSlotRangeLines(dayValue, cfg.timeSlots || config.timeSlots || [], {
            interval: cfg.interval || config.interval || 30,
            endTime: cfg.endTime ?? config.endTime,
          });
          return ranges.length > 0;
        });

        let absenceForMainShop = null;

        shopRows.forEach(({ shop, dayValue, cfg }) => {
          if (typeof dayValue === 'string') {
            if (isAbsenceDayValue(dayValue)) {
              if (workedThisDay) return;
              if (mainShopId && String(shop.id) === String(mainShopId)) {
                entries.push({ shopId: shop.id, shopName: shop.name || shop.id, value: dayValue });
              } else if (!mainShopId) {
                entries.push({ shopId: shop.id, shopName: shop.name || shop.id, value: dayValue });
              } else {
                absenceForMainShop = dayValue;
              }
              return;
            }
            entries.push({ shopId: shop.id, shopName: shop.name || shop.id, value: dayValue });
            return;
          }
          if (Array.isArray(dayValue) && dayValue.some(normalizeSlot)) {
            const ranges = buildSlotRangeLines(dayValue, cfg.timeSlots || config.timeSlots || [], {
              interval: cfg.interval || config.interval || 30,
              endTime: cfg.endTime ?? config.endTime,
            });
            if (ranges.length > 0) {
              entries.push({ shopId: shop.id, shopName: shop.name || shop.id, value: ranges.join(', ') });
            }
          }
        });

        if (!workedThisDay && entries.length === 0 && absenceForMainShop && mainShopId) {
          const mainShop = (planningData.shops || []).find((s) => String(s.id) === String(mainShopId));
          entries.push({
            shopId: mainShopId,
            shopName: mainShop?.name || mainShopId,
            value: absenceForMainShop,
          });
        }

        entries.sort((a, b) =>
          (a.shopName || '').localeCompare(b.shopName || '', 'fr', { sensitivity: 'base' })
        );
        return { dayLabel, entries };
      };

      const buildEmployeeDayRows = (employeeId) =>
        weekDays.map((dayDate) => collectDayEntriesForEmployee(employeeId, dayDate));

      const buildEmployeeMonthRows = (employeeId) =>
        monthDaysFlat.map((dayDate) => collectDayEntriesForEmployee(employeeId, dayDate));

      /**
       * Export mensuel lisible : toujours préfixer par le nom de boutique (employés multi-boutiques).
       * Le périmètre boutique ne doit pas figurer dans l’en-tête PDF/TXT — il est dans cette colonne.
       */
      const formatMonthReadableDayDetail = (entries) => {
        if (!entries?.length) return 'Repos';
        const byShopId = new Map();
        entries.forEach((e) => {
          const id = String(e.shopId ?? '');
          if (!byShopId.has(id)) {
            byShopId.set(id, { shopName: e.shopName || '-', vals: [] });
          }
          byShopId.get(id).vals.push(String(e.value ?? ''));
        });
        const groups = [...byShopId.values()];
        return groups.map((g) => `${g.shopName}: ${g.vals.join(', ')}`).join(' · ');
      };

      const toPdfSafeText = (value) =>
        String(value ?? '')
          .replace(/Cong[eé]\s*☀️?/gi, 'Conge')
          .replace(/Maladie\s*🤒?/gi, 'Maladie')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^\x20-\x7E]/g, '')
          .trim();

      const sanitizeFileName = (name) => {
        const s = String(name || 'employe')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-zA-Z0-9-_.]+/g, '_')
          .replace(/_+/g, '_')
          .replace(/^_|_$/g, '')
          .slice(0, 50);
        return s || 'employe';
      };

      const appendEmployeeReadableSchedulePdfMonth = (doc, employeeId) => {
        const pageWidth = doc.internal.pageSize.getWidth();
        const employeeName = employeeMap.get(employeeId) || employeeId;
        const marginX = 10;
        const colDay = 28;
        const colNb = 15;
        const colPlanning = 68;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text('Planning mensuel employe', pageWidth / 2, 10, { align: 'center' });
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        const monthHeaderParts = [
          `Employe: ${toPdfSafeText(employeeName)}`,
          `Mois: ${toPdfSafeText(monthLabel)}`,
        ];
        const monthHeaderWrapped = doc.splitTextToSize(monthHeaderParts.join(' | '), pageWidth - marginX * 2);
        doc.text(monthHeaderWrapped, pageWidth / 2, 15, { align: 'center' });
        let yAfterHeader = 15 + monthHeaderWrapped.length * 3.8;
        doc.text(`Genere le: ${new Date().toLocaleString('fr-FR')}`, pageWidth / 2, yAfterHeader, {
          align: 'center',
        });
        const tableStartY = yAfterHeader + 5;

        const monthRows = buildEmployeeMonthRows(employeeId);
        const body = [];
        let weekKeyCurrent = null;
        let weekRunDates = [];

        const pushWeekSubtotalRow = () => {
          if (!weekRunDates.length) return;
          const sum = weekRunDates.reduce(
            (acc, d) => acc + sumEmployeeHoursForCalendarDay(employeeId, d),
            0
          );
          const start = weekRunDates[0];
          const end = weekRunDates[weekRunDates.length - 1];
          const label = `Total sem. ${format(start, 'dd/MM')}–${format(end, 'dd/MM')}`;
          body.push([
            {
              content: label,
              colSpan: 2,
              styles: {
                fontStyle: 'bold',
                fillColor: [220, 245, 236],
                textColor: [15, 100, 80],
              },
            },
            formatWorkedHoursForDisplay(sum),
          ]);
        };

        monthDaysFlat.forEach((dayDate, dayIdx) => {
          const wk = format(startOfWeek(dayDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
          if (weekKeyCurrent !== null && wk !== weekKeyCurrent) {
            pushWeekSubtotalRow();
            weekRunDates = [];
          }
          weekKeyCurrent = wk;
          weekRunDates.push(dayDate);

          const { dayLabel, entries } = monthRows[dayIdx];
          const dayHoursTotal = sumEmployeeHoursForCalendarDay(employeeId, dayDate);
          let detail = formatMonthReadableDayDetail(entries);
          const MAX_DAY_DETAIL = 110;
          if (detail.length > MAX_DAY_DETAIL) {
            detail = `${detail.slice(0, MAX_DAY_DETAIL - 1)}…`;
          }
          body.push([
            toPdfSafeText(dayLabel),
            toPdfSafeText(detail),
            formatWorkedHoursNbNotation(dayHoursTotal),
          ]);
        });
        pushWeekSubtotalRow();

        doc.autoTable({
          startY: tableStartY,
          margin: { left: marginX, right: marginX, bottom: 38 },
          pageBreak: 'avoid',
          rowPageBreak: 'auto',
          head: [['Jour', 'Horaires', 'Nb (h)']],
          body,
          styles: {
            fontSize: 6.5,
            cellPadding: 0.9,
            lineColor: [220, 220, 220],
            lineWidth: 0.08,
            overflow: 'linebreak',
          },
          headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          columnStyles: {
            0: { cellWidth: colDay },
            1: { cellWidth: colPlanning },
            2: { cellWidth: colNb, halign: 'right' },
          },
          tableLineWidth: 0.05,
        });

        const monthTotalPdf = sumEmployeeHoursForExportedMonth(employeeId);
        const monthShopPdf =
          selectedShop != null ? sumEmployeeHoursForShopMonth(employeeId, selectedShop) : 0;
        const { rows: monthlyRowsPdf, monthGrand: monthGrandPdf } = getEmployeeMonthlyHoursByShop(employeeId);
        let yStart = (doc.lastAutoTable?.finalY ?? tableStartY) + 3;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.text(
          `Total toutes boutiques : ${formatWorkedHoursForDisplay(monthTotalPdf)}`,
          marginX,
          yStart
        );
        yStart += 3.8;
        if (selectedShop != null) {
          doc.text(
            `Total ${toPdfSafeText(selectedShopLabelName)} : ${formatWorkedHoursForDisplay(monthShopPdf)}`,
            marginX,
            yStart
          );
          yStart += 3.8;
        }
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        const note =
          'Heures sur jours du mois calendaire (semaines a cheval : partie hors mois exclue).';
        const splitNote = doc.splitTextToSize(note, pageWidth - marginX * 2);
        doc.text(splitNote, marginX, yStart);
        yStart += splitNote.length * 2.6;

        if (monthlyRowsPdf.length === 0) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6.5);
          doc.text('(aucune heure sur ce mois dans les plannings)', marginX, yStart + 1);
        } else {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(6.5);
          doc.text('Detail par boutique :', marginX, yStart + 1);
          yStart += 3.5;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6);
          const shopChunks = monthlyRowsPdf.map(
            ({ shopName, hours }) => `${shopName}: ${formatWorkedHoursForDisplay(hours)}`
          );
          shopChunks.push(`Total : ${formatWorkedHoursForDisplay(monthGrandPdf)}`);
          const shopBlock = toPdfSafeText(shopChunks.join(' · '));
          const shopWrapped = doc.splitTextToSize(shopBlock, pageWidth - marginX * 2);
          doc.text(shopWrapped, marginX, yStart + 1);
        }
      };

      const appendEmployeeReadableSchedulePdf = (doc, employeeId) => {
        if (exportScopeMonth) {
          appendEmployeeReadableSchedulePdfMonth(doc, employeeId);
          return;
        }
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        const employeeName = employeeMap.get(employeeId) || employeeId;
        const marginPdf = 14;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text('Planning hebdomadaire employe', pageWidth / 2, 12, { align: 'center' });
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Semaine: ${weekLabel}`, pageWidth / 2, 19, { align: 'center' });
        const weekHeaderParts = [
          `Employe: ${toPdfSafeText(employeeName)}`,
          `Mois: ${toPdfSafeText(monthLabel)}`,
        ];
        const weekHeaderWrapped = doc.splitTextToSize(weekHeaderParts.join(' | '), pageWidth - marginPdf * 2);
        doc.text(weekHeaderWrapped, pageWidth / 2, 25, { align: 'center' });
        const yGen = 25 + weekHeaderWrapped.length * 4;
        doc.text(`Genere le: ${new Date().toLocaleString('fr-FR')}`, pageWidth / 2, yGen, {
          align: 'center',
        });
        const tableStartWeekY = yGen + 6;

        const body = [];
        buildEmployeeDayRows(employeeId).forEach(({ dayLabel, entries }, dayIdx) => {
          const dayDate = weekDays[dayIdx];
          const dayHoursTotal = sumEmployeeHoursForDay(employeeId, dayDate);
          const nbCellForRow = (entryIdx) =>
            entryIdx === 0 ? formatWorkedHoursNbNotation(dayHoursTotal) : '';
          if (!entries.length) {
            body.push([
              toPdfSafeText(dayLabel),
              '-',
              'Repos',
              nbCellForRow(0)
            ]);
            return;
          }
          entries.forEach((entry, entryIdx) => {
            body.push([
              entryIdx === 0 ? toPdfSafeText(dayLabel) : '',
              toPdfSafeText(entry.shopName || '-'),
              toPdfSafeText(entry.value),
              nbCellForRow(entryIdx),
            ]);
          });
        });

        doc.autoTable({
          startY: tableStartWeekY,
          head: [['Jour', 'Boutique', 'Horaires / Statut', 'Nb (h)']],
          body,
          styles: { fontSize: 9, cellPadding: 2.2, lineColor: [230, 230, 230], lineWidth: 0.1 },
          headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          columnStyles: {
            0: { cellWidth: 40 },
            1: { cellWidth: 38 },
            2: { cellWidth: 'auto' },
            3: { cellWidth: 18, halign: 'right' }
          }
        });

        const weekTotalPdf = sumEmployeeHoursForExportedWeek(employeeId);
        const weekTotalAtSelectedShop = sumEmployeeHoursForShopWeek(employeeId, selectedShop);
        const { rows: monthlyRowsPdf, monthGrand: monthGrandPdf } = getEmployeeMonthlyHoursByShop(employeeId);
        let yStart = (doc.lastAutoTable?.finalY ?? tableStartWeekY) + 8;
        if (yStart > pageH - 40) {
          doc.addPage();
          yStart = 18;
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(`Total toutes boutiques (cette semaine) : ${formatWorkedHoursForDisplay(weekTotalPdf)}`, 14, yStart);
        yStart += 8;
        if (selectedShop != null) {
          doc.text(
            `Total ${toPdfSafeText(selectedShopLabelName)} (cette semaine) : ${formatWorkedHoursForDisplay(weekTotalAtSelectedShop)}`,
            14,
            yStart
          );
          yStart += 8;
        }
        doc.text(`Cumul du mois (${toPdfSafeText(monthLabel)}) : detail par boutique`, 14, yStart);
        yStart += 6;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(
          'Heures comptees uniquement sur les jours du mois calendaire (semaines a cheval exclus du cumul).',
          14,
          yStart
        );
        yStart += 5;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);

        if (monthlyRowsPdf.length === 0) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.text('(aucune heure sur ce mois dans les plannings)', 14, yStart);
        } else {
          const monthBody = monthlyRowsPdf.map(({ shopName, hours }) => [
            toPdfSafeText(shopName),
            formatWorkedHoursForDisplay(hours)
          ]);
          monthBody.push(['Total toutes boutiques', formatWorkedHoursForDisplay(monthGrandPdf)]);
          doc.autoTable({
            startY: yStart,
            head: [['Boutique', 'Heures (mois)']],
            body: monthBody,
            styles: { fontSize: 9, cellPadding: 2.2 },
            headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: 'bold' },
            didParseCell: (data) => {
              if (
                data.section === 'body' &&
                data.table.body.length > 0 &&
                data.row.index === data.table.body.length - 1
              ) {
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.fillColor = [240, 248, 246];
              }
            }
          });
        }
      };

      const appendSynthesisAllEmployeesTablePage = (doc) => {
        const pageW = doc.internal.pageSize.getWidth();
        doc.addPage();
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        if (exportScopeMonth) {
          doc.text('Synthese : mois calendaire (tous les employes)', pageW / 2, 16, { align: 'center' });
          const synBody = targetEmployeeIds.map((id) => {
            const mH = sumEmployeeHoursForExportedMonth(id);
            return [
              toPdfSafeText(employeeMap.get(id) || id),
              formatWorkedHoursForDisplay(mH),
              formatWorkedHoursNbNotation(mH),
            ];
          });
          doc.autoTable({
            startY: 24,
            head: [['Employe', 'Heures (mois)', 'Nb (h)']],
            body: synBody,
            styles: { fontSize: 9, cellPadding: 2.4 },
            headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: 'bold' },
          });
          return;
        }
        doc.text('Synthese : semaine & cumul du mois (tous les employes)', pageW / 2, 16, { align: 'center' });
        const synBody = targetEmployeeIds.map((id) => {
          const wH = sumEmployeeHoursForExportedWeek(id);
          const { monthGrand } = getEmployeeMonthlyHoursByShop(id);
          return [
            toPdfSafeText(employeeMap.get(id) || id),
            `${formatWorkedHoursForDisplay(wH)}`,
            `${formatWorkedHoursForDisplay(monthGrand)}`,
          ];
        });
        doc.autoTable({
          startY: 24,
          head: [['Employe', 'Heures (semaine affichee)', 'Cumul du mois (toutes boutiques)']],
          body: synBody,
          styles: { fontSize: 9, cellPadding: 2.4 },
          headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: 'bold' },
        });
      };

      const filePeriodTag = exportScopeMonth ? monthTagFile : validWeek;

      const buildMonthlyHoursTableHtml = (employeeId) => {
        const { rows: monthlyByShop, monthGrand } = getEmployeeMonthlyHoursByShop(employeeId);
        if (!monthlyByShop.length) {
          return '<p><em>(aucune heure sur ce mois dans les plannings)</em></p>';
        }
        const rows = monthlyByShop
          .map(
            ({ shopName, hours }) =>
              `<tr><td>${escapeHtml(shopName)}</td><td>${escapeHtml(formatWorkedHoursForDisplay(hours))}</td></tr>`
          )
          .join('');
        const totalRow = `<tr class="subtotal"><td>Total toutes boutiques</td><td>${escapeHtml(formatWorkedHoursForDisplay(monthGrand))}</td></tr>`;
        return `<table><thead><tr><th>Boutique</th><th>Heures (mois)</th></tr></thead><tbody>${rows}${totalRow}</tbody></table>`;
      };

      const buildEmployeeReadableHtmlSection = (employeeId) => {
        const employeeName = employeeMap.get(employeeId) || employeeId;
        let mainTable = '';
        let totalsHtml = '';

        if (exportScopeMonth) {
          const monthRows = buildEmployeeMonthRows(employeeId);
          let weekKeyCurrent = null;
          let weekRunDates = [];
          let bodyRows = '';

          const pushWeekSubtotal = () => {
            if (!weekRunDates.length) return;
            const sum = weekRunDates.reduce(
              (acc, d) => acc + sumEmployeeHoursForCalendarDay(employeeId, d),
              0
            );
            const start = weekRunDates[0];
            const end = weekRunDates[weekRunDates.length - 1];
            bodyRows += `<tr class="subtotal"><td colspan="2">Total sem. ${format(start, 'dd/MM')}–${format(end, 'dd/MM')}</td><td>${escapeHtml(formatWorkedHoursForDisplay(sum))}</td></tr>`;
          };

          monthDaysFlat.forEach((dayDate, dayIdx) => {
            const wk = format(startOfWeek(dayDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
            if (weekKeyCurrent !== null && wk !== weekKeyCurrent) {
              pushWeekSubtotal();
              weekRunDates = [];
            }
            weekKeyCurrent = wk;
            weekRunDates.push(dayDate);
            const { dayLabel, entries } = monthRows[dayIdx];
            const dayHours = sumEmployeeHoursForCalendarDay(employeeId, dayDate);
            const detail = formatMonthReadableDayDetail(entries);
            bodyRows += `<tr><td>${escapeHtml(dayLabel)}</td><td>${escapeHtml(detail)}</td><td>${escapeHtml(formatWorkedHoursNbNotation(dayHours))}</td></tr>`;
          });
          pushWeekSubtotal();

          mainTable = `<table><thead><tr><th>Jour</th><th>Horaires</th><th>Nb (h)</th></tr></thead><tbody>${bodyRows}</tbody></table>`;
          const monthTotal = sumEmployeeHoursForExportedMonth(employeeId);
          totalsHtml = `<p><strong>Total toutes boutiques :</strong> ${escapeHtml(formatWorkedHoursForDisplay(monthTotal))}</p>`;
          if (selectedShop != null) {
            totalsHtml += `<p><strong>Total ${escapeHtml(selectedShopLabelName)} :</strong> ${escapeHtml(formatWorkedHoursForDisplay(sumEmployeeHoursForShopMonth(employeeId, selectedShop)))}</p>`;
          }
          totalsHtml +=
            '<p><em>Heures sur jours du mois calendaire (semaines a cheval : partie hors mois exclue).</em></p>';
        } else {
          let bodyRows = '';
          buildEmployeeDayRows(employeeId).forEach(({ dayLabel, entries }, dayIdx) => {
            const dayHours = sumEmployeeHoursForDay(employeeId, weekDays[dayIdx]);
            if (!entries.length) {
              bodyRows += `<tr><td>${escapeHtml(dayLabel)}</td><td>-</td><td>Repos</td><td>${escapeHtml(formatWorkedHoursNbNotation(dayHours))}</td></tr>`;
              return;
            }
            entries.forEach((entry, entryIdx) => {
              bodyRows += `<tr><td>${entryIdx === 0 ? escapeHtml(dayLabel) : ''}</td><td>${escapeHtml(entry.shopName || '-')}</td><td>${escapeHtml(entry.value)}</td><td>${entryIdx === 0 ? escapeHtml(formatWorkedHoursNbNotation(dayHours)) : ''}</td></tr>`;
            });
          });
          mainTable = `<table><thead><tr><th>Jour</th><th>Boutique</th><th>Horaires / Statut</th><th>Nb (h)</th></tr></thead><tbody>${bodyRows}</tbody></table>`;
          const weekTotal = sumEmployeeHoursForExportedWeek(employeeId);
          totalsHtml = `<p><strong>Total toutes boutiques (cette semaine) :</strong> ${escapeHtml(formatWorkedHoursForDisplay(weekTotal))}</p>`;
          if (selectedShop != null) {
            totalsHtml += `<p><strong>Total ${escapeHtml(selectedShopLabelName)} (cette semaine) :</strong> ${escapeHtml(formatWorkedHoursForDisplay(sumEmployeeHoursForShopWeek(employeeId, selectedShop)))}</p>`;
          }
        }

        return `
          <div class="schedule-sheet employee-block">
            <h2 class="section-title">${escapeHtml(employeeName)}</h2>
            ${mainTable}
            ${totalsHtml}
            <h3 class="section-title">Cumul mensuel (${escapeHtml(monthLabel)}) — detail par boutique</h3>
            ${buildMonthlyHoursTableHtml(employeeId)}
          </div>`;
      };

      const buildSynthesisAllEmployeesHtml = () => {
        if (exportScopeMonth) {
          const rows = targetEmployeeIds
            .map((id) => {
              const mH = sumEmployeeHoursForExportedMonth(id);
              return `<tr><td>${escapeHtml(employeeMap.get(id) || id)}</td><td>${escapeHtml(formatWorkedHoursForDisplay(mH))}</td><td>${escapeHtml(formatWorkedHoursNbNotation(mH))}</td></tr>`;
            })
            .join('');
          return `<div class="schedule-sheet"><h2 class="section-title">Synthese : mois calendaire (tous les employes)</h2><table><thead><tr><th>Employe</th><th>Heures (mois)</th><th>Nb (h)</th></tr></thead><tbody>${rows}</tbody></table></div>`;
        }
        const rows = targetEmployeeIds
          .map((id) => {
            const wH = sumEmployeeHoursForExportedWeek(id);
            const { monthGrand } = getEmployeeMonthlyHoursByShop(id);
            return `<tr><td>${escapeHtml(employeeMap.get(id) || id)}</td><td>${escapeHtml(formatWorkedHoursForDisplay(wH))}</td><td>${escapeHtml(formatWorkedHoursForDisplay(monthGrand))}</td></tr>`;
          })
          .join('');
        return `<div class="schedule-sheet"><h2 class="section-title">Synthese : semaine & cumul du mois (tous les employes)</h2><table><thead><tr><th>Employe</th><th>Heures (semaine affichee)</th><th>Cumul du mois</th></tr></thead><tbody>${rows}</tbody></table></div>`;
      };

      const buildReadableExportMetaLines = () => [
        exportScopeMonth ? `Mois: ${monthLabel}` : `Semaine: ${weekLabel}`,
        `Genere le: ${new Date().toLocaleString('fr-FR')}`,
        'Mode paysage requis sur telephone pour une lecture optimale.',
      ];

      const exportReadableHtmlDocument = (bodyHtml, filename) => {
        const title = exportScopeMonth
          ? `Horaires — ${monthLabel}`
          : `Horaires — semaine ${weekLabel}`;
        const doc = buildLandscapeHtmlDocument({
          title,
          bodyHtml,
          metaLines: buildReadableExportMetaLines(),
        });
        return openOrDownloadLandscapeHtml(doc, { title, filename });
      };

      if (normalizedExportMode === '1') {
        const buildTxtLinesForEmployee = (employeeId) => {
          const lines = [];
          const employeeName = employeeMap.get(employeeId) || employeeId;
          lines.push('============================================================');
          lines.push(`Employe: ${employeeName}`);
          lines.push('============================================================');
          if (exportScopeMonth) {
            const monthRowsTxt = buildEmployeeMonthRows(employeeId);
            let weekKeyCur = null;
            let weekDatesTxt = [];
            const flushWeekTxt = () => {
              if (!weekDatesTxt.length) return;
              const sum = weekDatesTxt.reduce(
                (acc, d) => acc + sumEmployeeHoursForCalendarDay(employeeId, d),
                0
              );
              const start = weekDatesTxt[0];
              const end = weekDatesTxt[weekDatesTxt.length - 1];
              lines.push(
                `  --- Total semaine ${format(start, 'dd/MM')}–${format(end, 'dd/MM')} : ${formatWorkedHoursForDisplay(sum)}`
              );
            };
            monthDaysFlat.forEach((dayDate, idx) => {
              const wk = format(startOfWeek(dayDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
              if (weekKeyCur !== null && wk !== weekKeyCur) {
                flushWeekTxt();
                weekDatesTxt = [];
              }
              weekKeyCur = wk;
              weekDatesTxt.push(dayDate);
              const { dayLabel, entries } = monthRowsTxt[idx];
              const dayH = sumEmployeeHoursForCalendarDay(employeeId, dayDate);
              const formatted = formatMonthReadableDayDetail(entries);
              lines.push(`${dayLabel} -> ${formatted} | Nb (h): ${formatWorkedHoursNbNotation(dayH)}`);
            });
            flushWeekTxt();
            const monthTotalH = sumEmployeeHoursForExportedMonth(employeeId);
            lines.push(`Total toutes boutiques (${monthLabel}) : ${formatWorkedHoursForDisplay(monthTotalH)}`);
            if (selectedShop != null) {
              const atShop = sumEmployeeHoursForShopMonth(employeeId, selectedShop);
              lines.push(`Total ${selectedShopLabelName} (${monthLabel}) : ${formatWorkedHoursForDisplay(atShop)}`);
            }
          } else {
            buildEmployeeDayRows(employeeId).forEach(({ dayLabel, entries }, idx) => {
              const dayH = sumEmployeeHoursForDay(employeeId, weekDays[idx]);
              const formatted = entries.length
                ? entries
                    .map((entry) =>
                      entry.shopName ? `${entry.shopName}: ${entry.value}` : `${entry.value}`
                    )
                    .join(' | ')
                : 'Repos';
              lines.push(`${dayLabel} -> ${formatted} | Nb (h): ${formatWorkedHoursNbNotation(dayH)}`);
            });
            const weekTotalH = sumEmployeeHoursForExportedWeek(employeeId);
            lines.push(`Total toutes boutiques (cette semaine) : ${formatWorkedHoursForDisplay(weekTotalH)}`);
            if (selectedShop != null) {
              const atShop = sumEmployeeHoursForShopWeek(employeeId, selectedShop);
              lines.push(`Total ${selectedShopLabelName} (cette semaine) : ${formatWorkedHoursForDisplay(atShop)}`);
            }
          }
          lines.push('');
          lines.push(`Cumul mensuel (${monthLabel}) — jours du mois calendaire uniquement — detail par boutique:`);
          const { rows: monthlyByShop, monthGrand } = getEmployeeMonthlyHoursByShop(employeeId);
          if (monthlyByShop.length === 0) {
            lines.push('  (aucune heure enregistree sur ce mois dans les plannings)');
          } else {
            monthlyByShop.forEach(({ shopName, hours }) => {
              lines.push(`  ${shopName} | ${formatWorkedHoursForDisplay(hours)}`);
            });
            lines.push(`  Total mois (toutes boutiques): ${formatWorkedHoursForDisplay(monthGrand)}`);
          }
          lines.push('');
          return lines;
        };

        if (audienceTrim === '3') {
          const runTxtChain = (idx) => {
            if (idx >= targetEmployeeIds.length) {
              setLocalFeedback(`✅ ${targetEmployeeIds.length} fichier(s) TXT (un par employe). Autorisez les telechargements multiples si le navigateur le demande.`);
              return;
            }
            const eid = targetEmployeeIds[idx];
            const header = [
              'PLANNING EMPLOYES - EXPORT LISIBLE',
              exportScopeMonth ? `Mois: ${monthLabel}` : `Semaine: ${weekLabel}`,
              `Genere le: ${new Date().toLocaleString('fr-FR')}`,
              '',
              'Recapitulatif mois: detail par boutique (voir ci-dessous).',
              '',
            ];
            const content = [...header, ...buildTxtLinesForEmployee(eid)].join('\n');
            const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `horaires_${sanitizeFileName(employeeMap.get(eid) || eid)}_${filePeriodTag}.txt`;
            a.click();
            URL.revokeObjectURL(url);
            setTimeout(() => runTxtChain(idx + 1), 420);
          };
          runTxtChain(0);
        } else {
          const lines = [];
          lines.push('PLANNING EMPLOYES - EXPORT LISIBLE');
          lines.push(exportScopeMonth ? `Mois: ${monthLabel}` : `Semaine: ${weekLabel}`);
          lines.push(`Genere le: ${new Date().toLocaleString('fr-FR')}`);
          lines.push('');
          targetEmployeeIds.forEach((employeeId) => {
            lines.push(...buildTxtLinesForEmployee(employeeId));
          });
          const content = lines.join('\n');
          const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          const suffix = audienceTrim === '2' ? 'individuel' : 'collectif';
          a.download = `horaires_${suffix}_${filePeriodTag}.txt`;
          a.click();
          URL.revokeObjectURL(url);
          setLocalFeedback(
            `✅ Export TXT ${audienceTrim === '2' ? 'individuel' : 'collectif'} genere.`
          );
        }
      } else if (normalizedExportMode === '2') {
        if (audienceTrim === '3') {
          const runPdfChain = (idx) => {
            if (idx >= targetEmployeeIds.length) {
              setLocalFeedback(
                `✅ ${targetEmployeeIds.length} PDF telecharges (un par employe). Verifiez le dossier de telechargement et l autorisation des telechargements multiples.`
              );
              return;
            }
            const eid = targetEmployeeIds[idx];
            const docOne = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            appendEmployeeReadableSchedulePdf(docOne, eid);
            docOne.save(
              `horaires_${sanitizeFileName(employeeMap.get(eid) || eid)}_${filePeriodTag}.pdf`
            );
            setTimeout(() => runPdfChain(idx + 1), 450);
          };
          runPdfChain(0);
        } else {
          const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
          targetEmployeeIds.forEach((employeeId, index) => {
            if (index > 0) {
              doc.addPage();
            }
            appendEmployeeReadableSchedulePdf(doc, employeeId);
          });
          if (audienceTrim === '1' && targetEmployeeIds.length > 0) {
            appendSynthesisAllEmployeesTablePage(doc);
          }
          const suffix = audienceTrim === '2' ? 'individuel' : 'collectif';
          doc.save(`horaires_${suffix}_${filePeriodTag}.pdf`);
          setLocalFeedback(
            `✅ Export PDF ${audienceTrim === '2' ? 'individuel' : 'collectif'} genere${
              audienceTrim === '1'
                ? exportScopeMonth
                  ? ' (avec page synthese mois)'
                  : ' (avec page synthese semaine + mois)'
                : ''
            }.`
          );
        }
      } else {
        if (audienceTrim === '3') {
          const runHtmlChain = (idx) => {
            if (idx >= targetEmployeeIds.length) {
              setLocalFeedback(
                `✅ ${targetEmployeeIds.length} fichier(s) HTML telecharges (un par employe). Basculez le telephone en paysage pour lire.`
              );
              return;
            }
            const eid = targetEmployeeIds[idx];
            const bodyHtml = buildEmployeeReadableHtmlSection(eid);
            const doc = buildLandscapeHtmlDocument({
              title: `Horaires — ${employeeMap.get(eid) || eid}`,
              bodyHtml,
              metaLines: buildReadableExportMetaLines(),
            });
            downloadLandscapeHtmlFile(
              doc,
              `horaires_${sanitizeFileName(employeeMap.get(eid) || eid)}_${filePeriodTag}.html`
            );
            setTimeout(() => runHtmlChain(idx + 1), 420);
          };
          runHtmlChain(0);
        } else {
          const sections = targetEmployeeIds.map((employeeId) =>
            buildEmployeeReadableHtmlSection(employeeId)
          );
          if (audienceTrim === '1' && targetEmployeeIds.length > 0) {
            sections.push(buildSynthesisAllEmployeesHtml());
          }
          const suffix = audienceTrim === '2' ? 'individuel' : 'collectif';
          const filename = `horaires_${suffix}_${filePeriodTag}.html`;
          const result = exportReadableHtmlDocument(sections.join(''), filename);
          if (result.mode === 'download-fallback') {
            setLocalFeedback(
              `✅ Export HTML ${audienceTrim === '2' ? 'individuel' : 'collectif'} telecharge (pop-up bloquee). Ouvrez le fichier et basculez en paysage.`
            );
          } else if (result.mode === 'download') {
            setLocalFeedback(
              `✅ Export HTML ${audienceTrim === '2' ? 'individuel' : 'collectif'} telecharge. Basculez le telephone en paysage.`
            );
          } else {
            setLocalFeedback(
              `✅ Export HTML ${audienceTrim === '2' ? 'individuel' : 'collectif'} ouvert. Basculez le telephone en paysage pour visualiser.`
            );
          }
        }
      }
    } catch (error) {
      console.error('Erreur export horaires lisibles:', error);
      setLocalFeedback('❌ Erreur lors de l export horaires lisibles.');
    }
  }, [validWeek, selectedShop, planning, userScopedPlanningData, config, setLocalFeedback]);

  if (!currentShopData) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '40px 20px',
        maxWidth: '600px',
        margin: '0 auto'
      }}>
        <h2 style={{ color: '#333', marginBottom: '20px' }}>Aucune boutique sélectionnée</h2>
        <p style={{ color: '#666', marginBottom: '30px' }}>
          Il semble qu'aucune boutique ne soit configurée ou sélectionnée.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '15px' }}>
          <button
            onClick={onBackToStartup}
            style={{
              padding: '12px 30px',
              fontSize: '16px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            Retour à l'écran de démarrage
          </button>
        </div>
      </div>
    );
  }

  // Si la page copier-coller est active, afficher seulement cette page
  if (showCopyPastePage) {
    return (
      <CopyPastePage
        planningData={planningData}
        setPlanningData={setPlanningData}
        selectedShop={selectedShop}
        selectedWeek={validWeek}
        liveWeekPlanning={planning}
        isEmployeeAssignedToCurrentShop={isEmployeeAssignedToCurrentShop}
        setSelectedWeek={setSelectedWeek}
        setForceRefresh={setForceRefresh}
        onBack={() => setShowCopyPastePage(false)}
      />
    );
  }

  // Si la page des statistiques est active, afficher seulement cette page
  if (showShopStatsPage) {
    return (
      <ShopStatsPage
        planningData={planningData}
        selectedShop={selectedShop}
        selectedWeek={validWeek}
        config={config}
        shops={shops}
        employees={allEmployees}
        onBack={() => setShowShopStatsPage(false)}
      />
    );
  }

  return (
    <div className="planning-display" style={{
      width: '100%',
      minHeight: '100vh',
      padding: deviceInfo.isTablet ? '30px' : '20px',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      gap: deviceInfo.isTablet ? '25px' : '20px',
      overflowX: 'hidden',
      overflowY: 'auto',
      maxWidth: '100vw',
      margin: '0 auto'
    }}>
        <TouchOptimizationBanner />
      
      {localFeedback && (
        <p style={{ 
          fontFamily: 'Roboto, sans-serif', 
          textAlign: 'center', 
          color: localFeedback.includes('Succès') ? '#4caf50' : '#e53935', 
          marginBottom: '10px' 
        }}>
          {localFeedback}
        </p>
      )}
      
      {/* Titre de la semaine - EN HAUT */}
      <div style={{
        textAlign: 'center',
        marginBottom: deviceInfo.isTablet ? '14px' : '12px',
        padding: deviceInfo.isTablet ? '16px 18px' : '12px 16px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: deviceInfo.isTablet ? '20px' : '16px',
        border: 'none',
        boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)',
        position: 'relative',
        overflow: 'hidden',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(45deg, rgba(255,255,255,0.1) 25%, transparent 25%), linear-gradient(-45deg, rgba(255,255,255,0.1) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.1) 75%), linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.1) 75%)',
          backgroundSize: '20px 20px',
          backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px'
        }} />
        <h2 style={{
          fontFamily: 'Roboto, sans-serif',
          fontSize: deviceInfo.isTablet ? '24px' : '22px',
          fontWeight: '800',
          color: '#ffffff',
          margin: '0',
          textTransform: 'uppercase',
          letterSpacing: '2px',
          textShadow: '0 2px 4px rgba(0,0,0,0.3)',
          position: 'relative',
          zIndex: 1
        }}>
          {getWeekTitle()}
        </h2>
        <p style={{
          fontFamily: 'Roboto, sans-serif',
          fontSize: deviceInfo.isTablet ? '18px' : '16px',
          color: '#ffffff',
          margin: '6px 0 0 0',
          fontStyle: 'italic',
          fontWeight: '500',
          textShadow: '0 1px 2px rgba(0,0,0,0.3)',
          position: 'relative',
          zIndex: 1
        }}>
          {currentShopData?.name || selectedShop}
          {deviceInfo.isIPad && (
            <span style={{ 
              fontSize: '16px', 
              color: '#e3f2fd', 
              marginLeft: '12px',
              fontWeight: '400',
              backgroundColor: 'rgba(255,255,255,0.2)',
              padding: '4px 8px',
              borderRadius: '6px'
            }}>
              📱 Mode iPad
            </span>
          )}
        </p>
      </div>

      {/* Indicateur de sauvegarde automatique */}
      {nextAutoBackup && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: '10px',
          padding: '8px 16px',
          background: 'linear-gradient(135deg, #e8f5e8 0%, #d4edda 100%)',
          borderRadius: '8px',
          border: '1px solid #c3e6cb',
          fontSize: '12px',
          color: '#155724',
          fontWeight: '500'
        }}>
          <span style={{ marginRight: '8px' }}>💾</span>
          Sauvegarde automatique JSON dans {Math.max(0, Math.ceil((nextAutoBackup - autoBackupNowMs) / 1000))} s
        </div>
      )}



      {/* Menu Actions - sauvegarde/fermeture toujours visibles */}
        <div style={{ width: '100%', position: 'sticky', top: 0, zIndex: 200, flexShrink: 0 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 8,
              padding: '8px 12px',
              background: '#f8fafc',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              marginBottom: showPlanningMenuBar ? '8px' : 0,
              boxShadow: '0 2px 8px rgba(15, 23, 42, 0.08)'
            }}
          >
            <span style={{ fontSize: '14px', fontWeight: 800, color: '#334155' }}>
              ⚙️ Menu actions (Pilotage, exports, sauvegardes…)
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleManualSave}
                style={{
                  backgroundColor: '#17a2b8',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 14px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  whiteSpace: 'nowrap'
                }}
                title="Sauvegarder la semaine et le fichier complet dans Supabase"
              >
                💾 SAUVE SUPABASE
              </button>
              <button
                type="button"
                onClick={handleCloseApplication}
                style={{
                  backgroundColor: '#6c757d',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 14px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  whiteSpace: 'nowrap'
                }}
                title="Fermer l'application"
              >
                🚪 Fermer
              </button>
              {(!currentUser?.code || checkUserPermission(currentUser.code, 'canViewWeeklyMatrix')) && (
                <button
                  type="button"
                  onClick={() => setShowWeeklyWorkMatrix(true)}
                  style={{
                    backgroundColor: '#1565c0',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 14px',
                    fontSize: '13px',
                    cursor: 'pointer',
                    fontWeight: 700,
                    whiteSpace: 'nowrap'
                  }}
                  title="Planning semaine ou mois par boutique : employés présents, horaires, congés, impression et PDF"
                >
                  📋 Planning boutiques semaine
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowPlanningMenuBar((value) => !value)}
                style={{
                  backgroundColor: showPlanningMenuBar ? '#ff9800' : '#4caf50',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  fontWeight: 700
                }}
                title={showPlanningMenuBar ? 'Masquer la barre de menu' : 'Afficher la barre de menu'}
              >
                {showPlanningMenuBar ? '👁️ Masquer menu' : '👁️ Afficher menu'}
              </button>
            </div>
          </div>
          {showPlanningMenuBar && (
          <PlanningMenuBar
            currentShop={selectedShop}
            shops={accessibleShops}
            currentWeek={validWeek}
            changeWeek={changeWeek}
            changeShop={changeShop}
            changeMonth={changeMonth}
            onBack={onBackToEmployees}
            onBackToShop={onBackToShopSelection}
            onBackToShopManagement={onBackToShopManagement}
            onBackToWeek={onBackToWeekSelection}
            onBackToConfig={onBackToConfig}
            onBackToStartup={onBackToStartup}
            onOpenSchoolMode={onOpenSchoolMode}
            onExport={handleExport}
            onImport={onImport}
            onReset={() => setShowResetModal(true)}
            onOpenShopWeekInsights={() => setShowShopWeekInsights(true)}
            onOpenPresenceMap={() => setShowPresenceMap(true)}
            onOpenWeeklyWorkMatrix={() => setShowWeeklyWorkMatrix(true)}
            handleManualSave={handleManualSave}
            onCreateJSONBackup={createAutoBackupJSON}
            onExportReadableSchedules={exportReadableSchedules}
            onOpenShopStats={() => setShowShopStatsPage(true)}
            onOpenGestion={() => setShowGestionBoutique(true)}
            onOpenNotes={() => setShowNotesModal(true)}
            onOpenLabourInspection={() => setShowLabourInspectionModal(true)}
            testSupabase={testSupabase}
            cleanSupabaseData={cleanSupabaseData}
            diagnoseSupabase={diagnoseSupabase}
            diagnoseAndCleanLocks={diagnoseAndCleanLocks}
            handleRestoreFromSupabase={onRestoreFromSupabase}
            handleRestoreBackupFromHistory={onRestoreBackupFromHistory}
            handleBrowseShopWeekArchives={onBrowseShopWeekArchives}
            handleRestoreShopWeekFromHistory={onRestoreShopWeekFromHistory}
            handleExploreBackupHistory={onExploreBackupHistory}
            handleMergeShopFromJson={onMergeShopFromJson}
            handleExitApplication={onExitApplication}
          currentUser={currentUser}
          // Nouveaux props pour les boutons déplacés
          setShowResetModal={setShowResetModal}
          toggleMenu={toggleMenu}
          restoreFromBackup={restoreFromBackup}
          createAutoBackupJSON={createAutoBackupJSON}
          autoLockEnabled={autoLockEnabled}
          setAutoLockEnabled={setAutoLockEnabled}
          copyWeekToNextWeek={copyWeekToNextWeek}
          onOpenCopyPastePage={() => setShowCopyPastePage(true)}
          validationState={validationState}
          
          // Gestion des employés masqués
          planningData={planningData}
          onEmployeeUpdate={setPlanningData}
          />
          )}
        </div>




      {/* PLANNING - DIRECTEMENT APRÈS LE TITRE ET LES RÉCAPITULATIFS */}


      <div className="planning-content" style={{
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        flex: '1',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        minHeight: '0',
        overflowX: 'hidden',
        boxSizing: 'border-box'
      }}>
        <div className="planning-left" style={{
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          boxSizing: 'border-box'
        }}>
          {/* Sélecteur de boutique et navigation */}
          <div style={{
            textAlign: 'center',
            marginBottom: '10px',
            padding: deviceInfo.isTablet ? '12px' : '10px',
            background: 'linear-gradient(135deg, #fffaf0 0%, #fef5e7 100%)',
            borderRadius: '16px',
            border: '2px solid #fbd38d',
            display: 'flex',
            alignItems: 'center',
            gap: deviceInfo.isTablet ? '20px' : '15px',
            flexWrap: 'wrap',
            justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(251, 211, 141, 0.2)',
            width: '100%',
            boxSizing: 'border-box'
          }}>
            <select
              value={selectedShop}
              onChange={(e) => setSelectedShop(e.target.value)}
              style={{ 
                padding: deviceInfo.isTablet ? '14px 18px' : '12px 16px',
                fontSize: deviceInfo.isTablet ? '16px' : '15px',
                border: '2px solid #e2e8f0',
                borderRadius: '10px',
                minWidth: deviceInfo.isTablet ? '250px' : '220px',
                maxWidth: '100%',
                backgroundColor: '#fff',
                cursor: 'pointer',
                fontWeight: '500',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                transition: 'all 0.2s ease',
                flex: deviceInfo.isTablet ? '1' : '0 1 auto'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.borderColor = '#cbd5e0';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = '#e2e8f0';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
              }}
            >
              {accessibleShops.map(shop => (
                <option key={shop.id} value={shop.id}>{shop.name}</option>
              ))}
            </select>

            {/* Boutons de navigation semaine */}
            <button
              onClick={() => changeWeek('prev')}
              style={{
                background: 'linear-gradient(135deg, #2196f3 0%, #1976d2 100%)',
                color: 'white',
                padding: deviceInfo.isTablet ? '14px 24px' : '12px 20px',
                fontSize: deviceInfo.isTablet ? '16px' : '15px',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: '600',
                boxShadow: '0 4px 12px rgba(33, 150, 243, 0.3)',
                transition: 'all 0.3s ease',
                textShadow: '0 1px 2px rgba(0,0,0,0.2)',
                whiteSpace: 'nowrap',
                minWidth: deviceInfo.isTablet ? 'auto' : 'fit-content'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(33, 150, 243, 0.4)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #2196f3 0%, #1976d2 100%)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(33, 150, 243, 0.3)';
              }}
            >
              ← Semaine précédente
            </button>

            {/* Sélecteur de mois */}
            <select
              value={selectedWeek ? format(parseISO(selectedWeek), 'yyyy-MM') : ''}
              onChange={(e) => changeMonth(e.target.value)}
              style={{ 
                padding: deviceInfo.isTablet ? '12px 16px' : '10px 14px',
                fontSize: deviceInfo.isTablet ? '15px' : '14px',
                border: '2px solid #e2e8f0',
                borderRadius: '10px',
                minWidth: deviceInfo.isTablet ? '180px' : '150px',
                maxWidth: '100%',
                backgroundColor: '#fff',
                cursor: 'pointer',
                fontWeight: '500',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                transition: 'all 0.2s ease',
                flex: deviceInfo.isTablet ? '1' : '0 1 auto'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.borderColor = '#cbd5e0';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = '#e2e8f0';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
              }}
            >
              {(() => {
                const currentDate = selectedWeek ? parseISO(selectedWeek) : new Date();
                const startDate = new Date(currentDate.getFullYear() - 1, currentDate.getMonth(), 1);
                const endDate = new Date(currentDate.getFullYear() + 1, currentDate.getMonth(), 1);
                
                const months = [];
                for (let d = new Date(startDate); d <= endDate; d.setMonth(d.getMonth() + 1)) {
                  const monthKey = format(d, 'yyyy-MM');
                  const monthLabel = format(d, 'MMMM yyyy', { locale: fr });
                  months.push(
                    <option key={monthKey} value={monthKey}>
                      {monthLabel}
                    </option>
                  );
                }
                return months;
              })()}
            </select>

            <button
              onClick={() => changeWeek('next')}
              style={{
                background: 'linear-gradient(135deg, #2196f3 0%, #1976d2 100%)',
                color: 'white',
                padding: deviceInfo.isTablet ? '14px 24px' : '12px 20px',
                fontSize: deviceInfo.isTablet ? '16px' : '15px',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: '600',
                boxShadow: '0 4px 12px rgba(33, 150, 243, 0.3)',
                transition: 'all 0.3s ease',
                textShadow: '0 1px 2px rgba(0,0,0,0.2)',
                whiteSpace: 'nowrap',
                minWidth: deviceInfo.isTablet ? 'auto' : 'fit-content'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(33, 150, 243, 0.4)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #2196f3 0%, #1976d2 100%)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(33, 150, 243, 0.3)';
              }}
            >
              Semaine suivante →
            </button>
          </div>

          <DayButtons 
            days={days} 
            currentDay={currentDay} 
            setCurrentDay={handleDayChange}
            planning={planning}
            config={config}
            selectedEmployees={localSelectedEmployees}
            selectedWeek={format(mondayOfWeek, 'yyyy-MM-dd')}
            selectedShop={selectedShop}
          />

          <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0 4px' }}>
            <button
              type="button"
              onClick={() => setShowPresenceMap(true)}
              title="Voir qui est présent en même temps, créneau par créneau, pour la boutique affichée"
              style={{
                background: 'linear-gradient(90deg, #0f4c75 0%, #1b4964 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '10px 18px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(15, 76, 117, 0.25)'
              }}
            >
              🗺️ Cartographie présence (jour × heure)
            </button>
          </div>
          
          {/* Boutons de déverrouillage simples */}
          <div style={{
            backgroundColor: '#f8f9fa',
            border: '1px solid #dee2e6',
            borderRadius: '8px',
            padding: '8px',
            margin: '6px 0',
            display: 'flex',
            gap: '10px',
            flexWrap: 'wrap'
          }}>
            <button
              onClick={() => {
                const newState = {
                  isWeekValidated: false,
                  validatedEmployees: [],
                  lockedEmployees: []
                };
                setValidationState(newState);
                localStorage.setItem(`validation_${selectedShop}_${validWeek}`, JSON.stringify(newState));
              }}
              style={{
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                padding: '8px 16px',
                fontSize: '14px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              🔓 Déverrouiller tous
            </button>
            
            <button
              onClick={() => {
                const newState = {
                  isWeekValidated: true,
                  validatedEmployees: localSelectedEmployees,
                  lockedEmployees: localSelectedEmployees
                };
                setValidationState(newState);
                localStorage.setItem(`validation_${selectedShop}_${validWeek}`, JSON.stringify(newState));
              }}
              style={{
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                padding: '8px 16px',
                fontSize: '14px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              🔒 Verrouiller tous
            </button>
            
            <div style={{ fontSize: '12px', color: '#6c757d', alignSelf: 'center' }}>
              {validationState.lockedEmployees.length} employé(s) verrouillé(s)
            </div>
            
            <button
              onClick={() => setAutoLockEnabled(!autoLockEnabled)}
              style={{
                backgroundColor: autoLockEnabled ? '#28a745' : '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                padding: '8px 16px',
                fontSize: '14px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
              title={autoLockEnabled ? 
                'Désactiver le verrouillage automatique lors du changement de jour' : 
                'Activer le verrouillage automatique lors du changement de jour'
              }
            >
              {autoLockEnabled ? '🔒 Auto-verrouillage ON' : '🔓 Auto-verrouillage OFF'}
            </button>
            
            <button
              onClick={copyWeekToNextWeek}
              style={{
                backgroundColor: '#17a2b8',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                padding: '8px 16px',
                fontSize: '14px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
              title="Copier les données de la semaine actuelle vers la semaine suivante"
            >
              📋 Copier → Semaine +1
            </button>
          </div>
          

        </div>

        {(isWeekEditingLocked || sessionAllHistoricalUnlocked || isBeforeLatestVisitedWeek) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              padding: '12px 14px',
              borderRadius: '10px',
              border: isWeekEditingLocked ? '2px solid #f59e0b' : '2px solid #22c55e',
              background: isWeekEditingLocked ? '#fffbeb' : '#ecfdf5',
              color: isWeekEditingLocked ? '#92400e' : '#166534',
              fontWeight: 700,
              flexWrap: 'wrap'
            }}
          >
            <div>
              {isWeekEditingLocked
                ? isBeforeLatestVisitedWeek
                  ? '🔒 Semaine verrouillée : une semaine plus récente a déjà été consultée.'
                  : isWeekFullyHistorical
                  ? '🔒 Semaine verrouillée : toutes les dates sont antérieures à aujourd’hui.'
                  : '🔒 Dates passées verrouillées : aujourd’hui et les jours futurs restent modifiables.'
                : sessionAllHistoricalUnlocked
                  ? '🔓 Toutes les semaines passées sont modifiables pour cette session.'
                  : '🔓 Semaine affichée modifiable pour cette session.'}
              <div style={{ fontSize: '12px', fontWeight: 500, marginTop: '3px' }}>
                Code superviseur : déverrouille toutes les semaines passées (pas seulement la semaine affichée).
              </div>
            </div>
            <button
              type="button"
              onClick={isWeekEditingLocked ? requestHistoricalWeekUnlock : relockHistoricalWeek}
              style={{
                background: isWeekEditingLocked ? '#d97706' : '#15803d',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '9px 14px',
                cursor: 'pointer',
                fontWeight: 800
              }}
            >
              {isWeekEditingLocked ? 'Déverrouiller toutes les semaines passées' : 'Reverrouiller les semaines passées'}
            </button>
          </div>
        )}

        <div className="planning-right" style={{
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          flex: '1',
          minHeight: '0',
          overflowX: 'hidden',
          boxSizing: 'border-box'
        }}>
          <PlanningTable
            employees={currentShopEmployees}
            selectedEmployees={localSelectedEmployees}
            onEmployeeToggle={handleEmployeeToggle}
            planning={planning}
            onToggleSlot={toggleSlot}
            planningData={planningData}
            selectedShop={selectedShop}
            onSetDayStatus={(employeeId, dayIndex, status) => {
              if (isPlanningDateLocked(dayIndex)) {
                setLocalFeedback('🔒 Date antérieure verrouillée. Code superviseur requis pour la modifier pendant cette session.');
                return;
              }
              if (readOnly) { setLocalFeedback('🔒 Lecture seule'); return; }
              const dayKey = format(addDays(mondayOfWeek, dayIndex), 'yyyy-MM-dd');
              const absenceValue =
                status === 'maladie' ? 'Maladie 🤒' : status === 'conge' ? 'Congé ☀️' : null;
              const mainShopIdForEmployee =
                getEmployeeMainShopId(planningData, employeeId) || String(selectedShop);
              setPlanning(prev => {
                const updated = { ...prev };
                if (!updated[employeeId]) updated[employeeId] = {};
                if (status === 'maladie') {
                  updated[employeeId][dayKey] = 'Maladie 🤒';
                } else if (status === 'conge') {
                  updated[employeeId][dayKey] = 'Congé ☀️';
                } else {
                  // none: réinitialiser les slots à false
                  updated[employeeId][dayKey] = Array(config.timeSlots.length).fill(false);
                }
                if (absenceValue && String(selectedShop) !== String(mainShopIdForEmployee)) {
                  updated[employeeId][dayKey] = Array(config.timeSlots.length).fill(false);
                }
                // Sauvegarde immédiate
                try {
                  setPlanningData((currentPlanning) => {
                    if (status === 'none') {
                      return saveWeekPlanning(
                        currentPlanning,
                        selectedShop,
                        validWeek,
                        updated,
                        localSelectedEmployees
                      );
                    }
                    if (!absenceValue) {
                      return saveWeekPlanning(
                        currentPlanning,
                        selectedShop,
                        validWeek,
                        updated,
                        localSelectedEmployees
                      );
                    }
                    let d = currentPlanning;
                    const employeeGlobal = (d.shops || [])
                      .flatMap(s => s.employees || [])
                      .find(e => e.id === employeeId);
                    const mainShopId = String(
                      employeeGlobal?.mainShop ||
                      determineEmployeeMainShop(d, employeeId) ||
                      selectedShop
                    );
                    const mainShop = (d.shops || []).find(s => String(s.id) === mainShopId);
                    const mainWp = mainShop?.weeks?.[validWeek]?.planning || {};
                    d = saveWeekPlanning(
                      d,
                      mainShopId,
                      validWeek,
                      {
                        ...mainWp,
                        [employeeId]: {
                          ...(mainWp[employeeId] || {}),
                          [dayKey]: absenceValue
                        }
                      },
                      mainShop?.weeks?.[validWeek]?.selectedEmployees || localSelectedEmployees
                    );
                    (employeeGlobal?.canWorkIn || []).forEach((shopId) => {
                      if (String(shopId) === mainShopId) return;
                      const shop = (d.shops || []).find(s => String(s.id) === String(shopId));
                      if (!shop) return;
                      const wp = shop.weeks?.[validWeek]?.planning || {};
                      const dv = wp[employeeId]?.[dayKey];
                      if (typeof dv !== 'string' || !isAbsenceDayValue(dv)) return;
                      const empCopy = { ...(wp[employeeId] || {}) };
                      delete empCopy[dayKey];
                      const newWp = { ...wp };
                      if (Object.keys(empCopy).length === 0) delete newWp[employeeId];
                      else newWp[employeeId] = empCopy;
                      d = saveWeekPlanning(
                        d,
                        shopId,
                        validWeek,
                        newWp,
                        shop.weeks?.[validWeek]?.selectedEmployees || []
                      );
                    });
                    if (String(selectedShop) !== mainShopId) {
                      d = saveWeekPlanning(
                        d,
                        selectedShop,
                        validWeek,
                        updated,
                        localSelectedEmployees
                      );
                    }
                    return d;
                  });
                  setHasUnsavedChanges(false);
                } catch (e) {
                  console.error('Erreur sauvegarde statut jour:', e);
                  setHasUnsavedChanges(true);
                }
                return updated;
              });
            }}
            config={config}
            lockedEmployees={
              isWeekFullyLocked
                ? currentShopEmployees.map((emp) => emp.id).filter(Boolean)
                : validationState.lockedEmployees
            }
            currentDay={currentDay}
            selectedWeek={format(mondayOfWeek, 'yyyy-MM-dd')}
            showCalendarTotals={showCalendarTotals}
            setShowCalendarTotals={setShowCalendarTotals}
            currentShopEmployees={currentShopEmployees}
            validatedData={validatedData}
            onMarkAsValidated={markAsValidated}
          />
        </div>
      </div>

      <EmployeeRecapCompact
        show={showEmployeeRecap}
        onToggle={() => setShowEmployeeRecap(!showEmployeeRecap)}
        employeeIds={(localSelectedEmployees && localSelectedEmployees.length > 0
          ? localSelectedEmployees.filter((employeeId) =>
              (currentShopEmployees || []).some((emp) => emp.id === employeeId)
            )
          : (currentShopEmployees || []).map((emp) => emp.id))}
        currentShopEmployees={currentShopEmployees}
        planningData={planningData}
        planning={planning}
        selectedShop={selectedShop}
        validWeek={validWeek}
        mondayOfWeek={mondayOfWeek}
        config={config}
        deviceInfo={deviceInfo}
        onOpenWeeklyRecap={(employeeId) => {
          setSelectedEmployeeForWeeklyRecap(employeeId);
          setShowEmployeeWeeklyRecap(true);
        }}
        onOpenMonthlyDetail={(employeeId) => {
          setSelectedEmployeeForMonthlyDetail(employeeId);
          setShowEmployeeMonthlyDetail(true);
        }}
        onOpenMonthlyRecap={(employeeId) => {
          setSelectedEmployeeForMonthlyRecap(employeeId);
          setShowEmployeeMonthlyRecap(true);
        }}
        onHideEmployee={handleHideEmployee}
        onArchiveEmployee={handleArchiveEmployee}
        onReactivateEmployee={handleShowEmployee}
        onRenameEmployee={handleRenameEmployeeClick}
        isEmployeeHiddenInShop={(employeeId) => {
          const emp = currentShopEmployees?.find((e) => e.id === employeeId);
          return !!emp?.hiddenFrom;
        }}
      />

      {/* TOUT LE RESTE - SOUS LE PLANNING */}


      {/* Modales */}
      <ResetModal
        show={showResetModal}
        onClose={() => setShowResetModal(false)}
        onReset={handleReset}
        currentShop={selectedShop}
        currentWeek={validWeek}
        employees={currentShopEmployees}
      />

      <RecapModal
        show={showRecapModal !== null}
        onClose={() => setShowRecapModal(null)}
        recapType={showRecapModal}
        employees={currentShopEmployees}
        planning={planning}
        config={config}
        currentWeek={validWeek}
        currentShop={selectedShop}
      />

      

      {/* Version 2 de la modale globale */}
      <ShopWeekInsightsModal
        isOpen={showShopWeekInsights}
        onClose={() => setShowShopWeekInsights(false)}
        planningData={userScopedPlanningData}
        selectedShop={selectedShop}
        selectedWeek={validWeek}
        planning={planning}
        config={config}
        currentShopEmployees={currentShopEmployees}
        selectedEmployees={localSelectedEmployees}
        shops={accessibleShops}
        changeShop={changeShop}
        changeMonth={changeMonth}
        changeToSpecificWeek={changeToSpecificWeek}
      />

      <ShopPresenceMapModal
        isOpen={showPresenceMap}
        onClose={() => setShowPresenceMap(false)}
        shopName={currentShopLabel}
        selectedWeek={validWeek}
        mondayOfWeek={mondayOfWeek}
        planning={planning}
        config={config}
        employeeIds={localSelectedEmployees}
        employeeNameById={employeeNameById}
        currentDay={currentDay}
      />

      <WeeklyWorkMatrixModal
        isOpen={showWeeklyWorkMatrix}
        onClose={() => setShowWeeklyWorkMatrix(false)}
        planningData={userScopedPlanningData}
        selectedWeek={validWeek}
        currentShopId={selectedShop}
        currentWeekPlanning={planning}
      />

      <LabourInspectionModal
        isOpen={showLabourInspectionModal}
        onClose={() => setShowLabourInspectionModal(false)}
        planningData={planningData}
        selectedShop={selectedShop}
        selectedWeek={validWeek}
        currentPlanning={planning}
        currentConfig={config}
        activeEmployees={currentShopEmployees}
        savedMetaByShop={planningData?.inspectionMetaByShop || {}}
        onSaveMeta={handleSaveInspectionMeta}
        onSaveEmployeeContractData={handleSaveInspectionEmployeeContractData}
      />

      

      {showMonthlyRecapModal && (
      <MonthlyRecapModals
        showMonthlyRecapModal={showMonthlyRecapModal}
        setShowMonthlyRecapModal={setShowMonthlyRecapModal}
        config={config}
        selectedShop={selectedShop}
        selectedWeek={validWeek}
        selectedEmployees={localSelectedEmployees}
        shops={accessibleShops}
          planningData={userScopedPlanningData}
      />
      )}

      {/* Temporairement désactivé pour éviter les problèmes d'affichage */}
      {false && (
      <MonthlyDetailModal
        show={showMonthlyDetailModal}
        onClose={() => setShowMonthlyDetailModal(false)}
        planning={planning}
        config={config}
        currentWeek={validWeek}
        currentShop={selectedShop}
        employees={currentShopEmployees}
      />
      )}



      {/* Modales temporairement désactivées pour éviter l'ouverture automatique */}
      {showEmployeeMonthlyWeeklyModal && (
        <EmployeeMonthlyWeeklyModal
          show={showEmployeeMonthlyWeeklyModal}
          onClose={() => setShowEmployeeMonthlyWeeklyModal(false)}
          selectedEmployeeForMonthlyRecap={selectedEmployeeForMonthlyRecap}
          setSelectedEmployeeForMonthlyRecap={setSelectedEmployeeForMonthlyRecap}
          currentWeek={validWeek}
          currentShop={selectedShop}
          config={config}
        />
      )}

      {showEmployeeMonthlyRecap && (
        <EmployeeMonthlyRecapModal
          showEmployeeMonthlyRecap={showEmployeeMonthlyRecap}
          setShowEmployeeMonthlyRecap={setShowEmployeeMonthlyRecap}
          config={config}
          selectedShop={selectedShop}
          selectedWeek={validWeek}
          selectedEmployees={localSelectedEmployees}
          selectedEmployeeForMonthlyRecap={selectedEmployeeForMonthlyRecap}
          shops={accessibleShops}
          employees={currentShopEmployees}
          planningData={userScopedPlanningData}
        />
      )}

      {showEmployeeWeeklyRecap && (
        <EmployeeWeeklyRecapModal
          showEmployeeWeeklyRecap={showEmployeeWeeklyRecap}
          setShowEmployeeWeeklyRecap={setShowEmployeeWeeklyRecap}
          config={config}
          selectedShop={selectedShop}
          selectedWeek={validWeek}
          selectedEmployeeForWeeklyRecap={selectedEmployeeForWeeklyRecap}
          shops={accessibleShops}
          employees={currentShopEmployees}
          planningData={userScopedPlanningData}
        />
      )}

      {showEmployeeMonthlyDetail && (
        <EmployeeMonthlyDetailModal
          showEmployeeMonthlyDetail={showEmployeeMonthlyDetail}
          setShowEmployeeMonthlyDetail={setShowEmployeeMonthlyDetail}
          config={config}
          selectedShop={selectedShop}
          selectedWeek={validWeek}
          selectedEmployeeForMonthlyDetail={selectedEmployeeForMonthlyDetail}
          shops={shops}
          employees={currentShopEmployees}
          planningData={planningData}
          forceRefresh={modalForceRefresh}
          onForceRefresh={() => setModalForceRefresh(prev => prev + 1)}
        />
      )}

      {/* Modale d'avertissement pour les données validées */}
      {showValidationWarning && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '8px',
            maxWidth: '500px',
            textAlign: 'center',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
          }}>
            <h3 style={{ color: '#dc3545', marginBottom: '20px' }}>
              ⚠️ ATTENTION - Données Validées
            </h3>
            <p style={{ marginBottom: '20px', fontSize: '16px' }}>
              Vous tentez de modifier des données qui ont été marquées comme validées.
            </p>
            <p style={{ marginBottom: '25px', fontSize: '14px', color: '#666' }}>
              Cette action pourrait compromettre l'intégrité des données sauvegardées.
            </p>
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
              <button
                onClick={cancelModification}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                ❌ Annuler
              </button>
              <button
                onClick={forceModification}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                ⚠️ Forcer la modification
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale de notes */}
      <NotesModal
        showNotesModal={showNotesModal}
        setShowNotesModal={setShowNotesModal}
        selectedShop={selectedShop}
        selectedWeek={validWeek}
        employees={currentShopEmployees}
        planningData={planningData}
        onSaveNotes={(notes) => {
          console.log('Notes sauvegardées:', notes);
          setFeedback('✅ Notes sauvegardées avec succès');
        }}
      />

      {/* Page de Gestion Boutique */}
      {showGestionBoutique && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            padding: '40px',
            borderRadius: '16px',
            maxWidth: '900px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            {/* Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '30px',
              borderBottom: '2px solid #e0e0e0',
              paddingBottom: '20px'
            }}>
              <h1 style={{
                color: '#333',
                margin: '0',
                fontSize: '28px',
                fontWeight: 'bold'
              }}>
                🏪 Gestion Boutique
              </h1>
              <button
                onClick={() => setShowGestionBoutique(false)}
                style={{
                  background: 'linear-gradient(135deg, #6c757d 0%, #495057 100%)',
                  color: 'white',
                  padding: '12px 24px',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '14px'
                }}
              >
                ✕ Fermer
              </button>
            </div>

            {/* Sélecteur de module */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '20px',
              marginBottom: '40px',
              flexWrap: 'wrap'
            }}>
              <button
                onClick={() => setShowShopStatsPage(true)}
                style={{
                  padding: '20px 30px',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '18px',
                  background: 'linear-gradient(135deg, #007bff 0%, #0056b3 100%)',
                  color: 'white',
                  transition: 'all 0.3s ease',
                  minWidth: '200px'
                }}
              >
                📅 Statistiques Planning
              </button>
              <button
                onClick={() => {
                  setShowShopStatsPage(true);
                  setShowGestionBoutique(false);
                }}
                style={{
                  padding: '20px 30px',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '18px',
                  background: 'linear-gradient(135deg, #28a745 0%, #1e7e34 100%)',
                  color: 'white',
                  transition: 'all 0.3s ease',
                  minWidth: '200px'
                }}
              >
                📊 Statistiques CA
              </button>
              <button
                style={{
                  padding: '20px 30px',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '18px',
                  background: 'linear-gradient(135deg, #ffc107 0%, #e0a800 100%)',
                  color: 'white',
                  transition: 'all 0.3s ease',
                  minWidth: '200px'
                }}
              >
                💰 Caisse Enregistreuse
              </button>
            </div>

            {/* Contenu du module sélectionné */}
            <div style={{ minHeight: '300px', textAlign: 'center' }}>
              <h2 style={{ color: '#333', marginBottom: '20px' }}>Sélectionnez un module</h2>
              <p style={{ color: '#666', fontSize: '16px', marginBottom: '30px' }}>
                Choisissez le module que vous souhaitez utiliser :
              </p>
              
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '20px',
                marginBottom: '30px'
              }}>
                <div style={{
                  background: 'linear-gradient(135deg, #007bff 0%, #0056b3 100%)',
                  color: 'white',
                  padding: '25px',
                  borderRadius: '12px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
                onClick={() => setShowShopStatsPage(true)}
                >
                  <h3 style={{ margin: '0 0 15px 0', fontSize: '20px' }}>📅 Statistiques Planning</h3>
                  <p style={{ margin: '0', opacity: '0.9' }}>Analyser les heures et la rentabilité</p>
                </div>

                <div style={{
                  background: 'linear-gradient(135deg, #28a745 0%, #1e7e34 100%)',
                  color: 'white',
                  padding: '25px',
                  borderRadius: '12px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
                onClick={() => {
                  setShowShopStatsPage(true);
                  setShowGestionBoutique(false);
                }}
                >
                  <h3 style={{ margin: '0 0 15px 0', fontSize: '20px' }}>📊 Statistiques CA</h3>
                  <p style={{ margin: '0', opacity: '0.9' }}>Import et gestion des données CA</p>
                </div>

                <div style={{
                  background: 'linear-gradient(135deg, #ffc107 0%, #e0a800 100%)',
                  color: 'white',
                  padding: '25px',
                  borderRadius: '12px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
                >
                  <h3 style={{ margin: '0 0 15px 0', fontSize: '20px' }}>💰 Caisse Enregistreuse</h3>
                  <p style={{ margin: '0', opacity: '0.9' }}>Gestion des ventes et paiements</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}




      <input
        ref={jsonRestoreInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleJsonRestoreFile}
        style={{ display: 'none' }}
      />

    </div>
  );
};

export default PlanningDisplay;
