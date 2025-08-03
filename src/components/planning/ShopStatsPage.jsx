import React, { useState, useEffect } from 'react';
import { format, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { fr } from 'date-fns/locale';
import { calculateEmployeeDailyHours } from '../../utils/planningUtils';
import { getWeekPlanning } from '../../utils/planningDataManager';
import { loadFromLocalStorage } from '../../utils/localStorage';
import { getCAData, calculateMonthlyCA, getAllData, calculateCompleteStats } from '../../utils/excelImportUtils';
import Button from '../common/Button';
import ExcelImportModal from './ExcelImportModal';
import CAManagementPage from './CAManagementPage';
import CompleteDataImportPage from './CompleteDataImportPage';
import '@/assets/styles.css';

const ShopStatsPage = ({
  planningData,
  selectedShop,
  selectedWeek,
  config,
  shops,
  employees,
  onBack
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedMonth, setSelectedMonth] = useState(selectedWeek);
  
  // États pour la rentabilité
  const [monthlyRevenue, setMonthlyRevenue] = useState('');
  const [weeklyRevenue, setWeeklyRevenue] = useState('');
  const [revenueMode, setRevenueMode] = useState('monthly'); // 'monthly' ou 'weekly'
  
  // États pour le CA HT (pour le calcul du taux de marge)
  const [monthlyRevenueHT, setMonthlyRevenueHT] = useState('');
  const [weeklyRevenueHT, setWeeklyRevenueHT] = useState('');
  const [revenueHTMode, setRevenueHTMode] = useState('monthly'); // 'monthly' ou 'weekly'
  
  // États pour la marge réalisée
  const [monthlyMargin, setMonthlyMargin] = useState('');
  const [weeklyMargin, setWeeklyMargin] = useState('');
  const [marginMode, setMarginMode] = useState('monthly'); // 'monthly' ou 'weekly'
  
  // États pour les coûts (étape ultérieure)
  const [monthlyVariableCosts, setMonthlyVariableCosts] = useState('');
  const [weeklyVariableCosts, setWeeklyVariableCosts] = useState('');
  const [monthlyFixedCosts, setMonthlyFixedCosts] = useState('');
  const [weeklyFixedCosts, setWeeklyFixedCosts] = useState('');
  const [costsMode, setCostsMode] = useState('monthly'); // 'monthly' ou 'weekly'
  
  // États pour la sélection
  const [currentShop, setCurrentShop] = useState(selectedShop);
  const [selectedEmployees, setSelectedEmployees] = useState([]);

  // États pour les achats calculés
  const [calculatedPurchases, setCalculatedPurchases] = useState(0);
  const [calculationsPerformed, setCalculationsPerformed] = useState(false);

  // Nouveaux états pour l'interface améliorée
  const [revenueInputMode, setRevenueInputMode] = useState('TTC'); // 'TTC' ou 'HT'
  const [showCalculations, setShowCalculations] = useState(false);
  const [calculationsTriggered, setCalculationsTriggered] = useState(false);
  
  // États pour l'import Excel
  const [showExcelImportModal, setShowExcelImportModal] = useState(false);
  const [importedCAData, setImportedCAData] = useState([]);
  const [importedCompleteData, setImportedCompleteData] = useState([]);
  
  // État pour la page de gestion des CA
  const [showCAManagement, setShowCAManagement] = useState(false);
  
  // État pour l'import de données complètes
  const [showCompleteDataImport, setShowCompleteDataImport] = useState(false);

  // Fonction pour calculer le total des heures de la boutique pour le mois
  const calculateShopMonthlyTotal = (monthDate = selectedMonth) => {
    let totalHours = 0;
    const currentDate = new Date(monthDate);
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
      const weekData = getWeekPlanning(planningData, currentShop, weekKey);
      const selectedEmployeesForShop = weekData.selectedEmployees || [];
      const weekPlanning = weekData.planning || {};
      
      // Si des employés sont sélectionnés, ne calculer que pour eux
      const employeesToCalculate = selectedEmployees.length > 0 ? selectedEmployees : selectedEmployeesForShop;
      
      // Calculer les heures pour chaque employé
      employeesToCalculate.forEach(employee => {
        const hours = calculateEmployeeDailyHours(employee, dayKey, weekPlanning, config);
        totalHours += hours;
      });
    }
    
    return totalHours.toFixed(1);
  };

  // Fonction pour calculer les heures par employé
  const calculateEmployeeHours = (employeeId, monthDate = selectedMonth) => {
    let totalHours = 0;
    const currentDate = new Date(monthDate);
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const lastDayOfMonth = new Date(year, month + 1, 0);
    
    for (let day = 1; day <= lastDayOfMonth.getDate(); day++) {
      const dayKey = format(new Date(year, month, day), 'yyyy-MM-dd');
      const dayDate = new Date(year, month, day);
      const weekStart = startOfWeek(dayDate, { weekStartsOn: 1 });
      const weekKey = format(weekStart, 'yyyy-MM-dd');
      
      const weekData = getWeekPlanning(planningData, currentShop, weekKey);
      const weekPlanning = weekData.planning || {};
      
      const hours = calculateEmployeeDailyHours(employeeId, dayKey, weekPlanning, config);
      totalHours += hours;
    }
    
    return totalHours.toFixed(1);
  };

  // Fonction pour obtenir les jours hors mois (fragmentés)
  const getDaysOutsideMonth = (monthDate = selectedMonth) => {
    const daysOutsideMonth = [];
    const selectedShopData = planningData.shops.find(shop => shop.id === currentShop);
    if (!selectedShopData || !selectedShopData.weeks) return daysOutsideMonth;
    
    const monthStart = startOfMonth(new Date(monthDate));
    const monthEnd = endOfMonth(new Date(monthDate));
    
    Object.keys(selectedShopData.weeks).forEach(weekKey => {
      const weekStart = new Date(weekKey);
      const weekEnd = addDays(weekStart, 6);
      
      const overlapsMonth = (weekStart <= monthEnd && weekEnd >= monthStart);
      
      if (overlapsMonth) {
        const weekData = selectedShopData.weeks[weekKey];
        if (weekData && weekData.planning) {
          Object.keys(weekData.planning).forEach(employeeId => {
            Object.keys(weekData.planning[employeeId]).forEach(dayStr => {
              const dayDate = new Date(dayStr);
              
              if (dayDate < monthStart || dayDate > monthEnd) {
                const slots = weekData.planning[employeeId][dayStr];
                if (Array.isArray(slots) && slots.some(slot => slot === true)) {
                  const hours = calculateEmployeeDailyHours(employeeId, dayStr, { [employeeId]: { [dayStr]: slots } }, config);
                  daysOutsideMonth.push({
                    date: dayStr,
                    employeeId: employeeId,
                    employeeName: getEmployeeName(employeeId),
                    hours: hours,
                    dayName: format(dayDate, 'EEEE', { locale: fr }),
                    dayDate: format(dayDate, 'dd/MM/yyyy', { locale: fr }),
                    isBeforeMonth: dayDate < monthStart,
                    weekKey: weekKey
                  });
                }
              }
            });
          });
        }
      }
    });
    
    return daysOutsideMonth.sort((a, b) => new Date(a.date) - new Date(b.date));
  };

  // Fonction pour obtenir le nom de l'employé
  const getEmployeeName = (employeeId) => {
    if (!employees || !Array.isArray(employees)) {
      console.log('Debug getEmployeeName - no employees array:', { employeeId, employees });
      return employeeId;
    }
    
    // Essayer plusieurs méthodes de recherche
    let employee = null;
    
    // 1. Recherche par ID exact
    employee = employees.find(emp => emp.id === employeeId);
    
    // 2. Si pas trouvé, recherche par correspondance exacte
    if (!employee) {
      employee = employees.find(emp => emp === employeeId);
    }
    
    // 3. Si pas trouvé, recherche par nom (cas où employeeId est déjà un nom)
    if (!employee) {
      employee = employees.find(emp => emp.name === employeeId);
    }
    
    // 4. Si pas trouvé, recherche par ID numérique
    if (!employee && !isNaN(employeeId)) {
      employee = employees.find(emp => emp.id === parseInt(employeeId));
    }
    
    const result = employee ? (employee.name || employee) : employeeId;
    console.log('Debug getEmployeeName:', { employeeId, found: !!employee, result, employeesCount: employees.length });
    
    return result;
  };

  // Fonction pour obtenir les employés de la boutique
  const getShopEmployees = () => {
    // Récupérer uniquement les employés qui ont des heures effectives dans cette boutique
    const employeesWithHours = new Set();
    const selectedShopData = planningData.shops.find(shop => shop.id === currentShop);
    
    if (selectedShopData && selectedShopData.weeks) {
      Object.keys(selectedShopData.weeks).forEach(weekKey => {
        const weekData = selectedShopData.weeks[weekKey];
        if (weekData && weekData.planning) {
          Object.keys(weekData.planning).forEach(employeeId => {
            // Vérifier si l'employé a effectivement des heures dans cette semaine
            const employeePlanning = weekData.planning[employeeId];
            if (employeePlanning) {
              let hasHours = false;
              Object.keys(employeePlanning).forEach(dayKey => {
                const slots = employeePlanning[dayKey];
                if (Array.isArray(slots) && slots.some(slot => slot === true)) {
                  hasHours = true;
                }
              });
              if (hasHours) {
                employeesWithHours.add(employeeId);
              }
            }
          });
        }
      });
    }
    
    const shopEmployeeIds = Array.from(employeesWithHours);
    
    // Convertir les IDs en objets employés complets
    const shopEmployees = shopEmployeeIds.map(employeeId => {
      // Chercher l'employé dans la liste des employés passée en props
      let employee = null;
      
      // 1. Recherche par ID exact
      employee = employees.find(emp => emp.id === employeeId);
      
      // 2. Si pas trouvé, recherche par correspondance exacte
      if (!employee) {
        employee = employees.find(emp => emp === employeeId);
      }
      
      // 3. Si pas trouvé, recherche par nom (cas où employeeId est déjà un nom)
      if (!employee) {
        employee = employees.find(emp => emp.name === employeeId);
      }
      
      // 4. Si pas trouvé, recherche par ID numérique
      if (!employee && !isNaN(employeeId)) {
        employee = employees.find(emp => emp.id === parseInt(employeeId));
      }
      
      if (employee) {
        return employee;
      }
      
      // Si pas trouvé, créer un objet avec l'ID comme nom
      // Essayer de nettoyer l'ID pour un affichage plus propre
      let displayName = employeeId;
      if (employeeId.startsWith('emp_')) {
        // Pour les IDs générés automatiquement, essayer de trouver un nom plus lisible
        displayName = `Employé ${employeeId.slice(4, 8)}`; // Prendre les 4 premiers chiffres après 'emp_'
      }
      
      return { id: employeeId, name: displayName };
    });
    
    console.log('Debug getShopEmployees:', { 
      currentShop, 
      shopEmployeeIds, 
      shopEmployees,
      employeesFromProps: employees?.length || 0
    });
    return shopEmployees;
  };

  // Fonction pour calculer les statistiques par jour de la semaine
  const getWeeklyStats = (monthDate = selectedMonth) => {
    const stats = {
      lundi: 0, mardi: 0, mercredi: 0, jeudi: 0, vendredi: 0, samedi: 0, dimanche: 0
    };
    
    const currentDate = new Date(monthDate);
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const lastDayOfMonth = new Date(year, month + 1, 0);
    
    for (let day = 1; day <= lastDayOfMonth.getDate(); day++) {
      const dayKey = format(new Date(year, month, day), 'yyyy-MM-dd');
      const dayDate = new Date(year, month, day);
      const dayName = format(dayDate, 'EEEE', { locale: fr }).toLowerCase();
      
      const weekStart = startOfWeek(dayDate, { weekStartsOn: 1 });
      const weekKey = format(weekStart, 'yyyy-MM-dd');
      
      const weekData = getWeekPlanning(planningData, currentShop, weekKey);
      const selectedEmployeesForShop = weekData.selectedEmployees || [];
      const weekPlanning = weekData.planning || {};
      
      // Si des employés sont sélectionnés, ne calculer que pour eux
      const employeesToCalculate = selectedEmployees.length > 0 ? selectedEmployees : selectedEmployeesForShop;
      
      let dayTotal = 0;
      employeesToCalculate.forEach(employee => {
        const hours = calculateEmployeeDailyHours(employee, dayKey, weekPlanning, config);
        dayTotal += hours;
      });
      
      if (stats.hasOwnProperty(dayName)) {
        stats[dayName] += dayTotal;
      }
    }
    
    return stats;
  };

  // Fonctions de calcul de rentabilité
  const getCurrentRevenue = () => {
    // Priorité aux données importées complètes
    const completeStats = getImportedCompleteStats();
    if (completeStats && completeStats.totalCA > 0) {
      return completeStats.totalCA;
    }
    
    // Sinon, utiliser les données CA importées
    const importedCA = getImportedMonthlyCA();
    if (importedCA && importedCA.totalCA > 0) {
      return parseFloat(importedCA.totalCA);
    }
    
    // En dernier recours, utiliser les saisies manuelles
    if (revenueMode === 'monthly') {
      return parseFloat(monthlyRevenue) || 0;
    } else {
      return parseFloat(weeklyRevenue) || 0;
    }
  };

  // Fonction pour obtenir le CA HT (pour le calcul du taux de marge)
  const getCurrentRevenueHT = () => {
    // Priorité aux données importées complètes
    const completeStats = getImportedCompleteStats();
    if (completeStats && completeStats.totalCAHT > 0) {
      return completeStats.totalCAHT;
    }
    
    // Sinon, utiliser les saisies manuelles
    if (revenueHTMode === 'monthly') {
      return parseFloat(monthlyRevenueHT) || 0;
    } else {
      return parseFloat(weeklyRevenueHT) || 0;
    }
  };

  const calculateRevenuePerHour = () => {
    const revenue = getCurrentRevenue();
    const hours = parseFloat(calculateShopMonthlyTotal());
    return hours > 0 ? (revenue / hours).toFixed(2) : 0;
  };

  const calculateRevenuePerEmployee = () => {
    const revenue = getCurrentRevenue();
    const shopEmployees = getShopEmployees();
    const employeeCount = selectedEmployees.length > 0 ? selectedEmployees.length : shopEmployees.length;
    console.log('Debug CA par employé:', { revenue, employeeCount, result: employeeCount > 0 ? (revenue / employeeCount).toFixed(2) : 0 });
    return employeeCount > 0 ? (revenue / employeeCount).toFixed(2) : 0;
  };

  const calculateRevenuePerShop = () => {
    const revenue = getCurrentRevenue();
    return revenue.toFixed(2);
  };

  // Fonction pour calculer le CA par jour
  const calculateDailyRevenue = () => {
    const revenue = getCurrentRevenue();
    const currentDate = new Date(selectedMonth);
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();
    
    return revenue > 0 ? (revenue / daysInMonth).toFixed(2) : 0;
  };

  // Fonction pour calculer le CA par jour travaillé
  const calculateRevenuePerWorkDay = () => {
    const revenue = getCurrentRevenue();
    const currentDate = new Date(selectedMonth);
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const lastDayOfMonth = new Date(year, month + 1, 0);
    
    let workDays = 0;
    for (let day = 1; day <= lastDayOfMonth.getDate(); day++) {
      const dayKey = format(new Date(year, month, day), 'yyyy-MM-dd');
      const dayDate = new Date(year, month, day);
      const weekStart = startOfWeek(dayDate, { weekStartsOn: 1 });
      const weekKey = format(weekStart, 'yyyy-MM-dd');
      
      const weekData = getWeekPlanning(planningData, currentShop, weekKey);
      const selectedEmployeesForShop = weekData.selectedEmployees || [];
      const weekPlanning = weekData.planning || {};
      
      // Si des employés sont sélectionnés, ne calculer que pour eux
      const employeesToCalculate = selectedEmployees.length > 0 ? selectedEmployees : selectedEmployeesForShop;
      
      let dayTotalHours = 0;
      employeesToCalculate.forEach(employee => {
        const hours = calculateEmployeeDailyHours(employee, dayKey, weekPlanning, config);
        dayTotalHours += hours;
      });
      
      if (dayTotalHours > 0) {
        workDays++;
      }
    }
    
    return workDays > 0 ? (revenue / workDays).toFixed(2) : 0;
  };

  // Fonction pour calculer le CA par employé par jour
  const calculateRevenuePerEmployeePerDay = () => {
    const revenue = getCurrentRevenue();
    const shopEmployees = getShopEmployees();
    const employeeCount = selectedEmployees.length > 0 ? selectedEmployees.length : shopEmployees.length;
    
    if (employeeCount === 0) return 0;
    
    const currentDate = new Date(selectedMonth);
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();
    
    return (revenue / employeeCount / daysInMonth).toFixed(2);
  };

  // Fonction pour calculer le CA par employé par heure de travail
  const calculateRevenuePerEmployeePerHour = () => {
    const revenue = getCurrentRevenue();
    const shopEmployees = getShopEmployees();
    const employeeCount = selectedEmployees.length > 0 ? selectedEmployees.length : shopEmployees.length;
    const totalHours = parseFloat(calculateShopMonthlyTotal());
    
    if (employeeCount === 0 || totalHours === 0) return 0;
    
    return (revenue / employeeCount / totalHours).toFixed(2);
  };

          // Fonction de calcul de la marge directe
        const getCurrentMargin = () => {
          if (marginMode === 'monthly') {
            return parseFloat(monthlyMargin) || 0;
          } else {
            return parseFloat(weeklyMargin) || 0;
          }
        };

        // Fonctions de calcul des coûts (étape ultérieure)
        const getCurrentVariableCosts = () => {
          if (costsMode === 'monthly') {
            return parseFloat(monthlyVariableCosts) || 0;
          } else {
            return parseFloat(weeklyVariableCosts) || 0;
          }
        };

        const getCurrentFixedCosts = () => {
          if (costsMode === 'monthly') {
            return parseFloat(monthlyFixedCosts) || 0;
          } else {
            return parseFloat(weeklyFixedCosts) || 0;
          }
        };

        const getCurrentTotalCosts = () => {
          return getCurrentVariableCosts() + getCurrentFixedCosts();
        };

        // Fonctions de calcul des marges
        const calculateGrossMargin = () => {
          return getCurrentMargin().toFixed(2);
        };

  const calculateNetMargin = () => {
    const revenue = getCurrentRevenue();
    const totalCosts = getCurrentTotalCosts();
    return (revenue - totalCosts).toFixed(2);
  };

  const calculateGrossMarginRate = () => {
    const revenueHT = getCurrentRevenueHT();
    const grossMargin = getCurrentMargin();
    
    // Ajouter des logs pour debug
    console.log('Debug taux de marge:', { 
      revenueHT, 
      grossMargin, 
      revenueHTMode,
      marginMode,
      calculation: revenueHT > 0 ? ((grossMargin / revenueHT) * 100) : 0,
      result: revenueHT > 0 ? ((grossMargin / revenueHT) * 100).toFixed(1) : 0,
      manualCheck: revenueHT > 0 ? ((grossMargin / revenueHT) * 100) : 0
    });
    
    return revenueHT > 0 ? ((grossMargin / revenueHT) * 100).toFixed(1) : 0;
  };

  const calculateNetMarginRate = () => {
    const revenue = getCurrentRevenue();
    const netMargin = parseFloat(calculateNetMargin());
    return revenue > 0 ? ((netMargin / revenue) * 100).toFixed(1) : 0;
  };

          const calculateMarginPerHour = () => {
          const grossMargin = getCurrentMargin();
          const totalHours = parseFloat(calculateShopMonthlyTotal());
          return totalHours > 0 ? (grossMargin / totalHours).toFixed(2) : 0;
        };

        const calculateMarginPerEmployee = () => {
          const grossMargin = getCurrentMargin();
          const shopEmployees = getShopEmployees();
          const employeeCount = selectedEmployees.length > 0 ? selectedEmployees.length : shopEmployees.length;
          return employeeCount > 0 ? (grossMargin / employeeCount).toFixed(2) : 0;
        };

          const calculateMarginPerEmployeePerDay = () => {
          const grossMargin = getCurrentMargin();
          const shopEmployees = getShopEmployees();
          const employeeCount = selectedEmployees.length > 0 ? selectedEmployees.length : shopEmployees.length;
          
          if (employeeCount === 0) return 0;
          
          const currentDate = new Date(selectedMonth);
          const year = currentDate.getFullYear();
          const month = currentDate.getMonth();
          const lastDayOfMonth = new Date(year, month + 1, 0);
          const daysInMonth = lastDayOfMonth.getDate();
          
          return (grossMargin / employeeCount / daysInMonth).toFixed(2);
        };

        const calculateMarginPerEmployeePerHour = () => {
          const grossMargin = getCurrentMargin();
          const shopEmployees = getShopEmployees();
          const employeeCount = selectedEmployees.length > 0 ? selectedEmployees.length : shopEmployees.length;
          const totalHours = parseFloat(calculateShopMonthlyTotal());
          
          if (employeeCount === 0 || totalHours === 0) return 0;
          
          return (grossMargin / employeeCount / totalHours).toFixed(2);
        };

  const shop = shops.find(s => s.id === currentShop) || { name: 'Boutique' };
  const shopEmployees = getShopEmployees();
  const totalHours = calculateShopMonthlyTotal();
  const weeklyStats = getWeeklyStats();
  const daysOutsideMonth = getDaysOutsideMonth();

  // Fonctions pour la sélection
  const handleShopChange = (shopId) => {
    setCurrentShop(shopId);
    setSelectedEmployees([]); // Réinitialiser la sélection d'employés
  };

  const handleEmployeeToggle = (employeeId) => {
    setSelectedEmployees(prev => {
      if (prev.includes(employeeId)) {
        return prev.filter(id => id !== employeeId);
      } else {
        return [...prev, employeeId];
      }
    });
  };

  const handleSelectAllEmployees = () => {
    setSelectedEmployees(shopEmployees.map(emp => emp.id));
  };

  const handleClearEmployeeSelection = () => {
    setSelectedEmployees([]);
  };

  // Fonction pour calculer les achats à partir de la marge
  const calculatePurchasesFromMargin = () => {
    const revenue = getCurrentRevenue();
    const margin = getCurrentMargin();
    
    if (revenue <= 0 || margin < 0) return 0;
    
    // Achats = CA - Marge réalisée
    return revenue - margin;
  };

  // Fonction pour déclencher les calculs d'achats
  const handleCalculatePurchases = () => {
    const purchases = calculatePurchasesFromMargin();
    setCalculatedPurchases(purchases);
    setCalculationsPerformed(true);
  };

  // Nouvelle fonction pour démarrer tous les calculs
  const handleStartCalculations = () => {
    setShowCalculations(true);
    setCalculationsTriggered(true);
  };

  // Fonction pour réinitialiser les calculs
  const handleResetCalculations = () => {
    setShowCalculations(false);
    setCalculationsTriggered(false);
    setCalculationsPerformed(false);
    setCalculatedPurchases(0);
  };

  // Fonction pour charger les données CA importées
  const loadImportedCAData = () => {
    const caData = getCAData(currentShop);
    const completeData = getAllData(currentShop);
    setImportedCAData(caData);
    setImportedCompleteData(completeData);
    return caData;
  };

  // Fonction pour gérer le succès de l'import
  const handleImportSuccess = (shopId, caData) => {
    setImportedCAData(caData);
    console.log(`Données CA importées pour ${shopId}:`, caData);
  };

  // Fonction pour obtenir le CA du mois depuis les données importées
  const getImportedMonthlyCA = () => {
    if (importedCAData.length === 0) return null;
    
    const currentDate = new Date(selectedMonth);
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    return calculateMonthlyCA(importedCAData, year, month);
  };

  // Fonction pour obtenir les statistiques complètes depuis les données importées
  const getImportedCompleteStats = () => {
    if (importedCompleteData.length === 0) return null;
    
    const currentDate = new Date(selectedMonth);
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    return calculateCompleteStats(importedCompleteData, year, month);
  };

  // Fonction pour obtenir les encaissements depuis les données importées
  const getImportedEncaissements = () => {
    const completeStats = getImportedCompleteStats();
    if (completeStats && completeStats.totalEncaissement > 0) {
      return completeStats.totalEncaissement;
    }
    return 0;
  };

  // Fonction pour détecter si des données importées sont utilisées
  const isUsingImportedData = () => {
    const completeStats = getImportedCompleteStats();
    const importedCA = getImportedMonthlyCA();
    return (completeStats && completeStats.totalCA > 0) || (importedCA && importedCA.totalCA > 0);
  };

  // Charger les données CA au changement de boutique
  useEffect(() => {
    loadImportedCAData();
  }, [currentShop]);

  return (
    <div style={{ 
      padding: '20px', 
      maxWidth: '1200px', 
      margin: '0 auto',
      fontFamily: 'Roboto, sans-serif'
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
         <div>
           <h1 style={{ 
             color: '#333', 
             margin: '0 0 10px 0',
             fontSize: '28px',
             fontWeight: 'bold'
           }}>
             📊 Statistiques
           </h1>
           <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
             <p style={{ 
               color: '#666', 
               margin: '0',
               fontSize: '16px'
             }}>
               Mois de {format(new Date(selectedMonth), 'MMMM yyyy', { locale: fr })}
             </p>
             {isUsingImportedData() && (
               <span style={{
                 backgroundColor: '#28a745',
                 color: 'white',
                 padding: '4px 8px',
                 borderRadius: '12px',
                 fontSize: '12px',
                 fontWeight: 'bold'
               }}>
                 📊 Données importées
               </span>
             )}
           </div>
         </div>
         <Button
           onClick={onBack}
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
           ← Retour
         </Button>
       </div>

       {/* Sélecteur de boutique */}
       <div style={{ 
         background: 'white', 
         padding: '20px', 
         borderRadius: '12px',
         boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
         marginBottom: '20px'
       }}>
         <h3 style={{ color: '#333', marginBottom: '15px' }}>🏪 Sélectionner une boutique</h3>
         <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
           {shops.map(shopItem => (
             <button
               key={shopItem.id}
               onClick={() => handleShopChange(shopItem.id)}
               style={{
                 padding: '10px 16px',
                 border: 'none',
                 borderRadius: '8px',
                 cursor: 'pointer',
                 fontWeight: '600',
                 fontSize: '14px',
                 background: currentShop === shopItem.id ? 'linear-gradient(135deg, #007bff 0%, #0056b3 100%)' : '#f8f9fa',
                 color: currentShop === shopItem.id ? 'white' : '#333',
                 transition: 'all 0.3s ease'
               }}
             >
               {shopItem.name}
             </button>
           ))}
           
           {/* Bouton Import Excel */}
           <button
             onClick={() => setShowExcelImportModal(true)}
             style={{
               padding: '10px 16px',
               border: 'none',
               borderRadius: '8px',
               cursor: 'pointer',
               fontWeight: '600',
               fontSize: '14px',
               background: 'linear-gradient(135deg, #28a745 0%, #1e7e34 100%)',
               color: 'white',
               transition: 'all 0.3s ease',
               marginLeft: '10px'
             }}
           >
             📊 Import CA
           </button>
           
           {/* Bouton Import Données Complètes */}
           <button
             onClick={() => setShowCompleteDataImport(true)}
             style={{
               padding: '10px 16px',
               border: 'none',
               borderRadius: '8px',
               cursor: 'pointer',
               fontWeight: '600',
               fontSize: '14px',
               background: 'linear-gradient(135deg, #17a2b8 0%, #138496 100%)',
               color: 'white',
               transition: 'all 0.3s ease',
               marginLeft: '10px'
             }}
             title="Importer les données complètes depuis un fichier Excel"
           >
             📋 Import Données Complètes
           </button>
           
           <button
             onClick={() => setShowCAManagement(true)}
             style={{
               padding: '10px 16px',
               border: 'none',
               borderRadius: '8px',
               cursor: 'pointer',
               fontWeight: '600',
               fontSize: '14px',
               background: 'linear-gradient(135deg, #007bff 0%, #0056b3 100%)',
               color: 'white',
               transition: 'all 0.3s ease',
               marginLeft: '10px'
             }}
             title="Gérer les données CA de toutes les boutiques"
           >
             🏪 Gestion CA
           </button>
         </div>
         
         {/* Affichage des données CA importées */}
         {importedCAData.length > 0 && (
           <div style={{
             marginTop: '15px',
             padding: '12px',
             backgroundColor: '#e8f5e8',
             borderRadius: '8px',
             border: '1px solid #28a745'
           }}>
             <div style={{
               display: 'flex',
               justifyContent: 'space-between',
               alignItems: 'center'
             }}>
               <span style={{ color: '#155724', fontWeight: 'bold' }}>
                 ✅ Données CA importées : {importedCAData.length} jours
               </span>
               <span style={{ color: '#155724', fontSize: '14px' }}>
                 Total du mois : {getImportedMonthlyCA()?.totalCA || '0.00'} €
               </span>
             </div>
           </div>
         )}
       </div>

               {/* Sélecteur d'employés */}
        <div style={{ 
          background: 'white', 
          padding: '20px', 
          borderRadius: '12px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3 style={{ color: '#333', margin: '0' }}>👥 Sélectionner des employés</h3>
            {shopEmployees.length > 0 && (
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={handleSelectAllEmployees}
                  style={{
                    padding: '6px 12px',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '12px',
                    background: '#28a745',
                    color: 'white'
                  }}
                >
                  Tout sélectionner
                </button>
                <button
                  onClick={handleClearEmployeeSelection}
                  style={{
                    padding: '6px 12px',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '12px',
                    background: '#dc3545',
                    color: 'white'
                  }}
                >
                  Effacer
                </button>
              </div>
            )}
          </div>
          
          {shopEmployees.length > 0 ? (
            <>
                          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {shopEmployees.map(employee => (
                <button
                  key={employee.id}
                  onClick={() => handleEmployeeToggle(employee.id)}
                  style={{
                    padding: '8px 14px',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '13px',
                    background: selectedEmployees.includes(employee.id) ? 'linear-gradient(135deg, #28a745 0%, #1e7e34 100%)' : '#f8f9fa',
                    color: selectedEmployees.includes(employee.id) ? 'white' : '#333',
                    transition: 'all 0.3s ease'
                  }}
                >
                  {employee.name}
                </button>
              ))}
            </div>
              {selectedEmployees.length > 0 && (
                <p style={{ 
                  margin: '10px 0 0 0', 
                  fontSize: '14px', 
                  color: '#666',
                  fontStyle: 'italic'
                }}>
                  {selectedEmployees.length} employé{selectedEmployees.length > 1 ? 's' : ''} sélectionné{selectedEmployees.length > 1 ? 's' : ''} 
                  {selectedEmployees.length < shopEmployees.length && ` (sur ${shopEmployees.length})`}
                </p>
              )}
            </>
          ) : (
            <div style={{ 
              textAlign: 'center', 
              padding: '20px',
              color: '#666',
              fontSize: '14px',
              fontStyle: 'italic'
            }}>
              Aucun employé trouvé pour cette boutique. 
              <br />
              Assurez-vous d'avoir créé des plannings pour cette boutique.
            </div>
          )}
        </div>

      {/* Sélecteur de mois */}
      <div style={{ 
        marginBottom: '30px',
        display: 'flex',
        alignItems: 'center',
        gap: '15px'
      }}>
        <label style={{ fontWeight: '600', color: '#333' }}>Mois :</label>
        <input
          type="month"
          value={format(new Date(selectedMonth), 'yyyy-MM')}
          onChange={(e) => setSelectedMonth(e.target.value + '-01')}
          style={{
            padding: '8px 12px',
            border: '1px solid #ddd',
            borderRadius: '6px',
            fontSize: '14px'
          }}
        />
      </div>

      {/* Onglets */}
      <div style={{ 
        display: 'flex', 
        gap: '10px', 
        marginBottom: '30px',
        borderBottom: '1px solid #e0e0e0'
      }}>
                 {[
           { id: 'overview', label: 'Vue d\'ensemble', icon: '📈' },
           { id: 'employees', label: 'Par employé', icon: '👥' },
           { id: 'weekly', label: 'Par jour', icon: '📅' },
           { id: 'fragmented', label: 'Jours fragmentés', icon: '🔗' },
           { id: 'profitability', label: 'Rentabilité', icon: '💰' }
         ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '12px 20px',
              border: 'none',
              background: activeTab === tab.id ? '#007bff' : '#f8f9fa',
              color: activeTab === tab.id ? 'white' : '#333',
              borderRadius: '8px 8px 0 0',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '14px',
              transition: 'all 0.3s ease'
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Contenu des onglets */}
      <div style={{ minHeight: '400px' }}>
        {activeTab === 'overview' && (
          <div>
            <h2 style={{ color: '#333', marginBottom: '20px' }}>Vue d'ensemble</h2>
            
            {/* Cartes de statistiques */}
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
                textAlign: 'center'
              }}>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '18px' }}>Total Heures</h3>
                <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{totalHours}h</div>
                <p style={{ margin: '10px 0 0 0', opacity: '0.9' }}>Mois complet</p>
              </div>

              <div style={{
                background: 'linear-gradient(135deg, #28a745 0%, #1e7e34 100%)',
                color: 'white',
                padding: '25px',
                borderRadius: '12px',
                textAlign: 'center'
              }}>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '18px' }}>Employés</h3>
                <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{shopEmployees.length}</div>
                <p style={{ margin: '10px 0 0 0', opacity: '0.9' }}>Actifs ce mois</p>
              </div>

              <div style={{
                background: 'linear-gradient(135deg, #ffc107 0%, #e0a800 100%)',
                color: 'white',
                padding: '25px',
                borderRadius: '12px',
                textAlign: 'center'
              }}>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '18px' }}>Moyenne/Employé</h3>
                <div style={{ fontSize: '32px', fontWeight: 'bold' }}>
                  {shopEmployees.length > 0 ? (parseFloat(totalHours) / shopEmployees.length).toFixed(1) : '0'}h
                </div>
                <p style={{ margin: '10px 0 0 0', opacity: '0.9' }}>Par personne</p>
              </div>

              <div style={{
                background: 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)',
                color: 'white',
                padding: '25px',
                borderRadius: '12px',
                textAlign: 'center'
              }}>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '18px' }}>Jours Fragmentés</h3>
                <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{daysOutsideMonth.length}</div>
                <p style={{ margin: '10px 0 0 0', opacity: '0.9' }}>Hors mois</p>
              </div>
            </div>

            {/* Graphique des heures par jour de la semaine */}
            <div style={{ 
              background: 'white', 
              padding: '25px', 
              borderRadius: '12px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ color: '#333', marginBottom: '20px' }}>Répartition par jour de la semaine</h3>
              <div style={{ display: 'flex', alignItems: 'end', gap: '15px', height: '200px' }}>
                {Object.entries(weeklyStats).map(([day, hours]) => (
                  <div key={day} style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{
                      background: 'linear-gradient(135deg, #007bff 0%, #0056b3 100%)',
                      height: `${Math.max((hours / Math.max(...Object.values(weeklyStats))) * 150, 20)}px`,
                      borderRadius: '6px 6px 0 0',
                      marginBottom: '10px'
                    }}></div>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: '#333' }}>
                      {day.charAt(0).toUpperCase() + day.slice(1)}
                    </div>
                    <div style={{ fontSize: '11px', color: '#666' }}>{hours.toFixed(1)}h</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'employees' && (
          <div>
            <h2 style={{ color: '#333', marginBottom: '20px' }}>Détail par employé</h2>
            
            <div style={{ 
              background: 'white', 
              borderRadius: '12px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
              overflow: 'hidden'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8f9fa' }}>
                    <th style={{ padding: '15px', textAlign: 'left', borderBottom: '1px solid #dee2e6', fontWeight: '600' }}>
                      Employé
                    </th>
                    <th style={{ padding: '15px', textAlign: 'center', borderBottom: '1px solid #dee2e6', fontWeight: '600' }}>
                      Heures
                    </th>
                    <th style={{ padding: '15px', textAlign: 'center', borderBottom: '1px solid #dee2e6', fontWeight: '600' }}>
                      % du total
                    </th>
                    <th style={{ padding: '15px', textAlign: 'center', borderBottom: '1px solid #dee2e6', fontWeight: '600' }}>
                      Barre
                    </th>
                  </tr>
                </thead>
                                                  <tbody>
                    {(selectedEmployees.length > 0 ? selectedEmployees : shopEmployees.map(emp => emp.id)).map((employeeId, index) => {
                      const hours = calculateEmployeeHours(employeeId);
                      const percentage = parseFloat(totalHours) > 0 ? (parseFloat(hours) / parseFloat(totalHours) * 100) : 0;
                     
                     return (
                       <tr key={index} style={{ 
                         backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8f9fa',
                         borderBottom: '1px solid #dee2e6'
                       }}>
                         <td style={{ padding: '15px', fontWeight: '500' }}>
                           {getEmployeeName(employeeId)}
                         </td>
                         <td style={{ padding: '15px', textAlign: 'center', fontWeight: '600' }}>
                           {hours}h
                         </td>
                         <td style={{ padding: '15px', textAlign: 'center' }}>
                           {percentage.toFixed(1)}%
                         </td>
                         <td style={{ padding: '15px', textAlign: 'center' }}>
                           <div style={{
                             width: '100%',
                             height: '20px',
                             backgroundColor: '#e9ecef',
                             borderRadius: '10px',
                             overflow: 'hidden'
                           }}>
                             <div style={{
                               width: `${percentage}%`,
                               height: '100%',
                               background: 'linear-gradient(135deg, #007bff 0%, #0056b3 100%)',
                               transition: 'width 0.3s ease'
                             }}></div>
                           </div>
                         </td>
                       </tr>
                     );
                   })}
                 </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'weekly' && (
          <div>
            <h2 style={{ color: '#333', marginBottom: '20px' }}>Répartition par jour de la semaine</h2>
            
            <div style={{ 
              background: 'white', 
              borderRadius: '12px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
              padding: '25px'
            }}>
              <div style={{ display: 'flex', alignItems: 'end', gap: '20px', height: '300px' }}>
                {Object.entries(weeklyStats).map(([day, hours]) => {
                  const maxHours = Math.max(...Object.values(weeklyStats));
                  const height = maxHours > 0 ? (hours / maxHours) * 250 : 0;
                  
                  return (
                    <div key={day} style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{
                        background: 'linear-gradient(135deg, #007bff 0%, #0056b3 100%)',
                        height: `${height}px`,
                        borderRadius: '8px 8px 0 0',
                        marginBottom: '15px',
                        position: 'relative',
                        transition: 'all 0.3s ease'
                      }}>
                        <div style={{
                          position: 'absolute',
                          top: '-25px',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          background: '#333',
                          color: 'white',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          whiteSpace: 'nowrap'
                        }}>
                          {hours.toFixed(1)}h
                        </div>
                      </div>
                      <div style={{ 
                        fontSize: '14px', 
                        fontWeight: '600', 
                        color: '#333',
                        textTransform: 'capitalize'
                      }}>
                        {day}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'fragmented' && (
          <div>
            <h2 style={{ color: '#333', marginBottom: '20px' }}>Jours hors mois (fragmentés)</h2>
            
            {daysOutsideMonth.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                padding: '50px',
                color: '#666',
                fontSize: '16px'
              }}>
                Aucun jour fragmenté pour ce mois
              </div>
            ) : (
              <div style={{ 
                background: 'white', 
                borderRadius: '12px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                overflow: 'hidden'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8f9fa' }}>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6', fontWeight: '600' }}>
                        Employé
                      </th>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6', fontWeight: '600' }}>
                        Jour
                      </th>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6', fontWeight: '600' }}>
                        Date
                      </th>
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #dee2e6', fontWeight: '600' }}>
                        Heures
                      </th>
                      <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #dee2e6', fontWeight: '600' }}>
                        Statut
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {daysOutsideMonth.map((day, index) => (
                      <tr key={index} style={{ 
                        backgroundColor: day.isBeforeMonth ? '#fff3cd' : '#e3f2fd',
                        borderLeft: day.isBeforeMonth ? '4px solid #ffc107' : '4px solid #17a2b8'
                      }}>
                        <td style={{ padding: '12px', fontWeight: '500' }}>
                          {day.employeeName}
                        </td>
                        <td style={{ padding: '12px' }}>
                          {day.dayName}
                          <span style={{ 
                            fontSize: '10px', 
                            color: day.isBeforeMonth ? '#856404' : '#0c5460',
                            marginLeft: '4px',
                            fontWeight: 'bold'
                          }}>
                            {day.isBeforeMonth ? '←' : '→'}
                          </span>
                        </td>
                        <td style={{ padding: '12px' }}>{day.dayDate}</td>
                        <td style={{ padding: '12px', textAlign: 'center', fontWeight: '600' }}>
                          {day.hours.toFixed(1)} h
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <span style={{ 
                            padding: '4px 8px', 
                            borderRadius: '4px', 
                            fontWeight: 'bold',
                            color: 'white',
                            fontSize: '12px',
                            backgroundColor: day.isBeforeMonth ? '#28a745' : '#007bff'
                          }}>
                            {day.isBeforeMonth ? '✓ Payé' : '⏳ Fragmenté'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                <div style={{ 
                  padding: '20px',
                  backgroundColor: '#f8f9fa',
                  borderTop: '1px solid #dee2e6'
                }}>
                  <div style={{ 
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '14px'
                  }}>
                    <span style={{ fontWeight: '600', color: '#333' }}>
                      Total : {daysOutsideMonth.reduce((total, day) => total + day.hours, 0).toFixed(1)}h
                    </span>
                    <span style={{ color: '#666' }}>
                      {daysOutsideMonth.filter(day => day.isBeforeMonth).reduce((total, day) => total + day.hours, 0).toFixed(1)}h payées / {daysOutsideMonth.filter(day => !day.isBeforeMonth).reduce((total, day) => total + day.hours, 0).toFixed(1)}h fragmentées
                    </span>
                  </div>
                </div>
              </div>
                         )}
           </div>
         )}

         {activeTab === 'profitability' && (
           <div>
             <h2 style={{ color: '#333', marginBottom: '20px' }}>Analyse de rentabilité</h2>
             
             {/* Saisie des données financières */}
             <div style={{ 
               background: 'white', 
               padding: '25px', 
               borderRadius: '12px',
               boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
               marginBottom: '30px'
             }}>
               <h3 style={{ color: '#333', marginBottom: '20px', fontSize: '20px' }}>💰 Données financières</h3>
               
               {/* Curseur HT/TTC */}
               <div style={{ 
                 marginBottom: '25px',
                 textAlign: 'center'
               }}>
                 <h4 style={{ color: '#333', marginBottom: '15px', fontSize: '16px' }}>Mode de saisie</h4>
                 <div style={{ 
                   display: 'flex', 
                   alignItems: 'center', 
                   justifyContent: 'center',
                   gap: '15px',
                   background: '#f8f9fa',
                   padding: '10px',
                   borderRadius: '25px',
                   width: 'fit-content',
                   margin: '0 auto'
                 }}>
                   <span style={{ 
                     fontWeight: '600', 
                     color: revenueInputMode === 'TTC' ? '#007bff' : '#666',
                     fontSize: '14px'
                   }}>
                     TTC
                   </span>
                   <button
                     onClick={() => setRevenueInputMode(revenueInputMode === 'TTC' ? 'HT' : 'TTC')}
                     style={{
                       width: '50px',
                       height: '25px',
                       borderRadius: '25px',
                       border: 'none',
                       background: revenueInputMode === 'TTC' ? '#007bff' : '#6c757d',
                       cursor: 'pointer',
                       position: 'relative',
                       transition: 'all 0.3s ease'
                     }}
                   >
                     <div style={{
                       width: '20px',
                       height: '20px',
                       borderRadius: '50%',
                       background: 'white',
                       position: 'absolute',
                       top: '2.5px',
                       left: revenueInputMode === 'TTC' ? '3px' : '27px',
                       transition: 'all 0.3s ease'
                     }} />
                   </button>
                   <span style={{ 
                     fontWeight: '600', 
                     color: revenueInputMode === 'HT' ? '#007bff' : '#666',
                     fontSize: '14px'
                   }}>
                     HT
                   </span>
                 </div>
                 <p style={{ 
                   marginTop: '10px', 
                   fontSize: '12px', 
                   color: '#666',
                   fontStyle: 'italic'
                 }}>
                   Choisissez le mode de saisie pour vos montants
                 </p>
               </div>

               {/* Saisie des données selon le mode */}
               <div style={{ 
                 display: 'grid', 
                 gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
                 gap: '20px',
                 marginBottom: '25px'
               }}>
                 {/* Chiffre d'affaires */}
                 <div style={{ 
                   padding: '15px',
                   border: '1px solid #e0e0e0',
                   borderRadius: '8px',
                   backgroundColor: revenueInputMode === 'TTC' ? '#f8f9fa' : '#e8f5e8'
                 }}>
                   <h4 style={{ color: '#333', marginBottom: '10px', fontSize: '16px' }}>
                     Chiffre d'affaires {revenueInputMode}
                   </h4>
                   
                   {/* Affichage des données importées si disponibles */}
                   {importedCAData.length > 0 && revenueMode === 'monthly' && (
                     <div style={{
                       marginBottom: '10px',
                       padding: '8px',
                       backgroundColor: '#d4edda',
                       borderRadius: '4px',
                       border: '1px solid #c3e6cb'
                     }}>
                       <div style={{
                         display: 'flex',
                         justifyContent: 'space-between',
                         alignItems: 'center',
                         fontSize: '14px'
                       }}>
                         <span style={{ color: '#155724', fontWeight: 'bold' }}>
                           📊 CA importé automatiquement
                         </span>
                         <span style={{ color: '#155724' }}>
                           {getImportedMonthlyCA()?.totalCA || '0.00'} €
                         </span>
                       </div>
                     </div>
                   )}
                   
                   <div style={{ 
                     display: 'flex', 
                     alignItems: 'center', 
                     gap: '10px',
                     marginBottom: '10px'
                   }}>
                     <label style={{ fontWeight: '600', color: '#333', fontSize: '14px' }}>
                       CA {revenueMode === 'monthly' ? 'mensuel' : 'hebdomadaire'} ({revenueInputMode}) :
                     </label>
                     <input
                       type="number"
                       value={(() => {
                         // Si on a des données importées et qu'on est en mode mensuel, utiliser les données importées
                         if (importedCAData.length > 0 && revenueMode === 'monthly' && revenueInputMode === 'TTC') {
                           return getImportedMonthlyCA()?.totalCA || '0.00';
                         }
                         
                         // Sinon, utiliser les valeurs saisies manuellement
                         return revenueInputMode === 'TTC' 
                           ? (revenueMode === 'monthly' ? monthlyRevenue : weeklyRevenue)
                           : (revenueHTMode === 'monthly' ? monthlyRevenueHT : weeklyRevenueHT);
                       })()}
                       onChange={(e) => {
                         if (revenueInputMode === 'TTC') {
                           if (revenueMode === 'monthly') {
                             setMonthlyRevenue(e.target.value);
                           } else {
                             setWeeklyRevenue(e.target.value);
                           }
                         } else {
                           if (revenueHTMode === 'monthly') {
                             setMonthlyRevenueHT(e.target.value);
                           } else {
                             setWeeklyRevenueHT(e.target.value);
                           }
                         }
                       }}
                       placeholder="0.00"
                       style={{
                         padding: '8px 10px',
                         border: '1px solid #ddd',
                         borderRadius: '4px',
                         fontSize: '14px',
                         width: '120px',
                         backgroundColor: importedCAData.length > 0 && revenueMode === 'monthly' && revenueInputMode === 'TTC' ? '#e8f5e8' : 'white'
                       }}
                       readOnly={importedCAData.length > 0 && revenueMode === 'monthly' && revenueInputMode === 'TTC'}
                     />
                   </div>
                   <p style={{ fontSize: '12px', color: '#666', margin: '0' }}>
                     {importedCAData.length > 0 && revenueMode === 'monthly' && revenueInputMode === 'TTC'
                       ? '✅ Données importées automatiquement'
                       : revenueInputMode === 'TTC' 
                         ? '(pour les calculs de rentabilité)' 
                         : '(pour le calcul du taux de marge)'
                     }
                   </p>
                 </div>

                 {/* Marge réalisée */}
                 <div style={{ 
                   padding: '15px',
                   border: '1px solid #e0e0e0',
                   borderRadius: '8px',
                   backgroundColor: '#d4edda'
                 }}>
                   <h4 style={{ color: '#333', marginBottom: '10px', fontSize: '16px' }}>Marge réalisée</h4>
                   <div style={{ 
                     display: 'flex', 
                     alignItems: 'center', 
                     gap: '10px'
                   }}>
                     <label style={{ fontWeight: '600', color: '#333', fontSize: '14px' }}>
                       Marge {marginMode === 'monthly' ? 'mensuelle' : 'hebdomadaire'} (€) :
                     </label>
                     <input
                       type="number"
                       value={marginMode === 'monthly' ? monthlyMargin : weeklyMargin}
                       onChange={(e) => {
                         if (marginMode === 'monthly') {
                           setMonthlyMargin(e.target.value);
                         } else {
                           setWeeklyMargin(e.target.value);
                         }
                       }}
                       placeholder="0.00"
                       style={{
                         padding: '8px 10px',
                         border: '1px solid #ddd',
                         borderRadius: '4px',
                         fontSize: '14px',
                         width: '120px'
                       }}
                     />
                   </div>
                   <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                     (marge brute réalisée)
                   </p>
                 </div>
               </div>

               {/* Boutons de mode */}
               <div style={{ 
                 display: 'flex', 
                 gap: '15px', 
                 justifyContent: 'center',
                 marginBottom: '25px'
               }}>
                 <button
                   onClick={() => {
                     setRevenueMode('monthly');
                     setRevenueHTMode('monthly');
                     setMarginMode('monthly');
                   }}
                   style={{
                     padding: '10px 20px',
                     border: 'none',
                     borderRadius: '8px',
                     cursor: 'pointer',
                     fontWeight: '600',
                     fontSize: '14px',
                     background: revenueMode === 'monthly' ? 'linear-gradient(135deg, #007bff 0%, #0056b3 100%)' : '#f8f9fa',
                     color: revenueMode === 'monthly' ? 'white' : '#333',
                     transition: 'all 0.3s ease'
                   }}
                 >
                   📅 Mensuel
                 </button>
                 <button
                   onClick={() => {
                     setRevenueMode('weekly');
                     setRevenueHTMode('weekly');
                     setMarginMode('weekly');
                   }}
                   style={{
                     padding: '10px 20px',
                     border: 'none',
                     borderRadius: '8px',
                     cursor: 'pointer',
                     fontWeight: '600',
                     fontSize: '14px',
                     background: revenueMode === 'weekly' ? 'linear-gradient(135deg, #007bff 0%, #0056b3 100%)' : '#f8f9fa',
                     color: revenueMode === 'weekly' ? 'white' : '#333',
                     transition: 'all 0.3s ease'
                   }}
                 >
                   📊 Hebdomadaire
                 </button>
               </div>

               {/* Bouton de démarrage des calculs */}
               <div style={{ 
                 textAlign: 'center'
               }}>
                 {!showCalculations ? (
                   <button
                     onClick={handleStartCalculations}
                     disabled={!getCurrentRevenue() || !getCurrentMargin()}
                     style={{
                       padding: '15px 30px',
                       border: 'none',
                       borderRadius: '10px',
                       cursor: getCurrentRevenue() && getCurrentMargin() ? 'pointer' : 'not-allowed',
                       fontWeight: '600',
                       fontSize: '18px',
                       background: getCurrentRevenue() && getCurrentMargin() ? 'linear-gradient(135deg, #28a745 0%, #1e7e34 100%)' : '#6c757d',
                       color: 'white',
                       transition: 'all 0.3s ease',
                       boxShadow: getCurrentRevenue() && getCurrentMargin() ? '0 4px 15px rgba(40, 167, 69, 0.3)' : 'none'
                     }}
                   >
                     🚀 Démarrer les calculs
                   </button>
                 ) : (
                   <button
                     onClick={handleResetCalculations}
                     style={{
                       padding: '10px 20px',
                       border: 'none',
                       borderRadius: '8px',
                       cursor: 'pointer',
                       fontWeight: '600',
                       fontSize: '14px',
                       background: 'linear-gradient(135deg, #6c757d 0%, #495057 100%)',
                       color: 'white',
                       transition: 'all 0.3s ease'
                     }}
                   >
                     🔄 Nouveaux calculs
                   </button>
                 )}
                 
                 {(!getCurrentRevenue() || !getCurrentMargin()) && !showCalculations && (
                   <p style={{ 
                     marginTop: '15px', 
                     fontSize: '14px', 
                     color: '#666',
                     fontStyle: 'italic'
                   }}>
                     Veuillez saisir le CA et la marge pour démarrer les calculs
                   </p>
                 )}
               </div>
             </div>

             {/* Cartes de rentabilité */}
             {showCalculations && (
               <>
                 <div style={{ 
                   display: 'grid', 
                   gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
                   gap: '20px',
                   marginBottom: '30px'
                 }}>
                   <div style={{
                     background: 'linear-gradient(135deg, #28a745 0%, #1e7e34 100%)',
                     color: 'white',
                     padding: '25px',
                     borderRadius: '12px',
                     textAlign: 'center'
                   }}>
                     <h3 style={{ margin: '0 0 10px 0', fontSize: '18px' }}>CA par heure</h3>
                     <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{calculateRevenuePerHour()}€</div>
                     <p style={{ margin: '10px 0 0 0', opacity: '0.9' }}>Rentabilité horaire</p>
                   </div>

                   <div style={{
                     background: 'linear-gradient(135deg, #17a2b8 0%, #138496 100%)',
                     color: 'white',
                     padding: '25px',
                     borderRadius: '12px',
                     textAlign: 'center'
                   }}>
                     <h3 style={{ margin: '0 0 10px 0', fontSize: '18px' }}>CA par employé</h3>
                     <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{calculateRevenuePerEmployee() || '0.00'}€</div>
                     <p style={{ margin: '10px 0 0 0', opacity: '0.9' }}>Productivité employé</p>
                   </div>

                   <div style={{
                     background: 'linear-gradient(135deg, #6f42c1 0%, #5a2d91 100%)',
                     color: 'white',
                     padding: '25px',
                     borderRadius: '12px',
                     textAlign: 'center'
                   }}>
                     <h3 style={{ margin: '0 0 10px 0', fontSize: '18px' }}>CA total boutique</h3>
                     <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{calculateRevenuePerShop()}€</div>
                     <p style={{ margin: '10px 0 0 0', opacity: '0.9' }}>Chiffre d'affaires</p>
                   </div>

                   <div style={{
                     background: 'linear-gradient(135deg, #fd7e14 0%, #e55a00 100%)',
                     color: 'white',
                     padding: '25px',
                     borderRadius: '12px',
                     textAlign: 'center'
                   }}>
                     <h3 style={{ margin: '0 0 10px 0', fontSize: '18px' }}>Heures totales</h3>
                     <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{totalHours}h</div>
                     <p style={{ margin: '10px 0 0 0', opacity: '0.9' }}>Temps de travail</p>
                   </div>

                   <div style={{
                     background: 'linear-gradient(135deg, #20c997 0%, #17a2b8 100%)',
                     color: 'white',
                     padding: '25px',
                     borderRadius: '12px',
                     textAlign: 'center'
                   }}>
                     <h3 style={{ margin: '0 0 10px 0', fontSize: '18px' }}>CA par jour</h3>
                     <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{calculateDailyRevenue()}€</div>
                     <p style={{ margin: '10px 0 0 0', opacity: '0.9' }}>Moyenne journalière</p>
                   </div>

                   <div style={{
                     background: 'linear-gradient(135deg, #e83e8c 0%, #d63384 100%)',
                     color: 'white',
                     padding: '25px',
                     borderRadius: '12px',
                     textAlign: 'center'
                   }}>
                     <h3 style={{ margin: '0 0 10px 0', fontSize: '18px' }}>CA/jour travaillé</h3>
                     <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{calculateRevenuePerWorkDay()}€</div>
                     <p style={{ margin: '10px 0 0 0', opacity: '0.9' }}>Rentabilité réelle</p>
                   </div>

                   <div style={{
                     background: 'linear-gradient(135deg, #6c757d 0%, #495057 100%)',
                     color: 'white',
                     padding: '25px',
                     borderRadius: '12px',
                     textAlign: 'center'
                   }}>
                     <h3 style={{ margin: '0 0 10px 0', fontSize: '18px' }}>CA/employé/jour</h3>
                     <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{calculateRevenuePerEmployeePerDay()}€</div>
                     <p style={{ margin: '10px 0 0 0', opacity: '0.9' }}>Productivité quotidienne</p>
                   </div>

                   <div style={{
                     background: 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)',
                     color: 'white',
                     padding: '25px',
                     borderRadius: '12px',
                     textAlign: 'center'
                   }}>
                     <h3 style={{ margin: '0 0 10px 0', fontSize: '18px' }}>CA/employé/heure</h3>
                     <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{calculateRevenuePerEmployeePerHour()}€</div>
                     <p style={{ margin: '10px 0 0 0', opacity: '0.9' }}>Efficacité horaire</p>
                   </div>

                   <div style={{
                     background: 'linear-gradient(135deg, #28a745 0%, #1e7e34 100%)',
                     color: 'white',
                     padding: '25px',
                     borderRadius: '12px',
                     textAlign: 'center'
                   }}>
                     <h3 style={{ margin: '0 0 10px 0', fontSize: '18px' }}>Marge réalisée</h3>
                     <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{calculateGrossMargin()}€</div>
                     <p style={{ margin: '10px 0 0 0', opacity: '0.9' }}>Marge directe du CA TTC</p>
                   </div>

                   <div style={{
                     background: 'linear-gradient(135deg, #17a2b8 0%, #138496 100%)',
                     color: 'white',
                     padding: '25px',
                     borderRadius: '12px',
                     textAlign: 'center'
                   }}>
                     <h3 style={{ margin: '0 0 10px 0', fontSize: '18px' }}>Marge nette</h3>
                     <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{calculateNetMargin()}€</div>
                     <p style={{ margin: '10px 0 0 0', opacity: '0.9' }}>CA - Coûts totaux</p>
                   </div>

                   <div style={{
                     background: 'linear-gradient(135deg, #6f42c1 0%, #5a2d91 100%)',
                     color: 'white',
                     padding: '25px',
                     borderRadius: '12px',
                     textAlign: 'center'
                   }}>
                     <h3 style={{ margin: '0 0 10px 0', fontSize: '18px' }}>Taux marge réalisée</h3>
                     <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{calculateGrossMarginRate()}%</div>
                     <p style={{ margin: '10px 0 0 0', opacity: '0.9' }}>Marge réalisée / CA</p>
                   </div>

                   <div style={{
                     background: 'linear-gradient(135deg, #fd7e14 0%, #e55a00 100%)',
                     color: 'white',
                     padding: '25px',
                     borderRadius: '12px',
                     textAlign: 'center'
                   }}>
                     <h3 style={{ margin: '0 0 10px 0', fontSize: '18px' }}>Marge/heure</h3>
                     <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{calculateMarginPerHour()}€</div>
                     <p style={{ margin: '10px 0 0 0', opacity: '0.9' }}>Rentabilité horaire</p>
                   </div>

                   <div style={{
                     background: 'linear-gradient(135deg, #20c997 0%, #17a2b8 100%)',
                     color: 'white',
                     padding: '25px',
                     borderRadius: '12px',
                     textAlign: 'center'
                   }}>
                     <h3 style={{ margin: '0 0 10px 0', fontSize: '18px' }}>Marge/employé</h3>
                     <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{calculateMarginPerEmployee()}€</div>
                     <p style={{ margin: '10px 0 0 0', opacity: '0.9' }}>Rentabilité employé</p>
                   </div>

                   {calculationsPerformed && (
                     <div style={{
                       background: 'linear-gradient(135deg, #ffc107 0%, #e0a800 100%)',
                       color: 'white',
                       padding: '25px',
                       borderRadius: '12px',
                       textAlign: 'center'
                     }}>
                       <h3 style={{ margin: '0 0 10px 0', fontSize: '18px' }}>Achats calculés</h3>
                       <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{calculatedPurchases.toFixed(2)}€</div>
                       <p style={{ margin: '10px 0 0 0', opacity: '0.9' }}>CA - Marge réalisée</p>
                     </div>
                   )}
                 </div>

                 {/* Bouton pour calculer les achats */}
                 {!calculationsPerformed && (
                   <div style={{ 
                     textAlign: 'center',
                     marginBottom: '30px'
                   }}>
                     <button
                       onClick={handleCalculatePurchases}
                       style={{
                         padding: '12px 24px',
                         border: 'none',
                         borderRadius: '8px',
                         cursor: 'pointer',
                         fontWeight: '600',
                         fontSize: '16px',
                         background: 'linear-gradient(135deg, #ffc107 0%, #e0a800 100%)',
                         color: 'white',
                         transition: 'all 0.3s ease'
                       }}
                     >
                       🧮 Calculer les achats
                     </button>
                   </div>
                 )}

                 {/* Tableau détaillé de rentabilité */}
                 <div style={{ 
                   background: 'white', 
                   borderRadius: '12px',
                   boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                   overflow: 'hidden'
                 }}>
                   <h3 style={{ color: '#333', margin: '20px 20px 0 20px' }}>Détail de rentabilité par employé</h3>
                   <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                     <thead>
                       <tr style={{ backgroundColor: '#f8f9fa' }}>
                         <th style={{ padding: '15px', textAlign: 'left', borderBottom: '1px solid #dee2e6', fontWeight: '600' }}>
                           Employé
                         </th>
                         <th style={{ padding: '15px', textAlign: 'center', borderBottom: '1px solid #dee2e6', fontWeight: '600' }}>
                           Heures
                         </th>
                         <th style={{ padding: '15px', textAlign: 'center', borderBottom: '1px solid #dee2e6', fontWeight: '600' }}>
                           CA généré
                         </th>
                         <th style={{ padding: '15px', textAlign: 'center', borderBottom: '1px solid #dee2e6', fontWeight: '600' }}>
                           CA/heure
                         </th>
                         <th style={{ padding: '15px', textAlign: 'center', borderBottom: '1px solid #dee2e6', fontWeight: '600' }}>
                           % du CA total
                         </th>
                         <th style={{ padding: '15px', textAlign: 'center', borderBottom: '1px solid #dee2e6', fontWeight: '600' }}>
                           CA/jour
                         </th>
                         <th style={{ padding: '15px', textAlign: 'center', borderBottom: '1px solid #dee2e6', fontWeight: '600' }}>
                           CA/employé/jour
                         </th>
                         <th style={{ padding: '15px', textAlign: 'center', borderBottom: '1px solid #dee2e6', fontWeight: '600' }}>
                           CA/employé/heure
                         </th>
                         <th style={{ padding: '15px', textAlign: 'center', borderBottom: '1px solid #dee2e6', fontWeight: '600' }}>
                           Marge réalisée
                         </th>
                         <th style={{ padding: '15px', textAlign: 'center', borderBottom: '1px solid #dee2e6', fontWeight: '600' }}>
                           Marge/heure
                         </th>
                         <th style={{ padding: '15px', textAlign: 'center', borderBottom: '1px solid #dee2e6', fontWeight: '600' }}>
                           Marge/employé
                         </th>
                         {calculationsPerformed && (
                           <th style={{ padding: '15px', textAlign: 'center', borderBottom: '1px solid #dee2e6', fontWeight: '600' }}>
                             Achats/employé
                           </th>
                         )}
                       </tr>
                     </thead>
                     <tbody>
                       {(selectedEmployees.length > 0 ? selectedEmployees : shopEmployees.map(emp => emp.id)).map((employeeId, index) => {
                         const hours = calculateEmployeeHours(employeeId);
                         const employeeRevenue = parseFloat(hours) * parseFloat(calculateRevenuePerHour());
                         const revenuePerHour = parseFloat(calculateRevenuePerHour());
                         const totalRevenue = getCurrentRevenue();
                         const percentageOfTotal = totalRevenue > 0 ? (employeeRevenue / totalRevenue * 100) : 0;
                         
                         // Calculer le CA quotidien par employé
                         const currentDate = new Date(selectedMonth);
                         const year = currentDate.getFullYear();
                         const month = currentDate.getMonth();
                         const lastDayOfMonth = new Date(year, month + 1, 0);
                         const daysInMonth = lastDayOfMonth.getDate();
                         const dailyRevenuePerEmployee = employeeRevenue / daysInMonth;
                         
                         // Calculer les nouvelles métriques par employé
                         const employeeCount = selectedEmployees.length > 0 ? selectedEmployees.length : shopEmployees.length;
                         const revenuePerEmployeePerDay = employeeCount > 0 ? (totalRevenue / employeeCount / daysInMonth) : 0;
                         const revenuePerEmployeePerHour = employeeCount > 0 && parseFloat(hours) > 0 ? (totalRevenue / employeeCount / parseFloat(hours)) : 0;
                         
                         // Calculer les métriques de marge par employé
                         const grossMargin = getCurrentMargin();
                         const employeeMargin = parseFloat(hours) * parseFloat(calculateMarginPerHour());
                         const marginPerEmployee = employeeCount > 0 ? (grossMargin / employeeCount) : 0;
                         
                         return (
                           <tr key={index} style={{ 
                             backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8f9fa',
                             borderBottom: '1px solid #dee2e6'
                           }}>
                             <td style={{ padding: '15px', fontWeight: '500' }}>
                               {getEmployeeName(employeeId)}
                             </td>
                             <td style={{ padding: '15px', textAlign: 'center', fontWeight: '600' }}>
                               {hours}h
                             </td>
                             <td style={{ padding: '15px', textAlign: 'center', fontWeight: '600', color: '#28a745' }}>
                               {employeeRevenue.toFixed(2)}€
                             </td>
                             <td style={{ padding: '15px', textAlign: 'center', color: '#007bff' }}>
                               {revenuePerHour.toFixed(2)}€
                             </td>
                             <td style={{ padding: '15px', textAlign: 'center' }}>
                               {percentageOfTotal.toFixed(1)}%
                             </td>
                             <td style={{ padding: '15px', textAlign: 'center', fontWeight: '600', color: '#e83e8c' }}>
                               {dailyRevenuePerEmployee.toFixed(2)}€
                             </td>
                             <td style={{ padding: '15px', textAlign: 'center', fontWeight: '600', color: '#6c757d' }}>
                               {revenuePerEmployeePerDay.toFixed(2)}€
                             </td>
                             <td style={{ padding: '15px', textAlign: 'center', fontWeight: '600', color: '#dc3545' }}>
                               {revenuePerEmployeePerHour.toFixed(2)}€
                             </td>
                             <td style={{ padding: '15px', textAlign: 'center', fontWeight: '600', color: '#28a745' }}>
                               {employeeMargin.toFixed(2)}€
                             </td>
                             <td style={{ padding: '15px', textAlign: 'center', fontWeight: '600', color: '#fd7e14' }}>
                               {calculateMarginPerHour()}€
                             </td>
                             <td style={{ padding: '15px', textAlign: 'center', fontWeight: '600', color: '#20c997' }}>
                               {marginPerEmployee.toFixed(2)}€
                             </td>
                             {calculationsPerformed && (
                               <td style={{ padding: '15px', textAlign: 'center', fontWeight: '600', color: '#ffc107' }}>
                                 {(employeeRevenue - employeeMargin).toFixed(2)}€
                               </td>
                             )}
                           </tr>
                         );
                       })}
                       <tr style={{ backgroundColor: '#e9ecef', fontWeight: 'bold' }}>
                         <td style={{ padding: '15px', borderTop: '2px solid #dee2e6' }}>TOTAL</td>
                         <td style={{ padding: '15px', textAlign: 'center', borderTop: '2px solid #dee2e6' }}>
                           {totalHours}h
                         </td>
                         <td style={{ padding: '15px', textAlign: 'center', borderTop: '2px solid #dee2e6', color: '#28a745' }}>
                           {getCurrentRevenue().toFixed(2)}€
                         </td>
                         <td style={{ padding: '15px', textAlign: 'center', borderTop: '2px solid #dee2e6', color: '#007bff' }}>
                           {calculateRevenuePerHour()}€
                         </td>
                         <td style={{ padding: '15px', textAlign: 'center', borderTop: '2px solid #dee2e6' }}>
                           100%
                         </td>
                         <td style={{ padding: '15px', textAlign: 'center', borderTop: '2px solid #dee2e6', color: '#e83e8c' }}>
                           {calculateDailyRevenue()}€
                         </td>
                         <td style={{ padding: '15px', textAlign: 'center', borderTop: '2px solid #dee2e6', color: '#6c757d' }}>
                           {calculateRevenuePerEmployeePerDay()}€
                         </td>
                         <td style={{ padding: '15px', textAlign: 'center', borderTop: '2px solid #dee2e6', color: '#dc3545' }}>
                           {calculateRevenuePerEmployeePerHour()}€
                         </td>
                         <td style={{ padding: '15px', textAlign: 'center', borderTop: '2px solid #dee2e6', color: '#28a745' }}>
                           {calculateGrossMargin()}€
                         </td>
                         <td style={{ padding: '15px', textAlign: 'center', borderTop: '2px solid #dee2e6', color: '#fd7e14' }}>
                           {calculateMarginPerHour()}€
                         </td>
                         <td style={{ padding: '15px', textAlign: 'center', borderTop: '2px solid #dee2e6', color: '#20c997' }}>
                           {calculateMarginPerEmployee()}€
                         </td>
                         {calculationsPerformed && (
                           <td style={{ padding: '15px', textAlign: 'center', borderTop: '2px solid #dee2e6', color: '#ffc107' }}>
                             {calculatedPurchases.toFixed(2)}€
                           </td>
                         )}
                       </tr>
                     </tbody>
                   </table>
                 </div>
               </>
             )}
           </div>
         )}
      </div>
      
      {/* Modal d'import Excel */}
      <ExcelImportModal
        isOpen={showExcelImportModal}
        onClose={() => setShowExcelImportModal(false)}
        shops={shops}
        currentShop={currentShop}
        selectedMonth={selectedMonth}
        onImportSuccess={handleImportSuccess}
      />
      
      {/* Page de gestion des CA */}
      {showCAManagement && (
        <CAManagementPage
          shops={shops}
          onClose={() => setShowCAManagement(false)}
        />
      )}
      
      {/* Modale d'import de données complètes */}
      {showCompleteDataImport && (
        <CompleteDataImportPage
          onClose={() => setShowCompleteDataImport(false)}
        />
      )}
    </div>
  );
};

export default ShopStatsPage; 