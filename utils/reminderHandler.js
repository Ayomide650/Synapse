// reminderHandler.js - Reminder Handler
const db = require('./database');
const { EmbedBuilder } = require('discord.js');

const CHECK_INTERVAL = 60000; // Check every minute

class ReminderHandler {
  constructor(client) {
    this.client = client;
    this.checkInterval = null;
  }

  async start() {
    try {
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
      const remindersData = await db.read('remindme') || { reminders: [] };
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
        
        await db.write('remindme', remindersData);
        
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
      const remindersData = await db.read('remindme') || { reminders: [] };
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
