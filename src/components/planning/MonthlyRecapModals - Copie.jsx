import React from 'react';
import { format, startOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import Button from '../common/Button';
import { calculateEmployeeDailyHours } from '../../utils/planningUtils';
import { loadFromLocalStorage } from '../../utils/localStorage';
import { getWeekPlanning } from '../../utils/planningDataManager';
import '@/assets/styles.css';

const MonthlyRecapModals = ({
  showMonthlyRecapModal,
  setShowMonthlyRecapModal,
  config,
  selectedShop,
  selectedWeek,
  selectedEmployees,
  shops,
  planningData
}) => {
  // Ne rien afficher si la modale n'est pas visible
  if (!showMonthlyRecapModal) {
    return null;
  }

  console.log('🚨🚨🚨 MonthlyRecapModals: COMPONENT RENDERED 🚨🚨🚨');

  // Calculer le total des heures du mois (1er au dernier jour du mois)
  const calculateTotalHours = () => {
    console.log('🚨🚨🚨 MonthlyRecapModals: calculateTotalHours FUNCTION CALLED 🚨🚨🚨');
    
    let totalHours = 0;
    const currentDate = new Date(selectedWeek);
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // Dernier jour du mois
    const lastDayOfMonth = new Date(year, month + 1, 0);
    
    // Parcourir tous les jours du mois (1er au dernier jour)
    for (let day = 1; day <= lastDayOfMonth.getDate(); day++) {
      const dayKey = format(new Date(year, month, day), 'yyyy-MM-dd');
      
      // Trouver la semaine qui contient ce jour
      const dayDate = new Date(year, month, day);
      const weekStart = startOfWeek(dayDate, { weekStartsOn: 1 });
      const weekKey = format(weekStart, 'yyyy-MM-dd');
      
      // Utiliser getWeekPlanning pour normaliser les données
      const weekData = getWeekPlanning(planningData, selectedShop, weekKey);
      const selectedEmployeesForShop = weekData.selectedEmployees || [];
      const weekPlanning = weekData.planning || {};
      
      // Calculer les heures pour chaque employé
      selectedEmployeesForShop.forEach(employee => {
        const hours = calculateEmployeeDailyHours(employee, dayKey, weekPlanning, config);
        totalHours += hours;
      });
    }
    
    console.log('MonthlyRecapModals: Total hours calculated:', totalHours.toFixed(1));
    return totalHours.toFixed(1);
  };

  // Calculer les heures mensuelles pour un employé spécifique
  const calculateEmployeeMonthlyHours = (employee) => {
    console.log(`🚨🚨🚨 MonthlyRecapModals: calculateEmployeeMonthlyHours FUNCTION CALLED for ${employee} 🚨🚨🚨`);
    
    let totalHours = 0;
    const currentDate = new Date(selectedWeek);
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // Dernier jour du mois
    const lastDayOfMonth = new Date(year, month + 1, 0);
    
    // Parcourir tous les jours du mois (1er au dernier jour)
    for (let day = 1; day <= lastDayOfMonth.getDate(); day++) {
      const dayKey = format(new Date(year, month, day), 'yyyy-MM-dd');
      
      // Trouver la semaine qui contient ce jour
      const dayDate = new Date(year, month, day);
      const weekStart = startOfWeek(dayDate, { weekStartsOn: 1 });
      const weekKey = format(weekStart, 'yyyy-MM-dd');
      
      // Utiliser getWeekPlanning pour normaliser les données
      const weekData = getWeekPlanning(planningData, selectedShop, weekKey);
      const weekPlanning = weekData.planning || {};
      
      // Calculer les heures pour l'employé
      const hours = calculateEmployeeDailyHours(employee, dayKey, weekPlanning, config);
      totalHours += hours;
    }
    
    console.log(`MonthlyRecapModals: Employee ${employee} hours:`, totalHours.toFixed(1));
    return totalHours.toFixed(1);
  };

  const shop = Array.isArray(shops) ? shops.find(s => s.id === selectedShop) || { name: 'Boutique' } : { name: 'Boutique' };
  const totalHours = calculateTotalHours();
  const employees = loadFromLocalStorage(`employees_${selectedShop}`, []);

  return (
    <div className="modal-overlay" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
      <div className="modal-content">
        <button
          className="modal-close"
          onClick={() => {
            console.log('MonthlyRecapModals: Closing modal');
            setShowMonthlyRecapModal(false);
          }}
          style={{ color: '#dc3545', fontSize: '18px' }}
        >
          ✕
        </button>
        
        <h3 style={{ fontFamily: 'Roboto, sans-serif', textAlign: 'center' }}>
          Récapitulatif mensuel pour {shop.name} ({totalHours} H)
        </h3>
        
        <p style={{ fontFamily: 'Roboto, sans-serif', textAlign: 'center', marginBottom: '20px' }}>
          Mois de {format(new Date(selectedWeek), 'MMMM yyyy', { locale: fr })}
        </p>

        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ fontFamily: 'Roboto, sans-serif', textAlign: 'center', marginBottom: '10px' }}>
            Totaux par employé (1er au dernier jour du mois)
          </h4>
          
          <table style={{ fontFamily: 'Roboto, sans-serif', width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f0f0f0' }}>
                <th style={{ border: '1px solid #ddd', padding: '8px', fontWeight: '700' }}>Employé(e)</th>
                <th style={{ border: '1px solid #ddd', padding: '8px', fontWeight: '700' }}>Heures effectives</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee, index) => (
                <tr key={index} style={{ backgroundColor: index % 2 === 0 ? '#f9f9f9' : '#ffffff' }}>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{employee}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                    {calculateEmployeeMonthlyHours(employee)} H
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <Button
            className="button-retour"
            onClick={() => {
              console.log('MonthlyRecapModals: Closing modal via button');
              setShowMonthlyRecapModal(false);
            }}
          >
            Fermer
          </Button>
        </div>
      </div>
    </div>
  );
};

export default MonthlyRecapModals;