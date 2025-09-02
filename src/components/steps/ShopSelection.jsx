import { useState, useEffect } from 'react';
import { loadFromLocalStorage, saveToLocalStorage } from '../../utils/localStorage';
import { importAllData } from '../../utils/backupUtils';
import Button from '../common/Button';
import { FaTrash } from 'react-icons/fa';
import '../../assets/styles.css';

const ShopSelection = ({ shops, setShops, setSelectedShop, setStep, setConfig, setSelectedWeek, setSelectedEmployees, setPlanning, setFeedback }) => {
  const [newShop, setNewShop] = useState('');
  const [localShops, setLocalShops] = useState(loadFromLocalStorage('shops', []));
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    console.log('ShopSelection: Initial shops from localStorage:', JSON.stringify(localShops, null, 2), 'propsShops:', JSON.stringify(shops, null, 2));
    if (shops.length > 0) {
      setLocalShops(shops);
      saveToLocalStorage('shops', shops);
    }
  }, [shops]);

  const handleAddShop = () => {
    const trimmedShop = newShop.trim();
    if (!trimmedShop) {
      setFeedback('Erreur: Le nom de la boutique ne peut pas être vide.');
      console.error('Failed to add shop: Empty name');
      return;
    }
    const shopId = trimmedShop.toUpperCase().replace(/\s+/g, '_');
    if (localShops.some(shop => shop && shop.id === shopId)) {
      setFeedback('Erreur: Cette boutique existe déjà.');
      console.error('Failed to add shop: Already exists', shopId);
      return;
    }
    const newShops = [...localShops, { id: shopId, name: trimmedShop, hours: { open: '09:00', close: '23:00', interval: 30 } }];
    setLocalShops(newShops);
    setShops(newShops);
    saveToLocalStorage('shops', newShops);
    setNewShop('');
    setFeedback('Succès: Boutique ajoutée.');
    console.log('Shop added:', shopId);
  };

  const handleDeleteShop = (shopId) => {
    const newShops = localShops.filter(shop => shop && shop.id !== shopId);
    setLocalShops(newShops);
    setShops(newShops);
    saveToLocalStorage('shops', newShops);
    localStorage.removeItem(`employees_${shopId}`);
    localStorage.removeItem(`lastPlanning_${shopId}`);
    Object.keys(localStorage)
      .filter(key => key.startsWith(`planning_${shopId}_`) || key.startsWith(`selected_employees_${shopId}_`))
      .forEach(key => localStorage.removeItem(key));
    setFeedback('Succès: Boutique supprimée.');
    console.log('Shop deleted:', shopId);
    if (selected === shopId) {
      setSelected(null);
    }
  };

  const handleSelectShop = (shopId) => {
    setSelected(shopId);
    setSelectedShop(shopId);
    setStep(3);
    setFeedback('Succès: Boutique sélectionnée.');
    console.log('Shop selected:', shopId);
  };

  const handleImport = (event) => {
    const file = event.target.files[0];
    if (!file) {
      setFeedback('Erreur: Aucun fichier sélectionné.');
      console.error('No file selected for import');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        console.log('ShopSelection: Imported JSON data:', JSON.stringify(data, null, 2));
        // Transformer les boutiques pour correspondre au format attendu
        const transformedShops = data.shops.map(shop => ({
          id: shop.shop.toUpperCase().replace(/\s+/g, '_'),
          name: shop.shop,
          hours: { open: '09:00', close: '23:00', interval: 30 }
        }));
        setLocalShops(transformedShops);
        setShops(transformedShops);
        saveToLocalStorage('shops', transformedShops);
        // Mettre à jour la configuration
        setConfig(data.timeSlotConfig || { timeSlots: [], interval: 30, startTime: '09:00', endTime: '23:00' });
        setFeedback('Succès: Données importées.');
        console.log('ShopSelection: Import successful, transformed shops:', transformedShops);
      } catch (error) {
        setFeedback('Erreur: Échec de l\'importation du fichier JSON.');
        console.error('ShopSelection: Import failed', error);
      }
    };
    reader.readAsText(file);
  };

  const handleReset = () => {
    setLocalShops([]);
    setShops([]);
    saveToLocalStorage('shops', []);
    localStorage.clear();
    setSelected(null);
    setFeedback('Succès: Liste des boutiques réinitialisée.');
    console.log('Shops reset');
  };

  const handleValidate = () => {
    if (!selected) {
      setFeedback('Erreur: Aucune boutique sélectionnée.');
      console.error('No shop selected for validation');
      return;
    }
    setSelectedShop(selected);
    setStep(3);
    setFeedback('Succès: Validation effectuée.');
    console.log('Validation successful:', selected);
  };

  console.log('Rendering ShopSelection with shops:', JSON.stringify(localShops, null, 2));

  return (
    <div className="step-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '465px' }}>
      <h2 style={{ fontFamily: 'Roboto, sans-serif', textAlign: 'center', marginBottom: '15px' }}>
        Sélection des boutiques
      </h2>
      <div className="shop-input" style={{ marginBottom: '15px', width: '100%', maxWidth: '400px' }}>
        <label style={{ fontFamily: 'Roboto, sans-serif', fontSize: '16px', marginBottom: '5px', display: 'block', textAlign: 'center' }}>
          Ajouter une boutique
        </label>
        <input
          type="text"
          value={newShop}
          onChange={(e) => setNewShop(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAddShop(); }}
          placeholder="Nom de la boutique"
          className="shop-input-field"
        />
        <Button
          className="button-validate"
          onClick={handleAddShop}
          style={{ backgroundColor: '#1e88e5', color: '#fff', padding: '8px 16px', fontSize: '14px', marginTop: '10px' }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1565c0'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#1e88e5'}
        >
          Ajouter
        </Button>
      </div>
      <div className="form-group" style={{ marginBottom: '15px', width: '100%', maxWidth: '400px' }}>
        <label style={{ fontFamily: 'Roboto, sans-serif', fontSize: '16px', marginBottom: '5px', display: 'block', textAlign: 'center' }}>
          Importer une sauvegarde
        </label>
        <input type="file" accept=".json" onChange={handleImport} />
      </div>
      <div className="shop-list" style={{ marginBottom: '15px', width: '100%', maxWidth: '400px', maxHeight: '200px', overflowY: 'auto' }}>
        <label style={{ fontFamily: 'Roboto, sans-serif', fontSize: '16px', marginBottom: '5px', display: 'block', textAlign: 'center' }}>
          Boutiques disponibles
        </label>
        {Array.isArray(localShops) && localShops.length > 0 ? (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {localShops.map((shop, index) => {
              if (!shop || !shop.id || !shop.name) {
                console.warn('ShopSelection: Invalid shop at index', index, shop);
                return null;
              }
              return (
                <li key={shop.id} className="shop-item">
                  <Button
                    onClick={() => handleSelectShop(shop.id)}
                    style={{
                      backgroundColor: selected === shop.id ? '#e6ffed' : '#fff',
                      color: selected === shop.id ? '#333' : '#333',
                      padding: '8px 16px',
                      fontSize: '14px',
                      width: '100%',
                      display: 'flex',
                      justifyContent: 'space-between'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = selected === shop.id ? '#d6ffdd' : '#f0f0f0'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = selected === shop.id ? '#e6ffed' : '#fff'}
                  >
                    {shop.name.toUpperCase()}
                    <span className="delete-icon" onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteShop(shop.id);
                    }}><FaTrash /></span>
                  </Button>
                </li>
              );
            }).filter(Boolean)}
          </ul>
        ) : (
          <p style={{ fontFamily: 'Roboto, sans-serif', color: '#e53935', textAlign: 'center' }}>
            Aucune boutique disponible.
          </p>
        )}
      </div>
      <div className="button-group" style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: 'auto', width: '100%', maxWidth: '400px' }}>
        <Button
          className="button-retour"
          onClick={() => setStep(1)}
          style={{ backgroundColor: '#000000', color: '#fff', padding: '8px 16px', fontSize: '14px' }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#333'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#000000'}
        >
          Retour
        </Button>
        <Button
          className="button-validate"
          onClick={handleValidate}
          style={{ backgroundColor: '#4caf50', color: '#fff', padding: '8px 16px', fontSize: '14px' }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#388e3c'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#4caf50'}
        >
          Valider
        </Button>
        <Button
          className="button-reinitialiser"
          onClick={handleReset}
          style={{ backgroundColor: '#e53935', color: '#fff', padding: '8px 16px', fontSize: '14px' }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#c62828'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#e53935'}
        >
          Réinitialiser
        </Button>
      </div>
      <p style={{ fontFamily: 'Roboto, sans-serif', textAlign: 'center', marginTop: '20px', fontSize: '14px', color: '#ccc' }}>
        Klick-Planning - copyright © Nicolas Lefevre
      </p>
    </div>
  );
};

export default ShopSelection;
