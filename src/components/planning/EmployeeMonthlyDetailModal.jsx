import React, { useCallback } from 'react';
import { format, addDays, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { fr } from 'date-fns/locale';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { loadXlsx } from '../../utils/xlsxLoader';
import html2canvas from 'html2canvas';
import Button from '../common/Button';
import HtmlExportButton from '../common/HtmlExportButton';
import { calculateEmployeeDailyHours, formatWorkedHoursForDisplay, formatWorkedHoursNbNotation } from '../../utils/planningUtils';
import { getSlotEndTimeFormatted } from '../../utils/slotDurationUtils';
import { exportModalContentFromButtonAsLandscape } from '../../utils/htmlLandscapeExport';
import '@/assets/styles.css';

const EmployeeMonthlyDetailModal = ({ 
  showEmployeeMonthlyDetail,
  setShowEmployeeMonthlyDetail,
  config, 
  selectedShop,
  selectedWeek,
  selectedEmployeeForMonthlyDetail,
  shops,
  employees,
  planningData,
  forceRefresh,
  onForceRefresh
}) => {
  // État pour forcer le rafraîchissement des données
  const [localForceRefresh, setLocalForceRefresh] = React.useState(0);
  
  console.log('EmployeeMonthlyDetailModal: Rendered with props', {
    showEmployeeMonthlyDetail,
    selectedShop,
    selectedWeek,
    selectedEmployeeForMonthlyDetail,
    shops,
    config: config ? { timeSlotsLength: config.timeSlots?.length } : null
  });

  // Si la modale ne doit pas être affichée, ne rien rendre
  if (!showEmployeeMonthlyDetail) {
    return null;
  }

  // Fonction pour obtenir le nom de l'employé
  const getEmployeeName = (employeeId) => {
    if (!employees || !Array.isArray(employees)) return employeeId;
    const employee = employees.find(emp => emp.id === employeeId || emp === employeeId);
    return employee ? (employee.name || employee) : employeeId;
  };

  const employeeName = getEmployeeName(selectedEmployeeForMonthlyDetail);

  // Obtenir le premier et dernier jour du mois de la semaine sélectionnée
  const weekDate = new Date(selectedWeek);
  const firstDayOfMonth = startOfMonth(weekDate);
  const lastDayOfMonth = endOfMonth(weekDate);

  // Obtenir tous les jours du mois
  const allDaysOfMonth = eachDayOfInterval({ start: firstDayOfMonth, end: lastDayOfMonth });

  // Obtenir les boutiques où l'employé a des données de planning
  const getEmployeeShops = () => {
    if (!planningData?.shops) return [];
    
    const employeeShops = new Map();
    planningData.shops.forEach(shop => {
      if (shop.weeks) {
        // Vérifier si l'employé a des données de planning avec des créneaux sélectionnés dans cette boutique
        let hasPlanningData = false;
        Object.keys(shop.weeks).forEach(weekKey => {
          const weekData = shop.weeks[weekKey];
          if (weekData.planning && weekData.planning[selectedEmployeeForMonthlyDetail]) {
            // Vérifier si l'employé a des créneaux sélectionnés dans cette semaine
            Object.keys(weekData.planning[selectedEmployeeForMonthlyDetail]).forEach(dayStr => {
              const slots = weekData.planning[selectedEmployeeForMonthlyDetail][dayStr];
              if (Array.isArray(slots) && slots.some(slot => slot === true)) {
                hasPlanningData = true;
              }

            });
          }
        });
        
        if (hasPlanningData) {
          employeeShops.set(shop.id, shop.name || shop.id);
        }
      }
    });
    
    return Array.from(employeeShops.entries()).map(([id, name]) => ({ id, name }));
  };

     const employeeShops = getEmployeeShops();

  

  // Obtenir les données de planning pour cet employé (toutes les boutiques)
  const getAllEmployeePlanning = useCallback(() => {
    const allPlanning = {};
    
    if (!planningData?.shops || !Array.isArray(planningData.shops)) {
      console.warn('Invalid planningData or shops in EmployeeMonthlyDetailModal');
      return allPlanning;
    }
    
    
    
    planningData.shops.forEach(shop => {
      if (shop && shop.weeks && typeof shop.weeks === 'object') {
        Object.keys(shop.weeks).forEach(weekKey => {
          const weekData = shop.weeks[weekKey];
          if (weekData && weekData.planning && weekData.planning[selectedEmployeeForMonthlyDetail]) {
            // Ajouter l'ID de la boutique aux données pour TOUS les jours du mois
            Object.keys(weekData.planning[selectedEmployeeForMonthlyDetail]).forEach(dayStr => {
              // Vérifier que le jour appartient au mois en cours
              const dayDate = new Date(dayStr);
              const monthStart = startOfMonth(new Date(selectedWeek));
              const monthEnd = endOfMonth(new Date(selectedWeek));
              
              if (dayDate >= monthStart && dayDate <= monthEnd) {
                const slots = weekData.planning[selectedEmployeeForMonthlyDetail][dayStr];
                
                // Inclure TOUS les jours, même ceux sans créneaux sélectionnés
                if (!allPlanning[dayStr]) {
                  allPlanning[dayStr] = {};
                }
                
                                 // Si c'est un statut (string), l'inclure directement
                 if (typeof slots === 'string') {
                   allPlanning[dayStr][shop.id] = slots;
                 } 
                // Si c'est un tableau, l'inclure même s'il n'y a pas de créneaux sélectionnés
                else if (Array.isArray(slots)) {
                  allPlanning[dayStr][shop.id] = slots;
                }
              }
            });
          }
        });
      }
    });
    
    
    return allPlanning;
  }, [planningData, selectedEmployeeForMonthlyDetail, selectedWeek, localForceRefresh, forceRefresh]);

  // FORCER LE RECALCUL À CHAQUE RENDU POUR ÉVITER LE CACHE
  const allEmployeePlanning = React.useMemo(() => {
    return getAllEmployeePlanning();
  }, [getAllEmployeePlanning, localForceRefresh, planningData, forceRefresh]);

  // Calculer les heures totales du mois (toutes boutiques)
  const calculateTotalMonthHours = () => {
    let totalHours = 0;
    allDaysOfMonth.forEach(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayPlanning = allEmployeePlanning[dayStr];
      if (dayPlanning) {
        Object.keys(dayPlanning).forEach(shopId => {
          const hours = calculateEmployeeDailyHours(selectedEmployeeForMonthlyDetail, dayStr, { [selectedEmployeeForMonthlyDetail]: { [dayStr]: dayPlanning[shopId] } }, config);
          totalHours += hours;
        });
      }
    });
    return totalHours;
  };

  // Calculer les heures par boutique
  const calculateShopHours = (shopId) => {
    let totalHours = 0;
    allDaysOfMonth.forEach(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayPlanning = allEmployeePlanning[dayStr];
      if (dayPlanning && dayPlanning[shopId]) {
        const hours = calculateEmployeeDailyHours(selectedEmployeeForMonthlyDetail, dayStr, { [selectedEmployeeForMonthlyDetail]: { [dayStr]: dayPlanning[shopId] } }, config);
        totalHours += hours;
      }
    });
    return totalHours;
  };

  // Calculer les heures pour la boutique sélectionnée uniquement (pour les statistiques)
  const calculateSelectedShopHours = () => {
    if (!selectedShop) return 0;
    return calculateShopHours(selectedShop);
  };

  // Calculer les heures d'un jour pour la boutique sélectionnée uniquement
  const calculateDayHoursForSelectedShop = (date) => {
    if (!selectedShop) return 0;
    
    const dayStr = format(date, 'yyyy-MM-dd');
    const dayPlanning = allEmployeePlanning[dayStr];
    
    if (!dayPlanning || !dayPlanning[selectedShop]) {
      return 0;
    }
    
    const hours = calculateEmployeeDailyHours(selectedEmployeeForMonthlyDetail, dayStr, { [selectedEmployeeForMonthlyDetail]: { [dayStr]: dayPlanning[selectedShop] } }, config);
    return hours;
  };

  // Obtenir le nom du jour
  const getDayName = (date) => {
    return format(date, 'EEEE', { locale: fr });
  };

  // Obtenir la boutique pour un jour donné
  const getShopForDay = (date) => {
    const dayStr = format(date, 'yyyy-MM-dd');
    const dayPlanning = allEmployeePlanning[dayStr];
    if (!dayPlanning) return null;
    
    // Retourner la première boutique trouvée (normalement une seule par jour)
    const shopId = Object.keys(dayPlanning)[0];
    return shopId ? employeeShops.find(s => s.id === shopId) : null;
  };

  // Obtenir toutes les boutiques pour un jour donné (pour les employés multi-boutiques)
  const getAllShopsForDay = (date) => {
    const dayStr = format(date, 'yyyy-MM-dd');
    const dayPlanning = allEmployeePlanning[dayStr];
    if (!dayPlanning) return [];
    
    // Ne retourner que les boutiques avec des données réelles (statut ou horaires)
    return Object.keys(dayPlanning).map(shopId => {
      const shopData = dayPlanning[shopId];
      const hasData = typeof shopData === 'string' || (Array.isArray(shopData) && shopData.some(slot => slot === true));
      
      if (hasData) {
        return employeeShops.find(s => s.id === shopId);
      }
      return null;
    }).filter(Boolean);
  };

  // Vérifier si un créneau est sélectionné
  const isSlotSelected = (date, slotIndex) => {
    const dayStr = format(date, 'yyyy-MM-dd');
    const dayPlanning = allEmployeePlanning[dayStr];
    if (!dayPlanning) return false;
    
    // Vérifier dans toutes les boutiques du jour
    return Object.values(dayPlanning).some(slots => {
      return slots && Array.isArray(slots) && slots[slotIndex];
    });
  };

  // Vérifier si un créneau est sélectionné dans la boutique sélectionnée
  const isSlotSelectedInSelectedShop = (date, slotIndex) => {
    if (!selectedShop) return false;
    
    const dayStr = format(date, 'yyyy-MM-dd');
    const dayPlanning = allEmployeePlanning[dayStr];
    if (!dayPlanning || !dayPlanning[selectedShop]) return false;
    
    const slots = dayPlanning[selectedShop];
    if (typeof slots === 'string') return false;
    return slots && Array.isArray(slots) && slots[slotIndex];
  };

  // Calculer les heures d'un jour (boutique sélectionnée uniquement)
  const calculateDayHours = (date) => {
    return calculateDayHoursForSelectedShop(date);
  };

  // Vérifier si un jour est en congé (aucun créneau sélectionné dans la boutique sélectionnée)
  const isDayOff = (date) => {
    if (!selectedShop) return false;
    
    const dayStr = format(date, 'yyyy-MM-dd');
    const dayPlanning = allEmployeePlanning[dayStr];
    
    if (!dayPlanning || !dayPlanning[selectedShop]) {
      return false; // Pas de données = pas automatiquement un congé
    }
    
    const slots = dayPlanning[selectedShop];
    if (typeof slots === 'string') return true; // Statut (Congé, Maladie)
    return Array.isArray(slots) && slots.every(slot => !slot); // Aucun créneau sélectionné
  };

  // Calculer les heures de travail pour un jour (boutique sélectionnée uniquement)
  const calculateWorkHours = (date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const selectedSlots = [];
    
    // Récupérer tous les créneaux sélectionnés pour cette date dans la boutique sélectionnée
    config.timeSlots.forEach((time, index) => {
      if (isSlotSelectedInSelectedShop(date, index)) {
        selectedSlots.push({ time, index });
      }
    });
    
    if (selectedSlots.length === 0) return { entry: null, pause: null, return: null, exit: null, hours: 0 };
    
    // Trier par index pour avoir l'ordre chronologique
    selectedSlots.sort((a, b) => a.index - b.index);
    
    const entry = selectedSlots[0].time;
    const lastSelected = selectedSlots[selectedSlots.length - 1];
    const exit = getSlotEndTimeFormatted(config.timeSlots, lastSelected.index, config);
    
    // Détecter les pauses (gaps dans les créneaux sélectionnés)
    let pause = null;
    let returnTime = null;
    
    for (let i = 0; i < selectedSlots.length - 1; i++) {
      const currentIndex = selectedSlots[i].index;
      const nextIndex = selectedSlots[i + 1].index;
      
      // Si il y a un gap de plus d'un créneau, c'est une pause
      if (nextIndex - currentIndex > 1) {
        pause = getSlotEndTimeFormatted(config.timeSlots, currentIndex, config);
        returnTime = config.timeSlots[nextIndex];
        break;
      }
    }
    
    // Calculer le total des heures
    const hours = calculateDayHoursForSelectedShop(date);
    
    return { entry, pause, return: returnTime, exit, hours };
  };

  // Calculer les heures de travail pour un jour et une boutique spécifique
  const calculateWorkHoursForShop = (date, shopId) => {
    const dayStr = format(date, 'yyyy-MM-dd');
    const dayPlanning = allEmployeePlanning[dayStr];
    
    if (!dayPlanning || !dayPlanning[shopId]) {
      return { entry: null, pause: null, return: null, exit: null, hours: 0 };
    }
    
    const slots = dayPlanning[shopId];
    if (typeof slots === 'string') {
      return { entry: null, pause: null, return: null, exit: null, hours: 0 };
    }
    
    const selectedSlots = [];
    
    // Récupérer tous les créneaux sélectionnés pour cette date dans cette boutique
    config.timeSlots.forEach((time, index) => {
      if (slots && Array.isArray(slots) && slots[index]) {
        selectedSlots.push({ time, index });
      }
    });
    
    if (selectedSlots.length === 0) return { entry: null, pause: null, return: null, exit: null, hours: 0 };
    
    // Trier par index pour avoir l'ordre chronologique
    selectedSlots.sort((a, b) => a.index - b.index);
    
    const entry = selectedSlots[0].time;
    const lastSelected = selectedSlots[selectedSlots.length - 1];
    const exit = getSlotEndTimeFormatted(config.timeSlots, lastSelected.index, config);
    
    // Détecter les pauses (gaps dans les créneaux sélectionnés)
    let pause = null;
    let returnTime = null;
    
    for (let i = 0; i < selectedSlots.length - 1; i++) {
      const currentIndex = selectedSlots[i].index;
      const nextIndex = selectedSlots[i + 1].index;
      
      // Si il y a un gap de plus d'un créneau, c'est une pause
      if (nextIndex - currentIndex > 1) {
        pause = getSlotEndTimeFormatted(config.timeSlots, currentIndex, config);
        returnTime = config.timeSlots[nextIndex];
        break;
      }
    }
    
    // Calculer le total des heures pour cette boutique
    const hours = calculateEmployeeDailyHours(selectedEmployeeForMonthlyDetail, dayStr, { [selectedEmployeeForMonthlyDetail]: { [dayStr]: slots } }, config);
    
    return { entry, pause, return: returnTime, exit, hours };
  };

  // Vérifier si un jour est en congé pour une boutique spécifique
  const isDayOffForShop = (date, shopId) => {
    const dayStr = format(date, 'yyyy-MM-dd');
    const dayPlanning = allEmployeePlanning[dayStr];
    
    if (!dayPlanning || !dayPlanning[shopId]) {
      return false; // Pas de données = pas automatiquement un congé
    }
    
    const slots = dayPlanning[shopId];
    if (typeof slots === 'string') return true; // Statut (Congé, Maladie)
    return Array.isArray(slots) && slots.every(slot => !slot); // Aucun créneau sélectionné
  };

  const exportToPDF = () => {
    console.log('EmployeeMonthlyDetailModal: Exporting to PDF');
    const doc = new jsPDF();
    doc.setFont('Helvetica', 'normal');
    
    // Titre avec la boutique sélectionnée
    const selectedShopName = shops.find(s => s.id === selectedShop)?.name || selectedShop;
    const title = `Récapitulatif mensuel détaillé pour ${employeeName} - ${selectedShopName}`;
    doc.text(title, 10, 10);
    doc.text(`Mois de ${format(firstDayOfMonth, 'MMMM yyyy', { locale: fr })}`, 10, 20);
    doc.text(`Total boutique: ${formatWorkedHoursForDisplay(calculateSelectedShopHours())}`, 10, 30);
    
    const columns = ['Jour', 'ENTRÉE', 'PAUSE', 'RETOUR', 'SORTIE', 'Heures', 'Nb (h)'];
    const body = [];
    
    // Grouper les jours par semaine
    const weeks = {};
    allDaysOfMonth.forEach((date, index) => {
      const weekNumber = getWeekOfDate(date);
      if (!weeks[weekNumber]) {
        weeks[weekNumber] = [];
      }
      weeks[weekNumber].push({ date, index });
    });
    
    Object.keys(weeks).sort((a, b) => parseInt(a) - parseInt(b)).forEach(weekNumber => {
      const weekDays = weeks[weekNumber];
      const weekTitle = getWeekTitle(weekDays[0].date);
      
      // Ligne d'en-tête de semaine
      body.push([weekTitle, '', '', '', '', '', '', '']);
      
             // Jours de la semaine
       weekDays.forEach(({ date }) => {
         const dayName = getDayName(date);
         const dayDate = format(date, 'dd/MM', { locale: fr });
         const dayStr = format(date, 'yyyy-MM-dd');
         const dayPlanning = allEmployeePlanning[dayStr];
         
         // Vérifier les statuts dans toutes les boutiques pour ce jour
         let status = null;
         let isSick = false;
         let hasWorkHours = false;
         
         if (dayPlanning) {
           Object.keys(dayPlanning).forEach(shopId => {
             const shopStatus = dayPlanning[shopId];
             if (typeof shopStatus === 'string') {
               // C'est un statut (Congé, Maladie, etc.)
               if (shopStatus.toLowerCase().includes('maladie')) {
                 status = shopStatus;
                 isSick = true;
               } else if (!status) {
                 // Garder le premier statut trouvé (priorité à la maladie)
                 status = shopStatus;
               }
             } else if (Array.isArray(shopStatus) && shopStatus.some(slot => slot === true)) {
               // Il y a des heures de travail dans cette boutique
               hasWorkHours = true;
             }
           });
         }
         
         // Si pas de statut mais pas d'heures non plus, ce n'est plus automatiquement un congé
         if (!status && !hasWorkHours) {
           status = null;
         }
         
         // Si pas de données du tout pour ce jour, ce n'est plus automatiquement un congé
         if (!dayPlanning) {
           status = null;
           hasWorkHours = false;
         }
         
         // Ne pas afficher les jours sans données dans l'export PDF
         if (!status && !hasWorkHours) {
           return;
         }
         
         // Calculer les heures de travail pour l'export (toutes boutiques confondues)
         let totalHours = 0;
         
         if (hasWorkHours) {
           // Calculer les heures totales de toutes les boutiques
           Object.keys(dayPlanning).forEach(shopId => {
             const shopSlots = dayPlanning[shopId];
             if (Array.isArray(shopSlots)) {
               const hours = calculateEmployeeDailyHours(selectedEmployeeForMonthlyDetail, dayStr, { [selectedEmployeeForMonthlyDetail]: { [dayStr]: shopSlots } }, config);
               totalHours += hours;
             }
           });
         }
         
         body.push([
           `${dayName} ${dayDate}`,
           status ? (isSick ? 'MALADIE' : status) : '-',
           status ? '-' : '-',
           status ? '-' : '-',
           status ? '-' : '-',
           status ? formatWorkedHoursForDisplay(0) : formatWorkedHoursForDisplay(totalHours),
           formatWorkedHoursNbNotation(status ? 0 : totalHours)
         ]);
       });
    });
    
    // Total de la boutique sélectionnée
    body.push(['Total boutique', '', '', '', '', formatWorkedHoursForDisplay(calculateSelectedShopHours()), formatWorkedHoursNbNotation(calculateSelectedShopHours())]);
    
    // Si l'employé travaille dans plusieurs boutiques, ajouter un résumé
    if (employeeShops.length > 1) {
      body.push(['', '', '', '', '', '', '', '']);
      body.push(['Résumé multi-boutiques:', '', '', '', '', '', '', '']);
      employeeShops.forEach((shop) => {
        const h = calculateShopHours(shop.id);
        body.push([`- ${shop.name}`, '', '', '', '', formatWorkedHoursForDisplay(h), formatWorkedHoursNbNotation(h)]);
      });
      body.push(['Total global', '', '', '', '', formatWorkedHoursForDisplay(calculateTotalMonthHours()), formatWorkedHoursNbNotation(calculateTotalMonthHours())]);
    }
    
    doc.autoTable({
      head: [columns],
      body: body,
      startY: 50,
      styles: { fontSize: 7, fontStyle: 'bold' },
      headStyles: { fillColor: [30, 136, 229], fontSize: 8, fontStyle: 'bold' }
    });
    doc.save(`monthly_detail_${employeeName}_${selectedShopName}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    console.log('EmployeeMonthlyDetailModal: PDF exported successfully');
  };

  const exportToExcel = async () => {
    const XLSX = await loadXlsx();
    console.log('EmployeeMonthlyDetailModal: Exporting to Excel');
    const data = [];
    
    // Grouper les jours par semaine
    const weeks = {};
    allDaysOfMonth.forEach((date, index) => {
      const weekNumber = getWeekOfDate(date);
      if (!weeks[weekNumber]) {
        weeks[weekNumber] = [];
      }
      weeks[weekNumber].push({ date, index });
    });
    
    Object.keys(weeks).sort((a, b) => parseInt(a) - parseInt(b)).forEach(weekNumber => {
      const weekDays = weeks[weekNumber];
      const weekTitle = getWeekTitle(weekDays[0].date);
      
      // Ligne d'en-tête de semaine
      data.push({
        'Jour': weekTitle,
        'ENTRÉE': '',
        'PAUSE': '',
        'RETOUR': '',
        'SORTIE': '',
        'Heures': '',
        'Nb (h)': '',
        'Statut': ''
      });
      
             // Jours de la semaine
       weekDays.forEach(({ date }) => {
         const dayName = getDayName(date);
         const dayDate = format(date, 'dd/MM', { locale: fr });
         const dayStr = format(date, 'yyyy-MM-dd');
         const dayPlanning = allEmployeePlanning[dayStr];
         
         // Vérifier les statuts dans toutes les boutiques pour ce jour
         let status = null;
         let isSick = false;
         let hasWorkHours = false;
         
         if (dayPlanning) {
           Object.keys(dayPlanning).forEach(shopId => {
             const shopStatus = dayPlanning[shopId];
             
             if (typeof shopStatus === 'string') {
               // C'est un statut (Congé, Maladie, etc.)
               if (shopStatus.toLowerCase().includes('maladie')) {
                 status = shopStatus;
                 isSick = true;
               } else if (!status) {
                 // Garder le premier statut trouvé (priorité à la maladie)
                 status = shopStatus;
               }
             } else if (Array.isArray(shopStatus) && shopStatus.some(slot => slot === true)) {
               // Il y a des heures de travail dans cette boutique
               hasWorkHours = true;
             }
           });
         }
         
         // Si pas de statut mais pas d'heures non plus, ce n'est plus automatiquement un congé
         if (!status && !hasWorkHours) {
           status = null;
         }
         
         // Si pas de données du tout pour ce jour, ce n'est plus automatiquement un congé
         if (!dayPlanning) {
           status = null;
           hasWorkHours = false;
         }
         
         // Ne pas afficher les jours sans données dans l'export Excel
         if (!status && !hasWorkHours) {
           return;
         }
         
         // Calculer les heures de travail pour l'export (toutes boutiques confondues)
         let totalHours = 0;
         let workHours = { entry: null, pause: null, return: null, exit: null, hours: 0 };
         
         if (hasWorkHours) {
           // Calculer les heures totales de toutes les boutiques
           Object.keys(dayPlanning).forEach(shopId => {
             const shopSlots = dayPlanning[shopId];
             if (Array.isArray(shopSlots)) {
               const hours = calculateEmployeeDailyHours(selectedEmployeeForMonthlyDetail, dayStr, { [selectedEmployeeForMonthlyDetail]: { [dayStr]: shopSlots } }, config);
               totalHours += hours;
             }
           });
           
           // Pour l'export, on peut simplifier les heures de travail
           workHours.hours = totalHours;
         }
         
         data.push({
           'Jour': `${dayName} ${dayDate}`,
           'ENTRÉE': status ? (isSick ? 'MALADIE' : status) : (workHours.entry ? `${workHours.entry} H` : '-'),
           'PAUSE': status ? '-' : (workHours.pause ? `${workHours.pause} H` : '-'),
           'RETOUR': status ? '-' : (workHours.return ? `${workHours.return} H` : '-'),
           'SORTIE': status ? '-' : (workHours.exit ? `${workHours.exit} H` : '-'),
           'Heures': status ? formatWorkedHoursForDisplay(0) : formatWorkedHoursForDisplay(workHours.hours),
           'Nb (h)': formatWorkedHoursNbNotation(status ? 0 : workHours.hours),
           'Statut': isSick ? 'MALADIE' : (status ? 'CONGÉ' : 'TRAVAIL')
         });
       });
    });
    
    // Total de la boutique sélectionnée
    data.push({
      'Jour': 'Total boutique',
      'ENTRÉE': '',
      'PAUSE': '',
      'RETOUR': '',
      'SORTIE': '',
      'Heures': formatWorkedHoursForDisplay(calculateSelectedShopHours()),
      'Nb (h)': formatWorkedHoursNbNotation(calculateSelectedShopHours()),
      'Statut': ''
    });
    
    // Si l'employé travaille dans plusieurs boutiques, ajouter un résumé
    if (employeeShops.length > 1) {
      data.push({
        'Jour': '',
        'ENTRÉE': '',
        'PAUSE': '',
        'RETOUR': '',
        'SORTIE': '',
        'Heures': '',
        'Nb (h)': '',
        'Statut': ''
      });
      data.push({
        'Jour': 'Résumé multi-boutiques:',
        'ENTRÉE': '',
        'PAUSE': '',
        'RETOUR': '',
        'SORTIE': '',
        'Heures': '',
        'Nb (h)': '',
        'Statut': ''
      });
      employeeShops.forEach((shop) => {
        const h = calculateShopHours(shop.id);
        data.push({
          'Jour': `- ${shop.name}`,
          'ENTRÉE': '',
          'PAUSE': '',
          'RETOUR': '',
          'SORTIE': '',
          'Heures': formatWorkedHoursForDisplay(h),
          'Nb (h)': formatWorkedHoursNbNotation(h),
          'Statut': ''
        });
      });
      data.push({
        'Jour': 'Total global',
        'ENTRÉE': '',
        'PAUSE': '',
        'RETOUR': '',
        'SORTIE': '',
        'Heures': formatWorkedHoursForDisplay(calculateTotalMonthHours()),
        'Nb (h)': formatWorkedHoursNbNotation(calculateTotalMonthHours()),
        'Statut': ''
      });
    }
    
    const selectedShopName = shops.find(s => s.id === selectedShop)?.name || selectedShop;
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Récapitulatif mensuel');
    XLSX.writeFile(wb, `monthly_detail_${employeeName}_${selectedShopName}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    console.log('EmployeeMonthlyDetailModal: Excel exported successfully');
  };

  const exportAsImagePdf = async () => {
    console.log('EmployeeMonthlyDetailModal: Exporting to PDF as image');
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
      pdf.save(`monthly_detail_${employeeName}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      console.log('EmployeeMonthlyDetailModal: PDF exported successfully as image');
    } catch (error) {
      console.error('EmployeeMonthlyDetailModal: PDF export failed', error);
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
              console.log('EmployeeMonthlyDetailModal: Closing modal via cross');
              setShowEmployeeMonthlyDetail(false);
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
                console.log('EmployeeMonthlyDetailModal: Closing modal via button');
                setShowEmployeeMonthlyDetail(false);
              }}
            >
              Fermer
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const weekColors = [
    '#E3F2FD', // Light Blue - Semaine 1
    '#E8F5E8', // Light Green - Semaine 2
    '#FFEBEE', // Light Red - Semaine 3
    '#F3E5F5', // Light Purple - Semaine 4
    '#FFF8E1', // Light Yellow - Semaine 5
    '#E1F5FE', // Light Cyan - Semaine 6
    '#F1F8E9', // Light Lime - Semaine 7
    '#FFF3E0', // Light Orange - Semaine 8
  ];

  // Fonction pour obtenir la semaine d'une date (semaine du lundi au dimanche)
  const getWeekOfDate = (date) => {
    // Calculer le dimanche de la semaine de cette date
    const dayOfWeek = date.getDay();
    const daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
    const sundayOfWeek = new Date(date);
    sundayOfWeek.setDate(date.getDate() + daysToSunday);
    
    // Calculer le premier dimanche du mois
    const monthStart = startOfMonth(new Date(date));
    const firstSundayOfMonth = new Date(monthStart);
    const daysToFirstSunday = monthStart.getDay() === 0 ? 0 : 7 - monthStart.getDay();
    firstSundayOfMonth.setDate(monthStart.getDate() + daysToFirstSunday);
    
    // Calculer le numéro de semaine basé sur les dimanches
    const diffTime = sundayOfWeek.getTime() - firstSundayOfMonth.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const weekNumber = Math.floor(diffDays / 7);
    
    return Math.max(0, weekNumber);
  };

  // Fonction pour obtenir le titre de la semaine
  const getWeekTitle = (date) => {
    const mondayOfWeek = new Date(date);
    const dayOfWeek = date.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    mondayOfWeek.setDate(date.getDate() - daysToMonday);
    
    const sundayOfWeek = new Date(mondayOfWeek);
    sundayOfWeek.setDate(mondayOfWeek.getDate() + 6);
    
    return `Semaine du ${format(mondayOfWeek, 'd MMMM', { locale: fr })} au ${format(sundayOfWeek, 'd MMMM yyyy', { locale: fr })}`;
  };

  // Identifier les jours hors mois qui ont des données de planning
  const getDaysOutsideMonth = () => {
    const daysOutsideMonth = [];
    
    if (!planningData?.shops) return daysOutsideMonth;
    
    // Ne regarder que la boutique sélectionnée
    const selectedShopData = planningData.shops.find(shop => shop.id === selectedShop);
    if (!selectedShopData || !selectedShopData.weeks) return daysOutsideMonth;
    
    // Trouver les semaines qui chevauchent le mois sélectionné
    const monthStart = startOfMonth(new Date(selectedWeek));
    const monthEnd = endOfMonth(new Date(selectedWeek));
    
    Object.keys(selectedShopData.weeks).forEach(weekKey => {
      const weekStart = new Date(weekKey);
      const weekEnd = addDays(weekStart, 6);
      
      // Vérifier si cette semaine chevauche le mois sélectionné
      const overlapsMonth = (weekStart <= monthEnd && weekEnd >= monthStart);
      
      if (overlapsMonth) {
        const weekData = selectedShopData.weeks[weekKey];
        if (weekData && weekData.planning && weekData.planning[selectedEmployeeForMonthlyDetail]) {
          Object.keys(weekData.planning[selectedEmployeeForMonthlyDetail]).forEach(dayStr => {
            const dayDate = new Date(dayStr);
            
            // Si le jour est en dehors du mois (avant OU après) ET a des créneaux sélectionnés
            if (dayDate < monthStart || dayDate > monthEnd) {
              const slots = weekData.planning[selectedEmployeeForMonthlyDetail][dayStr];
              if (Array.isArray(slots) && slots.some(slot => slot === true)) {
                const hours = calculateEmployeeDailyHours(selectedEmployeeForMonthlyDetail, dayStr, { [selectedEmployeeForMonthlyDetail]: { [dayStr]: slots } }, config);
                daysOutsideMonth.push({
                  date: dayStr,
                  shopName: selectedShopData.name || selectedShopData.id,
                  hours: hours,
                  dayName: format(dayDate, 'EEEE', { locale: fr }),
                  dayDate: format(dayDate, 'dd/MM/yyyy', { locale: fr }),
                  isBeforeMonth: dayDate < monthStart,
                  weekKey: weekKey
                });
              }
            }
          });
        }
      }
    });
    
    // Trier par date pour avoir un ordre chronologique
    return daysOutsideMonth.sort((a, b) => new Date(a.date) - new Date(b.date));
  };

  const daysOutsideMonth = getDaysOutsideMonth();

     return (
     <div className="modal-overlay" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
       <div className="modal-content" style={{ 
         width: '95%',
         maxWidth: '1200px',
         maxHeight: '80vh', 
         overflowY: 'auto',
         '@media print': {
           maxHeight: 'none',
           overflowY: 'visible',
           backgroundColor: 'white',
           color: 'black'
         }
       }}>
        <button
          className="modal-close"
          onClick={() => {
            console.log('EmployeeMonthlyDetailModal: Closing modal via cross');
            setShowEmployeeMonthlyDetail(false);
          }}
          style={{ color: '#dc3545', fontSize: '18px' }}
        >
          ✕
        </button>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                   <div></div>
                   <h3 style={{ fontFamily: 'Roboto, sans-serif', textAlign: 'center', margin: 0 }}>
                     Récapitulatif mensuel détaillé pour {employeeName}
                   </h3>
                   <button 
                     onClick={() => {
                       setLocalForceRefresh(prev => prev + 1);
                     }} 
                     style={{ 
                       padding: '6px 12px', 
                       backgroundColor: '#007bff', 
                       color: 'white', 
                       border: 'none', 
                       borderRadius: '4px', 
                       cursor: 'pointer',
                       fontSize: '11px',
                       fontWeight: 'bold'
                     }}
                     title="Rafraîchir les données"
                   >
                     🔄 Actualiser
                   </button>
                 </div>
                 <p style={{ fontFamily: 'Roboto, sans-serif', textAlign: 'center', marginBottom: '20px' }}>
                   Mois de {format(firstDayOfMonth, 'MMMM yyyy', { locale: fr })}
                 </p>
                 
                 {/* Boutons par boutique avec totaux séparés */}
                 <div style={{ 
                   display: 'flex', 
                   justifyContent: 'center', 
                   gap: '15px', 
                   marginBottom: '20px',
                   flexWrap: 'wrap'
                 }}>
                   {employeeShops.map((shop) => (
                     <button
                       key={shop.id}
                       style={{
                         display: 'flex',
                         flexDirection: 'column',
                         alignItems: 'center',
                         padding: '15px 20px',
                         border: '3px solid #007bff',
                         borderRadius: '12px',
                         backgroundColor: '#f8f9fa',
                         minWidth: '180px',
                         cursor: 'pointer',
                         transition: 'all 0.3s ease',
                         boxShadow: '0 2px 8px rgba(0, 123, 255, 0.2)'
                       }}
                       onMouseEnter={(e) => {
                         e.target.style.backgroundColor = '#e3f2fd';
                         e.target.style.transform = 'translateY(-2px)';
                         e.target.style.boxShadow = '0 4px 12px rgba(0, 123, 255, 0.3)';
                       }}
                       onMouseLeave={(e) => {
                         e.target.style.backgroundColor = '#f8f9fa';
                         e.target.style.transform = 'translateY(0)';
                         e.target.style.boxShadow = '0 2px 8px rgba(0, 123, 255, 0.2)';
                       }}
                       onClick={() => {
                         // Ici on pourrait ajouter une action pour changer de boutique
                         console.log(`Boutique sélectionnée: ${shop.name} (${shop.id})`);
                       }}
                     >
                       <div style={{
                         fontWeight: 'bold',
                         fontSize: '16px',
                         color: '#007bff',
                         marginBottom: '8px',
                         textAlign: 'center'
                       }}>
                         {shop.name}
                       </div>
                       <div style={{
                         fontSize: '24px',
                         fontWeight: 'bold',
                         color: '#28a745',
                         textAlign: 'center'
                       }}>
                         {formatWorkedHoursForDisplay(calculateShopHours(shop.id))}
                       </div>
                       <div style={{
                         fontSize: '12px',
                         color: '#666',
                         marginTop: '5px',
                         textAlign: 'center'
                       }}>
                         Total du mois
                       </div>
                     </button>
                   ))}
                   
                   {/* Bouton total global (si plusieurs boutiques) */}
                   {employeeShops.length > 1 && (
                     <button
                       style={{
                         display: 'flex',
                         flexDirection: 'column',
                         alignItems: 'center',
                         padding: '15px 20px',
                         border: '3px solid #28a745',
                         borderRadius: '12px',
                         backgroundColor: '#f8fff9',
                         minWidth: '180px',
                         cursor: 'pointer',
                         transition: 'all 0.3s ease',
                         boxShadow: '0 2px 8px rgba(40, 167, 69, 0.2)'
                       }}
                       onMouseEnter={(e) => {
                         e.target.style.backgroundColor = '#e8f5e8';
                         e.target.style.transform = 'translateY(-2px)';
                         e.target.style.boxShadow = '0 4px 12px rgba(40, 167, 69, 0.3)';
                       }}
                       onMouseLeave={(e) => {
                         e.target.style.backgroundColor = '#f8fff9';
                         e.target.style.transform = 'translateY(0)';
                         e.target.style.boxShadow = '0 2px 8px rgba(40, 167, 69, 0.2)';
                       }}
                     >
                       <div style={{
                         fontWeight: 'bold',
                         fontSize: '16px',
                         color: '#28a745',
                         marginBottom: '8px',
                         textAlign: 'center'
                       }}>
                         TOTAL GLOBAL
                       </div>
                       <div style={{
                         fontSize: '24px',
                         fontWeight: 'bold',
                         color: '#28a745',
                         textAlign: 'center'
                       }}>
                         {formatWorkedHoursForDisplay(calculateTotalMonthHours())}
                       </div>
                       <div style={{
                         fontSize: '12px',
                         color: '#666',
                         marginTop: '5px',
                         textAlign: 'center'
                       }}>
                         Toutes boutiques
                       </div>
                     </button>
                   )}
                 </div>
                 
                 {/* Statistiques de la boutique sélectionnée */}
                 {selectedShop && (
                   <div style={{ 
                     marginBottom: '20px', 
                     padding: '15px', 
                     backgroundColor: '#e3f2fd', 
                     border: '1px solid #2196f3', 
                     borderRadius: '8px',
                     fontFamily: 'Roboto, sans-serif'
                   }}>
                     <h4 style={{ 
                       margin: '0 0 10px 0', 
                       color: '#1976d2', 
                       fontSize: '14px', 
                       fontWeight: 'bold',
                       textAlign: 'center'
                     }}>
                       📊 Statistiques de la boutique sélectionnée
                     </h4>
                     <div style={{ 
                       display: 'flex', 
                       justifyContent: 'space-around', 
                       flexWrap: 'wrap',
                       gap: '10px'
                     }}>
                       <div style={{ textAlign: 'center' }}>
                         <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#28a745' }}>
                           {formatWorkedHoursForDisplay(calculateSelectedShopHours())}
                         </div>
                         <div style={{ fontSize: '12px', color: '#666' }}>
                           Total du mois
                         </div>
                       </div>
                       <div style={{ textAlign: 'center' }}>
                         <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#ff9800' }}>
                           {allDaysOfMonth.filter(day => !isDayOff(day)).length}
                         </div>
                         <div style={{ fontSize: '12px', color: '#666' }}>
                           Jours travaillés
                         </div>
                       </div>
                       <div style={{ textAlign: 'center' }}>
                         <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#e91e63' }}>
                           {allDaysOfMonth.filter(day => isDayOff(day)).length}
                         </div>
                         <div style={{ fontSize: '12px', color: '#666' }}>
                           Jours de repos
                         </div>
                       </div>
                     </div>
                   </div>
                 )}
                 
                 {/* Tableau explicatif des jours hors mois */}
                 {daysOutsideMonth.length > 0 && (
                   <div style={{ 
                     marginBottom: '20px', 
                     padding: '15px', 
                     backgroundColor: '#fff3cd', 
                     border: '1px solid #ffeaa7', 
                     borderRadius: '8px',
                     fontFamily: 'Roboto, sans-serif'
                   }}>
                     <h4 style={{ 
                       margin: '0 0 10px 0', 
                       color: '#856404', 
                       fontSize: '14px', 
                       fontWeight: 'bold',
                       textAlign: 'center'
                     }}>
                       ⚠️ Jours hors mois non comptabilisés dans le total
                     </h4>
                     <table style={{ 
                       width: '100%', 
                       borderCollapse: 'collapse', 
                       fontSize: '11px',
                       fontFamily: 'Roboto, sans-serif'
                     }}>
                       <thead>
                         <tr style={{ backgroundColor: '#f8f9fa' }}>
                           <th style={{ border: '1px solid #dee2e6', padding: '6px', textAlign: 'left', fontWeight: 'bold' }}>Jour</th>
                           <th style={{ border: '1px solid #dee2e6', padding: '6px', textAlign: 'left', fontWeight: 'bold' }}>Date</th>
                           <th style={{ border: '1px solid #dee2e6', padding: '6px', textAlign: 'left', fontWeight: 'bold' }}>Boutique</th>
                           <th style={{ border: '1px solid #dee2e6', padding: '6px', textAlign: 'center', fontWeight: 'bold' }}>Heures</th>
                           <th style={{ border: '1px solid #dee2e6', padding: '6px', textAlign: 'center', fontWeight: 'bold' }}>Statut</th>
                         </tr>
                       </thead>
                       <tbody>
                         {daysOutsideMonth.map((day, index) => (
                           <tr key={index} style={{ 
                             backgroundColor: day.isBeforeMonth ? '#fff3cd' : '#e3f2fd',
                             borderLeft: day.isBeforeMonth ? '4px solid #ffc107' : '4px solid #17a2b8'
                           }}>
                             <td style={{ border: '1px solid #dee2e6', padding: '6px' }}>
                               {day.dayName}
                               <span style={{ 
                                 fontSize: '9px', 
                                 color: day.isBeforeMonth ? '#856404' : '#0c5460',
                                 marginLeft: '4px',
                                 fontWeight: 'bold'
                               }}>
                                 {day.isBeforeMonth ? '←' : '→'}
                               </span>
                             </td>
                             <td style={{ border: '1px solid #dee2e6', padding: '6px' }}>{day.dayDate}</td>
                             <td style={{ border: '1px solid #dee2e6', padding: '6px' }}>{day.shopName}</td>
                             <td style={{ border: '1px solid #dee2e6', padding: '6px', textAlign: 'center', fontWeight: 'bold' }}>
                               {formatWorkedHoursForDisplay(day.hours)}
                             </td>
                             <td style={{ border: '1px solid #dee2e6', padding: '6px', textAlign: 'center', fontSize: '10px' }}>
                               <span style={{ 
                                 padding: '2px 6px', 
                                 borderRadius: '4px', 
                                 fontWeight: 'bold',
                                 color: 'white',
                                 backgroundColor: day.isBeforeMonth ? '#28a745' : '#007bff'
                               }}>
                                 {day.isBeforeMonth ? '✓ Payé' : '⏳ Fragmenté'}
                               </span>
                             </td>
                           </tr>
                         ))}
                         <tr style={{ backgroundColor: '#e9ecef', fontWeight: 'bold' }}>
                           <td colSpan="3" style={{ border: '1px solid #dee2e6', padding: '6px', textAlign: 'right' }}>
                             Total hors mois :
                           </td>
                           <td style={{ border: '1px solid #dee2e6', padding: '6px', textAlign: 'center' }}>
                             {formatWorkedHoursForDisplay(daysOutsideMonth.reduce((total, day) => total + day.hours, 0))}
                           </td>
                           <td style={{ border: '1px solid #dee2e6', padding: '6px', textAlign: 'center' }}>
                             <span style={{ fontSize: '10px', color: '#6c757d' }}>
                               {formatWorkedHoursForDisplay(daysOutsideMonth.filter(day => day.isBeforeMonth).reduce((total, day) => total + day.hours, 0))} payées / {formatWorkedHoursForDisplay(daysOutsideMonth.filter(day => !day.isBeforeMonth).reduce((total, day) => total + day.hours, 0))} fragmentées
                             </span>
                           </td>
                         </tr>
                       </tbody>
                     </table>
                     <div style={{ 
                       marginTop: '10px', 
                       fontSize: '10px', 
                       color: '#856404',
                       display: 'flex',
                       justifyContent: 'space-between',
                       alignItems: 'center'
                     }}>
                       <span style={{ display: 'flex', alignItems: 'center' }}>
                         <span style={{ 
                           display: 'inline-block', 
                           width: '12px', 
                           height: '12px', 
                           backgroundColor: '#fff3cd', 
                           border: '1px solid #ffc107',
                           marginRight: '4px',
                           borderRadius: '2px'
                         }}></span>
                         <span style={{ color: '#28a745', fontWeight: 'bold' }}>✓ Heures déjà payées</span>
                       </span>
                       <span style={{ display: 'flex', alignItems: 'center' }}>
                         <span style={{ 
                           display: 'inline-block', 
                           width: '12px', 
                           height: '12px', 
                           backgroundColor: '#e3f2fd', 
                           border: '1px solid #17a2b8',
                           marginRight: '4px',
                           borderRadius: '2px'
                         }}></span>
                         <span style={{ color: '#007bff', fontWeight: 'bold' }}>⏳ Semaine fragmentée (report août)</span>
                       </span>
                     </div>
                     <p style={{ 
                       margin: '10px 0 0 0', 
                       fontSize: '11px', 
                       color: '#856404', 
                       textAlign: 'center',
                       fontStyle: 'italic'
                     }}>
                       Ces heures proviennent de semaines fragmentées à cheval sur deux mois. 
                       Même une semaine complète de 35h peut être divisée entre deux paies.
                     </p>
                   </div>
                 )}
        
                                   <table style={{ 
                     fontFamily: 'Roboto, sans-serif', 
                     width: '100%', 
                     borderCollapse: 'collapse', 
                     fontSize: '11px',
                     tableLayout: 'fixed',
                     fontWeight: 'bold'
                   }}>
          <thead>
                <tr style={{ backgroundColor: '#f0f0f0' }}>
                  <th style={{ border: '1px solid #ddd', padding: '3px 4px', fontWeight: '700', fontSize: '10px', width: '12%' }}>Jour</th>
                  <th style={{ border: '1px solid #ddd', padding: '3px 4px', fontWeight: '700', fontSize: '10px', width: '18%' }}>BOUTIQUE</th>
                  <th style={{ border: '1px solid #ddd', padding: '3px 4px', fontWeight: '700', fontSize: '10px', width: '12%' }}>ENTRÉE</th>
                  <th style={{ border: '1px solid #ddd', padding: '3px 4px', fontWeight: '700', fontSize: '10px', width: '12%' }}>PAUSE</th>
                  <th style={{ border: '1px solid #ddd', padding: '3px 4px', fontWeight: '700', fontSize: '10px', width: '12%' }}>RETOUR</th>
                  <th style={{ border: '1px solid #ddd', padding: '3px 4px', fontWeight: '700', fontSize: '10px', width: '12%' }}>SORTIE</th>
                  <th style={{ border: '1px solid #ddd', padding: '3px 4px', fontWeight: '700', fontSize: '10px', width: '22%' }}>Heures</th>
                  <th style={{ border: '1px solid #ddd', padding: '3px 4px', fontWeight: '700', fontSize: '10px', width: '8%' }}>Nb (h)</th>
            </tr>
          </thead>
          <tbody>
              {(() => {
                // Grouper les jours par semaine
                const weeks = {};
                allDaysOfMonth.forEach((date, index) => {
                  const weekNumber = getWeekOfDate(date);
                  if (!weeks[weekNumber]) {
                    weeks[weekNumber] = [];
                  }
                  weeks[weekNumber].push({ date, index });
                });

                const rows = [];
                Object.keys(weeks).sort((a, b) => parseInt(a) - parseInt(b)).forEach(weekNumber => {
                  const weekDays = weeks[weekNumber];
                  const weekColor = weekColors[parseInt(weekNumber) % weekColors.length];
                  const weekTitle = getWeekTitle(weekDays[0].date);
                  
                                                      // Calculer le total de la semaine
                   const weekTotal = weekDays.reduce((total, { date }) => {
                     return total + calculateDayHours(date);
                   }, 0);
                   
                                      // Ajouter une ligne d'en-tête pour la semaine
                    rows.push(
                      <tr key={`week-${weekNumber}`} style={{ backgroundColor: weekColor }}>
                                                <td 
                           colSpan="6" 
                           style={{ 
                             border: '1px solid #ddd', 
                             padding: '3px 4px', 
                             fontWeight: '700', 
                             fontSize: '10px',
                             textAlign: 'center',
                             color: '#333'
                           }}
                         >
                           {weekTitle}
                         </td>
                         <td 
                           style={{ 
                             border: '1px solid #ddd', 
                             padding: '3px 4px', 
                             fontWeight: '700', 
                             fontSize: '10px',
                             textAlign: 'center',
                             color: '#333',
                             backgroundColor: weekColor
                           }}
                         >
                           {formatWorkedHoursForDisplay(weekTotal)}
                         </td>
                         <td 
                           style={{ 
                             border: '1px solid #ddd', 
                             padding: '3px 4px', 
                             fontWeight: '700', 
                             fontSize: '10px',
                             textAlign: 'center',
                             color: '#333',
                             backgroundColor: weekColor
                           }}
                         >
                           {formatWorkedHoursNbNotation(weekTotal)}
                         </td>
                      </tr>
                    );
                   
                                      // Ajouter les jours de la semaine
                    weekDays.forEach(({ date, index }) => {
                      const dayName = getDayName(date);
                      const dayDate = format(date, 'dd/MM', { locale: fr });
                      const allShopsForDay = getAllShopsForDay(date);
                      
                      // Si l'employé travaille dans plusieurs boutiques ce jour-là, créer une ligne pour chaque boutique
                      if (allShopsForDay.length > 0) {
                        // Vérifier d'abord s'il y a des horaires de travail
                        const hasWorkHours = allShopsForDay.some(shop => {
                          const dayStr = format(date, 'yyyy-MM-dd');
                          const dayPlanning = allEmployeePlanning[dayStr];
                          const shopSlots = dayPlanning?.[shop.id];
                          return Array.isArray(shopSlots) && shopSlots.some(slot => slot === true);
                        });
                        
                        // Si il y a des horaires de travail, afficher chaque boutique avec horaires
                        if (hasWorkHours) {
                          allShopsForDay.forEach((shop, shopIndex) => {
                            const workHours = calculateWorkHoursForShop(date, shop.id);
                            const dayStr = format(date, 'yyyy-MM-dd');
                            const dayPlanning = allEmployeePlanning[dayStr];
                            const shopSlots = dayPlanning?.[shop.id];
                            
                            // N'afficher que les boutiques avec des horaires réels
                            if (Array.isArray(shopSlots) && shopSlots.some(slot => slot === true)) {
                              rows.push(
                                <tr key={`${index}-${shop.id}`} style={{
                                  backgroundColor: weekColor
                                }}>
                                  <td style={{ border: '1px solid #ddd', padding: '2px 3px', fontWeight: '600', fontSize: '10px' }}>
                                    {shopIndex === 0 ? `${dayName} ${dayDate}` : ''}
                                  </td>
                                  <td style={{ border: '1px solid #ddd', padding: '2px 3px', fontSize: '10px', fontWeight: '600' }}>
                                    {shop.name}
                                  </td>
                                  <td style={{ border: '1px solid #ddd', padding: '2px 3px', fontSize: '10px', fontWeight: '600' }}>
                                    {workHours.entry ? `${workHours.entry} H` : '-'}
                                  </td>
                                  <td style={{ border: '1px solid #ddd', padding: '2px 3px', fontSize: '10px', fontWeight: '600' }}>
                                    {workHours.pause ? `${workHours.pause} H` : '-'}
                                  </td>
                                  <td style={{ border: '1px solid #ddd', padding: '2px 3px', fontSize: '10px', fontWeight: '600' }}>
                                    {workHours.return ? `${workHours.return} H` : '-'}
                                  </td>
                                  <td style={{ border: '1px solid #ddd', padding: '2px 3px', fontSize: '10px', fontWeight: '600' }}>
                                    {workHours.exit ? `${workHours.exit} H` : '-'}
                                  </td>
                                  <td style={{ 
                                    border: '1px solid #ddd', 
                                    padding: '2px 3px', 
                                    fontWeight: '600',
                                    fontSize: '10px',
                                    color: '#333'
                                  }}>
                                    {formatWorkedHoursForDisplay(workHours.hours)}
                                  </td>
                                  <td style={{ 
                                    border: '1px solid #ddd', 
                                    padding: '2px 3px', 
                                    fontWeight: '600',
                                    fontSize: '10px',
                                    color: '#333'
                                  }}>
                                    {formatWorkedHoursNbNotation(workHours.hours)}
                                  </td>
                                </tr>
                              );
                            }
                          });
                        } else {
                          // Si pas d'horaires, vérifier s'il y a un statut (Congé, Maladie)
                          const dayStr = format(date, 'yyyy-MM-dd');
                          const dayPlanning = allEmployeePlanning[dayStr];
                          let status = null;
                          let isSick = false;
                          
                          // Chercher le premier statut trouvé
                          if (dayPlanning) {
                            for (const shopId in dayPlanning) {
                              const shopSlots = dayPlanning[shopId];
                              if (typeof shopSlots === 'string') {
                                status = shopSlots;
                                isSick = shopSlots.toLowerCase().includes('maladie');
                                break; // Prendre le premier statut trouvé
                              }
                            }
                          }
                          
                          // Afficher une seule ligne avec le statut
                          if (status) {
                            rows.push(
                              <tr key={index} style={{
                                backgroundColor: weekColor
                              }}>
                                <td style={{ border: '1px solid #ddd', padding: '2px 3px', fontWeight: '600', fontSize: '10px' }}>
                                  {dayName} {dayDate}
                                </td>
                                <td style={{ border: '1px solid #ddd', padding: '2px 3px', fontSize: '10px', fontWeight: '600' }}>
                                  <span style={{ color: isSick ? '#dc3545' : '#FF9800', fontWeight: '600', fontSize: '9px' }}>
                                    {status}
                                  </span>
                                </td>
                                <td style={{ border: '1px solid #ddd', padding: '2px 3px', fontSize: '10px', fontWeight: '600' }}>
                                  -
                                </td>
                                <td style={{ border: '1px solid #ddd', padding: '2px 3px', fontSize: '10px', fontWeight: '600' }}>
                                  -
                                </td>
                                <td style={{ border: '1px solid #ddd', padding: '2px 3px', fontSize: '10px', fontWeight: '600' }}>
                                  -
                                </td>
                                <td style={{ border: '1px solid #ddd', padding: '2px 3px', fontSize: '10px', fontWeight: '600' }}>
                                  -
                                </td>
                                <td style={{ 
                                  border: '1px solid #ddd', 
                                  padding: '2px 3px', 
                                  fontWeight: '600',
                                  fontSize: '10px',
                                  color: '#FF9800'
                                }}>
                                  {formatWorkedHoursForDisplay(0)}
                                </td>
                                <td style={{ 
                                  border: '1px solid #ddd', 
                                  padding: '2px 3px', 
                                  fontWeight: '600',
                                  fontSize: '10px',
                                  color: '#FF9800'
                                }}>
                                  {formatWorkedHoursNbNotation(0)}
                                </td>
                              </tr>
                            );
                          }
                        }
                      }
                      
                      // Si aucun horaire ni statut pour ce jour, afficher une ligne vide
                      if (allShopsForDay.length === 0) {
                        rows.push(
                          <tr key={index} style={{
                            backgroundColor: weekColor
                          }}>
                            <td style={{ border: '1px solid #ddd', padding: '2px 3px', fontWeight: '600', fontSize: '10px' }}>
                              {dayName} {dayDate}
                            </td>
                            <td style={{ border: '1px solid #ddd', padding: '2px 3px', fontSize: '10px', fontWeight: '600' }}>
                              -
                            </td>
                            <td style={{ border: '1px solid #ddd', padding: '2px 3px', fontSize: '10px', fontWeight: '600' }}>
                              -
                            </td>
                            <td style={{ border: '1px solid #ddd', padding: '2px 3px', fontSize: '10px', fontWeight: '600' }}>
                              -
                            </td>
                            <td style={{ border: '1px solid #ddd', padding: '2px 3px', fontSize: '10px', fontWeight: '600' }}>
                              -
                            </td>
                            <td style={{ border: '1px solid #ddd', padding: '2px 3px', fontSize: '10px', fontWeight: '600' }}>
                              -
                            </td>
                            <td style={{ 
                              border: '1px solid #ddd', 
                              padding: '2px 3px', 
                              fontWeight: '600',
                              fontSize: '10px'
                            }}>
                              -
                            </td>
                            <td style={{ 
                              border: '1px solid #ddd', 
                              padding: '2px 3px', 
                              fontWeight: '600',
                              fontSize: '10px'
                            }}>
                              -
                            </td>
                          </tr>
                        );
                      }
                    });
                });
                
                return rows;
              })()}
                                           {/* Totaux par boutique */}
                                {employeeShops.map((shop) => (
                   <tr key={`total-${shop.id}`} style={{ backgroundColor: '#f0f0f0', fontWeight: '700' }}>
                     <td colSpan="6" style={{ border: '1px solid #ddd', padding: '3px 4px', fontSize: '10px', fontWeight: '700' }}>
                       TOTAL {shop.name}
                     </td>
                     <td style={{ border: '1px solid #ddd', padding: '3px 4px', fontSize: '10px', fontWeight: '700' }}>
                       {formatWorkedHoursForDisplay(calculateShopHours(shop.id))}
                     </td>
                     <td style={{ border: '1px solid #ddd', padding: '3px 4px', fontSize: '10px', fontWeight: '700' }}>
                       {formatWorkedHoursNbNotation(calculateShopHours(shop.id))}
                     </td>
              </tr>
            ))}
                 
                 {/* Total général */}
                 <tr style={{ backgroundColor: '#e0e0e0', fontWeight: '700' }}>
                   <td colSpan="6" style={{ border: '1px solid #ddd', padding: '3px 4px', fontSize: '10px', fontWeight: '700' }}>Total mois</td>
                   <td style={{ border: '1px solid #ddd', padding: '3px 4px', fontSize: '10px', fontWeight: '700' }}>{formatWorkedHoursForDisplay(calculateTotalMonthHours())}</td>
                   <td style={{ border: '1px solid #ddd', padding: '3px 4px', fontSize: '10px', fontWeight: '700' }}>{formatWorkedHoursNbNotation(calculateTotalMonthHours())}</td>
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
        
        <div className="button-group" style={{ display: 'flex', justifyContent: 'center', marginTop: '15px', flexWrap: 'wrap', gap: '10px' }}>
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
                      <title>Récapitulatif mensuel détaillé - ${employeeName}</title>
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
                          font-size: 9px;
                          table-layout: fixed;
                          font-weight: bold;
                        }
                        th, td {
                          border: 1px solid #ddd;
                          padding: 2px 3px;
                          font-size: 8px;
                          line-height: 1.2;
                          font-weight: bold;
                        }
                        th {
                          background-color: #f0f0f0;
                          font-weight: 700;
                          font-size: 9px;
                          padding: 2px 3px;
                        }
                        h3, p {
                          text-align: center;
                          margin: 10px 0;
                          font-weight: bold;
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
                   title: `Récapitulatif mensuel détaillé - ${employeeName}`,
                   metaLines: [
                     `Boutique: ${selectedShopName}`,
                     `Mois de ${format(new Date(selectedWeek), 'MMMM yyyy', { locale: fr })}`,
                   ],
                   filename: `monthly_detail_${employeeName}_${selectedShopName}_${format(new Date(), 'yyyy-MM-dd')}.html`,
                 });
               }}
             />
             <Button className="button-pdf" onClick={() => exportToPDF()}>
               Exporter en PDF
             </Button>
             <Button className="button-pdf" onClick={() => exportToExcel()}>
               Exporter en Excel
             </Button>
             <Button className="button-pdf" onClick={() => exportAsImagePdf()}>
               Exporter en PDF (image fidèle)
             </Button>
             
             {/* Boutons de debug pour Benedicte Saint-Tropez 20/07 */}
             {console.log('EmployeeMonthlyDetailModal: employeeName =', employeeName, 'selectedEmployeeForMonthlyDetail =', selectedEmployeeForMonthlyDetail)}
             {/* Boutons de debug pour TOUS les employés temporairement */}
             {true && (
               <div style={{ display: 'flex', gap: '5px', marginTop: '10px' }}>
                 <div style={{ 
                   backgroundColor: '#17a2b8', 
                   color: 'white', 
                   padding: '5px 10px', 
                   fontSize: '10px', 
                   borderRadius: '3px',
                   marginBottom: '5px'
                 }}>
                   DEBUG: {employeeName} ({selectedEmployeeForMonthlyDetail})
                 </div>
                 <Button
                   style={{
                     backgroundColor: '#dc3545',
                     color: 'white',
                     padding: '5px 10px',
                     fontSize: '10px',
                     border: 'none',
                     borderRadius: '3px',
                     cursor: 'pointer'
                   }}
                                        onClick={() => {
                       console.log('🧹 Nettoyer - Suppression des données', employeeName, '20/07');
                       
                       // Supprimer les données de l'employé pour le 20/07 dans toutes les boutiques
                       if (planningData?.shops) {
                         const updatedPlanningData = {
                           ...planningData,
                           shops: planningData.shops.map(shop => {
                             if (shop.weeks) {
                               const updatedWeeks = { ...shop.weeks };
                               Object.keys(updatedWeeks).forEach(weekKey => {
                                 const weekData = updatedWeeks[weekKey];
                                 if (weekData.planning && weekData.planning[selectedEmployeeForMonthlyDetail]) {
                                   // Supprimer spécifiquement le 20/07
                                   delete weekData.planning[selectedEmployeeForMonthlyDetail]['2025-07-20'];
                                   console.log(`Supprimé 2025-07-20 pour ${employeeName} dans ${shop.name}`);
                                 }
                               });
                               return { ...shop, weeks: updatedWeeks };
                             }
                             return shop;
                           })
                         };
                       
                       // Sauvegarder dans localStorage
                       localStorage.setItem('planningData', JSON.stringify(updatedPlanningData));
                       console.log('Données mises à jour dans localStorage');
                       
                       // Forcer le rafraîchissement
                       setLocalForceRefresh(prev => prev + 1);
                       if (onForceRefresh) {
                         onForceRefresh();
                       }
                       
                                                alert(`Données ${employeeName} 20/07 supprimées !`);
                     }
                   }}
                                    >
                     🧹 Nettoyer {employeeName} 20/07
                   </Button>
                 
                 <Button
                   style={{
                     backgroundColor: '#fd7e14',
                     color: 'white',
                     padding: '5px 10px',
                     fontSize: '10px',
                     border: 'none',
                     borderRadius: '3px',
                     cursor: 'pointer'
                   }}
                                        onClick={() => {
                       console.log('💥 Supprimer 20/07 - Suppression forcée pour', employeeName);
                       
                       // Supprimer toutes les données du 20/07 pour l'employé
                       if (planningData?.shops) {
                         const updatedPlanningData = {
                           ...planningData,
                           shops: planningData.shops.map(shop => {
                             if (shop.weeks) {
                               const updatedWeeks = { ...shop.weeks };
                               Object.keys(updatedWeeks).forEach(weekKey => {
                                 const weekData = updatedWeeks[weekKey];
                                 if (weekData.planning && weekData.planning[selectedEmployeeForMonthlyDetail]) {
                                   // Supprimer complètement les données du 20/07
                                   const updatedPlanning = { ...weekData.planning };
                                   if (updatedPlanning[selectedEmployeeForMonthlyDetail]) {
                                     delete updatedPlanning[selectedEmployeeForMonthlyDetail]['2025-07-20'];
                                     console.log(`Supprimé 2025-07-20 pour ${employeeName} dans ${shop.name}`);
                                   }
                                   updatedWeeks[weekKey] = { ...weekData, planning: updatedPlanning };
                                 }
                               });
                               return { ...shop, weeks: updatedWeeks };
                             }
                             return shop;
                           })
                         };
                       
                       // Sauvegarder dans localStorage
                       localStorage.setItem('planningData', JSON.stringify(updatedPlanningData));
                       console.log('Données mises à jour dans localStorage');
                       
                       // Forcer le rafraîchissement
                       setLocalForceRefresh(prev => prev + 1);
                       if (onForceRefresh) {
                         onForceRefresh();
                       }
                       
                                                alert(`Suppression forcée 20/07 effectuée pour ${employeeName} !`);
                     }
                   }}
                 >
                   💥 Supprimer 20/07
                 </Button>
                 
                 <Button
                   style={{
                     backgroundColor: '#6f42c1',
                     color: 'white',
                     padding: '5px 10px',
                     fontSize: '10px',
                     border: 'none',
                     borderRadius: '3px',
                     cursor: 'pointer'
                   }}
                                        onClick={() => {
                       console.log('🧨 Nettoyer', employeeName, '- Suppression complète');
                       
                       // Supprimer toutes les données de l'employé
                       if (planningData?.shops) {
                         const updatedPlanningData = {
                           ...planningData,
                           shops: planningData.shops.map(shop => {
                             if (shop.weeks) {
                               const updatedWeeks = { ...shop.weeks };
                               Object.keys(updatedWeeks).forEach(weekKey => {
                                 const weekData = updatedWeeks[weekKey];
                                 if (weekData.planning && weekData.planning[selectedEmployeeForMonthlyDetail]) {
                                   // Supprimer complètement l'employé
                                   const updatedPlanning = { ...weekData.planning };
                                   delete updatedPlanning[selectedEmployeeForMonthlyDetail];
                                   console.log(`Supprimé ${employeeName} complètement dans ${shop.name}`);
                                   updatedWeeks[weekKey] = { ...weekData, planning: updatedPlanning };
                                 }
                               });
                               return { ...shop, weeks: updatedWeeks };
                             }
                             return shop;
                           })
                         };
                       
                       // Sauvegarder dans localStorage
                       localStorage.setItem('planningData', JSON.stringify(updatedPlanningData));
                       console.log('Données mises à jour dans localStorage');
                       
                       // Forcer le rafraîchissement
                       setLocalForceRefresh(prev => prev + 1);
                       if (onForceRefresh) {
                         onForceRefresh();
                       }
                       
                                                alert(`Nettoyage complet ${employeeName} effectué !`);
                     }
                   }}
                                    >
                     🧨 Nettoyer {employeeName}
                   </Button>
               </div>
             )}
             
             {/* Bouton de debug temporaire pour tous les employés */}
             <div style={{ display: 'flex', gap: '5px', marginTop: '10px' }}>
               <Button
                 style={{
                   backgroundColor: '#28a745',
                   color: 'white',
                   padding: '5px 10px',
                   fontSize: '10px',
                   border: 'none',
                   borderRadius: '3px',
                   cursor: 'pointer'
                 }}
                 onClick={() => {
                   console.log('DEBUG: Employé actuel =', employeeName, 'ID =', selectedEmployeeForMonthlyDetail);
                   alert(`DEBUG: Employé = ${employeeName} (ID: ${selectedEmployeeForMonthlyDetail})`);
                 }}
               >
                 🔍 Debug: {employeeName}
               </Button>
             </div>
             
        <Button
               className="button-retour"
          onClick={() => { 
                 console.log('EmployeeMonthlyDetailModal: Closing modal via button');
                 setShowEmployeeMonthlyDetail(false);
          }}
        >
          Fermer
        </Button>
           </div>
      </div>
    </div>
  );
};

export default EmployeeMonthlyDetailModal;
