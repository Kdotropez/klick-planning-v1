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
  const [sourceWeek, setSourceWeek] = useState('');
  const [destinationWeek, setDestinationWeek] = useState('');
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [availableWeeks, setAvailableWeeks] = useState([]);
  const [availableEmployees, setAvailableEmployees] = useState([]);
  const [feedback, setFeedback] = useState('');
  const [copiedData, setCopiedData] = useState(null);

  // Générer les semaines disponibles (8 semaines avant et après la semaine actuelle)
  useEffect(() => {
    if (selectedWeek) {
      const currentDate = parseISO(selectedWeek);
      const weeks = [];
      
      for (let i = -8; i <= 8; i++) {
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

  // Fonction de copie simplifiée
  const handleCopy = useCallback(() => {
    try {
      setFeedback('🔄 Copie en cours...');
      
      if (!sourceWeek) {
        setFeedback('❌ Veuillez sélectionner une semaine source');
        return;
      }

      if (selectedEmployees.length === 0) {
        setFeedback('❌ Veuillez sélectionner au moins un employé');
        return;
      }

      // Récupérer les données source
      const sourceData = getWeekPlanning(planningData, selectedShop, sourceWeek);
      console.log('🔍 Données source récupérées:', sourceData);
      
      if (!sourceData.planning || Object.keys(sourceData.planning).length === 0) {
        setFeedback('❌ Aucune donnée à copier dans la semaine source');
        return;
      }

      // Préparer les données à copier
      const dataToCopy = {};
      
      selectedEmployees.forEach(empId => {
        if (sourceData.planning[empId]) {
          dataToCopy[empId] = {};
          
          // Copier tous les jours de l'employé
          Object.keys(sourceData.planning[empId]).forEach(dayKey => {
            if (sourceData.planning[empId][dayKey] && Array.isArray(sourceData.planning[empId][dayKey])) {
              dataToCopy[empId][dayKey] = [...sourceData.planning[empId][dayKey]];
            }
          });
        }
      });

      // Sauvegarder dans localStorage
      const copyBuffer = {
        data: dataToCopy,
        sourceWeek,
        selectedEmployees,
        timestamp: Date.now()
      };
      
      localStorage.setItem('copyPasteBuffer', JSON.stringify(copyBuffer));
      setCopiedData(copyBuffer);

      const employeeCount = selectedEmployees.length;
      const sourceWeekStart = format(new Date(sourceWeek), 'dd/MM');
      const sourceWeekEnd = format(new Date(new Date(sourceWeek).getTime() + 6 * 24 * 60 * 60 * 1000), 'dd/MM');
      
      setFeedback(`✅ Copie réussie : ${employeeCount} employé(s) de la semaine du ${sourceWeekStart} au ${sourceWeekEnd}`);

    } catch (error) {
      console.error('Erreur lors de la copie:', error);
      setFeedback('❌ Erreur lors de la copie');
    }
  }, [planningData, selectedShop, sourceWeek, selectedEmployees]);

  // Fonction de collage simplifiée
  const handlePaste = useCallback(() => {
    try {
      setFeedback('🔄 Collage en cours...');
      
      if (!destinationWeek) {
        setFeedback('❌ Veuillez sélectionner une semaine de destination');
        return;
      }

      if (!copiedData) {
        setFeedback('❌ Aucune donnée copiée. Veuillez d\'abord copier des données.');
        return;
      }

      // Récupérer les données de destination actuelles
      const destinationData = getWeekPlanning(planningData, selectedShop, destinationWeek);
      const currentPlanning = destinationData.planning || {};
      
      console.log('🔍 Données destination récupérées:', destinationData);

      // Vérifier s'il y a des données existantes à écraser
      const hasExistingData = Object.keys(currentPlanning).some(empId => 
        Object.keys(currentPlanning[empId] || {}).length > 0
      );

      if (hasExistingData) {
        const existingWeekStart = format(new Date(destinationWeek), 'dd/MM');
        const existingWeekEnd = format(new Date(new Date(destinationWeek).getTime() + 6 * 24 * 60 * 60 * 1000), 'dd/MM');
        const confirmOverwrite = window.confirm(
          `⚠️ Attention : Des données existent déjà dans la semaine du ${existingWeekStart} au ${existingWeekEnd}.\n\nVoulez-vous les écraser ?`
        );
        if (!confirmOverwrite) {
          setFeedback('❌ Collage annulé');
          return;
        }
      }

      // Préparer les nouvelles données
      const newPlanning = { ...currentPlanning };

      // Transformer les dates de la semaine source vers la semaine destination
      const sourceWeekStart = parseISO(copiedData.sourceWeek);
      const targetWeekStart = parseISO(destinationWeek);

      Object.keys(copiedData.data).forEach(empId => {
        if (!newPlanning[empId]) {
          newPlanning[empId] = {};
        }
        
        Object.keys(copiedData.data[empId]).forEach(dayKey => {
          // Vérifier si c'est une date valide
          if (dayKey.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const sourceDay = parseISO(dayKey);
            const dayIndex = differenceInDays(sourceDay, sourceWeekStart);
            const targetDay = format(addDays(targetWeekStart, dayIndex), 'yyyy-MM-dd');
            newPlanning[empId][targetDay] = [...copiedData.data[empId][dayKey]];
          }
        });
      });

      console.log('🔍 Nouvelles données à sauvegarder:', newPlanning);

      // Sauvegarder les nouvelles données
      const updatedPlanningData = saveWeekPlanning(
        planningData, 
        selectedShop, 
        destinationWeek, 
        newPlanning, 
        destinationData.selectedEmployees || []
      );

      setPlanningData(updatedPlanningData);
      
      const successWeekStart = format(new Date(destinationWeek), 'dd/MM');
      const successWeekEnd = format(new Date(new Date(destinationWeek).getTime() + 6 * 24 * 60 * 60 * 1000), 'dd/MM');
      
      setFeedback(`✅ Collage réussi vers la semaine du ${successWeekStart} au ${successWeekEnd}`);
      
      // Vider le buffer de copie
      setCopiedData(null);
      localStorage.removeItem('copyPasteBuffer');

    } catch (error) {
      console.error('Erreur lors du collage:', error);
      setFeedback('❌ Erreur lors du collage');
    }
  }, [planningData, selectedShop, destinationWeek, copiedData, setPlanningData]);

  // Fonction pour vider le buffer de copie
  const clearCopyBuffer = () => {
    setCopiedData(null);
    localStorage.removeItem('copyPasteBuffer');
    setFeedback('🗑️ Buffer de copie vidé');
  };

  return (
    <div style={{ 
      padding: '20px', 
      maxWidth: '800px', 
      margin: '0 auto',
      backgroundColor: '#f5f5f5',
      minHeight: '100vh'
    }}>
      <div style={{ 
        backgroundColor: 'white', 
        padding: '20px', 
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ marginBottom: '20px', color: '#333' }}>
          📋 Copier-Coller de Planning
        </h2>

        {/* Section Copie */}
        <div style={{ marginBottom: '30px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
          <h3 style={{ marginBottom: '15px', color: '#495057' }}>📤 COPIE</h3>
          
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Semaine source :
            </label>
            <select 
              value={sourceWeek} 
              onChange={(e) => setSourceWeek(e.target.value)}
              style={{ 
                width: '100%', 
                padding: '8px', 
                borderRadius: '4px', 
                border: '1px solid #ddd' 
              }}
            >
              <option value="">Sélectionner une semaine</option>
              {availableWeeks.map(week => (
                <option key={week.key} value={week.key}>
                  {week.label}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Employés à copier :
            </label>
            <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '4px', padding: '10px' }}>
              {availableEmployees.map(emp => (
                <label key={emp.id} style={{ display: 'block', marginBottom: '5px' }}>
                  <input
                    type="checkbox"
                    checked={selectedEmployees.includes(emp.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedEmployees([...selectedEmployees, emp.id]);
                      } else {
                        setSelectedEmployees(selectedEmployees.filter(id => id !== emp.id));
                      }
                    }}
                    style={{ marginRight: '8px' }}
                  />
                  {emp.name}
                </label>
              ))}
            </div>
          </div>

          <button
            onClick={handleCopy}
            style={{
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '10px 20px',
              fontSize: '14px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            📋 Copier
          </button>
        </div>

        {/* Section Collage */}
        <div style={{ marginBottom: '30px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
          <h3 style={{ marginBottom: '15px', color: '#495057' }}>📥 COLLAGE</h3>
          
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Semaine de destination :
            </label>
            <select 
              value={destinationWeek} 
              onChange={(e) => setDestinationWeek(e.target.value)}
              style={{ 
                width: '100%', 
                padding: '8px', 
                borderRadius: '4px', 
                border: '1px solid #ddd' 
              }}
            >
              <option value="">Sélectionner une semaine</option>
              {availableWeeks.map(week => (
                <option key={week.key} value={week.key}>
                  {week.label}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handlePaste}
              disabled={!copiedData}
              style={{
                backgroundColor: copiedData ? '#28a745' : '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                padding: '10px 20px',
                fontSize: '14px',
                cursor: copiedData ? 'pointer' : 'not-allowed',
                fontWeight: 'bold'
              }}
            >
              📥 Coller
            </button>

            {copiedData && (
              <button
                onClick={clearCopyBuffer}
                style={{
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '10px 20px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                🗑️ Vider
              </button>
            )}
          </div>
        </div>

        {/* Feedback */}
        {feedback && (
          <div style={{ 
            padding: '10px', 
            borderRadius: '4px', 
            backgroundColor: feedback.includes('✅') ? '#d4edda' : feedback.includes('❌') ? '#f8d7da' : '#d1ecf1',
            color: feedback.includes('✅') ? '#155724' : feedback.includes('❌') ? '#721c24' : '#0c5460',
            marginBottom: '20px'
          }}>
            {feedback}
          </div>
        )}

        {/* Informations sur les données copiées */}
        {copiedData && (
          <div style={{ 
            padding: '15px', 
            backgroundColor: '#e7f3ff', 
            borderRadius: '6px',
            marginBottom: '20px'
          }}>
            <h4 style={{ marginBottom: '10px', color: '#0056b3' }}>📋 Données copiées :</h4>
            <p><strong>Semaine source :</strong> {format(new Date(copiedData.sourceWeek), 'dd/MM/yyyy')}</p>
            <p><strong>Employés :</strong> {copiedData.selectedEmployees.length} employé(s)</p>
            <p><strong>Copié le :</strong> {format(new Date(copiedData.timestamp), 'dd/MM/yyyy à HH:mm')}</p>
          </div>
        )}

        {/* Bouton retour */}
        <button
          onClick={onBack}
          style={{
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '10px 20px',
            fontSize: '14px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          ← Retour au planning
        </button>
      </div>
    </div>
  );
};

export default CopyPastePage; 