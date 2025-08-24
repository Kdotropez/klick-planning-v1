-- Script de nettoyage d'urgence pour les verrous bloqués
-- À exécuter dans l'éditeur SQL de Supabase si le verrou reste bloqué

-- 1. Voir tous les verrous actuels
SELECT 
  resource_id,
  holder,
  lease_token,
  expires_at,
  updated_at,
  CASE 
    WHEN expires_at IS NULL THEN 'Libéré'
    WHEN expires_at <= now() THEN 'Expiré'
    ELSE 'Actif'
  END as status
FROM public.planning_lock
ORDER BY updated_at DESC;

-- 2. Nettoyer tous les verrous expirés (optionnel)
DELETE FROM public.planning_lock 
WHERE expires_at IS NOT NULL AND expires_at <= now();

-- 3. Nettoyer un verrou spécifique (remplacez 'PORT_GRIMAUD:2025-01-20' par votre ressource)
-- DELETE FROM public.planning_lock WHERE resource_id = 'PORT_GRIMAUD:2025-01-20';

-- 4. Nettoyer tous les verrous (URGENCE SEULEMENT - à utiliser avec précaution)
-- DELETE FROM public.planning_lock;

-- 5. Vérifier le résultat
SELECT 
  resource_id,
  holder,
  lease_token,
  expires_at,
  updated_at,
  CASE 
    WHEN expires_at IS NULL THEN 'Libéré'
    WHEN expires_at <= now() THEN 'Expiré'
    ELSE 'Actif'
  END as status
FROM public.planning_lock
ORDER BY updated_at DESC;
