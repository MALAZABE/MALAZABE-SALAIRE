// Gestion des pointages - VERSION 3.0 avec vue calendrier
const Attendance = {
    // Cache des pointages par mois
    cache: {},
    
    // État de la vue
    viewState: {
        currentMonth: null,
        selectedEmployee: 'all', // 'all' ou employeeId
        viewMode: 'calendar' // 'calendar' ou 'grid'
    },
    
    // Charger les pointages d'un mois
    load: async function(month = null) {
        try {
            const targetMonth = month || Utils.getCurrentMonth();
            
            console.log(`Chargement des pointages pour ${targetMonth}`);
            
            // Charger depuis la base
            const attendances = await Database.getAttendances(targetMonth);
            
            // Organiser par employé et date
            const organized = {};
            attendances.forEach(att => {
                const key = `${att.employeeId}_${att.date}`;
                organized[key] = att;
            });
            
            // Créer les entrées manquantes pour tous les employés
            const [year, monthNum] = targetMonth.split('-');
            const daysInMonth = new Date(year, monthNum, 0).getDate();
            const today = new Date();
            
            for (const employee of Employees.list) {
                const startDate = new Date(employee.startDate);
                
                for (let day = 1; day <= daysInMonth; day++) {
                    const currentDate = new Date(year, monthNum - 1, day);
                    
                    // Vérifier si l'employé était déjà embauché et si ce n'est pas dans le futur
                    if (currentDate >= startDate && currentDate <= today) {
                        const dateStr = `${targetMonth}-${day.toString().padStart(2, '0')}`;
                        const key = `${employee._id || employee.id}_${dateStr}`;
                        
                        // Si l'entrée n'existe pas, la créer avec statut "P" par défaut
                        if (!organized[key]) {
                            console.log(`Création entrée manquante: ${employee.name} - ${dateStr}`);
                            
                            const attendance = {
                                employeeId: employee._id || employee.id,
                                date: dateStr,
                                month: targetMonth,
                                status: 'P', // Présent par défaut
                                year: new Date(dateStr).getFullYear()
                            };
                            
                            // Sauvegarder dans la base
                            const saved = await Database.saveAttendance(attendance);
                            
                            // Ajouter au cache organisé
                            organized[key] = saved;
                        }
                    }
                }
            }
            
            // Mettre en cache
            this.cache[targetMonth] = organized;
            
            // Synchroniser avec les congés existants
            await this.syncWithLeaves(targetMonth);
            
            console.log(`${Object.keys(organized).length} entrées de pointage chargées/créées`);
            
            return organized;
        } catch (error) {
            console.error('Erreur chargement pointages:', error);
            notify.error('Erreur lors du chargement des pointages');
            return {};
        }
    },
    
    // Synchroniser avec les congés de la table leaves
    syncWithLeaves: async function(month) {
        console.log('Synchronisation pointage avec les congés...');
        
        // S'assurer que Leaves est chargé
        if (window.Leaves && Leaves.list) {
            for (const leave of Leaves.list) {
                if (leave.status === 'active' && leave.startDate && leave.endDate) {
                    const start = new Date(leave.startDate);
                    const end = new Date(leave.endDate);
                    
                    // Marquer chaque jour du congé
                    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                        const dateStr = d.toISOString().slice(0, 10);
                        
                        // Si la date est dans le mois chargé
                        if (dateStr.startsWith(month)) {
                            const key = `${leave.employeeId}_${dateStr}`;
                            const attendance = this.cache[month][key];
                            
                            // Marquer CP si ce n'est pas déjà fait
                            if (attendance && attendance.status !== 'CP') {
                                attendance.status = 'CP';
                                await Database.saveAttendance(attendance);
                                console.log(`Synchronisé: ${dateStr} marqué CP pour congé`);
                            }
                        }
                    }
                }
            }
        }
    },
    
    // Obtenir le statut d'un employé pour une date
    getStatus: function(employeeId, date) {
        const month = date.substring(0, 7);
        const attendances = this.cache[month] || {};
        const key = `${employeeId}_${date}`;
        const attendance = attendances[key];
        return attendance ? attendance.status : 'P'; // Par défaut: Présent
    },
    
    // Définir le statut d'un employé pour une date
    setStatus: async function(employeeId, date, status, skipSync = false) {
        try {
            const month = date.substring(0, 7);
            
            // S'assurer que le mois est chargé
            if (!this.cache[month]) {
                await this.load(month);
            }
            
            const attendance = {
                employeeId: employeeId,
                date: date,
                month: month,
                status: status,
                year: new Date(date).getFullYear()
            };
            
            // Sauvegarder dans la base
            const saved = await Database.saveAttendance(attendance);
            
            // Mettre à jour le cache
            if (!this.cache[month]) {
                this.cache[month] = {};
            }
            const key = `${employeeId}_${date}`;
            this.cache[month][key] = saved;
            
            console.log(`Statut mis à jour: ${employeeId} - ${date} = ${status}`);
            
            // Synchroniser avec les congés si nécessaire et si pas skipSync
            if (!skipSync) {
                await this.handleStatusSync(employeeId, date, status);
            }
            
            return saved;
        } catch (error) {
            console.error('Erreur sauvegarde pointage:', error);
            notify.error('Erreur lors de la sauvegarde du pointage');
            return false;
        }
    },
    
    // Gérer la synchronisation lors du changement de statut
    handleStatusSync: async function(employeeId, date, newStatus) {
        // Si on essaie de mettre CP, bloquer et informer
        if (newStatus === 'CP') {
            notify.warning('Les congés doivent être créés depuis la section Congés');
            return false;
        }
        
        // Si on enlève CP, informer aussi
        const currentStatus = this.getStatus(employeeId, date);
        if (currentStatus === 'CP' && newStatus !== 'CP') {
            notify.warning('Pour modifier un congé, utilisez la section Congés');
            return false;
        }
        
        // Pour les autres statuts, pas de problème
        return true;
    },
    
    // Basculer le statut (pour le clic)
    toggleStatus: async function(employeeId, date) {
        const currentStatus = this.getStatus(employeeId, date);
        
        // Si c'est CP, bloquer
        if (currentStatus === 'CP') {
            notify.info('Pour modifier un congé, utilisez la section Congés');
            return currentStatus; // Retourner le statut actuel sans changement
        }
        
        // Liste des statuts possibles (sans CP)
        const statuses = ['P', 'A', 'R', 'DM']; // CP retiré !
        const currentIndex = statuses.indexOf(currentStatus);
        const nextIndex = (currentIndex + 1) % statuses.length;
        const nextStatus = statuses[nextIndex];
        
        return await this.setStatus(employeeId, date, nextStatus);
    },
    
    // Obtenir le résumé des présences pour un employé sur un mois
    getSummary: function(employeeId, month) {
        const employee = Employees.getById(employeeId);
        if (!employee) return null;
        
        const [year, monthNum] = month.split('-');
        const daysInMonth = new Date(year, monthNum, 0).getDate();
        const startDate = new Date(employee.startDate);
        const today = new Date();
        
        const summary = {
            P: 0,   // Présent
            A: 0,   // Absent
            R: 0,   // Retard
            DM: 0,  // Demi-journée
            CP: 0,  // Congé payé
            total: 0
        };
        
        // Parcourir tous les jours du mois
        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(year, monthNum - 1, day);
            
            // Vérifier si l'employé était déjà embauché et si ce n'est pas dans le futur
            if (currentDate >= startDate && currentDate <= today) {
                const dateStr = `${month}-${day.toString().padStart(2, '0')}`;
                const status = this.getStatus(employeeId, dateStr);
                
                if (summary[status] !== undefined) {
                    summary[status]++;
                }
                summary.total++;
            }
        }
        
        return summary;
    },
    
    // Afficher la vue calendrier
    renderCalendar: function(containerId, month = null) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const targetMonth = month || this.viewState.currentMonth || Utils.getCurrentMonth();
        this.viewState.currentMonth = targetMonth;
        
        const [year, monthNum] = targetMonth.split('-');
        const firstDay = new Date(year, monthNum - 1, 1);
        const lastDay = new Date(year, monthNum, 0);
        const daysInMonth = lastDay.getDate();
        const firstDayOfWeek = firstDay.getDay(); // 0 = Dimanche
        const today = new Date();
        const todayStr = today.toISOString().slice(0, 10);
        
        let html = `
            <div class="attendance-container calendar-view">
                <div class="attendance-header">
                    <h4>📅 Pointage - Vue Calendrier</h4>
                    <div class="attendance-controls">
                        <!-- Sélecteur d'employé -->
                        <select id="employeeSelector" class="form-control" style="width: 250px;">
                            <option value="all" ${this.viewState.selectedEmployee === 'all' ? 'selected' : ''}>
                                👥 Tous les employés
                            </option>
                            ${Employees.list.map(emp => `
                                <option value="${emp._id || emp.id}" 
                                    ${this.viewState.selectedEmployee === (emp._id || emp.id) ? 'selected' : ''}>
                                    ${emp.name}
                                </option>
                            `).join('')}
                        </select>
                        
                        <!-- Navigation mensuelle -->
                        <div class="month-navigation">
                            <button class="btn btn-sm btn-secondary" onclick="Attendance.navigateMonth(-1)">
                                ◀ Mois précédent
                            </button>
                            <span class="current-month">${Utils.formatMonth(targetMonth)}</span>
                            <button class="btn btn-sm btn-secondary" onclick="Attendance.navigateMonth(1)"
                                ${targetMonth >= Utils.getCurrentMonth() ? 'disabled' : ''}>
                                Mois suivant ▶
                            </button>
                        </div>
                        
                        <!-- Actions -->
                        <div class="attendance-actions">
                            <button class="btn btn-success btn-sm" onclick="Attendance.markAllPresent()">
                                ✅ Tous présents aujourd'hui
                            </button>
                            <button class="btn btn-primary btn-sm" onclick="Attendance.toggleView()">
                                🔄 Vue ${this.viewState.viewMode === 'calendar' ? 'grille' : 'calendrier'}
                            </button>
                            <button class="btn btn-info btn-sm" onclick="Attendance.exportMonth('${targetMonth}')">
                                📄 Exporter
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- Légende -->
                <div class="attendance-legend">
                    ${Object.entries(CONFIG.attendanceStatus).map(([key, val]) => `
                        <span class="legend-item">
                            <span class="legend-color" style="background-color: ${val.color}"></span>
                            ${key} = ${val.label}
                        </span>
                    `).join('')}
                </div>
        `;
        
        // Vue calendrier ou grille selon le mode
        if (this.viewState.viewMode === 'calendar') {
            html += this.renderCalendarView(targetMonth, year, monthNum, firstDayOfWeek, daysInMonth, todayStr);
        } else {
            html += this.renderGridView(targetMonth);
        }
        
        html += '</div>';
        container.innerHTML = html;
        
        // Événement pour le sélecteur d'employé
        document.getElementById('employeeSelector').addEventListener('change', (e) => {
            this.viewState.selectedEmployee = e.target.value;
            this.renderCalendar(containerId, targetMonth);
        });
    },
    
    // Rendu de la vue calendrier
    renderCalendarView: function(targetMonth, year, monthNum, firstDayOfWeek, daysInMonth, todayStr) {
        let html = '<div class="calendar-wrapper">';
        
        // En-têtes des jours
        html += `
            <div class="calendar">
                <div class="calendar-header">
                    <div class="day-header">Dim</div>
                    <div class="day-header">Lun</div>
                    <div class="day-header">Mar</div>
                    <div class="day-header">Mer</div>
                    <div class="day-header">Jeu</div>
                    <div class="day-header">Ven</div>
                    <div class="day-header">Sam</div>
                </div>
                <div class="calendar-body">
        `;
        
        // Jours vides avant le premier jour du mois
        for (let i = 0; i < firstDayOfWeek; i++) {
            html += '<div class="calendar-day empty"></div>';
        }
        
        // Jours du mois
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${targetMonth}-${day.toString().padStart(2, '0')}`;
            const dayDate = new Date(year, monthNum - 1, day);
            const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6;
            const isToday = dateStr === todayStr;
            const isFuture = dayDate > new Date();
            
            html += `
                <div class="calendar-day ${isWeekend ? 'weekend' : ''} ${isToday ? 'today' : ''} ${isFuture ? 'future' : ''}">
                    <div class="day-number">${day}</div>
            `;
            
            if (!isFuture) {
                if (this.viewState.selectedEmployee === 'all') {
                    // Afficher un résumé pour tous les employés
                    const dayStats = this.getDayStats(dateStr);
                    html += `
                        <div class="day-summary">
                            ${dayStats.total > 0 ? `
                                <div class="mini-stats">
                                    ${dayStats.P > 0 ? `<span class="stat-p" title="Présents">${dayStats.P}</span>` : ''}
                                    ${dayStats.A > 0 ? `<span class="stat-a" title="Absents">${dayStats.A}</span>` : ''}
                                    ${dayStats.R > 0 ? `<span class="stat-r" title="Retards">${dayStats.R}</span>` : ''}
                                    ${dayStats.CP > 0 ? `<span class="stat-cp" title="Congés">${dayStats.CP}</span>` : ''}
                                </div>
                            ` : '<span class="no-data">-</span>'}
                        </div>
                        <div class="day-actions">
                            <button class="btn-day-detail" onclick="Attendance.showDayDetails('${dateStr}')">
                                👁️ Détails
                            </button>
                        </div>
                    `;
                } else {
                    // Afficher le statut d'un seul employé
                    const employee = Employees.getById(this.viewState.selectedEmployee);
                    if (employee && new Date(employee.startDate) <= dayDate) {
                        const status = this.getStatus(this.viewState.selectedEmployee, dateStr);
                        const statusInfo = CONFIG.attendanceStatus[status];
                        
                        if (status === 'CP') {
                            html += `
                                <div class="day-status single-employee" 
                                    style="background-color: ${statusInfo.color}; cursor: not-allowed;"
                                    onclick="notify.info('Les congés se gèrent dans la section Congés')">
                                    ${status} 🔒
                                </div>
                            `;
                        } else {
                            html += `
                                <div class="day-status single-employee" 
                                    style="background-color: ${statusInfo.color}; cursor: pointer;"
                                    onclick="Attendance.handleDayClick('${this.viewState.selectedEmployee}', '${dateStr}')"
                                    title="${statusInfo.label}">
                                    ${status}
                                </div>
                            `;
                        }
                    }
                }
            }
            
            html += '</div>';
        }
        
        // Jours vides après le dernier jour
        const totalCells = firstDayOfWeek + daysInMonth;
        const remainingCells = 7 - (totalCells % 7);
        if (remainingCells < 7) {
            for (let i = 0; i < remainingCells; i++) {
                html += '<div class="calendar-day empty"></div>';
            }
        }
        
        html += `
                </div>
            </div>
        `;
        
        // Résumé mensuel
        if (this.viewState.selectedEmployee !== 'all') {
            const summary = this.getSummary(this.viewState.selectedEmployee, targetMonth);
            if (summary) {
                html += `
                    <div class="month-summary">
                        <h5>Résumé du mois</h5>
                        ${this.renderSummary(this.viewState.selectedEmployee, targetMonth)}
                    </div>
                `;
            }
        } else {
            // Statistiques globales
            const stats = this.getMonthStats(targetMonth);
            html += `
                <div class="month-summary">
                    <h5>Statistiques globales</h5>
                    <div class="global-stats">
                        <div class="stat-card">
                            <span class="stat-label">Taux de présence</span>
                            <span class="stat-value">${stats.presenceRate.toFixed(1)}%</span>
                        </div>
                        <div class="stat-card">
                            <span class="stat-label">Total présences</span>
                            <span class="stat-value">${stats.totalPresent}</span>
                        </div>
                        <div class="stat-card">
                            <span class="stat-label">Total absences</span>
                            <span class="stat-value">${stats.totalAbsent}</span>
                        </div>
                        <div class="stat-card">
                            <span class="stat-label">Total congés</span>
                            <span class="stat-value">${stats.totalLeave}</span>
                        </div>
                    </div>
                </div>
            `;
        }
        
        html += '</div>';
        
        // Ajouter les styles CSS pour le calendrier
        if (!document.getElementById('calendar-styles')) {
            const style = document.createElement('style');
            style.id = 'calendar-styles';
            style.textContent = `
                .calendar-view .calendar {
                    background: white;
                    border-radius: 8px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    padding: 20px;
                    margin-top: 20px;
                }
                
                .calendar-header {
                    display: grid;
                    grid-template-columns: repeat(7, 1fr);
                    gap: 5px;
                    margin-bottom: 10px;
                }
                
                .day-header {
                    text-align: center;
                    font-weight: bold;
                    padding: 10px;
                    background: #f8f9fa;
                    border-radius: 4px;
                }
                
                .calendar-body {
                    display: grid;
                    grid-template-columns: repeat(7, 1fr);
                    gap: 5px;
                }
                
                .calendar-day {
                    min-height: 80px;
                    border: 1px solid #dee2e6;
                    border-radius: 4px;
                    padding: 5px;
                    position: relative;
                    background: white;
                }
                
                .calendar-day.empty {
                    background: #f8f9fa;
                    border: none;
                }
                
                .calendar-day.weekend {
                    background: #f0f0f0;
                }
                
                .calendar-day.today {
                    border: 2px solid #007bff;
                    background: #e7f1ff;
                }
                
                .calendar-day.future {
                    opacity: 0.5;
                }
                
                .day-number {
                    font-weight: bold;
                    font-size: 14px;
                    margin-bottom: 5px;
                }
                
                .day-summary {
                    margin-top: 5px;
                }
                
                .mini-stats {
                    display: flex;
                    gap: 3px;
                    flex-wrap: wrap;
                }
                
                .mini-stats span {
                    padding: 2px 6px;
                    border-radius: 3px;
                    font-size: 11px;
                    font-weight: bold;
                    color: white;
                }
                
                .stat-p { background: #28a745; }
                .stat-a { background: #dc3545; }
                .stat-r { background: #ffc107; color: #333; }
                .stat-cp { background: #6f42c1; }
                
                .day-status.single-employee {
                    margin-top: 10px;
                    padding: 8px;
                    text-align: center;
                    border-radius: 4px;
                    color: white;
                    font-weight: bold;
                }
                
                .btn-day-detail {
                    margin-top: 5px;
                    padding: 2px 8px;
                    font-size: 11px;
                    border: none;
                    background: #007bff;
                    color: white;
                    border-radius: 3px;
                    cursor: pointer;
                }
                
                .attendance-controls {
                    display: flex;
                    gap: 20px;
                    align-items: center;
                    flex-wrap: wrap;
                }
                
                .month-navigation {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                
                .current-month {
                    font-weight: bold;
                    min-width: 150px;
                    text-align: center;
                }
                
                .global-stats {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                    gap: 15px;
                    margin-top: 15px;
                }
                
                .stat-card {
                    background: #f8f9fa;
                    padding: 15px;
                    border-radius: 8px;
                    text-align: center;
                }
                
                .stat-label {
                    display: block;
                    font-size: 12px;
                    color: #6c757d;
                    margin-bottom: 5px;
                }
                
                .stat-value {
                    display: block;
                    font-size: 24px;
                    font-weight: bold;
                    color: #495057;
                }
            `;
            document.head.appendChild(style);
        }
        
        return html;
    },
    
    // Rendu de la vue grille (ancienne vue)
    renderGridView: function(targetMonth) {
        const [year, monthNum] = targetMonth.split('-');
        const daysInMonth = new Date(year, monthNum, 0).getDate();
        const today = new Date();
        
        let html = '<div class="grid-wrapper">';
        
        // Filtrer les employés si un seul est sélectionné
        const employeesToShow = this.viewState.selectedEmployee === 'all' 
            ? Employees.list 
            : Employees.list.filter(e => (e._id || e.id) === this.viewState.selectedEmployee);
        
        // Pour chaque employé
        employeesToShow.forEach(employee => {
            const startDate = new Date(employee.startDate);
            const summary = this.getSummary(employee._id || employee.id, targetMonth);
            
            html += `
                <div class="employee-attendance">
                    <div class="employee-info">
                        <strong>${employee.name}</strong>
                        <small>${CONFIG.positions.find(p => p.value === employee.position)?.label}</small>
                    </div>
                    <div class="attendance-grid">
            `;
            
            // Grille des jours
            for (let day = 1; day <= daysInMonth; day++) {
                const currentDate = new Date(year, monthNum - 1, day);
                const dateStr = `${targetMonth}-${day.toString().padStart(2, '0')}`;
                const isValidDate = currentDate >= startDate && currentDate <= today;
                
                if (isValidDate) {
                    const status = this.getStatus(employee._id || employee.id, dateStr);
                    const statusInfo = CONFIG.attendanceStatus[status];
                    
                    if (status === 'CP') {
                        html += `
                            <button 
                                class="attendance-day cp-readonly"
                                style="background-color: ${statusInfo.color}; cursor: not-allowed; opacity: 0.8;"
                                onclick="event.preventDefault(); notify.info('Les congés se gèrent dans la section Congés')"
                                title="${day} - Congé payé (non modifiable)"
                            >
                                <div class="day-number">${day}</div>
                                <div class="day-status">CP 🔒</div>
                            </button>
                        `;
                    } else {
                        html += `
                            <button 
                                class="attendance-day"
                                style="background-color: ${statusInfo.color}"
                                onclick="Attendance.handleDayClick('${employee._id || employee.id}', '${dateStr}')"
                                title="${day} - ${statusInfo.label}"
                            >
                                <div class="day-number">${day}</div>
                                <div class="day-status">${status}</div>
                            </button>
                        `;
                    }
                } else {
                    html += `
                        <div class="attendance-day disabled">
                            <div class="day-number">${day}</div>
                        </div>
                    `;
                }
            }
            
            html += `
                    </div>
                    <div class="attendance-summary">
                        ${this.renderSummary(employee._id || employee.id, targetMonth)}
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        return html;
    },
    
    // Obtenir les statistiques d'un jour
    getDayStats: function(date) {
        const stats = {
            P: 0, A: 0, R: 0, DM: 0, CP: 0, total: 0
        };
        
        Employees.list.forEach(employee => {
            const startDate = new Date(employee.startDate);
            const dayDate = new Date(date);
            
            if (dayDate >= startDate) {
                const status = this.getStatus(employee._id || employee.id, date);
                if (stats[status] !== undefined) {
                    stats[status]++;
                }
                stats.total++;
            }
        });
        
        return stats;
    },
    
    // Afficher les détails d'un jour
    showDayDetails: function(date) {
        const dayStats = this.getDayStats(date);
        const [year, month, day] = date.split('-');
        const dayDate = new Date(year, month - 1, day);
        const dayName = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][dayDate.getDay()];
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h3>📅 Détails du ${dayName} ${day}/${month}/${year}</h3>
                    <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
                </div>
                
                <div class="modal-body">
                    <div class="day-stats-summary mb-3">
                        ${Object.entries(CONFIG.attendanceStatus).map(([key, val]) => `
                            <span class="stat-badge" style="background-color: ${val.color}">
                                ${val.label}: ${dayStats[key] || 0}
                            </span>
                        `).join('')}
                    </div>
                    
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Employé</th>
                                <th>Statut</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${Employees.list.map(employee => {
                                const startDate = new Date(employee.startDate);
                                if (dayDate < startDate) return '';
                                
                                const status = this.getStatus(employee._id || employee.id, date);
                                const statusInfo = CONFIG.attendanceStatus[status];
                                
                                return `
                                    <tr>
                                        <td>${employee.name}</td>
                                        <td>
                                            <span class="badge" style="background-color: ${statusInfo.color}">
                                                ${statusInfo.label}
                                            </span>
                                        </td>
                                        <td>
                                            ${status === 'CP' ? 
                                                '<span class="text-muted">🔒 Congé</span>' :
                                                `<button class="btn btn-sm btn-primary" 
                                                    onclick="Attendance.changeStatusFromModal('${employee._id || employee.id}', '${date}', this)">
                                                    Modifier
                                                </button>`
                                            }
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
                
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">
                        Fermer
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    },
    
    // Changer le statut depuis le modal
    changeStatusFromModal: async function(employeeId, date, button) {
        await this.toggleStatus(employeeId, date);
        
        // Rafraîchir le modal
        this.showDayDetails(date);
        
        // Rafraîchir le calendrier
        this.renderCalendar('attendanceGrid', this.viewState.currentMonth);
    },
    
    // Navigation mensuelle
    navigateMonth: function(direction) {
        const [year, month] = this.viewState.currentMonth.split('-');
        const date = new Date(year, month - 1 + direction, 1);
        const newMonth = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        
        // Charger le nouveau mois
        this.load(newMonth).then(() => {
            this.renderCalendar('attendanceGrid', newMonth);
        });
    },
    
    // Basculer entre vue calendrier et grille
    toggleView: function() {
        this.viewState.viewMode = this.viewState.viewMode === 'calendar' ? 'grid' : 'calendar';
        this.renderCalendar('attendanceGrid', this.viewState.currentMonth);
    },
    
    // Afficher le résumé
    renderSummary: function(employeeId, month) {
        const summary = this.getSummary(employeeId, month);
        if (!summary) return '';
        
        return `
            <div class="summary-items">
                ${Object.entries(CONFIG.attendanceStatus).map(([key, val]) => `
                    <span class="summary-item" style="color: ${val.color}">
                        ${key}: ${summary[key]}
                    </span>
                `).join('')}
                <span class="summary-item summary-total">
                    Total: ${summary.total}
                </span>
            </div>
        `;
    },
    
    // Gérer le clic sur un jour
    handleDayClick: async function(employeeId, date) {
        await this.toggleStatus(employeeId, date);
        
        // Rafraîchir l'affichage
        this.renderCalendar('attendanceGrid', this.viewState.currentMonth);
    },
    
    // Marquer tous présents pour aujourd'hui
    markAllPresent: async function() {
        const today = Utils.getCurrentDate();
        const confirmed = await Utils.confirm(
            'Marquer tous les employés comme présents pour aujourd\'hui ?'
        );
        
        if (!confirmed) return;
        
        let count = 0;
        for (const employee of Employees.list) {
            const startDate = new Date(employee.startDate);
            const todayDate = new Date(today);
            
            if (todayDate >= startDate) {
                await this.setStatus(employee._id || employee.id, today, 'P');
                count++;
            }
        }
        
        notify.success(`${count} employés marqués présents`);
        
        // Rafraîchir l'affichage si on est sur le mois en cours
        const currentMonth = Utils.getCurrentMonth();
        if (today.startsWith(currentMonth)) {
            this.renderCalendar('attendanceGrid', currentMonth);
        }
        
        // Forcer le rafraîchissement de l'UI
        if (window.UI && UI.render) {
            await UI.render();
        }
    },
    
    // Obtenir les statistiques du mois
    getMonthStats: function(month) {
        const stats = {
            totalDays: 0,
            totalPresent: 0,
            totalAbsent: 0,
            totalLate: 0,
            totalHalfDay: 0,
            totalLeave: 0,
            presenceRate: 0
        };
        
        Employees.list.forEach(employee => {
            const summary = this.getSummary(employee._id || employee.id, month);
            if (summary) {
                stats.totalDays += summary.total;
                stats.totalPresent += summary.P;
                stats.totalAbsent += summary.A;
                stats.totalLate += summary.R;
                stats.totalHalfDay += summary.DM;
                stats.totalLeave += summary.CP;
            }
        });
        
        // Calculer le taux de présence
        if (stats.totalDays > 0) {
            const effectivePresence = stats.totalPresent + stats.totalLeave + 
                                     (stats.totalLate * 0.75) + (stats.totalHalfDay * 0.5);
            stats.presenceRate = (effectivePresence / stats.totalDays) * 100;
        }
        
        return stats;
    },
    
    // Get employee ranking
    getEmployeeRanking: function(period = 'month') {
        const rankings = Employees.list.map(emp => {
            const summary = this.getSummary(emp._id || emp.id, Utils.getCurrentMonth());
            const rate = summary ? ((summary.P + summary.CP) / summary.total) * 100 : 0;
            
            // Vérifier les absences consécutives
            let consecutiveAbsences = 0;
            let maxConsecutiveAbsences = 0;
            const month = Utils.getCurrentMonth();
            const today = new Date();
            const daysToCheck = Math.min(30, today.getDate());
            
            for (let i = daysToCheck; i >= 1; i--) {
                const date = `${month}-${i.toString().padStart(2, '0')}`;
                const status = this.getStatus(emp._id || emp.id, date);
                
                if (status === 'A') {
                    consecutiveAbsences++;
                    maxConsecutiveAbsences = Math.max(maxConsecutiveAbsences, consecutiveAbsences);
                } else {
                    consecutiveAbsences = 0;
                }
            }
            
            return {
                ...emp,
                presenceRate: rate,
                summary: summary,
                consecutiveAbsences: maxConsecutiveAbsences,
                hasAlert: maxConsecutiveAbsences >= 3
            };
        });
        
        return rankings.sort((a, b) => b.presenceRate - a.presenceRate);
    },
    
    // Exporter le mois en CSV
    exportMonth: function(month) {
        const [year, monthNum] = month.split('-');
        const daysInMonth = new Date(year, monthNum, 0).getDate();
        
        // En-têtes
        let csv = 'Employé';
        for (let day = 1; day <= daysInMonth; day++) {
            csv += `,${day}`;
        }
        csv += ',Total P,Total A,Total R,Total DM,Total CP,Total\n';
        
        // Données
        Employees.list.forEach(employee => {
            csv += employee.name;
            
            const startDate = new Date(employee.startDate);
            const today = new Date();
            const summary = this.getSummary(employee._id || employee.id, month);
            
            // Jours
            for (let day = 1; day <= daysInMonth; day++) {
                const currentDate = new Date(year, monthNum - 1, day);
                const dateStr = `${month}-${day.toString().padStart(2, '0')}`;
                
                if (currentDate >= startDate && currentDate <= today) {
                    const status = this.getStatus(employee._id || employee.id, dateStr);
                    csv += `,${status}`;
                } else {
                    csv += `,-`;
                }
            }
            
            // Totaux
            csv += `,${summary ? summary.P : 0}`;
            csv += `,${summary ? summary.A : 0}`;
            csv += `,${summary ? summary.R : 0}`;
            csv += `,${summary ? summary.DM : 0}`;
            csv += `,${summary ? summary.CP : 0}`;
            csv += `,${summary ? summary.total : 0}`;
            csv += '\n';
        });
        
        // Télécharger
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `pointage-${month}.csv`;
        link.click();
        
        notify.success('Export réussi');
    },
    
    // Nouvelle méthode pour UI.js
    renderGrid: function(containerId, month = null) {
        // Appeler renderCalendar qui gère maintenant les deux vues
        this.renderCalendar(containerId, month);
    }
};

// Rendre disponible globalement
window.Attendance = Attendance;