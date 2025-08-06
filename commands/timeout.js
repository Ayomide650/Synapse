const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const ms = require('ms');

const LOG_CHANNEL_ID = process.env.SERVER_LOG_CHANNEL;
const DATA_PATH = path.join(__dirname, '../data/moderation.json');

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
      await member.timeout(duration, reason);
      await interaction.reply({ content: `Timed out ${user.tag} for ${durationString}.`, ephemeral: true });
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
                { name: 'Time', value: new Date().toISOString() }
              ],
              color: 0xcccc00
            }]
          });
        }
      }
      let data = { timeouts: [] };
      if (fs.existsSync(DATA_PATH)) {
        data = JSON.parse(fs.readFileSync(DATA_PATH));
      }
      if (!data.timeouts) data.timeouts = [];
      data.timeouts.push({
        user_id: user.id,
        moderator_id: interaction.user.id,
        reason,
        duration: durationString,
        expires_at: new Date(Date.now() + duration).toISOString(),
        timestamp: new Date().toISOString()
      });
      fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
    } catch (error) {
      interaction.reply({ content: 'Failed to timeout user. Error: ' + error.message, ephemeral: true });
    }
  }
};
