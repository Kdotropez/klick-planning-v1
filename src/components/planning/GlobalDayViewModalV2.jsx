import React, { useState, useMemo } from 'react';
import { format, addDays, addMinutes, parse, startOfWeek, endOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import Button from '../common/Button';
import { FaDownload, FaFileExcel, FaFilePdf, FaTimes, FaChartBar, FaUsers, FaClock, FaStore } from 'react-icons/fa';
import '@/assets/styles.css';

const GlobalDayViewModalV2 = ({
  showGlobalDayViewModal,
  setShowGlobalDayViewModal,
  config,
  selectedShop,
  selectedWeek,
  selectedEmployees,
  planning,
  currentShopEmployees,
  planningData
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedDay, setSelectedDay] = useState(null);

  const days = config.days || [
    { name: 'Lundi', short: 'Lun' },
    { name: 'Mardi', short: 'Mar' },
    { name: 'Mercredi', short: 'Mer' },
    { name: 'Jeudi', short: 'Jeu' },
    { name: 'Vendredi', short: 'Ven' },
    { name: 'Samedi', short: 'Sam' },
    { name: 'Dimanche', short: 'Dim' }
  ];

  const timeSlots = config.timeSlots || [];

  // Calcul des données pour chaque jour
  const dayData = useMemo(() => {
    if (!showGlobalDayViewModal) {
      return [];
    }
    return days.map((day, index) => {
      const dayKey = format(addDays(new Date(selectedWeek), index), 'yyyy-MM-dd');
      const dayDate = addDays(new Date(selectedWeek), index);
      
      // Calcul des employés par créneau
      const slotData = timeSlots.map((slot, slotIndex) => {
        const employeeIds = selectedEmployees.filter(empId => 
          planning[empId]?.[dayKey]?.[slotIndex]
        );
        
        // Convertir les IDs en noms d'employés
        const employees = employeeIds.map(empId => {
          const employee = currentShopEmployees?.find(emp => emp.id === empId);
          return employee?.name || empId;
        });
        
        return {
          time: slot,
          count: employees.length,
          employees: employees
        };
      });

      // Calcul des heures d'ouverture/fermeture
      let openTime = null, closeTime = null;
      for (let i = 0; i < slotData.length; i++) {
        if (slotData[i].count > 0 && !openTime) {
          openTime = slotData[i].time;
        }
        if (slotData[i].count > 0) {
          closeTime = format(addMinutes(parse(slotData[i].time, 'HH:mm', new Date()), config.interval), 'HH:mm');
        }
      }

      // Calcul du total d'heures
      const totalHours = slotData.reduce((total, slot) => {
        return total + (slot.count > 0 ? config.interval / 60 : 0);
      }, 0);

      return {
        day: day.name,
        short: day.short,
        date: dayDate,
        dateKey: dayKey,
        openTime: openTime || 'Fermé',
        closeTime: closeTime || 'Fermé',
        totalHours: Math.round(totalHours * 10) / 10,
        slotData,
        maxEmployees: Math.max(...slotData.map(s => s.count)),
        totalSlots: slotData.filter(s => s.count > 0).length
      };
    });
  }, [days, selectedWeek, selectedEmployees, planning, timeSlots, config, showGlobalDayViewModal, currentShopEmployees]);

  // Statistiques globales
  const globalStats = useMemo(() => {
    if (!showGlobalDayViewModal) {
      return {
        totalHours: 0,
        totalDays: 0,
        avgEmployeesPerDay: 0,
        weekRange: ''
      };
    }
    
    const totalHours = dayData.reduce((sum, day) => sum + day.totalHours, 0);
    const totalDays = dayData.filter(day => day.totalHours > 0).length;
    const avgEmployeesPerDay = dayData.reduce((sum, day) => sum + day.maxEmployees, 0) / Math.max(totalDays, 1);
    
    return {
      totalHours: Math.round(totalHours * 10) / 10,
      totalDays,
      avgEmployeesPerDay: Math.round(avgEmployeesPerDay * 10) / 10,
      weekRange: `${format(startOfWeek(new Date(selectedWeek), { weekStartsOn: 1 }), 'dd/MM', { locale: fr })} - ${format(endOfWeek(new Date(selectedWeek), { weekStartsOn: 1 }), 'dd/MM', { locale: fr })}`
    };
  }, [dayData, selectedWeek, showGlobalDayViewModal]);

  const getEmployeeColor = (count) => {
    if (count === 0) return '#ff6b6b';
    if (count === 1) return '#4ecdc4';
    if (count === 2) return '#45b7d1';
    return '#96ceb4';
  };

  const getEmployeeIcon = (count) => {
    if (count === 0) return '⚠️';
    if (count === 1) return '👤';
    if (count === 2) return '👥';
    return '👨‍👩‍👧‍👦';
  };

  // Fonction pour obtenir les horaires d'un employé pour un jour
  const getEmployeeSchedule = (employeeId, dayKey) => {
    const dayPlanning = planning[employeeId]?.[dayKey];
    if (!dayPlanning || !Array.isArray(dayPlanning)) return null;

    const schedules = [];
    let currentStart = null;
    let currentEnd = null;

    dayPlanning.forEach((isSelected, slotIndex) => {
      if (isSelected) {
        const slotTime = timeSlots[slotIndex];
        if (!currentStart) {
          currentStart = slotTime;
        }
        currentEnd = format(addMinutes(parse(slotTime, 'HH:mm', new Date()), config.interval), 'HH:mm');
      } else if (currentStart) {
        schedules.push({
          start: currentStart,
          end: currentEnd
        });
        currentStart = null;
        currentEnd = null;
      }
    });

    // Ajouter le dernier créneau si nécessaire
    if (currentStart) {
      schedules.push({
        start: currentStart,
        end: currentEnd
      });
    }

    return schedules;
  };

  // Vue d'ensemble avec cartes
  const OverviewTab = () => (
    <div className="overview-tab">
      {/* Statistiques globales */}
      <div className="stats-grid">
        <div className="stat-card">
          <FaStore className="stat-icon" />
          <div className="stat-content">
            <h3>{selectedShop}</h3>
            <p>{globalStats.weekRange}</p>
          </div>
        </div>
        <div className="stat-card">
          <FaClock className="stat-icon" />
          <div className="stat-content">
            <h3>{globalStats.totalHours}h</h3>
            <p>Total semaine</p>
          </div>
        </div>
        <div className="stat-card">
          <FaUsers className="stat-icon" />
          <div className="stat-content">
            <h3>{globalStats.avgEmployeesPerDay}</h3>
            <p>Moyenne/jour</p>
          </div>
        </div>
        <div className="stat-card">
          <FaChartBar className="stat-icon" />
          <div className="stat-content">
            <h3>{globalStats.totalDays}/7</h3>
            <p>Jours ouverts</p>
          </div>
        </div>
      </div>

      {/* Détails du jour sélectionné */}
      {selectedDay && (
        <div className="selected-day-details">
          <div className="selected-day-header">
            <h3>{selectedDay.day} {format(selectedDay.date, 'dd/MM/yyyy', { locale: fr })}</h3>
            <button 
              className="close-details-btn"
              onClick={() => setSelectedDay(null)}
            >
              <FaTimes />
            </button>
          </div>
          
                     <div className="employee-summary">
             <table className="employee-summary-table">
               <thead>
                 <tr>
                   <th>Nombre d'employés</th>
                   <th>Tranches horaires</th>
                   <th>Employés présents</th>
                 </tr>
               </thead>
               <tbody>
                                   {(() => {
                    // Grouper les créneaux par nombre d'employés
                    const employeeGroups = {};
                    selectedDay.slotData.forEach((slot, index) => {
                      if (slot.count > 0) {
                        if (!employeeGroups[slot.count]) {
                          employeeGroups[slot.count] = [];
                        }
                        employeeGroups[slot.count].push({
                          time: slot.time,
                          endTime: format(addMinutes(parse(slot.time, 'HH:mm', new Date()), config.interval), 'HH:mm'),
                          employees: slot.employees
                        });
                      }
                    });

                    return Object.entries(employeeGroups)
                      .sort(([a], [b]) => parseInt(a) - parseInt(b))
                      .map(([count, slots]) => {
                        // Regrouper les créneaux consécutifs
                        const groupedSlots = [];
                        let currentGroup = [slots[0]];
                        
                        for (let i = 1; i < slots.length; i++) {
                          const currentSlot = slots[i];
                          const lastSlot = currentGroup[currentGroup.length - 1];
                          
                          // Vérifier si les créneaux sont consécutifs et ont les mêmes employés
                          const isConsecutive = currentSlot.time === lastSlot.endTime;
                          const sameEmployees = JSON.stringify(currentSlot.employees.sort()) === JSON.stringify(lastSlot.employees.sort());
                          
                          if (isConsecutive && sameEmployees) {
                            currentGroup.push(currentSlot);
                          } else {
                            groupedSlots.push(currentGroup);
                            currentGroup = [currentSlot];
                          }
                        }
                        groupedSlots.push(currentGroup);

                        return (
                          <tr key={count} className="employee-group-row">
                            <td className="employee-count">
                              <strong>{count} employé{count > 1 ? 's' : ''}</strong>
                            </td>
                            <td className="time-slots">
                              {groupedSlots.map((group, groupIndex) => {
                                const startTime = group[0].time;
                                const endTime = group[group.length - 1].endTime;
                                return (
                                  <div key={groupIndex} className="time-slot-cell">
                                    {startTime} - {endTime}
                                  </div>
                                );
                              })}
                            </td>
                            <td className="employee-names">
                              {groupedSlots.map((group, groupIndex) => (
                                <div key={groupIndex} className="employee-names-cell">
                                  {group[0].employees.join(', ')}
                                </div>
                              ))}
                            </td>
                          </tr>
                        );
                      });
                  })()}
               </tbody>
             </table>
           </div>
        </div>
      )}

      {/* Planning hebdomadaire visuel */}
      <div className="weekly-planning-section" style={{ marginTop: '30px', marginBottom: '30px' }}>
        <h3 style={{ 
          textAlign: 'center', 
          color: '#2c3e50', 
          marginBottom: '20px',
          fontSize: '18px',
          fontWeight: '600',
          borderBottom: '2px solid #3498db',
          paddingBottom: '10px'
        }}>
          📅 Planning Hebdomadaire - Vue d'ensemble
        </h3>
        
        <div className="weekly-planning-table" style={{ 
          overflowX: 'auto',
          border: '2px solid #ecf0f1',
          borderRadius: '8px',
          backgroundColor: 'white'
        }}>
          <table style={{ 
            width: '100%', 
            borderCollapse: 'collapse',
            fontSize: '12px'
          }}>
            <thead>
              <tr style={{ backgroundColor: '#3498db', color: 'white' }}>
                <th style={{ padding: '12px 8px', border: '1px solid #2980b9', textAlign: 'center', minWidth: '80px' }}>
                  Employée
                </th>
                {dayData.map((day, index) => (
                  <th key={index} style={{ 
                    padding: '12px 8px', 
                    border: '1px solid #2980b9', 
                    textAlign: 'center',
                    minWidth: '100px',
                    position: 'relative'
                  }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{day.short}</div>
                    <div style={{ fontSize: '10px', opacity: '0.9' }}>
                      {format(day.date, 'dd/MM', { locale: fr })}
                    </div>
                    {day.totalHours > 0 && (
                      <div style={{ 
                        fontSize: '9px', 
                        backgroundColor: 'rgba(255,255,255,0.2)', 
                        padding: '2px 6px',
                        borderRadius: '4px',
                        marginTop: '4px'
                      }}>
                        {day.totalHours}h
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {currentShopEmployees?.map((employee, empIndex) => (
                <tr key={employee.id} style={{ 
                  backgroundColor: empIndex % 2 === 0 ? '#f8f9fa' : 'white',
                  borderBottom: '1px solid #ecf0f1'
                }}>
                  <td style={{ 
                    padding: '10px 8px', 
                    border: '1px solid #ecf0f1',
                    fontWeight: '600',
                    color: '#2c3e50',
                    backgroundColor: '#ecf0f1',
                    textAlign: 'center',
                    minWidth: '80px'
                  }}>
                    <div style={{ fontWeight: 'bold' }}>{employee.name}</div>
                    <div style={{ 
                      fontSize: '10px', 
                      color: '#7f8c8d',
                      marginTop: '2px'
                    }}>
                      {selectedShop}
                    </div>
                  </td>
                  {dayData.map((day, dayIndex) => {
                    const dayKey = day.dateKey;
                    const dayPlanning = planning[employee.id]?.[dayKey];
                    
                    // Déterminer le contenu de la cellule
                    let cellContent = '';
                    let cellStyle = { 
                      padding: '8px 6px', 
                      border: '1px solid #ecf0f1',
                      textAlign: 'center',
                      fontSize: '11px',
                      backgroundColor: '#f8f9fa'
                    };
                    
                    if (dayPlanning) {
                      if (typeof dayPlanning === 'string') {
                        // Statut spécial (congé, maladie)
                        if (dayPlanning.includes('Congé')) {
                          cellContent = '🏖️ Congé';
                          cellStyle.backgroundColor = '#ffeaa7';
                          cellStyle.color = '#d63031';
                        } else if (dayPlanning.includes('Maladie')) {
                          cellContent = '🤒 Maladie';
                          cellStyle.backgroundColor = '#fd79a8';
                          cellStyle.color = '#c44569';
                        } else {
                          cellContent = dayPlanning;
                          cellStyle.backgroundColor = '#fdcb6e';
                          cellStyle.color = '#e17055';
                        }
                      } else if (Array.isArray(dayPlanning)) {
                        // Créneaux horaires
                        const hasWork = dayPlanning.some(slot => slot === true);
                        if (hasWork) {
                          const schedules = getEmployeeSchedule(employee.id, dayKey);
                          if (schedules && schedules.length > 0) {
                            cellContent = schedules.map(schedule => 
                              `${schedule.start}-${schedule.end}`
                            ).join(' / ');
                            cellStyle.backgroundColor = '#55a3ff';
                            cellStyle.color = 'white';
                          } else {
                            cellContent = '⏰ Horaires';
                            cellStyle.backgroundColor = '#74b9ff';
                            cellStyle.color = 'white';
                          }
                        } else {
                          cellContent = '❌ Libre';
                          cellStyle.backgroundColor = '#ddd';
                          cellStyle.color = '#666';
                        }
                      }
                    } else {
                      cellContent = '❌ Libre';
                      cellStyle.backgroundColor = '#ddd';
                      cellStyle.color = '#666';
                    }
                    
                    return (
                      <td key={dayIndex} style={cellStyle}>
                        <div style={{ 
                          wordBreak: 'break-word',
                          lineHeight: '1.2'
                        }}>
                          {cellContent}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cartes des jours */}
      <div className="days-grid">
        {dayData.map((day, index) => (
          <div 
            key={index} 
            className={`day-card ${day.totalHours > 0 ? 'active' : 'inactive'} ${selectedDay?.dateKey === day.dateKey ? 'selected' : ''}`}
            onClick={() => setSelectedDay(day)}
          >
            <div className="day-header">
              <h4>{day.short}</h4>
              <span className="day-date">{format(day.date, 'dd/MM', { locale: fr })}</span>
            </div>
            
            {day.totalHours > 0 ? (
              <>
                <div className="day-hours">
                  <span className="hours-badge">{day.totalHours}h</span>
                </div>
                <div className="day-schedule">
                  <div className="schedule-item">
                    <span className="schedule-label">Ouverture:</span>
                    <span className="schedule-time">{day.openTime}</span>
                  </div>
                  <div className="schedule-item">
                    <span className="schedule-label">Fermeture:</span>
                    <span className="schedule-time">{day.closeTime}</span>
                  </div>
                </div>
                <div className="day-employees">
                  <span className="max-employees">
                    {getEmployeeIcon(day.maxEmployees)} Max: {day.maxEmployees}
                  </span>
                </div>
              </>
            ) : (
              <div className="day-closed">
                <span>Fermé</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  // Vue détaillée par jour
  const DetailTab = () => (
    <div className="detail-tab">
      {/* Sélecteur de jour */}
      <div className="day-selector">
        <h3>Sélectionner un jour :</h3>
        <div className="day-buttons">
          {dayData.map((day, index) => (
            <button
              key={index}
              className={`day-selector-btn ${selectedDay?.dateKey === day.dateKey ? 'active' : ''} ${day.totalHours > 0 ? 'has-data' : 'no-data'}`}
              style={selectedDay?.dateKey === day.dateKey ? {
                borderColor: '#ff8c00',
                backgroundColor: '#ff8c00',
                color: 'black',
                boxShadow: '0 4px 12px rgba(255, 140, 0, 0.3)',
                transform: 'translateY(-2px)'
              } : {}}
              onClick={() => setSelectedDay(day)}
            >
              <div className="day-btn-content">
                <span className="day-name">{day.short}</span>
                <span className="day-date">{format(day.date, 'dd/MM', { locale: fr })}</span>
                {day.totalHours > 0 && (
                  <span className="day-hours">{day.totalHours}h</span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Détails du jour sélectionné */}
      {selectedDay ? (
        <div className="day-detail">
          <div className="day-detail-header">
            <h3>{selectedDay.day} {format(selectedDay.date, 'dd/MM/yyyy', { locale: fr })}</h3>
            <div className="day-summary">
              <span>Ouverture: {selectedDay.openTime}</span>
              <span>Fermeture: {selectedDay.closeTime}</span>
              <span>Total: {selectedDay.totalHours}h</span>
            </div>
          </div>
          
          <div className="time-slots-grid">
            {selectedDay.slotData.map((slot, index) => {
              const getSlotColor = (count) => {
                if (count === 0) return '#ff6b6b'; // Rouge vif
                if (count === 1) return '#4ecdc4'; // Vert vif
                if (count === 2) return '#ffd93d'; // Jaune vif
                return '#6c5ce7'; // Violet vif pour 3+
              };
              
              return (
                <div 
                  key={index} 
                  className={`time-slot ${slot.count > 0 ? 'active' : 'inactive'}`}
                  style={{ backgroundColor: getSlotColor(slot.count) }}
                >
                  <div className="slot-time">
                    {slot.time} - {format(addMinutes(parse(slot.time, 'HH:mm', new Date()), config.interval), 'HH:mm')}
                  </div>
                  <div className="slot-employees">
                    {slot.count === 0 ? '⚠️' : `${getEmployeeIcon(slot.count)} ${slot.count}`}
                  </div>
                  {slot.employees.length > 0 && (
                    <div className="slot-employee-list">
                      {slot.employees.map(emp => (
                        <span key={emp} className="employee-tag">{emp}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="no-day-selected">
          <p>Sélectionnez un jour ci-dessus pour voir les détails</p>
        </div>
      )}
    </div>
  );

  // Vue tableau classique
  const TableTab = () => (
    <div className="table-tab">
      <div className="table-scroll-container">
        <table className="global-day-table">
          <thead>
            <tr>
              <th className="fixed-col header day-col">Jour</th>
              <th className="fixed-col header schedule-col">Horaires</th>
              {timeSlots.map((slot, index) => (
                <th key={index} className="scrollable-col header">
                  <div style={{ fontSize: '7px', fontWeight: 'bold', textAlign: 'center', transform: 'none' }}>{slot}</div>
                  <div style={{ fontSize: '7px', fontWeight: 'bold', textAlign: 'center', transform: 'none' }}>
                    {format(addMinutes(parse(slot, 'HH:mm', new Date()), config.interval), 'HH:mm')}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dayData.map((day, dayIndex) => (
              <tr key={dayIndex} className="day-row">
                <td className="fixed-col day-col">
                  <div className="day-info">
                    <strong>{day.short}</strong>
                    <span className="day-date">{format(day.date, 'dd/MM', { locale: fr })}</span>
                  </div>
                </td>
                <td className="fixed-col schedule-col">
                  <div className="schedule-info">
                    <div className="schedule-line">O: {day.openTime}</div>
                    <div className="schedule-line">F: {day.closeTime}</div>
                  </div>
                </td>
                {day.slotData.map((slot, slotIndex) => {
                  const getSlotColor = (count) => {
                    if (count === 0) return '#ff6b6b'; // Rouge vif
                    if (count === 1) return '#4ecdc4'; // Vert vif
                    if (count === 2) return '#ffd93d'; // Jaune vif
                    return '#6c5ce7'; // Violet vif pour 3+
                  };
                  
                  return (
                    <td 
                      key={slotIndex} 
                      className="scrollable-col"
                      style={{ backgroundColor: getSlotColor(slot.count) }}
                    >
                      <div className="slot-display">
                        {slot.count === 0 ? '⚠️' : slot.count}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // Vue hebdomadaire professionnelle
  const WeeklyTab = () => {
      // Fonction pour obtenir les horaires d'un employé pour un jour
  const getEmployeeSchedule = (employeeId, dayKey) => {
    const dayPlanning = planning[employeeId]?.[dayKey];
    if (!dayPlanning || !Array.isArray(dayPlanning)) return null;

    const schedules = [];
    let currentStart = null;
    let currentEnd = null;

    dayPlanning.forEach((isSelected, slotIndex) => {
        if (isSelected) {
          const slotTime = timeSlots[slotIndex];
          if (!currentStart) {
            currentStart = slotTime;
          }
          currentEnd = format(addMinutes(parse(slotTime, 'HH:mm', new Date()), config.interval), 'HH:mm');
        } else if (currentStart) {
          schedules.push({
            start: currentStart,
            end: currentEnd
          });
          currentStart = null;
          currentEnd = null;
        }
      });

      // Ajouter le dernier créneau si nécessaire
      if (currentStart) {
        schedules.push({
          start: currentStart,
          end: currentEnd
        });
      }

      return schedules;
    };

    // Fonction pour fusionner les créneaux consécutifs
    const mergeConsecutiveSlots = (schedules) => {
      if (schedules.length <= 1) return schedules;

      const merged = [];
      let current = schedules[0];

      for (let i = 1; i < schedules.length; i++) {
        const next = schedules[i];
        if (current.end === next.start) {
          current.end = next.end;
        } else {
          merged.push(current);
          current = next;
        }
      }
      merged.push(current);
      return merged;
    };

    return (
      <div className="weekly-tab">
        <div className="weekly-header">
          <h3>Planning hebdomadaire - {selectedShop}</h3>
          <p>Semaine du {globalStats.weekRange}</p>
        </div>

        <div className="weekly-schedule" id="weekly-schedule-export">
          {dayData.map((day, dayIndex) => {
            if (day.totalHours === 0) return null;

            return (
              <div key={dayIndex} className="day-schedule-card">
                <div className="day-header">
                  <h4>{day.day} {format(day.date, 'dd/MM/yyyy', { locale: fr })}</h4>
                  <div className="day-summary">
                    <span>Ouverture: {day.openTime}</span>
                    <span>Fermeture: {day.closeTime}</span>
                    <span>Total: {day.totalHours}h</span>
                  </div>
                </div>

                <div className="employees-schedule">
                  {selectedEmployees.map(employeeId => {
                    const employee = currentShopEmployees?.find(emp => emp.id === employeeId);
                    if (!employee) return null;

                    const schedules = getEmployeeSchedule(employeeId, day.dateKey);
                    if (!schedules || schedules.length === 0) return null;

                    const mergedSchedules = mergeConsecutiveSlots(schedules);

                    return (
                      <div key={employeeId} className="employee-schedule-row">
                        <div className="employee-name">
                          <strong>{employee.name}</strong>
                        </div>
                        <div className="employee-hours">
                          {mergedSchedules.map((schedule, index) => (
                            <span key={index} className="time-slot">
                              {schedule.start} - {schedule.end}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
         );
   };

     // Vue combinée : Vue d'ensemble + Vue hebdomadaire
  const CombinedTab = ({
    selectedWeek, selectedShop, selectedEmployees, planning, currentShopEmployees, planningData
  }) => {
     return (
       <div className="combined-tab">
         {/* Section 1: Vue d'ensemble par jour */}
         <div className="combined-overview-section" style={{ marginBottom: '40px' }}>
           <h3 style={{ 
             textAlign: 'center', 
             color: '#2c3e50', 
             marginBottom: '25px',
             fontSize: '20px',
             fontWeight: '600',
             borderBottom: '3px solid #3498db',
             paddingBottom: '15px'
           }}>
             📅 Vue d'ensemble par jour
           </h3>
           
           <div className="daily-employee-overview">
             {dayData.map((day, dayIndex) => {
               if (day.totalHours === 0) return null;
               
                               // Récupérer tous les employés qui travaillent ce jour dans TOUTES les boutiques
                const workingEmployees = [];
                
                // Vérifier d'abord si des employés travaillent dans la boutique actuelle ce jour
                const currentShopWorkingEmployees = selectedEmployees.filter(employeeId => {
                  const dayPlanning = planning[employeeId]?.[day.dateKey];
                  if (dayPlanning) {
                    if (typeof dayPlanning === 'string') return true; // Congé ou Maladie
                    if (Array.isArray(dayPlanning)) {
                      return dayPlanning.some(slot => slot === true); // Au moins un créneau sélectionné
                    }
                  }
                  return false;
                });
                
                // Si aucun employé ne travaille dans la boutique actuelle, vérifier dans toutes les boutiques
                if (currentShopWorkingEmployees.length === 0 && planningData && planningData.shops) {
                  Object.keys(planningData.shops).forEach(shopId => {
                    const shop = planningData.shops[shopId];
                    selectedEmployees.forEach(employeeId => {
                      const employee = currentShopEmployees?.find(emp => emp.id === employeeId);
                      if (!employee) return;
                      
                      const shopPlanningForEmployee = shop.weeks?.[selectedWeek]?.planning?.[employeeId]?.[day.dateKey];
                      
                      if (shopPlanningForEmployee) {
                        if (typeof shopPlanningForEmployee === 'string') { // Congé or Maladie
                          workingEmployees.push({
                            employee,
                            boutiques: [{
                              boutique: shop.name,
                              status: shopPlanningForEmployee,
                              schedules: []
                            }]
                          });
                        } else if (Array.isArray(shopPlanningForEmployee)) { // Actual time slots
                          const hasWork = shopPlanningForEmployee.some(slot => slot === true);
                          if (hasWork) {
                            const shopSchedules = [];
                            let currentStart = null;
                            let currentEnd = null;
                            
                            shopPlanningForEmployee.forEach((isSelected, slotIndex) => {
                              if (isSelected) {
                                const slotTime = timeSlots[slotIndex];
                                if (!currentStart) {
                                  currentStart = slotTime;
                                }
                                currentEnd = format(addMinutes(parse(slotTime, 'HH:mm', new Date()), config.interval), 'HH:mm');
                              } else if (currentStart) {
                                shopSchedules.push({
                                  start: currentStart,
                                  end: currentEnd
                                });
                                currentStart = null;
                                currentEnd = null;
                              }
                            });
                            
                            if (currentStart) {
                              shopSchedules.push({
                                start: currentStart,
                                end: currentEnd
                              });
                            }
                            
                            workingEmployees.push({
                              employee,
                              boutiques: [{
                                boutique: shop.name,
                                status: 'Travail',
                                schedules: shopSchedules
                              }]
                            });
                          }
                        }
                      }
                    });
                  });
                } else {
                  // Utiliser les employés qui travaillent dans la boutique actuelle
                  currentShopWorkingEmployees.forEach(employeeId => {
                    const employee = currentShopEmployees?.find(emp => emp.id === employeeId);
                    if (!employee) return;
                    
                    const dayPlanning = planning[employeeId]?.[day.dateKey];
                    const employeeBoutiqueSchedules = [];
                    
                    if (dayPlanning) {
                      if (typeof dayPlanning === 'string') { // Congé or Maladie
                        employeeBoutiqueSchedules.push({
                          boutique: selectedShop,
                          status: dayPlanning,
                          schedules: []
                        });
                      } else if (Array.isArray(dayPlanning)) { // Actual time slots
                        const hasWork = dayPlanning.some(slot => slot === true);
                        if (hasWork) {
                          const schedules = getEmployeeSchedule(employeeId, day.dateKey) || [];
                          employeeBoutiqueSchedules.push({
                            boutique: selectedShop,
                            status: 'Travail',
                            schedules: schedules
                          });
                        }
                      }
                    }
                    
                    // Ajouter les autres boutiques où l'employé travaille
                    if (planningData && planningData.shops) {
                      Object.keys(planningData.shops).forEach(shopId => {
                        const shop = planningData.shops[shopId];
                        if (shop.id === selectedShop) return; // On a déjà traité la boutique actuelle
                        
                        const shopPlanningForEmployee = shop.weeks?.[selectedWeek]?.planning?.[employeeId]?.[day.dateKey];
                        
                        if (shopPlanningForEmployee) {
                          if (typeof shopPlanningForEmployee === 'string') { // Congé or Maladie
                            employeeBoutiqueSchedules.push({
                              boutique: shop.name,
                              status: shopPlanningForEmployee,
                              schedules: []
                            });
                          } else if (Array.isArray(shopPlanningForEmployee)) { // Actual time slots
                            const hasWork = shopPlanningForEmployee.some(slot => slot === true);
                            if (hasWork) {
                              const shopSchedules = [];
                              let currentStart = null;
                              let currentEnd = null;
                              
                              shopPlanningForEmployee.forEach((isSelected, slotIndex) => {
                                if (isSelected) {
                                  const slotTime = timeSlots[slotIndex];
                                  if (!currentStart) {
                                    currentStart = slotTime;
                                  }
                                  currentEnd = format(addMinutes(parse(slotTime, 'HH:mm', new Date()), config.interval), 'HH:mm');
                                } else if (currentStart) {
                                  shopSchedules.push({
                                    start: currentStart,
                                    end: currentEnd
                                  });
                                  currentStart = null;
                                  currentEnd = null;
                                }
                              });
                              
                              if (currentStart) {
                                shopSchedules.push({
                                  start: currentStart,
                                  end: currentEnd
                                });
                              }
                              
                              employeeBoutiqueSchedules.push({
                                boutique: shop.name,
                                status: 'Travail',
                                schedules: shopSchedules
                              });
                            }
                          }
                        }
                      });
                    }
                    
                    if (employeeBoutiqueSchedules.length > 0) {
                      workingEmployees.push({
                        employee,
                        boutiques: employeeBoutiqueSchedules
                      });
                    }
                  });
                }
               
               return (
                 <div key={dayIndex} className="day-employee-card" style={{
                   background: 'white',
                   borderRadius: '12px',
                   padding: '20px',
                   marginBottom: '20px',
                   boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                   border: '2px solid #ecf0f1'
                 }}>
                   <div className="day-header" style={{
                     display: 'flex',
                     justifyContent: 'space-between',
                     alignItems: 'center',
                     marginBottom: '20px',
                     paddingBottom: '15px',
                     borderBottom: '2px solid #3498db'
                   }}>
                     <h4 style={{
                       margin: 0,
                       fontSize: '18px',
                       fontWeight: '700',
                       color: '#2c3e50',
                       textTransform: 'uppercase'
                     }}>
                       {day.day} {format(day.date, 'dd/MM/yyyy', { locale: fr })}
                     </h4>
                     <div className="day-summary" style={{
                       display: 'flex',
                       gap: '15px',
                       fontSize: '14px',
                       color: '#34495e'
                     }}>
                       <span>O: {day.openTime}</span>
                       <span>F: {day.closeTime}</span>
                       <span style={{ fontWeight: 'bold', color: '#3498db' }}>{day.totalHours}h</span>
                     </div>
                   </div>
                   
                   <div className="employees-list">
                     {workingEmployees.length > 0 ? (
                       workingEmployees.map((empData, empIndex) => (
                         <div key={empIndex} className="employee-row" style={{
                           display: 'flex',
                           justifyContent: 'space-between',
                           alignItems: 'center',
                           padding: '12px 16px',
                           margin: '8px 0',
                           borderRadius: '8px',
                           backgroundColor: empIndex % 2 === 0 ? '#f8f9fa' : 'white',
                           border: '1px solid #ecf0f1'
                         }}>
                           <div className="employee-info" style={{ flex: 1 }}>
                             <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#2c3e50' }}>
                               {empData.employee.name}
                             </div>
                             <div style={{ fontSize: '14px', color: '#7f8c8d', marginTop: '4px' }}>
                               {selectedShop}
                             </div>
                           </div>
                           
                                                       <div className="employee-schedule" style={{ flex: 2, textAlign: 'center' }}>
                              {empData.boutiques.length === 0 ? (
                                <span style={{ color: '#95a5a6', fontStyle: 'italic' }}>Libre</span>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                                  {empData.boutiques.map((boutique, bIndex) => (
                                    <div key={bIndex} style={{
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '4px',
                                      alignItems: 'center',
                                      padding: '8px',
                                      border: '1px solid #ecf0f1',
                                      borderRadius: '8px',
                                      backgroundColor: '#f8f9fa'
                                    }}>
                                      {/* Nom de la boutique */}
                                      <div style={{ 
                                        backgroundColor: '#e74c3c', 
                                        color: 'white',
                                        padding: '4px 8px',
                                        borderRadius: '12px',
                                        fontSize: '11px',
                                        fontWeight: '600'
                                      }}>
                                        {boutique.boutique}
                                      </div>
                                      
                                      {/* Statut ou horaires */}
                                      {boutique.status === 'Congé ☀️' ? (
                                        <span style={{ 
                                          backgroundColor: '#ffeaa7', 
                                          color: '#d63031',
                                          padding: '4px 8px',
                                          borderRadius: '12px',
                                          fontSize: '11px',
                                          fontWeight: '600'
                                        }}>
                                          🏖️ Congé
                                        </span>
                                      ) : boutique.status === 'Maladie 🤒' ? (
                                        <span style={{ 
                                          backgroundColor: '#fd79a8', 
                                          color: '#c44569',
                                          padding: '4px 8px',
                                          borderRadius: '12px',
                                          fontSize: '11px',
                                          fontWeight: '600'
                                        }}>
                                          🤒 Maladie
                                        </span>
                                      ) : boutique.schedules.length > 0 ? (
                                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'center' }}>
                                          {boutique.schedules.map((schedule, sIndex) => (
                                            <span key={sIndex} style={{
                                              backgroundColor: '#3498db',
                                              color: 'white',
                                              padding: '4px 8px',
                                              borderRadius: '12px',
                                              fontSize: '10px',
                                              fontWeight: '600'
                                            }}>
                                              {schedule.start}-{schedule.end}
                                            </span>
                                          ))}
                                        </div>
                                      ) : (
                                        <span style={{ color: '#95a5a6', fontSize: '10px' }}>Libre</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                         </div>
                       ))
                     ) : (
                       <div style={{ 
                         textAlign: 'center', 
                         color: '#95a5a6', 
                         fontStyle: 'italic',
                         padding: '20px'
                       }}>
                         Aucun employé programmé ce jour
                       </div>
                     )}
                   </div>
                 </div>
               );
             })}
           </div>
         </div>
         
         {/* Section 2: Vue hebdomadaire en listing */}
         <div className="combined-weekly-section">
           <h3 style={{ 
             textAlign: 'center', 
             color: '#2c3e50', 
             marginBottom: '25px',
             fontSize: '20px',
             fontWeight: '600',
             borderBottom: '3px solid #e74c3c',
             paddingBottom: '15px'
           }}>
             📊 Vue hebdomadaire en listing
           </h3>
           
           <div className="weekly-listing" style={{
             background: 'white',
             borderRadius: '12px',
             padding: '20px',
             boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
           }}>
             {dayData.map((day, dayIndex) => {
               if (day.totalHours === 0) return null;
               
               return (
                 <div key={dayIndex} className="weekly-day-card" style={{
                   marginBottom: '20px',
                   border: '1px solid #ecf0f1',
                   borderRadius: '8px',
                   overflow: 'hidden'
                 }}>
                   <div className="weekly-day-header" style={{
                     backgroundColor: '#34495e',
                     color: 'white',
                     padding: '12px 16px',
                     fontWeight: '600'
                   }}>
                     {day.day} {format(day.date, 'dd/MM/yyyy', { locale: fr })} - {day.totalHours}h
                   </div>
                   
                   <div className="weekly-employees-list">
                     {(() => {
                       // Instead of mapping selectedEmployees directly, we need to gather all employee-boutique-schedule combinations for the day
                       const employeesWithBoutiqueSchedules = [];
                       
                       if (planningData && planningData.shops) {
                         Object.keys(planningData.shops).forEach(shopId => {
                           const shop = planningData.shops[shopId];
                           selectedEmployees.forEach(employeeId => {
                             const employee = currentShopEmployees?.find(emp => emp.id === employeeId);
                             if (!employee) return;
                             
                             const shopPlanningForEmployee = shop.weeks?.[selectedWeek]?.planning?.[employeeId]?.[day.dateKey];
                             
                             if (shopPlanningForEmployee) {
                               if (typeof shopPlanningForEmployee === 'string') { // Congé or Maladie
                                 employeesWithBoutiqueSchedules.push({
                                   employee,
                                   boutique: shop.name,
                                   status: shopPlanningForEmployee,
                                   schedules: []
                                 });
                               } else if (Array.isArray(shopPlanningForEmployee)) { // Actual time slots
                                 const hasWork = shopPlanningForEmployee.some(slot => slot === true);
                                 if (hasWork) {
                                   const shopSchedules = [];
                                   let currentStart = null;
                                   let currentEnd = null;
                                   
                                   shopPlanningForEmployee.forEach((isSelected, slotIndex) => {
                                     if (isSelected) {
                                       const slotTime = timeSlots[slotIndex];
                                       if (!currentStart) {
                                         currentStart = slotTime;
                                       }
                                       currentEnd = format(addMinutes(parse(slotTime, 'HH:mm', new Date()), config.interval), 'HH:mm');
                                     } else if (currentStart) {
                                       shopSchedules.push({
                                         start: currentStart,
                                         end: currentEnd
                                       });
                                       currentStart = null;
                                       currentEnd = null;
                                     }
                                   });
                                   
                                   if (currentStart) {
                                     shopSchedules.push({
                                       start: currentStart,
                                       end: currentEnd
                                     });
                                   }
                                   
                                   employeesWithBoutiqueSchedules.push({
                                     employee,
                                     boutique: shop.name,
                                     status: 'Travail',
                                     schedules: shopSchedules
                                   });
                                 }
                               }
                             }
                           });
                         });
                       }
                       
                       // Now map through employeesWithBoutiqueSchedules for rendering
                       return employeesWithBoutiqueSchedules.map((empBoutiqueData, index) => {
                         if (!empBoutiqueData.schedules || empBoutiqueData.schedules.length === 0) return null;
                         
                         return (
                           <div key={`${empBoutiqueData.employee.id}-${empBoutiqueData.boutique}-${index}`} className="weekly-employee-row" style={{
                             display: 'flex',
                             justifyContent: 'space-between',
                             alignItems: 'center',
                             padding: '12px 16px',
                             borderBottom: '1px solid #ecf0f1',
                             backgroundColor: '#f8f9fa'
                           }}>
                             <div className="weekly-employee-name" style={{ fontWeight: '600', color: '#2c3e50', minWidth: '120px' }}>
                               {empBoutiqueData.employee.name}
                             </div>
                             <div className="weekly-employee-boutique" style={{ 
                               backgroundColor: '#e74c3c', 
                               color: 'white',
                               padding: '4px 8px',
                               borderRadius: '12px',
                               fontSize: '11px',
                               fontWeight: '600',
                               marginRight: '16px'
                             }}>
                               {empBoutiqueData.boutique}
                             </div>
                             <div className="weekly-employee-schedule" style={{ display: 'flex', gap: '8px', flex: 1 }}>
                               {empBoutiqueData.schedules.map((schedule, sIndex) => (
                                 <button key={sIndex} style={{
                                   backgroundColor: '#3498db',
                                   color: 'white',
                                   padding: '6px 12px',
                                   border: 'none',
                                   borderRadius: '20px',
                                   fontSize: '12px',
                                   fontWeight: '600',
                                   cursor: 'pointer',
                                   transition: 'all 0.2s ease'
                                 }}
                                 onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
                                 onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                                 >
                                   {schedule.start}-{schedule.end}
                                 </button>
                               ))}
                             </div>
                           </div>
                         );
                       });
                     })()}
                   </div>
                 </div>
               );
             })}
           </div>
         </div>
       </div>
     );
   };
 
   const exportToPDF = async () => {
    try {
      // Attendre que le DOM soit mis à jour
      await new Promise(resolve => setTimeout(resolve, 200));
      
      let container, title, filename;
      
      if (activeTab === 'weekly') {
        // Export de la vue hebdomadaire
        container = document.querySelector('.weekly-schedule');
        title = `Planning hebdomadaire - ${selectedShop}`;
        filename = `planning_hebdomadaire_${selectedShop}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      } else {
        // Export de la vue globale (comportement existant)
        container = document.querySelector('.table-scroll-container');
        title = `Vue globale par jour - ${selectedShop}`;
        filename = `vue_globale_${selectedShop}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      }
      
      if (!container) {
        console.error('Conteneur non trouvé');
        return;
      }

      // Capturer le contenu avec html2canvas pour une image fidèle
      const canvas = await html2canvas(container, {
        scale: 2, // Haute résolution pour une image fidèle
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: container.scrollWidth,
        height: container.scrollHeight,
        scrollX: 0,
        scrollY: 0,
        windowWidth: container.scrollWidth,
        windowHeight: container.scrollHeight
      });

      // Créer le PDF
      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF({ 
        orientation: activeTab === 'weekly' ? 'portrait' : 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      // Calculer les dimensions pour centrer l'image
      const imgWidth = pdfWidth - 20; // Marge de 10mm de chaque côté
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      // Ajouter le titre
      pdf.setFontSize(16);
      pdf.setFont('Helvetica', 'bold');
      pdf.text(title, pdfWidth / 2, 15, { align: 'center' });
      
      pdf.setFontSize(12);
      pdf.setFont('Helvetica', 'normal');
      pdf.text(`Semaine du ${globalStats.weekRange}`, pdfWidth / 2, 25, { align: 'center' });
      if (activeTab !== 'weekly') {
        pdf.text(`Total: ${globalStats.totalHours}h sur ${globalStats.totalDays} jours`, pdfWidth / 2, 32, { align: 'center' });
      }

      // Ajouter l'image du contenu
      const yPosition = activeTab === 'weekly' ? 35 : 40;
      pdf.addImage(imgData, 'PNG', 10, yPosition, imgWidth, imgHeight);

      pdf.save(filename);
    } catch (error) {
      console.error('Erreur lors de l\'export PDF:', error);
      alert('Erreur lors de l\'export PDF. Veuillez réessayer.');
    }
  };

  const exportToExcel = () => {
    const wsData = [
      ['Vue globale par jour', selectedShop],
      ['Semaine', globalStats.weekRange],
      ['Total heures', globalStats.totalHours],
      [''],
      ['Jour', 'Date', 'Ouverture', 'Fermeture', 'Total heures', ...timeSlots.map(slot => `${slot} - ${format(addMinutes(parse(slot, 'HH:mm', new Date()), config.interval), 'HH:mm')}`)]
    ];

    dayData.forEach(day => {
      wsData.push([
        day.day,
        format(day.date, 'dd/MM/yyyy', { locale: fr }),
        day.openTime,
        day.closeTime,
        day.totalHours,
        ...day.slotData.map(slot => `${getEmployeeIcon(slot.count)} ${slot.count}`)
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Vue Globale');
    XLSX.writeFile(wb, `vue_globale_${selectedShop}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  if (!showGlobalDayViewModal) {
    return null;
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content global-day-modal-v2">
        <div className="modal-header">
          <div className="modal-title">
            <FaChartBar />
            <h2>Vue globale par jour - {selectedShop}</h2>
          </div>
          <Button
            className="modal-close"
            onClick={() => setShowGlobalDayViewModal(false)}
          >
            <FaTimes />
          </Button>
        </div>

        <div className="modal-body">
          {/* Onglets */}
          <div className="tabs">
            <button 
              className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              <FaChartBar /> Vue d'ensemble
            </button>
            <button 
              className={`tab ${activeTab === 'detail' ? 'active' : ''}`}
              onClick={() => setActiveTab('detail')}
            >
              <FaUsers /> Détail par jour
            </button>
            <button 
              className={`tab ${activeTab === 'table' ? 'active' : ''}`}
              onClick={() => setActiveTab('table')}
            >
              <FaChartBar /> Tableau complet
            </button>
                         <button 
               className={`tab ${activeTab === 'weekly' ? 'active' : ''}`}
               onClick={() => setActiveTab('weekly')}
             >
               <FaUsers /> Vue hebdomadaire
             </button>
             <button 
               className={`tab ${activeTab === 'combined' ? 'active' : ''}`}
               onClick={() => setActiveTab('combined')}
             >
               <FaChartBar /> Planning combiné
             </button>
          </div>

                     {/* Contenu des onglets */}
           <div className="tab-content">
             {activeTab === 'overview' && <OverviewTab />}
             {activeTab === 'detail' && <DetailTab />}
             {activeTab === 'table' && <TableTab />}
             {activeTab === 'weekly' && <WeeklyTab />}
             {activeTab === 'combined' && <CombinedTab 
               selectedWeek={selectedWeek}
               selectedShop={selectedShop}
               selectedEmployees={selectedEmployees}
               planning={planning}
               currentShopEmployees={currentShopEmployees}
               planningData={planningData}
             />}
           </div>
        </div>

        <div className="modal-footer">
          <div className="export-buttons">
            <Button className="export-btn" onClick={exportToPDF}>
              <FaFilePdf /> PDF
            </Button>
            <Button className="export-btn" onClick={exportToExcel}>
              <FaFileExcel /> Excel
            </Button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .global-day-modal-v2 {
          max-width: 95vw;
          max-height: 90vh;
          width: 1200px;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          border-bottom: 1px solid #e0e0e0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border-radius: 8px 8px 0 0;
        }

        .modal-title {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .modal-title h2 {
          margin: 0;
          font-size: 1.5rem;
        }

        .tabs {
          display: flex;
          border-bottom: 1px solid #e0e0e0;
          margin-bottom: 20px;
        }

        .tab {
          padding: 12px 24px;
          border: none;
          background: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          color: #666;
          border-bottom: 3px solid transparent;
          transition: all 0.3s ease;
        }

        .tab.active {
          color: #667eea;
          border-bottom-color: #667eea;
          background: #f8f9ff;
        }

        .tab:hover {
          background: #f5f5f5;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
          margin-bottom: 30px;
        }

        .stat-card {
          display: flex;
          align-items: center;
          gap: 15px;
          padding: 20px;
          background: white;
          border-radius: 10px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          border-left: 4px solid #667eea;
        }

        .stat-icon {
          font-size: 2rem;
          color: #667eea;
        }

        .stat-content h3 {
          margin: 0;
          font-size: 1.5rem;
          color: #333;
        }

        .stat-content p {
          margin: 5px 0 0 0;
          color: #666;
          font-size: 0.9rem;
        }

        .days-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 15px;
        }

        .day-card {
          background: white;
          border-radius: 10px;
          padding: 15px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          cursor: pointer;
          transition: all 0.3s ease;
          border: 2px solid transparent;
        }

        .day-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        }

        .day-card.active {
          border-color: #4ecdc4;
        }

                 .day-card.inactive {
           opacity: 0.6;
           background: #f8f9fa;
         }

         .day-card.selected {
           border-color: #ff8c00;
           box-shadow: 0 4px 20px rgba(255, 140, 0, 0.3);
           transform: translateY(-2px);
         }

         /* Styles pour les détails du jour sélectionné */
         .selected-day-details {
           background: white;
           border-radius: 10px;
           padding: 20px;
           margin-bottom: 20px;
           box-shadow: 0 4px 20px rgba(0,0,0,0.1);
           border: 2px solid #ff8c00;
         }

         .selected-day-header {
           display: flex;
           justify-content: space-between;
           align-items: center;
           margin-bottom: 15px;
           padding-bottom: 10px;
           border-bottom: 1px solid #e0e0e0;
         }

         .selected-day-header h3 {
           margin: 0;
           color: #333;
           font-size: 1.3rem;
         }

         .close-details-btn {
           background: none;
           border: none;
           font-size: 1.2rem;
           color: #666;
           cursor: pointer;
           padding: 5px;
           border-radius: 5px;
           transition: all 0.3s ease;
         }

         .close-details-btn:hover {
           background: #f5f5f5;
           color: #333;
         }

                   .employee-summary {
            display: flex;
            flex-direction: column;
            gap: 15px;
          }

          .employee-summary-table {
            width: 100%;
            border-collapse: collapse;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }

          .employee-summary-table th {
            background: #667eea;
            color: white;
            padding: 12px 15px;
            text-align: left;
            font-weight: bold;
            font-size: 0.9rem;
          }

          .employee-summary-table td {
            padding: 12px 15px;
            border-bottom: 1px solid #e0e0e0;
            vertical-align: top;
          }

          .employee-summary-table tr:last-child td {
            border-bottom: none;
          }

          .employee-group-row:hover {
            background: #f8f9fa;
          }

          .employee-count {
            font-size: 1rem;
            color: #333;
            min-width: 120px;
          }

          .time-slots {
            min-width: 200px;
          }

          .time-slot-cell {
            padding: 4px 0;
            font-weight: 500;
            color: #333;
          }

          .employee-names {
            min-width: 250px;
          }

          .employee-names-cell {
            padding: 4px 0;
            color: #666;
            font-size: 0.9rem;
          }

        .day-header {
          text-align: center;
          margin-bottom: 10px;
        }

        .day-header h4 {
          margin: 0;
          font-size: 1.1rem;
          color: #333;
        }

        .day-date {
          font-size: 0.8rem;
          color: #666;
        }

        .day-hours {
          text-align: center;
          margin-bottom: 10px;
        }

        .hours-badge {
          background: #4ecdc4;
          color: white;
          padding: 5px 10px;
          border-radius: 15px;
          font-weight: bold;
          font-size: 0.9rem;
        }

        .day-schedule {
          margin-bottom: 10px;
        }

        .schedule-item {
          display: flex;
          justify-content: space-between;
          font-size: 0.8rem;
          margin-bottom: 2px;
        }

        .schedule-label {
          color: #666;
        }

        .schedule-time {
          font-weight: bold;
          color: #333;
        }

        .day-employees {
          text-align: center;
        }

        .max-employees {
          font-size: 0.8rem;
          color: #666;
        }

        .day-closed {
          text-align: center;
          color: #999;
          font-style: italic;
        }

        .time-slots-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 10px;
        }

                 .time-slot {
           padding: 10px;
           border-radius: 8px;
           text-align: center;
           color: #333;
           font-weight: bold;
         }

        .time-slot.active {
          opacity: 1;
        }

        .time-slot.inactive {
          opacity: 0.3;
          background: #ccc !important;
        }

        .slot-time {
          font-size: 0.8rem;
          margin-bottom: 5px;
        }

        .slot-employees {
          font-size: 1.2rem;
          margin-bottom: 5px;
        }

        .slot-employee-list {
          display: flex;
          flex-wrap: wrap;
          gap: 2px;
          justify-content: center;
        }

        .employee-tag {
          background: rgba(255,255,255,0.2);
          padding: 2px 6px;
          border-radius: 10px;
          font-size: 0.7rem;
        }

        .day-detail-header {
          background: #f8f9fa;
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 20px;
        }

        .day-summary {
          display: flex;
          gap: 20px;
          margin-top: 10px;
        }

        /* Styles pour le sélecteur de jour */
        .day-selector {
          margin-bottom: 30px;
          padding: 20px;
          background: #f8f9fa;
          border-radius: 10px;
          border: 1px solid #e0e0e0;
        }

        .day-selector h3 {
          margin: 0 0 15px 0;
          color: #333;
          font-size: 1.1rem;
        }

        .day-buttons {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .day-selector-btn {
          padding: 12px 16px;
          border: 2px solid #ddd;
          border-radius: 8px;
          background: white;
          color: #333;
          cursor: pointer;
          transition: all 0.3s ease;
          min-width: 80px;
          text-align: center;
        }

        .day-selector-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }

                 .day-selector-btn.active {
           border-color: #ff8c00;
           background: #ff8c00;
           color: white;
           box-shadow: 0 4px 12px rgba(255, 140, 0, 0.3);
           transform: translateY(-2px);
         }

                 .day-selector-btn.has-data {
           border-color: #4ecdc4;
           background: #d4f1d4;
           box-shadow: 0 2px 6px rgba(78, 205, 196, 0.2);
         }

                 .day-selector-btn.has-data:hover {
           background: #4ecdc4;
           color: white;
           box-shadow: 0 4px 12px rgba(78, 205, 196, 0.4);
           transform: translateY(-2px);
         }

        .day-selector-btn.no-data {
          border-color: #ccc;
          background: #f8f9fa;
          color: #999;
        }

        .day-selector-btn.no-data:hover {
          background: #e9ecef;
          color: #666;
        }

        .day-btn-content {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .day-name {
          font-weight: bold;
          font-size: 0.9rem;
        }

        .day-date {
          font-size: 0.8rem;
          opacity: 0.8;
        }

        .day-hours {
          font-size: 0.7rem;
          font-weight: bold;
          color: #4ecdc4;
        }

        .day-selector-btn.active .day-hours {
          color: white;
        }

        .export-buttons {
          display: flex;
          gap: 10px;
        }

        .export-btn {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 8px 16px;
          border: none;
          border-radius: 5px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.3s ease;
        }

        .export-btn:first-child {
          background: #dc3545;
          color: white;
        }

        .export-btn:last-child {
          background: #28a745;
          color: white;
        }

        .export-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        }

        /* Styles pour le tableau optimisé */
        .table-tab {
          display: flex;
          flex-direction: column;
          height: 100%;
          min-height: 400px;
        }

        .table-scroll-container {
          width: 100%;
          height: 100%;
          border: 1px solid #ddd;
          border-radius: 8px;
          overflow: hidden;
          flex: 1;
        }

        .global-day-table {
          width: 100%;
          height: 100%;
          border-collapse: collapse;
          font-size: 12px;
          table-layout: fixed;
          display: table;
        }

        .global-day-table thead {
          display: table-header-group;
        }

        .global-day-table tbody {
          display: table-row-group;
        }

        .global-day-table tr {
          display: table-row;
        }

        .global-day-table th,
        .global-day-table td {
          display: table-cell;
        }

        .global-day-table th,
        .global-day-table td {
          padding: 6px 2px;
          text-align: center;
          border: 1px solid #ddd;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .fixed-col {
          position: sticky;
          background: white;
          z-index: 10;
        }

        .day-col {
          position: sticky;
          left: 0;
          background: white;
          z-index: 20;
          border-right: 2px solid #ddd;
          width: 8%;
          min-width: 60px;
        }

        .schedule-col {
          width: 10%;
        }

                 /* Styles pour la vue hebdomadaire professionnelle et élégante */
         .weekly-tab {
           padding: 20px;
           max-height: 80vh;
           overflow-y: auto;
           background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
         }

         .weekly-header {
           text-align: center;
           margin-bottom: 25px;
           padding: 20px 25px;
           background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
           color: white;
           border-radius: 12px;
           box-shadow: 0 4px 20px rgba(44, 62, 80, 0.3);
           border: 1px solid rgba(255, 255, 255, 0.1);
         }

         .weekly-header h3 {
           margin: 0 0 8px 0;
           font-size: 24px;
           font-weight: 700;
           letter-spacing: 0.5px;
           text-transform: uppercase;
         }

         .weekly-header p {
           margin: 0;
           font-size: 16px;
           opacity: 0.95;
           font-weight: 300;
           letter-spacing: 0.3px;
         }

         .weekly-schedule {
           display: grid;
           grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
           gap: 20px;
           padding: 10px;
         }

         .day-schedule-card {
           background: white;
           border-radius: 16px;
           box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
           overflow: hidden;
           border: 1px solid rgba(255, 255, 255, 0.8);
           transition: all 0.3s ease;
           position: relative;
         }

         .day-schedule-card:hover {
           transform: translateY(-2px);
           box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
         }

         .day-schedule-card::before {
           content: '';
           position: absolute;
           top: 0;
           left: 0;
           right: 0;
           height: 4px;
           background: linear-gradient(90deg, #3498db, #2ecc71, #f39c12, #e74c3c);
         }

         .day-header {
           background: linear-gradient(135deg, #ecf0f1 0%, #bdc3c7 100%);
           padding: 16px 20px;
           border-bottom: 2px solid #ecf0f1;
           position: relative;
         }

         .day-header h4 {
           margin: 0 0 8px 0;
           font-size: 18px;
           font-weight: 700;
           color: #2c3e50;
           text-transform: capitalize;
           letter-spacing: 0.5px;
         }

         .day-summary {
           display: flex;
           gap: 20px;
           font-size: 13px;
           color: #34495e;
           font-weight: 500;
         }

         .day-summary span {
           display: flex;
           align-items: center;
           gap: 6px;
           padding: 6px 12px;
           background: rgba(255, 255, 255, 0.7);
           border-radius: 20px;
           border: 1px solid rgba(52, 73, 94, 0.1);
         }

         .employees-schedule {
           padding: 16px 20px;
           background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
         }

         .employee-schedule-row {
           display: flex;
           align-items: center;
           padding: 12px 16px;
           margin: 8px 0;
           border-radius: 12px;
           background: white;
           border: 1px solid #ecf0f1;
           transition: all 0.2s ease;
           box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
         }

         .employee-schedule-row:hover {
           background: #f8f9fa;
           border-color: #3498db;
           transform: translateX(4px);
         }

         .employee-schedule-row:last-child {
           border-bottom: none;
         }

         .employee-name {
           width: 120px;
           min-width: 120px;
           font-size: 14px;
           font-weight: 700;
           color: #2c3e50;
           text-transform: uppercase;
           letter-spacing: 0.3px;
           padding-right: 16px;
           border-right: 2px solid #ecf0f1;
         }

         .employee-hours {
           display: flex;
           flex-wrap: wrap;
           gap: 8px;
           flex: 1;
           padding-left: 16px;
         }

         .time-slot {
           background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
           color: white;
           padding: 8px 16px;
           border-radius: 20px;
           font-size: 13px;
           font-weight: 600;
           box-shadow: 0 4px 12px rgba(52, 152, 219, 0.3);
           white-space: nowrap;
           border: 1px solid rgba(255, 255, 255, 0.2);
           transition: all 0.2s ease;
           position: relative;
           overflow: hidden;
         }

         .time-slot::before {
           content: '';
           position: absolute;
           top: 0;
           left: -100%;
           width: 100%;
           height: 100%;
           background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
           transition: left 0.5s ease;
         }

         .time-slot:hover::before {
           left: 100%;
         }

         .time-slot:hover {
           transform: translateY(-2px);
           box-shadow: 0 6px 16px rgba(52, 152, 219, 0.4);
         }
          min-width: 55px;
        }

        .scrollable-col {
          width: auto;
          min-width: 50px;
          max-width: 50px;
        }

        .day-info {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1px;
        }

        .day-info strong {
          font-size: 10px;
          color: #333;
        }

        .day-date {
          font-size: 8px;
          color: #666;
        }

        .schedule-info {
          display: flex;
          flex-direction: column;
          gap: 0px;
        }

        .schedule-line {
          font-size: 9px;
          color: #333;
          font-weight: 500;
          line-height: 1.1;
        }

        .slot-display {
          font-size: 10px;
          font-weight: bold;
        }

        .has-employees {
          background-color: #e8f5e8;
        }

        .no-employees {
          background-color: #ffeaea;
        }

        /* Couleurs pastel selon le nombre d'employés */
        .scrollable-col[class*="has-employees"] {
          background-color: #e8f5e8; /* Vert clair par défaut */
        }

        .scrollable-col[class*="no-employees"] {
          background-color: #ffeaea; /* Rouge clair pour 0 employé */
        }

        .header {
          background-color: #f8f9fa;
          font-weight: bold;
          color: #333;
          border-bottom: 2px solid #ddd;
          transform: none !important;
        }

        .header * {
          transform: none !important;
        }
      `}</style>
    </div>
  );
};

export default GlobalDayViewModalV2; 
