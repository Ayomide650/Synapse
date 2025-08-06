const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '../data/moderation.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Unlock a channel by restoring SEND_MESSAGES to @everyone')
    .addChannelOption(option =>
      option.setName('channel').setDescription('Channel to unlock').setRequired(false)),
  async execute(interaction) {
    if (!interaction.member.permissions.has('ManageChannels')) {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    let data = { locked_channels: {} };
    if (fs.existsSync(DATA_PATH)) {
      data = JSON.parse(fs.readFileSync(DATA_PATH));
    }
    if (!data.locked_channels || !data.locked_channels[channel.id]) {
      return interaction.reply({ content: 'Channel is not locked or no record found.', ephemeral: true });
    }
    await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: null });
    await channel.send('🔓 Channel unlocked.');
    delete data.locked_channels[channel.id];
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
    await interaction.reply({ content: `Unlocked ${channel.name}.`, ephemeral: true });
  }
};
