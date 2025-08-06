const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('Display user avatar in high quality')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to show avatar for (default: yourself)')
        .setRequired(false)),

  async execute(interaction) {
    try {
      const user = interaction.options.getUser('user') || interaction.user;
      
      const avatarEmbed = new EmbedBuilder()
        .setTitle(`${user.username}'s Avatar`)
        .setImage(user.displayAvatarURL({ size: 4096, dynamic: true }))
        .setDescription(`[PNG](${user.displayAvatarURL({ size: 4096, format: 'png' })}) | ` +
                       `[JPG](${user.displayAvatarURL({ size: 4096, format: 'jpg' })}) | ` +
                       `[WebP](${user.displayAvatarURL({ size: 4096, format: 'webp' })})` +
                       (user.avatar?.startsWith('a_') ? ` | [GIF](${user.displayAvatarURL({ size: 4096, format: 'gif' })})` : ''))
        .setColor(0x3498db)
        .setTimestamp();

      await interaction.reply({ embeds: [avatarEmbed] });

    } catch (error) {
      console.error('Error in avatar command:', error);
      await interaction.reply({
        content: '❌ Failed to fetch avatar. Please try again.',
        ephemeral: true
      });
    }
  }
};