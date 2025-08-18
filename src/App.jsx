import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { loadFromLocalStorage, saveToLocalStorage } from './utils/localStorage';
import ErrorBoundary from './components/common/ErrorBoundary';
import CopyrightNotice from './components/common/CopyrightNotice';

// import LicenseManager from './components/admin/LicenseManager';
// import { enableProtection } from './utils/protection';
// import { loadLicense, isLicenseValid, checkLicenseLimits } from './utils/licenseManagerVercel';
// import './utils/createFullLicense';
// import './utils/licenseKeyGenerator';
// import './utils/licenseCreator';
import MainStartupScreen from './components/MainStartupScreen';
import StartupScreen from './components/StartupScreen';

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
} from './utils/planningDataManager';
import './App.css';
import { loadRemotePlanning } from './utils/remoteStore';

const App = () => {
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
  const [mode, setMode] = useState('main-startup'); // 'main-startup', 'startup', 'new', 'imported', 'week-selection', 'planning', 'cash-register'
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

  // Charger les données depuis localStorage au démarrage
  useEffect(() => {
    try {
      // Charger les données depuis localStorage si elles existent
      const savedData = loadFromLocalStorage('planningData');
      console.log('Données chargées depuis localStorage:', savedData);
      
      if (savedData && savedData.version === "2.0" && savedData.shops && savedData.shops.length > 0) {
        // Vérifier que les données sont complètes et valides
        const isValidData = savedData.shops.every(shop => 
          shop.id && shop.name && shop.config && Array.isArray(shop.employees)
        );
        
        if (isValidData) {
          setPlanningData(savedData);
          setMode('week-selection');
          // Sélectionner automatiquement la première boutique
          setSelectedShop(savedData.shops[0].id);
          console.log('Données valides chargées, passage en mode week-selection');
          setRestoredInfo('🔄 Données restaurées depuis le stockage local');
        } else {
          console.log('Données corrompues détectées, nettoyage du localStorage');
          localStorage.clear();
          setMode('startup');
          setRestoredInfo('');
        }
      } else if (savedData && savedData.version === "2.0" && (!savedData.shops || savedData.shops.length === 0)) {
        // Données vides ou corrompues, nettoyer et retourner à l'écran de démarrage
        console.log('Données vides détectées, nettoyage du localStorage');
        localStorage.clear();
        setMode('startup');
        setRestoredInfo('');
      } else {
        // Aucune donnée ou format incorrect, nettoyer et retourner à l'écran de démarrage
        console.log('Aucune donnée valide trouvée, nettoyage du localStorage');
        localStorage.clear();
        setMode('startup');
        setRestoredInfo('');
      }
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
      console.log('Nettoyage du localStorage suite à l\'erreur');
      localStorage.clear();
      setMode('startup');
      setRestoredInfo('');
    }
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

  // Protection désactivée
  // useEffect(() => {
  //   enableProtection();
  // }, []);

  // Vérification de licence désactivée
  // useEffect(() => { ... }, [planningData]);

  // Gestion du démarrage
  const handleNewPlanning = () => {
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

  // Démarrer directement sur une boutique depuis l'écran de démarrage
  const handleStartWithShop = (shopId) => {
    try {
      console.log('🚀 handleStartWithShop appelé avec:', shopId);
      console.log('📊 planningData:', planningData);
      
      // Si on a des données de planning normales
      if (planningData?.shops && planningData.shops.length > 0) {
        const exists = planningData.shops.some(s => s.id === shopId);
        if (!exists) {
          console.log('❌ Boutique non trouvée dans planningData.shops');
          return;
        }
        setSelectedShop(shopId);
        // Préparer semaine courante par défaut
        const currentWeekKey = format(new Date(), 'yyyy-MM-dd');
        setSelectedWeek(currentWeekKey);
        setMode('week-selection');
        setFeedback('Sélectionnez la semaine pour commencer.');
        return;
      }
      
      // Si on n'a pas de données normales, essayer de charger depuis localStorage
      const savedPlanningData = localStorage.getItem('planningData');
      if (savedPlanningData) {
        try {
          const parsedData = JSON.parse(savedPlanningData);
          console.log('📦 Données chargées depuis localStorage:', parsedData);
          
          if (parsedData.shops && parsedData.shops.length > 0) {
            const exists = parsedData.shops.some(s => s.id === shopId);
            if (exists) {
              // Mettre à jour planningData avec les données restaurées
              setPlanningData(parsedData);
              setSelectedShop(shopId);
              const currentWeekKey = format(new Date(), 'yyyy-MM-dd');
              setSelectedWeek(currentWeekKey);
              setMode('week-selection');
              setFeedback('Planning restauré ! Sélectionnez la semaine pour commencer.');
              return;
            }
          }
        } catch (error) {
          console.error('❌ Erreur parsing localStorage:', error);
        }
      }
      
      console.log('❌ Aucune donnée valide trouvée pour la boutique:', shopId);
      setFeedback('Aucune donnée trouvée pour cette boutique. Veuillez d\'abord restaurer depuis Supabase.');
      
    } catch (error) {
      console.error('❌ Erreur dans handleStartWithShop:', error);
      setFeedback('Erreur lors du démarrage sur cette boutique.');
    }
  };

  // Aller directement au planning après restauration depuis Supabase
  const handleRestoreFromSupabase = () => {
    try {
      console.log('🔄 handleRestoreFromSupabase appelé dans App.jsx');
      console.log('📊 planningData actuel:', planningData);
      
      // Charger les données depuis localStorage
      const savedPlanningData = localStorage.getItem('planningData');
      if (!savedPlanningData) {
        setFeedback('Aucune donnée trouvée. Veuillez d\'abord restaurer depuis Supabase.');
        return;
      }
      
      try {
        const parsedData = JSON.parse(savedPlanningData);
        console.log('📦 Données chargées depuis localStorage:', parsedData);
        
        if (!parsedData.shops || parsedData.shops.length === 0) {
          setFeedback('Aucune boutique trouvée dans les données restaurées.');
          return;
        }
        
        // Mettre à jour planningData avec les données restaurées
        setPlanningData(parsedData);
        
        // Sélectionner la première boutique par défaut
        const firstShop = parsedData.shops[0];
        setSelectedShop(firstShop.id);
        
        // Sélectionner la semaine courante
        const currentWeekKey = format(new Date(), 'yyyy-MM-dd');
        setSelectedWeek(currentWeekKey);
        
        // Aller directement au planning
        setMode('planning');
        setFeedback('Planning restauré depuis Supabase !');
        
      } catch (error) {
        console.error('❌ Erreur parsing localStorage:', error);
        setFeedback('Erreur lors du chargement des données restaurées.');
      }
      
    } catch (error) {
      console.error('❌ Erreur dans handleRestoreFromSupabase:', error);
      setFeedback('Erreur lors de la restauration depuis Supabase.');
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
        setSelectedShop(importedData.shops[0].id);
      }
      
      // Aller à la sélection de semaine (comportement d'origine qui fonctionnait)
      setMode('week-selection');
      setFeedback('Import réussi ! Veuillez sélectionner une semaine.');
      

    } catch (error) {
      setFeedback(`Erreur d'import : ${error.message}`);
    }
  };

  const handleExit = () => {
    if (window.confirm('Êtes-vous sûr de vouloir quitter l\'application ?')) {
      window.close();
    }
  };

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
    setMode('startup'); // Retour à l'écran de démarrage du planning
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
        const firstShop = planningData.shops[0];
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
      const currentWeek = format(new Date(), 'yyyy-MM-dd');
      setSelectedWeek(currentWeek);
      
      // Initialiser les employés sélectionnés (employés affectés à la première boutique)
      if (planningData.shops && planningData.shops.length > 0 && 
          planningData.shops[0] && planningData.shops[0].employees && 
          planningData.shops[0].employees.length > 0) {
        const firstShop = planningData.shops[0];
        console.log('Première boutique:', firstShop);
        console.log('Tous les employés de la première boutique:', firstShop.employees);
        
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
  const handleExport = () => {
    try {
      const ok = exportPlanningToExcel(planningData);
      if (ok === true) {
        setFeedback('📊 Export Excel réussi !');
      } else {
        setFeedback('❌ Échec export Excel');
      }
    } catch (error) {
      console.error('Erreur lors de l\'export Excel:', error);
      setFeedback('❌ Échec export Excel');
    }
  };

  const handleReset = () => {
    setPlanningData(createNewPlanningData());
    setMode('startup');
    setCurrentStep(1);
    setCurrentShopIndex(0);
    setFeedback('Application réinitialisée');
  };

  // Fonctions de navigation pour PlanningDisplay
  const handleBackToEmployees = () => {
    setMode('new');
    setCurrentStep(4); // Étape de gestion des employés
  };

  const handleBackToShopSelection = () => {
    // S'assurer qu'une boutique est sélectionnée
    if (!selectedShop && planningData.shops && planningData.shops.length > 0) {
      setSelectedShop(planningData.shops[0].id);
    }
    setMode('week-selection');
  };

  const handleBackToWeekSelection = () => {
    // S'assurer qu'une boutique est sélectionnée
    if (!selectedShop && planningData.shops && planningData.shops.length > 0) {
      setSelectedShop(planningData.shops[0].id);
    }
    setMode('week-selection');
  };

  const handleBackToConfig = () => {
    setMode('new');
    setCurrentStep(2); // Étape de configuration des boutiques
  };

  // Rendu conditionnel
  if (mode === 'main-startup') {
    return (
      <ErrorBoundary>
        <MainStartupScreen 
          onSelectPlanning={handleSelectPlanning}
        />
        <CopyrightNotice />
      </ErrorBoundary>
    );
  }

  if (mode === 'startup') {
    return (
      <ErrorBoundary>
                  <StartupScreen
            onNewPlanning={handleNewPlanning}
            onImportPlanning={handleImportPlanning}
            onExit={handleExit}
            onClearLocalStorage={handleClearLocalStorage}
            onStartWithShop={handleStartWithShop}
            onRestoreFromSupabase={handleRestoreFromSupabase}
          />
        <CopyrightNotice />
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
              
              // Charger les données de la semaine sélectionnée
              if (planningData && selectedShop) {
                (async () => {
                  // Tentative de chargement distant
                  const remote = await loadRemotePlanning(selectedShop, week);
                  if (remote && remote.planning) {
                    setPlanning(remote.planning);
                    if (remote.selectedEmployees) setSelectedEmployees(remote.selectedEmployees);
                  } else {
                    // Fallback local
                    const shop = planningData.shops.find(s => s.id === selectedShop);
                    if (shop && shop.weeks && shop.weeks[week]) {
                      const weekData = shop.weeks[week];
                      if (weekData.planning) {
                        setPlanning(weekData.planning);
                      }
                      if (weekData.selectedEmployees) {
                        setSelectedEmployees(weekData.selectedEmployees);
                      }
                    }
                  }
                })();
              }
              
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
              onBackToWeekSelection={handleBackToWeekSelection}
              onBackToConfig={handleBackToConfig}
              setFeedback={setFeedback}
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
        <LicenseManager />
        <CopyrightNotice />
      </ErrorBoundary>
    );
  }

  return null;
};

export default App;