import React, { useState, useRef } from 'react';
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
  showCalendarTotals
}) => {
  const [openMenus, setOpenMenus] = useState({
    tools: false,
    retour: false
  });
  
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

  const MenuButton = ({ icon, label, isOpen, onClick, children }) => (
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
          minWidth: '140px',
          justifyContent: 'space-between'
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


      {/* Boutons Principaux - Directement Visibles */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        gap: '10px', 
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        <Button
          className="button-primary"
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
        </Button>

        <Button
          className="button-primary"
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
        </Button>

        <Button
          className="button-primary"
          onClick={handleManualSave}
          style={{
            backgroundColor: '#17a2b8',
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
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#138496'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#17a2b8'}
        >
          💾 Sauvegarder
        </Button>

        <Button
          className="button-primary"
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
        </Button>
      </div>

      {/* Menus Secondaires */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        gap: '10px', 
        flexWrap: 'wrap'
      }}>
        {/* Menu Outils */}
        <MenuButton
          icon={<FaTools />}
          label="Outils"
          isOpen={openMenus.tools}
          onClick={() => toggleMenu('tools')}
        >
          <MenuItem onClick={() => {}}>
            🔧 Diagnostic données
          </MenuItem>
          <MenuItem onClick={() => {}}>
            🧹 Nettoyer cache
          </MenuItem>
          <MenuItem onClick={() => {}}>
            📋 Logs système
          </MenuItem>
        </MenuButton>

        {/* Sélecteur de retour */}
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