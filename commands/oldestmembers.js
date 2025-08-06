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
        .setMaxValue(25)),

  async execute(interaction) {
    try {
      const count = interaction.options.getInteger('count') || 10;

      await interaction.deferReply();

      // Fetch all members if not cached
      if (interaction.guild.members.cache.size !== interaction.guild.memberCount) {
        await interaction.guild.members.fetch();
      }

      // Sort members by account creation date
      const oldestMembers = interaction.guild.members.cache
        .sort((a, b) => a.user.createdTimestamp - b.user.createdTimestamp)
        .first(count);

      // Create embed
      const listEmbed = new EmbedBuilder()
        .setTitle('👴 Oldest Discord Accounts')
        .setColor(0x2F3136)
        .setDescription(
          oldestMembers.map((member, index) => {
            const createdAt = Math.floor(member.user.createdTimestamp / 1000);
            const accountAge = Math.floor((Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24));
            
            return `${index + 1}. ${member.user.tag}\n` +
                   `↳ Created: <t:${createdAt}:D> (${accountAge} days ago)`;
          }).join('\n\n')
        )
        .setFooter({ 
          text: `Showing ${oldestMembers.length} out of ${interaction.guild.memberCount} members` 
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [listEmbed] });

    } catch (error) {
      console.error('Error in oldestmembers command:', error);
      const reply = {
        content: '❌ Failed to fetch member information. Please try again.',
        ephemeral: true
      };

      if (interaction.deferred) {
        await interaction.editReply(reply);
      } else {
        await interaction.reply(reply);
      }
    }
  }
};