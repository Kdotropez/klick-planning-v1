import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { loadFromLocalStorage, saveToLocalStorage } from '../../utils/localStorage';

const ValidationManager = ({ 
  selectedShop, 
  selectedWeek, 
  selectedEmployees, 
  planning,
  onValidationChange 
}) => {
  const [validationState, setValidationState] = useState({
    isWeekValidated: false,
    validatedEmployees: [],
    lockedEmployees: []
  });
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [selectedEmployeeToUnlock, setSelectedEmployeeToUnlock] = useState('');

  // Charger l'état de validation
  useEffect(() => {
    if (selectedShop && selectedWeek) {
      const savedValidation = loadFromLocalStorage(
        `validation_${selectedShop}_${selectedWeek}`, 
        { isWeekValidated: false, validatedEmployees: [], lockedEmployees: [] }
      );
      setValidationState(savedValidation);
    }
  }, [selectedShop, selectedWeek]);

  // Sauvegarder l'état de validation
  useEffect(() => {
    if (selectedShop && selectedWeek) {
      saveToLocalStorage(`validation_${selectedShop}_${selectedWeek}`, validationState);
      if (onValidationChange) {
        onValidationChange(validationState);
      }
    }
  }, [validationState, selectedShop, selectedWeek, onValidationChange]);

  // Valider la semaine complète
  const validateWeek = () => {
    setValidationState(prev => ({
      ...prev,
      isWeekValidated: true,
      validatedEmployees: [...new Set([...prev.validatedEmployees, ...selectedEmployees])],
      lockedEmployees: [...new Set([...prev.lockedEmployees, ...selectedEmployees])]
    }));
    setShowValidationModal(false);
  };

  // Débloquer un employé spécifique
  const unlockEmployee = (employeeId) => {
    setValidationState(prev => ({
      ...prev,
      lockedEmployees: prev.lockedEmployees.filter(emp => emp !== employeeId)
    }));
    setShowUnlockModal(false);
    setSelectedEmployeeToUnlock('');
  };

  // Vérifier si un employé est verrouillé
  const isEmployeeLocked = (employeeId) => {
    return validationState.lockedEmployees.includes(employeeId);
  };

  // Vérifier si la semaine est validée
  const isWeekValidated = validationState.isWeekValidated;

  // Obtenir la liste des employés verrouillés
  const getLockedEmployees = () => {
    return selectedEmployees.filter(emp => isEmployeeLocked(emp));
  };

  return (
    <div className="validation-manager">
      {/* Bouton de validation */}
      <div className="validation-controls">
        {!isWeekValidated ? (
          <button 
            className="btn btn-success"
            onClick={() => setShowValidationModal(true)}
            disabled={selectedEmployees.length === 0}
          >
            🔒 Valider la semaine
          </button>
        ) : (
          <div className="validation-status">
            <span className="badge badge-success">✅ Semaine validée</span>
            <button 
              className="btn btn-warning btn-sm"
              onClick={() => setShowUnlockModal(true)}
            >
              🔓 Débloquer employé
            </button>
          </div>
        )}
      </div>

      

      {/* Modal de validation */}
      {showValidationModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h4>🔒 Valider la semaine</h4>
            <p>
              Êtes-vous sûr de vouloir valider la semaine du{' '}
              {format(new Date(selectedWeek), 'd MMMM yyyy', { locale: fr })} ?
            </p>
            <p className="warning">
              ⚠️ Cette action verrouillera tous les plannings des employés sélectionnés.
              Ils ne pourront plus être modifiés sans déblocage explicite.
            </p>
            <div className="modal-actions">
              <button 
                className="btn btn-success"
                onClick={validateWeek}
              >
                ✅ Confirmer la validation
              </button>
              <button 
                className="btn btn-secondary"
                onClick={() => setShowValidationModal(false)}
              >
                ❌ Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de déblocage */}
      {showUnlockModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h4>🔓 Débloquer un employé</h4>
            <p>Sélectionnez l'employé à débloquer :</p>
            <select 
              value={selectedEmployeeToUnlock}
              onChange={(e) => setSelectedEmployeeToUnlock(e.target.value)}
              className="form-select"
            >
              <option value="">Choisir un employé...</option>
              {getLockedEmployees().map(empId => (
                <option key={empId} value={empId}>
                  {empId}
                </option>
              ))}
            </select>
            <div className="modal-actions">
              <button 
                className="btn btn-warning"
                onClick={() => unlockEmployee(selectedEmployeeToUnlock)}
                disabled={!selectedEmployeeToUnlock}
              >
                🔓 Débloquer
              </button>
              <button 
                className="btn btn-secondary"
                onClick={() => setShowUnlockModal(false)}
              >
                ❌ Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .validation-manager {
          margin: 1rem 0;
          padding: 1rem;
          border: 1px solid #ddd;
          border-radius: 8px;
          background: #f8f9fa;
        }

        .validation-controls {
          display: flex;
          gap: 1rem;
          align-items: center;
          margin-bottom: 1rem;
        }

                 .validation-status {
           display: flex;
           gap: 1rem;
           align-items: center;
         }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal-content {
          background: white;
          padding: 2rem;
          border-radius: 8px;
          max-width: 500px;
          width: 90%;
        }

        .modal-actions {
          display: flex;
          gap: 1rem;
          margin-top: 1rem;
          justify-content: flex-end;
        }

        .warning {
          color: #dc3545;
          font-weight: bold;
          background: #f8d7da;
          padding: 0.5rem;
          border-radius: 4px;
        }

        .btn {
          padding: 0.5rem 1rem;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: bold;
        }

        .btn-success {
          background: #28a745;
          color: white;
        }

        .btn-warning {
          background: #ffc107;
          color: #212529;
        }

        .btn-secondary {
          background: #6c757d;
          color: white;
        }

        .btn-sm {
          padding: 0.25rem 0.5rem;
          font-size: 0.875rem;
        }

        .badge {
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 0.875rem;
        }

        .badge-success {
          background: #28a745;
          color: white;
        }

        .badge-secondary {
          background: #6c757d;
          color: white;
        }

        .form-select {
          width: 100%;
          padding: 0.5rem;
          border: 1px solid #ddd;
          border-radius: 4px;
          margin: 1rem 0;
        }
      `}</style>
    </div>
  );
};

export default ValidationManager; 