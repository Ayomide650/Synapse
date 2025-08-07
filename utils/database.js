const fs = require('fs').promises;
const path = require('path');
const config = require('../config/config');

class Database {
  constructor() {
    this.cache = new Map();
    this.dataPath = path.join(process.cwd(), config.dataPath);
    this.backupPath = path.join(process.cwd(), config.backupPath);
    this.initialize();
  }

  async initialize() {
    try {
      await fs.mkdir(this.dataPath, { recursive: true });
      await fs.mkdir(this.backupPath, { recursive: true });
    } catch (error) {
      console.error('Error initializing database directories:', error);
    }
  }

  async read(fileName) {
    try {
      const filePath = path.join(this.dataPath, fileName);
      
      // Return cached data if available
      if (this.cache.has(fileName)) {
        return this.cache.get(fileName);
      }

      const data = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(data);
      this.cache.set(fileName, parsed);
      return parsed;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async write(fileName, data) {
    try {
      const filePath = path.join(this.dataPath, fileName);
      const jsonData = JSON.stringify(data, null, 2);
      
      // Only create backup if file exists
      await this.createBackupIfExists(fileName);
      
      // Atomic write using temporary file
      const tempPath = `${filePath}.tmp`;
      await fs.writeFile(tempPath, jsonData);
      await fs.rename(tempPath, filePath);
      
      // Update cache
      this.cache.set(fileName, data);
      
      return true;
    } catch (error) {
      console.error(`Error writing to ${fileName}:`, error);
      return false;
    }
  }

  async createBackupIfExists(fileName) {
    try {
      const sourcePath = path.join(this.dataPath, fileName);
      
      // Check if source file exists before trying to backup
      try {
        await fs.access(sourcePath);
      } catch (error) {
        // File doesn't exist, skip backup silently
        return;
      }
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = `${fileName}.${timestamp}.bak`;
      const backupPath = path.join(this.backupPath, backupFile);
      
      await fs.copyFile(sourcePath, backupPath);
      
      // Clean old backups (keep last 5)
      const backups = await fs.readdir(this.backupPath);
      const fileBackups = backups.filter(f => f.startsWith(fileName));
      
      if (fileBackups.length > 5) {
        const oldBackups = fileBackups
          .sort()
          .slice(0, fileBackups.length - 5);
        
        for (const backup of oldBackups) {
          await fs.unlink(path.join(this.backupPath, backup));
        }
      }
    } catch (error) {
      // Only log backup errors, don't fail the write operation
      console.log(`Backup skipped for ${fileName} (file may not exist yet)`);
    }
  }

  // Keep the old method for backward compatibility
  async createBackup(fileName) {
    return this.createBackupIfExists(fileName);
  }

  async delete(fileName) {
    try {
      const filePath = path.join(this.dataPath, fileName);
      await fs.unlink(filePath);
      this.cache.delete(fileName);
      return true;
    } catch (error) {
      return false;
    }
  }

  clearCache(fileName = null) {
    if (fileName) {
      this.cache.delete(fileName);
    } else {
      this.cache.clear();
    }
  }
}

module.exports = new Database();
