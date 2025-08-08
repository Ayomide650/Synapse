const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Database = require('../database/database'); // Adjust path as needed

const WARNINGS_PER_PAGE = 5;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('View warnings for a user')
    .addUserOption(option =>
      option.setName('user').setDescription('User to check warnings for').setRequired(true))
    .addIntegerOption(option =>
      option.setName('page').setDescription('Page number').setMinValue(1)),
      
  async execute(interaction) {
    try {
      const user = interaction.options.getUser('user');
      const page = interaction.options.getInteger('page') || 1;

      // Check permissions - only moderators and the user themselves can view warnings
      const canViewWarnings = interaction.member.permissions.has('ModerateMembers') || 
                             interaction.user.id === user.id ||
                             interaction.member.permissions.has('Administrator');

      if (!canViewWarnings) {
        const permissionEmbed = new EmbedBuilder()
          .setTitle('🔒 Access Denied')
          .setDescription('You can only view your own warnings or need moderation permissions to view others.')
          .setColor(0xff0000);

        return interaction.reply({ 
          embeds: [permissionEmbed], 
          ephemeral: true 
        });
      }

      // Initialize database
      const db = new Database();
      await db.initialize();

      // Get warnings data
      const warningsData = await db.get('warn') || { warnings: [] };
      if (!warningsData.warnings) warningsData.warnings = [];

      // Filter and sort user warnings (newest first)
      const userWarnings = warningsData.warnings
        .filter(w => w.user_id === user.id)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      // Handle no warnings case
      if (userWarnings.length === 0) {
        const noWarningsEmbed = new EmbedBuilder()
          .setTitle('✅ Clean Record')
          .setDescription(`**${user.tag}** has no warnings.`)
          .setThumbnail(user.displayAvatarURL())
          .setColor(0x00ff00)
          .setTimestamp();

        return interaction.reply({ 
          embeds: [noWarningsEmbed], 
          ephemeral: true 
        });
      }

      // Calculate pagination
      const totalPages = Math.ceil(userWarnings.length / WARNINGS_PER_PAGE);
      
      if (page > totalPages) {
        const invalidPageEmbed = new EmbedBuilder()
          .setTitle('📄 Invalid Page')
          .setDescription(`Page **${page}** does not exist.`)
          .addFields([
            { name: 'Available Pages', value: `1 - ${totalPages}`, inline: true },
            { name: 'Total Warnings', value: userWarnings.length.toString(), inline: true }
          ])
          .setColor(0xffa500);

        return interaction.reply({ 
          embeds: [invalidPageEmbed], 
          ephemeral: true 
        });
      }

      // Get warnings for current page
      const startIdx = (page - 1) * WARNINGS_PER_PAGE;
      const pageWarnings = userWarnings.slice(startIdx, startIdx + WARNINGS_PER_PAGE);

      // Color coding based on warning count
      const getColor = (warningCount) => {
        if (warningCount <= 2) return 0x00ff00;      // Green - Low
        if (warningCount <= 4) return 0xffff00;      // Yellow - Medium
        if (warningCount <= 6) return 0xff8000;      // Orange - High
        return 0xff0000;                             // Red - Very High
      };

      // Risk level indicator
      const getRiskLevel = (warningCount) => {
        if (warningCount <= 2) return '🟢 Low Risk';
        if (warningCount <= 4) return '🟡 Medium Risk';
        if (warningCount <= 6) return '🟠 High Risk';
        return '🔴 Very High Risk';
      };

      // Create main embed
      const embed = new EmbedBuilder()
        .setTitle(`⚠️ Warnings for ${user.tag}`)
        .setDescription(`**Total Warnings:** ${userWarnings.length}\n**Risk Level:** ${getRiskLevel(userWarnings.length)}`)
        .setThumbnail(user.displayAvatarURL())
        .setColor(getColor(userWarnings.length))
        .setFooter({ 
          text: `Page ${page} of ${totalPages} • Requested by ${interaction.user.tag}`,
          iconURL: interaction.user.displayAvatarURL()
        })
        .setTimestamp();

      // Add warnings to embed
      for (let i = 0; i < pageWarnings.length; i++) {
        const warning = pageWarnings[i];
        const warningNumber = startIdx + i + 1;
        
        try {
          // Try to fetch moderator info
          let moderatorInfo = warning.moderator_tag || 'Unknown Moderator';
          
          if (warning.moderator_id) {
            try {
              const moderator = await interaction.client.users.fetch(warning.moderator_id);
              moderatorInfo = moderator.tag;
            } catch (fetchError) {
              // Use stored tag if fetch fails
              moderatorInfo = warning.moderator_tag || `<@${warning.moderator_id}>`;
            }
          }

          // Format date with relative time
          const warningDate = new Date(warning.timestamp);
          const timestamp = Math.floor(warningDate.getTime() / 1000);
          
          embed.addFields({
            name: `${warningNumber}. Warning ID: \`${warning.id}\``,
            value: `**Reason:** ${warning.reason}\n**Moderator:** ${moderatorInfo}\n**Date:** <t:${timestamp}:f> (<t:${timestamp}:R>)`,
            inline: false
          });

        } catch (fieldError) {
          console.error(`Error processing warning ${warning.id}:`, fieldError);
          // Add basic info even if detailed fetch fails
          embed.addFields({
            name: `${warningNumber}. Warning ID: \`${warning.id}\``,
            value: `**Reason:** ${warning.reason}\n**Moderator:** ${warning.moderator_tag || 'Unknown'}\n**Date:** ${new Date(warning.timestamp).toLocaleString()}`,
            inline: false
          });
        }
      }

      // Add navigation hint for multiple pages
      if (totalPages > 1) {
        embed.addFields({
          name: '📖 Navigation',
          value: `Use \`/warnings user:${user.tag} page:${page + 1 <= totalPages ? page + 1 : 1}\` to view ${page + 1 <= totalPages ? 'next' : 'first'} page`,
          inline: false
        });
      }

      // Add summary statistics
      if (userWarnings.length > 0) {
        const oldestWarning = userWarnings[userWarnings.length - 1];
        const newestWarning = userWarnings[0];
        const daysSinceFirst = Math.floor((Date.now() - new Date(oldestWarning.timestamp).getTime()) / (1000 * 60 * 60 * 24));
        const daysSinceLast = Math.floor((Date.now() - new Date(newestWarning.timestamp).getTime()) / (1000 * 60 * 60 * 24));

        embed.addFields({
          name: '📊 Statistics',
          value: `**First Warning:** ${daysSinceFirst} days ago\n**Latest Warning:** ${daysSinceLast} days ago\n**Average per Month:** ${((userWarnings.length / Math.max(daysSinceFirst, 1)) * 30).toFixed(1)}`,
          inline: false
        });
      }

      await interaction.reply({ 
        embeds: [embed], 
        ephemeral: true 
      });

    } catch (error) {
      console.error('Error in warnings command:', error);
      
      // Fallback error response
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Error')
        .setDescription('An error occurred while fetching warnings. Please try again later.')
        .setColor(0xff0000);
        
      await interaction.reply({ 
        embeds: [errorEmbed], 
        ephemeral: true 
      });
    }
  }
};
