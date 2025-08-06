const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '../data/moderation.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Lock a channel by removing SEND_MESSAGES from @everyone')
    .addChannelOption(option =>
      option.setName('channel').setDescription('Channel to lock').setRequired(false))
    .addStringOption(option =>
      option.setName('reason').setDescription('Reason for locking').setRequired(false)),
  async execute(interaction) {
    if (!interaction.member.permissions.has('ManageChannels')) {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const everyoneRole = interaction.guild.roles.everyone;
    const originalPerms = channel.permissionOverwrites.cache.get(everyoneRole.id)?.allow?.toArray() || [];
    let data = { locked_channels: {} };
    if (fs.existsSync(DATA_PATH)) {
      data = JSON.parse(fs.readFileSync(DATA_PATH));
    }
    if (!data.locked_channels) data.locked_channels = {};
    data.locked_channels[channel.id] = { originalPerms, reason, timestamp: new Date().toISOString() };
    await channel.permissionOverwrites.edit(everyoneRole, { SendMessages: false });
    await channel.send(`🔒 Channel locked. Reason: ${reason}`);
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
    await interaction.reply({ content: `Locked ${channel.name}.`, ephemeral: true });
  }
};
