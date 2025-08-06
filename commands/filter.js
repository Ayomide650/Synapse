const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '../data/config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('filter')
    .setDescription('Manage word filter')
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Add a word to the filter')
        .addStringOption(option =>
          option.setName('word').setDescription('Word or pattern to filter').setRequired(true))
        .addStringOption(option =>
          option.setName('action')
          .setDescription('Action to take when word is used')
          .setRequired(true)
          .addChoices(
            { name: 'Delete Message', value: 'delete' },
            { name: 'Timeout User', value: 'mute' },
            { name: 'Warn User', value: 'warn' },
            { name: 'Ban User', value: 'ban' }
          )))
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove a word from the filter')
        .addStringOption(option =>
          option.setName('word').setDescription('Word to remove from filter').setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List all filtered words')),
  async execute(interaction) {
    if (!interaction.member.permissions.has('Administrator')) {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }
    let config = { filters: [] };
    if (fs.existsSync(CONFIG_PATH)) {
      config = JSON.parse(fs.readFileSync(CONFIG_PATH));
    }
    if (!config.filters) config.filters = [];

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'add') {
      const word = interaction.options.getString('word').toLowerCase();
      const action = interaction.options.getString('action');
      const existingFilter = config.filters.find(f => f.word === word);
      if (existingFilter) {
        return interaction.reply({ content: 'This word is already filtered.', ephemeral: true });
      }
      config.filters.push({
        word,
        action,
        created_by: interaction.user.id,
        created_at: new Date().toISOString()
      });
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
      await interaction.reply({ 
        content: `Added "${word}" to filter with action: ${action}`,
        ephemeral: true 
      });
    }
    else if (subcommand === 'remove') {
      const word = interaction.options.getString('word').toLowerCase();
      const filterIndex = config.filters.findIndex(f => f.word === word);
      if (filterIndex === -1) {
        return interaction.reply({ content: 'Word not found in filter.', ephemeral: true });
      }
      config.filters.splice(filterIndex, 1);
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
      await interaction.reply({ 
        content: `Removed "${word}" from filter.`,
        ephemeral: true 
      });
    }
    else if (subcommand === 'list') {
      if (config.filters.length === 0) {
        return interaction.reply({ content: 'No filtered words.', ephemeral: true });
      }
      const filterList = config.filters.map(f => 
        `• "${f.word}" - Action: ${f.action}`
      ).join('\n');
      await interaction.reply({ 
        content: `**Filtered Words:**\n${filterList}`,
        ephemeral: true 
      });
    }
  }
};