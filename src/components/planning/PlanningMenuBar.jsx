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
  setShowGlobalDayViewModal,
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
    actions: false,
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
      actions: false,
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
             {/* Navigation Principale - Directement Visible */}
               <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          gap: '10px', 
          flexWrap: 'wrap',
          alignItems: 'center'
        }}>
          {/* Boutons de navigation semaine */}
          <Button
            className="button-primary"
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
          >
            ← Semaine précédente
          </Button>

          {/* Sélecteur de mois */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <select
              value={currentWeek ? format(new Date(currentWeek), 'yyyy-MM') : ''}
              onChange={(e) => changeMonth(e.target.value)}
              style={{ 
                padding: '8px 12px',
                fontSize: '14px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                minWidth: '150px'
              }}
            >
              {(() => {
                const currentDate = currentWeek ? new Date(currentWeek) : new Date();
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
          </div>

          <Button
            className="button-primary"
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
          >
            Semaine suivante →
          </Button>
        </div>

      {/* Récapitulatifs des Employés - Directement Visibles */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        gap: '8px', 
        flexWrap: 'wrap',
        padding: '10px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        border: '1px solid #e9ecef'
      }}>
        <div style={{ 
          fontSize: '14px', 
          fontWeight: 'bold', 
          color: '#495057',
          marginBottom: '8px',
          width: '100%',
          textAlign: 'center'
        }}>
          Récapitulatifs Employés
        </div>
        
        {selectedEmployees?.map((employeeId) => {
          const employee = currentShopEmployees?.find(emp => emp.id === employeeId);
          const employeeName = employee?.name || employeeId;
          
          return (
            <div key={employeeId} style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              padding: '8px 12px',
              backgroundColor: 'white',
              borderRadius: '6px',
              border: '1px solid #dee2e6',
              minWidth: '120px',
              textAlign: 'center'
            }}>
              <div style={{ 
                fontSize: '12px', 
                fontWeight: 'bold',
                color: '#495057',
                marginBottom: '4px'
              }}>
                {employeeName}
              </div>
              
              <Button
                onClick={() => setShowRecapModal(employeeId)}
                style={{
                  backgroundColor: '#17a2b8',
                  color: 'white',
                  padding: '4px 8px',
                  fontSize: '11px',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  marginBottom: '2px'
                }}
                title="Récapitulatif journalier"
              >
                📅 Jour: {calculateEmployeeDayHours(employeeId)}h
              </Button>
              
              <Button
                onClick={() => {
                  setSelectedEmployeeForWeeklyRecap(employeeId);
                  setShowEmployeeWeeklyRecap(true);
                }}
                style={{
                  backgroundColor: '#28a745',
                  color: 'white',
                  padding: '4px 8px',
                  fontSize: '11px',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  marginBottom: '2px'
                }}
                title="Récapitulatif hebdomadaire"
              >
                📊 Semaine: {calculateEmployeeWeekHours(employeeId)}h
              </Button>
              
              <Button
                onClick={() => {
                  setSelectedEmployeeForMonthlyRecap(employeeId);
                  setShowEmployeeMonthlyRecap(true);
                }}
                style={{
                  backgroundColor: '#ffc107',
                  color: '#212529',
                  padding: '4px 8px',
                  fontSize: '11px',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  marginBottom: '2px'
                }}
                title="Récapitulatif mensuel"
              >
                📈 Mois: {calculateEmployeeMonthHours(employeeId)}h
              </Button>
              
              <Button
                onClick={() => {
                  setSelectedEmployeeForMonthlyDetail(employeeId);
                  setShowEmployeeMonthlyDetail(true);
                }}
                style={{
                  backgroundColor: '#6f42c1',
                  color: 'white',
                  padding: '4px 8px',
                  fontSize: '11px',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer'
                }}
                title="Détail mensuel complet"
              >
                📋 Détail mensuel
              </Button>
            </div>
          );
        })}
      </div>

             {/* Récapitulatifs Globaux - Dans Menu */}
       <div style={{ 
         display: 'flex', 
         justifyContent: 'center', 
         gap: '8px', 
         flexWrap: 'wrap',
         padding: '8px',
         backgroundColor: '#e3f2fd',
         borderRadius: '8px',
         border: '1px solid #bbdefb'
       }}>
         <div style={{ 
           fontSize: '13px', 
           fontWeight: 'bold', 
           color: '#1565c0',
           marginBottom: '4px',
           width: '100%',
           textAlign: 'center'
         }}>
           {currentShop} - {getSelectedEmployeesCount()}/{getTotalShopEmployeesCount()} employés
         </div>
         
         <div style={{
           padding: '6px 12px',
           backgroundColor: 'white',
           borderRadius: '4px',
           border: '1px solid #dee2e6',
           fontSize: '12px',
           color: '#495057',
           fontWeight: 'bold'
         }}
         title="Total des heures des employés sélectionnés"
         >
           📋 Sélectionnés: {calculateTotalSelectedEmployeesHours()}h
         </div>
         
         <div style={{
           padding: '6px 12px',
           backgroundColor: 'white',
           borderRadius: '4px',
           border: '1px solid #dee2e6',
           fontSize: '12px',
           color: '#495057',
           fontWeight: 'bold'
         }}
         title="Total des heures de tous les employés de la boutique"
         >
           📊 Total boutique: {calculateTotalShopEmployeesHours()}h
         </div>
       </div>

             {/* Menus Secondaires */}
       <div style={{ 
         display: 'flex', 
         justifyContent: 'center', 
         gap: '10px', 
         flexWrap: 'wrap'
       }}>
                  {/* Menu Actions */}
          <MenuButton
            icon={<FaCog />}
            label="Actions"
            isOpen={openMenus.actions}
            onClick={() => toggleMenu('actions')}
          >
            <MenuItem onClick={() => {
              setShowGlobalDayViewModal(true);
              closeAllMenus();
            }}>
              📊 Vue globale par jour (V1)
            </MenuItem>
            <MenuItem onClick={() => {
              setShowGlobalDayViewModalV2(true);
              closeAllMenus();
            }}>
              🎨 Vue globale par jour (V2 - Nouveau design)
            </MenuItem>
            <MenuItem onClick={onExport}>
              <FaDownload /> Exporter les données
            </MenuItem>
            <MenuItem onClick={handleImportClick}>
              📥 Importer les données
            </MenuItem>
            <MenuItem onClick={onReset}>
              🔄 Réinitialiser
            </MenuItem>
            <MenuItem onClick={() => setShowRecapModal('week')}>
              📊 Récap hebdomadaire boutique ({calculateShopWeekHours()}h)
            </MenuItem>
            <MenuItem onClick={() => setShowMonthlyRecapModal(true)}>
              📈 Récap mensuel boutique ({calculateGlobalMonthHours()}h)
            </MenuItem>
          </MenuButton>

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