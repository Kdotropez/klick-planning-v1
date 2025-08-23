# 🔒 ORGANIGRAMME COMPLET DU SYSTÈME DE VERROUILLAGE COLLABORATIF

## 📋 Vue d'ensemble du système

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SYSTÈME DE VERROUILLAGE GLOBAL                    │
│                              (Un seul PC à la fois)                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 🔄 Flux principal : PC1 et PC2 se connectent

```
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
```

## 🔓 Flux de libération normale

```
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
```

## 🚨 Flux de force libération

```
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
```

## 🔐 Flux de déverrouillage d'urgence

```
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
```

## 💾 Flux de sauvegarde et restauration

```
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
```

## 🔄 Flux de restauration automatique

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   PC2       │    │   PC1       │    │  Supabase   │
│  Acquiert   │    │  Libère     │    │  plannings  │
│  le verrou  │    │  le verrou  │    │             │
└─────┬───────┘    └─────┬───────┘    └─────┬───────┘
      │                  │                  │
      │ 1. Acquisition   │                  │
      │  du verrou       │                  │
      │  GLOBAL          │                  │
      │                  │                  │
      ▼                  │                  │
┌─────────────┐          │                  │
│ 2. Vérification│       │                  │
│  de la fraîcheur│      │                  │
│  des données │         │                  │
└─────┬───────┘          │                  │
      │                  │                  │
      ▼                  │                  │
┌─────────────┐          │                  │
│ 3. Restauration│       │                  │
│  depuis     │          │                  │
│  Supabase   │─────────┼──────────────────┼───┐
└─────┬───────┘          │                  │   │
      │                  │                  │   │
      ▼                  │                  │   │
┌─────────────┐          │                  │   │
│ 4. Mise à   │          │                  │   │
│  jour de    │          │                  │   │
│  l'indicateur│         │                  │   │
│  dataFreshness│        │                  │   │
└─────┬───────┘          │                  │   │
      │                  │                  │   │
      ▼                  ▼                  ▼   ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  PC2:       │    │  PC1:       │    │  Données    │
│  📊 Données │    │  PC1:       │    │  restaurées │
│  fraîches   │    │  🔒 Lecture │    │  depuis     │
│  depuis     │    │  seule      │    │  Supabase   │
│  Supabase   │    │             │    │             │
└─────────────┘    └─────────────┘    └─────────────┘
```

## ⏱️ Flux de vérification périodique

```
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
```

## 🧹 Flux de nettoyage des verrous expirés

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   PC1       │    │   PC2       │    │  Supabase   │
│  (Contrôle) │    │ (Lecture    │    │  planning_  │
│             │    │  seule)     │    │   locks     │
└─────┬───────┘    └─────┬───────┘    └─────┬───────┘
      │                  │                  │
      │ Toutes les 60s   │ Toutes les 60s   │
      │                  │                  │
      ▼                  ▼                  ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ 1. Calcul   │    │ 1. Calcul   │    │ 1. Recherche│
│  du cutoff  │    │  du cutoff  │    │  des verrous│
│  (2 min)    │    │  (2 min)    │    │  expirés    │
└─────┬───────┘    └─────┬───────┘    └─────┬───────┘
      │                  │                  │
      ▼                  ▼                  ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ 2. Suppression│   │ 2. Suppression│   │ 2. Suppression│
│  des verrous│   │  des verrous│   │  des verrous│
│  expirés    │   │  expirés    │   │  expirés    │
│  localStorage│   │  localStorage│   │  de la DB   │
└─────────────┘    └─────────────┘    └─────────────┘
```

## 📊 États possibles du système

```
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
```

## 🔧 Protection contre les boucles infinies

```
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
```

## 📱 Interface utilisateur

```
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
```

## 🎯 Résumé des flux principaux

1. **Connexion** : Premier PC obtient le contrôle, les autres sont en lecture seule
2. **Libération normale** : Sauvegarde automatique + libération du verrou
3. **Force libération** : Notification → Sauvegarde automatique → Libération
4. **Déverrouillage d'urgence** : Code JJMM → Suppression directe → Nouveau verrou
5. **Sauvegarde** : Automatique (3min) + Manuelle + Libération
6. **Restauration** : Automatique lors de l'acquisition du verrou
7. **Vérification** : Périodique toutes les 5s avec heartbeat
8. **Nettoyage** : Suppression des verrous expirés toutes les 60s

Le système garantit qu'un seul PC a le contrôle à la fois, avec des mécanismes de récupération robustes et une synchronisation en temps réel.

