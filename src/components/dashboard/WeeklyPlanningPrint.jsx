import React, { useRef } from 'react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';
import { fr } from 'date-fns/locale';
import { calculateEmployeeDailyHours, formatWorkedHoursForDisplay } from '../../utils/planningUtils';
import { getSlotEndTimeFormatted } from '../../utils/slotDurationUtils';
import { getWeekPlanning, determineEmployeeMainShop } from '../../utils/planningDataManager';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import {
  buildLandscapeHtmlDocument,
  openOrDownloadLandscapeHtml,
} from '../../utils/htmlLandscapeExport';

const WeeklyPlanningPrint = ({
  selectedShop,
  selectedWeek,
  planningData,
  shops,
  employees,
  config,
  onClose
}) => {
     const printRef = useRef();

       // Fonction pour calculer la taille de police dynamique
    const calculateDynamicFontSize = () => {
      const containerWidth = printRef.current?.clientWidth || 800;
      const containerHeight = printRef.current?.clientHeight || 600;
      
      // Calculer la taille de base en fonction de la largeur du conteneur (plus important pour les cellules)
      let baseFontSize = Math.min(containerWidth / 80, containerHeight / 60);
      
      // Limiter la taille entre 8px et 18px pour une meilleure adaptation
      baseFontSize = Math.max(8, Math.min(18, baseFontSize));
      
      return {
        base: baseFontSize,
        small: Math.max(6, baseFontSize * 0.75), // Plus petit pour les horaires
        large: Math.max(10, baseFontSize * 1.2), // Plus grand pour le total
        header: Math.max(12, baseFontSize * 1.4),
        title: Math.max(16, baseFontSize * 1.8)
      };
    };

   // Obtenir les tailles de police dynamiques
   const fontSizes = calculateDynamicFontSize();

     // Obtenir les données de la semaine
   const weekStart = startOfWeek(new Date(selectedWeek), { weekStartsOn: 1 });
   const weekEnd = endOfWeek(new Date(selectedWeek), { weekStartsOn: 1 });
   const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
   
   // Debug pour voir les jours de la semaine
   if (!window.debugInfo) window.debugInfo = [];
   window.debugInfo.push(`📅 Semaine affichée: ${format(weekStart, 'dd/MM/yyyy')} au ${format(weekEnd, 'dd/MM/yyyy')}`);
   window.debugInfo.push(`📅 Jours de la semaine: ${weekDays.map(day => format(day, 'dd/MM/yyyy')).join(', ')}`);

  // Obtenir tous les employés (pas seulement ceux de la boutique)
  const shopEmployees = employees;

  // Obtenir le nom de la boutique
  const shopName = shops.find(shop => shop.id === selectedShop)?.name || selectedShop;

  // Fonction pour obtenir les heures d'un employé pour un jour
  const getEmployeeHours = (employeeId, day) => {
    const dayKey = format(day, 'yyyy-MM-dd');
    const weekKey = format(weekStart, 'yyyy-MM-dd');
    
    const weekData = getWeekPlanning(planningData, selectedShop, weekKey);
    if (!weekData.planning || !weekData.planning[employeeId] || !weekData.planning[employeeId][dayKey]) {
      return 0;
    }
    
    const slots = weekData.planning[employeeId][dayKey];
    return calculateEmployeeDailyHours(employeeId, dayKey, { [employeeId]: { [dayKey]: slots } }, config);
  };

  // Fonction pour obtenir les horaires détaillés d'un employé pour un jour
  const getEmployeeSchedule = (employeeId, day) => {
    const dayKey = format(day, 'yyyy-MM-dd');
    const weekKey = format(weekStart, 'yyyy-MM-dd');
    
    const weekData = getWeekPlanning(planningData, selectedShop, weekKey);
    if (!weekData.planning || !weekData.planning[employeeId] || !weekData.planning[employeeId][dayKey]) {
      return { periods: [], hours: 0 };
    }
    
    const slots = weekData.planning[employeeId][dayKey];
    if (!Array.isArray(slots) || !slots.some(slot => slot === true)) {
      return { periods: [], hours: 0 };
    }
    
    const periods = [];
    let currentStart = null;
    let lastIdx = null;

    for (let i = 0; i < slots.length && i < config.timeSlots.length; i++) {
      if (slots[i] === true) {
        if (currentStart === null) {
          currentStart = config.timeSlots[i];
          lastIdx = i;
        } else {
          lastIdx = i;
        }
      } else if (currentStart !== null) {
        periods.push({
          start: currentStart,
          end: getSlotEndTimeFormatted(config.timeSlots, lastIdx, config),
        });
        currentStart = null;
        lastIdx = null;
      }
    }

    if (currentStart !== null && lastIdx !== null) {
      periods.push({
        start: currentStart,
        end: getSlotEndTimeFormatted(config.timeSlots, lastIdx, config),
      });
    }
    
    const hours = calculateEmployeeDailyHours(employeeId, dayKey, { [employeeId]: { [dayKey]: slots } }, config);
    
    // Debug pour voir ce qui se passe
    console.log(`getEmployeeSchedule for ${employeeId} on ${dayKey}:`, {
      slots: slots.slice(0, 10), // Afficher les 10 premiers créneaux
      timeSlots: config.timeSlots?.slice(0, 10),
      periods: periods.map(p => `${p.start} - ${p.end}`), // Afficher les périodes en format lisible
      periodsCount: periods.length,
      hours
    });
    
    return { periods, hours };
  };

  // Fonction pour obtenir le statut d'un employé pour un jour
  const getEmployeeStatus = (employeeId, day) => {
    const dayKey = format(day, 'yyyy-MM-dd');
    const weekKey = format(weekStart, 'yyyy-MM-dd');
    
    const employee = employees.find(emp => emp.id === employeeId);
    const canWorkInThisShop = employee?.canWorkIn?.includes(selectedShop);
    
         // Debug simplifié - seulement pour CHRISTINE, MANON, YHONNA, VALOU, ANGELIQUE
     if (employee?.name === 'CHRISTINE' || employee?.name === 'MANON' || employee?.name === 'YHONNA' || employee?.name === 'VALOU' || employee?.name === 'ANGELIQUE') {
       // Stocker les informations de debug dans une variable globale
       if (!window.debugInfo) window.debugInfo = [];
       window.debugInfo.push(`🔍 ${employee?.name} ${dayKey}: canWorkIn=${JSON.stringify(employee?.canWorkIn)}, selectedShop=${selectedShop}, worksInMultipleShops=${employee?.canWorkIn && employee.canWorkIn.length > 1}`);
       
       // Debug spécial pour le 23 août
       if (dayKey === '2025-08-23') {
         window.debugInfo.push(`🎯 ${employee?.name} 23/08 SPÉCIAL: canWorkIn=${JSON.stringify(employee?.canWorkIn)}, selectedShop=${selectedShop}`);
       }
     }
    
         // Si l'employé ne peut pas travailler dans cette boutique, c'est "Non présent"
     if (!canWorkInThisShop) {
       if (employee?.name === 'CHRISTINE' || employee?.name === 'MANON' || employee?.name === 'YHONNA') {
         if (!window.debugInfo) window.debugInfo = [];
         window.debugInfo.push(`❌ ${employee?.name} ne peut pas travailler dans ${selectedShop} → Non présent`);
       }
       return 'Non présent';
     }
    
    // Vérifier si l'employé travaille dans plusieurs boutiques
    const worksInMultipleShops = employee?.canWorkIn && employee.canWorkIn.length > 1;
    
    // Vérifier si l'employé travaille dans cette boutique ce jour-là
    const weekData = getWeekPlanning(planningData, selectedShop, weekKey);
    const hasDataInThisShop = weekData.planning && 
                             weekData.planning[employeeId] && 
                             weekData.planning[employeeId][dayKey];
    
         if (employee?.name === 'CHRISTINE' || employee?.name === 'MANON' || employee?.name === 'YHONNA' || employee?.name === 'VALOU' || employee?.name === 'ANGELIQUE') {
       if (!window.debugInfo) window.debugInfo = [];
       window.debugInfo.push(`📊 ${employee?.name} ${dayKey}: hasDataInThisShop=${hasDataInThisShop}, worksInMultipleShops=${worksInMultipleShops}`);
     }
    
    // Calculer les heures travaillées dans cette boutique
    let hours = 0;
    if (hasDataInThisShop) {
      const slots = weekData.planning[employeeId][dayKey];
      hours = calculateEmployeeDailyHours(employeeId, dayKey, { [employeeId]: { [dayKey]: slots } }, config);
    }
    
    if (employee?.name === 'CHRISTINE' || employee?.name === 'MANON' || employee?.name === 'YHONNA' || employee?.name === 'VALOU' || employee?.name === 'ANGELIQUE') {
      if (!window.debugInfo) window.debugInfo = [];
      window.debugInfo.push(`⏰ ${employee?.name} ${dayKey}: ${hours}h dans ${selectedShop}`);
    }
    
    // Si l'employé a des heures dans cette boutique
    if (hours > 0) {
      if (hours < 4) {
        return 'Demi-journée';
      } else {
        return 'Présent';
      }
    }
    
    // Si l'employé n'a pas d'heures dans cette boutique (0h ou pas de données)
    if (worksInMultipleShops) {
      // Pour les employés multi-boutiques, vérifier s'ils travaillent dans d'autres boutiques
      let workingShop = null;
      
      for (const shopId of employee.canWorkIn) {
        if (shopId === selectedShop) continue; // Ignorer la boutique actuelle
        
        const otherShopWeekData = getWeekPlanning(planningData, shopId, weekKey);
        const hasData = otherShopWeekData.planning && 
               otherShopWeekData.planning[employeeId] && 
               otherShopWeekData.planning[employeeId][dayKey];
        const otherHours = hasData ? calculateEmployeeDailyHours(employeeId, dayKey, { [employeeId]: { [dayKey]: otherShopWeekData.planning[employeeId][dayKey] } }, config) : 0;
        
        // Debug détaillé pour VALOU
        if (employee?.name === 'VALOU' && (dayKey === '2025-08-21' || dayKey === '2025-08-24')) {
          if (!window.debugInfo) window.debugInfo = [];
          window.debugInfo.push(`🔍 VALOU ${dayKey} - Boutique ${shopId}: hasData=${hasData}, hours=${otherHours}`);
        }
        
        if (hasData && otherHours > 0) {
          workingShop = shopId;
          break; // Trouvé la boutique où elle travaille
        }
      }
      
      // Debug spécial pour VALOU le jeudi et dimanche
      if (employee?.name === 'VALOU' && (dayKey === '2025-08-21' || dayKey === '2025-08-24')) {
        if (!window.debugInfo) window.debugInfo = [];
        window.debugInfo.push(`🎯 VALOU ${dayKey} RÉSULTAT: workingShop=${workingShop} → ${workingShop ? workingShop : 'Repos'}`);
      }
      
      if (employee?.name === 'CHRISTINE' || employee?.name === 'MANON' || employee?.name === 'YHONNA' || employee?.name === 'VALOU' || employee?.name === 'ANGELIQUE') {
        if (!window.debugInfo) window.debugInfo = [];
        window.debugInfo.push(`🔄 ${employee?.name} ${dayKey}: multi-boutique avec 0h, travaille dans une autre boutique: ${workingShop} → ${workingShop ? workingShop : 'Repos'}`);
      }
      
      if (workingShop) {
        // Retourner le nom de la boutique où elle travaille
        const shopName = shops.find(shop => shop.id === workingShop)?.name || workingShop;
        return shopName;
      } else {
        return 'Repos';
      }
    } else {
      // Pour les employés mono-boutique, c'est "Repos" (congé)
      if (employee?.name === 'CHRISTINE' || employee?.name === 'MANON' || employee?.name === 'YHONNA' || employee?.name === 'VALOU' || employee?.name === 'ANGELIQUE') {
        if (!window.debugInfo) window.debugInfo = [];
        window.debugInfo.push(`🏖️ ${employee?.name} ${dayKey}: mono-boutique avec 0h → Repos`);
      }
      return 'Repos';
    }
  };

  const handleExportHtml = () => {
    if (!printRef.current) return;

    const title = `Planning hebdomadaire — ${shopName}`;
    const weekLabel = `${format(weekStart, 'dd/MM/yyyy')} – ${format(weekEnd, 'dd/MM/yyyy')}`;
    const bodyHtml = `<div class="schedule-sheet weekly-print">${printRef.current.innerHTML}</div>`;
    const doc = buildLandscapeHtmlDocument({
      title,
      bodyHtml,
      metaLines: [
        `Boutique: ${shopName}`,
        `Semaine: ${weekLabel}`,
        `Genere le: ${new Date().toLocaleString('fr-FR')}`,
        'Mode paysage requis sur telephone pour une lecture optimale.',
      ],
    });
    const filename = `planning-hebdomadaire-${shopName}-${format(weekStart, 'yyyy-MM-dd')}.html`;
    const result = openOrDownloadLandscapeHtml(doc, { title, filename });
    if (result.mode === 'window') {
      alert('Planning HTML ouvert. Sur mobile, tournez votre telephone en mode paysage pour visualiser les horaires.');
    } else {
      alert('Planning HTML telecharge. Ouvrez le fichier sur mobile en mode paysage.');
    }
  };

  // Fonction pour imprimer
  const handlePrint = async () => {
    if (!printRef.current) return;

    try {
      // Créer une image de haute qualité
      const canvas = await html2canvas(printRef.current, {
        scale: 3, // Augmenter la résolution pour une meilleure qualité
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false, // Désactiver les logs pour de meilleures performances
        width: printRef.current.scrollWidth,
        height: printRef.current.scrollHeight
      });

      // Convertir en image PNG de haute qualité
      const imgData = canvas.toDataURL('image/png', 1.0);
      
             // Créer le PDF en mode paysage A4
       const pdf = new jsPDF('landscape', 'mm', 'a4');
      
      // Calculer les dimensions pour un rendu fidèle
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      // Calculer le ratio pour maintenir les proportions
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * pageWidth) / canvas.width;
      
      // Si l'image est trop haute, ajuster pour tenir sur une page
      let finalImgHeight = imgHeight;
      let yOffset = 0;
      
      if (imgHeight > pageHeight) {
        finalImgHeight = pageHeight;
        yOffset = 0;
      }
      
      // Ajouter l'image au PDF avec une qualité maximale
      pdf.addImage(imgData, 'PNG', 0, yOffset, imgWidth, finalImgHeight, '', 'FAST');
      
      // Sauvegarder le PDF avec un nom descriptif
      const fileName = `planning-hebdomadaire-${shopName}-${format(weekStart, 'yyyy-MM-dd')}.pdf`;
      pdf.save(fileName);
      
      onClose();
    } catch (error) {
      console.error('Erreur lors de l\'impression:', error);
      alert('Erreur lors de l\'impression. Veuillez réessayer.');
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
             <div style={{
         backgroundColor: 'white',
         borderRadius: '12px',
         padding: '20px',
         width: '98%',
         height: '98%',
         overflow: 'auto',
         position: 'relative'
       }}>
        {/* Boutons d'action */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          padding: '10px',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px'
        }}>
          <h2 style={{ margin: 0, color: '#333' }}>📋 Planning Hebdomadaire - Impression</h2>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handlePrint}
              style={{
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              🖨️ Imprimer PDF
            </button>
            <button
              onClick={handleExportHtml}
              style={{
                backgroundColor: '#0f766e',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              📱 HTML (paysage)
            </button>
                         <button
               onClick={() => {
                 if (window.debugInfo) {
                   // Créer un fichier texte téléchargeable
                   const debugText = window.debugInfo.join('\n');
                   const blob = new Blob([debugText], { type: 'text/plain' });
                   const url = URL.createObjectURL(blob);
                   const a = document.createElement('a');
                   a.href = url;
                   a.download = 'debug-info.txt';
                   document.body.appendChild(a);
                   a.click();
                   document.body.removeChild(a);
                   URL.revokeObjectURL(url);
                   
                   // Afficher aussi dans la console
                   console.log('=== DEBUG INFO ===');
                   console.log(debugText);
                   console.log('==================');
                 } else {
                   alert('Aucune info de debug disponible');
                 }
               }}
               style={{
                 backgroundColor: '#17a2b8',
                 color: 'white',
                 border: 'none',
                 padding: '10px 20px',
                 borderRadius: '6px',
                 cursor: 'pointer',
                 fontSize: '14px',
                 fontWeight: '600'
               }}
             >
               📄 Debug (Télécharger)
             </button>
             <button
               onClick={onClose}
               style={{
                 backgroundColor: '#dc3545',
                 color: 'white',
                 border: 'none',
                 padding: '10px 20px',
                 borderRadius: '6px',
                 cursor: 'pointer',
                 fontSize: '14px',
                 fontWeight: '600'
               }}
             >
               ❌ Fermer
             </button>
          </div>
        </div>

                 {/* Contenu à imprimer */}
         <div ref={printRef} style={{
           backgroundColor: 'white',
           padding: '15px',
           fontFamily: 'Arial, sans-serif',
           fontSize: `${fontSizes.base}px`,
           lineHeight: '1.3',
           width: '100%',
           height: '100%',
           display: 'flex',
           flexDirection: 'column'
         }}>
                     {/* En-tête */}
           <div style={{
             textAlign: 'center',
             marginBottom: '15px',
             borderBottom: '2px solid #333',
             paddingBottom: '12px',
             flexShrink: 0
           }}>
                         <h1 style={{ 
               margin: '0 0 8px 0', 
               fontSize: `${fontSizes.title}px`, 
               fontWeight: 'bold',
               color: '#333'
             }}>
               Planning Hebdomadaire
             </h1>
             <h2 style={{ 
               margin: '0 0 5px 0', 
               fontSize: `${fontSizes.header}px`, 
               fontWeight: 'bold',
               color: '#666'
             }}>
               {shopName}
             </h2>
             <p style={{ 
               margin: '0', 
               fontSize: `${fontSizes.large}px`, 
               color: '#666'
             }}>
               Du {format(weekStart, 'dd/MM/yyyy', { locale: fr })} au {format(weekEnd, 'dd/MM/yyyy', { locale: fr })}
             </p>
          </div>

                                {/* Tableau du planning */}
           <table style={{
             width: '100%',
             borderCollapse: 'collapse',
             marginBottom: '15px',
             border: '2px solid #333',
             flex: 1,
             display: 'flex',
             flexDirection: 'column'
           }}>
             <thead style={{ flexShrink: 0 }}>
               <tr style={{ 
                 backgroundColor: '#f8f9fa',
                 display: 'flex'
               }}>
                 <th style={{
                   border: '1px solid #333',
                   padding: '10px',
                   textAlign: 'center',
                   fontWeight: 'bold',
                   fontSize: `${fontSizes.base}px`,
                   flex: '0 0 15%',
                   display: 'flex',
                   alignItems: 'center',
                   justifyContent: 'center'
                 }}>
                   Jour
                 </th>
                                                                                                                                                                                                                   {shopEmployees.map((employee, empIndex) => (
                     <th key={empIndex} style={{
                       border: '1px solid #333',
                       padding: '10px',
                       textAlign: 'center',
                       fontWeight: 'bold',
                       fontSize: `${fontSizes.base}px`,
                       flex: 1,
                       display: 'flex',
                       alignItems: 'center',
                       justifyContent: 'center'
                     }}>
                       {employee.name}
                     </th>
                   ))}
               </tr>
             </thead>
                                        <tbody style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
               {weekDays.map((day, dayIndex) => (
                  <tr key={dayIndex} style={{ 
                   backgroundColor: dayIndex % 2 === 0 ? '#ffffff' : '#f8f9fa',
                   flex: 1,
                   display: 'flex'
                 }}>
                                                          <td style={{
                     border: '1px solid #333',
                     padding: '10px',
                     fontWeight: 'bold',
                     fontSize: `${fontSizes.base}px`,
                     flex: '0 0 15%',
                     display: 'flex',
                     flexDirection: 'column',
                     alignItems: 'center',
                     justifyContent: 'center'
                   }}>
                     <div>{format(day, 'EEEE', { locale: fr })}</div>
                     <div style={{ fontSize: `${fontSizes.small}px`, color: '#666' }}>
                       {format(day, 'dd/MM', { locale: fr })}
                     </div>
                   </td>
                                         {shopEmployees.map((employee, empIndex) => {
                       const status = getEmployeeStatus(employee.id, day);
                       const schedule = getEmployeeSchedule(employee.id, day);
                       
                       let backgroundColor = '#ffffff';
                       let color = '#333';
                       
                       // Vérifier si le statut est un nom de boutique (pour les employés multi-boutiques)
                       const isShopName = shops.some(shop => shop.name === status);
                       
                       if (isShopName) {
                         // Couleur spéciale pour les employés travaillant dans une autre boutique
                         backgroundColor = '#e3f2fd';
                         color = '#1565c0';
                       } else if (status === 'Non présent') {
                         backgroundColor = '#f8f9fa';
                         color = '#000000';
                       } else if (status === 'Repos') {
                         backgroundColor = '#ffe6e6';
                         color = '#000000';
                       } else if (status === 'Demi-journée') {
                         backgroundColor = '#fff8dc';
                         color = '#000000';
                       } else if (status === 'Présent') {
                         backgroundColor = '#e8f5e8';
                         color = '#000000';
                       }

                       return (
                         <td key={empIndex} style={{
                           border: '1px solid #333',
                           padding: '0',
                           backgroundColor,
                           color,
                           flex: 1,
                           display: 'flex',
                           flexDirection: 'row'
                         }}>
                                                       {/* Partie principale (2/3) - Données existantes */}
                            <div style={{
                              flex: '2',
                              padding: '6px',
                              textAlign: 'center',
                              fontSize: `${fontSizes.small}px`,
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'center',
                              alignItems: 'center',
                              borderRight: '1px solid #333',
                              height: `${Math.max(60, fontSizes.small * 4)}px`, // Hauteur adaptative basée sur la police
                              minHeight: '60px',
                              maxHeight: '100px'
                            }}>
                                                         {schedule.hours > 0 ? (
                              // Si l'employé a des horaires, afficher TOUJOURS sur 3 lignes fixes
                              <>
                                {/* Ligne 1: Première période ou arrivée */}
                                <div style={{ fontSize: `${fontSizes.small}px`, marginBottom: '2px', fontWeight: 'bold', color: '#333', height: `${Math.max(16, fontSizes.small * 1.5)}px`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                  {schedule.periods.length > 0 ? `${schedule.periods[0].start} - ${schedule.periods[0].end}` : '--:-- - --:--'}
                                </div>
                                
                                {/* Ligne 2: Deuxième période si elle existe, sinon vide */}
                                <div style={{ fontSize: `${fontSizes.small}px`, marginBottom: '2px', fontWeight: 'bold', color: '#333', height: `${Math.max(16, fontSizes.small * 1.5)}px`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                  {schedule.periods.length > 1 ? `${schedule.periods[1].start} - ${schedule.periods[1].end}` : ''}
                                </div>
                                
                                                                 {/* Ligne 3: Total heures */}
                                 <div style={{ fontSize: `${fontSizes.small}px`, fontWeight: 'bold', marginTop: '2px', color: '#1565c0', height: `${Math.max(16, fontSizes.small * 1.5)}px`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                   ({schedule.hours}h)
                                 </div>
                              </>
                            ) : (
                              // Si pas d'horaires, afficher le statut (Repos, nom de boutique, etc.)
                              <div style={{ fontWeight: 'bold', fontSize: `${fontSizes.base}px`, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                                {status}
                              </div>
                            )}
                           </div>
                           
                                                       {/* Partie heures supplémentaires (1/3) */}
                            <div style={{
                              flex: '1',
                              padding: '5px',
                              textAlign: 'center',
                              fontSize: `${fontSizes.small}px`,
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'center',
                              alignItems: 'center',
                              backgroundColor: '#fff3cd',
                              borderLeft: '1px solid #ffeaa7'
                            }}>
                              <div style={{ 
                                fontSize: `${fontSizes.small}px`,
                                color: '#856404',
                                fontStyle: 'italic',
                                minHeight: '20px'
                              }}>
                                --.-- H
                              </div>
                            </div>
                         </td>
                       );
                     })}
                    
                  </tr>
                ))}
                                 {/* Ligne de totaux par employé */}
                 <tr style={{ 
                   backgroundColor: '#f8f9fa', 
                   fontWeight: 'bold',
                   flexShrink: 0,
                   display: 'flex'
                 }}>
                                                        <td style={{
                     border: '1px solid #333',
                     padding: '10px',
                     textAlign: 'center',
                     fontWeight: 'bold',
                     fontSize: `${fontSizes.base}px`,
                     backgroundColor: '#e9ecef',
                     flex: '0 0 15%',
                     display: 'flex',
                     alignItems: 'center',
                     justifyContent: 'center'
                   }}>
                     Total Heures
                   </td>
                                     {shopEmployees.map((employee, empIndex) => {
                     let totalEmployeeHours = 0;
                     weekDays.forEach(day => {
                       totalEmployeeHours += getEmployeeHours(employee.id, day);
                     });

                     return (
                       <td key={empIndex} style={{
                         border: '1px solid #333',
                         padding: '0',
                         textAlign: 'center',
                         fontWeight: 'bold',
                         fontSize: `${fontSizes.base}px`,
                         backgroundColor: '#e9ecef',
                         flex: 1,
                         display: 'flex',
                         flexDirection: 'row'
                       }}>
                         {/* Partie principale (2/3) - Total heures normales */}
                         <div style={{
                           flex: '2',
                           padding: '10px',
                           display: 'flex',
                           alignItems: 'center',
                           justifyContent: 'center',
                           borderRight: '1px solid #333'
                         }}>
                           {formatWorkedHoursForDisplay(totalEmployeeHours)}
                         </div>
                         
                                                   {/* Partie heures supplémentaires (1/3) - Total heures supp. */}
                          <div style={{
                            flex: '1',
                            padding: '5px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: '#fff3cd',
                            borderLeft: '1px solid #ffeaa7',
                            fontSize: `${fontSizes.small}px`,
                            color: '#856404'
                          }}>
                            --.-- H
                          </div>
                       </td>
                     );
                   })}
                  
                </tr>
              </tbody>
           </table>

                     {/* Espaces pour signatures */}
           <div style={{
             display: 'flex',
             justifyContent: 'space-between',
             marginTop: '20px',
             paddingTop: '15px',
             borderTop: '2px solid #333',
             flexShrink: 0
           }}>
            <div style={{
              width: '45%',
              textAlign: 'center'
            }}>
                             <div style={{
                 border: '1px solid #333',
                 height: '80px',
                 marginBottom: '10px',
                 display: 'flex',
                 alignItems: 'center',
                 justifyContent: 'center',
                 backgroundColor: '#f8f9fa'
               }}>
                 <span style={{ color: '#666', fontSize: `${fontSizes.base}px` }}>Signature du Responsable</span>
               </div>
               <p style={{ margin: '0', fontSize: `${fontSizes.small}px`, color: '#666' }}>
                 Responsable de la boutique
               </p>
            </div>
            
                         <div style={{
               width: '45%',
               textAlign: 'center'
             }}>
               <div style={{
                 border: '1px solid #333',
                 height: '80px',
                 marginBottom: '10px',
                 display: 'flex',
                 alignItems: 'center',
                 justifyContent: 'center',
                 backgroundColor: '#f8f9fa'
               }}>
                 <span style={{ color: '#666', fontSize: `${fontSizes.base}px` }}>Signature des Employés</span>
               </div>
               <p style={{ margin: '0', fontSize: `${fontSizes.small}px`, color: '#666' }}>
                 Validation des employés
               </p>
             </div>
          </div>

                     

            {/* Zone de notes pour heures supplémentaires */}
            <div style={{
              marginTop: '20px',
              padding: '12px',
              backgroundColor: '#fff3cd',
              borderRadius: '6px',
              border: '1px solid #ffeaa7',
              fontSize: `${fontSizes.small}px`,
              color: '#856404',
              flexShrink: 0
            }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: `${fontSizes.base}px` }}>📝 Notes - Heures Supplémentaires :</h4>
              <div style={{ 
                border: '1px solid #ffeaa7', 
                backgroundColor: 'white', 
                minHeight: '60px', 
                padding: '8px',
                fontSize: `${fontSizes.small}px`,
                lineHeight: '1.4'
              }}>
                <p style={{ margin: '0 0 5px 0', fontStyle: 'italic', color: '#856404' }}>
                  Espace pour noter les heures supplémentaires, congés exceptionnels, ou remarques importantes :
                </p>
                <div style={{ 
                  borderTop: '1px dashed #ffeaa7', 
                  paddingTop: '8px',
                  minHeight: '40px'
                }}>
                  {/* Zone pour écrire manuellement */}
                </div>
              </div>
            </div>

                                {/* Pied de page */}
           <div style={{
             marginTop: '20px',
             textAlign: 'center',
             fontSize: `${fontSizes.small}px`,
             color: '#666',
             borderTop: '1px solid #ccc',
             paddingTop: '10px',
             flexShrink: 0
           }}>
             <p style={{ margin: '0 0 5px 0' }}>
               Document généré le {format(new Date(), 'dd/MM/yyyy à HH:mm', { locale: fr })} - 
               Planning hebdomadaire {shopName}
             </p>
             <p style={{ margin: '0', fontSize: `${fontSizes.small}px`, color: '#999' }}>
               © 2025 Klick Planning - Nicolas Lefevre - Tous droits réservés
             </p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default WeeklyPlanningPrint; 
