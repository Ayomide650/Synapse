const { SlashCommandBuilder, EmbedBuilder, version: discordVersion } = require('discord.js');
const { version } = require('../package.json');
const fs = require('fs');
const path = require('path');
const config = require('../config/config'); // Import config for correct paths

module.exports = {
  data: new SlashCommandBuilder()
    .setName('botinfo')
    .setDescription('Display comprehensive bot statistics and information'),

  async execute(interaction) {
    try {
      const client = interaction.client;
      
      // Get guild and member counts
      const totalGuilds = client.guilds.cache.size;
      const totalMembers = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
      
      // Count total commands
      const commandsPath = path.join(__dirname);
      const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
      const totalCommands = commandFiles.length;

      // Get JSON storage stats using correct config paths
      const storageStats = await this.getStorageStats();

      // Create embed
      const embed = new EmbedBuilder()
        .setTitle('🤖 Bot Information')
        .setColor(0x3498db)
        .addFields(
          {
            name: '📊 Statistics',
            value: `
• Servers: ${totalGuilds}
• Total Members: ${totalMembers}
• Commands: ${totalCommands}
• Node.js: ${process.version}
• Discord.js: v${discordVersion}
            `,
            inline: false
          },
          {
            name: '💾 Storage',
            value: `
• JSON Files: ${storageStats.files}
• Total Size: ${storageStats.sizeFormatted}
• Backup Files: ${storageStats.backupFiles}
• Last Backup: ${storageStats.lastBackup}
            `,
            inline: false
          },
          {
            name: '📋 Version',
            value: `
• Bot Version: v${version}
• Last Updated: ${this.getLastUpdateTime()}
• Uptime: ${this.formatUptime(client.uptime)}
            `,
            inline: false
          }
        )
        .setFooter({ text: 'Need help? Use /help command' })
        .setTimestamp();

      // Add memory usage
      const memUsage = process.memoryUsage();
      embed.addFields({
        name: '⚡ Performance',
        value: `
• Memory: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB
• CPU: ${process.cpuUsage().user / 1000}ms
• Ping: ${client.ws.ping}ms
        `,
        inline: true
      });

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in botinfo command:', error);
      await interaction.reply({
        content: '❌ Failed to fetch bot information. Please try again.',
        ephemeral: true
      });
    }
  },

  async getStorageStats() {
    try {
      // Use config paths instead of hardcoded relative paths
      const dataPath = path.resolve(process.cwd(), config.dataPath);
      const backupPath = path.resolve(process.cwd(), config.backupPath);
      
      let stats = {
        files: 0,
        size: 0,
        backupFiles: 0,
        backupSize: 0,
        sizeFormatted: '0 KB',
        lastBackup: 'None'
      };

      // Check main data directory
      if (fs.existsSync(dataPath)) {
        const files = fs.readdirSync(dataPath).filter(file => file.endsWith('.json'));
        stats.files = files.length;
        
        for (const file of files) {
          try {
            const filePath = path.join(dataPath, file);
            const fileStats = fs.statSync(filePath);
            stats.size += fileStats.size;
          } catch (err) {
            console.log(`Could not read stats for ${file}:`, err.message);
          }
        }
      }

      // Check backup directory
      if (fs.existsSync(backupPath)) {
        const backupFiles = fs.readdirSync(backupPath).filter(file => file.endsWith('.bak'));
        stats.backupFiles = backupFiles.length;
        
        // Get most recent backup time
        if (backupFiles.length > 0) {
          const backupTimes = backupFiles.map(file => {
            try {
              return fs.statSync(path.join(backupPath, file)).mtime;
            } catch {
              return new Date(0);
            }
          }).sort((a, b) => b - a);
          
          stats.lastBackup = backupTimes[0].toLocaleString();
        }
      }

      // Format size nicely
      if (stats.size > 1024 * 1024) {
        stats.sizeFormatted = `${(stats.size / 1024 / 1024).toFixed(2)} MB`;
      } else if (stats.size > 1024) {
        stats.sizeFormatted = `${(stats.size / 1024).toFixed(2)} KB`;
      } else {
        stats.sizeFormatted = `${stats.size} bytes`;
      }

      return stats;

    } catch (error) {
      console.error('Error getting storage stats:', error);
      return {
        files: 0,
        size: 0,
        backupFiles: 0,
        sizeFormatted: 'Error reading',
        lastBackup: 'Error'
      };
    }
  },

  getLastUpdateTime() {
    try {
      const stats = fs.statSync(__filename);
      return stats.mtime.toLocaleString();
    } catch {
      return 'Unknown';
    }
  },

  formatUptime(uptime) {
    if (!uptime) return 'Unknown';
    
    const seconds = Math.floor(uptime / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }
};
