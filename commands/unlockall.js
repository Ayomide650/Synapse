const { SlashCommandBuilder, ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');

const LOG_CHANNEL_ID = process.env.SERVER_LOG_CHANNEL;
const DATA_PATH = path.join(__dirname, '../data/moderation.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unlockall')
    .setDescription('Unlock all previously locked channels'),
  async execute(interaction) {
    if (!interaction.member.permissions.has('Administrator')) {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }
    let data = { locked_channels: {} };
    if (fs.existsSync(DATA_PATH)) {
      data = JSON.parse(fs.readFileSync(DATA_PATH));
    }
    if (!data.locked_channels || Object.keys(data.locked_channels).length === 0) {
      return interaction.reply({ content: 'No locked channels found.', ephemeral: true });
    }
    let unlockedCount = 0;
    for (const channelId of Object.keys(data.locked_channels)) {
      const channel = interaction.guild.channels.cache.get(channelId);
      if (channel && channel.type === ChannelType.GuildText && channel.permissionsFor(interaction.guild.members.me).has('ManageChannels')) {
        await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: null });
        await channel.send('🔓 Channel unlocked.');
        unlockedCount++;
      }
    }
    data.locked_channels = {};
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
    if (LOG_CHANNEL_ID) {
      const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
      if (logChannel) {
        logChannel.send({
          embeds: [{
            title: 'Unlock All Complete',
            description: `${interaction.user.tag} unlocked all previously locked channels.`,
            fields: [
              { name: 'Unlocked Channels', value: unlockedCount.toString() },
              { name: 'Moderator', value: interaction.user.tag },
              { name: 'Time', value: new Date().toISOString() }
            ],
            color: 0x00ffcc
          }]
        });
      }
    }
    await interaction.reply({ content: `Unlocked ${unlockedCount} channels.`, ephemeral: true });
  }
};
