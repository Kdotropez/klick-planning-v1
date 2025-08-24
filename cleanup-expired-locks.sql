-- Nettoyage des verrous expirés
-- À exécuter dans l'éditeur SQL de Supabase

-- Voir les verrous actuels
SELECT 
  resource_id,
  holder,
  expires_at,
  CASE 
    WHEN expires_at IS NULL THEN 'Libéré'
    WHEN expires_at <= now() THEN 'Expiré'
    ELSE 'Actif'
  END as status
FROM public.planning_lock
ORDER BY updated_at DESC;

-- Nettoyer les verrous expirés
DELETE FROM public.planning_lock 
WHERE expires_at IS NOT NULL AND expires_at <= now();

-- Vérifier le résultat
SELECT 
  resource_id,
  holder,
  expires_at,
  CASE 
    WHEN expires_at IS NULL THEN 'Libéré'
    WHEN expires_at <= now() THEN 'Expiré'
    ELSE 'Actif'
  END as status
FROM public.planning_lock
ORDER BY updated_at DESC;
