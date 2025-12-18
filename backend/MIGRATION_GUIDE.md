# Migration System Guide

## Overview

The migration system has been improved with better safety, logging, and rollback capabilities. This guide explains what changed and how to use it in practice.

## What Changed

### 1. **File Naming Convention**

**Before:** Single migration file  
**Now:** Three types of files per migration:

- `migrate-{name}.sql` - **Dry-run preview** (ends with `ROLLBACK`)
- `migrate-{name}-apply.sql` - **Apply changes** (ends with `COMMIT`)
- `migrate-{name}-rollback.sql` - **Reverse migration dry-run** (NEW)
- `migrate-{name}-rollback-apply.sql` - **Reverse migration apply** (NEW)

### 2. **Structured Logging**

Migrations now output structured logs with:
- `[METRICS]` tags for key statistics
- Timestamps for each operation
- Row counts and performance data

**Example output:**
```
========================================
Migration: set-term-ids (DRY-RUN)
Started at: 2025-01-15 10:30:00
========================================
[INDEX CHECK] term_id index: EXISTS
[METRICS] Migration will update 45 users out of 60 non-pending users.
[2025-01-15 10:30:05] Starting UPDATE operation...
[METRICS] Rows updated: 45
```

### 3. **Safety Checks**

Migrations now validate:
- Column existence before using it
- Whether migration already ran
- Required terms/data exist
- Index availability (performance warnings)

### 4. **Rollback Scripts**

You can now undo migrations if needed using the rollback scripts.

## Developer Workflow

### Running a Migration (Recommended Process)

**Step 1: Preview (Dry-Run)**
```bash
psql -d your_database -f backend/migrate-set-term-ids.sql
```

This shows you:
- What will change
- How many rows affected
- Index status
- Any warnings

**Step 2: Review Output**
- Check the `[METRICS]` lines
- Verify the sample rows look correct
- Note any warnings about indexes

**Step 3: Apply (If Everything Looks Good)**
```bash
psql -d your_database -f backend/migrate-set-term-ids-apply.sql
```

### What You'll See

**New Logging Output:**
- Migration start/end timestamps
- `[METRICS]` tags with statistics
- `[INDEX CHECK]` status messages
- `[PERFORMANCE]` warnings if indexes are missing

**Example:**
```
[INDEX CHECK] term_id index: MISSING (may impact performance)
[PERFORMANCE] Consider adding indexes: CREATE INDEX idx_users_term_id_role...
```

### If Something Goes Wrong

**Option 1: Rollback (If Migration Already Applied)**
```bash
# Preview rollback
psql -d your_database -f backend/migrate-set-term-ids-rollback.sql

# Apply rollback
psql -d your_database -f backend/migrate-set-term-ids-rollback-apply.sql
```

**Option 2: Transaction Already Rolled Back**
- Dry-run files end with `ROLLBACK` - changes are automatically undone
- Just close the connection if you see an error

### Updating Migration Constants

If you need to change the date boundaries (e.g., for a different year):

**Before:** Hard-coded dates scattered throughout  
**Now:** Update the `WITH migration_constants AS` CTE in each query

**Files to update:**
1. `migrate-set-term-ids.sql` - 3 places (lines ~98, ~117, ~150)
2. `migrate-set-term-ids-apply.sql` - 3 places (same pattern)

**Example:**
```sql
WITH migration_constants AS (
  SELECT 
    '2026-01-01'::DATE as fall_year_start,  -- Changed from 2025
    '2027-01-01'::DATE as fall_year_end,    -- Changed from 2026
    'fall'::VARCHAR(50) as fall_term_name,
    'fall/winter'::VARCHAR(50) as fall_winter_term_name
)
```

## Important Notes

### ⚠️ Breaking Changes

1. **Column Existence Check**
   - Migration will **fail** if `expiry_date` column doesn't exist
   - This is intentional - prevents running outdated migrations
   - If you see this error, the migration may have already been superseded

2. **Migration Tracking**
   - Migration warns if it appears to have already run
   - Check the `[METRICS]` output to verify

3. **Index Warnings**
   - Missing indexes won't stop the migration
   - But you'll see performance warnings
   - Consider adding indexes for large tables

### ✅ What Stayed the Same

- Migration logic (same business rules)
- Transaction safety (still uses BEGIN/COMMIT/ROLLBACK)
- Manual execution (still run via psql/pgAdmin)

### 🆕 New Capabilities

- **Rollback scripts** - Can undo migrations
- **Better visibility** - Structured logging shows what's happening
- **Performance awareness** - Index checks warn about slow queries
- **Safety** - More validation prevents mistakes

## Common Scenarios

### Scenario 1: Running Migration for First Time

```bash
# 1. Preview
psql -d production -f backend/migrate-set-term-ids.sql > preview.log

# 2. Review preview.log
cat preview.log | grep -E "\[METRICS\]|\[INDEX|WARNING"

# 3. If looks good, apply
psql -d production -f backend/migrate-set-term-ids-apply.sql
```

### Scenario 2: Migration Already Ran

You'll see:
```
WARNING: All non-pending users already have term_id set. This migration may have already been run.
```

**Action:** Check your migration history. The migration may have already completed.

### Scenario 3: Need to Undo Migration

```bash
# 1. Preview rollback
psql -d production -f backend/migrate-set-term-ids-rollback.sql

# 2. Review output

# 3. Apply rollback
psql -d production -f backend/migrate-set-term-ids-rollback-apply.sql
```

### Scenario 4: Missing Indexes

You'll see:
```
[INDEX CHECK] term_id index: MISSING (may impact performance)
[PERFORMANCE] Consider adding indexes: CREATE INDEX idx_users_term_id_role...
```

**Action:** 
- For small tables (< 1000 rows): Can ignore
- For large tables: Add the suggested index before running migration

## Best Practices

1. **Always preview first** - Use the dry-run file before applying
2. **Check logs** - Look for `[METRICS]` and `[INDEX CHECK]` output
3. **Backup before apply** - Especially for production
4. **Use rollback if needed** - The rollback scripts are there for safety
5. **Update constants carefully** - If changing dates, update all CTEs consistently

## Troubleshooting

### Error: "expiry_date column does not exist"

**Cause:** Column was removed in a later migration  
**Solution:** This migration is no longer applicable. Users may already have `term_id` set via a different path.

### Error: "Required term 'fall' does not exist"

**Cause:** Terms table doesn't have the required terms  
**Solution:** The migration tries to create them, but if it fails, check your terms table schema.

### Warning: "All non-pending users already have term_id set"

**Cause:** Migration appears to have already run  
**Solution:** Check your database state. If migration already completed, you don't need to run it again.

### Performance: Migration is slow

**Cause:** Missing indexes  
**Solution:** Add the suggested indexes from the `[PERFORMANCE]` warning before running the migration.

## Summary

**What you need to do differently:**
- ✅ Use dry-run files first (preview before applying)
- ✅ Pay attention to `[METRICS]` and `[INDEX CHECK]` output
- ✅ Use rollback scripts if you need to undo

**What you can ignore:**
- ⚠️ Index warnings are informational (migration still works)
- ⚠️ Some warnings are just notifications (not errors)

**New safety features:**
- 🛡️ Column existence checks prevent errors
- 🛡️ Migration tracking prevents duplicate runs
- 🛡️ Rollback scripts allow recovery

The migration system is now more robust, but the core workflow remains the same: preview, review, apply.

