// src/components/planning/MonthlyRecapModals.jsx
import React, { useState } from 'react';
import { format, startOfMonth, endOfMonth, eachWeekOfInterval, isMonday, isWithinInterval, addDays, eachDayOfInterval, startOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import { loadFromLocalStorage } from '../../utils/localStorage';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';
import Button from '../common/Button';
import '@/assets/styles.css';

const MonthlyRecapModals = ({
    config,
    selectedShop,
    selectedWeek,
    selectedEmployees,
    planning,
    showMonthlyRecapModal,
    setShowMonthlyRecapModal,
    showEmployeeMonthlyRecap,
    setShowEmployeeMonthlyRecap,
    showMonthlyDetailModal,
    setShowMonthlyDetailModal,
    showEmployeeMonthlyDetailModal,
    setShowEmployeeMonthlyDetailModal,
    selectedEmployeeForMonthlyRecap,
    setSelectedEmployeeForMonthlyRecap,
    calculateEmployeeDailyHours
}) => {
    if (!showMonthlyRecapModal && !showEmployeeMonthlyRecap && !showMonthlyDetailModal && !showEmployeeMonthlyDetailModal) {
        console.log('MonthlyRecapModals: No modal to show');
        return null;
    }

    const [selectedMonth, setSelectedMonth] = useState(new Date(selectedWeek));
    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfMonth(selectedMonth);
    const weeks = eachWeekOfInterval({ start: monthStart, end: monthEnd }, { weekStartsOn: 1 })
        .filter(week => isMonday(week))
        .map(week => ({
            key: format(week, 'yyyy-MM-dd'),
            label: `Semaine du ${format(week, 'd MMMM yyyy', { locale: fr })}`
        }));

    const months = Array.from({ length: 12 }, (_, i) => {
        const monthDate = new Date(selectedMonth.getFullYear(), i, 1);
        return {
            value: format(monthDate, 'yyyy-MM'),
            label: format(monthDate, 'MMMM yyyy', { locale: fr })
        };
    });

    const handleMonthChange = (e) => {
        const [year, month] = e.target.value.split('-').map(Number);
        setSelectedMonth(new Date(year, month - 1, 1));
    };

    const getEmployeeColorClass = (employee) => {
        const index = selectedEmployees.indexOf(employee);
        const colors = ['employee-0', 'employee-1', 'employee-2', 'employee-3', 'employee-4', 'employee-5', 'employee-6'];
        return index >= 0 ? colors[index % colors.length] : '';
    };

    const getEmployeeBackgroundColor = (employee) => {
        const index = selectedEmployees.indexOf(employee);
        const backgroundColors = [
            [230, 240, 250], // #e6f0fa
            [230, 255, 237], // #e6ffed
            [255, 230, 230], // #ffe6e6
            [208, 240, 250], // #d0f0fa
            [240, 230, 250], // #f0e6fa
            [255, 253, 230], // #fffde6
            [214, 230, 255]  // #d6e6ff
        ];
        return index >= 0 ? backgroundColors[index % backgroundColors.length] : [200, 200, 200];
    };

    const getWeekBackgroundColor = (day) => {
        const weekStart = startOfWeek(day, { weekStartsOn: 1 });
        const weekIndex = weeks.findIndex(week => week.key === format(weekStart, 'yyyy-MM-dd'));
        const pastelColors = ['#e6f0fa', '#e6ffed', '#ffe6e6', '#d0f0fa', '#f0e6fa', '#fffde6', '#d6e6ff'];
        return pastelColors[weekIndex % pastelColors.length] || '#ffffff';
    };

    const calculateEmployeeWeeklyHoursInMonth = (employee, week, weekPlanning) => {
        let calendarHours = 0;
        let realHours = 0;
        for (let i = 0; i < 7; i++) {
            const dayKey = format(addDays(new Date(week), i), 'yyyy-MM-dd');
            const hours = calculateEmployeeDailyHours(employee, dayKey, weekPlanning);
            realHours += hours;
            if (isWithinInterval(new Date(dayKey), { start: monthStart, end: monthEnd })) {
                calendarHours += hours;
            }
        }
        console.log('Weekly hours for', employee, week, { calendar: calendarHours.toFixed(1), real: realHours.toFixed(1) });
        return { calendarHours, realHours };
    };

    const calculateEmployeeMonthlyHours = (employee) => {
        let calendarHours = 0;
        let realHours = 0;
        
        // Générer tous les jours du mois
        const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
        
        // Filtrer pour ne garder que les jours qui appartiennent réellement au mois en cours
        const days = allDays.filter(day => {
            const dayMonth = day.getMonth();
            const dayYear = day.getFullYear();
            const selectedMonth = monthStart.getMonth();
            const selectedYear = monthStart.getFullYear();
            
            // Ne garder que les jours du mois sélectionné
            return dayMonth === selectedMonth && dayYear === selectedYear;
        });
        
        // Calculer les heures pour chaque jour du mois
        days.forEach(day => {
            const dayKey = format(day, 'yyyy-MM-dd');
            const weekKey = format(startOfWeek(day, { weekStartsOn: 1 }), 'yyyy-MM-dd');
            const weekPlanning = loadFromLocalStorage(`planning_${selectedShop}_${weekKey}`, planning);
            const hours = calculateEmployeeDailyHours(employee, dayKey, weekPlanning);
            calendarHours += hours;
            realHours += hours;
        });
        
        console.log('Monthly hours for', employee, { calendar: calendarHours.toFixed(1), real: realHours.toFixed(1) });
        return { calendarHours: calendarHours.toFixed(1), realHours: realHours.toFixed(1) };
    };

    const calculateShopMonthlyHours = () => {
        let calendarHours = 0;
        let realHours = 0;
        
        // Générer tous les jours du mois
        const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
        
        // Filtrer pour ne garder que les jours qui appartiennent réellement au mois en cours
        const days = allDays.filter(day => {
            const dayMonth = day.getMonth();
            const dayYear = day.getFullYear();
            const selectedMonth = monthStart.getMonth();
            const selectedYear = monthStart.getFullYear();
            
            // Ne garder que les jours du mois sélectionné
            return dayMonth === selectedMonth && dayYear === selectedYear;
        });
        
        // Calculer les heures pour chaque jour du mois pour tous les employés
        days.forEach(day => {
            const dayKey = format(day, 'yyyy-MM-dd');
            const weekKey = format(startOfWeek(day, { weekStartsOn: 1 }), 'yyyy-MM-dd');
            const weekPlanning = loadFromLocalStorage(`planning_${selectedShop}_${weekKey}`, planning);
            
            selectedEmployees.forEach(employee => {
                const hours = calculateEmployeeDailyHours(employee, dayKey, weekPlanning);
                calendarHours += hours;
                realHours += hours;
            });
        });
        
        console.log('Shop monthly hours:', { calendar: calendarHours.toFixed(1), real: realHours.toFixed(1) });
        return { calendarHours: calendarHours.toFixed(1), realHours: realHours.toFixed(1) };
    };

    // Nouvelle fonction pour calculer le récapitulatif des semaines à cheval
    const calculateOverlappingWeeksRecap = () => {
        const recap = [];
        
        // Trouver toutes les semaines qui chevauchent le mois sélectionné
        const storageKeys = Object.keys(localStorage).filter(key => key.startsWith(`planning_${selectedShop}_`));
        
        storageKeys.forEach(key => {
            const weekKey = key.replace(`planning_${selectedShop}_`, '');
            const weekStart = new Date(weekKey);
            const weekEnd = addDays(weekStart, 6);
            
            // Vérifier si cette semaine chevauche le mois sélectionné
            const overlapsMonth = (weekStart <= monthEnd && weekEnd >= monthStart);
            
            if (overlapsMonth) {
                const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
                let previousMonthHours = 0;
                let currentMonthHours = 0;
                let nextMonthHours = 0;
                
                weekDays.forEach(day => {
                    const dayKey = format(day, 'yyyy-MM-dd');
                    const weekPlanning = loadFromLocalStorage(key, planning);
                    
                    // Calculer les heures pour tous les employés de cette journée
                    selectedEmployees.forEach(employee => {
                        const hours = calculateEmployeeDailyHours(employee, dayKey, weekPlanning);
                        
                        // Déterminer à quel mois appartient ce jour
                        const dayMonth = day.getMonth();
                        const dayYear = day.getFullYear();
                        const selectedMonth = monthStart.getMonth();
                        const selectedYear = monthStart.getFullYear();
                        
                        if (dayMonth === selectedMonth && dayYear === selectedYear) {
                            currentMonthHours += hours;
                        } else if (day < monthStart) {
                            previousMonthHours += hours;
                        } else if (day > monthEnd) {
                            nextMonthHours += hours;
                        }
                    });
                });
                
                // Ne garder que les semaines qui ont effectivement des heures à cheval
                const hasOverlappingHours = previousMonthHours > 0 || nextMonthHours > 0;
                const totalWeekHours = previousMonthHours + currentMonthHours + nextMonthHours;
                
                if (hasOverlappingHours && totalWeekHours > 0) {
                    recap.push({
                        weekKey,
                        weekLabel: `Du ${format(weekStart, 'dd/MM/yyyy')} au ${format(weekEnd, 'dd/MM/yyyy')}`,
                        previousMonthHours: previousMonthHours.toFixed(1),
                        currentMonthHours: currentMonthHours.toFixed(1),
                        nextMonthHours: nextMonthHours.toFixed(1),
                        totalWeekHours: totalWeekHours.toFixed(1),
                        employeeCount: selectedEmployees.length
                    });
                }
            }
        });
        
        console.log('Overlapping weeks recap calculated:', recap);
        return recap;
    };

    // Fonction pour calculer le récapitulatif des semaines à cheval pour un employé spécifique
    const calculateOverlappingWeeksRecapForEmployee = (employee) => {
        const recap = [];
        
        // Trouver toutes les semaines qui chevauchent le mois sélectionné
        const storageKeys = Object.keys(localStorage).filter(key => key.startsWith(`planning_${selectedShop}_`));
        
        storageKeys.forEach(key => {
            const weekKey = key.replace(`planning_${selectedShop}_`, '');
            const weekStart = new Date(weekKey);
            const weekEnd = addDays(weekStart, 6);
            
            // Vérifier si cette semaine chevauche le mois sélectionné
            const overlapsMonth = (weekStart <= monthEnd && weekEnd >= monthStart);
            
            if (overlapsMonth) {
                const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
                let previousMonthHours = 0;
                let currentMonthHours = 0;
                let nextMonthHours = 0;
                
                weekDays.forEach(day => {
                    const dayKey = format(day, 'yyyy-MM-dd');
                    const weekPlanning = loadFromLocalStorage(key, planning);
                    
                    // Calculer les heures pour cet employé spécifique
                    const hours = calculateEmployeeDailyHours(employee, dayKey, weekPlanning);
                    
                    // Déterminer à quel mois appartient ce jour
                    const dayMonth = day.getMonth();
                    const dayYear = day.getFullYear();
                    const selectedMonth = monthStart.getMonth();
                    const selectedYear = monthStart.getFullYear();
                    
                    if (dayMonth === selectedMonth && dayYear === selectedYear) {
                        currentMonthHours += hours;
                    } else if (day < monthStart) {
                        previousMonthHours += hours;
                    } else if (day > monthEnd) {
                        nextMonthHours += hours;
                    }
                });
                
                // Ne garder que les semaines qui ont effectivement des heures à cheval
                const hasOverlappingHours = previousMonthHours > 0 || nextMonthHours > 0;
                const totalWeekHours = previousMonthHours + currentMonthHours + nextMonthHours;
                
                if (hasOverlappingHours && totalWeekHours > 0) {
                    recap.push({
                        weekKey,
                        weekLabel: `Du ${format(weekStart, 'dd/MM/yyyy')} au ${format(weekEnd, 'dd/MM/yyyy')}`,
                        previousMonthHours: previousMonthHours.toFixed(1),
                        currentMonthHours: currentMonthHours.toFixed(1),
                        nextMonthHours: nextMonthHours.toFixed(1),
                        totalWeekHours: totalWeekHours.toFixed(1)
                    });
                }
            }
        });
        
        console.log(`Overlapping weeks recap calculated for ${employee}:`, recap);
        return recap;
    };

    const getDailyHoursOrCongé = (employee, dayKey, weekPlanning) => {
        const slots = weekPlanning[employee]?.[dayKey];
        console.log(`getDailyHoursOrCongé for ${employee} on ${dayKey}:`, slots);
        if (slots === 'Congé ☀️') {
            return ['Congé ☀️', '', '', '', '0.0 h'];
        }
        if (Array.isArray(slots)) {
            if (slots.length === 4 && typeof slots[0] === 'string') {
                const [entry, pause, resume, exit] = slots;
                const hours = calculateEmployeeDailyHours(employee, dayKey, weekPlanning);
                return [entry || '', pause || '', resume || '', exit || '', `${hours.toFixed(1)} h`];
            } else if (slots.some(s => s === true)) {
                const hours = calculateEmployeeDailyHours(employee, dayKey, weekPlanning);
                if (hours > 0) {
                    const startIndex = slots.findIndex(s => s === true);
                    const endIndex = slots.lastIndexOf(true);
                    const startTime = config.timeSlots[startIndex] || '';
                    const endTime = config.timeSlots[endIndex + 1] || '';
                    return [startTime, '', '', endTime, `${hours.toFixed(1)} h`];
                }
            }
        }
        return ['', '', '', '', '0.0 h'];
    };

    let recapData = [];
    let detailData = [];
    let employeeDetailData = [];
    let totalMonthCalendarHours = 0;
    let totalMonthRealHours = 0;
    let overlappingWeeksRecap = [];

    if (showMonthlyRecapModal) {
        recapData = selectedEmployees.map(employee => {
            const { calendarHours, realHours } = calculateEmployeeMonthlyHours(employee);
            return {
                employee,
                weeks: weeks.map(week => {
                    const weekPlanning = loadFromLocalStorage(`planning_${selectedShop}_${week.key}`, planning);
                    const { calendarHours: weekCalendar, realHours: weekReal } = calculateEmployeeWeeklyHoursInMonth(employee, week.key, weekPlanning);
                    return {
                        week: week.label,
                        calendarHours: weekCalendar.toFixed(1),
                        realHours: weekReal.toFixed(1)
                    };
                }),
                totalCalendarHours: calendarHours,
                totalRealHours: realHours,
                colorClass: getEmployeeColorClass(employee),
                backgroundColor: getEmployeeBackgroundColor(employee)
            };
        });
        const shopHours = calculateShopMonthlyHours();
        totalMonthCalendarHours = shopHours.calendarHours;
        totalMonthRealHours = shopHours.realHours;
        console.log('MonthlyRecapModals: Generated recap data:', recapData);
    }

    if (showEmployeeMonthlyRecap) {
        const employee = selectedEmployeeForMonthlyRecap;
        const { calendarHours, realHours } = calculateEmployeeMonthlyHours(employee);
        recapData = [{
            employee,
            weeks: weeks.map(week => {
                const weekPlanning = loadFromLocalStorage(`planning_${selectedShop}_${week.key}`, planning);
                const { calendarHours: weekCalendar, realHours: weekReal } = calculateEmployeeWeeklyHoursInMonth(employee, week.key, weekPlanning);
                return {
                    week: week.label,
                    calendarHours: weekCalendar.toFixed(1),
                    realHours: weekReal.toFixed(1)
                };
            }),
            totalCalendarHours: calendarHours,
            totalRealHours: realHours,
            colorClass: getEmployeeColorClass(employee),
            backgroundColor: getEmployeeBackgroundColor(employee)
        }];
        totalMonthCalendarHours = parseFloat(calendarHours);
        totalMonthRealHours = parseFloat(realHours);
        console.log('MonthlyRecapModals: Generated employee recap data:', recapData);
    }

    if (showMonthlyDetailModal) {
        // Afficher tous les jours des semaines qui chevauchent le mois
        const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
        
        detailData = allDays.map(day => {
            const dayKey = format(day, 'yyyy-MM-dd');
            const weekKey = format(startOfWeek(day, { weekStartsOn: 1 }), 'yyyy-MM-dd');
            const weekPlanning = loadFromLocalStorage(`planning_${selectedShop}_${weekKey}`, planning);
            
            // Vérifier si le jour appartient au mois sélectionné
            const dayMonth = day.getMonth();
            const dayYear = day.getFullYear();
            const selectedMonth = monthStart.getMonth();
            const selectedYear = monthStart.getFullYear();
            const isInSelectedMonth = dayMonth === selectedMonth && dayYear === selectedYear;
            
            const row = {
                day: format(day, 'dd/MM/yyyy', { locale: fr }),
                employees: {},
                isInSelectedMonth
            };
            
            selectedEmployees.forEach(employee => {
                const [entry, pause, resume, exit, hours] = getDailyHoursOrCongé(employee, dayKey, weekPlanning);
                // Si le jour n'appartient pas au mois sélectionné, afficher "---" au lieu des heures
                row.employees[employee] = isInSelectedMonth ? (hours === '0.0 h' && !entry ? 'CONGÉ' : hours) : '---';
            });
            return row;
        });
        const shopHours = calculateShopMonthlyHours();
        totalMonthCalendarHours = shopHours.calendarHours;
        totalMonthRealHours = shopHours.realHours;
        console.log('MonthlyRecapModals: Generated detail data:', detailData);
    }

    if (showEmployeeMonthlyDetailModal) {
        const employee = selectedEmployeeForMonthlyRecap;
        const { calendarHours, realHours } = calculateEmployeeMonthlyHours(employee);
        const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
        
        employeeDetailData = allDays.map(day => {
            const dayKey = format(day, 'yyyy-MM-dd');
            const weekKey = format(startOfWeek(day, { weekStartsOn: 1 }), 'yyyy-MM-dd');
            const weekPlanning = loadFromLocalStorage(`planning_${selectedShop}_${weekKey}`, planning);
            
            // Vérifier si le jour appartient au mois sélectionné
            const dayMonth = day.getMonth();
            const dayYear = day.getFullYear();
            const selectedMonth = monthStart.getMonth();
            const selectedYear = monthStart.getFullYear();
            const isInSelectedMonth = dayMonth === selectedMonth && dayYear === selectedYear;
            
            const [entry, pause, resume, exit, hours] = getDailyHoursOrCongé(employee, dayKey, weekPlanning);
            return {
                day: format(day, 'dd/MM/yyyy', { locale: fr }),
                dayName: format(day, 'EEEE', { locale: fr }),
                entry: isInSelectedMonth ? entry : '---',
                pause: isInSelectedMonth ? pause : '---',
                resume: isInSelectedMonth ? resume : '---',
                exit: isInSelectedMonth ? exit : '---',
                hours: isInSelectedMonth ? hours : '---',
                weekColor: getWeekBackgroundColor(day),
                isInSelectedMonth
            };
        });
        totalMonthCalendarHours = parseFloat(calendarHours);
        totalMonthRealHours = parseFloat(realHours);
        
        // Calculer le récapitulatif des semaines à cheval pour cet employé spécifique
        overlappingWeeksRecap = calculateOverlappingWeeksRecapForEmployee(employee);
        
        console.log('MonthlyRecapModals: Generated employee detail data:', employeeDetailData);
        console.log('MonthlyRecapModals: Generated overlapping weeks recap for employee:', overlappingWeeksRecap);
    }

    const exportToPDF = () => {
        console.log('MonthlyRecapModals: Exporting to PDF');
        try {
            const doc = new jsPDF({ orientation: 'landscape' });
            doc.setFont('Helvetica', 'normal');
            doc.text(
                `Récapitulatif mensuel ${showMonthlyRecapModal ? `- ${selectedShop}` : showEmployeeMonthlyRecap ? `de ${selectedEmployeeForMonthlyRecap}` : showEmployeeMonthlyDetailModal ? `détaillé de ${selectedEmployeeForMonthlyRecap}` : `détaillé - ${selectedShop}`}`,
                10,
                10
            );
            doc.text(`Mois de ${format(monthStart, 'MMMM yyyy', { locale: fr })}`, 10, 20);
            doc.text(`Total heures du mois calendaire : ${totalMonthCalendarHours.toFixed(1)} h`, 10, 30);
            doc.text(`Total heures du mois réel : ${totalMonthRealHours.toFixed(1)} h`, 10, 40);

            let body = [];
            if (showMonthlyDetailModal) {
                body = detailData.map(row => {
                    const employeeHours = selectedEmployees.map(employee => row.employees[employee]);
                    return [row.day, ...employeeHours];
                });
                const totalRow = ['Total mois', ...selectedEmployees.map(employee => `${calculateEmployeeMonthlyHours(employee).calendarHours} h`)];
                body.push(totalRow);
                doc.autoTable({
                    head: [['Jour', ...selectedEmployees]],
                    body,
                    startY: 50,
                    styles: { font: 'Helvetica', fontSize: 10, cellPadding: 2, lineHeight: 1 },
                    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 10 },
                    bodyStyles: { textColor: [51, 51, 51], fontSize: 10 },
                    columnStyles: {
                        0: { cellWidth: 30, halign: 'left' },
                        ...selectedEmployees.reduce((acc, _, idx) => ({ ...acc, [idx + 1]: { cellWidth: 50, halign: 'center' } }), {})
                    },
                    didParseCell: (data) => {
                        if (data.section === 'body' && data.row.index < body.length - 1) {
                            const employeeIndex = data.column.index - 1;
                            if (employeeIndex >= 0) {
                                data.cell.styles.fillColor = getEmployeeBackgroundColor(selectedEmployees[employeeIndex]);
                            }
                        }
                        if (data.section === 'body' && data.row.index === body.length - 1) {
                            data.cell.styles.fontStyle = 'bold';
                        }
                    }
                });
            } else if (showEmployeeMonthlyDetailModal) {
                body = employeeDetailData.map(data => [
                    `${data.dayName} ${data.day}`,
                    data.entry,
                    data.pause,
                    data.resume,
                    data.exit,
                    data.hours
                ]);
                body.push(['Total mois', '', '', '', '', `${totalMonthCalendarHours.toFixed(1)} h`]);
                doc.autoTable({
                    head: [['Jour', 'ENTRÉE', 'PAUSE', 'RETOUR', 'SORTIE', 'Heures effectives']],
                    body,
                    startY: 50,
                    styles: { font: 'Helvetica', fontSize: 10, cellPadding: 2, lineHeight: 1 },
                    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 10 },
                    bodyStyles: { textColor: [51, 51, 51], fontSize: 10 },
                    columnStyles: {
                        0: { cellWidth: 40, halign: 'left' },
                        1: { cellWidth: 25, halign: 'center' },
                        2: { cellWidth: 25, halign: 'center' },
                        3: { cellWidth: 25, halign: 'center' },
                        4: { cellWidth: 25, halign: 'center' },
                        5: { cellWidth: 30, halign: 'center' }
                    },
                    didParseCell: (data) => {
                        if (data.section === 'body' && data.row.index < body.length - 1) {
                            data.cell.styles.fillColor = employeeDetailData[data.row.index].weekColor;
                        }
                        if (data.section === 'body' && data.row.index === body.length - 1) {
                            data.cell.styles.fontStyle = 'bold';
                        }
                    }
                });
            } else {
                recapData.forEach((employeeData, empIndex) => {
                    employeeData.weeks.forEach((weekData, weekIndex) => {
                        body.push({
                            row: [
                                weekIndex === 0 ? employeeData.employee : '',
                                weekData.week,
                                `${weekData.calendarHours} h / ${weekData.realHours} h`
                            ],
                            backgroundColor: employeeData.backgroundColor
                        });
                    });
                    body.push({
                        row: ['', `Total mois calendaire pour ${employeeData.employee}`, `${employeeData.totalCalendarHours} h`],
                        backgroundColor: employeeData.backgroundColor
                    });
                    body.push({
                        row: ['', `Total mois réel pour ${employeeData.employee}`, `${employeeData.totalRealHours} h`],
                        backgroundColor: employeeData.backgroundColor
                    });
                    if (empIndex < recapData.length - 1 || !showMonthlyRecapModal) {
                        body.push({
                            row: ['', '', ''],
                            backgroundColor: [255, 255, 255]
                        });
                    }
                });
                doc.autoTable({
                    head: [['Employé', 'Semaine', 'Heures (Calendaire / Réel)']],
                    body: body.map(item => item.row),
                    startY: 50,
                    styles: { font: 'Helvetica', fontSize: 10, cellPadding: 2, lineHeight: 1 },
                    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 10 },
                    bodyStyles: { textColor: [51, 51, 51], fontSize: 10 },
                    columnStyles: {
                        0: { cellWidth: 40, halign: 'left' },
                        1: { cellWidth: 80, halign: 'left' },
                        2: { cellWidth: 30 }
                    },
                    didParseCell: (data) => {
                        if (data.section === 'body') {
                            const rowIndex = data.row.index;
                            data.cell.styles.fillColor = body[rowIndex].backgroundColor;
                        }
                    }
                });
            }

            doc.save(`monthly_recap_${showMonthlyRecapModal ? 'shop' : showEmployeeMonthlyRecap ? `employee_${selectedEmployeeForMonthlyRecap}` : showEmployeeMonthlyDetailModal ? `employee_detail_${selectedEmployeeForMonthlyRecap}` : 'detail'}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
            console.log('MonthlyRecapModals: PDF exported successfully');
        } catch (error) {
            console.error('MonthlyRecapModals: PDF export failed', error);
            alert(`Erreur lors de l'exportation PDF : ${error.message || 'Erreur inconnue'}`);
        }
    };

    const exportAsImagePdf = async () => {
        console.log('MonthlyRecapModals: Starting PDF export as image');
        try {
            const modalElement = document.querySelector('.modal-content');
            if (!modalElement) throw new Error('Contenu de la modale introuvable');

            const canvas = await html2canvas(modalElement, {
                scale: 3,
                useCORS: true,
                scrollX: 0,
                scrollY: -window.scrollY,
                backgroundColor: '#ffffff',
                windowWidth: modalElement.scrollWidth,
                windowHeight: modalElement.scrollHeight
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 10;

            const imgWidth = canvas.width * 0.264583;
            const imgHeight = canvas.height * 0.264583;
            const maxWidth = pageWidth - 2 * margin;
            const maxHeight = pageHeight - 2 * margin;

            const ratio = Math.min(maxWidth / imgWidth, maxHeight / imgHeight);
            const scaledWidth = imgWidth * ratio;
            const scaledHeight = imgHeight * ratio;

            if (scaledWidth > maxWidth || scaledHeight > maxHeight) {
                const totalWidth = imgWidth;
                let currentX = 0;
                let pageCount = 0;
                while (currentX < totalWidth) {
                    if (pageCount > 0) {
                        pdf.addPage();
                    }
                    const sliceWidth = maxWidth / ratio;
                    pdf.addImage(imgData, 'PNG', margin, margin, maxWidth, Math.min(scaledHeight, maxHeight), null, 'FAST', 0, currentX);
                    currentX += sliceWidth;
                    pageCount++;
                }
            } else {
                pdf.addImage(imgData, 'PNG', margin, margin, scaledWidth, scaledHeight);
            }

            pdf.save(`monthly_recap_${showMonthlyRecapModal ? 'shop' : showEmployeeMonthlyRecap ? `employee_${selectedEmployeeForMonthlyRecap}` : showEmployeeMonthlyDetailModal ? `employee_detail_${selectedEmployeeForMonthlyRecap}` : 'detail'}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
            console.log('MonthlyRecapModals: PDF exported successfully as image');
        } catch (error) {
            console.error('MonthlyRecapModals: PDF export failed', error);
            alert(`Erreur lors de l'exportation PDF : ${error.message || 'Erreur inconnue'}`);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <h2 style={{ fontFamily: 'Roboto, sans-serif', textAlign: 'center', marginBottom: '15px' }}>
                    {showMonthlyRecapModal ? `Récapitulatif mensuel - ${selectedShop}` :
                     showEmployeeMonthlyRecap ? `Récapitulatif mensuel de ${selectedEmployeeForMonthlyRecap}` :
                     showEmployeeMonthlyDetailModal ? `Récapitulatif détaillé de ${selectedEmployeeForMonthlyRecap}` :
                     `Récapitulatif mensuel détaillé - ${selectedShop}`}
                </h2>
                <div className="form-group" style={{ marginBottom: '15px', textAlign: 'center' }}>
                    <label style={{ fontFamily: 'Roboto, sans-serif', fontSize: '16px', marginBottom: '5px', display: 'block' }}>
                        Sélectionner le mois
                    </label>
                    <select
                        value={format(selectedMonth, 'yyyy-MM')}
                        onChange={handleMonthChange}
                        style={{ width: '200px', padding: '8px', fontSize: '14px', border: '1px solid #ccc', borderRadius: '4px' }}
                    >
                        {months.map(month => (
                            <option key={month.value} value={month.value}>
                                {month.label}
                            </option>
                        ))}
                    </select>
                </div>
                <p style={{ fontFamily: 'Roboto, sans-serif', textAlign: 'center', marginBottom: '15px', fontSize: '14px', color: '#333' }}>
                    Mois de {format(monthStart, 'MMMM yyyy', { locale: fr })}
                </p>
                <p style={{ fontFamily: 'Roboto, sans-serif', textAlign: 'center', marginBottom: '10px', fontSize: '14px', color: '#333' }}>
                    Total heures du mois calendaire : {totalMonthCalendarHours.toFixed(1)} h
                </p>
                <p style={{ fontFamily: 'Roboto, sans-serif', textAlign: 'center', marginBottom: '15px', fontSize: '14px', color: '#333' }}>
                    Total heures du mois réel : {totalMonthRealHours.toFixed(1)} h
                </p>
                <table className="monthly-recap-table">
                    <thead>
                        <tr>
                            {showMonthlyDetailModal ? (
                                <>
                                    <th className="align-left">Jour</th>
                                    {selectedEmployees.map(employee => (
                                        <th key={employee} className="align-center">{employee}</th>
                                    ))}
                                </>
                            ) : showEmployeeMonthlyDetailModal ? (
                                <>
                                    <th className="align-left">Jour</th>
                                    <th className="align-center">ENTRÉE</th>
                                    <th className="align-center">PAUSE</th>
                                    <th className="align-center">RETOUR</th>
                                    <th className="align-center">SORTIE</th>
                                    <th className="align-center">Heures effectives</th>
                                </>
                            ) : (
                                <>
                                    <th className="align-left">Employé</th>
                                    <th className="align-left">Semaine</th>
                                    <th>Heures (Calendaire / Réel)</th>
                                </>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {showMonthlyDetailModal ? (
                            <>
                                {detailData.map((row, index) => (
                                    <tr key={index} style={{ 
                                        backgroundColor: row.isInSelectedMonth ? 'transparent' : '#f8f9fa',
                                        opacity: row.isInSelectedMonth ? 1 : 0.7
                                    }}>
                                        <td className="align-left" style={{ 
                                            color: row.isInSelectedMonth ? '#333' : '#999',
                                            fontStyle: row.isInSelectedMonth ? 'normal' : 'italic'
                                        }}>
                                            {row.day}
                                        </td>
                                        {selectedEmployees.map(employee => (
                                            <td key={employee} className={`align-center ${getEmployeeColorClass(employee)}`} style={{
                                                color: row.isInSelectedMonth ? 'inherit' : '#999',
                                                fontStyle: row.isInSelectedMonth ? 'normal' : 'italic'
                                            }}>
                                                {row.employees[employee]}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                                <tr>
                                    <td className="align-left"><strong>Total mois</strong></td>
                                    {selectedEmployees.map(employee => (
                                        <td key={employee} className={`align-center ${getEmployeeColorClass(employee)}`}>
                                            <strong>{calculateEmployeeMonthlyHours(employee).calendarHours} h</strong>
                                        </td>
                                    ))}
                                </tr>
                            </>
                        ) : showEmployeeMonthlyDetailModal ? (
                            <>
                                {employeeDetailData.map((data, index) => (
                                    <tr key={index} style={{ 
                                        backgroundColor: data.isInSelectedMonth ? data.weekColor : '#f8f9fa',
                                        opacity: data.isInSelectedMonth ? 1 : 0.7
                                    }}>
                                        <td className="align-left" style={{ 
                                            color: data.isInSelectedMonth ? '#333' : '#999',
                                            fontStyle: data.isInSelectedMonth ? 'normal' : 'italic'
                                        }}>
                                            {`${data.dayName} ${data.day}`}
                                        </td>
                                        <td className="align-center" style={{
                                            color: data.isInSelectedMonth ? 'inherit' : '#999',
                                            fontStyle: data.isInSelectedMonth ? 'normal' : 'italic'
                                        }}>
                                            {data.entry}
                                        </td>
                                        <td className="align-center" style={{
                                            color: data.isInSelectedMonth ? 'inherit' : '#999',
                                            fontStyle: data.isInSelectedMonth ? 'normal' : 'italic'
                                        }}>
                                            {data.pause}
                                        </td>
                                        <td className="align-center" style={{
                                            color: data.isInSelectedMonth ? 'inherit' : '#999',
                                            fontStyle: data.isInSelectedMonth ? 'normal' : 'italic'
                                        }}>
                                            {data.resume}
                                        </td>
                                        <td className="align-center" style={{
                                            color: data.isInSelectedMonth ? 'inherit' : '#999',
                                            fontStyle: data.isInSelectedMonth ? 'normal' : 'italic'
                                        }}>
                                            {data.exit}
                                        </td>
                                        <td className="align-center" style={{
                                            color: data.isInSelectedMonth ? 'inherit' : '#999',
                                            fontStyle: data.isInSelectedMonth ? 'normal' : 'italic'
                                        }}>
                                            {data.hours}
                                        </td>
                                    </tr>
                                ))}
                                <tr style={{ backgroundColor: '#ffffff' }}>
                                    <td className="align-left"><strong>Total mois</strong></td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td className="align-center"><strong>{totalMonthCalendarHours.toFixed(1)} h</strong></td>
                                </tr>
                            </>
                        ) : (
                            recapData.map((employeeData, empIndex) => (
                                <React.Fragment key={empIndex}>
                                    {employeeData.weeks.map((weekData, weekIndex) => (
                                        <tr key={`${empIndex}-${weekIndex}`} className={employeeData.colorClass}>
                                            <td className="align-left">{weekIndex === 0 ? employeeData.employee : ''}</td>
                                            <td className="align-left">{weekData.week}</td>
                                            <td>{`${weekData.calendarHours} h / ${weekData.realHours} h`}</td>
                                        </tr>
                                    ))}
                                    <tr className={employeeData.colorClass}>
                                        <td className="align-left"></td>
                                        <td className="align-left">Total mois calendaire pour {employeeData.employee}</td>
                                        <td>{`${employeeData.totalCalendarHours} h`}</td>
                                    </tr>
                                    <tr className={employeeData.colorClass}>
                                        <td className="align-left"></td>
                                        <td className="align-left">Total mois réel pour {employeeData.employee}</td>
                                        <td>{`${employeeData.totalRealHours} h`}</td>
                                    </tr>
                                    {(empIndex < recapData.length - 1 || !showMonthlyRecapModal) && (
                                        <tr className="employee-divider">
                                            <td colSpan="3" style={{ height: '10px', backgroundColor: '#fff' }}></td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))
                        )}
                    </tbody>
                </table>
                
                {/* Tableau récapitulatif des semaines à cheval */}
                {overlappingWeeksRecap.length > 0 && (
                    <div style={{ marginTop: '20px' }}>
                        <h3 style={{ 
                            fontFamily: 'Roboto, sans-serif', 
                            textAlign: 'center', 
                            marginBottom: '15px',
                            color: '#d63384',
                            fontSize: '16px'
                        }}>
                            📊 Récapitulatif des semaines à cheval sur {format(monthStart, 'MMMM yyyy', { locale: fr })}
                            {showEmployeeMonthlyDetailModal ? ` - ${selectedEmployeeForMonthlyRecap}` : ' (Tous employés)'}
                        </h3>
                        <table className="monthly-recap-table" style={{ marginBottom: '15px' }}>
                            <thead>
                                <tr>
                                    <th className="align-left">Semaine</th>
                                    <th className="align-center">Heures mois précédent</th>
                                    <th className="align-center">Heures {format(monthStart, 'MMMM yyyy', { locale: fr })}</th>
                                    <th className="align-center">Heures mois suivant</th>
                                    <th className="align-center">Total semaine</th>
                                </tr>
                            </thead>
                            <tbody>
                                {overlappingWeeksRecap.map((week, index) => (
                                    <tr key={index} style={{ backgroundColor: index % 2 === 0 ? '#f8f9fa' : '#ffffff' }}>
                                        <td className="align-left" style={{ fontSize: '13px' }}>
                                            {week.weekLabel}
                                        </td>
                                        <td className="align-center" style={{ 
                                            color: parseFloat(week.previousMonthHours) > 0 ? '#dc3545' : '#999',
                                            fontWeight: parseFloat(week.previousMonthHours) > 0 ? 'bold' : 'normal'
                                        }}>
                                            {parseFloat(week.previousMonthHours) > 0 ? `${week.previousMonthHours} h` : '---'}
                                        </td>
                                        <td className="align-center" style={{ 
                                            color: '#28a745',
                                            fontWeight: 'bold'
                                        }}>
                                            {week.currentMonthHours} h
                                        </td>
                                        <td className="align-center" style={{ 
                                            color: parseFloat(week.nextMonthHours) > 0 ? '#007bff' : '#999',
                                            fontWeight: parseFloat(week.nextMonthHours) > 0 ? 'bold' : 'normal'
                                        }}>
                                            {parseFloat(week.nextMonthHours) > 0 ? `${week.nextMonthHours} h` : '---'}
                                        </td>
                                        <td className="align-center" style={{ 
                                            backgroundColor: '#e9ecef',
                                            fontWeight: 'bold'
                                        }}>
                                            {week.totalWeekHours} h
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div style={{ 
                            backgroundColor: '#fff3cd', 
                            border: '1px solid #ffeaa7', 
                            borderRadius: '6px', 
                            padding: '10px', 
                            marginBottom: '15px',
                            fontSize: '13px',
                            color: '#856404'
                        }}>
                            <strong>💡 Explication :</strong> Ce tableau montre les heures {showEmployeeMonthlyDetailModal ? `de <strong>${selectedEmployeeForMonthlyRecap}</strong>` : '<strong>combinées de tous les employés</strong>'} pour les semaines à cheval. 
                            Les heures du mois précédent ont été payées le mois précédent, celles du mois suivant seront payées le mois suivant.
                            {!showEmployeeMonthlyDetailModal && <><br /><strong>Note :</strong> Les heures affichées sont la somme de tous les employés de la boutique.</>}
                        </div>
                    </div>
                )}
                
                <div className="button-group" style={{ marginTop: '15px', display: 'flex', justifyContent: 'center', gap: '10px' }}>
                    <Button className="button-pdf" onClick={exportToPDF}>
                        Exporter en PDF
                    </Button>
                    <Button className="button-pdf" onClick={exportAsImagePdf}>
                        Exporter en PDF (image fidèle)
                    </Button>
                    <Button
                        className="modal-close"
                        onClick={() => {
                            console.log('MonthlyRecapModals: Closing modal');
                            if (showMonthlyRecapModal) {
                                setShowMonthlyRecapModal(false);
                            } else if (showEmployeeMonthlyRecap) {
                                setShowEmployeeMonthlyRecap(false);
                                setSelectedEmployeeForMonthlyRecap('');
                            } else if (showMonthlyDetailModal) {
                                setShowMonthlyDetailModal(false);
                            } else {
                                setShowEmployeeMonthlyDetailModal(false);
                                setSelectedEmployeeForMonthlyRecap('');
                            }
                        }}
                    >
                        ✕
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default MonthlyRecapModals;