const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '../data/antilink.json');

// Initialize antilink data
if (!fs.existsSync(DATA_PATH)) {
  fs.writeFileSync(DATA_PATH, JSON.stringify({ channels: {} }));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('antilink')
    .setDescription('Manage link protection in channels')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('enable')
        .setDescription('Enable link protection in a channel')
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('Channel to enable link protection in')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('disable')
        .setDescription('Disable link protection in a channel')
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('Channel to disable link protection in')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List all channels with link protection enabled')),

  async execute(interaction) {
    try {
      const subcommand = interaction.options.getSubcommand();
      const data = JSON.parse(fs.readFileSync(DATA_PATH));

      switch (subcommand) {
        case 'enable': {
          const channel = interaction.options.getChannel('channel');
          data.channels[channel.id] = true;
          fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));

          await interaction.reply({
            content: `✅ Link protection enabled in ${channel}`,
            ephemeral: true
          });
          break;
        }

        case 'disable': {
          const channel = interaction.options.getChannel('channel');
          delete data.channels[channel.id];
          fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));

          await interaction.reply({
            content: `✅ Link protection disabled in ${channel}`,
            ephemeral: true
          });
          break;
        }

        case 'list': {
          const channels = Object.keys(data.channels)
            .map(id => `<#${id}>`)
            .join('\n') || 'No channels with link protection';

          await interaction.reply({
            content: `**Channels with Link Protection:**\n${channels}`,
            ephemeral: true
          });
          break;
        }
      }
    } catch (error) {
      console.error('Error in antilink command:', error);
      await interaction.reply({
        content: '❌ Failed to manage link protection. Please try again.',
        ephemeral: true
      });
    }
  },

  // Message event handler for link detection
  async handleMessage(message) {
    try {
      if (message.author.bot) return;

      const data = JSON.parse(fs.readFileSync(DATA_PATH));
      if (!data.channels[message.channel.id]) return;

      // Skip if user is admin
      if (message.member.permissions.has(PermissionFlagsBits.Administrator)) return;

      // Link detection regex
      const linkRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|discord\.gg\/[a-zA-Z0-9]+/gi;
      
      if (linkRegex.test(message.content)) {
        await message.delete();
        const warning = await message.channel.send({
          content: `⚠️ ${message.author}, links are not allowed in this channel!`
        });
        
        // Delete warning after 5 seconds
        setTimeout(() => warning.delete().catch(() => {}), 5000);
      }
    } catch (error) {
      console.error('Error in antilink message handler:', error);
    }
  }
};