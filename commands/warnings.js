const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '../data/moderation.json');
const WARNINGS_PER_PAGE = 5;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('View warnings for a user')
    .addUserOption(option =>
      option.setName('user').setDescription('User to check warnings for').setRequired(true))
    .addIntegerOption(option =>
      option.setName('page').setDescription('Page number').setMinValue(1)),
  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const page = interaction.options.getInteger('page') || 1;

    if (!fs.existsSync(DATA_PATH)) {
      return interaction.reply({ content: 'No warnings found.', ephemeral: true });
    }

    const data = JSON.parse(fs.readFileSync(DATA_PATH));
    if (!data.warnings) data.warnings = [];

    const userWarnings = data.warnings
      .filter(w => w.user_id === user.id)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (userWarnings.length === 0) {
      return interaction.reply({ content: `${user.tag} has no warnings.`, ephemeral: true });
    }

    const totalPages = Math.ceil(userWarnings.length / WARNINGS_PER_PAGE);
    if (page > totalPages) {
      return interaction.reply({ 
        content: `Invalid page. Total pages: ${totalPages}`,
        ephemeral: true 
      });
    }

    const startIdx = (page - 1) * WARNINGS_PER_PAGE;
    const pageWarnings = userWarnings.slice(startIdx, startIdx + WARNINGS_PER_PAGE);

    const getColor = (warningCount) => {
      if (warningCount <= 2) return 0x00ff00;      // Green
      if (warningCount <= 4) return 0xffff00;      // Yellow
      return 0xff0000;                             // Red
    };

    const embed = new EmbedBuilder()
      .setTitle(`Warnings for ${user.tag}`)
      .setDescription(`Total Warnings: ${userWarnings.length}`)
      .setColor(getColor(userWarnings.length))
      .setFooter({ text: `Page ${page}/${totalPages}` })
      .setTimestamp();

    for (const warning of pageWarnings) {
      const moderator = await interaction.client.users.fetch(warning.moderator_id);
      const warningDate = new Date(warning.timestamp).toLocaleString();
      embed.addFields({
        name: `Warning ID: ${warning.id}`,
        value: `**Reason:** ${warning.reason}\n**By:** ${moderator.tag}\n**Date:** ${warningDate}`
      });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};