import React, { useState, useEffect } from 'react';
import Button from '../common/Button';
import { hideEmployee, showEmployee, getHiddenEmployees, isEmployeeHidden } from '../../utils/planningDataManager';

const EmployeeManagement = ({ planningData, onEmployeeUpdate, onNext, onBack }) => {
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [forceUpdate, setForceUpdate] = useState(0);
  const [activeTab, setActiveTab] = useState('active'); // 'active' ou 'hidden'
  const [hideDate, setHideDate] = useState('');

  // Forcer la mise à jour quand planningData change
  useEffect(() => {
    setForceUpdate(prev => prev + 1);
  }, [planningData]);

  const handleAddEmployee = () => {
    if (!newEmployeeName.trim()) {
      alert('Veuillez saisir un nom d\'employé');
      return;
    }

    const newEmployee = {
      name: newEmployeeName.trim().toUpperCase(),
      canWorkIn: [] // Pas de boutique sélectionnée par défaut
    };

    onEmployeeUpdate(newEmployee);
    setNewEmployeeName('');
    
    // Forcer la mise à jour
    setForceUpdate(prev => prev + 1);
    
    // Focus sur le champ après ajout
    setTimeout(() => {
      const input = document.getElementById('employee-name-input');
      if (input) input.focus();
    }, 100);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleAddEmployee();
    }
  };



  const handleEmployeeToggle = (employeeId) => {
    setSelectedEmployees(prev => 
      prev.includes(employeeId)
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const handleNextStep = () => {
    if (selectedEmployees.length === 0) {
      alert('Veuillez sélectionner au moins un employé avant de continuer');
      return;
    }
    
    if (window.confirm(`Êtes-vous sûr de vouloir continuer avec ${selectedEmployees.length} employé(s) sélectionné(s) ?`)) {
      onNext(selectedEmployees);
    }
  };

  const handleDeleteEmployee = (employeeId) => {
    const employeeToDelete = employees.find(emp => emp.id === employeeId);
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer l'employé "${employeeToDelete.name}" ?`)) {
      onEmployeeUpdate({ type: 'deleteEmployee', employeeId });
      // Forcer la mise à jour
      setTimeout(() => setForceUpdate(prev => prev + 1), 100);
    }
  };

  const handleDeleteAllEmployees = () => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer tous les employés (${employees.length}) ?`)) {
      onEmployeeUpdate({ type: 'deleteAllEmployees' });
      // Forcer la mise à jour
      setTimeout(() => setForceUpdate(prev => prev + 1), 100);
    }
  };

  // Fonctions pour gérer les employés masqués
  const handleHideEmployee = (employeeId) => {
    if (!hideDate) {
      alert('Veuillez sélectionner une date de masquage');
      return;
    }

    const updatedPlanningData = hideEmployee(planningData, employeeId, hideDate);
    onEmployeeUpdate({ type: 'updatePlanningData', planningData: updatedPlanningData });
    setHideDate('');
    setTimeout(() => setForceUpdate(prev => prev + 1), 100);
  };

  const handleShowEmployee = (employeeId) => {
    const updatedPlanningData = showEmployee(planningData, employeeId);
    onEmployeeUpdate({ type: 'updatePlanningData', planningData: updatedPlanningData });
    setTimeout(() => setForceUpdate(prev => prev + 1), 100);
  };

  const getHiddenEmployeesList = () => {
    return getHiddenEmployees(planningData);
  };

  const getAllEmployees = () => {
    const employeesMap = new Map();
    
    planningData.shops.forEach(shop => {
      shop.employees.forEach(emp => {
        // Vérifier si l'employé n'est pas masqué pour la date actuelle
        if (!isEmployeeHidden(emp, new Date())) {
          if (!employeesMap.has(emp.id)) {
            employeesMap.set(emp.id, emp);
          } else {
            // Fusionner les boutiques autorisées
            const existing = employeesMap.get(emp.id);
            const mergedCanWorkIn = [...new Set([...existing.canWorkIn, ...emp.canWorkIn])];
            employeesMap.set(emp.id, { ...existing, canWorkIn: mergedCanWorkIn });
          }
        }
      });
    });
    
    return Array.from(employeesMap.values());
  };

  const employees = getAllEmployees();

  return (
    <div style={{
      maxWidth: '1000px',
      margin: '0 auto',
      padding: '20px'
    }}>
      <h2 style={{
        textAlign: 'center',
        marginBottom: '30px',
        color: '#333'
      }}>
        Gestion des employés
      </h2>

      <div style={{
        backgroundColor: 'white',
        padding: '30px',
        borderRadius: '10px',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
        marginBottom: '30px'
      }}>
        <h3 style={{ marginBottom: '20px', color: '#555' }}>Ajouter un employé</h3>
        
        <div style={{ marginBottom: '20px' }}>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            fontWeight: 'bold',
            color: '#555'
          }}>
            Nom de l'employé
          </label>
          <input
            id="employee-name-input"
            type="text"
            value={newEmployeeName}
            onChange={(e) => setNewEmployeeName(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Saisissez le nom de l'employé"
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '5px',
              fontSize: '16px'
            }}
          />
        </div>

        <p style={{ 
          fontSize: '14px', 
          color: '#666', 
          marginBottom: '15px', 
          fontStyle: 'italic',
          backgroundColor: '#f8f9fa',
          padding: '10px',
          borderRadius: '5px',
          border: '1px solid #e9ecef'
        }}>
          💡 <strong>Note :</strong> L'affectation des employés aux boutiques se fera à l'étape suivante
        </p>

        <Button
          onClick={handleAddEmployee}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          Ajouter l'employé
        </Button>
      </div>

      {employees.length > 0 && (
        <div style={{
          backgroundColor: 'white',
          padding: '30px',
          borderRadius: '10px',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
          marginBottom: '30px'
        }}>
          {/* Onglets pour gérer les employés actifs et masqués */}
          <div style={{
            display: 'flex',
            gap: '10px',
            marginBottom: '20px',
            borderBottom: '2px solid #e9ecef',
            paddingBottom: '10px'
          }}>
            <button
              onClick={() => setActiveTab('active')}
              style={{
                padding: '10px 20px',
                border: 'none',
                backgroundColor: activeTab === 'active' ? '#007bff' : '#f8f9fa',
                color: activeTab === 'active' ? 'white' : '#666',
                borderRadius: '8px 8px 0 0',
                cursor: 'pointer',
                fontWeight: activeTab === 'active' ? 'bold' : 'normal',
                transition: 'all 0.2s ease'
              }}
            >
              👥 Employés actifs ({employees.length})
            </button>
            <button
              onClick={() => setActiveTab('hidden')}
              style={{
                padding: '10px 20px',
                border: 'none',
                backgroundColor: activeTab === 'hidden' ? '#6c757d' : '#f8f9fa',
                color: activeTab === 'hidden' ? 'white' : '#666',
                borderRadius: '8px 8px 0 0',
                cursor: 'pointer',
                fontWeight: activeTab === 'hidden' ? 'bold' : 'normal',
                transition: 'all 0.2s ease'
              }}
            >
              🚫 Employés masqués ({getHiddenEmployeesList().length})
            </button>
          </div>

          {/* Contenu des onglets */}
          {activeTab === 'active' && (
            <>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px'
              }}>
                <h3 style={{ color: '#555', margin: 0 }}>Employés actifs</h3>
             <div style={{ display: 'flex', gap: '10px' }}>
               <Button
                 onClick={() => setForceUpdate(prev => prev + 1)}
                 style={{
                   padding: '8px 15px',
                   fontSize: '14px',
                   backgroundColor: '#17a2b8',
                   color: 'white',
                   border: 'none',
                   borderRadius: '5px',
                   cursor: 'pointer',
                   fontWeight: 'bold'
                 }}
                 title="Rafraîchir l'affichage"
               >
                 🔄 Rafraîchir
               </Button>
               <Button
                 onClick={handleDeleteAllEmployees}
                 style={{
                   padding: '8px 15px',
                   fontSize: '14px',
                   backgroundColor: '#dc3545',
                   color: 'white',
                   border: 'none',
                   borderRadius: '5px',
                   cursor: 'pointer',
                   fontWeight: 'bold'
                 }}
               >
                 🗑️ Supprimer tout
               </Button>
             </div>
           </div>
          <p style={{ fontSize: '14px', color: '#666', marginBottom: '15px', fontStyle: 'italic' }}>
            💡 Cliquez sur un employé pour le sélectionner
          </p>
          
          <div style={{
            display: 'grid',
            gap: '15px'
          }}>
            {employees.map(employee => (
                             <div key={employee.id} style={{
                 border: selectedEmployees.includes(employee.id) ? '2px solid #ff8c00' : '1px solid #ddd',
                 borderRadius: '8px',
                 padding: '15px',
                 backgroundColor: selectedEmployees.includes(employee.id) ? '#fff3e0' : '#fff',
                 cursor: 'pointer',
                 transition: 'all 0.2s ease'
               }}
              onClick={() => handleEmployeeToggle(employee.id)}
                             onMouseEnter={(e) => {
                 if (!selectedEmployees.includes(employee.id)) {
                   e.currentTarget.style.backgroundColor = '#f8f9fa';
                   e.currentTarget.style.borderColor = '#ff8c00';
                 }
               }}
               onMouseLeave={(e) => {
                 if (!selectedEmployees.includes(employee.id)) {
                   e.currentTarget.style.backgroundColor = '#fff';
                   e.currentTarget.style.borderColor = '#ddd';
                 }
               }}
              title={selectedEmployees.includes(employee.id) ? "Cliqué pour désélectionner" : "Cliqué pour sélectionner"}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '10px'
                }}>
                  <h4 style={{
                    margin: 0,
                    color: '#333'
                  }}>
                    {employee.name}
                  </h4>
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteEmployee(employee.id);
                    }}
                    style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    🗑️
                  </Button>
                </div>
                
                <div style={{ marginBottom: '10px' }}>
                  <span style={{
                    fontSize: '12px',
                    color: '#666',
                    backgroundColor: '#f8f9fa',
                    padding: '4px 8px',
                    borderRadius: '4px'
                  }}>
                    L'affectation aux boutiques se fera à l'étape suivante
                  </span>
                </div>

                {/* Section de masquage d'employé */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '6px',
                  border: '1px solid #e9ecef'
                }}>
                  <span style={{ fontSize: '12px', color: '#666' }}>Masquer à partir du :</span>
                  <input
                    type="date"
                    value={hideDate}
                    onChange={(e) => setHideDate(e.target.value)}
                    style={{
                      padding: '4px 8px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '12px'
                    }}
                    min={new Date().toISOString().split('T')[0]}
                  />
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleHideEmployee(employee.id);
                    }}
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      backgroundColor: '#6c757d',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                    disabled={!hideDate}
                  >
                    🚫 Masquer
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Onglet des employés masqués */}
      {activeTab === 'hidden' && (
        <div style={{
          backgroundColor: 'white',
          padding: '30px',
          borderRadius: '10px',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
          marginBottom: '30px'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px'
          }}>
            <h3 style={{ color: '#555', margin: 0 }}>Employés masqués</h3>
            <span style={{ fontSize: '14px', color: '#666' }}>
              Ces employés ne sont plus visibles dans le planning mais conservent leurs données historiques
            </span>
          </div>

          {getHiddenEmployeesList().length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: '#666',
              fontStyle: 'italic'
            }}>
              Aucun employé masqué pour le moment
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gap: '15px'
            }}>
              {getHiddenEmployeesList().map(employee => (
                <div key={employee.id} style={{
                  border: '1px solid #e9ecef',
                  borderRadius: '8px',
                  padding: '15px',
                  backgroundColor: '#f8f9fa',
                  transition: 'all 0.2s ease'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '10px'
                  }}>
                    <h4 style={{
                      margin: 0,
                      color: '#333'
                    }}>
                      {employee.name}
                    </h4>
                    <Button
                      onClick={() => handleShowEmployee(employee.id)}
                      style={{
                        padding: '6px 12px',
                        fontSize: '12px',
                        backgroundColor: '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                      }}
                    >
                      🔓 Remettre en service
                    </Button>
                  </div>
                  
                                     <div style={{ marginBottom: '10px' }}>
                     <span style={{
                       fontSize: '12px',
                       color: '#666',
                       backgroundColor: '#e9ecef',
                       padding: '4px 8px',
                       borderRadius: '4px'
                     }}>
                       Masqué à partir du {new Date(employee.hiddenFrom).toLocaleDateString('fr-FR')}
                     </span>
                   </div>

                   <div style={{ marginBottom: '10px' }}>
                     <span style={{
                       fontSize: '12px',
                       color: '#666',
                       backgroundColor: '#e9ecef',
                       padding: '4px 8px',
                       borderRadius: '4px'
                     }}>
                       Boutiques autorisées : {employee.canWorkIn?.join(', ') || 'Aucune'}
                     </span>
                   </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '15px',
        marginTop: '30px'
      }}>
        <Button
          onClick={onBack}
          style={{
            padding: '12px 30px',
            fontSize: '16px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          Retour
        </Button>
                 <Button
           onClick={handleNextStep}
          style={{
            padding: '12px 30px',
            fontSize: '16px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          Terminer la configuration
        </Button>
      </div>
    </div>
  );
};

export default EmployeeManagement; 