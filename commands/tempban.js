const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const ms = require('ms');

const LOG_CHANNEL_ID = process.env.SERVER_LOG_CHANNEL;
const DATA_PATH = path.join(__dirname, '../data/moderation.json');

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
      await member.ban({ reason });
      await interaction.reply({ content: `Temporarily banned ${user.tag} for ${durationString}.`, ephemeral: true });
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
      let data = { temp_bans: [] };
      if (fs.existsSync(DATA_PATH)) {
        data = JSON.parse(fs.readFileSync(DATA_PATH));
      }
      if (!data.temp_bans) data.temp_bans = [];
      data.temp_bans.push({
        user_id: user.id,
        moderator_id: interaction.user.id,
        reason,
        duration: durationString,
        expires_at: new Date(Date.now() + duration).toISOString(),
        timestamp: new Date().toISOString(),
        active: true
      });
      fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
    } catch (error) {
      interaction.reply({ content: 'Failed to tempban user. Error: ' + error.message, ephemeral: true });
    }
  }
};
