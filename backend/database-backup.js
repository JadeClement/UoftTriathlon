const fs = require('fs');
const path = require('path');
const { db } = require('./database');

// Backup directory
const backupDir = path.join(__dirname, 'backups');

// Ensure backup directory exists
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

// Create backup function
function createBackup() {
  return new Promise((resolve, reject) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `backup-${timestamp}.db`);
    
    console.log('💾 Creating database backup...');
    
    // Create a backup by copying the database file
    const sourcePath = path.join(__dirname, 'triathlon_club.db');
    
    if (!fs.existsSync(sourcePath)) {
      reject(new Error('Source database file not found'));
      return;
    }
    
    try {
      fs.copyFileSync(sourcePath, backupPath);
      console.log(`✅ Backup created: ${backupPath}`);
      
      // Keep only the last 5 backups
      cleanupOldBackups();
      
      resolve(backupPath);
    } catch (error) {
      console.error('❌ Backup failed:', error);
      reject(error);
    }
  });
}

// Cleanup old backups (keep only last 5)
function cleanupOldBackups() {
  try {
    const files = fs.readdirSync(backupDir)
      .filter(file => file.endsWith('.db'))
      .map(file => ({
        name: file,
        path: path.join(backupDir, file),
        time: fs.statSync(path.join(backupDir, file)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time);
    
    // Remove old backups (keep only last 5)
    if (files.length > 5) {
      const filesToRemove = files.slice(5);
      filesToRemove.forEach(file => {
        fs.unlinkSync(file.path);
        console.log(`🗑️ Removed old backup: ${file.name}`);
      });
    }
  } catch (error) {
    console.error('⚠️ Error cleaning up old backups:', error);
  }
}

// Restore from backup function
function restoreFromBackup(backupPath) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(backupPath)) {
      reject(new Error('Backup file not found'));
      return;
    }
    
    console.log('🔄 Restoring database from backup...');
    
    try {
      const targetPath = path.join(__dirname, 'triathlon_club.db');
      
      // Copy backup to main database
      fs.copyFileSync(backupPath, targetPath);
      console.log('✅ Database restored from backup');
      
      // Note: Database reconnection will happen automatically on next request
      // since the database file has been replaced
      console.log('✅ Database file replaced, will reconnect on next request');
      
      resolve();
    } catch (error) {
      console.error('❌ Restore failed:', error);
      reject(error);
    }
  });
}

// List available backups
function listBackups() {
  try {
    const files = fs.readdirSync(backupDir)
      .filter(file => file.endsWith('.db'))
      .map(file => {
        const filePath = path.join(backupDir, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          size: (stats.size / 1024 / 1024).toFixed(2) + ' MB',
          created: stats.mtime.toISOString()
        };
      })
      .sort((a, b) => new Date(b.created) - new Date(a.created));
    
    return files;
  } catch (error) {
    console.error('Error listing backups:', error);
    return [];
  }
}

// Auto-backup every hour
function startAutoBackup() {
  setInterval(() => {
    createBackup().catch(error => {
      console.error('Auto-backup failed:', error);
    });
  }, 60 * 60 * 1000); // Every hour
  
  console.log('🕐 Auto-backup started (every hour)');
}

module.exports = {
  createBackup,
  restoreFromBackup,
  listBackups,
  startAutoBackup
};
