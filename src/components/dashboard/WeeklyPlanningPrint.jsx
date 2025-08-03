import React, { useRef } from 'react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';
import { fr } from 'date-fns/locale';
import { calculateEmployeeDailyHours } from '../../utils/planningUtils';
import { getWeekPlanning, determineEmployeeMainShop } from '../../utils/planningDataManager';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

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
     
     // Calculer la taille de base en fonction de la taille du conteneur
     let baseFontSize = Math.min(containerWidth / 50, containerHeight / 40);
     
     // Limiter la taille entre 12px et 20px pour une meilleure lisibilité
     baseFontSize = Math.max(12, Math.min(20, baseFontSize));
     
     return {
       base: baseFontSize,
       small: baseFontSize * 0.85,
       large: baseFontSize * 1.3,
       header: baseFontSize * 1.5,
       title: baseFontSize * 2.0
     };
   };

   // Obtenir les tailles de police dynamiques
   const fontSizes = calculateDynamicFontSize();

  // Obtenir les données de la semaine
  const weekStart = startOfWeek(new Date(selectedWeek), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(selectedWeek), { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

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
    
    // Analyser les créneaux pour trouver les périodes de travail
    const periods = [];
    let currentPeriod = null;
    
    for (let i = 0; i < slots.length && i < config.timeSlots.length; i++) {
      if (slots[i] === true) {
        // Début d'une nouvelle période
        if (currentPeriod === null) {
          currentPeriod = {
            start: config.timeSlots[i],
            end: config.timeSlots[i]
          };
        } else {
          // Continuer la période actuelle
          currentPeriod.end = config.timeSlots[i];
        }
      } else {
        // Fin d'une période
        if (currentPeriod !== null) {
          periods.push(currentPeriod);
          currentPeriod = null;
        }
      }
    }
    
    // Ajouter la dernière période si elle existe
    if (currentPeriod !== null) {
      periods.push(currentPeriod);
    }
    
    // Si aucune période trouvée mais des créneaux actifs, créer une période simple
    if (periods.length === 0 && slots.some(slot => slot === true)) {
      let firstActiveIndex = -1;
      let lastActiveIndex = -1;
      
      for (let i = 0; i < slots.length && i < config.timeSlots.length; i++) {
        if (slots[i] === true) {
          if (firstActiveIndex === -1) firstActiveIndex = i;
          lastActiveIndex = i;
        }
      }
      
      if (firstActiveIndex !== -1 && lastActiveIndex !== -1) {
        // Calculer l'heure de fin en ajoutant l'intervalle
        const startTime = config.timeSlots[firstActiveIndex];
        const endTime = config.timeSlots[lastActiveIndex];
        
        // Convertir en minutes pour calculer l'heure de fin
        const startMinutes = parseInt(startTime.split(':')[0]) * 60 + parseInt(startTime.split(':')[1]);
        const endMinutes = parseInt(endTime.split(':')[0]) * 60 + parseInt(endTime.split(':')[1]) + config.interval;
        const endTimeFormatted = `${Math.floor(endMinutes / 60).toString().padStart(2, '0')}:${(endMinutes % 60).toString().padStart(2, '0')}`;
        
        periods.push({
          start: startTime,
          end: endTimeFormatted
        });
      }
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
    
    // Vérifier si c'est la boutique principale de l'employé (même logique que Dashboard)
    const employee = employees.find(emp => emp.id === employeeId);
    const determinedMainShop = employee?.mainShop || determineEmployeeMainShop(planningData, employeeId);
    const isMainShop = determinedMainShop === selectedShop;
    const canWorkInThisShop = employee?.canWorkIn?.includes(selectedShop);
    
    // Debug pour voir les boutiques principales
    console.log(`getEmployeeStatus for ${employee?.name} (${employeeId}):`, {
      mainShop: employee?.mainShop,
      determinedMainShop,
      selectedShop,
      isMainShop,
      canWorkInThisShop
    });
    
    const weekData = getWeekPlanning(planningData, selectedShop, weekKey);
    if (!weekData.planning || !weekData.planning[employeeId] || !weekData.planning[employeeId][dayKey]) {
      // Si l'employé ne peut pas travailler dans cette boutique, c'est "Non présent"
      if (!canWorkInThisShop) {
        return 'Non présent';
      }
      // Si c'est sa boutique principale mais pas d'heures, c'est "Repos"
      if (isMainShop) {
        return 'Repos';
      }
      // Sinon, c'est "Non présent" (pas sa boutique principale)
      return 'Non présent';
    }
    
    const slots = weekData.planning[employeeId][dayKey];
    const hours = calculateEmployeeDailyHours(employeeId, dayKey, { [employeeId]: { [dayKey]: slots } }, config);
    
    if (hours === 0) {
      // Si l'employé ne peut pas travailler dans cette boutique, c'est "Non présent"
      if (!canWorkInThisShop) {
        return 'Non présent';
      }
      // Si c'est sa boutique principale mais pas d'heures, c'est "Repos"
      if (isMainShop) {
        return 'Repos';
      }
      // Sinon, c'est "Non présent" (pas sa boutique principale)
      return 'Non présent';
    } else if (hours < 4) {
      return 'Demi-journée';
    } else {
      return 'Présent';
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
      
      // Créer le PDF en mode portrait A4
      const pdf = new jsPDF('portrait', 'mm', 'a4');
      
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
                     <div>{employee.name}</div>
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
                      
                      if (status === 'Non présent') {
                        backgroundColor = '#e2e3e5';
                        color = '#495057';
                      } else if (status === 'Repos') {
                        backgroundColor = '#f8d7da';
                        color = '#721c24';
                      } else if (status === 'Demi-journée') {
                        backgroundColor = '#fff3cd';
                        color = '#856404';
                      } else if (status === 'Présent') {
                        backgroundColor = '#d4edda';
                        color = '#155724';
                      }

                      return (
                                                                          <td key={empIndex} style={{
                           border: '1px solid #333',
                           padding: '10px',
                           textAlign: 'center',
                           fontSize: `${fontSizes.small}px`,
                           backgroundColor,
                           color,
                           flex: 1,
                           display: 'flex',
                           flexDirection: 'column',
                           justifyContent: 'center',
                           alignItems: 'center'
                         }}>
                           <div style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: `${fontSizes.base}px` }}>
                             {status}
                           </div>
                           {schedule.hours > 0 && (
                             <>
                               {schedule.periods.map((period, periodIndex) => (
                                 <div key={periodIndex} style={{ fontSize: `${fontSizes.small}px`, marginBottom: '2px' }}>
                                   {period.start} - {period.end}
                                 </div>
                               ))}
                               <div style={{ fontSize: `${fontSizes.small}px`, fontWeight: 'bold', marginTop: '2px' }}>
                                 {schedule.hours}h
                               </div>
                             </>
                           )}
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
                         padding: '10px',
                         textAlign: 'center',
                         fontWeight: 'bold',
                         fontSize: `${fontSizes.base}px`,
                         backgroundColor: '#e9ecef',
                         flex: 1,
                         display: 'flex',
                         alignItems: 'center',
                         justifyContent: 'center'
                       }}>
                         {totalEmployeeHours.toFixed(1)}h
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

                     {/* Informations supplémentaires */}
           <div style={{
             marginTop: '20px',
             padding: '12px',
             backgroundColor: '#f8f9fa',
             borderRadius: '6px',
             fontSize: `${fontSizes.small}px`,
             color: '#666',
             flexShrink: 0
           }}>
                          <h4 style={{ margin: '0 0 10px 0', fontSize: `${fontSizes.base}px` }}>Légende :</h4>
             <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <div style={{ width: '15px', height: '15px', backgroundColor: '#d4edda', border: '1px solid #333' }}></div>
                  <span>Présent</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <div style={{ width: '15px', height: '15px', backgroundColor: '#fff3cd', border: '1px solid #333' }}></div>
                  <span>Demi-journée</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <div style={{ width: '15px', height: '15px', backgroundColor: '#f8d7da', border: '1px solid #333' }}></div>
                  <span>Repos</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <div style={{ width: '15px', height: '15px', backgroundColor: '#e2e3e5', border: '1px solid #333' }}></div>
                  <span>Non présent</span>
                </div>
              </div>
             
                                                       <h4 style={{ margin: '15px 0 10px 0', fontSize: `${fontSizes.base}px` }}>Informations sur les horaires :</h4>
             <div style={{ fontSize: `${fontSizes.small}px`, lineHeight: '1.4' }}>
                <p style={{ margin: '0 0 5px 0' }}>
                  <strong>Format des horaires :</strong> Chaque ligne = une période de travail (ex: 09:00 - 12:00)
                </p>
                <p style={{ margin: '0 0 5px 0' }}>
                  <strong>Pauses :</strong> Les espaces entre les périodes représentent les pauses
                </p>
                <p style={{ margin: '0 0 5px 0' }}>
                  <strong>Heures travaillées :</strong> Total des heures effectuées par jour
                </p>
                                 <p style={{ margin: '0 0 5px 0' }}>
                   <strong>Demi-journée :</strong> Moins de 4 heures de travail
                 </p>
                 <p style={{ margin: '0 0 5px 0' }}>
                   <strong>Présent :</strong> 4 heures ou plus de travail
                 </p>
                 <p style={{ margin: '0 0 5px 0' }}>
                   <strong>Repos :</strong> Employé en congé/vacances dans sa boutique principale
                 </p>
                 <p style={{ margin: '0' }}>
                   <strong>Non présent :</strong> Employé qui ne travaille pas dans cette boutique (pas sa boutique principale)
                 </p>
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