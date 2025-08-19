-- Ajouter les colonnes manquantes à la table planning_locks
-- À exécuter dans l'éditeur SQL de Supabase

-- Ajouter la colonne force_release_request si elle n'existe pas
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'planning_locks' 
        AND column_name = 'force_release_request'
    ) THEN
        ALTER TABLE public.planning_locks ADD COLUMN force_release_request timestamptz;
    END IF;
END $$;

-- Ajouter la colonne main_request si elle n'existe pas
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'planning_locks' 
        AND column_name = 'main_request'
    ) THEN
        ALTER TABLE public.planning_locks ADD COLUMN main_request timestamptz;
    END IF;
END $$;

-- Vérifier que les colonnes ont été ajoutées
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'planning_locks' 
ORDER BY ordinal_position;
