// Gestion des paiements - VERSION 7.0 - CORRIGÉE AVEC CALCULATEASYNC ET DEBOUNCE
const Payments = {
    // Liste des paiements
    list: [],
    
    // Timer pour le debounce
    updateTimer: null,
    
    // Types de paiements disponibles
    PAYMENT_TYPES: {
        salary: { label: '💵 Salaire', needsMonth: true, useMultiple: true },
        advance: { label: '💰 Avance', needsMonth: true, useMultiple: true },
        special_advance: { label: '📅 Avance spéciale', needsMonth: false, useMultiple: false },
        bonus: { label: '🎁 Prime', needsMonth: true, useMultiple: true },
        leave_monetized: { label: '💸 Congé monnayé', needsMonth: false, useMultiple: false },
        other: { label: '📌 Autre', needsMonth: true, useMultiple: false }
    },
    
    // Charger tous les paiements
    load: async function() {
        try {
            this.list = await Database.getPayments();
            console.log(`${this.list.length} paiements chargés`);
            
            // Analyser les types
            const typeCount = {};
            this.list.forEach(p => {
                typeCount[p.paymentType] = (typeCount[p.paymentType] || 0) + 1;
            });
            console.log('Types de paiements:', typeCount);
            
            return this.list;
        } catch (error) {
            console.error('Erreur chargement paiements:', error);
            notify.error('Erreur lors du chargement des paiements');
            return [];
        }
    },
    
    // Ajouter un paiement
    add: async function(paymentData) {
        try {
            // Validation générale
            if (!paymentData.employeeId || !paymentData.amount || paymentData.amount <= 0) {
                notify.error('Données de paiement invalides');
                return false;
            }
            
            // Validation spécifique selon le type
            if (!await this.validatePayment(paymentData)) {
                return false;
            }
            
            // Préparer les données
            const payment = {
                ...paymentData,
                id: Utils.generateId(),
                date: paymentData.date || Utils.getCurrentDate(),
                month: paymentData.month || paymentData.date?.substring(0, 7) || Utils.getCurrentMonth(),
                createdAt: new Date().toISOString(),
                type: 'payment', // Type de document pour la base
                paymentType: paymentData.paymentType // Type de paiement
            };
            
            console.log('Ajout paiement:', payment.paymentType, payment.amount);
            
            // Traitement spécial pour avance spéciale
            if (payment.paymentType === 'special_advance') {
                await this.handleSpecialAdvance(payment);
            }
            
            // Sauvegarder
            const saved = await Database.savePayment(payment);
            
            // Ajouter à la liste locale
            this.list.unshift(saved);
            
            // Message de succès
            const typeInfo = this.PAYMENT_TYPES[payment.paymentType];
            notify.success(`${typeInfo ? typeInfo.label : 'Paiement'} enregistré`);
            
            // IMPORTANT: Recharger la liste complète
            await this.load();
            
            // Rafraîchir l'interface
            if (window.UI && UI.render) {
                await UI.render();
            }
            
            return saved;
            
        } catch (error) {
            console.error('Erreur ajout paiement:', error);
            notify.error('Erreur lors de l\'enregistrement');
            return false;
        }
    },
    
    // NOUVELLE MÉTHODE: Ajouter plusieurs paiements
    addMultiple: async function(paymentsData) {
        try {
            let successCount = 0;
            let failCount = 0;
            
            for (const payment of paymentsData) {
                // Ignorer les montants vides ou 0
                if (!payment.amount || payment.amount <= 0) {
                    continue;
                }
                
                const result = await this.add(payment);
                if (result) {
                    successCount++;
                } else {
                    failCount++;
                }
            }
            
            if (successCount > 0) {
                notify.success(`${successCount} paiement(s) enregistré(s)`);
            }
            
            if (failCount > 0) {
                notify.warning(`${failCount} paiement(s) échoué(s)`);
            }
            
            return successCount > 0;
            
        } catch (error) {
            console.error('Erreur paiements multiples:', error);
            notify.error('Erreur lors de l\'enregistrement multiple');
            return false;
        }
    },
    
    // Valider un paiement selon son type
    validatePayment: async function(data) {
        const employee = Employees.getById(data.employeeId);
        if (!employee) {
            notify.error('Employé introuvable');
            return false;
        }
        
        switch (data.paymentType) {
            case 'advance':
                // Calculer le maximum autorisé correctement - UTILISER AWAIT
                const maxAllowed = await this.calculateMaxAdvance(data.employeeId, data.month);
                
                if (data.amount > maxAllowed) {
                    notify.error(`Avance trop élevée pour ${employee.name} ! Maximum: ${Utils.formatMoney(maxAllowed)}`);
                    return false;
                }
                break;
                
            case 'special_advance':
                // Pour les avances spéciales, valider l'échéancier
                if (data.schedule) {
                    return await this.validateSpecialAdvanceSchedule(data.employeeId, data.schedule);
                }
                break;
                
            case 'leave_monetized':
                // Vérifier le solde avec Leaves
                if (window.Leaves && Leaves.getBalance) {
                    const balance = Leaves.getBalance(data.employeeId);
                    if (balance.available < data.days) {
                        notify.error(`Solde insuffisant : ${balance.available.toFixed(1)} jours disponibles`);
                        return false;
                    }
                }
                break;
        }
        
        return true;
    },
    
    // CORRIGER: Calculer le maximum autorisé pour une avance
    calculateMaxAdvance: async function(employeeId, month) {
        const employee = Employees.getById(employeeId);
        if (!employee) return 0;
        
        // Avances normales déjà prises ce mois
        const normalAdvances = this.getMonthlyAdvances(employeeId, month);
        
        // Avance spéciale du mois - UTILISER LA MÉTHODE ASYNC
        const specialAdvances = await this.getSpecialAdvanceMonthly(employeeId, month);
        
        // Maximum = Salaire - Avances normales - Avance spéciale
        const maxAllowed = employee.salary - normalAdvances - specialAdvances;
        
        console.log(`Max avance pour ${employee.name}: Salaire(${employee.salary}) - Avances(${normalAdvances}) - AvSpec(${specialAdvances}) = ${maxAllowed}`);
        
        return Math.max(0, maxAllowed);
    },
    
    // NOUVELLE MÉTHODE: Valider l'échéancier d'une avance spéciale
    validateSpecialAdvanceSchedule: async function(employeeId, schedule) {
        const employee = Employees.getById(employeeId);
        if (!employee) return false;
        
        // Vérifier chaque mois de l'échéancier
        for (const [month, amount] of Object.entries(schedule)) {
            // Calculer ce qui est déjà pris ce mois
            const normalAdvances = this.getMonthlyAdvances(employeeId, month);
            
            // IMPORTANT: Utiliser la version async pour avoir les vraies données
            const existingSpecial = await this.getSpecialAdvanceMonthly(employeeId, month);
            
            // Total des engagements
            const totalDeductions = normalAdvances + existingSpecial + amount;
            
            // Pas de limite fixe - on peut prendre jusqu'au salaire complet
            const maxAllowed = employee.salary;
            
            if (totalDeductions > maxAllowed) {
                const available = maxAllowed - normalAdvances - existingSpecial;
                notify.error(
                    `Échéance trop élevée pour ${Utils.formatMonth(month)} !\n` +
                    `Maximum autorisé: ${Utils.formatMoney(available)}`
                );
                return false;
            }
        }
        
        return true;
    },
    
    // Obtenir l'avance spéciale existante pour un mois (SYNCHRONE)
    getSpecialAdvanceForMonth: function(employeeId, month) {
        // IMPORTANT: Ne PAS utiliser la liste locale qui peut être obsolète
        // Cette méthode doit être remplacée par une version async pour être cohérente
        console.warn('getSpecialAdvanceForMonth est synchrone et peut retourner des données obsolètes');
        
        // Chercher dans les paiements d'avances spéciales
        const specialAdvancePayments = this.list.filter(p => 
            p.paymentType === 'special_advance' && 
            p.employeeId === employeeId &&
            p.schedule
        );
        
        let total = 0;
        specialAdvancePayments.forEach(payment => {
            if (payment.schedule && payment.schedule[month]) {
                total += payment.schedule[month];
            }
        });
        
        return total;
    },
    
    // Gérer une avance spéciale
    handleSpecialAdvance: async function(payment) {
        if (payment.schedule) {
            // IMPORTANT: Utiliser l'ID correct du paiement
            const scheduleData = {
                employeeId: payment.employeeId,
                paymentId: payment._id || payment.id,  // Corriger: utiliser aussi payment.id
                loanDate: payment.date,
                totalAmount: payment.amount,
                schedule: payment.schedule,
                paidMonths: [],
                status: 'active'
            };
            
            await Database.saveSpecialAdvanceSchedule(scheduleData);
        }
    },
    
    // Modifier un paiement
    update: async function(paymentId, updates) {
        try {
            const payment = this.list.find(p => p._id === paymentId);
            if (!payment) {
                notify.error('Paiement introuvable');
                return false;
            }
            
            // Interdire la modification de certains types
            if (payment.paymentType === 'special_advance') {
                notify.error('Les avances spéciales ne peuvent pas être modifiées');
                return false;
            }
            
            // Validation si changement du montant
            if (updates.amount && payment.paymentType === 'advance') {
                const tempData = { ...payment, ...updates };
                if (!await this.validatePayment(tempData)) {
                    return false;
                }
            }
            
            // Fusionner les modifications
            const updated = { ...payment, ...updates };
            
            // Si on change la date, mettre à jour le mois
            if (updates.date) {
                updated.month = updates.date.substring(0, 7);
            }
            
            // Sauvegarder
            const saved = await Database.savePayment(updated);
            
            // Mettre à jour la liste locale
            const index = this.list.findIndex(p => p._id === saved._id);
            if (index !== -1) {
                this.list[index] = saved;
            }
            
            notify.success('Paiement modifié');
            
            // IMPORTANT: Recharger la liste complète
            await this.load();
            
            // Rafraîchir l'interface
            if (window.UI && UI.render) {
                await UI.render();
            }
            
            return saved;
            
        } catch (error) {
            console.error('Erreur modification paiement:', error);
            notify.error('Erreur lors de la modification');
            return false;
        }
    },
    
    // Supprimer un paiement
    delete: async function(paymentId) {
        try {
            const payment = this.list.find(p => p._id === paymentId);
            if (!payment) {
                notify.error('Paiement introuvable');
                return false;
            }
            
            // Confirmer
            const typeInfo = this.PAYMENT_TYPES[payment.paymentType];
            const confirm = await Utils.confirm(
                `Supprimer ${typeInfo ? typeInfo.label : 'ce paiement'} ?\n` +
                `Montant: ${Utils.formatMoney(payment.amount)}`
            );
            
            if (!confirm) return false;
            
            // Actions spéciales pour avance spéciale
            if (payment.paymentType === 'special_advance') {
                console.log('Suppression avance spéciale:', paymentId);
                console.log('Paiement:', payment);
                
                // NOUVELLE APPROCHE : Supprimer l'échéancier complet
                try {
                    // L'ID de l'échéancier est : special_advance_[employeeId]
                    const scheduleId = `special_advance_${payment.employeeId}`;
                    console.log('Recherche échéancier avec ID:', scheduleId);
                    
                    // Essayer de récupérer et supprimer l'échéancier
                    const scheduleDoc = await Database.get(scheduleId);
                    if (scheduleDoc) {
                        console.log('Échéancier trouvé:', scheduleDoc);
                        await Database.delete(scheduleId);
                        console.log('Échéancier supprimé');
                    } else {
                        console.log('Aucun échéancier trouvé avec cet ID');
                    }
                    
                    // Alternative : chercher par employeeId
                    const schedules = await Database.getSpecialAdvanceSchedules(payment.employeeId);
                    console.log(`${schedules.length} échéancier(s) trouvé(s) pour l'employé`);
                    
                    // Si on a un échéancier et qu'il correspond au montant du paiement
                    for (const schedule of schedules) {
                        if (schedule.totalAmount === payment.amount) {
                            console.log('Suppression échéancier correspondant:', schedule._id);
                            await Database.delete(schedule._id);
                        }
                    }
                    
                } catch (error) {
                    console.error('Erreur suppression échéancier:', error);
                }
            }
            
            // Supprimer de la base
            await Database.delete(paymentId);
            
            // Retirer de la liste locale
            this.list = this.list.filter(p => p._id !== paymentId);
            
            // IMPORTANT: Recharger la liste complète
            await this.load();
            
            notify.success('Paiement supprimé');
            
            // CRITIQUE: Pour les avances spéciales, forcer la mise à jour de tous les formulaires ouverts
            if (payment.paymentType === 'special_advance') {
                // Fermer tous les modals de paiement ouverts
                document.querySelectorAll('.modal').forEach(modal => {
                    if (modal.querySelector('#multiplePaymentForm') || modal.querySelector('#paymentForm')) {
                        modal.remove();
                        notify.info('Formulaire fermé - Veuillez rouvrir pour voir les montants actualisés');
                    }
                });
            }
            
            // Rafraîchir l'interface
            if (window.UI && UI.render) {
                await UI.render();
            }
            
            return true;
            
        } catch (error) {
            console.error('Erreur suppression paiement:', error);
            notify.error('Erreur lors de la suppression');
            return false;
        }
    },
    
    // ===== MÉTHODES DE CALCUL =====
    
    // Obtenir le total des avances du mois
    getMonthlyAdvances: function(employeeId, month) {
        return this.list
            .filter(p => 
                p && 
                p.employeeId === employeeId && 
                p.month === month && 
                p.paymentType === 'advance'
            )
            .reduce((sum, p) => sum + (p.amount || 0), 0);
    },
    
    // Obtenir le total payé pour un mois (salaires uniquement)
    getTotalPaidForMonth: function(employeeId, month) {
        return this.list
            .filter(p => 
                p && 
                p.employeeId === employeeId && 
                p.month === month &&
                p.paymentType === 'salary'
            )
            .reduce((total, p) => total + (p.amount || 0), 0);
    },
    
    // Obtenir les bonus du mois
    getMonthlyBonus: function(employeeId, month) {
        return this.list
            .filter(p => 
                p && 
                p.employeeId === employeeId && 
                p.month === month &&
                p.paymentType === 'bonus'
            )
            .reduce((total, p) => total + (p.amount || 0), 0);
    },
    
    // Obtenir l'échéance d'avance spéciale du mois (ASYNC)
    getSpecialAdvanceMonthly: async function(employeeId, month) {
        try {
            // IMPORTANT: Toujours récupérer les données fraîches de la base
            const schedules = await Database.getSpecialAdvanceSchedules(employeeId);
            let total = 0;
            
            // Filtrer seulement les échéanciers actifs
            const activeSchedules = schedules.filter(s => s.status === 'active');
            
            // Log pour debug
            console.log(`Recherche avance spéciale pour ${employeeId} en ${month}`);
            console.log(`${activeSchedules.length} échéancier(s) actif(s) trouvé(s)`);
            
            activeSchedules.forEach(schedule => {
                // NE PAS MODIFIER L'ÉCHÉANCIER - JUSTE LIRE
                if (schedule.schedule && schedule.schedule[month]) {
                    const monthAmount = schedule.schedule[month];
                    // Vérifier que ce mois n'a pas déjà été payé
                    if (!schedule.paidMonths || !schedule.paidMonths.includes(month)) {
                        total += monthAmount;
                        console.log(`Ajout de ${monthAmount} pour le mois ${month}`);
                    }
                }
            });
            
            console.log(`Total avance spéciale pour ${employeeId} en ${month}: ${total} Ar`);
            return total;
            
        } catch (error) {
            console.error('Erreur récupération avances spéciales:', error);
            return 0;
        }
    },
    
    // Obtenir les congés monnayés
    getLeavesMonetized: function(employeeId, year = null) {
        return this.list.filter(p => 
            p.paymentType === 'leave_monetized' &&
            (!employeeId || p.employeeId === employeeId) &&
            (!year || new Date(p.date).getFullYear() === year)
        );
    },
    
    // ===== NOUVELLES MÉTHODES POUR LES STATISTIQUES =====
    
    // Compter les congés monnayés
    getLeavesMonetizedCount: function() {
        return this.list.filter(p => p.paymentType === 'leave_monetized').length;
    },
    
    // Obtenir les statistiques par type de paiement
    getPaymentStats: function() {
        const stats = {
            total: this.list.length,
            byType: {},
            totalAmount: 0,
            byMonth: {}
        };
        
        this.list.forEach(p => {
            // Par type
            stats.byType[p.paymentType] = (stats.byType[p.paymentType] || 0) + 1;
            
            // Montant total
            stats.totalAmount += (p.amount || 0);
            
            // Par mois
            const month = p.month || p.date?.substring(0, 7);
            if (month) {
                if (!stats.byMonth[month]) {
                    stats.byMonth[month] = {
                        count: 0,
                        amount: 0
                    };
                }
                stats.byMonth[month].count++;
                stats.byMonth[month].amount += (p.amount || 0);
            }
        });
        
        return stats;
    },
    
    // Obtenir les statistiques d'un mois spécifique
    getMonthlyStats: function(month) {
        const monthPayments = this.list.filter(p => 
            (p.month === month) || (p.date && p.date.startsWith(month))
        );
        
        return {
            total: monthPayments.length,
            totalAmount: monthPayments.reduce((sum, p) => sum + (p.amount || 0), 0),
            salaries: monthPayments.filter(p => p.paymentType === 'salary').length,
            advances: monthPayments.filter(p => p.paymentType === 'advance').length,
            bonuses: monthPayments.filter(p => p.paymentType === 'bonus').length,
            leavesMonetized: monthPayments.filter(p => p.paymentType === 'leave_monetized').length
        };
    },
    
    // Obtenir le reste à payer pour un employé
    getRemainingToPay: function(employeeId, month) {
        const employee = Employees.getById(employeeId);
        if (!employee) return 0;
        
        // Utiliser la méthode de Salary pour calculer
        if (window.Salary && Salary.calculate) {
            const calc = Salary.calculate(employee, month);
            const totalPaid = this.getTotalPaidForMonth(employeeId, month);
            return Math.max(0, calc.netSalary - totalPaid);
        }
        
        return 0;
    },
    
    // ===== INTERFACE UTILISATEUR =====
    
    // Afficher le modal de paiement unifié
    showPaymentModal: function(presets = {}) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>💳 Nouveau paiement</h3>
                    <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
                </div>
                
                <form id="paymentForm">
                    <div class="form-group">
                        <label>Type de paiement *</label>
                        <select id="paymentType" class="form-control" required>
                            <option value="">Sélectionner un type</option>
                            ${Object.entries(this.PAYMENT_TYPES).map(([type, info]) => `
                                <option value="${type}" ${presets.paymentType === type ? 'selected' : ''}>
                                    ${info.label}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    
                    <div id="paymentFields" style="display: none;">
                        <!-- Champs dynamiques selon le type -->
                    </div>
                    
                    <div class="modal-footer" style="display: none;" id="formFooter">
                        <button type="submit" class="btn btn-primary">
                            Enregistrer
                        </button>
                        <button type="button" class="btn btn-secondary" 
                            onclick="this.closest('.modal').remove()">
                            Annuler
                        </button>
                    </div>
                </form>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Gérer le changement de type
        document.getElementById('paymentType').addEventListener('change', (e) => {
            const type = e.target.value;
            const typeInfo = this.PAYMENT_TYPES[type];
            
            if (typeInfo && typeInfo.useMultiple) {
                // Fermer le modal actuel
                modal.remove();
                // Ouvrir le modal multiple
                this.showMultiplePaymentModal(type);
            } else {
                // Afficher les champs normaux
                this.showPaymentFields(type, presets);
            }
        });
        
        // Si un type est présélectionné
        if (presets.paymentType) {
            const typeInfo = this.PAYMENT_TYPES[presets.paymentType];
            if (typeInfo && typeInfo.useMultiple) {
                modal.remove();
                this.showMultiplePaymentModal(presets.paymentType);
            } else {
                this.showPaymentFields(presets.paymentType, presets);
            }
        }
        
        // Gérer la soumission
        document.getElementById('paymentForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = this.collectPaymentData();
            if (!formData) return;
            
            if (await this.add(formData)) {
                modal.remove();
            }
        });
    },
    
    // NOUVELLE MÉTHODE: Modal pour paiements multiples avec sélection
    showMultiplePaymentModal: function(paymentType) {
        const typeInfo = this.PAYMENT_TYPES[paymentType];
        const currentMonth = Utils.getCurrentMonth();
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content modal-large">
                <div class="modal-header">
                    <h3>${typeInfo.label} - Paiement multiple</h3>
                    <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
                </div>
                
                <form id="multiplePaymentForm">
                    <div class="form-row">
                        <div class="form-group">
                            <label>Date *</label>
                            <input type="date" id="paymentDate" class="form-control" 
                                value="${Utils.getCurrentDate()}" 
                                max="${Utils.getCurrentDate()}" required>
                        </div>
                        
                        <div class="form-group">
                            <label>Mois *</label>
                            <input type="month" id="paymentMonth" class="form-control" 
                                value="${currentMonth}" 
                                max="${currentMonth}" required
                                onchange="Payments.updateEmployeesListDebounced('${paymentType}')">
                        </div>
                        
                        <div class="form-group">
                            <label>Mode de paiement *</label>
                            <select id="paymentMethod" class="form-control" required>
                                ${CONFIG.paymentMethods.map(m => `
                                    <option value="${m.value}">${m.label}</option>
                                `).join('')}
                            </select>
                        </div>
                    </div>
                    
                    <!-- NOUVEAU: Sélecteur d'employés -->
                    <div class="employee-selector">
                        <div class="selector-header">
                            <label>Employés à payer:</label>
                            <div class="selector-actions">
                                <button type="button" class="btn btn-sm btn-info" 
                                    onclick="Payments.selectAllEmployees('${paymentType}')">
                                    ✓ Tous
                                </button>
                                <button type="button" class="btn btn-sm btn-secondary" 
                                    onclick="Payments.unselectAllEmployees('${paymentType}')">
                                    ✗ Aucun
                                </button>
                            </div>
                        </div>
                        
                        <div class="employee-checkboxes">
                            ${Employees.list.map(emp => `
                                <label class="employee-checkbox">
                                    <input type="checkbox" 
                                        class="employee-selector-cb" 
                                        value="${emp._id || emp.id}"
                                        onchange="Payments.updateEmployeesListDebounced('${paymentType}')">
                                    <span>${emp.name}</span>
                                </label>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div class="employees-payment-list" id="selectedEmployeesList">
                        <div class="alert alert-info">
                            Sélectionnez les employés à payer ci-dessus
                        </div>
                    </div>
                    
                    <div class="modal-footer">
                        <button type="submit" class="btn btn-primary" disabled id="submitButton">
                            ✓ Enregistrer tous les paiements
                        </button>
                        <button type="button" class="btn btn-secondary" 
                            onclick="this.closest('.modal').remove()">
                            ✗ Annuler
                        </button>
                    </div>
                </form>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Ajouter les styles pour le sélecteur
        if (!document.getElementById('employee-selector-styles')) {
            const style = document.createElement('style');
            style.id = 'employee-selector-styles';
            style.innerHTML = `
                .employee-selector {
                    background: #f8f9fa;
                    padding: 15px;
                    border-radius: 5px;
                    margin: 15px 0;
                }
                
                .selector-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 10px;
                }
                
                .selector-actions {
                    display: flex;
                    gap: 10px;
                }
                
                .employee-checkboxes {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                    gap: 10px;
                    max-height: 200px;
                    overflow-y: auto;
                    padding: 10px;
                    background: white;
                    border-radius: 3px;
                }
                
                .employee-checkbox {
                    display: flex;
                    align-items: center;
                    cursor: pointer;
                }
                
                .employee-checkbox input {
                    margin-right: 8px;
                }
                
                .employee-payment-cards {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                    gap: 15px;
                    max-height: 400px;
                    overflow-y: auto;
                    padding: 10px;
                }
                
                .employee-payment-card {
                    background: #f8f9fa;
                    padding: 15px;
                    border-radius: 5px;
                    border: 1px solid #dee2e6;
                }
                
                .employee-payment-card .employee-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 10px;
                }
                
                .employee-payment-card h5 {
                    margin: 0;
                    font-size: 16px;
                }
                
                .employee-info {
                    margin-bottom: 10px;
                    font-size: 14px;
                }
                
                .info-row {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 5px;
                }
                
                .info-row.warning {
                    color: #ff6b6b;
                    font-weight: bold;
                }
                
                .info-row.success {
                    color: #51cf66;
                    font-weight: bold;
                }
                
                .payment-input {
                    position: relative;
                }
                
                .payment-input input {
                    padding-right: 40px;
                }
                
                .payment-input .currency {
                    position: absolute;
                    right: 10px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: #6c757d;
                }
                
                .payment-summary {
                    background: #e9ecef;
                    padding: 15px;
                    border-radius: 5px;
                    margin-top: 15px;
                }
                
                .summary-row {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 5px;
                    font-weight: bold;
                }
                
                /* NOUVEAU: Style pour l'indicateur de chargement */
                .updating-indicator {
                    display: none;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                    color: #6c757d;
                }
                
                .updating-indicator.show {
                    display: flex;
                }
                
                .updating-indicator::before {
                    content: '';
                    display: inline-block;
                    width: 20px;
                    height: 20px;
                    margin-right: 10px;
                    border: 3px solid #f3f3f3;
                    border-top: 3px solid #007bff;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
                
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }
        
        // Gérer la soumission
        document.getElementById('multiplePaymentForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const paymentsData = this.collectMultiplePaymentData(paymentType);
            if (!paymentsData || paymentsData.length === 0) {
                notify.warning('Aucun montant saisi');
                return;
            }
            
            if (await this.addMultiple(paymentsData)) {
                modal.remove();
            }
        });
    },
    
    // NOUVELLE MÉTHODE: Version debounced de updateEmployeesList
    updateEmployeesListDebounced: function(paymentType) {
        // Annuler le timer précédent s'il existe
        if (this.updateTimer) {
            clearTimeout(this.updateTimer);
        }
        
        // Afficher un indicateur de chargement en attente
        const container = document.getElementById('selectedEmployeesList');
        const selectedCount = document.querySelectorAll('.employee-selector-cb:checked').length;
        
        if (selectedCount > 0) {
            container.innerHTML = `
                <div class="updating-indicator show">
                    Mise à jour en cours...
                </div>
            `;
        }
        
        // Créer un nouveau timer
        this.updateTimer = setTimeout(() => {
            this.updateEmployeesList(paymentType);
        }, 1500); // Attendre 1.5 secondes après le dernier changement
    },
    
    // Sélectionner tous les employés
    selectAllEmployees: function(paymentType) {
        document.querySelectorAll('.employee-selector-cb').forEach(cb => {
            cb.checked = true;
        });
        // Utiliser la version debounced
        this.updateEmployeesListDebounced(paymentType);
    },
    
    // Désélectionner tous les employés
    unselectAllEmployees: function(paymentType) {
        document.querySelectorAll('.employee-selector-cb').forEach(cb => {
            cb.checked = false;
        });
        // Utiliser la version debounced
        this.updateEmployeesListDebounced(paymentType);
    },
    
    // Mettre à jour la liste des employés sélectionnés
    updateEmployeesList: async function(paymentType) {
        // Annuler le timer s'il existe encore (au cas où)
        if (this.updateTimer) {
            clearTimeout(this.updateTimer);
            this.updateTimer = null;
        }
        
        const selectedIds = Array.from(document.querySelectorAll('.employee-selector-cb:checked'))
            .map(cb => cb.value);
        
        const container = document.getElementById('selectedEmployeesList');
        const submitButton = document.getElementById('submitButton');
        
        if (selectedIds.length === 0) {
            container.innerHTML = '<div class="alert alert-info">Sélectionnez les employés à payer ci-dessus</div>';
            submitButton.disabled = true;
            return;
        }
        
        submitButton.disabled = false;
        const month = document.getElementById('paymentMonth').value;
        
        // Afficher seulement les employés sélectionnés
        let html = '<div class="employee-payment-cards">';
        
        for (const empId of selectedIds) {
            const employee = Employees.getById(empId);
            if (!employee) continue;
            
            // Calculer les informations - UTILISER AWAIT
            const normalAdvances = this.getMonthlyAdvances(empId, month);
            const specialAdvance = await this.getSpecialAdvanceMonthly(empId, month);
            const totalAdvances = normalAdvances + specialAdvance;
            
            let maxAllowed = 0;
            let additionalInfo = '';
            
            switch (paymentType) {
                case 'advance':
                    maxAllowed = Math.max(0, employee.salary - totalAdvances);
                    additionalInfo = `
                        <div class="info-row">
                            <span>Salaire:</span>
                            <span>${Utils.formatMoney(employee.salary)}</span>
                        </div>
                        ${normalAdvances > 0 ? `
                        <div class="info-row">
                            <span>Avances normales:</span>
                            <span>${Utils.formatMoney(normalAdvances)}</span>
                        </div>
                        ` : ''}
                        ${specialAdvance > 0 ? `
                        <div class="info-row">
                            <span>Avance spéciale:</span>
                            <span>${Utils.formatMoney(specialAdvance)}</span>
                        </div>
                        ` : ''}
                        <div class="info-row warning">
                            <span>⚠️ Maximum autorisé:</span>
                            <span>${Utils.formatMoney(maxAllowed)}</span>
                        </div>
                    `;
                    break;
                    
                case 'salary':
                    // Calculer le net à payer correctement - UTILISER CALCULATEASYNC
                    if (window.Salary && Salary.calculateAsync) {
                        const calc = await Salary.calculateAsync(employee, month);
                        const alreadyPaid = this.getTotalPaidForMonth(empId, month);
                        const netToPay = Math.max(0, calc.netSalary - alreadyPaid);
                        
                        additionalInfo = `
                            <div class="info-row">
                                <span>Salaire net:</span>
                                <span>${Utils.formatMoney(calc.netSalary)}</span>
                            </div>
                            ${alreadyPaid > 0 ? `
                            <div class="info-row">
                                <span>Déjà payé:</span>
                                <span>${Utils.formatMoney(alreadyPaid)}</span>
                            </div>
                            ` : ''}
                            <div class="info-row success">
                                <span>Net à payer:</span>
                                <span>${Utils.formatMoney(netToPay)}</span>
                            </div>
                        `;
                    } else {
                        const netToPay = this.getRemainingToPay(empId, month);
                        const alreadyPaid = this.getTotalPaidForMonth(empId, month);
                        additionalInfo = `
                            <div class="info-row">
                                <span>Déjà payé:</span>
                                <span>${Utils.formatMoney(alreadyPaid)}</span>
                            </div>
                            <div class="info-row success">
                                <span>Net à payer:</span>
                                <span>${Utils.formatMoney(netToPay)}</span>
                            </div>
                        `;
                    }
                    break;
                    
                case 'bonus':
                    additionalInfo = `
                        <div class="info-row">
                            <span>Salaire de base:</span>
                            <span>${Utils.formatMoney(employee.salary)}</span>
                        </div>
                    `;
                    break;
            }
            
            html += `
                <div class="employee-payment-card">
                    <div class="employee-header">
                        <h5>${employee.name}</h5>
                        <span class="badge">${CONFIG.positions.find(p => p.value === employee.position)?.label}</span>
                    </div>
                    
                    <div class="employee-info">
                        ${additionalInfo}
                    </div>
                    
                    <div class="payment-input">
                        <label>Montant:</label>
                        <input type="number" 
                            class="form-control payment-amount" 
                            data-employee-id="${empId}"
                            data-max="${maxAllowed}"
                            placeholder="0"
                            min="0"
                            ${paymentType === 'advance' ? `max="${maxAllowed}"` : ''}>
                        <span class="currency">Ar</span>
                    </div>
                </div>
            `;
        }
        
        html += '</div>';
        
        // Ajouter un résumé
        html += `
            <div class="payment-summary">
                <div class="summary-row">
                    <span>Total à payer:</span>
                    <span id="totalAmount">0 Ar</span>
                </div>
                <div class="summary-row">
                    <span>Nombre de paiements:</span>
                    <span id="paymentCount">0</span>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
        
        // Ajouter l'événement de calcul après le rendu
        setTimeout(() => {
            this.bindMultiplePaymentEvents(paymentType);
        }, 100);
    },
    
    // NOUVELLE MÉTHODE: Lier les événements pour le paiement multiple
    bindMultiplePaymentEvents: function(paymentType) {
        const inputs = document.querySelectorAll('.payment-amount');
        
        inputs.forEach(input => {
            input.addEventListener('input', (e) => {
                // Validation pour les avances
                if (paymentType === 'advance') {
                    const max = parseFloat(input.dataset.max);
                    const value = parseFloat(input.value) || 0;
                    
                    if (value > max) {
                        input.value = max;
                        notify.warning(`Maximum dépassé ! Limité à ${Utils.formatMoney(max)}`);
                    }
                }
                
                // Mettre à jour le résumé
                this.updatePaymentSummary();
            });
        });
    },
    
    // NOUVELLE MÉTHODE: Mettre à jour le résumé des paiements
    updatePaymentSummary: function() {
        const inputs = document.querySelectorAll('.payment-amount');
        let total = 0;
        let count = 0;
        
        inputs.forEach(input => {
            const value = parseFloat(input.value) || 0;
            if (value > 0) {
                total += value;
                count++;
            }
        });
        
        document.getElementById('totalAmount').textContent = Utils.formatMoney(total);
        document.getElementById('paymentCount').textContent = count;
    },
    
    // NOUVELLE MÉTHODE: Collecter les données de paiement multiple
    collectMultiplePaymentData: function(paymentType) {
        const date = document.getElementById('paymentDate').value;
        const month = document.getElementById('paymentMonth').value;
        const method = document.getElementById('paymentMethod').value;
        
        const payments = [];
        const inputs = document.querySelectorAll('.payment-amount');
        
        inputs.forEach(input => {
            const amount = parseFloat(input.value) || 0;
            if (amount > 0) {
                payments.push({
                    paymentType: paymentType,
                    employeeId: input.dataset.employeeId,
                    amount: amount,
                    date: date,
                    month: month,
                    method: method
                });
            }
        });
        
        return payments;
    },
    
    // Afficher les champs selon le type de paiement (pour formulaire simple)
    showPaymentFields: function(type, presets = {}) {
        const fieldsDiv = document.getElementById('paymentFields');
        const footerDiv = document.getElementById('formFooter');
        
        if (!type) {
            fieldsDiv.style.display = 'none';
            footerDiv.style.display = 'none';
            return;
        }
        
        let html = '';
        
        // Champs communs
        html += `
            <div class="form-group">
                <label>Employé *</label>
                <select id="employeeId" class="form-control" required>
                    <option value="">Sélectionner un employé</option>
                    ${Employees.list.map(emp => `
                        <option value="${emp._id || emp.id}" ${presets.employeeId === (emp._id || emp.id) ? 'selected' : ''}>
                            ${emp.name} - ${Utils.formatMoney(emp.salary)}
                        </option>
                    `).join('')}
                </select>
            </div>
        `;
        
        // Champs spécifiques selon le type
        switch (type) {
            case 'special_advance':
                html += `
                    <div id="specialAdvanceWarning" class="alert alert-warning" style="display: none;"></div>
                    <div class="form-group">
                        <label>Montant total du prêt (Ar) *</label>
                        <input type="number" id="amount" class="form-control" min="1" required>
                    </div>
                    <div class="form-group">
                        <label>Nombre de mois *</label>
                        <input type="number" id="months" class="form-control" 
                            min="1" max="24" value="6" required>
                    </div>
                    <div class="form-group">
                        <label>Premier mois de remboursement *</label>
                        <input type="month" id="startMonth" class="form-control" 
                            value="${Utils.getCurrentMonth()}" required>
                    </div>
                    <div id="schedulePreview">
                        <h6>Échéancier personnalisable :</h6>
                        <div id="scheduleTable"></div>
                        <div class="alert alert-info" style="margin-top: 15px;">
                            <strong>Reste à répartir : <span id="remainingAmount">0 Ar</span></strong>
                        </div>
                    </div>
                `;
                break;
                
            case 'leave_monetized':
                html += `
                    <div id="leaveBalanceInfo" class="alert alert-info" style="display: none;"></div>
                    <div class="form-group">
                        <label>Nombre de jours à monnayer *</label>
                        <input type="number" id="days" class="form-control" 
                            min="0.5" step="0.5" required>
                    </div>
                    <div id="monetizeCalc" class="alert alert-success" style="display: none;"></div>
                `;
                break;
                
            case 'other':
                html += `
                    <div class="form-group">
                        <label>Montant (Ar) *</label>
                        <input type="number" id="amount" class="form-control" min="1" required>
                    </div>
                    <div class="form-group">
                        <label>Description *</label>
                        <input type="text" id="description" class="form-control" required>
                    </div>
                `;
                break;
        }
        
        // Champs communs (suite)
        html += `
            <div class="form-group">
                <label>Date *</label>
                <input type="date" id="date" class="form-control" 
                    value="${presets.date || Utils.getCurrentDate()}" 
                    max="${Utils.getCurrentDate()}" required>
            </div>
            <div class="form-group">
                <label>Mode de paiement *</label>
                <select id="method" class="form-control" required>
                    ${CONFIG.paymentMethods.map(m => `
                        <option value="${m.value}">${m.label}</option>
                    `).join('')}
                </select>
            </div>
        `;
        
        fieldsDiv.innerHTML = html;
        fieldsDiv.style.display = 'block';
        footerDiv.style.display = 'flex';
        
        // Ajouter les événements dynamiques
        this.bindFieldEvents(type);
    },
    
    // Lier les événements aux champs
    bindFieldEvents: function(type) {
        const employeeSelect = document.getElementById('employeeId');
        
        switch (type) {
            case 'special_advance':
                // Variable pour stocker l'échéancier personnalisé
                window.customSchedule = {};
                
                // Générer l'échéancier flexible
                const generateFlexibleSchedule = async () => {
                    const amount = parseFloat(document.getElementById('amount').value) || 0;
                    const months = parseInt(document.getElementById('months').value) || 1;
                    const startMonth = document.getElementById('startMonth').value;
                    const empId = employeeSelect.value;
                    
                    if (!amount || !startMonth || !empId) return;
                    
                    const employee = Employees.getById(empId);
                    const scheduleDiv = document.getElementById('scheduleTable');
                    
                    let html = `
                        <table class="table table-sm">
                            <thead>
                                <tr>
                                    <th>Mois</th>
                                    <th>Montant</th>
                                    <th>Max autorisé</th>
                                </tr>
                            </thead>
                            <tbody>
                    `;
                    
                    window.customSchedule = {};
                    let remaining = amount;
                    
                    for (let i = 0; i < months; i++) {
                        const date = new Date(startMonth);
                        date.setMonth(date.getMonth() + i);
                        const monthStr = date.toISOString().slice(0, 7);
                        
                        // Calculer le max pour ce mois - UTILISER LA VERSION ASYNC
                        const normalAdvances = this.getMonthlyAdvances(empId, monthStr);
                        const existingSpecial = await this.getSpecialAdvanceMonthly(empId, monthStr);
                        const maxForMonth = Math.max(0, employee.salary - normalAdvances - existingSpecial);
                        
                        // Montant suggéré
                        const suggested = Math.min(
                            Math.round(amount / months),
                            maxForMonth,
                            remaining
                        );
                        
                        window.customSchedule[monthStr] = suggested;
                        remaining -= suggested;
                        
                        html += `
                            <tr>
                                <td>${Utils.formatMonth(monthStr)}</td>
                                <td>
                                    <input type="number" 
                                        class="form-control form-control-sm schedule-input" 
                                        data-month="${monthStr}"
                                        value="${suggested}"
                                        min="0"
                                        max="${maxForMonth}"
                                        onchange="Payments.updateScheduleAmount('${monthStr}', this.value)">
                                </td>
                                <td class="text-muted">${Utils.formatMoney(maxForMonth)}</td>
                            </tr>
                        `;
                    }
                    
                    html += `
                            </tbody>
                        </table>
                    `;
                    
                    scheduleDiv.innerHTML = html;
                    this.updateRemainingAmount();
                    
                    // Afficher un avertissement si nécessaire
                    const warningDiv = document.getElementById('specialAdvanceWarning');
                    if (remaining > 0) {
                        warningDiv.innerHTML = `
                            ⚠️ Attention : Le montant total ne peut pas être réparti entièrement 
                            à cause des limites mensuelles (salaire - avances existantes).
                        `;
                        warningDiv.style.display = 'block';
                    } else {
                        warningDiv.style.display = 'none';
                    }
                };
                
                employeeSelect.addEventListener('change', generateFlexibleSchedule);
                document.getElementById('amount').addEventListener('input', generateFlexibleSchedule);
                document.getElementById('months').addEventListener('input', generateFlexibleSchedule);
                document.getElementById('startMonth').addEventListener('change', generateFlexibleSchedule);
                break;
                
            case 'leave_monetized':
                // Calculer le montant et afficher le solde
                const updateMonetizeInfo = () => {
                    const empId = employeeSelect.value;
                    if (!empId) return;
                    
                    const employee = Employees.getById(empId);
                    const infoDiv = document.getElementById('leaveBalanceInfo');
                    
                    // Utiliser Leaves.getBalance si disponible
                    if (window.Leaves && Leaves.getBalance) {
                        const balance = Leaves.getBalance(empId);
                        infoDiv.innerHTML = `
                            <strong>${employee.name}</strong><br>
                            Salaire journalier: ${Utils.formatMoney(employee.salary / CONFIG.salary.workDaysPerMonth)}<br>
                            Solde de congés: ${balance.available.toFixed(1)} jours disponibles
                        `;
                        document.getElementById('days').max = balance.available;
                    } else {
                        infoDiv.innerHTML = `
                            <strong>${employee.name}</strong><br>
                            Salaire journalier: ${Utils.formatMoney(employee.salary / CONFIG.salary.workDaysPerMonth)}
                        `;
                    }
                    
                    infoDiv.style.display = 'block';
                };
                
                const calculateAmount = () => {
                    const empId = employeeSelect.value;
                    const days = parseFloat(document.getElementById('days').value) || 0;
                    
                    if (!empId || !days) {
                        document.getElementById('monetizeCalc').style.display = 'none';
                        return;
                    }
                    
                    const employee = Employees.getById(empId);
                    const dailySalary = employee.salary / CONFIG.salary.workDaysPerMonth;
                    const amount = Math.round(dailySalary * days);
                    
                    const calcDiv = document.getElementById('monetizeCalc');
                    calcDiv.innerHTML = `
                        Montant à payer: <strong>${Utils.formatMoney(amount)}</strong><br>
                        (${days} jours × ${Utils.formatMoney(dailySalary)})
                    `;
                    calcDiv.style.display = 'block';
                };
                
                employeeSelect.addEventListener('change', () => {
                    updateMonetizeInfo();
                    calculateAmount();
                });
                document.getElementById('days').addEventListener('input', calculateAmount);
                break;
        }
    },
    
    // Mettre à jour un montant dans l'échéancier
    updateScheduleAmount: function(month, value) {
        window.customSchedule[month] = parseFloat(value) || 0;
        this.updateRemainingAmount();
    },
    
    // Calculer le montant restant à répartir
    updateRemainingAmount: function() {
        const totalAmount = parseFloat(document.getElementById('amount').value) || 0;
        const totalScheduled = Object.values(window.customSchedule || {}).reduce((sum, val) => sum + val, 0);
        const remaining = totalAmount - totalScheduled;
        
        const remainingSpan = document.getElementById('remainingAmount');
        if (remainingSpan) {
            remainingSpan.textContent = Utils.formatMoney(remaining);
            remainingSpan.style.color = remaining === 0 ? 'green' : 'red';
        }
    },
    
    // Collecter les données du formulaire
    collectPaymentData: function() {
        const type = document.getElementById('paymentType').value;
        const employeeId = document.getElementById('employeeId').value;
        const date = document.getElementById('date').value;
        const method = document.getElementById('method').value;
        
        const data = {
            paymentType: type,
            employeeId: employeeId,
            date: date,
            method: method
        };
        
        // Données spécifiques selon le type
        switch (type) {
            case 'special_advance':
                const amount = parseFloat(document.getElementById('amount').value);
                
                // Utiliser l'échéancier personnalisé
                const schedule = window.customSchedule || {};
                const totalScheduled = Object.values(schedule).reduce((sum, val) => sum + val, 0);
                
                // Vérifier que l'échéancier correspond au montant
                if (Math.abs(amount - totalScheduled) > 1) {
                    notify.error(`L'échéancier (${Utils.formatMoney(totalScheduled)}) ne correspond pas au montant total (${Utils.formatMoney(amount)})`);
                    return null;
                }
                
                data.amount = amount;
                data.schedule = schedule;
                data.description = `Prêt de ${Utils.formatMoney(amount)} sur ${Object.keys(schedule).length} mois`;
                break;
                
            case 'leave_monetized':
                const empId = data.employeeId;
                const days = parseFloat(document.getElementById('days').value);
                const employee = Employees.getById(empId);
                const dailySalary = employee.salary / CONFIG.salary.workDaysPerMonth;
                
                data.days = days;
                data.amount = Math.round(dailySalary * days);
                data.description = `Monnayage de ${days} jours de congés`;
                break;
                
            case 'other':
                data.amount = parseFloat(document.getElementById('amount').value);
                data.description = document.getElementById('description').value;
                break;
        }
        
        return data;
    },
    
    // Afficher le tableau des paiements
    renderTable: function(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        // Utiliser les filtres de UI si disponibles
        let filteredPayments = [...this.list];
        
        if (window.UI && UI.activeFilters && UI.activeFilters.payments) {
            const filters = UI.activeFilters.payments;
            
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
        
        let html = `
            <div class="payments-container">
                <div class="payments-header">
                    <h4>📋 Historique des paiements</h4>
                    <button class="btn btn-primary" onclick="Payments.showPaymentModal()">
                        ➕ Nouveau paiement
                    </button>
                </div>
        `;
        
        if (filteredPayments.length === 0) {
            html += `
                <div class="alert alert-info">
                    Aucun paiement enregistré.
                </div>
            `;
        } else {
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
                    const typeInfo = this.PAYMENT_TYPES[payment.paymentType] || { label: payment.paymentType };
                    
                    let description = payment.description || '';
                    
                    html += `
                        <tr>
                            <td>${Utils.formatDate(payment.date)}</td>
                            <td>${employee ? employee.name : 'Employé supprimé'}</td>
                            <td>${typeInfo.label}</td>
                            <td><small>${description}</small></td>
                            <td>${CONFIG.paymentMethods.find(m => m.value === payment.method)?.label}</td>
                            <td class="text-primary font-weight-bold">
                                ${payment.amount > 0 ? Utils.formatMoney(payment.amount) : '-'}
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
        }
        
        html += '</div>';
        container.innerHTML = html;
    },
    
    // Afficher le modal d'édition
    showEditModal: function(paymentId) {
        const payment = this.list.find(p => p._id === paymentId);
        if (!payment) return;
        
        const typeInfo = this.PAYMENT_TYPES[payment.paymentType];
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content modal-sm">
                <div class="modal-header">
                    <h3>✏️ Modifier le paiement</h3>
                    <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
                </div>
                
                <form id="editPaymentForm">
                    <div class="form-group">
                        <label>Type</label>
                        <input type="text" class="form-control" value="${typeInfo.label}" disabled>
                    </div>
                    
                    <div class="form-group">
                        <label>Montant (Ar)</label>
                        <input type="number" id="editAmount" class="form-control" 
                            value="${payment.amount}" min="1" required>
                    </div>
                    
                    <div class="form-group">
                        <label>Date</label>
                        <input type="date" id="editDate" class="form-control" 
                            value="${payment.date}" max="${Utils.getCurrentDate()}" required>
                    </div>
                    
                    <div class="form-group">
                        <label>Mode de paiement</label>
                        <select id="editMethod" class="form-control" required>
                            ${CONFIG.paymentMethods.map(m => `
                                <option value="${m.value}" ${payment.method === m.value ? 'selected' : ''}>
                                    ${m.label}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    
                    <div class="modal-footer">
                        <button type="submit" class="btn btn-primary">
                            Enregistrer
                        </button>
                        <button type="button" class="btn btn-secondary" 
                            onclick="this.closest('.modal').remove()">
                            Annuler
                        </button>
                    </div>
                </form>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        document.getElementById('editPaymentForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const updates = {
                amount: parseFloat(document.getElementById('editAmount').value),
                date: document.getElementById('editDate').value,
                method: document.getElementById('editMethod').value
            };
            
            if (await this.update(paymentId, updates)) {
                modal.remove();
            }
        });
        
        document.getElementById('editAmount').focus();
        document.getElementById('editAmount').select();
    },
    
    // ===== NOUVELLES MÉTHODES POUR LE NETTOYAGE =====
    
    // Nettoyer les échéanciers orphelins
    cleanOrphanSchedules: async function() {
        try {
            console.log('🧹 Début du nettoyage des échéanciers orphelins...');
            
            // Récupérer tous les échéanciers
            const allSchedules = await Database.find({type: 'special_advance'});
            console.log(`${allSchedules.length} échéancier(s) trouvé(s)`);
            
            // Récupérer tous les paiements d'avances spéciales
            const specialPayments = this.list.filter(p => p.paymentType === 'special_advance');
            console.log(`${specialPayments.length} paiement(s) d'avance spéciale`);
            
            let cleaned = 0;
            
            for (const schedule of allSchedules) {
                // Vérifier si un paiement correspond à cet échéancier
                const hasPayment = specialPayments.some(p => 
                    p.employeeId === schedule.employeeId && 
                    p.amount === schedule.totalAmount
                );
                
                if (!hasPayment) {
                    console.log(`Échéancier orphelin trouvé pour ${schedule.employeeId}, montant: ${schedule.totalAmount}`);
                    
                    // Demander confirmation
                    const employee = Employees.getById(schedule.employeeId);
                    const employeeName = employee ? employee.name : 'Employé inconnu';
                    
                    const confirm = await Utils.confirm(
                        `Supprimer l'échéancier orphelin ?\n\n` +
                        `Employé: ${employeeName}\n` +
                        `Montant total: ${Utils.formatMoney(schedule.totalAmount)}\n` +
                        `Statut: ${schedule.status}`
                    );
                    
                    if (confirm) {
                        await Database.delete(schedule._id);
                        cleaned++;
                        console.log(`✅ Échéancier supprimé: ${schedule._id}`);
                    }
                }
            }
            
            if (cleaned > 0) {
                notify.success(`${cleaned} échéancier(s) orphelin(s) nettoyé(s)`);
                // Rafraîchir l'interface
                if (window.UI && UI.render) {
                    await UI.render();
                }
            } else {
                notify.info('Aucun échéancier orphelin trouvé');
            }
            
            return cleaned;
            
        } catch (error) {
            console.error('Erreur nettoyage échéanciers:', error);
            notify.error('Erreur lors du nettoyage');
            return 0;
        }
    },
    
    // Voir les détails des échéanciers d'un employé
    inspectEmployeeSchedules: async function(employeeId) {
        try {
            const employee = Employees.getById(employeeId);
            const schedules = await Database.getSpecialAdvanceSchedules(employeeId);
            const payments = this.list.filter(p => 
                p.employeeId === employeeId && 
                p.paymentType === 'special_advance'
            );
            
            console.log('=== INSPECTION AVANCES SPÉCIALES ===');
            console.log(`Employé: ${employee ? employee.name : employeeId}`);
            console.log(`${schedules.length} échéancier(s) trouvé(s)`);
            console.log(`${payments.length} paiement(s) trouvé(s)`);
            
            console.log('\n--- ÉCHÉANCIERS ---');
            schedules.forEach(s => {
                console.log(`ID: ${s._id}`);
                console.log(`Montant total: ${Utils.formatMoney(s.totalAmount)}`);
                console.log(`Statut: ${s.status}`);
                console.log(`Échéances:`, s.schedule);
                console.log('---');
            });
            
            console.log('\n--- PAIEMENTS ---');
            payments.forEach(p => {
                console.log(`ID: ${p._id}`);
                console.log(`Montant: ${Utils.formatMoney(p.amount)}`);
                console.log(`Date: ${p.date}`);
                console.log(`Description: ${p.description}`);
                console.log('---');
            });
            
            return { schedules, payments };
            
        } catch (error) {
            console.error('Erreur inspection:', error);
            return null;
        }
    },
    
    // Forcer la suppression d'un échéancier
    forceDeleteSchedule: async function(employeeId) {
        try {
            const scheduleId = `special_advance_${employeeId}`;
            const confirm = await Utils.confirm(
                `⚠️ ATTENTION !\n\n` +
                `Forcer la suppression de l'échéancier pour cet employé ?\n` +
                `Cette action est irréversible.`
            );
            
            if (!confirm) return false;
            
            await Database.delete(scheduleId);
            notify.success('Échéancier supprimé de force');
            
            // Rafraîchir
            if (window.UI && UI.render) {
                await UI.render();
            }
            
            return true;
            
        } catch (error) {
            console.error('Erreur suppression forcée:', error);
            notify.error('Erreur lors de la suppression');
            return false;
        }
    },
    
    // Méthodes raccourcis pour les modals spécifiques
    showAdvanceModal: function(employeeId = null) {
        this.showPaymentModal({
            paymentType: 'advance',
            employeeId: employeeId
        });
    },
    
    showSpecialAdvanceModal: function(employeeId = null) {
        this.showPaymentModal({
            paymentType: 'special_advance',
            employeeId: employeeId
        });
    },
    
    showSalaryModal: function(employeeId = null, month = null) {
        // Pour les salaires, on veut le formulaire multiple
        this.showMultiplePaymentModal('salary');
        
        // Si un employé spécifique est demandé, on peut pré-cocher et pré-remplir son montant
        if (employeeId && month) {
            setTimeout(() => {
                // Cocher uniquement cet employé
                document.querySelectorAll('.employee-selector-cb').forEach(cb => {
                    cb.checked = cb.value === employeeId;
                });
                
                // Mettre à jour la liste
                this.updateEmployeesList('salary').then(() => {
                    // Pré-remplir le montant net à payer
                    const netToPay = this.getRemainingToPay(employeeId, month);
                    const input = document.querySelector(`input[data-employee-id="${employeeId}"]`);
                    if (input) {
                        input.value = netToPay;
                        input.focus();
                        this.updatePaymentSummary();
                    }
                });
            }, 200);
        }
    }
};

// Rendre disponible globalement
window.Payments = Payments;