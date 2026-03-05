-- Migration: Add result_fields JSONB column to records table (APPLY VERSION)
-- This allows storing sport-specific data (e.g., average HR, Swolf, SPM, SPL for swim)

BEGIN;

-- Check if column already exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'records' 
        AND column_name = 'result_fields'
    ) THEN
        -- Add the result_fields column
        ALTER TABLE records 
        ADD COLUMN result_fields JSONB;
        
        RAISE NOTICE '✅ Added result_fields column to records table';
    ELSE
        RAISE NOTICE 'ℹ️  result_fields column already exists in records table';
    END IF;
END $$;

-- Verify the column was added
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'records' 
AND column_name = 'result_fields';

COMMIT;

