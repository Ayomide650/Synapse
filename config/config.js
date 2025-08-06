// Only load dotenv in local development
if (!process.env.GITHUB_ACTIONS) {
  try {
    require('dotenv').config();
  } catch (error) {
    console.log('dotenv not available, using environment variables directly');
  }
}

module.exports = {
  // Bot Configuration
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID,
  
  // API Configuration
  port: process.env.PORT || 3000,
  
  // Database Configuration - Updated to use environment variables
  dataPath: process.env.DATA_PATH || './data',
  backupPath: process.env.BACKUP_PATH || './data/backups',
  
  // Add database object for services that expect this structure
  database: {
    dataDir: process.env.DATA_PATH || './data',
    backupDir: process.env.BACKUP_PATH || './data/backups'
  },
  
  // Channel Configuration - Add missing channel settings
  channels: {
    serverLog: process.env.SERVER_LOG_CHANNEL,
    giveaway: process.env.GIVEAWAY_CHANNEL_ID
  },
  
  // Economy Configuration - Add missing economy settings
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
  }
};
