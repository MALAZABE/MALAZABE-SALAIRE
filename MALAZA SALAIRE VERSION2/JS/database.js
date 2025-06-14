// Gestion de la base de données avec PouchDB - VERSION 3.0 PWA
// Note: Pour modifier la limite d'avance, chercher "LIMITE_AVANCE" dans payments.js et salary.js
const Database = {
    // Instances de bases
    db: null,
    localDB: null,
    remoteDB: null,
    sync: null,
    
    // Initialiser la base de données
    init: async function() {
        try {
            // TOUJOURS créer une base locale
            this.localDB = new PouchDB(CONFIG.dbName);
            
            // Vérifier si on peut se connecter à CouchDB
            if (navigator.onLine) {
                try {
                    // ⚠️ REMPLACE tonmotdepasse par TON vrai mot de passe !
                    const couchUrl = 'http://admin:admin123@localhost:5984/malazabe-salaire';
                    this.remoteDB = new PouchDB(couchUrl);
                    
                    // Tester la connexion
                    await this.remoteDB.info();
                    console.log('📡 CouchDB connecté, synchronisation activée');
                    
                    // Synchronisation bidirectionnelle
                    this.sync = this.localDB.sync(this.remoteDB, {
                        live: true,
                        retry: true
                    }).on('change', (info) => {
                        console.log('📡 Sync:', info.direction, info.change.docs.length, 'docs');
                    }).on('paused', (err) => {
                        if (err) {
                            console.log('⚠️ Sync en pause:', err);
                        } else {
                            console.log('✅ Sync à jour');
                        }
                    }).on('error', (err) => {
                        console.error('❌ Erreur sync:', err);
                        notify.warning('Mode hors ligne - Les données seront synchronisées plus tard');
                    });
                    
                } catch (error) {
                    console.log('📴 CouchDB non disponible, mode local uniquement');
                }
            } else {
                console.log('📴 Hors ligne, mode local uniquement');
            }
            
            // Toujours utiliser la base locale pour la rapidité
            this.db = this.localDB;
            
            // Informations sur la base
            const info = await this.db.info();
            console.log('Base de données initialisée:', info);
            
            // Créer les index pour les recherches rapides
            await this.createIndexes();
            
            // Écouter les changements de connexion
            window.addEventListener('online', () => {
                console.log('🌐 Connexion rétablie');
                this.reconnectSync();
            });
            
            window.addEventListener('offline', () => {
                console.log('📴 Connexion perdue');
                notify.info('Mode hors ligne activé');
            });
            
            return true;
        } catch (error) {
            console.error('Erreur initialisation DB:', error);
            notify.error('Erreur lors de l\'initialisation de la base de données');
            return false;
        }
    },
    
    // Reconnecter la synchronisation
    reconnectSync: async function() {
        if (!this.remoteDB || this.sync) return;
        
        try {
            // ⚠️ REMPLACE tonmotdepasse par TON vrai mot de passe !
            const couchUrl = 'http://admin:tonmotdepasse@localhost:5984/malazabe-salaire';
            this.remoteDB = new PouchDB(couchUrl);
            
            await this.remoteDB.info();
            
            this.sync = this.localDB.sync(this.remoteDB, {
                live: true,
                retry: true
            });
            
            notify.success('Synchronisation rétablie');
        } catch (error) {
            console.log('Impossible de reconnecter à CouchDB');
        }
    },
    
    // Créer les index pour optimiser les recherches
    createIndexes: async function() {
        try {
            // Index pour les types de documents
            await this.db.createIndex({
                index: { fields: ['type'] }
            });
            
            // Index pour les employés
            await this.db.createIndex({
                index: { fields: ['type', 'name'] }
            });
            
            // Index pour les paiements par mois
            await this.db.createIndex({
                index: { fields: ['type', 'month'] }
            });
            
            // Index pour les paiements par employé et mois
            await this.db.createIndex({
                index: { fields: ['type', 'employeeId', 'month'] }
            });
            
            // NOUVEAU: Index pour les reports d'avances spéciales
            await this.db.createIndex({
                index: { fields: ['type', 'subtype'] }
            });
            
            console.log('✅ Index créés avec succès');
            
        } catch (error) {
            console.error('Erreur création index:', error);
        }
    },
    
    // ===== MÉTHODES GÉNÉRIQUES =====
    
    // Sauvegarder un document
    save: async function(doc) {
        try {
            // Ajouter un timestamp
            if (!doc.createdAt) {
                doc.createdAt = new Date().toISOString();
            }
            doc.updatedAt = new Date().toISOString();
            
            // Si le document a un _id mais pas de _rev, le récupérer
            if (doc._id && !doc._rev) {
                try {
                    const existing = await this.db.get(doc._id);
                    doc._rev = existing._rev;
                } catch (e) {
                    // Document n'existe pas encore, c'est OK
                }
            }
            
            // Sauvegarder
            const response = await this.db.put(doc);
            doc._rev = response.rev;
            
            return doc;
            
        } catch (error) {
            console.error('Erreur sauvegarde:', error);
            notify.error('Erreur lors de la sauvegarde');
            return null;
        }
    },
    
    // Trouver des documents
    find: async function(selector) {
        try {
            const result = await this.db.find({
                selector: selector,
                limit: 1000
            });
            return result.docs;
        } catch (error) {
            console.error('Erreur recherche:', error);
            return [];
        }
    },
    
    // Supprimer un document
    delete: async function(doc) {
        try {
            const result = await this.db.remove(doc);
            return result.ok;
        } catch (error) {
            console.error('Erreur suppression:', error);
            notify.error('Erreur lors de la suppression');
            return false;
        }
    },
    
    // ===== MÉTHODES SPÉCIFIQUES =====
    
    // -- Employés --
    saveEmployee: async function(employee) {
        employee.type = 'employee';
        employee._id = employee._id || `employee_${employee.cin.replace(/\s/g, '')}`;
        return await this.save(employee);
    },
    
    getEmployees: async function() {
        return await this.find({ type: 'employee' });
    },
    
    deleteEmployee: async function(employee) {
        return await this.delete(employee);
    },
    
    // -- Pointages --
    saveAttendance: async function(attendance) {
        attendance.type = 'attendance';
        attendance._id = `attendance_${attendance.employeeId}_${attendance.date}`;
        return await this.save(attendance);
    },
    
    getAttendances: async function(month = null) {
        const selector = { type: 'attendance' };
        if (month) {
            selector.date = { $regex: `^${month}` };
        }
        return await this.find(selector);
    },
    
    // -- Paiements --
    savePayment: async function(payment) {
        payment.type = 'payment';
        if (!payment._id) {
            payment._id = `payment_${payment.employeeId}_${Date.now()}`;
        }
        return await this.save(payment);
    },
    
    getPayments: async function() {
        const payments = await this.find({ type: 'payment' });
        return payments.sort((a, b) => new Date(b.date) - new Date(a.date));
    },
    
    deletePayment: async function(payment) {
        return await this.delete(payment);
    },
    
    // NOUVELLE MÉTHODE: Obtenir les avances du mois pour validation
    getMonthlyAdvances: async function(employeeId, month) {
        const payments = await this.find({
            type: 'payment',
            employeeId: employeeId,
            month: month
        });
        
        // Filtrer seulement les avances normales
        const advances = payments.filter(p => p.paymentType === 'advance');
        
        return advances.reduce((total, p) => total + (p.amount || 0), 0);
    },
    
    // -- Congés --
    saveLeave: async function(leave) {
        leave.type = 'leave';
        return await this.save(leave);
    },
    
    getLeaves: async function(year = null) {
        const leaves = await this.find({ type: 'leave' });
        if (year) {
            return leaves.filter(l => new Date(l.date).getFullYear() === year);
        }
        return leaves;
    },
    
    // -- Primes et Avances --
    saveBonusAdvance: async function(data) {
        data.type = 'bonus_advance';
        data._id = `bonus_advance_${data.employeeId}_${data.month}_${data.subtype}`;
        return await this.save(data);
    },
    
    getBonusesAdvances: async function(month = null) {
        const selector = { type: 'bonus_advance' };
        if (month) {
            selector.month = month;
        }
        return await this.find(selector);
    },
    
    // -- Avances spéciales --
    saveSpecialAdvance: async function(advance) {
        advance.type = 'special_advance';
        advance._id = `special_advance_${advance.employeeId}`;
        
        // Ajouter un historique vide si non présent
        if (!advance.reportHistory) {
            advance.reportHistory = [];
        }
        
        return await this.save(advance);
    },
    
    // ALIAS pour compatibilité avec payments.js
    saveSpecialAdvanceSchedule: async function(schedule) {
        return await this.saveSpecialAdvance(schedule);
    },
    
    getSpecialAdvances: async function() {
        return await this.find({ type: 'special_advance' });
    },
    
    // ALIAS pour compatibilité avec payments.js
    getSpecialAdvanceSchedules: async function(employeeId = null) {
        const selector = { type: 'special_advance', status: 'active' };
        if (employeeId) {
            selector.employeeId = employeeId;
        }
        return await this.find(selector);
    },
    
    // NOUVEAU: Sauvegarder un report d'avance spéciale
    saveSpecialAdvanceReport: async function(report) {
        report.type = 'special_advance_report';
        report._id = `special_advance_report_${report.employeeId}_${report.month}`;
        return await this.save(report);
    },
    
    // NOUVEAU: Obtenir les reports d'avances spéciales
    getSpecialAdvanceReports: async function(employeeId = null) {
        const selector = { type: 'special_advance_report' };
        if (employeeId) {
            selector.employeeId = employeeId;
        }
        return await this.find(selector);
    },
    
    // ===== EXPORT/IMPORT =====
    
    // Exporter toutes les données
    exportData: async function() {
        try {
            const allDocs = await this.db.allDocs({
                include_docs: true,
                attachments: false
            });
            
            // Filtrer les documents système
            const docs = allDocs.rows
                .filter(row => !row.id.startsWith('_'))
                .map(row => row.doc);
            
            const backup = {
                version: CONFIG.version,
                date: new Date().toISOString(),
                dataVersion: 5,
                counts: {
                    employees: docs.filter(d => d.type === 'employee').length,
                    payments: docs.filter(d => d.type === 'payment').length,
                    attendances: docs.filter(d => d.type === 'attendance').length,
                    leaves: docs.filter(d => d.type === 'leave').length,
                    bonusAdvances: docs.filter(d => d.type === 'bonus_advance').length,
                    specialAdvances: docs.filter(d => d.type === 'special_advance').length,
                    specialAdvanceReports: docs.filter(d => d.type === 'special_advance_report').length
                },
                data: docs
            };
            
            console.log('Export:', backup.counts);
            return backup;
            
        } catch (error) {
            console.error('Erreur export:', error);
            notify.error('Erreur lors de l\'export');
            return null;
        }
    },
    
    // Importer des données
    importData: async function(backup) {
        try {
            // Vérifier la structure
            if (!backup.data || !Array.isArray(backup.data)) {
                notify.error('Format de fichier invalide');
                return false;
            }
            
            // Vérifier la version
            const currentVersion = 5;
            if (backup.dataVersion && backup.dataVersion > currentVersion) {
                notify.error('Cette sauvegarde provient d\'une version plus récente');
                return false;
            }
            
            // Confirmer l'import
            const confirmMsg = `Importer ${backup.data.length} documents ?\n` +
                             `Cela remplacera toutes les données existantes.\n\n` +
                             `Employés: ${backup.counts?.employees || 0}\n` +
                             `Paiements: ${backup.counts?.payments || 0}\n` +
                             `Pointages: ${backup.counts?.attendances || 0}\n` +
                             `Congés: ${backup.counts?.leaves || 0}`;
            
            const migrate = await Utils.confirm(confirmMsg);
            
            if (!migrate) return false;
            
            // Importer chaque document
            let imported = 0;
            let errors = 0;
            
            for (const doc of backup.data) {
                // Retirer les métadonnées PouchDB
                delete doc._rev;
                
                try {
                    await this.db.put(doc);
                    imported++;
                } catch (error) {
                    console.error('Erreur import doc:', doc._id, error);
                    errors++;
                }
            }
            
            notify.success(`Import terminé : ${imported} documents importés${errors > 0 ? `, ${errors} erreurs` : ''}`);
            return true;
            
        } catch (error) {
            console.error('Erreur import:', error);
            notify.error('Erreur lors de l\'import');
            return false;
        }
    },
    
    // Obtenir des statistiques sur la base
    getStats: async function() {
        try {
            const info = await this.db.info();
            const allDocs = await this.db.allDocs();
            
            // Compter par type
            const typeCount = {};
            for (const row of allDocs.rows) {
                if (!row.id.startsWith('_')) { // Ignorer les docs système
                    const type = row.id.split('_')[0];
                    typeCount[type] = (typeCount[type] || 0) + 1;
                }
            }
            
            // Compter les reports d'avances spéciales
            const reports = await this.find({ type: 'special_advance_report' });
            
            // État de la synchronisation
            let syncStatus = 'Non configuré';
            if (this.sync) {
                syncStatus = navigator.onLine ? 'Actif' : 'En pause';
            } else if (this.remoteDB) {
                syncStatus = 'Déconnecté';
            }
            
            return {
                totalDocs: info.doc_count,
                updateSeq: info.update_seq,
                diskSize: (info.disk_size / 1024 / 1024).toFixed(2) + ' MB',
                types: typeCount,
                specialAdvanceReports: reports.length,
                syncStatus: syncStatus
            };
        } catch (error) {
            console.error('Erreur stats:', error);
            return null;
        }
    },
    
    // ===== UTILITAIRES =====
    
    // Nettoyer complètement la base (pour le reset)
    clearAll: async function() {
        try {
            const confirm = await Utils.confirm(
                '⚠️ ATTENTION !\n\n' +
                'Cette action va supprimer TOUTES les données.\n' +
                'Avez-vous fait une sauvegarde ?\n\n' +
                'Cette action est IRREVERSIBLE !'
            );
            
            if (!confirm) return false;
            
            // Arrêter la sync
            if (this.sync) {
                this.sync.cancel();
            }
            
            // Détruire la base locale
            await this.localDB.destroy();
            
            // Recréer et réinitialiser
            await this.init();
            
            notify.success('Base de données réinitialisée');
            return true;
            
        } catch (error) {
            console.error('Erreur lors du reset:', error);
            notify.error('Erreur lors de la réinitialisation');
            return false;
        }
    }
};

// Rendre disponible globalement
window.Database = Database;