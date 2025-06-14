// Gestion des calculs de salaire - VERSION 5.0 - REPORT DIFFÉRÉ
const Salary = {
    // Cache pour les reports d'avances spéciales
    reportCache: {},
    
    // Charger (pour compatibilité)
    loadBonusesAdvances: async function(month = null) {
        // Plus rien à charger, tout est dans Payments
        console.log('Salary: Utilise maintenant Payments comme source');
        return true;
    },
    
    // Charger les avances spéciales
    loadSpecialAdvances: async function() {
        // Les échéanciers sont dans la base
        console.log('Chargement des échéanciers d\'avances spéciales...');
        return true;
    },
    
    // NOUVELLE MÉTHODE : Obtenir le nombre de jours dans un mois
    getDaysInMonth: function(month) {
        const [year, monthNum] = month.split('-').map(Number);
        return new Date(year, monthNum, 0).getDate(); // 28, 29, 30 ou 31
    },
    
    // Calculer le salaire d'un employé pour un mois
    calculate: function(employee, month, untilDay = null) {
        // MODIFICATION : Utiliser les jours réels du mois
        const daysInMonth = this.getDaysInMonth(month);
        const dailySalary = employee.salary / daysInMonth;
        
        console.log(`Calcul pour ${month}: ${daysInMonth} jours, salaire jour: ${dailySalary}`);
        
        // Obtenir le résumé des présences
        const summary = Attendance.getSummary(employee._id || employee.id, month);
        if (!summary) {
            return {
                baseSalary: 0,
                attendanceSummary: { P: 0, A: 0, R: 0, DM: 0, CP: 0, total: 0 },
                deductions: 0,
                bonus: 0,
                advance: 0,
                specialAdvance: 0,
                netSalary: 0,
                daysCount: 0,
                daysInMonth: daysInMonth,
                hasUnpaidSpecialAdvance: false,
                unpaidSpecialAdvanceAmount: 0,
                isPotentialReport: false
            };
        }
        
        // Calculer au prorata pour le mois en cours
        let baseSalary = employee.salary;
        let daysCount = daysInMonth;
        
        const today = new Date();
        const [year, monthNum] = month.split('-');
        const isCurrentMonth = month === Utils.getCurrentMonth();
        
        if (isCurrentMonth && !untilDay) {
            // Pour le mois en cours, calculer jusqu'à aujourd'hui
            untilDay = today.getDate();
            console.log(`Calcul au prorata jusqu'au jour ${untilDay}`);
        }
        
        if (untilDay) {
            // Calculer le salaire au prorata
            daysCount = untilDay;
            baseSalary = Math.round((employee.salary * untilDay) / daysInMonth);
            console.log(`Salaire au prorata: ${baseSalary} (${untilDay} jours sur ${daysInMonth})`);
        }
        
        // Calcul des déductions basées sur les présences réelles
        let deductions = 0;
        deductions += summary.A * dailySalary * CONFIG.salary.deductionRates.absence;
        deductions += summary.R * dailySalary * CONFIG.salary.deductionRates.late;
        deductions += summary.DM * dailySalary * CONFIG.salary.deductionRates.halfDay;
        
        // Arrondir les déductions
        deductions = Math.round(deductions);
        
        // Obtenir les montants depuis Payments
        const employeeId = employee._id || employee.id;
        
        // IMPORTANT: Vérifier que Payments est chargé
        let bonus = 0;
        let advance = 0;
        
        if (window.Payments && Payments.list && Payments.list.length >= 0) {
            bonus = Payments.getMonthlyBonus(employeeId, month);
            advance = Payments.getMonthlyAdvances(employeeId, month);
        } else {
            console.warn('Payments non chargé - calculs de bonus/avances impossibles');
        }
        
        // Pour l'avance spéciale, on la calculera dans calculateAsync
        let specialAdvance = 0;
        
        // Calcul du net SANS l'avance spéciale pour l'instant
        const netBeforeSpecial = baseSalary - deductions + bonus - advance;
        const netSalary = Math.max(0, netBeforeSpecial);
        
        return {
            baseSalary,
            attendanceSummary: summary,
            deductions,
            bonus,
            advance,
            specialAdvance,
            netSalary,
            daysCount,
            daysInMonth,
            hasUnpaidSpecialAdvance: false,
            unpaidSpecialAdvanceAmount: 0,
            isPotentialReport: false
        };
    },
    
    // Version asynchrone du calcul (CORRIGÉE avec report différé)
    calculateAsync: async function(employee, month, untilDay = null) {
        const calc = this.calculate(employee, month, untilDay);
        const employeeId = employee._id || employee.id;
        const isCurrentMonth = month === Utils.getCurrentMonth();
        
        // Obtenir l'avance spéciale due ce mois
        const specialAdvanceDue = await Payments.getSpecialAdvanceMonthly(employeeId, month);
        
        if (specialAdvanceDue > 0) {
            console.log(`Avance spéciale due pour ${employee.name}: ${specialAdvanceDue}`);
            
            // Calculer ce qui reste après déductions et avances normales
            const availableAfterNormal = calc.baseSalary - calc.deductions + calc.bonus - calc.advance;
            console.log(`Disponible après avances normales: ${availableAfterNormal}`);
            
            // NOUVEAU : Gestion différenciée selon le mois
            if (isCurrentMonth) {
                // MOIS EN COURS : Calcul de projection seulement, pas de report réel
                if (availableAfterNormal >= specialAdvanceDue) {
                    // On pourra payer l'échéance complète
                    calc.specialAdvance = specialAdvanceDue;
                    console.log(`Échéance complète payable: ${specialAdvanceDue}`);
                } else if (availableAfterNormal > 0) {
                    // Paiement partiel possible
                    calc.specialAdvance = availableAfterNormal;
                    calc.isPotentialReport = true; // NOUVEAU: Flag pour report potentiel
                    calc.unpaidSpecialAdvanceAmount = specialAdvanceDue - availableAfterNormal;
                    console.log(`Paiement partiel possible. Report potentiel: ${calc.unpaidSpecialAdvanceAmount}`);
                } else {
                    // Salaire insuffisant
                    calc.specialAdvance = 0;
                    calc.isPotentialReport = true;
                    calc.unpaidSpecialAdvanceAmount = specialAdvanceDue;
                    console.log(`Salaire insuffisant. Report potentiel complet: ${specialAdvanceDue}`);
                }
                // PAS DE SAUVEGARDE DE REPORT POUR LE MOIS EN COURS
            } else {
                // MOIS PASSÉ : Gestion normale avec report réel
                if (availableAfterNormal > 0) {
                    if (availableAfterNormal >= specialAdvanceDue) {
                        // On peut payer l'échéance complète
                        calc.specialAdvance = specialAdvanceDue;
                        console.log(`Échéance complète payée: ${specialAdvanceDue}`);
                    } else {
                        // On paie ce qu'on peut et on reporte le reste
                        calc.specialAdvance = availableAfterNormal;
                        calc.hasUnpaidSpecialAdvance = true;
                        calc.unpaidSpecialAdvanceAmount = specialAdvanceDue - availableAfterNormal;
                        
                        console.log(`Paiement partiel: ${calc.specialAdvance}, Report: ${calc.unpaidSpecialAdvanceAmount}`);
                        
                        // SAUVEGARDER LE REPORT (uniquement pour les mois passés)
                        await this.handleUnpaidSpecialAdvance(employeeId, month, calc.unpaidSpecialAdvanceAmount);
                    }
                } else {
                    // Salaire déjà épuisé, tout est reporté
                    calc.specialAdvance = 0;
                    calc.hasUnpaidSpecialAdvance = true;
                    calc.unpaidSpecialAdvanceAmount = specialAdvanceDue;
                    
                    console.log(`Salaire épuisé, report complet: ${specialAdvanceDue}`);
                    
                    // SAUVEGARDER LE REPORT
                    await this.handleUnpaidSpecialAdvance(employeeId, month, specialAdvanceDue);
                }
            }
        }
        
        // Recalculer le net final
        calc.netSalary = Math.max(0, 
            calc.baseSalary - calc.deductions + calc.bonus - calc.advance - calc.specialAdvance
        );
        
        // Obtenir le total payé
        calc.totalPaid = Payments.getTotalPaidForMonth(employeeId, month);
        calc.netToPay = Math.max(0, calc.netSalary - calc.totalPaid);
        
        console.log(`Net final pour ${employee.name}: ${calc.netSalary}, Reste à payer: ${calc.netToPay}`);
        
        return calc;
    },
    
    // Gérer les impayés d'avances spéciales (inchangé car utilisé seulement pour mois passés)
    handleUnpaidSpecialAdvance: async function(employeeId, month, unpaidAmount) {
        try {
            // Récupérer l'échéancier actuel
            const schedules = await Database.getSpecialAdvanceSchedules(employeeId);
            if (!schedules || schedules.length === 0) return;
            
            // Trouver l'échéancier actif
            const activeSchedule = schedules.find(s => s.status === 'active' && s.schedule[month]);
            if (!activeSchedule) return;
            
            console.log(`Report de ${Utils.formatMoney(unpaidAmount)} pour ${employeeId}`);
            
            // Trouver les mois futurs
            const futureMonths = Object.keys(activeSchedule.schedule)
                .filter(m => m > month)
                .sort();
            
            if (futureMonths.length > 0) {
                // Stratégie 1: Répartir équitablement sur les mois restants
                const amountPerMonth = Math.round(unpaidAmount / futureMonths.length);
                const lastMonthAdjustment = unpaidAmount - (amountPerMonth * (futureMonths.length - 1));
                
                // Mettre à jour l'échéancier
                futureMonths.forEach((futureMonth, index) => {
                    if (index === futureMonths.length - 1) {
                        // Dernier mois : ajouter le reste pour éviter les erreurs d'arrondi
                        activeSchedule.schedule[futureMonth] += lastMonthAdjustment;
                    } else {
                        activeSchedule.schedule[futureMonth] += amountPerMonth;
                    }
                });
                
                // Ajouter l'historique du report
                if (!activeSchedule.reportHistory) {
                    activeSchedule.reportHistory = [];
                }
                
                activeSchedule.reportHistory.push({
                    month: month,
                    unpaidAmount: unpaidAmount,
                    reportedTo: futureMonths,
                    date: new Date().toISOString(),
                    reason: 'Salaire insuffisant après déductions'
                });
                
                // Sauvegarder l'échéancier modifié
                await Database.saveSpecialAdvanceSchedule(activeSchedule);
                
                // Stocker dans le cache pour affichage
                if (!this.reportCache[employeeId]) {
                    this.reportCache[employeeId] = [];
                }
                this.reportCache[employeeId].push({
                    month: month,
                    amount: unpaidAmount,
                    message: `Report de ${Utils.formatMoney(unpaidAmount)} sur ${futureMonths.length} mois`
                });
                
                notify.info(
                    `Avance spéciale: ${Utils.formatMoney(unpaidAmount)} reporté sur les ${futureMonths.length} prochains mois`
                );
                
            } else {
                // Pas de mois futur dans l'échéancier, créer un nouveau mois
                const nextMonth = this.getNextMonth(month);
                activeSchedule.schedule[nextMonth] = unpaidAmount;
                
                // Ajouter l'historique
                if (!activeSchedule.reportHistory) {
                    activeSchedule.reportHistory = [];
                }
                
                activeSchedule.reportHistory.push({
                    month: month,
                    unpaidAmount: unpaidAmount,
                    reportedTo: [nextMonth],
                    date: new Date().toISOString(),
                    reason: 'Salaire insuffisant - Report sur mois supplémentaire'
                });
                
                await Database.saveSpecialAdvanceSchedule(activeSchedule);
                
                notify.warning(
                    `Avance spéciale: ${Utils.formatMoney(unpaidAmount)} reporté sur ${Utils.formatMonth(nextMonth)}`
                );
            }
            
        } catch (error) {
            console.error('Erreur gestion report avance spéciale:', error);
            notify.error('Erreur lors du report de l\'avance spéciale');
        }
    },
    
    // NOUVELLE MÉTHODE : Obtenir le mois suivant
    getNextMonth: function(month) {
        const [year, monthNum] = month.split('-').map(Number);
        const date = new Date(year, monthNum - 1, 1);
        date.setMonth(date.getMonth() + 1);
        return date.toISOString().slice(0, 7);
    },
    
    // NOUVELLE MÉTHODE : Obtenir l'historique des reports
    getReportHistory: async function(employeeId) {
        const schedules = await Database.getSpecialAdvanceSchedules(employeeId);
        const history = [];
        
        schedules.forEach(schedule => {
            if (schedule.reportHistory) {
                history.push(...schedule.reportHistory);
            }
        });
        
        return history.sort((a, b) => new Date(b.date) - new Date(a.date));
    },
    
    // Définir un bonus (crée un paiement)
    setBonus: async function(employeeId, month, amount) {
        try {
            // Chercher si un bonus existe déjà
            const existingBonuses = Payments.list.filter(p => 
                p.employeeId === employeeId && 
                p.month === month && 
                p.paymentType === 'bonus'
            );
            
            // Si un bonus existe, le mettre à jour
            if (existingBonuses.length > 0 && amount > 0) {
                const existing = existingBonuses[0];
                return await Payments.update(existing._id, { amount });
            }
            // Si pas de bonus et montant > 0, créer
            else if (amount > 0) {
                const paymentData = {
                    employeeId,
                    month,
                    paymentType: 'bonus',
                    amount,
                    method: 'cash',
                    date: Utils.getCurrentDate(),
                    description: `Prime du mois ${month}`
                };
                
                return await Payments.add(paymentData);
            }
            // Si montant = 0, supprimer le bonus existant
            else if (existingBonuses.length > 0) {
                await Payments.delete(existingBonuses[0]._id);
                return true;
            }
            
            return true;
        } catch (error) {
            console.error('Erreur gestion prime:', error);
            notify.error('Erreur lors de la gestion de la prime');
            return false;
        }
    },
    
    // Afficher le tableau des salaires - MODIFIÉ pour afficher les reports potentiels
    renderTable: async function(containerId, month = null) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const targetMonth = month || Utils.getCurrentMonth();
        const isCurrentMonth = targetMonth === Utils.getCurrentMonth();
        const today = new Date();
        const currentDay = today.getDate();
        const daysInMonth = this.getDaysInMonth(targetMonth);
        
        let html = `
            <div class="salary-container">
                <div class="salary-header">
                    <h4>Calcul des salaires - ${Utils.formatMonth(targetMonth)}${isCurrentMonth ? ` (jusqu'au ${currentDay})` : ''}</h4>
                    <button class="btn btn-primary" onclick="Salary.exportMonth('${targetMonth}')">
                        📄 Exporter le mois
                    </button>
                </div>
                
                ${isCurrentMonth ? `
                    <div class="alert alert-info">
                        ⚠️ Mois en cours : Les salaires sont calculés au prorata jusqu'au ${currentDay} ${Utils.formatMonth(targetMonth)}<br>
                        📅 Ce mois compte ${daysInMonth} jours<br>
                        ⏳ Les reports d'avances spéciales seront calculés en fin de mois
                    </div>
                ` : `
                    <div class="alert alert-light">
                        📅 ${Utils.formatMonth(targetMonth)} compte ${daysInMonth} jours
                    </div>
                `}
                
                <div class="table-responsive">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Employé</th>
                                <th>Salaire de base</th>
                                <th>Payé</th>
                                <th class="text-primary">Net à payer</th>
                                <th>Av. Spéc</th>
                                <th>Avances</th>
                                <th>Prime</th>
                                <th>Jours</th>
                                <th>Déductions</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        
        // Calculer de manière asynchrone puis afficher
        await this.renderTableAsync(container, targetMonth, html);
    },
    
    // Version asynchrone du rendu (MODIFIÉE pour gérer les reports potentiels)
    renderTableAsync: async function(container, targetMonth, htmlStart) {
        const isCurrentMonth = targetMonth === Utils.getCurrentMonth();
        const currentDay = new Date().getDate();
        const daysInMonth = this.getDaysInMonth(targetMonth);
        
        let html = htmlStart;
        let totalNet = 0;
        let totalDeductions = 0;
        let totalPaid = 0;
        let totalRemaining = 0;
        let totalAdvances = 0;
        let totalSpecialAdvances = 0;
        let totalUnpaidSpecial = 0;
        let totalPotentialReports = 0;
        let totalBonuses = 0;
        let totalBaseSalary = 0;
        
        // Vider le cache des reports pour ce mois
        this.reportCache = {};
        
        for (const employee of Employees.list) {
            const calc = await this.calculateAsync(employee, targetMonth);
            totalBaseSalary += calc.baseSalary;
            totalNet += calc.netSalary;
            totalDeductions += calc.deductions;
            totalAdvances += calc.advance;
            totalSpecialAdvances += calc.specialAdvance;
            totalBonuses += calc.bonus;
            
            // Gestion différenciée pour reports réels vs potentiels
            if (calc.isPotentialReport) {
                totalPotentialReports += calc.unpaidSpecialAdvanceAmount;
            } else if (calc.hasUnpaidSpecialAdvance) {
                totalUnpaidSpecial += calc.unpaidSpecialAdvanceAmount;
            }
            
            const paid = calc.totalPaid;
            const remaining = calc.netToPay;
            totalPaid += paid;
            totalRemaining += remaining;
            
            const isPaid = remaining === 0 && calc.netSalary > 0;
            
            // Indicateur de report (potentiel ou réel)
            const hasReport = calc.hasUnpaidSpecialAdvance || calc.isPotentialReport;
            const isPotential = calc.isPotentialReport;
            
            html += `
                <tr ${hasReport ? (isPotential ? 'class="table-info"' : 'class="table-warning"') : ''}>
                    <td>
                        <strong>${employee.name}</strong><br>
                        <small>${CONFIG.positions.find(p => p.value === employee.position)?.label}</small>
                        ${hasReport ? 
                            (isPotential ? 
                                '<br><span class="badge badge-info">⏳ Report potentiel</span>' : 
                                '<br><span class="badge badge-warning">⚠️ Report effectué</span>'
                            ) : ''
                        }
                    </td>
                    <td>
                        ${Utils.formatMoney(calc.baseSalary)}
                        ${isCurrentMonth || calc.daysCount < daysInMonth ? `<br><small>(${calc.daysCount}/${daysInMonth} jours)</small>` : ''}
                    </td>
                    <td>
                        ${calc.netSalary === 0 ? 
                            '<span class="text-muted">-</span>' :
                            (isPaid ? 
                                `<span class="badge badge-success">✓ ${Utils.formatMoney(paid)}</span>` : 
                                `<span class="badge badge-warning">${Utils.formatMoney(paid)}</span>`
                            )
                        }
                    </td>
                    <td class="text-primary font-weight-bold">
                        ${calc.netSalary === 0 ? 
                            '<span class="text-muted">-</span>' :
                            Utils.formatMoney(remaining)
                        }
                    </td>
                    <td>
                        ${Utils.formatMoney(calc.specialAdvance)}
                        ${hasReport ? `
                            <br><small class="${isPotential ? 'text-info' : 'text-danger'}">
                                ${isPotential ? 'Potentiel' : 'Reporté'}: ${Utils.formatMoney(calc.unpaidSpecialAdvanceAmount)}
                            </small>
                        ` : ''}
                    </td>
                    <td class="text-warning">${Utils.formatMoney(calc.advance)}</td>
                    <td class="text-success">
                        ${Utils.formatMoney(calc.bonus)}
                        <button class="btn btn-sm btn-outline-success" 
                            onclick="Salary.showBonusModal('${employee._id || employee.id}', '${targetMonth}')">
                            ✏️
                        </button>
                    </td>
                    <td>
                        <small>
                            P:${calc.attendanceSummary.P} 
                            A:${calc.attendanceSummary.A} 
                            R:${calc.attendanceSummary.R}
                            ${calc.attendanceSummary.CP > 0 ? `CP:${calc.attendanceSummary.CP}` : ''}
                        </small>
                    </td>
                    <td class="text-danger">${Utils.formatMoney(calc.deductions)}</td>
                    <td>
                        <div class="btn-group">
                            ${!isPaid && calc.netSalary > 0 ? `
                                <button class="btn btn-sm btn-primary" 
                                    onclick="Salary.showSalaryPaymentModal('${employee._id || employee.id}', '${targetMonth}', ${remaining})">
                                    💵 Payer
                                </button>
                            ` : ''}
                            <button class="btn btn-sm btn-info" 
                                onclick="Salary.printPayslip('${employee._id || employee.id}', '${targetMonth}')">
                                📄 Fiche
                            </button>
                            ${hasReport && !isPotential ? `
                                <button class="btn btn-sm btn-warning" 
                                    onclick="Salary.showReportDetails('${employee._id || employee.id}', '${targetMonth}')">
                                    ⚠️ Détails
                                </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }
        
        html += `
                        </tbody>
                        <tfoot>
                            <tr class="table-active">
                                <th>TOTAUX</th>
                                <th>${Utils.formatMoney(totalBaseSalary)}</th>
                                <th>${Utils.formatMoney(totalPaid)}</th>
                                <th class="text-primary">${Utils.formatMoney(totalRemaining)}</th>
                                <th>
                                    ${Utils.formatMoney(totalSpecialAdvances)}
                                    ${totalUnpaidSpecial > 0 ? `
                                        <br><small class="text-danger">
                                            Reporté: ${Utils.formatMoney(totalUnpaidSpecial)}
                                        </small>
                                    ` : ''}
                                    ${totalPotentialReports > 0 ? `
                                        <br><small class="text-info">
                                            Potentiel: ${Utils.formatMoney(totalPotentialReports)}
                                        </small>
                                    ` : ''}
                                </th>
                                <th class="text-warning">${Utils.formatMoney(totalAdvances)}</th>
                                <th class="text-success">${Utils.formatMoney(totalBonuses)}</th>
                                <th>-</th>
                                <th class="text-danger">${Utils.formatMoney(totalDeductions)}</th>
                                <th></th>
                            </tr>
                            <tr class="table-info">
                                <th colspan="3">NET TOTAL</th>
                                <th colspan="1" class="text-primary">${Utils.formatMoney(totalNet)}</th>
                                <th colspan="6"></th>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                
                ${totalPotentialReports > 0 && isCurrentMonth ? `
                    <div class="alert alert-info mt-3">
                        <strong>⏳ Reports potentiels d'avances spéciales :</strong><br>
                        Total potentiel : ${Utils.formatMoney(totalPotentialReports)}<br>
                        <small>Ces reports seront calculés définitivement en fin de mois si le salaire reste insuffisant.</small>
                    </div>
                ` : ''}
                
                ${totalUnpaidSpecial > 0 && !isCurrentMonth ? `
                    <div class="alert alert-warning mt-3">
                        <strong>⚠️ Reports d'avances spéciales :</strong><br>
                        Total reporté ce mois : ${Utils.formatMoney(totalUnpaidSpecial)}<br>
                        <small>Les montants ont été automatiquement reportés sur les mois suivants.</small>
                    </div>
                ` : ''}
            </div>
        `;
        
        container.innerHTML = html;
    },
    
    // Modal de paiement avec montant pré-rempli (inchangé)
    showSalaryPaymentModal: function(employeeId, month, netToPay) {
        const employee = Employees.getById(employeeId);
        if (!employee) return;
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content modal-sm">
                <div class="modal-header">
                    <h3>💵 Paiement salaire - ${employee.name}</h3>
                    <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
                </div>
                
                <form id="salaryPaymentForm">
                    <div class="form-group">
                        <label>Mois: ${Utils.formatMonth(month)}</label>
                    </div>
                    
                    <div class="form-group">
                        <label>Net à payer</label>
                        <input 
                            type="text" 
                            class="form-control text-primary font-weight-bold"
                            value="${Utils.formatMoney(netToPay)}"
                            readonly
                        >
                    </div>
                    
                    <div class="form-group">
                        <label>Montant à payer (Ar)</label>
                        <input 
                            type="number" 
                            id="paymentAmount" 
                            class="form-control"
                            value="${netToPay}"
                            min="0"
                            max="${netToPay}"
                            required
                        >
                        <small class="form-text text-muted">
                            Vous pouvez modifier le montant si nécessaire
                        </small>
                    </div>
                    
                    <div class="form-group">
                        <label>Mode de paiement</label>
                        <select id="paymentMethod" class="form-control" required>
                            ${CONFIG.paymentMethods.map(m => 
                                `<option value="${m.value}">${m.label}</option>`
                            ).join('')}
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label>Date</label>
                        <input 
                            type="date" 
                            id="paymentDate" 
                            class="form-control"
                            value="${Utils.getCurrentDate()}"
                            required
                        >
                    </div>
                    
                    <div class="form-group">
                        <label>Note (optionnel)</label>
                        <input 
                            type="text" 
                            id="paymentNote" 
                            class="form-control"
                            placeholder="Ex: Paiement salaire ${Utils.formatMonth(month)}"
                        >
                    </div>
                    
                    <div class="modal-footer">
                        <button type="submit" class="btn btn-primary">
                            Enregistrer le paiement
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
        
        document.getElementById('salaryPaymentForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const paymentData = {
                employeeId: employeeId,
                month: month,
                paymentType: 'salary',
                amount: parseFloat(document.getElementById('paymentAmount').value),
                method: document.getElementById('paymentMethod').value,
                date: document.getElementById('paymentDate').value,
                description: document.getElementById('paymentNote').value || `Paiement salaire ${Utils.formatMonth(month)}`
            };
            
            if (await Payments.add(paymentData)) {
                modal.remove();
                // Rafraîchir l'affichage
                if (window.UI && UI.render) {
                    await UI.render();
                } else {
                    // Rafraîchir juste le tableau des salaires
                    this.renderTable('salary-table', month);
                }
            }
        });
        
        // Focus sur le montant et sélectionner
        document.getElementById('paymentAmount').focus();
        document.getElementById('paymentAmount').select();
    },
    
    // Afficher les détails d'un report (inchangé car seulement pour mois passés)
    showReportDetails: async function(employeeId, month) {
        const employee = Employees.getById(employeeId);
        if (!employee) return;
        
        const calc = await this.calculateAsync(employee, month);
        const history = await this.getReportHistory(employeeId);
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h3>⚠️ Détails du report - ${employee.name}</h3>
                    <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
                </div>
                
                <div class="modal-body">
                    <h5>Situation du mois ${Utils.formatMonth(month)}</h5>
                    <table class="table table-sm">
                        <tr>
                            <td>Salaire de base</td>
                            <td>${Utils.formatMoney(calc.baseSalary)}</td>
                        </tr>
                        <tr>
                            <td>Après déductions et avances</td>
                            <td>${Utils.formatMoney(calc.baseSalary - calc.deductions - calc.advance + calc.bonus)}</td>
                        </tr>
                        <tr>
                            <td>Avance spéciale due</td>
                            <td>${Utils.formatMoney(calc.specialAdvance + calc.unpaidSpecialAdvanceAmount)}</td>
                        </tr>
                        <tr>
                            <td>Avance spéciale payée</td>
                            <td class="text-success">${Utils.formatMoney(calc.specialAdvance)}</td>
                        </tr>
                        <tr>
                            <td>Montant reporté</td>
                            <td class="text-danger">${Utils.formatMoney(calc.unpaidSpecialAdvanceAmount)}</td>
                        </tr>
                    </table>
                    
                    ${history.length > 0 ? `
                        <h5 class="mt-4">Historique des reports</h5>
                        <div style="max-height: 300px; overflow-y: auto;">
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
                                    ${history.map(h => `
                                        <tr>
                                            <td>${Utils.formatMonth(h.month)}</td>
                                            <td>${Utils.formatMoney(h.unpaidAmount)}</td>
                                            <td><small>${h.reason}</small></td>
                                            <td><small>${h.reportedTo.map(m => Utils.formatMonth(m)).join(', ')}</small></td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : ''}
                    
                    <div class="alert alert-info mt-3">
                        <strong>ℹ️ Comment ça fonctionne ?</strong><br>
                        <ul class="mb-0">
                            <li>L'application déduit d'abord les avances normales</li>
                            <li>Si le reste est insuffisant pour l'avance spéciale, elle est reportée</li>
                            <li>Le montant reporté est réparti équitablement sur les mois restants</li>
                            <li>Les reports sont automatiques et traçables</li>
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
    },
    
    // Afficher le modal de prime (inchangé)
    showBonusModal: function(employeeId, month) {
        const employee = Employees.getById(employeeId);
        if (!employee) return;
        
        const currentBonus = Payments.getMonthlyBonus(employeeId, month);
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content modal-sm">
                <div class="modal-header">
                    <h3>🎁 Prime pour ${employee.name}</h3>
                    <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
                </div>
                
                <form id="bonusForm">
                    <div class="form-group">
                        <label>Mois: ${Utils.formatMonth(month)}</label>
                    </div>
                    
                    <div class="form-group">
                        <label>Montant de la prime (Ar)</label>
                        <input 
                            type="number" 
                            id="bonusAmount" 
                            class="form-control"
                            value="${currentBonus}"
                            min="0"
                            required
                        >
                        <small class="form-text">
                            Salaire de base: ${Utils.formatMoney(employee.salary)}
                        </small>
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
        
        document.getElementById('bonusForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const amount = parseFloat(document.getElementById('bonusAmount').value) || 0;
            
            if (await this.setBonus(employeeId, month, amount)) {
                modal.remove();
                // IMPORTANT: Forcer le rafraîchissement complet
                if (window.UI && UI.render) {
                    await UI.render();
                }
            }
        });
        
        document.getElementById('bonusAmount').focus();
        document.getElementById('bonusAmount').select();
    },
    
    // Imprimer la fiche de paie - MODIFIÉE pour gérer les reports potentiels
    printPayslip: async function(employeeId, month) {
        const employee = Employees.getById(employeeId);
        if (!employee) return;
        
        const calc = await this.calculateAsync(employee, month);
        const paid = calc.totalPaid;
        const remaining = calc.netToPay;
        const daysInMonth = calc.daysInMonth;
        
        // Liste des avances
        const advances = Payments.list.filter(p => 
            p.employeeId === employeeId && 
            p.month === month && 
            p.paymentType === 'advance'
        );
        
        const isCurrentMonth = month === Utils.getCurrentMonth();
        const today = new Date();
        
        const payslipHTML = `
            <!DOCTYPE html>
            <html lang="fr">
            <head>
                <meta charset="UTF-8">
                <title>Fiche de paie - ${employee.name}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    .header { text-align: center; margin-bottom: 30px; }
                    .company { font-size: 24px; font-weight: bold; color: #333; }
                    .payslip-title { font-size: 18px; margin-top: 10px; }
                    .section { margin-bottom: 20px; }
                    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
                    .info-item { padding: 5px 0; }
                    .label { font-weight: bold; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #f0f0f0; }
                    .summary { background-color: #f8f9fa; padding: 15px; margin-top: 20px; }
                    .total { font-size: 18px; font-weight: bold; color: #007bff; }
                    .signature { margin-top: 50px; display: grid; grid-template-columns: 1fr 1fr; gap: 50px; }
                    .signature-box { border-top: 1px solid #333; padding-top: 10px; text-align: center; }
                    .note { background-color: #fff3cd; padding: 10px; margin-top: 10px; border-radius: 5px; }
                    .warning { background-color: #f8d7da; padding: 10px; margin-top: 10px; border-radius: 5px; }
                    .info { background-color: #d1ecf1; padding: 10px; margin-top: 10px; border-radius: 5px; }
                    @media print { body { margin: 0; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="company">MALAZA BE</div>
                    <div class="payslip-title">FICHE DE PAIE</div>
                    <div>Mois de ${Utils.formatMonth(month)} (${daysInMonth} jours)</div>
                    ${isCurrentMonth ? `<div class="note">⚠️ Calcul au prorata jusqu'au ${today.getDate()} ${Utils.formatMonth(month)}</div>` : ''}
                </div>
                
                <div class="section">
                    <h3>Informations de l'employé</h3>
                    <div class="info-grid">
                        <div class="info-item"><span class="label">Nom:</span> ${employee.name}</div>
                        <div class="info-item"><span class="label">CIN:</span> ${employee.cin}</div>
                        <div class="info-item"><span class="label">Poste:</span> ${CONFIG.positions.find(p => p.value === employee.position)?.label}</div>
                        <div class="info-item"><span class="label">Date d'entrée:</span> ${Utils.formatDate(employee.startDate)}</div>
                    </div>
                </div>
                
                <div class="section">
                    <h3>Détail des présences</h3>
                    <table>
                        <tr>
                            <th>Type</th>
                            <th>Nombre de jours</th>
                            <th>Impact</th>
                        </tr>
                        <tr>
                            <td>Présent</td>
                            <td>${calc.attendanceSummary.P}</td>
                            <td>-</td>
                        </tr>
                        <tr>
                            <td>Absent</td>
                            <td>${calc.attendanceSummary.A}</td>
                            <td style="color: red;">-100% du jour</td>
                        </tr>
                        <tr>
                            <td>Retard</td>
                            <td>${calc.attendanceSummary.R}</td>
                            <td style="color: orange;">-25% du jour</td>
                        </tr>
                        <tr>
                            <td>Demi-journée</td>
                            <td>${calc.attendanceSummary.DM}</td>
                            <td style="color: orange;">-50% du jour</td>
                        </tr>
                        <tr>
                            <td>Congé payé</td>
                            <td>${calc.attendanceSummary.CP}</td>
                            <td style="color: green;">Payé</td>
                        </tr>
                        <tr style="background-color: #f0f0f0;">
                            <th>Total jours travaillés</th>
                            <th>${calc.attendanceSummary.total}</th>
                            <th>-</th>
                        </tr>
                    </table>
                </div>
                
                <div class="section">
                    <h3>Calcul du salaire</h3>
                    <table>
                        <tr>
                            <td>Salaire mensuel</td>
                            <td style="text-align: right;">${Utils.formatMoney(employee.salary)}</td>
                        </tr>
                        <tr>
                            <td>Salaire journalier (base ${daysInMonth} jours)</td>
                            <td style="text-align: right;">${Utils.formatMoney(Math.round(employee.salary / daysInMonth))}</td>
                        </tr>
                        ${isCurrentMonth || calc.daysCount < daysInMonth ? `
                        <tr>
                            <td>Salaire au prorata (${calc.daysCount} jours)</td>
                            <td style="text-align: right;">${Utils.formatMoney(calc.baseSalary)}</td>
                        </tr>
                        ` : ''}
                        <tr>
                            <td>Déductions (absences, retards, demi-journées)</td>
                            <td style="text-align: right; color: red;">- ${Utils.formatMoney(calc.deductions)}</td>
                        </tr>
                        ${calc.bonus > 0 ? `
                        <tr>
                            <td>Prime</td>
                            <td style="text-align: right; color: green;">+ ${Utils.formatMoney(calc.bonus)}</td>
                        </tr>
                        ` : ''}
                        ${calc.advance > 0 ? `
                        <tr>
                            <td>Avances (${advances.length} avance${advances.length > 1 ? 's' : ''})</td>
                            <td style="text-align: right; color: red;">- ${Utils.formatMoney(calc.advance)}</td>
                        </tr>
                        ` : ''}
                        ${calc.specialAdvance > 0 || calc.unpaidSpecialAdvanceAmount > 0 ? `
                        <tr>
                            <td>
                                Avance spéciale (échéance du mois)
                                ${calc.isPotentialReport && isCurrentMonth ? 
                                    '<br><small>⏳ Report potentiel: ' + Utils.formatMoney(calc.unpaidSpecialAdvanceAmount) + '</small>' : 
                                    (calc.unpaidSpecialAdvanceAmount > 0 ? '<br><small>⚠️ Montant reporté: ' + Utils.formatMoney(calc.unpaidSpecialAdvanceAmount) + '</small>' : '')
                                }
                            </td>
                            <td style="text-align: right; color: red;">- ${Utils.formatMoney(calc.specialAdvance)}</td>
                        </tr>
                        ` : ''}
                        <tr style="background-color: #f0f0f0; font-weight: bold;">
                            <td>NET À PAYER</td>
                            <td style="text-align: right; font-size: 18px; color: #007bff;">${Utils.formatMoney(calc.netSalary)}</td>
                        </tr>
                    </table>
                </div>
                
                ${calc.isPotentialReport && isCurrentMonth ? `
                <div class="info">
                    <strong>⏳ Report potentiel d'avance spéciale</strong><br>
                    Montant potentiel : ${Utils.formatMoney(calc.unpaidSpecialAdvanceAmount)}<br>
                    <small>Ce report sera confirmé en fin de mois si le salaire reste insuffisant.</small>
                </div>
                ` : ''}
                
                ${calc.hasUnpaidSpecialAdvance && !calc.isPotentialReport ? `
                <div class="warning">
                    <strong>⚠️ Report d'avance spéciale</strong><br>
                    Montant reporté : ${Utils.formatMoney(calc.unpaidSpecialAdvanceAmount)}<br>
                    <small>Ce montant a été automatiquement réparti sur les mois suivants.</small>
                </div>
                ` : ''}
                
                ${advances.length > 0 ? `
                <div class="section">
                    <h3>Détail des avances</h3>
                    <table>
                        <tr>
                            <th>Date</th>
                            <th>Montant</th>
                            <th>Mode</th>
                            <th>Note</th>
                        </tr>
                        ${advances.map(adv => `
                            <tr>
                                <td>${Utils.formatDate(adv.date)}</td>
                                <td>${Utils.formatMoney(adv.amount)}</td>
                                <td>${CONFIG.paymentMethods.find(m => m.value === adv.method)?.label || adv.method}</td>
                                <td>${adv.description || '-'}</td>
                            </tr>
                        `).join('')}
                    </table>
                </div>
                ` : ''}
                
                <div class="section summary">
                    <h3>État des paiements</h3>
                    <div class="info-item"><span class="label">Net à payer:</span> ${Utils.formatMoney(calc.netSalary)}</div>
                    <div class="info-item"><span class="label">Montant payé:</span> ${Utils.formatMoney(paid)}</div>
                    <div class="info-item"><span class="label">Reste à payer:</span> <span class="total">${Utils.formatMoney(remaining)}</span></div>
                </div>
                
                <div class="signature">
                    <div class="signature-box">
                        <div>L'employeur</div>
                    </div>
                    <div class="signature-box">
                        <div>L'employé</div>
                    </div>
                </div>
                
                <div style="text-align: center; margin-top: 30px; font-size: 12px; color: #666;">
                    Document généré le ${Utils.formatDate(new Date())} à ${new Date().toLocaleTimeString('fr-FR')}
                </div>
            </body>
            </html>
        `;
        
        const printWindow = window.open('', '_blank');
        printWindow.document.write(payslipHTML);
        printWindow.document.close();
        printWindow.focus();
        
        setTimeout(() => {
            printWindow.print();
        }, 250);
    },
    
    // Exporter le mois (inchangé)
    exportMonth: async function(month) {
        const data = [];
        const isCurrentMonth = month === Utils.getCurrentMonth();
        const currentDay = new Date().getDate();
        const daysInMonth = this.getDaysInMonth(month);
        
        for (const employee of Employees.list) {
            const calc = await this.calculateAsync(employee, month);
            const paid = calc.totalPaid;
            const remaining = calc.netToPay;
            
            data.push({
                Nom: employee.name,
                Poste: CONFIG.positions.find(p => p.value === employee.position)?.label,
                'Salaire de base': calc.baseSalary,
                'Jours dans le mois': daysInMonth,
                'Jours présents': calc.attendanceSummary.P,
                'Absences': calc.attendanceSummary.A,
                'Retards': calc.attendanceSummary.R,
                'Congés payés': calc.attendanceSummary.CP,
                'Déductions': calc.deductions,
                'Prime': calc.bonus,
                'Avances': calc.advance,
                'Avance spéciale': calc.specialAdvance,
                'Avance reportée': calc.unpaidSpecialAdvanceAmount,
                'Net à payer': calc.netSalary,
                'Déjà payé': paid,
                'Reste à payer': remaining,
                'Note': isCurrentMonth ? 
                    `Calculé jusqu'au ${currentDay}` + (calc.isPotentialReport ? ' - Report potentiel' : '') : 
                    (calc.hasUnpaidSpecialAdvance ? 'Report avance spéciale' : '')
            });
        }
        
        // Créer un CSV
        const headers = Object.keys(data[0]);
        const csv = [
            headers.join(','),
            ...data.map(row => headers.map(h => row[h]).join(','))
        ].join('\n');
        
        // Télécharger
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `salaires-${month}.csv`;
        link.click();
        
        notify.success('Export réussi');
    },
    
    // Obtenir les statistiques pour le tableau de bord (inchangé)
    getMonthlyStats: async function(month) {
        let totalSalaries = 0;
        let totalDeductions = 0;
        let totalBonuses = 0;
        let totalAdvances = 0;
        let totalSpecialAdvances = 0;
        let totalNet = 0;
        
        for (const employee of Employees.list) {
            const calc = await this.calculateAsync(employee, month);
            totalSalaries += calc.baseSalary;
            totalDeductions += calc.deductions;
            totalBonuses += calc.bonus;
            totalAdvances += calc.advance;
            totalSpecialAdvances += calc.specialAdvance;
            totalNet += calc.netSalary;
        }
        
        return {
            totalSalaries,
            totalDeductions,
            totalBonuses,
            totalAdvances,
            totalSpecialAdvances,
            totalNet
        };
    },
    
    // Obtenir les détails de toutes les avances pour un employé (inchangé)
    getEmployeeAdvanceDetails: async function(employeeId, month) {
        const employee = Employees.getById(employeeId);
        if (!employee) return null;
        
        const calc = await this.calculateAsync(employee, month);
        
        // Détail des avances normales
        const normalAdvances = Payments.list.filter(p => 
            p.employeeId === employeeId && 
            p.month === month && 
            p.paymentType === 'advance'
        );
        
        // Détail de l'avance spéciale
        let specialAdvanceDetails = null;
        const schedules = await Database.getSpecialAdvanceSchedules(employeeId);
        const activeSchedule = schedules.find(s => s.status === 'active' && s.schedule[month]);
        
        if (activeSchedule) {
            specialAdvanceDetails = {
                totalLoan: activeSchedule.totalAmount,
                monthlyDue: activeSchedule.schedule[month],
                paid: calc.specialAdvance,
                unpaid: calc.unpaidSpecialAdvanceAmount,
                schedule: activeSchedule.schedule,
                isPotential: calc.isPotentialReport
            };
        }
        
        return {
            employee: employee,
            calculation: calc,
            normalAdvances: normalAdvances,
            specialAdvance: specialAdvanceDetails
        };
    },
    
    // Afficher les rapports avec avances spéciales (modifié pour gérer les reports potentiels)
    renderReports: async function(containerId, month) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const targetMonth = month || Utils.getCurrentMonth();
        const daysInMonth = this.getDaysInMonth(targetMonth);
        const isCurrentMonth = targetMonth === Utils.getCurrentMonth();
        
        let html = `
            <div class="reports-section">
                <div class="section-header">
                    <h4>Rapport détaillé - ${Utils.formatMonth(targetMonth)} (${daysInMonth} jours)</h4>
                    <button class="btn btn-primary" onclick="Salary.printMonthReport('${targetMonth}')">
                        🖨️ Imprimer le rapport
                    </button>
                </div>
                ${isCurrentMonth ? `
                    <div class="alert alert-info mb-3">
                        ⏳ Les reports d'avances spéciales seront calculés définitivement en fin de mois
                    </div>
                ` : ''}
        `;
        
        for (const employee of Employees.list) {
            const details = await this.getEmployeeAdvanceDetails(employee._id || employee.id, targetMonth);
            const calc = details.calculation;
            const totalPaid = calc.totalPaid;
            const remaining = calc.netToPay;
            const isPaid = remaining === 0 && calc.netSalary > 0;
            
            html += `
                <div class="report-card ${isPaid ? 'paid' : 'unpaid'}">
                    <div class="report-header">
                        <h5>${employee.name}</h5>
                        <span class="status-badge ${isPaid ? 'badge-success' : 'badge-warning'}">
                            ${isPaid ? '✓ Payé' : '⏳ En attente'}
                        </span>
                    </div>
                    
                    <div class="report-grid">
                        <div class="report-section">
                            <h6>Présences</h6>
                            <ul>
                                <li>Présent: ${calc.attendanceSummary.P} jours</li>
                                <li>Absent: ${calc.attendanceSummary.A} jours</li>
                                <li>Retard: ${calc.attendanceSummary.R} jours</li>
                                <li>Demi-journée: ${calc.attendanceSummary.DM} jours</li>
                                <li>Congé payé: ${calc.attendanceSummary.CP} jours</li>
                            </ul>
                        </div>
                        
                        <div class="report-section">
                            <h6>Calcul du salaire</h6>
                            <ul>
                                <li>Salaire de base: ${Utils.formatMoney(calc.baseSalary)}</li>
                                <li>Déductions: <span class="text-danger">${Utils.formatMoney(calc.deductions)}</span></li>
                                <li>Prime: <span class="text-success">${Utils.formatMoney(calc.bonus)}</span></li>
                                <li>Avances: <span class="text-warning">${Utils.formatMoney(calc.advance)}</span></li>
                                ${calc.specialAdvance > 0 || calc.unpaidSpecialAdvanceAmount > 0 ? 
                                    `<li>Avance spéciale: <span class="text-warning">${Utils.formatMoney(calc.specialAdvance)}</span>
                                    ${calc.isPotentialReport ? 
                                        `<br><small class="text-info">Report potentiel: ${Utils.formatMoney(calc.unpaidSpecialAdvanceAmount)}</small>` :
                                        (calc.unpaidSpecialAdvanceAmount > 0 ? `<br><small class="text-danger">Reporté: ${Utils.formatMoney(calc.unpaidSpecialAdvanceAmount)}</small>` : '')
                                    }
                                    </li>` : ''
                                }
                                <li><strong>Net à payer: ${Utils.formatMoney(calc.netSalary)}</strong></li>
                            </ul>
                        </div>
                        
                        <div class="report-section">
                            <h6>Paiements</h6>
                            <ul>
                                <li>Total payé: ${Utils.formatMoney(totalPaid)}</li>
                                <li>Reste à payer: <strong>${Utils.formatMoney(remaining)}</strong></li>
                            </ul>
                            ${!isPaid && calc.netSalary > 0 ? `
                                <button class="btn btn-sm btn-primary" 
                                    onclick="Salary.showSalaryPaymentModal('${employee._id || employee.id}', '${targetMonth}', ${remaining})">
                                    💵 Payer maintenant
                                </button>
                            ` : ''}
                        </div>
                    </div>
                    
                    ${details.specialAdvance ? `
                        <div class="report-special-advance">
                            <h6>📅 Détails de l'avance spéciale</h6>
                            <p>
                                Prêt total: ${Utils.formatMoney(details.specialAdvance.totalLoan)}<br>
                                Échéance du mois: ${Utils.formatMoney(details.specialAdvance.monthlyDue)}<br>
                                ${details.specialAdvance.isPotential && isCurrentMonth ? 
                                    `<span class="text-info">⏳ Report potentiel: ${Utils.formatMoney(details.specialAdvance.unpaid)}</span>` :
                                    (details.specialAdvance.unpaid > 0 ? 
                                        `<span class="text-danger">Montant reporté: ${Utils.formatMoney(details.specialAdvance.unpaid)}</span>` : 
                                        '<span class="text-success">Échéance payée</span>'
                                    )
                                }
                            </p>
                        </div>
                    ` : ''}
                    
                    <div class="report-actions">
                        <button class="btn btn-sm btn-secondary" 
                            onclick="Salary.printPayslip('${employee._id || employee.id}', '${targetMonth}')">
                            📄 Fiche de paie
                        </button>
                    </div>
                </div>
            `;
        }
        
        html += '</div>';
        container.innerHTML = html;
    },
    
    // NOUVELLE MÉTHODE : Traiter les reports en fin de mois
    processEndOfMonthReports: async function(month) {
        // Cette méthode doit être appelée à la fin du mois pour convertir
        // les reports potentiels en reports réels
        console.log(`Traitement des reports pour ${month}...`);
        
        let reportsCount = 0;
        let totalReported = 0;
        
        for (const employee of Employees.list) {
            const calc = await this.calculateAsync(employee, month);
            
            // Si on a un report potentiel (mois en cours), le transformer en report réel
            if (calc.isPotentialReport && calc.unpaidSpecialAdvanceAmount > 0) {
                console.log(`Conversion du report potentiel pour ${employee.name}: ${calc.unpaidSpecialAdvanceAmount}`);
                
                // Sauvegarder le report
                await this.handleUnpaidSpecialAdvance(
                    employee._id || employee.id, 
                    month, 
                    calc.unpaidSpecialAdvanceAmount
                );
                
                reportsCount++;
                totalReported += calc.unpaidSpecialAdvanceAmount;
            }
        }
        
        if (reportsCount > 0) {
            notify.success(
                `Fin du mois ${Utils.formatMonth(month)}: ` +
                `${reportsCount} report(s) traité(s), total: ${Utils.formatMoney(totalReported)}`
            );
        }
        
        return { reportsCount, totalReported };
    }
};

// Rendre disponible globalement
window.Salary = Salary;