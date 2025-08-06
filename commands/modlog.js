const { SlashCommandBuilder, ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '../data/config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('modlog')
    .setDescription('Set the moderation log channel')
    .addChannelOption(option =>
      option.setName('channel')
      .setDescription('Channel for mod logs (none to disable)')
      .setRequired(false)),
  async execute(interaction) {
    if (!interaction.member.permissions.has('Administrator')) {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }
    const channel = interaction.options.getChannel('channel');
    if (channel && channel.type !== ChannelType.GuildText) {
      return interaction.reply({ content: 'Modlog channel must be a text channel.', ephemeral: true });
    }
    let config = {};
    if (fs.existsSync(CONFIG_PATH)) {
      config = JSON.parse(fs.readFileSync(CONFIG_PATH));
    }
    if (channel) {
      config.modlog_channel = channel.id;
      await interaction.reply({ 
        content: `Modlog channel set to ${channel.name}.`,
        ephemeral: true 
      });
      await channel.send({
        embeds: [{
          title: 'Modlog Channel Set',
          description: `This channel has been set as the moderation log by ${interaction.user.tag}`,
          color: 0x00ff00,
          timestamp: new Date()
        }]
      });
    } else {
      delete config.modlog_channel;
      await interaction.reply({ 
        content: 'Modlog disabled.',
        ephemeral: true 
      });
    }
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  }
};