const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Display detailed information about a user')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to show info for (default: yourself)')
        .setRequired(false)),

  async execute(interaction) {
    try {
      const member = interaction.options.getMember('user') || interaction.member;
      const user = member.user;

      // Format timestamps
      const createdAt = `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`;
      const joinedAt = `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>`;

      // Get user roles excluding @everyone
      const roles = member.roles.cache
        .filter(role => role.id !== interaction.guild.id)
        .sort((a, b) => b.position - a.position)
        .map(role => role.toString());

      // Get user activity/status
      const activities = member.presence?.activities.map(activity => {
        let text = `${activity.type === 'CUSTOM' ? '' : activity.type + ' '}${activity.name}`;
        if (activity.state) text += `: ${activity.state}`;
        return text;
      }) || ['No activity'];

      // Create embed
      const infoEmbed = new EmbedBuilder()
        .setAuthor({
          name: user.tag,
          iconURL: user.displayAvatarURL({ dynamic: true })
        })
        .setThumbnail(user.displayAvatarURL({ size: 1024, dynamic: true }))
        .setColor(member.displayHexColor || '#2F3136')
        .addFields(
          { name: '👤 User Info', value: `
• ID: ${user.id}
• Created: ${createdAt}
• Joined: ${joinedAt}
• Nickname: ${member.nickname || 'None'}
          `, inline: false },
          { name: '🎮 Activity', value: activities.join('\n') || 'None', inline: false },
          { name: `📝 Roles [${roles.length}]`, value: roles.join(' ') || 'None', inline: false },
          { name: '🛡️ Key Permissions', value: this.getKeyPermissions(member), inline: false }
        )
        .setFooter({ text: 'Last Updated' })
        .setTimestamp();

      await interaction.reply({ embeds: [infoEmbed] });

    } catch (error) {
      console.error('Error in userinfo command:', error);
      await interaction.reply({
        content: '❌ Failed to fetch user information. Please try again.',
        ephemeral: true
      });
    }
  },

  // Helper method to get key permissions
  getKeyPermissions(member) {
    const keyPermissions = [
      'Administrator',
      'ManageGuild',
      'ManageRoles',
      'ManageChannels',
      'ManageMessages',
      'ManageWebhooks',
      'ManageNicknames',
      'KickMembers',
      'BanMembers',
      'MentionEveryone'
    ];

    const permissions = member.permissions.toArray()
      .filter(perm => keyPermissions.includes(perm))
      .map(perm => `\`${perm}\``)
      .join(', ');

    return permissions || 'No key permissions';
  }
};