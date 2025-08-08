const { SlashCommandBuilder } = require('discord.js');
const ms = require('ms');
const db = require('../utils/database');

const LOG_CHANNEL_ID = process.env.SERVER_LOG_CHANNEL;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tempban')
    .setDescription('Temporarily ban a user from the server')
    .addUserOption(option =>
      option.setName('user').setDescription('User to tempban').setRequired(true))
    .addStringOption(option =>
      option.setName('duration').setDescription('Ban duration (1h, 1d, 1w)').setRequired(true))
    .addStringOption(option =>
      option.setName('reason').setDescription('Reason for tempban').setRequired(false)),

  async execute(interaction) {
    if (!interaction.member.permissions.has('BanMembers')) {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }

    const user = interaction.options.getUser('user');
    const durationString = interaction.options.getString('duration');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const member = interaction.guild.members.cache.get(user.id);

    if (!member) {
      return interaction.reply({ content: 'User not found in this server.', ephemeral: true });
    }

    if (!member.bannable) {
      return interaction.reply({ content: 'I cannot ban this user.', ephemeral: true });
    }

    const duration = ms(durationString);
    if (!duration || duration < 1000) {
      return interaction.reply({ content: 'Invalid duration. Use formats like 1h, 1d, 1w.', ephemeral: true });
    }

    try {
      // Initialize database instance
      const db = new Database();
      await db.initialize();

      // Ban the user
      await member.ban({ reason });
      await interaction.reply({ content: `Temporarily banned ${user.tag} for ${durationString}.`, ephemeral: true });

      // Log to channel if configured
      if (LOG_CHANNEL_ID) {
        const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
        if (logChannel) {
          logChannel.send({
            embeds: [{
              title: 'User Temporarily Banned',
              description: `${user.tag} was tempbanned by ${interaction.user.tag}`,
              fields: [
                { name: 'Duration', value: durationString },
                { name: 'Reason', value: reason },
                { name: 'User ID', value: user.id },
                { name: 'Moderator', value: interaction.user.tag },
                { name: 'Expires At', value: new Date(Date.now() + duration).toISOString() },
                { name: 'Time', value: new Date().toISOString() }
              ],
              color: 0xff3300
            }]
          });
        }
      }

      // Get current temp punishments data using the new database system
      // Based on your commandFiles mapping, tempban uses 'moderation/temp_punishments.json'
      const tempPunishmentsKey = 'temp_punishments';
      let data = await db.get(tempPunishmentsKey) || { temp_bans: [], temp_mutes: [], temp_timeouts: [] };

      // Ensure temp_bans array exists
      if (!data.temp_bans) {
        data.temp_bans = [];
      }

      // Add new temp ban record
      const tempBanRecord = {
        user_id: user.id,
        guild_id: interaction.guild.id, // Added guild_id for better tracking
        moderator_id: interaction.user.id,
        reason,
        duration: durationString,
        expires_at: new Date(Date.now() + duration).toISOString(),
        timestamp: new Date().toISOString(),
        active: true
      };

      data.temp_bans.push(tempBanRecord);

      // Save data using the new database system
      await db.set(tempPunishmentsKey, data);
      
      console.log(`✅ Temporary ban recorded for ${user.tag} (${user.id}) - expires ${tempBanRecord.expires_at}`);

    } catch (error) {
      console.error('❌ Error in tempban command:', error);
      
      // Try to reply if interaction hasn't been replied to yet
      const errorMessage = 'Failed to tempban user. Error: ' + error.message;
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: errorMessage, ephemeral: true });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
  }
};
