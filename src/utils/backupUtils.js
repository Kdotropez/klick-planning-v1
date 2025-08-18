import { saveToLocalStorage, loadFromLocalStorage } from './localStorage';
import { format, addMinutes, parse } from 'date-fns';

// Fonction d'export optimisée pour iPad
export const exportAllDataIPad = async (setFeedback, planningData = null) => {
  console.log('exportAllDataIPad called');
  try {
    // Utiliser planningData si fourni, sinon fallback vers localStorage
    let data;
    
    if (planningData && planningData.shops) {
      // Utiliser les données actuelles du planning
      data = {
        shops: planningData.shops,
        config: planningData.config || {},
        exportDate: new Date().toISOString()
      };
      console.log('Utilisation des données planningData actuelles:', data);
    } else {
      // Fallback vers l'ancien système localStorage
      const shops = loadFromLocalStorage('shops', []);
      const config = loadFromLocalStorage('config', {});
      data = { shops: [], config };

      if (!Array.isArray(shops)) {
        throw new Error('Les boutiques ne sont pas un tableau valide');
      }

      shops.forEach(shop => {
        const shopData = {
          id: shop.id,
          name: shop.name,
          hours: shop.hours,
          employees: loadFromLocalStorage(`employees_${shop.id}`, []),
          weeks: {}
        };
        const storageKeys = Object.keys(localStorage).filter(key => key.startsWith(`planning_${shop.id}_`));
        storageKeys.forEach(key => {
          const weekKey = key.replace(`planning_${shop.id}_`, '');
          const weekPlanning = loadFromLocalStorage(key, {});
          const weekEmployees = [];
          const selectedEmployees = loadFromLocalStorage(`selected_employees_${shop.id}_${weekKey}`, []);
          if (Array.isArray(selectedEmployees)) {
            selectedEmployees.forEach(employee => {
              const schedule = {};
              if (weekPlanning[employee]) {
                Object.keys(weekPlanning[employee]).forEach(dayKey => {
                  const slots = weekPlanning[employee][dayKey];
                  schedule[dayKey] = convertSlotsToTimeRanges(slots, config.timeSlots, config.interval);
                });
                weekEmployees.push({ id: employee, schedule });
              }
            });
            shopData.weeks[weekKey] = { timeSlots: config.timeSlots, employees: weekEmployees };
          }
        });
        data.shops.push(shopData);
      });
      console.log('Utilisation des données localStorage (fallback):', data);
    }

    const jsonData = JSON.stringify(data, null, 2);
    const fileName = `planning_all_shops_${format(new Date(), 'yyyy-MM-dd_HHmm')}.json`;
    
    console.log('Données à exporter:', data);
    console.log('Taille des données:', jsonData.length, 'caractères');
    
    // Vérifier si l'API Web Share est disponible (iPad/iOS)
    if (navigator.share && navigator.canShare) {
      const blob = new Blob([jsonData], { type: 'application/json' });
      const file = new File([blob], fileName, { type: 'application/json' });
      
      try {
        await navigator.share({
          title: 'Export Planning Klick',
          text: 'Données de planning exportées',
          files: [file]
        });
        setFeedback('Succès: Données partagées via l\'appareil.');
      } catch (shareError) {
        console.log('Web Share non supporté, fallback vers téléchargement:', shareError);
        // Fallback vers téléchargement classique
        downloadFile(jsonData, fileName);
        setFeedback('Succès: Données exportées (téléchargement).');
      }
    } else {
      // Sur ordinateur, essayer d'ouvrir WhatsApp Web
      try {
        const whatsappUrl = `https://wa.me/?text=Planning%20Klick%20-%20Export%20du%20${format(new Date(), 'dd/MM/yyyy')}%20à%20${format(new Date(), 'HH:mm')}`;
        window.open(whatsappUrl, '_blank');
        
        // Télécharger aussi le fichier
        downloadFile(jsonData, fileName);
        setFeedback('Succès: WhatsApp Web ouvert + fichier téléchargé. Envoyez le fichier manuellement.');
      } catch (error) {
        // Fallback pour navigateurs non-supportés
        downloadFile(jsonData, fileName);
        setFeedback('Succès: Données exportées (téléchargement).');
      }
    }
    
    console.log('Data exported successfully:', data);
  } catch (error) {
    console.error('Error exporting data:', error);
    setFeedback('Erreur lors de l\'exportation: ' + error.message);
  }
};

// Fonction helper pour téléchargement
const downloadFile = (data, fileName) => {
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
};

export const importAllData = (setFeedback, setShops, setSelectedShop, setConfig) => {
  console.log('importAllData called');
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (event) => {
    try {
      const file = event.target.files[0];
      if (!file) throw new Error('Aucun fichier sélectionné');
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data || typeof data !== 'object') {
        throw new Error('Données importées invalides');
      }

      // Vérification robuste pour data.shops
      if (!Array.isArray(data.shops)) {
        console.warn('importAllData: data.shops n\'est pas un tableau, initialisation à []');
        data.shops = [];
      }

      // Nettoyer les clés de date non standardisées et supprimer les doublons d'employés
      const cleanedShops = data.shops.map(shop => ({
        ...shop,
        weeks: Object.keys(shop.weeks || {}).reduce((acc, weekKey) => {
          let cleanedWeekKey = weekKey;
          try {
            const parsedDate = parse(weekKey, 'd MMMM', new Date(2025, 0, 1));
            if (!isNaN(parsedDate.getTime())) {
              cleanedWeekKey = format(parsedDate, 'yyyy-MM-dd');
            }
          } catch (e) {
            console.warn(`importAllData: Clé de semaine non standardisée: ${weekKey}`);
          }
          acc[cleanedWeekKey] = shop.weeks[weekKey];
          return acc;
        }, {})
      }));

      const uniqueShops = cleanedShops.reduce((acc, shop) => {
        const existingShop = acc.find(s => s.id === shop.id);
        if (!existingShop) {
          acc.push({
            ...shop,
            weeks: Object.keys(shop.weeks || {}).reduce((weekAcc, weekKey) => {
              const weekData = shop.weeks[weekKey];
              const uniqueEmployees = [];
              const seenEmployeeIds = new Set();
              if (Array.isArray(weekData.employees)) {
                weekData.employees.forEach(emp => {
                  if (!seenEmployeeIds.has(emp.id)) {
                    uniqueEmployees.push(emp);
                    seenEmployeeIds.add(emp.id);
                  }
                });
              }
              weekAcc[weekKey] = { ...weekData, employees: uniqueEmployees };
              return weekAcc;
            }, {})
          });
        }
        return acc;
      }, []);

      localStorage.clear();
      saveToLocalStorage('shops', uniqueShops);
      saveToLocalStorage('config', data.config || {});
      uniqueShops.forEach(shop => {
        if (!shop.id) {
          console.warn('importAllData: Boutique sans id, ignorée');
          return;
        }
        saveToLocalStorage(`employees_${shop.id}`, shop.employees || []);
        if (shop.weeks && typeof shop.weeks === 'object') {
          Object.keys(shop.weeks).forEach(weekKey => {
            const weekData = shop.weeks[weekKey];
            const weekPlanning = {};
            if (Array.isArray(weekData.employees)) {
              weekData.employees.forEach(employee => {
                weekPlanning[employee.id] = {};
                if (employee.schedule && typeof employee.schedule === 'object') {
                  Object.keys(employee.schedule).forEach(dayKey => {
                    let cleanedDayKey = dayKey;
                    try {
                      const parsedDate = parse(dayKey, 'd MMMM', new Date(2025, 0, 1));
                      if (!isNaN(parsedDate.getTime())) {
                        cleanedDayKey = format(parsedDate, 'yyyy-MM-dd');
                      }
                    } catch (e) {
                      console.warn(`importAllData: Clé de jour non standardisée: ${dayKey}`);
                    }
                    const slots = convertTimeRangesToSlots(
                      employee.schedule[dayKey],
                      weekData.timeSlots || data.config.timeSlots || [],
                      data.config.interval || 30
                    );
                    if (slots.some(slot => slot)) {
                      weekPlanning[employee.id][cleanedDayKey] = slots;
                    }
                  });
                }
              });
              saveToLocalStorage(`planning_${shop.id}_${weekKey}`, weekPlanning);
              saveToLocalStorage(`selected_employees_${shop.id}_${weekKey}`, weekData.employees.map(emp => emp.id) || []);
            }
          });
        }
      });

      // VERROUILLAGE AUTOMATIQUE DÉSACTIVÉ - Les données sont importées sans verrouillage automatique
      console.log('✅ Import terminé sans verrouillage automatique');

      setShops(uniqueShops);
      setSelectedShop(uniqueShops[0]?.id || '');
      setConfig(data.config || {});
      setFeedback('Succès: Données importées.');
      console.log('Data imported successfully:', uniqueShops);
    } catch (error) {
      console.error('Error importing data:', error);
      setFeedback('Erreur lors de l\'importation: ' + error.message);
    }
  };
  input.click();
};

const convertSlotsToTimeRanges = (slots, timeSlots, interval) => {
  if (!Array.isArray(slots) || !Array.isArray(timeSlots)) {
    console.warn('convertSlotsToTimeRanges: Invalid input', { slots, timeSlots });
    return [];
  }

  const ranges = [];
  let start = null;
  let pauseStart = null;
  let resume = null;

  for (let i = 0; i < slots.length && i < timeSlots.length; i++) {
    if (slots[i] && !start) {
      start = timeSlots[i];
    } else if (!slots[i] && start && !pauseStart) {
      pauseStart = timeSlots[i];
      ranges.push(start);
      if (i < slots.length) {
        ranges.push(`${start}-${timeSlots[i]}`);
      }
    } else if (slots[i] && pauseStart && !resume) {
      resume = timeSlots[i];
    } else if (!slots[i] && resume) {
      ranges.push(resume);
      ranges.push(`${resume}-${timeSlots[i]}`);
      start = null;
      pauseStart = null;
      resume = null;
    } else if (slots[i] && i === slots.length - 1) {
      ranges.push(start || timeSlots[i]);
      ranges.push(`${start || timeSlots[i]}-${getEndTime(timeSlots[i], interval)}`);
    }
  }

  if (start && !pauseStart && !resume) {
    ranges.push(start);
    ranges.push(`${start}-${getEndTime(timeSlots[slots.length - 1], interval)}`);
  }

  console.log('Converted slots to time ranges:', { slots, timeSlots, ranges });
  return ranges;
};

const convertTimeRangesToSlots = (ranges, timeSlots, interval) => {
  if (!Array.isArray(ranges) || !Array.isArray(timeSlots)) {
    console.warn('convertTimeRangesToSlots: Invalid input', { ranges, timeSlots });
    return Array(timeSlots?.length || 0).fill(false);
  }

  const slots = Array(timeSlots.length).fill(false);
  ranges.forEach((range, index) => {
    if (typeof range === 'string' && range.includes('-')) {
      const [rangeStart, rangeEnd] = range.split('-');
      const startIndex = timeSlots.indexOf(rangeStart);
      const endIndex = timeSlots.indexOf(rangeEnd) !== -1 ? timeSlots.indexOf(rangeEnd) : timeSlots.indexOf(getEndTime(rangeStart, interval));
      if (startIndex >= 0 && endIndex >= 0 && endIndex > startIndex) {
        for (let j = startIndex; j < endIndex; j++) {
          slots[j] = true;
        }
      }
    } else if (typeof range === 'string') {
      const startIndex = timeSlots.indexOf(range);
      if (startIndex >= 0) {
        slots[startIndex] = true;
      }
    }
  });

  console.log('Converted time ranges to slots:', { ranges, timeSlots, slots });
  return slots;
};

const getEndTime = (startTime, interval) => {
  if (!startTime) return '-';
  const [hours, minutes] = startTime.split(':').map(Number);
  const date = new Date(2025, 0, 1, hours, minutes);
  return format(addMinutes(date, interval), 'HH:mm');
};