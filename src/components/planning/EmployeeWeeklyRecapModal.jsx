import React from 'react';
import { format, addDays, startOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import Button from '../common/Button';
import HtmlExportButton from '../common/HtmlExportButton';
import { calculateEmployeeDailyHours, formatWorkedHoursForDisplay, formatWorkedHoursNbNotation } from '../../utils/planningUtils';
import { getSlotEndTimeFormatted } from '../../utils/slotDurationUtils';
import { exportModalContentFromButtonAsLandscape } from '../../utils/htmlLandscapeExport';
import '@/assets/styles.css';

const isSelectedSlot = (value) => value === true || value === 1 || value === '1' || value === 'true';

const EmployeeWeeklyRecapModal = ({
  showEmployeeWeeklyRecap,
  setShowEmployeeWeeklyRecap,
  config,
  selectedShop,
  selectedWeek,
  selectedEmployeeForWeeklyRecap,
  shops,
  employees,
  planningData
}) => {
  console.log('EmployeeWeeklyRecapModal: Rendered with props', {
    showEmployeeWeeklyRecap,
    selectedShop,
    selectedWeek,
    selectedEmployeeForWeeklyRecap,
    shops,
    config: config ? { timeSlotsLength: config.timeSlots?.length } : null
  });

  // Si la modale ne doit pas être affichée, ne rien rendre
  if (!showEmployeeWeeklyRecap) {
    return null;
  }

  // Fonction pour obtenir le nom de l'employé
  const getEmployeeName = (employeeId) => {
    if (!employees || !Array.isArray(employees)) return employeeId;
    const employee = employees.find(emp => emp.id === employeeId || emp === employeeId);
    return employee ? (employee.name || employee) : employeeId;
  };

  const employeeName = getEmployeeName(selectedEmployeeForWeeklyRecap);

  // Obtenir le lundi de la semaine
  const mondayOfWeek = startOfWeek(new Date(selectedWeek), { weekStartsOn: 1 });

  // Obtenir les données de planning pour cet employé (toutes les boutiques)
  const getEmployeePlanning = () => {
    // Récupérer les données de toutes les boutiques
    const allPlanning = {};
    
    if (planningData?.shops) {
      for (const shop of planningData.shops) {
        if (shop.weeks?.[selectedWeek]?.planning?.[selectedEmployeeForWeeklyRecap]) {
          const shopPlanning = shop.weeks[selectedWeek].planning[selectedEmployeeForWeeklyRecap];
          
          // Fusionner les données de chaque boutique
          for (const day in shopPlanning) {
            if (!allPlanning[day]) {
              allPlanning[day] = shopPlanning[day];
            } else if (Array.isArray(shopPlanning[day]) && Array.isArray(allPlanning[day])) {
              // Si c'est un tableau (créneaux horaires), fusionner avec OU logique
              allPlanning[day] = allPlanning[day].map((slot, index) => 
                slot || shopPlanning[day][index]
              );
            }
            // Si c'est une chaîne (statut), la première trouvée est conservée
          }
        }
      }
    }
    
    return allPlanning;
  };

  const employeePlanning = getEmployeePlanning();

  const formatShopDisplayName = (shop) =>
    shop?.name?.replace(/[-_]/g, ' ').toUpperCase() || shop?.name || '-';

  const computeWorkHoursFromDayPlanning = (dayPlanning, shopConfig, employeeId, dayKey) => {
    const timeSlots = shopConfig?.timeSlots || [];

    if (typeof dayPlanning === 'string') {
      return {
        status: dayPlanning,
        entry: null,
        pause: null,
        return: null,
        exit: null,
        hours: 0,
        isOff: true
      };
    }

    if (!Array.isArray(dayPlanning) || !timeSlots.length || dayPlanning.every((slot) => !isSelectedSlot(slot))) {
      return null;
    }

    const selectedSlots = [];
    for (let i = 0; i < dayPlanning.length; i++) {
      if (isSelectedSlot(dayPlanning[i]) && timeSlots[i]) {
        selectedSlots.push({ index: i, time: timeSlots[i] });
      }
    }

    if (selectedSlots.length === 0) return null;

    selectedSlots.sort((a, b) => a.index - b.index);

    const entry = selectedSlots[0].time;
    const lastSlotIndex = selectedSlots[selectedSlots.length - 1].index;
    const exit = getSlotEndTimeFormatted(timeSlots, lastSlotIndex, shopConfig);

    let pause = null;
    let returnTime = null;

    for (let i = 0; i < selectedSlots.length - 1; i++) {
      const currentIndex = selectedSlots[i].index;
      const nextIndex = selectedSlots[i + 1].index;
      if (nextIndex > currentIndex + 1) {
        pause = getSlotEndTimeFormatted(timeSlots, currentIndex, shopConfig);
        returnTime = timeSlots[nextIndex];
        break;
      }
    }

    const hours = calculateEmployeeDailyHours(
      employeeId,
      dayKey,
      { [employeeId]: { [dayKey]: dayPlanning } },
      shopConfig
    );

    return { entry, pause, return: returnTime, exit, hours, status: null, isOff: false };
  };

  /** Toutes les plages travaillées du jour (une entrée par boutique). */
  const getDayWorkSegments = (dayIndex) => {
    const dayKey = format(addDays(mondayOfWeek, dayIndex), 'yyyy-MM-dd');
    const segments = [];

    if (!planningData?.shops?.length) {
      const fallback = employeePlanning[dayKey];
      const computed = computeWorkHoursFromDayPlanning(
        fallback,
        config,
        selectedEmployeeForWeeklyRecap,
        dayKey
      );
      if (computed) {
        segments.push({ shopName: '-', ...computed });
      }
      return segments;
    }

    for (const shop of planningData.shops) {
      const dayPlanning =
        shop.weeks?.[selectedWeek]?.planning?.[selectedEmployeeForWeeklyRecap]?.[dayKey];
      if (dayPlanning === undefined || dayPlanning === null) continue;

      const computed = computeWorkHoursFromDayPlanning(
        dayPlanning,
        shop.config || config,
        selectedEmployeeForWeeklyRecap,
        dayKey
      );
      if (!computed) continue;

      segments.push({
        shopName: formatShopDisplayName(shop),
        ...computed
      });
    }

    return segments;
  };

  const getDayName = (dayIndex) => {
    const day = addDays(mondayOfWeek, dayIndex);
    return format(day, 'EEEE', { locale: fr });
  };

  const buildWeekDisplayRows = () => {
    const rows = [];
    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const dayName = getDayName(dayIndex);
      const dayDate = format(addDays(mondayOfWeek, dayIndex), 'dd/MM', { locale: fr });
      const segments = getDayWorkSegments(dayIndex);

      if (!segments.length) {
        rows.push({
          key: `day-${dayIndex}-empty`,
          dayLabel: `${dayName} ${dayDate}`,
          shopName: '-',
          status: null,
          isOff: false,
          entry: null,
          pause: null,
          return: null,
          exit: null,
          hours: 0
        });
        continue;
      }

      segments.forEach((segment, segmentIndex) => {
        rows.push({
          key: `day-${dayIndex}-shop-${segmentIndex}`,
          dayLabel: segmentIndex === 0 ? `${dayName} ${dayDate}` : `↳ ${dayName} ${dayDate}`,
          shopName: segment.shopName,
          status: segment.status || null,
          isOff: !!segment.isOff,
          entry: segment.entry,
          pause: segment.pause,
          return: segment.return,
          exit: segment.exit,
          hours: segment.hours || 0
        });
      });
    }
    return rows;
  };

  const weekDisplayRows = buildWeekDisplayRows();

  const calculateDayHours = (dayIndex) => {
    const day = format(addDays(mondayOfWeek, dayIndex), 'yyyy-MM-dd');

    if (!planningData?.shops?.length) {
      return calculateEmployeeDailyHours(
        selectedEmployeeForWeeklyRecap,
        day,
        { [selectedEmployeeForWeeklyRecap]: employeePlanning },
        config
      );
    }

    let totalHours = 0;
    for (const shop of planningData.shops) {
      const employeeSlice = shop.weeks?.[selectedWeek]?.planning?.[selectedEmployeeForWeeklyRecap];
      if (!employeeSlice?.[day]) continue;
      const shopConfig = shop.config || config;
      if (!shopConfig?.timeSlots?.length) continue;
      totalHours += calculateEmployeeDailyHours(
        selectedEmployeeForWeeklyRecap,
        day,
        { [selectedEmployeeForWeeklyRecap]: employeeSlice },
        shopConfig
      );
    }
    return totalHours;
  };

  // Calculer les heures totales de la semaine
  const calculateWeekHours = () => {
    let totalHours = 0;
    for (let i = 0; i < 7; i++) {
      totalHours += calculateDayHours(i);
    }
    return totalHours;
  };

  // Obtenir la date formatée
  const getDayDate = (dayIndex) => {
    const day = addDays(mondayOfWeek, dayIndex);
    return format(day, 'd MMMM yyyy', { locale: fr });
  };

  const exportToPDF = () => {
    console.log('EmployeeWeeklyRecapModal: Exporting to PDF');
    const doc = new jsPDF();
    doc.setFont('Helvetica', 'normal');
    const title = `Récapitulatif hebdomadaire pour ${employeeName} (${formatWorkedHoursForDisplay(calculateWeekHours())})`;
    doc.text(title, 10, 10);
    doc.text(`Semaine du ${format(mondayOfWeek, 'd MMMM', { locale: fr })} au ${format(addDays(mondayOfWeek, 6), 'd MMMM yyyy', { locale: fr })}`, 10, 20);
    doc.text(`Vue multi-boutiques - Boutique principale: ${selectedShop}`, 10, 30);
    
         const columns = ['Jour', 'Boutique', 'ENTRÉE', 'PAUSE', 'RETOUR', 'SORTIE', 'Heures effectives', 'Nb (h)'];
     const body = weekDisplayRows.map((row) => {
       const isOff = row.isOff;
       return [
         row.dayLabel,
         row.shopName,
         isOff ? (row.status || 'Congé ☀️') : (row.entry ? `${row.entry} H` : '-'),
         isOff ? '-' : (row.pause ? `${row.pause} H` : '-'),
         isOff ? '-' : (row.return ? `${row.return} H` : '-'),
         isOff ? '-' : (row.exit ? `${row.exit} H` : '-'),
         isOff ? formatWorkedHoursForDisplay(0) : formatWorkedHoursForDisplay(row.hours),
         formatWorkedHoursNbNotation(isOff ? 0 : row.hours)
       ];
     });

     body.push([
       'Total semaine',
       '',
       '',
       '',
       '',
       '',
       formatWorkedHoursForDisplay(calculateWeekHours()),
       formatWorkedHoursNbNotation(calculateWeekHours())
     ]);
    
    doc.autoTable({
      head: [columns],
      body: body,
      startY: 40,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 136, 229] }
    });
    doc.save(`weekly_recap_${employeeName}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    console.log('EmployeeWeeklyRecapModal: PDF exported successfully');
  };

  const exportToExcel = () => {
    console.log('EmployeeWeeklyRecapModal: Exporting to Excel');
         const data = weekDisplayRows.map((row) => {
       const isOff = row.isOff;
       const isSick = row.status && typeof row.status === 'string' && row.status.toLowerCase().includes('maladie');
       return {
         'Jour': row.dayLabel,
         'Boutique': row.shopName,
         'ENTRÉE': isOff ? (isSick ? 'MALADIE' : (row.status || 'Congé ☀️')) : (row.entry ? `${row.entry} H` : '-'),
         'PAUSE': isOff ? '-' : (row.pause ? `${row.pause} H` : '-'),
         'RETOUR': isOff ? '-' : (row.return ? `${row.return} H` : '-'),
         'SORTIE': isOff ? '-' : (row.exit ? `${row.exit} H` : '-'),
         'Heures effectives': isOff ? formatWorkedHoursForDisplay(0) : formatWorkedHoursForDisplay(row.hours),
         'Nb (h)': formatWorkedHoursNbNotation(isOff ? 0 : row.hours),
         'Statut': isSick ? 'MALADIE' : (isOff ? 'CONGÉ' : 'TRAVAIL')
       };
     });

     const weekTot = calculateWeekHours();
     data.push({
       'Jour': 'Total semaine',
       'Boutique': '',
       'ENTRÉE': '',
       'PAUSE': '',
       'RETOUR': '',
       'SORTIE': '',
       'Heures effectives': formatWorkedHoursForDisplay(weekTot),
       'Nb (h)': formatWorkedHoursNbNotation(weekTot),
       'Statut': ''
     });
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Récapitulatif hebdomadaire');
    XLSX.writeFile(wb, `weekly_recap_${employeeName}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    console.log('EmployeeWeeklyRecapModal: Excel exported successfully');
  };

  const exportAsImagePdf = async () => {
    console.log('EmployeeWeeklyRecapModal: Exporting to PDF as image');
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
      pdf.save(`weekly_recap_${employeeName}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      console.log('EmployeeWeeklyRecapModal: PDF exported successfully as image');
    } catch (error) {
      console.error('EmployeeWeeklyRecapModal: PDF export failed', error);
      alert(`Erreur lors de l'exportation PDF : ${error.message || 'Erreur inconnue'}`);
    }
  };

  if (!config?.timeSlots?.length) {
    return (
      <div className="modal-overlay" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
        <div className="modal-content" style={{ width: '95%', maxWidth: '1200px' }}>
          <button
            className="modal-close"
            onClick={() => {
              console.log('EmployeeWeeklyRecapModal: Closing modal via cross');
              setShowEmployeeWeeklyRecap(false);
            }}
            style={{ color: '#dc3545', fontSize: '18px' }}
          >
            ✕
          </button>
          <h3 style={{ fontFamily: 'Roboto, sans-serif', textAlign: 'center' }}>
            Erreur
          </h3>
          <p style={{ fontFamily: 'Roboto, sans-serif', textAlign: 'center', color: '#e53935' }}>
            Aucune configuration de tranches horaires disponible.
          </p>
          <div className="button-group" style={{ display: 'flex', justifyContent: 'center', marginTop: '15px' }}>
            <Button
              className="button-retour"
              onClick={() => {
                console.log('EmployeeWeeklyRecapModal: Closing modal via button');
                setShowEmployeeWeeklyRecap(false);
              }}
            >
              Fermer
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const totalHours = calculateWeekHours();

  return (
    <div className="modal-overlay" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
      <div className="modal-content" style={{ width: '95%', maxWidth: '1200px' }}>
        <button
          className="modal-close"
          onClick={() => {
            console.log('EmployeeWeeklyRecapModal: Closing modal via cross');
            setShowEmployeeWeeklyRecap(false);
          }}
          style={{ color: '#dc3545', fontSize: '18px' }}
        >
          ✕
        </button>
        <h3 style={{ fontFamily: 'Roboto, sans-serif', textAlign: 'center' }}>
          Récapitulatif hebdomadaire pour {employeeName} ({formatWorkedHoursForDisplay(totalHours)})
        </h3>
        <p style={{ fontFamily: 'Roboto, sans-serif', textAlign: 'center', marginBottom: '10px' }}>
          Semaine du {format(mondayOfWeek, 'd MMMM', { locale: fr })} au {format(addDays(mondayOfWeek, 6), 'd MMMM yyyy', { locale: fr })}
        </p>
        <p style={{ fontFamily: 'Roboto, sans-serif', textAlign: 'center', marginBottom: '20px', color: '#666' }}>
          Vue multi-boutiques - Boutique principale: {selectedShop}
        </p>
        
                 <table style={{ fontFamily: 'Roboto, sans-serif', width: '100%', borderCollapse: 'collapse' }}>
           <thead>
             <tr style={{ backgroundColor: '#f0f0f0' }}>
               <th style={{ border: '1px solid #ddd', padding: '8px', fontWeight: '700' }}>Jour</th>
               <th style={{ border: '1px solid #ddd', padding: '8px', fontWeight: '700' }}>Boutique</th>
               <th style={{ border: '1px solid #ddd', padding: '8px', fontWeight: '700' }}>ENTRÉE</th>
               <th style={{ border: '1px solid #ddd', padding: '8px', fontWeight: '700' }}>PAUSE</th>
               <th style={{ border: '1px solid #ddd', padding: '8px', fontWeight: '700' }}>RETOUR</th>
               <th style={{ border: '1px solid #ddd', padding: '8px', fontWeight: '700' }}>SORTIE</th>
               <th style={{ border: '1px solid #ddd', padding: '8px', fontWeight: '700' }}>Heures effectives</th>
               <th style={{ border: '1px solid #ddd', padding: '8px', fontWeight: '700' }}>Nb (h)</th>
             </tr>
           </thead>
           <tbody>
             {weekDisplayRows.map((row) => (
                 <tr key={row.key} style={{
                   backgroundColor: row.isOff ? '#FFF3E0' : '#E3F2FD'
                 }}>
                   <td style={{ border: '1px solid #ddd', padding: '8px', fontWeight: '600' }}>
                     {row.dayLabel}
                   </td>
                   <td style={{ border: '1px solid #ddd', padding: '8px', fontWeight: '600', textAlign: 'center' }}>
                     {row.shopName}
                   </td>
                   <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                     {row.isOff ? (
                       <span style={{ color: row.status?.toLowerCase().includes('maladie') ? '#dc3545' : '#FF9800', fontWeight: '600' }}>
                         {row.status}
                       </span>
                     ) : (
                       row.entry ? `${row.entry} H` : '-'
                     )}
                   </td>
                   <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                     {row.isOff ? '-' : (row.pause ? `${row.pause} H` : '-')}
                   </td>
                   <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                     {row.isOff ? '-' : (row.return ? `${row.return} H` : '-')}
                   </td>
                   <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                     {row.isOff ? '-' : (row.exit ? `${row.exit} H` : '-')}
                   </td>
                   <td style={{ 
                     border: '1px solid #ddd', 
                     padding: '8px', 
                     fontWeight: '600',
                     color: row.isOff ? '#FF9800' : '#333'
                   }}>
                     {row.isOff ? formatWorkedHoursForDisplay(0) : formatWorkedHoursForDisplay(row.hours)}
                   </td>
                   <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>
                     {formatWorkedHoursNbNotation(row.isOff ? 0 : row.hours)}
                   </td>
                 </tr>
               ))}
             <tr style={{ backgroundColor: '#f0f0f0', fontWeight: '700' }}>
               <td colSpan="6" style={{ border: '1px solid #ddd', padding: '8px' }}>Total semaine</td>
               <td style={{ border: '1px solid #ddd', padding: '8px' }}>{formatWorkedHoursForDisplay(totalHours)}</td>
               <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>{formatWorkedHoursNbNotation(totalHours)}</td>
             </tr>
           </tbody>
         </table>
        
        {/* Cases de signature */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          marginTop: '30px', 
          marginBottom: '20px',
          gap: '20px'
        }}>
                     {/* Signature de l'employé */}
           <div style={{ 
             flex: 1, 
             border: '2px solid #ddd', 
             borderRadius: '8px', 
             padding: '15px',
             backgroundColor: '#f9f9f9'
           }}>
             <div style={{ 
               textAlign: 'center', 
               marginBottom: '10px',
               fontWeight: '600',
               fontSize: '14px',
               color: '#333'
             }}>
               Signature de l'employé
             </div>
                          <div style={{ 
                height: '60px', 
                border: '1px dashed #ccc', 
                borderRadius: '4px',
                backgroundColor: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#999',
                fontSize: '12px'
              }}>
                
              </div>
             <div style={{ 
               textAlign: 'center', 
               marginTop: '5px',
               fontSize: '11px',
               color: '#666'
             }}>
               Date: {format(addDays(mondayOfWeek, 6), 'dd/MM/yyyy')}
             </div>
           </div>
          
                     {/* Signature du responsable */}
           <div style={{ 
             flex: 1, 
             border: '2px solid #ddd', 
             borderRadius: '8px', 
             padding: '15px',
             backgroundColor: '#f9f9f9'
           }}>
             <div style={{ 
               textAlign: 'center', 
               marginBottom: '10px',
               fontWeight: '600',
               fontSize: '14px',
               color: '#333'
             }}>
               Signature du responsable
             </div>
                          <div style={{ 
                height: '60px', 
                border: '1px dashed #ccc', 
                borderRadius: '4px',
                backgroundColor: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#999',
                fontSize: '12px'
              }}>
                
              </div>
             <div style={{ 
               textAlign: 'center', 
               marginTop: '5px',
               fontSize: '11px',
               color: '#666'
             }}>
               Date: {format(addDays(mondayOfWeek, 6), 'dd/MM/yyyy')}
             </div>
           </div>
        </div>
        
        <div className="button-group" style={{ display: 'flex', justifyContent: 'center', marginTop: '15px' }}>
          <Button className="button-pdf" onClick={() => {
            // Masquer les boutons avant l'impression
            const buttonGroup = document.querySelector('.button-group');
            const modalClose = document.querySelector('.modal-close');
            if (buttonGroup) {
              buttonGroup.style.display = 'none';
            }
            if (modalClose) {
              modalClose.style.display = 'none';
            }
            
            // Créer une nouvelle fenêtre pour l'impression
            const printWindow = window.open('', '_blank');
            const modalContent = document.querySelector('.modal-content');
            
            if (printWindow && modalContent) {
              printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                  <title>Récapitulatif hebdomadaire - ${employeeName}</title>
                  <style>
                    body {
                      font-family: 'Roboto', sans-serif;
                      margin: 0;
                      padding: 20px;
                      background-color: white;
                      color: black;
                    }
                    .print-content {
                      max-width: 100%;
                      margin: 0 auto;
                    }
                    table {
                      font-family: 'Roboto', sans-serif;
                      width: 100%;
                      border-collapse: collapse;
                      font-size: 12px;
                      font-weight: bold;
                    }
                    th, td {
                      border: 1px solid #ddd;
                      padding: 8px;
                      font-size: 11px;
                      line-height: 1.2;
                      font-weight: bold;
                    }
                    th {
                      background-color: #f0f0f0;
                      font-weight: 700;
                      font-size: 12px;
                      padding: 8px;
                    }
                    h3, p {
                      text-align: center;
                      margin: 10px 0;
                      font-weight: bold;
                    }
                    .signature-section {
                      display: flex;
                      justify-content: space-between;
                      margin-top: 30px;
                      gap: 20px;
                    }
                    .signature-box {
                      flex: 1;
                      border: 2px solid #ddd;
                      border-radius: 8px;
                      padding: 15px;
                      background-color: #f9f9f9;
                    }
                    .signature-title {
                      text-align: center;
                      margin-bottom: 10px;
                      font-weight: 600;
                      font-size: 14px;
                      color: #333;
                    }
                    .signature-area {
                      height: 60px;
                      border: 1px dashed #ccc;
                      border-radius: 4px;
                      background-color: white;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      color: #999;
                      font-size: 12px;
                    }
                    .signature-date {
                      text-align: center;
                      margin-top: 5px;
                      font-size: 11px;
                      color: #666;
                    }
                    @page {
                      margin: 10mm;
                      size: A4 portrait;
                    }
                  </style>
                </head>
                <body>
                  <div class="print-content">
                    ${modalContent.innerHTML}
                  </div>
                </body>
                </html>
              `);
              
              printWindow.document.close();
              printWindow.focus();
              
              // Attendre que le contenu soit chargé puis imprimer
              printWindow.onload = function() {
                printWindow.print();
                printWindow.close();
              };
            } else {
              // Fallback si la nouvelle fenêtre échoue
              window.print();
            }
            
            // Remettre les boutons après l'impression
            setTimeout(() => {
              if (buttonGroup) {
                buttonGroup.style.display = 'flex';
              }
              if (modalClose) {
                modalClose.style.display = 'block';
              }
            }, 1000);
          }}>
            Imprimer
          </Button>
          <HtmlExportButton
            onClick={(e) => {
              exportModalContentFromButtonAsLandscape({
                triggerElement: e.currentTarget,
                title: `Récapitulatif hebdomadaire - ${employeeName}`,
                metaLines: [
                  `Semaine du ${format(new Date(selectedWeek), 'dd/MM', { locale: fr })}`,
                ],
                filename: `weekly_recap_${employeeName}_${format(new Date(), 'yyyy-MM-dd')}.html`,
              });
            }}
          />
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
              console.log('EmployeeWeeklyRecapModal: Closing modal via button');
              setShowEmployeeWeeklyRecap(false);
            }}
          >
            Fermer
          </Button>
        </div>
      </div>
    </div>
  );
};

export default EmployeeWeeklyRecapModal; 
