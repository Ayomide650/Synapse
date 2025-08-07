const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const config = require('../config/config');

class Database {
  constructor() {
    this.cache = new Map();
    
    // Handle both old and new config structures
    const currentConfig = typeof config.getCurrentConfig === 'function' 
      ? config.getCurrentConfig() 
      : config;
    
    // GitHub configuration
    this.githubToken = process.env.GITHUB_TOKEN;
    this.githubOwner = 'Ayomide650';
    this.githubRepo = 'my-bot-data';
    this.githubApiBase = 'https://api.github.com';
    
    // Local paths for temporary storage and caching
    this.dataPath = path.join(process.cwd(), 'temp_data');
    this.backupPath = path.join(process.cwd(), 'temp_backups');
    this.configPath = path.join(process.cwd(), 'db.config.json');
    this.metadataPath = path.join(this.dataPath, '.metadata.json');
    this.isInitialized = false;
    
    // Use config values with fallbacks
    this.compressionEnabled = currentConfig.compression !== false;
    this.maxBackups = currentConfig.maxBackups || 10;
    this.maxCacheSize = currentConfig.maxCacheSize || 1000;
    
    // GitHub API headers
    this.githubHeaders = {
      'Authorization': `token ${this.githubToken}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'SynapseBot-Storage'
    };
    
    // Auto-initialize on startup
    this.initialize();
  }

  async initialize() {
    if (this.isInitialized) return;
    
    try {
      // Verify GitHub token
      if (!this.githubToken) {
        throw new Error('GITHUB_TOKEN environment variable is required');
      }
      
      // Test GitHub connection
      await this.testGitHubConnection();
      
      // Create local temp directories
      await fs.mkdir(this.dataPath, { recursive: true });
      await fs.mkdir(this.backupPath, { recursive: true });
      
      // Load or create persistent configuration
      await this.loadOrCreateConfig();
      
      // Sync data from GitHub
      await this.syncFromGitHub();
      
      // Load metadata for tracking database state
      await this.loadMetadata();
      
      this.isInitialized = true;
      console.log('Database initialized successfully');
      console.log(`GitHub repo: ${this.githubOwner}/${this.githubRepo}`);
      console.log(`Local cache enabled: ${this.config.persistCache ? 'Yes' : 'No'}`);
      console.log(`Compression enabled: ${this.compressionEnabled ? 'Yes' : 'No'}`);
      
    } catch (error) {
      console.error('Error initializing database:', error);
      throw error;
    }
  }

  async testGitHubConnection() {
    try {
      const response = await axios.get(
        `${this.githubApiBase}/repos/${this.githubOwner}/${this.githubRepo}`,
        { headers: this.githubHeaders }
      );
      console.log('GitHub connection successful');
      return true;
    } catch (error) {
      if (error.response?.status === 404) {
        throw new Error(`Repository ${this.githubOwner}/${this.githubRepo} not found or no access`);
      }
      throw new Error(`GitHub connection failed: ${error.message}`);
    }
  }

  async syncFromGitHub() {
    try {
      console.log('Syncing data from GitHub...');
      
      // Get all files from the data directory in GitHub
      const response = await axios.get(
        `${this.githubApiBase}/repos/${this.githubOwner}/${this.githubRepo}/contents/data`,
        { headers: this.githubHeaders }
      );
      
      const files = response.data;
      let syncCount = 0;
      
      for (const file of files) {
        if (file.type === 'file' && file.name.endsWith('.json')) {
          const content = await this.downloadFromGitHub(`data/${file.name}`);
          if (content) {
            // Save to local cache
            const localPath = path.join(this.dataPath, file.name);
            await fs.writeFile(localPath, JSON.stringify(content, null, 2));
            
            // Cache in memory
            this.setCacheItem(file.name, {
              data: content,
              timestamp: Date.now(),
              sha: file.sha
            });
            
            syncCount++;
          }
        }
      }
      
      console.log(`Synced ${syncCount} files from GitHub`);
      
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('No existing data directory in GitHub repo - starting fresh');
      } else {
        console.error('Error syncing from GitHub:', error.message);
      }
    }
  }

  async downloadFromGitHub(filePath) {
    try {
      const response = await axios.get(
        `${this.githubApiBase}/repos/${this.githubOwner}/${this.githubRepo}/contents/${filePath}`,
        { headers: this.githubHeaders }
      );
      
      // GitHub returns base64 encoded content
      const content = Buffer.from(response.data.content, 'base64').toString('utf8');
      return JSON.parse(content);
      
    } catch (error) {
      if (error.response?.status === 404) {
        return null; // File doesn't exist
      }
      throw error;
    }
  }

  async uploadToGitHub(fileName, data, sha = null) {
    try {
      const filePath = `data/${fileName}`;
      const content = Buffer.from(JSON.stringify(data, null, this.compressionEnabled ? 0 : 2)).toString('base64');
      
      const payload = {
        message: `Update ${fileName}`,
        content: content
      };
      
      // If we have the SHA, include it for updates
      if (sha) {
        payload.sha = sha;
      }
      
      const response = await axios.put(
        `${this.githubApiBase}/repos/${this.githubOwner}/${this.githubRepo}/contents/${filePath}`,
        payload,
        { headers: this.githubHeaders }
      );
      
      return response.data.content.sha;
      
    } catch (error) {
      console.error(`Error uploading ${fileName} to GitHub:`, error.message);
      throw error;
    }
  }

  async loadOrCreateConfig() {
    try {
      const configData = await fs.readFile(this.configPath, 'utf8');
      this.config = JSON.parse(configData);
    } catch (error) {
      // Get current config for defaults
      const currentConfig = typeof config.getCurrentConfig === 'function' 
        ? config.getCurrentConfig() 
        : config;
      
      // Create default config if doesn't exist
      this.config = {
        version: '1.0.0',
        persistCache: currentConfig.database?.persistCache !== false,
        autoBackup: currentConfig.database?.autoBackup !== false,
        compressionLevel: currentConfig.database?.compressionLevel || 6,
        maxFileSize: currentConfig.maxFileSize || 10 * 1024 * 1024, // 10MB per file
        created: new Date().toISOString(),
        lastStartup: new Date().toISOString(),
        githubSync: true
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
        lastGitHubSync: null,
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

  // Enhanced read with GitHub sync
  async read(fileName) {
    await this.initialize();
    
    try {
      // Check cache first
      if (this.cache.has(fileName)) {
        const cached = this.cache.get(fileName);
        return cached.data;
      }

      // Try to read from GitHub
      const data = await this.downloadFromGitHub(`data/${fileName}`);
      
      if (data) {
        // Cache the data
        this.setCacheItem(fileName, {
          data: data,
          timestamp: Date.now()
        });
        
        return data;
      }
      
      return null; // File doesn't exist
      
    } catch (error) {
      console.error(`Error reading ${fileName}:`, error.message);
      return null;
    }
  }

  // Enhanced write with GitHub sync
  async write(fileName, data) {
    await this.initialize();
    
    try {
      // Get current SHA if file exists
      let currentSha = null;
      const cached = this.cache.get(fileName);
      if (cached && cached.sha) {
        currentSha = cached.sha;
      }
      
      // Upload to GitHub
      const newSha = await this.uploadToGitHub(fileName, data, currentSha);
      
      // Update local cache
      this.setCacheItem(fileName, {
        data: data,
        timestamp: Date.now(),
        sha: newSha
      });
      
      // Save locally as backup
      const localPath = path.join(this.dataPath, fileName);
      await fs.writeFile(localPath, JSON.stringify(data, null, 2));
      
      // Update metadata
      const jsonData = JSON.stringify(data);
      await this.updateFileMetadata(fileName, jsonData.length);
      
      console.log(`Successfully wrote ${fileName} to GitHub`);
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
    this.metadata.lastGitHubSync = new Date().toISOString();
    await this.saveMetadata();
  }

  async createBackupIfExists(fileName) {
    try {
      // Check if file exists in GitHub
      const existingData = await this.downloadFromGitHub(`data/${fileName}`);
      if (!existingData) return; // File doesn't exist
      
      // Create backup in GitHub
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `${fileName}.${timestamp}.bak`;
      
      await this.uploadToGitHub(`backups/${backupFileName}`, existingData);
      console.log(`Created backup: ${backupFileName}`);
      
      // Enhanced backup cleanup
      await this.cleanupBackups(fileName);
      
    } catch (error) {
      console.log(`Backup skipped for ${fileName}:`, error.message);
    }
  }

  async cleanupBackups(fileName) {
    try {
      // Get all backup files from GitHub
      const response = await axios.get(
        `${this.githubApiBase}/repos/${this.githubOwner}/${this.githubRepo}/contents/backups`,
        { headers: this.githubHeaders }
      );
      
      const backups = response.data
        .filter(file => file.name.startsWith(fileName) && file.name.endsWith('.bak'))
        .sort((a, b) => b.name.localeCompare(a.name)); // Sort by name (newest first)
      
      if (backups.length > this.maxBackups) {
        const oldBackups = backups.slice(this.maxBackups);
        
        for (const backup of oldBackups) {
          await axios.delete(
            `${this.githubApiBase}/repos/${this.githubOwner}/${this.githubRepo}/contents/backups/${backup.name}`,
            {
              headers: this.githubHeaders,
              data: {
                message: `Delete old backup: ${backup.name}`,
                sha: backup.sha
              }
            }
          );
        }
        
        console.log(`Cleaned up ${oldBackups.length} old backups for ${fileName}`);
      }
    } catch (error) {
      if (error.response?.status !== 404) {
        console.error('Error cleaning up backups:', error);
      }
    }
  }

  async delete(fileName) {
    await this.initialize();
    
    try {
      // Get file SHA from GitHub
      const response = await axios.get(
        `${this.githubApiBase}/repos/${this.githubOwner}/${this.githubRepo}/contents/data/${fileName}`,
        { headers: this.githubHeaders }
      );
      
      // Delete from GitHub
      await axios.delete(
        `${this.githubApiBase}/repos/${this.githubOwner}/${this.githubRepo}/contents/data/${fileName}`,
        {
          headers: this.githubHeaders,
          data: {
            message: `Delete ${fileName}`,
            sha: response.data.sha
          }
        }
      );
      
      // Remove from cache
      this.cache.delete(fileName);
      
      // Delete local file
      try {
        await fs.unlink(path.join(this.dataPath, fileName));
      } catch (e) {
        // Ignore if local file doesn't exist
      }
      
      // Update metadata
      if (this.metadata.fileRegistry[fileName]) {
        this.metadata.totalSize -= this.metadata.fileRegistry[fileName].size || 0;
        this.metadata.totalFiles--;
        delete this.metadata.fileRegistry[fileName];
        await this.saveMetadata();
      }
      
      console.log(`Successfully deleted ${fileName} from GitHub`);
      return true;
      
    } catch (error) {
      if (error.response?.status === 404) {
        console.log(`File ${fileName} doesn't exist in GitHub`);
        return true; // File already doesn't exist
      }
      console.error(`Error deleting ${fileName}:`, error);
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
      lastStartup: this.config.lastStartup,
      lastGitHubSync: this.metadata.lastGitHubSync,
      githubRepo: `${this.githubOwner}/${this.githubRepo}`
    };
    
    return stats;
  }

  async vacuum() {
    console.log('Starting database vacuum...');
    
    // Sync with GitHub to get latest state
    await this.syncFromGitHub();
    
    // Clean up orphaned cache entries
    const validFiles = Array.from(this.cache.keys());
    
    // Clean up old local files
    try {
      const localFiles = await fs.readdir(this.dataPath);
      for (const file of localFiles) {
        if (file.endsWith('.json') && !validFiles.includes(file)) {
          await fs.unlink(path.join(this.dataPath, file));
        }
      }
    } catch (e) {
      // Ignore errors
    }
    
    this.metadata.lastCleanup = new Date().toISOString();
    await this.saveMetadata();
    
    console.log('Database vacuum completed');
  }

  clearCache(fileName = null) {
    if (fileName) {
      this.cache.delete(fileName);
    } else {
      this.cache.clear();
    }
  }

  // Graceful shutdown
  async shutdown() {
    console.log('Shutting down database...');
    
    try {
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
