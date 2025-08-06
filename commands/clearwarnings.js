const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const LOG_CHANNEL_ID = process.env.SERVER_LOG_CHANNEL;
const DATA_PATH = path.join(__dirname, '../data/moderation.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clearwarnings')
    .setDescription('Remove all warnings for a user')
    .addUserOption(option =>
      option.setName('user').setDescription('User to clear warnings for').setRequired(true))
    .addStringOption(option =>
      option.setName('confirm').setDescription('Type CONFIRM to proceed').setRequired(true)),
  async execute(interaction) {
    if (!interaction.member.permissions.has('Administrator')) {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }
    const user = interaction.options.getUser('user');
    const confirm = interaction.options.getString('confirm');
    if (confirm !== 'CONFIRM') {
      return interaction.reply({ content: 'You must type CONFIRM to clear warnings.', ephemeral: true });
    }
    let data = { warnings: [] };
    if (fs.existsSync(DATA_PATH)) {
      data = JSON.parse(fs.readFileSync(DATA_PATH));
    }
    const beforeCount = data.warnings.filter(w => w.user_id === user.id).length;
    data.warnings = data.warnings.filter(w => w.user_id !== user.id);
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
    await interaction.reply({ content: `Cleared ${beforeCount} warning(s) for ${user.tag}.`, ephemeral: true });
    if (LOG_CHANNEL_ID) {
      const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
      if (logChannel) {
        logChannel.send({
          embeds: [{
            title: 'Warnings Cleared',
            description: `${interaction.user.tag} cleared all warnings for ${user.tag}`,
            fields: [
              { name: 'User ID', value: user.id },
              { name: 'Moderator', value: interaction.user.tag },
              { name: 'Time', value: new Date().toISOString() },
              { name: 'Warnings Removed', value: beforeCount.toString() }
            ],
            color: 0x0000ff
          }]
        });
      }
    }
  }
};
