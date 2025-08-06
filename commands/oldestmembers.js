const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('oldestmembers')
    .setDescription('List the oldest Discord accounts in the server')
    .addIntegerOption(option =>
      option.setName('count')
        .setDescription('Number of members to show (default: 10, max: 25)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(25))
    .setContexts([0, 1]) // 0 = Guild, 1 = BotDM, 2 = PrivateChannel
    .setIntegrationTypes([0, 1]), // 0 = Guild Install, 1 = User Install

  async execute(interaction) {
    try {
      // Check if command is being used in a guild
      if (!interaction.guild) {
        return await interaction.reply({
          content: '❌ This command can only be used in a server, not in DMs or private channels.',
          ephemeral: true
        });
      }

      // Check if bot has necessary permissions in the guild
      if (!interaction.guild.members.me) {
        return await interaction.reply({
          content: '❌ I cannot access member information in this server.',
          ephemeral: true
        });
      }

      // Check if bot has permission to view members
      if (!interaction.guild.members.me.permissions.has('ViewChannel') || 
          !interaction.guild.members.me.permissions.has('ReadMessageHistory')) {
        return await interaction.reply({
          content: '❌ I need permission to view channels and members to use this command.',
          ephemeral: true
        });
      }

      const count = interaction.options.getInteger('count') || 10;
      await interaction.deferReply();

      // Check if the guild is available and not in an outage
      if (!interaction.guild.available) {
        return await interaction.editReply({
          content: '❌ This server is currently unavailable due to a Discord outage. Please try again later.',
          ephemeral: true
        });
      }

      // Fetch all members if not cached (with error handling)
      let membersFetched = false;
      try {
        if (interaction.guild.members.cache.size < interaction.guild.memberCount) {
          console.log(`Fetching members for guild: ${interaction.guild.name} (${interaction.guild.id})`);
          await interaction.guild.members.fetch({ limit: 1000 }); // Fetch up to 1000 members
          membersFetched = true;
        }
      } catch (fetchError) {
        console.error('Error fetching members:', fetchError);
        // Continue with cached members if fetch fails
      }

      // Check if we have any members to work with
      if (interaction.guild.members.cache.size === 0) {
        return await interaction.editReply({
          content: '❌ Unable to access member information. The bot may not have sufficient permissions or the server may be experiencing issues.',
        });
      }

      // Filter out bots if desired (optional)
      const humanMembers = interaction.guild.members.cache.filter(member => !member.user.bot);
      
      // Use human members if we have enough, otherwise use all members
      const membersToSort = humanMembers.size >= count ? humanMembers : interaction.guild.members.cache;

      // Sort members by account creation date
      const oldestMembers = membersToSort
        .sort((a, b) => a.user.createdTimestamp - b.user.createdTimestamp)
        .first(count);

      if (oldestMembers.length === 0) {
        return await interaction.editReply({
          content: '❌ No members found to display.',
        });
      }

      // Create embed
      const listEmbed = new EmbedBuilder()
        .setTitle('👴 Oldest Discord Accounts')
        .setColor(0x2F3136)
        .setDescription(
          oldestMembers.map((member, index) => {
            const createdAt = Math.floor(member.user.createdTimestamp / 1000);
            const accountAge = Math.floor((Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24));
            
            // Handle potential display name issues
            const displayName = member.user.globalName || member.user.username || 'Unknown User';
            const tag = member.user.discriminator !== '0' 
              ? `${member.user.username}#${member.user.discriminator}`
              : `@${member.user.username}`;
            
            return `${index + 1}. **${displayName}** (${tag})\n` +
                   `↳ Created: <t:${createdAt}:D> (${accountAge.toLocaleString()} days ago)`;
          }).join('\n\n')
        )
        .setFooter({ 
          text: `Showing ${oldestMembers.length} out of ${membersToSort.size} members${membersFetched ? ' (recently fetched)' : ' (from cache)'}` 
        })
        .setTimestamp();

      // Add server info
      if (interaction.guild.iconURL()) {
        listEmbed.setThumbnail(interaction.guild.iconURL());
      }

      await interaction.editReply({ embeds: [listEmbed] });

    } catch (error) {
      console.error('Error in oldestmembers command:', error);
      console.error('Guild info:', {
        guildId: interaction.guild?.id,
        guildName: interaction.guild?.name,
        memberCount: interaction.guild?.memberCount,
        cachedMembers: interaction.guild?.members?.cache?.size
      });

      const errorMessage = error.code === 50001 
        ? '❌ I don\'t have permission to access member information in this server.'
        : error.code === 50013
        ? '❌ Missing permissions. Please ensure the bot has "View Server Members" permission.'
        : '❌ Failed to fetch member information. This might be due to Discord API limits or server settings.';

      const reply = {
        content: errorMessage,
        ephemeral: true
      };

      try {
        if (interaction.deferred) {
          await interaction.editReply(reply);
        } else {
          await interaction.reply(reply);
        }
      } catch (replyError) {
        console.error('Failed to send error message:', replyError);
      }
    }
  }
};
