import React from 'react';
import { format, addDays, startOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import Button from '../common/Button';
import { calculateEmployeeDailyHours } from '../../utils/planningUtils';
import '@/assets/styles.css';

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

  // Obtenir les données de planning pour cet employé
  const getEmployeePlanning = () => {
    const shopData = planningData?.shops?.find(s => s.id === selectedShop);
    if (!shopData?.weeks?.[selectedWeek]) return {};
    
    const weekData = shopData.weeks[selectedWeek];
    return weekData.planning || {};
  };

  const employeePlanning = getEmployeePlanning();

  // Calculer les heures totales de la semaine
  const calculateWeekHours = () => {
    let totalHours = 0;
    for (let i = 0; i < 7; i++) {
      const day = format(addDays(mondayOfWeek, i), 'yyyy-MM-dd');
      const hours = calculateEmployeeDailyHours(selectedEmployeeForWeeklyRecap, day, employeePlanning, config);
      totalHours += hours;
    }
    return totalHours.toFixed(1);
  };

  // Obtenir les noms des jours
  const getDayName = (dayIndex) => {
    const day = addDays(mondayOfWeek, dayIndex);
    return format(day, 'EEEE', { locale: fr });
  };

  // Obtenir la date formatée
  const getDayDate = (dayIndex) => {
    const day = addDays(mondayOfWeek, dayIndex);
    return format(day, 'd MMMM yyyy', { locale: fr });
  };

  // Vérifier si un créneau est sélectionné
  const isSlotSelected = (dayIndex, slotIndex) => {
    const day = format(addDays(mondayOfWeek, dayIndex), 'yyyy-MM-dd');
    const dayPlanning = employeePlanning[selectedEmployeeForWeeklyRecap]?.[day];
    return dayPlanning && dayPlanning[slotIndex];
  };

  // Calculer les heures d'un jour
  const calculateDayHours = (dayIndex) => {
    const day = format(addDays(mondayOfWeek, dayIndex), 'yyyy-MM-dd');
    return calculateEmployeeDailyHours(selectedEmployeeForWeeklyRecap, day, employeePlanning, config);
  };

  // Vérifier si un jour est en congé (aucun créneau sélectionné)
  const isDayOff = (dayIndex) => {
    const day = format(addDays(mondayOfWeek, dayIndex), 'yyyy-MM-dd');
    const dayPlanning = employeePlanning[selectedEmployeeForWeeklyRecap]?.[day];
    return !dayPlanning || dayPlanning.every(slot => !slot);
  };

  // Calculer les heures de travail pour un jour
  const calculateWorkHours = (dayIndex) => {
    if (isDayOff(dayIndex)) return { entry: null, pause: null, return: null, exit: null, hours: 0 };
    
    const day = format(addDays(mondayOfWeek, dayIndex), 'yyyy-MM-dd');
    const dayPlanning = employeePlanning[selectedEmployeeForWeeklyRecap]?.[day];
    
    if (!dayPlanning || dayPlanning.every(slot => !slot)) {
      return { entry: null, pause: null, return: null, exit: null, hours: 0 };
    }
    
    // Trouver les créneaux sélectionnés
    const selectedSlots = [];
    for (let i = 0; i < dayPlanning.length; i++) {
      if (dayPlanning[i]) {
        selectedSlots.push({
          index: i,
          time: config.timeSlots[i]
        });
      }
    }
    
    if (selectedSlots.length === 0) return { entry: null, pause: null, return: null, exit: null, hours: 0 };
    
    // Trier par index pour avoir l'ordre chronologique
    selectedSlots.sort((a, b) => a.index - b.index);
    
    const entry = selectedSlots[0].time;
    
    // Calculer l'heure de fin (dernier créneau + intervalle)
    const lastSlotIndex = selectedSlots[selectedSlots.length - 1].index;
    const lastTime = config.timeSlots[lastSlotIndex];
    const interval = config.interval || 30;
    const lastTimeDate = new Date(`2000-01-01T${lastTime}:00`);
    const endTimeDate = new Date(lastTimeDate.getTime() + interval * 60 * 1000);
    const exit = format(endTimeDate, 'HH:mm');
    
    // Détecter les pauses (gaps dans les créneaux sélectionnés)
    let pause = null;
    let returnTime = null;
    
    for (let i = 0; i < selectedSlots.length - 1; i++) {
      const currentIndex = selectedSlots[i].index;
      const nextIndex = selectedSlots[i + 1].index;
      
      // Si il y a un gap entre les créneaux sélectionnés
      if (nextIndex > currentIndex + 1) {
        // L'heure de pause est l'heure de fin du créneau actuel
        const currentTime = config.timeSlots[currentIndex];
        const currentTimeDate = new Date(`2000-01-01T${currentTime}:00`);
        const pauseTimeDate = new Date(currentTimeDate.getTime() + interval * 60 * 1000);
        pause = format(pauseTimeDate, 'HH:mm');
        
        // L'heure de retour est l'heure de début du prochain créneau
        returnTime = config.timeSlots[nextIndex];
        break;
      }
    }
    
    return { entry, pause, return: returnTime, exit, hours: calculateDayHours(dayIndex) };
  };

  const exportToPDF = () => {
    console.log('EmployeeWeeklyRecapModal: Exporting to PDF');
    const doc = new jsPDF();
    doc.setFont('Helvetica', 'normal');
    const title = `Récapitulatif hebdomadaire pour ${employeeName} (${calculateWeekHours()} H)`;
    doc.text(title, 10, 10);
    doc.text(`Semaine du ${format(mondayOfWeek, 'd MMMM', { locale: fr })} au ${format(addDays(mondayOfWeek, 6), 'd MMMM yyyy', { locale: fr })}`, 10, 20);
    doc.text(`Boutique: ${selectedShop}`, 10, 30);
    
         const columns = ['Jour', 'ENTRÉE', 'PAUSE', 'RETOUR', 'SORTIE', 'Heures effectives'];
     const body = [];
     
     for (let i = 0; i < 7; i++) {
       const dayName = getDayName(i);
       const dayDate = format(addDays(mondayOfWeek, i), 'dd/MM', { locale: fr });
       const isOff = isDayOff(i);
       const workHours = calculateWorkHours(i);
       
       body.push([
         `${dayName} ${dayDate}`,
         isOff ? 'Congé' : (workHours.entry ? `${workHours.entry} H` : '-'),
         isOff ? '-' : (workHours.pause ? `${workHours.pause} H` : '-'),
         isOff ? '-' : (workHours.return ? `${workHours.return} H` : '-'),
         isOff ? '-' : (workHours.exit ? `${workHours.exit} H` : '-'),
         isOff ? '0.0 h' : `${workHours.hours} h`
       ]);
     }
    
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
         const data = [];
     
     for (let i = 0; i < 7; i++) {
       const dayName = getDayName(i);
       const dayDate = format(addDays(mondayOfWeek, i), 'dd/MM', { locale: fr });
       const isOff = isDayOff(i);
       const workHours = calculateWorkHours(i);
       
       data.push({
         'Jour': `${dayName} ${dayDate}`,
         'ENTRÉE': isOff ? 'Congé' : (workHours.entry ? `${workHours.entry} H` : '-'),
         'PAUSE': isOff ? '-' : (workHours.pause ? `${workHours.pause} H` : '-'),
         'RETOUR': isOff ? '-' : (workHours.return ? `${workHours.return} H` : '-'),
         'SORTIE': isOff ? '-' : (workHours.exit ? `${workHours.exit} H` : '-'),
         'Heures effectives': isOff ? '0.0 h' : `${workHours.hours} h`
       });
     }
    
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
          Récapitulatif hebdomadaire pour {employeeName} ({totalHours} H)
        </h3>
        <p style={{ fontFamily: 'Roboto, sans-serif', textAlign: 'center', marginBottom: '10px' }}>
          Semaine du {format(mondayOfWeek, 'd MMMM', { locale: fr })} au {format(addDays(mondayOfWeek, 6), 'd MMMM yyyy', { locale: fr })}
        </p>
        <p style={{ fontFamily: 'Roboto, sans-serif', textAlign: 'center', marginBottom: '20px', color: '#666' }}>
          Boutique: {selectedShop}
        </p>
        
                 <table style={{ fontFamily: 'Roboto, sans-serif', width: '100%', borderCollapse: 'collapse' }}>
           <thead>
             <tr style={{ backgroundColor: '#f0f0f0' }}>
               <th style={{ border: '1px solid #ddd', padding: '8px', fontWeight: '700' }}>Jour</th>
               <th style={{ border: '1px solid #ddd', padding: '8px', fontWeight: '700' }}>ENTRÉE</th>
               <th style={{ border: '1px solid #ddd', padding: '8px', fontWeight: '700' }}>PAUSE</th>
               <th style={{ border: '1px solid #ddd', padding: '8px', fontWeight: '700' }}>RETOUR</th>
               <th style={{ border: '1px solid #ddd', padding: '8px', fontWeight: '700' }}>SORTIE</th>
               <th style={{ border: '1px solid #ddd', padding: '8px', fontWeight: '700' }}>Heures effectives</th>
             </tr>
           </thead>
           <tbody>
             {Array.from({ length: 7 }, (_, i) => {
               const dayName = getDayName(i);
               const dayDate = format(addDays(mondayOfWeek, i), 'dd/MM', { locale: fr });
               const isOff = isDayOff(i);
               const workHours = calculateWorkHours(i);
               
               // Couleurs alternées pour les jours
               const pastelColors = [
                 '#E3F2FD', // Light Blue
                 '#E8F5E8', // Light Green
                 '#FFEBEE', // Light Red
                 '#E3F2FD', // Light Blue
                 '#F3E5F5', // Light Purple
                 '#FFF8E1', // Light Yellow
                 '#E3F2FD'  // Light Blue
               ];
               
               return (
                 <tr key={i} style={{
                   backgroundColor: isOff ? '#FFF3E0' : pastelColors[i % pastelColors.length]
                 }}>
                   <td style={{ border: '1px solid #ddd', padding: '8px', fontWeight: '600' }}>
                     {dayName} {dayDate}
                   </td>
                   <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                     {isOff ? (
                       <span style={{ color: '#FF9800', fontWeight: '600' }}>
                         Congé ☀️
                       </span>
                     ) : (
                       workHours.entry ? `${workHours.entry} H` : '-'
                     )}
                   </td>
                   <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                     {isOff ? '-' : (workHours.pause ? `${workHours.pause} H` : '-')}
                   </td>
                   <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                     {isOff ? '-' : (workHours.return ? `${workHours.return} H` : '-')}
                   </td>
                   <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                     {isOff ? '-' : (workHours.exit ? `${workHours.exit} H` : '-')}
                   </td>
                   <td style={{ 
                     border: '1px solid #ddd', 
                     padding: '8px', 
                     fontWeight: '600',
                     color: isOff ? '#FF9800' : '#333'
                   }}>
                     {isOff ? '0.0 h' : `${workHours.hours} h`}
                   </td>
                 </tr>
               );
             })}
             <tr style={{ backgroundColor: '#f0f0f0', fontWeight: '700' }}>
               <td colSpan="5" style={{ border: '1px solid #ddd', padding: '8px' }}>Total semaine</td>
               <td style={{ border: '1px solid #ddd', padding: '8px' }}>{totalHours} h</td>
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
              {employeeName}
            </div>
            <div style={{ 
              textAlign: 'center', 
              marginTop: '5px',
              fontSize: '11px',
              color: '#666'
            }}>
              Date: {format(new Date(), 'dd/MM/yyyy')}
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
              Responsable {selectedShop}
            </div>
            <div style={{ 
              textAlign: 'center', 
              marginTop: '5px',
              fontSize: '11px',
              color: '#666'
            }}>
              Date: {format(new Date(), 'dd/MM/yyyy')}
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