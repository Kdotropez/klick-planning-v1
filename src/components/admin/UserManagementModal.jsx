import React, { useState, useEffect } from 'react';
import { 
  getAllUsersWithSecrets, 
  updateSecretCode, 
  addNewUser, 
  removeUser,
  checkUserPermission 
} from '../../config/userCodes';

const UserManagementModal = ({ isOpen, onClose, currentUser }) => {
  const [users, setUsers] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [newUser, setNewUser] = useState({ name: '', role: 'employee', secretCode: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Vérifier les permissions
  const canManageUsers = currentUser && checkUserPermission(currentUser.code, 'canManageUsers');
  const canViewSecretCodes = currentUser && checkUserPermission(currentUser.code, 'canViewSecretCodes');
  const canModifySecretCodes = currentUser && checkUserPermission(currentUser.code, 'canModifySecretCodes');

  useEffect(() => {
    if (isOpen && canViewSecretCodes) {
      try {
        const allUsers = getAllUsersWithSecrets(currentUser.role);
        setUsers(allUsers);
      } catch (error) {
        setError('Erreur lors du chargement des utilisateurs: ' + error.message);
      }
    }
  }, [isOpen, currentUser, canViewSecretCodes]);

  const handleEditUser = (user) => {
    setEditingUser({ ...user });
    setError('');
    setSuccess('');
  };

  const handleSaveEdit = () => {
    try {
      if (!editingUser.secretCode.trim()) {
        setError('Le code secret ne peut pas être vide');
        return;
      }

      updateSecretCode(editingUser.code, editingUser.secretCode, currentUser.role);
      
      // Mettre à jour la liste
      const updatedUsers = getAllUsersWithSecrets(currentUser.role);
      setUsers(updatedUsers);
      
      setEditingUser(null);
      setSuccess('Code secret mis à jour avec succès');
      setError('');
    } catch (error) {
      setError(error.message);
      setSuccess('');
    }
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
    setError('');
    setSuccess('');
  };

  const handleAddUser = () => {
    try {
      if (!newUser.name.trim() || !newUser.secretCode.trim()) {
        setError('Le nom et le code secret sont requis');
        return;
      }

      addNewUser(newUser.secretCode, newUser.name, newUser.role, currentUser.role);
      
      // Mettre à jour la liste
      const updatedUsers = getAllUsersWithSecrets(currentUser.role);
      setUsers(updatedUsers);
      
      // Réinitialiser le formulaire
      setNewUser({ name: '', role: 'employee', secretCode: '' });
      setSuccess('Utilisateur ajouté avec succès');
      setError('');
    } catch (error) {
      setError(error.message);
      setSuccess('');
    }
  };

  const handleDeleteUser = (userCode) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer cet utilisateur ?`)) {
      try {
        removeUser(userCode, currentUser.role);
        
        // Mettre à jour la liste
        const updatedUsers = getAllUsersWithSecrets(currentUser.role);
        setUsers(updatedUsers);
        
        setSuccess('Utilisateur supprimé avec succès');
        setError('');
      } catch (error) {
        setError(error.message);
        setSuccess('');
      }
    }
  };

  if (!isOpen) return null;

  if (!canManageUsers) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        zIndex: 10000,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '20px'
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '10px',
          padding: '30px',
          maxWidth: '500px',
          width: '100%',
          textAlign: 'center'
        }}>
          <h2>Accès Refusé</h2>
          <p>Vous n'avez pas les permissions nécessaires pour gérer les utilisateurs.</p>
          <button onClick={onClose} style={{
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            padding: '10px 20px',
            cursor: 'pointer'
          }}>
            Fermer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      zIndex: 10000,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '10px',
        padding: '30px',
        maxWidth: '800px',
        width: '100%',
        maxHeight: '80vh',
        overflow: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2>🔐 Gestion des Utilisateurs</h2>
          <button onClick={onClose} style={{
            background: 'none',
            border: 'none',
            fontSize: '24px',
            cursor: 'pointer',
            color: '#666'
          }}>
            ✕
          </button>
        </div>

        {error && (
          <div style={{
            backgroundColor: '#f8d7da',
            color: '#721c24',
            padding: '10px',
            borderRadius: '5px',
            marginBottom: '15px'
          }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{
            backgroundColor: '#d4edda',
            color: '#155724',
            padding: '10px',
            borderRadius: '5px',
            marginBottom: '15px'
          }}>
            {success}
          </div>
        )}

        {/* Formulaire d'ajout d'utilisateur */}
        <div style={{
          border: '1px solid #ddd',
          borderRadius: '8px',
          padding: '20px',
          marginBottom: '20px',
          backgroundColor: '#f8f9fa'
        }}>
          <h3>➕ Ajouter un nouvel utilisateur</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '10px', alignItems: 'end' }}>
            <input
              type="text"
              placeholder="Nom de l'utilisateur"
              value={newUser.name}
              onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
            />
            <input
              type="password"
              placeholder="Code secret"
              value={newUser.secretCode}
              onChange={(e) => setNewUser({ ...newUser, secretCode: e.target.value })}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
            />
            <select
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
            >
              <option value="employee">Employé</option>
              <option value="supervisor">Superviseur</option>
            </select>
            <button onClick={handleAddUser} style={{
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '8px 16px',
              cursor: 'pointer'
            }}>
              Ajouter
            </button>
          </div>
        </div>

        {/* Liste des utilisateurs */}
        <div>
          <h3>👥 Utilisateurs existants</h3>
          <div style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa' }}>
                  <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Nom</th>
                  <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Rôle</th>
                  <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Code Secret</th>
                  <th style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid #ddd' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.code} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '10px' }}>{user.name}</td>
                    <td style={{ padding: '10px' }}>
                      <span style={{
                        backgroundColor: user.role === 'supervisor' ? '#007bff' : '#6c757d',
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: '12px',
                        fontSize: '12px'
                      }}>
                        {user.role === 'supervisor' ? 'Superviseur' : 'Employé'}
                      </span>
                    </td>
                    <td style={{ padding: '10px' }}>
                      {editingUser && editingUser.code === user.code ? (
                        <input
                          type="password"
                          value={editingUser.secretCode}
                          onChange={(e) => setEditingUser({ ...editingUser, secretCode: e.target.value })}
                          style={{ padding: '4px', borderRadius: '4px', border: '1px solid #ddd', width: '80px' }}
                        />
                      ) : (
                        <span style={{ 
                          fontFamily: 'monospace', 
                          backgroundColor: '#f8f9fa',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          border: '1px solid #dee2e6',
                          fontSize: '14px',
                          fontWeight: 'bold',
                          color: '#495057'
                        }}>
                          {user.secretCode}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      {editingUser && editingUser.code === user.code ? (
                        <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                          <button onClick={handleSaveEdit} style={{
                            backgroundColor: '#28a745',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}>
                            ✓
                          </button>
                          <button onClick={handleCancelEdit} style={{
                            backgroundColor: '#6c757d',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}>
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                          {canModifySecretCodes && (
                            <button onClick={() => handleEditUser(user)} style={{
                              backgroundColor: '#ffc107',
                              color: 'black',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '4px 8px',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}>
                              ✏️
                            </button>
                          )}
                          <button onClick={() => handleDeleteUser(user.code)} style={{
                            backgroundColor: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}>
                            🗑️
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <button onClick={onClose} style={{
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            padding: '10px 20px',
            cursor: 'pointer'
          }}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserManagementModal;
