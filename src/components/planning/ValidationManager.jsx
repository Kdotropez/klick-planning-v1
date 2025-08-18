import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { loadFromLocalStorage, saveToLocalStorage } from '../../utils/localStorage';

const ValidationManager = ({ 
  selectedShop, 
  selectedWeek, 
  selectedEmployees, 
  planning,
  onValidationChange,
  currentShopEmployees = [],
  autoLockEnabled = true,
  onAutoLockToggle = null
}) => {
  const [validationState, setValidationState] = useState({
    isWeekValidated: false,
    validatedEmployees: [],
    lockedEmployees: []
  });
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [showRevalidateModal, setShowRevalidateModal] = useState(false);
  const [selectedEmployeeToUnlock, setSelectedEmployeeToUnlock] = useState('');
  const [selectedEmployeeToRevalidate, setSelectedEmployeeToRevalidate] = useState('');

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
      console.log('💾 Sauvegarde de l\'état de validation:', validationState);
      saveToLocalStorage(`validation_${selectedShop}_${selectedWeek}`, validationState);
      if (onValidationChange) {
        console.log('🔄 Propagation de l\'état vers le parent');
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

  // Revalider les employés débloqués
  const revalidateUnlockedEmployees = () => {
    setValidationState(prev => ({
      ...prev,
      lockedEmployees: [...new Set([...selectedEmployees])]
    }));
  };

  // Revalider un employé spécifique
  const revalidateEmployee = (employeeId) => {
    setValidationState(prev => ({
      ...prev,
      lockedEmployees: [...new Set([...prev.lockedEmployees, employeeId])]
    }));
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

  // Vérifier si la semaine est validée (même si certains employés sont débloqués)
  const isWeekValidated = validationState.isWeekValidated;

  // Obtenir la liste des employés verrouillés avec leurs noms réels
  const getLockedEmployees = () => {
    console.log('Debug - validationState:', validationState);
    console.log('Debug - currentShopEmployees:', currentShopEmployees);
    console.log('Debug - lockedEmployees:', validationState.lockedEmployees);
    
    return validationState.lockedEmployees
      .map(empId => {
        const employee = currentShopEmployees.find(emp => emp.id === empId);
        console.log('Debug - employee found for', empId, ':', employee);
        return {
          id: empId,
          name: employee?.name || empId
        };
      });
  };

  // Obtenir la liste des employés débloqués avec leurs noms réels
  const getUnlockedEmployees = () => {
    const unlockedEmployeeIds = selectedEmployees.filter(empId => !validationState.lockedEmployees.includes(empId));
    
    return unlockedEmployeeIds
      .map(empId => {
        const employee = currentShopEmployees.find(emp => emp.id === empId);
        return {
          id: empId,
          name: employee?.name || empId
        };
      });
  };

  // Débloquer tous les employés
  const unlockAllEmployees = () => {
    console.log('🔓 unlockAllEmployees appelé');
    console.log('🔓 État avant déverrouillage:', validationState);
    
    // Forcer le déverrouillage complet
    const newState = {
      isWeekValidated: false, // Réinitialiser la validation de semaine
      validatedEmployees: [], // Vider les employés validés
      lockedEmployees: [] // Vider les employés verrouillés
    };
    
    console.log('🔓 Nouvel état après déverrouillage:', newState);
    setValidationState(newState);
    
    // Forcer la sauvegarde immédiate
    if (selectedShop && selectedWeek) {
      console.log('🔓 Sauvegarde forcée du nouvel état');
      saveToLocalStorage(`validation_${selectedShop}_${selectedWeek}`, newState);
      if (onValidationChange) {
        console.log('🔓 Propagation forcée vers le parent');
        onValidationChange(newState);
      }
    }
    
    setShowUnlockModal(false);
    setSelectedEmployeeToUnlock('');
    console.log('🔓 Déverrouillage de tous les employés terminé');
  };

  // Vérifier s'il y a des employés verrouillés
  const hasLockedEmployees = validationState.lockedEmployees.length > 0;

  return (
    <div className="validation-manager" style={{
      backgroundColor: '#f8f9fa',
      border: '2px solid #dee2e6',
      borderRadius: '8px',
      padding: '15px',
      margin: '10px 0',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    }}>
      <h4 style={{ margin: '0 0 10px 0', color: '#495057', fontSize: '16px' }}>
        🔒 Gestion du verrouillage
      </h4>
      <div className="validation-controls" style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '10px',
        alignItems: 'center'
      }}>
        {console.log('🔍 ValidationManager rendu - État:', validationState)}
        {console.log('🔍 Employés verrouillés:', validationState.lockedEmployees)}
        {console.log('🔍 Semaine validée:', validationState.isWeekValidated)}
        
        {/* Bouton de test */}
        <button
          onClick={() => {
            console.log('🔍 Bouton de test cliqué !');
            alert('Bouton de test fonctionne !');
          }}
          style={{
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '6px 12px',
            fontSize: '12px',
            cursor: 'pointer',
            fontWeight: 'bold',
            marginRight: '10px'
          }}
        >
          🧪 Test
        </button>
        
        {/* Contrôle du verrouillage automatique - Aligné avec les autres boutons */}
        {onAutoLockToggle && (
          <button
            onClick={onAutoLockToggle}
            style={{
              backgroundColor: autoLockEnabled ? '#28a745' : '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '6px 12px',
              fontSize: '12px',
              cursor: 'pointer',
              fontWeight: 'bold',
              transition: 'all 0.2s ease',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              marginRight: '10px'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
            }}
            title={autoLockEnabled ? 
              'Verrouillage automatique activé - Cliquer pour désactiver' : 
              'Verrouillage automatique désactivé - Cliquer pour activer'
            }
          >
            {autoLockEnabled ? '🔒 Auto-verrouillage ON' : '🔓 Auto-verrouillage OFF'}
          </button>
        )}

        {/* Bouton de validation de la semaine */}
        {!isWeekValidated && (
          <button
            onClick={() => setShowValidationModal(true)}
            style={{
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '6px 12px',
              fontSize: '12px',
              cursor: 'pointer',
              fontWeight: 'bold',
              transition: 'all 0.2s ease',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              marginRight: '10px'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
            }}
          >
            🔒 Valider la semaine
          </button>
        )}
         {isWeekValidated && hasLockedEmployees && getUnlockedEmployees().length > 0 && (
           <div className="validation-status">
             <button 
               className="btn btn-success btn-sm"
               onClick={() => setShowRevalidateModal(true)}
             >
               🔒 Revalider employé
             </button>
           </div>
         )}
         
         {isWeekValidated && !hasLockedEmployees && (
           <div className="validation-status">
             <button 
               className="btn btn-success btn-sm"
               onClick={revalidateUnlockedEmployees}
             >
               🔒 Revalider tous les employés
             </button>
           </div>
         )}

        {/* Bouton de déverrouillage - toujours visible si des employés sont verrouillés */}
        {hasLockedEmployees && (
          <button
            onClick={() => setShowUnlockModal(true)}
            style={{
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '6px 12px',
              fontSize: '12px',
              cursor: 'pointer',
              fontWeight: 'bold',
              transition: 'all 0.2s ease',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              marginRight: '10px'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
            }}
          >
            🔓 Déverrouiller
          </button>
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
             <h4>🔓 Débloquer des employés</h4>
             <p>Choisissez une option :</p>
             
             <div className="unlock-options">
               <button 
                 className="btn btn-danger btn-block"
                 onClick={unlockAllEmployees}
               >
                 🔓 Débloquer TOUS les employés
               </button>
               
               <div className="separator">
                 <span>OU</span>
               </div>
               
               <div className="individual-unlock">
                 <p>Sélectionnez un employé spécifique :</p>
                 <select 
                   value={selectedEmployeeToUnlock}
                   onChange={(e) => setSelectedEmployeeToUnlock(e.target.value)}
                   className="form-select"
                 >
                   <option value="">Choisir un employé...</option>
                   {getLockedEmployees().map(employee => (
                     <option key={employee.id} value={employee.id}>
                       {employee.name}
                     </option>
                   ))}
                 </select>
                 <button 
                   className="btn btn-warning"
                   onClick={() => unlockEmployee(selectedEmployeeToUnlock)}
                   disabled={!selectedEmployeeToUnlock}
                 >
                   🔓 Débloquer cet employé
                 </button>
               </div>
             </div>
             
             <div className="modal-actions">
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

        {/* Modal de revalidation */}
        {showRevalidateModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h4>🔒 Revalider un employé</h4>
              <p>Sélectionnez un employé à revalider :</p>
              
              <div className="revalidate-options">
                <div className="individual-revalidate">
                  <select 
                    value={selectedEmployeeToRevalidate}
                    onChange={(e) => setSelectedEmployeeToRevalidate(e.target.value)}
                    className="form-select"
                  >
                    <option value="">Choisir un employé...</option>
                    {getUnlockedEmployees().map(employee => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name}
                      </option>
                    ))}
                  </select>
                  <button 
                    className="btn btn-success"
                    onClick={() => {
                      if (selectedEmployeeToRevalidate) {
                        revalidateEmployee(selectedEmployeeToRevalidate);
                        setShowRevalidateModal(false);
                        setSelectedEmployeeToRevalidate('');
                      }
                    }}
                    disabled={!selectedEmployeeToRevalidate}
                  >
                    🔒 Revalider cet employé
                  </button>
                </div>
              </div>
              
              <div className="modal-actions">
                <button 
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowRevalidateModal(false);
                    setSelectedEmployeeToRevalidate('');
                  }}
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

         .badge-info {
           background: #17a2b8;
           color: white;
         }

         .badge-warning {
           background: #ffc107;
           color: #212529;
         }

                 .form-select {
           width: 100%;
           padding: 0.5rem;
           border: 1px solid #ddd;
           border-radius: 4px;
           margin: 1rem 0;
         }

         .unlock-options {
           margin: 1.5rem 0;
         }

         .btn-block {
           width: 100%;
           margin-bottom: 1rem;
         }

         .btn-danger {
           background: #dc3545;
           color: white;
         }

         .separator {
           text-align: center;
           margin: 1rem 0;
           position: relative;
         }

         .separator::before {
           content: '';
           position: absolute;
           top: 50%;
           left: 0;
           right: 0;
           height: 1px;
           background: #ddd;
         }

         .separator span {
           background: white;
           padding: 0 1rem;
           color: #666;
           font-weight: bold;
         }

         .individual-unlock {
           margin-top: 1rem;
         }

         .individual-unlock p {
           margin-bottom: 0.5rem;
           font-weight: bold;
         }
      `}</style>
    </div>
  );
};

export default ValidationManager; 