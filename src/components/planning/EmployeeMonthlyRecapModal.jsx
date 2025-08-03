import React from 'react';
import { format, addDays, startOfMonth, endOfMonth, startOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import Button from '../common/Button';
import { calculateEmployeeDailyHours } from '../../utils/planningUtils';
import { loadFromLocalStorage } from '../../utils/localStorage';
import { getWeekPlanning } from '../../utils/planningDataManager';
import '@/assets/styles.css';

const EmployeeMonthlyRecapModal = ({
  showEmployeeMonthlyRecap,
  setShowEmployeeMonthlyRecap,
  config,
  selectedShop,
  selectedWeek,
  selectedEmployees,
  selectedEmployeeForMonthlyRecap,
  shops,
  employees,
  planningData
}) => {
  console.log('EmployeeMonthlyRecapModal: Rendered with props', {
    showEmployeeMonthlyRecap,
    setShowEmployeeMonthlyRecap: typeof setShowEmployeeMonthlyRecap,
    selectedShop,
    selectedWeek,
    shops,
    config: config ? { timeSlotsLength: config.timeSlots?.length } : null
  });
  
  console.log('EmployeeMonthlyRecapModal: Validation check', {
    hasTimeSlots: config?.timeSlots?.length > 0,
    isShopsArray: Array.isArray(shops),
    shopsLength: shops?.length,
    condition: !config?.timeSlots?.length || !Array.isArray(shops) || shops.length === 0
  });

  // Si la modale ne doit pas être affichée, ne rien rendre
  if (!showEmployeeMonthlyRecap) {
    return null;
  }

  // Fonction pour obtenir le nom de l'employé
  const getEmployeeName = (employeeId) => {
    if (!employees || !Array.isArray(employees)) return employeeId;
    const employee = employees.find(emp => emp.id === employeeId || emp === employeeId);
    return employee ? (employee.name || employee) : employeeId;
  };

  const employeeName = getEmployeeName(selectedEmployeeForMonthlyRecap);

  const getMonthWeeks = (selectedWeek) => {
    const start = startOfMonth(new Date(selectedWeek));
    const end = endOfMonth(new Date(selectedWeek));
    const weeks = [];
    let current = startOfWeek(start, { weekStartsOn: 1 });
    while (current <= end) {
      weeks.push(current);
      current = addDays(current, 7);
    }
    return weeks;
  };

  const getWeekRange = (weekStart) => {
    const weekEnd = addDays(weekStart, 6);
    return `Du ${format(weekStart, 'd MMMM', { locale: fr })} au ${format(weekEnd, 'd MMMM yyyy', { locale: fr })}`;
  };

  const calculateTotalHours = () => {
    let totalHours = 0;
    
    // Calculer seulement pour les jours du mois (1er au dernier jour)
    const start = startOfMonth(new Date(selectedWeek));
    const end = endOfMonth(new Date(selectedWeek));
    
    // Ne calculer que pour la boutique actuelle
    const currentShop = shops.find(shop => shop.id === selectedShop);
    if (currentShop) {
      // Parcourir chaque jour du mois
      let currentDay = start;
      while (currentDay <= end) {
        const dayKey = format(currentDay, 'yyyy-MM-dd');
        
        // Trouver la semaine qui contient ce jour
        const weekStart = startOfWeek(currentDay, { weekStartsOn: 1 });
        const weekKey = format(weekStart, 'yyyy-MM-dd');
        
        // Utiliser getWeekPlanning pour normaliser les données
        const weekData = getWeekPlanning(planningData, selectedShop, weekKey);
        if (weekData.selectedEmployees?.includes(selectedEmployeeForMonthlyRecap)) {
          const weekPlanning = weekData.planning || {};
          const hours = calculateEmployeeDailyHours(selectedEmployeeForMonthlyRecap, dayKey, weekPlanning, config);
          totalHours += hours;
        }
        
        currentDay = addDays(currentDay, 1);
      }
    }
    return totalHours.toFixed(1);
  };

  const calculateShopWeeklyHours = (shopId, week) => {
    const weekKey = format(week, 'yyyy-MM-dd');
    
    // Utiliser getWeekPlanning pour normaliser les données
    const weekData = getWeekPlanning(planningData, shopId, weekKey);
    if (!weekData.selectedEmployees?.includes(selectedEmployeeForMonthlyRecap)) return 0;
    
    const weekPlanning = weekData.planning || {};
    let weekHours = 0;
    
    // Calculer seulement pour les jours de cette semaine qui appartiennent au mois
    const start = startOfMonth(new Date(selectedWeek));
    const end = endOfMonth(new Date(selectedWeek));
    
    for (let i = 0; i < 7; i++) {
      const day = format(addDays(week, i), 'yyyy-MM-dd');
      const dayDate = new Date(day);
      
      // Ne calculer que si le jour appartient au mois
      if (dayDate >= start && dayDate <= end) {
        const hours = calculateEmployeeDailyHours(selectedEmployeeForMonthlyRecap, day, weekPlanning, config);
        weekHours += hours;
      }
    }
    return weekHours.toFixed(1);
  };

  const calculateShopMonthlyHours = (shopId) => {
    let totalHours = 0;
    const weeks = getMonthWeeks(selectedWeek);
    weeks.forEach(week => {
      totalHours += parseFloat(calculateShopWeeklyHours(shopId, week));
    });
    return totalHours.toFixed(1);
  };

  const exportToPDF = () => {
    console.log('EmployeeMonthlyRecapModal: Exporting to PDF');
    const doc = new jsPDF();
    doc.setFont('Helvetica', 'normal');
    const title = `Récapitulatif mensuel pour ${employeeName} (${calculateTotalHours()} H)`;
    doc.text(title, 10, 10);
    doc.text(`Mois de ${format(new Date(selectedWeek), 'MMMM yyyy', { locale: fr })}`, 10, 20);
    
    // Déterminer les boutiques avec des heures
    const weeks = getMonthWeeks(selectedWeek);
    const shopsWithHours = new Map();
    weeks.forEach(week => {
      shops.forEach(shop => {
        const shopHours = calculateShopWeeklyHours(shop.id, week);
        if (parseFloat(shopHours) > 0) {
          shopsWithHours.set(shop.id, shop.name);
        }
      });
    });
    
    const columns = ['Semaine', ...Array.from(shopsWithHours.values())];
    const body = [];
    weeks.forEach(week => {
      const row = [getWeekRange(week)];
      shopsWithHours.forEach((shopName, shopId) => {
        const shopHours = calculateShopWeeklyHours(shopId, week);
        row.push(shopHours > 0 ? shopHours + ' H' : '');
      });
      body.push(row);
    });
    
    doc.autoTable({
      head: [columns],
      body: body,
      startY: 30,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 136, 229] }
    });
    doc.save(`monthly_recap_${employeeName}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    console.log('EmployeeMonthlyRecapModal: PDF exported successfully');
  };

  const exportToExcel = () => {
    console.log('EmployeeMonthlyRecapModal: Exporting to Excel');
    const weeks = getMonthWeeks(selectedWeek);
    
    // Déterminer les boutiques avec des heures
    const shopsWithHours = new Map();
    weeks.forEach(week => {
      shops.forEach(shop => {
        const shopHours = calculateShopWeeklyHours(shop.id, week);
        if (parseFloat(shopHours) > 0) {
          shopsWithHours.set(shop.id, shop.name);
        }
      });
    });
    
    const data = [];
    weeks.forEach(week => {
      const row = { 'Semaine': getWeekRange(week) };
      shopsWithHours.forEach((shopName, shopId) => {
        const shopHours = calculateShopWeeklyHours(shopId, week);
        row[shopName] = shopHours > 0 ? shopHours + ' H' : '';
      });
      data.push(row);
    });
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Récapitulatif mensuel');
    XLSX.writeFile(wb, `monthly_recap_${employeeName}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    console.log('EmployeeMonthlyRecapModal: Excel exported successfully');
  };

  const exportAsImagePdf = async () => {
    console.log('EmployeeMonthlyRecapModal: Exporting to PDF as image');
    try {
      const element = document.querySelector('.modal-content');
      if (!element) {
        throw new Error('Modal content not found');
      }
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      pdf.save(`monthly_recap_${selectedEmployeeForMonthlyRecap}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      console.log('EmployeeMonthlyRecapModal: PDF exported successfully as image');
    } catch (error) {
      console.error('EmployeeMonthlyRecapModal: PDF export failed', error);
      alert(`Erreur lors de l'exportation PDF : ${error.message || 'Erreur inconnue'}`);
    }
  };

  if (!config?.timeSlots?.length || !Array.isArray(shops) || shops.length === 0) {
    return (
      <div className="modal-overlay" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
        <div className="modal-content" style={{ width: '95%', maxWidth: '1200px' }}>
          <button
            className="modal-close"
            onClick={() => {
              console.log('EmployeeMonthlyRecapModal: Closing modal via cross');
              setShowEmployeeMonthlyRecap(false);
            }}
            style={{ color: '#dc3545', fontSize: '18px' }}
          >
            ✕
          </button>
          <h3 style={{ fontFamily: 'Roboto, sans-serif', textAlign: 'center' }}>
            Erreur
          </h3>
          <p style={{ fontFamily: 'Roboto, sans-serif', textAlign: 'center', color: '#e53935' }}>
            Aucune configuration de tranches horaires ou boutiques disponible.
          </p>
          <div className="button-group" style={{ display: 'flex', justifyContent: 'center', marginTop: '15px' }}>
            <Button
              className="button-retour"
              onClick={() => {
                console.log('EmployeeMonthlyRecapModal: Closing modal via button');
                setShowEmployeeMonthlyRecap(false);
              }}
            >
              Fermer
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const totalHours = calculateTotalHours();

  return (
    <div className="modal-overlay" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
      <div className="modal-content" style={{ width: '95%', maxWidth: '1200px' }}>
        <button
          className="modal-close"
          onClick={() => {
            console.log('EmployeeMonthlyRecapModal: Closing modal via cross');
            setShowEmployeeMonthlyRecap(false);
          }}
          style={{ color: '#dc3545', fontSize: '18px' }}
        >
          ✕
        </button>
        <h3 style={{ fontFamily: 'Roboto, sans-serif', textAlign: 'center' }}>
          Récapitulatif mensuel pour {employeeName} ({totalHours} H)
        </h3>
        <p style={{ fontFamily: 'Roboto, sans-serif', textAlign: 'center', marginBottom: '10px' }}>
          Mois de {format(new Date(selectedWeek), 'MMMM yyyy', { locale: fr })}
        </p>
        {(() => {
          const weeks = getMonthWeeks(selectedWeek);
          const dayData = [];

          // Déterminer quelles boutiques ont des heures pour cet employé
          const shopsWithHours = new Map(); // Utiliser Map pour stocker shopId -> shopName
          weeks.forEach(week => {
            shops.forEach(shop => {
              const shopHours = calculateShopWeeklyHours(shop.id, week);
              if (parseFloat(shopHours) > 0) {
                shopsWithHours.set(shop.id, shop.name);
              }
            });
          });

          weeks.forEach((week, weekIndex) => {
            const row = {
              week: getWeekRange(week),
              weekIndex
            };
            
            // Ajouter seulement les boutiques où l'employé a travaillé
            shopsWithHours.forEach((shopName, shopId) => {
              row[shopId] = calculateShopWeeklyHours(shopId, week);
            });
            
            dayData.push(row);
          });

          if (dayData.length === 0) {
            return (
              <p style={{ fontFamily: 'Roboto, sans-serif', textAlign: 'center', color: '#e53935' }}>
                Aucune donnée disponible pour ce mois.
              </p>
            );
          }

          return (
            <table style={{ fontFamily: 'Roboto, sans-serif', width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f0f0f0' }}>
                  <th style={{ border: '1px solid #ddd', padding: '8px', fontWeight: '700' }}>Semaine</th>
                  {Array.from(shopsWithHours.values()).map((shopName, index) => (
                    <th key={index} style={{ border: '1px solid #ddd', padding: '8px', fontWeight: '700' }}>{shopName}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dayData.map((data, index) => (
                  <tr key={index} style={{
                    backgroundColor: (() => {
                      const pastelColors = [
                        '#F0F8FF', // AliceBlue
                        '#F5F5DC', // Beige
                        '#F5DEB3', // Wheat
                        '#F0FFF0', // Honeydew
                        '#E6E6FA'  // Lavender
                      ];
                      return pastelColors[data.weekIndex % pastelColors.length];
                    })()
                  }}>
                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>{data.week}</td>
                    {Array.from(shopsWithHours.entries()).map(([shopId, shopName], index) => (
                      <td key={index} style={{ border: '1px solid #ddd', padding: '8px' }}>
                        {data[shopId] > 0 ? data[shopId] + ' H' : ''}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr style={{ backgroundColor: '#f0f0f0', fontWeight: '700' }}>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>Total mois</td>
                  {Array.from(shopsWithHours.entries()).map(([shopId, shopName], index) => (
                    <td key={index} style={{ border: '1px solid #ddd', padding: '8px' }}>{calculateShopMonthlyHours(shopId)} H</td>
                  ))}
                </tr>
              </tbody>
            </table>
          );
        })()}
        <div className="button-group" style={{ display: 'flex', justifyContent: 'center', marginTop: '15px' }}>
          <Button className="button-pdf" onClick={exportToPDF}>
            Exporter en PDF
          </Button>
          <Button className="button-pdf" onClick={exportToExcel}>
            Exporter en Excel
          </Button>
          <Button className="button-pdf" onClick={exportAsImagePdf}>
            Exporter en PDF (image fidèle)
          </Button>
          <Button
            className="button-retour"
            onClick={() => {
              console.log('EmployeeMonthlyRecapModal: Closing modal via button');
              setShowEmployeeMonthlyRecap(false);
            }}
          >
            Fermer
          </Button>
        </div>
      </div>
    </div>
  );
};

export default EmployeeMonthlyRecapModal; 