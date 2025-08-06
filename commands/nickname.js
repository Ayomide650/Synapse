const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nickname')
    .setDescription('Change a user\'s nickname')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames)
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to change nickname for')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('nickname')
        .setDescription('New nickname (leave empty to reset)')
        .setRequired(false)),

  async execute(interaction) {
    try {
      const targetUser = interaction.options.getMember('user');
      const newNickname = interaction.options.getString('nickname');

      // Check if target user exists
      if (!targetUser) {
        return await interaction.reply({
          content: '❌ Could not find that user in this server.',
          ephemeral: true
        });
      }

      // Check role hierarchy
      if (targetUser.roles.highest.position >= interaction.member.roles.highest.position 
          && interaction.user.id !== interaction.guild.ownerId) {
        return await interaction.reply({
          content: '❌ You cannot modify the nickname of someone with a higher or equal role.',
          ephemeral: true
        });
      }

      // Check bot hierarchy
      if (targetUser.roles.highest.position >= interaction.guild.members.me.roles.highest.position) {
        return await interaction.reply({
          content: '❌ I cannot modify the nickname of someone with a higher or equal role than me.',
          ephemeral: true
        });
      }

      const oldNickname = targetUser.nickname || targetUser.user.username;
      
      // Change nickname
      await targetUser.setNickname(newNickname || null);

      const response = newNickname
        ? `✅ Changed ${targetUser}'s nickname from "${oldNickname}" to "${newNickname}"`
        : `✅ Reset ${targetUser}'s nickname back to "${targetUser.user.username}"`;

      await interaction.reply({
        content: response,
        ephemeral: true
      });

    } catch (error) {
      console.error('Error in nickname command:', error);
      await interaction.reply({
        content: '❌ Failed to change nickname. Please check my permissions and try again.',
        ephemeral: true
      });
    }
  }
};