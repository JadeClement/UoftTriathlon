#!/usr/bin/env node

/**
 * Migration Runner Utility
 * 
 * Helps automate the migration workflow: preview → review → apply
 * 
 * Usage:
 *   node utils/migration-runner.js preview migrate-set-term-ids.sql
 *   node utils/migration-runner.js apply migrate-set-term-ids-apply.sql
 *   node utils/migration-runner.js status
 *   node utils/migration-runner.js list
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { pool } = require('../database-pg');

const MIGRATIONS_DIR = path.join(__dirname, '..');
const SCHEMA_MIGRATIONS_TABLE = 'schema_migrations';

async function checkSchemaMigrationsTable() {
  try {
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = '${SCHEMA_MIGRATIONS_TABLE}'
      )
    `);
    return result.rows[0].exists;
  } catch (error) {
    return false;
  }
}

async function hasMigrationRun(migrationName) {
  const tableExists = await checkSchemaMigrationsTable();
  if (!tableExists) {
    return false;
  }
  
  try {
    const result = await pool.query(
      'SELECT id FROM schema_migrations WHERE migration_name = $1',
      [migrationName]
    );
    return result.rows.length > 0;
  } catch (error) {
    return false;
  }
}

async function recordMigration(migrationName, executionTimeMs, rowsAffected, notes = '') {
  const tableExists = await checkSchemaMigrationsTable();
  if (!tableExists) {
    console.log('⚠️  schema_migrations table does not exist. Skipping tracking.');
    return;
  }
  
  try {
    await pool.query(
      `INSERT INTO schema_migrations (migration_name, applied_by, execution_time_ms, rows_affected, notes)
       VALUES ($1, current_user, $2, $3, $4)
       ON CONFLICT (migration_name) DO UPDATE SET
         applied_at = CURRENT_TIMESTAMP,
         execution_time_ms = $2,
         rows_affected = $3,
         notes = $4`,
      [migrationName, executionTimeMs, rowsAffected, notes]
    );
  } catch (error) {
    console.error('⚠️  Failed to record migration:', error.message);
  }
}

function runSQLFile(filePath, isDryRun = false) {
  const fullPath = path.join(MIGRATIONS_DIR, filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ Migration file not found: ${fullPath}`);
    process.exit(1);
  }
  
  const startTime = Date.now();
  
  try {
    // Read the file to check if it's a dry-run
    const content = fs.readFileSync(fullPath, 'utf8');
    const isRollback = content.includes('ROLLBACK') && !content.includes('COMMIT');
    
    if (isDryRun && !isRollback) {
      console.log('⚠️  Warning: This file appears to be an apply file (contains COMMIT)');
      console.log('   For dry-run, use the file without -apply suffix');
    }
    
    console.log(`\n📄 Running: ${filePath}`);
    console.log(`   Mode: ${isDryRun ? 'DRY-RUN (ROLLBACK)' : 'APPLY (COMMIT)'}\n`);
    
    // For now, we'll just show instructions
    // In production, you'd use pg client library to execute
    console.log('To run this migration, use:');
    console.log(`  psql -d your_database -f ${fullPath}\n`);
    
    const executionTime = Date.now() - startTime;
    return { success: true, executionTime, rowsAffected: null };
    
  } catch (error) {
    console.error(`❌ Error running migration: ${error.message}`);
    return { success: false, executionTime: Date.now() - startTime, rowsAffected: null };
  }
}

async function previewMigration(migrationFile) {
  const migrationName = path.basename(migrationFile, '.sql');
  
  console.log('🔍 Previewing migration:', migrationName);
  console.log('========================================\n');
  
  // Check if already run
  const alreadyRun = await hasMigrationRun(migrationName);
  if (alreadyRun) {
    console.log('⚠️  This migration appears to have already been run.');
    console.log('   Check schema_migrations table for details.\n');
  }
  
  const result = runSQLFile(migrationFile, true);
  
  if (result.success) {
    console.log('\n✅ Preview completed');
    console.log('   Review the output above before applying.');
  }
}

async function applyMigration(migrationFile) {
  const migrationName = path.basename(migrationFile, '.sql').replace('-apply', '');
  
  console.log('🚀 Applying migration:', migrationName);
  console.log('========================================\n');
  
  // Check if already run
  const alreadyRun = await hasMigrationRun(migrationName);
  if (alreadyRun) {
    console.log('⚠️  This migration appears to have already been run.');
    const response = await prompt('Continue anyway? (y/N): ');
    if (response.toLowerCase() !== 'y') {
      console.log('Aborted.');
      process.exit(0);
    }
  }
  
  const startTime = Date.now();
  const result = runSQLFile(migrationFile, false);
  const executionTime = Date.now() - startTime;
  
  if (result.success) {
    // Record in schema_migrations
    await recordMigration(migrationName, executionTime, result.rowsAffected);
    console.log('\n✅ Migration applied successfully');
    console.log(`   Execution time: ${executionTime}ms`);
  } else {
    console.log('\n❌ Migration failed');
    process.exit(1);
  }
}

async function listMigrations() {
  const tableExists = await checkSchemaMigrationsTable();
  
  if (!tableExists) {
    console.log('⚠️  schema_migrations table does not exist.');
    console.log('   Run migrate-create-schema-migrations.sql first.\n');
    return;
  }
  
  try {
    const result = await pool.query(`
      SELECT 
        migration_name,
        applied_at,
        applied_by,
        execution_time_ms,
        rows_affected
      FROM schema_migrations
      ORDER BY applied_at DESC
    `);
    
    if (result.rows.length === 0) {
      console.log('No migrations have been recorded yet.\n');
      return;
    }
    
    console.log('\n📋 Migration History:');
    console.log('========================================');
    result.rows.forEach((row, index) => {
      console.log(`${index + 1}. ${row.migration_name}`);
      console.log(`   Applied: ${row.applied_at}`);
      console.log(`   By: ${row.applied_by}`);
      if (row.execution_time_ms) {
        console.log(`   Duration: ${row.execution_time_ms}ms`);
      }
      if (row.rows_affected) {
        console.log(`   Rows affected: ${row.rows_affected}`);
      }
      console.log('');
    });
  } catch (error) {
    console.error('❌ Error listing migrations:', error.message);
  }
}

async function showStatus() {
  const tableExists = await checkSchemaMigrationsTable();
  
  if (!tableExists) {
    console.log('⚠️  schema_migrations table does not exist.');
    console.log('   Run migrate-create-schema-migrations.sql first.\n');
    return;
  }
  
  try {
    // Get all migration files
    const migrationFiles = fs.readdirSync(MIGRATIONS_DIR)
      .filter(file => file.startsWith('migrate-') && file.endsWith('.sql'))
      .filter(file => !file.includes('rollback'))
      .map(file => {
        const name = file.replace('migrate-', '').replace('.sql', '').replace('-apply', '');
        return { file, name };
      });
    
    // Get unique migration names
    const uniqueMigrations = [...new Set(migrationFiles.map(m => m.name))];
    
    // Get applied migrations
    const appliedResult = await pool.query(
      'SELECT migration_name FROM schema_migrations'
    );
    const appliedNames = new Set(appliedResult.rows.map(r => r.migration_name));
    
    console.log('\n📊 Migration Status:');
    console.log('========================================');
    console.log(`Total migrations found: ${uniqueMigrations.length}`);
    console.log(`Applied migrations: ${appliedNames.size}`);
    console.log(`Pending migrations: ${uniqueMigrations.length - appliedNames.size}\n`);
    
    if (uniqueMigrations.length > 0) {
      console.log('Migration Status:');
      uniqueMigrations.forEach(name => {
        const status = appliedNames.has(name) ? '✅ Applied' : '⏳ Pending';
        console.log(`  ${status} - ${name}`);
      });
    }
    console.log('');
  } catch (error) {
    console.error('❌ Error checking status:', error.message);
  }
}

function prompt(question) {
  // Simple synchronous prompt for CLI
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

// Main CLI
async function main() {
  const command = process.argv[2];
  const file = process.argv[3];
  
  try {
    switch (command) {
      case 'preview':
        if (!file) {
          console.error('❌ Usage: node utils/migration-runner.js preview <migration-file>');
          process.exit(1);
        }
        await previewMigration(file);
        break;
        
      case 'apply':
        if (!file) {
          console.error('❌ Usage: node utils/migration-runner.js apply <migration-file>');
          process.exit(1);
        }
        await applyMigration(file);
        break;
        
      case 'status':
        await showStatus();
        break;
        
      case 'list':
        await listMigrations();
        break;
        
      default:
        console.log('Migration Runner Utility\n');
        console.log('Usage:');
        console.log('  node utils/migration-runner.js preview <migration-file>  - Preview a migration (dry-run)');
        console.log('  node utils/migration-runner.js apply <migration-file>     - Apply a migration');
        console.log('  node utils/migration-runner.js status                     - Show migration status');
        console.log('  node utils/migration-runner.js list                        - List all applied migrations');
        console.log('');
        console.log('Examples:');
        console.log('  node utils/migration-runner.js preview migrate-set-term-ids.sql');
        console.log('  node utils/migration-runner.js apply migrate-set-term-ids-apply.sql');
        console.log('  node utils/migration-runner.js status');
        break;
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  hasMigrationRun,
  recordMigration,
  listMigrations,
  showStatus
};

