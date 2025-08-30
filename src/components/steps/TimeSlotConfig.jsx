import React from 'react';
import { format, isAfter, parse } from 'date-fns';
import Button from '../common/Button';
import { saveToLocalStorage, loadFromLocalStorage } from '../../utils/localStorage';
import { importAllData } from '../../utils/backupUtils';
import { FaUpload } from 'react-icons/fa';
import '@/assets/styles.css';

const TimeSlotConfig = ({ config, setConfig, setStep, setFeedback, selectedShop }) => {
    const intervals = [15, 30, 60];
    const startTimeOptions = ['09:00', '09:30', '10:00', 'other'];
    const endTimeOptions = ['19:00', '20:00', '22:00', '23:00', '23:59', '00:00', '01:00', '02:00', '03:00', 'other'];

    const validateTimeFormat = (time) => {
        const timeRegex = /^(?:([0-1][0-9]|2[0-3]):[0-5][0-9]|23:59)$|^24:00$|^0[0-3]:[0-5][0-9]$/;
        return timeRegex.test(time);
    };

    const generateTimeSlots = (start, end, interval) => {
        if (!start || !end || !interval) return [];
        const startDate = parse(start, 'HH:mm', new Date(2025, 0, 1));
        const normalizedEnd = end === '24:00' ? '23:59' : end;
        const endDate = ['00:00', '01:00', '02:00', '03:00'].includes(normalizedEnd) 
            ? parse(normalizedEnd === '00:00' ? '00:00' : normalizedEnd, 'HH:mm', new Date(2025, 0, 2))
            : parse(normalizedEnd, 'HH:mm', new Date(2025, 0, 1));
        if (!isAfter(endDate, startDate)) return [];
        const slots = [];
        let current = startDate;
        while (current < endDate) {
            slots.push(format(current, 'HH:mm'));
            current = new Date(current.getTime() + interval * 60 * 1000);
        }
        return slots;
    };

    const updateExistingPlannings = (newTimeSlots) => {
        const storageKeys = Object.keys(localStorage).filter(key => key.startsWith(`planning_${selectedShop}_`));
        console.log('Updating existing plannings for new timeSlots:', storageKeys);
        storageKeys.forEach(key => {
            const weekPlanning = loadFromLocalStorage(key, {});
            const updatedPlanning = { ...weekPlanning };
            Object.keys(weekPlanning).forEach(employee => {
                Object.keys(weekPlanning[employee]).forEach(dayKey => {
                    const existingSlots = weekPlanning[employee][dayKey];
                    if (Array.isArray(existingSlots)) {
                        const newSlots = Array(newTimeSlots.length).fill(false);
                        for (let i = 0; i < Math.min(existingSlots.length, newTimeSlots.length); i++) {
                            newSlots[i] = existingSlots[i];
                        }
                        updatedPlanning[employee][dayKey] = newSlots;
                    }
                });
            });
            console.log(`Updating planning for ${key}:`, updatedPlanning);
            saveToLocalStorage(key, updatedPlanning);
        });
    };

    const handleNext = () => {
        if (!config.startTime || !config.endTime) {
            setFeedback('Erreur: Veuillez sélectionner une heure de début et de fin.');
            return;
        }
        if (!validateTimeFormat(config.startTime)) {
            setFeedback('Erreur: Heure de début invalide (HH:mm).');
            return;
        }
        if (!validateTimeFormat(config.endTime)) {
            setFeedback('Erreur: Heure de fin invalide (HH:mm).');
            return;
        }
        const startTime = config.startTime === 'other' ? config.startTimeCustom : config.startTime;
        const endTime = config.endTime === 'other' ? config.endTimeCustom : config.endTime;
        if (!startTime || !endTime) {
            setFeedback('Erreur: Veuillez spécifier une heure personnalisée pour l\'option "Autre".');
            return;
        }
        const timeSlots = generateTimeSlots(startTime, endTime, config.interval);
        if (timeSlots.length === 0) {
            setFeedback('Erreur: Aucun créneau horaire défini.');
            return;
        }
        const updatedConfig = { ...config, timeSlots, startTime, endTime };
        updateExistingPlannings(timeSlots);
        saveToLocalStorage(`timeSlotConfig_${selectedShop}`, updatedConfig);
        setConfig(updatedConfig);
        setStep(2);
        setFeedback('Succès: Configuration des tranches enregistrée.');
    };

    const handleReset = () => {
        const defaultConfig = { 
            timeSlots: generateTimeSlots('09:00', '01:00', 30), 
            interval: 30, 
            startTime: '09:00', 
            endTime: '01:00', 
            startTimeCustom: '', 
            endTimeCustom: '' 
        };
        updateExistingPlannings(defaultConfig.timeSlots);
        setConfig(defaultConfig);
        saveToLocalStorage(`timeSlotConfig_${selectedShop}`, defaultConfig);
        setFeedback('Succès: Configuration réinitialisée.');
    };

    console.log('Rendering TimeSlotConfig with config:', config, 'selectedShop:', selectedShop);

    return (
        <div className="step-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h2 style={{ fontFamily: 'Roboto, sans-serif', textAlign: 'center', marginBottom: '15px' }}>
                Configuration des tranches horaires
            </h2>
            <div className="button-group" style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '20px' }}>
                <Button className="button-validate" onClick={() => importAllData(setFeedback, () => {}, () => {}, setConfig)}>
                    <FaUpload /> Importer
                </Button>
            </div>
            <div className="form-group" style={{ marginBottom: '15px', width: '100%', maxWidth: '400px' }}>
                <label style={{ fontFamily: 'Roboto, sans-serif', fontSize: '16px', marginBottom: '5px', display: 'block', textAlign: 'center' }}>
                    Intervalle (minutes)
                </label>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    {intervals.map((int) => (
                        <label
                            key={int}
                            style={{
                                fontFamily: 'Roboto, sans-serif',
                                border: '1px solid #d6e6ff',
                                backgroundColor: config.interval === int ? '#e0e0e0' : '#f0f0f0',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#e0e0e0'}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = config.interval === int ? '#e0e0e0' : '#f0f0f0'}
                        >
                            <input
                                type="radio"
                                name="interval"
                                value={int}
                                checked={config.interval === int}
                                onChange={(e) => setConfig({ ...config, interval: Number(e.target.value) })}
                                style={{ marginRight: '4px' }}
                            />
                            {int} min
                        </label>
                    ))}
                </div>
            </div>
            <div className="form-group" style={{ marginBottom: '15px', width: '100%', maxWidth: '400px' }}>
                <label style={{ fontFamily: 'Roboto, sans-serif', fontSize: '16px', marginBottom: '5px', display: 'block', textAlign: 'center' }}>
                    Heure de début
                </label>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    {startTimeOptions.map((time) => (
                        <label
                            key={time}
                            style={{
                                fontFamily: 'Roboto, sans-serif',
                                border: '1px solid #d6e6ff',
                                backgroundColor: config.startTime === time ? '#e0e0e0' : '#f0f0f0',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#e0e0e0'}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = config.startTime === time ? '#e0e0e0' : '#f0f0f0'}
                        >
                            <input
                                type="radio"
                                name="startTime"
                                value={time}
                                checked={config.startTime === time}
                                onChange={(e) => setConfig({ ...config, startTime: e.target.value })}
                                style={{ marginRight: '4px' }}
                            />
                            {time === 'other' ? 'Autre' : time}
                        </label>
                    ))}
                </div>
                {config.startTime === 'other' && (
                    <input
                        type="time"
                        value={config.startTimeCustom || ''}
                        onChange={(e) => setConfig({ ...config, startTimeCustom: e.target.value, startTime: e.target.value })}
                        style={{ padding: '10px', fontSize: '16px', width: '100%', marginTop: '10px' }}
                    />
                )}
            </div>
            <div className="form-group" style={{ marginBottom: '15px', width: '100%', maxWidth: '400px' }}>
                <label style={{ fontFamily: 'Roboto, sans-serif', fontSize: '16px', marginBottom: '5px', display: 'block', textAlign: 'center' }}>
                    Heure de fin
                </label>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    {endTimeOptions.map((time) => (
                        <label
                            key={time}
                            style={{
                                fontFamily: 'Roboto, sans-serif',
                                border: '1px solid #d6e6ff',
                                backgroundColor: config.endTime === time ? '#e0e0e0' : '#f0f0f0',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#e0e0e0'}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = config.endTime === time ? '#e0e0e0' : '#f0f0f0'}
                        >
                            <input
                                type="radio"
                                name="endTime"
                                value={time}
                                checked={config.endTime === time}
                                onChange={(e) => setConfig({ ...config, endTime: e.target.value })}
                                style={{ marginRight: '4px' }}
                            />
                            {time === 'other' ? 'Autre' : time}
                        </label>
                    ))}
                </div>
                {config.endTime === 'other' && (
                    <input
                        type="time"
                        value={config.endTimeCustom || ''}
                        onChange={(e) => setConfig({ ...config, endTimeCustom: e.target.value, endTime: e.target.value })}
                        style={{ padding: '10px', fontSize: '16px', width: '100%', marginTop: '10px' }}
                    />
                )}
            </div>
            <div className="button-group" style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '20px' }}>
                <Button className="button-validate" onClick={handleNext}>
                    Valider
                </Button>
                <Button className="button-reinitialiser" onClick={handleReset}>
                    Réinitialiser
                </Button>
            </div>
            <p style={{ fontFamily: 'Roboto, sans-serif', textAlign: 'center', marginTop: '20px', fontSize: '14px', color: '#333' }}>
                Klick-Planning - copyright © Nicolas Lefevre
            </p>
        </div>
    );
};

export default TimeSlotConfig;