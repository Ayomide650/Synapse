const fs = require('fs');
const path = require('path');
const config = require('../config/config');

class DatabaseService {
  constructor() {
    this.dataDir = config.database.dataDir;
    this.backupDir = config.database.backupDir;
    this.initializeDirs();
  }

  initializeDirs() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  async read(filename) {
    const filePath = path.join(this.dataDir, filename);
    if (!fs.existsSync(filePath)) return null;
    
    try {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error(`Error reading ${filename}:`, error);
      return null;
    }
  }

  async write(filename, data) {
    const filePath = path.join(this.dataDir, filename);
    const backupPath = path.join(this.backupDir, `${filename}.backup`);

    try {
      // Create backup of existing file
      if (fs.existsSync(filePath)) {
        fs.copyFileSync(filePath, backupPath);
      }

      // Write new data
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

      // Remove backup on success
      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
      }

      return true;
    } catch (error) {
      console.error(`Error writing ${filename}:`, error);
      
      // Restore from backup if write failed
      if (fs.existsSync(backupPath)) {
        fs.copyFileSync(backupPath, filePath);
        fs.unlinkSync(backupPath);
      }
      
      return false;
    }
  }

  async createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFolder = path.join(this.backupDir, timestamp);
    
    try {
      fs.mkdirSync(backupFolder, { recursive: true });
      
      const files = fs.readdirSync(this.dataDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          fs.copyFileSync(
            path.join(this.dataDir, file),
            path.join(backupFolder, file)
          );
        }
      }

      // Keep only last 30 backups
      const backups = fs.readdirSync(this.backupDir)
        .filter(f => fs.statSync(path.join(this.backupDir, f)).isDirectory())
        .sort()
        .slice(0, -30);

      for (const backup of backups) {
        fs.rmSync(path.join(this.backupDir, backup), { recursive: true });
      }

      return true;
    } catch (error) {
      console.error('Error creating backup:', error);
      return false;
    }
  }
}

module.exports = new DatabaseService();