import { useState, useRef, useEffect } from 'react';
import { format, addDays, addMinutes, parse } from 'date-fns';
import { fr } from 'date-fns/locale';
import { calculateEmployeeDailyHours } from '../../utils/planningUtils';
import { useDeviceDetection } from '../../hooks/useDeviceDetection';
import '../../assets/styles.css';

const PlanningTable = ({ 
  config, 
  selectedWeek, 
  planning, 
  selectedEmployees, 
  onToggleSlot, 
  onSetDayStatus,
  currentDay, 
  currentShopEmployees,
  copyMode = false,
  pasteMode = false,
  selectedSlots = [],
  copiedSlots = null,
  lockedEmployees = [],
  planningData = null,
  selectedShop = null
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [dragValue, setDragValue] = useState(null);
  const [edgeSelection, setEdgeSelection] = useState(null); // { employeeId, dayIndex, edge: 'first' | 'last', ts }
  const edgeTimerRef = useRef(null);
  let clickTimeout = null;

  // Détection d'appareil tactile
  const { isTouchDevice, isTablet } = useDeviceDetection();

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

    const dayKey = format(addDays(new Date(selectedWeek), dayIndex), 'yyyy-MM-dd');
    const dayData = planning?.[employeeId]?.[dayKey];
    // Si un statut (Maladie/Congé) est déjà posé (nouveau ou legacy)
    const hasStatus = (
      typeof dayData === 'string' ||
      (Array.isArray(dayData) && dayData.some(v => v === 'M' || v === 'C' || (typeof v === 'string' && (v.toLowerCase().includes('maladie') || v.toLowerCase().includes('congé')))))
    );
    const totalSlots = (config?.timeSlots?.length || 0);
    const isFirst = slotIndex === 0;
    const isLast = slotIndex === totalSlots - 1;
    if (hasStatus) {
      // Autoriser la gestuelle premier+dernier pour RETIRER le statut
      if (isFirst || isLast) {
        const now = Date.now();
        const edge = isFirst ? 'first' : 'last';
        if (
          edgeSelection &&
          edgeSelection.employeeId === employeeId &&
          edgeSelection.dayIndex === dayIndex &&
          edgeSelection.edge !== edge &&
          now - edgeSelection.ts <= 3000
        ) {
          if (edgeTimerRef.current) clearTimeout(edgeTimerRef.current);
          setEdgeSelection(null);
          if (typeof onSetDayStatus === 'function') {
            event.preventDefault();
            if (clickTimeout) clearTimeout(clickTimeout);
            onSetDayStatus(employeeId, dayIndex, 'none');
            return;
          }
        } else {
          setEdgeSelection({ employeeId, dayIndex, edge, ts: now });
          if (edgeTimerRef.current) clearTimeout(edgeTimerRef.current);
          edgeTimerRef.current = setTimeout(() => setEdgeSelection(null), 3000);
          event.preventDefault();
          return;
        }
      }
      event.preventDefault();
      return;
    }
    const currentValue = Array.isArray(dayData) ? (dayData?.[slotIndex] || false) : false;

    // Geste maladie: clic premier et dernier créneau
    if (isFirst || isLast) {
      const now = Date.now();
      const edge = isFirst ? 'first' : 'last';
      if (
        edgeSelection &&
        edgeSelection.employeeId === employeeId &&
        edgeSelection.dayIndex === dayIndex &&
        edgeSelection.edge !== edge &&
        edgeSelection.type === 'maladie' &&
        now - edgeSelection.ts <= 3000
      ) {
        // Complète le geste -> marquer maladie
        if (edgeTimerRef.current) clearTimeout(edgeTimerRef.current);
        setEdgeSelection(null);
        if (typeof onSetDayStatus === 'function') {
          event.preventDefault();
          if (clickTimeout) clearTimeout(clickTimeout);
          onSetDayStatus(employeeId, dayIndex, 'maladie');
          return;
        }
      } else {
        // Démarrer la sélection de maladie
        setEdgeSelection({ employeeId, dayIndex, edge, ts: now, type: 'maladie' });
        if (edgeTimerRef.current) clearTimeout(edgeTimerRef.current);
        edgeTimerRef.current = setTimeout(() => setEdgeSelection(null), 3000);
        // Ne pas return ici pour permettre le clic normal
      }
    }

    // Geste congé: clic deuxième et avant-dernier créneau
    const isSecond = slotIndex === 1;
    const isSecondLast = slotIndex === totalSlots - 2;
    if (isSecond || isSecondLast) {
      const now = Date.now();
      const edge = isSecond ? 'second' : 'secondLast';
      if (
        edgeSelection &&
        edgeSelection.employeeId === employeeId &&
        edgeSelection.dayIndex === dayIndex &&
        edgeSelection.edge !== edge &&
        edgeSelection.type === 'conge' &&
        now - edgeSelection.ts <= 3000
      ) {
        // Complète le geste -> marquer congé
        if (edgeTimerRef.current) clearTimeout(edgeTimerRef.current);
        setEdgeSelection(null);
        if (typeof onSetDayStatus === 'function') {
          event.preventDefault();
          if (clickTimeout) clearTimeout(clickTimeout);
          onSetDayStatus(employeeId, dayIndex, 'conge');
          return;
        }
      } else {
        // Démarrer la sélection de congé
        setEdgeSelection({ employeeId, dayIndex, edge, ts: now, type: 'conge' });
        if (edgeTimerRef.current) clearTimeout(edgeTimerRef.current);
        edgeTimerRef.current = setTimeout(() => setEdgeSelection(null), 3000);
        // Ne pas return ici pour permettre le clic normal
      }
    }

    // Annulation automatique des sélections maladie/congé si clic sur créneaux intermédiaires
    if (edgeSelection && 
        edgeSelection.employeeId === employeeId && 
        edgeSelection.dayIndex === dayIndex &&
        !isFirst && !isLast && !isSecond && !isSecondLast) {
      console.log('Annulation automatique de la sélection (clic sur créneau intermédiaire)');
      setEdgeSelection(null);
      if (edgeTimerRef.current) clearTimeout(edgeTimerRef.current);
    }

    // Sinon, comportement normal (drag/toggle)
    setIsDragging(true);
    setDragStart({ employeeId, slotIndex, dayIndex });
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
    event.stopPropagation();
    
    // Vérifier si l'employé est verrouillé
    if (lockedEmployees.includes(employeeId)) {
      console.log('EMPLOYÉ VERROUILLÉ - Modification bloquée (touch):', employeeId);
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
    
    // Ajouter un feedback visuel immédiat pour l'interaction tactile
    const target = event.currentTarget;
    target.style.transform = 'scale(0.95)';
    target.style.backgroundColor = 'rgba(0, 123, 255, 0.2)';
    
    // Restaurer l'apparence après un court délai
    setTimeout(() => {
      target.style.transform = '';
      target.style.backgroundColor = '';
    }, 150);
    
    const dayKey = format(addDays(new Date(selectedWeek), dayIndex), 'yyyy-MM-dd');
    const dayData = planning?.[employeeId]?.[dayKey];
    // Si un statut (Maladie/Congé) est déjà posé (nouveau ou legacy)
    const hasStatus = (
      typeof dayData === 'string' ||
      (Array.isArray(dayData) && dayData.some(v => v === 'M' || v === 'C' || (typeof v === 'string' && (v.toLowerCase().includes('maladie') || v.toLowerCase().includes('congé')))))
    );
    const totalSlots = (config?.timeSlots?.length || 0);
    const isFirst = slotIndex === 0;
    const isLast = slotIndex === totalSlots - 1;
    if (hasStatus) {
      // Autoriser la gestuelle premier+dernier pour RETIRER le statut en touch
      if (isFirst || isLast) {
        const now = Date.now();
        const edge = isFirst ? 'first' : 'last';
        if (
          edgeSelection &&
          edgeSelection.employeeId === employeeId &&
          edgeSelection.dayIndex === dayIndex &&
          edgeSelection.edge !== edge &&
          now - edgeSelection.ts <= 3000
        ) {
          if (edgeTimerRef.current) clearTimeout(edgeTimerRef.current);
          setEdgeSelection(null);
          if (typeof onSetDayStatus === 'function') {
            onSetDayStatus(employeeId, dayIndex, 'none');
            return;
          }
        } else {
          setEdgeSelection({ employeeId, dayIndex, edge, ts: now });
          if (edgeTimerRef.current) clearTimeout(edgeTimerRef.current);
          edgeTimerRef.current = setTimeout(() => setEdgeSelection(null), 3000);
          return;
        }
      }
      return;
    }
    const currentValue = Array.isArray(dayData) ? (dayData?.[slotIndex] || false) : false;
    console.log('Toggling slot:', { employeeId, dayKey, slotIndex, currentValue });
    if (isFirst || isLast) {
      const now = Date.now();
      const edge = isFirst ? 'first' : 'last';
      if (
        edgeSelection &&
        edgeSelection.employeeId === employeeId &&
        edgeSelection.dayIndex === dayIndex &&
        edgeSelection.edge !== edge &&
        edgeSelection.type === 'maladie' &&
        now - edgeSelection.ts <= 3000
      ) {
        if (edgeTimerRef.current) clearTimeout(edgeTimerRef.current);
        setEdgeSelection(null);
        if (typeof onSetDayStatus === 'function') {
          onSetDayStatus(employeeId, dayIndex, 'maladie');
          return;
        }
      } else {
        // Démarrer la sélection de maladie
        setEdgeSelection({ employeeId, dayIndex, edge, ts: now, type: 'maladie' });
        if (edgeTimerRef.current) clearTimeout(edgeTimerRef.current);
        edgeTimerRef.current = setTimeout(() => setEdgeSelection(null), 3000);
        // Ne pas return ici pour permettre le clic normal
      }
    }

    // Geste congé tactile: clic deuxième et avant-dernier créneau
    const isSecond = slotIndex === 1;
    const isSecondLast = slotIndex === totalSlots - 2;
    if (isSecond || isSecondLast) {
      const now = Date.now();
      const edge = isSecond ? 'second' : 'secondLast';
      if (
        edgeSelection &&
        edgeSelection.employeeId === employeeId &&
        edgeSelection.dayIndex === dayIndex &&
        edgeSelection.edge !== edge &&
        edgeSelection.type === 'conge' &&
        now - edgeSelection.ts <= 3000
      ) {
        if (edgeTimerRef.current) clearTimeout(edgeTimerRef.current);
        setEdgeSelection(null);
        if (typeof onSetDayStatus === 'function') {
          onSetDayStatus(employeeId, dayIndex, 'conge');
          return;
        }
      } else {
        // Démarrer la sélection de congé
        setEdgeSelection({ employeeId, dayIndex, edge, ts: now, type: 'conge' });
        if (edgeTimerRef.current) clearTimeout(edgeTimerRef.current);
        edgeTimerRef.current = setTimeout(() => setEdgeSelection(null), 3000);
        // Ne pas return ici pour permettre le clic normal
      }
    }
    onToggleSlot(employeeId, slotIndex, dayIndex, !currentValue);
  };

  // Nouvelle fonction pour gérer les événements tactiles de manière plus robuste
  const handleTouchEnd = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleTouchMove = (event) => {
    // Empêcher le scroll pendant l'interaction avec les cellules
    event.preventDefault();
  };

  useEffect(() => {
    return () => {
      if (edgeTimerRef.current) clearTimeout(edgeTimerRef.current);
    };
  }, []);

  const handleContextMenu = (e, employeeId, dayIndex) => {
    e.preventDefault();
    if (typeof onSetDayStatus !== 'function') return;
    const choice = window.prompt('Statut du jour (maladie / conge / none) :', 'maladie');
    if (!choice) return;
    const normalized = choice.trim().toLowerCase();
    if (normalized === 'maladie') {
      onSetDayStatus(employeeId, dayIndex, 'maladie');
    } else if (normalized === 'conge' || normalized === 'congé') {
      onSetDayStatus(employeeId, dayIndex, 'conge');
    } else if (normalized === 'none' || normalized === 'aucun') {
      onSetDayStatus(employeeId, dayIndex, 'none');
    } else {
      alert('Valeur non reconnue. Options: maladie, conge, none');
    }
  };

  // Validation de selectedWeek
  const validWeek = selectedWeek && !isNaN(new Date(selectedWeek).getTime()) ? selectedWeek : format(new Date(), 'yyyy-MM-dd');
  
  // Validation de la configuration des tranches horaires
  const validTimeSlots = config?.timeSlots && Array.isArray(config.timeSlots) && config.timeSlots.length > 0 
    ? config.timeSlots.filter(slot => slot && typeof slot === 'string')
    : [];
  
  if (validTimeSlots.length === 0) {
    console.warn('PlanningTable: Configuration des tranches horaires invalide:', { config, timeSlots: config?.timeSlots });
    return (
      <div className="table-container">
        <div style={{ 
          padding: '20px', 
          textAlign: 'center', 
          color: '#e53935', 
          backgroundColor: '#ffebee',
          border: '1px solid #e53935',
          borderRadius: '4px'
        }}>
          <h3>⚠️ Configuration des tranches horaires invalide</h3>
          <p>La configuration des tranches horaires de cette boutique n'est pas valide.</p>
          <p>Veuillez reconfigurer la boutique dans les paramètres.</p>
        </div>
      </div>
    );
  }
  
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
            {validTimeSlots.map((slot, index) => (
              <th key={slot.start || slot} className="scrollable-col header">
                {typeof slot === 'string' ? slot : slot.start}
              </th>
            ))}
          </tr>
          <tr>
            <th className="fixed-col header">À</th>
            {validTimeSlots.map((slot, index) => (
              <th key={slot.start || slot} className="scrollable-col header">
                {index < validTimeSlots.length - 1
                  ? (typeof validTimeSlots[index + 1] === 'string' ? validTimeSlots[index + 1] : validTimeSlots[index + 1]?.start || '')
                  : getEndTime(typeof slot === 'string' ? slot : slot.start, config?.interval || 30)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(selectedEmployees || []).map((employeeId, employeeIndex) => {
            const dayKey = format(addDays(new Date(validWeek), currentDay), 'yyyy-MM-dd');
            const dayData = planning?.[employeeId]?.[dayKey];
            const dayStatus = typeof dayData === 'string' ? dayData : null;
            const legacyArrayStatus = Array.isArray(dayData)
              ? (dayData.some(v => v === 'M' || (typeof v === 'string' && v.toLowerCase().includes('maladie')))
                  ? 'Maladie 🤒'
                  : (dayData.some(v => v === 'C' || (typeof v === 'string' && (v.toLowerCase().includes('congé') || v.toLowerCase().includes('conge'))))
                      ? 'Congé ☀️'
                      : null))
              : null;
            const displayStatus = dayStatus || legacyArrayStatus;
            const employeeSlots = Array.isArray(dayData) ? dayData : Array(validTimeSlots.length).fill(false);
            const hours = calculateEmployeeDailyHours(employeeId, dayKey, planning, config);
            
            // Trouver l'employé dans currentShopEmployees pour récupérer son nom
            const employee = currentShopEmployees?.find(emp => emp.id === employeeId);
            const employeeName = employee?.name || employeeId;
            

            const isLocked = lockedEmployees.includes(employeeId);
            
            const isSickDay = typeof displayStatus === 'string' && displayStatus.toLowerCase().includes('maladie');
            const isCongéDay = typeof displayStatus === 'string' && displayStatus.toLowerCase().includes('congé');
            
            // Construire la classe CSS pour la ligne
            let rowClassName = isLocked ? 'locked-employee' : '';
            if (isSickDay) {
              rowClassName += ' maladie-row';
            } else if (isCongéDay) {
              rowClassName += ' conge-row';
            }
            
            return (
              <tr key={employeeId} className={rowClassName}>
                <td 
                  className={`fixed-col employee ${getEmployeeColorClass(employeeIndex)} ${isLocked ? 'locked' : ''}`}
                >
                  {employeeName} ({hours.toFixed(1)} h)
                  {(() => {
                    // Vérifier si l'employé travaille déjà ce jour dans d'autres boutiques
                    if (!planningData || !planningData.shops) return null;
                    
                    const boutiquesOuTravaille = [];
                    
                    planningData.shops.forEach(shop => {
                      if (shop.id !== selectedShop && shop.weeks && shop.weeks[selectedWeek]?.planning?.[employeeId]?.[dayKey]) {
                        const slots = shop.weeks[selectedWeek].planning[employeeId][dayKey];
                        if (Array.isArray(slots) && slots.some(slot => slot === true)) {
                          boutiquesOuTravaille.push(shop.name);
                        }
                      }
                    });
                    
                    if (boutiquesOuTravaille.length > 0) {
                      return (
                        <span style={{ 
                          marginLeft: '8px', 
                          fontSize: '11px', 
                          fontWeight: 'bold', 
                          color: '#1e88e5',
                          backgroundColor: 'rgba(30, 136, 229, 0.1)',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          border: '1px solid rgba(30, 136, 229, 0.3)'
                        }}>
                          {boutiquesOuTravaille.join(', ')}
                        </span>
                      );
                    }
                    return null;
                  })()}
                  {displayStatus && (
                    <span style={{ marginLeft: '8px', fontSize: '11px', fontWeight: 'bold', color: isSickDay ? '#dc3545' : '#ff9800' }}>
                      {displayStatus}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (typeof onSetDayStatus === 'function') {
                            onSetDayStatus(employeeId, currentDay, 'none');
                          }
                        }}
                        title="Retirer le statut"
                        style={{
                          marginLeft: '6px',
                          border: 'none',
                          background: 'transparent',
                          color: '#6c757d',
                          cursor: 'pointer',
                          fontWeight: 'bold'
                        }}
                      >
                        ✕
                      </button>
                    </span>
                  )}
                  {isLocked && <span className="lock-icon">🔒</span>}
                </td>
                {validTimeSlots.map((_, slotIndex) => {
                  const isChecked = employeeSlots[slotIndex] === true;
                  const slotStyle = getSlotStyle(employeeId, currentDay, slotIndex);

                  return (
                    <td
                      key={slotIndex}
                      className={`scrollable-col ${isChecked ? `clicked-${employeeIndex % 7}` : ''} ${isTouchDevice ? 'touch-device' : ''} ${isTablet ? 'tablet-device' : ''}`}
                      style={{
                        ...slotStyle,
                        // Styles conditionnels pour les appareils tactiles
                        ...(isTouchDevice && {
                          minWidth: '44px',
                          minHeight: '44px',
                          padding: '8px 4px',
                          cursor: 'pointer'
                        })
                      }}
                      onTouchStart={(e) => handleTouchStart(employeeId, slotIndex, currentDay, e)}
                      onTouchEnd={handleTouchEnd}
                      onTouchMove={handleTouchMove}
                      onMouseDown={(e) => {
                        // Toujours déléguer au handler qui gère aussi la suppression de statut via gestuelle
                        handleMouseDown(employeeId, slotIndex, currentDay, e);
                      }}
                      onMouseMove={(e) => {
                        if (displayStatus) return;
                        handleMouseMove(employeeId, slotIndex, currentDay, e);
                      }}
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
