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
  currentUser = null,
  
  // Nouveaux boutons à ajouter
  setShowResetModal,
  toggleMenu,
  restoreFromBackup,
  createAutoBackupJSON,
  autoLockEnabled,
  setAutoLockEnabled,
  copyWeekToNextWeek,
  validationState
}) => {
  const [showUserManagement, setShowUserManagement] = useState(false);
  
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
      {/* Bandeau supérieur avec utilisateur connecté */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'flex-start', 
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
      </div>

      {/* Mode unifié : grille équilibrée avec toutes les fonctions uniques */}
      <div style={{ 
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gridTemplateRows: 'repeat(3, minmax(50px, auto))', // Étendu à 3 lignes
        gridAutoFlow: 'row',
        justifyItems: 'stretch',
        alignItems: 'stretch',
        gap: '8px',
        overflowX: 'hidden',
        paddingBottom: '4px'
      }}>
        {/* LIGNE 1: Fonctions principales */}
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

        {/* LIGNE 2: Fonctions utilitaires et Navigation */}
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

        {/* LIGNE 3: Nouveaux boutons ajoutés */}
        <Button
          className="button-primary"
          onClick={() => setShowResetModal(true)}
          style={{
            backgroundColor: '#dc3545',
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
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#c82333'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#dc3545'}
        >
          🗑️ Effacer
        </Button>

        <Button
          className="button-primary"
          onClick={() => toggleMenu('retour')}
          style={{
            backgroundColor: '#6c757d',
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
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#495057'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#6c757d'}
        >
          ↩️ Retour
        </Button>

        <Button
          className="button-primary"
          onClick={restoreFromBackup}
          style={{
            backgroundColor: '#fd7e14',
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
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#e55a00'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#fd7e14'}
        >
          🔄 Restaurer
        </Button>

        <Button
          className="button-primary"
          onClick={createAutoBackupJSON}
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
          💾 JSON
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

      {/* Section navigation semaine et contrôles avancés */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '10px',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '10px',
        backgroundColor: 'rgba(248, 249, 250, 0.8)',
        borderRadius: '8px',
        border: '1px solid #dee2e6'
      }}>
        {/* Boutons de navigation semaine */}
        <Button
          className="button-primary"
          onClick={() => changeWeek('prev')}
          style={{
            backgroundColor: '#2196f3',
            color: '#fff',
            padding: '8px 16px',
            fontSize: '12px',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1976d2'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#2196f3'}
        >
          ← Semaine précédente
        </Button>

        <Button
          className="button-primary"
          onClick={() => changeWeek('next')}
          style={{
            backgroundColor: '#2196f3',
            color: '#fff',
            padding: '8px 16px',
            fontSize: '12px',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1976d2'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#2196f3'}
        >
          Semaine suivante →
        </Button>

        {/* Contrôles de verrouillage */}
        <Button
          className="button-primary"
          onClick={() => {
            // Logique pour verrouiller tous les employés
            console.log('Verrouiller tous les employés');
          }}
          style={{
            backgroundColor: '#ff9800',
            color: '#fff',
            padding: '8px 16px',
            fontSize: '12px',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f57c00'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#ff9800'}
        >
          🔒 Verrouiller tous
        </Button>

        <Button
          className="button-primary"
          onClick={() => setAutoLockEnabled(!autoLockEnabled)}
          style={{
            backgroundColor: autoLockEnabled ? '#28a745' : '#6c757d',
            color: '#fff',
            padding: '8px 16px',
            fontSize: '12px',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = autoLockEnabled ? '#218838' : '#495057'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = autoLockEnabled ? '#28a745' : '#6c757d'}
        >
          {autoLockEnabled ? '🔒 Auto-verrouillage ON' : '🔓 Auto-verrouillage OFF'}
        </Button>

        <Button
          className="button-primary"
          onClick={copyWeekToNextWeek}
          style={{
            backgroundColor: '#17a2b8',
            color: '#fff',
            padding: '8px 16px',
            fontSize: '12px',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#138496'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#17a2b8'}
        >
          📋 Copier → Semaine +1
        </Button>

        {/* Indicateur employés verrouillés */}
        {validationState && (
          <div style={{ 
            fontSize: '12px', 
            color: '#6c757d', 
            padding: '8px 12px',
            backgroundColor: 'rgba(108, 117, 125, 0.1)',
            borderRadius: '6px',
            border: '1px solid rgba(108, 117, 125, 0.2)'
          }}>
            {validationState.lockedEmployees?.length || 0} employé(s) verrouillé(s)
          </div>
        )}
      </div>
      
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