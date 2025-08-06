const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '../data/stats.json');
const SAVE_INTERVAL = 5 * 60 * 1000; // Save every 5 minutes

class StatsHandler {
  constructor(client) {
    this.client = client;
    this.stats = this.loadStats();
    this.saveInterval = null;
  }

  start() {
    // Set up event listeners
    this.client.on('messageCreate', msg => this.logMessage(msg));
    this.client.on('guildMemberAdd', member => this.logMember(member, 'join'));
    this.client.on('guildMemberRemove', member => this.logMember(member, 'leave'));
    this.client.on('interactionCreate', interaction => {
      if (interaction.isChatInputCommand()) {
        this.logCommand(interaction);
      }
    });

    // Start periodic saving
    this.saveInterval = setInterval(() => this.saveStats(), SAVE_INTERVAL);
  }

  stop() {
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
      this.saveInterval = null;
    }
    this.saveStats();
  }

  loadStats() {
    if (!fs.existsSync(DATA_PATH)) {
      return {
        messages: [],
        commands: [],
        members: []
      };
    }
    return JSON.parse(fs.readFileSync(DATA_PATH));
  }

  saveStats() {
    try {
      // Ensure directory exists
      const dir = path.dirname(DATA_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Cleanup old entries (older than 30 days)
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      this.stats.messages = this.stats.messages.filter(m => m.timestamp > thirtyDaysAgo);
      this.stats.commands = this.stats.commands.filter(c => c.timestamp > thirtyDaysAgo);
      this.stats.members = this.stats.members.filter(m => m.timestamp > thirtyDaysAgo);

      // Save to file
      fs.writeFileSync(DATA_PATH, JSON.stringify(this.stats, null, 2));
    } catch (error) {
      console.error('Error saving stats:', error);
    }
  }

  logMessage(message) {
    if (message.author.bot) return;

    this.stats.messages.push({
      timestamp: Date.now(),
      channelId: message.channel.id,
      userId: message.author.id,
      guildId: message.guild?.id
    });
  }

  logCommand(interaction) {
    this.stats.commands.push({
      timestamp: Date.now(),
      name: interaction.commandName,
      userId: interaction.user.id,
      guildId: interaction.guild?.id,
      channelId: interaction.channel?.id
    });
  }

  logMember(member, type) {
    this.stats.members.push({
      timestamp: Date.now(),
      type: type,
      userId: member.id,
      guildId: member.guild.id,
      onlineCount: member.guild.members.cache
        .filter(m => m.presence?.status !== 'offline').size
    });
  }
}

module.exports = StatsHandler;