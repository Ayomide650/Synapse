const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Display detailed information about the server'),

  async execute(interaction) {
    try {
      const { guild } = interaction;
      await guild.fetch();
      
      // Get channel counts
      const totalChannels = guild.channels.cache.size;
      const textChannels = guild.channels.cache.filter(c => c.type === 0).size;
      const voiceChannels = guild.channels.cache.filter(c => c.type === 2).size;
      const categoryChannels = guild.channels.cache.filter(c => c.type === 4).size;

      // Get member counts
      const totalMembers = guild.memberCount;
      const botCount = guild.members.cache.filter(member => member.user.bot).size;
      const humanCount = totalMembers - botCount;

      // Get role count
      const roleCount = guild.roles.cache.size - 1; // Exclude @everyone

      // Create embed
      const serverEmbed = new EmbedBuilder()
        .setTitle(guild.name)
        .setThumbnail(guild.iconURL({ size: 1024, dynamic: true }))
        .setImage(guild.bannerURL({ size: 1024 }) || null)
        .setColor(0x2F3136)
        .addFields(
          { 
            name: '📊 Server Statistics',
            value: `
• Owner: ${(await guild.fetchOwner()).user.tag}
• Created: <t:${Math.floor(guild.createdTimestamp / 1000)}:F>
• Boost Level: ${guild.premiumTier}
• Boosts: ${guild.premiumSubscriptionCount || 0}
            `,
            inline: false
          },
          {
            name: '👥 Member Count',
            value: `
• Total: ${totalMembers}
• Humans: ${humanCount}
• Bots: ${botCount}
            `,
            inline: true
          },
          {
            name: '💬 Channels',
            value: `
• Total: ${totalChannels}
• Text: ${textChannels}
• Voice: ${voiceChannels}
• Categories: ${categoryChannels}
            `,
            inline: true
          },
          {
            name: '✨ Features',
            value: guild.features.length > 0
              ? guild.features.map(feature => `\`${feature}\``).join(', ')
              : 'No special features',
            inline: false
          },
          {
            name: '👑 Roles',
            value: `${roleCount} roles`,
            inline: true
          },
          {
            name: '🔐 Verification',
            value: `Level: ${guild.verificationLevel}`,
            inline: true
          }
        )
        .setFooter({ text: `ID: ${guild.id}` })
        .setTimestamp();

      await interaction.reply({ embeds: [serverEmbed] });

    } catch (error) {
      console.error('Error in serverinfo command:', error);
      await interaction.reply({
        content: '❌ Failed to fetch server information. Please try again.',
        ephemeral: true
      });
    }
  }
};