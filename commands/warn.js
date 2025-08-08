const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Database = require('../database/database'); // Adjust path as needed

const LOG_CHANNEL_ID = process.env.SERVER_LOG_CHANNEL;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Issue a warning to a user')
    .addUserOption(option =>
      option.setName('user').setDescription('User to warn').setRequired(true))
    .addStringOption(option =>
      option.setName('reason').setDescription('Reason for warning').setRequired(true)),
      
  async execute(interaction) {
    try {
      // Check permissions
      if (!interaction.member.permissions.has('ModerateMembers')) {
        return interaction.reply({ 
          content: 'You do not have permission to use this command.', 
          ephemeral: true 
        });
      }

      const user = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason');
      
      // Check if user is in the server
      const member = interaction.guild.members.cache.get(user.id);
      if (!member) {
        return interaction.reply({ 
          content: 'User not found in this server.', 
          ephemeral: true 
        });
      }

      // Prevent warning bots or the command user themselves
      if (user.bot) {
        return interaction.reply({ 
          content: 'You cannot warn bots.', 
          ephemeral: true 
        });
      }

      if (user.id === interaction.user.id) {
        return interaction.reply({ 
          content: 'You cannot warn yourself.', 
          ephemeral: true 
        });
      }

      // Check if trying to warn a higher role member
      if (member.roles.highest.position >= interaction.member.roles.highest.position && 
          interaction.user.id !== interaction.guild.ownerId) {
        return interaction.reply({ 
          content: 'You cannot warn someone with a higher or equal role.', 
          ephemeral: true 
        });
      }

      // Initialize database
      const db = new Database();
      await db.initialize();

      // Get existing warnings data
      const warningsData = await db.get('warn') || { warnings: [] };
      if (!warningsData.warnings) warningsData.warnings = [];

      // Create new warning object
      const warning = {
        id: Date.now(),
        user_id: user.id,
        username: user.username,
        user_tag: user.tag,
        moderator_id: interaction.user.id,
        moderator_tag: interaction.user.tag,
        reason: reason.trim(),
        timestamp: new Date().toISOString(),
        guild_id: interaction.guild.id,
        guild_name: interaction.guild.name
      };

      // Add warning to data
      warningsData.warnings.push(warning);

      // Save to database
      await db.set('warn', warningsData);

      // Count user's total warnings
      const userWarnings = warningsData.warnings.filter(w => w.user_id === user.id);
      const warningCount = userWarnings.length;

      // Create response embed
      const responseEmbed = new EmbedBuilder()
        .setTitle('⚠️ Warning Issued')
        .setDescription(`Successfully warned **${user.tag}**`)
        .addFields([
          { name: 'Warning ID', value: `\`${warning.id}\``, inline: true },
          { name: 'Total Warnings', value: `${warningCount}`, inline: true },
          { name: 'Reason', value: reason, inline: false }
        ])
        .setColor(0xffa500)
        .setTimestamp()
        .setFooter({ 
          text: `Moderator: ${interaction.user.tag}`, 
          iconURL: interaction.user.displayAvatarURL() 
        });

      await interaction.reply({ 
        embeds: [responseEmbed],
        ephemeral: true 
      });

      // Send DM to warned user (optional, but good practice)
      try {
        const dmEmbed = new EmbedBuilder()
          .setTitle('⚠️ You Have Been Warned')
          .setDescription(`You have been warned in **${interaction.guild.name}**`)
          .addFields([
            { name: 'Warning ID', value: `\`${warning.id}\``, inline: true },
            { name: 'Total Warnings', value: `${warningCount}`, inline: true },
            { name: 'Reason', value: reason, inline: false },
            { name: 'Moderator', value: interaction.user.tag, inline: true }
          ])
          .setColor(0xffa500)
          .setTimestamp();

        await user.send({ embeds: [dmEmbed] });
      } catch (dmError) {
        console.log(`Could not send DM to ${user.tag}: ${dmError.message}`);
        // Don't fail the command if DM fails
      }

      // Log to moderation channel if configured
      if (LOG_CHANNEL_ID) {
        try {
          const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
          if (logChannel && logChannel.isTextBased()) {
            const logEmbed = new EmbedBuilder()
              .setTitle('🚨 Moderation Action: Warning')
              .setDescription(`**${user.tag}** was warned by **${interaction.user.tag}**`)
              .addFields([
                { name: 'Warning ID', value: `\`${warning.id}\``, inline: true },
                { name: 'User ID', value: user.id, inline: true },
                { name: 'Moderator ID', value: interaction.user.id, inline: true },
                { name: 'Total Warnings', value: warningCount.toString(), inline: true },
                { name: 'Channel', value: `<#${interaction.channel.id}>`, inline: true },
                { name: 'Time', value: `<t:${Math.floor(Date.now() / 1000)}:f>`, inline: true },
                { name: 'Reason', value: reason, inline: false }
              ])
              .setColor(0xffa500)
              .setThumbnail(user.displayAvatarURL())
              .setTimestamp();

            await logChannel.send({ embeds: [logEmbed] });
          }
        } catch (logError) {
          console.error('Error sending to log channel:', logError);
          // Don't fail the command if logging fails
        }
      }

      // Auto-moderation based on warning count
      if (warningCount >= 3) {
        try {
          const autoModEmbed = new EmbedBuilder()
            .setTitle('🔴 Auto-Moderation Alert')
            .setDescription(`**${user.tag}** now has **${warningCount}** warnings!`)
            .addFields([
              { name: 'Suggested Actions', value: '• Consider temporary timeout\n• Review user behavior\n• Escalate to higher staff if needed' }
            ])
            .setColor(0xff0000)
            .setTimestamp();

          if (LOG_CHANNEL_ID) {
            const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
            if (logChannel && logChannel.isTextBased()) {
              await logChannel.send({ embeds: [autoModEmbed] });
            }
          }
        } catch (autoModError) {
          console.error('Error sending auto-mod alert:', autoModError);
        }
      }

    } catch (error) {
      console.error('Error in warn command:', error);
      
      // Fallback error response
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Error')
        .setDescription('An error occurred while issuing the warning. Please try again later.')
        .setColor(0xff0000);
        
      await interaction.reply({ 
        embeds: [errorEmbed], 
        ephemeral: true 
      });
    }
  }
};
