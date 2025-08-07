// Only load dotenv in local development
if (!process.env.GITHUB_ACTIONS) {
  try {
    require('dotenv').config();
  } catch (error) {
    console.log('dotenv not available, using environment variables directly');
  }
}

const path = require('path');

module.exports = {
  // Bot Configuration
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID,
  
  // API Configuration
  port: process.env.PORT || 3000,
  
  // Database Configuration - Updated to use environment variables with database.js compatibility
  dataPath: process.env.DATA_PATH || './data',
  backupPath: process.env.BACKUP_PATH || './data/backups',
  
  // Database optimization settings (for database.js compatibility)
  compression: process.env.DB_COMPRESSION !== 'false', // Enable compression by default
  maxBackups: parseInt(process.env.DB_MAX_BACKUPS) || 10,
  maxCacheSize: parseInt(process.env.DB_MAX_CACHE_SIZE) || 1000,
  maxFileSize: parseInt(process.env.DB_MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB default
  
  // Add database object for services that expect this structure
  database: {
    dataDir: process.env.DATA_PATH || './data',
    backupDir: process.env.BACKUP_PATH || './data/backups',
    // Additional database settings
    persistCache: process.env.DB_PERSIST_CACHE !== 'false',
    autoBackup: process.env.DB_AUTO_BACKUP !== 'false',
    compressionLevel: parseInt(process.env.DB_COMPRESSION_LEVEL) || 6
  },
  
  // Channel Configuration
  channels: {
    serverLog: process.env.SERVER_LOG_CHANNEL,
    giveaway: process.env.GIVEAWAY_CHANNEL_ID
  },
  
  // Economy Configuration
  economy: {
    dailyAmount: parseInt(process.env.DAILY_AMOUNT) || 100
  },
  
  // Feature Flags
  features: {
    antiLink: true,
    leveling: true,
    economy: true,
    moderation: true
  },
  
  // Command Categories
  categories: [
    'Moderation',
    'Economy',
    'Leveling',
    'Utility',
    'Fun',
    'Admin'
  ],
  
  // Default Settings
  defaults: {
    prefix: '/',
    deleteCommandMessages: true,
    colorSuccess: 0x00ff00,
    colorError: 0xff0000,
    colorNeutral: 0x2f3136
  },
  
  // Cooldowns
  cooldowns: {
    daily: 24 * 60 * 60 * 1000,
    xp: 60 * 1000
  },
  
  // Environment specific settings
  development: {
    logLevel: 'debug',
    compressionLevel: 2, // Faster compression for dev
  },
  
  production: {
    logLevel: 'error',
    compressionLevel: 6, // Better compression for production
  },
  
  // Get current environment config
  getCurrentConfig() {
    const env = process.env.NODE_ENV || 'development';
    return {
      ...this,
      ...this[env]
    };
  }
};
