import React, { useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getWeekPlanning, saveWeekPlanning } from '../../utils/PlanningDataManager';

const SimpleCopyPaste = ({ 
  planningData, 
  selectedShop, 
  selectedWeek, 
  currentShopEmployees, 
  setPlanning, 
  setLocalFeedback 
}) => {
  const [sourceWeek, setSourceWeek] = useState('');
  const [targetWeek, setTargetWeek] = useState('');
  const [sourceEmployee, setSourceEmployee] = useState('');
  const [targetEmployee, setTargetEmployee] = useState('');
  const [copiedData, setCopiedData] = useState(null);

  // Fonction simple pour copier un employé
  const copyEmployee = () => {
    if (!sourceEmployee || !sourceWeek) {
      setLocalFeedback('❌ Veuillez sélectionner un employé et une semaine source');
      return;
    }

    const sourceWeekData = getWeekPlanning(planningData, selectedShop, sourceWeek);
    const sourcePlanning = sourceWeekData.planning || {};
    const employeeData = sourcePlanning[sourceEmployee] || {};

    setCopiedData({
      type: 'employee',
      employee: sourceEmployee,
      sourceWeek: sourceWeek,
      data: employeeData
    });

    const employee = currentShopEmployees.find(emp => emp.id === sourceEmployee);
    setLocalFeedback(`✅ Créneaux de ${employee?.name || sourceEmployee} copiés depuis la semaine du ${format(new Date(sourceWeek), 'd MMMM yyyy', { locale: fr })}`);
  };

  // Fonction simple pour copier tous les employés
  const copyAllEmployees = () => {
    if (!sourceWeek) {
      setLocalFeedback('❌ Veuillez sélectionner une semaine source');
      return;
    }

    const sourceWeekData = getWeekPlanning(planningData, selectedShop, sourceWeek);
    const sourcePlanning = sourceWeekData.planning || {};

    setCopiedData({
      type: 'all',
      sourceWeek: sourceWeek,
      data: sourcePlanning
    });

    setLocalFeedback(`✅ Créneaux de tous les employés copiés depuis la semaine du ${format(new Date(sourceWeek), 'd MMMM yyyy', { locale: fr })}`);
  };

  // Fonction simple pour coller
  const pasteData = () => {
    if (!copiedData || !targetWeek) {
      setLocalFeedback('❌ Veuillez d\'abord copier des données et sélectionner une semaine cible');
      return;
    }

    const targetWeekData = getWeekPlanning(planningData, selectedShop, targetWeek);
    const targetPlanning = targetWeekData.planning || {};
    const newPlanning = { ...targetPlanning };

    if (copiedData.type === 'employee') {
      const employeeToPasteTo = targetEmployee || copiedData.employee;
      newPlanning[employeeToPasteTo] = { ...copiedData.data };
      
      const employee = currentShopEmployees.find(emp => emp.id === employeeToPasteTo);
      setLocalFeedback(`✅ Créneaux de ${employee?.name || employeeToPasteTo} collés vers la semaine du ${format(new Date(targetWeek), 'd MMMM yyyy', { locale: fr })}`);
    } else if (copiedData.type === 'all') {
      Object.assign(newPlanning, copiedData.data);
      setLocalFeedback(`✅ Créneaux de tous les employés collés vers la semaine du ${format(new Date(targetWeek), 'd MMMM yyyy', { locale: fr })}`);
    }

    saveWeekPlanning(planningData, selectedShop, targetWeek, newPlanning);
    
    if (targetWeek === selectedWeek) {
      setPlanning(newPlanning);
    }

    setCopiedData(null);
  };

  // Générer les options de semaines
  const generateWeekOptions = () => {
    const weeks = [];
    for (let i = -4; i <= 4; i++) {
      const weekStart = new Date(selectedWeek);
      weekStart.setDate(weekStart.getDate() + (i * 7));
      weeks.push({
        value: format(weekStart, 'yyyy-MM-dd'),
        label: `Semaine du ${format(weekStart, 'd MMMM yyyy', { locale: fr })}`
      });
    }
    return weeks;
  };

  return (
    <div style={{ 
      padding: '15px', 
      border: '1px solid #ddd', 
      borderRadius: '8px',
      backgroundColor: '#f9f9f9',
      marginTop: '20px'
    }}>
      <h3 style={{ fontFamily: 'Roboto, sans-serif', textAlign: 'center', marginBottom: '15px' }}>
        📋 Copier/Coller Simple (Version V8)
      </h3>
      
      {/* Indicateur de données copiées */}
      {copiedData && (
        <div style={{
          padding: '10px',
          backgroundColor: '#d4edda',
          border: '1px solid #c3e6cb',
          borderRadius: '4px',
          marginBottom: '15px',
          fontSize: '14px',
          color: '#155724'
        }}>
          📋 <strong>Données copiées :</strong> {copiedData.type === 'employee' ? 'Un employé' : 'Tous les employés'} - Semaine du {format(new Date(copiedData.sourceWeek), 'd MMMM yyyy', { locale: fr })}
        </div>
      )}
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
        {/* Employé source */}
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>Employé source</label>
          <select
            value={sourceEmployee}
            onChange={(e) => setSourceEmployee(e.target.value)}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
          >
            <option value="">Sélectionner un employé</option>
            {currentShopEmployees.map(employee => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
          </select>
        </div>

        {/* Semaine source */}
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>Semaine source</label>
          <select
            value={sourceWeek}
            onChange={(e) => setSourceWeek(e.target.value)}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
          >
            <option value="">Sélectionner une semaine</option>
            {generateWeekOptions().map(week => (
              <option key={week.value} value={week.value}>
                {week.label}
              </option>
            ))}
          </select>
        </div>

        {/* Semaine cible */}
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>Semaine cible</label>
          <select
            value={targetWeek}
            onChange={(e) => setTargetWeek(e.target.value)}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
          >
            <option value="">Sélectionner une semaine</option>
            {generateWeekOptions().map(week => (
              <option key={week.value} value={week.value}>
                {week.label}
              </option>
            ))}
          </select>
        </div>

        {/* Employé cible */}
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>Employé cible</label>
          <select
            value={targetEmployee}
            onChange={(e) => setTargetEmployee(e.target.value)}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
          >
            <option value="">Même employé</option>
            {currentShopEmployees.map(employee => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Boutons d'action */}
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
        <button
          onClick={copyEmployee}
          style={{
            padding: '10px 20px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          📋 Copier un employé
        </button>
        <button
          onClick={copyAllEmployees}
          style={{
            padding: '10px 20px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          📋 Copier tous
        </button>
        <button
          onClick={pasteData}
          style={{
            padding: '10px 20px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          📎 Coller
        </button>
      </div>
    </div>
  );
};

export default SimpleCopyPaste; 
