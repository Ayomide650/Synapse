const { SlashCommandBuilder, EmbedBuilder, version: discordVersion } = require('discord.js');
const { version } = require('../package.json');
const fs = require('fs');
const path = require('path');

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

      // Get JSON storage stats
      const dataPath = path.join(__dirname, '../data');
      let storageStats = { files: 0, size: 0 };
      if (fs.existsSync(dataPath)) {
        const files = fs.readdirSync(dataPath).filter(file => file.endsWith('.json'));
        storageStats.files = files.length;
        for (const file of files) {
          const stats = fs.statSync(path.join(dataPath, file));
          storageStats.size += stats.size;
        }
      }

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
• Total Size: ${(storageStats.size / 1024 / 1024).toFixed(2)} MB
• Last Backup: ${this.getLastBackupTime(dataPath)}
            `,
            inline: false
          },
          {
            name: '📋 Version',
            value: `
• Bot Version: v${version}
• Last Updated: ${this.getLastUpdateTime()}
• Created By: Your Name
            `,
            inline: false
          }
        )
        .setFooter({ text: 'Need help? Use /help command' })
        .setTimestamp();

      // Add changelog if available
      const changelog = this.getLatestChangelog();
      if (changelog) {
        embed.addFields({
          name: '📝 Latest Changes',
          value: changelog,
          inline: false
        });
      }

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in botinfo command:', error);
      await interaction.reply({
        content: '❌ Failed to fetch bot information. Please try again.',
        ephemeral: true
      });
    }
  },

  getLastBackupTime(dataPath) {
    try {
      const backupPath = path.join(dataPath, 'backups');
      if (!fs.existsSync(backupPath)) return 'No backups found';

      const files = fs.readdirSync(backupPath)
        .filter(file => file.endsWith('.json'))
        .map(file => fs.statSync(path.join(backupPath, file)).mtime)
        .sort((a, b) => b - a);

      return files.length ? files[0].toLocaleString() : 'No backups found';
    } catch {
      return 'Unknown';
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

  getLatestChangelog() {
    try {
      const changelogPath = path.join(__dirname, '../CHANGELOG.md');
      if (!fs.existsSync(changelogPath)) return null;

      const changelog = fs.readFileSync(changelogPath, 'utf8')
        .split('\n')
        .slice(0, 5)
        .join('\n');

      return changelog || 'No recent changes';
    } catch {
      return null;
    }
  }
};