-- Script de diagnostic pour vérifier l'état actuel de la base de données
-- À exécuter dans l'éditeur SQL de Supabase

-- 1. Vérifier toutes les tables existantes
SELECT 
  table_schema,
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- 2. Vérifier si la table planning_lock existe et sa structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'planning_lock'
ORDER BY ordinal_position;

-- 3. Vérifier toutes les fonctions existantes liées au planning
SELECT 
  routine_name,
  routine_type,
  data_type as return_type,
  routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name LIKE '%planning%'
ORDER BY routine_name;

-- 4. Vérifier les politiques RLS sur planning_lock
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'planning_lock';

-- 5. Vérifier les verrous actuels dans planning_lock
SELECT 
  resource_id,
  holder,
  lease_token,
  expires_at,
  updated_at,
  CASE 
    WHEN expires_at <= now() THEN 'EXPIRÉ'
    ELSE 'ACTIF'
  END as status,
  EXTRACT(EPOCH FROM (expires_at - now())) as seconds_remaining
FROM public.planning_lock
ORDER BY updated_at DESC;

-- 6. Tester si les fonctions actuelles fonctionnent
SELECT 'Test des fonctions existantes' as test_name;

-- Test acquire_planning_lock si elle existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.routines 
    WHERE routine_schema = 'public' 
    AND routine_name = 'acquire_planning_lock'
  ) THEN
    RAISE NOTICE 'Fonction acquire_planning_lock existe';
  ELSE
    RAISE NOTICE 'Fonction acquire_planning_lock N''EXISTE PAS';
  END IF;
END$$;

-- 7. Vérifier les extensions installées
SELECT 
  extname,
  extversion
FROM pg_extension
WHERE extname IN ('pgcrypto', 'uuid-ossp');

-- 8. Résumé de l'état
SELECT 
  'Résumé de l''état actuel' as summary,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'planning_lock') as table_exists,
  (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name LIKE '%planning_lock%') as functions_exist,
  (SELECT COUNT(*) FROM public.planning_lock) as active_locks;
