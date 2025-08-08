// remindme.js - Updated Command
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
      
      // Initialize database
      const db = new Database();
      await db.initialize();

      // Load existing reminders
      const remindersData = await db.get('remindme') || { reminders: [] };
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
      await db.set('remindme', remindersData);

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

// ================================================================================================
// reminderHandler.js - Updated Handler
const Database = require('../database/database'); // Adjust path as needed
const { EmbedBuilder } = require('discord.js');

const CHECK_INTERVAL = 60000; // Check every minute

class ReminderHandler {
  constructor(client) {
    this.client = client;
    this.checkInterval = null;
    this.db = new Database();
  }

  async start() {
    try {
      await this.db.initialize();
      this.checkInterval = setInterval(() => this.checkReminders(), CHECK_INTERVAL);
      console.log('✅ Reminder handler started successfully');
    } catch (error) {
      console.error('❌ Failed to start reminder handler:', error);
    }
  }

  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('🛑 Reminder handler stopped');
    }
  }

  async checkReminders() {
    try {
      const remindersData = await this.db.get('remindme') || { reminders: [] };
      if (!remindersData.reminders || remindersData.reminders.length === 0) return;

      const now = new Date();
      let updated = false;
      let processedCount = 0;

      for (const reminder of remindersData.reminders) {
        if (!reminder.active) continue;

        const remindTime = new Date(reminder.remind_at);
        if (remindTime <= now) {
          await this.sendReminder(reminder);
          reminder.active = false;
          reminder.completed_at = now.toISOString();
          updated = true;
          processedCount++;
        }
      }

      if (updated) {
        // Clean up old completed reminders (older than 7 days)
        const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
        const initialCount = remindersData.reminders.length;
        
        remindersData.reminders = remindersData.reminders.filter(r => 
          r.active || new Date(r.remind_at) > weekAgo
        );

        const cleanedCount = initialCount - remindersData.reminders.length;
        
        await this.db.set('remindme', remindersData);
        
        if (processedCount > 0) {
          console.log(`📬 Processed ${processedCount} reminder(s), cleaned ${cleanedCount} old reminder(s)`);
        }
      }

    } catch (error) {
      console.error('❌ Error checking reminders:', error);
    }
  }

  async sendReminder(reminder) {
    try {
      const user = await this.client.users.fetch(reminder.user_id);
      if (!user) {
        console.log(`⚠️ Could not fetch user ${reminder.user_id} for reminder ${reminder.id}`);
        return;
      }

      // Create reminder embed
      const reminderEmbed = new EmbedBuilder()
        .setTitle('⏰ Reminder!')
        .setDescription(`**${reminder.message}**`)
        .addFields([
          { name: '📍 Server', value: reminder.guild_name || 'Unknown Server', inline: true },
          { name: '📢 Channel', value: reminder.channel_name ? `#${reminder.channel_name}` : 'Unknown Channel', inline: true },
          { name: '🆔 Reminder ID', value: `\`${reminder.id}\``, inline: true },
          { name: '📅 Set On', value: `<t:${Math.floor(new Date(reminder.created_at).getTime() / 1000)}:F>`, inline: true },
          { name: '⏱️ Duration', value: reminder.duration_str || 'Unknown', inline: true },
          { name: '🔗 Jump to Channel', value: `<#${reminder.channel_id}>`, inline: true }
        ])
        .setColor(0x00ff00)
        .setThumbnail(user.displayAvatarURL())
        .setTimestamp()
        .setFooter({ text: 'Reminder completed' });

      // Try to send DM
      try {
        await user.send({ embeds: [reminderEmbed] });
        console.log(`📬 Sent reminder to ${user.tag} (${reminder.id})`);
      } catch (dmError) {
        console.log(`⚠️ Could not DM ${user.tag}, trying channel fallback`);
        
        // Fallback: try to send in the original channel
        try {
          const guild = await this.client.guilds.fetch(reminder.guild_id);
          const channel = await guild.channels.fetch(reminder.channel_id);
          
          if (channel && channel.isTextBased()) {
            const fallbackEmbed = new EmbedBuilder()
              .setTitle('⏰ Reminder (DM Failed)')
              .setDescription(`<@${reminder.user_id}>, here's your reminder:\n\n**${reminder.message}**`)
              .addFields([
                { name: '📅 Set On', value: `<t:${Math.floor(new Date(reminder.created_at).getTime() / 1000)}:R>`, inline: true },
                { name: '🆔 Reminder ID', value: `\`${reminder.id}\``, inline: true }
              ])
              .setColor(0xffa500)
              .setFooter({ text: 'Could not send DM - sent here instead' });

            await channel.send({ embeds: [fallbackEmbed] });
            console.log(`📬 Sent reminder fallback to channel for ${user.tag}`);
          }
        } catch (channelError) {
          console.error(`❌ Failed to send reminder fallback for ${user.tag}:`, channelError);
        }
      }

    } catch (error) {
      console.error(`❌ Error sending reminder ${reminder.id}:`, error);
    }
  }

  // Get statistics about reminders
  async getStats() {
    try {
      const remindersData = await this.db.get('remindme') || { reminders: [] };
      const reminders = remindersData.reminders || [];
      
      const active = reminders.filter(r => r.active).length;
      const completed = reminders.filter(r => !r.active).length;
      const total = reminders.length;
      
      return { active, completed, total };
    } catch (error) {
      console.error('Error getting reminder stats:', error);
      return { active: 0, completed: 0, total: 0 };
    }
  }
}

module.exports = ReminderHandler;
