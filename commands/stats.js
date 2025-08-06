const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '../data/stats.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('View server activity statistics')
    .addStringOption(option =>
      option.setName('timeframe')
        .setDescription('Time period to view stats for')
        .setRequired(false)
        .addChoices(
          { name: 'Today', value: 'today' },
          { name: 'Week', value: 'week' },
          { name: 'Month', value: 'month' },
          { name: 'All Time', value: 'all' }
        )),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      const timeframe = interaction.options.getString('timeframe') || 'week';
      const stats = this.loadStats();
      const filtered = this.filterStatsByTimeframe(stats, timeframe);
      
      // Get member change statistics
      const memberChanges = this.getMemberStats(filtered);
      
      // Get message statistics
      const messageStats = this.getMessageStats(filtered);
      
      // Get command usage statistics
      const commandStats = this.getCommandStats(filtered);

      const embed = new EmbedBuilder()
        .setTitle(`📊 Server Statistics (${this.formatTimeframe(timeframe)})`)
        .setColor(0x3498db)
        .addFields(
          {
            name: '👥 Member Activity',
            value: `
• Joins: ${memberChanges.joins}
• Leaves: ${memberChanges.leaves}
• Net Change: ${memberChanges.joins - memberChanges.leaves}
• Peak Online: ${memberChanges.peakOnline}
            `,
            inline: false
          },
          {
            name: '💬 Message Activity',
            value: `
• Total Messages: ${messageStats.total}
• Most Active Channel: ${messageStats.topChannel || 'None'}
• Most Active User: ${messageStats.topUser || 'None'}
• Average Messages/Day: ${messageStats.average}
            `,
            inline: false
          },
          {
            name: '⚡ Command Usage',
            value: commandStats.length > 0
              ? commandStats.map(cmd => `• ${cmd.name}: ${cmd.uses} uses`).join('\n')
              : 'No commands used in this period',
            inline: false
          }
        )
        .setFooter({ text: 'Statistics are updated in real-time' })
        .setTimestamp();

      // Add growth chart if data exists
      if (messageStats.trend) {
        embed.addFields({
          name: '📈 Activity Trend',
          value: this.generateAsciiChart(messageStats.trend),
          inline: false
        });
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in stats command:', error);
      const reply = {
        content: '❌ Failed to fetch server statistics. Please try again.',
        ephemeral: true
      };

      if (interaction.deferred) {
        await interaction.editReply(reply);
      } else {
        await interaction.reply(reply);
      }
    }
  },

  loadStats() {
    if (!fs.existsSync(DATA_PATH)) {
      return { messages: [], commands: [], members: [] };
    }
    return JSON.parse(fs.readFileSync(DATA_PATH));
  },

  filterStatsByTimeframe(stats, timeframe) {
    const now = Date.now();
    const cutoff = {
      today: now - (24 * 60 * 60 * 1000),
      week: now - (7 * 24 * 60 * 60 * 1000),
      month: now - (30 * 24 * 60 * 60 * 1000),
      all: 0
    }[timeframe];

    return {
      messages: stats.messages.filter(m => m.timestamp > cutoff),
      commands: stats.commands.filter(c => c.timestamp > cutoff),
      members: stats.members.filter(m => m.timestamp > cutoff)
    };
  },

  getMemberStats(stats) {
    return {
      joins: stats.members.filter(m => m.type === 'join').length,
      leaves: stats.members.filter(m => m.type === 'leave').length,
      peakOnline: Math.max(...stats.members.map(m => m.onlineCount || 0))
    };
  },

  getMessageStats(filtered) {
    if (filtered.messages.length === 0) {
      return { total: 0 };
    }

    // Group by channel and user
    const byChannel = {};
    const byUser = {};
    filtered.messages.forEach(msg => {
      byChannel[msg.channelId] = (byChannel[msg.channelId] || 0) + 1;
      byUser[msg.userId] = (byUser[msg.userId] || 0) + 1;
    });

    // Get top channel and user
    const topChannelId = Object.entries(byChannel)
      .sort(([,a], [,b]) => b - a)[0]?.[0];
    const topUserId = Object.entries(byUser)
      .sort(([,a], [,b]) => b - a)[0]?.[0];

    return {
      total: filtered.messages.length,
      topChannel: topChannelId ? `<#${topChannelId}>` : null,
      topUser: topUserId ? `<@${topUserId}>` : null,
      average: Math.round(filtered.messages.length / 7) // per week
    };
  },

  getCommandStats(filtered) {
    const counts = {};
    filtered.commands.forEach(cmd => {
      counts[cmd.name] = (counts[cmd.name] || 0) + 1;
    });

    return Object.entries(counts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([name, uses]) => ({ name, uses }));
  },

  generateAsciiChart(data) {
    const chars = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
    const max = Math.max(...data);
    return data.map(n => chars[Math.floor((n / max) * (chars.length - 1))]).join('');
  },

  formatTimeframe(timeframe) {
    return {
      today: 'Last 24 Hours',
      week: 'Last 7 Days',
      month: 'Last 30 Days',
      all: 'All Time'
    }[timeframe];
  }
};