import React, { useState, useEffect, useMemo } from 'react';
import {
  getAllUsersWithSecrets,
  updateSecretCode,
  addNewUser,
  removeUser,
  checkUserPermission,
  pullUserCodesFromSupabase,
  pushUserCodesToSupabase,
  updateUserAccessSettings,
  FEATURE_CATALOG,
  ROLE_PERMISSIONS,
  PRIMARY_ADMIN_CODE
} from '../../config/userCodes';

const UserManagementModal = ({ isOpen, onClose, currentUser, planningData }) => {
  const [users, setUsers] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [editingAccessUser, setEditingAccessUser] = useState(null);
  const [accessDraft, setAccessDraft] = useState({ allowedShopIds: [], featureOverrides: {} });
  const [newUser, setNewUser] = useState({ name: '', role: 'employee', secretCode: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const shops = planningData?.shops || [];

  const featureGroups = useMemo(() => {
    const groups = {};
    FEATURE_CATALOG.forEach((feature) => {
      if (!groups[feature.group]) groups[feature.group] = [];
      groups[feature.group].push(feature);
    });
    return groups;
  }, []);

  const canManageUsers = currentUser && checkUserPermission(currentUser.code, 'canManageUsers');
  const canViewSecretCodes = currentUser && checkUserPermission(currentUser.code, 'canViewSecretCodes');
  const canModifySecretCodes = currentUser && checkUserPermission(currentUser.code, 'canModifySecretCodes');

  const reloadUsers = async () => {
    await pullUserCodesFromSupabase();
    const allUsers = getAllUsersWithSecrets(currentUser.role);
    setUsers(allUsers);
  };

  useEffect(() => {
    if (isOpen && canViewSecretCodes) {
      (async () => {
        try {
          await reloadUsers();
        } catch (loadError) {
          setError('Erreur lors du chargement des utilisateurs: ' + loadError.message);
        }
      })();
    }
  }, [isOpen, currentUser, canViewSecretCodes]);

  const getRoleDefault = (user, featureKey) => {
    const rolePerms = ROLE_PERMISSIONS[user?.role] || {};
    if (featureKey === 'canAccessAllShops') {
      return rolePerms.canAccessAllShops ?? rolePerms.canAccessAllData ?? false;
    }
    return rolePerms[featureKey] || false;
  };

  const getEffectiveFeature = (user, featureKey) => {
    if (user?.featureOverrides && typeof user.featureOverrides[featureKey] === 'boolean') {
      return user.featureOverrides[featureKey];
    }
    return getRoleDefault(user, featureKey);
  };

  const handleEditUser = (user) => {
    setEditingUser({ ...user });
    setEditingAccessUser(null);
    setError('');
    setSuccess('');
  };

  const handleEditAccess = (user) => {
    setEditingAccessUser(user);
    setEditingUser(null);
    setAccessDraft({
      allowedShopIds: [...(user.allowedShopIds || [])],
      featureOverrides: { ...(user.featureOverrides || {}) }
    });
    setError('');
    setSuccess('');
  };

  const handleSaveAccess = async () => {
    try {
      if (!editingAccessUser) return;
      updateUserAccessSettings(
        editingAccessUser.code,
        {
          allowedShopIds: accessDraft.allowedShopIds,
          featureOverrides: accessDraft.featureOverrides
        },
        currentUser.role
      );
      await pushUserCodesToSupabase();
      await reloadUsers();
      setEditingAccessUser(null);
      setSuccess(`Droits mis à jour pour ${editingAccessUser.name}`);
      setError('');
    } catch (saveError) {
      setError(saveError.message);
      setSuccess('');
    }
  };

  const toggleShopAccess = (shopId) => {
    setAccessDraft((prev) => {
      const has = prev.allowedShopIds.includes(shopId);
      return {
        ...prev,
        allowedShopIds: has
          ? prev.allowedShopIds.filter((id) => id !== shopId)
          : [...prev.allowedShopIds, shopId]
      };
    });
  };

  const setFeatureOverride = (featureKey, value) => {
    setAccessDraft((prev) => {
      const nextOverrides = { ...prev.featureOverrides };
      if (value === null) {
        delete nextOverrides[featureKey];
      } else {
        nextOverrides[featureKey] = value;
      }
      return { ...prev, featureOverrides: nextOverrides };
    });
  };

  const handleSaveEdit = async () => {
    try {
      if (!editingUser.secretCode.trim()) {
        setError('Le code secret ne peut pas être vide');
        return;
      }

      updateSecretCode(editingUser.code, editingUser.secretCode, currentUser.role);
      await pushUserCodesToSupabase();
      await reloadUsers();

      setEditingUser(null);
      setSuccess('Code secret mis à jour avec succès');
      setError('');
    } catch (saveError) {
      setError(saveError.message);
      setSuccess('');
    }
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
    setEditingAccessUser(null);
    setError('');
    setSuccess('');
  };

  const handleAddUser = async () => {
    try {
      if (!newUser.name.trim() || !newUser.secretCode.trim()) {
        setError('Le nom et le code secret sont requis');
        return;
      }

      addNewUser(newUser.secretCode, newUser.name, newUser.role, currentUser.role);
      await pushUserCodesToSupabase();
      await reloadUsers();

      setNewUser({ name: '', role: 'employee', secretCode: '' });
      setSuccess('Utilisateur ajouté avec succès');
      setError('');
    } catch (addError) {
      setError(addError.message);
      setSuccess('');
    }
  };

  const handleDeleteUser = async (userCode) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) {
      try {
        removeUser(userCode, currentUser.role);
        await pushUserCodesToSupabase();
        await reloadUsers();

        setSuccess('Utilisateur supprimé avec succès');
        setError('');
      } catch (deleteError) {
        setError(deleteError.message);
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
          <p>Vous n&apos;avez pas les permissions nécessaires pour gérer les utilisateurs.</p>
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
        maxWidth: editingAccessUser ? '960px' : '900px',
        width: '100%',
        maxHeight: '85vh',
        overflow: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2>🔐 Gestion des Utilisateurs et des Accès</h2>
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

        <p style={{ color: '#64748b', fontSize: '13px', marginTop: '-8px', marginBottom: '16px' }}>
          Définissez quelles boutiques et quelles fonctions chaque utilisateur peut utiliser après connexion.
        </p>

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

        {editingAccessUser && (
          <div style={{
            border: '2px solid #0f4c75',
            borderRadius: '10px',
            padding: '20px',
            marginBottom: '20px',
            backgroundColor: '#f0f7fc'
          }}>
            <h3 style={{ marginTop: 0 }}>
              🔑 Droits de {editingAccessUser.name}
              <span style={{ fontSize: '12px', fontWeight: 500, color: '#64748b', marginLeft: '8px' }}>
                ({editingAccessUser.role === 'supervisor' ? 'Superviseur' : 'Employé'})
              </span>
            </h3>

            <div style={{ marginBottom: '18px' }}>
              <h4 style={{ margin: '0 0 10px' }}>Boutiques autorisées</h4>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 10px' }}>
                Laissez vide pour déduire la boutique du nom/code utilisateur. Cochez plusieurs boutiques pour un accès élargi.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {shops.length === 0 && (
                  <span style={{ color: '#94a3b8' }}>Aucune boutique chargée dans le planning.</span>
                )}
                {shops.map((shop) => {
                  const checked = accessDraft.allowedShopIds.includes(shop.id);
                  return (
                    <label
                      key={shop.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: checked ? '2px solid #0f4c75' : '1px solid #cbd5e1',
                        background: checked ? '#e8f0f7' : '#fff',
                        cursor: 'pointer',
                        fontSize: '13px'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleShopAccess(shop.id)}
                      />
                      {shop.name}
                    </label>
                  );
                })}
              </div>
            </div>

            {Object.entries(featureGroups).map(([groupName, features]) => (
              <div key={groupName} style={{ marginBottom: '16px' }}>
                <h4 style={{ margin: '0 0 8px', color: '#0f4c75' }}>{groupName}</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '8px' }}>
                  {features.map((feature) => {
                    const roleDefault = getRoleDefault(editingAccessUser, feature.key);
                    const hasOverride = typeof accessDraft.featureOverrides[feature.key] === 'boolean';
                    const effective = hasOverride
                      ? accessDraft.featureOverrides[feature.key]
                      : roleDefault;
                    return (
                      <label
                        key={feature.key}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 10px',
                          borderRadius: '6px',
                          border: '1px solid #e2e8f0',
                          background: effective ? '#f0fdf4' : '#fff',
                          fontSize: '13px',
                          cursor: 'pointer'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={effective}
                          onChange={(e) => setFeatureOverride(feature.key, e.target.checked)}
                        />
                        <span>{feature.label}</span>
                        {hasOverride && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              setFeatureOverride(feature.key, null);
                            }}
                            style={{
                              marginLeft: 'auto',
                              fontSize: '11px',
                              border: 'none',
                              background: 'transparent',
                              color: '#64748b',
                              cursor: 'pointer'
                            }}
                            title={`Revenir au défaut du rôle (${roleDefault ? 'oui' : 'non'})`}
                          >
                            défaut
                          </button>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={handleCancelEdit} style={{
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                padding: '10px 16px',
                cursor: 'pointer'
              }}>
                Annuler
              </button>
              <button onClick={handleSaveAccess} style={{
                backgroundColor: '#0f4c75',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                padding: '10px 16px',
                cursor: 'pointer',
                fontWeight: 700
              }}>
                Enregistrer les droits
              </button>
            </div>
          </div>
        )}

        {!editingAccessUser && (
          <>
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

            <div>
              <h3>👥 Utilisateurs existants</h3>
              <div style={{ overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8f9fa' }}>
                      <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Nom</th>
                      <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Rôle</th>
                      <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Boutiques</th>
                      <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Code Secret</th>
                      <th style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid #ddd' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => {
                      const shopLabel = getEffectiveFeature(user, 'canAccessAllShops')
                        ? 'Toutes'
                        : (user.allowedShopIds?.length
                          ? user.allowedShopIds.map((id) => shops.find((s) => s.id === id)?.name || id).join(', ')
                          : 'Auto (nom/code)');
                      return (
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
                          <td style={{ padding: '10px', fontSize: '12px', color: '#475569' }}>{shopLabel}</td>
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
                              <div style={{ display: 'flex', gap: '5px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                <button onClick={() => handleEditAccess(user)} style={{
                                  backgroundColor: '#0f4c75',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  padding: '4px 8px',
                                  cursor: 'pointer',
                                  fontSize: '12px'
                                }}>
                                  🔑 Droits
                                </button>
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
                                {user.code !== PRIMARY_ADMIN_CODE && (
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
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

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
