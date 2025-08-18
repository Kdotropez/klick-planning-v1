import React, { useState } from 'react';
import Button from '../common/Button';
import '@/assets/styles.css';

const ResetModal = ({
  show,
  onClose,
  onReset,
  currentShop,
  currentWeek,
  employees
}) => {
  const [resetOption, setResetOption] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState('');

  const handleReset = () => {
    if (resetOption === 'all') {
      onReset('all');
    } else if (resetOption === 'employee' && selectedEmployee) {
      onReset('employee', selectedEmployee);
    }
    onClose();
    setResetOption('');
    setSelectedEmployee('');
  };

  const handleClose = () => {
    onClose();
    setResetOption('');
    setSelectedEmployee('');
  };

  if (!show) return null;

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
      zIndex: 1000,
      pointerEvents: 'auto' 
    }}>
      <div className="modal-content" style={{
        backgroundColor: 'white',
        padding: '30px',
        borderRadius: '10px',
        maxWidth: '500px',
        width: '90%',
        maxHeight: '80vh',
        overflowY: 'auto',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
      }}>
        <h3 style={{ 
          fontFamily: 'Roboto, sans-serif', 
          textAlign: 'center',
          marginBottom: '20px',
          color: '#333'
        }}>
          Réinitialisation des clics
        </h3>
        
        <p style={{ 
          fontFamily: 'Roboto, sans-serif', 
          textAlign: 'center', 
          marginBottom: '20px',
          color: '#666'
        }}>
          Que souhaitez-vous effacer ?
        </p>

        <p style={{ 
          fontFamily: 'Roboto, sans-serif', 
          textAlign: 'center', 
          marginBottom: '20px',
          color: '#999',
          fontSize: '14px'
        }}>
          Boutique : {currentShop}<br/>
          Semaine : {currentWeek}
        </p>
        
        <div style={{
          padding: '15px',
          backgroundColor: '#fff3cd',
          border: '1px solid #ffeaa7',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <p style={{
            fontFamily: 'Roboto, sans-serif',
            color: '#856404',
            fontSize: '14px',
            margin: '0',
            textAlign: 'center'
          }}>
            ⚠️ <strong>Attention :</strong> Cette action est irréversible !
          </p>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '15px', fontFamily: 'Roboto, sans-serif' }}>
            <input
              type="radio"
              name="resetOption"
              value="all"
              checked={resetOption === 'all'}
              onChange={(e) => setResetOption(e.target.value)}
              style={{ marginRight: '10px' }}
            />
            <strong>Effacer tous les clics</strong> - Tous les employés
          </label>
          
          <label style={{ display: 'block', marginBottom: '15px', fontFamily: 'Roboto, sans-serif' }}>
            <input
              type="radio"
              name="resetOption"
              value="employee"
              checked={resetOption === 'employee'}
              onChange={(e) => setResetOption(e.target.value)}
              style={{ marginRight: '10px' }}
            />
            <strong>Effacer les clics d'un employé</strong> - Choisir un employé
          </label>
        </div>

        {resetOption === 'employee' && (
          <div style={{ marginBottom: '20px' }}>
            <p style={{ 
              fontFamily: 'Roboto, sans-serif', 
              marginBottom: '10px',
              color: '#666',
              fontSize: '14px'
            }}>
              Sélectionnez l'employé :
            </p>
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '5px',
                border: '1px solid #ddd',
                fontFamily: 'Roboto, sans-serif',
                fontSize: '14px'
              }}
            >
              <option value="">-- Choisir un employé --</option>
              {employees && employees.map((employee, index) => (
                <option key={employee.id || index} value={employee.id || employee}>
                  {employee.name || employee}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="button-group" style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          gap: '15px',
          marginTop: '20px' 
        }}>
          <Button 
            className="button-retour" 
            onClick={handleClose}
            style={{
              padding: '10px 20px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            Annuler
          </Button>
          
          <Button 
            className="button-reinitialiser" 
            onClick={handleReset}
            disabled={!resetOption || (resetOption === 'employee' && !selectedEmployee)}
            style={{
              padding: '10px 20px',
              backgroundColor: (resetOption && (resetOption !== 'employee' || selectedEmployee)) ? '#e53935' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: (resetOption && (resetOption !== 'employee' || selectedEmployee)) ? 'pointer' : 'not-allowed'
            }}
          >
            Effacer
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ResetModal;