import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const NotesModal = ({
  showNotesModal,
  setShowNotesModal,
  selectedShop,
  selectedWeek,
  employees,
  planningData,
  onSaveNotes
}) => {
  const [notes, setNotes] = useState({});
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedDay, setSelectedDay] = useState('');

  // Générer les jours de la semaine
  const weekDays = [];
  const startDate = new Date(selectedWeek);
  for (let i = 0; i < 7; i++) {
    const day = new Date(startDate);
    day.setDate(startDate.getDate() + i);
    weekDays.push({
      date: day,
      key: format(day, 'yyyy-MM-dd'),
      label: format(day, 'EEEE dd/MM', { locale: fr })
    });
  }

  // Charger les notes existantes
  useEffect(() => {
    if (showNotesModal && selectedShop && selectedWeek) {
      const existingNotes = localStorage.getItem(`notes_${selectedShop}_${selectedWeek}`);
      if (existingNotes) {
        setNotes(JSON.parse(existingNotes));
      }
    }
  }, [showNotesModal, selectedShop, selectedWeek]);

  // Sauvegarder les notes
  const handleSaveNotes = () => {
    if (selectedShop && selectedWeek) {
      localStorage.setItem(`notes_${selectedShop}_${selectedWeek}`, JSON.stringify(notes));
      if (onSaveNotes) {
        onSaveNotes(notes);
      }
      setShowNotesModal(false);
    }
  };

  // Ajouter une note
  const addNote = () => {
    if (!selectedEmployee || !selectedDay) {
      alert('Veuillez sélectionner un employé et un jour');
      return;
    }

    const noteKey = `${selectedEmployee}_${selectedDay}`;
    const newNote = prompt('Entrez votre note (heures supplémentaires, congés, etc.) :');
    
    if (newNote) {
      setNotes(prev => ({
        ...prev,
        [noteKey]: {
          employee: selectedEmployee,
          day: selectedDay,
          note: newNote,
          timestamp: new Date().toISOString()
        }
      }));
    }
  };

  // Supprimer une note
  const deleteNote = (noteKey) => {
    if (confirm('Voulez-vous vraiment supprimer cette note ?')) {
      setNotes(prev => {
        const newNotes = { ...prev };
        delete newNotes[noteKey];
        return newNotes;
      });
    }
  };

  // Obtenir le nom de l'employé
  const getEmployeeName = (employeeId) => {
    const employee = employees.find(emp => emp.id === employeeId);
    return employee ? employee.name : employeeId;
  };

  if (!showNotesModal) return null;

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
        padding: '25px',
        width: '90%',
        maxWidth: '800px',
        maxHeight: '90vh',
        overflow: 'auto',
        position: 'relative'
      }}>
        {/* En-tête */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          paddingBottom: '15px',
          borderBottom: '2px solid #dee2e6'
        }}>
          <h2 style={{ margin: 0, color: '#333' }}>📝 Notes et Heures Supplémentaires</h2>
          <button
            onClick={() => setShowNotesModal(false)}
            style={{
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            ❌ Fermer
          </button>
        </div>

        {/* Sélecteurs */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '15px',
          marginBottom: '20px'
        }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Employé :
            </label>
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            >
              <option value="">Sélectionner un employé</option>
              {employees.map(employee => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Jour :
            </label>
            <select
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            >
              <option value="">Sélectionner un jour</option>
              {weekDays.map(day => (
                <option key={day.key} value={day.key}>
                  {day.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Bouton Ajouter */}
        <button
          onClick={addNote}
          style={{
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            marginBottom: '20px'
          }}
        >
          ➕ Ajouter une note
        </button>

        {/* Liste des notes */}
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ marginBottom: '15px', color: '#333' }}>Notes existantes :</h3>
          {Object.keys(notes).length === 0 ? (
            <p style={{ color: '#666', fontStyle: 'italic' }}>Aucune note enregistrée</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {Object.entries(notes).map(([key, note]) => (
                <div
                  key={key}
                  style={{
                    border: '1px solid #dee2e6',
                    borderRadius: '8px',
                    padding: '15px',
                    backgroundColor: '#f8f9fa'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '8px'
                  }}>
                    <div>
                      <strong style={{ color: '#333' }}>
                        {getEmployeeName(note.employee)}
                      </strong>
                      <span style={{ color: '#666', marginLeft: '10px' }}>
                        - {format(new Date(note.day), 'EEEE dd/MM/yyyy', { locale: fr })}
                      </span>
                    </div>
                    <button
                      onClick={() => deleteNote(key)}
                      style={{
                        backgroundColor: '#dc3545',
                        color: 'white',
                        border: 'none',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                  <div style={{
                    backgroundColor: 'white',
                    padding: '10px',
                    borderRadius: '4px',
                    border: '1px solid #e9ecef'
                  }}>
                    {note.note}
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: '#666',
                    marginTop: '5px'
                  }}>
                    Créé le {format(new Date(note.timestamp), 'dd/MM/yyyy à HH:mm', { locale: fr })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Boutons d'action */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '10px',
          paddingTop: '15px',
          borderTop: '1px solid #dee2e6'
        }}>
          <button
            onClick={() => setShowNotesModal(false)}
            style={{
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Annuler
          </button>
          <button
            onClick={handleSaveNotes}
            style={{
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600'
            }}
          >
            💾 Sauvegarder
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotesModal; 