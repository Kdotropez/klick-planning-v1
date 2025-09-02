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
import '@/assets/styles.css';

const MonthlyRecapModals = ({
  showMonthlyRecapModal,
  setShowMonthlyRecapModal,
  config,
  selectedShop,
  selectedWeek,
  selectedEmployees,
  shops
}) => {
  // Ne rien afficher si la modale n'est pas visible OU si les données ne sont pas valides
  if (!showMonthlyRecapModal || !config?.timeSlots?.length || !Array.isArray(shops) || shops.length === 0) {
    return null;
  }
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
    const weeks = getMonthWeeks(selectedWeek);
    shops.forEach(shop => {
      if (shop.id !== selectedShop) return;
      weeks.forEach(week => {
        const weekKey = format(week, 'yyyy-MM-dd');
        const selectedEmployeesForShop = loadFromLocalStorage(`selected_employees_${shop.id}_${weekKey}`, []);
        selectedEmployeesForShop.forEach(employee => {
          const weekPlanning = loadFromLocalStorage(`planning_${shop.id}_${weekKey}`, {});
          for (let i = 0; i < 7; i++) {
            const day = format(addDays(week, i), 'yyyy-MM-dd');
            const hours = calculateEmployeeDailyHours(employee, day, weekPlanning, config);
            totalHours += hours;
          }
        });
      });
    });
    return totalHours.toFixed(1);
  };

  const calculateEmployeeMonthlyHours = (employee) => {
    let totalHours = 0;
    const weeks = getMonthWeeks(selectedWeek);
    shops.forEach(shop => {
      if (shop.id !== selectedShop) return;
      weeks.forEach(week => {
        const weekKey = format(week, 'yyyy-MM-dd');
        const weekPlanning = loadFromLocalStorage(`planning_${shop.id}_${weekKey}`, {});
        for (let i = 0; i < 7; i++) {
          const day = format(addDays(week, i), 'yyyy-MM-dd');
          const hours = calculateEmployeeDailyHours(employee, day, weekPlanning, config);
          totalHours += hours;
        }
      });
    });
    return totalHours.toFixed(1);
  };

  const exportToPDF = () => {
    console.log('MonthlyRecapModals: Exporting to PDF');
    const doc = new jsPDF();
    doc.setFont('Helvetica', 'normal');
    const shop = Array.isArray(shops) ? shops.find(s => s.id === selectedShop) || { name: 'Boutique' } : { name: 'Boutique' };
    const title = `Récapitulatif mensuel pour ${shop.name} (${calculateTotalHours()} H)`;
    doc.text(title, 10, 10);
    doc.text(`Mois de ${format(new Date(selectedWeek), 'MMMM yyyy', { locale: fr })}`, 10, 20);
    const columns = ['Semaine', 'Employé(e)', 'Heures effectives'];
    const body = [];
    const weeks = getMonthWeeks(selectedWeek);
    const employees = loadFromLocalStorage(`employees_${selectedShop}`, []);

    weeks.forEach((week, index) => {
      const weekKey = format(week, 'yyyy-MM-dd');
      const selectedEmployeesForShop = loadFromLocalStorage(`selected_employees_${selectedShop}_${weekKey}`, employees);
      console.log(`MonthlyRecapModals: Checking employees for ${selectedShop} ${weekKey}`, JSON.stringify(selectedEmployeesForShop, null, 2));
      employees.forEach(employee => {
        const weekPlanning = loadFromLocalStorage(`planning_${selectedShop}_${weekKey}`, {});
        let weekHours = 0;
        for (let i = 0; i < 7; i++) {
          const day = format(addDays(week, i), 'yyyy-MM-dd');
          const hours = calculateEmployeeDailyHours(employee, day, weekPlanning, config);
          weekHours += hours;
        }
        body.push([
          index === 0 ? getWeekRange(week) : '',
          `    ${employee}`,
          weekHours.toFixed(1) + ' H'
        ]);
      });
    });

    employees.forEach(employee => {
      body.push([
        `Total mois ${employee}`,
        '',
        calculateEmployeeMonthlyHours(employee) + ' H'
      ]);
    });

    doc.autoTable({
      head: [columns],
      body,
      startY: 30,
      styles: { font: 'Helvetica', fontSize: 10, cellPadding: 4 },
      headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
      bodyStyles: { textColor: [51, 51, 51] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      columnStyles: {
        0: { cellWidth: 60, halign: 'left' },
        1: { cellWidth: 60 },
        2: { cellWidth: 40 }
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.row.index < body.length - employees.length) {
          const weekIndex = Math.floor((data.row.index) / employees.length);
          const pastelColors = [
            [240, 248, 255], // AliceBlue
            [245, 245, 220], // Beige
            [245, 222, 179], // Wheat
            [240, 255, 240], // Honeydew
            [230, 230, 250]  // Lavender
          ];
          data.cell.styles.fillColor = pastelColors[weekIndex % pastelColors.length];
        }
      }
    });
    doc.save(`monthly_recap_${selectedShop}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    console.log('MonthlyRecapModals: PDF exported successfully');
  };

  const exportToExcel = () => {
    console.log('MonthlyRecapModals: Exporting to Excel');
    const columns = ['Semaine', 'Employé(e)', 'Heures effectives'];
    const wsData = [columns];
    const weeks = getMonthWeeks(selectedWeek);
    const employees = loadFromLocalStorage(`employees_${selectedShop}`, []);

    weeks.forEach((week, index) => {
      const weekKey = format(week, 'yyyy-MM-dd');
      const selectedEmployeesForShop = loadFromLocalStorage(`selected_employees_${selectedShop}_${weekKey}`, employees);
      console.log(`MonthlyRecapModals: Checking employees for ${selectedShop} ${weekKey}`, JSON.stringify(selectedEmployeesForShop, null, 2));
      employees.forEach(employee => {
        const weekPlanning = loadFromLocalStorage(`planning_${selectedShop}_${weekKey}`, {});
        let weekHours = 0;
        for (let i = 0; i < 7; i++) {
          const day = format(addDays(week, i), 'yyyy-MM-dd');
          const hours = calculateEmployeeDailyHours(employee, day, weekPlanning, config);
          weekHours += hours;
        }
        wsData.push([
          index === 0 ? getWeekRange(week) : '',
          `    ${employee}`,
          weekHours.toFixed(1) + ' H'
        ]);
      });
    });

    employees.forEach(employee => {
      wsData.push([
        `Total mois ${employee}`,
        '',
        calculateEmployeeMonthlyHours(employee) + ' H'
      ]);
    });

    console.log('MonthlyRecapModals: wsData for Excel export:', JSON.stringify(wsData, null, 2));
    try {
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Monthly Recap');
      XLSX.write(wb, `monthly_recap_${selectedShop}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
      console.log('MonthlyRecapModals: Excel exported successfully');
    } catch (error) {
      console.error('MonthlyRecapModals: Excel export failed', error);
      alert(`Erreur lors de l'exportation Excel : ${error.message || 'Erreur inconnue'}`);
    }
  };

  const exportAsImagePdf = async () => {
    console.log('MonthlyRecapModals: Starting PDF export as image');
    try {
      const modalElement = document.querySelector('.modal-content');
      if (!modalElement) throw new Error('Contenu de la modale introuvable');
      const canvas = await html2canvas(modalElement, {
        scale: 3,
        useCORS: true,
        scrollX: 0,
        scrollY: -window.scrollY,
        backgroundColor: '#ffffff',
        windowWidth: modalElement.scrollWidth,
        windowHeight: modalElement.scrollHeight
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const imgWidth = canvas.width * 0.264583;
      const imgHeight = canvas.height * 0.264583;
      const maxWidth = pageWidth - 2 * margin;
      const maxHeight = pageHeight - 2 * margin;
      const ratio = Math.min(maxWidth / imgWidth, maxHeight / imgHeight);
      const scaledWidth = imgWidth * ratio;
      const scaledHeight = imgHeight * ratio;
      if (scaledWidth > maxWidth || scaledHeight > maxHeight) {
        let currentX = 0;
        let pageCount = 0;
        while (currentX < imgWidth) {
          if (pageCount > 0) pdf.addPage();
          const sliceWidth = maxWidth / ratio;
          pdf.addImage(imgData, 'PNG', margin, margin, maxWidth, Math.min(scaledHeight, maxHeight), null, 'FAST', 0, currentX);
          currentX += sliceWidth;
          pageCount++;
        }
      } else {
        pdf.addImage(imgData, 'PNG', margin, margin, scaledWidth, scaledHeight);
      }
      pdf.save(`monthly_recap_${selectedShop}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      console.log('MonthlyRecapModals: PDF exported successfully as image');
    } catch (error) {
      console.error('MonthlyRecapModals: PDF export failed', error);
      alert(`Erreur lors de l'exportation PDF : ${error.message || 'Erreur inconnue'}`);
    }
  };

  if (!config?.timeSlots?.length || !Array.isArray(shops) || shops.length === 0) {
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
            Erreur
          </h3>
          <p style={{ fontFamily: 'Roboto, sans-serif', textAlign: 'center', color: '#e53935' }}>
            Aucune configuration de tranches horaires ou boutiques disponible.
          </p>
          <div className="button-group" style={{ display: 'flex', justifyContent: 'center', marginTop: '15px' }}>
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
  }

  const shop = Array.isArray(shops) ? shops.find(s => s.id === selectedShop) || { name: 'Boutique' } : { name: 'Boutique' };
  const totalHours = calculateTotalHours();

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
        <p style={{ fontFamily: 'Roboto, sans-serif', textAlign: 'center', marginBottom: '10px' }}>
          Mois de {format(new Date(selectedWeek), 'MMMM yyyy', { locale: fr })}
        </p>
        {(() => {
          const weeks = getMonthWeeks(selectedWeek);
          const employees = loadFromLocalStorage(`employees_${selectedShop}`, []);
          const dayData = [];

          weeks.forEach((week, index) => {
            const weekKey = format(week, 'yyyy-MM-dd');
            const selectedEmployeesForShop = loadFromLocalStorage(`selected_employees_${selectedShop}_${weekKey}`, employees);
            console.log(`MonthlyRecapModals: Checking employees for ${selectedShop} ${weekKey}`, JSON.stringify(selectedEmployeesForShop, null, 2));
            employees.forEach(employee => {
              const weekPlanning = loadFromLocalStorage(`planning_${selectedShop}_${weekKey}`, {});
              let weekHours = 0;
              for (let i = 0; i < 7; i++) {
                const day = format(addDays(week, i), 'yyyy-MM-dd');
                const hours = calculateEmployeeDailyHours(employee, day, weekPlanning, config);
                weekHours += hours;
              }
              dayData.push({
                week: getWeekRange(week),
                employee,
                hours: weekHours.toFixed(1),
                weekIndex: index,
                isWeekHeader: index === 0
              });
            });
          });

          employees.forEach(employee => {
            dayData.push({
              week: `Total mois ${employee}`,
              employee: '',
              hours: calculateEmployeeMonthlyHours(employee),
              weekIndex: -1,
              isWeekHeader: false
            });
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
                  <th style={{ border: '1px solid #ddd', padding: '8px', fontWeight: '700' }}>Employé(e)</th>
                  <th style={{ border: '1px solid #ddd', padding: '8px', fontWeight: '700' }}>Heures effectives</th>
                </tr>
              </thead>
              <tbody>
                {dayData.map((data, index) => (
                  <tr key={index} style={{
                    backgroundColor: (() => {
                      if (data.weekIndex === -1) return '#ffffff';
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
                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                      {data.isWeekHeader ? data.week : data.week.includes('Total mois') ? data.week : ''}
                    </td>
                    <td style={{ border: '1px solid #ddd', padding: '8px', paddingLeft: data.week.includes('Total mois') ? '8px' : '20px' }}>
                      {data.employee}
                    </td>
                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>{data.hours} H</td>
                  </tr>
                ))}
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