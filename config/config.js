require('dotenv').config();

module.exports = {
  // Bot Configuration
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID,

  // API Configuration
  port: process.env.PORT || 3000,

  // Database Configuration
  dataPath: './data',
  backupPath: './data/backups',
  
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