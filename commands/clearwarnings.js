const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../utils/database');

const LOG_CHANNEL_ID = process.env.SERVER_LOG_CHANNEL;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clearwarnings')
    .setDescription('Remove all warnings for a user')
    .addUserOption(option =>
      option.setName('user').setDescription('User to clear warnings for').setRequired(true))
    .addStringOption(option =>
      option.setName('confirm').setDescription('Type CONFIRM to proceed').setRequired(true)),
      
  async execute(interaction) {
    try {
      // Check permissions - Administrator only for clearing warnings
      if (!interaction.member.permissions.has('Administrator')) {
        return interaction.reply({ 
          content: 'You do not have permission to use this command. Administrator role required.', 
          ephemeral: true 
        });
      }

      const user = interaction.options.getUser('user');
      const confirm = interaction.options.getString('confirm');

      // Require explicit confirmation to prevent accidental clearing
      if (confirm !== 'CONFIRM') {
        const confirmEmbed = new EmbedBuilder()
          .setTitle('⚠️ Confirmation Required')
          .setDescription('You must type **CONFIRM** (all caps) to clear warnings.')
          .addFields([
            { name: 'Target User', value: user.tag, inline: true },
            { name: 'Action', value: 'Clear all warnings', inline: true },
            { name: 'Required Input', value: '`CONFIRM`', inline: true }
          ])
          .setColor(0xffa500);

        return interaction.reply({ 
          embeds: [confirmEmbed], 
          ephemeral: true 
        });
      }

      // Initialize database
      const db = new Database();
      await db.initialize();

      // Get current warnings data
      const warningsData = await db.get('warn') || { warnings: [] };
      if (!warningsData.warnings) warningsData.warnings = [];

      // Count warnings before clearing
      const userWarnings = warningsData.warnings.filter(w => w.user_id === user.id);
      const beforeCount = userWarnings.length;

      if (beforeCount === 0) {
        const noWarningsEmbed = new EmbedBuilder()
          .setTitle('ℹ️ No Warnings Found')
          .setDescription(`**${user.tag}** has no warnings to clear.`)
          .setColor(0x0099ff);

        return interaction.reply({ 
          embeds: [noWarningsEmbed], 
          ephemeral: true 
        });
      }

      // Store cleared warnings for audit log (optional - for record keeping)
      const clearedWarnings = userWarnings.map(warning => ({
        ...warning,
        cleared_by: interaction.user.id,
        cleared_by_tag: interaction.user.tag,
        cleared_at: new Date().toISOString(),
        cleared_reason: 'Administrator cleared all warnings'
      }));

      // Remove all warnings for the user
      warningsData.warnings = warningsData.warnings.filter(w => w.user_id !== user.id);

      // Save updated data to database
      await db.set('warn', warningsData);

      // Create success response embed
      const successEmbed = new EmbedBuilder()
        .setTitle('✅ Warnings Cleared')
        .setDescription(`Successfully cleared all warnings for **${user.tag}**`)
        .addFields([
          { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
          { name: 'Warnings Removed', value: beforeCount.toString(), inline: true },
          { name: 'Cleared By', value: interaction.user.tag, inline: true }
        ])
        .setColor(0x00ff00)
        .setTimestamp()
        .setFooter({ 
          text: `Action performed by ${interaction.user.tag}`, 
          iconURL: interaction.user.displayAvatarURL() 
        });

      await interaction.reply({ 
        embeds: [successEmbed], 
        ephemeral: true 
      });

      // Send DM to user (optional notification)
      try {
        const dmEmbed = new EmbedBuilder()
          .setTitle('✅ Warnings Cleared')
          .setDescription(`Your warnings have been cleared in **${interaction.guild.name}**`)
          .addFields([
            { name: 'Warnings Removed', value: beforeCount.toString(), inline: true },
            { name: 'Cleared By', value: interaction.user.tag, inline: true }
          ])
          .setColor(0x00ff00)
          .setTimestamp();

        await user.send({ embeds: [dmEmbed] });
      } catch (dmError) {
        console.log(`Could not send DM to ${user.tag}: ${dmError.message}`);
        // Don't fail the command if DM fails
      }

      // Log to moderation channel
      if (LOG_CHANNEL_ID) {
        try {
          const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
          if (logChannel && logChannel.isTextBased()) {
            const logEmbed = new EmbedBuilder()
              .setTitle('🗑️ Moderation Action: Warnings Cleared')
              .setDescription(`**${interaction.user.tag}** cleared all warnings for **${user.tag}**`)
              .addFields([
                { name: 'Target User', value: `${user.tag}\n\`${user.id}\``, inline: true },
                { name: 'Administrator', value: `${interaction.user.tag}\n\`${interaction.user.id}\``, inline: true },
                { name: 'Warnings Removed', value: beforeCount.toString(), inline: true },
                { name: 'Channel', value: `<#${interaction.channel.id}>`, inline: true },
                { name: 'Time', value: `<t:${Math.floor(Date.now() / 1000)}:f>`, inline: true },
                { name: 'Confirmation', value: '✅ CONFIRMED', inline: true }
              ])
              .setColor(0x0000ff)
              .setThumbnail(user.displayAvatarURL())
              .setTimestamp();

            // Add detailed warning summary if there were many warnings
            if (beforeCount > 5) {
              logEmbed.addFields([
                { name: '⚠️ High Warning Count', value: `This user had **${beforeCount}** warnings before clearing. Consider monitoring their future behavior.`, inline: false }
              ]);
            }

            await logChannel.send({ embeds: [logEmbed] });

            // Send a separate embed with cleared warnings details (for audit trail)
            if (clearedWarnings.length > 0 && clearedWarnings.length <= 5) {
              const auditEmbed = new EmbedBuilder()
                .setTitle('📋 Cleared Warnings Details')
                .setDescription(`Audit trail for warnings cleared from **${user.tag}**`)
                .setColor(0x999999)
                .setTimestamp();

              clearedWarnings.forEach((warning, index) => {
                auditEmbed.addFields([
                  { 
                    name: `Warning ${index + 1} (ID: ${warning.id})`, 
                    value: `**Reason:** ${warning.reason}\n**Date:** <t:${Math.floor(new Date(warning.timestamp).getTime() / 1000)}:f>\n**By:** ${warning.moderator_tag || 'Unknown'}`, 
                    inline: false 
                  }
                ]);
              });

              await logChannel.send({ embeds: [auditEmbed] });
            }
          }
        } catch (logError) {
          console.error('Error sending to log channel:', logError);
          // Don't fail the command if logging fails
        }
      }

    } catch (error) {
      console.error('Error in clearwarnings command:', error);
      
      // Fallback error response
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Error')
        .setDescription('An error occurred while clearing warnings. Please try again later.')
        .setColor(0xff0000);
        
      await interaction.reply({ 
        embeds: [errorEmbed], 
        ephemeral: true 
      });
    }
  }
};
