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
    this.autoBackup = currentConfig.database?.autoBackup !== false;
    
    // GitHub API headers
    this.githubHeaders = {
      'Authorization': `token ${this.githubToken}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'SynapseBot-Storage'
    };
    
    // Command file mapping for organized storage
    this.commandFiles = {
      // Economy System
      'balance': 'economy/user_balances.json',
      'addcoins': 'economy/user_balances.json',
      'removecoins': 'economy/user_balances.json',
      'setcoins': 'economy/user_balances.json',
      'daily': 'economy/daily_claims.json',
      'coinflip': 'economy/gambling_history.json',
      'dice': 'economy/gambling_history.json',
      
      // Leveling System
      'level': 'leveling/user_levels.json',
      'addxp': 'leveling/user_levels.json',
      'leaderboard': 'leveling/user_levels.json',
      'levelroles': 'leveling/level_roles_config.json',
      'rankrole': 'leveling/rank_roles_config.json',
      
      // Moderation System
      'warn': 'moderation/user_warnings.json',
      'clearwarnings': 'moderation/user_warnings.json',
      'warnings': 'moderation/user_warnings.json',
      'tempban': 'moderation/temp_punishments.json',
      'mute': 'moderation/temp_punishments.json',
      'timeout': 'moderation/temp_punishments.json',
      'modlog': 'moderation/server_configs.json',
      
      // Server Features
      'giveaway': 'features/giveaways.json',
      'remindme': 'features/reminders.json',
      'antilink': 'features/antilink_configs.json',
      'filter': 'features/word_filters.json',
      'welcome': 'features/welcome_configs.json',
      'ff-verify': 'features/verification_data.json'
    };
    
    // Track write operations for better logging
    this.writeQueue = new Map();
    this.lastSync = new Map();
    
    // Auto-initialize on startup
    this.initialize();
  }

  async initialize() {
    if (this.isInitialized) return;
    
    try {
      console.log('🔄 Initializing enhanced database system...');
      
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
      
      // Migrate old data structure if needed
      await this.migrateOldData();
      
      this.isInitialized = true;
      console.log('✅ Enhanced database initialized successfully');
      console.log(`📁 Command files mapped: ${Object.keys(this.commandFiles).length}`);
      console.log(`🔗 GitHub repo: ${this.githubOwner}/${this.githubRepo}`);
      console.log(`💾 Local cache enabled: ${this.config.persistCache ? 'Yes' : 'No'}`);
      console.log(`🗜️ Compression enabled: ${this.compressionEnabled ? 'Yes' : 'No'}`);
      console.log(`📦 Auto-backup enabled: ${this.autoBackup ? 'Yes' : 'No'}`);
      
    } catch (error) {
      console.error('❌ Error initializing database:', error);
      throw error;
    }
  }

  async testGitHubConnection() {
    try {
      const response = await axios.get(
        `${this.githubApiBase}/repos/${this.githubOwner}/${this.githubRepo}`,
        { headers: this.githubHeaders }
      );
      console.log('🔗 GitHub connection successful');
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
      console.log('🔄 Syncing data from GitHub...');
      
      // Get all files from the data directory in GitHub
      const response = await axios.get(
        `${this.githubApiBase}/repos/${this.githubOwner}/${this.githubRepo}/contents/data`,
        { headers: this.githubHeaders }
      );
      
      const files = response.data;
      let syncCount = 0;
      
      // Recursively sync all directories and files
      await this.syncDirectory('data', files);
      
      console.log(`✅ Synced ${this.cache.size} files from GitHub`);
      
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('📁 No existing data directory in GitHub repo - starting fresh');
        await this.createInitialDirectoryStructure();
      } else {
        console.error('❌ Error syncing from GitHub:', error.message);
      }
    }
  }

  async syncDirectory(basePath, items) {
    for (const item of items) {
      if (item.type === 'file' && item.name.endsWith('.json')) {
        const content = await this.downloadFromGitHub(`${basePath}/${item.name}`);
        if (content) {
          // Save to local cache
          const localPath = path.join(this.dataPath, item.name);
          await fs.writeFile(localPath, JSON.stringify(content, null, 2));
          
          // Cache in memory with full path
          const cacheKey = `${basePath}/${item.name}`;
          this.setCacheItem(cacheKey, {
            data: content,
            timestamp: Date.now(),
            sha: item.sha,
            path: basePath
          });
        }
      } else if (item.type === 'dir') {
        // Recursively sync subdirectories
        const subResponse = await axios.get(
          `${this.githubApiBase}/repos/${this.githubOwner}/${this.githubRepo}/contents/${basePath}/${item.name}`,
          { headers: this.githubHeaders }
        );
        await this.syncDirectory(`${basePath}/${item.name}`, subResponse.data);
      }
    }
  }

  async createInitialDirectoryStructure() {
    console.log('🏗️ Creating initial directory structure...');
    
    const directories = [
      'data/economy',
      'data/leveling', 
      'data/moderation',
      'data/features',
      'backups'
    ];
    
    for (const dir of directories) {
      try {
        // Create a placeholder file to create the directory in GitHub
        await this.uploadToGitHub(`${dir}/.gitkeep`, { created: new Date().toISOString() });
        console.log(`📁 Created directory: ${dir}`);
      } catch (error) {
        console.log(`⚠️ Could not create ${dir}:`, error.message);
      }
    }
  }

  async migrateOldData() {
    console.log('🔄 Checking for data migration...');
    
    // Check if old data files exist and migrate them
    const oldFiles = [
      'giveaways.json',
      'users.json', 
      'servers.json',
      'economy.json',
      'levels.json',
      'warnings.json'
    ];
    
    let migratedCount = 0;
    
    for (const oldFile of oldFiles) {
      const oldData = await this.downloadFromGitHub(`data/${oldFile}`);
      if (oldData) {
        console.log(`📦 Found old data file: ${oldFile}`);
        await this.migrateDataFile(oldFile, oldData);
        migratedCount++;
      }
    }
    
    if (migratedCount > 0) {
      console.log(`✅ Migrated ${migratedCount} old data files`);
    }
  }

  async migrateDataFile(oldFileName, data) {
    // Migration logic based on file type
    switch (oldFileName) {
      case 'giveaways.json':
        await this.write('features/giveaways.json', data);
        break;
      case 'users.json':
      case 'economy.json':
        if (data.balances) await this.write('economy/user_balances.json', data.balances);
        if (data.levels) await this.write('leveling/user_levels.json', data.levels);
        if (data.daily) await this.write('economy/daily_claims.json', data.daily);
        break;
      case 'servers.json':
        if (data.antilink) await this.write('features/antilink_configs.json', data.antilink);
        if (data.welcome) await this.write('features/welcome_configs.json', data.welcome);
        if (data.modlog) await this.write('moderation/server_configs.json', data.modlog);
        break;
      case 'warnings.json':
        await this.write('moderation/user_warnings.json', data);
        break;
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
        `${this.githubApiBase}/repos/${this.githubOwner}/${this.githubRepo}/contents/${fileName}`,
        payload,
        { headers: this.githubHeaders }
      );
      
      return response.data.content.sha;
      
    } catch (error) {
      console.error(`❌ Error uploading ${fileName} to GitHub:`, error.message);
      throw error;
    }
  }

  // Enhanced read method with command file mapping
  async read(fileNameOrCommand) {
    await this.initialize();
    
    try {
      // Check if it's a command name that maps to a specific file
      const actualFileName = this.commandFiles[fileNameOrCommand] || fileNameOrCommand;
      
      // Check cache first
      if (this.cache.has(actualFileName)) {
        const cached = this.cache.get(actualFileName);
        console.log(`📖 Reading ${actualFileName} from cache`);
        return cached.data;
      }

      // Try to read from GitHub
      const data = await this.downloadFromGitHub(actualFileName);
      
      if (data) {
        // Cache the data
        this.setCacheItem(actualFileName, {
          data: data,
          timestamp: Date.now()
        });
        
        console.log(`📖 Read ${actualFileName} from GitHub`);
        return data;
      }
      
      console.log(`📄 File ${actualFileName} doesn't exist - returning empty object`);
      return {}; // Return empty object instead of null for easier handling
      
    } catch (error) {
      console.error(`❌ Error reading ${fileNameOrCommand}:`, error.message);
      return {};
    }
  }

  // Enhanced write method with automatic backup and command file mapping
  async write(fileNameOrCommand, data, options = {}) {
    await this.initialize();
    
    try {
      const actualFileName = this.commandFiles[fileNameOrCommand] || fileNameOrCommand;
      
      // Create backup if enabled and file exists
      if (this.autoBackup && !options.skipBackup) {
        await this.createBackupIfExists(actualFileName);
      }
      
      // Get current SHA if file exists
      let currentSha = null;
      const cached = this.cache.get(actualFileName);
      if (cached && cached.sha) {
        currentSha = cached.sha;
      }
      
      // Upload to GitHub
      const newSha = await this.uploadToGitHub(actualFileName, data, currentSha);
      
      // Update local cache
      this.setCacheItem(actualFileName, {
        data: data,
        timestamp: Date.now(),
        sha: newSha
      });
      
      // Save locally as backup
      const localPath = path.join(this.dataPath, path.basename(actualFileName));
      await fs.writeFile(localPath, JSON.stringify(data, null, 2));
      
      // Update metadata
      const jsonData = JSON.stringify(data);
      await this.updateFileMetadata(actualFileName, jsonData.length);
      
      // Track last sync
      this.lastSync.set(actualFileName, Date.now());
      
      console.log(`✅ Successfully wrote ${actualFileName} to GitHub (${jsonData.length} bytes)`);
      return true;
      
    } catch (error) {
      console.error(`❌ Error writing to ${fileNameOrCommand}:`, error);
      return false;
    }
  }

  // Command-specific helper methods
  async readUserData(userId, dataType = 'balance') {
    const fileName = this.getFileForDataType(dataType);
    const data = await this.read(fileName);
    return data[userId] || this.getDefaultUserData(dataType);
  }

  async writeUserData(userId, userData, dataType = 'balance') {
    const fileName = this.getFileForDataType(dataType);
    const data = await this.read(fileName);
    data[userId] = userData;
    return await this.write(fileName, data);
  }

  async readServerData(guildId, dataType = 'config') {
    const fileName = this.getFileForServerDataType(dataType);
    const data = await this.read(fileName);
    return data[guildId] || this.getDefaultServerData(dataType);
  }

  async writeServerData(guildId, serverData, dataType = 'config') {
    const fileName = this.getFileForServerDataType(dataType);
    const data = await this.read(fileName);
    data[guildId] = serverData;
    return await this.write(fileName, data);
  }

  getFileForDataType(dataType) {
    const mapping = {
      'balance': 'economy/user_balances.json',
      'daily': 'economy/daily_claims.json',
      'level': 'leveling/user_levels.json',
      'warnings': 'moderation/user_warnings.json'
    };
    return mapping[dataType] || 'data/users.json';
  }

  getFileForServerDataType(dataType) {
    const mapping = {
      'config': 'moderation/server_configs.json',
      'antilink': 'features/antilink_configs.json',
      'welcome': 'features/welcome_configs.json',
      'levelroles': 'leveling/level_roles_config.json',
      'rankroles': 'leveling/rank_roles_config.json'
    };
    return mapping[dataType] || 'data/servers.json';
  }

  getDefaultUserData(dataType) {
    const defaults = {
      'balance': { coins: 0, bank: 0 },
      'daily': { lastClaim: null, streak: 0 },
      'level': { xp: 0, level: 1, totalXp: 0 },
      'warnings': []
    };
    return defaults[dataType] || {};
  }

  getDefaultServerData(dataType) {
    const defaults = {
      'config': { modLogChannel: null },
      'antilink': { enabled: false, action: 'warn' },
      'welcome': { enabled: false, channel: null, message: null },
      'levelroles': {},
      'rankroles': {}
    };
    return defaults[dataType] || {};
  }

  setCacheItem(key, value) {
    // Implement LRU cache behavior
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
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
        version: '2.0.0',
        persistCache: currentConfig.database?.persistCache !== false,
        autoBackup: currentConfig.database?.autoBackup !== false,
        compressionLevel: currentConfig.database?.compressionLevel || 6,
        maxFileSize: currentConfig.maxFileSize || 10 * 1024 * 1024, // 10MB per file
        created: new Date().toISOString(),
        lastStartup: new Date().toISOString(),
        githubSync: true,
        separateCommandFiles: true
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
      console.error('❌ Error saving config:', error);
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
        fileRegistry: {},
        commandFilesMigrated: false
      };
      await this.saveMetadata();
    }
  }

  async saveMetadata() {
    try {
      await fs.writeFile(this.metadataPath, JSON.stringify(this.metadata, null, 2));
    } catch (error) {
      console.error('❌ Error saving metadata:', error);
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
      const existingData = await this.downloadFromGitHub(fileName);
      if (!existingData) return; // File doesn't exist
      
      // Create backup in GitHub
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `backups/${path.basename(fileName)}.${timestamp}.bak`;
      
      await this.uploadToGitHub(backupFileName, existingData);
      console.log(`📦 Created backup: ${backupFileName}`);
      
      // Enhanced backup cleanup
      await this.cleanupBackups(fileName);
      
    } catch (error) {
      console.log(`⚠️ Backup skipped for ${fileName}:`, error.message);
    }
  }

  async cleanupBackups(fileName) {
    try {
      // Get all backup files from GitHub
      const response = await axios.get(
        `${this.githubApiBase}/repos/${this.githubOwner}/${this.githubRepo}/contents/backups`,
        { headers: this.githubHeaders }
      );
      
      const baseName = path.basename(fileName);
      const backups = response.data
        .filter(file => file.name.startsWith(baseName) && file.name.endsWith('.bak'))
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
        
        console.log(`🧹 Cleaned up ${oldBackups.length} old backups for ${baseName}`);
      }
    } catch (error) {
      if (error.response?.status !== 404) {
        console.error('❌ Error cleaning up backups:', error);
      }
    }
  }

  async delete(fileNameOrCommand) {
    await this.initialize();
    
    try {
      const actualFileName = this.commandFiles[fileNameOrCommand] || fileNameOrCommand;
      
      // Get file SHA from GitHub
      const response = await axios.get(
        `${this.githubApiBase}/repos/${this.githubOwner}/${this.githubRepo}/contents/${actualFileName}`,
        { headers: this.githubHeaders }
      );
      
      // Delete from GitHub
      await axios.delete(
        `${this.githubApiBase}/repos/${this.githubOwner}/${this.githubRepo}/contents/${actualFileName}`,
        {
          headers: this.githubHeaders,
          data: {
            message: `Delete ${actualFileName}`,
            sha: response.data.sha
          }
        }
      );
      
      // Remove from cache
      this.cache.delete(actualFileName);
      
      // Delete local file
      try {
        await fs.unlink(path.join(this.dataPath, path.basename(actualFileName)));
      } catch (e) {
        // Ignore if local file doesn't exist
      }
      
      // Update metadata
      if (this.metadata.fileRegistry[actualFileName]) {
        this.metadata.totalSize -= this.metadata.fileRegistry[actualFileName].size || 0;
        this.metadata.totalFiles--;
        delete this.metadata.fileRegistry[actualFileName];
        await this.saveMetadata();
      }
      
      console.log(`🗑️ Successfully deleted ${actualFileName} from GitHub`);
      return true;
      
    } catch (error) {
      if (error.response?.status === 404) {
        console.log(`⚠️ File ${fileNameOrCommand} doesn't exist in GitHub`);
        return true; // File already doesn't exist
      }
      console.error(`❌ Error deleting ${fileNameOrCommand}:`, error);
      return false;
    }
  }

  // Enhanced utility methods
  async getStats() {
    await this.initialize();
    
    const stats = {
      totalFiles: this.metadata.totalFiles,
      totalSize: this.metadata.totalSize,
      cacheSize: this.cache.size,
      commandFilesMapped: Object.keys(this.commandFiles).length,
      uptime: Date.now() - new Date(this.config.lastStartup).getTime(),
      lastStartup: this.config.lastStartup,
      lastGitHubSync: this.metadata.lastGitHubSync,
      githubRepo: `${this.githubOwner}/${this.githubRepo}`,
      version: this.config.version || '2.0.0',
      autoBackup: this.autoBackup,
      separateCommandFiles: this.config.separateCommandFiles || false
    };
    
    return stats;
  }

  async vacuum() {
    console.log('🧹 Starting enhanced database vacuum...');
    
    // Sync with GitHub to get latest state
    await this.syncFromGitHub();
    
    // Clean up orphaned cache entries
    const validFiles = Array.from(this.cache.keys());
    
    // Clean up old local files
    try {
      const localFiles = await fs.readdir(this.dataPath);
      for (const file of localFiles) {
        if (file.endsWith('.json') && !validFiles.some(f => f.endsWith(file))) {
          await fs.unlink(path.join(this.dataPath, file));
          console.log(`🗑️ Cleaned up orphaned local file: ${file}`);
        }
      }
    } catch (e) {
      // Ignore errors
    }
    
    this.metadata.lastCleanup = new Date().toISOString();
    await this.saveMetadata();
    
    console.log('✅ Enhanced database vacuum completed');
  }

  clearCache(fileName = null) {
    if (fileName) {
      const actualFileName = this.commandFiles[fileName] || fileName;
      this.cache.delete(actualFileName);
      console.log(`🧹 Cleared cache for ${actualFileName}`);
    } else {
      this.cache.clear();
      console.log('🧹 Cleared entire cache');
    }
  }

  // Get mapped file for command
  getCommandFile(commandName) {
    return this.commandFiles[commandName] || null;
  }

  // List all available command files
  getAvailableCommandFiles() {
    return { ...this.commandFiles };
  }

  // Graceful shutdown
  async shutdown() {
    console.log('🔄 Shutting down enhanced database...');
    
    try {
      await this.saveMetadata();
      await this.saveConfig();
      
      console.log('✅ Enhanced database shutdown complete');
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
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
