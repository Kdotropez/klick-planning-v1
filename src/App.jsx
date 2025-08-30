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
import UserIdentificationModal from './components/UserIdentificationModal';

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
import { versionChecker } from './utils/versionChecker';

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
  const [mode, setMode] = useState('identification'); // 'identification', 'main-startup', 'startup', 'new', 'imported', 'week-selection', 'planning', 'cash-register'
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

  // Charger les données depuis localStorage au démarrage
  useEffect(() => {
    try {
      // Initialiser le vérificateur de version
      versionChecker.init().catch(error => {
        console.error('❌ Erreur initialisation VersionChecker:', error);
      });

      // Vérifier si un utilisateur est déjà connecté
      const currentUser = localStorage.getItem('current_user');
      if (currentUser) {
        try {
          const user = JSON.parse(currentUser);
          setCurrentUser(user);
          console.log('🆔 Utilisateur déjà connecté:', user);
        } catch (e) {
          console.log('❌ Erreur parsing utilisateur, nettoyage');
          localStorage.removeItem('current_user');
        }
      }

      // Charger les données depuis localStorage si elles existent
      const savedData = loadFromLocalStorage('planningData');
      console.log('Données chargées depuis localStorage:', savedData);
      console.log('Structure complète des données:', {
        version: savedData?.version,
        hasShops: !!savedData?.shops,
        shopsLength: savedData?.shops?.length,
        allKeys: Object.keys(savedData || {}),
        shopsType: typeof savedData?.shops,
        isArray: Array.isArray(savedData?.shops)
      });
      
      // Si un utilisateur est connecté et qu'il y a des données valides, aller au démarrage principal
      if (currentUser && savedData && savedData.version === "2.0" && savedData.shops && savedData.shops.length > 0) {
        // Vérifier que les données sont complètes et valides
        const isValidData = savedData.shops.every(shop => 
          shop.id && shop.name && shop.config && Array.isArray(shop.employees)
        );
        
        if (isValidData) {
          setPlanningData(savedData);
          setMode('main-startup');
          console.log('Utilisateur connecté et données valides, passage au démarrage principal');
          setRestoredInfo('💾 Données locales disponibles - Choisissez votre action');
        } else {
          console.log('Données corrompues détectées, nettoyage du localStorage');
          localStorage.clear();
          setMode('identification');
          setRestoredInfo('');
        }
      } else if (savedData && savedData.version === "2.0" && savedData.shops && savedData.shops.length > 0) {
        // Données valides mais pas d'utilisateur connecté
        const isValidData = savedData.shops.every(shop => 
          shop.id && shop.name && shop.config && Array.isArray(shop.employees)
        );
        
        if (isValidData) {
          setPlanningData(savedData);
          setMode('identification');
          console.log('Données valides mais pas d\'utilisateur connecté, identification requise');
        } else {
          console.log('Données corrompues détectées, nettoyage du localStorage');
          localStorage.clear();
          setMode('identification');
          setRestoredInfo('');
        }
      } else {
        // Aucune donnée ou format incorrect, commencer par l'identification
        console.log('Aucune donnée valide trouvée, identification requise');
        if (savedData && savedData.version !== "2.0") {
          localStorage.clear();
        }
        setMode('identification');
        setRestoredInfo('');
      }
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
      console.log('Nettoyage du localStorage suite à l\'erreur');
      localStorage.clear();
      setMode('identification');
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

  // Gestion de l'identification
  const handleUserIdentification = (user) => {
    console.log('🆔 Utilisateur identifié:', user);
    setCurrentUser(user);
    setMode('main-startup');
    setFeedback(`👋 Bienvenue ${user.name} !`);
  };

  const handleIdentificationCancel = () => {
    // Optionnel : rediriger vers une page d'erreur ou fermer l'app
    alert('Identification requise pour accéder à l\'application.');
    // Ou simplement rester sur l'écran d'identification
  };

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



  // Aller directement au planning après restauration depuis Supabase
  // Continuer avec les données locales
  const handleContinueWithLocalData = () => {
    if (planningData && planningData.shops && planningData.shops.length > 0) {
      setSelectedShop(planningData.shops[0].id);
      setSelectedWeek(format(new Date(), 'yyyy-MM-dd'));
      setMode('week-selection');
      setFeedback('✅ Continuation avec les données locales');
    } else {
      setFeedback('❌ Aucune donnée locale disponible');
    }
  };

  const handleRestoreFromSupabase = async () => {
    console.log('🔄 handleRestoreFromSupabase appelé dans App.jsx');
    
    setFeedback('⏳ Chargement depuis Supabase...');
    
    try {
      // Initialiser Supabase
      const { createClient } = await import('@supabase/supabase-js');
      const url = import.meta.env.VITE_SUPABASE_URL;
      const key = import.meta.env.VITE_SUPABASE_KEY;
      
      if (!url || !key) {
        setFeedback('❌ Configuration Supabase manquante.');
        return;
      }
      
      const supabase = createClient(url, key);
      
      // Charger les données depuis Supabase avec fallback
      const { loadCompletePlanningData } = await import('./utils/remoteStore');
      
      // Initialiser le service Supabase pour loadCompletePlanningData
      const { initLockService } = await import('./utils/collabLock');
      await initLockService({ url, key });
      
      const restoredData = await loadCompletePlanningData();
      
      if (!restoredData) {
        setFeedback('❌ Aucune donnée trouvée sur Supabase.');
        return;
      }
      
      if (!restoredData.shops || restoredData.shops.length === 0) {
        setFeedback('❌ Aucune boutique trouvée dans les données.');
        return;
      }
      
      // Mettre à jour les données
      setPlanningData(restoredData);
      localStorage.setItem('planningData', JSON.stringify(restoredData));
      
      // Sélectionner la première boutique
      const firstShop = restoredData.shops[0];
      setSelectedShop(firstShop.id);
      setSelectedWeek(format(new Date(), 'yyyy-MM-dd'));
      
      // Aller à la sélection de semaine
      setMode('week-selection');
      setFeedback('✅ Planning restauré depuis Supabase ! Sélectionnez une semaine.');
      
    } catch (error) {
      console.error('❌ Erreur restauration:', error);
      setFeedback('❌ Erreur: ' + error.message);
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

  // Alias pour handleImportData (utilisé dans certains composants)
  const handleImportData = handleImportPlanning;

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
        <div style="background:#fff;padding:16px 20px;border-radius:8px;min-width:320px;font-family:Roboto, sans-serif">
          <div style="font-weight:700;margin-bottom:10px;font-size:14px">Exporter le mois</div>
          <div style="display:flex;gap:10px;align-items:center">
            <label for="export-month-input" style="min-width:90px;font-size:12px">Mois:</label>
            <input id="export-month-input" type="month" style="flex:1;padding:6px 8px;font-size:12px" value="${format(new Date(), 'yyyy-MM')}" />
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
        const ok = exportPlanningToExcel(planningData, { monthDate });
        if (ok === true) {
          setFeedback('📊 Export Excel réussi !');
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
            onRestoreFromSupabase={handleRestoreFromSupabase}
            onContinueWithLocalData={handleContinueWithLocalData}
            hasLocalData={planningData && planningData.shops && planningData.shops.length > 0}
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
              setFeedback={setFeedback}
              onRestoreFromSupabase={handleRestoreFromSupabase}
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

  // Mode identification
  if (mode === 'identification') {
    return (
      <ErrorBoundary>
        <UserIdentificationModal 
          onIdentification={handleUserIdentification}
          onCancel={handleIdentificationCancel}
        />
      </ErrorBoundary>
    );
  }

  return null;
};

export default App;