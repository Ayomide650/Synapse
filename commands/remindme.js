// remindme.js - Command Only
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../utils/database');

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
      
      // Validate message length
      if (message.length > 500) {
        const errorEmbed = new EmbedBuilder()
          .setTitle('❌ Message Too Long')
          .setDescription('Reminder message must be 500 characters or less.')
          .addFields([
            { name: 'Current Length', value: message.length.toString(), inline: true },
            { name: 'Max Length', value: '500', inline: true }
          ])
          .setColor(0xff0000);

        return await interaction.reply({
          embeds: [errorEmbed],
          ephemeral: true
        });
      }

      // Parse duration string
      const duration = this.parseDuration(durationStr);
      if (!duration) {
        const helpEmbed = new EmbedBuilder()
          .setTitle('❌ Invalid Duration Format')
          .setDescription('Use combinations of: **d** (days), **h** (hours), **m** (minutes)')
          .addFields([
            { name: 'Examples', value: '• `1h30m` - 1 hour 30 minutes\n• `2d` - 2 days\n• `45m` - 45 minutes\n• `1d12h30m` - 1 day 12 hours 30 minutes' },
            { name: 'Limits', value: '• Minimum: 1 minute\n• Maximum: 30 days' }
          ])
          .setColor(0xffa500);

        return await interaction.reply({
          embeds: [helpEmbed],
          ephemeral: true
        });
      }

      const remindTime = new Date(Date.now() + duration);

      // Load existing reminders
      const remindersData = await db.read('remindme') || { reminders: [] };
      if (!remindersData.reminders) remindersData.reminders = [];

      // Check user's active reminders limit
      const userActiveReminders = remindersData.reminders.filter(r => 
        r.user_id === interaction.user.id && r.active
      );

      if (userActiveReminders.length >= 10) {
        const limitEmbed = new EmbedBuilder()
          .setTitle('🚫 Reminder Limit Reached')
          .setDescription('You can only have up to **10** active reminders at a time.')
          .addFields([
            { name: 'Current Active', value: userActiveReminders.length.toString(), inline: true },
            { name: 'Maximum Allowed', value: '10', inline: true }
          ])
          .setColor(0xff0000);

        return await interaction.reply({
          embeds: [limitEmbed],
          ephemeral: true
        });
      }

      // Create new reminder
      const reminder = {
        id: `${Date.now()}_${interaction.user.id}`,
        user_id: interaction.user.id,
        username: interaction.user.username,
        user_tag: interaction.user.tag,
        guild_id: interaction.guild.id,
        guild_name: interaction.guild.name,
        channel_id: interaction.channel.id,
        channel_name: interaction.channel.name,
        message: message.trim(),
        duration_ms: duration,
        duration_str: durationStr,
        remind_at: remindTime.toISOString(),
        created_at: new Date().toISOString(),
        active: true
      };

      remindersData.reminders.push(reminder);

      // Save to database
      await db.write('remindme', remindersData);

      // Create success response
      const timeUntil = this.formatDuration(duration);
      const successEmbed = new EmbedBuilder()
        .setTitle('⏰ Reminder Set!')
        .setDescription(`I'll remind you about: **${message}**`)
        .addFields([
          { name: 'Remind In', value: timeUntil, inline: true },
          { name: 'Remind At', value: `<t:${Math.floor(remindTime.getTime() / 1000)}:F>`, inline: true },
          { name: 'Relative Time', value: `<t:${Math.floor(remindTime.getTime() / 1000)}:R>`, inline: true },
          { name: 'Reminder ID', value: `\`${reminder.id}\``, inline: false }
        ])
        .setColor(0x00ff00)
        .setThumbnail(interaction.user.displayAvatarURL())
        .setTimestamp()
        .setFooter({ text: `Active reminders: ${userActiveReminders.length + 1}/10` });

      await interaction.reply({
        embeds: [successEmbed],
        ephemeral: true
      });

    } catch (error) {
      console.error('Error in remindme command:', error);
      
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Error')
        .setDescription('Failed to set reminder. Please try again later.')
        .setColor(0xff0000);

      await interaction.reply({
        embeds: [errorEmbed],
        ephemeral: true
      });
    }
  },

  // Parse duration string into milliseconds
  parseDuration(durationStr) {
    const matches = durationStr.toLowerCase().match(/(\d+[dhm])/g);
    if (!matches) return null;
    
    let total = 0;
    const usedUnits = new Set();
    
    for (const match of matches) {
      const num = parseInt(match.slice(0, -1));
      const unit = match.slice(-1);
      
      // Prevent duplicate units
      if (usedUnits.has(unit)) return null;
      usedUnits.add(unit);
      
      // Validate individual values
      if (num <= 0) return null;
      if (unit === 'd' && num > 30) return null; // Max 30 days
      if (unit === 'h' && num > 23) return null; // Max 23 hours per unit
      if (unit === 'm' && num > 59) return null; // Max 59 minutes per unit
      
      switch (unit) {
        case 'd': total += num * 24 * 60 * 60 * 1000; break;
        case 'h': total += num * 60 * 60 * 1000; break;
        case 'm': total += num * 60 * 1000; break;
        default: return null;
      }
    }
    
    // Validate total duration
    const minDuration = 60 * 1000; // 1 minute
    const maxDuration = 30 * 24 * 60 * 60 * 1000; // 30 days
    return total >= minDuration && total <= maxDuration ? total : null;
  },

  // Format duration for display
  formatDuration(ms) {
    const days = Math.floor(ms / (24 * 60 * 60 * 1000));
    ms %= 24 * 60 * 60 * 1000;
    const hours = Math.floor(ms / (60 * 60 * 1000));
    ms %= 60 * 60 * 1000;
    const minutes = Math.floor(ms / (60 * 1000));
    
    const parts = [];
    if (days) parts.push(`${days} day${days > 1 ? 's' : ''}`);
    if (hours) parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
    if (minutes) parts.push(`${minutes} minute${minutes > 1 ? 's' : ''}`);
    
    return parts.length > 0 ? parts.join(', ') : '0 minutes';
  }
};
