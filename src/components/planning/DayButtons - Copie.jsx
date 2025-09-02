import React from 'react';
import { format, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { calculateEmployeeDailyHours } from '../../utils/planningUtils';
import { loadFromLocalStorage } from '../../utils/localStorage';
import '@/assets/styles.css';

const DayButtons = ({ days, currentDay, setCurrentDay, planning, config, selectedEmployees, selectedWeek, selectedShop }) => {
  const calculateDayHours = (dayIndex) => {
    // Vérifier que toutes les données nécessaires sont disponibles
    if (!selectedWeek || !selectedShop || !config || !selectedEmployees || !planning) {
      return '0.0';
    }
    
    // Vérifier que selectedWeek est valide
    if (isNaN(new Date(selectedWeek).getTime())) {
      console.warn('calculateDayHours: selectedWeek is invalid', selectedWeek);
      return '0.0';
    }
    
    // Vérifier que selectedEmployees est valide
    if (!Array.isArray(selectedEmployees) || selectedEmployees.length === 0) {
      return '0.0';
    }
    
    const dayKey = format(addDays(new Date(selectedWeek), dayIndex), 'yyyy-MM-dd');
    let totalHours = 0;
    
    selectedEmployees.forEach(employee => {
      const hours = calculateEmployeeDailyHours(employee, dayKey, planning, config);
      totalHours += isNaN(hours) ? 0 : hours;
    });
    
    return totalHours.toFixed(1);
  };

  return (
    <div className="day-buttons" style={{ display: 'flex', justifyContent: 'center', marginBottom: '15px' }}>
      {days.map((day, index) => (
        <button
          key={index}
          className={`day-button ${currentDay === index ? 'active' : ''}`}
          onClick={() => setCurrentDay(index)}
          style={{
            fontFamily: 'Roboto, sans-serif',
            padding: '12px 20px',
            margin: '0 8px',
            border: currentDay === index ? '2px solid #4caf50' : '1px solid #ddd',
            backgroundColor: currentDay === index ? '#e6ffed' : '#fff',
            cursor: 'pointer',
            borderRadius: '8px',
            minWidth: '120px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
            {day.name}
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            {day.date}
          </div>
          <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#4caf50' }}>
            {calculateDayHours(index)} h
          </div>
        </button>
      ))}
    </div>
  );
};

export default DayButtons;