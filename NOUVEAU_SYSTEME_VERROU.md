# 🔒 Nouveau Système de Verrou à Bail

## Vue d'ensemble

Le nouveau système de verrou à bail remplace l'ancien système de verrouillage par conversation entre clients. Il utilise une approche **100% côté serveur** avec Postgres/Supabase pour garantir l'atomicité et éviter les boucles infinies.

## 🏗️ Architecture

### Principe de base
- **1 ligne par planning** dans la table `planning_lock`
- **Acquisition atomique** via `INSERT ... ON CONFLICT DO UPDATE WHERE ...`
- **Token de bail (UUID)** pour sécuriser les opérations
- **TTL court (30s)** + **heartbeat (10s)** pour la récupération automatique
- **Realtime Supabase** pour les notifications instantanées

### Table `planning_lock`
```sql
CREATE TABLE planning_lock (
  resource_id   text PRIMARY KEY,    -- "boutique:semaine"
  holder        text,                -- identifiant utilisateur
  lease_token   uuid,                -- token secret du bail
  expires_at    timestamptz,         -- échéance du bail
  updated_at    timestamptz NOT NULL DEFAULT now()
);
```

## 🔧 Fonctions SQL

### 1. `acquire_planning_lock(resource_id, holder, ttl_seconds)`
- **Acquisition atomique** du verrou
- **Succès** si aucun détenteur ou bail expiré
- **Retourne** `{acquired, resource_id, holder, lease_token, expires_at}`

### 2. `renew_planning_lock(resource_id, holder, lease_token, ttl_seconds)`
- **Heartbeat** pour maintenir le bail
- **Nécessite le token** pour sécuriser l'opération
- **Retourne** `boolean`

### 3. `release_planning_lock(resource_id, holder, lease_token)`
- **Libération volontaire** du verrou
- **Nécessite le token** pour éviter les libérations frauduleuses
- **Retourne** `boolean`

### 4. `emergency_takeover_planning_lock(resource_id, new_holder, pin, ttl_seconds)`
- **Déverrouillage d'urgence** avec code JJMM
- **Validé côté serveur** (timezone Europe/Paris)
- **Remet un nouveau token**
- **Retourne** `{acquired, resource_id, holder, lease_token, expires_at}`

## 🎯 Service côté client

### `lockService.js`
```javascript
// Acquisition du verrou
const result = await acquireLock(resourceId, holder, 30);

// Renouvellement (heartbeat)
const renewed = await renewLock(resourceId, holder, leaseToken, 30);

// Libération volontaire
const released = await releaseLock(resourceId, holder, leaseToken);

// Déverrouillage d'urgence
const emergency = await emergencyTakeover(resourceId, newHolder, "0101", 30);

// Abonnement Realtime
const unsubscribe = subscribeLock(resourceId, (payload) => {
  // Notification de changement
});
```

## 🪝 Hook React

### `usePlanningLock(resourceId, holderId)`
```javascript
const { 
  status,        // 'loading' | 'owner' | 'readonly' | 'lost'
  isOwner,       // boolean
  readOnly,      // boolean
  lockInfo,      // { holder, lease_token, expires_at }
  release,       // fonction de libération
  emergency      // fonction d'urgence
} = usePlanningLock(resourceId, holderId);
```

### Comportement automatique
- **Acquisition** au montage du composant
- **Heartbeat** toutes les 10 secondes
- **Libération** automatique au démontage
- **Récupération** automatique via Realtime
- **Anti-thundering herd** avec jitter aléatoire

## 🎨 Interface utilisateur

### `LockBanner.jsx`
- **Statut visuel** avec couleurs et icônes
- **Bouton de libération** pour le détenteur
- **Bouton d'urgence** pour les autres utilisateurs
- **Informations** sur le détenteur actuel

## 🚀 Déploiement

### 1. Migration SQL
```bash
# Exécuter le script de déploiement
.\deploy-lock-migration.ps1
```

### 2. Copier le contenu SQL dans Supabase
- Aller dans **SQL Editor**
- Coller le contenu de `supabase/migrations/20250101_planning_lock.sql`
- Exécuter le script

### 3. Activer Realtime
- Dans **Database > Replication**
- Activer les événements sur `planning_lock`

## 🔄 Migration depuis l'ancien système

### Changements dans `PlanningDisplay.jsx`
- ✅ Suppression de l'ancien code de verrouillage
- ✅ Intégration du hook `usePlanningLock`
- ✅ Ajout du composant `LockBanner`
- ✅ Wrapper `safeSaveWeekPlanning` pour respecter le verrou

### Avantages du nouveau système
- 🎯 **Atomicité garantie** côté serveur
- 🔒 **Sécurité renforcée** avec tokens UUID
- ⚡ **Réactivité instantanée** via Realtime
- 🛡️ **Récupération automatique** en cas de crash
- 🚫 **Pas de boucles infinies**
- 🕐 **Horloge serveur** (pas de dérive cliente)

## 📊 Paramètres recommandés

- **TTL**: 30 secondes
- **Heartbeat**: 10 secondes
- **Resource ID**: `"boutique:semaine"` (ex: `"KDO-Tropez:2025-08-25"`)
- **Holder ID**: email ou ID utilisateur

## 🚨 Gestion d'urgence

### Code JJMM
- **Format**: `DDMM` (jour + mois)
- **Timezone**: Europe/Paris
- **Exemple**: `0101` pour le 1er janvier

### Force Release (optionnel)
- Peut être ajouté si nécessaire
- Utilise le même principe que l'urgence
- Code différent pour distinguer les actions

## 🔍 Monitoring

### Logs côté client
```javascript
console.log('🔒 Verrou acquis:', lockInfo);
console.log('💓 Heartbeat renouvelé');
console.log('🔓 Verrou libéré');
console.log('🚨 Déverrouillage d'urgence');
```

### Logs côté serveur
- Fonctions SQL avec `SECURITY DEFINER`
- Audit trail via `updated_at`
- Expiration automatique des baux

## ✅ Tests recommandés

1. **Acquisition normale** du verrou
2. **Heartbeat** et renouvellement
3. **Libération volontaire**
4. **Déverrouillage d'urgence**
5. **Récupération automatique** après expiration
6. **Concurrence** entre plusieurs utilisateurs
7. **Crash simulation** (fermeture navigateur)
8. **Realtime** notifications

---

**🎉 Le nouveau système est plus robuste, plus simple et plus fiable que l'ancien !**
