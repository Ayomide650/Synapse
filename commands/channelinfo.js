const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('channelinfo')
    .setDescription('Display detailed information about a channel')
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Channel to show info for (default: current channel)')
        .setRequired(false)),

  async execute(interaction) {
    try {
      const channel = interaction.options.getChannel('channel') || interaction.channel;

      // Get channel type string
      const typeMap = {
        [ChannelType.GuildText]: 'Text Channel',
        [ChannelType.GuildVoice]: 'Voice Channel',
        [ChannelType.GuildCategory]: 'Category',
        [ChannelType.GuildAnnouncement]: 'Announcement Channel',
        [ChannelType.GuildForum]: 'Forum Channel',
        [ChannelType.GuildStageVoice]: 'Stage Channel'
      };

      // Get permission overwrites
      const overwrites = channel.permissionOverwrites.cache.map(overwrite => {
        const type = overwrite.type === 0 ? 'Role' : 'Member';
        const target = overwrite.type === 0 
          ? interaction.guild.roles.cache.get(overwrite.id)
          : interaction.guild.members.cache.get(overwrite.id);
        
        const allow = overwrite.allow.toArray();
        const deny = overwrite.deny.toArray();
        
        return `${type}: ${target?.name || 'Unknown'}\n` +
               `↳ Allow: ${allow.length ? allow.join(', ') : 'None'}\n` +
               `↳ Deny: ${deny.length ? deny.join(', ') : 'None'}`;
      }).join('\n\n');

      const infoEmbed = new EmbedBuilder()
        .setTitle(`#${channel.name}`)
        .setColor(0x2F3136)
        .addFields(
          {
            name: '📝 Channel Info',
            value: `
• Type: ${typeMap[channel.type] || 'Unknown'}
• Category: ${channel.parent?.name || 'None'}
• Created: <t:${Math.floor(channel.createdTimestamp / 1000)}:F>
• Topic: ${channel.topic || 'No topic set'}
            `,
            inline: false
          },
          {
            name: '⚙️ Channel Settings',
            value: `
• NSFW: ${channel.nsfw ? 'Yes' : 'No'}
• Slowmode: ${channel.rateLimitPerUser || 0}s
• Position: ${channel.position}
            `,
            inline: false
          }
        )
        .setFooter({ text: `Channel ID: ${channel.id}` })
        .setTimestamp();

      // Add permission overwrites if any exist
      if (overwrites.length > 0) {
        // Split overwrites into chunks if too long
        const chunks = overwrites.match(/.{1,1024}/gs) || [];
        chunks.forEach((chunk, i) => {
          infoEmbed.addFields({
            name: i === 0 ? '🔒 Permission Overwrites' : '🔒 Permission Overwrites (cont.)',
            value: chunk,
            inline: false
          });
        });
      }

      await interaction.reply({ embeds: [infoEmbed] });

    } catch (error) {
      console.error('Error in channelinfo command:', error);
      await interaction.reply({
        content: '❌ Failed to fetch channel information. Please try again.',
        ephemeral: true
      });
    }
  }
};