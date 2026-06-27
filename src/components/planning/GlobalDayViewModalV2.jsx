import React, { useState, useMemo } from 'react';
import { format, addDays, parse, startOfWeek, endOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getSlotDurationMinutes, getSlotEndTimeFormatted } from '../../utils/slotDurationUtils';
import { formatWorkedHoursForDisplay } from '../../utils/planningUtils';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import Button from '../common/Button';
import HtmlExportButton from '../common/HtmlExportButton';
import { exportElementHtmlAsLandscape } from '../../utils/htmlLandscapeExport';
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
  planningData,
  currentShopEmployees
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
      
             // Calcul des employés par créneau (UNIQUEMENT pour la boutique sélectionnée)
       const slotData = timeSlots.map((slot, slotIndex) => {
         // Utiliser UNIQUEMENT les employés sélectionnés pour cette boutique
         // selectedEmployees contient les employés qui ont des horaires dans cette boutique
         const employeeIds = selectedEmployees.filter(empId => {
           // Vérifier que l'employé a des horaires ce jour-là
           return planning[empId]?.[dayKey]?.[slotIndex];
         });
         
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
          closeTime = getSlotEndTimeFormatted(timeSlots, i, config);
        }
      }

      // Calcul du total d'heures
      const totalHours = slotData.reduce((total, slot, slotIndex) => {
        return total + (slot.count > 0 ? getSlotDurationMinutes(timeSlots, slotIndex, config) / 60 : 0);
      }, 0);

      return {
        day: day.name,
        short: day.short,
        date: dayDate,
        dateKey: dayKey,
        openTime: openTime || 'Fermé',
        closeTime: closeTime || 'Fermé',
        totalHours,
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
      totalHours,
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
            <h3>{formatWorkedHoursForDisplay(globalStats.totalHours)}</h3>
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
                          endTime: getSlotEndTimeFormatted(timeSlots, index, config),
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
                  <span className="hours-badge">{formatWorkedHoursForDisplay(day.totalHours)}</span>
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
                  <span className="day-hours">{formatWorkedHoursForDisplay(day.totalHours)}</span>
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
              <span>Total: {formatWorkedHoursForDisplay(selectedDay.totalHours)}</span>
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
                    {slot.time} - {getSlotEndTimeFormatted(timeSlots, index, config)}
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
                    {getSlotEndTimeFormatted(timeSlots, index, config)}
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
      if (!dayPlanning) return null;

      // Si c'est un statut (Congé/Maladie), retourner null
      if (typeof dayPlanning === 'string') {
        return null;
      }

      // Si ce n'est pas un tableau, retourner null
      if (!Array.isArray(dayPlanning)) {
        return null;
      }

      const schedules = [];
      let currentStart = null;
      let currentEnd = null;

      dayPlanning.forEach((isSelected, slotIndex) => {
        if (isSelected) {
          const slotTime = timeSlots[slotIndex];
          if (!currentStart) {
            currentStart = slotTime;
          }
          currentEnd = getSlotEndTimeFormatted(timeSlots, slotIndex, config);
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
      if (!Array.isArray(schedules) || schedules.length === 0) return [];
      
      // Convertir les créneaux en objets avec start/end
      const timeSlots = [];
      let currentStart = null;
      
      for (let i = 0; i < schedules.length; i++) {
        if (schedules[i] === true || schedules[i] === 1) {
          if (currentStart === null) {
            currentStart = i;
          }
        } else {
          if (currentStart !== null) {
            const startTime = config.timeSlots[currentStart];
            // Calculer l'heure de fin en ajoutant l'intervalle au créneau de début
            const endTime = config.timeSlots[i];
            timeSlots.push({ start: startTime, end: endTime });
            currentStart = null;
          }
        }
      }
      
      // Gérer le dernier créneau
      if (currentStart !== null) {
        const startTime = config.timeSlots[currentStart];
        // Pour le dernier créneau, ajouter l'intervalle à l'heure de début
        const endTime = config.timeSlots[schedules.length - 1];
        timeSlots.push({ start: startTime, end: endTime });
      }
      
      return timeSlots;
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
                               <div key={dayIndex} className="day-schedule-card" style={{
                   borderLeft: `6px solid ${(() => {
                     const dayColors = {
                       'LUNDI': '#3498db',      // Bleu
                       'MARDI': '#e67e22',      // Orange
                       'MERCREDI': '#9b59b6',   // Violet
                       'JEUDI': '#f39c12',      // Jaune-Orange
                       'VENDREDI': '#e74c3c',   // Rouge
                       'SAMEDI': '#27ae60',     // Vert
                       'DIMANCHE': '#1abc9c'    // Turquoise
                     };
                     return dayColors[day.day.toUpperCase()] || '#95a5a6';
                   })()}`
                 }}>
                   <div className="day-header" style={{
                     background: `linear-gradient(135deg, ${(() => {
                       const dayColors = {
                         'LUNDI': '#3498db',      // Bleu
                         'MARDI': '#e67e22',      // Orange
                         'MERCREDI': '#9b59b6',   // Violet
                         'JEUDI': '#f39c12',      // Jaune-Orange
                         'VENDREDI': '#e74c3c',   // Rouge
                         'SAMEDI': '#27ae60',     // Vert
                         'DIMANCHE': '#1abc9c'    // Turquoise
                       };
                       const color = dayColors[day.day.toUpperCase()] || '#95a5a6';
                       return `${color}15 0%, ${color}25 100%`;
                     })()})`
                   }}>
                     <div className="day-header-line">
                       <h4>{day.day} {format(day.date, 'dd/MM/yyyy', { locale: fr })}</h4>
                       <div className="day-summary-compact">
                         <span>O: {day.openTime}</span>
                         <span>F: {day.closeTime}</span>
                         <span>T: {(() => {
                           // Calculer le total des heures des employés présents ce jour-là
                           let totalEmployeeHours = 0;
                           selectedEmployees.forEach(employeeId => {
                             const schedules = getEmployeeSchedule(employeeId, day.dateKey);
                             if (schedules && schedules.length > 0) {
                               schedules.forEach(schedule => {
                                 const startTime = parse(schedule.start, 'HH:mm', new Date());
                                 const endTime = parse(schedule.end, 'HH:mm', new Date());
                                 const duration = (endTime - startTime) / (1000 * 60 * 60); // Durée en heures
                                 totalEmployeeHours += duration;
                               });
                             }
                           });
                           return formatWorkedHoursForDisplay(totalEmployeeHours);
                         })()}</span>
                       </div>
                     </div>
                   </div>

                                 <div className="employees-schedule">
                   {selectedEmployees.map(employeeId => {
                     const employee = currentShopEmployees?.find(emp => emp.id === employeeId);
                     if (!employee) return null;

                     const schedules = getEmployeeSchedule(employeeId, day.dateKey);
                     if (!schedules || schedules.length === 0) return null;

                     return (
                       <div key={employeeId} className="employee-schedule-row" style={{
                         borderLeft: `4px solid ${(() => {
                           const dayColors = {
                             'LUNDI': '#3498db',      // Bleu
                             'MARDI': '#e67e22',      // Orange
                             'MERCREDI': '#9b59b6',   // Violet
                             'JEUDI': '#f39c12',      // Jaune-Orange
                             'VENDREDI': '#e74c3c',   // Rouge
                             'SAMEDI': '#27ae60',     // Vert
                             'DIMANCHE': '#1abc9c'    // Turquoise
                           };
                           return dayColors[day.day.toUpperCase()] || '#95a5a6';
                         })()}`,
                         backgroundColor: `${(() => {
                           const dayColors = {
                             'LUNDI': '#3498db',      // Bleu
                             'MARDI': '#e67e22',      // Orange
                             'MERCREDI': '#9b59b6',   // Violet
                             'JEUDI': '#f39c12',      // Jaune-Orange
                             'VENDREDI': '#e74c3c',   // Rouge
                             'SAMEDI': '#27ae60',     // Vert
                             'DIMANCHE': '#1abc9c'    // Turquoise
                           };
                           const color = dayColors[day.day.toUpperCase()] || '#95a5a6';
                           return `${color}08`;
                         })()}`
                       }}>
                         <div className="employee-name">
                           <strong>{employee.name}</strong>
                         </div>
                         <div className="employee-hours">
                           {schedules.map((schedule, index) => (
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

  // Vue hebdomadaire multi-boutiques (clone exact de WeeklyTab)
  const WeeklyMultiTab = () => {
    // Mapping des noms de boutiques (IDs numériques et textuels)
    const shopNameMapping = {
      // IDs numériques
      '0': 'PORT GRIMAUD',
      '1': 'CAVALAIRE', 
      '2': 'SAINT TROPEZ',
      '3': 'CANNES',
      '4': 'SAINTE MAXIME',
      '5': 'MARCHE AMBULANT',
      // IDs textuels (fallback)
      'port-grimaud': 'PORT GRIMAUD',
      'cavalaire': 'CAVALAIRE',
      'saint-tropez': 'SAINT TROPEZ'
    };

    // Fonction pour obtenir le nom affiché d'une boutique
    const getShopDisplayName = (shopId) => {
      return shopNameMapping[shopId] || shopId?.replace(/[-_]/g, ' ').toUpperCase() || shopId;
    };

    // Fonction pour obtenir la couleur d'une boutique
    const getShopColor = (shopName) => {
      const colorMap = {
        'PORT GRIMAUD': '#e74c3c',      // Rouge
        'CAVALAIRE': '#27ae60',         // Vert
        'SAINT TROPEZ': '#9b59b6',      // Violet
        'CANNES': '#f39c12',            // Orange
        'SAINTE MAXIME': '#1abc9c',     // Turquoise
        'MARCHE AMBULANT': '#e67e22'    // Orange foncé
      };
      return colorMap[shopName] || '#95a5a6'; // Gris par défaut
    };

    // Fonction pour assigner une couleur à chaque employé
    const getEmployeeColor = (employeeName) => {
      const colorMap = {
        'CHRISTINE': '#e74c3c',      // Rouge
        'MANON': '#27ae60',          // Vert  
        'YHONNA': '#9b59b6',        // Violet
        'ANGELIQUE': '#f39c12',      // Orange
        'MARINE': '#1abc9c',         // Turquoise
        'JULIE': '#e67e22',          // Orange foncé
        'SOPHIE': '#8e44ad',         // Violet foncé
        'LUCIA': '#16a085'           // Vert-bleu
      };
      return colorMap[employeeName] || '#95a5a6'; // Gris par défaut
    };

    // Fonction pour assigner une couleur à chaque jour
    const getDayColor = (dayName) => {
      const colorMap = {
        'LUNDI': '#3498db',      // Bleu
        'MARDI': '#e67e22',      // Orange
        'MERCREDI': '#9b59b6',   // Violet
        'JEUDI': '#f39c12',      // Jaune-Orange
        'VENDREDI': '#e74c3c',   // Rouge
        'SAMEDI': '#27ae60',     // Vert
        'DIMANCHE': '#1abc9c'    // Turquoise
      };
      return colorMap[dayName] || '#95a5a6'; // Gris par défaut
    };

    // Fonction pour obtenir les horaires d'un employé pour un jour
    const getEmployeeSchedule = (employeeId, dayKey) => {
      const dayPlanning = planning[employeeId]?.[dayKey];
      if (!dayPlanning) return null;

      // Si c'est un statut (Congé/Maladie), retourner null
      if (typeof dayPlanning === 'string') {
        return null;
      }

      // Si ce n'est pas un tableau, retourner null
      if (!Array.isArray(dayPlanning)) {
        return null;
      }

      const schedules = [];
      let currentStart = null;
      let currentEnd = null;

      dayPlanning.forEach((isSelected, slotIndex) => {
        if (isSelected) {
          const slotTime = timeSlots[slotIndex];
          if (!currentStart) {
            currentStart = slotTime;
          }
          currentEnd = getSlotEndTimeFormatted(timeSlots, slotIndex, config);
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
      if (!Array.isArray(schedules) || schedules.length === 0) return [];
      
      // Convertir les créneaux en objets avec start/end
      const timeSlots = [];
      let currentStart = null;
      
      for (let i = 0; i < schedules.length; i++) {
        if (schedules[i] === true || schedules[i] === 1) {
          if (currentStart === null) {
            currentStart = i;
          }
        } else {
          if (currentStart !== null) {
            const startTime = config.timeSlots[currentStart];
            // Calculer l'heure de fin en ajoutant l'intervalle au créneau de début
            const endTime = config.timeSlots[i];
            timeSlots.push({ start: startTime, end: endTime });
            currentStart = null;
          }
        }
      }
      
      // Gérer le dernier créneau
      if (currentStart !== null) {
        const startTime = config.timeSlots[currentStart];
        // Pour le dernier créneau, ajouter l'intervalle à l'heure de début
        const endTime = config.timeSlots[schedules.length - 1];
        timeSlots.push({ start: startTime, end: endTime });
      }
      
      return timeSlots;
    };

    return (
      <div className="weekly-tab">
        <div className="weekly-header">
          <h3>Planning hebdomadaire - GLOBAL</h3>
          <p>Semaine du {globalStats.weekRange}</p>
        </div>

        <div className="weekly-schedule" id="weekly-schedule-export">
          {dayData.map((day, dayIndex) => {
            return (
              <div 
                key={dayIndex} 
                className="day-schedule-card"
                style={{
                  borderBottom: `2px solid ${getDayColor(day.day)}`,
                  paddingBottom: '20px',
                  marginBottom: '20px'
                }}
              >
                <div className="day-header">
                  <h4>{day.day} {format(day.date, 'dd/MM/yyyy', { locale: fr })}</h4>
                </div>

                <div className="employees-schedule">
                  {currentShopEmployees.map(employee => {
                    // Logique multi-boutique : chercher où l'employé travaille ce jour-là
                    let employeeShop = getShopDisplayName(selectedShop); // Nom affiché de la boutique actuelle
                    let schedules = null;
                    let isOnLeave = false;
                    
                    // 1. Vérifier d'abord la boutique actuelle
                    schedules = getEmployeeSchedule(employee.id, day.dateKey);
                    
                    // DEBUG: Afficher les données brutes
                    console.log(`🔍 DEBUG ${employee.name} - ${day.day} (${day.dateKey}):`, {
                      employeeId: employee.id,
                      dayKey: day.dateKey,
                      schedulesFromCurrentShop: schedules,
                      schedulesType: typeof schedules,
                      isArray: Array.isArray(schedules),
                      hasValidSlots: schedules && Array.isArray(schedules) ? schedules.some(slot => slot === true || slot === 1) : false,
                      hasValidTimeSlots: schedules && Array.isArray(schedules) ? schedules.some(slot => slot && typeof slot === 'object' && slot.start && slot.end) : false
                    });
                    
                     // 2. Si pas d'horaires dans la boutique actuelle, vérifier les autres boutiques
                     if (!schedules || schedules.length === 0 || (typeof schedules === 'string' && schedules.includes('Congé'))) {
                       console.log(`🔍 DEBUG ${employee.name} - ${day.day}: Pas d'horaires dans la boutique actuelle, recherche dans les autres boutiques...`);
                       
                       // Chercher dans toutes les boutiques disponibles via planningData
                       if (planningData && planningData.shops) {
                         console.log(`🔍 DEBUG ${employee.name} - ${day.day}: planningData.shops disponibles:`, Object.keys(planningData.shops));
                         
                         for (const shopId in planningData.shops) {
                           const shop = planningData.shops[shopId];
                           console.log(`🔍 DEBUG ${employee.name} - ${day.day}: Vérification boutique ${shop.name} (ID: ${shopId})`);
                           
                           if (shop.name !== selectedShop) { // Éviter de revérifier la boutique actuelle
                             const otherShopSchedule = shop.weeks?.[selectedWeek]?.planning?.[employee.id]?.[day.dateKey];
                             console.log(`🔍 DEBUG ${employee.name} - ${day.day}: Horaires trouvés dans ${shop.name}:`, otherShopSchedule);
                             
                             if (otherShopSchedule && Array.isArray(otherShopSchedule) && otherShopSchedule.some(slot => slot)) {
                               console.log(`🔍 DEBUG ${employee.name} - ${day.day}: Horaires valides trouvés dans ${shop.name}!`);
                               // Utiliser le mapping des noms de boutiques
                               employeeShop = getShopDisplayName(shop.name);
                               schedules = otherShopSchedule;
                               break;
                             }
                           }
                         }
                       } else {
                         console.log(`🔍 DEBUG ${employee.name} - ${day.day}: planningData.shops non disponible`);
                       }
                       
                       // 3. Si toujours pas d'horaires, c'est un congé
                       if (!schedules || schedules.length === 0) {
                         console.log(`🔍 DEBUG ${employee.name} - ${day.day}: Aucun horaire trouvé, marqué comme congé`);
                         isOnLeave = true;
                       }
                     }
                    
                    // Filtrer les valeurs invalides et traiter les horaires
                    let mergedSchedules = [];
                    if (schedules && !isOnLeave && Array.isArray(schedules)) {
                      // Vérifier s'il y a des créneaux valides (format booléen)
                      const hasValidSlots = schedules.some(slot => slot === true || slot === 1);
                      // Vérifier s'il y a des créneaux valides (format objet avec start/end)
                      const hasValidTimeSlots = schedules.some(slot => slot && typeof slot === 'object' && slot.start && slot.end);
                      
                      if (hasValidSlots) {
                        // Format booléen : utiliser mergeConsecutiveSlots
                        mergedSchedules = mergeConsecutiveSlots(schedules);
                      } else if (hasValidTimeSlots) {
                        // Format objet : utiliser directement les schedules
                        mergedSchedules = schedules.filter(slot => slot && typeof slot === 'object' && slot.start && slot.end);
                      }
                    }

                    return (
                      <div 
                        key={employee.id} 
                        className="employee-schedule-row"
                        style={{
                          border: `3px solid ${getEmployeeColor(employee.name)}`,
                          backgroundColor: `${getEmployeeColor(employee.name)}15`,
                          color: '#333',
                          borderRadius: '8px',
                          padding: '8px',
                          marginBottom: '8px'
                        }}
                      >
                        <div className="employee-name">
                          <strong style={{ color: getEmployeeColor(employee.name) }}>{employee.name}</strong>
                        </div>
                        {!isOnLeave && (
                          <div className="employee-shop">
                            <span 
                              className="shop-badge"
                              style={{
                                backgroundColor: getShopColor(employeeShop)
                              }}
                            >
                              {employeeShop}
                            </span>
                          </div>
                        )}
                        <div className="employee-hours">
                          {isOnLeave ? (
                            <span className="leave-status">🏖️ Congé</span>
                          ) : mergedSchedules.length > 0 ? (
                            mergedSchedules.map((schedule, index) => (
                              <span key={index} className="time-slot">
                                {schedule.start} - {schedule.end}
                              </span>
                            ))
                          ) : (
                            <span className="no-schedule">Aucun horaire</span>
                          )}
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



  const exportToPDF = async () => {
    try {
      // Attendre que le DOM soit mis à jour
      await new Promise(resolve => setTimeout(resolve, activeTab === 'weekly-multi' ? 500 : 200));
      
      let container, title, filename;
      
      if (activeTab === 'weekly') {
        // Export de la vue hebdomadaire
        container = document.querySelector('.weekly-schedule');
        title = `Planning hebdomadaire - ${selectedShop}`;
        filename = `planning_hebdomadaire_${selectedShop}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      } else if (activeTab === 'weekly-multi') {
        // Export de la vue hebdomadaire multi-boutiques (onglet 5)
        container = document.querySelector('#weekly-schedule-export');
        title = `Planning hebdomadaire multi-boutiques - GLOBAL`;
        filename = `planning_hebdomadaire_global_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      } else {
        // Export de la vue globale (comportement existant)
        container = document.querySelector('.table-scroll-container');
        title = `Vue globale par jour - ${selectedShop}`;
        filename = `vue_globale_${selectedShop}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      }
      
      if (!container) {
        console.error('Conteneur non trouvé pour l\'onglet:', activeTab);
        console.error('Conteneur recherché:', activeTab === 'weekly-multi' ? '#weekly-schedule-export' : '.weekly-schedule');
        return;
      }

      console.log('Conteneur trouvé:', container);
      console.log('Dimensions du conteneur:', {
        width: container.scrollWidth,
        height: container.scrollHeight,
        offsetWidth: container.offsetWidth,
        offsetHeight: container.offsetHeight
      });

      // Capturer le contenu avec html2canvas pour une image fidèle
      const canvas = await html2canvas(container, {
        scale: 2, // Résolution fixe pour la fidélité
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
        orientation: activeTab === 'weekly' || activeTab === 'weekly-multi' ? 'portrait' : 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      // Calculer les dimensions pour centrer l'image (image fidèle)
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
        pdf.text(
          `Total: ${formatWorkedHoursForDisplay(globalStats.totalHours)} sur ${globalStats.totalDays} jours`,
          pdfWidth / 2,
          32,
          { align: 'center' }
        );
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

  const exportToHtml = async () => {
    try {
      await new Promise((resolve) => setTimeout(resolve, activeTab === 'weekly-multi' ? 500 : 200));
      let container;
      let title;
      let filename;
      if (activeTab === 'weekly') {
        container = document.querySelector('.weekly-schedule');
        title = `Planning hebdomadaire - ${selectedShop}`;
        filename = `planning_hebdomadaire_${selectedShop}_${format(new Date(), 'yyyy-MM-dd')}.html`;
      } else if (activeTab === 'weekly-multi') {
        container = document.querySelector('#weekly-schedule-export');
        title = 'Planning hebdomadaire multi-boutiques - GLOBAL';
        filename = `planning_hebdomadaire_global_${format(new Date(), 'yyyy-MM-dd')}.html`;
      } else {
        container = document.querySelector('.table-scroll-container');
        title = `Vue globale par jour - ${selectedShop}`;
        filename = `vue_globale_${selectedShop}_${format(new Date(), 'yyyy-MM-dd')}.html`;
      }
      if (!container) {
        alert('Contenu introuvable pour l export HTML.');
        return;
      }
      exportElementHtmlAsLandscape({
        element: container,
        title,
        metaLines: [
          `Semaine du ${globalStats.weekRange}`,
          `Genere le: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: fr })}`,
        ],
        filename,
      });
    } catch (error) {
      console.error('Erreur lors de l export HTML:', error);
      alert('Erreur lors de l export HTML. Veuillez reessayer.');
    }
  };

  const exportToExcel = () => {
    const wsData = [
      ['Vue globale par jour', selectedShop],
      ['Semaine', globalStats.weekRange],
      ['Total heures', formatWorkedHoursForDisplay(globalStats.totalHours)],
      [''],
      ['Jour', 'Date', 'Ouverture', 'Fermeture', 'Total heures', ...timeSlots.map((slot, idx) => `${slot} - ${getSlotEndTimeFormatted(timeSlots, idx, config)}`)]
    ];

    dayData.forEach(day => {
      wsData.push([
        day.day,
        format(day.date, 'dd/MM/yyyy', { locale: fr }),
        day.openTime,
        day.closeTime,
        formatWorkedHoursForDisplay(day.totalHours),
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
              className={`tab ${activeTab === 'weekly-multi' ? 'active' : ''}`}
              onClick={() => setActiveTab('weekly-multi')}
            >
              <FaStore /> Vue Hebdomadaire Multi boutique
            </button>

          </div>

          {/* Contenu des onglets */}
          <div className="tab-content">
            {activeTab === 'overview' && <OverviewTab />}
            {activeTab === 'detail' && <DetailTab />}
            {activeTab === 'table' && <TableTab />}
            {activeTab === 'weekly' && <WeeklyTab />}
            {activeTab === 'weekly-multi' && <WeeklyMultiTab />}

          </div>
        </div>

        <div className="modal-footer">
          <div className="export-buttons">
            <HtmlExportButton onClick={exportToHtml} />
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
            padding: 12px 16px;
            border-bottom: 2px solid #ecf0f1;
            position: relative;
          }

          .day-header-line {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 15px;
          }

          .day-header h4 {
            margin: 0;
            font-size: 16px;
            font-weight: 700;
            color: #2c3e50;
            text-transform: capitalize;
            letter-spacing: 0.5px;
            flex-shrink: 0;
          }

          .day-summary-compact {
            display: flex;
            gap: 12px;
            font-size: 12px;
            color: #34495e;
            font-weight: 500;
            flex-shrink: 0;
          }

          .day-summary-compact span {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 4px 8px;
            background: rgba(255, 255, 255, 0.8);
            border-radius: 12px;
            border: 1px solid rgba(52, 73, 94, 0.15);
            white-space: nowrap;
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
              flex-wrap: nowrap;
              gap: 12px;
              flex: 1;
              padding-left: 16px;
              overflow-x: auto;
              align-items: center;
            }

                                                                                                                                                               .time-slot {
               background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
               color: white;
               padding: 12px 20px;
               border-radius: 25px;
               font-size: 16px;
               font-weight: 600;
               box-shadow: 0 4px 12px rgba(52, 152, 219, 0.3);
               white-space: nowrap;
               border: 1px solid rgba(255, 255, 255, 0.2);
               transition: all 0.2s ease;
               position: relative;
               overflow: hidden;
               margin: 4px;
               flex-shrink: 0;
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

        /* Nouveaux styles pour la vue hebdomadaire multi-boutiques */
        .employee-info {
          width: 140px;
          min-width: 140px;
          padding-right: 16px;
          border-right: 2px solid #ecf0f1;
        }

        .employee-schedules {
          display: flex;
          flex-direction: column;
          gap: 8px;
          flex: 1;
          padding-left: 16px;
        }

        .schedule-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 12px;
          background: rgba(248, 249, 250, 0.8);
          border-radius: 8px;
          border: 1px solid #ecf0f1;
        }

        .shop-badge {
          /* Background sera défini dynamiquement via JavaScript */
          color: white;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          white-space: nowrap;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .status-display {
          display: flex;
          align-items: center;
        }

        .status-conge {
          background: linear-gradient(135deg, #ffeaa7 0%, #fdcb6e 100%);
          color: #d63031;
          padding: 6px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
          box-shadow: 0 2px 8px rgba(255, 234, 167, 0.3);
          border: 1px solid rgba(214, 48, 49, 0.2);
        }

        .status-maladie {
          background: linear-gradient(135deg, #fd79a8 0%, #e84393 100%);
          color: #c44569;
          padding: 6px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
          box-shadow: 0 2px 8px rgba(253, 121, 168, 0.3);
          border: 1px solid rgba(196, 69, 105, 0.2);
        }

        .status-other {
          background: linear-gradient(135deg, #95a5a6 0%, #7f8c8d 100%);
          color: white;
          padding: 6px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
          box-shadow: 0 2px 8px rgba(149, 165, 166, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .time-slots {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .time-slot {
          background: #f8f9fa;
          color: #333;
          padding: 4px 10px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 700;
          border: 2px solid #e9ecef;
          white-space: nowrap;
          display: inline-block;
          margin-right: 6px;
        }

        .no-schedule {
          color: #95a5a6;
          font-style: italic;
          font-size: 12px;
        }

        /* Ajustement de la grille pour 2 colonnes */
        .weekly-schedule {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
          padding: 10px;
        }

        .day-schedule-card {
          min-width: 0; /* Permet aux cartes de se rétrécir */
        }

        

        .status-conge {
          background: linear-gradient(135deg, #ffc107 0%, #e0a800 100%);
          color: #856404;
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          box-shadow: 0 1px 3px rgba(255, 193, 7, 0.3);
        }

        .status-maladie {
          background: linear-gradient(135deg, #fd79a8 0%, #e84393 100%);
          color: #c44569;
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          box-shadow: 0 1px 3px rgba(253, 121, 168, 0.3);
        }
      `}</style>
    </div>
  );
};

export default GlobalDayViewModalV2; 

