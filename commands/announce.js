const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Send a rich embed announcement')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option.setName('title')
        .setDescription('Title of the announcement')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('message')
        .setDescription('Content of the announcement')
        .setRequired(true))
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Channel to send announcement to (default: current channel)')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('color')
        .setDescription('Color of the embed (hex code or basic color name)')
        .setRequired(false)
        .addChoices(
          { name: 'Red', value: 'Red' },
          { name: 'Blue', value: 'Blue' },
          { name: 'Green', value: 'Green' },
          { name: 'Yellow', value: 'Yellow' },
          { name: 'Purple', value: 'Purple' },
          { name: 'Orange', value: 'Orange' }
        )),

  async execute(interaction) {
    try {
      const title = interaction.options.getString('title');
      const message = interaction.options.getString('message');
      const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
      const color = interaction.options.getString('color') || 'Blue';

      // Create rich embed
      const announceEmbed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(message)
        .setColor(color)
        .setTimestamp()
        .setFooter({ 
          text: `Announced by ${interaction.user.tag}`, 
          iconURL: interaction.user.displayAvatarURL() 
        });

      // Send the announcement
      await targetChannel.send({ embeds: [announceEmbed] });

      // Confirm to the user
      await interaction.reply({
        content: `✅ Announcement sent to ${targetChannel}!`,
        ephemeral: true
      });

    } catch (error) {
      console.error('Error in announce command:', error);
      await interaction.reply({
        content: '❌ Failed to send announcement. Please check my permissions and try again.',
        ephemeral: true
      });
    }
  }
};