const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roleinfo')
    .setDescription('Display detailed information about a role')
    .addRoleOption(option =>
      option.setName('role')
        .setDescription('Role to show info for')
        .setRequired(true)),

  async execute(interaction) {
    try {
      const role = interaction.options.getRole('role');

      // Get role permissions
      const permissions = role.permissions.toArray();
      const keyPermissions = permissions.filter(perm => 
        ['Administrator', 'ManageGuild', 'ManageRoles', 'ManageChannels', 
         'ManageMessages', 'KickMembers', 'BanMembers'].includes(perm)
      );

      // Get role members count
      const memberCount = role.members.size;

      // Create embed
      const infoEmbed = new EmbedBuilder()
        .setTitle(role.name)
        .setColor(role.color || 0x2F3136)
        .addFields(
          {
            name: '📊 Role Statistics',
            value: `
• Members: ${memberCount}
• Position: ${role.position}/${interaction.guild.roles.cache.size - 1}
• Created: <t:${Math.floor(role.createdTimestamp / 1000)}:F>
• Mentionable: ${role.mentionable ? 'Yes' : 'No'}
• Hoisted: ${role.hoist ? 'Yes' : 'No'}
• Color: ${role.hexColor}
            `,
            inline: false
          },
          {
            name: '⚡ Key Permissions',
            value: keyPermissions.length ? keyPermissions.map(p => `\`${p}\``).join(', ') : 'None',
            inline: false
          }
        )
        .setFooter({ text: `Role ID: ${role.id}` })
        .setTimestamp();

      // Add all permissions if they exist and differ from key permissions
      if (permissions.length > keyPermissions.length) {
        const otherPerms = permissions.filter(p => !keyPermissions.includes(p));
        const chunks = this.chunkArray(otherPerms, 15);
        
        chunks.forEach((chunk, i) => {
          infoEmbed.addFields({
            name: i === 0 ? '📝 Other Permissions' : '📝 Other Permissions (cont.)',
            value: chunk.map(p => `\`${p}\``).join(', '),
            inline: false
          });
        });
      }

      await interaction.reply({ embeds: [infoEmbed] });

    } catch (error) {
      console.error('Error in roleinfo command:', error);
      await interaction.reply({
        content: '❌ Failed to fetch role information. Please try again.',
        ephemeral: true
      });
    }
  },

  // Helper method to chunk arrays
  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
};