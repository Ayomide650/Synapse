const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const LOG_CHANNEL_ID = process.env.SERVER_LOG_CHANNEL;
const DATA_PATH = path.join(__dirname, '../data/moderation.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Permanently ban a user from the server')
    .addUserOption(option =>
      option.setName('user').setDescription('User to ban').setRequired(true))
    .addStringOption(option =>
      option.setName('reason').setDescription('Reason for ban').setRequired(false))
    .addIntegerOption(option =>
      option.setName('delete_days')
      .setDescription('Number of days of messages to delete')
      .setMinValue(0)
      .setMaxValue(7)
      .setRequired(false)),
  async execute(interaction) {
    if (!interaction.member.permissions.has('BanMembers')) {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const deleteDays = interaction.options.getInteger('delete_days') || 0;
    const member = interaction.guild.members.cache.get(user.id);
    if (!member) {
      return interaction.reply({ content: 'User not found in this server.', ephemeral: true });
    }
    if (!member.bannable) {
      return interaction.reply({ content: 'I cannot ban this user.', ephemeral: true });
    }
    await member.ban({ deleteMessageDays: deleteDays, reason: reason });
    await interaction.reply({ content: `Banned ${user.tag}.`, ephemeral: true });
    if (LOG_CHANNEL_ID) {
      const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
      if (logChannel) {
        logChannel.send({
          embeds: [{
            title: 'User Banned',
            description: `${user.tag} was banned by ${interaction.user.tag}`,
            fields: [
              { name: 'Reason', value: reason },
              { name: 'User ID', value: user.id },
              { name: 'Moderator', value: interaction.user.tag },
              { name: 'Message Deletion', value: `${deleteDays} days` },
              { name: 'Time', value: new Date().toISOString() }
            ],
            color: 0xff0000
          }]
        });
      }
    }
    let data = { bans: [] };
    if (fs.existsSync(DATA_PATH)) {
      data = JSON.parse(fs.readFileSync(DATA_PATH));
    }
    if (!data.bans) data.bans = [];
    data.bans.push({
      user_id: user.id,
      moderator_id: interaction.user.id,
      reason,
      delete_days: deleteDays,
      timestamp: new Date().toISOString()
    });
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
  }
};