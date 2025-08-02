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

  const exportToPDF = async () => {
    try {
      // Attendre que le DOM soit mis à jour
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const tableContainer = document.querySelector('.table-scroll-container');
      if (!tableContainer) {
        console.error('Conteneur du tableau non trouvé');
        return;
      }

      // Capturer le tableau avec html2canvas pour une image fidèle
      const canvas = await html2canvas(tableContainer, {
        scale: 3, // Haute résolution pour une image fidèle
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: tableContainer.scrollWidth,
        height: tableContainer.scrollHeight,
        scrollX: 0,
        scrollY: 0,
        windowWidth: tableContainer.scrollWidth,
        windowHeight: tableContainer.scrollHeight
      });

      // Créer le PDF
      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF({ 
        orientation: 'landscape',
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
      pdf.text(`Vue globale par jour - ${selectedShop}`, pdfWidth / 2, 15, { align: 'center' });
      
      pdf.setFontSize(12);
      pdf.setFont('Helvetica', 'normal');
      pdf.text(`Semaine du ${globalStats.weekRange}`, pdfWidth / 2, 25, { align: 'center' });
      pdf.text(`Total: ${globalStats.totalHours}h sur ${globalStats.totalDays} jours`, pdfWidth / 2, 32, { align: 'center' });

      // Ajouter l'image du tableau
      const yPosition = 40;
      pdf.addImage(imgData, 'PNG', 10, yPosition, imgWidth, imgHeight);

      pdf.save(`vue_globale_${selectedShop}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
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
          </div>

          {/* Contenu des onglets */}
          <div className="tab-content">
            {activeTab === 'overview' && <OverviewTab />}
            {activeTab === 'detail' && <DetailTab />}
            {activeTab === 'table' && <TableTab />}
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