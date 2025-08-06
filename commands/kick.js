const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const LOG_CHANNEL_ID = process.env.SERVER_LOG_CHANNEL;
const DATA_PATH = path.join(__dirname, '../data/moderation.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a user from the server')
    .addUserOption(option =>
      option.setName('user').setDescription('User to kick').setRequired(true))
    .addStringOption(option =>
      option.setName('reason').setDescription('Reason for kick').setRequired(false)),
  async execute(interaction) {
    if (!interaction.member.permissions.has('KickMembers')) {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const member = interaction.guild.members.cache.get(user.id);
    if (!member) {
      return interaction.reply({ content: 'User not found in this server.', ephemeral: true });
    }
    if (!member.kickable) {
      return interaction.reply({ content: 'I cannot kick this user.', ephemeral: true });
    }
    await member.kick(reason);
    await interaction.reply({ content: `Kicked ${user.tag}.`, ephemeral: true });
    if (LOG_CHANNEL_ID) {
      const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
      if (logChannel) {
        logChannel.send({
          embeds: [{
            title: 'User Kicked',
            description: `${user.tag} was kicked by ${interaction.user.tag}`,
            fields: [
              { name: 'Reason', value: reason },
              { name: 'User ID', value: user.id },
              { name: 'Moderator', value: interaction.user.tag },
              { name: 'Time', value: new Date().toISOString() }
            ],
            color: 0xff0000
          }]
        });
      }
    }
    let data = { kicks: [] };
    if (fs.existsSync(DATA_PATH)) {
      data = JSON.parse(fs.readFileSync(DATA_PATH));
    }
    data.kicks.push({
      user_id: user.id,
      moderator_id: interaction.user.id,
      reason,
      timestamp: new Date().toISOString()
    });
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
  }
};
