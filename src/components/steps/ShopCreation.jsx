import React, { useState } from 'react';
import Button from '../common/Button';

const ShopCreation = ({ onShopsCreated, onBack }) => {
  const [shops, setShops] = useState([]);
  const [newShopName, setNewShopName] = useState('');

  const handleAddShop = () => {
    if (!newShopName.trim()) {
      alert('Veuillez saisir un nom de boutique');
      return;
    }

    const shopId = newShopName.trim().toUpperCase().replace(/\s+/g, '_');
    const newShop = {
      id: shopId,
      name: newShopName.trim().toUpperCase()
    };

    setShops(prev => [...prev, newShop]);
    setNewShopName('');
    
    // Focus sur le champ après ajout
    setTimeout(() => {
      const input = document.getElementById('shop-name-input');
      if (input) input.focus();
    }, 100);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleAddShop();
    }
  };

  // Pas besoin de handleKeyDown spécial - les touches Backspace/Delete fonctionnent déjà
  // avec onChange qui met à jour newShopName

  const handleRemoveShop = (shopId) => {
    const shopToRemove = shops.find(shop => shop.id === shopId);
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer la boutique "${shopToRemove.name}" ?`)) {
      setShops(prev => prev.filter(shop => shop.id !== shopId));
    }
  };

  const handleContinue = () => {
    if (shops.length === 0) {
      alert('Veuillez créer au moins une boutique');
      return;
    }
    onShopsCreated(shops);
  };

  return (
    <div style={{
      maxWidth: '800px',
      margin: '0 auto',
      padding: '20px'
    }}>
      <h2 style={{
        textAlign: 'center',
        marginBottom: '30px',
        color: '#333'
      }}>
        Création des boutiques
      </h2>

      <div style={{
        backgroundColor: 'white',
        padding: '30px',
        borderRadius: '10px',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
        marginBottom: '30px'
      }}>
        <h3 style={{ marginBottom: '20px', color: '#555' }}>Ajouter une boutique</h3>
        
        <div style={{ marginBottom: '20px' }}>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            fontWeight: 'bold',
            color: '#555'
          }}>
            Nom de la boutique
          </label>
                     <input
             id="shop-name-input"
             type="text"
             value={newShopName}
             onChange={(e) => setNewShopName(e.target.value)}
             onKeyPress={handleKeyPress}
             placeholder="Saisissez le nom de la boutique"
             style={{
               width: '100%',
               padding: '10px',
               border: '1px solid #ddd',
               borderRadius: '5px',
               fontSize: '16px'
             }}
           />
        </div>

        <Button
          onClick={handleAddShop}
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
          Ajouter la boutique
        </Button>
      </div>

      {shops.length > 0 && (
        <div style={{
          backgroundColor: 'white',
          padding: '30px',
          borderRadius: '10px',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
          marginBottom: '30px'
        }}>
                     <h3 style={{ marginBottom: '20px', color: '#555' }}>Boutiques créées</h3>
           <p style={{ fontSize: '14px', color: '#666', marginBottom: '15px', fontStyle: 'italic' }}>
             💡 Cliquez sur une boutique pour continuer vers la configuration
           </p>
          
          <div style={{
            display: 'grid',
            gap: '10px'
          }}>
                         {shops.map(shop => (
               <div key={shop.id} style={{
                 display: 'flex',
                 justifyContent: 'space-between',
                 alignItems: 'center',
                 padding: '15px',
                 border: '1px solid #ddd',
                 borderRadius: '8px',
                 backgroundColor: '#f9f9f9',
                 cursor: 'pointer',
                 transition: 'all 0.2s ease'
               }}
               onMouseEnter={(e) => {
                 e.currentTarget.style.backgroundColor = '#e9ecef';
                 e.currentTarget.style.borderColor = '#007bff';
               }}
               onMouseLeave={(e) => {
                 e.currentTarget.style.backgroundColor = '#f9f9f9';
                 e.currentTarget.style.borderColor = '#ddd';
               }}
               onClick={() => handleContinue()}
               title="Cliquez pour continuer vers la configuration"
               >
                                 <div>
                   <strong style={{ color: '#333' }}>{shop.name}</strong>
                 </div>
                
                                 <Button
                   onClick={(e) => {
                     e.stopPropagation(); // Empêcher le déclenchement du onClick du parent
                     handleRemoveShop(shop.id);
                   }}
                   style={{
                     padding: '10px 20px',
                     fontSize: '14px',
                     backgroundColor: '#dc3545',
                     color: 'white',
                     border: 'none',
                     borderRadius: '5px',
                     cursor: 'pointer',
                     fontWeight: 'bold',
                     boxShadow: '0 2px 4px rgba(220, 53, 69, 0.3)'
                   }}
                 >
                   🗑️ Supprimer
                 </Button>
              </div>
            ))}
          </div>
        </div>
      )}

             <div style={{
         display: 'flex',
         justifyContent: 'center',
         gap: '15px'
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
              if (window.confirm(`Êtes-vous sûr de vouloir continuer avec ${shops.length} boutique(s) ?`)) {
                handleContinue();
              }
            }}
            disabled={shops.length === 0}
            style={{
              padding: '12px 30px',
              fontSize: '16px',
              backgroundColor: shops.length > 0 ? '#007bff' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: shops.length > 0 ? 'pointer' : 'not-allowed'
            }}
          >
            Continuer vers la configuration
          </Button>
       </div>
    </div>
  );
};

export default ShopCreation; 
