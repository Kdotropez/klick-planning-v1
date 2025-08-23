import fs from 'fs';
import path from 'path';

// Lire le contenu de l'organigramme
const organigrammeContent = fs.readFileSync('ORGANIGRAMME_VERROUILLAGE.md', 'utf8');

// Créer un fichier HTML simple avec le contenu formaté
const htmlContent = `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Organigramme Système de Verrouillage Collaboratif</title>
    <style>
        body {
            font-family: 'Courier New', monospace;
            line-height: 1.6;
            margin: 20px;
            background-color: white;
            color: black;
        }
        h1 {
            color: #2c3e50;
            text-align: center;
            border-bottom: 3px solid #3498db;
            padding-bottom: 10px;
        }
        h2 {
            color: #34495e;
            border-left: 4px solid #3498db;
            padding-left: 10px;
            margin-top: 30px;
        }
        pre {
            background-color: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 5px;
            padding: 15px;
            overflow-x: auto;
            font-size: 12px;
            line-height: 1.4;
        }
        .flow-diagram {
            background-color: #f8f9fa;
            border: 2px solid #dee2e6;
            border-radius: 8px;
            padding: 20px;
            margin: 15px 0;
            font-family: 'Courier New', monospace;
            font-size: 11px;
            line-height: 1.3;
        }
        .summary {
            background-color: #e8f4fd;
            border: 1px solid #bee5eb;
            border-radius: 5px;
            padding: 15px;
            margin: 20px 0;
        }
        .summary ol {
            margin: 10px 0;
            padding-left: 20px;
        }
        .summary li {
            margin: 5px 0;
        }
        @media print {
            body {
                margin: 0;
                font-size: 10px;
            }
            pre, .flow-diagram {
                font-size: 9px;
                page-break-inside: avoid;
            }
            h2 {
                page-break-after: avoid;
            }
        }
    </style>
</head>
<body>
    <h1>🔒 ORGANIGRAMME COMPLET DU SYSTÈME DE VERROUILLAGE COLLABORATIF</h1>
    
    <div class="summary">
        <h2>📋 Vue d'ensemble du système</h2>
        <p><strong>SYSTÈME DE VERROUILLAGE GLOBAL (Un seul PC à la fois)</strong></p>
        <p>Ce système garantit qu'un seul PC a le contrôle à la fois, avec des mécanismes de récupération robustes et une synchronisation en temps réel.</p>
    </div>

    <h2>🔄 Flux principal : PC1 et PC2 se connectent</h2>
    <div class="flow-diagram">
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   PC1       │    │   PC2       │    │  Supabase   │    │ localStorage │
│  Démarrage  │    │  Démarrage  │    │  planning_  │    │  global_lock │
│             │    │             │    │   locks     │    │             │
└─────┬───────┘    └─────┬───────┘    └─────┬───────┘    └─────┬───────┘
      │                  │                  │                  │
      │ 1. Vérification  │ 1. Vérification  │                  │
      │    du verrou     │    du verrou     │                  │
      │                  │                  │                  │
      └─────────┬────────┴─────────┬────────┘                  │
                │                  │                           │
                ▼                  ▼                           ▼
        ┌─────────────┐    ┌─────────────┐            ┌─────────────┐
        │  PC1 trouve │    │  PC2 trouve │            │  Fallback   │
        │  aucun      │    │  aucun      │            │  localStorage│
        │  verrou     │    │  verrou     │            │             │
        └─────┬───────┘    └─────┬───────┘            └─────────────┘
              │                  │
              │ 2. Tentative     │ 2. Tentative
              │ d'acquisition    │ d'acquisition
              │                  │
              └─────────┬────────┴─────────┬────────┘
                        │                  │
                        ▼                  ▼
                ┌─────────────┐    ┌─────────────┐
                │  PC1 acquiert│    │  PC2 échoue │
                │  le verrou   │    │  (conflit)  │
                │  GLOBAL      │    │             │
                └─────┬───────┘    └─────┬───────┘
                      │                  │
                      ▼                  ▼
                ┌─────────────┐    ┌─────────────┐
                │  PC1:       │    │  PC2:       │
                │  🔓 Contrôle│    │  🔒 Lecture │
                │  complet    │    │  seule      │
                └─────────────┘    └─────────────┘
    </div>

    <h2>🔓 Flux de libération normale</h2>
    <div class="flow-diagram">
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   PC1       │    │   PC2       │    │  Supabase   │
│  (Contrôle) │    │ (Lecture    │    │  planning_  │
│             │    │  seule)     │    │   locks     │
└─────┬───────┘    └─────┬───────┘    └─────┬───────┘
      │                  │                  │
      │ 1. Clic          │                  │
      │ "Relâcher        │                  │
      │  la main"        │                  │
      │                  │                  │
      ▼                  │                  │
┌─────────────┐          │                  │
│ 2. Sauvegarde│         │                  │
│  automatique │         │                  │
│  complète    │         │                  │
│  Supabase    │         │                  │
└─────┬───────┘          │                  │
      │                  │                  │
      ▼                  │                  │
┌─────────────┐          │                  │
│ 3. Libération│         │                  │
│  du verrou   │         │                  │
│  GLOBAL      │─────────┼──────────────────┼───┐
└─────┬───────┘          │                  │   │
      │                  │                  │   │
      ▼                  ▼                  ▼   ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  PC1:       │    │  PC2:       │    │  Verrou     │
│  🔒 Lecture │    │  PC2:       │    │  supprimé   │
│  seule      │    │  🔓 Contrôle│    │  de la DB   │
│             │    │  complet    │    │             │
└─────────────┘    └─────────────┘    └─────────────┘
    </div>

    <h2>🚨 Flux de force libération</h2>
    <div class="flow-diagram">
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   PC2       │    │   PC1       │    │  Supabase   │
│ (Lecture    │    │ (Contrôle)  │    │  planning_  │
│  seule)     │    │             │    │   locks     │
└─────┬───────┘    └─────┬───────┘    └─────┬───────┘
      │                  │                  │
      │ 1. Clic          │                  │
      │ "Forcer la       │                  │
      │  libération"     │                  │
      │                  │                  │
      ▼                  │                  │
┌─────────────┐          │                  │
│ 2. Création │          │                  │
│  notification│         │                  │
│  force_release│        │                  │
│  _request    │─────────┼──────────────────┼───┐
└─────────────┘          │                  │   │
                         │                  │   │
                         ▼                  ▼   ▼
                ┌─────────────┐    ┌─────────────┐
                │  PC1 détecte│    │  Notification│
                │  la demande │    │  créée dans │
                │  de force   │    │  la DB      │
                │  release    │    │             │
                └─────┬───────┘    └─────────────┘
                      │
                      ▼
                ┌─────────────┐
                │ 3. Sauvegarde│
                │  automatique │
                │  complète    │
                │  Supabase    │
                └─────┬───────┘
                      │
                      ▼
                ┌─────────────┐
                │ 4. Libération│
                │  automatique │
                │  du verrou   │
                └─────┬───────┘
                      │
                      ▼
                ┌─────────────┐    ┌─────────────┐
                │  PC1:       │    │  PC2:       │
                │  🔒 Lecture │    │  PC2:       │
                │  seule      │    │  🔓 Contrôle│
                │             │    │  complet    │
                └─────────────┘    └─────────────┘
    </div>

    <h2>🔐 Flux de déverrouillage d'urgence</h2>
    <div class="flow-diagram">
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   PC2       │    │   PC1       │    │  Supabase   │
│ (Lecture    │    │ (Contrôle)  │    │  planning_  │
│  seule)     │    │             │    │   locks     │
└─────┬───────┘    └─────┬───────┘    └─────┬───────┘
      │                  │                  │
      │ 1. Clic          │                  │
      │ "Déverrouillage  │                  │
      │  d'urgence"      │                  │
      │                  │                  │
      ▼                  │                  │
┌─────────────┐          │                  │
│ 2. Saisie   │          │                  │
│  code JJMM  │          │                  │
│  (ex: 2701) │          │                  │
└─────┬───────┘          │                  │
      │                  │                  │
      ▼                  │                  │
┌─────────────┐          │                  │
│ 3. Vérification│       │                  │
│  du code     │         │                  │
│  de sécurité │         │                  │
└─────┬───────┘          │                  │
      │                  │                  │
      ▼                  │                  │
┌─────────────┐          │                  │
│ 4. Suppression│         │                  │
│  directe du  │         │                  │
│  verrou sans │         │                  │
│  notification│─────────┼──────────────────┼───┐
└─────┬───────┘          │                  │   │
      │                  │                  │   │
      ▼                  │                  │   │
┌─────────────┐          │                  │   │
│ 5. Création │          │                  │   │
│  nouveau    │          │                  │   │
│  verrou avec│          │                  │   │
│  marqueur   │          │                  │   │
│  emergency_ │          │                  │   │
│  unlock     │─────────┼──────────────────┼───┼───┐
└─────┬───────┘          │                  │   │   │
      │                  │                  │   │   │
      ▼                  ▼                  ▼   ▼   ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  PC2:       │    │  PC1:       │    │  Verrou     │
│  🔓 Contrôle│    │  PC1:       │    │  remplacé   │
│  complet    │    │  🔒 Lecture │    │  immédiatement│
│             │    │  seule      │    │             │
└─────────────┘    └─────────────┘    └─────────────┘
    </div>

    <h2>💾 Flux de sauvegarde et restauration</h2>
    <div class="flow-diagram">
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   PC1       │    │   PC2       │    │  Supabase   │
│  (Contrôle) │    │ (Lecture    │    │  plannings  │
│             │    │  seule)     │    │             │
└─────┬───────┘    └─────┬───────┘    └─────┬───────┘
      │                  │                  │
      │ 1. Modification  │                  │
      │  des données     │                  │
      │                  │                  │
      ▼                  │                  │
┌─────────────┐          │                  │
│ 2. Sauvegarde│         │                  │
│  automatique │         │                  │
│  toutes les  │         │                  │
│  3 minutes  │─────────┼──────────────────┼───┐
└─────┬───────┘          │                  │   │
      │                  │                  │   │
      ▼                  │                  │   │
┌─────────────┐          │                  │   │
│ 3. Sauvegarde│         │                  │   │
│  manuelle   │          │                  │   │
│  (bouton)   │          │                  │   │
└─────┬───────┘          │                  │   │
      │                  │                  │   │
      ▼                  │                  │   │
┌─────────────┐          │                  │   │
│ 4. Sauvegarde│         │                  │   │
│  lors de    │          │                  │   │
│  libération │          │                  │   │
└─────┬───────┘          │                  │   │
      │                  │                  │   │
      ▼                  ▼                  ▼   ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  PC1:       │    │  PC2:       │    │  Données    │
│  💾 Données │    │  PC2:       │    │  sauvegardées│
│  sauvegardées│   │  🔄 Restauration│  │  dans       │
│  localement │    │  depuis     │    │  Supabase   │
│             │    │  Supabase   │    │             │
└─────────────┘    └─────────────┘    └─────────────┘
    </div>

    <h2>⏱️ Flux de vérification périodique</h2>
    <div class="flow-diagram">
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   PC1       │    │   PC2       │    │  Supabase   │
│  (Contrôle) │    │ (Lecture    │    │  planning_  │
│             │    │  seule)     │    │   locks     │
└─────┬───────┘    └─────┬───────┘    └─────┬───────┘
      │                  │                  │
      │ Toutes les 5s    │ Toutes les 5s    │
      │                  │                  │
      ▼                  ▼                  ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ 1. Vérification│  │ 1. Vérification│  │ 1. Lecture │
│  du verrou   │  │  du verrou   │  │  du verrou   │
│  actuel      │  │  actuel      │  │  GLOBAL      │
└─────┬───────┘    └─────┬───────┘    └─────┬───────┘
      │                  │                  │
      ▼                  ▼                  ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ 2. Heartbeat│    │ 2. Détection│    │ 3. Retour   │
│  si on a    │    │  de changement│   │  des données│
│  le verrou  │    │  de verrou  │    │  mises à    │
└─────┬───────┘    └─────┬───────┘    │  jour       │
      │                  │            └─────┬───────┘
      ▼                  ▼                  │
┌─────────────┐    ┌─────────────┐          │
│ 3. Vérification│  │ 3. Mise à   │          │
│  des demandes│  │  jour de     │          │
│  de force    │  │  l'état      │          │
│  release     │  │  (lecture    │          │
└─────────────┘    │  seule/     │          │
                   │  contrôle)  │          │
                   └─────────────┘          │
                                            │
                                            ▼
                                   ┌─────────────┐
                                   │ 4. Synchronisation│
                                   │  en temps réel│
                                   └─────────────┘
    </div>

    <h2>🔧 Protection contre les boucles infinies</h2>
    <div class="flow-diagram">
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PROTECTIONS ANTI-BOUCLE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ⏳ Délai minimum de 3s entre les tentatives d'acquisition                 │
│  ⏱️ Vérification périodique toutes les 5s (au lieu de 2s)                 │
│  🚨 Flag emergencyUnlockInProgress pour bypasser les délais               │
│  🧹 Nettoyage des verrous expirés toutes les 60s                          │
│  🔄 Renouvellement automatique du verrou pour le même utilisateur         │
│  📡 Synchronisation en temps réel avec détection de changements           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
    </div>

    <h2>📊 États possibles du système</h2>
    <div class="flow-diagram">
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ÉTATS DU SYSTÈME                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  🔓 PC1 Contrôle + PC2 Lecture seule                                       │
│  🔓 PC2 Contrôle + PC1 Lecture seule                                       │
│  🔒 PC1 Lecture seule + PC2 Lecture seule (verrou expiré)                  │
│  🔒 PC2 Lecture seule + PC1 Lecture seule (verrou expiré)                  │
│  🚨 Déverrouillage d'urgence en cours                                      │
│  🔄 Force release en cours                                                 │
│  💾 Sauvegarde en cours                                                    │
│  📊 Restauration en cours                                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
    </div>

    <h2>📱 Interface utilisateur</h2>
    <div class="flow-diagram">
┌─────────────────────────────────────────────────────────────────────────────┐
│                              INTERFACE UTILISATEUR                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  🔓 Contrôle complet :                                                     │
│     - Bouton "Relâcher la main" (sauvegarde + libération)                  │
│     - Indicateur de fraîcheur des données                                  │
│     - Sauvegarde automatique toutes les 3 minutes                         │
│                                                                             │
│  🔒 Lecture seule :                                                        │
│     - Bouton "Forcer la libération" (notification)                         │
│     - Bouton "🚨 Déverrouillage d'urgence" (code JJMM)                     │
│     - Message "Lecture seule - [user] utilise l'application"              │
│                                                                             │
│  📊 Indicateurs :                                                          │
│     - dataFreshness: 'local' | 'loading' | 'supabase'                     │
│     - lockInfo: informations sur le verrou actuel                         │
│     - localFeedback: messages de statut en temps réel                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
    </div>

    <div class="summary">
        <h2>🎯 Résumé des flux principaux</h2>
        <ol>
            <li><strong>Connexion</strong> : Premier PC obtient le contrôle, les autres sont en lecture seule</li>
            <li><strong>Libération normale</strong> : Sauvegarde automatique + libération du verrou</li>
            <li><strong>Force libération</strong> : Notification → Sauvegarde automatique → Libération</li>
            <li><strong>Déverrouillage d'urgence</strong> : Code JJMM → Suppression directe → Nouveau verrou</li>
            <li><strong>Sauvegarde</strong> : Automatique (3min) + Manuelle + Libération</li>
            <li><strong>Restauration</strong> : Automatique lors de l'acquisition du verrou</li>
            <li><strong>Vérification</strong> : Périodique toutes les 5s avec heartbeat</li>
            <li><strong>Nettoyage</strong> : Suppression des verrous expirés toutes les 60s</li>
        </ol>
        <p><strong>Le système garantit qu'un seul PC a le contrôle à la fois, avec des mécanismes de récupération robustes et une synchronisation en temps réel.</strong></p>
    </div>

    <div style="text-align: center; margin-top: 40px; padding: 20px; border-top: 2px solid #3498db;">
        <p><strong>Version 3.4.2</strong> - Système de Verrouillage Collaboratif</p>
        <p>Généré le ${new Date().toLocaleDateString('fr-FR')}</p>
    </div>
</body>
</html>
`;

// Écrire le fichier HTML
fs.writeFileSync('organigramme_verrouillage.html', htmlContent);

console.log('✅ Fichier HTML créé : organigramme_verrouillage.html');
console.log('📝 Pour convertir en PDF, ouvrez le fichier HTML dans un navigateur et utilisez Ctrl+P (Impression)');
console.log('💡 Ou utilisez un outil comme wkhtmltopdf si installé');
