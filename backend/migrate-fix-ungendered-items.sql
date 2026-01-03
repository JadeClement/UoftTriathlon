-- Migration script to set gender to NULL for swim caps and backpacks
-- These items should not have a gender value

BEGIN;

-- Preview: Show which records will be updated
SELECT 
  id,
  item,
  gender,
  'Will be set to NULL' as action
FROM merch_orders
WHERE gender IS NOT NULL
  AND (
    LOWER(item) LIKE '%swim cap%' OR
    LOWER(item) LIKE '%cap - swim%' OR
    LOWER(item) LIKE '%backpack%' OR
    LOWER(item) LIKE '%bag%'
  )
ORDER BY created_at DESC;

-- Update: Set gender to NULL for swim caps and backpacks
UPDATE merch_orders
SET gender = NULL
WHERE gender IS NOT NULL
  AND (
    LOWER(item) LIKE '%swim cap%' OR
    LOWER(item) LIKE '%cap - swim%' OR
    LOWER(item) LIKE '%backpack%' OR
    LOWER(item) LIKE '%bag%'
  );

-- Verify: Show updated records
SELECT 
  id,
  item,
  gender,
  'Updated' as status
FROM merch_orders
WHERE (
    LOWER(item) LIKE '%swim cap%' OR
    LOWER(item) LIKE '%cap - swim%' OR
    LOWER(item) LIKE '%backpack%' OR
    LOWER(item) LIKE '%bag%'
  )
ORDER BY created_at DESC
LIMIT 20;

-- Summary
SELECT 
  COUNT(*) as total_updated,
  'Records updated (gender set to NULL)' as description
FROM merch_orders
WHERE gender IS NULL
  AND (
    LOWER(item) LIKE '%swim cap%' OR
    LOWER(item) LIKE '%cap - swim%' OR
    LOWER(item) LIKE '%backpack%' OR
    LOWER(item) LIKE '%bag%'
  );

ROLLBACK; -- Change to COMMIT; when ready to apply



