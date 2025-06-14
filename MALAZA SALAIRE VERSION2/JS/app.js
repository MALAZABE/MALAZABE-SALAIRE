// Application principale MALAZA BE - VERSION 3.0
// Gestion centralisée de l'application

const App = {
    // État de l'application
    isReady: false,
    version: CONFIG.version,
    
    // Initialisation principale
    init: async function() {
        console.log('🚀 Démarrage de MALAZA BE v' + this.version);
        
        try {
            // Vérifier l'authentification
            if (!Auth.isAuthenticated) {
                console.log('🔐 Authentification requise');
                Auth.showLoginForm();
                return;
            }
            
            // Démarrer l'application
            await this.start();
            
        } catch (error) {
            console.error('Erreur initialisation:', error);
            this.showError('Erreur lors du démarrage de l\'application');
        }
    },
    
    // Démarrer l'application après authentification
    start: async function() {
        try {
            // 1. Initialiser la base de données
            console.log('📊 Initialisation de la base de données...');
            if (!await Database.init()) {
                throw new Error('Impossible d\'initialiser la base de données');
            }
            
            // 2. Charger toutes les données
            console.log('📥 Chargement des données...');
            await this.loadAllData();
            
            // 3. Initialiser l'interface
            console.log('🎨 Initialisation de l\'interface...');
            UI.init();
            
            // 4. Démarrer les tâches périodiques
            this.startPeriodicTasks();
            
            // Application prête
            this.isReady = true;
            console.log('✅ Application prête !');
            
            // Afficher un message de bienvenue
            this.showWelcomeMessage();
            
            // Vérifier s'il faut créer des données de démo
            if (App.utils.isFirstUse() && Employees.list.length === 0) {
                setTimeout(() => {
                    App.utils.createDemoData();
                }, 1000);
            }
            
        } catch (error) {
            console.error('Erreur démarrage:', error);
            this.showError('Erreur lors du chargement de l\'application');
        }
    },
    
    // Charger toutes les données nécessaires
    loadAllData: async function() {
        try {
            // 1. D'abord charger les employés
            console.log('1️⃣ Chargement des employés...');
            await Employees.load();
            
            // 2. Ensuite charger les paiements (nécessaire pour les avances)
            console.log('2️⃣ Chargement des paiements...');
            await Payments.load();
            
            // 3. Charger les congés
            console.log('3️⃣ Chargement des congés...');
            await Leaves.load();
            
            // 4. Charger le pointage du mois en cours
            console.log('4️⃣ Chargement du pointage...');
            await Attendance.load(Utils.getCurrentMonth());
            
            // 5. Charger les bonus et avances spéciales APRÈS les paiements
            console.log('5️⃣ Chargement des bonus et avances spéciales...');
            await Salary.loadBonusesAdvances(Utils.getCurrentMonth());
            await Salary.loadSpecialAdvances();
            
            console.log('✅ Toutes les données chargées');
            
            // Vérifier que les paiements sont bien chargés
            console.log(`Paiements chargés: ${Payments.list.length}`);
            console.log(`Employés chargés: ${Employees.list.length}`);
            
            // CORRECTION: Leaves n'a plus de list dans v2.0 - tout est dans Payments
            const leavesCount = Payments.list.filter(p => 
                p.paymentType === 'leave_taken' || p.paymentType === 'leave_monetized'
            ).length;
            console.log(`Congés chargés: ${leavesCount}`);
            
        } catch (error) {
            console.error('Erreur chargement données:', error);
            throw error;
        }
    },
    
    // Recharger les données pour une section
    reloadDataForSection: async function(section) {
        console.log(`Rechargement des données pour: ${section}`);
        
        try {
            // Toujours recharger dans le bon ordre
            await Employees.load();
            await Payments.load();
            await Leaves.load();
            
            switch (section) {
                case 'attendance':
                    await Attendance.load(UI.selectedMonth);
                    break;
                    
                case 'salaries':
                case 'bonusAdvance':
                    await Attendance.load(UI.selectedMonth);
                    await Salary.loadBonusesAdvances(UI.selectedMonth);
                    await Salary.loadSpecialAdvances();
                    break;
                    
                case 'reports':
                    await Attendance.load(UI.selectedMonth);
                    await Salary.loadBonusesAdvances(UI.selectedMonth);
                    await Salary.loadSpecialAdvances();
                    break;
            }
            
            console.log('✅ Données rechargées');
            
        } catch (error) {
            console.error('Erreur rechargement:', error);
        }
    },
    
    // Afficher un loader
    showLoader: function() {
        const app = document.getElementById('app');
        app.innerHTML = `
            <div class="app-loader">
                <div class="loader-content">
                    <h1>MALAZA BE</h1>
                    <div class="spinner"></div>
                    <p>Chargement en cours...</p>
                </div>
            </div>
        `;
    },
    
    // Afficher une erreur
    showError: function(message) {
        const app = document.getElementById('app');
        app.innerHTML = `
            <div class="app-error">
                <div class="error-content">
                    <h1>😞 Oups !</h1>
                    <p>${message}</p>
                    <button class="btn btn-primary" onclick="location.reload()">
                        Recharger
                    </button>
                </div>
            </div>
        `;
    },
    
    // Message de bienvenue
    showWelcomeMessage: function() {
        const hour = new Date().getHours();
        let greeting = 'Bonjour';
        
        if (hour >= 12 && hour < 18) {
            greeting = 'Bon après-midi';
        } else if (hour >= 18) {
            greeting = 'Bonsoir';
        }
        
        notify.success(`${greeting} ! Bienvenue dans MALAZA BE`);
        
        // Vérifications et alertes
        this.checkNotifications();
    },
    
    // Vérifier les notifications importantes
    checkNotifications: function() {
        const currentMonth = Utils.getCurrentMonth();
        const today = Utils.getCurrentDay();
        
        // Vérifier les paiements en retard
        const unpaidCount = Employees.list.filter(emp => {
            const calc = Salary.calculate(emp, currentMonth);
            return calc.remaining > 0;
        }).length;
        
        if (unpaidCount > 0) {
            setTimeout(() => {
                notify.warning(`${unpaidCount} employé(s) non payé(s) ce mois. Pensez à finaliser les paiements`);
            }, 3000);
        }
        
        // Vérifier les absences
        const todayAttendance = Object.keys(Attendance.cache[currentMonth] || {})
            .filter(key => key.endsWith(today))
            .length;
        
        if (todayAttendance === 0 && new Date().getHours() >= 8) {
            setTimeout(() => {
                notify.info('Aucun pointage enregistré aujourd\'hui');
            }, 4000);
        }
    },
    
    // Tâches périodiques
    startPeriodicTasks: function() {
        // Sauvegarde automatique toutes les 5 minutes
        setInterval(() => {
            if (this.isReady) {
                console.log('💾 Sauvegarde automatique...');
                // PouchDB sauvegarde automatiquement, on peut juste vérifier l'état
                Database.db.info().then(info => {
                    console.log('✅ Base de données OK:', info.doc_count, 'documents');
                });
            }
        }, 5 * 60 * 1000); // 5 minutes
        
        // Rafraîchir les données toutes les 30 secondes si on est sur le dashboard
        setInterval(() => {
            if (this.isReady && UI.currentSection === 'dashboard') {
                UI.render();
            }
        }, 30 * 1000); // 30 secondes
    },
    
    // Gestionnaire d'erreurs global
    handleError: function(error) {
        console.error('Erreur globale:', error);
        
        // Afficher une notification selon le type d'erreur
        if (error.status === 404) {
            notify.error('Donnée introuvable');
        } else if (error.status === 409) {
            notify.error('Conflit de données, veuillez rafraîchir');
        } else if (error.message && error.message.includes('quota')) {
            notify.error('Espace de stockage insuffisant');
        } else {
            notify.error('Une erreur est survenue');
        }
    },
    
    // Utilitaires
    utils: {
        // Vérifier si c'est la première utilisation
        isFirstUse: function() {
            return !Utils.loadPreference('hasBeenUsed', false);
        },
        
        // Marquer comme utilisé
        markAsUsed: function() {
            Utils.savePreference('hasBeenUsed', true);
        },
        
        // Créer des données de démonstration
        createDemoData: async function() {
            const confirm = await Utils.confirm(
                'Voulez-vous créer des données de démonstration ?\n' +
                'Cela ajoutera 3 employés avec des pointages.'
            );
            
            if (!confirm) return;
            
            // Ajouter des employés de démo
            const demoEmployees = [
                {
                    name: 'Jean Rakoto',
                    cin: '101 234 567 890',
                    position: 'chauffeur',
                    salary: 500000,
                    startDate: '2023-01-15',
                    address: 'Antananarivo',
                    phone: '034 12 345 67'
                },
                {
                    name: 'Marie Razafy',
                    cin: '102 345 678 901',
                    position: 'vendeur',
                    salary: 400000,
                    startDate: '2023-03-20',
                    address: 'Mahajanga',
                    phone: '032 98 765 43'
                },
                {
                    name: 'Paul Randria',
                    cin: '103 456 789 012',
                    position: 'gardien',
                    salary: 350000,
                    startDate: '2023-06-01',
                    address: 'Toamasina',
                    phone: '033 11 222 33'
                }
            ];
            
            for (const empData of demoEmployees) {
                await Employees.add(empData);
            }
            
            notify.success('Données de démonstration créées !');
            
            // Rafraîchir l'interface
            UI.render();
        }
    }
};

// Gestionnaire d'erreurs global
window.addEventListener('error', (event) => {
    App.handleError(event.error);
});

// Gestionnaire de promesses rejetées
window.addEventListener('unhandledrejection', (event) => {
    App.handleError(event.reason);
});

// Empêcher la fermeture accidentelle
window.addEventListener('beforeunload', (event) => {
    if (App.isReady) {
        event.preventDefault();
        event.returnValue = 'Êtes-vous sûr de vouloir quitter ?';
    }
});

// Démarrer l'application quand le DOM est prêt
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.init());
} else {
    App.init();
}

// Rendre App disponible globalement
window.App = App;

// Message de bienvenue dans la console
console.log(`
%c🏢 MALAZA BE - Gestion des Salaires %cv${CONFIG.version}

%c👨‍💻 Développé avec ❤️ pour simplifier la gestion salariale
%c📊 Base de données locale avec sauvegarde automatique
%c🔒 Vos données restent privées et sécurisées

%cRaccourcis clavier:
  Ctrl+E : Nouvel employé
  Ctrl+P : Nouveau paiement
  Ctrl+D : Tableau de bord
  Échap  : Fermer les fenêtres

`, 
'color: #007bff; font-size: 20px; font-weight: bold;',
'color: #28a745; font-size: 16px;',
'color: #666; font-size: 14px;',
'color: #666; font-size: 14px;',
'color: #666; font-size: 14px;',
'color: #17a2b8; font-size: 14px; font-weight: bold;'
);

// NOUVEAU : Enregistrer le Service Worker pour PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/malazabe-salaire/sw.js')
            .then(reg => console.log('✅ Service Worker enregistré:', reg))
            .catch(err => console.log('❌ Service Worker erreur:', err));
    });
}