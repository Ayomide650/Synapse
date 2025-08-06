const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const LOG_CHANNEL_ID = process.env.SERVER_LOG_CHANNEL;
const DATA_PATH = path.join(__dirname, '../data/moderation.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Issue a warning to a user')
    .addUserOption(option =>
      option.setName('user').setDescription('User to warn').setRequired(true))
    .addStringOption(option =>
      option.setName('reason').setDescription('Reason for warning').setRequired(true)),
  async execute(interaction) {
    if (!interaction.member.permissions.has('ModerateMembers')) {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }

    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');
    const member = interaction.guild.members.cache.get(user.id);

    if (!member) {
      return interaction.reply({ content: 'User not found in this server.', ephemeral: true });
    }

    let data = { warnings: [] };
    if (fs.existsSync(DATA_PATH)) {
      data = JSON.parse(fs.readFileSync(DATA_PATH));
    }
    if (!data.warnings) data.warnings = [];

    const warning = {
      id: Date.now(),
      user_id: user.id,
      moderator_id: interaction.user.id,
      reason,
      timestamp: new Date().toISOString()
    };

    data.warnings.push(warning);
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));

    const userWarnings = data.warnings.filter(w => w.user_id === user.id);
    await interaction.reply({ 
      content: `Warning issued to ${user.tag}. They now have ${userWarnings.length} warning(s).`,
      ephemeral: true 
    });

    if (LOG_CHANNEL_ID) {
      const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
      if (logChannel) {
        logChannel.send({
          embeds: [{
            title: 'User Warned',
            description: `${user.tag} was warned by ${interaction.user.tag}`,
            fields: [
              { name: 'Warning ID', value: warning.id.toString() },
              { name: 'Reason', value: reason },
              { name: 'User ID', value: user.id },
              { name: 'Total Warnings', value: userWarnings.length.toString() },
              { name: 'Moderator', value: interaction.user.tag },
              { name: 'Time', value: new Date().toISOString() }
            ],
            color: 0xffa500
          }]
        });
      }
    }
  }
};