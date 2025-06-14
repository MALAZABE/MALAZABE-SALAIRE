// Gestion des congés - VERSION 4.0 - Règle des 15 jours + couleur jaune
const Leaves = {
    // Liste des congés
    list: [],
    
    // Charger tous les congés
    load: async function() {
        try {
            this.list = await Database.getLeaves();
            console.log(`${this.list.length} congés chargés`);
            return this.list;
        } catch (error) {
            console.error('Erreur chargement congés:', error);
            notify.error('Erreur lors du chargement des congés');
            return [];
        }
    },
    
    // Calculer le solde de congés d'un employé
    getBalance: function(employeeId, year = null) {
        const targetYear = year || new Date().getFullYear();
        const employee = Employees.getById(employeeId);
        
        if (!employee) return { acquired: 0, used: 0, available: 0 };
        
        // NOUVEAU: Calculer les mois éligibles (présent >= 15 jours)
        const startDate = new Date(employee.startDate);
        const startYear = startDate.getFullYear();
        const startMonth = startDate.getMonth();
        
        let monthsEligible = 0;
        let monthDetails = [];
        
        // Parcourir chaque mois depuis l'embauche
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth();
        
        for (let year = startYear; year <= targetYear; year++) {
            const monthStart = (year === startYear) ? startMonth : 0;
            const monthEnd = (year === targetYear) ? 
                ((targetYear === currentYear) ? currentMonth : 11) : 11;
            
            for (let month = monthStart; month <= monthEnd; month++) {
                const monthStr = `${year}-${(month + 1).toString().padStart(2, '0')}`;
                
                // Obtenir le résumé de présence pour ce mois
                if (window.Attendance && Attendance.getSummary) {
                    const summary = Attendance.getSummary(employeeId, monthStr);
                    
                    if (summary) {
                        // Calculer les jours de présence effective
                        // P = Présent, CP = Congé payé, R = Retard (compte comme présent)
                        // DM = Demi-journée (compte comme 0.5 jour)
                        const effectiveDays = summary.P + summary.CP + summary.R + (summary.DM * 0.5);
                        
                        // RÈGLE DES 15 JOURS
                        if (effectiveDays >= 15) {
                            monthsEligible++;
                            monthDetails.push({
                                month: monthStr,
                                days: effectiveDays,
                                eligible: true
                            });
                        } else {
                            monthDetails.push({
                                month: monthStr,
                                days: effectiveDays,
                                eligible: false
                            });
                        }
                    } else {
                        // Si pas de données de pointage, considérer comme éligible
                        // (pour compatibilité avec les anciens employés)
                        monthsEligible++;
                    }
                }
            }
        }
        
        // Si Attendance n'est pas disponible, utiliser l'ancien calcul
        if (!window.Attendance || monthsEligible === 0) {
            let monthsWorked = 0;
            if (targetYear > startYear) {
                monthsWorked = 12;
            } else if (targetYear === startYear) {
                const endMonth = (targetYear === currentYear) ? currentMonth : 11;
                monthsWorked = endMonth - startMonth + 1;
            }
            monthsEligible = monthsWorked;
        }
        
        // Calculer les jours acquis (2.5 jours par mois éligible)
        const acquired = Math.min(monthsEligible * CONFIG.salary.leaveAccrualRate, 30);
        
        // Calculer les jours utilisés (pris seulement, pas les monnayés)
        const takenLeaves = this.list.filter(leave => 
            leave.employeeId === employeeId && 
            new Date(leave.startDate).getFullYear() === targetYear &&
            leave.status !== 'cancelled'
        );
        
        const takenDays = takenLeaves.reduce((total, leave) => 
            total + (leave.days || 0), 0
        );
        
        // Les congés monnayés viennent de Payments
        const monetizedDays = Payments.list
            .filter(p => 
                p.employeeId === employeeId && 
                new Date(p.date).getFullYear() === targetYear &&
                p.paymentType === 'leave_monetized'
            )
            .reduce((total, p) => total + (p.days || 0), 0);
        
        const totalUsed = takenDays + monetizedDays;
        
        return {
            acquired: acquired,
            taken: takenDays,
            monetized: monetizedDays,
            used: totalUsed,
            available: acquired - totalUsed,
            monthsWorked: monthsEligible,
            monthDetails: monthDetails // Détails pour debug
        };
    },
    
    // Ajouter un congé
    add: async function(leaveData) {
        try {
            // Validation
            if (!this.validate(leaveData)) {
                return false;
            }
            
            // Vérifier le solde
            const balance = this.getBalance(leaveData.employeeId);
            if (balance.available < leaveData.days) {
                const confirm = await Utils.confirm(
                    `Solde insuffisant (${balance.available.toFixed(1)} jours disponibles).\n` +
                    `Voulez-vous continuer quand même ?`
                );
                if (!confirm) return false;
            }
            
            // Préparer les données
            const leave = {
                ...leaveData,
                id: Utils.generateId(),
                createdAt: new Date().toISOString(),
                year: new Date(leaveData.startDate).getFullYear(),
                status: 'active'
            };
            
            console.log('Ajout congé:', leave.days, 'jours');
            
            // Sauvegarder
            const saved = await Database.saveLeave(leave);
            
            // Ajouter à la liste locale
            this.list.push(saved);
            
            // Marquer les jours dans le pointage
            await this.markLeaveDaysInAttendance(saved);
            
            notify.success('Congé enregistré avec succès');
            
            // Rafraîchir l'interface
            if (window.UI && UI.render) {
                await UI.render();
            }
            
            return saved;
            
        } catch (error) {
            console.error('Erreur ajout congé:', error);
            notify.error('Erreur lors de l\'enregistrement du congé');
            return false;
        }
    },
    
    // Modifier un congé
    update: async function(leaveId, updates) {
        try {
            const leave = this.list.find(l => l._id === leaveId);
            if (!leave) {
                notify.error('Congé introuvable');
                return false;
            }
            
            // Restaurer les anciens jours dans le pointage
            await this.restoreAttendanceStatuses(leave);
            
            // Fusionner les modifications
            const updated = { ...leave, ...updates };
            
            // Validation
            if (!this.validate(updated)) {
                // Re-marquer les anciens jours si validation échoue
                await this.markLeaveDaysInAttendance(leave);
                return false;
            }
            
            // Recalculer les jours si les dates ont changé
            if (updates.startDate || updates.endDate) {
                updated.days = Utils.getDaysBetween(
                    updated.startDate, 
                    updated.endDate
                );
            }
            
            // Sauvegarder
            const saved = await Database.saveLeave(updated);
            
            // Mettre à jour la liste locale
            const index = this.list.findIndex(l => l._id === saved._id);
            if (index !== -1) {
                this.list[index] = saved;
            }
            
            // Marquer les nouveaux jours dans le pointage
            await this.markLeaveDaysInAttendance(saved);
            
            notify.success('Congé modifié');
            
            // Rafraîchir
            if (window.UI && UI.render) {
                await UI.render();
            }
            
            return saved;
            
        } catch (error) {
            console.error('Erreur modification congé:', error);
            notify.error('Erreur lors de la modification');
            return false;
        }
    },
    
    // Supprimer un congé - CORRIGÉ
    delete: async function(id) {
        try {
            const leave = this.list.find(l => l._id === id);
            if (!leave) {
                notify.error('Congé introuvable');
                return false;
            }
            
            // Confirmer la suppression
            const confirm = await Utils.confirm(
                `Supprimer ce congé ?\n\n` +
                `${leave.days} jours du ${Utils.formatDate(leave.startDate)} au ${Utils.formatDate(leave.endDate)}`
            );
            
            if (!confirm) {
                return false;
            }
            
            // Restaurer les jours dans le pointage
            const restored = await this.restoreAttendanceStatuses(leave);
            console.log(`${restored} jours restaurés dans le pointage`);
            
            // CORRECTION: Utiliser Database.delete au lieu de Database.deleteLeave
            await Database.delete(id);
            
            // Retirer de la liste locale
            this.list = this.list.filter(l => l._id !== id);
            
            notify.success('Congé supprimé');
            
            // Rafraîchir l'interface
            if (window.UI && UI.render) {
                await UI.render();
            }
            
            return true;
            
        } catch (error) {
            console.error('Erreur suppression congé:', error);
            notify.error('Erreur lors de la suppression');
            return false;
        }
    },
    
    // Valider les données d'un congé
    validate: function(leave) {
        if (!leave.employeeId) {
            notify.error('Veuillez sélectionner un employé');
            return false;
        }
        
        if (!leave.startDate || !leave.endDate) {
            notify.error('Les dates de début et fin sont obligatoires');
            return false;
        }
        
        if (new Date(leave.startDate) > new Date(leave.endDate)) {
            notify.error('La date de fin doit être après la date de début');
            return false;
        }
        
        if (!leave.days || leave.days <= 0) {
            notify.error('Le nombre de jours doit être supérieur à 0');
            return false;
        }
        
        // Vérifier les chevauchements
        const overlapping = this.list.find(l => 
            l._id !== leave._id &&
            l.employeeId === leave.employeeId &&
            l.status === 'active' &&
            !(new Date(l.endDate) < new Date(leave.startDate) || 
              new Date(l.startDate) > new Date(leave.endDate))
        );
        
        if (overlapping) {
            notify.error('Ce congé chevauche avec un congé existant');
            return false;
        }
        
        return true;
    },
    
    // Marquer les jours de congé dans le pointage
    markLeaveDaysInAttendance: async function(leave) {
        try {
            const start = new Date(leave.startDate);
            const end = new Date(leave.endDate);
            
            console.log(`Marquage congé dans pointage: ${leave.startDate} au ${leave.endDate}`);
            
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                const dateStr = d.toISOString().slice(0, 10);
                await Attendance.setStatus(leave.employeeId, dateStr, 'CP', true);
            }
            
            console.log(`${leave.days} jours marqués comme CP`);
            
        } catch (error) {
            console.error('Erreur marquage pointage:', error);
            notify.warning('Erreur lors de la mise à jour du pointage');
        }
    },
    
    // Restaurer les jours dans le pointage - ALIAS pour compatibilité
    restoreAttendanceStatuses: async function(leave) {
        return await this.restoreLeaveDaysInAttendance(leave);
    },
    
    // Restaurer les jours dans le pointage
    restoreLeaveDaysInAttendance: async function(leave) {
        try {
            const start = new Date(leave.startDate);
            const end = new Date(leave.endDate);
            let count = 0;
            
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                const dateStr = d.toISOString().slice(0, 10);
                await Attendance.setStatus(leave.employeeId, dateStr, 'P', true);
                count++;
            }
            
            console.log(`${count} jours restaurés dans le pointage`);
            return count;
            
        } catch (error) {
            console.error('Erreur restauration pointage:', error);
            return 0;
        }
    },
    
    // Afficher le modal de prise de congé
    showTakeLeaveModal: function(employeeId = null) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>📅 Nouvelle demande de congé</h3>
                    <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
                </div>
                
                <form id="leaveForm">
                    <div class="form-group">
                        <label>Employé *</label>
                        <select id="leaveEmployeeId" class="form-control" required>
                            <option value="">Sélectionner un employé</option>
                            ${Employees.list.map(emp => {
                                const balance = this.getBalance(emp._id || emp.id);
                                return `
                                    <option value="${emp._id || emp.id}" 
                                        ${employeeId === (emp._id || emp.id) ? 'selected' : ''}
                                        ${balance.available <= 0 ? 'title="Solde insuffisant"' : ''}>
                                        ${emp.name} (${balance.available.toFixed(1)} jours disponibles)
                                    </option>
                                `;
                            }).join('')}
                        </select>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group col-md-6">
                            <label>Date de début *</label>
                            <input type="date" id="leaveStartDate" class="form-control" required>
                        </div>
                        <div class="form-group col-md-6">
                            <label>Date de fin *</label>
                            <input type="date" id="leaveEndDate" class="form-control" required>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label>Nombre de jours</label>
                        <input type="number" id="leaveDays" class="form-control" readonly>
                    </div>
                    
                    <div class="form-group">
                        <label>Motif / Commentaire</label>
                        <textarea id="leaveReason" class="form-control" rows="3"></textarea>
                    </div>
                    
                    <div id="leaveBalanceInfo" class="alert alert-info" style="display:none;">
                        <!-- Infos sur le solde -->
                    </div>
                    
                    <div class="modal-footer">
                        <button type="submit" class="btn btn-primary">Enregistrer</button>
                        <button type="button" class="btn btn-secondary" 
                            onclick="this.closest('.modal').remove()">Annuler</button>
                    </div>
                </form>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Mettre à jour les infos du solde
        const updateBalanceInfo = () => {
            const empId = document.getElementById('leaveEmployeeId').value;
            if (empId) {
                const balance = this.getBalance(empId);
                const infoDiv = document.getElementById('leaveBalanceInfo');
                infoDiv.innerHTML = `
                    <strong>Solde actuel:</strong> ${balance.available.toFixed(1)} jours disponibles<br>
                    <small>Acquis: ${balance.acquired.toFixed(1)} | Pris: ${balance.taken.toFixed(1)} | Monnayés: ${balance.monetized.toFixed(1)}</small>
                `;
                infoDiv.style.display = 'block';
            }
        };
        
        // Calculer le nombre de jours
        const calculateDays = () => {
            const startDate = document.getElementById('leaveStartDate').value;
            const endDate = document.getElementById('leaveEndDate').value;
            
            if (startDate && endDate) {
                const days = Utils.getDaysBetween(startDate, endDate);
                document.getElementById('leaveDays').value = days;
                
                // Afficher un message pour les weekends
                const start = new Date(startDate);
                const end = new Date(endDate);
                let weekendDays = 0;
                
                for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                    if (d.getDay() === 0 || d.getDay() === 6) {
                        weekendDays++;
                    }
                }
                
                if (weekendDays > 0) {
                    notify.info(`Note: ${weekendDays} jour(s) de weekend inclus`);
                }
            }
        };
        
        // Événements
        document.getElementById('leaveEmployeeId').addEventListener('change', updateBalanceInfo);
        document.getElementById('leaveStartDate').addEventListener('change', calculateDays);
        document.getElementById('leaveEndDate').addEventListener('change', calculateDays);
        
        // Soumettre le formulaire
        document.getElementById('leaveForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const leaveData = {
                employeeId: document.getElementById('leaveEmployeeId').value,
                startDate: document.getElementById('leaveStartDate').value,
                endDate: document.getElementById('leaveEndDate').value,
                days: parseInt(document.getElementById('leaveDays').value),
                reason: document.getElementById('leaveReason').value.trim()
            };
            
            if (await this.add(leaveData)) {
                modal.remove();
            }
        });
        
        // Focus initial
        if (employeeId) {
            updateBalanceInfo();
            document.getElementById('leaveStartDate').focus();
        } else {
            document.getElementById('leaveEmployeeId').focus();
        }
    },
    
    // Afficher le modal de monnayage (redirige vers Payments)
    showMonetizeModal: function(employeeId = null) {
        // Les congés monnayés restent dans Payments
        Payments.showPaymentModal({
            paymentType: 'leave_monetized',
            employeeId: employeeId
        });
    },
    
    // Afficher le modal alias (pour compatibilité)
    showLeaveModal: function(employeeId = null) {
        this.showTakeLeaveModal(employeeId);
    },
    
    // Afficher la section des congés
    renderSection: function(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const currentYear = new Date().getFullYear();
        
        let html = `
            <div class="leaves-container">
                <div class="leaves-header">
                    <h4>🏖️ Gestion des congés - ${currentYear}</h4>
                    <div>
                        <button class="btn btn-primary" onclick="Leaves.showTakeLeaveModal()">
                            📅 Nouveau congé
                        </button>
                        <button class="btn btn-success" onclick="Leaves.showMonetizeModal()">
                            💰 Monnayer des congés
                        </button>
                    </div>
                </div>
                
                <div class="leaves-info alert alert-info">
                    <strong>Règles des congés:</strong>
                    <ul class="mb-0">
                        <li><strong>NOUVEAU:</strong> Acquisition uniquement si présent ≥ 15 jours dans le mois</li>
                        <li>Acquisition: ${CONFIG.salary.leaveAccrualRate} jours par mois éligible (30 jours/an maximum)</li>
                        <li>Les congés pris sont marqués automatiquement dans le pointage</li>
                        <li>Modification dans le pointage: <strong>INTERDITE</strong> pour les jours de congé</li>
                        <li>Monnayage possible à tout moment du solde disponible</li>
                    </ul>
                </div>
                
                <h5>📊 Soldes des congés</h5>
                <div class="leaves-balances">
        `;
        
        // Afficher les soldes de chaque employé
        Employees.list.forEach(employee => {
            const balance = this.getBalance(employee._id || employee.id);
            // MODIFIÉ: Utiliser jaune au lieu de vert
            const balanceClass = balance.available < 0 ? 'danger' : 
                               balance.available > 20 ? 'warning' : 'warning';
            
            html += `
                <div class="employee-leave-card">
                    <div class="employee-info">
                        <strong>${employee.name}</strong>
                        <small>${CONFIG.positions.find(p => p.value === employee.position)?.label}</small>
                    </div>
                    <div class="leave-balance">
                        <div class="balance-details">
                            <span title="${balance.monthsWorked} mois éligibles">
                                Acquis: ${balance.acquired.toFixed(1)}
                            </span>
                            <span>Pris: ${balance.taken.toFixed(1)}</span>
                            <span>Monnayés: ${balance.monetized.toFixed(1)}</span>
                            <span class="text-${balanceClass}" style="${balanceClass === 'warning' ? 'color: #ffc107 !important;' : ''}">
                                <strong>Solde: ${balance.available.toFixed(1)} jours</strong>
                            </span>
                        </div>
                        <div class="leave-actions">
                            <button class="btn btn-sm btn-info" 
                                onclick="Leaves.showTakeLeaveModal('${employee._id || employee.id}')">
                                📅 Congé
                            </button>
                            <button class="btn btn-sm btn-success" 
                                onclick="Leaves.showMonetizeModal('${employee._id || employee.id}')"
                                ${balance.available <= 0 ? 'disabled' : ''}>
                                💰 Monnayer
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += `
                </div>
                
                <h5 class="mt-4">📅 Congés en cours</h5>
                <div class="current-leaves mb-4">
        `;
        
        // Afficher les congés en cours
        const today = new Date().toISOString().slice(0, 10);
        const currentLeaves = this.list.filter(leave => 
            leave.status === 'active' &&
            leave.startDate <= today &&
            leave.endDate >= today
        );
        
        if (currentLeaves.length > 0) {
            html += `<div class="alert alert-success">`;
            currentLeaves.forEach(leave => {
                const employee = Employees.getById(leave.employeeId);
                html += `
                    <div>
                        <strong>${employee ? employee.name : 'Employé inconnu'}</strong> 
                        est en congé jusqu'au ${Utils.formatDate(leave.endDate)}
                        ${leave.reason ? `(${leave.reason})` : ''}
                    </div>
                `;
            });
            html += `</div>`;
        } else {
            html += `<p class="text-muted">Aucun employé en congé actuellement</p>`;
        }
        
        html += `
                </div>
                
                <h5>📋 Historique des congés</h5>
                <div class="table-responsive">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Employé</th>
                                <th>Début</th>
                                <th>Fin</th>
                                <th>Jours</th>
                                <th>Motif</th>
                                <th>Statut</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        
        // Afficher l'historique
        const sortedLeaves = [...this.list].sort((a, b) => 
            new Date(b.startDate) - new Date(a.startDate)
        );
        
        if (sortedLeaves.length === 0) {
            html += `<tr><td colspan="7" class="text-center">Aucun congé enregistré</td></tr>`;
        } else {
            sortedLeaves.forEach(leave => {
                const employee = Employees.getById(leave.employeeId);
                const isPast = new Date(leave.endDate) < new Date(today);
                const isCurrent = leave.startDate <= today && leave.endDate >= today;
                
                html += `
                    <tr>
                        <td>${employee ? employee.name : 'Employé supprimé'}</td>
                        <td>${Utils.formatDate(leave.startDate)}</td>
                        <td>${Utils.formatDate(leave.endDate)}</td>
                        <td>${leave.days} jour${leave.days > 1 ? 's' : ''}</td>
                        <td>${leave.reason || '-'}</td>
                        <td>
                            ${isCurrent ? 
                                '<span class="badge badge-success">En cours</span>' :
                                isPast ? 
                                    '<span class="badge badge-secondary">Terminé</span>' :
                                    '<span class="badge badge-info">À venir</span>'
                            }
                        </td>
                        <td>
                            ${!isPast ? `
                                <button class="btn btn-sm btn-warning" 
                                    onclick="Leaves.showEditModal('${leave._id}')">
                                    ✏️
                                </button>
                            ` : ''}
                            <button class="btn btn-sm btn-danger" 
                                onclick="Leaves.delete('${leave._id}')">
                                🗑️
                            </button>
                        </td>
                    </tr>
                `;
            });
        }
        
        html += `
                        </tbody>
                    </table>
                </div>
                
                <!-- NOUVEAU: Info sur la règle des 15 jours -->
                <div class="alert alert-warning mt-3">
                    <strong>ℹ️ Rappel:</strong> Les congés ne s'accumulent que pour les mois où l'employé 
                    a été présent au moins 15 jours (présences + retards + demi-journées + congés payés).
                </div>
            </div>
        `;
        
        container.innerHTML = html;
    },
    
    // Modal d'édition
    showEditModal: function(leaveId) {
        const leave = this.list.find(l => l._id === leaveId);
        if (!leave) return;
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>✏️ Modifier le congé</h3>
                    <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
                </div>
                
                <form id="editLeaveForm">
                    <div class="form-row">
                        <div class="form-group col-md-6">
                            <label>Date de début *</label>
                            <input type="date" id="editStartDate" class="form-control" 
                                value="${leave.startDate}" required>
                        </div>
                        <div class="form-group col-md-6">
                            <label>Date de fin *</label>
                            <input type="date" id="editEndDate" class="form-control" 
                                value="${leave.endDate}" required>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label>Nombre de jours</label>
                        <input type="number" id="editDays" class="form-control" 
                            value="${leave.days}" readonly>
                    </div>
                    
                    <div class="form-group">
                        <label>Motif / Commentaire</label>
                        <textarea id="editReason" class="form-control" rows="3">${leave.reason || ''}</textarea>
                    </div>
                    
                    <div class="modal-footer">
                        <button type="submit" class="btn btn-primary">
                            Enregistrer les modifications
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
        
        // Calculer les jours
        const calculateDays = () => {
            const start = document.getElementById('editStartDate').value;
            const end = document.getElementById('editEndDate').value;
            
            if (start && end) {
                const days = Utils.getDaysBetween(start, end);
                document.getElementById('editDays').value = days;
            }
        };
        
        document.getElementById('editStartDate').addEventListener('change', calculateDays);
        document.getElementById('editEndDate').addEventListener('change', calculateDays);
        
        // Soumettre
        document.getElementById('editLeaveForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const updates = {
                startDate: document.getElementById('editStartDate').value,
                endDate: document.getElementById('editEndDate').value,
                reason: document.getElementById('editReason').value.trim()
            };
            
            if (await this.update(leaveId, updates)) {
                modal.remove();
            }
        });
    }
};

// Rendre disponible globalement
window.Leaves = Leaves;