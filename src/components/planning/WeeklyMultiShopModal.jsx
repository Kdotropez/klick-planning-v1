import React, { useState, useMemo } from 'react';
import { format, addDays, addMinutes, parse, startOfWeek, endOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import Button from '../common/Button';
import { FaDownload, FaFilePdf, FaTimes, FaUsers, FaClock, FaStore } from 'react-icons/fa';
import '@/assets/styles.css';

const WeeklyMultiShopModal = ({
  showWeeklyMultiShopModal,
  setShowWeeklyMultiShopModal,
  config,
  selectedShop,
  selectedWeek,
  planningData
}) => {
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
    if (!showWeeklyMultiShopModal) {
      return [];
    }
    return days.map((day, index) => {
      const dayKey = format(addDays(new Date(selectedWeek), index), 'yyyy-MM-dd');
      const dayDate = addDays(new Date(selectedWeek), index);
      
      // Calcul des heures d'ouverture/fermeture basé sur toutes les boutiques
      let openTime = null, closeTime = null;
      let totalHours = 0;
      
      if (planningData && planningData.shops) {
        Object.keys(planningData.shops).forEach(shopId => {
          const shop = planningData.shops[shopId];
          if (shop.weeks && shop.weeks[selectedWeek]?.planning) {
            Object.values(shop.weeks[selectedWeek].planning).forEach(employeePlanning => {
              if (employeePlanning && employeePlanning[dayKey]) {
                if (Array.isArray(employeePlanning[dayKey])) {
                  const hasWork = employeePlanning[dayKey].some(slot => slot === true);
                  if (hasWork) {
                    // Trouver le premier et dernier créneau
                    for (let i = 0; i < employeePlanning[dayKey].length; i++) {
                      if (employeePlanning[dayKey][i] && !openTime) {
                        openTime = timeSlots[i];
                      }
                      if (employeePlanning[dayKey][i]) {
                        closeTime = format(addMinutes(parse(timeSlots[i], 'HH:mm', new Date()), config.interval), 'HH:mm');
                      }
                    }
                    totalHours += config.interval / 60;
                  }
                }
              }
            });
          }
        });
      }

      return {
        day: day.name,
        short: day.short,
        date: dayDate,
        dateKey: dayKey,
        openTime: openTime || 'Fermé',
        closeTime: closeTime || 'Fermé',
        totalHours: Math.round(totalHours * 10) / 10
      };
    });
  }, [days, selectedWeek, planningData, timeSlots, config, showWeeklyMultiShopModal]);

  // Statistiques globales
  const globalStats = useMemo(() => {
    if (!showWeeklyMultiShopModal) {
      return {
        totalHours: 0,
        totalDays: 0,
        weekRange: ''
      };
    }
    
    const totalHours = dayData.reduce((sum, day) => sum + day.totalHours, 0);
    const totalDays = dayData.filter(day => day.totalHours > 0).length;
    
    return {
      totalHours: Math.round(totalHours * 10) / 10,
      totalDays,
      weekRange: `${format(startOfWeek(new Date(selectedWeek), { weekStartsOn: 1 }), 'dd/MM', { locale: fr })} - ${format(endOfWeek(new Date(selectedWeek), { weekStartsOn: 1 }), 'dd/MM', { locale: fr })}`
    };
  }, [dayData, selectedWeek, showWeeklyMultiShopModal]);

  // Fonction pour obtenir les horaires d'un employé pour un jour et une boutique
  const getEmployeeScheduleForShop = (employeeId, dayKey, shopId) => {
    if (!planningData || !planningData.shops || !planningData.shops[shopId]) return null;
    
    const shop = planningData.shops[shopId];
    const dayPlanning = shop.weeks?.[selectedWeek]?.planning?.[employeeId]?.[dayKey];
    
    if (!dayPlanning) return null;
    
    // Si c'est un statut (Congé/Maladie)
    if (typeof dayPlanning === 'string') {
      return {
        type: 'status',
        status: dayPlanning,
        schedules: []
      };
    }
    
    // Si ce sont des créneaux horaires
    if (Array.isArray(dayPlanning)) {
      const hasWork = dayPlanning.some(slot => slot === true);
      if (!hasWork) return null;
      
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

      return {
        type: 'work',
        status: 'Travail',
        schedules: schedules
      };
    }
    
    return null;
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

  // Récupérer tous les employés de toutes les boutiques
  const getAllEmployeesFromAllShops = () => {
    const allEmployees = [];
    
    if (planningData && planningData.shops) {
      Object.keys(planningData.shops).forEach(shopId => {
        const shop = planningData.shops[shopId];
        if (shop.employees && Array.isArray(shop.employees)) {
          shop.employees.forEach(employee => {
            // Éviter les doublons
            if (!allEmployees.find(emp => emp.id === employee.id)) {
              allEmployees.push({
                ...employee,
                primaryShop: shop.name // Boutique principale de l'employé
              });
            }
          });
        }
      });
    }
    
    return allEmployees;
  };

  const allEmployees = getAllEmployeesFromAllShops();

  const exportToPDF = async () => {
    try {
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const container = document.querySelector('.weekly-multishop-schedule');
      if (!container) {
        console.error('Conteneur non trouvé');
        return;
      }

      const canvas = await html2canvas(container, {
        scale: 2,
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

      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF({ 
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgWidth = pdfWidth - 20;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.setFontSize(16);
      pdf.setFont('Helvetica', 'bold');
      pdf.text('Planning hebdomadaire - Toutes les boutiques', pdfWidth / 2, 15, { align: 'center' });
      
      pdf.setFontSize(12);
      pdf.setFont('Helvetica', 'normal');
      pdf.text(`Semaine du ${globalStats.weekRange}`, pdfWidth / 2, 25, { align: 'center' });

      pdf.addImage(imgData, 'PNG', 10, 35, imgWidth, imgHeight);
      pdf.save(`planning_hebdomadaire_multiboutiques_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    } catch (error) {
      console.error('Erreur lors de l\'export PDF:', error);
      alert('Erreur lors de l\'export PDF. Veuillez réessayer.');
    }
  };

  if (!showWeeklyMultiShopModal) {
    return null;
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content weekly-multishop-modal">
        <div className="modal-header">
          <div className="modal-title">
            <FaUsers />
            <h2>Vue hebdomadaire - Toutes les boutiques</h2>
          </div>
          <Button
            className="modal-close"
            onClick={() => setShowWeeklyMultiShopModal(false)}
          >
            <FaTimes />
          </Button>
        </div>

        <div className="modal-body">
          <div className="weekly-multishop-tab">
            <div className="weekly-header">
              <h3>Planning hebdomadaire - Toutes les boutiques</h3>
              <p>Semaine du {globalStats.weekRange}</p>
            </div>

            <div className="weekly-multishop-schedule" id="weekly-multishop-schedule-export">
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
                      {allEmployees.map(employee => {
                        // Récupérer les horaires de cet employé dans toutes les boutiques pour ce jour
                        const employeeSchedules = [];
                        
                        if (planningData && planningData.shops) {
                          Object.keys(planningData.shops).forEach(shopId => {
                            const shop = planningData.shops[shopId];
                            const scheduleData = getEmployeeScheduleForShop(employee.id, day.dateKey, shopId);
                            
                            if (scheduleData) {
                              employeeSchedules.push({
                                shop: shop.name,
                                ...scheduleData
                              });
                            }
                          });
                        }
                        
                        // Si l'employé n'a aucun planning ce jour, ne pas l'afficher
                        if (employeeSchedules.length === 0) return null;

                        return (
                          <div key={employee.id} className="employee-schedule-row">
                            <div className="employee-info">
                              <div className="employee-name">
                                <strong>{employee.name}</strong>
                              </div>
                            </div>
                            
                            <div className="employee-schedules">
                              {employeeSchedules.map((scheduleData, scheduleIndex) => (
                                <div key={scheduleIndex} className="schedule-item">
                                  <div className="shop-badge">
                                    {scheduleData.shop}
                                  </div>
                                  
                                  {scheduleData.type === 'status' ? (
                                    // Affichage du statut (Congé/Maladie)
                                    <div className="status-display">
                                      {scheduleData.status === 'Congé ☀️' ? (
                                        <span className="status-conge">🏖️ Congé</span>
                                      ) : scheduleData.status === 'Maladie 🤒' ? (
                                        <span className="status-maladie">🤒 Maladie</span>
                                      ) : (
                                        <span className="status-other">{scheduleData.status}</span>
                                      )}
                                    </div>
                                  ) : (
                                    // Affichage des créneaux horaires
                                    <div className="time-slots">
                                      {scheduleData.schedules && scheduleData.schedules.length > 0 ? (
                                        mergeConsecutiveSlots(scheduleData.schedules).map((schedule, index) => (
                                          <span key={index} className="time-slot">
                                            {schedule.start} - {schedule.end}
                                          </span>
                                        ))
                                      ) : (
                                        <span className="no-schedule">Libre</span>
                                      )}
                                    </div>
                                  )}
                                </div>
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
        </div>

        <div className="modal-footer">
          <div className="export-buttons">
            <Button className="export-btn" onClick={exportToPDF}>
              <FaFilePdf /> PDF
            </Button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .weekly-multishop-modal {
          max-width: 95vw;
          max-height: 90vh;
          width: 1400px;
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

        .modal-body {
          padding: 20px;
          max-height: 70vh;
          overflow-y: auto;
        }

        .weekly-multishop-tab {
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

        .weekly-multishop-schedule {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
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
          min-width: 0;
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

        .employee-info {
          width: 140px;
          min-width: 140px;
          padding-right: 16px;
          border-right: 2px solid #ecf0f1;
        }

        .employee-name {
          font-size: 14px;
          font-weight: 700;
          color: #2c3e50;
          text-transform: uppercase;
          letter-spacing: 0.3px;
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
          background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
          color: white;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          white-space: nowrap;
          box-shadow: 0 2px 8px rgba(231, 76, 60, 0.3);
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

        .no-schedule {
          color: #95a5a6;
          font-style: italic;
          font-size: 12px;
        }

        .modal-footer {
          padding: 20px;
          border-top: 1px solid #e0e0e0;
          background: #f8f9fa;
          border-radius: 0 0 8px 8px;
        }

        .export-buttons {
          display: flex;
          gap: 10px;
          justify-content: center;
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
          background: #dc3545;
          color: white;
        }

        .export-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        }
      `}</style>
    </div>
  );
};

export default WeeklyMultiShopModal;
