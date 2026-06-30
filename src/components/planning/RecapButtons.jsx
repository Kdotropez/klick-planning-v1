import React, { useState, useEffect } from 'react';
import { format, addDays, startOfMonth, endOfMonth, isMonday, isWithinInterval, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import Button from '../common/Button';
import { calculateEmployeeDailyHours, formatWorkedHoursForDisplay } from '../../utils/planningUtils';
import { getAllEmployees, hideEmployee, showEmployee, isEmployeeHidden } from '../../utils/planningDataManager';
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

  // État local pour gérer les employés masqués
  const [hiddenEmployees, setHiddenEmployees] = useState(new Set());

  // Vérifier les employés masqués au chargement
  useEffect(() => {
    if (planningData) {
      const hidden = new Set();
      planningData.shops.forEach(shop => {
        shop.employees.forEach(emp => {
          if (isEmployeeHidden(emp, new Date())) {
            hidden.add(emp.id);
          }
        });
      });
      setHiddenEmployees(hidden);
    }
  }, [planningData]);

  // Fonction pour masquer un employé
  const handleHideEmployee = (employeeId) => {
    const updatedPlanningData = hideEmployee(planningData, employeeId, new Date().toISOString());
    // Mettre à jour l'état local
    setHiddenEmployees(prev => new Set([...prev, employeeId]));
    // Forcer la mise à jour du composant parent
    if (planningData !== updatedPlanningData) {
      // Solution simple : recharger la page pour appliquer les changements
      window.location.reload();
    }
  };

  // Fonction pour réactiver un employé
  const handleShowEmployee = (employeeId) => {
    const updatedPlanningData = showEmployee(planningData, employeeId);
    // Mettre à jour l'état local
    setHiddenEmployees(prev => {
      const newSet = new Set(prev);
      newSet.delete(employeeId);
      return newSet;
    });
    // Forcer la mise à jour du composant parent
    if (planningData !== updatedPlanningData) {
      // Solution simple : recharger la page pour appliquer les changements
      window.location.reload();
    }
  };

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
    return hours;
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
    return totalHours;
  };

  // Calculer les heures mensuelles réelles pour un employé (toutes boutiques du mois)
  const calculateEmployeeMonthHours = (employee) => {
    if (!currentWeek || !planningData) return 0;

    const employeeId = typeof employee === 'string' ? employee : employee?.id;
    if (!employeeId) return 0;

    const monthWeekKeys = getMonthWeeks(currentWeek);
    let totalHours = 0;

    (planningData.shops || []).forEach((shop) => {
      if (!shop?.config) return;
      const belongsToShop = (shop.employees || []).some((emp) => emp?.id === employeeId);
      if (!belongsToShop) return;

      monthWeekKeys.forEach((weekKey) => {
        const weekData = shop.weeks?.[weekKey];
        if (!weekData?.planning?.[employeeId]) return;

        const weekStart = parseISO(weekKey);
        for (let i = 0; i < 7; i++) {
          const dayKey = format(addDays(weekStart, i), 'yyyy-MM-dd');
          totalHours += calculateEmployeeDailyHours(
            employeeId,
            dayKey,
            weekData.planning,
            shop.config
          );
        }
      });
    });

    return totalHours;
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
    monthWeeks.forEach((weekKey) => {
      const weekData = shop.weeks?.[weekKey];
      if (weekData && weekData.planning) {
        const weekStart = parseISO(weekKey);
        shop.employees.forEach(employee => {
          if (weekData.planning[employee.id]) {
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
    
    return totalMonthHours;
  };

  // Calculer les heures d'un employé dans une boutique spécifique
  const calculateEmployeeShopHours = (employee, shopId) => {
    if (!currentWeek || !planningData) return 0;
    
    const shop = planningData.shops.find(s => s.id === shopId);
    if (!shop || !shop.config) return 0;
    
    // Récupérer le planning de cette boutique pour cette semaine
    const weekData = shop.weeks?.[currentWeek];
    if (!weekData || !weekData.planning) {
      return 0;
    }
    
    // Calculer les heures pour cette semaine dans cette boutique
    let totalHours = 0;
    for (let i = 0; i < 7; i++) {
      const dayDate = format(addDays(new Date(currentWeek), i), 'yyyy-MM-dd');
      const hours = calculateEmployeeDailyHours(employee, dayDate, weekData.planning, shop.config);
      totalHours += hours;
    }
    
    return totalHours;
  };

  // Calculer le total des heures d'un employé dans toutes ses boutiques
  const calculateEmployeeTotalMultiShopHours = (employee) => {
    if (!currentWeek || !planningData) return 0;
    
    const employeeShops = getEmployeeShops(employee);
    if (employeeShops.length <= 1) {
      const weekHours = calculateEmployeeWeekHours(employee);
      return weekHours;
    }
    
    let totalHours = 0;
    employeeShops.forEach(shop => {
      const shopHours = calculateEmployeeShopHours(employee, shop.id);
      totalHours += shopHours;
    });
    
    return totalHours;
  };

    // Obtenir les boutiques où un employé travaille ET a des données
  const getEmployeeShops = (employee) => {
    if (!planningData || !currentWeek) return [];
    
    // Trouver l'ID de l'employé
    let employeeId = employee;
    const allEmployees = planningData.shops?.flatMap(shop => shop.employees || []) || [];
    const employeeData = allEmployees.find(emp => emp.name === employee || emp.id === employee);
    if (employeeData) {
      employeeId = employeeData.id;
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
    
    return Array.from(employeeShops.entries()).map(([id, name]) => ({ id, name }));
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
    return totalHours;
  };

  // Calculer les heures mensuelles pour la boutique (employés sélectionnés)
  const calculateShopMonthHours = () => {
    if (!currentWeek || !currentShop || !planningData || !selectedEmployees?.length) return 0;

    const shop = planningData.shops.find((s) => s.id === currentShop);
    if (!shop?.config) return 0;

    const monthWeekKeys = getMonthWeeks(currentWeek);
    let totalHours = 0;

    selectedEmployees.forEach((employeeId) => {
      monthWeekKeys.forEach((weekKey) => {
        const weekData = shop.weeks?.[weekKey];
        if (!weekData?.planning?.[employeeId]) return;

        const weekStart = parseISO(weekKey);
        for (let i = 0; i < 7; i++) {
          const dayKey = format(addDays(weekStart, i), 'yyyy-MM-dd');
          totalHours += calculateEmployeeDailyHours(
            employeeId,
            dayKey,
            weekData.planning,
            shop.config
          );
        }
      });
    });

    return totalHours;
  };

  // Calculer le total des heures pour tous les employés sélectionnés
  const calculateTotalSelectedEmployeesHours = () => {
    if (!selectedEmployees || selectedEmployees.length === 0) return 0;
    let totalHours = 0;
    selectedEmployees.forEach(employeeId => {
      totalHours += calculateEmployeeWeekHours(employeeId);
    });
    return totalHours;
  };

  // Calculer le total des heures pour tous les employés de la boutique
  const calculateTotalShopEmployeesHours = () => {
    if (!currentShopEmployees || currentShopEmployees.length === 0 || !planning) return 0;
    let totalHours = 0;
    currentShopEmployees.forEach(employee => {
      totalHours += calculateEmployeeWeekHours(employee.id);
    });
    return totalHours;
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
  // CORRECTION : Utiliser la date de la semaine sélectionnée pour le filtrage des employés masqués
  // L'employé est masqué uniquement à partir de sa date hiddenFrom, par rapport à la semaine affichée
  const weekDate = new Date(currentWeek); // Date de la semaine sélectionnée pour le filtrage des employés masqués
  const allEmployees = getAllEmployees(planningData, weekDate);
  
  return (
    <div className="recap-buttons" style={{ display: 'flex', flexDirection: 'row', overflowX: 'auto', justifyContent: 'center', gap: '12px', marginBottom: '15px' }}>
      {(allEmployees || []).map((employee, index) => {
        const employeeId = employee.id;
        const employeeName = employee?.name || employeeId;
        
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
              JOUR: {formatWorkedHoursForDisplay(calculateEmployeeDayHours(employeeId))}
            </Button>
                      <Button
              className="button-recap"
              onClick={() => {
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
              SEMAINE: {formatWorkedHoursForDisplay(calculateEmployeeWeekHours(employeeId))}
            </Button>
          {showCalendarTotals && (
            <Button
              className="button-recap"
              onClick={() => {
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
              SEMAINE CAL: {formatWorkedHoursForDisplay(calculateEmployeeWeekHours(employeeId))}
            </Button>
          )}
                     {(() => {
             const employeeShops = getEmployeeShops(employeeId);

             // Logique unifiée : si l'employé a des heures dans plusieurs boutiques, afficher les boutons séparés
             if (employeeShops.length <= 1) {
              // Employé dans une seule boutique ou pas de données multi-boutiques
              return (
                <Button
                  className="button-recap"
                  onClick={() => {
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
                  MOIS: {formatWorkedHoursForDisplay(calculateEmployeeMonthHours(employeeId))}
                </Button>
              );
            } else {
              // Employé dans plusieurs boutiques - afficher une ligne par boutique
              return (
                <div style={{ width: '100%' }}>
                  {employeeShops.map((shop, shopIndex) => (
                    <Button
                      key={shop.id || shopIndex}
                      className="button-recap"
                      onClick={() => {
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
                      {shop.name}: {formatWorkedHoursForDisplay(calculateEmployeeShopHours(employeeId, shop.id))}
                    </Button>
                  ))}
                  {/* Bouton total global séparé */}
                  <Button
                    className="button-recap"
                    onClick={() => {
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
                    TOTAL GLOBAL: {formatWorkedHoursForDisplay(calculateEmployeeTotalMultiShopHours(employeeId))}
                  </Button>
                </div>
              );
            }
          })()}
          {showCalendarTotals && (
            <Button
              className="button-recap"
              onClick={() => {
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
              MOIS CAL: {formatWorkedHoursForDisplay(calculateEmployeeMonthHours(employeeId))}
            </Button>
          )}
          <Button
            className="button-recap"
            onClick={() => {
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
          
          {isEmployeeHidden(employee, weekDate) ? (
            <Button
              className="button-recap"
              onClick={() => handleShowEmployee(employeeId)}
              style={{
                backgroundColor: '#6c757d',
                color: '#fff',
                padding: '8px 16px',
                fontSize: '11px',
                width: '100%',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
              onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#5a6268'; }}
              onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#6c757d'; }}
            >
              Réactiver
            </Button>
          ) : (
            <Button
              className="button-recap"
              onClick={() => handleHideEmployee(employeeId)}
              style={{
                backgroundColor: '#dc3545',
                color: '#fff',
                padding: '8px 16px',
                fontSize: '11px',
                width: '100%',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
              onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#c82333'; }}
              onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#dc3545'; }}
            >
              Masquer
            </Button>
          )}
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
          SEMAINE: {formatWorkedHoursForDisplay(calculateShopWeekHours())} ({getSelectedEmployeesCount()} emp)
        </Button>
        {showCalendarTotals && (
          <Button
            className="button-recap"
            onClick={() => {
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
            SEMAINE CAL: {formatWorkedHoursForDisplay(calculateShopWeekHours())} ({getSelectedEmployeesCount()} emp)
          </Button>
        )}
        {/* Garder uniquement le bouton MOIS GLOBAL */}
        <Button
          className="button-recap"
          onClick={() => {
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
          MOIS GLOBAL: {formatWorkedHoursForDisplay(calculateGlobalMonthHours())}
        </Button>
        <Button
          className="button-recap"
          onClick={() => {
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
          TOTAL SÉLECTIONNÉS: {formatWorkedHoursForDisplay(calculateTotalSelectedEmployeesHours())} ({getSelectedEmployeesCount()} emp)
        </Button>
        <Button
          className="button-recap"
          onClick={() => {
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
          TOTAL BOUTIQUE: {formatWorkedHoursForDisplay(calculateTotalShopEmployeesHours())} ({getTotalShopEmployeesCount()} emp)
        </Button>
      </div>
    </div>
  );
  };
  
  export default RecapButtons;
