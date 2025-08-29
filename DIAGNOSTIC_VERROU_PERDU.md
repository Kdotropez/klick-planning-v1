# Diagnostic: Verrou perdu toutes les 15 secondes

## Problème identifié

Le verrou de planning est perdu toutes les 15-30 secondes au lieu de durer 5 minutes comme configuré.

## Cause racine

**Les fonctions SQL utilisent des valeurs par défaut de TTL = 30 secondes au lieu de 300 secondes.**

### Détails techniques

1. **Code client (JavaScript):**
   ```javascript
   const HEARTBEAT_SEC = 60;  // ✅ Correct: 1 minute
   const TTL_SEC = 300;       // ✅ Correct: 5 minutes
   ```

2. **Fonctions SQL (Postgres):**
   ```sql
   -- ❌ PROBLÈME: Valeurs par défaut incorrectes
   CREATE OR REPLACE FUNCTION public.acquire_planning_lock(
     p_ttl_seconds int DEFAULT 30  -- ❌ Devrait être 300
   )
   
   CREATE OR REPLACE FUNCTION public.renew_planning_lock(
     p_ttl_seconds int DEFAULT 30  -- ❌ Devrait être 300
   )
   
   CREATE OR REPLACE FUNCTION public.emergency_takeover_planning_lock(
     p_ttl_seconds int DEFAULT 30  -- ❌ Devrait être 300
   )
   ```

3. **Comportement observé:**
   - Le client envoie `TTL_SEC = 300` (5 minutes)
   - Mais si le paramètre n'est pas correctement transmis, les fonctions SQL utilisent leur valeur par défaut de 30 secondes
   - Résultat: le verrou expire après 30 secondes au lieu de 300 secondes

## Solution

### Étape 1: Corriger les fonctions SQL

Exécuter le script `fix-lock-ttl.sql` dans l'éditeur SQL de Supabase:

```sql
-- Corriger les valeurs par défaut
CREATE OR REPLACE FUNCTION public.acquire_planning_lock(
  p_ttl_seconds int DEFAULT 300  -- ✅ Corrigé: 5 minutes
)

CREATE OR REPLACE FUNCTION public.renew_planning_lock(
  p_ttl_seconds int DEFAULT 300  -- ✅ Corrigé: 5 minutes
)

CREATE OR REPLACE FUNCTION public.emergency_takeover_planning_lock(
  p_ttl_seconds int DEFAULT 300  -- ✅ Corrigé: 5 minutes
)
```

### Étape 2: Vérifier la transmission des paramètres

Les logs de débogage ajoutés permettront de vérifier:

1. **Dans `usePlanningLock.js`:**
   ```
   🔒 Tentative d'acquisition du verrou: { resourceId, holderId, TTL_SEC: 300 }
   ```

2. **Dans `lockService.js`:**
   ```
   🔒 acquireLock appelé avec: { resourceId, holder, ttlSeconds: 300 }
   🔒 acquireLock réponse Supabase: { acquired: true, ... }
   ```

3. **Dans `startHeartbeat():**
   ```
   🔄 Renouvellement du verrou avec TTL: 300
   🔄 Résultat renouvellement: true
   ✅ Verrou renouvelé avec succès
   ```

### Étape 3: Tester la correction

Après application de la correction:

1. **Ouvrir la console du navigateur (F12)**
2. **Observer les logs de verrouillage**
3. **Vérifier que le verrou dure bien 5 minutes**

## Scripts de diagnostic

- `verifier-fonctions-sql.ps1` - Guide pour vérifier l'état des fonctions SQL
- `appliquer-correction-ttl.ps1` - Guide pour appliquer la correction
- `check-sql-functions.sql` - Script SQL de vérification
- `fix-lock-ttl.sql` - Script SQL de correction

## Logs de débogage ajoutés

### Dans `usePlanningLock.js:`
- 🔒 Tentative d'acquisition
- 💓 Démarrage/arrêt du heartbeat
- 🔄 Renouvellement du verrou
- 👀 Surveillance du verrou
- 🔓 Libération du verrou

### Dans `lockService.js:`
- 🔒 Appels aux fonctions RPC
- 🔄 Paramètres envoyés à Supabase
- ❌ Erreurs détaillées
- 🔔 Changements détectés

## Résultat attendu

Après correction:
- ✅ Verrou dure 5 minutes (300 secondes)
- ✅ Heartbeat toutes les 60 secondes
- ✅ Pas de perte de verrou intempestive
- ✅ Logs clairs pour le diagnostic

## Vérification

Pour vérifier que la correction fonctionne:

1. **Exécuter le script de correction SQL**
2. **Redémarrer l'application**
3. **Observer les logs dans la console**
4. **Vérifier que le verrou dure bien 5 minutes**

Le problème devrait être résolu et le verrou ne devrait plus être perdu toutes les 15-30 secondes.
