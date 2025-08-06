const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '../data/config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('welcome')
    .setDescription('Configure welcome message channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('set')
        .setDescription('Set the welcome message channel')
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('Channel to send welcome messages in')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('disable')
        .setDescription('Disable welcome messages')),

  async execute(interaction) {
    try {
      const subcommand = interaction.options.getSubcommand();
      
      // Load config
      let config = {};
      if (fs.existsSync(CONFIG_PATH)) {
        config = JSON.parse(fs.readFileSync(CONFIG_PATH));
      }
      
      if (subcommand === 'set') {
        const channel = interaction.options.getChannel('channel');
        
        // Update config
        config.welcome_channel = channel.id;
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
        
        await interaction.reply({
          content: `✅ Welcome messages will now be sent in ${channel}`,
          ephemeral: true
        });
      } else if (subcommand === 'disable') {
        // Remove welcome channel from config
        delete config.welcome_channel;
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
        
        await interaction.reply({
          content: '✅ Welcome messages have been disabled',
          ephemeral: true
        });
      }
    } catch (error) {
      console.error('Error in welcome command:', error);
      await interaction.reply({
        content: '❌ Failed to configure welcome messages. Please try again.',
        ephemeral: true
      });
    }
  }
};