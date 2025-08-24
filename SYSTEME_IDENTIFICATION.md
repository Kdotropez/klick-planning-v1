# 🔐 Système d'Identification Utilisateur - Klick Planning

## 📋 Vue d'ensemble

Le système d'identification permet à chaque utilisateur d'avoir son propre code d'accès personnalisé. Au démarrage de l'application, l'utilisateur doit saisir son code pour accéder au planning.

## 🎯 Avantages

- ✅ **Identification personnalisée** : Chaque utilisateur a son propre code
- ✅ **Traçabilité** : Toutes les actions sont liées à l'utilisateur connecté
- ✅ **Sécurité** : Contrôle d'accès basé sur les rôles
- ✅ **Flexibilité** : Codes facilement modifiables
- ✅ **Gestion des verrous** : Identifiants uniques pour le système de verrouillage

## 🔧 Configuration

### 📁 Fichier de configuration : `src/config/userCodes.js`

Ce fichier contient tous les codes utilisateurs et leurs permissions. Vous pouvez le modifier selon vos besoins.

### 👥 Codes utilisateurs disponibles

#### 🏢 Administrateurs
- `ADMIN001` - Administrateur Principal
- `ADMIN002` - Administrateur Système

#### 👔 Direction
- `DIRECTOR001` - Directeur Commercial
- `DIRECTOR002` - Directeur RH
- `DIRECTOR003` - Directeur Financier

#### 👨‍💼 Superviseurs
- `SUPERVISOR001` - Superviseur Régional
- `SUPERVISOR002` - Superviseur Zone Nord
- `SUPERVISOR003` - Superviseur Zone Sud

#### 🏪 Managers
- `MANAGER001` - Manager Boutique 1
- `MANAGER002` - Manager Boutique 2
- `MANAGER003` - Manager Boutique 3

#### 👷 Employés
- `EMPLOYEE001` - Employé Boutique 1
- `EMPLOYEE002` - Employé Boutique 2
- `EMPLOYEE003` - Employé Boutique 3
- `EMPLOYEE004` - Employé Polyvalent

#### 👨‍💻 Assistants
- `ASSISTANT001` - Assistant RH
- `ASSISTANT002` - Assistant Commercial
- `ASSISTANT003` - Assistant Direction

#### 🎓 Stagiaires
- `TRAINEE001` - Stagiaire Commercial
- `TRAINEE002` - Stagiaire RH
- `TRAINEE003` - Stagiaire Marketing

#### 🔧 Consultants
- `CONSULTANT001` - Consultant Externe
- `CONSULTANT002` - Consultant IT
- `CONSULTANT003` - Consultant Formation

#### 🧪 Codes de test
- `TEST001` - Utilisateur Test
- `DEMO001` - Démonstration

## 🔐 Permissions par rôle

### 🏢 Administrateur
- ✅ Gestion des utilisateurs
- ✅ Accès à toutes les données
- ✅ Modification du système
- ✅ Export complet
- ✅ Import de données

### 👔 Directeur
- ❌ Gestion des utilisateurs
- ✅ Accès à toutes les données
- ❌ Modification du système
- ✅ Export complet
- ✅ Import de données

### 👨‍💼 Superviseur
- ❌ Gestion des utilisateurs
- ✅ Accès à toutes les données
- ❌ Modification du système
- ✅ Export complet
- ❌ Import de données

### 🏪 Manager
- ❌ Gestion des utilisateurs
- ❌ Accès à toutes les données
- ❌ Modification du système
- ❌ Export complet
- ❌ Import de données

### 👷 Employé
- ❌ Gestion des utilisateurs
- ❌ Accès à toutes les données
- ❌ Modification du système
- ❌ Export complet
- ❌ Import de données

## 🚀 Utilisation

### 1️⃣ Démarrage de l'application
L'application commence par l'écran d'identification.

### 2️⃣ Saisie du code
L'utilisateur saisit son code personnel (ex: `ADMIN001`).

### 3️⃣ Validation
Le système vérifie le code et charge les permissions correspondantes.

### 4️⃣ Accès au planning
L'utilisateur accède au planning avec ses permissions spécifiques.

## 🔧 Personnalisation

### Ajouter un nouvel utilisateur

1. Ouvrir `src/config/userCodes.js`
2. Ajouter une nouvelle entrée :

```javascript
'NOUVEAU001': { name: 'Nouvel Utilisateur', role: 'employee' }
```

3. Redémarrer l'application

### Modifier un utilisateur existant

1. Ouvrir `src/config/userCodes.js`
2. Modifier l'entrée souhaitée :

```javascript
'MANAGER001': { name: 'Manager Boutique 1 Modifié', role: 'supervisor' }
```

3. Redémarrer l'application

### Ajouter un nouveau rôle

1. Ajouter le rôle dans `VALID_USER_CODES`
2. Ajouter les permissions dans `ROLE_PERMISSIONS`
3. Redémarrer l'application

## 🔍 Traçabilité

### Identifiants de verrouillage
Chaque utilisateur génère un identifiant unique pour le système de verrouillage :
- Format : `user_[CODE]_[TIMESTAMP]`
- Exemple : `user_ADMIN001_1703123456789`

### Logs de connexion
Les informations de connexion sont sauvegardées :
- Code utilisateur
- Nom complet
- Rôle
- Heure de connexion
- ID de session

## 🛡️ Sécurité

### Stockage local
- Les informations utilisateur sont stockées dans `localStorage`
- Pas de transmission vers des serveurs externes
- Données chiffrées localement

### Gestion des sessions
- Session unique par connexion
- Déconnexion automatique à la fermeture du navigateur
- Possibilité de déconnexion manuelle

## 🔄 Migration depuis l'ancien système

### Ancien système
- Identifiants générés automatiquement
- Format : `user_[hash]_[timestamp]_[random]`

### Nouveau système
- Identifiants personnalisés
- Format : `user_[CODE]_[timestamp]`

### Compatibilité
- Le nouveau système est rétrocompatible
- Les anciens identifiants sont conservés en fallback
- Migration automatique lors de la première connexion

## 📱 Interface utilisateur

### Écran d'identification
- Interface moderne et intuitive
- Validation en temps réel
- Liste des codes disponibles (mode développement)
- Messages d'erreur clairs

### Indicateur utilisateur
- Affichage du nom et du rôle
- Positionné dans la barre de menu
- Couleurs selon le rôle
- Informations de session

## 🚨 Dépannage

### Code invalide
- Vérifier l'orthographe du code
- Vérifier que le code existe dans la configuration
- Redémarrer l'application si nécessaire

### Problème de permissions
- Vérifier le rôle de l'utilisateur
- Contacter l'administrateur si nécessaire
- Vérifier les permissions dans la configuration

### Perte de session
- Fermer et rouvrir le navigateur
- Vider le cache si nécessaire
- Se reconnecter avec le code utilisateur

## 📞 Support

Pour toute question ou problème :
1. Vérifier la documentation
2. Contacter l'administrateur système
3. Consulter les logs de l'application

---

**Version :** 1.0.0  
**Date :** Janvier 2025  
**Auteur :** Nicolas Lefevre
