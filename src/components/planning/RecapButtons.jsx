import React from 'react';
import { format, addDays, startOfMonth, endOfMonth, isMonday, isWithinInterval } from 'date-fns';
import { fr } from 'date-fns/locale';
import Button from '../common/Button';
import { calculateEmployeeDailyHours } from '../../utils/planningUtils';
import { loadFromLocalStorage } from '../../utils/localStorage';
import { getAllEmployees } from '../../utils/planningDataManager';
import '../../assets/styles.css';

const RecapButtons = ({
  selectedEmployees,
  currentShop,
  currentWeek,
  currentDay,
  showCalendarTotals,
  setShowRecapModal,
  setShowMonthlyRecapModal,
  setShowEmployeeMonthlyRecap,
  setShowEmployeeWeeklyRecap,
  setShowMonthlyDetailModal,
  setShowEmployeeMonthlyDetail,

  setSelectedEmployeeForMonthlyRecap,
  setSelectedEmployeeForWeeklyRecap,
  setSelectedEmployeeForMonthlyDetail,
  config,
  shops,
  currentShopEmployees,
  planning,
  planningData
}) => {

  const pastelColors = ['#e6f0fa', '#e6ffed', '#ffe6e6', '#d0f0fa', '#f0e6fa', '#fffde6', '#d6e6ff'];
  const monthDisplay = 'MM';



  // Fonction pour obtenir les semaines du mois
  const getMonthWeeks = (weekStart) => {
    const weeks = [];
    const startDate = new Date(weekStart);
    const monthStart = startOfMonth(startDate);
    const monthEnd = endOfMonth(startDate);
    
    let currentWeek = new Date(monthStart);
    while (currentWeek <= monthEnd) {
      if (isMonday(currentWeek)) {
        weeks.push(format(currentWeek, 'yyyy-MM-dd'));
      }
      currentWeek = addDays(currentWeek, 1);
    }
    return weeks;
  };

  // Calculer les heures journalières pour un employé
  const calculateEmployeeDayHours = (employee) => {
    if (!currentWeek || !currentShop || !planning) return 0;
    // Utiliser le jour actuellement sélectionné dans l'interface
    const dayKey = format(addDays(new Date(currentWeek), currentDay || 0), 'yyyy-MM-dd');
    const hours = calculateEmployeeDailyHours(employee, dayKey, planning, config);
    return hours.toFixed(1);
  };

  // Calculer les heures hebdomadaires réelles pour un employé
  const calculateEmployeeWeekHours = (employee) => {
    if (!currentWeek || !currentShop || !planning) return 0;
    let totalHours = 0;
    for (let i = 0; i < 7; i++) {
      const dayKey = format(addDays(new Date(currentWeek), i), 'yyyy-MM-dd');
      const hours = calculateEmployeeDailyHours(employee, dayKey, planning, config);
      totalHours += hours;
    }
    return totalHours.toFixed(1);
  };

  // Calculer les heures mensuelles réelles pour un employé
  const calculateEmployeeMonthHours = (employee) => {
    if (!currentWeek || !planningData) return 0;
    
    // Pour l'instant, on utilise seulement la semaine actuelle
    // TODO: Implémenter le calcul mensuel complet multi-boutiques
    return calculateEmployeeWeekHours(employee);
  };

  // Calculer les heures mensuelles de la boutique actuelle
  const calculateGlobalMonthHours = () => {
    if (!currentWeek || !planningData || !currentShop) return 0;
    
    // Trouver la boutique actuelle
    const shop = planningData.shops.find(s => s.id === currentShop);
    if (!shop || !shop.config) return 0;
    
    // Obtenir le mois de la semaine actuelle
    const currentDate = new Date(currentWeek);
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    
    // Obtenir toutes les semaines du mois
    const monthWeeks = getMonthWeeks(currentWeek);
    
    let totalMonthHours = 0;
    
    // Pour chaque semaine du mois
    monthWeeks.forEach(weekStart => {
      const weekKey = format(weekStart, 'yyyy-MM-dd');
      
      // Récupérer le planning de cette semaine pour cette boutique
      const weekData = shop.weeks?.[weekKey];
      if (weekData && weekData.planning) {
        // Pour chaque employé de cette boutique
        shop.employees.forEach(employee => {
          if (weekData.planning[employee.id]) {
            // Calculer les heures de cette semaine pour cet employé
            let weekHours = 0;
            for (let i = 0; i < 7; i++) {
              const dayDate = format(addDays(weekStart, i), 'yyyy-MM-dd');
              const hours = calculateEmployeeDailyHours(employee, dayDate, weekData.planning, shop.config);
              weekHours += hours;
            }
            totalMonthHours += weekHours;
          }
        });
      }
    });
    
    return totalMonthHours.toFixed(1);
  };

  // Calculer les heures d'un employé dans une boutique spécifique
  const calculateEmployeeShopHours = (employee, shopId) => {
    if (!currentWeek || !planningData) return 0;
    
    const shop = planningData.shops.find(s => s.id === shopId);
    if (!shop || !shop.config) return 0;
    
    console.log(`Recherche données pour employé ${employee} dans boutique ${shopId}, semaine ${currentWeek}`);
    console.log(`Boutique trouvée:`, shop);
    console.log(`Semaines disponibles:`, Object.keys(shop.weeks || {}));
    
    // Récupérer le planning de cette boutique pour cette semaine
    const weekData = shop.weeks?.[currentWeek];
    console.log(`Données de semaine trouvées:`, weekData);
    
    if (!weekData || !weekData.planning) {
      console.log(`Aucune donnée trouvée pour la semaine ${currentWeek}`);
      return 0;
    }
    
    // Vérifier les données de l'employé spécifiquement
    const employeeData = weekData.planning[employee];
    console.log(`Données de l'employé ${employee} dans ${shopId}:`, employeeData);
    
    // Calculer les heures pour cette semaine dans cette boutique
    let totalHours = 0;
    for (let i = 0; i < 7; i++) {
      const dayDate = format(addDays(new Date(currentWeek), i), 'yyyy-MM-dd');
      const employeeData = weekData.planning[employee];
      const daySlots = employeeData?.[dayDate];
      console.log(`Jour ${dayDate} pour ${employee} dans ${shopId}:`, daySlots);
      const hours = calculateEmployeeDailyHours(employee, dayDate, weekData.planning, shop.config);
      totalHours += hours;
    }
    
    console.log(`Total heures calculé pour ${employee} dans ${shopId}: ${totalHours.toFixed(1)}`);
    return totalHours.toFixed(1);
  };

  // Calculer le total des heures d'un employé dans toutes ses boutiques
  const calculateEmployeeTotalMultiShopHours = (employee) => {
    if (!currentWeek || !planningData) return 0;
    
    const employeeShops = getEmployeeShops(employee);
    console.log(`Calcul total multi-boutiques pour ${employee}:`, employeeShops);
    
    if (employeeShops.length <= 1) {
      const weekHours = calculateEmployeeWeekHours(employee);
      console.log(`Employé dans une seule boutique, heures: ${weekHours}`);
      return weekHours;
    }
    
    let totalHours = 0;
    employeeShops.forEach(shop => {
      const shopHours = parseFloat(calculateEmployeeShopHours(employee, shop.id));
      console.log(`Heures dans ${shop.name}: ${shopHours}`);
      totalHours += shopHours;
    });
    
    console.log(`Total multi-boutiques pour ${employee}: ${totalHours.toFixed(1)}`);
    return totalHours.toFixed(1);
  };

    // Obtenir les boutiques où un employé travaille ET a des données
  const getEmployeeShops = (employee) => {
    if (!planningData || !currentWeek) return [];
    
    console.log(`DEBUG - getEmployeeShops appelé avec employee: "${employee}"`);
    console.log(`DEBUG - Type de employee:`, typeof employee);
    console.log(`DEBUG - currentWeek: "${currentWeek}"`);
    
    // Trouver l'ID de l'employé
    let employeeId = employee;
    const allEmployees = planningData.shops?.flatMap(shop => shop.employees || []) || [];
    const employeeData = allEmployees.find(emp => emp.name === employee || emp.id === employee);
    if (employeeData) {
      employeeId = employeeData.id;
      console.log(`DEBUG - ID trouvé pour ${employee}: ${employeeId}`);
    }
    
    const employeeShops = new Map();
    planningData.shops.forEach(shop => {
      if (shop.weeks) {
        // Vérifier si l'employé a des données de planning dans cette boutique
        let hasPlanningData = false;
        Object.keys(shop.weeks).forEach(weekKey => {
          const weekData = shop.weeks[weekKey];
          if (weekData.planning && weekData.planning[employeeId]) {
            // Vérifier si l'employé a des créneaux sélectionnés dans cette semaine
            Object.keys(weekData.planning[employeeId]).forEach(dayKey => {
              const dayData = weekData.planning[employeeId][dayKey];
              if (Array.isArray(dayData) && dayData.some(slot => slot === true)) {
                hasPlanningData = true;
              }
            });
          }
        });
        
        if (hasPlanningData) {
          employeeShops.set(shop.id, shop.name || shop.id);
        }
      }
    });
    
    console.log(`DEBUG - Boutiques trouvées pour ${employee}:`, Array.from(employeeShops.values()));
    return Array.from(employeeShops.values());
  };

  // Calculer les heures hebdomadaires pour la boutique
  const calculateShopWeekHours = () => {
    if (!currentWeek || !currentShop || !planning || !selectedEmployees) return 0;
    let totalHours = 0;
    selectedEmployees.forEach(employee => {
      for (let i = 0; i < 7; i++) {
        const dayKey = format(addDays(new Date(currentWeek), i), 'yyyy-MM-dd');
        const hours = calculateEmployeeDailyHours(employee, dayKey, planning, config);
        totalHours += hours;
      }
    });
    return totalHours.toFixed(1);
  };

  // Calculer les heures mensuelles pour la boutique
  const calculateShopMonthHours = () => {
    if (!currentWeek || !currentShop || !planning || !selectedEmployees) return 0;
    // Pour l'instant, on utilise seulement la semaine actuelle
    // TODO: Implémenter le calcul mensuel complet
    return calculateShopWeekHours();
  };

  // Calculer le total des heures pour tous les employés sélectionnés
  const calculateTotalSelectedEmployeesHours = () => {
    if (!selectedEmployees || selectedEmployees.length === 0) return 0;
    let totalHours = 0;
    selectedEmployees.forEach(employeeId => {
      totalHours += parseFloat(calculateEmployeeWeekHours(employeeId));
    });
    return totalHours.toFixed(1);
  };

  // Calculer le total des heures pour tous les employés de la boutique
  const calculateTotalShopEmployeesHours = () => {
    if (!currentShopEmployees || currentShopEmployees.length === 0 || !planning) return 0;
    let totalHours = 0;
    currentShopEmployees.forEach(employee => {
      totalHours += parseFloat(calculateEmployeeWeekHours(employee.id));
    });
    return totalHours.toFixed(1);
  };

  // Calculer le nombre d'employés sélectionnés
  const getSelectedEmployeesCount = () => {
    return selectedEmployees?.length || 0;
  };

  // Calculer le nombre total d'employés dans la boutique
  const getTotalShopEmployeesCount = () => {
    return currentShopEmployees?.length || 0;
  };

  // Utiliser getAllEmployees pour avoir tous les employés, pas seulement ceux de la boutique actuelle
  const allEmployees = getAllEmployees(planningData);
  
  return (
    <div className="recap-buttons" style={{ display: 'flex', flexDirection: 'row', overflowX: 'auto', justifyContent: 'center', gap: '12px', marginBottom: '15px' }}>
      {console.log('DEBUG - allEmployees:', allEmployees)}
      {(allEmployees || []).map((employee, index) => {
        const employeeId = employee.id;
        const employeeName = employee?.name || employeeId;
        
        console.log(`DEBUG - Affichage recap pour employé: "${employeeId}" (${employeeName})`);
        console.log(`DEBUG - employee object:`, employee);
        
        return (
                  <div
            key={employeeId}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              width: 'fit-content',
              minWidth: '120px',
              maxWidth: '300px',
              alignItems: 'center',
              backgroundColor: pastelColors[index % pastelColors.length],
              padding: '8px',
              borderRadius: '4px'
            }}
          >
            <h4 style={{
              fontFamily: 'Roboto, sans-serif',
              textAlign: 'center',
              marginBottom: '4px',
              lineHeight: '1.2',
              maxHeight: '2.8em',
              fontSize: '14px',
              fontWeight: '700',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              width: '100%'
            }}>
              <span>RECAP</span><br />
              <span>{employeeName}</span>
            </h4>
                      <Button
              className="button-recap"
              onClick={() => {
                console.log('Opening RecapModal for employee (day):', employeeId);
                setShowRecapModal(employeeId);
              }}
              style={{
                backgroundColor: '#1e88e5',
                color: '#fff',
                padding: '8px 16px',
                fontSize: '11px',
                width: '100%',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1565c0'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#1e88e5'}
            >
              JOUR: {calculateEmployeeDayHours(employeeId)}h
            </Button>
                      <Button
              className="button-recap"
              onClick={() => {
                console.log('Opening EmployeeWeeklyRecapModal for employee:', employeeId);
                console.log('setShowEmployeeWeeklyRecap function:', typeof setShowEmployeeWeeklyRecap);
                console.log('setSelectedEmployeeForWeeklyRecap function:', typeof setSelectedEmployeeForWeeklyRecap);
                setSelectedEmployeeForWeeklyRecap(employeeId);
                setShowEmployeeWeeklyRecap(true);
              }}
              style={{
                backgroundColor: '#1e88e5',
                color: '#fff',
                padding: '8px 16px',
                fontSize: '11px',
                width: '100%',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1565c0'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#1e88e5'}
            >
              SEMAINE: {calculateEmployeeWeekHours(employeeId)}h
            </Button>
          {showCalendarTotals && (
            <Button
              className="button-recap"
              onClick={() => {
                console.log('Opening RecapModal for employee (week):', employeeId + '_week');
                setShowRecapModal(employeeId + '_week');
              }}
              style={{
                backgroundColor: '#1e88e5',
                color: '#fff',
                padding: '8px 16px',
                fontSize: '11px',
                width: '100%',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1565c0'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#1e88e5'}
            >
              SEMAINE CAL: {calculateEmployeeWeekHours(employeeId)}h
            </Button>
          )}
                     {(() => {
             // Logique générale pour tous les employés multi-boutiques
             const allEmployees = getAllEmployees(planningData);
             const employeeData = allEmployees.find(emp => emp.id === employeeId);
             const isMultiShopEmployee = employeeData && employeeData.canWorkIn && employeeData.canWorkIn.length > 1;
             
             // Pour tous les employés, utiliser getEmployeeShops
             const employeeShops = getEmployeeShops(employeeId);
             console.log(`DEBUG - employeeShops pour ${employeeId}:`, employeeShops);
             console.log(`DEBUG - employeeShops.length:`, employeeShops.length);
             
             // Si l'employé n'est pas dans getAllEmployees mais a des heures dans plusieurs boutiques, le traiter comme multi-boutique
             if (!employeeData && employeeShops.length > 1) {
               console.log(`DEBUG - ${employeeId} n'est pas dans getAllEmployees mais a ${employeeShops.length} boutiques avec des heures`);
             }
             
                          // Logique unifiée : si l'employé a des heures dans plusieurs boutiques, afficher les boutons séparés
             if (employeeShops.length <= 1) {
              // Employé dans une seule boutique ou pas de données multi-boutiques
              return (
                <Button
                  className="button-recap"
                  onClick={() => {
                    console.log('Bouton MOIS RÉEL cliqué pour employé:', employeeId, 'Heures:', calculateEmployeeMonthHours(employeeId));
                    setSelectedEmployeeForMonthlyRecap(employeeId);
                    setShowEmployeeMonthlyRecap(true);
                  }}
                  style={{
                    backgroundColor: '#1e88e5',
                    color: '#fff',
                    padding: '8px 16px',
                    fontSize: '11px',
                    width: '100%',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1565c0'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#1e88e5'}
                >
                  MOIS: {calculateEmployeeMonthHours(employeeId)}h
                </Button>
              );
            } else {
              // Employé dans plusieurs boutiques - afficher une ligne par boutique
              return (
                <div style={{ width: '100%' }}>
                  {employeeShops.map((shop, shopIndex) => (
                    <Button
                      key={shop.id}
                      className="button-recap"
                      onClick={() => {
                        console.log('Bouton MOIS RÉEL cliqué pour employé:', employeeId, 'Boutique:', shop.name, 'Heures:', shop.hours);
                        setSelectedEmployeeForMonthlyRecap(employeeId);
                        setShowEmployeeMonthlyRecap(true);
                      }}
                      style={{
                        backgroundColor: '#1e88e5',
                        color: '#fff',
                        padding: '4px 8px',
                        fontSize: '10px',
                        width: '100%',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        marginBottom: shopIndex < employeeShops.length - 1 ? '2px' : '0'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1565c0'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#1e88e5'}
                    >
                      {shop.name}: {shop.hours}h
                    </Button>
                  ))}
                  {/* Bouton total global séparé */}
                  <Button
                    className="button-recap"
                    onClick={() => {
                      console.log('Bouton MOIS RÉEL TOTAL GLOBAL cliqué pour employé:', employeeId, 'Heures:', calculateEmployeeTotalMultiShopHours(employeeId));
                      setSelectedEmployeeForMonthlyRecap(employeeId);
                      setShowEmployeeMonthlyRecap(true);
                    }}
                    style={{
                      backgroundColor: '#28a745',
                      color: '#fff',
                      padding: '4px 8px',
                      fontSize: '10px',
                      width: '100%',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      marginTop: '2px'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#218838'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#28a745'}
                  >
                    TOTAL GLOBAL: {calculateEmployeeTotalMultiShopHours(employeeId)}h
                  </Button>
                </div>
              );
            }
          })()}
          {showCalendarTotals && (
            <Button
              className="button-recap"
              onClick={() => {
                console.log('Bouton MOIS CALENDAIRE cliqué pour employé:', employeeId, 'Heures:', calculateEmployeeMonthHours(employeeId));
                // Modale désactivée pour le moment
              }}
              style={{
                backgroundColor: '#1e88e5',
                color: '#fff',
                padding: '8px 16px',
                fontSize: '11px',
                width: '100%',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1565c0'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#1e88e5'}
            >
              MOIS CAL: {calculateEmployeeMonthHours(employeeId)}h
            </Button>
          )}
          <Button
            className="button-recap"
            onClick={() => {
              console.log('Bouton MOIS DÉTAIL cliqué pour employé:', employeeId, 'Heures:', calculateEmployeeMonthHours(employeeId));
              setSelectedEmployeeForMonthlyDetail(employeeId);
              setShowEmployeeMonthlyDetail(true);
            }}
            style={{
              backgroundColor: '#1e88e5',
              color: '#fff',
              padding: '8px 16px',
              fontSize: '11px',
              width: '100%',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1565c0'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#1e88e5'}
          >
                          MOIS DÉTAIL
          </Button>
        </div>
      );
      })}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', width: 'fit-content', minWidth: '120px', maxWidth: '300px', alignItems: 'center' }}>
        <h4 style={{
          fontFamily: 'Roboto, sans-serif',
          textAlign: 'center',
          marginBottom: '4px',
          lineHeight: '1.2',
          maxHeight: '2.8em',
          fontSize: '14px',
          fontWeight: '700',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          width: '100%'
        }}>
          <span>PLANNING</span><br />
          <span>{currentShop}</span><br />
          <span style={{ fontSize: '12px', fontWeight: '400' }}>
            {getSelectedEmployeesCount()}/{getTotalShopEmployeesCount()} employés
          </span>
        </h4>
        <Button
          className="button-recap"
          onClick={() => {
            console.log('Opening RecapModal for week');
            setShowRecapModal('week');
          }}
          style={{
            backgroundColor: '#1e88e5',
            color: '#fff',
            padding: '8px 16px',
            fontSize: '12px',
            width: '100%',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1565c0'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#1e88e5'}
        >
          SEMAINE: {calculateShopWeekHours()}h ({getSelectedEmployeesCount()} emp)
        </Button>
        {showCalendarTotals && (
          <Button
            className="button-recap"
            onClick={() => {
              console.log('Opening RecapModal for week');
              setShowRecapModal('week');
            }}
            style={{
              backgroundColor: '#1e88e5',
              color: '#fff',
              padding: '8px 16px',
              fontSize: '12px',
              width: '100%',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1565c0'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#1e88e5'}
          >
            SEMAINE CAL: {calculateShopWeekHours()}h ({getSelectedEmployeesCount()} emp)
          </Button>
        )}
        {/* Garder uniquement le bouton MOIS GLOBAL */}
        <Button
          className="button-recap"
          onClick={() => {
            console.log('Bouton MOIS GLOBAL cliqué, Heures:', calculateGlobalMonthHours());
            // Modale désactivée pour le moment
          }}
          style={{
            backgroundColor: '#9c27b0',
            color: '#fff',
            padding: '8px 16px',
            fontSize: '12px',
            width: '100%',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#7b1fa2'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#9c27b0'}
        >
          MOIS GLOBAL: {calculateGlobalMonthHours()}h
        </Button>
        <Button
          className="button-recap"
          onClick={() => {
            console.log('Bouton MENSUEL DÉTAIL cliqué');
            // Modale désactivée pour le moment
          }}
          style={{
            backgroundColor: '#1e88e5',
            color: '#fff',
            padding: '8px 16px',
            fontSize: '12px',
            width: '100%',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1565c0'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#1e88e5'}
        >
          MENSUEL DÉTAIL
        </Button>
        <Button
          className="button-recap"
          onClick={() => {
            console.log('Bouton TOTAL SÉLECTIONNÉS cliqué, Heures:', calculateTotalSelectedEmployeesHours());
            // Modale désactivée pour le moment
          }}
          style={{
            backgroundColor: '#4caf50',
            color: '#fff',
            padding: '8px 16px',
            fontSize: '12px',
            width: '100%',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#388e3c'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#4caf50'}
        >
          TOTAL SÉLECTIONNÉS: {calculateTotalSelectedEmployeesHours()}h ({getSelectedEmployeesCount()} emp)
        </Button>
        <Button
          className="button-recap"
          onClick={() => {
            console.log('Bouton TOTAL BOUTIQUE cliqué, Heures:', calculateTotalShopEmployeesHours());
            // Modale désactivée pour le moment
          }}
          style={{
            backgroundColor: '#ff9800',
            color: '#fff',
            padding: '8px 16px',
            fontSize: '12px',
            width: '100%',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f57c00'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#ff9800'}
        >
          TOTAL BOUTIQUE: {calculateTotalShopEmployeesHours()}h ({getTotalShopEmployeesCount()} emp)
        </Button>
      </div>
    </div>
  );
  };
  
  export default RecapButtons;