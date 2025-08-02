import React, { useState, useEffect, useCallback, useRef } from 'react';
import { format, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { FaDownload, FaChevronDown, FaChevronUp, FaCog, FaChartBar, FaArrowLeft, FaTools } from 'react-icons/fa';
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

import EmployeeMonthlyWeeklyModal from './EmployeeMonthlyWeeklyModal';
import EmployeeMonthlyRecapModal from './EmployeeMonthlyRecapModal';
import EmployeeWeeklyRecapModal from './EmployeeWeeklyRecapModal';
import EmployeeMonthlyDetailModal from './EmployeeMonthlyDetailModal';
import { getShopById, getWeekPlanning, saveWeekPlanning, saveWeekPlanningForEmployee } from '../../utils/planningDataManager';
import { calculateEmployeeDailyHours } from '../../utils/planningUtils';
import '@/assets/styles.css';

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


  const [showCalendarTotals, setShowCalendarTotals] = useState(false);
  const [localFeedback, setLocalFeedback] = useState('');
  
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

  // États pour les menus et l'import
  const [openMenus, setOpenMenus] = useState({
    tools: false,
    retour: false
  });
  const fileInputRef = useRef(null);

  // Définir validWeek tout au début pour éviter les erreurs d'initialisation
  const validWeek = selectedWeek && !isNaN(new Date(selectedWeek).getTime()) ? selectedWeek : format(new Date(), 'yyyy-MM-dd');

  // Fonctions pour les menus
  const toggleMenu = (menuName) => {
    setOpenMenus(prev => ({
      ...prev,
      [menuName]: !prev[menuName]
    }));
  };

  const closeAllMenus = () => {
    setOpenMenus({
      tools: false,
      retour: false
    });
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file && onImport) {
      onImport(file);
    }
    // Reset the input
    event.target.value = '';
  };

  // Récupérer la boutique actuelle et sa configuration
  const currentShopData = getShopById(planningData, selectedShop);
  const config = currentShopData?.config || { timeSlots: [] };

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
      }
    }
  }, [selectedShop, validWeek]);

  // Gestionnaire pour fermer les menus quand on clique ailleurs
  useEffect(() => {
    const handleClickOutside = (event) => {
      const target = event.target;
      if (target && typeof target.closest === 'function' && !target.closest('.menu-button')) {
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

  // Récupérer le planning de la semaine actuelle
  const weekData = selectedShop && selectedWeek ? getWeekPlanning(planningData, selectedShop, selectedWeek) : { planning: {}, selectedEmployees: [] };
  const [planning, setPlanning] = useState(weekData.planning || {});
  
  // Initialiser localSelectedEmployees avec les employés sélectionnés globaux si weekData est vide
  const initialSelectedEmployees = weekData.selectedEmployees && weekData.selectedEmployees.length > 0 
    ? weekData.selectedEmployees 
    : selectedEmployees;
  const [localSelectedEmployees, setLocalSelectedEmployees] = useState(initialSelectedEmployees);
  
  // Fonction de verrouillage automatique
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

  // Fonction de verrouillage automatique lors du changement de semaine/boutique
  const autoLockOnChange = useCallback(() => {
    // Utiliser localSelectedEmployees si selectedEmployees est vide
    const employeesToLock = selectedEmployees && selectedEmployees.length > 0 ? selectedEmployees : localSelectedEmployees;
    
    if (autoLockEnabled && employeesToLock && employeesToLock.length > 0) {
      console.log('🔒 Verrouillage automatique lors du changement de semaine/boutique:', { 
        autoLockEnabled, 
        employeesToLockLength: employeesToLock?.length
      });
      
      // Verrouiller tous les employés sélectionnés
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
      
      console.log('📊 État de validation mis à jour:', updatedValidationState);
    } else {
      console.log('❌ Verrouillage automatique ignoré lors du changement:', { 
        autoLockEnabled, 
        selectedEmployeesLength: selectedEmployees?.length,
        localSelectedEmployeesLength: localSelectedEmployees?.length
      });
    }
  }, [autoLockEnabled, selectedEmployees, localSelectedEmployees, validationState, selectedShop, validWeek]);

  // Fonction pour changer de jour avec verrouillage automatique
  const handleDayChange = useCallback((newDay) => {
    console.log('🔍 handleDayChange appelé:', { 
      currentDay, 
      newDay, 
      lastModifiedDay, 
      autoLockEnabled,
      selectedEmployees: selectedEmployees?.length,
      localSelectedEmployees: localSelectedEmployees?.length
    });
    
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
  }, [currentDay, lastModifiedDay, autoLockPreviousDay, autoLockEnabled, selectedEmployees, localSelectedEmployees]);

  // Fonction de verrouillage automatique simplifiée - verrouiller immédiatement lors du changement de jour
  const handleDayChangeWithLock = useCallback((newDay) => {
    console.log('🔍 handleDayChangeWithLock appelé:', { 
      currentDay, 
      newDay, 
      lastModifiedDay, 
      autoLockEnabled,
      localSelectedEmployees: localSelectedEmployees?.length
    });
    
    // Verrouiller TOUJOURS lors du changement de jour si le verrouillage automatique est activé
    if (autoLockEnabled && localSelectedEmployees && localSelectedEmployees.length > 0) {
      console.log('🔒 Verrouillage automatique lors du changement de jour:', { currentDay, newDay });
      
      const updatedValidationState = {
        ...validationState,
        isWeekValidated: true,
        lockedEmployees: [...new Set([...validationState.lockedEmployees, ...localSelectedEmployees])]
      };
      
      setValidationState(updatedValidationState);
      
      // Sauvegarder l'état de validation
      if (selectedShop && validWeek) {
        localStorage.setItem(`validation_${selectedShop}_${validWeek}`, JSON.stringify(updatedValidationState));
      }
      
      console.log('📊 État de validation mis à jour:', updatedValidationState);
    }
    
    setCurrentDay(newDay);
  }, [currentDay, autoLockEnabled, localSelectedEmployees, validationState, selectedShop, validWeek]);

  // Effet pour le verrouillage automatique lors du changement de jour
  useEffect(() => {
    if (currentDay !== null && lastModifiedDay !== null && currentDay > lastModifiedDay) {
      autoLockPreviousDay(currentDay);
    }
  }, [currentDay, lastModifiedDay, autoLockPreviousDay]);

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

  // Sauvegarder les données quand elles changent
  // Sauvegarde automatique du planning - DÉSACTIVÉE pour éviter les boucles infinies
  // useEffect(() => {
  //   if (selectedShop && selectedWeek && Object.keys(planning).length > 0) {
  //     console.log('💾 Sauvegarde automatique du planning:', { selectedShop, selectedWeek, planningKeys: Object.keys(planning) });
  //     const updatedPlanningData = saveWeekPlanning(planningData, selectedShop, selectedWeek, planning, localSelectedEmployees);
  //     setPlanningData(updatedPlanningData);
  //   }
  // }, [planning, localSelectedEmployees, selectedShop, selectedWeek, planningData]);
  
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
      
      // Filtrer les employés qui peuvent travailler dans cette boutique
      const shopEmployees = validShopEmployees.filter(emp => 
        emp.canWorkIn && emp.canWorkIn.includes(selectedShop)
      );
      
      const currentShopEmployeeIds = shopEmployees.map(emp => emp.id);
      
      // Mettre à jour les employés de la boutique actuelle
      setCurrentShopEmployees(shopEmployees);
      
      // 2. Récupérer le planning existant pour cette boutique/semaine
      const weekData = getWeekPlanning(planningData, selectedShop, selectedWeek);
      setPlanning(weekData.planning || {});
      
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
  }, [selectedShop, selectedWeek, planningData]);

  const toggleSlot = useCallback((employee, slotIndex, dayIndex, forceValue = null) => {
    if (!(config?.timeSlots?.length || 0)) {
      setLocalFeedback('Erreur: Configuration des tranches horaires non valide.');
      return;
    }
    
    console.log('Debug toggleSlot:', {
      employee,
      validationState,
      lockedEmployees: validationState.lockedEmployees,
      isLocked: validationState.lockedEmployees.includes(employee),
      forceValue,
      validationStateType: typeof validationState,
      lockedEmployeesType: typeof validationState.lockedEmployees
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
      updatedPlanning[employee][dayKey] = updatedPlanning[employee][dayKey].map((val, idx) =>
        idx === slotIndex ? (forceValue !== null ? forceValue : !val) : val
      );
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
    // Verrouillage automatique avant de changer de semaine
    autoLockOnChange();
    
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

  const changeShop = (newShop) => {
    // Verrouillage automatique avant de changer de boutique
    autoLockOnChange();
    
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
    if (resetType === 'all') {
      // Effacer tous les clics
      setPlanning({});
      setFeedback('Tous les clics réinitialisés');
    } else if (resetType === 'employee' && employeeName) {
      // Effacer les clics d'un employé spécifique
      const newPlanning = { ...planning };
      // Supprimer toutes les entrées pour cet employé
      Object.keys(newPlanning).forEach(key => {
        if (key.startsWith(employeeName + '_')) {
          delete newPlanning[key];
        }
      });
      setPlanning(newPlanning);
      setFeedback(`Clics de ${employeeName} réinitialisés`);
    } else if (resetType === 'week') {
      setPlanning({});
      setLocalSelectedEmployees([]);
      setFeedback('Semaine réinitialisée');
    } else if (resetType === 'clicks') {
      setPlanning({});
      setFeedback('Clics réinitialisés');
    }
  };



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

  return (
    <div className="planning-display">
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
        marginBottom: '20px',
        padding: '15px',
        backgroundColor: '#f8f9fa',
        borderRadius: '10px',
        border: '2px solid #e9ecef'
      }}>
        <h2 style={{
          fontFamily: 'Roboto, sans-serif',
          fontSize: '24px',
          fontWeight: 'bold',
          color: '#2c3e50',
          margin: '0',
          textTransform: 'uppercase',
          letterSpacing: '1px'
        }}>
          {getWeekTitle()}
        </h2>
        <p style={{
          fontFamily: 'Roboto, sans-serif',
          fontSize: '16px',
          color: '#6c757d',
          margin: '5px 0 0 0',
          fontStyle: 'italic'
        }}>
          {selectedShop}
        </p>
      </div>

      {/* Récapitulatifs des Employés - Juste après le titre de la semaine */}
      {localSelectedEmployees && localSelectedEmployees.length > 0 && (
        <>
          <div style={{ 
            fontSize: '16px', 
            fontWeight: 'bold', 
            color: '#495057',
            marginBottom: '10px',
            width: '100%',
            textAlign: 'center'
          }}>
            Récapitulatifs Employés
          </div>
          
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            gap: '8px', 
            flexWrap: 'nowrap',
            padding: '15px',
            backgroundColor: '#f8f9fa',
            borderRadius: '10px',
            border: '2px solid #e9ecef',
            marginBottom: '15px',
            width: '100%',
            boxSizing: 'border-box',
            overflowX: 'auto'
          }}>
            {localSelectedEmployees.map((employeeId) => {
              const employee = currentShopEmployees?.find(emp => emp.id === employeeId);
              const employeeName = employee?.name || employeeId;
              
              return (
                <div key={employeeId} style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  padding: '12px 15px',
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  border: '2px solid #dee2e6',
                  minWidth: '160px',
                  maxWidth: '180px',
                  textAlign: 'center',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                  flex: '0 0 auto'
                }}>
                  <div style={{ 
                    fontSize: '14px', 
                    fontWeight: 'bold',
                    color: '#495057',
                    marginBottom: '6px',
                    padding: '6px',
                    backgroundColor: '#f8f9fa',
                    borderRadius: '4px',
                    border: '1px solid #e9ecef',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {employeeName}
                  </div>
                  
                  <button
                    onClick={() => setShowRecapModal(employeeId)}
                    style={{
                      backgroundColor: '#17a2b8',
                      color: 'white',
                      padding: '8px 12px',
                      fontSize: '12px',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      marginBottom: '4px',
                      fontWeight: 'bold',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                      whiteSpace: 'nowrap'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = '#138496';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = '#17a2b8';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
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
                      backgroundColor: '#28a745',
                      color: 'white',
                      padding: '8px 12px',
                      fontSize: '12px',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      marginBottom: '4px',
                      fontWeight: 'bold',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                      whiteSpace: 'nowrap'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = '#218838';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = '#28a745';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
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
                  
                  <button
                    onClick={() => {
                      setSelectedEmployeeForMonthlyRecap(employeeId);
                      setShowEmployeeMonthlyRecap(true);
                    }}
                    style={{
                      backgroundColor: '#ffc107',
                      color: '#212529',
                      padding: '8px 12px',
                      fontSize: '12px',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      marginBottom: '4px',
                      fontWeight: 'bold',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                      whiteSpace: 'nowrap'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = '#e0a800';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = '#ffc107';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                    }}
                    title="Récapitulatif mensuel"
                  >
                    📈 Mois: {(() => {
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
                  
                  <button
                    onClick={() => {
                      setSelectedEmployeeForMonthlyDetail(employeeId);
                      setShowEmployeeMonthlyDetail(true);
                    }}
                    style={{
                      backgroundColor: '#6f42c1',
                      color: 'white',
                      padding: '8px 12px',
                      fontSize: '12px',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                      whiteSpace: 'nowrap'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = '#5a32a3';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = '#6f42c1';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
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
          </div>

          {/* Carte des boutons d'actions */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            gap: '10px', 
            flexWrap: 'wrap',
            alignItems: 'center',
            padding: '15px',
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            border: '2px solid #e9ecef',
            marginBottom: '15px',
            width: '100%',
            boxSizing: 'border-box'
          }}>
            {/* Boutons Principaux - Directement Visibles */}
            <button
              onClick={() => setShowGlobalDayViewModalV2(true)}
              style={{
                backgroundColor: '#1e88e5',
                color: '#fff',
                padding: '10px 16px',
                fontSize: '14px',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1565c0'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#1e88e5'}
            >
              📊 Vue globale par jour
            </button>

            <button
              onClick={onExport}
              style={{
                backgroundColor: '#28a745',
                color: '#fff',
                padding: '10px 16px',
                fontSize: '14px',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#218838'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#28a745'}
            >
              <FaDownload /> Exporter les données
            </button>

            <button
              onClick={handleImportClick}
              style={{
                backgroundColor: '#ffc107',
                color: '#212529',
                padding: '10px 16px',
                fontSize: '14px',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#e0a800'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#ffc107'}
            >
              📥 Importer les données
            </button>

            {/* Menu Outils */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => toggleMenu('tools')}
                style={{
                  backgroundColor: '#1e88e5',
                  color: '#fff',
                  padding: '10px 16px',
                  fontSize: '14px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1565c0'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#1e88e5'}
              >
                <FaTools /> Outils
                {openMenus.tools ? <FaChevronUp /> : <FaChevronDown />}
              </button>
              
              {openMenus.tools && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: '0',
                  backgroundColor: '#fff',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  zIndex: 1000,
                  minWidth: '200px'
                }}>
                  <button
                    onClick={() => {}}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: 'none',
                      backgroundColor: 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: '14px'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    🔧 Diagnostic données
                  </button>
                  <button
                    onClick={() => {}}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: 'none',
                      backgroundColor: 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: '14px'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    🧹 Nettoyer cache
                  </button>
                  <button
                    onClick={() => {}}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: 'none',
                      backgroundColor: 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: '14px'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    📋 Logs système
                  </button>
                </div>
              )}
            </div>

            {/* Menu Retour */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => toggleMenu('retour')}
                style={{
                  backgroundColor: '#1e88e5',
                  color: '#fff',
                  padding: '10px 16px',
                  fontSize: '14px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1565c0'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#1e88e5'}
              >
                <FaArrowLeft /> Retour
                {openMenus.retour ? <FaChevronUp /> : <FaChevronDown />}
              </button>
              
              {openMenus.retour && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: '0',
                  backgroundColor: '#fff',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  zIndex: 1000,
                  minWidth: '200px'
                }}>
                  <button
                    onClick={onBackToStartup}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: 'none',
                      backgroundColor: 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: '14px'
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
                      padding: '8px 12px',
                      border: 'none',
                      backgroundColor: 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: '14px'
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
                      padding: '8px 12px',
                      border: 'none',
                      backgroundColor: 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: '14px'
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
                      padding: '8px 12px',
                      border: 'none',
                      backgroundColor: 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: '14px'
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
                      padding: '8px 12px',
                      border: 'none',
                      backgroundColor: 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: '14px'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    📅 Sélection semaine
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Input file caché pour l'import */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </>
      )}

      {/* PLANNING - DIRECTEMENT APRÈS LE TITRE ET LES RÉCAPITULATIFS */}
      <div className="planning-content">
        <div className="planning-left">
          {/* Sélecteur de boutique et navigation */}
          <div style={{
            textAlign: 'center',
            marginBottom: '15px',
            padding: '15px',
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #dee2e6',
            display: 'flex',
            alignItems: 'center',
            gap: '15px',
            flexWrap: 'wrap',
            justifyContent: 'center'
          }}>
            <select
              value={selectedShop}
              onChange={(e) => setSelectedShop(e.target.value)}
              style={{ 
                padding: '8px 12px',
                fontSize: '14px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                minWidth: '200px',
                backgroundColor: '#fff',
                cursor: 'pointer'
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
                backgroundColor: '#2196f3',
                color: 'white',
                padding: '8px 16px',
                fontSize: '14px',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1976d2'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#2196f3'}
            >
              ← Semaine précédente
            </button>

            {/* Sélecteur de mois */}
            <select
              value={selectedWeek ? format(new Date(selectedWeek), 'yyyy-MM') : ''}
              onChange={(e) => changeMonth(e.target.value)}
              style={{ 
                padding: '8px 12px',
                fontSize: '14px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                minWidth: '150px',
                backgroundColor: '#fff'
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
                backgroundColor: '#2196f3',
                color: 'white',
                padding: '8px 16px',
                fontSize: '14px',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1976d2'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#2196f3'}
            >
              Semaine suivante →
            </button>
          </div>

          <DayButtons 
            days={days} 
            currentDay={currentDay} 
            setCurrentDay={handleDayChangeWithLock}
            planning={planning}
            config={config}
            selectedEmployees={localSelectedEmployees}
            selectedWeek={format(mondayOfWeek, 'yyyy-MM-dd')}
            selectedShop={selectedShop}
          />
          
          {/* Gestionnaire de validation */}
          <ValidationManager
            selectedShop={selectedShop}
            selectedWeek={validWeek}
            selectedEmployees={localSelectedEmployees}
            planning={planning}
            onValidationChange={setValidationState}
            currentShopEmployees={currentShopEmployees}
            autoLockEnabled={autoLockEnabled}
            onAutoLockToggle={() => setAutoLockEnabled(!autoLockEnabled)}
          />
        </div>

        <div className="planning-right">
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

      {showMonthlyRecapModal && (
      <MonthlyRecapModals
        showMonthlyRecapModal={showMonthlyRecapModal}
        setShowMonthlyRecapModal={setShowMonthlyRecapModal}
        config={config}
        selectedShop={selectedShop}
        selectedWeek={validWeek}
        selectedEmployees={localSelectedEmployees}
        shops={shops}
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
    </div>
  );
};

export default PlanningDisplay;