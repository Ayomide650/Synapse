const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('serverinvite')
    .setDescription('Generate a server invite link with custom settings')
    .setDefaultMemberPermissions(PermissionFlagsBits.CreateInstantInvite)
    .addIntegerOption(option =>
      option.setName('expires')
        .setDescription('Expiration time in hours (0 = never)')
        .setRequired(false)
        .setMinValue(0)
        .setMaxValue(168)) // 1 week max
    .addIntegerOption(option =>
      option.setName('uses')
        .setDescription('Maximum number of uses (0 = unlimited)')
        .setRequired(false)
        .setMinValue(0)
        .setMaxValue(100)),

  async execute(interaction) {
    try {
      const expiresIn = interaction.options.getInteger('expires') || 0;
      const maxUses = interaction.options.getInteger('uses') || 0;

      // Convert hours to seconds for the API
      const maxAge = expiresIn * 3600;

      // Create the invite
      const invite = await interaction.channel.createInvite({
        maxAge: maxAge,
        maxUses: maxUses,
        unique: true,
        reason: `Created by ${interaction.user.tag}`
      });

      // Format response message
      let response = `✅ **New Invite Created**\n`;
      response += `🔗 Link: ${invite.url}\n`;
      response += `📍 Channel: ${interaction.channel}\n`;
      
      if (maxUses > 0) {
        response += `📊 Uses: 0/${maxUses}\n`;
      } else {
        response += `📊 Uses: Unlimited\n`;
      }
      
      if (expiresIn > 0) {
        response += `⏱️ Expires: After ${expiresIn} hour${expiresIn === 1 ? '' : 's'}\n`;
      } else {
        response += `⏱️ Expires: Never\n`;
      }

      await interaction.reply({
        content: response,
        ephemeral: true
      });

    } catch (error) {
      console.error('Error in serverinvite command:', error);
      await interaction.reply({
        content: '❌ Failed to create invite. Please check my permissions and try again.',
        ephemeral: true
      });
    }
  }
};