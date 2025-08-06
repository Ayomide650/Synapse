const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const LOG_CHANNEL_ID = process.env.SERVER_LOG_CHANNEL;
const DATA_PATH = path.join(__dirname, '../data/moderation.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('softban')
    .setDescription('Ban and immediately unban a user (deletes messages)')
    .addUserOption(option =>
      option.setName('user').setDescription('User to softban').setRequired(true))
    .addStringOption(option =>
      option.setName('reason').setDescription('Reason for softban').setRequired(false)),
  async execute(interaction) {
    if (!interaction.member.permissions.has('BanMembers')) {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const member = interaction.guild.members.cache.get(user.id);
    if (!member) {
      return interaction.reply({ content: 'User not found in this server.', ephemeral: true });
    }
    if (!member.bannable) {
      return interaction.reply({ content: 'I cannot ban this user.', ephemeral: true });
    }
    try {
      await member.ban({ deleteMessageDays: 7, reason });
      if (LOG_CHANNEL_ID) {
        const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
        if (logChannel) {
          logChannel.send({
            embeds: [{
              title: 'User Softbanned',
              description: `${user.tag} was softbanned by ${interaction.user.tag}`,
              fields: [
                { name: 'Reason', value: reason },
                { name: 'User ID', value: user.id },
                { name: 'Moderator', value: interaction.user.tag },
                { name: 'Time', value: new Date().toISOString() }
              ],
              color: 0xff6600
            }]
          });
        }
      }
      await interaction.guild.members.unban(user.id, 'Softban unban');
      if (LOG_CHANNEL_ID) {
        const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
        if (logChannel) {
          logChannel.send({
            embeds: [{
              title: 'User Unbanned (Softban)',
              description: `${user.tag} was unbanned after softban by ${interaction.user.tag}`,
              fields: [
                { name: 'User ID', value: user.id },
                { name: 'Moderator', value: interaction.user.tag },
                { name: 'Time', value: new Date().toISOString() }
              ],
              color: 0x00ccff
            }]
          });
        }
      }
      let data = { softbans: [] };
      if (fs.existsSync(DATA_PATH)) {
        data = JSON.parse(fs.readFileSync(DATA_PATH));
      }
      if (!data.softbans) data.softbans = [];
      data.softbans.push({
        user_id: user.id,
        moderator_id: interaction.user.id,
        reason,
        timestamp: new Date().toISOString()
      });
      fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
      await interaction.reply({ content: `Softbanned ${user.tag}.`, ephemeral: true });
    } catch (error) {
      interaction.reply({ content: 'Failed to softban user. Error: ' + error.message, ephemeral: true });
    }
  }
};
