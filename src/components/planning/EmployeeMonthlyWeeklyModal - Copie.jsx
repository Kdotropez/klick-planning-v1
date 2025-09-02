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

const EmployeeMonthlyWeeklyModal = ({
  showEmployeeMonthlyWeeklyModal,
  setShowEmployeeMonthlyWeeklyModal,
  config,
  selectedShop,
  selectedWeek,
  selectedEmployeeForMonthlyRecap,
  shops
}) => {
  console.log('EmployeeMonthlyWeeklyModal: Rendered with props', {
    showEmployeeMonthlyWeeklyModal,
    setShowEmployeeMonthlyWeeklyModal: typeof setShowEmployeeMonthlyWeeklyModal,
    selectedEmployeeForMonthlyRecap,
    selectedShop,
    selectedWeek,
    shops
  });

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
      weeks.forEach(week => {
        const weekKey = format(week, 'yyyy-MM-dd');
        const selectedEmployeesForShop = loadFromLocalStorage(`selected_employees_${shop.id}_${weekKey}`, []);
        if (!selectedEmployeesForShop.includes(selectedEmployeeForMonthlyRecap)) return;
        const weekPlanning = loadFromLocalStorage(`planning_${shop.id}_${weekKey}`, {});
        for (let i = 0; i < 7; i++) {
          const day = format(addDays(week, i), 'yyyy-MM-dd');
          const hours = calculateEmployeeDailyHours(selectedEmployeeForMonthlyRecap, day, weekPlanning, config);
          totalHours += hours;
        }
      });
    });
    return totalHours.toFixed(1);
  };

  const calculateShopWeeklyHours = (shopId, week) => {
    const weekKey = format(week, 'yyyy-MM-dd');
    const selectedEmployeesForShop = loadFromLocalStorage(`selected_employees_${shopId}_${weekKey}`, []);
    if (!selectedEmployeesForShop.includes(selectedEmployeeForMonthlyRecap)) return 0;
    const weekPlanning = loadFromLocalStorage(`planning_${shopId}_${weekKey}`, {});
    let weekHours = 0;
    for (let i = 0; i < 7; i++) {
      const day = format(addDays(week, i), 'yyyy-MM-dd');
      const hours = calculateEmployeeDailyHours(selectedEmployeeForMonthlyRecap, day, weekPlanning, config);
      weekHours += hours;
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
    console.log('EmployeeMonthlyWeeklyModal: Exporting to PDF');
    const doc = new jsPDF();
    doc.setFont('Helvetica', 'normal');
    const title = `Récapitulatif mensuel pour ${selectedEmployeeForMonthlyRecap} (${calculateTotalHours()} H)`;
    doc.text(title, 10, 10);
    doc.text(`Mois de ${format(new Date(selectedWeek), 'MMMM yyyy', { locale: fr })}`, 10, 20);
    const columns = ['Semaine', 'CAVALAIRE', 'PORT GRIMAUD'];
    const body = [];
    const weeks = getMonthWeeks(selectedWeek);

    weeks.forEach((week, weekIndex) => {
      const row = [getWeekRange(week)];
      const cavalaireHours = calculateShopWeeklyHours('CAVALAIRE', week);
      const portGrimaudHours = calculateShopWeeklyHours('PORT_GRIMAUD', week);
      row.push(cavalaireHours > 0 ? cavalaireHours + ' H' : '');
      row.push(portGrimaudHours > 0 ? portGrimaudHours + ' H' : '');
      body.push(row);
    });

    body.push(['Total mois CAVALAIRE', calculateShopMonthlyHours('CAVALAIRE') + ' H', '']);
    body.push(['Total mois PORT GRIMAUD', '', calculateShopMonthlyHours('PORT_GRIMAUD') + ' H']);

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
        1: { cellWidth: 40 },
        2: { cellWidth: 40 }
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.row.index < weeks.length) {
          const pastelColors = [
            [240, 248, 255], // AliceBlue
            [245, 245, 220], // Beige
            [245, 222, 179], // Wheat
            [240, 255, 240], // Honeydew
            [230, 230, 250]  // Lavender
          ];
          data.cell.styles.fillColor = pastelColors[data.row.index % pastelColors.length];
        }
      }
    });
    doc.save(`monthly_recap_${selectedEmployeeForMonthlyRecap}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    console.log('EmployeeMonthlyWeeklyModal: PDF exported successfully');
  };

  const exportToExcel = () => {
    console.log('EmployeeMonthlyWeeklyModal: Exporting to Excel');
    const columns = ['Semaine', 'CAVALAIRE', 'PORT GRIMAUD'];
    const wsData = [columns];
    const weeks = getMonthWeeks(selectedWeek);

    weeks.forEach(week => {
      const row = [getWeekRange(week)];
      const cavalaireHours = calculateShopWeeklyHours('CAVALAIRE', week);
      const portGrimaudHours = calculateShopWeeklyHours('PORT_GRIMAUD', week);
      row.push(cavalaireHours > 0 ? cavalaireHours + ' H' : '');
      row.push(portGrimaudHours > 0 ? portGrimaudHours + ' H' : '');
      wsData.push(row);
    });

    wsData.push(['Total mois CAVALAIRE', calculateShopMonthlyHours('CAVALAIRE') + ' H', '']);
    wsData.push(['Total mois PORT GRIMAUD', '', calculateShopMonthlyHours('PORT_GRIMAUD') + ' H']);

    console.log('EmployeeMonthlyWeeklyModal: wsData for Excel export:', JSON.stringify(wsData, null, 2));
    try {
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Employee Monthly Recap');
      XLSX.write(wb, `monthly_recap_${selectedEmployeeForMonthlyRecap}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
      console.log('EmployeeMonthlyWeeklyModal: Excel exported successfully');
    } catch (error) {
      console.error('EmployeeMonthlyWeeklyModal: Excel export failed', error);
      alert(`Erreur lors de l'exportation Excel : ${error.message || 'Erreur inconnue'}`);
    }
  };

  const exportAsImagePdf = async () => {
    console.log('EmployeeMonthlyWeeklyModal: Starting PDF export as image');
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
      pdf.save(`monthly_recap_${selectedEmployeeForMonthlyRecap}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      console.log('EmployeeMonthlyWeeklyModal: PDF exported successfully as image');
    } catch (error) {
      console.error('EmployeeMonthlyWeeklyModal: PDF export failed', error);
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
              console.log('EmployeeMonthlyWeeklyModal: Closing modal via cross');
              setShowEmployeeMonthlyWeeklyModal(false);
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
                console.log('EmployeeMonthlyWeeklyModal: Closing modal via button');
                setShowEmployeeMonthlyWeeklyModal(false);
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
      <div className="modal-content">
        <button
          className="modal-close"
          onClick={() => {
            console.log('EmployeeMonthlyWeeklyModal: Closing modal via cross');
            setShowEmployeeMonthlyWeeklyModal(false);
          }}
          style={{ color: '#dc3545', fontSize: '18px' }}
        >
          ✕
        </button>
        <h3 style={{ fontFamily: 'Roboto, sans-serif', textAlign: 'center' }}>
          Récapitulatif mensuel pour {selectedEmployeeForMonthlyRecap} ({totalHours} H)
        </h3>
        <p style={{ fontFamily: 'Roboto, sans-serif', textAlign: 'center', marginBottom: '10px' }}>
          Mois de {format(new Date(selectedWeek), 'MMMM yyyy', { locale: fr })}
        </p>
        {(() => {
          const weeks = getMonthWeeks(selectedWeek);
          const dayData = [];

          weeks.forEach((week, weekIndex) => {
            const row = {
              week: getWeekRange(week),
              cavalaireHours: calculateShopWeeklyHours('CAVALAIRE', week),
              portGrimaudHours: calculateShopWeeklyHours('PORT_GRIMAUD', week),
              weekIndex
            };
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
                  <th style={{ border: '1px solid #ddd', padding: '8px', fontWeight: '700' }}>CAVALAIRE</th>
                  <th style={{ border: '1px solid #ddd', padding: '8px', fontWeight: '700' }}>PORT GRIMAUD</th>
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
                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>{data.cavalaireHours > 0 ? data.cavalaireHours + ' H' : ''}</td>
                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>{data.portGrimaudHours > 0 ? data.portGrimaudHours + ' H' : ''}</td>
                  </tr>
                ))}
                <tr style={{ backgroundColor: '#f0f0f0', fontWeight: '700' }}>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>Total mois CAVALAIRE</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{calculateShopMonthlyHours('CAVALAIRE')} H</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}></td>
                </tr>
                <tr style={{ backgroundColor: '#f0f0f0', fontWeight: '700' }}>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>Total mois PORT GRIMAUD</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}></td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{calculateShopMonthlyHours('PORT_GRIMAUD')} H</td>
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
              console.log('EmployeeMonthlyWeeklyModal: Closing modal via button');
              setShowEmployeeMonthlyWeeklyModal(false);
            }}
          >
            Fermer
          </Button>
        </div>
      </div>
    </div>
  );
};

export default EmployeeMonthlyWeeklyModal;