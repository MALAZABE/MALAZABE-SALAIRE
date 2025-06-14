// Gestion des employés - VERSION 2.1 - Rafraîchissement automatique
const Employees = {
    // Liste des employés en mémoire
    list: [],
    
    // Charger tous les employés
    load: async function() {
        try {
            this.list = await Database.getEmployees();
            
            // S'assurer que chaque employé a un _id cohérent
            this.list.forEach(emp => {
                if (!emp._id && emp.id) {
                    emp._id = 'employee_' + emp.id;
                }
            });
            
            console.log(`${this.list.length} employés chargés`);
            return this.list;
        } catch (error) {
            console.error('Erreur chargement employés:', error);
            notify.error('Erreur lors du chargement des employés');
            return [];
        }
    },
    
    // Obtenir un employé par ID
    getById: function(id) {
        // Chercher par _id ou par id pour compatibilité
        return this.list.find(emp => 
            emp._id === id || 
            emp.id === id || 
            emp._id === 'employee_' + id
        );
    },
    
    // Ajouter un employé
    add: async function(employeeData) {
        try {
            // Validation
            if (!this.validate(employeeData)) {
                return false;
            }
            
            // Vérifier les doublons
            const existingByCIN = this.list.find(emp => emp.cin === employeeData.cin);
            if (existingByCIN) {
                notify.error(`Un employé avec le CIN ${employeeData.cin} existe déjà`);
                return false;
            }
            
            // Préparer les données
            const employee = {
                ...employeeData,
                id: Utils.generateId(),
                active: true
            };
            
            // L'_id sera généré par Database.saveEmployee
            
            // Sauvegarder dans la base
            const saved = await Database.saveEmployee(employee);
            
            // Ajouter à la liste locale seulement si pas déjà présent
            const exists = this.list.find(emp => emp._id === saved._id);
            if (!exists) {
                this.list.push(saved);
            }
            
            notify.success(`Employé ${employee.name} ajouté avec succès`);
            
            // NOUVEAU: Rafraîchir l'interface automatiquement
            if (window.UI && UI.forceFullRefresh) {
                await UI.forceFullRefresh();
            }
            
            return saved;
            
        } catch (error) {
            console.error('Erreur ajout employé:', error);
            notify.error('Erreur lors de l\'ajout de l\'employé');
            return false;
        }
    },
    
    // Modifier un employé
    update: async function(id, updates) {
        try {
            // Trouver l'employé
            const employee = this.getById(id);
            if (!employee) {
                notify.error('Employé introuvable');
                return false;
            }
            
            // Vérifier si le CIN change et n'est pas déjà pris
            if (updates.cin && updates.cin !== employee.cin) {
                const existingByCIN = this.list.find(emp => 
                    emp.cin === updates.cin && emp._id !== employee._id
                );
                if (existingByCIN) {
                    notify.error(`Le CIN ${updates.cin} est déjà utilisé`);
                    return false;
                }
            }
            
            // Fusionner les modifications SANS changer les IDs
            const updated = { 
                ...employee, 
                ...updates,
                _id: employee._id,  // Garder l'ID original
                id: employee.id     // Garder l'ID original
            };
            
            // Validation
            if (!this.validate(updated)) {
                return false;
            }
            
            // Sauvegarder
            const saved = await Database.saveEmployee(updated);
            
            // Mettre à jour la liste locale
            const index = this.list.findIndex(emp => emp._id === saved._id);
            if (index !== -1) {
                this.list[index] = saved;
            }
            
            notify.success('Employé modifié avec succès');
            
            // NOUVEAU: Forcer le rafraîchissement complet
            if (window.UI && UI.forceFullRefresh) {
                await UI.forceFullRefresh();
            }
            
            return saved;
            
        } catch (error) {
            console.error('Erreur modification employé:', error);
            notify.error('Erreur lors de la modification');
            return false;
        }
    },
    
    // Supprimer un employé
    delete: async function(id) {
        try {
            const employee = this.getById(id);
            if (!employee) {
                notify.error('Employé introuvable');
                return false;
            }
            
            // Confirmer la suppression
            const confirm = await Utils.confirm(
                `Êtes-vous sûr de vouloir supprimer ${employee.name} ?\n\n` +
                `Cette action est IRRÉVERSIBLE et supprimera :\n` +
                `- Tous les pointages\n` +
                `- Tous les paiements\n` +
                `- Toutes les données associées`
            );
            
            if (!confirm) {
                return false;
            }
            
            // Supprimer de la base (supprime aussi les données associées)
            await Database.deleteEmployee(employee._id);
            
            // Retirer de la liste locale
            this.list = this.list.filter(emp => emp._id !== employee._id);
            
            notify.success(`${employee.name} a été supprimé avec toutes ses données`);
            
            // NOUVEAU: Forcer le rafraîchissement complet
            if (window.UI && UI.forceFullRefresh) {
                await UI.forceFullRefresh();
            }
            
            return true;
            
        } catch (error) {
            console.error('Erreur suppression employé:', error);
            notify.error('Erreur lors de la suppression');
            return false;
        }
    },
    
    // Valider les données d'un employé
    validate: function(employee) {
        // Nom obligatoire
        if (!employee.name || employee.name.trim() === '') {
            notify.error('Le nom est obligatoire');
            return false;
        }
        
        // CIN obligatoire et format valide
        if (!employee.cin || employee.cin.trim() === '') {
            notify.error('Le numéro CIN est obligatoire');
            return false;
        }
        
        // Format CIN malgache: 12 chiffres
        const cinRegex = /^\d{3}\s?\d{3}\s?\d{3}\s?\d{3}$/;
        if (!cinRegex.test(employee.cin.replace(/\s/g, ' '))) {
            notify.error('Format CIN invalide (ex: 101 234 567 890)');
            return false;
        }
        
        // Position obligatoire
        if (!employee.position) {
            notify.error('Le poste est obligatoire');
            return false;
        }
        
        // Vérifier que la position est valide
        const validPositions = CONFIG.positions.map(p => p.value);
        if (!validPositions.includes(employee.position)) {
            notify.error('Poste invalide');
            return false;
        }
        
        // Salaire obligatoire et positif
        if (!employee.salary || employee.salary <= 0) {
            notify.error('Le salaire doit être supérieur à 0');
            return false;
        }
        
        // Salaire maximum raisonnable
        if (employee.salary > 50000000) { // 50 millions Ar
            notify.error('Le salaire semble trop élevé');
            return false;
        }
        
        // Date d'entrée obligatoire
        if (!employee.startDate) {
            notify.error('La date d\'entrée est obligatoire');
            return false;
        }
        
        // Vérifier que la date est valide
        if (!Utils.isValidDate(employee.startDate)) {
            notify.error('Date d\'entrée invalide');
            return false;
        }
        
        // Vérifier que la date n'est pas dans le futur
        if (new Date(employee.startDate) > new Date()) {
            notify.error('La date d\'entrée ne peut pas être dans le futur');
            return false;
        }
        
        // Vérifier que la date n'est pas trop ancienne
        const minDate = new Date('1950-01-01');
        if (new Date(employee.startDate) < minDate) {
            notify.error('La date d\'entrée semble incorrecte');
            return false;
        }
        
        // Validation du téléphone si fourni
        if (employee.phone) {
            // Format téléphone malgache: 03X XX XXX XX
            const phoneRegex = /^03[234]\s?\d{2}\s?\d{3}\s?\d{2}$/;
            if (!phoneRegex.test(employee.phone.replace(/\s/g, ''))) {
                notify.error('Format téléphone invalide (ex: 034 12 345 67)');
                return false;
            }
        }
        
        return true;
    },
    
    // Afficher le modal d'ajout/modification
    showModal: function(employeeId = null) {
        const isEdit = employeeId !== null;
        const employee = isEdit ? this.getById(employeeId) : {};
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${isEdit ? '✏️ Modifier' : '➕ Ajouter'} un employé</h3>
                    <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
                </div>
                
                <form id="employeeForm">
                    <div class="form-group">
                        <label>Nom complet *</label>
                        <input 
                            type="text" 
                            id="empName" 
                            class="form-control"
                            value="${employee.name || ''}"
                            placeholder="Ex: Jean Rakoto"
                            required
                        >
                    </div>
                    
                    <div class="form-group">
                        <label>Numéro CIN *</label>
                        <input 
                            type="text" 
                            id="empCIN" 
                            class="form-control"
                            value="${employee.cin || ''}"
                            placeholder="Ex: 101 234 567 890"
                            pattern="\\d{3}\\s?\\d{3}\\s?\\d{3}\\s?\\d{3}"
                            title="12 chiffres (espaces optionnels)"
                            required
                        >
                    </div>
                    
                    <div class="form-group">
                        <label>Date d'entrée *</label>
                        <input 
                            type="date" 
                            id="empStartDate" 
                            class="form-control"
                            value="${employee.startDate || ''}"
                            max="${Utils.getCurrentDate()}"
                            min="1950-01-01"
                            required
                        >
                    </div>
                    
                    <div class="form-group">
                        <label>Poste *</label>
                        <select id="empPosition" class="form-control" required>
                            <option value="">Sélectionner un poste</option>
                            ${CONFIG.positions.map(pos => `
                                <option value="${pos.value}" ${employee.position === pos.value ? 'selected' : ''}>
                                    ${pos.label}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label>Salaire mensuel (Ar) *</label>
                        <input 
                            type="number" 
                            id="empSalary" 
                            class="form-control"
                            value="${employee.salary || ''}"
                            min="1"
                            max="50000000"
                            placeholder="Ex: 500000"
                            required
                        >
                    </div>
                    
                    <div class="form-group">
                        <label>Adresse</label>
                        <input 
                            type="text" 
                            id="empAddress" 
                            class="form-control"
                            value="${employee.address || ''}"
                            placeholder="Ex: Mahajanga"
                        >
                    </div>
                    
                    <div class="form-group">
                        <label>Téléphone</label>
                        <input 
                            type="tel" 
                            id="empPhone" 
                            class="form-control"
                            value="${employee.phone || ''}"
                            pattern="03[234]\\s?\\d{2}\\s?\\d{3}\\s?\\d{2}"
                            placeholder="Ex: 034 12 345 67"
                            title="Format: 03X XX XXX XX"
                        >
                    </div>
                    
                    <div class="modal-footer">
                        <button type="submit" class="btn btn-primary">
                            ${isEdit ? 'Modifier' : 'Ajouter'}
                        </button>
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">
                            Annuler
                        </button>
                    </div>
                </form>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Formater automatiquement le CIN
        document.getElementById('empCIN').addEventListener('input', (e) => {
            let value = e.target.value.replace(/\s/g, '');
            if (value.length > 3) value = value.slice(0, 3) + ' ' + value.slice(3);
            if (value.length > 7) value = value.slice(0, 7) + ' ' + value.slice(7);
            if (value.length > 11) value = value.slice(0, 11) + ' ' + value.slice(11);
            e.target.value = value.slice(0, 15); // Max 12 chiffres + 3 espaces
        });
        
        // Formater automatiquement le téléphone
        document.getElementById('empPhone').addEventListener('input', (e) => {
            let value = e.target.value.replace(/\s/g, '');
            if (value.length > 3) value = value.slice(0, 3) + ' ' + value.slice(3);
            if (value.length > 6) value = value.slice(0, 6) + ' ' + value.slice(6);
            if (value.length > 10) value = value.slice(0, 10) + ' ' + value.slice(10);
            e.target.value = value.slice(0, 12); // Max 10 chiffres + 2 espaces
        });
        
        // Gérer la soumission
        document.getElementById('employeeForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = {
                name: document.getElementById('empName').value.trim(),
                cin: document.getElementById('empCIN').value.trim(),
                startDate: document.getElementById('empStartDate').value,
                position: document.getElementById('empPosition').value,
                salary: parseFloat(document.getElementById('empSalary').value),
                address: document.getElementById('empAddress').value.trim(),
                phone: document.getElementById('empPhone').value.trim()
            };
            
            let success;
            if (isEdit) {
                success = await this.update(employee._id || employeeId, formData);
            } else {
                success = await this.add(formData);
            }
            
            if (success) {
                modal.remove();
                // L'interface est rafraîchie automatiquement dans add/update
            }
        });
        
        // Focus sur le premier champ
        document.getElementById('empName').focus();
    },
    
    // Obtenir les statistiques
    getStats: function() {
        return {
            total: this.list.length,
            byPosition: CONFIG.positions.map(pos => ({
                position: pos.label,
                count: this.list.filter(emp => emp.position === pos.value).length
            })),
            totalSalary: this.list.reduce((sum, emp) => sum + (emp.salary || 0), 0),
            averageSalary: this.list.length > 0 ? 
                Math.round(this.list.reduce((sum, emp) => sum + (emp.salary || 0), 0) / this.list.length) : 0
        };
    }
};

// Rendre disponible globalement
window.Employees = Employees;