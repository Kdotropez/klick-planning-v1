import { useState } from 'react';
import { format, addDays, addMinutes, parse } from 'date-fns';
import { fr } from 'date-fns/locale';
import { calculateEmployeeDailyHours } from '../../utils/planningUtils';
import '../../assets/styles.css';

const PlanningTable = ({ 
  config, 
  selectedWeek, 
  planning, 
  selectedEmployees, 
  onToggleSlot, 
  currentDay, 
  currentShopEmployees,
  copyMode = false,
  pasteMode = false,
  selectedSlots = [],
  copiedSlots = null,
  lockedEmployees = []
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [dragValue, setDragValue] = useState(null);
  let clickTimeout = null;

  const getEndTime = (startTime, interval) => {
    if (!startTime) return '-';
    const [hours, minutes] = startTime.split(':').map(Number);
    const date = new Date(2025, 0, 1, hours, minutes);
    return format(addMinutes(date, interval), 'HH:mm');
  };

  const handleMouseDown = (employeeId, slotIndex, dayIndex, event) => {
    if (event.type !== 'mousedown') return;
    
    // Vérifier si l'employé est verrouillé
    if (lockedEmployees.includes(employeeId)) {
      console.log('EMPLOYÉ VERROUILLÉ - Modification bloquée:', employeeId);
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    
    console.log('handleMouseDown called:', { employeeId, slotIndex, dayIndex });
    setIsDragging(true);
    setDragStart({ employeeId, slotIndex, dayIndex });

    const dayKey = format(addDays(new Date(selectedWeek), dayIndex), 'yyyy-MM-dd');
    const currentValue = planning?.[employeeId]?.[dayKey]?.[slotIndex] || false;
    setDragValue(!currentValue);

    clickTimeout = setTimeout(() => {
      if (typeof onToggleSlot === 'function') {
        console.log('Simulating single click:', { employeeId, slotIndex, dayIndex, currentValue });
        onToggleSlot(employeeId, slotIndex, dayIndex, !currentValue);
      } else {
        console.error('onToggleSlot is not a function:', onToggleSlot);
      }
    }, 100);
  };

  const handleMouseMove = (employeeId, slotIndex, dayIndex, event) => {
    if (!isDragging || !dragStart || event.type !== 'mousemove') return;
    if (employeeId !== dragStart.employeeId || dayIndex !== dragStart.dayIndex) return;
    
    // Vérifier si l'employé est verrouillé
    if (lockedEmployees.includes(employeeId)) {
      console.log('EMPLOYÉ VERROUILLÉ - Drag bloqué:', employeeId);
      return;
    }
    
    clearTimeout(clickTimeout);
    console.log('handleMouseMove called:', { employeeId, slotIndex, dayIndex, dragValue });
    if (typeof onToggleSlot === 'function') {
      onToggleSlot(employeeId, slotIndex, dayIndex, dragValue);
    } else {
      console.error('onToggleSlot is not a function:', onToggleSlot);
    }
  };

  const handleMouseUp = () => {
    console.log('handleMouseUp called');
    clearTimeout(clickTimeout);
    setIsDragging(false);
    setDragStart(null);
    setDragValue(null);
  };

  const handleTouchStart = (employeeId, slotIndex, dayIndex, event) => {
    console.log('handleTouchStart called:', { employeeId, slotIndex, dayIndex });
    event.preventDefault();
    
    // Vérifier si l'employé est verrouillé
    if (lockedEmployees.includes(employeeId)) {
      console.log('EMPLOYÉ VERROUILLÉ - Modification bloquée (touch):', employeeId);
      event.stopPropagation();
      return;
    }
    
    if (typeof onToggleSlot !== 'function') {
      console.error('onToggleSlot is not a function:', onToggleSlot);
      return;
    }
    if (!planning || !selectedWeek || currentDay === undefined || !selectedEmployees) {
      console.error('Invalid props:', { planning, selectedWeek, currentDay, selectedEmployees });
      return;
    }
    const dayKey = format(addDays(new Date(selectedWeek), dayIndex), 'yyyy-MM-dd');
    const currentValue = planning?.[employeeId]?.[dayKey]?.[slotIndex] || false;
    console.log('Toggling slot:', { employeeId, dayKey, slotIndex, currentValue });
    onToggleSlot(employeeId, slotIndex, dayIndex, !currentValue);
  };

  // Validation de selectedWeek
  const validWeek = selectedWeek && !isNaN(new Date(selectedWeek).getTime()) ? selectedWeek : format(new Date(), 'yyyy-MM-dd');
  
  const days = Array.from({ length: 7 }, (_, i) => ({
    name: format(addDays(new Date(validWeek), i), 'EEEE', { locale: fr }),
    date: format(addDays(new Date(validWeek), i), 'd MMMM', { locale: fr }),
  }));

  const getEmployeeColorClass = (index) => {
    const colors = ['employee-0', 'employee-1', 'employee-2', 'employee-3', 'employee-4', 'employee-5', 'employee-6'];
    return colors[index % colors.length];
  };

  // Fonction pour déterminer le style d'un créneau selon le mode
  const getSlotStyle = (employeeId, dayIndex, slotIndex) => {
    const dayKey = format(addDays(new Date(validWeek), dayIndex), 'yyyy-MM-dd');
    const slotKey = `${employeeId}_${dayKey}_${slotIndex}`;
    
    if (copyMode) {
      // Mode copie : vérifier si le créneau est sélectionné
      const isSelected = selectedSlots.some(slot => slot.key === slotKey);
      if (isSelected) {
        return {
          backgroundColor: '#007bff',
          color: 'white',
          border: '2px solid #0056b3',
          cursor: 'pointer'
        };
      }
      return {
        backgroundColor: '#f8f9fa',
        border: '1px solid #dee2e6',
        cursor: 'pointer'
      };
    }
    
    if (pasteMode) {
      // Mode collage : style spécial pour indiquer qu'on peut coller
      return {
        backgroundColor: '#e8f5e8',
        border: '2px dashed #28a745',
        cursor: 'pointer'
      };
    }
    
    // Mode normal
    return {};
  };



  return (
    <div className="table-container" onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
      <style jsx>{`
        .locked-employee {
          opacity: 0.7;
          background-color: #f8f9fa;
        }
        
        .locked-employee .fixed-col.locked {
          background-color: #e9ecef;
          color: #6c757d;
          font-style: italic;
        }
        
        .lock-icon {
          margin-left: 8px;
          font-size: 12px;
        }
        
        .locked-employee td {
          cursor: not-allowed;
        }
      `}</style>
      <table className="planning-table">
        <thead>
          <tr>
            <th className="fixed-col header">DE</th>
            {(config?.timeSlots || []).map((slot, index) => (
              <th key={slot.start || slot} className="scrollable-col header">
                {typeof slot === 'string' ? slot : slot.start}
              </th>
            ))}
          </tr>
          <tr>
            <th className="fixed-col header">À</th>
            {(config?.timeSlots || []).map((slot, index) => (
              <th key={slot.start || slot} className="scrollable-col header">
                {index < (config?.timeSlots?.length || 0) - 1
                  ? (typeof config.timeSlots[index + 1] === 'string' ? config.timeSlots[index + 1] : config.timeSlots[index + 1]?.start || '')
                  : getEndTime(typeof slot === 'string' ? slot : slot.start, config?.interval || 30)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(selectedEmployees || []).map((employeeId, employeeIndex) => {
            const dayKey = format(addDays(new Date(validWeek), currentDay), 'yyyy-MM-dd');
            const employeeSlots = planning?.[employeeId]?.[dayKey] || Array(config?.timeSlots?.length || 0).fill(false);
            const hours = calculateEmployeeDailyHours(employeeId, dayKey, planning, config);
            
            // Trouver l'employé dans currentShopEmployees pour récupérer son nom
            const employee = currentShopEmployees?.find(emp => emp.id === employeeId);
            const employeeName = employee?.name || employeeId;
            

            const isLocked = lockedEmployees.includes(employeeId);
            
            return (
              <tr key={employeeId} className={isLocked ? 'locked-employee' : ''}>
                <td className={`fixed-col employee ${getEmployeeColorClass(employeeIndex)} ${isLocked ? 'locked' : ''}`}>
                  {employeeName} ({hours.toFixed(1)} h)
                  {isLocked && <span className="lock-icon">🔒</span>}
                </td>
                {(config?.timeSlots || []).map((_, slotIndex) => {
                  const isChecked = employeeSlots[slotIndex] === true;
                  const slotStyle = getSlotStyle(employeeId, currentDay, slotIndex);

                  return (
                    <td
                      key={slotIndex}
                      className={`scrollable-col ${isChecked ? `clicked-${employeeIndex % 7}` : ''}`}
                      style={slotStyle}
                      onTouchStart={(e) => handleTouchStart(employeeId, slotIndex, currentDay, e)}
                      onMouseDown={(e) => handleMouseDown(employeeId, slotIndex, currentDay, e)}
                      onMouseMove={(e) => handleMouseMove(employeeId, slotIndex, currentDay, e)}
                    >
                      {isChecked && <span className="checkmark">✅</span>}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default PlanningTable;