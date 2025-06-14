// Configuration globale de l'application - VERSION 2.0
const CONFIG = {
    // Nom de l'application
    appName: 'MALAZA BE SALAIRES',
    
    // Version
    version: '3.0.0', // Mise à jour de version
    
    // Nom de la base de données
    dbName: 'malaza-salaires-db',
    
    // Configuration du thème
    theme: {
        defaultMode: 'light', // 'light' ou 'dark'
        autoSwitch: false,    // Changement auto selon l'heure
        darkModeStartHour: 18, // 18h
        darkModeEndHour: 6     // 6h
    },
    
    // Configuration des calculs de salaire
    salary: {
        // NOUVEAU: Utiliser les jours réels du mois au lieu de 30 fixe
        useRealMonthDays: true, // true = 28/29/30/31 jours, false = 30 jours fixes
        
        workDaysPerMonth: 30, // Utilisé seulement si useRealMonthDays = false
        
        // Taux de déduction par type d'absence
        deductionRates: {
            absence: 1.0,      // 100% du jour
            late: 0.25,        // 25% du jour
            halfDay: 0.5       // 50% du jour
        },
        
        // Configuration des congés
        leaveAccrualRate: 2.5,  // 2.5 jours par mois
        
        // NOUVEAU: Règle des 15 jours pour l'acquisition des congés
        leaveMinDaysForAccrual: 15, // Minimum de jours de présence pour acquérir des congés
        enableMinDaysRule: true     // Activer/désactiver la règle des 15 jours
    },
    
    // Configuration du pointage
    attendance: {
        // NOUVEAU: Vue par défaut
        defaultView: 'calendar', // 'calendar' ou 'grid'
        
        // NOUVEAU: Employé sélectionné par défaut
        defaultEmployee: 'all', // 'all' ou null pour le premier employé
        
        // NOUVEAU: Marquer automatiquement présent pour les nouveaux jours
        autoMarkPresent: true,
        
        // NOUVEAU: Permettre la modification des jours futurs
        allowFutureEditing: false,
        
        // NOUVEAU: Nombre de jours d'absence consécutifs pour alerte
        consecutiveAbsencesAlert: 3
    },
    
    // Configuration des paiements
    payments: {
        // NOUVEAU: Types de paiement utilisant le formulaire multiple
        multiplePaymentTypes: ['salary', 'advance', 'bonus'],
        
        // NOUVEAU: Types de paiement utilisant le formulaire individuel
        singlePaymentTypes: ['special_advance', 'leave_monetized', 'other'],
        
        // NOUVEAU: Afficher le maximum autorisé pour les avances
        showMaxAdvance: true,
        
        // NOUVEAU: Permettre le dépassement du maximum (avec confirmation)
        allowExceedMaxAdvance: false
    },
    
    // Configuration des rapports
    reports: {
        // NOUVEAU: Période par défaut pour les rapports
        defaultPeriod: 'month', // 'month', 'quarter', 'year'
        
        // NOUVEAU: Inclure les graphiques dans les exports PDF
        includeChartsInPDF: true,
        
        // NOUVEAU: Format de date pour les exports
        exportDateFormat: 'DD/MM/YYYY' // ou 'YYYY-MM-DD'
    },
    
    // Positions disponibles
    positions: [
        { value: 'chauffeur', label: 'Chauffeur' },
        { value: 'gardien', label: 'Gardien' },
        { value: 'vendeur', label: 'Vendeur' }
    ],
    
    // Modes de paiement
    paymentMethods: [
        { value: 'cash', label: 'Espèces' },
        { value: 'mvola', label: 'MVola' },
        { value: 'orange', label: 'Orange Money' }
    ],
    
    // Statuts de présence
    attendanceStatus: {
        P: { label: 'Présent', color: '#28a745' },
        A: { label: 'Absent', color: '#dc3545' },
        R: { label: 'Retard', color: '#ffc107' },
        DM: { label: 'Demi-journée', color: '#17a2b8' },
        CP: { label: 'Congé payé', color: '#6f42c1' }
    },
    
    // NOUVEAU: Configuration de l'interface
    ui: {
        // Nombre d'éléments par page dans les tableaux
        itemsPerPage: 25,
        
        // Afficher les totaux en bas des tableaux
        showTableFooters: true,
        
        // Animation des modals
        enableModalAnimations: true,
        
        // Format d'affichage des montants
        currencyFormat: {
            symbol: 'Ar',
            position: 'after', // 'before' ou 'after'
            separator: ' ',
            decimal: ',',
            thousand: ' '
        }
    },
    
    // NOUVEAU: Configuration des notifications
    notifications: {
        // Durée d'affichage des notifications (ms)
        duration: 3000,
        
        // Position des notifications
        position: 'top-right', // 'top-right', 'top-left', 'bottom-right', 'bottom-left'
        
        // Sons pour les notifications
        enableSounds: false
    },
    
    // NOUVEAU: Configuration de sauvegarde
    backup: {
        // Sauvegarde automatique
        autoBackup: false,
        autoBackupInterval: 24, // heures
        
        // Nombre maximum de sauvegardes à conserver
        maxBackups: 10
    },
    
    // NOUVEAU: Fonctions utilitaires pour les calculs
    utils: {
        // Obtenir le nombre de jours dans un mois
        getDaysInMonth: function(year, month) {
            return new Date(year, month, 0).getDate();
        },
        
        // Calculer le salaire journalier
        getDailySalary: function(monthlySalary, year, month) {
            if (this.salary.useRealMonthDays) {
                const daysInMonth = this.getDaysInMonth(year, month);
                return monthlySalary / daysInMonth;
            } else {
                return monthlySalary / this.salary.workDaysPerMonth;
            }
        },
        
        // Vérifier si un employé peut acquérir des congés pour un mois
        canAccrueLeave: function(presentDays) {
            if (!this.salary.enableMinDaysRule) {
                return true;
            }
            return presentDays >= this.salary.leaveMinDaysForAccrual;
        }
    }
};

// Fonction pour mettre à jour la configuration
CONFIG.update = function(updates) {
    Object.keys(updates).forEach(key => {
        if (typeof updates[key] === 'object' && !Array.isArray(updates[key])) {
            // Fusion profonde pour les objets
            CONFIG[key] = { ...CONFIG[key], ...updates[key] };
        } else {
            // Remplacement direct pour les valeurs simples
            CONFIG[key] = updates[key];
        }
    });
    
    // Sauvegarder dans localStorage
    try {
        localStorage.setItem('malaza-config', JSON.stringify({
            salary: CONFIG.salary,
            attendance: CONFIG.attendance,
            payments: CONFIG.payments,
            reports: CONFIG.reports,
            ui: CONFIG.ui,
            notifications: CONFIG.notifications,
            theme: CONFIG.theme
        }));
        console.log('Configuration sauvegardée');
    } catch (e) {
        console.error('Erreur sauvegarde config:', e);
    }
};

// Charger la configuration sauvegardée
CONFIG.load = function() {
    try {
        const saved = localStorage.getItem('malaza-config');
        if (saved) {
            const parsed = JSON.parse(saved);
            Object.keys(parsed).forEach(key => {
                if (CONFIG[key]) {
                    CONFIG[key] = { ...CONFIG[key], ...parsed[key] };
                }
            });
            console.log('Configuration chargée');
        }
    } catch (e) {
        console.error('Erreur chargement config:', e);
    }
};

// Réinitialiser la configuration
CONFIG.reset = function() {
    try {
        localStorage.removeItem('malaza-config');
        location.reload(); // Recharger la page pour réinitialiser
    } catch (e) {
        console.error('Erreur réinitialisation config:', e);
    }
};

// Charger la configuration au démarrage
CONFIG.load();

// Rendre CONFIG accessible globalement
window.CONFIG = CONFIG;