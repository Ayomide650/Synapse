const { SlashCommandBuilder } = require('discord.js');
const ms = require('ms');
const Database = require('../database/database'); // Adjust path as needed

const LOG_CHANNEL_ID = process.env.SERVER_LOG_CHANNEL;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Timeout a user for a specified duration')
    .addUserOption(option =>
      option.setName('user').setDescription('User to timeout').setRequired(true))
    .addStringOption(option =>
      option.setName('duration').setDescription('Timeout duration (1m, 1h, 1d)').setRequired(true))
    .addStringOption(option =>
      option.setName('reason').setDescription('Reason for timeout').setRequired(false)),

  async execute(interaction) {
    if (!interaction.member.permissions.has('ModerateMembers')) {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }

    const user = interaction.options.getUser('user');
    const durationString = interaction.options.getString('duration');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const member = interaction.guild.members.cache.get(user.id);

    if (!member) {
      return interaction.reply({ content: 'User not found in this server.', ephemeral: true });
    }

    if (!member.moderatable) {
      return interaction.reply({ content: 'I cannot timeout this user.', ephemeral: true });
    }

    const duration = ms(durationString);
    if (!duration || duration < 1000 || duration > ms('28d')) {
      return interaction.reply({ content: 'Invalid duration. Use 1m, 1h, 1d (max 28 days).', ephemeral: true });
    }

    try {
      // Initialize database instance
      const db = new Database();
      await db.initialize();

      // Apply the timeout
      await member.timeout(duration, reason);
      await interaction.reply({ content: `Timed out ${user.tag} for ${durationString}.`, ephemeral: true });

      // Log to channel if configured
      if (LOG_CHANNEL_ID) {
        const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
        if (logChannel) {
          logChannel.send({
            embeds: [{
              title: 'User Timed Out',
              description: `${user.tag} was timed out by ${interaction.user.tag}`,
              fields: [
                { name: 'Duration', value: durationString },
                { name: 'Reason', value: reason },
                { name: 'User ID', value: user.id },
                { name: 'Moderator', value: interaction.user.tag },
                { name: 'Expires At', value: new Date(Date.now() + duration).toISOString() },
                { name: 'Time', value: new Date().toISOString() }
              ],
              color: 0xcccc00
            }]
          });
        }
      }

      // Get current temp punishments data using the new database system
      // Based on your commandFiles mapping, timeout uses 'moderation/temp_punishments.json'
      const tempPunishmentsKey = 'temp_punishments';
      let data = await db.get(tempPunishmentsKey) || { 
        temp_bans: [], 
        temp_mutes: [], 
        temp_timeouts: [],
        mutes: [], // For compatibility
        timeouts: [] // Keep for backward compatibility
      };

      // Ensure timeouts arrays exist (maintaining compatibility with existing structure)
      if (!data.timeouts) {
        data.timeouts = [];
      }
      if (!data.temp_timeouts) {
        data.temp_timeouts = [];
      }

      // Create timeout record
      const timeoutRecord = {
        user_id: user.id,
        guild_id: interaction.guild.id, // Added guild_id for better tracking
        moderator_id: interaction.user.id,
        reason,
        duration: durationString,
        expires_at: new Date(Date.now() + duration).toISOString(),
        timestamp: new Date().toISOString(),
        active: true
      };

      // Add to both arrays for compatibility and future structure
      data.timeouts.push(timeoutRecord);
      data.temp_timeouts.push(timeoutRecord);

      // Save data using the new database system
      await db.set(tempPunishmentsKey, data);
      
      console.log(`✅ Timeout recorded for ${user.tag} (${user.id}) - expires ${timeoutRecord.expires_at}`);

    } catch (error) {
      console.error('❌ Error in timeout command:', error);
      
      // Try to reply if interaction hasn't been replied to yet
      const errorMessage = 'Failed to timeout user. Error: ' + error.message;
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: errorMessage, ephemeral: true });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
  }
};
