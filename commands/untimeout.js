const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const LOG_CHANNEL_ID = process.env.SERVER_LOG_CHANNEL;
const DATA_PATH = path.join(__dirname, '../data/moderation.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('untimeout')
    .setDescription('Remove timeout from a user')
    .addUserOption(option =>
      option.setName('user').setDescription('User to remove timeout from').setRequired(true)),
  async execute(interaction) {
    if (!interaction.member.permissions.has('ModerateMembers')) {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }
    const user = interaction.options.getUser('user');
    const member = interaction.guild.members.cache.get(user.id);
    if (!member) {
      return interaction.reply({ content: 'User not found in this server.', ephemeral: true });
    }
    if (!member.moderatable) {
      return interaction.reply({ content: 'I cannot remove timeout from this user.', ephemeral: true });
    }
    try {
      await member.timeout(null);
      await interaction.reply({ content: `Timeout removed for ${user.tag}.`, ephemeral: true });
      if (LOG_CHANNEL_ID) {
        const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
        if (logChannel) {
          logChannel.send({
            embeds: [{
              title: 'Timeout Removed',
              description: `${user.tag} had their timeout removed by ${interaction.user.tag}`,
              fields: [
                { name: 'User ID', value: user.id },
                { name: 'Moderator', value: interaction.user.tag },
                { name: 'Time', value: new Date().toISOString() }
              ],
              color: 0x00ffcc
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
        action: 'removed',
        timestamp: new Date().toISOString()
      });
      fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
    } catch (error) {
      interaction.reply({ content: 'Failed to remove timeout. Error: ' + error.message, ephemeral: true });
    }
  }
};
