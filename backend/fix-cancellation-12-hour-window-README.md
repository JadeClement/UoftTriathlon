# Fix Cancellation 12-Hour Window Script

## Overview
This SQL script fixes existing workout cancellations that were incorrectly marked as absences when they happened between 12-24 hours before the workout. 

With the current 12-hour rule, only cancellations within 12 hours of a workout should count as absences. Cancellations between 12-24 hours should NOT count as absences.

## What This Script Does

1. **Identifies problematic records**: Finds cancellations where:
   - `marked_absent = true` (currently marked as absence)
   - Cancellation happened between 12-24 hours before the workout

2. **Updates cancellation records**: Sets `marked_absent = false` and `within_12hrs = false`

3. **Fixes user absence counts**: Decrements the absence count for affected users (removes the incorrectly counted absence)

4. **Removes auto-generated attendance records**: Deletes `workout_attendance` records that were automatically created by these cancellations

## How to Run

### Option 1: Run directly with psql
```bash
psql -d your_database_name -f fix-cancellation-12-hour-window.sql
```

### Option 2: Run step by step (recommended for safety)
1. First, run the SELECT query (Step 1-2) to see what will be changed:
```sql
-- Copy and run the SELECT query from the script first
```

2. Review the results

3. If everything looks correct, run the UPDATE and DELETE statements (Steps 3-5)

4. Verify with the summary query (Step 6)

### Option 3: Using a database client
1. Open the SQL file in your database client (pgAdmin, DBeaver, etc.)
2. Run each step individually to review changes
3. Commit the transaction

## Important Notes

- **Backup first**: Always backup your database before running data modification scripts
- **Test environment**: Consider running this in a test environment first
- **Review output**: The SELECT query at the beginning shows exactly what will be fixed
- **Reversible**: If needed, you could manually restore records, but it's easier to restore from backup

## What Gets Fixed

- Cancellations between 12-24 hours that were marked as absences → now marked as regular cancellations
- User absence counts → decreased by 1 for affected users
- Auto-generated attendance records → removed

## Verification

After running, check:
- Cancellation records with `marked_absent = false` for the 12-24 hour window
- User absence counts decreased appropriately
- No attendance records exist for these cancellations

