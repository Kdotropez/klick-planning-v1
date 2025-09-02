import React from 'react';
import { FaDownload } from 'react-icons/fa';
import { format, startOfMonth, endOfMonth, eachMonthOfInterval } from 'date-fns';
import { fr } from 'date-fns/locale';
import Button from '../common/Button';
import '../../assets/styles.css';

const NavigationButtons = ({
  currentShop,
  shops,
  currentWeek,
  changeWeek,
  changeShop,
  changeMonth,
  onBack,
  onBackToShop,
  onBackToWeek,
  onBackToConfig,
  onExport,
  onReset,
  onBackToStartup,

}) => {
  return (
    <div className="navigation-buttons" style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '15px' }}>
      <Button
        className="button-retour"
        onClick={() => changeWeek('prev')}
        style={{ backgroundColor: '#1e88e5', color: '#fff', padding: '8px 16px', fontSize: '14px' }}
        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1565c0'}
        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#1e88e5'}
      >
        Semaine précédente
      </Button>
      <Button
        className="button-retour"
        onClick={() => changeWeek('next')}
        style={{ backgroundColor: '#1e88e5', color: '#fff', padding: '8px 16px', fontSize: '14px' }}
        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1565c0'}
        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#1e88e5'}
      >
        Semaine suivante
      </Button>
      
      {/* Sélecteur de mois */}
      <select
        value={currentWeek ? format(new Date(currentWeek), 'yyyy-MM') : ''}
        onChange={(e) => {
          if (changeMonth) {
            changeMonth(e.target.value);
          }
        }}
        style={{ 
          padding: '8px', 
          fontSize: '14px', 
          border: '1px solid #ccc', 
          borderRadius: '4px',
          backgroundColor: '#fff',
          minWidth: '120px'
        }}
      >
        {(() => {
          // Générer les 12 mois précédents et les 12 mois suivants
          const currentDate = currentWeek ? new Date(currentWeek) : new Date();
          const startDate = new Date(currentDate.getFullYear() - 1, currentDate.getMonth(), 1);
          const endDate = new Date(currentDate.getFullYear() + 1, currentDate.getMonth(), 1);
          
          const months = eachMonthOfInterval({ start: startDate, end: endDate });
          
          return months.map(month => {
            const monthKey = format(month, 'yyyy-MM');
            const monthLabel = format(month, 'MMMM yyyy', { locale: fr });
            return (
              <option key={monthKey} value={monthKey}>
                {monthLabel}
              </option>
            );
          });
        })()}
      </select>
      
      <select
        value={currentShop}
        onChange={(e) => changeShop(e.target.value)}
        style={{ padding: '8px', fontSize: '14px', border: '1px solid #ccc', borderRadius: '4px' }}
      >
        {shops.map(shop => (
          <option key={shop.id} value={shop.id}>{shop.name}</option>
        ))}
      </select>
      <Button
        className="button-retour"
        onClick={onBack}
        style={{ backgroundColor: '#1e88e5', color: '#fff', padding: '8px 16px', fontSize: '14px' }}
        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1565c0'}
        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#1e88e5'}
      >
        Retour Employés
      </Button>
      <Button
        className="button-retour"
        onClick={onBackToShop}
        style={{ backgroundColor: '#1e88e5', color: '#fff', padding: '8px 16px', fontSize: '14px' }}
        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1565c0'}
        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#1e88e5'}
      >
        Retour Boutique
      </Button>
      <Button
        className="button-retour"
        onClick={onBackToWeek}
        style={{ backgroundColor: '#1e88e5', color: '#fff', padding: '8px 16px', fontSize: '14px' }}
        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1565c0'}
        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#1e88e5'}
      >
        Retour Semaine
      </Button>
      <Button
        className="button-retour"
        onClick={onBackToConfig}
        style={{ backgroundColor: '#1e88e5', color: '#fff', padding: '8px 16px', fontSize: '14px' }}
        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1565c0'}
        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#1e88e5'}
      >
        Retour Configuration
      </Button>
      <Button
        className="button-primary"
        onClick={onExport}
        style={{ backgroundColor: '#1e88e5', color: '#fff', padding: '8px 16px', fontSize: '14px' }}
        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1565c0'}
        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#1e88e5'}
      >
        <FaDownload /> Exporter
      </Button>
      <Button
        className="button-reinitialiser"
        onClick={onReset}
        style={{ backgroundColor: '#e53935', color: '#fff', padding: '8px 16px', fontSize: '14px' }}
        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#c62828'}
        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#e53935'}
      >
        Réinitialiser
      </Button>

      <Button
        className="button-retour"
        onClick={onBackToStartup}
        style={{ backgroundColor: '#6c757d', color: '#fff', padding: '8px 16px', fontSize: '14px' }}
        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#5a6268'}
        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#6c757d'}
      >
        Retour au démarrage
      </Button>
    </div>
  );
};

export default NavigationButtons;