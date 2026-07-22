import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { isEmployeeHidden, getArchivedEmployeeIds, reactivateEmployee, promptEmployeeReactivationOptions, updateEmployeeHideDate, hideEmployee } from '../../utils/planningDataManager';
import { saveCompletePlanningData } from '../../utils/remoteStore';
import { getSaveMergeOptionsForUser } from '../../config/userCodes';

const HiddenEmployeesModal = ({ 
  isOpen, 
  onClose, 
  planningData, 
  onEmployeeUpdate,
  currentDate = new Date(),
  currentShop,
  currentUser = null
}) => {
  const [hiddenEmployees, setHiddenEmployees] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  // Récupérer la liste des employés masqués et tous les employés
  useEffect(() => {
    if (isOpen && planningData) {
      const archivedIds = getArchivedEmployeeIds(planningData);
      const hiddenMap = new Map();
      (planningData.shops || []).forEach((shop) => {
        (shop.employees || []).forEach((emp) => {
          if (!emp?.id) return;
          if (isEmployeeHidden(emp) || archivedIds.has(String(emp.id))) {
            if (!hiddenMap.has(emp.id)) {
              hiddenMap.set(emp.id, { ...emp, archived: archivedIds.has(String(emp.id)) || emp.archived });
            }
          }
        });
      });
      setHiddenEmployees(Array.from(hiddenMap.values()));
      const currentShopData = planningData.shops?.find((shop) => shop.id === currentShop);
      setAllEmployees(currentShopData?.employees || []);
    }
  }, [isOpen, planningData, currentDate, currentShop]);

  if (!isOpen) return null;

  const persistEmployeeChanges = async (updatedData, successMessage, failureMessage) => {
    const remoteResult = await saveCompletePlanningData(
      updatedData,
      getSaveMergeOptionsForUser(currentUser)
    );
    if (remoteResult?.ok && remoteResult.planningData) {
      localStorage.setItem('planningData', JSON.stringify(remoteResult.planningData));
      if (onEmployeeUpdate) {
        onEmployeeUpdate(remoteResult.planningData);
      }
      alert(successMessage);
      return remoteResult.planningData;
    }
    alert(failureMessage);
    return null;
  };

  const handleShowEmployee = async (employeeId) => {
    if (!employeeId) return;

    const employeeName =
      hiddenEmployees.find((e) => e.id === employeeId)?.name ||
      allEmployees.find((e) => e.id === employeeId)?.name ||
      employeeId;

    try {
      const options = promptEmployeeReactivationOptions(employeeName);
      if (!options) return;

      const updatedData = reactivateEmployee(planningData, employeeId, options);

      const saved = await persistEmployeeChanges(
        updatedData,
        `✅ « ${employeeName} » réactivé(e) à partir du ${options.visibleFrom}.\n\n` +
          'Les horaires antérieurs sont conservés (masqués avant cette date).',
        `⚠️ Sauvegarde Supabase échouée — aucune modification appliquée.\n\n` +
          'Réessayez ou utilisez « SAUVE SUPABASE ».'
      );
      if (saved) onClose();
    } catch (e) {
      console.error('Erreur lors de la réactivation:', e);
      alert('❌ Erreur lors de la réactivation de l\'employé');
    }
  };

  // Note: Le masquage se fait directement sur la carte de l'employé
  // Cette fonction n'est plus utilisée mais gardée pour référence
  const handleHideEmployee = (employeeId, hideFromDate) => {
    console.log('⚠️ Cette fonction n\'est plus utilisée - le masquage se fait sur la carte');
  };

  const handleUpdateHideDate = async (employeeId, newHideDate) => {
    if (!employeeId || !newHideDate) return;

    try {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(newHideDate)) {
        alert('❌ Format de date invalide. Utilisez le format AAAA-MM-JJ (ex: 2024-12-31)');
        return;
      }

      const testDate = new Date(newHideDate);
      if (isNaN(testDate.getTime())) {
        alert('❌ Date invalide. Veuillez entrer une date valide.');
        return;
      }

      const employeeName =
        hiddenEmployees.find((e) => e.id === employeeId)?.name ||
        allEmployees.find((e) => e.id === employeeId)?.name ||
        employeeId;

      const updatedData = updateEmployeeHideDate(planningData, employeeId, newHideDate);

      const saved = await persistEmployeeChanges(
        updatedData,
        `✅ Date de masquage modifiée pour « ${employeeName} » : ${newHideDate}\n\nEnregistré dans Supabase (toutes les boutiques).`,
        `⚠️ Sauvegarde Supabase échouée — aucune modification appliquée pour « ${employeeName} ».`
      );
      if (!saved) return;

      const hiddenMap = new Map();
      (saved.shops || []).forEach((shop) => {
        (shop.employees || []).forEach((emp) => {
          if (!emp?.id || !isEmployeeHidden(emp)) return;
          if (!hiddenMap.has(emp.id)) hiddenMap.set(emp.id, { ...emp });
        });
      });
      setHiddenEmployees(Array.from(hiddenMap.values()));
    } catch (e) {
      console.error('❌ Erreur lors de la modification de la date de masquage:', e);
      alert('❌ Erreur lors de la modification de la date de masquage');
    }
  };

  const handleReactivateAll = async () => {
    if (!hiddenEmployees.length) return;
    try {
      const options = promptEmployeeReactivationOptions(`${hiddenEmployees.length} employé(s) masqué(s)`);
      if (!options) return;

      let updatedData = planningData;
      for (const emp of hiddenEmployees) {
        updatedData = reactivateEmployee(updatedData, emp.id, options);
      }

      const saved = await persistEmployeeChanges(
        updatedData,
        `✅ ${hiddenEmployees.length} employé(s) réactivé(s) à partir du ${options.visibleFrom}.\n\nUne seule sauvegarde Supabase.`,
        '⚠️ Sauvegarde Supabase échouée — aucune réactivation appliquée.'
      );
      if (saved) onClose();
    } catch (e) {
      console.error('Erreur réactivation groupée:', e);
      alert('❌ Erreur lors de la réactivation groupée');
    }
  };

  const handleHideAllWithDate = async (newDate) => {
    if (!newDate || !hiddenEmployees.length) return;
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(newDate)) {
      alert('❌ Format de date invalide (AAAA-MM-JJ).');
      return;
    }
    try {
      let updatedData = planningData;
      for (const emp of hiddenEmployees) {
        updatedData = hideEmployee(updatedData, emp.id, newDate, null);
      }
      await persistEmployeeChanges(
        updatedData,
        `✅ Date de masquage ${newDate} appliquée à ${hiddenEmployees.length} employé(s) (toutes boutiques).`,
        '⚠️ Sauvegarde Supabase échouée — aucune modification appliquée.'
      );
    } catch (e) {
      console.error('Erreur masquage groupé:', e);
      alert('❌ Erreur lors du masquage groupé');
    }
  };

  const formatDate = (dateString) => {
    try {
      return format(new Date(dateString), 'dd/MM/yyyy', { locale: fr });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="modal-overlay" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000
    }}>
      <div className="modal-content" style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '20px',
        maxWidth: '800px',
        width: '90%',
        maxHeight: '80vh',
        overflow: 'auto',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
      }}>
        {/* En-tête */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          borderBottom: '2px solid #e9ecef',
          paddingBottom: '15px'
        }}>
          <div>
            <h2 style={{
              margin: 0,
              color: '#495057',
              fontSize: '24px',
              fontWeight: '600'
            }}>
              🔓 Réactivation des Employés Masqués
            </h2>
            <p style={{ 
              margin: '8px 0 0 0', 
              color: '#6c757d', 
              fontSize: '14px',
              fontStyle: 'italic'
            }}>
              💡 Gestion par boutique : les actions s'appliquent uniquement à la boutique en cours
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              cursor: 'pointer',
              fontSize: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ×
          </button>
        </div>

        {/* Statistiques */}
        <div style={{
          backgroundColor: '#f8f9fa',
          padding: '15px',
          borderRadius: '6px',
          marginBottom: '20px',
          border: '1px solid #dee2e6'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-around',
            textAlign: 'center'
          }}>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#dc3545' }}>
                {hiddenEmployees.length}
              </div>
              <div style={{ fontSize: '14px', color: '#6c757d' }}>
                Employés masqués
              </div>
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#28a745' }}>
                {allEmployees.length}
              </div>
              <div style={{ fontSize: '14px', color: '#6c757d' }}>
                Total employés
              </div>
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#17a2b8' }}>
                {formatDate(currentDate)}
              </div>
              <div style={{ fontSize: '14px', color: '#6c757d' }}>
                Date de référence
              </div>
            </div>
          </div>
        </div>

        {/* Liste des employés masqués */}
        {hiddenEmployees.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            color: '#6c757d',
            fontSize: '16px'
          }}>
            🎉 Aucun employé masqué actuellement !
            <br />
            <span style={{ fontSize: '14px' }}>
              Tous vos employés sont visibles dans les rapports.
            </span>
          </div>
        ) : (
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{
              margin: '0 0 15px 0',
              color: '#495057',
              fontSize: '18px',
              fontWeight: '500'
            }}>
              📋 Employés masqués ({hiddenEmployees.length})
            </h3>
            
            <div style={{
              display: 'flex',
              flexDirection: 'row',
              flexWrap: 'nowrap',
              gap: '10px',
              overflowX: 'auto',
              overflowY: 'hidden',
              paddingBottom: '6px'
            }}>
              {hiddenEmployees.map((employee) => (
                <div
                  key={employee.id}
                  style={{
                    backgroundColor: '#fff',
                    border: '1px solid #dee2e6',
                    borderRadius: '6px',
                    padding: '15px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    alignItems: 'stretch',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                    minWidth: '320px',
                    maxWidth: '320px',
                    flex: '0 0 auto'
                  }}
                >
                  {/* Informations employé */}
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#495057',
                      marginBottom: '5px'
                    }}>
                      {employee.name}
                    </div>
                    <div style={{
                      fontSize: '14px',
                      color: '#6c757d'
                    }}>
                      Masqué depuis le {formatDate(employee.hiddenFrom)}
                    </div>
                    {employee.canWorkIn && employee.canWorkIn.length > 0 && (
                      <div style={{
                        fontSize: '12px',
                        color: '#17a2b8',
                        marginTop: '5px'
                      }}>
                        Boutiques : {employee.canWorkIn.join(', ')}
                      </div>
                    )}
                  </div>

                  {/* Boutons d'action */}
                  <div style={{
                    display: 'flex',
                    gap: '10px',
                    marginTop: '12px',
                    flexWrap: 'wrap'
                  }}>
                    <button
                      onClick={() => handleShowEmployee(employee.id)}
                      style={{
                        backgroundColor: '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '8px 16px',
                        fontSize: '14px',
                        cursor: 'pointer',
                        fontWeight: '500',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#218838'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#28a745'}
                      title="Réactiver cet employé"
                    >
                      🔓 Réactiver
                    </button>
                    
                    <button
                      onClick={() => {
                        const newDate = prompt(
                          `Nouvelle date de masquage pour ${employee.name} (format: AAAA-MM-JJ)`,
                          employee.hiddenFrom
                        );
                        if (newDate) {
                          handleUpdateHideDate(employee.id, newDate);
                        }
                      }}
                      style={{
                        backgroundColor: '#ffc107',
                        color: '#212529',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '8px 16px',
                        fontSize: '14px',
                        cursor: 'pointer',
                        fontWeight: '500',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#e0a800'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#ffc107'}
                      title="Modifier la date de masquage"
                    >
                      📅 Modifier date
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions globales */}
        {hiddenEmployees.length > 0 && (
          <div style={{
            backgroundColor: '#e9ecef',
            padding: '15px',
            borderRadius: '6px',
            border: '1px solid #dee2e6'
          }}>
            <h4 style={{
              margin: '0 0 10px 0',
              color: '#495057',
              fontSize: '16px',
              fontWeight: '500'
            }}>
              🚀 Actions globales
            </h4>
            
            <div style={{
              display: 'flex',
              gap: '10px',
              flexWrap: 'wrap'
            }}>
              <button
                onClick={() => {
                  if (window.confirm(
                    `Réactiver TOUS les employés masqués (${hiddenEmployees.length}) avec une seule date de réembauche et une sauvegarde Supabase ?`
                  )) {
                    handleReactivateAll();
                  }
                }}
                style={{
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '10px 20px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#218838'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#28a745'}
              >
                🔓 Réactiver TOUS
              </button>
              
              <button
                onClick={() => {
                  const newDate = prompt(
                    'Masquer tous les employés masqués à partir d\'une nouvelle date (format: AAAA-MM-JJ)',
                    new Date().toISOString().split('T')[0]
                  );
                  if (newDate) {
                    handleHideAllWithDate(newDate);
                  }
                }}
                style={{
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '10px 20px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#c82333'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#dc3545'}
              >
                🚫 Masquer TOUS
              </button>
            </div>
          </div>
        )}

        {/* Pied de page */}
        <div style={{
          marginTop: '20px',
          paddingTop: '15px',
          borderTop: '1px solid #dee2e6',
          textAlign: 'center',
          color: '#6c757d',
          fontSize: '14px'
        }}>
          💡 <strong>Conseil :</strong> Les employés masqués ne sont pas supprimés, 
          ils sont simplement cachés des rapports à partir de la date spécifiée.
        </div>
      </div>
    </div>
  );
};

export default HiddenEmployeesModal;
