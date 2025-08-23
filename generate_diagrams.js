import fs from 'fs';

// Créer un fichier HTML avec des diagrammes visuels modernes
const htmlContent = `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Diagrammes Système de Verrouillage Collaboratif</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 20px;
            background-color: #f8f9fa;
            color: #333;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        h1 {
            color: #2c3e50;
            text-align: center;
            border-bottom: 3px solid #3498db;
            padding-bottom: 15px;
            margin-bottom: 30px;
        }
        
        h2 {
            color: #34495e;
            border-left: 4px solid #3498db;
            padding-left: 15px;
            margin-top: 40px;
            margin-bottom: 20px;
        }
        
        .diagram-container {
            background: #f8f9fa;
            border: 2px solid #e9ecef;
            border-radius: 8px;
            padding: 25px;
            margin: 20px 0;
            position: relative;
        }
        
        .flow-diagram {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin: 20px 0;
            flex-wrap: wrap;
        }
        
        .node {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 20px;
            border-radius: 10px;
            text-align: center;
            min-width: 120px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            position: relative;
            margin: 10px;
        }
        
        .node.pc1 {
            background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
        }
        
        .node.pc2 {
            background: linear-gradient(135deg, #fc466b 0%, #3f5efb 100%);
        }
        
        .node.supabase {
            background: linear-gradient(135deg, #3ecf8e 0%, #3ecf8e 100%);
        }
        
        .node.local {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        }
        
        .arrow {
            font-size: 24px;
            color: #3498db;
            margin: 0 15px;
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.2); }
            100% { transform: scale(1); }
        }
        
        .step {
            background: #e8f4fd;
            border: 1px solid #bee5eb;
            border-radius: 8px;
            padding: 15px;
            margin: 10px 0;
            position: relative;
        }
        
        .step::before {
            content: "→";
            position: absolute;
            left: -10px;
            top: 50%;
            transform: translateY(-50%);
            background: #3498db;
            color: white;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
        }
        
        .step-number {
            background: #3498db;
            color: white;
            padding: 5px 10px;
            border-radius: 15px;
            font-size: 12px;
            font-weight: bold;
            margin-right: 10px;
        }
        
        .status {
            display: inline-block;
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            margin: 5px;
        }
        
        .status.control {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        
        .status.readonly {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
        
        .status.loading {
            background: #fff3cd;
            color: #856404;
            border: 1px solid #ffeaa7;
        }
        
        .status.success {
            background: #d1ecf1;
            color: #0c5460;
            border: 1px solid #bee5eb;
        }
        
        .flow-steps {
            display: flex;
            flex-direction: column;
            gap: 15px;
            margin: 20px 0;
        }
        
        .flow-step {
            background: white;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            padding: 15px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .flow-step h4 {
            margin: 0 0 10px 0;
            color: #495057;
            font-size: 16px;
        }
        
        .flow-step p {
            margin: 5px 0;
            color: #6c757d;
        }
        
        .summary-box {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 10px;
            margin: 20px 0;
        }
        
        .summary-box h3 {
            margin: 0 0 15px 0;
            text-align: center;
        }
        
        .summary-list {
            list-style: none;
            padding: 0;
        }
        
        .summary-list li {
            padding: 8px 0;
            border-bottom: 1px solid rgba(255,255,255,0.2);
        }
        
        .summary-list li:last-child {
            border-bottom: none;
        }
        
        .icon {
            font-size: 20px;
            margin-right: 10px;
        }
        
        @media print {
            body {
                background: white;
                margin: 0;
                padding: 10px;
            }
            
            .container {
                box-shadow: none;
                border: 1px solid #ccc;
            }
            
            .diagram-container {
                page-break-inside: avoid;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔒 DIAGRAMMES DU SYSTÈME DE VERROUILLAGE COLLABORATIF</h1>
        
        <div class="summary-box">
            <h3>📋 Vue d'ensemble du système</h3>
            <p><strong>Système de verrouillage global : Un seul PC peut avoir le contrôle à la fois</strong></p>
            <p>Ce système garantit la cohérence des données en empêchant les modifications simultanées de plusieurs utilisateurs.</p>
        </div>

        <h2>🔄 1. FLUX PRINCIPAL : Connexion de PC1 et PC2</h2>
        <div class="diagram-container">
            <div class="flow-diagram">
                <div class="node pc1">
                    <strong>PC1</strong><br>
                    Démarrage
                </div>
                <div class="arrow">→</div>
                <div class="node supabase">
                    <strong>Supabase</strong><br>
                    Vérification<br>du verrou
                </div>
                <div class="arrow">→</div>
                <div class="node pc2">
                    <strong>PC2</strong><br>
                    Démarrage
                </div>
            </div>
            
            <div class="flow-steps">
                <div class="flow-step">
                    <h4>Étape 1 : Vérification initiale</h4>
                    <p><span class="step-number">1</span>PC1 et PC2 vérifient simultanément s'il existe un verrou global dans Supabase</p>
                    <p><span class="step-number">2</span>Aucun verrou n'existe au démarrage</p>
                </div>
                
                <div class="flow-step">
                    <h4>Étape 2 : Tentative d'acquisition</h4>
                    <p><span class="step-number">3</span>PC1 et PC2 tentent d'acquérir le verrou en même temps</p>
                    <p><span class="step-number">4</span>PC1 réussit à acquérir le verrou (premier arrivé)</p>
                    <p><span class="step-number">5</span>PC2 échoue et passe en mode lecture seule</p>
                </div>
                
                <div class="flow-step">
                    <h4>Résultat final</h4>
                    <p><span class="status control">PC1 : Contrôle complet</span></p>
                    <p><span class="status readonly">PC2 : Lecture seule</span></p>
                </div>
            </div>
        </div>

        <h2>🔓 2. FLUX DE LIBÉRATION NORMALE</h2>
        <div class="diagram-container">
            <div class="flow-diagram">
                <div class="node pc1">
                    <strong>PC1</strong><br>
                    <span class="status control">Contrôle</span>
                </div>
                <div class="arrow">→</div>
                <div class="node supabase">
                    <strong>Supabase</strong><br>
                    Sauvegarde<br>+ Libération
                </div>
                <div class="arrow">→</div>
                <div class="node pc2">
                    <strong>PC2</strong><br>
                    <span class="status readonly">Lecture seule</span>
                </div>
            </div>
            
            <div class="flow-steps">
                <div class="flow-step">
                    <h4>Étape 1 : Demande de libération</h4>
                    <p><span class="step-number">1</span>L'utilisateur clique sur "Relâcher la main" sur PC1</p>
                    <p><span class="step-number">2</span>Le système sauvegarde automatiquement toutes les données dans Supabase</p>
                </div>
                
                <div class="flow-step">
                    <h4>Étape 2 : Libération du verrou</h4>
                    <p><span class="step-number">3</span>Le verrou global est supprimé de la base de données</p>
                    <p><span class="step-number">4</span>PC1 passe automatiquement en mode lecture seule</p>
                </div>
                
                <div class="flow-step">
                    <h4>Étape 3 : Transfert du contrôle</h4>
                    <p><span class="step-number">5</span>PC2 détecte la libération du verrou</p>
                    <p><span class="step-number">6</span>PC2 acquiert automatiquement le contrôle</p>
                </div>
                
                <div class="flow-step">
                    <h4>Résultat final</h4>
                    <p><span class="status readonly">PC1 : Lecture seule</span></p>
                    <p><span class="status control">PC2 : Contrôle complet</span></p>
                </div>
            </div>
        </div>

        <h2>🚨 3. FLUX DE FORCE LIBÉRATION</h2>
        <div class="diagram-container">
            <div class="flow-diagram">
                <div class="node pc2">
                    <strong>PC2</strong><br>
                    <span class="status readonly">Lecture seule</span>
                </div>
                <div class="arrow">→</div>
                <div class="node supabase">
                    <strong>Supabase</strong><br>
                    Notification<br>force release
                </div>
                <div class="arrow">→</div>
                <div class="node pc1">
                    <strong>PC1</strong><br>
                    <span class="status control">Contrôle</span>
                </div>
            </div>
            
            <div class="flow-steps">
                <div class="flow-step">
                    <h4>Étape 1 : Demande de force libération</h4>
                    <p><span class="step-number">1</span>L'utilisateur clique sur "Forcer la libération" sur PC2</p>
                    <p><span class="step-number">2</span>Une notification est créée dans Supabase</p>
                </div>
                
                <div class="flow-step">
                    <h4>Étape 2 : Détection par PC1</h4>
                    <p><span class="step-number">3</span>PC1 détecte automatiquement la demande de force libération</p>
                    <p><span class="step-number">4</span>PC1 sauvegarde automatiquement ses données</p>
                </div>
                
                <div class="flow-step">
                    <h4>Étape 3 : Libération forcée</h4>
                    <p><span class="step-number">5</span>PC1 libère automatiquement le verrou</p>
                    <p><span class="step-number">6</span>PC2 acquiert le contrôle</p>
                </div>
                
                <div class="flow-step">
                    <h4>Résultat final</h4>
                    <p><span class="status readonly">PC1 : Lecture seule</span></p>
                    <p><span class="status control">PC2 : Contrôle complet</span></p>
                </div>
            </div>
        </div>

        <h2>🔐 4. FLUX DE DÉVERROUILLAGE D'URGENCE</h2>
        <div class="diagram-container">
            <div class="flow-diagram">
                <div class="node pc2">
                    <strong>PC2</strong><br>
                    <span class="status readonly">Lecture seule</span>
                </div>
                <div class="arrow">→</div>
                <div class="node supabase">
                    <strong>Supabase</strong><br>
                    Code JJMM<br>Validation
                </div>
                <div class="arrow">→</div>
                <div class="node pc1">
                    <strong>PC1</strong><br>
                    <span class="status control">Contrôle</span>
                </div>
            </div>
            
            <div class="flow-steps">
                <div class="flow-step">
                    <h4>Étape 1 : Demande d'urgence</h4>
                    <p><span class="step-number">1</span>L'utilisateur clique sur "Déverrouillage d'urgence" sur PC2</p>
                    <p><span class="step-number">2</span>Saisie du code de sécurité (JJMM, ex: 2701 pour 27 janvier)</p>
                </div>
                
                <div class="flow-step">
                    <h4>Étape 2 : Validation du code</h4>
                    <p><span class="step-number">3</span>Le système vérifie que le code correspond à la date du jour</p>
                    <p><span class="step-number">4</span>Si valide, suppression directe du verrou sans notification</p>
                </div>
                
                <div class="flow-step">
                    <h4>Étape 3 : Prise de contrôle immédiate</h4>
                    <p><span class="step-number">5</span>Création d'un nouveau verrou pour PC2 avec marqueur d'urgence</p>
                    <p><span class="step-number">6</span>PC1 détecte immédiatement la perte du contrôle</p>
                </div>
                
                <div class="flow-step">
                    <h4>Résultat final</h4>
                    <p><span class="status readonly">PC1 : Lecture seule (forcée)</span></p>
                    <p><span class="status control">PC2 : Contrôle complet (urgence)</span></p>
                </div>
            </div>
        </div>

        <h2>💾 5. FLUX DE SAUVEGARDE ET RESTAURATION</h2>
        <div class="diagram-container">
            <div class="flow-diagram">
                <div class="node pc1">
                    <strong>PC1</strong><br>
                    <span class="status control">Contrôle</span>
                </div>
                <div class="arrow">→</div>
                <div class="node supabase">
                    <strong>Supabase</strong><br>
                    Sauvegarde<br>automatique
                </div>
                <div class="arrow">→</div>
                <div class="node pc2">
                    <strong>PC2</strong><br>
                    <span class="status readonly">Lecture seule</span>
                </div>
            </div>
            
            <div class="flow-steps">
                <div class="flow-step">
                    <h4>Sauvegarde automatique</h4>
                    <p><span class="step-number">1</span>Toutes les 3 minutes, PC1 sauvegarde automatiquement dans Supabase</p>
                    <p><span class="step-number">2</span>Sauvegarde manuelle possible via le bouton "Sauvegarder"</p>
                    <p><span class="step-number">3</span>Sauvegarde automatique lors de la libération du verrou</p>
                </div>
                
                <div class="flow-step">
                    <h4>Restauration automatique</h4>
                    <p><span class="step-number">4</span>Quand PC2 acquiert le contrôle, il restaure automatiquement depuis Supabase</p>
                    <p><span class="step-number">5</span>Vérification de la fraîcheur des données</p>
                    <p><span class="step-number">6</span>Mise à jour de l'indicateur de fraîcheur</p>
                </div>
                
                <div class="flow-step">
                    <h4>Indicateurs de fraîcheur</h4>
                    <p><span class="status loading">🔄 Loading : Restauration en cours</span></p>
                    <p><span class="status success">📊 Supabase : Données fraîches</span></p>
                    <p><span class="status readonly">💾 Local : Données locales</span></p>
                </div>
            </div>
        </div>

        <h2>⏱️ 6. VÉRIFICATION PÉRIODIQUE</h2>
        <div class="diagram-container">
            <div class="flow-diagram">
                <div class="node pc1">
                    <strong>PC1</strong><br>
                    <span class="status control">Contrôle</span><br>
                    Toutes les 5s
                </div>
                <div class="arrow">→</div>
                <div class="node supabase">
                    <strong>Supabase</strong><br>
                    Heartbeat<br>+ Vérification
                </div>
                <div class="arrow">→</div>
                <div class="node pc2">
                    <strong>PC2</strong><br>
                    <span class="status readonly">Lecture seule</span><br>
                    Toutes les 5s
                </div>
            </div>
            
            <div class="flow-steps">
                <div class="flow-step">
                    <h4>Vérification toutes les 5 secondes</h4>
                    <p><span class="step-number">1</span>Chaque PC vérifie l'état du verrou toutes les 5 secondes</p>
                    <p><span class="step-number">2</span>PC1 envoie un heartbeat pour maintenir le verrou</p>
                    <p><span class="step-number">3</span>PC2 détecte les changements de verrou</p>
                </div>
                
                <div class="flow-step">
                    <h4>Détection des changements</h4>
                    <p><span class="step-number">4</span>Détection automatique des déverrouillages d'urgence</p>
                    <p><span class="step-number">5</span>Détection des demandes de force libération</p>
                    <p><span class="step-number">6</span>Mise à jour immédiate de l'interface utilisateur</p>
                </div>
                
                <div class="flow-step">
                    <h4>Nettoyage automatique</h4>
                    <p><span class="step-number">7</span>Nettoyage des verrous expirés toutes les 60 secondes</p>
                    <p><span class="step-number">8</span>Protection contre les boucles infinies</p>
                </div>
            </div>
        </div>

        <h2>🔧 7. PROTECTIONS ET SÉCURITÉ</h2>
        <div class="diagram-container">
            <div class="flow-steps">
                <div class="flow-step">
                    <h4>⏳ Protection contre les boucles infinies</h4>
                    <p><span class="step-number">1</span>Délai minimum de 3 secondes entre les tentatives d'acquisition</p>
                    <p><span class="step-number">2</span>Vérification périodique réduite à 5 secondes (au lieu de 2)</p>
                    <p><span class="step-number">3</span>Flag spécial pour bypasser les délais lors d'emergency unlock</p>
                </div>
                
                <div class="flow-step">
                    <h4>🔄 Renouvellement automatique</h4>
                    <p><span class="step-number">4</span>Renouvellement automatique du verrou pour le même utilisateur</p>
                    <p><span class="step-number">5</span>Heartbeat toutes les 30 secondes pour maintenir le verrou actif</p>
                    <p><span class="step-number">6</span>Expiration automatique après 2 minutes d'inactivité</p>
                </div>
                
                <div class="flow-step">
                    <h4>🧹 Nettoyage et maintenance</h4>
                    <p><span class="step-number">7</span>Nettoyage des verrous expirés toutes les 60 secondes</p>
                    <p><span class="step-number">8</span>Synchronisation en temps réel avec détection de changements</p>
                    <p><span class="step-number">9</span>Gestion robuste des erreurs de connexion</p>
                </div>
            </div>
        </div>

        <h2>📊 8. ÉTATS POSSIBLES DU SYSTÈME</h2>
        <div class="diagram-container">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 15px;">
                <div class="flow-step">
                    <h4>🟢 États normaux</h4>
                    <p><span class="status control">PC1 Contrôle + PC2 Lecture seule</span></p>
                    <p><span class="status control">PC2 Contrôle + PC1 Lecture seule</span></p>
                </div>
                
                <div class="flow-step">
                    <h4>🟡 États transitoires</h4>
                    <p><span class="status loading">Sauvegarde en cours</span></p>
                    <p><span class="status loading">Restauration en cours</span></p>
                    <p><span class="status loading">Vérification en cours</span></p>
                </div>
                
                <div class="flow-step">
                    <h4>🔴 États d'urgence</h4>
                    <p><span class="status readonly">Déverrouillage d'urgence en cours</span></p>
                    <p><span class="status readonly">Force release en cours</span></p>
                    <p><span class="status readonly">Verrous expirés</span></p>
                </div>
            </div>
        </div>

        <h2>📱 9. INTERFACE UTILISATEUR</h2>
        <div class="diagram-container">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
                <div class="flow-step">
                    <h4>🔓 Mode Contrôle complet</h4>
                    <p>• Bouton "Relâcher la main" (sauvegarde + libération)</p>
                    <p>• Indicateur de fraîcheur des données</p>
                    <p>• Sauvegarde automatique toutes les 3 minutes</p>
                    <p>• Modification complète des données possible</p>
                </div>
                
                <div class="flow-step">
                    <h4>🔒 Mode Lecture seule</h4>
                    <p>• Bouton "Forcer la libération" (notification)</p>
                    <p>• Bouton "🚨 Déverrouillage d'urgence" (code JJMM)</p>
                    <p>• Message "Lecture seule - [user] utilise l'application"</p>
                    <p>• Aucune modification possible</p>
                </div>
                
                <div class="flow-step">
                    <h4>📊 Indicateurs visuels</h4>
                    <p>• <span class="status loading">dataFreshness</span> : 'local' | 'loading' | 'supabase'</p>
                    <p>• <span class="status control">lockInfo</span> : informations sur le verrou actuel</p>
                    <p>• <span class="status success">localFeedback</span> : messages de statut en temps réel</p>
                    <p>• Indicateurs de connexion Supabase</p>
                </div>
            </div>
        </div>

        <div class="summary-box">
            <h3>🎯 RÉSUMÉ DES FLUX PRINCIPAUX</h3>
            <ul class="summary-list">
                <li><span class="icon">🔄</span><strong>Connexion</strong> : Premier PC obtient le contrôle, les autres sont en lecture seule</li>
                <li><span class="icon">🔓</span><strong>Libération normale</strong> : Sauvegarde automatique + libération du verrou</li>
                <li><span class="icon">🚨</span><strong>Force libération</strong> : Notification → Sauvegarde automatique → Libération</li>
                <li><span class="icon">🔐</span><strong>Déverrouillage d'urgence</strong> : Code JJMM → Suppression directe → Nouveau verrou</li>
                <li><span class="icon">💾</span><strong>Sauvegarde</strong> : Automatique (3min) + Manuelle + Libération</li>
                <li><span class="icon">📊</span><strong>Restauration</strong> : Automatique lors de l'acquisition du verrou</li>
                <li><span class="icon">⏱️</span><strong>Vérification</strong> : Périodique toutes les 5s avec heartbeat</li>
                <li><span class="icon">🧹</span><strong>Nettoyage</strong> : Suppression des verrous expirés toutes les 60s</li>
            </ul>
            <p style="text-align: center; margin-top: 20px; font-weight: bold;">
                Le système garantit qu'un seul PC a le contrôle à la fois, avec des mécanismes de récupération robustes et une synchronisation en temps réel.
            </p>
        </div>

        <div style="text-align: center; margin-top: 40px; padding: 20px; border-top: 2px solid #3498db;">
            <p><strong>Version 3.4.2</strong> - Système de Verrouillage Collaboratif</p>
            <p>Généré le ${new Date().toLocaleDateString('fr-FR')}</p>
        </div>
    </div>
</body>
</html>
`;

// Écrire le fichier HTML
fs.writeFileSync('diagrammes_verrouillage.html', htmlContent);

console.log('✅ Fichier HTML avec diagrammes visuels créé : diagrammes_verrouillage.html');
console.log('📝 Pour convertir en PDF, ouvrez le fichier HTML dans un navigateur et utilisez Ctrl+P (Impression)');
console.log('💡 Recommandation : Utilisez l\'orientation "Paysage" pour une meilleure lisibilité');

