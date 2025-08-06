const { SlashCommandBuilder, ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '../data/moderation.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lockall')
    .setDescription('Lock all text channels in the server')
    .addStringOption(option =>
      option.setName('reason').setDescription('Reason for locking all channels').setRequired(false))
    .addStringOption(option =>
      option.setName('confirm').setDescription('Type CONFIRM to proceed').setRequired(true)),
  async execute(interaction) {
    if (!interaction.member.permissions.has('Administrator')) {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const confirm = interaction.options.getString('confirm');
    if (confirm !== 'CONFIRM') {
      return interaction.reply({ content: 'You must type CONFIRM to lock all channels.', ephemeral: true });
    }
    let data = { locked_channels: {} };
    if (fs.existsSync(DATA_PATH)) {
      data = JSON.parse(fs.readFileSync(DATA_PATH));
    }
    if (!data.locked_channels) data.locked_channels = {};
    let lockedCount = 0;
    for (const channel of interaction.guild.channels.cache.values()) {
      if (channel.type === ChannelType.GuildText && channel.permissionsFor(interaction.guild.members.me).has('ManageChannels')) {
        const everyoneRole = interaction.guild.roles.everyone;
        const originalPerms = channel.permissionOverwrites.cache.get(everyoneRole.id)?.allow?.toArray() || [];
        data.locked_channels[channel.id] = { originalPerms, reason, timestamp: new Date().toISOString() };
        await channel.permissionOverwrites.edit(everyoneRole, { SendMessages: false });
        await channel.send(`🔒 Channel locked. Reason: ${reason}`);
        lockedCount++;
      }
    }
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
    await interaction.reply({ content: `Locked ${lockedCount} channels.`, ephemeral: true });
  }
};
