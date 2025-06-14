// Fonctions utilitaires réutilisables - VERSION 2.0 AVEC EXPORT
const Utils = {
    // Formater un nombre en Ariary
    formatMoney: function(amount) {
        return new Intl.NumberFormat('fr-MG').format(amount) + ' Ar';
    },
    
    // Formater une date en français
    formatDate: function(date) {
        return new Date(date).toLocaleDateString('fr-FR');
    },
    
    // Formater un mois (2024-01 → Janvier 2024)
    formatMonth: function(yearMonth) {
        const [year, month] = yearMonth.split('-');
        const months = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 
                       'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
        return months[parseInt(month) - 1] + ' ' + year;
    },
    
    // Obtenir le mois actuel (format: 2024-01)
    getCurrentMonth: function() {
        return new Date().toISOString().slice(0, 7);
    },
    
    // Obtenir la date actuelle (format: 2024-01-15)
    getCurrentDate: function() {
        return new Date().toISOString().slice(0, 10);
    },
    
    // Calculer le nombre de jours entre deux dates
    getDaysBetween: function(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays + 1; // +1 pour inclure les deux jours
    },
    
    // Générer un ID unique
    generateId: function() {
        return Date.now().toString() + Math.random().toString(36).substr(2, 9);
    },
    
    // Afficher une notification
    notify: function(message, type = 'success') {
        // On créera le système de notification plus tard
        console.log(`[${type.toUpperCase()}] ${message}`);
        
        // Pour l'instant, on utilise une div simple
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 5px;
            color: white;
            font-weight: bold;
            z-index: 9999;
            animation: slideIn 0.3s ease;
        `;
        
        // Couleurs selon le type
        const colors = {
            success: '#28a745',
            error: '#dc3545',
            info: '#17a2b8',
            warning: '#ffc107'
        };
        notification.style.backgroundColor = colors[type] || colors.info;
        
        document.body.appendChild(notification);
        
        // Supprimer après 3 secondes
        setTimeout(() => {
            notification.remove();
        }, 3000);
    },
    
    // Confirmer une action
    confirm: async function(message) {
        return window.confirm(message);
    },
    
    // Calculer le salaire journalier
    getDailySalary: function(monthlySalary) {
        return monthlySalary / CONFIG.salary.workDaysPerMonth;
    },
    
    // Vérifier si une date est valide
    isValidDate: function(dateString) {
        const date = new Date(dateString);
        return date instanceof Date && !isNaN(date);
    },
    
    // Sauvegarder une préférence
    savePreference: function(key, value) {
        localStorage.setItem(`malaza_${key}`, JSON.stringify(value));
    },
    
    // Charger une préférence
    loadPreference: function(key, defaultValue = null) {
        const stored = localStorage.getItem(`malaza_${key}`);
        return stored ? JSON.parse(stored) : defaultValue;
    },
    
    // ===== NOUVELLES FONCTIONS D'EXPORT =====
    
    // Export vers PDF
    exportToPDF: async function(data) {
        try {
            notify.info('Génération du PDF...');
            
            // Créer le contenu HTML pour le PDF
            const htmlContent = this.generatePDFContent(data);
            
            // Créer une nouvelle fenêtre pour l'impression
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>${data.title || 'Rapport MALAZA BE'}</title>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            margin: 20px;
                            color: #333;
                        }
                        .header {
                            text-align: center;
                            margin-bottom: 30px;
                            border-bottom: 2px solid #007bff;
                            padding-bottom: 20px;
                        }
                        .company-name {
                            font-size: 24px;
                            font-weight: bold;
                            color: #007bff;
                        }
                        .report-title {
                            font-size: 18px;
                            margin-top: 10px;
                        }
                        .section {
                            margin-bottom: 25px;
                        }
                        .section-title {
                            font-size: 16px;
                            font-weight: bold;
                            margin-bottom: 10px;
                            color: #495057;
                        }
                        table {
                            width: 100%;
                            border-collapse: collapse;
                            margin-bottom: 20px;
                        }
                        th, td {
                            border: 1px solid #dee2e6;
                            padding: 8px;
                            text-align: left;
                        }
                        th {
                            background-color: #e9ecef;
                            font-weight: bold;
                        }
                        .total-row {
                            font-weight: bold;
                            background-color: #f8f9fa;
                        }
                        .amount {
                            text-align: right;
                        }
                        .text-danger { color: #dc3545; }
                        .text-success { color: #28a745; }
                        .text-warning { color: #ffc107; }
                        .text-primary { color: #007bff; }
                        .summary-box {
                            background-color: #f8f9fa;
                            padding: 15px;
                            border-radius: 5px;
                            margin-bottom: 20px;
                        }
                        .footer {
                            text-align: center;
                            margin-top: 40px;
                            font-size: 12px;
                            color: #6c757d;
                        }
                        @media print {
                            body { margin: 0; }
                            .page-break { page-break-after: always; }
                        }
                    </style>
                </head>
                <body>
                    ${htmlContent}
                </body>
                </html>
            `);
            
            printWindow.document.close();
            printWindow.focus();
            
            // Attendre un peu avant d'imprimer
            setTimeout(() => {
                printWindow.print();
                notify.success('PDF prêt à être imprimé/enregistré');
            }, 500);
            
        } catch (error) {
            console.error('Erreur export PDF:', error);
            notify.error('Erreur lors de la génération du PDF');
        }
    },
    
    // Générer le contenu HTML pour le PDF
    generatePDFContent: function(data) {
        let html = `
            <div class="header">
                <div class="company-name">🏢 MALAZA BE</div>
                <div class="report-title">${data.title || 'Rapport'}</div>
                <div>Généré le ${this.formatDate(new Date())}</div>
            </div>
        `;
        
        // Si c'est un rapport d'employé
        if (data.type === 'employee_report') {
            html += this.generateEmployeePDFContent(data);
        }
        // Si c'est un rapport de synthèse
        else if (data.type === 'summary_report') {
            html += this.generateSummaryPDFContent(data);
        }
        // Si c'est une liste de paiements
        else if (data.type === 'payments_report') {
            html += this.generatePaymentsPDFContent(data);
        }
        
        html += `
            <div class="footer">
                Document généré automatiquement par MALAZA BE v${CONFIG.version}<br>
                © 2024 - Gestion des salaires
            </div>
        `;
        
        return html;
    },
    
    // Générer le PDF pour un rapport d'employé
    generateEmployeePDFContent: function(data) {
        let html = '';
        
        data.employees.forEach(emp => {
            html += `
                <div class="section">
                    <div class="section-title">${emp.name} - ${emp.position}</div>
                    
                    <table>
                        <thead>
                            <tr>
                                <th>Mois</th>
                                <th>Salaire de base</th>
                                <th>Déductions</th>
                                <th>Primes</th>
                                <th>Avances</th>
                                <th>Net à payer</th>
                                <th>Statut</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${emp.monthlyData.map(month => `
                                <tr>
                                    <td>${this.formatMonth(month.month)}</td>
                                    <td class="amount">${this.formatMoney(month.baseSalary)}</td>
                                    <td class="amount text-danger">${this.formatMoney(month.deductions)}</td>
                                    <td class="amount text-success">${this.formatMoney(month.bonus)}</td>
                                    <td class="amount text-warning">${this.formatMoney(month.advances)}</td>
                                    <td class="amount text-primary">${this.formatMoney(month.net)}</td>
                                    <td>${month.isPaid ? '✓ Payé' : '⏳ En attente'}</td>
                                </tr>
                            `).join('')}
                            <tr class="total-row">
                                <td>TOTAL</td>
                                <td class="amount">${this.formatMoney(emp.totals.salaries)}</td>
                                <td class="amount text-danger">${this.formatMoney(emp.totals.deductions)}</td>
                                <td class="amount text-success">${this.formatMoney(emp.totals.bonuses)}</td>
                                <td class="amount text-warning">${this.formatMoney(emp.totals.advances)}</td>
                                <td class="amount text-primary">${this.formatMoney(emp.totals.net)}</td>
                                <td></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            `;
        });
        
        return html;
    },
    
    // Export vers Excel
    exportToExcel: async function(data) {
        try {
            notify.info('Génération du fichier Excel...');
            
            // Créer le contenu CSV (compatible Excel)
            let csvContent = '';
            
            // Ajouter l'en-tête
            csvContent += 'MALAZA BE - ' + (data.title || 'Rapport') + '\n';
            csvContent += 'Généré le ' + this.formatDate(new Date()) + '\n\n';
            
            if (data.type === 'employee_report') {
                csvContent += this.generateEmployeeCSV(data);
            } else if (data.type === 'summary_report') {
                csvContent += this.generateSummaryCSV(data);
            } else if (data.type === 'payments_report') {
                csvContent += this.generatePaymentsCSV(data);
            }
            
            // Convertir en Blob avec BOM pour Excel
            const BOM = '\uFEFF';
            const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
            
            // Créer le lien de téléchargement
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `malaza_${data.type}_${new Date().toISOString().split('T')[0]}.csv`;
            link.click();
            
            notify.success('Fichier Excel généré avec succès');
            
        } catch (error) {
            console.error('Erreur export Excel:', error);
            notify.error('Erreur lors de la génération du fichier Excel');
        }
    },
    
    // Générer CSV pour rapport d'employé
    generateEmployeeCSV: function(data) {
        let csv = '';
        
        data.employees.forEach(emp => {
            csv += `\n${emp.name} - ${emp.position}\n`;
            csv += 'Mois,Salaire de base,Déductions,Primes,Avances,Avance spéciale,Net à payer,Payé,Reste\n';
            
            emp.monthlyData.forEach(month => {
                csv += `${this.formatMonth(month.month)},`;
                csv += `${month.baseSalary},`;
                csv += `${month.deductions},`;
                csv += `${month.bonus},`;
                csv += `${month.advances},`;
                csv += `${month.specialAdvance || 0},`;
                csv += `${month.net},`;
                csv += `${month.paid},`;
                csv += `${month.remaining}\n`;
            });
            
            // Totaux
            csv += `TOTAL,${emp.totals.salaries},${emp.totals.deductions},`;
            csv += `${emp.totals.bonuses},${emp.totals.advances},`;
            csv += `${emp.totals.specialAdvances || 0},${emp.totals.net},`;
            csv += `${emp.totals.paid},${emp.totals.remaining}\n`;
        });
        
        return csv;
    },
    
    // Générer CSV pour synthèse
    generateSummaryCSV: function(data) {
        let csv = 'Employé,Salaires totaux,Déductions,Primes,Avances,Net total,Payé,Reste à payer\n';
        
        data.summary.forEach(emp => {
            csv += `${emp.name},`;
            csv += `${emp.totalSalaries},`;
            csv += `${emp.totalDeductions},`;
            csv += `${emp.totalBonuses},`;
            csv += `${emp.totalAdvances},`;
            csv += `${emp.totalNet},`;
            csv += `${emp.totalPaid},`;
            csv += `${emp.totalRemaining}\n`;
        });
        
        // Ligne de total
        csv += `\nTOTAL GÉNÉRAL,`;
        csv += `${data.globalTotals.salaries},`;
        csv += `${data.globalTotals.deductions},`;
        csv += `${data.globalTotals.bonuses},`;
        csv += `${data.globalTotals.advances},`;
        csv += `${data.globalTotals.net},`;
        csv += `${data.globalTotals.paid},`;
        csv += `${data.globalTotals.remaining}\n`;
        
        return csv;
    },
    
    // Générer CSV pour paiements
    generatePaymentsCSV: function(data) {
        let csv = 'Date,Employé,Type,Description,Mode,Montant\n';
        
        data.payments.forEach(payment => {
            csv += `${this.formatDate(payment.date)},`;
            csv += `${payment.employeeName},`;
            csv += `${payment.type},`;
            csv += `"${payment.description || ''}",`;
            csv += `${payment.method},`;
            csv += `${payment.amount}\n`;
        });
        
        // Totaux par type
        csv += '\n\nRésumé par type\n';
        csv += 'Type,Nombre,Montant total\n';
        
        Object.entries(data.totals.byType).forEach(([type, info]) => {
            csv += `${info.label},${info.count},${info.amount}\n`;
        });
        
        csv += `\nTOTAL GÉNÉRAL,,${data.totals.total}\n`;
        
        return csv;
    },
    
    // NOUVELLE FONCTION: Exporter vers JSON (pour analyses externes)
    exportToJSON: function(data, filename) {
        try {
            const jsonStr = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json' });
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = filename || `malaza_export_${new Date().toISOString().split('T')[0]}.json`;
            link.click();
            
            notify.success('Données exportées en JSON');
        } catch (error) {
            console.error('Erreur export JSON:', error);
            notify.error('Erreur lors de l\'export JSON');
        }
    },
    
    // NOUVELLE FONCTION: Générer un graphique simple (pour les rapports)
    generateSimpleChart: function(data, type = 'bar') {
        // Génère un graphique SVG simple pour les rapports
        const width = 600;
        const height = 300;
        const margin = { top: 20, right: 20, bottom: 40, left: 60 };
        
        let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;
        
        // Fond
        svg += `<rect width="${width}" height="${height}" fill="#f8f9fa"/>`;
        
        // Titre
        svg += `<text x="${width/2}" y="${margin.top}" text-anchor="middle" font-size="16" font-weight="bold">`;
        svg += data.title || 'Graphique';
        svg += '</text>';
        
        // Corps du graphique selon le type
        if (type === 'bar') {
            svg += this.drawBarChart(data, width, height, margin);
        }
        
        svg += '</svg>';
        
        return svg;
    },
    
    // Dessiner un graphique en barres
    drawBarChart: function(data, width, height, margin) {
        const chartWidth = width - margin.left - margin.right;
        const chartHeight = height - margin.top - margin.bottom;
        const barWidth = chartWidth / data.values.length;
        
        const maxValue = Math.max(...data.values.map(v => v.value));
        const scale = chartHeight / maxValue;
        
        let bars = '';
        
        data.values.forEach((item, index) => {
            const barHeight = item.value * scale;
            const x = margin.left + (index * barWidth) + (barWidth * 0.1);
            const y = margin.top + chartHeight - barHeight;
            const w = barWidth * 0.8;
            
            // Barre
            bars += `<rect x="${x}" y="${y}" width="${w}" height="${barHeight}" fill="#007bff" opacity="0.8"/>`;
            
            // Valeur
            bars += `<text x="${x + w/2}" y="${y - 5}" text-anchor="middle" font-size="12">`;
            bars += this.formatMoney(item.value);
            bars += '</text>';
            
            // Label
            bars += `<text x="${x + w/2}" y="${height - 5}" text-anchor="middle" font-size="11">`;
            bars += item.label;
            bars += '</text>';
        });
        
        return bars;
    },
    
    // NOUVELLE FONCTION: Créer un résumé imprimable
    createPrintableSummary: function(data) {
        const summary = document.createElement('div');
        summary.id = 'printable-summary';
        summary.style.display = 'none';
        
        summary.innerHTML = `
            <style>
                @media print {
                    body * { visibility: hidden; }
                    #printable-summary, #printable-summary * { visibility: visible; }
                    #printable-summary { 
                        position: absolute; 
                        left: 0; 
                        top: 0;
                        width: 100%;
                        padding: 20px;
                    }
                }
            </style>
            ${this.generatePDFContent(data)}
        `;
        
        document.body.appendChild(summary);
        window.print();
        
        // Nettoyer après impression
        setTimeout(() => {
            summary.remove();
        }, 1000);
    }
};

// Raccourcis pour les notifications
const notify = {
    success: (msg) => Utils.notify(msg, 'success'),
    error: (msg) => Utils.notify(msg, 'error'),
    info: (msg) => Utils.notify(msg, 'info'),
    warning: (msg) => Utils.notify(msg, 'warning')
};

// Rendre disponible globalement
window.Utils = Utils;
window.notify = notify;