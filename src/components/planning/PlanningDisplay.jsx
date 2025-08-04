import React, { useState, useEffect, useCallback, useRef } from 'react';
import { format, addDays, startOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import { FaDownload, FaChevronDown, FaChevronUp, FaCog, FaChartBar, FaArrowLeft } from 'react-icons/fa';
import { loadFromLocalStorage, saveToLocalStorage } from '../../utils/localStorage';
import PlanningMenuBar from './PlanningMenuBar';
import DayButtons from './DayButtons';
import PlanningTable from './PlanningTable';
import ResetModal from './ResetModal';
import RecapModal from './RecapModal';
import GlobalDayViewModalV2 from './GlobalDayViewModalV2';
import MonthlyRecapModals from './MonthlyRecapModals';
import MonthlyDetailModal from './MonthlyDetailModal';
import ValidationManager from './ValidationManager';
import Dashboard from '../dashboard/Dashboard';

import EmployeeMonthlyWeeklyModal from './EmployeeMonthlyWeeklyModal';
import EmployeeMonthlyRecapModal from './EmployeeMonthlyRecapModal';
import EmployeeWeeklyRecapModal from './EmployeeWeeklyRecapModal';
import EmployeeMonthlyDetailModal from './EmployeeMonthlyDetailModal';
import CopyPastePage from './CopyPastePage';
import NotesModal from './NotesModal';
import ShopStatsPage from './ShopStatsPage';
import { getShopById, getWeekPlanning, saveWeekPlanning, saveWeekPlanningForEmployee } from '../../utils/planningDataManager';
import { calculateEmployeeDailyHours } from '../../utils/planningUtils';
import { useDeviceDetection } from '../../hooks/useDeviceDetection';
import '@/assets/styles.css';
import '../dashboard/Dashboard.css';

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
  onBackToWeekSelection,
  onBackToConfig,
  setFeedback 
}) => {
  const [currentDay, setCurrentDay] = useState(0);
  const [showGlobalDayViewModalV2, setShowGlobalDayViewModalV2] = useState(false);
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

  // État pour le tableau de bord
  const [showDashboard, setShowDashboard] = useState(false);
  
  // État pour la page copier-coller avancé
  const [showCopyPastePage, setShowCopyPastePage] = useState(false);
  
  // État pour la modale de notes
  const [showNotesModal, setShowNotesModal] = useState(false);
  
  // État pour la page des statistiques de la boutique
  const [showShopStatsPage, setShowShopStatsPage] = useState(false);
  
  // État pour la page de gestion boutique
  const [showGestionBoutique, setShowGestionBoutique] = useState(false);
  
  // État pour afficher/masquer le récapitulatif employé
  const [showEmployeeRecap, setShowEmployeeRecap] = useState(true);
  const [activeMenu, setActiveMenu] = useState(null);

  const [showCalendarTotals, setShowCalendarTotals] = useState(false);
  const [localFeedback, setLocalFeedback] = useState('');
  
  // État local pour les employés sélectionnés
  const [localSelectedEmployees, setLocalSelectedEmployees] = useState(selectedEmployees || []);
  
  // États pour la protection des données validées
  const [validatedData, setValidatedData] = useState({});
  const [showValidationWarning, setShowValidationWarning] = useState(false);
  const [pendingModification, setPendingModification] = useState(null);
  
  // État pour forcer le rafraîchissement de la modale mensuelle
  const [modalForceRefresh, setModalForceRefresh] = useState(0);
  
  // État de validation globale
  const [validationState, setValidationState] = useState({
    isWeekValidated: false,
    validatedEmployees: [],
    lockedEmployees: []
  });

  // État pour le verrouillage automatique
  const [autoLockEnabled, setAutoLockEnabled] = useState(true);
  const [lastModifiedDay, setLastModifiedDay] = useState(null);
  
  // État pour forcer le rafraîchissement
  const [forceRefresh, setForceRefresh] = useState(0);
  


  // États pour les menus et l'import
  const [openMenus, setOpenMenus] = useState({
    retour: false
  });
  const fileInputRef = useRef(null);

  // Détection automatique de l'appareil
  const deviceInfo = useDeviceDetection();

  // Définir validWeek tout au début pour éviter les erreurs d'initialisation
  const validWeek = selectedWeek && !isNaN(new Date(selectedWeek).getTime()) ? selectedWeek : format(new Date(), 'yyyy-MM-dd');

  // Fonction pour calculer le total des heures de la boutique pour le mois
  const calculateShopMonthlyTotal = () => {
    let totalHours = 0;
    const currentDate = new Date(selectedWeek);
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
    
    return totalHours.toFixed(1);
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
    onImport();
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
    onExport();
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
    console.warn('Configuration des tranches horaires invalide, utilisation de la configuration par défaut:', { 
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
      console.warn('Aucune tranche horaire valide trouvée, utilisation de la configuration par défaut');
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
  
  // État pour les employés de la boutique actuelle
  const [currentShopEmployees, setCurrentShopEmployees] = useState([]);
  
  // État pour tous les employés de toutes les boutiques
  const [allEmployees, setAllEmployees] = useState([]);

  // Récupérer le planning de la semaine actuelle
  const weekData = selectedShop && selectedWeek ? getWeekPlanning(planningData, selectedShop, selectedWeek) : { planning: {}, selectedEmployees: [] };
  const [planning, setPlanning] = useState(weekData.planning || {});
  
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
    if (selectedShop && selectedWeek && Object.keys(planning).length > 0) {
      try {
        const updatedPlanningData = saveWeekPlanning(planningData, selectedShop, selectedWeek, planning, localSelectedEmployees);
        setPlanningData(updatedPlanningData);
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
  }, [currentDay, lastModifiedDay, autoLockPreviousDay, selectedShop, selectedWeek, planning, planningData, localSelectedEmployees, setPlanningData]);

  // Mettre à jour les employés sélectionnés globalement
  useEffect(() => {
    setSelectedEmployees(localSelectedEmployees);
  }, [localSelectedEmployees, setSelectedEmployees]);

  // Mettre à jour localSelectedEmployees quand selectedEmployees change (pour la première initialisation)
  useEffect(() => {
    if (selectedEmployees && selectedEmployees.length > 0) {
      setLocalSelectedEmployees(selectedEmployees);
    }
  }, [selectedEmployees]);
  
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
    const date = new Date(dateString);
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
    
    if (selectedShop && selectedWeek) {
      // 1. Récupérer les données de la boutique actuelle (recalculer à chaque changement)
      const currentShopData = getShopById(planningData, selectedShop);
      const allShopEmployees = currentShopData?.employees || [];
      
      // Valider et nettoyer les employés
      const validShopEmployees = allShopEmployees
        .filter(emp => emp && typeof emp === 'object' && emp.id && emp.name)
        .map(emp => ({
          id: String(emp.id),
          name: String(emp.name),
          canWorkIn: Array.isArray(emp.canWorkIn) ? emp.canWorkIn.map(String) : [],
          ...(emp.color && { color: String(emp.color) }),
          ...(emp.role && { role: String(emp.role) })
        }));
      
      // Mettre à jour tous les employés de toutes les boutiques
      setAllEmployees(validShopEmployees);
      
      // Filtrer les employés qui peuvent travailler dans cette boutique
      const shopEmployees = validShopEmployees.filter(emp => 
        emp.canWorkIn && emp.canWorkIn.includes(selectedShop)
      );
      
      const currentShopEmployeeIds = shopEmployees.map(emp => emp.id);
      
      // Mettre à jour les employés de la boutique actuelle
      setCurrentShopEmployees(shopEmployees);
      
      // 2. Récupérer le planning existant pour cette boutique/semaine
      console.log('🔍 Appel getWeekPlanning avec:', { selectedShop, selectedWeek, planningData });
      const weekData = getWeekPlanning(planningData, selectedShop, selectedWeek);
      console.log('🔍 Résultat getWeekPlanning:', weekData);
      
      // Charger le planning depuis les données sauvegardées
      setPlanning(weekData.planning || {});
      console.log('📥 Planning chargé depuis les données sauvegardées:', weekData.planning);
      
      // 3. Gérer les employés sélectionnés
      if (weekData.selectedEmployees && weekData.selectedEmployees.length > 0) {
        // Si des employés étaient sauvegardés pour cette semaine, les filtrer pour la boutique actuelle
        const validEmployees = weekData.selectedEmployees.filter(empId => currentShopEmployeeIds.includes(empId));
        setLocalSelectedEmployees(validEmployees);
        setSelectedEmployees(validEmployees);
      } else {
        // Si aucun employé n'était sauvegardé, sélectionner tous les employés de la boutique
        if (currentShopEmployeeIds.length > 0) {
          setLocalSelectedEmployees(currentShopEmployeeIds);
          setSelectedEmployees(currentShopEmployeeIds);
        } else {
          setLocalSelectedEmployees([]);
          setSelectedEmployees([]);
        }
      }
    }
  }, [selectedShop, selectedWeek, planningData, forceRefresh]);

  const toggleSlot = useCallback((employee, slotIndex, dayIndex, forceValue = null) => {
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
      
      // SAUVEGARDE AUTOMATIQUE IMMÉDIATE (DÉSACTIVÉE TEMPORAIREMENT POUR ÉVITER LES CONFLITS)
      // if (selectedShop && selectedWeek) {
      //   try {
      //     const updatedPlanningData = saveWeekPlanning(planningData, selectedShop, selectedWeek, updatedPlanning, localSelectedEmployees);
      //     setPlanningData(updatedPlanningData);
      //     console.log('💾 Sauvegarde automatique après modification');
      //   } catch (error) {
      //     console.error('Erreur lors de la sauvegarde automatique:', error);
      //   }
      // }
      
      return updatedPlanning;
    });
  }, [config, mondayOfWeek, validatedData, validationState.lockedEmployees, lastModifiedDay]);

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
  const handleManualSave = useCallback(() => {
    if (selectedShop && selectedWeek) {
      const updatedPlanningData = saveWeekPlanning(planningData, selectedShop, selectedWeek, planning, localSelectedEmployees);
      setPlanningData(updatedPlanningData);
      saveToLocalStorage('planningData', updatedPlanningData);
      setLocalFeedback('💾 Planning sauvegardé manuellement');
    }
  }, [planning, localSelectedEmployees, selectedShop, selectedWeek, planningData, setPlanningData]);

  const changeWeek = (direction) => {
    const currentDate = new Date(validWeek);
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
    setSelectedWeek(weekDate);
    
    // Réinitialiser le jour modifié
    setLastModifiedDay(null);
  };

  const changeShop = (newShop) => {
    try {
      // Sauvegarder le planning actuel avant de changer de boutique
      if (selectedShop && selectedWeek && Object.keys(planning).length > 0) {
        console.log('Sauvegarde avant changement de boutique:', { selectedShop, selectedWeek, planning, localSelectedEmployees });
        let updatedPlanningData = planningData;
        // Sauvegarder pour tous les employés multi-boutiques
        localSelectedEmployees.forEach(employeeId => {
          updatedPlanningData = saveWeekPlanningForEmployee(
            updatedPlanningData,
            employeeId,
            selectedWeek,
            planning,
            localSelectedEmployees,
            selectedShop // on sauvegarde dans la boutique qu'on quitte
          );
        });
        setPlanningData(updatedPlanningData);
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
    try {
    if (resetType === 'all') {
        // Effacer tous les clics de la semaine
        const emptyPlanning = {};
        const updatedPlanningData = saveWeekPlanning(
          planningData,
          selectedShop,
          selectedWeek,
          emptyPlanning,
          []
        );
        setPlanningData(updatedPlanningData);
        setPlanning(emptyPlanning);
        setLocalSelectedEmployees([]);
        setFeedback('✅ Tous les clics de la semaine ont été effacés');
    } else if (resetType === 'employee' && employeeName) {
      // Effacer les clics d'un employé spécifique
        const currentWeekData = getWeekPlanning(planningData, selectedShop, selectedWeek);
        const newPlanning = { ...currentWeekData.planning };
        
      // Supprimer toutes les entrées pour cet employé
        if (newPlanning[employeeName]) {
          delete newPlanning[employeeName];
        }
        
        const updatedPlanningData = saveWeekPlanning(
          planningData,
          selectedShop,
          selectedWeek,
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
          selectedWeek,
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
          selectedWeek,
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

  // Fonction pour copier les données d'une semaine vers la semaine suivante (version corrigée)
  const copyWeekToNextWeek = useCallback(() => {
    try {
      console.log('🔄 Début de la copie de semaine vers la semaine suivante');
      
      // Semaine source : 28/07 au 3/08 (2025-07-28)
      const sourceWeek = '2025-07-28';
      // Semaine destination : 4/08 au 10/08 (2025-08-04)
      const destinationWeek = '2025-08-04';
      
      // VÉRIFIER SI LA SEMAINE DESTINATION CONTIENT DÉJÀ DES DONNÉES
      const destinationWeekData = planningData?.shops?.find(shop => shop.id === selectedShop)?.weeks?.[destinationWeek];
      const existingDestinationPlanning = destinationWeekData?.planning || {};
      
      // Compter les cliques existants dans la semaine destination
      let existingClicksCount = 0;
      Object.keys(existingDestinationPlanning).forEach(empId => {
        Object.keys(existingDestinationPlanning[empId]).forEach(dayKey => {
          const daySlots = existingDestinationPlanning[empId][dayKey];
          if (daySlots && Array.isArray(daySlots)) {
            existingClicksCount += daySlots.filter(slot => slot === true).length;
          }
        });
      });
      
      console.log(`🔍 Semaine destination (${destinationWeek}) contient ${existingClicksCount} cliques existants`);
      
      // Si la semaine destination contient des données, demander confirmation
      if (existingClicksCount > 0) {
        const confirmMessage = `⚠️ La semaine du 4/08 au 10/08 contient déjà ${existingClicksCount} cliques.\n\nVoulez-vous vraiment écraser ces données ?\n\nCette action ne peut pas être annulée.`;
        
        if (!window.confirm(confirmMessage)) {
          console.log('❌ Copie annulée par l\'utilisateur');
          setLocalFeedback('❌ Copie annulée. Les données existantes sont préservées.');
        return;
      }
      
        console.log('✅ Utilisateur a confirmé l\'écrasement des données existantes');
      }
      
      // Récupérer les données de la semaine source depuis planningData
      const sourceWeekData = planningData?.shops?.find(shop => shop.id === selectedShop)?.weeks?.[sourceWeek];
      const sourcePlanning = sourceWeekData?.planning || {};
      const sourceSelectedEmployees = sourceWeekData?.selectedEmployees || [];
      
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
        setLocalFeedback('⚠️ Aucun planning à copier. Assurez-vous d\'avoir des cliques sur la semaine du 28/07 au 3/08.');
        return;
      }
      
      // TRANSFORMATION DES CLÉS DE DATES : Créer un nouveau planning avec les clés de la semaine destination
      const transformedPlanning = {};
      
      // Générer les dates de la semaine destination (4/08 au 10/08)
      const destinationDates = [];
      const startDate = new Date(destinationWeek);
      for (let i = 0; i < 7; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        destinationDates.push(date.toISOString().split('T')[0]);
      }
      
      // Générer les dates de la semaine source (28/07 au 3/08)
      const sourceDates = [];
      const sourceStartDate = new Date(sourceWeek);
      for (let i = 0; i < 7; i++) {
        const date = new Date(sourceStartDate);
        date.setDate(sourceStartDate.getDate() + i);
        sourceDates.push(date.toISOString().split('T')[0]);
      }
      
      console.log('📅 Dates source:', sourceDates);
      console.log('📅 Dates destination:', destinationDates);
      
      // Transformer le planning en remplaçant les clés de dates
      Object.keys(sourcePlanning).forEach(empId => {
        transformedPlanning[empId] = {};
        
        // Copier les données de chaque jour en transformant les clés
        sourceDates.forEach((sourceDate, index) => {
          const destinationDate = destinationDates[index];
          if (sourcePlanning[empId][sourceDate]) {
            transformedPlanning[empId][destinationDate] = [...sourcePlanning[empId][sourceDate]];
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
        
        setLocalFeedback(`✅ Planning copié vers la semaine du 4/08 au 10/08. Navigation automatique en cours...`);
      } else {
        console.log('❌ Échec de la copie - données non trouvées dans localStorage');
        setLocalFeedback('❌ Échec de la copie. Veuillez réessayer.');
      }
      
    } catch (error) {
      console.error('❌ Erreur lors de la copie:', error);
      setLocalFeedback('❌ Erreur lors de la copie des données');
    }
  }, [selectedShop, setSelectedWeek, planningData, setPlanningData]);

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
        selectedWeek={selectedWeek}
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
      overflow: 'auto',
      maxWidth: '100vw',
      margin: '0 auto'
    }}>
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
        marginBottom: deviceInfo.isTablet ? '30px' : '25px',
        padding: deviceInfo.isTablet ? '30px 25px' : '25px 20px',
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
          fontSize: deviceInfo.isTablet ? '32px' : '28px',
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
          fontSize: deviceInfo.isTablet ? '26px' : '22px',
          color: '#ffffff',
          margin: '12px 0 0 0',
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

      {/* Menu Actions - Juste après le titre */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: deviceInfo.isTablet ? '15px' : '12px',
        flexWrap: 'nowrap',
        padding: deviceInfo.isTablet ? '20px 25px' : '15px 20px',
        background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
        borderRadius: deviceInfo.isTablet ? '24px' : '20px',
        border: '2px solid #dee2e6',
        marginBottom: deviceInfo.isTablet ? '30px' : '25px',
        width: '100%',
        boxSizing: 'border-box',
        boxShadow: '0 6px 24px rgba(0,0,0,0.1)',
        overflowX: 'auto'
      }}>
        <button
          onClick={() => setShowGlobalDayViewModalV2(true)}
          style={{
            background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
            color: 'white',
            padding: deviceInfo.isTablet ? '12px 20px' : '10px 16px',
            fontSize: deviceInfo.isTablet ? '14px' : '12px',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            fontWeight: '600',
            transition: 'all 0.3s ease',
            boxShadow: '0 4px 12px rgba(25, 118, 210, 0.4)',
            whiteSpace: 'nowrap',
            minHeight: deviceInfo.isTablet ? '45px' : '38px',
            minWidth: deviceInfo.isTablet ? '120px' : '100px',
            letterSpacing: '0.5px',
            textShadow: '0 2px 4px rgba(0,0,0,0.3)',
            position: 'relative',
            overflow: 'hidden'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #1565c0 0%, #0d47a1 100%)';
            e.currentTarget.style.transform = 'translateY(-4px) scale(1.03)';
            e.currentTarget.style.boxShadow = '0 10px 24px rgba(25, 118, 210, 0.6)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)';
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(25, 118, 210, 0.4)';
          }}
        >
          📊 Vue Jour
        </button>
        
        <button
          onClick={() => setShowDashboard(true)}
          style={{
            background: 'linear-gradient(135deg, #7b1fa2 0%, #4a148c 100%)',
            color: 'white',
            padding: deviceInfo.isTablet ? '12px 20px' : '10px 16px',
            fontSize: deviceInfo.isTablet ? '14px' : '12px',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            fontWeight: '600',
            transition: 'all 0.3s ease',
            boxShadow: '0 4px 12px rgba(123, 31, 162, 0.4)',
            whiteSpace: 'nowrap',
            minHeight: deviceInfo.isTablet ? '45px' : '38px',
            minWidth: deviceInfo.isTablet ? '120px' : '100px',
            letterSpacing: '0.5px',
            textShadow: '0 2px 4px rgba(0,0,0,0.3)',
            position: 'relative',
            overflow: 'hidden'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #4a148c 0%, #311b92 100%)';
            e.currentTarget.style.transform = 'translateY(-4px) scale(1.03)';
            e.currentTarget.style.boxShadow = '0 10px 24px rgba(123, 31, 162, 0.6)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #7b1fa2 0%, #4a148c 100%)';
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(123, 31, 162, 0.4)';
          }}
        >
          📈 Dashboard
        </button>
        
        <button
          onClick={() => {
            console.log('🚨🚨🚨 PlanningDisplay: SHOP STATS BUTTON CLICKED 🚨🚨🚨');
            setShowShopStatsPage(true);
            console.log('🚨🚨🚨 PlanningDisplay: showShopStatsPage set to true 🚨🚨🚨');
          }}
          style={{
            background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)',
            color: 'white',
            padding: deviceInfo.isTablet ? '12px 20px' : '10px 16px',
            fontSize: deviceInfo.isTablet ? '14px' : '12px',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            fontWeight: '600',
            transition: 'all 0.3s ease',
            boxShadow: '0 4px 12px rgba(255, 152, 0, 0.4)',
            whiteSpace: 'nowrap',
            minHeight: deviceInfo.isTablet ? '45px' : '38px',
            minWidth: deviceInfo.isTablet ? '120px' : '100px',
            letterSpacing: '0.5px',
            textShadow: '0 2px 4px rgba(0,0,0,0.3)',
            position: 'relative',
            overflow: 'hidden'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #f57c00 0%, #e65100 100%)';
            e.currentTarget.style.transform = 'translateY(-4px) scale(1.03)';
            e.currentTarget.style.boxShadow = '0 10px 24px rgba(255, 152, 0, 0.6)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)';
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(255, 152, 0, 0.4)';
          }}
        >
          📊 Statistiques Boutique
        </button>
        
        <button
          onClick={() => setShowGestionBoutique(true)}
          style={{
            background: 'linear-gradient(135deg, #28a745 0%, #1e7e34 100%)',
            color: 'white',
            padding: deviceInfo.isTablet ? '12px 20px' : '10px 16px',
            fontSize: deviceInfo.isTablet ? '14px' : '12px',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            fontWeight: '600',
            transition: 'all 0.3s ease',
            boxShadow: '0 4px 12px rgba(40, 167, 69, 0.4)',
            whiteSpace: 'nowrap',
            minHeight: deviceInfo.isTablet ? '45px' : '38px',
            minWidth: deviceInfo.isTablet ? '120px' : '100px',
            letterSpacing: '0.5px',
            textShadow: '0 2px 4px rgba(0,0,0,0.3)',
            position: 'relative',
            overflow: 'hidden'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #1e7e34 0%, #155724 100%)';
            e.currentTarget.style.transform = 'translateY(-4px) scale(1.03)';
            e.currentTarget.style.boxShadow = '0 10px 24px rgba(40, 167, 69, 0.6)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #28a745 0%, #1e7e34 100%)';
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(40, 167, 69, 0.4)';
          }}
        >
          🏪 Gestion Boutique
        </button>
        
        <button
          onClick={handleExport}
          style={{
            background: 'linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%)',
            color: 'white',
            padding: deviceInfo.isTablet ? '12px 20px' : '10px 16px',
            fontSize: deviceInfo.isTablet ? '14px' : '12px',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            fontWeight: '600',
            transition: 'all 0.3s ease',
            boxShadow: '0 4px 12px rgba(46, 125, 50, 0.4)',
            whiteSpace: 'nowrap',
            minHeight: deviceInfo.isTablet ? '45px' : '38px',
            minWidth: deviceInfo.isTablet ? '120px' : '100px',
            letterSpacing: '0.5px',
            textShadow: '0 2px 4px rgba(0,0,0,0.3)',
            position: 'relative',
            overflow: 'hidden'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #1b5e20 0%, #0d4f1c 100%)';
            e.currentTarget.style.transform = 'translateY(-4px) scale(1.03)';
            e.currentTarget.style.boxShadow = '0 10px 24px rgba(46, 125, 50, 0.6)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%)';
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(46, 125, 50, 0.4)';
          }}
        >
          ⬇️ Exporter
        </button>
        
        <button
          onClick={handleImportClick}
          style={{
            background: 'linear-gradient(135deg, #f57c00 0%, #e65100 100%)',
            color: 'white',
            padding: deviceInfo.isTablet ? '12px 20px' : '10px 16px',
            fontSize: deviceInfo.isTablet ? '14px' : '12px',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            fontWeight: '600',
            transition: 'all 0.3s ease',
            boxShadow: '0 4px 12px rgba(245, 124, 0, 0.4)',
            whiteSpace: 'nowrap',
            minHeight: deviceInfo.isTablet ? '45px' : '38px',
            minWidth: deviceInfo.isTablet ? '120px' : '100px',
            letterSpacing: '0.5px',
            textShadow: '0 2px 4px rgba(0,0,0,0.3)',
            position: 'relative',
            overflow: 'hidden'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #e65100 0%, #bf360c 100%)';
            e.currentTarget.style.transform = 'translateY(-4px) scale(1.03)';
            e.currentTarget.style.boxShadow = '0 10px 24px rgba(245, 124, 0, 0.6)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #f57c00 0%, #e65100 100%)';
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(245, 124, 0, 0.4)';
          }}
        >
          📥 Importer
        </button>
        
        <button
          onClick={() => setShowCopyPastePage(true)}
          style={{
            background: 'linear-gradient(135deg, #17a2b8 0%, #138496 100%)',
            color: 'white',
            padding: deviceInfo.isTablet ? '12px 20px' : '10px 16px',
            fontSize: deviceInfo.isTablet ? '14px' : '12px',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            fontWeight: '600',
            transition: 'all 0.3s ease',
            boxShadow: '0 4px 12px rgba(23, 162, 184, 0.4)',
            whiteSpace: 'nowrap',
            minHeight: deviceInfo.isTablet ? '45px' : '38px',
            minWidth: deviceInfo.isTablet ? '120px' : '100px',
            letterSpacing: '0.5px',
            textShadow: '0 2px 4px rgba(0,0,0,0.3)',
            position: 'relative',
            overflow: 'hidden'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #138496 0%, #0f6674 100%)';
            e.currentTarget.style.transform = 'translateY(-4px) scale(1.03)';
            e.currentTarget.style.boxShadow = '0 10px 24px rgba(23, 162, 184, 0.6)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #17a2b8 0%, #138496 100%)';
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(23, 162, 184, 0.4)';
          }}
        >
          📋 Copier-Coller
        </button>
        
        <button
          onClick={() => setShowNotesModal(true)}
          style={{
            background: 'linear-gradient(135deg, #ffc107 0%, #e0a800 100%)',
            color: 'white',
            padding: deviceInfo.isTablet ? '12px 20px' : '10px 16px',
            fontSize: deviceInfo.isTablet ? '14px' : '12px',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            fontWeight: '600',
            transition: 'all 0.3s ease',
            boxShadow: '0 4px 12px rgba(255, 193, 7, 0.4)',
            whiteSpace: 'nowrap',
            minHeight: deviceInfo.isTablet ? '45px' : '38px',
            minWidth: deviceInfo.isTablet ? '120px' : '100px',
            letterSpacing: '0.5px',
            textShadow: '0 2px 4px rgba(0,0,0,0.3)',
            position: 'relative',
            overflow: 'hidden'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #e0a800 0%, #b8860b 100%)';
            e.currentTarget.style.transform = 'translateY(-4px) scale(1.03)';
            e.currentTarget.style.boxShadow = '0 10px 24px rgba(255, 193, 7, 0.6)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #ffc107 0%, #e0a800 100%)';
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(255, 193, 7, 0.4)';
          }}
        >
          📝 Notes
        </button>
        
        <button
          onClick={() => setShowResetModal(true)}
          style={{
            background: 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)',
            color: 'white',
            padding: deviceInfo.isTablet ? '12px 20px' : '10px 16px',
            fontSize: deviceInfo.isTablet ? '14px' : '12px',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            fontWeight: '600',
            transition: 'all 0.3s ease',
            boxShadow: '0 4px 12px rgba(220, 53, 69, 0.4)',
            whiteSpace: 'nowrap',
            minHeight: deviceInfo.isTablet ? '45px' : '38px',
            minWidth: deviceInfo.isTablet ? '120px' : '100px',
            letterSpacing: '0.5px',
            textShadow: '0 2px 4px rgba(0,0,0,0.3)',
            position: 'relative',
            overflow: 'hidden'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #c82333 0%, #a71e2a 100%)';
            e.currentTarget.style.transform = 'translateY(-4px) scale(1.03)';
            e.currentTarget.style.boxShadow = '0 10px 24px rgba(220, 53, 69, 0.6)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)';
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(220, 53, 69, 0.4)';
          }}
        >
          🗑️ Effacer
        </button>
        
        <button
          onClick={() => toggleMenu('retour')}
          style={{
            background: 'linear-gradient(135deg, #6c757d 0%, #495057 100%)',
            color: 'white',
            padding: deviceInfo.isTablet ? '12px 20px' : '10px 16px',
            fontSize: deviceInfo.isTablet ? '14px' : '12px',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            fontWeight: '600',
            transition: 'all 0.3s ease',
            boxShadow: '0 4px 12px rgba(108, 117, 125, 0.4)',
            whiteSpace: 'nowrap',
            minHeight: deviceInfo.isTablet ? '45px' : '38px',
            minWidth: deviceInfo.isTablet ? '120px' : '100px',
            letterSpacing: '0.5px',
            textShadow: '0 2px 4px rgba(0,0,0,0.3)',
            position: 'relative',
            overflow: 'hidden'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #495057 0%, #343a40 100%)';
            e.currentTarget.style.transform = 'translateY(-4px) scale(1.03)';
            e.currentTarget.style.boxShadow = '0 10px 24px rgba(108, 117, 125, 0.6)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #6c757d 0%, #495057 100%)';
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(108, 117, 125, 0.4)';
          }}
        >
          ⬅️ Retour
        </button>
      </div>

      {/* Menu déroulant Retour */}
      {openMenus.retour && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: '#fff',
          border: '2px solid #dee2e6',
          borderRadius: '8px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          zIndex: 1000,
          minWidth: '250px',
          padding: '10px 0'
        }}>
          <button
            onClick={onBackToStartup}
            style={{
              width: '100%',
              padding: '12px 16px',
              border: 'none',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              textAlign: 'left',
              fontSize: '14px',
              transition: 'background-color 0.2s ease'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            🏠 Écran de démarrage
          </button>
          <button
            onClick={onBackToConfig}
            style={{
              width: '100%',
              padding: '12px 16px',
              border: 'none',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              textAlign: 'left',
              fontSize: '14px',
              transition: 'background-color 0.2s ease'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            ⚙️ Configuration boutiques
          </button>
          <button
            onClick={onBackToEmployees}
            style={{
              width: '100%',
              padding: '12px 16px',
              border: 'none',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              textAlign: 'left',
              fontSize: '14px',
              transition: 'background-color 0.2s ease'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            👥 Gestion employés
          </button>
          <button
            onClick={onBackToShopSelection}
            style={{
              width: '100%',
              padding: '12px 16px',
              border: 'none',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              textAlign: 'left',
              fontSize: '14px',
              transition: 'background-color 0.2s ease'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            🏪 Sélection boutique
          </button>
          <button
            onClick={onBackToWeekSelection}
            style={{
              width: '100%',
              padding: '12px 16px',
              border: 'none',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              textAlign: 'left',
              fontSize: '14px',
              transition: 'background-color 0.2s ease'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            📅 Sélection semaine
          </button>
        </div>
      )}

      {/* Récapitulatifs des Employés - Juste après le titre de la semaine */}
      <div style={{ 
        fontSize: deviceInfo.isTablet ? '20px' : '18px', 
        fontWeight: '800', 
        color: '#2c3e50',
        marginBottom: '15px',
        width: '100%',
        textAlign: 'center',
        padding: '12px 20px',
        background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
        borderRadius: '12px',
        border: '2px solid #dee2e6',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        textTransform: 'uppercase',
        letterSpacing: '1px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span>📊 Récapitulatifs Employés</span>
        <button
          onClick={() => setShowEmployeeRecap(!showEmployeeRecap)}
          style={{
            backgroundColor: showEmployeeRecap ? '#ff9800' : '#4caf50',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            padding: '8px 16px',
            fontSize: '14px',
            cursor: 'pointer',
            fontWeight: 'bold',
            transition: 'all 0.2s ease',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            textTransform: 'none',
            letterSpacing: 'normal'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 3px 6px rgba(0,0,0,0.3)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
          }}
          title={showEmployeeRecap ? 'Masquer le récapitulatif employé' : 'Afficher le récapitulatif employé'}
        >
          {showEmployeeRecap ? '👁️ Masquer' : '👁️ Afficher'}
        </button>
      </div>
      
      {showEmployeeRecap && localSelectedEmployees && localSelectedEmployees.length > 0 && (
        <>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            gap: '12px', 
            flexWrap: 'nowrap',
            padding: '20px',
            background: 'linear-gradient(135deg, #fff5f5 0%, #fed7d7 100%)',
            borderRadius: '16px',
            border: '2px solid #fed7d7',
            marginBottom: '20px',
            width: '100%',
            boxSizing: 'border-box',
            overflowX: 'auto',
            boxShadow: '0 4px 20px rgba(254, 215, 215, 0.3)'
          }}>
            {localSelectedEmployees.map((employeeId) => {
              const employee = currentShopEmployees?.find(emp => emp.id === employeeId);
              const employeeName = employee?.name || employeeId;
              
              return (
                <div key={employeeId} style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  padding: '22px 24px',
                  background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                  borderRadius: '16px',
                  border: '2px solid #e3f2fd',
                  minWidth: '220px',
                  maxWidth: '260px',
                  textAlign: 'center',
                  boxShadow: '0 6px 24px rgba(0,0,0,0.12)',
                  flex: '0 0 auto',
                  transition: 'all 0.3s ease',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  <div style={{ 
                    fontSize: deviceInfo.isTablet ? '18px' : '16px', 
                    fontWeight: '800',
                    color: '#1a237e',
                    marginBottom: '10px',
                    padding: '12px 16px',
                    background: 'linear-gradient(135deg, #e8f4fd 0%, #bbdefb 100%)',
                    borderRadius: '12px',
                    border: '2px solid #2196f3',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    boxShadow: '0 4px 12px rgba(33, 150, 243, 0.3)',
                    textShadow: '0 1px 2px rgba(0,0,0,0.1)',
                    letterSpacing: '0.5px'
                  }}>
                    👤 {employeeName}
                  </div>
                  
                  <button
                    onClick={() => setShowRecapModal(employeeId)}
                    style={{
                      backgroundColor: '#1976d2',
                      color: 'white',
                      padding: deviceInfo.isTablet ? '14px 18px' : '12px 16px',
                      fontSize: deviceInfo.isTablet ? '15px' : '13px',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      marginBottom: '6px',
                      fontWeight: '600',
                      transition: 'all 0.3s ease',
                      boxShadow: '0 3px 8px rgba(25, 118, 210, 0.3)',
                      whiteSpace: 'nowrap',
                      minHeight: deviceInfo.isTablet ? '48px' : '40px',
                      letterSpacing: '0.5px'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = '#1565c0';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 6px 16px rgba(25, 118, 210, 0.4)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = '#1976d2';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 3px 8px rgba(25, 118, 210, 0.3)';
                    }}
                    title="Récapitulatif journalier"
                  >
                    📅 Jour: {(() => {
          if (!selectedWeek || !selectedShop || !planning) return '0.0';
          const dayKey = format(addDays(new Date(selectedWeek), currentDay || 0), 'yyyy-MM-dd');
          const hours = calculateEmployeeDailyHours(employeeId, dayKey, planning, config);
          return hours.toFixed(1);
                    })()}h
                  </button>
                  
                  <button
                    onClick={() => {
                      setSelectedEmployeeForWeeklyRecap(employeeId);
                      setShowEmployeeWeeklyRecap(true);
                    }}
                    style={{
                      backgroundColor: '#2e7d32',
                      color: 'white',
                      padding: deviceInfo.isTablet ? '14px 18px' : '12px 16px',
                      fontSize: deviceInfo.isTablet ? '15px' : '13px',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      marginBottom: '6px',
                      fontWeight: '600',
                      transition: 'all 0.3s ease',
                      boxShadow: '0 3px 8px rgba(46, 125, 50, 0.3)',
                      whiteSpace: 'nowrap',
                      minHeight: deviceInfo.isTablet ? '48px' : '40px',
                      letterSpacing: '0.5px'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = '#1b5e20';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 6px 16px rgba(46, 125, 50, 0.4)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = '#2e7d32';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 3px 8px rgba(46, 125, 50, 0.3)';
                    }}
                    title="Récapitulatif hebdomadaire"
                  >
                    📊 Semaine: {(() => {
          if (!selectedWeek || !selectedShop || !planning) return '0.0';
          let totalHours = 0;
          for (let i = 0; i < 7; i++) {
            const dayKey = format(addDays(new Date(selectedWeek), i), 'yyyy-MM-dd');
            const hours = calculateEmployeeDailyHours(employeeId, dayKey, planning, config);
            totalHours += hours;
          }
          return totalHours.toFixed(1);
                    })()}h
                  </button>
                  
                  {(() => {
                    // FORCER l'affichage des boutons séparés pour VALOU et ANGELIQUE
                    if (employeeName === 'VALOU' || employeeName === 'ANGELIQUE') {
                      console.log(`FORCING SEPARATE BUTTONS FOR ${employeeName} (ID: ${employeeId})`);
                      
                      // Calculer les heures pour chaque boutique
                      const allShops = planningData?.shops || [];
                      const shopsWithHours = [];
                      
                      allShops.forEach(shop => {
                        let shopHours = 0;
                        
                        // Calculer les heures du mois pour cette boutique
                        if (selectedWeek && planningData) {
                          const currentDate = new Date(selectedWeek);
                          const year = currentDate.getFullYear();
                          const month = currentDate.getMonth();
                          const firstDayOfMonth = new Date(year, month, 1);
                          const lastDayOfMonth = new Date(year, month + 1, 0);
                          
                          // Parcourir tous les jours du mois
                          for (let day = 1; day <= lastDayOfMonth.getDate(); day++) {
                            const dayKey = format(new Date(year, month, day), 'yyyy-MM-dd');
                            
                            // Calculer les heures pour cette boutique spécifique
                            if (shop.weeks) {
                              Object.keys(shop.weeks).forEach(weekKey => {
                                const weekData = shop.weeks[weekKey];
                                if (weekData.planning && weekData.planning[employeeId] && weekData.planning[employeeId][dayKey]) {
                                  const slots = weekData.planning[employeeId][dayKey];
                                  if (Array.isArray(slots) && slots.some(slot => slot === true)) {
                                    const hours = calculateEmployeeDailyHours(employeeId, dayKey, { [employeeId]: { [dayKey]: slots } }, config);
                                    shopHours += hours;
                                  }
                                }
                              });
                            }
                          }
                        }
                        
                        if (shopHours > 0) {
                          shopsWithHours.push({
                            id: shop.id,
                            name: shop.name,
                            hours: shopHours
                          });
                        }
                      });
                      
                      console.log(`Shops with hours for ${employeeName}:`, shopsWithHours);
                      
                      if (shopsWithHours.length > 1) {
                        return (
                          <div style={{ width: '100%' }}>
                            {shopsWithHours.map((shop, shopIndex) => (
                  <button
                                key={shop.id}
                    onClick={() => {
                                  console.log('Bouton MOIS RÉEL cliqué pour employé:', employeeName, 'Boutique:', shop.name, 'Heures:', shop.hours);
                                  setSelectedEmployeeForMonthlyRecap(employeeId);
                                  setShowEmployeeMonthlyRecap(true);
                                }}
                                style={{
                                  backgroundColor: '#1e88e5',
                                  color: '#fff',
                                  padding: deviceInfo.isTablet ? '10px 14px' : '8px 12px',
                                  fontSize: deviceInfo.isTablet ? '13px' : '11px',
                                  border: 'none',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  marginBottom: shopIndex < shopsWithHours.length - 1 ? '4px' : '6px',
                                  fontWeight: '600',
                                  transition: 'all 0.3s ease',
                                  boxShadow: '0 2px 6px rgba(30, 136, 229, 0.3)',
                                  whiteSpace: 'nowrap',
                                  width: '100%',
                                  letterSpacing: '0.5px'
                                }}
                                onMouseOver={(e) => {
                                  e.currentTarget.style.backgroundColor = '#1565c0';
                                  e.currentTarget.style.transform = 'translateY(-1px)';
                                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(30, 136, 229, 0.4)';
                                }}
                                onMouseOut={(e) => {
                                  e.currentTarget.style.backgroundColor = '#1e88e5';
                                  e.currentTarget.style.transform = 'translateY(0)';
                                  e.currentTarget.style.boxShadow = '0 2px 6px rgba(30, 136, 229, 0.3)';
                                }}
                                title={`Récapitulatif mensuel - ${shop.name}`}
                              >
                                📈 {shop.name}: {shop.hours.toFixed(1)}h
                              </button>
                            ))}
                            {/* Bouton total global séparé */}
                            <button
                              onClick={() => {
                                console.log('Bouton MOIS RÉEL TOTAL GLOBAL cliqué pour employé:', employeeName);
                                setSelectedEmployeeForMonthlyRecap(employeeId);
                                setShowEmployeeMonthlyRecap(true);
                              }}
                              style={{
                                backgroundColor: '#28a745',
                                color: '#fff',
                                padding: deviceInfo.isTablet ? '10px 14px' : '8px 12px',
                                fontSize: deviceInfo.isTablet ? '13px' : '11px',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                marginTop: '4px',
                                fontWeight: '600',
                                transition: 'all 0.3s ease',
                                boxShadow: '0 2px 6px rgba(40, 167, 69, 0.3)',
                                whiteSpace: 'nowrap',
                                width: '100%',
                                letterSpacing: '0.5px'
                              }}
                              onMouseOver={(e) => {
                                e.currentTarget.style.backgroundColor = '#218838';
                                e.currentTarget.style.transform = 'translateY(-1px)';
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(40, 167, 69, 0.4)';
                              }}
                              onMouseOut={(e) => {
                                e.currentTarget.style.backgroundColor = '#28a745';
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 2px 6px rgba(40, 167, 69, 0.3)';
                              }}
                              title="Récapitulatif mensuel global"
                            >
                              📈 TOTAL GLOBAL: {(() => {
                                if (!selectedWeek || !planningData) return '0.0';
                                
                                // Calculer les heures du mois complet sur toutes les boutiques
                                const currentDate = new Date(selectedWeek);
                                const year = currentDate.getFullYear();
                                const month = currentDate.getMonth();
                                
                                // Premier jour du mois
                                const firstDayOfMonth = new Date(year, month, 1);
                                // Dernier jour du mois
                                const lastDayOfMonth = new Date(year, month + 1, 0);
                                
                                let totalHours = 0;
                                
                                // Parcourir tous les jours du mois
                                for (let day = 1; day <= lastDayOfMonth.getDate(); day++) {
                                  const dayKey = format(new Date(year, month, day), 'yyyy-MM-dd');
                                  
                                  // Calculer les heures pour toutes les boutiques où l'employé travaille
                                  if (planningData.shops) {
                                    planningData.shops.forEach(shop => {
                                      if (shop.weeks) {
                                        Object.keys(shop.weeks).forEach(weekKey => {
                                          const weekData = shop.weeks[weekKey];
                                          if (weekData.planning && weekData.planning[employeeId] && weekData.planning[employeeId][dayKey]) {
                                            const slots = weekData.planning[employeeId][dayKey];
                                            if (Array.isArray(slots) && slots.some(slot => slot === true)) {
                                              const hours = calculateEmployeeDailyHours(employeeId, dayKey, { [employeeId]: { [dayKey]: slots } }, config);
                                              totalHours += hours;
                                            }
                                          }
                                        });
                                      }
                                    });
                                  }
                                }
                                
                                return totalHours.toFixed(1);
                              })()}h
                            </button>
                          </div>
                        );
                      }
                    }
                    
                    // Pour tous les autres employés, bouton normal
                    return (
                      <button
                        onClick={() => {
                          console.log('🚨🚨🚨 PlanningDisplay: MOIS BUTTON CLICKED for employee', employeeId, '🚨🚨🚨');
                          setSelectedEmployeeForMonthlyRecap(employeeId);
                          setShowEmployeeMonthlyRecap(true);
                          console.log('🚨🚨🚨 PlanningDisplay: showEmployeeMonthlyRecap set to true 🚨🚨🚨');
                    }}
                    style={{
                      backgroundColor: '#f57c00',
                      color: 'white',
                      padding: deviceInfo.isTablet ? '14px 18px' : '12px 16px',
                      fontSize: deviceInfo.isTablet ? '15px' : '13px',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      marginBottom: '6px',
                      fontWeight: '600',
                      transition: 'all 0.3s ease',
                      boxShadow: '0 3px 8px rgba(245, 124, 0, 0.3)',
                      whiteSpace: 'nowrap',
                      minHeight: deviceInfo.isTablet ? '48px' : '40px',
                      letterSpacing: '0.5px'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = '#e65100';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 6px 16px rgba(245, 124, 0, 0.4)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = '#f57c00';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 3px 8px rgba(245, 124, 0, 0.3)';
                    }}
                    title="Récapitulatif mensuel"
                  >
                    📈 Mois: {(() => {
          if (!selectedWeek || !planningData) return '0.0';
          
          // Calculer les heures du mois complet sur toutes les boutiques
          const currentDate = new Date(selectedWeek);
          const year = currentDate.getFullYear();
          const month = currentDate.getMonth();
          
          // Premier jour du mois
          const firstDayOfMonth = new Date(year, month, 1);
          // Dernier jour du mois
          const lastDayOfMonth = new Date(year, month + 1, 0);
          
          let totalHours = 0;
          
          // Parcourir tous les jours du mois
          for (let day = 1; day <= lastDayOfMonth.getDate(); day++) {
            const dayKey = format(new Date(year, month, day), 'yyyy-MM-dd');
            
            // Calculer les heures pour toutes les boutiques où l'employé travaille
            if (planningData.shops) {
              planningData.shops.forEach(shop => {
                if (shop.weeks) {
                  Object.keys(shop.weeks).forEach(weekKey => {
                    const weekData = shop.weeks[weekKey];
                    if (weekData.planning && weekData.planning[employeeId] && weekData.planning[employeeId][dayKey]) {
                      const slots = weekData.planning[employeeId][dayKey];
                      if (Array.isArray(slots) && slots.some(slot => slot === true)) {
                        const hours = calculateEmployeeDailyHours(employeeId, dayKey, { [employeeId]: { [dayKey]: slots } }, config);
                        totalHours += hours;
                      }
                    }
                  });
                }
              });
            }
          }
          
          return totalHours.toFixed(1);
                    })()}h
                  </button>
                    );
                  })()}
                  
                  <button
                    onClick={() => {
                      setSelectedEmployeeForMonthlyDetail(employeeId);
                      setShowEmployeeMonthlyDetail(true);
                    }}
                    style={{
                      backgroundColor: '#7b1fa2',
                      color: 'white',
                      padding: deviceInfo.isTablet ? '14px 18px' : '12px 16px',
                      fontSize: deviceInfo.isTablet ? '15px' : '13px',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      marginBottom: '6px',
                      fontWeight: '600',
                      transition: 'all 0.3s ease',
                      boxShadow: '0 3px 8px rgba(123, 31, 162, 0.3)',
                      whiteSpace: 'nowrap',
                      minHeight: deviceInfo.isTablet ? '48px' : '40px',
                      letterSpacing: '0.5px'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = '#4a148c';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 6px 16px rgba(123, 31, 162, 0.4)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = '#7b1fa2';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 3px 8px rgba(123, 31, 162, 0.3)';
                    }}
                    title="Détail mensuel complet"
                  >
                    📋 Détail mensuel
                  </button>
                  
                  {/* Boutons de verrouillage/déverrouillage */}
                  <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                    {validationState.lockedEmployees.includes(employeeId) ? (
                      <button
                        onClick={() => {
                          const updatedValidationState = {
                            ...validationState,
                            lockedEmployees: validationState.lockedEmployees.filter(id => id !== employeeId)
                          };
                          setValidationState(updatedValidationState);
                          if (selectedShop && validWeek) {
                            localStorage.setItem(`validation_${selectedShop}_${validWeek}`, JSON.stringify(updatedValidationState));
                          }
                        }}
                        style={{
                          backgroundColor: '#dc3545',
                          color: 'white',
                          padding: deviceInfo.isTablet ? '10px 14px' : '6px 10px',
                          fontSize: deviceInfo.isTablet ? '13px' : '11px',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          transition: 'all 0.2s ease',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                          flex: '1',
                          minHeight: deviceInfo.isTablet ? '44px' : 'auto'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.backgroundColor = '#c82333';
                          e.currentTarget.style.transform = 'translateY(-1px)';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.backgroundColor = '#dc3545';
                          e.currentTarget.style.transform = 'translateY(0)';
                        }}
                        title="Déverrouiller l'employé"
                      >
                        🔓 Débloquer
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          const updatedValidationState = {
                            ...validationState,
                            lockedEmployees: [...validationState.lockedEmployees, employeeId]
                          };
                          setValidationState(updatedValidationState);
                          if (selectedShop && validWeek) {
                            localStorage.setItem(`validation_${selectedShop}_${validWeek}`, JSON.stringify(updatedValidationState));
                          }
                        }}
                        style={{
                          backgroundColor: '#28a745',
                          color: 'white',
                          padding: '6px 10px',
                          fontSize: '11px',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          transition: 'all 0.2s ease',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                          flex: '1'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.backgroundColor = '#218838';
                          e.currentTarget.style.transform = 'translateY(-1px)';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.backgroundColor = '#28a745';
                          e.currentTarget.style.transform = 'translateY(0)';
                        }}
                        title="Verrouiller l'employé"
                      >
                        🔒 Bloquer
                      </button>
                    )}
                  </div>
                </div>
              );
            })}



            {/* Input file caché pour l'import */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </div>
        </>
      )}

      {/* PLANNING - DIRECTEMENT APRÈS LE TITRE ET LES RÉCAPITULATIFS */}
      <div className="planning-content" style={{
        width: '100%',
        flex: '1',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        minHeight: '0'
      }}>
        <div className="planning-left" style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>
          {/* Sélecteur de boutique et navigation */}
          <div style={{
            textAlign: 'center',
            marginBottom: '20px',
            padding: deviceInfo.isTablet ? '25px' : '20px',
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
              {shops.map(shop => (
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
              value={selectedWeek ? format(new Date(selectedWeek), 'yyyy-MM') : ''}
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
                const currentDate = selectedWeek ? new Date(selectedWeek) : new Date();
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
          
          {/* Boutons de déverrouillage simples */}
          <div style={{
            backgroundColor: '#f8f9fa',
            border: '2px solid #dee2e6',
            borderRadius: '8px',
            padding: '15px',
            margin: '10px 0',
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
              title="Copier les données de la semaine du 28/07 au 3/08 vers la semaine du 4/08 au 10/08"
            >
              📋 Copier semaine
            </button>
          </div>
          

        </div>

        <div className="planning-right" style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          flex: '1',
          minHeight: '0'
        }}>
          <PlanningTable
            employees={currentShopEmployees}
            selectedEmployees={localSelectedEmployees}
            onEmployeeToggle={handleEmployeeToggle}
            planning={planning}
            onToggleSlot={toggleSlot}
            config={config}
            lockedEmployees={validationState.lockedEmployees}
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
      <GlobalDayViewModalV2
        showGlobalDayViewModal={showGlobalDayViewModalV2}
        setShowGlobalDayViewModal={setShowGlobalDayViewModalV2}
        planning={planning}
        config={config}
        selectedShop={selectedShop}
        selectedWeek={validWeek}
        selectedEmployees={localSelectedEmployees}
        currentShopEmployees={currentShopEmployees}
      />

      {/* Modale du tableau de bord */}
      {showDashboard && (
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
            borderRadius: '8px',
            padding: '20px',
            maxWidth: '95%',
            maxHeight: '95%',
            overflow: 'auto',
            position: 'relative'
          }}>
            <button
              onClick={() => setShowDashboard(false)}
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: '#666'
              }}
            >
              ×
            </button>
            <Dashboard
              selectedShop={selectedShop}
              selectedWeek={validWeek}
              selectedEmployees={localSelectedEmployees}
              globalPlanning={planning}
              planningData={planningData}
              onShopChange={changeShop}
              onWeekChange={changeToSpecificWeek}
              onMonthChange={changeMonth}
              shops={shops}
              employees={currentShopEmployees}
              config={config}
            />
          </div>
        </div>
      )}

      {showMonthlyRecapModal && (
      <MonthlyRecapModals
        showMonthlyRecapModal={showMonthlyRecapModal}
        setShowMonthlyRecapModal={setShowMonthlyRecapModal}
        config={config}
        selectedShop={selectedShop}
        selectedWeek={validWeek}
        selectedEmployees={localSelectedEmployees}
        shops={shops}
          planningData={planningData}
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
          shops={shops}
          employees={currentShopEmployees}
          planningData={planningData}
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
          shops={shops}
          employees={currentShopEmployees}
          planningData={planningData}
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
    </div>
  );
};

export default PlanningDisplay;