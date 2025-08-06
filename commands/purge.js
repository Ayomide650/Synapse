const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Bulk delete messages in a channel')
    .addIntegerOption(option =>
      option.setName('amount').setDescription('Number of messages to delete (1-100)').setRequired(true).setMinValue(1).setMaxValue(100))
    .addUserOption(option =>
      option.setName('user').setDescription('Only delete messages from this user').setRequired(false))
    .addStringOption(option =>
      option.setName('content_filter').setDescription('Filter by content (links, images, etc.)').setRequired(false)),
  async execute(interaction) {
    if (!interaction.member.permissions.has('ManageMessages')) {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }
    const amount = interaction.options.getInteger('amount');
    const user = interaction.options.getUser('user');
    const filter = interaction.options.getString('content_filter');
    const channel = interaction.channel;
    let messages = await channel.messages.fetch({ limit: amount });
    if (user) {
      messages = messages.filter(m => m.author.id === user.id);
    }
    if (filter) {
      if (filter === 'links') messages = messages.filter(m => /https?:\/\//.test(m.content));
      if (filter === 'images') messages = messages.filter(m => m.attachments.size > 0);
    }
    const toDelete = messages.first(amount);
    await channel.bulkDelete(toDelete, true);
    await interaction.reply({ content: `Deleted ${toDelete.length} messages.`, ephemeral: true });
  }
};
