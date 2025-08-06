const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '../data/reminders.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remindme')
    .setDescription('Set a personal reminder')
    .addStringOption(option =>
      option.setName('duration')
        .setDescription('When to remind you (e.g., 1h30m, 2d, 3h, 30m)')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('message')
        .setDescription('What to remind you about')
        .setRequired(true)),

  async execute(interaction) {
    try {
      const durationStr = interaction.options.getString('duration');
      const message = interaction.options.getString('message');

      // Parse duration string
      const duration = this.parseDuration(durationStr);
      if (!duration) {
        return await interaction.reply({
          content: '❌ Invalid duration format. Use combinations of: d (days), h (hours), m (minutes)\nExample: 1d12h30m',
          ephemeral: true
        });
      }

      const remindTime = new Date(Date.now() + duration);
      
      // Load existing reminders
      let reminders = { reminders: [] };
      if (fs.existsSync(DATA_PATH)) {
        reminders = JSON.parse(fs.readFileSync(DATA_PATH));
      }

      // Add new reminder
      const reminder = {
        id: Date.now().toString(),
        user_id: interaction.user.id,
        guild_id: interaction.guild.id,
        channel_id: interaction.channel.id,
        message: message,
        remind_at: remindTime.toISOString(),
        created_at: new Date().toISOString(),
        active: true
      };

      reminders.reminders.push(reminder);

      // Save to file
      fs.writeFileSync(DATA_PATH, JSON.stringify(reminders, null, 2));

      // Format confirmation message
      const timeUntil = this.formatDuration(duration);
      await interaction.reply({
        content: `✅ I'll remind you about "${message}" in ${timeUntil} (<t:${Math.floor(remindTime.getTime() / 1000)}:R>)`,
        ephemeral: true
      });

    } catch (error) {
      console.error('Error in remindme command:', error);
      await interaction.reply({
        content: '❌ Failed to set reminder. Please try again.',
        ephemeral: true
      });
    }
  },

  // Parse duration string into milliseconds
  parseDuration(durationStr) {
    const matches = durationStr.toLowerCase().match(/(\d+[dhm])/g);
    if (!matches) return null;

    let total = 0;
    for (const match of matches) {
      const num = parseInt(match.slice(0, -1));
      const unit = match.slice(-1);
      
      switch (unit) {
        case 'd': total += num * 24 * 60 * 60 * 1000; break;
        case 'h': total += num * 60 * 60 * 1000; break;
        case 'm': total += num * 60 * 1000; break;
      }
    }

    // Validate total duration (max 30 days)
    const maxDuration = 30 * 24 * 60 * 60 * 1000;
    return total > 0 && total <= maxDuration ? total : null;
  },

  // Format duration for display
  formatDuration(ms) {
    const days = Math.floor(ms / (24 * 60 * 60 * 1000));
    ms %= 24 * 60 * 60 * 1000;
    const hours = Math.floor(ms / (60 * 60 * 1000));
    ms %= 60 * 60 * 1000;
    const minutes = Math.floor(ms / (60 * 1000));

    const parts = [];
    if (days) parts.push(`${days}d`);
    if (hours) parts.push(`${hours}h`);
    if (minutes) parts.push(`${minutes}m`);
    
    return parts.join(' ');
  }
};