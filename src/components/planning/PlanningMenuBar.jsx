import React, { useState, useRef, useEffect } from 'react';
import { FaDownload, FaChevronDown, FaChevronUp, FaCog, FaChartBar, FaArrowLeft, FaTools, FaUsers } from 'react-icons/fa';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import Button from '../common/Button';
import { checkUserPermission } from '../../config/userCodes';
import UserManagementModal from '../admin/UserManagementModal';
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
  onForceSync,
  
  // Utilisateur connecté
  currentUser = null
}) => {
  const [showUserManagement, setShowUserManagement] = useState(false);
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



  return (
    <div 
      style={{ 
        display: 'flex', 
        flexDirection: 'column',
        gap: '10px', 
        marginBottom: '15px'
      }}

    >
      {/* Bandeau supérieur avec mode et utilisateur */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '10px'
      }}>
        {/* Indicateur utilisateur connecté */}
        {currentUser && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 12px',
            backgroundColor: 'rgba(40, 167, 69, 0.1)',
            borderRadius: '16px',
            border: '1px solid rgba(40, 167, 69, 0.3)',
            fontSize: '12px',
            color: '#28a745',
            fontWeight: '500'
          }}>
            <span style={{ fontSize: '14px' }}>👤</span>
            <span>{currentUser.name}</span>
            <span style={{ 
              fontSize: '10px', 
              opacity: '0.7',
              backgroundColor: 'rgba(40, 167, 69, 0.2)',
              padding: '2px 6px',
              borderRadius: '8px'
            }}>
              {currentUser.role}
            </span>
          </div>
        )}
        
        {/* Bandeau de mode */}
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
        // Mode intelligent: grille équilibrée 4x2, boutons étirés, pas de débordement
        <div style={{ 
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gridTemplateRows: 'repeat(2, minmax(50px, auto))',
          gridAutoFlow: 'row',
          justifyItems: 'stretch',
          alignItems: 'stretch',
          gap: '8px',
          overflowX: 'hidden',
          paddingBottom: '4px'
        }}>
          <Button
            className="button-primary"
            onClick={() => setShowGlobalDayViewModalV2(true)}
            style={{
              backgroundColor: '#1e88e5',
              color: '#fff',
              padding: '10px 14px',
              fontSize: '13px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
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
              padding: '10px 14px',
              fontSize: '13px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
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
              padding: '10px 14px',
              fontSize: '13px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
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
              padding: '10px 14px',
              fontSize: '13px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
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
              padding: '10px 14px',
              fontSize: '13px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
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
              padding: '10px 14px',
              fontSize: '13px',
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

          {/* Boutons Outils - remplacement des menus déroulants */}
          <Button
            className="button-primary"
            onClick={() => onForceSync && onForceSync()}
            style={{
              backgroundColor: '#ff9800',
              color: '#fff',
              padding: '10px 14px',
              fontSize: '13px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f57c00'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#ff9800'}
          >
            🔄 Synchro {outboxSize > 0 ? `(${outboxSize})` : ''}
          </Button>

          <Button
            className="button-primary"
            onClick={diagnoseAndCleanLocks}
            style={{
              backgroundColor: '#3f51b5',
              color: '#fff',
              padding: '10px 14px',
              fontSize: '13px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#303f9f'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#3f51b5'}
          >
            🔍 Diagnostic Verrous
          </Button>

          {currentUser && checkUserPermission(currentUser.code, 'canManageUsers') && (
            <Button
              className="button-primary"
              onClick={() => setShowUserManagement(true)}
              style={{
                backgroundColor: '#4caf50',
                color: '#fff',
                padding: '10px 14px',
                fontSize: '13px',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#388e3c'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#4caf50'}
            >
              👥 Gestion Utilisateurs
            </Button>
          )}

          {/* Boutons Modules */}
          <Button
            className="button-primary"
            onClick={() => onOpenDashboard && onOpenDashboard()}
            style={{
              backgroundColor: '#2196f3',
              color: '#fff',
              padding: '10px 14px',
              fontSize: '13px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1976d2'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#2196f3'}
          >
            📊 Dashboard
          </Button>

          <Button
            className="button-primary"
            onClick={() => onOpenShopStats && onOpenShopStats()}
            style={{
              backgroundColor: '#673ab7',
              color: '#fff',
              padding: '10px 14px',
              fontSize: '13px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#512da8'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#673ab7'}
          >
            📈 Stats Boutique
          </Button>

          <Button
            className="button-primary"
            onClick={() => onOpenGestion && onOpenGestion()}
            style={{
              backgroundColor: '#ff9800',
              color: '#fff',
              padding: '10px 14px',
              fontSize: '13px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f57c00'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#ff9800'}
          >
            🛠️ Gestion
          </Button>

          <Button
            className="button-primary"
            onClick={() => onOpenNotes && onOpenNotes()}
            style={{
              backgroundColor: '#8bc34a',
              color: '#fff',
              padding: '10px 14px',
              fontSize: '13px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#689f38'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#8bc34a'}
          >
            📝 Notes
          </Button>

          {/* Boutons Retour */}
          <Button
            className="button-primary"
            onClick={onBackToStartup}
            style={{
              backgroundColor: '#f44336',
              color: '#fff',
              padding: '10px 14px',
              fontSize: '13px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#d32f2f'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f44336'}
          >
            🏠 Démarrage
          </Button>

          <Button
            className="button-primary"
            onClick={onBackToConfig}
            style={{
              backgroundColor: '#795548',
              color: '#fff',
              padding: '10px 14px',
              fontSize: '13px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#5d4037'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#795548'}
          >
            ⚙️ Config
          </Button>

          <Button
            className="button-primary"
            onClick={onBack}
            style={{
              backgroundColor: '#607d8b',
              color: '#fff',
              padding: '10px 14px',
              fontSize: '13px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#455a64'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#607d8b'}
          >
            👥 Employés
          </Button>

          <Button
            className="button-primary"
            onClick={onBackToShop}
            style={{
              backgroundColor: '#9c27b0',
              color: '#fff',
              padding: '10px 14px',
              fontSize: '13px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#7b1fa2'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#9c27b0'}
          >
            🏪 Boutique
          </Button>

          <Button
            className="button-primary"
            onClick={onBackToWeek}
            style={{
              backgroundColor: '#3f51b5',
              color: '#fff',
              padding: '10px 14px',
              fontSize: '13px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#303f9f'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#3f51b5'}
          >
            📅 Semaine
          </Button>
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

      {/* Modal de gestion des utilisateurs */}
      <UserManagementModal
        isOpen={showUserManagement}
        onClose={() => setShowUserManagement(false)}
        currentUser={currentUser}
      />
    </div>
  );
};

export default PlanningMenuBar; 