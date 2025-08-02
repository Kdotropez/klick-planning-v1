import React, { useState, useEffect, useCallback } from 'react';
import { format, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { loadFromLocalStorage, saveToLocalStorage } from '../../utils/localStorage';
import PlanningMenuBar from './PlanningMenuBar';
import DayButtons from './DayButtons';
import PlanningTable from './PlanningTable';
import ResetModal from './ResetModal';
import RecapModal from './RecapModal';
import GlobalDayViewModal from './GlobalDayViewModal';
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
  const [showGlobalDayViewModal, setShowGlobalDayViewModal] = useState(false);
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
  


  // Récupérer la boutique actuelle et sa configuration
  const currentShopData = getShopById(planningData, selectedShop);
  const config = currentShopData?.config || { timeSlots: [] };
  
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

  // Définir validWeek après les useEffect
  const validWeek = selectedWeek && !isNaN(new Date(selectedWeek).getTime()) ? selectedWeek : format(new Date(), 'yyyy-MM-dd');
  
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

  // Sauvegarder les données quand elles changent (désactivé temporairement pour éviter les boucles)
  // useEffect(() => {
  //   if (selectedShop && selectedWeek) {
  //     const updatedPlanningData = saveWeekPlanning(planningData, selectedShop, selectedWeek, planning, localSelectedEmployees);
  //     setPlanningData(updatedPlanningData);
  //   }
  // }, [planning, localSelectedEmployees, selectedShop, selectedWeek]);
  
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
    setShowGlobalDayViewModal(false);
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
  }, [config, mondayOfWeek, validatedData, validationState.lockedEmployees]);

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
    setShowGlobalDayViewModal(false);
    setShowResetModal(false);
    setSelectedEmployeeForMonthlyRecap('');
    setSelectedEmployeeForWeeklyRecap('');
    setSelectedEmployeeForMonthlyDetail('');
    // Réinitialiser le feedback
    setLocalFeedback('');
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
      
      

      


      <PlanningMenuBar
        currentShop={selectedShop}
        shops={shops}
        currentWeek={selectedWeek}
        changeWeek={changeWeek}
        changeShop={changeShop}
        changeMonth={changeMonth}
        onBack={onBackToEmployees}
        onBackToShop={onBackToShopSelection}
        onBackToWeek={onBackToWeekSelection}
        onBackToConfig={onBackToConfig}
        onBackToStartup={onBackToStartup}
        onExport={onExport}
        onImport={onImport}
        onReset={() => setShowResetModal(true)}
        setShowGlobalDayViewModal={setShowGlobalDayViewModal}
        setShowGlobalDayViewModalV2={setShowGlobalDayViewModalV2}
        handleManualSave={handleManualSave}
        selectedEmployees={localSelectedEmployees}
        currentShopEmployees={currentShopEmployees}
        setShowRecapModal={setShowRecapModal}
        setShowMonthlyRecapModal={setShowMonthlyRecapModal}
        setShowEmployeeMonthlyRecap={setShowEmployeeMonthlyRecap}
        setShowEmployeeWeeklyRecap={setShowEmployeeWeeklyRecap}
        setShowMonthlyDetailModal={setShowMonthlyDetailModal}
        setShowEmployeeMonthlyDetail={setShowEmployeeMonthlyDetail}
        setSelectedEmployeeForMonthlyRecap={setSelectedEmployeeForMonthlyRecap}
        setSelectedEmployeeForWeeklyRecap={setSelectedEmployeeForWeeklyRecap}
        setSelectedEmployeeForMonthlyDetail={setSelectedEmployeeForMonthlyDetail}
        calculateEmployeeDayHours={(employeeId) => {
          if (!selectedWeek || !selectedShop || !planning) return '0.0';
          const dayKey = format(addDays(new Date(selectedWeek), currentDay || 0), 'yyyy-MM-dd');
          const hours = calculateEmployeeDailyHours(employeeId, dayKey, planning, config);
          return hours.toFixed(1);
        }}
        calculateEmployeeWeekHours={(employeeId) => {
          if (!selectedWeek || !selectedShop || !planning) return '0.0';
          let totalHours = 0;
          for (let i = 0; i < 7; i++) {
            const dayKey = format(addDays(new Date(selectedWeek), i), 'yyyy-MM-dd');
            const hours = calculateEmployeeDailyHours(employeeId, dayKey, planning, config);
            totalHours += hours;
          }
          return totalHours.toFixed(1);
        }}
        calculateEmployeeMonthHours={(employeeId) => {
          if (!selectedWeek || !planningData) return '0.0';
          // Pour l'instant, on utilise seulement la semaine actuelle
          if (!selectedWeek || !selectedShop || !planning) return '0.0';
          let totalHours = 0;
          for (let i = 0; i < 7; i++) {
            const dayKey = format(addDays(new Date(selectedWeek), i), 'yyyy-MM-dd');
            const hours = calculateEmployeeDailyHours(employeeId, dayKey, planning, config);
            totalHours += hours;
          }
          return totalHours.toFixed(1);
        }}
        calculateShopWeekHours={() => {
          if (!selectedWeek || !selectedShop || !planning || !localSelectedEmployees) return '0.0';
          let totalHours = 0;
          localSelectedEmployees.forEach(employee => {
            for (let i = 0; i < 7; i++) {
              const dayKey = format(addDays(new Date(selectedWeek), i), 'yyyy-MM-dd');
              const hours = calculateEmployeeDailyHours(employee, dayKey, planning, config);
              totalHours += hours;
            }
          });
          return totalHours.toFixed(1);
        }}
        calculateGlobalMonthHours={() => {
          if (!selectedWeek || !planningData || !selectedShop) return '0.0';
          // Pour l'instant, on utilise seulement la semaine actuelle
          if (!selectedWeek || !selectedShop || !planning || !localSelectedEmployees) return '0.0';
          let totalHours = 0;
          localSelectedEmployees.forEach(employee => {
            for (let i = 0; i < 7; i++) {
              const dayKey = format(addDays(new Date(selectedWeek), i), 'yyyy-MM-dd');
              const hours = calculateEmployeeDailyHours(employee, dayKey, planning, config);
              totalHours += hours;
            }
          });
          return totalHours.toFixed(1);
        }}
        calculateTotalSelectedEmployeesHours={() => {
          if (!localSelectedEmployees || localSelectedEmployees.length === 0) return '0.0';
          let totalHours = 0;
          localSelectedEmployees.forEach(employeeId => {
            if (!selectedWeek || !selectedShop || !planning) return;
            let weekHours = 0;
            for (let i = 0; i < 7; i++) {
              const dayKey = format(addDays(new Date(selectedWeek), i), 'yyyy-MM-dd');
              const hours = calculateEmployeeDailyHours(employeeId, dayKey, planning, config);
              weekHours += hours;
            }
            totalHours += weekHours;
          });
          return totalHours.toFixed(1);
        }}
        calculateTotalShopEmployeesHours={() => {
          if (!currentShopEmployees || currentShopEmployees.length === 0 || !planning) return '0.0';
          let totalHours = 0;
          currentShopEmployees.forEach(employee => {
            if (!selectedWeek || !selectedShop || !planning) return;
            let weekHours = 0;
            for (let i = 0; i < 7; i++) {
              const dayKey = format(addDays(new Date(selectedWeek), i), 'yyyy-MM-dd');
              const hours = calculateEmployeeDailyHours(employee, dayKey, planning, config);
              weekHours += hours;
            }
            totalHours += weekHours;
          });
          return totalHours.toFixed(1);
        }}
        getSelectedEmployeesCount={() => localSelectedEmployees?.length || 0}
        getTotalShopEmployeesCount={() => currentShopEmployees?.length || 0}
        showCalendarTotals={showCalendarTotals}
      />

      <div className="planning-content">
        <div className="planning-left">
          {/* Titre de la semaine */}
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

          {/* Sélecteur de boutique */}
          <div style={{
            textAlign: 'center',
            marginBottom: '15px',
            padding: '10px',
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #dee2e6'
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
          </div>

          <DayButtons 
            days={days} 
            currentDay={currentDay} 
            setCurrentDay={setCurrentDay}
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

      <GlobalDayViewModal
        showGlobalDayViewModal={showGlobalDayViewModal}
        setShowGlobalDayViewModal={setShowGlobalDayViewModal}
        planning={planning}
        config={config}
        selectedShop={selectedShop}
        selectedWeek={validWeek}
        selectedEmployees={localSelectedEmployees}
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