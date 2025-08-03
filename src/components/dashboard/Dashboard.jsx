import React, { useState, useEffect, useMemo } from 'react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { loadFromLocalStorage } from '../../utils/localStorage';
import { getAllEmployees, isEmployeeOnLeave, getEmployeesByMainShop, determineEmployeeMainShop, updateAllMainShops } from '../../utils/planningDataManager';
import WeeklyPlanningPrint from './WeeklyPlanningPrint';

const Dashboard = ({ 
  selectedShop, 
  selectedWeek, 
  selectedEmployees, 
  globalPlanning, 
  planningData,
  onShopChange,
  onWeekChange,
  onMonthChange,
  shops,
  employees,
  config
}) => {
  const [dashboardData, setDashboardData] = useState({
    totalLeaveDays: 0,
    employeeStats: [],
    dayStats: [],
    weekStats: [],
    shopStats: [],
    monthStats: []
  });
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Calcul des employés de la boutique (en dehors du useMemo pour être accessible dans le JSX)
  const shopEmployees = useMemo(() => {
    if (!planningData || !selectedShop) return [];
    
    console.log('🔍 Calcul des employés pour la boutique:', selectedShop);
    
    // Ne compter que les employés dont la boutique principale est la boutique sélectionnée
    // Si un employé n'a pas de boutique principale définie, la déterminer automatiquement
    let employees = getEmployeesByMainShop(planningData, selectedShop);
    console.log('👥 Employés avec boutique principale définie:', employees.map(emp => ({ id: emp.id, name: emp.name, mainShop: emp.mainShop })));
    
    // Pour les employés sans boutique principale, essayer de la déterminer
    const allEmployeesData = getAllEmployees(planningData);
    const employeesWithoutMainShop = allEmployeesData.filter(emp => 
      emp.canWorkIn && emp.canWorkIn.includes(selectedShop) && !emp.mainShop
    );
    console.log('🔍 Employés sans boutique principale:', employeesWithoutMainShop.map(emp => ({ id: emp.id, name: emp.name, canWorkIn: emp.canWorkIn })));
    
    // Ajouter les employés dont la boutique principale a été déterminée automatiquement
    employeesWithoutMainShop.forEach(emp => {
      const determinedMainShop = determineEmployeeMainShop(planningData, emp.id);
      console.log(`🎯 ${emp.name} (${emp.id}): boutique principale déterminée = ${determinedMainShop}`);
      if (determinedMainShop === selectedShop) {
        employees.push({ ...emp, mainShop: determinedMainShop });
      }
    });
    
    console.log('✅ Employés finaux pour la boutique:', employees.map(emp => ({ id: emp.id, name: emp.name, mainShop: emp.mainShop })));
    return employees;
  }, [planningData, selectedShop]);

  // Calcul des statistiques
  const calculateStats = useMemo(() => {
    console.log('🔍 Dashboard - Données reçues:', { 
      globalPlanning: !!globalPlanning, 
      selectedShop, 
      selectedWeek, 
      planningData: !!planningData,
      planningDataKeys: planningData ? Object.keys(planningData) : null
    });
    
    if (!globalPlanning || !selectedShop || !selectedWeek || !planningData) {
      console.log('❌ Dashboard - Données manquantes');
      return;
    }

    const stats = {
      totalLeaveDays: 0,
      employeeStats: [],
      dayStats: [],
      weekStats: [],
      shopStats: [],
      monthStats: []
    };

    // Générer les dates du mois entier
    const selectedDate = new Date(selectedWeek);
    const monthStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const monthEnd = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
    const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
    
    console.log('📅 Calcul des congés du mois:', {
      selectedWeek,
      monthStart: format(monthStart, 'yyyy-MM-dd'),
      monthEnd: format(monthEnd, 'yyyy-MM-dd'),
      totalMonthDays: monthDays.length
    });
    
    // Générer les dates de la semaine sélectionnée
    const weekStart = startOfWeek(new Date(selectedWeek), { weekStartsOn: 1 }); // Lundi
    const weekEnd = endOfWeek(new Date(selectedWeek), { weekStartsOn: 1 }); // Dimanche
    const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
    
    const allEmployees = shopEmployees.map(emp => emp.id);
    
    // Collecter tous les employés qui ont des congés pour cette semaine
    const employeesWithLeave = [];
    
         allEmployees.forEach(employeeId => {
               let employeeLeaveDaysWeek = 0;
        let employeeLeaveDaysMonth = 0;
       
               // Parcourir tous les jours de la semaine
        weekDays.forEach((day, dayIndex) => {
          const dateString = format(day, 'yyyy-MM-dd');
          
                     // Utiliser la nouvelle logique pour vérifier les congés
           if (isEmployeeOnLeave(employeeId, dateString, planningData)) {
             console.log(`✅ ${employeeId} - ${dateString}: JOUR DE CONGÉ DÉTECTÉ (pas de créneaux dans aucune boutique)`);
             employeeLeaveDaysWeek += 1;
           }
        });
       
               // Parcourir tous les jours du mois pour le total mensuel
        monthDays.forEach((day) => {
          const dateString = format(day, 'yyyy-MM-dd');
          
                     // Utiliser la nouvelle logique pour vérifier les congés
           if (isEmployeeOnLeave(employeeId, dateString, planningData)) {
             employeeLeaveDaysMonth += 1;
           }
        });
      
             // Inclure tous les employés qui ont des congés (semaine OU mois)
                if (employeeLeaveDaysWeek > 0 || employeeLeaveDaysMonth > 0) {
           // Trouver le nom de l'employé dans la boutique sélectionnée
           console.log('🔍 Recherche employé:', employeeId, 'dans la boutique:', selectedShop);
           const employee = shopEmployees.find(emp => emp.id === employeeId);
           console.log('👤 Employé trouvé:', employee);
           const employeeName = employee?.name || employeeId;
           console.log('📝 Nom final:', employeeName);
         
                   employeesWithLeave.push({
            id: employeeId,
            name: employeeName,
            leaveDaysWeek: employeeLeaveDaysWeek,
            leaveDaysMonth: employeeLeaveDaysMonth
          });
       }
    });
    
    // Statistiques par employé
    stats.employeeStats = employeesWithLeave;
    
    // Statistiques par jour (utiliser les vraies dates)
    const dayNames = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
    
         weekDays.forEach((day, dayIndex) => {
       const dateString = format(day, 'yyyy-MM-dd');
       let dayLeaveDays = 0;
       const dayEmployees = new Set();
       const dayEmployeeNames = [];
       
               allEmployees.forEach(employeeId => {
          // Utiliser la nouvelle logique pour vérifier les congés
          if (isEmployeeOnLeave(employeeId, dateString, planningData)) {
            dayLeaveDays += 1;
            dayEmployees.add(employeeId);
            
            // Trouver le nom de l'employé
            const employee = shopEmployees.find(emp => emp.id === employeeId);
            const employeeName = employee?.name || employeeId;
            dayEmployeeNames.push(employeeName);
          }
        });
      
      stats.dayStats.push({
        date: day,
        dayName: dayNames[dayIndex],
        leaveDays: dayLeaveDays,
        employees: dayEmployees.size,
        employeeNames: dayEmployeeNames
      });
    });
    
    // Totaux
    stats.totalLeaveDays = employeesWithLeave.reduce((sum, emp) => sum + emp.leaveDaysWeek, 0);
    
    // Statistiques par boutique (pour l'instant, on met juste la boutique actuelle)
    stats.shopStats.push({
      name: selectedShop,
      leaveDaysWeek: stats.totalLeaveDays,
      leaveDaysMonth: employeesWithLeave.reduce((sum, emp) => sum + emp.leaveDaysMonth, 0)
    });
    
    return stats;
  }, [globalPlanning, selectedShop, selectedWeek, selectedEmployees, planningData]);

  useEffect(() => {
    if (calculateStats) {
      setDashboardData(calculateStats);
    }
  }, [calculateStats]);

  if (!selectedShop || !selectedWeek) {
    return (
      <div className="dashboard-container">
        <h2>📊 Tableau de Bord</h2>
        <p>Sélectionnez une boutique et une semaine pour voir les statistiques.</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <h2>📊 Tableau de Bord</h2>
      
      {/* Sélecteurs de navigation */}
      <div className="dashboard-navigation">
        <div className="selectors-container">
          {/* Sélecteur de boutique */}
          <div className="selector-group">
            <label className="selector-label">🏪 Boutique :</label>
                         <select 
               value={selectedShop} 
               onChange={(e) => {
                 if (onShopChange) {
                   onShopChange(e.target.value);
                 }
               }}
               className="dashboard-selector"
             >
              {planningData?.shops?.map(shop => (
                <option key={shop.id} value={shop.id}>
                  {shop.name}
                </option>
              )) || []}
            </select>
          </div>

          {/* Sélecteur de mois */}
          <div className="selector-group">
            <label className="selector-label">📅 Mois :</label>
                         <select 
               value={format(new Date(selectedWeek), 'yyyy-MM')} 
               onChange={(e) => {
                 if (onMonthChange) {
                   onMonthChange(e.target.value);
                 }
               }}
               className="dashboard-selector"
             >
              {(() => {
                const currentDate = new Date(selectedWeek);
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

          {/* Sélecteur de semaine */}
          <div className="selector-group">
            <label className="selector-label">📆 Semaine :</label>
                         <select 
               value={selectedWeek} 
               onChange={(e) => {
                 if (onWeekChange) {
                   onWeekChange(e.target.value);
                 }
               }}
               className="dashboard-selector"
             >
              {(() => {
                const currentDate = new Date(selectedWeek);
                const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
                const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
                
                const weeks = [];
                let currentWeek = startOfWeek(monthStart, { weekStartsOn: 1 });
                
                while (currentWeek <= monthEnd) {
                  const weekKey = format(currentWeek, 'yyyy-MM-dd');
                  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
                  const weekLabel = `${format(currentWeek, 'd', { locale: fr })} - ${format(weekEnd, 'd MMM', { locale: fr })}`;
                  
                  weeks.push(
                    <option key={weekKey} value={weekKey}>
                      {weekLabel}
                    </option>
                  );
                  
                  currentWeek = new Date(currentWeek);
                  currentWeek.setDate(currentWeek.getDate() + 7);
                }
                return weeks;
              })()}
            </select>
          </div>
        </div>
        
        {/* Bouton d'impression du planning hebdomadaire */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginTop: '20px',
          padding: '15px',
          backgroundColor: '#f8f9fa',
          borderRadius: '10px',
          border: '2px solid #dee2e6'
        }}>
          <button
            onClick={() => setShowPrintModal(true)}
            style={{
              background: 'linear-gradient(135deg, #007bff 0%, #0056b3 100%)',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '600',
              transition: 'all 0.3s ease',
              boxShadow: '0 4px 12px rgba(0, 123, 255, 0.4)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, #0056b3 0%, #004085 100%)';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 123, 255, 0.6)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, #007bff 0%, #0056b3 100%)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 123, 255, 0.4)';
            }}
          >
            🖨️ Imprimer Planning Hebdomadaire
          </button>
        </div>
      </div>

      <p className="dashboard-subtitle">
        Semaine du {format(new Date(selectedWeek), 'd MMMM yyyy', { locale: fr })}
      </p>



      {/* Résumé global */}
      <div className="dashboard-summary">
        <div className="summary-card">
          <h3>🏖️ Résumé des Congés - Semaine</h3>
          <div className="summary-stats">
            <div className="stat-item">
              <span className="stat-number">{dashboardData.totalLeaveDays}</span>
              <span className="stat-label">Jours de Congés</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">{dashboardData.employeeStats.length}</span>
              <span className="stat-label">Employés avec Congés</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">
                {format(startOfWeek(new Date(selectedWeek), { weekStartsOn: 1 }), 'd', { locale: fr })} - {format(endOfWeek(new Date(selectedWeek), { weekStartsOn: 1 }), 'd MMM', { locale: fr })}
              </span>
              <span className="stat-label">Semaine</span>
            </div>
          </div>
        </div>
      </div>

      {/* Résumé global - Mois */}
      <div className="dashboard-summary">
        <div className="summary-card">
          <h3>🏖️ Résumé des Congés - Mois</h3>
          <div className="summary-stats">
            <div className="stat-item">
              <span className="stat-number">{dashboardData.shopStats[0]?.leaveDaysMonth || 0}</span>
              <span className="stat-label">Jours de Congés</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">{dashboardData.employeeStats.filter(emp => emp.leaveDaysMonth > 0).length}</span>
              <span className="stat-label">Employés avec Congés</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">{format(new Date(selectedWeek), 'MMMM yyyy', { locale: fr })}</span>
              <span className="stat-label">Mois</span>
            </div>
          </div>
        </div>
      </div>

      {/* Statistiques par jour */}
      <div className="dashboard-section">
        <h3>📅 Congés par Jour - Semaine</h3>
        <div className="day-stats-grid">
          {dashboardData.dayStats.map((day, index) => (
            <div key={index} className="day-stat-card">
              <h4>{day.dayName}</h4>
              <div className="day-stat-content">
                <div className="day-stat-item">
                  <span className="stat-number">{day.employees}</span>
                  <span className="stat-label">Employés en Congés</span>
                </div>
                {day.employeeNames.length > 0 && (
                  <div className="day-employees-list">
                    <span className="employees-label">Noms :</span>
                    <div className="employees-names">
                      {day.employeeNames.map((name, nameIndex) => (
                        <span key={nameIndex} className="employee-name">
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Statistiques par employé */}
      <div className="dashboard-section">
        <h3>👥 Congés par Employé</h3>
        <div className="employee-stats-grid">
          {dashboardData.employeeStats.map((employee, index) => (
            <div key={index} className="employee-stat-card">
              <h4>{employee.name}</h4>
              <div className="employee-stat-content">
                <div className="employee-stat-item">
                  <span className="stat-number">{employee.leaveDaysWeek}</span>
                  <span className="stat-label">Congés Semaine</span>
                </div>
                <div className="employee-stat-item">
                  <span className="stat-number">{employee.leaveDaysMonth}</span>
                  <span className="stat-label">Congés Mois</span>
                </div>
                
              </div>
            </div>
          ))}
        </div>
      </div>

             {/* Statistiques par boutique */}
       <div className="dashboard-section">
         <h3>🏪 Congés par Boutique</h3>
         <div className="shop-stats-grid">
           {dashboardData.shopStats.map((shop, index) => (
             <div key={index} className="shop-stat-card">
               <h4>{shop.name}</h4>
               <div className="shop-stat-content">
                 <div className="shop-stat-item">
                   <span className="stat-number">{shop.leaveDaysWeek}</span>
                   <span className="stat-label">Congés Semaine</span>
                 </div>
                 <div className="shop-stat-item">
                   <span className="stat-number">{shop.leaveDaysMonth}</span>
                   <span className="stat-label">Congés Mois</span>
                 </div>
               </div>
             </div>
           ))}
         </div>
       </div>

       {/* Informations sur les boutiques principales */}
       <div className="dashboard-section">
         <h3>🎯 Boutiques Principales</h3>
         <div className="main-shop-info">
           <p>
             <strong>Logique de détermination :</strong> La boutique principale est déterminée automatiquement 
             en fonction de la présence de l'employé (nombre de semaines avec données + nombre total de créneaux).
           </p>
           <div className="employee-main-shops">
             {shopEmployees.map((emp, index) => {
               const determinedMainShop = emp.mainShop || determineEmployeeMainShop(planningData, emp.id);
               const isAutoDetermined = !emp.mainShop && determinedMainShop;
               
               return (
                 <div key={index} className="employee-main-shop-item">
                   <span className="employee-name">{emp.name}</span>
                   <span className="main-shop-name">
                     {determinedMainShop || 'Non déterminée'}
                     {isAutoDetermined && <span className="auto-badge">Auto</span>}
                   </span>
                 </div>
               );
             })}
           </div>
         </div>
       </div>
      
      {/* Modale d'impression du planning hebdomadaire */}
      {showPrintModal && (
        <WeeklyPlanningPrint
          selectedShop={selectedShop}
          selectedWeek={selectedWeek}
          planningData={planningData}
          shops={shops}
          employees={employees}
          config={config}
          onClose={() => setShowPrintModal(false)}
        />
      )}
    </div>
  );
};

export default Dashboard; 