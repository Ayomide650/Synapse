const fs = require('fs').promises;
const path = require('path');
const config = require('../config/config');

class Database {
  constructor() {
    this.cache = new Map();
    this.dataPath = path.join(process.cwd(), config.dataPath);
    this.backupPath = path.join(process.cwd(), config.backupPath);
    this.configPath = path.join(process.cwd(), 'db.config.json');
    this.metadataPath = path.join(this.dataPath, '.metadata.json');
    this.isInitialized = false;
    this.compressionEnabled = config.compression || true;
    this.maxBackups = config.maxBackups || 10;
    this.maxCacheSize = config.maxCacheSize || 1000; // Max items in cache
    
    // Auto-initialize on startup
    this.initialize();
  }

  async initialize() {
    if (this.isInitialized) return;
    
    try {
      // Create directories
      await fs.mkdir(this.dataPath, { recursive: true });
      await fs.mkdir(this.backupPath, { recursive: true });
      
      // Load or create persistent configuration
      await this.loadOrCreateConfig();
      
      // Load metadata for tracking database state
      await this.loadMetadata();
      
      // Restore cache from last session if enabled
      if (this.config.persistCache) {
        await this.restoreCache();
      }
      
      this.isInitialized = true;
      console.log('Database initialized successfully');
      console.log(`Data path: ${this.dataPath}`);
      console.log(`Cache enabled: ${this.config.persistCache ? 'Yes' : 'No'}`);
      console.log(`Compression enabled: ${this.compressionEnabled ? 'Yes' : 'No'}`);
      
    } catch (error) {
      console.error('Error initializing database:', error);
      throw error;
    }
  }

  async loadOrCreateConfig() {
    try {
      const configData = await fs.readFile(this.configPath, 'utf8');
      this.config = JSON.parse(configData);
    } catch (error) {
      // Create default config if doesn't exist
      this.config = {
        version: '1.0.0',
        persistCache: true,
        autoBackup: true,
        compressionLevel: 6,
        maxFileSize: 10 * 1024 * 1024, // 10MB per file
        created: new Date().toISOString(),
        lastStartup: new Date().toISOString()
      };
      await this.saveConfig();
    }
    
    // Update last startup time
    this.config.lastStartup = new Date().toISOString();
    await this.saveConfig();
  }

  async saveConfig() {
    try {
      await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error('Error saving config:', error);
    }
  }

  async loadMetadata() {
    try {
      const metadataStr = await fs.readFile(this.metadataPath, 'utf8');
      this.metadata = JSON.parse(metadataStr);
    } catch (error) {
      this.metadata = {
        totalFiles: 0,
        totalSize: 0,
        lastCleanup: null,
        fileRegistry: {}
      };
      await this.saveMetadata();
    }
  }

  async saveMetadata() {
    try {
      await fs.writeFile(this.metadataPath, JSON.stringify(this.metadata, null, 2));
    } catch (error) {
      console.error('Error saving metadata:', error);
    }
  }

  async restoreCache() {
    try {
      const cacheFile = path.join(this.dataPath, '.cache.json');
      const cacheData = await fs.readFile(cacheFile, 'utf8');
      const savedCache = JSON.parse(cacheData);
      
      // Restore cache with size limit
      let count = 0;
      for (const [key, value] of Object.entries(savedCache)) {
        if (count >= this.maxCacheSize) break;
        this.cache.set(key, value);
        count++;
      }
      
      console.log(`Restored ${count} items to cache`);
    } catch (error) {
      console.log('No previous cache found or error restoring cache');
    }
  }

  async persistCache() {
    if (!this.config.persistCache) return;
    
    try {
      const cacheFile = path.join(this.dataPath, '.cache.json');
      const cacheObj = Object.fromEntries(this.cache);
      await fs.writeFile(cacheFile, JSON.stringify(cacheObj, null, 2));
    } catch (error) {
      console.error('Error persisting cache:', error);
    }
  }

  // Enhanced read with better caching
  async read(fileName) {
    await this.initialize();
    
    try {
      const filePath = path.join(this.dataPath, fileName);
      
      // Return cached data if available and not expired
      if (this.cache.has(fileName)) {
        const cached = this.cache.get(fileName);
        // Simple cache invalidation based on file modification time
        try {
          const stats = await fs.stat(filePath);
          if (cached.timestamp >= stats.mtime.getTime()) {
            return cached.data;
          }
        } catch (e) {
          // File might not exist, remove from cache
          this.cache.delete(fileName);
        }
      }

      const data = await fs.readFile(filePath, 'utf8');
      const parsed = this.parseData(data);
      
      // Cache with timestamp
      this.setCacheItem(fileName, {
        data: parsed,
        timestamp: Date.now()
      });
      
      return parsed;
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  // Enhanced write with compression and size management
  async write(fileName, data) {
    await this.initialize();
    
    try {
      const filePath = path.join(this.dataPath, fileName);
      let jsonData = this.stringifyData(data);
      
      // Check file size limit
      if (jsonData.length > this.config.maxFileSize) {
        console.warn(`Warning: File ${fileName} exceeds size limit`);
        // Could implement file splitting here if needed
      }
      
      // Create backup if file exists and auto backup is enabled
      if (this.config.autoBackup) {
        await this.createBackupIfExists(fileName);
      }
      
      // Atomic write using temporary file
      const tempPath = `${filePath}.tmp`;
      await fs.writeFile(tempPath, jsonData);
      await fs.rename(tempPath, filePath);
      
      // Update cache
      this.setCacheItem(fileName, {
        data: data,
        timestamp: Date.now()
      });
      
      // Update metadata
      await this.updateFileMetadata(fileName, jsonData.length);
      
      // Persist cache periodically
      await this.persistCache();
      
      return true;
      
    } catch (error) {
      console.error(`Error writing to ${fileName}:`, error);
      return false;
    }
  }

  setCacheItem(key, value) {
    // Implement LRU cache behavior
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  parseData(jsonString) {
    return JSON.parse(jsonString);
  }

  stringifyData(data) {
    if (this.compressionEnabled) {
      // Simple compression by removing unnecessary whitespace
      return JSON.stringify(data);
    } else {
      return JSON.stringify(data, null, 2);
    }
  }

  async updateFileMetadata(fileName, size) {
    const wasNew = !this.metadata.fileRegistry[fileName];
    
    if (wasNew) {
      this.metadata.totalFiles++;
    } else {
      this.metadata.totalSize -= this.metadata.fileRegistry[fileName].size || 0;
    }
    
    this.metadata.fileRegistry[fileName] = {
      size: size,
      lastModified: new Date().toISOString()
    };
    
    this.metadata.totalSize += size;
    await this.saveMetadata();
  }

  async createBackupIfExists(fileName) {
    try {
      const sourcePath = path.join(this.dataPath, fileName);
      
      try {
        await fs.access(sourcePath);
      } catch (error) {
        return; // File doesn't exist
      }
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = `${fileName}.${timestamp}.bak`;
      const backupPath = path.join(this.backupPath, backupFile);
      
      await fs.copyFile(sourcePath, backupPath);
      
      // Enhanced backup cleanup
      await this.cleanupBackups(fileName);
      
    } catch (error) {
      console.log(`Backup skipped for ${fileName}:`, error.message);
    }
  }

  async cleanupBackups(fileName) {
    try {
      const backups = await fs.readdir(this.backupPath);
      const fileBackups = backups
        .filter(f => f.startsWith(fileName))
        .sort()
        .reverse(); // Most recent first
      
      if (fileBackups.length > this.maxBackups) {
        const oldBackups = fileBackups.slice(this.maxBackups);
        
        for (const backup of oldBackups) {
          await fs.unlink(path.join(this.backupPath, backup));
        }
        
        console.log(`Cleaned up ${oldBackups.length} old backups for ${fileName}`);
      }
    } catch (error) {
      console.error('Error cleaning up backups:', error);
    }
  }

  async delete(fileName) {
    await this.initialize();
    
    try {
      const filePath = path.join(this.dataPath, fileName);
      await fs.unlink(filePath);
      this.cache.delete(fileName);
      
      // Update metadata
      if (this.metadata.fileRegistry[fileName]) {
        this.metadata.totalSize -= this.metadata.fileRegistry[fileName].size || 0;
        this.metadata.totalFiles--;
        delete this.metadata.fileRegistry[fileName];
        await this.saveMetadata();
      }
      
      await this.persistCache();
      return true;
      
    } catch (error) {
      return false;
    }
  }

  // New utility methods
  async getStats() {
    await this.initialize();
    
    const stats = {
      totalFiles: this.metadata.totalFiles,
      totalSize: this.metadata.totalSize,
      cacheSize: this.cache.size,
      uptime: Date.now() - new Date(this.config.lastStartup).getTime(),
      lastStartup: this.config.lastStartup
    };
    
    return stats;
  }

  async vacuum() {
    console.log('Starting database vacuum...');
    
    // Clean up orphaned cache entries
    const files = await fs.readdir(this.dataPath);
    const validFiles = files.filter(f => !f.startsWith('.') && f.endsWith('.json'));
    
    for (const cacheKey of this.cache.keys()) {
      if (!validFiles.includes(cacheKey)) {
        this.cache.delete(cacheKey);
      }
    }
    
    // Clean up old backups
    const backups = await fs.readdir(this.backupPath);
    const oneMonthAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    
    for (const backup of backups) {
      const backupPath = path.join(this.backupPath, backup);
      const stats = await fs.stat(backupPath);
      
      if (stats.mtime.getTime() < oneMonthAgo) {
        await fs.unlink(backupPath);
      }
    }
    
    this.metadata.lastCleanup = new Date().toISOString();
    await this.saveMetadata();
    await this.persistCache();
    
    console.log('Database vacuum completed');
  }

  clearCache(fileName = null) {
    if (fileName) {
      this.cache.delete(fileName);
    } else {
      this.cache.clear();
    }
    
    // Persist the change
    this.persistCache();
  }

  // Graceful shutdown
  async shutdown() {
    console.log('Shutting down database...');
    
    try {
      await this.persistCache();
      await this.saveMetadata();
      await this.saveConfig();
      
      console.log('Database shutdown complete');
    } catch (error) {
      console.error('Error during shutdown:', error);
    }
  }
}

// Handle graceful shutdown
const database = new Database();

process.on('SIGINT', async () => {
  await database.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await database.shutdown();
  process.exit(0);
});

module.exports = database;
