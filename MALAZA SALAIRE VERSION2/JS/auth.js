// Gestion de l'authentification avec interface moderne
const Auth = {
    // Code PIN par défaut (à changer !)
    DEFAULT_PIN: '1234',
    
    // Clé de stockage
    STORAGE_KEY: 'malaza_auth',
    
    // État de connexion
    isAuthenticated: false,
    
    // Initialiser l'authentification
    init: function() {
        // Ajouter les styles pour la page de login
        this.injectLoginStyles();
        
        // Vérifier si déjà connecté (session)
        const session = sessionStorage.getItem(this.STORAGE_KEY);
        if (session === 'authenticated') {
            this.isAuthenticated = true;
            return true;
        }
        return false;
    },
    
    // Injecter les styles spécifiques au login
    injectLoginStyles: function() {
        if (!document.getElementById('auth-styles')) {
            const style = document.createElement('style');
            style.id = 'auth-styles';
            style.innerHTML = `
                /* Reset et base pour la page de login */
                .login-page {
                    margin: 0;
                    padding: 0;
                    width: 100vw;
                    height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    position: fixed;
                    top: 0;
                    left: 0;
                    overflow: hidden;
                }
                
                /* Effet de fond animé */
                .login-page::before {
                    content: '';
                    position: absolute;
                    top: -50%;
                    left: -50%;
                    width: 200%;
                    height: 200%;
                    background: radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px);
                    background-size: 50px 50px;
                    animation: backgroundMove 20s linear infinite;
                    opacity: 0.3;
                }
                
                @keyframes backgroundMove {
                    0% { transform: translate(0, 0); }
                    100% { transform: translate(50px, 50px); }
                }
                
                /* Container principal */
                .login-container {
                    position: relative;
                    z-index: 1;
                    width: 100%;
                    max-width: 400px;
                    padding: 20px;
                }
                
                /* Carte de login */
                .login-card {
                    background: rgba(255, 255, 255, 0.95);
                    backdrop-filter: blur(10px);
                    border-radius: 20px;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                    padding: 40px;
                    transform: translateY(0);
                    transition: all 0.3s ease;
                }
                
                .login-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 25px 70px rgba(0, 0, 0, 0.35);
                }
                
                /* Header */
                .login-header {
                    text-align: center;
                    margin-bottom: 40px;
                }
                
                .login-header h1 {
                    margin: 0;
                    font-size: 2.5em;
                    color: #333;
                    font-weight: 700;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                }
                
                .login-header .logo {
                    font-size: 1.2em;
                    animation: float 3s ease-in-out infinite;
                }
                
                @keyframes float {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-10px); }
                }
                
                .login-header p {
                    margin: 10px 0 0;
                    color: #666;
                    font-size: 1.1em;
                }
                
                /* Formulaire */
                .login-form {
                    margin: 0;
                }
                
                .login-form .form-group {
                    margin-bottom: 25px;
                }
                
                .login-form label {
                    display: block;
                    margin-bottom: 8px;
                    color: #333;
                    font-weight: 600;
                    font-size: 0.95em;
                }
                
                .login-form .form-control {
                    width: 100%;
                    padding: 15px 20px;
                    border: 2px solid #e0e0e0;
                    border-radius: 10px;
                    font-size: 1.1em;
                    transition: all 0.3s ease;
                    background: #f8f9fa;
                    box-sizing: border-box;
                }
                
                .login-form .form-control:focus {
                    outline: none;
                    border-color: #667eea;
                    background: white;
                    box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
                }
                
                /* Input PIN avec style spécial */
                #pin {
                    text-align: center;
                    letter-spacing: 10px;
                    font-size: 1.5em;
                    font-weight: bold;
                }
                
                .form-text {
                    display: block;
                    margin-top: 8px;
                    color: #888;
                    font-size: 0.85em;
                    text-align: center;
                }
                
                /* Bouton de connexion */
                .btn-login {
                    width: 100%;
                    padding: 15px;
                    border: none;
                    border-radius: 10px;
                    font-size: 1.1em;
                    font-weight: 600;
                    color: white;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    cursor: pointer;
                    transition: all 0.3s ease;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    position: relative;
                    overflow: hidden;
                }
                
                .btn-login::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: -100%;
                    width: 100%;
                    height: 100%;
                    background: rgba(255, 255, 255, 0.2);
                    transition: left 0.5s ease;
                }
                
                .btn-login:hover::before {
                    left: 100%;
                }
                
                .btn-login:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
                }
                
                .btn-login:active {
                    transform: translateY(0);
                }
                
                /* Footer */
                .login-footer {
                    text-align: center;
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 1px solid #e0e0e0;
                }
                
                .login-footer p {
                    margin: 0;
                    color: #888;
                    font-size: 0.9em;
                }
                
                /* Icônes et décorations */
                .pin-icon {
                    display: inline-block;
                    width: 60px;
                    height: 60px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border-radius: 50%;
                    margin: 0 auto 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.5em;
                    color: white;
                    box-shadow: 0 10px 30px rgba(102, 126, 234, 0.3);
                }
                
                /* Animations */
                @keyframes fadeIn {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                
                .login-card {
                    animation: fadeIn 0.6s ease-out;
                }
                
                /* Responsive */
                @media (max-width: 480px) {
                    .login-container {
                        padding: 10px;
                    }
                    
                    .login-card {
                        padding: 30px 20px;
                    }
                    
                    .login-header h1 {
                        font-size: 2em;
                    }
                    
                    #pin {
                        font-size: 1.3em;
                        letter-spacing: 8px;
                    }
                }
                
                /* Mode sombre (optionnel) */
                @media (prefers-color-scheme: dark) {
                    .login-card {
                        background: rgba(30, 30, 30, 0.95);
                        color: #fff;
                    }
                    
                    .login-header h1,
                    .login-form label {
                        color: #fff;
                    }
                    
                    .login-header p,
                    .form-text,
                    .login-footer p {
                        color: #aaa;
                    }
                    
                    .login-form .form-control {
                        background: #2a2a2a;
                        border-color: #444;
                        color: #fff;
                    }
                    
                    .login-form .form-control:focus {
                        border-color: #667eea;
                        background: #333;
                    }
                }
            `;
            document.head.appendChild(style);
        }
    },
    
    // Obtenir le code PIN sauvegardé
    getSavedPIN: function() {
        const saved = Utils.loadPreference('pin');
        return saved || this.DEFAULT_PIN;
    },
    
    // Changer le code PIN
    changePIN: async function(currentPIN, newPIN) {
        // Vérifier le PIN actuel
        if (currentPIN !== this.getSavedPIN()) {
            notify.error('Code PIN actuel incorrect');
            return false;
        }
        
        // Valider le nouveau PIN
        if (!newPIN || newPIN.length < 4) {
            notify.error('Le nouveau code PIN doit contenir au moins 4 chiffres');
            return false;
        }
        
        // Sauvegarder
        Utils.savePreference('pin', newPIN);
        notify.success('Code PIN modifié avec succès');
        return true;
    },
    
    // Vérifier le code PIN
    verifyPIN: function(pin) {
        return pin === this.getSavedPIN();
    },
    
    // Se connecter
    login: function(pin) {
        if (this.verifyPIN(pin)) {
            this.isAuthenticated = true;
            sessionStorage.setItem(this.STORAGE_KEY, 'authenticated');
            notify.success('Connexion réussie !');
            return true;
        } else {
            notify.error('Code PIN incorrect');
            // Secouer le formulaire en cas d'erreur
            const card = document.querySelector('.login-card');
            if (card) {
                card.style.animation = 'shake 0.5s';
                setTimeout(() => {
                    card.style.animation = '';
                }, 500);
            }
            return false;
        }
    },
    
    // Se déconnecter
    logout: function() {
        this.isAuthenticated = false;
        sessionStorage.removeItem(this.STORAGE_KEY);
        notify.info('Déconnexion réussie');
        
        // Recharger la page pour afficher le formulaire de connexion
        setTimeout(() => {
            window.location.reload();
        }, 1000);
    },
    
    // Afficher le formulaire de connexion
    showLoginForm: function() {
        const app = document.getElementById('app');
        
        // Ajouter l'animation de secousse
        const shakeAnimation = `
            @keyframes shake {
                0%, 100% { transform: translateX(0); }
                10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
                20%, 40%, 60%, 80% { transform: translateX(5px); }
            }
        `;
        
        if (!document.querySelector('#shake-animation')) {
            const style = document.createElement('style');
            style.id = 'shake-animation';
            style.innerHTML = shakeAnimation;
            document.head.appendChild(style);
        }
        
        app.innerHTML = `
            <div class="login-page">
                <div class="login-container">
                    <div class="login-card">
                        <div class="login-header">
                            <div class="pin-icon">🔐</div>
                            <h1>
                                <span class="logo">🏢</span>
                                MALAZA BE
                            </h1>
                            <p>Gestion des Salaires</p>
                        </div>
                        
                        <form id="loginForm" class="login-form">
                            <div class="form-group">
                                <label for="pin">Code PIN</label>
                                <input 
                                    type="password" 
                                    id="pin" 
                                    class="form-control" 
                                    placeholder="••••"
                                    maxlength="10"
                                    autocomplete="off"
                                    required
                                >
                                <small class="form-text">Code par défaut : 1234</small>
                            </div>
                            
                            <button type="submit" class="btn-login">
                                Se connecter
                            </button>
                        </form>
                        
                        <div class="login-footer">
                            <p>Version ${CONFIG.version} • Développé avec ❤️</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Gérer la soumission du formulaire
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const pin = document.getElementById('pin').value;
            
            if (this.login(pin)) {
                // Animation de succès
                const card = document.querySelector('.login-card');
                card.style.transform = 'scale(0.95)';
                card.style.opacity = '0.5';
                
                setTimeout(() => {
                    // Démarrer l'application
                    App.start();
                }, 300);
            }
        });
        
        // Focus sur le champ PIN avec un délai pour l'animation
        setTimeout(() => {
            document.getElementById('pin').focus();
        }, 100);
        
        // Effet de frappe pour le placeholder
        const pinInput = document.getElementById('pin');
        pinInput.addEventListener('input', function() {
            if (this.value.length > 0) {
                this.style.letterSpacing = '15px';
            } else {
                this.style.letterSpacing = '10px';
            }
        });
    },
    
    // Afficher le modal de changement de PIN
    showChangePINModal: function() {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>🔐 Changer le code PIN</h3>
                    <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
                </div>
                
                <form id="changePINForm">
                    <div class="form-group">
                        <label>Code PIN actuel</label>
                        <input 
                            type="password" 
                            id="currentPIN" 
                            class="form-control"
                            style="text-align: center; letter-spacing: 10px; font-size: 1.2em;"
                            required
                        >
                    </div>
                    
                    <div class="form-group">
                        <label>Nouveau code PIN</label>
                        <input 
                            type="password" 
                            id="newPIN" 
                            class="form-control"
                            style="text-align: center; letter-spacing: 10px; font-size: 1.2em;"
                            minlength="4"
                            maxlength="10"
                            pattern="[0-9]+"
                            title="Le code PIN doit contenir uniquement des chiffres"
                            required
                        >
                    </div>
                    
                    <div class="form-group">
                        <label>Confirmer le nouveau code PIN</label>
                        <input 
                            type="password" 
                            id="confirmPIN" 
                            class="form-control"
                            style="text-align: center; letter-spacing: 10px; font-size: 1.2em;"
                            minlength="4"
                            maxlength="10"
                            pattern="[0-9]+"
                            required
                        >
                    </div>
                    
                    <div class="modal-footer">
                        <button type="submit" class="btn btn-primary">
                            Changer le PIN
                        </button>
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">
                            Annuler
                        </button>
                    </div>
                </form>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Gérer la soumission
        document.getElementById('changePINForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const currentPIN = document.getElementById('currentPIN').value;
            const newPIN = document.getElementById('newPIN').value;
            const confirmPIN = document.getElementById('confirmPIN').value;
            
            // Vérifier que les nouveaux PIN correspondent
            if (newPIN !== confirmPIN) {
                notify.error('Les nouveaux codes PIN ne correspondent pas');
                return;
            }
            
            // Tenter de changer le PIN
            if (await this.changePIN(currentPIN, newPIN)) {
                modal.remove();
            }
        });
        
        // Focus sur le premier champ
        document.getElementById('currentPIN').focus();
    }
};

// Rendre disponible globalement
window.Auth = Auth;