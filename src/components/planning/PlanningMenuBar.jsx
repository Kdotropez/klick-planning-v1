import React, { useState, useRef, useEffect } from 'react';
import { FaDownload, FaChevronDown, FaChevronUp, FaCog, FaChartBar, FaArrowLeft, FaTools } from 'react-icons/fa';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import Button from '../common/Button';
import '../../assets/styles.css';

const PlanningMenuBar = ({
  // Navigation
  currentShop,
  shops,
  currentWeek,
  changeWeek,
  changeShop,
  changeMonth,
  onBack,
  onBackToShop,
  onBackToWeek,
  onBackToConfig,
  onBackToStartup,
  
  // Actions
  onExport,
  onImport,
  onReset,
  setShowGlobalDayViewModalV2,
  handleManualSave,
  handleRestoreFromSupabase,
  // Modules
  onOpenDashboard,
  onOpenShopStats,
  onOpenGestion,
  onOpenNotes,
  
  // Récapitulatifs
  selectedEmployees,
  currentShopEmployees,
  setShowRecapModal,
  setShowMonthlyRecapModal,
  setShowEmployeeMonthlyRecap,
  setShowEmployeeWeeklyRecap,
  setShowMonthlyDetailModal,
  setShowEmployeeMonthlyDetail,
  setSelectedEmployeeForMonthlyRecap,
  setSelectedEmployeeForWeeklyRecap,
  setSelectedEmployeeForMonthlyDetail,
  
  // Calculs
  calculateEmployeeDayHours,
  calculateEmployeeWeekHours,
  calculateEmployeeMonthHours,
  calculateShopWeekHours,
  calculateGlobalMonthHours,
  calculateTotalSelectedEmployeesHours,
  calculateTotalShopEmployeesHours,
  getSelectedEmployeesCount,
  getTotalShopEmployeesCount,
  showCalendarTotals,
  onCreateJSONBackup,
  testSupabase,
  cleanSupabaseData,
  diagnoseSupabase,
  forceReleaseLock,
  diagnoseAndCleanLocks,
  // Sync/Outbox (optionnels)
  outboxSize = 0,
  onForceSync
}) => {
  const [openMenus, setOpenMenus] = useState({
    tools: false,
    retour: false,
    modules: false
  });
  const [toolbarMode, setToolbarMode] = useState(() => {
    try {
      return localStorage.getItem('planning_toolbar_mode') || 'smart';
    } catch (_) {
      return 'smart';
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('planning_toolbar_mode', toolbarMode);
    } catch (_) {}
  }, [toolbarMode]);
  
  const fileInputRef = useRef(null);

  const toggleMenu = (menuName) => {
    setOpenMenus(prev => ({
      ...prev,
      [menuName]: !prev[menuName]
    }));
  };

  const closeAllMenus = () => {
    setOpenMenus({
      tools: false,
      retour: false,
      modules: false
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

  const MenuButton = ({ icon, label, isOpen, onClick, children, badge }) => (
    <div style={{ position: 'relative' }}>
      <Button
        className="menu-button"
        onClick={onClick}
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
          gap: '8px',
          justifyContent: 'space-between',
          whiteSpace: 'nowrap'
        }}
        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1565c0'}
        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#1e88e5'}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {icon}
          {label}
        </div>
        {isOpen ? <FaChevronUp size={12} /> : <FaChevronDown size={12} />}
      </Button>
      {badge}
      
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            backgroundColor: 'white',
            border: '1px solid #ddd',
            borderRadius: '4px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 1000,
            minWidth: '200px',
            maxHeight: '400px',
            overflowY: 'auto'
          }}
        >
          {children}
        </div>
      )}
    </div>
  );

  const MenuItem = ({ onClick, children, style = {} }) => (
    <div
      onClick={() => {
        onClick();
        closeAllMenus();
      }}
      style={{
        padding: '10px 16px',
        cursor: 'pointer',
        borderBottom: '1px solid #f0f0f0',
        fontSize: '14px',
        ...style
      }}
      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
      onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}
    >
      {children}
    </div>
  );

  return (
    <div 
      style={{ 
        display: 'flex', 
        flexDirection: 'column',
        gap: '10px', 
        marginBottom: '15px'
      }}
      onClick={(e) => {
        // Fermer les menus si on clique en dehors
        const target = e.target;
        if (target && typeof target.closest === 'function' && !target.closest('.menu-button')) {
          closeAllMenus();
        }
      }}
    >
      {/* Bandeau de mode */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          title="Basculer l'affichage de la barre"
          onClick={() => setToolbarMode(toolbarMode === 'smart' ? 'classic' : 'smart')}
          style={{
            backgroundColor: '#f1f3f5',
            color: '#333',
            padding: '6px 10px',
            fontSize: '12px',
            border: '1px solid #dee2e6',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          {toolbarMode === 'smart' ? 'Mode classique' : 'Mode intelligent'}
        </Button>
      </div>

      {toolbarMode === 'smart' ? (
        // Mode intelligent: grille stricte 7x2, boutons étirés, pas de débordement
        <div style={{ 
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gridTemplateRows: 'repeat(2, minmax(50px, auto))',
          gridAutoFlow: 'row',
          justifyItems: 'stretch',
          alignItems: 'stretch',
          gap: '10px',
          overflowX: 'hidden',
          paddingBottom: '4px'
        }}>
          <Button
            className="button-primary"
            onClick={() => setShowGlobalDayViewModalV2(true)}
            style={{
              backgroundColor: '#1e88e5',
              color: '#fff',
              padding: '12px 18px',
              fontSize: '15px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              whiteSpace: 'nowrap'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1565c0'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#1e88e5'}
          >
            📊 Vue globale par jour
          </Button>

          <Button
            className="button-primary"
            onClick={onExport}
            style={{
              backgroundColor: '#28a745',
              color: '#fff',
              padding: '12px 18px',
              fontSize: '15px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              whiteSpace: 'nowrap'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#218838'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#28a745'}
          >
            <FaDownload /> Exporter les données
          </Button>

          <Button
            className="button-primary"
            onClick={handleManualSave}
            style={{
              backgroundColor: '#17a2b8',
              color: '#fff',
              padding: '12px 18px',
              fontSize: '15px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              whiteSpace: 'nowrap'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#138496'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#17a2b8'}
          >
            💾 SAUVE SUPABASE
          </Button>

          <Button
            className="button-primary"
            onClick={handleRestoreFromSupabase}
            style={{
              backgroundColor: '#6f42c1',
              color: '#fff',
              padding: '12px 18px',
              fontSize: '15px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              whiteSpace: 'nowrap'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#5a32a3'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#6f42c1'}
          >
            🔄 RESTAURE SUPABASE
          </Button>

          <Button
            className="button-primary"
            onClick={onCreateJSONBackup}
            style={{
              backgroundColor: '#20c997',
              color: '#fff',
              padding: '12px 18px',
              fontSize: '15px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              whiteSpace: 'nowrap'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#17a2b8'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#20c997'}
          >
            📦 JSON
          </Button>

          <Button
            className="button-primary"
            onClick={handleImportClick}
            style={{
              backgroundColor: '#ffc107',
              color: '#212529',
              padding: '12px 18px',
              fontSize: '15px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              whiteSpace: 'nowrap'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#e0a800'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#ffc107'}
          >
            📥 Importer les données
          </Button>

          {/* Menus - intégrés dans la même grille */}
          <MenuButton
            icon={<FaTools />}
            label="Outils"
            isOpen={openMenus.tools}
            onClick={() => toggleMenu('tools')}
            badge={
              outboxSize > 0 ? (
                <span
                  title={`Synchronisation en attente: ${outboxSize}`}
                  style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: '#ff9800'
                  }}
                />
              ) : (
                <span
                  title="Synchronisation à jour"
                  style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: '#4caf50'
                  }}
                />
              )
            }
          >
            <MenuItem onClick={() => onForceSync && onForceSync()}>
              🔄 Forcer la synchro {outboxSize > 0 ? `(${outboxSize})` : ''}
            </MenuItem>
            <MenuItem onClick={testSupabase}>
              🧪 Test Supabase
            </MenuItem>
            <MenuItem onClick={cleanSupabaseData}>
              🧹 Nettoyer Supabase
            </MenuItem>
            <MenuItem onClick={diagnoseSupabase}>
              🔧 Diagnostic Supabase
            </MenuItem>
            <MenuItem onClick={forceReleaseLock}>
              🔓 Forcer libération verrou
            </MenuItem>
            <MenuItem onClick={diagnoseAndCleanLocks}>
              🔍 Diagnostic & Nettoyage Verrous
            </MenuItem>
            <MenuItem onClick={() => {}}>
              🧹 Nettoyer cache
            </MenuItem>
            <MenuItem onClick={() => {}}>
              📋 Logs système
            </MenuItem>
          </MenuButton>

          <MenuButton
            icon={<FaChartBar />}
            label="Modules"
            isOpen={openMenus.modules}
            onClick={() => toggleMenu('modules')}
          >
            <MenuItem onClick={() => onOpenDashboard && onOpenDashboard()}>
              📊 Ouvrir le Dashboard
            </MenuItem>
            <MenuItem onClick={() => onOpenShopStats && onOpenShopStats()}>
              📈 Statistiques Boutique
            </MenuItem>
            <MenuItem onClick={() => onOpenGestion && onOpenGestion()}>
              🛠️ Gestion Boutique
            </MenuItem>
            <MenuItem onClick={() => onOpenNotes && onOpenNotes()}>
              📝 Notes
            </MenuItem>
          </MenuButton>

          <MenuButton
            icon={<FaArrowLeft />}
            label="Retour"
            isOpen={openMenus.retour}
            onClick={() => toggleMenu('retour')}
          >
            <MenuItem onClick={onBackToStartup}>
              🏠 Écran de démarrage
            </MenuItem>
            <MenuItem onClick={onBackToConfig}>
              ⚙️ Configuration boutiques
            </MenuItem>
            <MenuItem onClick={onBack}>
              👥 Gestion employés
            </MenuItem>
            <MenuItem onClick={onBackToShop}>
              🏪 Sélection boutique
            </MenuItem>
            <MenuItem onClick={onBackToWeek}>
              📅 Sélection semaine
            </MenuItem>
          </MenuButton>
        </div>
      ) : (
        // Mode classique: tous les boutons à plat, sans menus
        <div style={{ 
          display: 'grid',
          gridAutoFlow: 'column',
          gridTemplateRows: 'repeat(2, auto)',
          justifyContent: 'center', 
          gap: '12px', 
          overflowX: 'auto',
          alignItems: 'center'
        }}>
          <Button style={{ padding: '10px 14px', fontSize: '14px', whiteSpace: 'nowrap' }} title="Vue globale par jour" onClick={() => setShowGlobalDayViewModalV2(true)}>📊 Vue globale</Button>
          <Button style={{ padding: '10px 14px', fontSize: '14px', whiteSpace: 'nowrap' }} title="Exporter" onClick={onExport}>⬇️ Exporter</Button>
          <Button style={{ padding: '10px 14px', fontSize: '14px', whiteSpace: 'nowrap' }} title="Sauvegarder" onClick={handleManualSave}>💾 Sauvegarder</Button>
          <Button style={{ padding: '10px 14px', fontSize: '14px', whiteSpace: 'nowrap' }} title="Restaurer depuis Supabase" onClick={handleRestoreFromSupabase}>🔄 Restaurer</Button>
          <Button style={{ padding: '10px 14px', fontSize: '14px', whiteSpace: 'nowrap' }} title="Importer" onClick={handleImportClick}>📥 Importer</Button>
          <Button style={{ padding: '10px 14px', fontSize: '14px', whiteSpace: 'nowrap' }} title="Diagnostic" onClick={() => {}}>🔧 Diagnostic</Button>
          <Button style={{ padding: '10px 14px', fontSize: '14px', whiteSpace: 'nowrap' }} title="Nettoyer cache" onClick={() => {}}>🧹 Cache</Button>
          <Button style={{ padding: '10px 14px', fontSize: '14px', whiteSpace: 'nowrap' }} title="Logs système" onClick={() => {}}>📋 Logs</Button>
          <Button style={{ padding: '10px 14px', fontSize: '14px', whiteSpace: 'nowrap' }} title="Écran de démarrage" onClick={onBackToStartup}>🏠 Démarrage</Button>
          <Button style={{ padding: '10px 14px', fontSize: '14px', whiteSpace: 'nowrap' }} title="Configuration boutiques" onClick={onBackToConfig}>⚙️ Config</Button>
          <Button style={{ padding: '10px 14px', fontSize: '14px', whiteSpace: 'nowrap' }} title="Gestion employés" onClick={onBack}>👥 Employés</Button>
          <Button style={{ padding: '10px 14px', fontSize: '14px', whiteSpace: 'nowrap' }} title="Sélection boutique" onClick={onBackToShop}>🏪 Boutique</Button>
          <Button style={{ padding: '10px 14px', fontSize: '14px', whiteSpace: 'nowrap' }} title="Sélection semaine" onClick={onBackToWeek}>📅 Semaine</Button>
        </div>
      )}
      
      {/* Input file caché pour l'import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
    </div>
  );
};

export default PlanningMenuBar; 