import React, { useState, useEffect } from 'react';
import Button from '../common/Button';

const ShopConfig = ({ shop, onConfigUpdate, onNext, onBack }) => {
  const [config, setConfig] = useState({
    interval: 30,
    startTime: "08:00",
    endTime: "18:00",
    timeSlots: []
  });

  useEffect(() => {
    if (shop.config) {
      setConfig(shop.config);
    }
  }, [shop]);

  const generateTimeSlots = () => {
    const slots = [];
    const start = new Date(`2000-01-01T${config.startTime}`);
    const end = new Date(`2000-01-01T${config.endTime}`);
    
    let current = new Date(start);
    while (current < end) {
      slots.push(current.toTimeString().slice(0, 5));
      current.setMinutes(current.getMinutes() + config.interval);
    }
    
    return slots;
  };

  const handleConfigChange = (field, value) => {
    console.log('ShopConfig - handleConfigChange:', { field, value });
    const newConfig = { ...config, [field]: value };
    setConfig(newConfig);
    
    // Générer les créneaux horaires
    if (field === 'interval' || field === 'startTime' || field === 'endTime') {
      newConfig.timeSlots = generateTimeSlots();
      console.log('ShopConfig - timeSlots générés:', newConfig.timeSlots);
    }
    
    console.log('ShopConfig - newConfig envoyé:', newConfig);
    onConfigUpdate(shop.id, newConfig);
  };

  const handleNext = () => {
    if (config.timeSlots.length > 0) {
      onNext();
    } else {
      alert('Veuillez configurer les créneaux horaires');
    }
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
        Configuration - {shop.name}
      </h2>

      <div style={{
        backgroundColor: 'white',
        padding: '30px',
        borderRadius: '10px',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ marginBottom: '25px' }}>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            fontWeight: 'bold',
            color: '#555'
          }}>
            Intervalle (minutes)
          </label>
          <select
            value={config.interval}
            onChange={(e) => handleConfigChange('interval', parseInt(e.target.value))}
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '5px',
              fontSize: '16px'
            }}
          >
            <option value={15}>15 minutes</option>
            <option value={30}>30 minutes</option>
            <option value={45}>45 minutes</option>
            <option value={60}>1 heure</option>
          </select>
        </div>

        <div style={{ marginBottom: '25px' }}>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            fontWeight: 'bold',
            color: '#555'
          }}>
            Heure de début
          </label>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))',
            gap: '8px'
          }}>
            {['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30'].map(time => (
              <Button
                key={time}
                onClick={() => handleConfigChange('startTime', time)}
                style={{
                  padding: '8px 12px',
                  fontSize: '14px',
                  backgroundColor: config.startTime === time ? '#007bff' : '#f8f9fa',
                  color: config.startTime === time ? 'white' : '#333',
                  border: `1px solid ${config.startTime === time ? '#007bff' : '#ddd'}`,
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontWeight: config.startTime === time ? 'bold' : 'normal'
                }}
              >
                {time}
              </Button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '25px' }}>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            fontWeight: 'bold',
            color: '#555'
          }}>
            Heure de fin
          </label>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))',
            gap: '8px'
          }}>
            {['18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00', '22:30', '23:00', '23:30', '23:59'].map(time => (
              <Button
                key={time}
                onClick={() => handleConfigChange('endTime', time)}
                style={{
                  padding: '8px 12px',
                  fontSize: '14px',
                  backgroundColor: config.endTime === time ? '#007bff' : '#f8f9fa',
                  color: config.endTime === time ? 'white' : '#333',
                  border: `1px solid ${config.endTime === time ? '#007bff' : '#ddd'}`,
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontWeight: config.endTime === time ? 'bold' : 'normal'
                }}
              >
                {time}
              </Button>
            ))}
          </div>
        </div>

        {config.timeSlots.length > 0 && (
          <div style={{ marginBottom: '25px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: 'bold',
              color: '#555'
            }}>
              Créneaux générés ({config.timeSlots.length} créneaux)
            </label>
            <div style={{
              maxHeight: '200px',
              overflowY: 'auto',
              border: '1px solid #ddd',
              borderRadius: '5px',
              padding: '10px',
              backgroundColor: '#f9f9f9'
            }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
                gap: '5px'
              }}>
                {config.timeSlots.map((slot, index) => (
                  <span key={index} style={{
                    padding: '5px',
                    backgroundColor: 'white',
                    border: '1px solid #ddd',
                    borderRadius: '3px',
                    textAlign: 'center',
                    fontSize: '14px'
                  }}>
                    {slot}
                  </span>
                ))}
              </div>
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
             onClick={handleNext}
             disabled={config.timeSlots.length === 0}
             style={{
               padding: '12px 30px',
               fontSize: '16px',
               backgroundColor: config.timeSlots.length > 0 ? '#007bff' : '#ccc',
               color: 'white',
               border: 'none',
               borderRadius: '5px',
               cursor: config.timeSlots.length > 0 ? 'pointer' : 'not-allowed'
             }}
           >
             Suivant
           </Button>
         </div>
      </div>
    </div>
  );
};

export default ShopConfig; 