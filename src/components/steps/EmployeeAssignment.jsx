import React, { useState, useEffect } from 'react';
import Button from '../common/Button';

const EmployeeAssignment = ({ planningData, onEmployeeUpdate, onNext, onBack, selectedEmployeesFromPrevious }) => {
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [forceUpdate, setForceUpdate] = useState(0);

  // Forcer la mise à jour quand planningData change
  useEffect(() => {
    setForceUpdate(prev => prev + 1);
  }, [planningData]);

  const getSelectedEmployees = () => {
    const employeesMap = new Map();
    
    planningData.shops.forEach(shop => {
      shop.employees.forEach(emp => {
        if (selectedEmployeesFromPrevious.includes(emp.id) && !employeesMap.has(emp.id)) {
          employeesMap.set(emp.id, emp);
        } else if (selectedEmployeesFromPrevious.includes(emp.id) && employeesMap.has(emp.id)) {
          // Fusionner les boutiques autorisées
          const existing = employeesMap.get(emp.id);
          const mergedCanWorkIn = [...new Set([...existing.canWorkIn, ...emp.canWorkIn])];
          employeesMap.set(emp.id, { ...existing, canWorkIn: mergedCanWorkIn });
        }
      });
    });
    
    return Array.from(employeesMap.values());
  };

  const employees = getSelectedEmployees();

  const handleEmployeeShopToggle = (employeeId, shopId, canWork) => {
    console.log('🔄 Toggle affectation:', { employeeId, shopId, canWork });
    onEmployeeUpdate({ type: 'updateShops', employeeId, shopId, canWork });
    
    // Forcer la mise à jour de l'interface
    setTimeout(() => setForceUpdate(prev => prev + 1), 100);
    
    // Forcer la synchronisation avec Supabase après un délai
    setTimeout(() => {
      console.log('🔄 Synchronisation forcée après modification d\'affectation');
      // Déclencher un événement pour forcer la synchronisation
      const syncEvent = new CustomEvent('forceSyncAfterAssignment', {
        detail: { employeeId, shopId, canWork }
      });
      window.dispatchEvent(syncEvent);
    }, 500);
  };

  const handleEmployeeToggle = (employeeId) => {
    setSelectedEmployees(prev => 
      prev.includes(employeeId)
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const handleAssignAllToAll = () => {
    if (window.confirm('Voulez-vous affecter tous les employés sélectionnés à toutes les boutiques ?')) {
      employees.forEach(employee => {
        planningData.shops.forEach(shop => {
          if (!employee.canWorkIn.includes(shop.id)) {
            onEmployeeUpdate({ type: 'updateShops', employeeId: employee.id, shopId: shop.id, canWork: true });
          }
        });
      });
      // Forcer la mise à jour
      setTimeout(() => setForceUpdate(prev => prev + 1), 200);
    }
  };

  const handleClearAllAssignments = () => {
    if (window.confirm('Voulez-vous supprimer toutes les affectations des employés sélectionnés aux boutiques ?')) {
      employees.forEach(employee => {
        employee.canWorkIn.forEach(shopId => {
          onEmployeeUpdate({ type: 'updateShops', employeeId: employee.id, shopId, canWork: false });
        });
      });
      // Forcer la mise à jour
      setTimeout(() => setForceUpdate(prev => prev + 1), 200);
    }
  };

  return (
    <div style={{
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '20px'
    }}>
      <h2 style={{
        textAlign: 'center',
        marginBottom: '30px',
        color: '#333'
      }}>
        Affectation des employés aux boutiques
      </h2>

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
           <h3 style={{ color: '#555', margin: 0 }}>Actions rapides</h3>
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
               onClick={handleAssignAllToAll}
               style={{
                 padding: '8px 15px',
                 fontSize: '14px',
                 backgroundColor: '#28a745',
                 color: 'white',
                 border: 'none',
                 borderRadius: '5px',
                 cursor: 'pointer',
                 fontWeight: 'bold'
               }}
             >
               ✅ Tout affecter
             </Button>
             <Button
               onClick={handleClearAllAssignments}
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
               🗑️ Tout effacer
             </Button>
           </div>
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
           💡 <strong>Instructions :</strong> Cochez les boutiques où chaque employé sélectionné peut travailler. Vous pouvez utiliser les boutons d'action rapide ci-dessus.
         </p>
      </div>

      {employees.length > 0 && (
        <div style={{
          backgroundColor: 'white',
          padding: '30px',
          borderRadius: '10px',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
          marginBottom: '30px'
        }}>
                     <h3 style={{ color: '#555', marginBottom: '20px' }}>Employés sélectionnés ({employees.length})</h3>
          <p style={{ fontSize: '14px', color: '#666', marginBottom: '15px', fontStyle: 'italic' }}>
            💡 Cliquez sur un employé pour le sélectionner
          </p>
          
          <div style={{
            display: 'grid',
            gap: '15px'
          }}>
            {employees.map(employee => (
              <div key={employee.id} style={{
                border: selectedEmployees.includes(employee.id) ? '2px solid #007bff' : '1px solid #ddd',
                borderRadius: '8px',
                padding: '15px',
                backgroundColor: selectedEmployees.includes(employee.id) ? '#f0f8ff' : '#fff',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onClick={() => handleEmployeeToggle(employee.id)}
              onMouseEnter={(e) => {
                if (!selectedEmployees.includes(employee.id)) {
                  e.currentTarget.style.backgroundColor = '#f8f9fa';
                  e.currentTarget.style.borderColor = '#007bff';
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
                  <span style={{
                    fontSize: '12px',
                    color: '#666',
                    backgroundColor: '#f8f9fa',
                    padding: '4px 8px',
                    borderRadius: '4px'
                  }}>
                    {employee.canWorkIn.length} boutique(s)
                  </span>
                </div>
                
                <div style={{ marginBottom: '10px' }}>
                  <span style={{
                    fontWeight: 'bold',
                    color: '#555',
                    fontSize: '14px'
                  }}>
                    Boutiques autorisées :
                  </span>
                </div>
                
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: '8px'
                }}>
                  {planningData.shops.map(shop => (
                    <label key={shop.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '14px',
                      cursor: 'pointer',
                      padding: '4px',
                      borderRadius: '4px',
                      backgroundColor: employee.canWorkIn.includes(shop.id) ? '#e8f5e8' : '#f8f9fa'
                    }}>
                      <input
                        type="checkbox"
                        checked={employee.canWorkIn.includes(shop.id)}
                        onChange={(e) => handleEmployeeShopToggle(employee.id, shop.id, e.target.checked)}
                      />
                      {shop.name}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
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
          onClick={() => {
            const totalAssignments = employees.reduce((total, emp) => total + emp.canWorkIn.length, 0);
            if (window.confirm(`Êtes-vous sûr de vouloir terminer la configuration avec ${totalAssignments} affectation(s) ?`)) {
              onNext();
            }
          }}
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

export default EmployeeAssignment; 