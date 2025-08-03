import React, { useState, useEffect, useCallback } from 'react';
import { format, addDays, parseISO, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getWeekPlanning, saveWeekPlanning } from '../../utils/planningDataManager';

const CopyPastePage = ({ 
  planningData, 
  setPlanningData,
  selectedShop, 
  selectedWeek,
  onBack 
}) => {
  const [copyMode, setCopyMode] = useState('week'); // 'week' ou 'day'
  const [pasteMode, setPasteMode] = useState('week'); // 'week' ou 'day'
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [sourceWeek, setSourceWeek] = useState('');
  const [sourceDay, setSourceDay] = useState('');
  const [destinationWeek, setDestinationWeek] = useState('');
  const [destinationDay, setDestinationDay] = useState('');
  const [availableWeeks, setAvailableWeeks] = useState([]);
  const [availableEmployees, setAvailableEmployees] = useState([]);
  const [feedback, setFeedback] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState(null);

  // Générer les semaines disponibles (4 semaines avant et après la semaine actuelle)
  useEffect(() => {
    if (selectedWeek) {
      const currentDate = parseISO(selectedWeek);
      const weeks = [];
      
             for (let i = -4; i <= 4; i++) {
         const weekDate = addDays(currentDate, i * 7);
         const weekKey = format(weekDate, 'yyyy-MM-dd');
         const monday = format(weekDate, 'EEEE dd/MM', { locale: fr });
         const sunday = format(addDays(weekDate, 6), 'EEEE dd/MM', { locale: fr });
         weeks.push({
           key: weekKey,
           label: `Semaine du ${monday} au ${sunday}`
         });
       }
      
      setAvailableWeeks(weeks);
      setSourceWeek(selectedWeek);
      setDestinationWeek(format(addDays(currentDate, 7), 'yyyy-MM-dd'));
    }
  }, [selectedWeek]);

  // Charger les employés de la boutique
  useEffect(() => {
    if (planningData && selectedShop) {
      const shop = planningData.shops?.find(s => s.id === selectedShop);
      if (shop?.employees) {
        const employees = shop.employees
          .filter(emp => emp.canWorkIn?.includes(selectedShop))
          .map(emp => ({
            id: emp.id,
            name: emp.name
          }));
        setAvailableEmployees(employees);
        setSelectedEmployees(employees.map(emp => emp.id)); // Sélectionner tous par défaut
      }
    }
  }, [planningData, selectedShop]);

  // Générer les jours de la semaine
  const generateWeekDays = (weekKey) => {
    if (!weekKey) return [];
    
    const weekStart = parseISO(weekKey);
    const days = [];
    
    for (let i = 0; i < 7; i++) {
      const dayDate = addDays(weekStart, i);
      days.push({
        key: format(dayDate, 'yyyy-MM-dd'),
        label: format(dayDate, 'EEEE dd/MM', { locale: fr })
      });
    }
    
    return days;
  };

  const sourceWeekDays = generateWeekDays(sourceWeek);
  const destinationWeekDays = generateWeekDays(destinationWeek);

  // Fonction de copie
  const handleCopy = useCallback(() => {
    try {
      setFeedback('🔄 Copie en cours...');
      setShowPreview(false); // Masquer la visualisation précédente
      
             // Récupérer les données source
       const sourceData = getWeekPlanning(planningData, selectedShop, sourceWeek);
       
       console.log('🔍 Données source récupérées:', sourceData);
       console.log('🔍 Planning source:', sourceData.planning);
       
       if (!sourceData.planning || Object.keys(sourceData.planning).length === 0) {
         setFeedback('❌ Aucune donnée à copier dans la semaine source');
         return;
       }

      // Préparer les données à copier
      let dataToCopy = {};
      
             if (copyMode === 'week') {
         // Copier toute la semaine pour les employés sélectionnés
         selectedEmployees.forEach(empId => {
           if (sourceData.planning[empId]) {
             // Transformer les clés de dates pour correspondre à la semaine destination
             const transformedData = {};
             Object.keys(sourceData.planning[empId]).forEach(dayKey => {
               // Vérifier si c'est une date valide (pas un index numérique)
               if (dayKey.match(/^\d{4}-\d{2}-\d{2}$/)) {
                 const sourceWeekStart = parseISO(sourceWeek);
                 const dayIndex = differenceInDays(parseISO(dayKey), sourceWeekStart);
                 // Générer la date de destination (semaine suivante par défaut)
                 const destinationWeekStart = addDays(sourceWeekStart, 7);
                 const targetDay = format(addDays(destinationWeekStart, dayIndex), 'yyyy-MM-dd');
                 transformedData[targetDay] = [...sourceData.planning[empId][dayKey]];
               } else {
                 // Garder les données non-dates telles quelles
                 transformedData[dayKey] = [...sourceData.planning[empId][dayKey]];
               }
             });
             dataToCopy[empId] = transformedData;
           }
         });
       } else {
         // Copier seulement le jour sélectionné
         if (!sourceDay) {
           setFeedback('❌ Veuillez sélectionner un jour source');
           return;
         }
         
         selectedEmployees.forEach(empId => {
           if (sourceData.planning[empId]?.[sourceDay]) {
             dataToCopy[empId] = { [sourceDay]: [...sourceData.planning[empId][sourceDay]] };
           }
         });
       }

      // Sauvegarder dans localStorage pour le collage
      localStorage.setItem('copyPasteBuffer', JSON.stringify({
        data: dataToCopy,
        mode: copyMode,
        sourceWeek,
        sourceDay,
        selectedEmployees,
        timestamp: Date.now()
      }));

      const employeeCount = selectedEmployees.length;
      const modeText = copyMode === 'week' ? 'semaine' : 'jour';
      setFeedback(`✅ Copie réussie : ${employeeCount} employé(s) pour la ${modeText} du ${sourceWeek}${sourceDay ? ` (jour ${sourceDay})` : ''}`);

    } catch (error) {
      console.error('Erreur lors de la copie:', error);
      setFeedback('❌ Erreur lors de la copie');
    }
  }, [planningData, selectedShop, sourceWeek, sourceDay, selectedEmployees, copyMode]);

  // Fonction de collage
  const handlePaste = useCallback(() => {
    try {
      setFeedback('🔄 Collage en cours...');
      
             // Récupérer les données copiées
       const bufferData = localStorage.getItem('copyPasteBuffer');
       if (!bufferData) {
         setFeedback('❌ Aucune donnée copiée. Veuillez d\'abord copier des données.');
         return;
       }

       const buffer = JSON.parse(bufferData);
       const { data: copiedData, mode: copiedMode, sourceWeek: originalSourceWeek } = buffer;
       
       console.log('🔍 Données copiées récupérées:', copiedData);
       console.log('🔍 Mode copié:', copiedMode);
       console.log('🔍 Semaine source originale:', originalSourceWeek);

      // Vérifier la compatibilité
      if (copiedMode === 'day' && pasteMode === 'week') {
        setFeedback('❌ Impossible de coller un jour dans une semaine complète');
        return;
      }

             // Récupérer les données de destination actuelles
       const destinationData = getWeekPlanning(planningData, selectedShop, destinationWeek);
       const currentPlanning = destinationData.planning || {};
       
       console.log('🔍 Données destination récupérées:', destinationData);
       console.log('🔍 Planning destination actuel:', currentPlanning);

       // Vérifier s'il y a des données existantes à écraser
       const hasExistingData = Object.keys(currentPlanning).some(empId => 
         Object.keys(currentPlanning[empId] || {}).length > 0
       );

       if (hasExistingData) {
         const confirmOverwrite = window.confirm(
           '⚠️ Attention : Des données existent déjà dans la semaine de destination. Voulez-vous les écraser ?'
         );
         if (!confirmOverwrite) {
           setFeedback('❌ Collage annulé');
           return;
         }
       }

       // Préparer les nouvelles données
       let newPlanning = { ...currentPlanning };

             if (pasteMode === 'week') {
         // Coller dans toute la semaine
         Object.keys(copiedData).forEach(empId => {
           if (!newPlanning[empId]) {
             newPlanning[empId] = {};
           }
           
                        Object.keys(copiedData[empId]).forEach(dayKey => {
               // Transformer la date si nécessaire
               if (copiedMode === 'day') {
                 // Si on copie un jour vers une semaine, répéter ce jour pour toute la semaine
                 const weekStart = parseISO(destinationWeek);
                 for (let i = 0; i < 7; i++) {
                   const targetDay = format(addDays(weekStart, i), 'yyyy-MM-dd');
                   newPlanning[empId][targetDay] = [...copiedData[empId][dayKey]];
                 }
               } else {
                 // Les dates sont déjà transformées lors de la copie, on peut les utiliser directement
                 newPlanning[empId][dayKey] = [...copiedData[empId][dayKey]];
               }
             });
         });
      } else {
        // Coller dans un jour spécifique
        if (!destinationDay) {
          setFeedback('❌ Veuillez sélectionner un jour de destination');
          return;
        }

        Object.keys(copiedData).forEach(empId => {
          if (!newPlanning[empId]) {
            newPlanning[empId] = {};
          }
          
          // Prendre le premier jour des données copiées
          const sourceDayData = Object.values(copiedData[empId])[0];
          if (sourceDayData) {
            newPlanning[empId][destinationDay] = [...sourceDayData];
          }
                 });
       }

       console.log('🔍 Données finales avant sauvegarde:', newPlanning);

       // Sauvegarder les nouvelles données
       const updatedPlanningData = saveWeekPlanning(
         planningData, 
         selectedShop, 
         destinationWeek, 
         newPlanning, 
         destinationData.selectedEmployees || []
       );

       console.log('🔍 Nouvelles données sauvegardées:', newPlanning);
       console.log('🔍 PlanningData mis à jour:', updatedPlanningData);

       setPlanningData(updatedPlanningData);

      // Préparer les données pour la visualisation
      const previewInfo = {
        destinationWeek,
        destinationDay,
        pasteMode,
        planning: newPlanning,
        employees: availableEmployees.filter(emp => selectedEmployees.includes(emp.id))
      };
      
      setPreviewData(previewInfo);
      setShowPreview(true);

      const modeText = pasteMode === 'week' ? 'semaine' : 'jour';
      setFeedback(`✅ Collage réussi vers la ${modeText} du ${destinationWeek}${destinationDay ? ` (jour ${destinationDay})` : ''}`);

    } catch (error) {
      console.error('Erreur lors du collage:', error);
      setFeedback('❌ Erreur lors du collage');
    }
  }, [planningData, selectedShop, destinationWeek, destinationDay, pasteMode, setPlanningData]);

  // Toggle sélection d'employé
  const toggleEmployee = (empId) => {
    setSelectedEmployees(prev => 
      prev.includes(empId) 
        ? prev.filter(id => id !== empId)
        : [...prev, empId]
    );
    setShowPreview(false); // Masquer la visualisation quand on change les employés
  };

  // Sélectionner/désélectionner tous les employés
  const toggleAllEmployees = () => {
    if (selectedEmployees.length === availableEmployees.length) {
      setSelectedEmployees([]);
    } else {
      setSelectedEmployees(availableEmployees.map(emp => emp.id));
    }
    setShowPreview(false); // Masquer la visualisation quand on change les employés
  };

  return (
    <div style={{
      padding: '20px',
      maxWidth: '1200px',
      margin: '0 auto',
      backgroundColor: '#f8f9fa',
      minHeight: '100vh'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '30px',
        padding: '20px',
        backgroundColor: 'white',
        borderRadius: '10px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{ margin: 0, color: '#333' }}>📋 Copier-Coller Avancé</h1>
        <button
          onClick={onBack}
          style={{
            padding: '10px 20px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          ← Retour
        </button>
      </div>

      {/* Feedback */}
      {feedback && (
        <div style={{
          padding: '15px',
          marginBottom: '20px',
          borderRadius: '5px',
          backgroundColor: feedback.includes('✅') ? '#d4edda' : '#f8d7da',
          color: feedback.includes('✅') ? '#155724' : '#721c24',
          border: `1px solid ${feedback.includes('✅') ? '#c3e6cb' : '#f5c6cb'}`
        }}>
          {feedback}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        
        {/* SECTION COPIE */}
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '10px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ color: '#007bff', marginBottom: '20px' }}>📋 COPIE</h2>
          
          {/* Mode de copie */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>
              Mode de copie :
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <input
                  type="radio"
                  value="week"
                  checked={copyMode === 'week'}
                  onChange={(e) => setCopyMode(e.target.value)}
                />
                Semaine complète
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <input
                  type="radio"
                  value="day"
                  checked={copyMode === 'day'}
                  onChange={(e) => setCopyMode(e.target.value)}
                />
                Jour spécifique
              </label>
            </div>
          </div>

          {/* Semaine source */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>
              Semaine source :
            </label>
            <select
              value={sourceWeek}
              onChange={(e) => {
                setSourceWeek(e.target.value);
                setShowPreview(false);
              }}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '5px'
              }}
            >
              {availableWeeks.map(week => (
                <option key={week.key} value={week.key}>
                  {week.label}
                </option>
              ))}
            </select>
          </div>

          {/* Jour source (si mode jour) */}
          {copyMode === 'day' && (
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>
                Jour source :
              </label>
              <select
                value={sourceDay}
                onChange={(e) => {
                  setSourceDay(e.target.value);
                  setShowPreview(false);
                }}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '5px'
                }}
              >
                <option value="">Sélectionner un jour</option>
                {sourceWeekDays.map(day => (
                  <option key={day.key} value={day.key}>
                    {day.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Employés à copier */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <label style={{ fontWeight: 'bold' }}>
                Employés à copier :
              </label>
              <button
                onClick={toggleAllEmployees}
                style={{
                  padding: '5px 10px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                {selectedEmployees.length === availableEmployees.length ? 'Désélectionner tout' : 'Sélectionner tout'}
              </button>
            </div>
            <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '5px', padding: '10px' }}>
              {availableEmployees.map(emp => (
                <label key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '5px' }}>
                  <input
                    type="checkbox"
                    checked={selectedEmployees.includes(emp.id)}
                    onChange={() => toggleEmployee(emp.id)}
                  />
                  {emp.name}
                </label>
              ))}
            </div>
          </div>

          {/* Bouton Copier */}
          <button
            onClick={handleCopy}
            style={{
              width: '100%',
              padding: '15px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold'
            }}
          >
            📋 Copier
          </button>
        </div>

        {/* SECTION COLLAGE */}
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '10px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ color: '#dc3545', marginBottom: '20px' }}>📌 COLLAGE</h2>
          
          {/* Mode de collage */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>
              Mode de collage :
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <input
                  type="radio"
                  value="week"
                  checked={pasteMode === 'week'}
                  onChange={(e) => setPasteMode(e.target.value)}
                />
                Semaine complète
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <input
                  type="radio"
                  value="day"
                  checked={pasteMode === 'day'}
                  onChange={(e) => setPasteMode(e.target.value)}
                />
                Jour spécifique
              </label>
            </div>
          </div>

          {/* Semaine destination */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>
              Semaine destination :
            </label>
            <select
              value={destinationWeek}
              onChange={(e) => {
                setDestinationWeek(e.target.value);
                setShowPreview(false);
              }}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '5px'
              }}
            >
              {availableWeeks.map(week => (
                <option key={week.key} value={week.key}>
                  {week.label}
                </option>
              ))}
            </select>
          </div>

          {/* Jour destination (si mode jour) */}
          {pasteMode === 'day' && (
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>
                Jour destination :
              </label>
              <select
                value={destinationDay}
                onChange={(e) => {
                  setDestinationDay(e.target.value);
                  setShowPreview(false);
                }}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '5px'
                }}
              >
                <option value="">Sélectionner un jour</option>
                {destinationWeekDays.map(day => (
                  <option key={day.key} value={day.key}>
                    {day.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Informations sur les données copiées */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>
              Données en mémoire :
            </label>
            <div style={{
              padding: '10px',
              backgroundColor: '#f8f9fa',
              border: '1px solid #ddd',
              borderRadius: '5px',
              minHeight: '60px'
            }}>
              {(() => {
                const bufferData = localStorage.getItem('copyPasteBuffer');
                if (!bufferData) {
                  return <span style={{ color: '#6c757d' }}>Aucune donnée copiée</span>;
                }
                
                try {
                  const buffer = JSON.parse(bufferData);
                  const employeeCount = buffer.selectedEmployees?.length || 0;
                  const modeText = buffer.mode === 'week' ? 'semaine' : 'jour';
                  return (
                    <div>
                      <div>✅ {employeeCount} employé(s) copié(s)</div>
                      <div>📅 {modeText} du {buffer.sourceWeek}</div>
                      {buffer.sourceDay && <div>📆 Jour : {buffer.sourceDay}</div>}
                    </div>
                  );
                } catch (error) {
                  return <span style={{ color: '#dc3545' }}>Erreur dans les données copiées</span>;
                }
              })()}
            </div>
          </div>

          {/* Bouton Coller */}
          <button
            onClick={handlePaste}
            style={{
              width: '100%',
              padding: '15px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold'
            }}
          >
            📌 Coller
          </button>
        </div>
      </div>

      {/* Visualisation du planning collé */}
      {showPreview && previewData && (
        <div style={{
          marginTop: '30px',
          padding: '20px',
          backgroundColor: '#f8f9fa',
          border: '2px solid #28a745',
          borderRadius: '10px',
          boxShadow: '0 4px 12px rgba(40, 167, 69, 0.2)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
            paddingBottom: '10px',
            borderBottom: '2px solid #28a745'
          }}>
            <h3 style={{ margin: 0, color: '#28a745', fontSize: '18px' }}>
              📋 Visualisation du planning collé
            </h3>
            <button
              onClick={() => setShowPreview(false)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '20px',
                cursor: 'pointer',
                color: '#6c757d',
                padding: '5px'
              }}
            >
              ✕
            </button>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <strong>Destination :</strong> {previewData.pasteMode === 'week' ? 'Semaine' : 'Jour'} du {previewData.destinationWeek}
            {previewData.destinationDay && ` (${previewData.destinationDay})`}
          </div>

          <div style={{ marginBottom: '15px' }}>
            <strong>Employés :</strong> {previewData.employees.length} employé(s)
          </div>

          {/* Tableau de visualisation */}
          <div style={{
            overflowX: 'auto',
            border: '1px solid #dee2e6',
            borderRadius: '5px',
            backgroundColor: 'white'
          }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '12px'
            }}>
              <thead>
                <tr style={{ backgroundColor: '#e9ecef' }}>
                  <th style={{
                    padding: '8px',
                    border: '1px solid #dee2e6',
                    textAlign: 'center',
                    minWidth: '100px'
                  }}>
                    Employé
                  </th>
                  {previewData.pasteMode === 'week' ? (
                    // Afficher les 7 jours de la semaine
                    Array.from({ length: 7 }, (_, i) => {
                      const dayDate = addDays(parseISO(previewData.destinationWeek), i);
                      return (
                        <th key={i} style={{
                          padding: '8px',
                          border: '1px solid #dee2e6',
                          textAlign: 'center',
                          minWidth: '80px'
                        }}>
                          {format(dayDate, 'EEEE dd/MM', { locale: fr })}
                        </th>
                      );
                    })
                  ) : (
                    // Afficher seulement le jour spécifique
                    <th style={{
                      padding: '8px',
                      border: '1px solid #dee2e6',
                      textAlign: 'center',
                      minWidth: '80px'
                    }}>
                      {previewData.destinationDay ? format(parseISO(previewData.destinationDay), 'EEEE dd/MM', { locale: fr }) : 'Jour'}
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {previewData.employees.map(emp => (
                  <tr key={emp.id}>
                    <td style={{
                      padding: '8px',
                      border: '1px solid #dee2e6',
                      fontWeight: 'bold',
                      backgroundColor: '#f8f9fa'
                    }}>
                      {emp.name}
                    </td>
                    {previewData.pasteMode === 'week' ? (
                      // Afficher les données pour chaque jour de la semaine
                      Array.from({ length: 7 }, (_, i) => {
                        const dayDate = format(addDays(parseISO(previewData.destinationWeek), i), 'yyyy-MM-dd');
                        const dayData = previewData.planning[emp.id]?.[dayDate];
                        const hasSlots = dayData && dayData.some(slot => slot === true);
                        
                        return (
                          <td key={i} style={{
                            padding: '8px',
                            border: '1px solid #dee2e6',
                            textAlign: 'center',
                            backgroundColor: hasSlots ? '#d4edda' : '#f8f9fa'
                          }}>
                            {hasSlots ? '✅' : '❌'}
                          </td>
                        );
                      })
                    ) : (
                      // Afficher les données pour le jour spécifique
                      <td style={{
                        padding: '8px',
                        border: '1px solid #dee2e6',
                        textAlign: 'center',
                        backgroundColor: previewData.planning[emp.id]?.[previewData.destinationDay]?.some(slot => slot === true) ? '#d4edda' : '#f8f9fa'
                      }}>
                        {previewData.planning[emp.id]?.[previewData.destinationDay]?.some(slot => slot === true) ? '✅' : '❌'}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{
            marginTop: '15px',
            padding: '10px',
            backgroundColor: '#d4edda',
            border: '1px solid #c3e6cb',
            borderRadius: '5px',
            fontSize: '14px',
            color: '#155724'
          }}>
            💡 <strong>Rappel :</strong> Les données ont été collées avec succès. Vous pouvez maintenant retourner au planning principal pour voir les modifications.
          </div>
        </div>
      )}
    </div>
  );
};

export default CopyPastePage; 