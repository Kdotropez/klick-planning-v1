import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { pushCompleteSyncNow } from '../../utils/planningSyncScheduler';

const HiddenEmployeesModal = ({ 
  isOpen, 
  onClose, 
  planningData, 
  onEmployeeUpdate,
  currentDate = new Date(),
  currentShop
}) => {
  const [hiddenEmployees, setHiddenEmployees] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  // Récupérer la liste des employés masqués et tous les employés
  useEffect(() => {
    if (isOpen && planningData) {
      const currentShopData = planningData.shops?.find((shop) => shop.id === currentShop);
      const shopEmployees = currentShopData?.employees || [];
      const hidden = shopEmployees.filter((emp) => !!emp?.hiddenFrom);
      const all = shopEmployees;
      setHiddenEmployees(hidden);
      setAllEmployees(all);
    }
  }, [isOpen, planningData, currentDate, currentShop]);

  if (!isOpen) return null;

  const handleShowEmployee = async (employeeId) => {
    if (!employeeId || !currentShop) return;
    
    try {
      const updatedShops = planningData.shops.map(shop => ({
        ...shop,
        employees: shop.id !== currentShop
          ? (shop.employees || [])
          : (shop.employees || []).map(emp =>
              emp && emp.id === employeeId ? { ...emp, hiddenFrom: null } : emp
            )
      }));
      
      const updatedData = {
        ...planningData,
        shops: updatedShops
      };
      
      localStorage.setItem('planningData', JSON.stringify(updatedData));
      
      const remoteResult = await pushCompleteSyncNow(updatedData);
      const dataToApply = remoteResult?.ok && remoteResult.planningData
        ? remoteResult.planningData
        : updatedData;
      
      if (onEmployeeUpdate) {
        onEmployeeUpdate(dataToApply);
      }
      
      onClose();
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

  // Nouvelle fonction pour modifier la date de masquage d'un employé
  const handleUpdateHideDate = async (employeeId, newHideDate) => {
    if (!employeeId || !newHideDate || !currentShop) return;
    
    try {
      console.log('🔧 handleUpdateHideDate appelé avec:', { employeeId, newHideDate });
      
      // Valider le format de la date
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(newHideDate)) {
        alert('❌ Format de date invalide. Utilisez le format AAAA-MM-JJ (ex: 2024-12-31)');
        return;
      }
      
      // Vérifier que la date est valide
      const testDate = new Date(newHideDate);
      if (isNaN(testDate.getTime())) {
        alert('❌ Date invalide. Veuillez entrer une date valide.');
        return;
      }
      
      // Trouver l'employé pour l'affichage
      const currentShopData = planningData?.shops?.find((shop) => shop.id === currentShop);
      const employee = currentShopData?.employees?.find((emp) => emp.id === employeeId);
      const employeeName = employee?.name || employeeId;
      
      console.log('🔍 Employé trouvé:', { employee, employeeName });
      
      // Mettre à jour les données
      const updatedShops = planningData.shops.map(shop => ({
        ...shop,
        employees: shop.id !== currentShop
          ? (shop.employees || [])
          : (shop.employees || []).map(emp =>
              emp && emp.id === employeeId ? { ...emp, hiddenFrom: newHideDate } : emp
            )
      }));
      
      const updatedData = {
        ...planningData,
        shops: updatedShops
      };
      
      console.log('📊 Données mises à jour:', {
        oldHiddenFrom: employee?.hiddenFrom,
        newHiddenFrom: newHideDate,
        updatedDataShops: updatedData.shops.length
      });
      
      // Sauvegarder dans localStorage
      localStorage.setItem('planningData', JSON.stringify(updatedData));
      console.log('💾 Données sauvegardées dans localStorage');
      
      // Sauvegarder dans Supabase
      try {
        console.log('💾 Sauvegarde de la modification de date dans Supabase...');
        const remoteResult = await pushCompleteSyncNow(updatedData);
        if (remoteResult?.ok) {
          console.log('✅ Date de masquage modifiée et sauvegardée dans Supabase');
          alert(`✅ Date de masquage modifiée pour "${employeeName}" : ${newHideDate}\n\nLa modification a été sauvegardée localement et dans Supabase.`);
        } else {
          console.log('❌ Échec sauvegarde Supabase de la modification de date');
          alert(`✅ Date de masquage modifiée pour "${employeeName}" : ${newHideDate}\n\n⚠️ La modification a été sauvegardée localement mais la sauvegarde Supabase a échoué.`);
        }
      } catch (error) {
        console.error('❌ Erreur sauvegarde Supabase de la modification de date:', error);
        alert(`✅ Date de masquage modifiée pour "${employeeName}" : ${newHideDate}\n\n⚠️ La modification a été sauvegardée localement mais la sauvegarde Supabase a échoué.`);
      }
      
      // Appeler la fonction de mise à jour pour rafraîchir l'interface
      console.log('🔄 Appel de onEmployeeUpdate avec les données mises à jour');
      if (onEmployeeUpdate) {
        onEmployeeUpdate(updatedData);
        console.log('✅ onEmployeeUpdate appelé avec succès');
      } else {
        console.log('❌ onEmployeeUpdate n\'est pas défini');
      }
      
      // Rafraîchir la liste des employés masqués
      const refreshedShop = updatedData.shops?.find((shop) => shop.id === currentShop);
      const hidden = (refreshedShop?.employees || []).filter((emp) => !!emp?.hiddenFrom);
      setHiddenEmployees(hidden);
      console.log('📋 Liste des employés masqués mise à jour:', hidden.length, 'employés');
      
    } catch (e) {
      console.error('❌ Erreur lors de la modification de la date de masquage:', e);
      alert('❌ Erreur lors de la modification de la date de masquage');
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
                    `Êtes-vous sûr de vouloir réactiver TOUS les employés masqués de cette boutique (${hiddenEmployees.length}) ?`
                  )) {
                    hiddenEmployees.forEach(emp => handleShowEmployee(emp.id));
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
                    hiddenEmployees.forEach(emp => handleUpdateHideDate(emp.id, newDate));
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
