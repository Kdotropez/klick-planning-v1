import React from 'react';
import { format, addDays } from 'date-fns';
import { calculateEmployeeDailyHours } from '../../utils/planningUtils';

const RecapButtonsModule = ({
  employeeId,
  employeeName,
  selectedWeek,
  selectedShop,
  planning,
  planningData,
  config,
  deviceInfo,
  setSelectedEmployeeForWeeklyRecap,
  setShowEmployeeWeeklyRecap,
  setSelectedEmployeeForMonthlyRecap,
  setShowEmployeeMonthlyRecap,
  setSelectedEmployeeForMonthlyDetail,
  setShowEmployeeMonthlyDetail
}) => {
  
  // Calcul des heures hebdomadaires
  const calculateWeeklyHours = () => {
    if (!selectedWeek || !selectedShop || !planning) return '0.0';
    let totalHours = 0;
    for (let i = 0; i < 7; i++) {
      const dayKey = format(addDays(new Date(selectedWeek), i), 'yyyy-MM-dd');
      const hours = calculateEmployeeDailyHours(employeeId, dayKey, planning, config);
      totalHours += hours;
    }
    return totalHours.toFixed(1);
  };

  // Calcul des heures mensuelles
  const calculateMonthlyHours = () => {
    if (!selectedWeek || !planningData) return '0.0';
    
    const currentDate = new Date(selectedWeek);
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const lastDayOfMonth = new Date(year, month + 1, 0);
    let totalHours = 0;
    
    for (let day = 1; day <= lastDayOfMonth.getDate(); day++) {
      const dayKey = format(new Date(year, month, day), 'yyyy-MM-dd');
      
      if (planningData.shops) {
        planningData.shops.forEach(shop => {
          if (shop.weeks) {
            Object.keys(shop.weeks).forEach(weekKey => {
              const weekData = shop.weeks[weekKey];
              if (weekData.planning && weekData.planning[employeeId] && weekData.planning[employeeId][dayKey]) {
                const slots = weekData.planning[employeeId][dayKey];
                if (Array.isArray(slots) && slots.some(slot => slot === true)) {
                  const hours = calculateEmployeeDailyHours(employeeId, dayKey, { [employeeId]: { [dayKey]: slots } }, config);
                  totalHours += hours;
                }
              }
            });
          }
        });
      }
    }
    
    return totalHours.toFixed(1);
  };

  // Calcul des heures mensuelles avec 2 décimales
  const calculateMonthlyHoursDetailed = () => {
    if (!selectedWeek || !planningData) return '0.00';
    
    const currentDate = new Date(selectedWeek);
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const lastDayOfMonth = new Date(year, month + 1, 0);
    let totalHours = 0;
    
    for (let day = 1; day <= lastDayOfMonth.getDate(); day++) {
      const dayKey = format(new Date(year, month, day), 'yyyy-MM-dd');
      
      if (planningData.shops) {
        planningData.shops.forEach(shop => {
          if (shop.weeks) {
            Object.keys(shop.weeks).forEach(weekKey => {
              const weekData = shop.weeks[weekKey];
              if (weekData.planning && weekData.planning[employeeId] && weekData.planning[employeeId][dayKey]) {
                const slots = weekData.planning[employeeId][dayKey];
                if (Array.isArray(slots) && slots.some(slot => slot === true)) {
                  const hours = calculateEmployeeDailyHours(employeeId, dayKey, { [employeeId]: { [dayKey]: slots } }, config);
                  totalHours += hours;
                }
              }
            });
          }
        });
      }
    }
    
    return totalHours.toFixed(2);
  };

  // Calcul des heures hebdomadaires par boutique
  const calculateWeeklyHoursByShop = (shop) => {
    if (!selectedWeek || !planningData) return '0.0';
    let totalHours = 0;
    for (let i = 0; i < 7; i++) {
      const dayKey = format(addDays(new Date(selectedWeek), i), 'yyyy-MM-dd');
      if (shop.weeks && shop.weeks[selectedWeek]?.planning?.[employeeId]?.[dayKey]) {
        const slots = shop.weeks[selectedWeek].planning[employeeId][dayKey];
        if (Array.isArray(slots) && slots.some(slot => slot === true)) {
          const hours = calculateEmployeeDailyHours(employeeId, dayKey, { [employeeId]: { [dayKey]: slots } }, config);
          totalHours += hours;
        }
      }
    }
    return totalHours.toFixed(1);
  };

  // Calcul des heures mensuelles par boutique
  const calculateMonthlyHoursByShop = (shop) => {
    if (!selectedWeek || !planningData) return '0.0';
    const currentDate = new Date(selectedWeek);
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const lastDayOfMonth = new Date(year, month + 1, 0);
    let totalHours = 0;
    
    for (let day = 1; day <= lastDayOfMonth.getDate(); day++) {
      const dayKey = format(new Date(year, month, day), 'yyyy-MM-dd');
      if (shop.weeks) {
        Object.keys(shop.weeks).forEach(weekKey => {
          const weekData = shop.weeks[weekKey];
          if (weekData.planning && weekData.planning[employeeId] && weekData.planning[employeeId][dayKey]) {
            const slots = weekData.planning[employeeId][dayKey];
            if (Array.isArray(slots) && slots.some(slot => slot === true)) {
              const hours = calculateEmployeeDailyHours(employeeId, dayKey, { [employeeId]: { [dayKey]: slots } }, config);
              totalHours += hours;
            }
          }
        });
      }
    }
    return totalHours.toFixed(1);
  };

  // Vérifier si l'employé a des données dans au moins une boutique
  const hasEmployeeData = () => {
    return planningData?.shops?.some(shop => 
      shop.weeks && Object.keys(shop.weeks).some(weekKey => 
        shop.weeks[weekKey]?.planning?.[employeeId]
      )
    );
  };

  const firstShop = planningData?.shops?.[0];
  const secondShop = planningData?.shops?.[1];
  const employeeHasData = hasEmployeeData();

  return (
    <>
      {/* Bouton Semaine principal - Couleur verte */}
      <button
        onClick={() => {
          setSelectedEmployeeForWeeklyRecap(employeeId);
          setShowEmployeeWeeklyRecap(true);
        }}
        style={{
          backgroundColor: '#2e7d32',
          color: 'white',
          padding: deviceInfo.isTablet ? '14px 18px' : '12px 16px',
          fontSize: deviceInfo.isTablet ? '15px' : '13px',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          marginBottom: '6px',
          fontWeight: '600',
          transition: 'all 0.3s ease',
          boxShadow: '0 3px 8px rgba(46, 125, 50, 0.3)',
          whiteSpace: 'nowrap',
          minHeight: deviceInfo.isTablet ? '48px' : '40px',
          letterSpacing: '0.5px',
          width: '100%'
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.backgroundColor = '#1b5e20';
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 6px 16px rgba(46, 125, 50, 0.4)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.backgroundColor = '#2e7d32';
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 3px 8px rgba(46, 125, 50, 0.3)';
        }}
        title="Récapitulatif hebdomadaire"
      >
        📊 Semaine: {calculateWeeklyHours()}h
      </button>

      {/* Section Semaines par boutique - Toujours 2 boutons */}
      <div style={{ width: '100%', marginBottom: '6px' }}>
        <div style={{ 
          fontSize: '11px', 
          fontWeight: '600', 
          color: '#2e7d32', 
          marginBottom: '4px',
          textAlign: 'center'
        }}>
          Semaines par boutique
        </div>
        
        {/* Premier bouton - Boutique 1 ou placeholder */}
        {employeeHasData ? (
          <button
            onClick={() => {
              setSelectedEmployeeForWeeklyRecap(employeeId);
              setShowEmployeeWeeklyRecap(true);
            }}
            style={{
              backgroundColor: '#2e7d32',
              color: 'white',
              padding: deviceInfo.isTablet ? '10px 14px' : '8px 12px',
              fontSize: deviceInfo.isTablet ? '13px' : '11px',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              marginBottom: '4px',
              fontWeight: '600',
              transition: 'all 0.3s ease',
              boxShadow: '0 2px 6px rgba(46, 125, 50, 0.3)',
              whiteSpace: 'nowrap',
              width: '100%',
              letterSpacing: '0.5px'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#1b5e20';
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(46, 125, 50, 0.4)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#2e7d32';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 6px rgba(46, 125, 50, 0.3)';
            }}
            title={`Semaine - ${firstShop?.name || 'Boutique 1'}`}
          >
            📊 {firstShop?.name || 'Boutique 1'}: {calculateWeeklyHoursByShop(firstShop)}h
          </button>
        ) : (
          <button
            disabled
            style={{
              backgroundColor: '#f8f9fa',
              color: '#6c757d',
              padding: deviceInfo.isTablet ? '10px 14px' : '8px 12px',
              fontSize: deviceInfo.isTablet ? '13px' : '11px',
              border: '1px solid #dee2e6',
              borderRadius: '6px',
              cursor: 'not-allowed',
              marginBottom: '4px',
              fontWeight: '600',
              width: '100%',
              letterSpacing: '0.5px'
            }}
            title="Aucune boutique"
          >
            📊 -
          </button>
        )}
        
        {/* Deuxième bouton - Boutique 2 ou placeholder */}
        {employeeHasData ? (
          <button
            onClick={() => {
              setSelectedEmployeeForWeeklyRecap(employeeId);
              setShowEmployeeWeeklyRecap(true);
            }}
            style={{
              backgroundColor: '#2e7d32',
              color: 'white',
              padding: deviceInfo.isTablet ? '10px 14px' : '8px 12px',
              fontSize: deviceInfo.isTablet ? '13px' : '11px',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              marginBottom: '4px',
              fontWeight: '600',
              transition: 'all 0.3s ease',
              boxShadow: '0 2px 6px rgba(46, 125, 50, 0.3)',
              whiteSpace: 'nowrap',
              width: '100%',
              letterSpacing: '0.5px'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#1b5e20';
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(46, 125, 50, 0.4)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#2e7d32';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 6px rgba(46, 125, 50, 0.3)';
            }}
            title={`Semaine - ${secondShop?.name || 'Boutique 2'}`}
          >
            📊 {secondShop?.name || 'Boutique 2'}: {calculateWeeklyHoursByShop(secondShop)}h
          </button>
        ) : (
          <button
            disabled
            style={{
              backgroundColor: '#f8f9fa',
              color: '#6c757d',
              padding: deviceInfo.isTablet ? '10px 14px' : '8px 12px',
              fontSize: deviceInfo.isTablet ? '13px' : '11px',
              border: '1px solid #dee2e6',
              borderRadius: '6px',
              cursor: 'not-allowed',
              marginBottom: '4px',
              fontWeight: '600',
              width: '100%',
              letterSpacing: '0.5px'
            }}
            title="Aucune boutique"
          >
            📊 -
          </button>
        )}
      </div>

      {/* Section Mois par boutique - Toujours 2 boutons */}
      <div style={{ width: '100%', marginBottom: '6px' }}>
        <div style={{ 
          fontSize: '11px', 
          fontWeight: '600', 
          color: '#1e88e5', 
          marginBottom: '4px',
          textAlign: 'center'
        }}>
          Mois par boutique
        </div>
        
        {/* Premier bouton - Boutique 1 ou placeholder */}
        {employeeHasData ? (
          <button
            onClick={() => {
              setSelectedEmployeeForMonthlyRecap(employeeId);
              setShowEmployeeMonthlyRecap(true);
            }}
            style={{
              backgroundColor: '#1e88e5',
              color: 'white',
              padding: deviceInfo.isTablet ? '10px 14px' : '8px 12px',
              fontSize: deviceInfo.isTablet ? '13px' : '11px',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              marginBottom: '4px',
              fontWeight: '600',
              transition: 'all 0.3s ease',
              boxShadow: '0 2px 6px rgba(30, 136, 229, 0.3)',
              whiteSpace: 'nowrap',
              width: '100%',
              letterSpacing: '0.5px'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#1565c0';
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(30, 136, 229, 0.4)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#1e88e5';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 6px rgba(30, 136, 229, 0.3)';
            }}
            title={`Mois - ${firstShop?.name || 'Boutique 1'}`}
          >
            📈 {firstShop?.name || 'Boutique 1'}: {calculateMonthlyHoursByShop(firstShop)}h
          </button>
        ) : (
          <button
            disabled
            style={{
              backgroundColor: '#f8f9fa',
              color: '#6c757d',
              padding: deviceInfo.isTablet ? '10px 14px' : '8px 12px',
              fontSize: deviceInfo.isTablet ? '13px' : '11px',
              border: '1px solid #dee2e6',
              borderRadius: '6px',
              cursor: 'not-allowed',
              marginBottom: '4px',
              fontWeight: '600',
              width: '100%',
              letterSpacing: '0.5px'
            }}
            title="Aucune boutique"
          >
            📈 -
          </button>
        )}
        
        {/* Deuxième bouton - Boutique 2 ou placeholder */}
        {employeeHasData ? (
          <button
            onClick={() => {
              setSelectedEmployeeForMonthlyRecap(employeeId);
              setShowEmployeeMonthlyRecap(true);
            }}
            style={{
              backgroundColor: '#1e88e5',
              color: 'white',
              padding: deviceInfo.isTablet ? '10px 14px' : '8px 12px',
              fontSize: deviceInfo.isTablet ? '13px' : '11px',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              marginBottom: '4px',
              fontWeight: '600',
              transition: 'all 0.3s ease',
              boxShadow: '0 2px 6px rgba(30, 136, 229, 0.3)',
              whiteSpace: 'nowrap',
              width: '100%',
              letterSpacing: '0.5px'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#1565c0';
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(30, 136, 229, 0.4)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#1e88e5';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 6px rgba(30, 136, 229, 0.3)';
            }}
            title={`Mois - ${secondShop?.name || 'Boutique 2'}`}
          >
            📈 {secondShop?.name || 'Boutique 2'}: {calculateMonthlyHoursByShop(secondShop)}h
          </button>
        ) : (
          <button
            disabled
            style={{
              backgroundColor: '#f8f9fa',
              color: '#6c757d',
              padding: deviceInfo.isTablet ? '10px 14px' : '8px 12px',
              fontSize: deviceInfo.isTablet ? '13px' : '11px',
              border: '1px solid #dee2e6',
              borderRadius: '6px',
              cursor: 'not-allowed',
              marginBottom: '4px',
              fontWeight: '600',
              width: '100%',
              letterSpacing: '0.5px'
            }}
            title="Aucune boutique"
          >
            📈 -
          </button>
        )}
      </div>

      {/* Bouton Mois global - Couleur bleue - Vue multi-boutiques */}
      <button
        onClick={() => {
          setSelectedEmployeeForMonthlyRecap(employeeId);
          setShowEmployeeMonthlyRecap(true);
        }}
        style={{
          backgroundColor: '#1e88e5',
          color: 'white',
          padding: deviceInfo.isTablet ? '14px 18px' : '12px 16px',
          fontSize: deviceInfo.isTablet ? '15px' : '13px',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          marginBottom: '6px',
          fontWeight: '600',
          transition: 'all 0.3s ease',
          boxShadow: '0 3px 8px rgba(30, 136, 229, 0.3)',
          whiteSpace: 'nowrap',
          minHeight: deviceInfo.isTablet ? '48px' : '40px',
          letterSpacing: '0.5px',
          width: '100%'
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.backgroundColor = '#1565c0';
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 6px 16px rgba(30, 136, 229, 0.4)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.backgroundColor = '#1e88e5';
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 3px 8px rgba(30, 136, 229, 0.3)';
        }}
        title="Récapitulatif mensuel multi-boutiques"
      >
        📈 Mois: {calculateMonthlyHours()}h
      </button>
      
      {/* Bouton Mois: XX.00h - Couleur bleue */}
      <button
        onClick={() => {
          setSelectedEmployeeForMonthlyDetail(employeeId);
          setShowEmployeeMonthlyDetail(true);
        }}
        style={{
          backgroundColor: '#1e88e5',
          color: 'white',
          padding: deviceInfo.isTablet ? '14px 18px' : '12px 16px',
          fontSize: deviceInfo.isTablet ? '15px' : '13px',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          marginBottom: '6px',
          fontWeight: '600',
          transition: 'all 0.3s ease',
          boxShadow: '0 3px 8px rgba(30, 136, 229, 0.3)',
          whiteSpace: 'nowrap',
          minHeight: deviceInfo.isTablet ? '48px' : '40px',
          letterSpacing: '0.5px',
          width: '100%'
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.backgroundColor = '#1565c0';
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 6px 16px rgba(30, 136, 229, 0.4)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.backgroundColor = '#1e88e5';
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 3px 8px rgba(30, 136, 229, 0.3)';
        }}
        title="Récapitulatif mensuel détaillé"
      >
        📋 Mois: {calculateMonthlyHoursDetailed()}h
      </button>
      
      {/* Bouton Detail/mois/boutique - Couleur bleue - Vue mono-boutique */}
      <button
        onClick={() => {
          setSelectedEmployeeForMonthlyDetail(employeeId);
          setShowEmployeeMonthlyDetail(true);
        }}
        style={{
          backgroundColor: '#1e88e5',
          color: 'white',
          padding: deviceInfo.isTablet ? '14px 18px' : '12px 16px',
          fontSize: deviceInfo.isTablet ? '15px' : '13px',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          marginBottom: '6px',
          fontWeight: '600',
          transition: 'all 0.3s ease',
          boxShadow: '0 3px 8px rgba(30, 136, 229, 0.3)',
          whiteSpace: 'nowrap',
          minHeight: deviceInfo.isTablet ? '48px' : '40px',
          letterSpacing: '0.5px',
          width: '100%'
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.backgroundColor = '#1565c0';
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 6px 16px rgba(30, 136, 229, 0.4)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.backgroundColor = '#1e88e5';
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 3px 8px rgba(30, 136, 229, 0.3)';
        }}
        title="Detail/mois/boutique - Vue mono-boutique"
      >
        📈 Detail/mois/boutique
      </button>
    </>
  );
};

export default RecapButtonsModule;
