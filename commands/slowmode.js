const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('Set channel slowmode')
    .addIntegerOption(option =>
      option.setName('seconds').setDescription('Slowmode duration in seconds (0-21600)').setRequired(true).setMinValue(0).setMaxValue(21600)),
  async execute(interaction) {
    if (!interaction.member.permissions.has('ManageChannels')) {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }
    const seconds = interaction.options.getInteger('seconds');
    const channel = interaction.channel;
    await channel.setRateLimitPerUser(seconds);
    await interaction.reply({ content: `Slowmode set to ${seconds} seconds.`, ephemeral: true });
  }
};
