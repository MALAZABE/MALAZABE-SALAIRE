// Gestion de l'interface utilisateur - VERSION 5.0 AVEC SUIVI AVANCES SPÉCIALES
const UI = {
    // Section active
    currentSection: 'dashboard',
    
    // Mois sélectionné
    selectedMonth: Utils.getCurrentMonth(),
    
    // Vue du rapport
    reportView: 'detailed',
    
    // Filtres actifs
    activeFilters: {
        reports: {
            employee: 'all',
            period: 'month',
            year: new Date().getFullYear(),
            startDate: null,
            endDate: null
        },
        payments: {
            employee: 'all',
            month: 'all',
            type: 'all'
        }
    },
    
    // Flag pour éviter les boucles infinies
    isRendering: false,
    
    // Initialiser l'interface
    init: function() {
        // Créer la structure de base
        this.createLayout();
        
        // Ajouter les événements
        this.bindEvents();
        
        // Charger la première section
        this.showSection('dashboard');
        
        // Appliquer le thème
        this.applyTheme();
        
        // Initialiser les styles des tableaux de rapports
        this.initReportTableStyles();
        
        // Initialiser les styles d'impression
        this.initPrintStyles();
        
        // NOUVEAU: Initialiser les styles pour les avances spéciales
        this.initSpecialAdvanceStyles();
    },
    
    // Créer la structure de l'interface
    createLayout: function() {
        const app = document.getElementById('app');
        
        app.innerHTML = `
            <!-- Sidebar -->
            <div class="sidebar" id="sidebar">
                <div class="sidebar-header">
                    <h3>🏢 MALAZA BE</h3>
                    <button class="sidebar-toggle" onclick="UI.toggleSidebar()">☰</button>
                </div>
                
                <nav class="sidebar-nav">
                    <a href="#" class="nav-item active" data-section="dashboard">
                        <span class="nav-icon">📊</span>
                        <span class="nav-text">Tableau de bord</span>
                    </a>
                    <a href="#" class="nav-item" data-section="employees">
                        <span class="nav-icon">👥</span>
                        <span class="nav-text">Employés</span>
                    </a>
                    <a href="#" class="nav-item" data-section="attendance">
                        <span class="nav-icon">📅</span>
                        <span class="nav-text">Pointage</span>
                    </a>
                    <a href="#" class="nav-item" data-section="salaries">
                        <span class="nav-icon">💵</span>
                        <span class="nav-text">Salaires</span>
                    </a>
                    <a href="#" class="nav-item" data-section="leaves">
                        <span class="nav-icon">🏖️</span>
                        <span class="nav-text">Congés</span>
                    </a>
                    <a href="#" class="nav-item" data-section="payments">
                        <span class="nav-icon">💳</span>
                        <span class="nav-text">Paiements</span>
                    </a>
                    <a href="#" class="nav-item" data-section="reports">
                        <span class="nav-icon">📁</span>
                        <span class="nav-text">Rapports</span>
                    </a>
                </nav>
                
                <div class="sidebar-footer">
                    <button class="btn btn-sm btn-secondary" onclick="UI.showSettingsModal()">
                        ⚙️ Paramètres
                    </button>
                </div>
            </div>
            
            <!-- Main content -->
            <div class="main-content">
                <!-- Header -->
                <header class="main-header">
                    <div class="header-left">
                        <h2 id="sectionTitle">Tableau de bord</h2>
                    </div>
                    <div class="header-right">
                        <div class="month-selector" id="monthSelector" style="display: none;">
                            <input 
                                type="month" 
                                id="globalMonth" 
                                class="form-control"
                                value="${this.selectedMonth}"
                                max="${Utils.getCurrentMonth()}"
                                onchange="UI.changeMonth(this.value)"
                            >
                        </div>
                        <button class="btn btn-sm btn-info" onclick="UI.refreshData()" title="Rafraîchir">
                            🔄
                        </button>
                        <button class="theme-toggle" onclick="UI.toggleTheme()" title="Changer le thème">
                            <span id="themeIcon">🌙</span>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="Auth.logout()">
                            Déconnexion
                        </button>
                    </div>
                </header>
                
                <!-- Content area -->
                <div class="content-area" id="contentArea">
                    <!-- Le contenu sera chargé ici -->
                </div>
            </div>
        `;
    },
    
    // Ajouter les événements
    bindEvents: function() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const section = item.dataset.section;
                this.showSection(section);
            });
        });
        
        // Raccourcis clavier
        document.addEventListener('keydown', (e) => {
            // Ctrl + E : Nouvel employé
            if (e.ctrlKey && e.key === 'e') {
                e.preventDefault();
                this.showSection('employees');
                Employees.showModal();
            }
            // Ctrl + P : Nouveau paiement
            else if (e.ctrlKey && e.key === 'p') {
                e.preventDefault();
                this.showSection('payments');
                Payments.showPaymentModal();
            }
            // Ctrl + L : Nouveau congé
            else if (e.ctrlKey && e.key === 'l') {
                e.preventDefault();
                this.showSection('leaves');
                Leaves.showLeaveModal();
            }
            // Ctrl + D : Dashboard
            else if (e.ctrlKey && e.key === 'd') {
                e.preventDefault();
                this.showSection('dashboard');
            }
            // Ctrl + R : Rafraîchir
            else if (e.ctrlKey && e.key === 'r') {
                e.preventDefault();
                this.refreshData();
            }
            // Echap : Fermer les modals
            else if (e.key === 'Escape') {
                const modal = document.querySelector('.modal');
                if (modal) {
                    modal.remove();
                }
            }
        });
    },
    
    // Afficher une section
    showSection: async function(section) {
        // Mettre à jour la navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.section === section);
        });
        
        // Mettre à jour le titre
        const titles = {
            dashboard: '📊 Tableau de bord',
            employees: '👥 Gestion des employés',
            attendance: '📅 Pointage journalier',
            salaries: '💵 Calcul des salaires',
            leaves: '🏖️ Gestion des congés',
            payments: '💳 Gestion des paiements',
            reports: '📁 Rapports et historique'
        };
        
        document.getElementById('sectionTitle').textContent = titles[section] || section;
        
        // Afficher/cacher le sélecteur de mois
        const monthSelector = document.getElementById('monthSelector');
        const needsMonth = ['attendance', 'salaries'].includes(section);
        monthSelector.style.display = needsMonth ? 'block' : 'none';
        
        // Mettre à jour la section courante
        this.currentSection = section;
        
        // Recharger les données et afficher
        await this.reloadAndRender();
    },
    
    // Recharger les données et rafraîchir l'affichage
    reloadAndRender: async function() {
        // Éviter les boucles
        if (this.isRendering) {
            console.log('Render déjà en cours');
            return;
        }
        
        this.isRendering = true;
        
        try {
            // Afficher un indicateur de chargement
            const contentArea = document.getElementById('contentArea');
            if (contentArea) {
                const currentContent = contentArea.innerHTML;
                contentArea.style.opacity = '0.5';
                contentArea.style.pointerEvents = 'none';
            }
            
            // ORDRE DE CHARGEMENT IMPORTANT
            // 1. Employés (base de tout)
            await Employees.load();
            
            // 2. Paiements (nécessaire pour calculer les avances)
            await Payments.load();
            
            // 3. Congés (nouvelle table séparée)
            await Leaves.load();
            
            // 4. Données spécifiques selon la section
            if (['attendance', 'salaries', 'reports'].includes(this.currentSection)) {
                await Attendance.load(this.selectedMonth);
            }
            
            // 5. Pour les salaires, charger aussi les bonus/avances
            if (this.currentSection === 'salaries') {
                if (window.Salary) {
                    await Salary.loadBonusesAdvances(this.selectedMonth);
                    await Salary.loadSpecialAdvances();
                }
            }
            
            console.log('✅ Toutes les données rechargées pour', this.currentSection);
            
            // Afficher le contenu
            await this.loadSectionContent(this.currentSection);
            
            // Restaurer l'opacité
            if (contentArea) {
                contentArea.style.opacity = '1';
                contentArea.style.pointerEvents = 'auto';
            }
            
        } catch (error) {
            console.error('Erreur rechargement:', error);
            notify.error('Erreur lors du chargement');
            
            // Restaurer l'interface même en cas d'erreur
            const contentArea = document.getElementById('contentArea');
            if (contentArea) {
                contentArea.style.opacity = '1';
                contentArea.style.pointerEvents = 'auto';
                contentArea.innerHTML = `
                    <div class="alert alert-danger">
                        Erreur lors du chargement des données. 
                        <button class="btn btn-sm btn-primary" onclick="UI.refreshData()">
                            Réessayer
                        </button>
                    </div>
                `;
            }
        } finally {
            this.isRendering = false;
        }
    },
    
    // Forcer un rafraîchissement complet
    forceFullRefresh: async function() {
        // Vider tous les caches possibles
        if (window.Attendance && Attendance.cache) {
            Attendance.cache = {};
        }
        if (window.Salary) {
            if (Salary.bonusCache) Salary.bonusCache = {};
            if (Salary.specialAdvanceCache) Salary.specialAdvanceCache = {};
        }
        
        // Forcer le rechargement
        this.isRendering = false; // Reset le flag
        await this.reloadAndRender();
    },
    
    // Alias pour la compatibilité
    render: async function() {
        await this.reloadAndRender();
    },
    
    // Charger le contenu d'une section
    loadSectionContent: async function(section) {
        const contentArea = document.getElementById('contentArea');
        
        // Afficher un loader
        contentArea.innerHTML = '<div class="loader">Chargement...</div>';
        
        try {
            switch (section) {
                case 'dashboard':
                    await this.renderDashboard();
                    break;
                    
                case 'employees':
                    await this.renderEmployees();
                    break;
                    
                case 'attendance':
                    contentArea.innerHTML = '<div id="attendanceGrid"></div>';
                    Attendance.renderGrid('attendanceGrid', this.selectedMonth);
                    break;
                    
                case 'salaries':
                    contentArea.innerHTML = '<div id="salaryTable"></div>';
                    if (window.Salary) {
                        Salary.renderTable('salaryTable', this.selectedMonth);
                    }
                    break;
                    
                case 'leaves':
                    contentArea.innerHTML = '<div id="leavesSection"></div>';
                    Leaves.renderSection('leavesSection');
                    break;
                    
                case 'payments':
                    await this.renderPaymentsWithFilters();
                    break;
                    
                case 'reports':
                    await this.renderAdvancedReports();
                    break;
                    
                default:
                    contentArea.innerHTML = '<div class="alert alert-warning">Section non implémentée</div>';
            }
        } catch (error) {
            console.error('Erreur chargement section:', error);
            contentArea.innerHTML = '<div class="alert alert-danger">Erreur lors du chargement</div>';
        }
    },
    
    // Rafraîchir manuellement les données
    refreshData: async function() {
        notify.info('Rafraîchissement...');
        await this.reloadAndRender();
        notify.success('Données rafraîchies');
    },
    
    // Changer le mois
    changeMonth: function(month) {
        this.selectedMonth = month;
        this.reloadAndRender();
    },
    
    // Basculer la sidebar
    toggleSidebar: function() {
        document.getElementById('sidebar').classList.toggle('collapsed');
        document.querySelector('.main-content').classList.toggle('expanded');
    },
    
    // Basculer le thème
    toggleTheme: function() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        document.getElementById('themeIcon').textContent = newTheme === 'light' ? '🌙' : '☀️';
        
        // Sauvegarder la préférence
        Utils.savePreference('theme', newTheme);
    },
    
    // Appliquer le thème sauvegardé
    applyTheme: function() {
        const savedTheme = Utils.loadPreference('theme', 'light');
        document.documentElement.setAttribute('data-theme', savedTheme);
        document.getElementById('themeIcon').textContent = savedTheme === 'light' ? '🌙' : '☀️';
    },
    
    // Afficher le tableau de bord
    renderDashboard: async function() {
        const contentArea = document.getElementById('contentArea');
        
        // Obtenir les statistiques
        const currentMonth = Utils.getCurrentMonth();
        const stats = {
            employees: Employees.getStats(),
            attendance: Attendance.getMonthStats(currentMonth),
            payments: await this.getPaymentStats(),
            leaves: this.getLeaveStats(),
            salary: window.Salary ? await Salary.getMonthlyStats(currentMonth) : null,
            specialAdvances: await this.getSpecialAdvancesStats()
        };
        
        contentArea.innerHTML = `
            <div class="dashboard">
                <!-- Cartes de statistiques -->
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-icon">👥</div>
                        <div class="stat-content">
                            <h3>${stats.employees.total}</h3>
                            <p>Employés actifs</p>
                        </div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-icon">💰</div>
                        <div class="stat-content">
                            <h3>${stats.salary ? Utils.formatMoney(stats.salary.totalNet) : 'N/A'}</h3>
                            <p>Masse salariale nette</p>
                        </div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-icon">📊</div>
                        <div class="stat-content">
                            <h3>${stats.attendance.presenceRate.toFixed(1)}%</h3>
                            <p>Taux de présence</p>
                        </div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-icon">📅</div>
                        <div class="stat-content">
                            <h3>${Utils.formatMoney(stats.specialAdvances.totalActive)}</h3>
                            <p>Avances spéc. actives</p>
                            <small>${stats.specialAdvances.activeCount} prêt(s)</small>
                        </div>
                    </div>
                </div>
                
                <!-- Actions rapides -->
                <div class="quick-actions">
                    <h4>⚡ Actions rapides</h4>
                    <div class="actions-grid">
                        <button class="action-btn" onclick="Employees.showModal()">
                            ➕ Nouvel employé
                        </button>
                        <button class="action-btn" onclick="Attendance.markAllPresent()">
                            ✅ Tous présents
                        </button>
                        <button class="action-btn" onclick="Payments.showPaymentModal()">
                            💵 Nouveau paiement
                        </button>
                        <button class="action-btn" onclick="Leaves.showLeaveModal()">
                            🏖️ Nouveau congé
                        </button>
                        <button class="action-btn" onclick="UI.exportData()">
                            💾 Backup
                        </button>
                    </div>
                </div>
                
                <!-- Alertes -->
                <div class="alerts-section">
                    <h4>🔔 Notifications</h4>
                    ${await this.getAlerts()}
                </div>
                
                <!-- Résumé du mois -->
                ${stats.salary ? `
                <div class="month-summary">
                    <h4>📈 Résumé du mois en cours</h4>
                    <div class="summary-grid">
                        <div class="summary-item">
                            <span class="label">Salaires bruts:</span>
                            <span class="value">${Utils.formatMoney(stats.salary.totalSalaries)}</span>
                        </div>
                        <div class="summary-item">
                            <span class="label">Déductions:</span>
                            <span class="value text-danger">-${Utils.formatMoney(stats.salary.totalDeductions)}</span>
                        </div>
                        <div class="summary-item">
                            <span class="label">Primes:</span>
                            <span class="value text-success">+${Utils.formatMoney(stats.salary.totalBonuses)}</span>
                        </div>
                        <div class="summary-item">
                            <span class="label">Avances:</span>
                            <span class="value text-warning">-${Utils.formatMoney(stats.salary.totalAdvances)}</span>
                        </div>
                        <div class="summary-item">
                            <span class="label"><strong>Net total:</strong></span>
                            <span class="value text-primary"><strong>${Utils.formatMoney(stats.salary.totalNet)}</strong></span>
                        </div>
                    </div>
                </div>
                ` : ''}
                
                <!-- NOUVEAU: Section avances spéciales sur le dashboard -->
                ${stats.specialAdvances.activeCount > 0 ? `
                <div class="special-advances-summary">
                    <h4>📅 Avances spéciales en cours</h4>
                    <div class="advances-preview">
                        ${await this.renderSpecialAdvancesSummary()}
                    </div>
                </div>
                ` : ''}
            </div>
        `;
    },
    
    // NOUVEAU: Obtenir les stats des avances spéciales
    getSpecialAdvancesStats: async function() {
        let activeCount = 0;
        let totalActive = 0;
        let dueThisMonth = 0;
        const currentMonth = Utils.getCurrentMonth();
        
        for (const emp of Employees.list) {
            const schedules = await Database.getSpecialAdvanceSchedules(emp._id || emp.id);
            
            for (const schedule of schedules) {
                if (schedule.status === 'active') {
                    // CORRECTION: Vérifier s'il reste vraiment quelque chose à payer
                    let hasRemainingPayments = false;
                    let remainingAmount = 0;
                    
                    Object.entries(schedule.schedule).forEach(([month, amount]) => {
                        // Vérifier si ce mois n'est pas déjà payé
                        const isPaid = schedule.paidMonths && schedule.paidMonths.includes(month);
                        
                        if (!isPaid && month >= currentMonth) {
                            hasRemainingPayments = true;
                            remainingAmount += amount;
                            
                            if (month === currentMonth) {
                                dueThisMonth += amount;
                            }
                        }
                    });
                    
                    // Ne compter que s'il reste vraiment des paiements
                    if (hasRemainingPayments) {
                        activeCount++;
                        totalActive += remainingAmount;
                    }
                }
            }
        }
        
        return {
            activeCount,
            totalActive,
            dueThisMonth
        };
    },
    
    // NOUVEAU: Résumé des avances spéciales pour le dashboard
    renderSpecialAdvancesSummary: async function() {
        const currentMonth = Utils.getCurrentMonth();
        const nextMonth = this.getNextMonth(currentMonth);
        const activeLoans = [];
        
        // Collecter les prêts actifs
        for (const emp of Employees.list) {
            const schedules = await Database.getSpecialAdvanceSchedules(emp._id || emp.id);
            
            for (const schedule of schedules) {
                if (schedule.status === 'active') {
                    // CORRECTION: Calculer le reste réel en excluant les mois payés
                    let remaining = 0;
                    let hasUnpaidMonths = false;
                    
                    Object.entries(schedule.schedule).forEach(([month, amount]) => {
                        // Vérifier si ce mois n'est pas déjà payé
                        const isPaid = schedule.paidMonths && schedule.paidMonths.includes(month);
                        
                        if (!isPaid && month >= currentMonth) {
                            remaining += amount;
                            hasUnpaidMonths = true;
                        }
                    });
                    
                    // Ne l'ajouter que s'il reste des paiements
                    if (hasUnpaidMonths && remaining > 0) {
                        const currentMonthAmount = schedule.schedule[currentMonth] || 0;
                        const nextMonthAmount = schedule.schedule[nextMonth] || 0;
                        
                        // Vérifier si ces mois ne sont pas déjà payés
                        const currentPaid = schedule.paidMonths && schedule.paidMonths.includes(currentMonth);
                        const nextPaid = schedule.paidMonths && schedule.paidMonths.includes(nextMonth);
                        
                        activeLoans.push({
                            employee: emp,
                            currentMonth: currentPaid ? 0 : currentMonthAmount,
                            nextMonth: nextPaid ? 0 : nextMonthAmount,
                            remaining: remaining
                        });
                    }
                }
            }
        }
        
        if (activeLoans.length === 0) return '';
        
        return `
            <table class="table table-sm">
                <thead>
                    <tr>
                        <th>Employé</th>
                        <th>Ce mois</th>
                        <th>Mois prochain</th>
                        <th>Reste total</th>
                    </tr>
                </thead>
                <tbody>
                    ${activeLoans.slice(0, 5).map(loan => `
                        <tr>
                            <td>${loan.employee.name}</td>
                            <td class="${loan.currentMonth > 0 ? 'text-warning' : ''}">${Utils.formatMoney(loan.currentMonth)}</td>
                            <td>${Utils.formatMoney(loan.nextMonth)}</td>
                            <td class="text-danger">${Utils.formatMoney(loan.remaining)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            ${activeLoans.length > 5 ? `<small>Et ${activeLoans.length - 5} autre(s)...</small>` : ''}
        `;
    },
    
    // Obtenir les statistiques de congés
    getLeaveStats: function() {
        const currentDate = new Date();
        const currentCount = Leaves.list.filter(leave => {
            if (leave.status === 'current') return true;
            // Vérifier si le congé est en cours
            if (leave.startDate && leave.endDate) {
                const start = new Date(leave.startDate);
                const end = new Date(leave.endDate);
                return currentDate >= start && currentDate <= end;
            }
            return false;
        }).length;
        
        const currentYear = currentDate.getFullYear();
        const yearCount = Leaves.list.filter(leave => 
            new Date(leave.startDate || leave.date).getFullYear() === currentYear
        ).length;
        
        return {
            currentCount: currentCount,
            yearCount: yearCount,
            totalDays: Leaves.list.reduce((sum, leave) => sum + (leave.days || 0), 0)
        };
    },
    
    // Obtenir les statistiques de paiements
    getPaymentStats: async function() {
        const currentMonth = Utils.getCurrentMonth();
        const currentYear = new Date().getFullYear();
        
        const stats = {
            totalThisMonth: 0,
            totalThisYear: 0,
            unpaidEmployees: 0,
            totalRemaining: 0
        };
        
        // Total du mois
        stats.totalThisMonth = Payments.list
            .filter(p => p.month === currentMonth && p.paymentType === 'salary')
            .reduce((sum, p) => sum + (p.amount || 0), 0);
        
        // Total de l'année
        stats.totalThisYear = Payments.list
            .filter(p => new Date(p.date).getFullYear() === currentYear)
            .reduce((sum, p) => sum + (p.amount || 0), 0);
        
        // Employés non payés
        for (const emp of Employees.list) {
            const remaining = Payments.getRemainingToPay(emp._id || emp.id, currentMonth);
            if (remaining > 0) {
                stats.unpaidEmployees++;
                stats.totalRemaining += remaining;
            }
        }
        
        return stats;
    },
    
    // Afficher les employés
    renderEmployees: async function() {
        const contentArea = document.getElementById('contentArea');
        const stats = Employees.getStats();
        
        contentArea.innerHTML = `
            <div class="employees-section">
                <div class="section-header">
                    <h4>Liste des employés (${Employees.list.length})</h4>
                    <button class="btn btn-primary" onclick="Employees.showModal()">
                        ➕ Ajouter un employé
                    </button>
                </div>
                
                <div class="employees-stats">
                    <span>Masse salariale totale: <strong>${Utils.formatMoney(stats.totalSalary)}</strong></span>
                    ${stats.averageSalary ? `<span>Salaire moyen: <strong>${Utils.formatMoney(stats.averageSalary)}</strong></span>` : ''}
                </div>
                
                <div class="employees-grid">
                    ${await this.renderEmployeeCards()}
                </div>
                
                ${Employees.list.length === 0 ? `
                    <div class="empty-state">
                        <p>Aucun employé enregistré</p>
                        <button class="btn btn-primary" onclick="Employees.showModal()">
                            Ajouter le premier employé
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    },
    
    // NOUVEAU: Rendre les cartes employés avec info avances spéciales
    renderEmployeeCards: async function() {
        let html = '';
        
        for (const emp of Employees.list) {
            // Calculer le solde de congés
            const leaveBalance = Leaves.getBalance(emp._id || emp.id);
            
            // NOUVEAU: Obtenir les infos d'avances spéciales
            const specialAdvanceInfo = await this.getEmployeeSpecialAdvanceInfo(emp._id || emp.id);
            
            html += `
                <div class="employee-card">
                    <div class="employee-header">
                        <h5>${emp.name}</h5>
                        <span class="badge">${CONFIG.positions.find(p => p.value === emp.position)?.label}</span>
                    </div>
                    <div class="employee-details">
                        <p><strong>CIN:</strong> ${emp.cin}</p>
                        <p><strong>Salaire:</strong> ${Utils.formatMoney(emp.salary)}</p>
                        <p><strong>Date d'entrée:</strong> ${Utils.formatDate(emp.startDate)}</p>
                        <p><strong>Congés:</strong> ${leaveBalance.available.toFixed(1)} jours disponibles</p>
                        ${emp.phone ? `<p><strong>Tél:</strong> ${emp.phone}</p>` : ''}
                        ${emp.address ? `<p><strong>Adresse:</strong> ${emp.address}</p>` : ''}
                        ${specialAdvanceInfo ? `
                            <div class="special-advance-info">
                                <p class="text-warning">
                                    <strong>📅 Avance spéciale:</strong> ${Utils.formatMoney(specialAdvanceInfo.remaining)} restants
                                    <button class="btn btn-xs btn-link" onclick="UI.showSpecialAdvanceDetails('${emp._id || emp.id}')">
                                        Détails
                                    </button>
                                </p>
                            </div>
                        ` : ''}
                    </div>
                    <div class="employee-actions">
                        <button class="btn btn-sm btn-info" onclick="Employees.showModal('${emp._id || emp.id}')">
                            ✏️ Modifier
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="Employees.delete('${emp._id || emp.id}')">
                            🗑️ Supprimer
                        </button>
                    </div>
                </div>
            `;
        }
        
        return html;
    },
    
    // NOUVEAU: Obtenir les infos d'avance spéciale d'un employé
    getEmployeeSpecialAdvanceInfo: async function(employeeId) {
        const schedules = await Database.getSpecialAdvanceSchedules(employeeId);
        const activeSchedule = schedules.find(s => s.status === 'active');
        
        if (!activeSchedule) return null;
        
        const currentMonth = Utils.getCurrentMonth();
        let remaining = 0;
        let nextPayment = null;
        
        Object.entries(activeSchedule.schedule).forEach(([month, amount]) => {
            if (month >= currentMonth) {
                remaining += amount;
                if (!nextPayment && month >= currentMonth) {
                    nextPayment = { month, amount };
                }
            }
        });
        
        if (remaining === 0) return null;
        
        return {
            totalAmount: activeSchedule.totalAmount,
            remaining: remaining,
            nextPayment: nextPayment
        };
    },
    
    // Afficher les paiements avec filtres
    renderPaymentsWithFilters: async function() {
        const contentArea = document.getElementById('contentArea');
        
        contentArea.innerHTML = `
            <div class="payments-container">
                <div class="section-header">
                    <h4>📋 Historique des paiements</h4>
                    <button class="btn btn-primary" onclick="Payments.showPaymentModal()">
                        ➕ Nouveau paiement
                    </button>
                </div>
                
                <!-- Filtres -->
                <div class="filters-section">
                    <div class="filter-group">
                        <label>Employé:</label>
                        <select id="filterEmployee" class="form-control" onchange="UI.applyPaymentFilters()">
                            <option value="all">Tous les employés</option>
                            ${Employees.list.map(emp => 
                                `<option value="${emp._id || emp.id}">${emp.name}</option>`
                            ).join('')}
                        </select>
                    </div>
                    
                    <div class="filter-group">
                        <label>Mois:</label>
                        <select id="filterMonth" class="form-control" onchange="UI.applyPaymentFilters()">
                            <option value="all">Tous les mois</option>
                            ${this.getAvailableMonths().map(month => 
                                `<option value="${month}" ${month === Utils.getCurrentMonth() ? 'selected' : ''}>
                                    ${Utils.formatMonth(month)}
                                </option>`
                            ).join('')}
                        </select>
                    </div>
                    
                    <div class="filter-group">
                        <label>Type:</label>
                        <select id="filterType" class="form-control" onchange="UI.applyPaymentFilters()">
                            <option value="all">Tous les types</option>
                            ${Object.entries(Payments.PAYMENT_TYPES).map(([value, info]) => 
                                `<option value="${value}">${info.label}</option>`
                            ).join('')}
                        </select>
                    </div>
                    
                    <button class="btn btn-secondary" onclick="UI.resetPaymentFilters()">
                        🔄 Réinitialiser
                    </button>
                </div>
                
                <div id="filteredPayments">
                    ${this.renderFilteredPayments()}
                </div>
            </div>
        `;
    },
    
    // Obtenir les mois disponibles
    getAvailableMonths: function() {
        const months = new Set();
        Payments.list.forEach(p => {
            const month = p.month || p.date?.substring(0, 7);
            if (month) months.add(month);
        });
        return Array.from(months).sort().reverse();
    },
    
    // Appliquer les filtres de paiements
    applyPaymentFilters: function() {
        const employee = document.getElementById('filterEmployee').value;
        const month = document.getElementById('filterMonth').value;
        const type = document.getElementById('filterType').value;
        
        this.activeFilters.payments = { employee, month, type };
        
        document.getElementById('filteredPayments').innerHTML = this.renderFilteredPayments();
    },
    
    // Réinitialiser les filtres
    resetPaymentFilters: function() {
        document.getElementById('filterEmployee').value = 'all';
        document.getElementById('filterMonth').value = 'all';
        document.getElementById('filterType').value = 'all';
        
        this.activeFilters.payments = { employee: 'all', month: 'all', type: 'all' };
        
        document.getElementById('filteredPayments').innerHTML = this.renderFilteredPayments();
    },
    
    // Afficher les paiements filtrés
    renderFilteredPayments: function() {
        const filters = this.activeFilters.payments;
        
        // Filtrer les paiements
        let filteredPayments = [...Payments.list];
        
        if (filters.employee !== 'all') {
            filteredPayments = filteredPayments.filter(p => p.employeeId === filters.employee);
        }
        
        if (filters.month !== 'all') {
            filteredPayments = filteredPayments.filter(p => {
                const pMonth = p.month || p.date?.substring(0, 7);
                return pMonth === filters.month;
            });
        }
        
        if (filters.type !== 'all') {
            filteredPayments = filteredPayments.filter(p => p.paymentType === filters.type);
        }
        
        // Grouper par mois
        const paymentsByMonth = {};
        filteredPayments.forEach(payment => {
            const month = payment.month || payment.date.substring(0, 7);
            if (!paymentsByMonth[month]) {
                paymentsByMonth[month] = [];
            }
            paymentsByMonth[month].push(payment);
        });
        
        // Trier les mois
        const sortedMonths = Object.keys(paymentsByMonth).sort().reverse();
        
        if (filteredPayments.length === 0) {
            return '<div class="alert alert-info">Aucun paiement trouvé avec ces filtres.</div>';
        }
        
        // Calculer les totaux
        const totals = this.calculatePaymentTotals(filteredPayments);
        
        let html = `
            <div class="payment-summary">
                <h5>Résumé des paiements filtrés</h5>
                <div class="summary-grid">
                    <div>Total: <strong>${Utils.formatMoney(totals.total)}</strong></div>
                    <div>Nombre: <strong>${filteredPayments.length}</strong></div>
                    ${totals.byType.map(t => 
                        `<div>${t.label}: <strong>${Utils.formatMoney(t.amount)}</strong></div>`
                    ).join('')}
                </div>
            </div>
        `;
        
        sortedMonths.forEach(month => {
            const monthPayments = paymentsByMonth[month];
            const monthTotal = monthPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
            
            html += `
                <div class="month-section">
                    <h5 class="month-header">
                        ${Utils.formatMonth(month)}
                        <span class="month-total">${Utils.formatMoney(monthTotal)}</span>
                    </h5>
                    
                    <div class="table-responsive">
                        <table class="table table-sm">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Employé</th>
                                    <th>Type</th>
                                    <th>Description</th>
                                    <th>Mode</th>
                                    <th>Montant</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
            `;
            
            monthPayments.forEach(payment => {
                const employee = Employees.getById(payment.employeeId);
                const typeInfo = Payments.PAYMENT_TYPES[payment.paymentType] || { label: payment.paymentType };
                
                html += `
                    <tr>
                        <td>${Utils.formatDate(payment.date)}</td>
                        <td>${employee ? employee.name : 'Employé supprimé'}</td>
                        <td>${typeInfo.label}</td>
                        <td><small>${payment.description || ''}</small></td>
                        <td>${CONFIG.paymentMethods.find(m => m.value === payment.method)?.label}</td>
                        <td class="text-primary font-weight-bold">
                            ${Utils.formatMoney(payment.amount)}
                        </td>
                        <td>
                            ${['advance', 'salary', 'bonus', 'other'].includes(payment.paymentType) ? `
                                <button class="btn btn-sm btn-info" 
                                    onclick="Payments.showEditModal('${payment._id}')">
                                    ✏️
                                </button>
                            ` : ''}
                            <button class="btn btn-sm btn-danger" 
                                onclick="Payments.delete('${payment._id}')">
                                🗑️
                            </button>
                        </td>
                    </tr>
                `;
            });
            
            html += `
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        });
        
        return html;
    },
    
    // Calculer les totaux des paiements
    calculatePaymentTotals: function(payments) {
        const byType = {};
        let total = 0;
        
        payments.forEach(p => {
            total += p.amount || 0;
            if (!byType[p.paymentType]) {
                byType[p.paymentType] = 0;
            }
            byType[p.paymentType] += p.amount || 0;
        });
        
        return {
            total,
            byType: Object.entries(byType).map(([type, amount]) => ({
                type,
                label: Payments.PAYMENT_TYPES[type]?.label || type,
                amount
            }))
        };
    },
    
    // Afficher les rapports avancés avec tableaux
    renderAdvancedReports: async function() {
        const contentArea = document.getElementById('contentArea');
        
        contentArea.innerHTML = `
            <div class="reports-section">
                <div class="section-header">
                    <h4>📁 Rapports et analyses</h4>
                    <div class="header-actions">
                        <button class="btn btn-primary" onclick="UI.exportFilteredReport()">
                            📥 Exporter
                        </button>
                        <button class="btn btn-info" onclick="UI.printFilteredReport()">
                            🖨️ Imprimer
                        </button>
                    </div>
                </div>
                
                <!-- NOUVEAU: Sélecteur de type de rapport -->
                <div class="report-type-selector">
                    <div class="btn-group btn-group-toggle">
                        <button class="btn btn-outline-primary active" onclick="UI.setReportType('salaries')">
                            💵 Salaires
                        </button>
                        <button class="btn btn-outline-primary" onclick="UI.setReportType('special_advances')">
                            📅 Avances spéciales
                        </button>
                    </div>
                </div>
                
                <div id="reportFilters">
                    <!-- Les filtres seront affichés ici selon le type -->
                </div>
                
                <div id="reportContent">
                    <!-- Le rapport sera affiché ici -->
                </div>
            </div>
        `;
        
        // Initialiser avec les rapports de salaires
        this.currentReportType = 'salaries';
        this.showReportFilters('salaries');
        await this.generateReport();
    },
    
    // NOUVEAU: Définir le type de rapport
    setReportType: function(type) {
        this.currentReportType = type;
        
        // Mettre à jour les boutons
        document.querySelectorAll('.report-type-selector .btn').forEach(btn => {
            btn.classList.remove('active');
        });
        event.target.classList.add('active');
        
        // Afficher les filtres appropriés
        this.showReportFilters(type);
        
        // Générer le rapport
        this.generateReport();
    },
    
    // NOUVEAU: Afficher les filtres selon le type de rapport
    showReportFilters: function(type) {
        const filtersDiv = document.getElementById('reportFilters');
        
        if (type === 'salaries') {
            // Filtres existants pour les salaires
            filtersDiv.innerHTML = `
                <!-- Filtres avancés -->
                <div class="report-filters">
                    <div class="filter-row">
                        <div class="filter-group">
                            <label>Employé:</label>
                            <select id="reportEmployee" class="form-control" onchange="UI.applyReportFilters()">
                                <option value="all">Tous les employés</option>
                                ${Employees.list.map(emp => 
                                    `<option value="${emp._id || emp.id}">${emp.name}</option>`
                                ).join('')}
                            </select>
                        </div>
                        
                        <div class="filter-group">
                            <label>Période:</label>
                            <select id="reportPeriod" class="form-control" onchange="UI.changePeriodType()">
                                <option value="month">Mois spécifique</option>
                                <option value="year">Année complète</option>
                                <option value="custom">Période personnalisée</option>
                            </select>
                        </div>
                        
                        <div id="periodSelector">
                            <!-- Sera rempli dynamiquement -->
                        </div>
                    </div>
                    
                    <div class="filter-actions">
                        <button class="btn btn-primary" onclick="UI.applyReportFilters()">
                            🔍 Appliquer
                        </button>
                        <button class="btn btn-secondary" onclick="UI.resetReportFilters()">
                            🔄 Réinitialiser
                        </button>
                    </div>
                </div>
                
                <!-- Sélecteur de vue pour les rapports multi-mois -->
                <div id="viewToggle" style="display: none;" class="view-toggle">
                    <div class="btn-group">
                        <button class="btn btn-outline-primary active" onclick="UI.setReportView('detailed')">
                            📊 Vue détaillée
                        </button>
                        <button class="btn btn-outline-primary" onclick="UI.setReportView('summary')">
                            📈 Vue synthèse
                        </button>
                    </div>
                </div>
            `;
            
            // Initialiser les sélecteurs de période
            this.changePeriodType();
            
        } else if (type === 'special_advances') {
            // Nouveaux filtres pour les avances spéciales
            filtersDiv.innerHTML = `
                <div class="report-filters">
                    <div class="filter-row">
                        <div class="filter-group">
                            <label>Employé:</label>
                            <select id="advanceEmployee" class="form-control" onchange="UI.generateReport()">
                                <option value="all">Tous les employés</option>
                                ${Employees.list.map(emp => 
                                    `<option value="${emp._id || emp.id}">${emp.name}</option>`
                                ).join('')}
                            </select>
                        </div>
                        
                        <div class="filter-group">
                            <label>Statut:</label>
                            <select id="advanceStatus" class="form-control" onchange="UI.generateReport()">
                                <option value="all">Tous</option>
                                <option value="active" selected>Actifs</option>
                                <option value="completed">Terminés</option>
                            </select>
                        </div>
                    </div>
                </div>
            `;
        }
    },
    
    // Changer le type de période
    changePeriodType: function() {
        const periodType = document.getElementById('reportPeriod').value;
        const selector = document.getElementById('periodSelector');
        
        switch (periodType) {
            case 'month':
                selector.innerHTML = `
                    <div class="filter-group">
                        <label>Mois:</label>
                        <input type="month" id="reportMonth" class="form-control" 
                            value="${Utils.getCurrentMonth()}" 
                            max="${Utils.getCurrentMonth()}">
                    </div>
                `;
                break;
                
            case 'year':
                selector.innerHTML = `
                    <div class="filter-group">
                        <label>Année:</label>
                        <select id="reportYear" class="form-control">
                            ${this.getAvailableYears().map(year => 
                                `<option value="${year}" ${year == new Date().getFullYear() ? 'selected' : ''}>
                                    ${year}
                                </option>`
                            ).join('')}
                        </select>
                    </div>
                `;
                break;
                
            case 'custom':
                selector.innerHTML = `
                    <div class="filter-group">
                        <label>Du:</label>
                        <input type="date" id="reportStartDate" class="form-control">
                    </div>
                    <div class="filter-group">
                        <label>Au:</label>
                        <input type="date" id="reportEndDate" class="form-control" 
                            max="${Utils.getCurrentDate()}">
                    </div>
                `;
                break;
        }
    },
    
    // Obtenir les années disponibles
    getAvailableYears: function() {
        const years = new Set();
        
        // Depuis les paiements
        Payments.list.forEach(p => {
            years.add(new Date(p.date).getFullYear());
        });
        
        // Depuis les employés (date d'entrée)
        Employees.list.forEach(emp => {
            if (emp.startDate) {
                years.add(new Date(emp.startDate).getFullYear());
            }
        });
        
        // Ajouter l'année courante
        years.add(new Date().getFullYear());
        
        return Array.from(years).sort().reverse();
    },
    
    // Appliquer les filtres de rapport
    applyReportFilters: async function() {
        await this.generateReport();
    },
    
    // Réinitialiser les filtres
    resetReportFilters: async function() {
        if (this.currentReportType === 'salaries') {
            document.getElementById('reportEmployee').value = 'all';
            document.getElementById('reportPeriod').value = 'month';
            this.changePeriodType();
        } else {
            document.getElementById('advanceEmployee').value = 'all';
            document.getElementById('advanceStatus').value = 'active';
        }
        await this.generateReport();
    },
    
    // Générer le rapport
    generateReport: async function() {
        const reportContent = document.getElementById('reportContent');
        
        if (this.currentReportType === 'salaries') {
            // Rapport de salaires existant
            await this.generateSalaryReport(reportContent);
        } else if (this.currentReportType === 'special_advances') {
            // Nouveau rapport des avances spéciales
            await this.generateSpecialAdvancesReport(reportContent);
        }
    },
    
    // NOUVEAU: Générer le rapport des avances spéciales
    generateSpecialAdvancesReport: async function(container) {
        const employeeFilter = document.getElementById('advanceEmployee')?.value || 'all';
        const statusFilter = document.getElementById('advanceStatus')?.value || 'active';
        
        const loans = [];
        
        // Collecter toutes les avances spéciales
        for (const emp of Employees.list) {
            if (employeeFilter !== 'all' && (emp._id || emp.id) !== employeeFilter) continue;
            
            const schedules = await Database.getSpecialAdvanceSchedules(emp._id || emp.id);
            
            for (const schedule of schedules) {
                if (statusFilter !== 'all' && schedule.status !== statusFilter) continue;
                
                const loanInfo = await this.calculateLoanInfo(emp, schedule);
                loans.push(loanInfo);
            }
        }
        
        // Trier par statut et date
        loans.sort((a, b) => {
            if (a.status !== b.status) {
                return a.status === 'active' ? -1 : 1;
            }
            return new Date(b.startDate) - new Date(a.startDate);
        });
        
        // Statistiques globales
        const stats = this.calculateSpecialAdvancesStats(loans);
        
        // Générer le HTML
        let html = `
            <div class="special-advances-report">
                <!-- Résumé -->
                <div class="summary-cards">
                    <div class="card text-center">
                        <div class="card-body">
                            <h6>Prêts actifs</h6>
                            <h3 class="text-primary">${stats.activeCount}</h3>
                            <small>employé(s)</small>
                        </div>
                    </div>
                    <div class="card text-center">
                        <div class="card-body">
                            <h6>Total en cours</h6>
                            <h3 class="text-danger">${Utils.formatMoney(stats.totalRemaining)}</h3>
                            <small>à récupérer</small>
                        </div>
                    </div>
                    <div class="card text-center">
                        <div class="card-body">
                            <h6>Échéances ${Utils.formatMonth(Utils.getCurrentMonth())}</h6>
                            <h3 class="text-warning">${Utils.formatMoney(stats.dueThisMonth)}</h3>
                            <small>ce mois</small>
                        </div>
                    </div>
                    <div class="card text-center">
                        <div class="card-body">
                            <h6>Total prêté</h6>
                            <h3 class="text-info">${Utils.formatMoney(stats.totalLoaned)}</h3>
                            <small>depuis le début</small>
                        </div>
                    </div>
                </div>
                
                ${loans.length === 0 ? 
                    '<div class="alert alert-info mt-4">Aucune avance spéciale trouvée avec ces critères.</div>' :
                    this.renderSpecialAdvancesTable(loans)
                }
            </div>
        `;
        
        container.innerHTML = html;
    },
    
    // NOUVEAU: Calculer les infos d'un prêt
    calculateLoanInfo: async function(employee, schedule) {
        const currentMonth = Utils.getCurrentMonth();
        let paid = 0;
        let remaining = 0;
        let nextPayment = null;
        let progress = 0;
        const monthlyPayments = [];
        
        // Analyser l'échéancier
        const sortedMonths = Object.keys(schedule.schedule).sort();
        
        for (const [month, amount] of Object.entries(schedule.schedule)) {
            const isPaid = month < currentMonth || (schedule.paidMonths && schedule.paidMonths.includes(month));
            
            monthlyPayments.push({
                month: month,
                amount: amount,
                isPaid: isPaid,
                isCurrent: month === currentMonth
            });
            
            if (isPaid) {
                paid += amount;
            } else {
                remaining += amount;
                if (!nextPayment && month >= currentMonth) {
                    nextPayment = { month, amount };
                }
            }
        }
        
        progress = (paid / schedule.totalAmount) * 100;
        
        return {
            employee: employee,
            employeeId: employee._id || employee.id,
            totalAmount: schedule.totalAmount,
            startDate: schedule.loanDate,
            endDate: sortedMonths[sortedMonths.length - 1],
            paid: paid,
            remaining: remaining,
            nextPayment: nextPayment,
            progress: progress,
            status: schedule.status,
            monthlyPayments: monthlyPayments.sort((a, b) => a.month.localeCompare(b.month)),
            reportHistory: schedule.reportHistory || []
        };
    },
    
    // NOUVEAU: Calculer les statistiques des avances spéciales
    calculateSpecialAdvancesStats: function(loans) {
        const currentMonth = Utils.getCurrentMonth();
        let activeCount = 0;
        let totalRemaining = 0;
        let dueThisMonth = 0;
        let totalLoaned = 0;
        
        loans.forEach(loan => {
            totalLoaned += loan.totalAmount;
            
            if (loan.status === 'active') {
                activeCount++;
                totalRemaining += loan.remaining;
                
                const currentPayment = loan.monthlyPayments.find(p => p.month === currentMonth && !p.isPaid);
                if (currentPayment) {
                    dueThisMonth += currentPayment.amount;
                }
            }
        });
        
        return {
            activeCount,
            totalRemaining,
            dueThisMonth,
            totalLoaned
        };
    },
    
    // NOUVEAU: Afficher le tableau des avances spéciales
    renderSpecialAdvancesTable: function(loans) {
        const activeLoans = loans.filter(l => l.status === 'active');
        const completedLoans = loans.filter(l => l.status !== 'active');
        
        let html = '';
        
        if (activeLoans.length > 0) {
            html += `
                <h5 class="mt-4">📅 Prêts en cours</h5>
                <div class="table-responsive">
                    <table class="table table-bordered table-hover">
                        <thead class="thead-light">
                            <tr>
                                <th>Employé</th>
                                <th>Montant total</th>
                                <th>Payé</th>
                                <th>Reste dû</th>
                                <th>Prochaine échéance</th>
                                <th>Fin prévue</th>
                                <th>Progression</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${activeLoans.map(loan => `
                                <tr>
                                    <td><strong>${loan.employee.name}</strong></td>
                                    <td>${Utils.formatMoney(loan.totalAmount)}</td>
                                    <td class="text-success">${Utils.formatMoney(loan.paid)}</td>
                                    <td class="text-danger font-weight-bold">${Utils.formatMoney(loan.remaining)}</td>
                                    <td>
                                        ${loan.nextPayment ? 
                                            `<span class="text-warning">${Utils.formatMonth(loan.nextPayment.month)}: ${Utils.formatMoney(loan.nextPayment.amount)}</span>` : 
                                            '-'
                                        }
                                    </td>
                                    <td>${Utils.formatMonth(loan.endDate)}</td>
                                    <td>
                                        <div class="progress" style="height: 20px;">
                                            <div class="progress-bar ${loan.progress > 75 ? 'bg-success' : loan.progress > 50 ? 'bg-info' : 'bg-warning'}" 
                                                style="width: ${loan.progress}%">
                                                ${loan.progress.toFixed(0)}%
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <button class="btn btn-sm btn-info" 
                                            onclick="UI.showSpecialAdvanceDetails('${loan.employeeId}')">
                                            📋 Détails
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot class="table-secondary font-weight-bold">
                            <tr>
                                <td>TOTAL</td>
                                <td>${Utils.formatMoney(activeLoans.reduce((sum, l) => sum + l.totalAmount, 0))}</td>
                                <td class="text-success">${Utils.formatMoney(activeLoans.reduce((sum, l) => sum + l.paid, 0))}</td>
                                <td class="text-danger">${Utils.formatMoney(activeLoans.reduce((sum, l) => sum + l.remaining, 0))}</td>
                                <td colspan="4"></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            `;
        }
        
        if (completedLoans.length > 0) {
            html += `
                <h5 class="mt-4">✅ Prêts terminés</h5>
                <div class="table-responsive">
                    <table class="table table-sm table-striped">
                        <thead>
                            <tr>
                                <th>Employé</th>
                                <th>Montant</th>
                                <th>Période</th>
                                <th>Statut</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${completedLoans.map(loan => `
                                <tr>
                                    <td>${loan.employee.name}</td>
                                    <td>${Utils.formatMoney(loan.totalAmount)}</td>
                                    <td>${Utils.formatMonth(loan.startDate)} - ${Utils.formatMonth(loan.endDate)}</td>
                                    <td><span class="badge badge-success">Terminé</span></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }
        
        return html;
    },
    
    // NOUVEAU: Afficher les détails d'une avance spéciale
    showSpecialAdvanceDetails: async function(employeeId) {
        const employee = Employees.getById(employeeId);
        if (!employee) return;
        
        const schedules = await Database.getSpecialAdvanceSchedules(employeeId);
        const activeSchedule = schedules.find(s => s.status === 'active');
        
        if (!activeSchedule) {
            notify.info('Aucune avance spéciale active pour cet employé');
            return;
        }
        
        const loanInfo = await this.calculateLoanInfo(employee, activeSchedule);
        
        const modal = document.createElement('div');
        modal.className = 'modal modal-lg';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 800px;">
                <div class="modal-header">
                    <h3>📅 Détails de l'avance spéciale - ${employee.name}</h3>
                    <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
                </div>
                
                <div class="modal-body">
                    <!-- Résumé -->
                    <div class="loan-summary">
                        <div class="row">
                            <div class="col-md-6">
                                <h5>Informations du prêt</h5>
                                <table class="table table-sm">
                                    <tr>
                                        <td>Montant total:</td>
                                        <td class="font-weight-bold">${Utils.formatMoney(loanInfo.totalAmount)}</td>
                                    </tr>
                                    <tr>
                                        <td>Date du prêt:</td>
                                        <td>${Utils.formatDate(loanInfo.startDate)}</td>
                                    </tr>
                                    <tr>
                                        <td>Fin prévue:</td>
                                        <td>${Utils.formatMonth(loanInfo.endDate)}</td>
                                    </tr>
                                    <tr>
                                        <td>Nombre de mois:</td>
                                        <td>${loanInfo.monthlyPayments.length}</td>
                                    </tr>
                                </table>
                            </div>
                            <div class="col-md-6">
                                <h5>État actuel</h5>
                                <table class="table table-sm">
                                    <tr>
                                        <td>Montant payé:</td>
                                        <td class="text-success">${Utils.formatMoney(loanInfo.paid)}</td>
                                    </tr>
                                    <tr>
                                        <td>Reste dû:</td>
                                        <td class="text-danger font-weight-bold">${Utils.formatMoney(loanInfo.remaining)}</td>
                                    </tr>
                                    <tr>
                                        <td>Progression:</td>
                                        <td>
                                            <div class="progress" style="height: 20px;">
                                                <div class="progress-bar ${loanInfo.progress > 75 ? 'bg-success' : loanInfo.progress > 50 ? 'bg-info' : 'bg-warning'}" 
                                                    style="width: ${loanInfo.progress}%">
                                                    ${loanInfo.progress.toFixed(0)}%
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                    ${loanInfo.nextPayment ? `
                                    <tr>
                                        <td>Prochaine échéance:</td>
                                        <td class="text-warning">
                                            ${Utils.formatMonth(loanInfo.nextPayment.month)}: ${Utils.formatMoney(loanInfo.nextPayment.amount)}
                                        </td>
                                    </tr>
                                    ` : ''}
                                </table>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Échéancier détaillé -->
                    <h5 class="mt-4">📋 Échéancier détaillé</h5>
                    <div class="table-responsive" style="max-height: 300px; overflow-y: auto;">
                        <table class="table table-sm table-bordered">
                            <thead class="thead-light sticky-top">
                                <tr>
                                    <th>Mois</th>
                                    <th>Montant</th>
                                    <th>Statut</th>
                                    <th>Salaire net</th>
                                    <th>Capacité</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${await this.renderPaymentScheduleRows(loanInfo, employee)}
                            </tbody>
                        </table>
                    </div>
                    
                    <!-- Historique des reports -->
                    ${loanInfo.reportHistory && loanInfo.reportHistory.length > 0 ? `
                        <h5 class="mt-4">⚠️ Historique des reports</h5>
                        <div class="table-responsive">
                            <table class="table table-sm">
                                <thead>
                                    <tr>
                                        <th>Mois</th>
                                        <th>Montant reporté</th>
                                        <th>Raison</th>
                                        <th>Reporté sur</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${loanInfo.reportHistory.map(h => `
                                        <tr>
                                            <td>${Utils.formatMonth(h.month)}</td>
                                            <td class="text-danger">${Utils.formatMoney(h.unpaidAmount)}</td>
                                            <td><small>${h.reason}</small></td>
                                            <td><small>${h.reportedTo.map(m => Utils.formatMonth(m)).join(', ')}</small></td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : ''}
                    
                    <!-- Conseils -->
                    <div class="alert alert-info mt-4">
                        <strong>ℹ️ Informations utiles</strong>
                        <ul class="mb-0">
                            <li>Les échéances sont déduites automatiquement du salaire net</li>
                            <li>Si le salaire est insuffisant, le montant est reporté sur les mois suivants</li>
                            <li>La capacité indique le salaire disponible après paiement de l'échéance</li>
                            ${loanInfo.remaining <= employee.salary ? 
                                '<li class="text-success">✓ L\'échéance mensuelle est inférieure au salaire</li>' :
                                '<li class="text-warning">⚠️ Attention: certaines échéances dépassent le salaire mensuel</li>'
                            }
                        </ul>
                    </div>
                </div>
                
                <div class="modal-footer">
                    <button class="btn btn-primary" onclick="UI.printSpecialAdvanceDetails('${employeeId}')">
                        🖨️ Imprimer
                    </button>
                    <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">
                        Fermer
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    },
    
    // NOUVEAU: Rendre les lignes de l'échéancier
    renderPaymentScheduleRows: async function(loanInfo, employee) {
        let html = '';
        const currentMonth = Utils.getCurrentMonth();
        
        for (const payment of loanInfo.monthlyPayments) {
            // Calculer le salaire net estimé pour ce mois
            let netSalary = '-';
            let capacity = '-';
            let rowClass = '';
            
            if (payment.month <= currentMonth && window.Salary) {
                const calc = await Salary.calculateAsync(employee, payment.month);
                netSalary = Utils.formatMoney(calc.netSalary);
                capacity = calc.netSalary - payment.amount;
                
                if (capacity < 0) {
                    rowClass = 'table-warning';
                }
            }
            
            let statusBadge = '';
            if (payment.isPaid) {
                statusBadge = '<span class="badge badge-success">✓ Payé</span>';
            } else if (payment.isCurrent) {
                statusBadge = '<span class="badge badge-warning">⏳ En cours</span>';
            } else if (payment.month < currentMonth) {
                statusBadge = '<span class="badge badge-danger">⚠️ Reporté</span>';
            } else {
                statusBadge = '<span class="badge badge-secondary">📅 À venir</span>';
            }
            
            html += `
                <tr class="${rowClass}">
                    <td>${Utils.formatMonth(payment.month)}</td>
                    <td class="font-weight-bold">${Utils.formatMoney(payment.amount)}</td>
                    <td>${statusBadge}</td>
                    <td>${netSalary}</td>
                    <td class="${capacity !== '-' && capacity < 0 ? 'text-danger' : ''}">
                        ${capacity !== '-' ? Utils.formatMoney(capacity) : '-'}
                    </td>
                </tr>
            `;
        }
        
        return html;
    },
    
    // NOUVEAU: Imprimer les détails d'une avance spéciale
    printSpecialAdvanceDetails: async function(employeeId) {
        const employee = Employees.getById(employeeId);
        if (!employee) return;
        
        const schedules = await Database.getSpecialAdvanceSchedules(employeeId);
        const activeSchedule = schedules.find(s => s.status === 'active');
        
        if (!activeSchedule) return;
        
        const loanInfo = await this.calculateLoanInfo(employee, activeSchedule);
        
        const printHTML = `
            <!DOCTYPE html>
            <html lang="fr">
            <head>
                <meta charset="UTF-8">
                <title>Avance spéciale - ${employee.name}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    h1, h2, h3 { color: #333; }
                    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #f0f0f0; font-weight: bold; }
                    .header { text-align: center; margin-bottom: 30px; }
                    .summary { background-color: #f8f9fa; padding: 15px; margin: 20px 0; }
                    .text-success { color: #28a745; }
                    .text-danger { color: #dc3545; }
                    .text-warning { color: #ffc107; }
                    .progress-text { font-weight: bold; }
                    @media print { 
                        body { margin: 0; }
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>MALAZA BE</h1>
                    <h2>Détails de l'avance spéciale</h2>
                    <p>Employé: <strong>${employee.name}</strong></p>
                    <p>Date d'impression: ${Utils.formatDate(new Date())}</p>
                </div>
                
                <div class="summary">
                    <h3>Résumé du prêt</h3>
                    <p><strong>Montant total:</strong> ${Utils.formatMoney(loanInfo.totalAmount)}</p>
                    <p><strong>Date du prêt:</strong> ${Utils.formatDate(loanInfo.startDate)}</p>
                    <p><strong>Montant payé:</strong> <span class="text-success">${Utils.formatMoney(loanInfo.paid)}</span></p>
                    <p><strong>Reste dû:</strong> <span class="text-danger">${Utils.formatMoney(loanInfo.remaining)}</span></p>
                    <p><strong>Progression:</strong> <span class="progress-text">${loanInfo.progress.toFixed(0)}%</span></p>
                </div>
                
                <h3>Échéancier de remboursement</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Mois</th>
                            <th>Montant</th>
                            <th>Statut</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${loanInfo.monthlyPayments.map(payment => {
                            let status = '';
                            if (payment.isPaid) {
                                status = '✓ Payé';
                            } else if (payment.isCurrent) {
                                status = '⏳ En cours';
                            } else {
                                status = '📅 À venir';
                            }
                            
                            return `
                                <tr>
                                    <td>${Utils.formatMonth(payment.month)}</td>
                                    <td>${Utils.formatMoney(payment.amount)}</td>
                                    <td>${status}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                    <tfoot>
                        <tr>
                            <th>TOTAL</th>
                            <th>${Utils.formatMoney(loanInfo.totalAmount)}</th>
                            <th></th>
                        </tr>
                    </tfoot>
                </table>
                
                <div style="margin-top: 50px; text-align: center; color: #666;">
                    <p>Document généré le ${Utils.formatDate(new Date())} à ${new Date().toLocaleTimeString('fr-FR')}</p>
                </div>
            </body>
            </html>
        `;
        
        const printWindow = window.open('', '_blank');
        printWindow.document.write(printHTML);
        printWindow.document.close();
        printWindow.focus();
        
        setTimeout(() => {
            printWindow.print();
        }, 250);
    },
    
    // Générer le rapport de salaires (existant)
    generateSalaryReport: async function(container) {
        const employee = document.getElementById('reportEmployee').value;
        const periodType = document.getElementById('reportPeriod').value;
        
        let months = [];
        let periodLabel = '';
        
        // Déterminer la période
        switch (periodType) {
            case 'month':
                const month = document.getElementById('reportMonth').value;
                months = [month];
                periodLabel = Utils.formatMonth(month);
                break;
                
            case 'year':
                const year = document.getElementById('reportYear').value;
                // Générer tous les mois de l'année
                for (let i = 1; i <= 12; i++) {
                    const m = `${year}-${String(i).padStart(2, '0')}`;
                    if (m <= Utils.getCurrentMonth()) {
                        months.push(m);
                    }
                }
                periodLabel = `Année ${year}`;
                break;
                
            case 'custom':
                const startDate = document.getElementById('reportStartDate').value;
                const endDate = document.getElementById('reportEndDate').value;
                if (startDate && endDate) {
                    // Générer tous les mois entre les dates
                    const start = new Date(startDate);
                    const end = new Date(endDate);
                    const current = new Date(start);
                    
                    while (current <= end) {
                        months.push(current.toISOString().slice(0, 7));
                        current.setMonth(current.getMonth() + 1);
                    }
                    
                    periodLabel = `Du ${Utils.formatDate(startDate)} au ${Utils.formatDate(endDate)}`;
                }
                break;
        }
        
        // Filtrer les employés
        let employees = employee === 'all' ? Employees.list : 
            Employees.list.filter(emp => (emp._id || emp.id) === employee);
        
        if (months.length === 0 || employees.length === 0) {
            container.innerHTML = '<div class="alert alert-warning">Aucune donnée à afficher</div>';
            return;
        }
        
        // Afficher/cacher le toggle de vue
        const viewToggle = document.getElementById('viewToggle');
        viewToggle.style.display = months.length > 1 ? 'block' : 'none';
        
        // Afficher selon le type
        if (months.length === 1) {
            // Un seul mois = tableau détaillé uniquement
            await this.renderMonthlyReportTable(container, employees, months[0], periodLabel);
        } else {
            // Plusieurs mois = vue détaillée ou synthèse selon le choix
            if (this.reportView === 'detailed') {
                await this.renderDetailedReportTable(container, employees, months, periodLabel);
            } else {
                await this.renderSummaryReportTable(container, employees, months, periodLabel);
            }
        }
    },
    
    // Définir la vue du rapport
    setReportView: function(view) {
        this.reportView = view;
        
        // Mettre à jour les boutons
        document.querySelectorAll('#viewToggle .btn').forEach(btn => {
            btn.classList.remove('active');
        });
        event.target.classList.add('active');
        
        // Regénérer le rapport avec la nouvelle vue
        this.generateReport();
    },
    
    // MODIFIÉ: Tableau pour un seul mois avec colonne avances spéciales
    renderMonthlyReportTable: async function(container, employees, month, periodLabel) {
        // Collecter toutes les données
        const tableData = [];
        let totals = {
            salary: 0,
            deductions: 0,
            bonus: 0,
            advances: 0,
            specialAdvances: 0,
            specialRemaining: 0, // NOUVEAU
            net: 0,
            paid: 0,
            remaining: 0
        };
        
        for (const emp of employees) {
            const details = await Salary.getEmployeeAdvanceDetails(emp._id || emp.id, month);
            const calc = details.calculation;
            const totalPaid = Payments.getTotalPaidForMonth(emp._id || emp.id, month);
            const remaining = Math.max(0, calc.netSalary - totalPaid);
            
            // NOUVEAU: Obtenir le reste dû des avances spéciales
            const specialAdvanceInfo = await this.getEmployeeSpecialAdvanceInfo(emp._id || emp.id);
            const specialRemaining = specialAdvanceInfo ? specialAdvanceInfo.remaining : 0;
            
            tableData.push({
                employee: emp,
                attendance: calc.attendanceSummary,
                salary: calc.baseSalary,
                deductions: calc.deductions,
                bonus: calc.bonus,
                advances: calc.advance,
                specialAdvance: calc.specialAdvance,
                specialRemaining: specialRemaining, // NOUVEAU
                net: calc.netSalary,
                paid: totalPaid,
                remaining: remaining,
                isPaid: remaining === 0
            });
            
            // Accumuler les totaux
            totals.salary += calc.baseSalary;
            totals.deductions += calc.deductions;
            totals.bonus += calc.bonus;
            totals.advances += calc.advance;
            totals.specialAdvances += calc.specialAdvance;
            totals.specialRemaining += specialRemaining; // NOUVEAU
            totals.net += calc.netSalary;
            totals.paid += totalPaid;
            totals.remaining += remaining;
        }
        
        // Générer le tableau HTML
        let html = `
            <div class="report-header">
                <h5>Rapport détaillé - ${periodLabel}</h5>
            </div>
            
            <div class="table-responsive">
                <table class="table table-bordered table-hover report-table">
                    <thead class="thead-light">
                        <tr>
                            <th rowspan="2">Employé</th>
                            <th rowspan="2">Position</th>
                            <th colspan="6" class="text-center">Présences</th>
                            <th rowspan="2">Salaire</th>
                            <th rowspan="2">Déductions</th>
                            <th rowspan="2">Primes</th>
                            <th rowspan="2">Avances</th>
                            <th colspan="2" class="text-center">Av. Spéciales</th>
                            <th rowspan="2" class="text-primary">NET</th>
                            <th rowspan="2">Payé</th>
                            <th rowspan="2">Reste</th>
                            <th rowspan="2">Statut</th>
                        </tr>
                        <tr>
                            <th>Jours</th>
                            <th>P</th>
                            <th>A</th>
                            <th>R</th>
                            <th>DM</th>
                            <th>CP</th>
                            <th>Mois</th>
                            <th>Reste total</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        // Lignes de données
        tableData.forEach(row => {
            const position = CONFIG.positions.find(p => p.value === row.employee.position)?.label || '';
            const attendance = row.attendance;
            const totalDays = attendance.total || 0;
            
            html += `
                <tr class="${row.isPaid ? 'table-success' : ''}">
                    <td><strong>${row.employee.name}</strong></td>
                    <td>${position}</td>
                    <td class="text-center">${totalDays}</td>
                    <td class="text-center">${attendance.P || 0}</td>
                    <td class="text-center ${attendance.A > 0 ? 'text-danger' : ''}">${attendance.A || 0}</td>
                    <td class="text-center ${attendance.R > 0 ? 'text-warning' : ''}">${attendance.R || 0}</td>
                    <td class="text-center">${attendance.DM || 0}</td>
                    <td class="text-center">${attendance.CP || 0}</td>
                    <td class="text-right">${Utils.formatMoney(row.salary)}</td>
                    <td class="text-right text-danger">${row.deductions > 0 ? '-' + Utils.formatMoney(row.deductions) : '-'}</td>
                    <td class="text-right text-success">${row.bonus > 0 ? '+' + Utils.formatMoney(row.bonus) : '-'}</td>
                    <td class="text-right text-warning">${row.advances > 0 ? '-' + Utils.formatMoney(row.advances) : '-'}</td>
                    <td class="text-right text-warning">${row.specialAdvance > 0 ? '-' + Utils.formatMoney(row.specialAdvance) : '-'}</td>
                    <td class="text-right ${row.specialRemaining > 0 ? 'text-danger font-weight-bold' : ''}">
                        ${row.specialRemaining > 0 ? 
                            `${Utils.formatMoney(row.specialRemaining)} 
                            <button class="btn btn-xs btn-link" onclick="UI.showSpecialAdvanceDetails('${row.employee._id || row.employee.id}')">
                                📅
                            </button>` : 
                            '-'
                        }
                    </td>
                    <td class="text-right text-primary font-weight-bold">${Utils.formatMoney(row.net)}</td>
                    <td class="text-right">${Utils.formatMoney(row.paid)}</td>
                    <td class="text-right ${row.remaining > 0 ? 'text-danger font-weight-bold' : ''}">${Utils.formatMoney(row.remaining)}</td>
                    <td class="text-center">
                        ${row.isPaid ? 
                            '<span class="badge badge-success">✓ Payé</span>' : 
                            '<span class="badge badge-warning">En attente</span>'
                        }
                    </td>
                </tr>
            `;
        });
        
        // Ligne de totaux
        html += `
                    </tbody>
                    <tfoot class="table-secondary font-weight-bold">
                        <tr>
                            <td colspan="8" class="text-right">TOTAUX</td>
                            <td class="text-right">${Utils.formatMoney(totals.salary)}</td>
                            <td class="text-right text-danger">${totals.deductions > 0 ? '-' + Utils.formatMoney(totals.deductions) : '-'}</td>
                            <td class="text-right text-success">${totals.bonus > 0 ? '+' + Utils.formatMoney(totals.bonus) : '-'}</td>
                            <td class="text-right text-warning">${totals.advances > 0 ? '-' + Utils.formatMoney(totals.advances) : '-'}</td>
                            <td class="text-right text-warning">${totals.specialAdvances > 0 ? '-' + Utils.formatMoney(totals.specialAdvances) : '-'}</td>
                            <td class="text-right text-danger">${totals.specialRemaining > 0 ? Utils.formatMoney(totals.specialRemaining) : '-'}</td>
                            <td class="text-right text-primary">${Utils.formatMoney(totals.net)}</td>
                            <td class="text-right">${Utils.formatMoney(totals.paid)}</td>
                            <td class="text-right ${totals.remaining > 0 ? 'text-danger' : 'text-success'}">${Utils.formatMoney(totals.remaining)}</td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            
            <div class="report-summary mt-3">
                <div class="row">
                    <div class="col-md-4">
                        <div class="alert alert-info">
                            <strong>Résumé salaires:</strong><br>
                            Masse salariale: ${Utils.formatMoney(totals.salary)}<br>
                            Total net à payer: ${Utils.formatMoney(totals.net)}<br>
                            Total déjà payé: ${Utils.formatMoney(totals.paid)}
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="alert ${totals.remaining > 0 ? 'alert-warning' : 'alert-success'}">
                            <strong>Statut paiements:</strong><br>
                            ${totals.remaining > 0 ? 
                                `Reste à payer: ${Utils.formatMoney(totals.remaining)}<br>
                                 ${tableData.filter(r => !r.isPaid).length} employé(s) non payé(s)` :
                                'Tous les salaires sont payés ✓'
                            }
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="alert alert-secondary">
                            <strong>Avances spéciales:</strong><br>
                            Échéances du mois: ${Utils.formatMoney(totals.specialAdvances)}<br>
                            Total restant dû: ${Utils.formatMoney(totals.specialRemaining)}<br>
                            ${tableData.filter(r => r.specialRemaining > 0).length} prêt(s) actif(s)
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
    },
    
    // Tableau détaillé pour plusieurs mois (existant - pas de modification nécessaire)
    renderDetailedReportTable: async function(container, employees, months, periodLabel) {
        // Code existant...
        // Pas de modification nécessaire pour cette vue
        // Le code original reste identique
        
        // Collecter toutes les données
        const allData = [];
        
        for (const emp of employees) {
            for (const month of months) {
                const calc = await Salary.calculateAsync(emp, month);
                const paid = Payments.getTotalPaidForMonth(emp._id || emp.id, month);
                const remaining = Math.max(0, calc.netSalary - paid);
                
                allData.push({
                    employee: emp,
                    month: month,
                    salary: calc.baseSalary,
                    deductions: calc.deductions,
                    bonus: calc.bonus,
                    advances: calc.advance,
                    specialAdvance: calc.specialAdvance,
                    net: calc.netSalary,
                    paid: paid,
                    remaining: remaining
                });
            }
        }
        
        // Générer le tableau
        let html = `
            <div class="report-header">
                <h5>Rapport détaillé - ${periodLabel}</h5>
                <p class="text-muted">Vue détaillée mois par mois</p>
            </div>
            
            <div class="table-responsive">
                <table class="table table-bordered table-sm report-table">
                    <thead class="thead-light">
                        <tr>
                            <th>Employé</th>
                            <th>Mois</th>
                            <th>Salaire</th>
                            <th>Déductions</th>
                            <th>Primes</th>
                            <th>Avances</th>
                            <th>Av. Spéc.</th>
                            <th class="text-primary">NET</th>
                            <th>Payé</th>
                            <th>Reste</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        let currentEmployee = null;
        let employeeTotals = null;
        
        allData.forEach((row, index) => {
            // Si on change d'employé, afficher le sous-total
            if (currentEmployee && currentEmployee !== row.employee._id) {
                html += this.renderEmployeeSubtotal(employeeTotals);
                employeeTotals = null;
            }
            
            // Initialiser les totaux pour le nouvel employé
            if (!employeeTotals || currentEmployee !== row.employee._id) {
                currentEmployee = row.employee._id || row.employee.id;
                employeeTotals = {
                    name: row.employee.name,
                    salary: 0,
                    deductions: 0,
                    bonus: 0,
                    advances: 0,
                    specialAdvance: 0,
                    net: 0,
                    paid: 0,
                    remaining: 0
                };
            }
            
            // Accumuler les totaux
            employeeTotals.salary += row.salary;
            employeeTotals.deductions += row.deductions;
            employeeTotals.bonus += row.bonus;
            employeeTotals.advances += row.advances;
            employeeTotals.specialAdvance += row.specialAdvance;
            employeeTotals.net += row.net;
            employeeTotals.paid += row.paid;
            employeeTotals.remaining += row.remaining;
            
            // Ligne de données
            html += `
                <tr>
                    <td>${row.employee.name}</td>
                    <td>${Utils.formatMonth(row.month)}</td>
                    <td class="text-right">${Utils.formatMoney(row.salary)}</td>
                    <td class="text-right text-danger">${row.deductions > 0 ? '-' + Utils.formatMoney(row.deductions) : '-'}</td>
                    <td class="text-right text-success">${row.bonus > 0 ? '+' + Utils.formatMoney(row.bonus) : '-'}</td>
                    <td class="text-right text-warning">${row.advances > 0 ? '-' + Utils.formatMoney(row.advances) : '-'}</td>
                    <td class="text-right text-warning">${row.specialAdvance > 0 ? '-' + Utils.formatMoney(row.specialAdvance) : '-'}</td>
                    <td class="text-right text-primary font-weight-bold">${Utils.formatMoney(row.net)}</td>
                    <td class="text-right">${Utils.formatMoney(row.paid)}</td>
                    <td class="text-right ${row.remaining > 0 ? 'text-danger' : ''}">${Utils.formatMoney(row.remaining)}</td>
                </tr>
            `;
        });
        
        // Dernier sous-total
        if (employeeTotals) {
            html += this.renderEmployeeSubtotal(employeeTotals);
        }
        
        html += `
                    </tbody>
                </table>
            </div>
        `;
        
        container.innerHTML = html;
    },
    
    // Ligne de sous-total pour un employé (existant)
    renderEmployeeSubtotal: function(totals) {
        return `
            <tr class="table-info font-weight-bold">
                <td colspan="2" class="text-right">TOTAL ${totals.name}</td>
                <td class="text-right">${Utils.formatMoney(totals.salary)}</td>
                <td class="text-right text-danger">${totals.deductions > 0 ? '-' + Utils.formatMoney(totals.deductions) : '-'}</td>
                <td class="text-right text-success">${totals.bonus > 0 ? '+' + Utils.formatMoney(totals.bonus) : '-'}</td>
                <td class="text-right text-warning">${totals.advances > 0 ? '-' + Utils.formatMoney(totals.advances) : '-'}</td>
                <td class="text-right text-warning">${totals.specialAdvance > 0 ? '-' + Utils.formatMoney(totals.specialAdvance) : '-'}</td>
                <td class="text-right text-primary">${Utils.formatMoney(totals.net)}</td>
                <td class="text-right">${Utils.formatMoney(totals.paid)}</td>
                <td class="text-right ${totals.remaining > 0 ? 'text-danger' : 'text-success'}">${Utils.formatMoney(totals.remaining)}</td>
            </tr>
            <tr><td colspan="10" style="height: 10px; background: #f8f9fa;"></td></tr>
        `;
    },
    
    // Tableau de synthèse (existant - pas de modification nécessaire)
    renderSummaryReportTable: async function(container, employees, months, periodLabel) {
        // Code existant reste identique...
        // Pas besoin de modifier cette vue
        
        // Calculer les totaux pour chaque employé
        const summaryData = [];
        let grandTotals = {
            salary: 0,
            deductions: 0,
            bonus: 0,
            advances: 0,
            specialAdvance: 0,
            net: 0,
            paid: 0,
            remaining: 0
        };
        
        for (const emp of employees) {
            let empTotals = {
                employee: emp,
                salary: 0,
                deductions: 0,
                bonus: 0,
                advances: 0,
                specialAdvance: 0,
                net: 0,
                paid: 0,
                remaining: 0,
                monthsCount: 0
            };
            
            for (const month of months) {
                const calc = await Salary.calculateAsync(emp, month);
                const paid = Payments.getTotalPaidForMonth(emp._id || emp.id, month);
                const remaining = Math.max(0, calc.netSalary - paid);
                
                empTotals.salary += calc.baseSalary;
                empTotals.deductions += calc.deductions;
                empTotals.bonus += calc.bonus;
                empTotals.advances += calc.advance;
                empTotals.specialAdvance += calc.specialAdvance;
                empTotals.net += calc.netSalary;
                empTotals.paid += paid;
                empTotals.remaining += remaining;
                empTotals.monthsCount++;
            }
            
            summaryData.push(empTotals);
            
            // Accumuler pour les totaux généraux
            grandTotals.salary += empTotals.salary;
            grandTotals.deductions += empTotals.deductions;
            grandTotals.bonus += empTotals.bonus;
            grandTotals.advances += empTotals.advances;
            grandTotals.specialAdvance += empTotals.specialAdvance;
            grandTotals.net += empTotals.net;
            grandTotals.paid += empTotals.paid;
            grandTotals.remaining += empTotals.remaining;
        }
        
        // Générer le tableau
        let html = `
            <div class="report-header">
                <h5>Rapport de synthèse - ${periodLabel}</h5>
                <p class="text-muted">Vue globale sur ${months.length} mois</p>
            </div>
            
            <div class="table-responsive">
                <table class="table table-bordered table-hover report-table">
                    <thead class="thead-light">
                        <tr>
                            <th>Employé</th>
                            <th>Position</th>
                            <th>Mois</th>
                            <th>Total Salaires</th>
                            <th>Total Déductions</th>
                            <th>Total Primes</th>
                            <th>Total Avances</th>
                            <th>Total Av. Spéc.</th>
                            <th class="text-primary">Total NET</th>
                            <th>Total Payé</th>
                            <th>RESTE DÛ</th>
                            <th>Statut</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        // Lignes de données
        summaryData.forEach(row => {
            const position = CONFIG.positions.find(p => p.value === row.employee.position)?.label || '';
            const isPaid = row.remaining === 0;
            
            html += `
                <tr class="${isPaid ? 'table-success' : ''}">
                    <td><strong>${row.employee.name}</strong></td>
                    <td>${position}</td>
                    <td class="text-center">${row.monthsCount}</td>
                    <td class="text-right">${Utils.formatMoney(row.salary)}</td>
                    <td class="text-right text-danger">${row.deductions > 0 ? '-' + Utils.formatMoney(row.deductions) : '-'}</td>
                    <td class="text-right text-success">${row.bonus > 0 ? '+' + Utils.formatMoney(row.bonus) : '-'}</td>
                    <td class="text-right text-warning">${row.advances > 0 ? '-' + Utils.formatMoney(row.advances) : '-'}</td>
                    <td class="text-right text-warning">${row.specialAdvance > 0 ? '-' + Utils.formatMoney(row.specialAdvance) : '-'}</td>
                    <td class="text-right text-primary font-weight-bold">${Utils.formatMoney(row.net)}</td>
                    <td class="text-right">${Utils.formatMoney(row.paid)}</td>
                    <td class="text-right ${row.remaining > 0 ? 'text-danger font-weight-bold' : 'text-success'}">${Utils.formatMoney(row.remaining)}</td>
                    <td class="text-center">
                        ${isPaid ? 
                            '<span class="badge badge-success">✓ Complet</span>' : 
                            '<span class="badge badge-warning">Incomplet</span>'
                        }
                    </td>
                </tr>
            `;
        });
        
        // Ligne de totaux généraux
        html += `
                    </tbody>
                    <tfoot class="table-dark font-weight-bold">
                        <tr>
                            <td colspan="3" class="text-right">TOTAUX GÉNÉRAUX</td>
                            <td class="text-right">${Utils.formatMoney(grandTotals.salary)}</td>
                            <td class="text-right">${grandTotals.deductions > 0 ? '-' + Utils.formatMoney(grandTotals.deductions) : '-'}</td>
                            <td class="text-right">${grandTotals.bonus > 0 ? '+' + Utils.formatMoney(grandTotals.bonus) : '-'}</td>
                            <td class="text-right">${grandTotals.advances > 0 ? '-' + Utils.formatMoney(grandTotals.advances) : '-'}</td>
                            <td class="text-right">${grandTotals.specialAdvance > 0 ? '-' + Utils.formatMoney(grandTotals.specialAdvance) : '-'}</td>
                            <td class="text-right text-primary">${Utils.formatMoney(grandTotals.net)}</td>
                            <td class="text-right">${Utils.formatMoney(grandTotals.paid)}</td>
                            <td class="text-right ${grandTotals.remaining > 0 ? 'text-danger' : 'text-success'}">${Utils.formatMoney(grandTotals.remaining)}</td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            
            <div class="report-summary mt-4">
                <div class="row">
                    <div class="col-md-4">
                        <div class="card">
                            <div class="card-body">
                                <h6 class="card-title">💰 Masse salariale</h6>
                                <h3 class="text-primary">${Utils.formatMoney(grandTotals.salary)}</h3>
                                <small class="text-muted">Sur ${months.length} mois</small>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="card">
                            <div class="card-body">
                                <h6 class="card-title">💵 Total NET</h6>
                                <h3 class="text-info">${Utils.formatMoney(grandTotals.net)}</h3>
                                <small class="text-muted">Après déductions et primes</small>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="card">
                            <div class="card-body">
                                <h6 class="card-title">⚠️ Reste à payer</h6>
                                <h3 class="${grandTotals.remaining > 0 ? 'text-danger' : 'text-success'}">${Utils.formatMoney(grandTotals.remaining)}</h3>
                                <small class="text-muted">${summaryData.filter(r => r.remaining > 0).length} employé(s) concerné(s)</small>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
    },
    
    // Autres méthodes existantes restent identiques...
    
    // NOUVEAU: Obtenir le mois suivant
    getNextMonth: function(month) {
        const [year, monthNum] = month.split('-').map(Number);
        const date = new Date(year, monthNum - 1, 1);
        date.setMonth(date.getMonth() + 1);
        return date.toISOString().slice(0, 7);
    },
    
    // NOUVEAU: Initialiser les styles pour les avances spéciales
    initSpecialAdvanceStyles: function() {
        const style = document.createElement('style');
        style.id = 'special-advance-styles';
        style.innerHTML = `
            .special-advance-info {
                margin-top: 10px;
                padding-top: 10px;
                border-top: 1px solid #e0e0e0;
            }
            
            .loan-summary {
                background: #f8f9fa;
                padding: 20px;
                border-radius: 8px;
                margin-bottom: 20px;
            }
            
            .loan-summary table {
                margin-bottom: 0;
            }
            
            .summary-cards {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 15px;
                margin-bottom: 30px;
            }
            
            .summary-cards .card {
                border: none;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                transition: transform 0.2s;
            }
            
            .summary-cards .card:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(0,0,0,0.15);
            }
            
            .special-advances-report h3 {
                margin: 0;
                color: #333;
            }
            
            .special-advances-report h6 {
                color: #6c757d;
                font-size: 14px;
                margin-bottom: 5px;
            }
            
            .btn-xs {
                padding: 0.1rem 0.3rem;
                font-size: 0.75rem;
            }
            
            .progress {
                background-color: #e9ecef;
                border-radius: 4px;
            }
            
            .progress-bar {
                transition: width 0.6s ease;
                font-weight: bold;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            @media print {
                .special-advances-report .btn {
                    display: none !important;
                }
            }
        `;
        
        if (!document.getElementById('special-advance-styles')) {
            document.head.appendChild(style);
        }
    },
    
    // Méthodes d'export, paramètres, etc. restent identiques...
    
    // Exporter le rapport filtré
    exportFilteredReport: async function() {
        const format = await this.showExportOptions();
        if (!format) return;
        
        // Récupérer les données du rapport actuel
        const reportData = await this.getReportData();
        
        switch (format) {
            case 'pdf':
                await this.exportToPDF(reportData);
                break;
            case 'excel':
                await this.exportToExcel(reportData);
                break;
            case 'csv':
                await this.exportToCSV(reportData);
                break;
        }
    },
    
    // Afficher les options d'export
    showExportOptions: function() {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content modal-sm">
                    <div class="modal-header">
                        <h3>📥 Format d'export</h3>
                        <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
                    </div>
                    
                    <div class="export-options">
                        <button class="export-option" onclick="UI.selectExportFormat('pdf')">
                            📄 PDF
                            <small>Pour impression et archivage</small>
                        </button>
                        <button class="export-option" onclick="UI.selectExportFormat('excel')">
                            📊 Excel
                            <small>Pour analyses avancées</small>
                        </button>
                        <button class="export-option" onclick="UI.selectExportFormat('csv')">
                            📋 CSV
                            <small>Pour import dans d'autres outils</small>
                        </button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            window.UI.selectExportFormat = (format) => {
                modal.remove();
                resolve(format);
            };
        });
    },
    
    // Obtenir les données du rapport
    getReportData: async function() {
        // Récupérer les paramètres actuels
        const employee = document.getElementById('reportEmployee').value;
        const periodType = document.getElementById('reportPeriod').value;
        
        // ... logique pour récupérer les données selon les filtres
        
        return {
            // Structure des données pour l'export
        };
    },
    
    // Export PDF (nécessitera utils.js)
    exportToPDF: async function(data) {
        if (window.Utils && Utils.exportToPDF) {
            await Utils.exportToPDF(data);
        } else {
            notify.error('Export PDF non disponible');
        }
    },
    
    // Export Excel (nécessitera utils.js)
    exportToExcel: async function(data) {
        if (window.Utils && Utils.exportToExcel) {
            await Utils.exportToExcel(data);
        } else {
            notify.error('Export Excel non disponible');
        }
    },
    
    // Export CSV
    exportToCSV: async function(data) {
        // Implémentation simple pour CSV
        notify.info('Export CSV en cours...');
        // ... code d'export
    },
    
    // Imprimer le rapport filtré
    printFilteredReport: function() {
        window.print();
    },
    
    // Obtenir les alertes (modifié pour inclure les avances spéciales)
    getAlerts: async function() {
        const alerts = [];
        const currentMonth = Utils.getCurrentMonth();
        
        // Employés non payés
        const paymentStats = await this.getPaymentStats();
        if (paymentStats.unpaidEmployees > 0) {
            alerts.push(`<div class="alert alert-warning">
                ${paymentStats.unpaidEmployees} employé(s) non payé(s) - Total: ${Utils.formatMoney(paymentStats.totalRemaining)}
            </div>`);
        }
        
        // NOUVEAU: Avances spéciales à payer ce mois
        const specialAdvanceStats = await this.getSpecialAdvancesStats();
        if (specialAdvanceStats.dueThisMonth > 0) {
            alerts.push(`<div class="alert alert-info">
                📅 Avances spéciales ce mois: ${Utils.formatMoney(specialAdvanceStats.dueThisMonth)} 
                (${specialAdvanceStats.activeCount} employé(s))
            </div>`);
        }
        
        // Employés avec avances élevées
        let highAdvanceCount = 0;
        for (const emp of Employees.list) {
            const advances = Payments.getMonthlyAdvances(emp._id || emp.id, currentMonth);
            const specialAdvance = await Payments.getSpecialAdvanceMonthly(emp._id || emp.id, currentMonth);
            const totalAdvances = advances + specialAdvance;
            
            if (totalAdvances > emp.salary * 0.5) {
                highAdvanceCount++;
            }
        }
        
        if (highAdvanceCount > 0) {
            alerts.push(`<div class="alert alert-info">
                ${highAdvanceCount} employé(s) avec avances > 50% du salaire
            </div>`);
        }
        
        // Congés qui se terminent bientôt
        const today = new Date();
        const in3Days = new Date();
        in3Days.setDate(today.getDate() + 3);
        
        const endingSoon = Leaves.list.filter(leave => {
            if (leave.endDate) {
                const endDate = new Date(leave.endDate);
                return endDate >= today && endDate <= in3Days;
            }
            return false;
        });
        
        if (endingSoon.length > 0) {
            alerts.push(`<div class="alert alert-info">
                ${endingSoon.length} congé(s) se terminent dans les 3 prochains jours
            </div>`);
        }
        
        // Absences consécutives
        const rankings = Attendance.getEmployeeRanking ? Attendance.getEmployeeRanking('month') : [];
        const withAlerts = rankings.filter(r => r.hasAlert);
        
        if (withAlerts.length > 0) {
            alerts.push(`<div class="alert alert-danger">
                ${withAlerts.length} employé(s) avec 3+ absences consécutives
            </div>`);
        }
        
        // Fin de mois
        const currentDay = new Date().getDate();
        const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
        if (currentDay >= daysInMonth - 3) {
            alerts.push(`<div class="alert alert-info">
                Fin de mois proche ! Pensez à finaliser les paiements
            </div>`);
        }
        
        return alerts.length > 0 ? alerts.join('') : 
            '<div class="alert alert-success">Tout est en ordre !</div>';
    },
    
    // Modal des paramètres
    showSettingsModal: function() {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>⚙️ Paramètres</h3>
                    <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
                </div>
                
                <div class="settings-sections">
                    <div class="setting-group">
                        <h5>🔐 Sécurité</h5>
                        <button class="btn btn-secondary" onclick="Auth.showChangePINModal()">
                            Changer le code PIN
                        </button>
                    </div>
                    
                    <div class="setting-group">
                        <h5>💾 Données</h5>
                        <button class="btn btn-primary" onclick="UI.exportData()">
                            Exporter (Backup)
                        </button>
                        <button class="btn btn-warning" onclick="UI.importData()">
                            Importer
                        </button>
                        <button class="btn btn-danger" onclick="UI.resetDatabase()">
                            🚨 Réinitialiser
                        </button>
                    </div>
                    
                    <div class="setting-group">
                        <h5>📊 Base de données</h5>
                        <div id="dbStats">Chargement...</div>
                    </div>
                    
                    <div class="setting-group">
                        <h5>ℹ️ À propos</h5>
                        <p>Version: ${CONFIG.version}</p>
                        <p>Structure: v5.0 (Avances spéciales intégrées)</p>
                        <p>Raccourcis clavier:</p>
                        <ul style="font-size: 0.9em;">
                            <li>Ctrl+E : Nouvel employé</li>
                            <li>Ctrl+P : Nouveau paiement</li>
                            <li>Ctrl+L : Nouveau congé</li>
                            <li>Ctrl+D : Dashboard</li>
                            <li>Ctrl+R : Rafraîchir</li>
                            <li>Echap : Fermer modal</li>
                        </ul>
                    </div>
                </div>
                
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">
                        Fermer
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Charger les stats
        this.loadDatabaseStats();
    },
    
    // Charger les statistiques de la base
    loadDatabaseStats: async function() {
        const statsDiv = document.getElementById('dbStats');
        
        try {
            if (window.Database && Database.getStats) {
                const stats = await Database.getStats();
                
                if (stats) {
                    statsDiv.innerHTML = `
                        <ul>
                            <li>Documents: ${stats.totalDocs}</li>
                            <li>Taille: ${stats.diskSize || 'N/A'}</li>
                            <li>Types: 
                                <ul>
                                    ${Object.entries(stats.types || {}).map(([type, count]) => 
                                        `<li>${type}: ${count}</li>`
                                    ).join('')}
                                </ul>
                            </li>
                        </ul>
                    `;
                } else {
                    statsDiv.innerHTML = 'Statistiques non disponibles';
                }
            } else {
                statsDiv.innerHTML = 'Module Database non chargé';
            }
        } catch (error) {
            console.error('Erreur chargement stats:', error);
            statsDiv.innerHTML = 'Erreur lors du chargement des statistiques';
        }
    },
    
    // Réinitialiser la base
    resetDatabase: async function() {
        const confirmed = await Utils.confirm(
            '🚨 ATTENTION !\n\n' +
            'Cette action va SUPPRIMER TOUTES LES DONNÉES.\n' +
            'Avez-vous fait une sauvegarde ?\n\n' +
            'Taper OK pour confirmer la suppression TOTALE.'
        );
        
        if (confirmed) {
            if (window.Database && Database.clearAll) {
                const result = await Database.clearAll();
                if (result) {
                    notify.success('Base de données réinitialisée');
                    // Recharger l'application
                    setTimeout(() => {
                        window.location.reload();
                    }, 1000);
                }
            } else {
                notify.error('Fonction non disponible');
            }
        }
    },
    
    // Exporter les données
    exportData: async function() {
        try {
            if (window.Database && Database.exportData) {
                const backup = await Database.exportData();
                
                // Créer un fichier JSON
                const dataStr = JSON.stringify(backup, null, 2);
                const dataBlob = new Blob([dataStr], {type: 'application/json'});
                
                // Créer un lien de téléchargement
                const link = document.createElement('a');
                link.href = URL.createObjectURL(dataBlob);
                link.download = `malaza-backup-${new Date().toISOString().split('T')[0]}.json`;
                link.click();
                
                notify.success('Données exportées avec succès');
            } else {
                notify.error('Export non disponible');
            }
        } catch (error) {
            console.error('Erreur export:', error);
            notify.error('Erreur lors de l\'export');
        }
    },
    
    // Importer des données
    importData: function() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            try {
                const text = await file.text();
                const backup = JSON.parse(text);
                
                if (window.Database && Database.importData) {
                    if (await Database.importData(backup)) {
                        // Recharger l'application
                        notify.success('Import réussi ! Rechargement...');
                        setTimeout(() => {
                            window.location.reload();
                        }, 1500);
                    }
                } else {
                    notify.error('Import non disponible');
                }
            } catch (error) {
                console.error('Erreur import:', error);
                notify.error('Erreur lors de l\'import');
            }
        };
        
        input.click();
    },
    
    // Imprimer le rapport du mois
    printMonthReport: function() {
        window.print();
    },
    
    // Pour la compatibilité
    reloadDataForCurrentSection: async function() {
        // Alias pour reloadAndRender
        await this.reloadAndRender();
    },
    
    // Initialiser les styles d'impression
    initPrintStyles: function() {
        this.preparePrintStyles();
    },
    
    // Préparer les styles d'impression
    preparePrintStyles: function() {
        // Ajouter des styles spécifiques pour l'impression
        const style = document.createElement('style');
        style.id = 'print-styles';
        style.innerHTML = `
            @media print {
                .sidebar, .main-header, .filters-section, .header-actions, button {
                    display: none !important;
                }
                
                .main-content {
                    margin: 0 !important;
                    padding: 20px !important;
                }
                
                .report-header {
                    text-align: center;
                    margin-bottom: 30px;
                }
                
                .employee-report-card, .employee-summary-card {
                    page-break-inside: avoid;
                    border: 1px solid #ddd;
                    padding: 15px;
                    margin-bottom: 20px;
                }
                
                table {
                    font-size: 12px;
                }
                
                .monthly-breakdown[open] {
                    page-break-inside: avoid;
                }
            }
        `;
        
        if (!document.getElementById('print-styles')) {
            document.head.appendChild(style);
        }
    },
    
    // Ajouter les styles CSS pour les tableaux
    initReportTableStyles: function() {
        const style = document.createElement('style');
        style.id = 'report-table-styles';
        style.innerHTML = `
            .report-table {
                font-size: 14px;
            }
            
            .report-table th {
                background-color: #f8f9fa;
                position: sticky;
                top: 0;
                z-index: 10;
            }
            
            .report-table tbody tr:hover {
                background-color: #f1f3f5;
            }
            
            .view-toggle {
                margin: 20px 0;
                text-align: center;
            }
            
            .view-toggle .btn-group {
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            
            .report-summary .card {
                border: none;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                text-align: center;
            }
            
            .report-summary .card-title {
                font-size: 14px;
                color: #6c757d;
                margin-bottom: 10px;
            }
            
            .report-type-selector {
                margin: 20px 0;
                text-align: center;
            }
            
            .report-type-selector .btn-group {
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            
            @media print {
                .view-toggle, .report-type-selector {
                    display: none !important;
                }
                
                .report-table {
                    font-size: 12px;
                }
                
                .table-responsive {
                    overflow: visible !important;
                }
            }
        `;
        
        if (!document.getElementById('report-table-styles')) {
            document.head.appendChild(style);
        }
    }
};

// Rendre disponible globalement
window.UI = UI;