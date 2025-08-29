-- Script pour vérifier l'état des fonctions de verrouillage
-- À exécuter dans l'éditeur SQL de Supabase

-- 1. Vérifier que la table planning_lock existe
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'planning_lock';

-- 2. Vérifier la structure de la table
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'planning_lock'
ORDER BY ordinal_position;

-- 3. Vérifier que les fonctions existent
SELECT 
  routine_name,
  routine_type,
  data_type as return_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name LIKE '%planning_lock%'
ORDER BY routine_name;

-- 4. Vérifier les politiques RLS
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

-- 5. Vérifier les verrous actuels
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

-- 6. Test de la fonction acquire_planning_lock
SELECT * FROM public.acquire_planning_lock('test-resource', 'test-holder', 300);

-- 7. Vérifier le verrou créé
SELECT * FROM public.planning_lock WHERE resource_id = 'test-resource';
