const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '../data/config.json');
const DATA_PATH = path.join(__dirname, '../data/levels.json');

function calculateLevel(messages) {
  return Math.floor(Math.sqrt(messages / 5));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('levelroles')
    .setDescription('View all level-based role rewards'),
  async execute(interaction) {
    let config = { rank_roles: {} };
    if (fs.existsSync(CONFIG_PATH)) {
      config = JSON.parse(fs.readFileSync(CONFIG_PATH));
    }

    const entries = Object.entries(config.rank_roles || {});
    if (entries.length === 0) {
      return interaction.reply({ content: 'No level roles configured.', ephemeral: true });
    }

    // Get user's current level
    let data = { users: {} };
    if (fs.existsSync(DATA_PATH)) {
      data = JSON.parse(fs.readFileSync(DATA_PATH));
    }
    const userData = data.users[interaction.user.id] || { messages: 0 };
    const userLevel = calculateLevel(userData.messages || 0);

    const embed = new EmbedBuilder()
      .setTitle('🏆 Level Roles')
      .setColor(0xffd700)
      .setDescription('Earn these roles by leveling up!');

    const sortedEntries = entries.sort(([a], [b]) => Number(a) - Number(b));
    for (const [level, roleId] of sortedEntries) {
      const role = await interaction.guild.roles.fetch(roleId);
      if (role) {
        const status = Number(level) <= userLevel ? '✅' : '❌';
        const color = Number(level) <= userLevel ? '🟢' : Number(level) - userLevel <= 5 ? '🟡' : '🔴';
        embed.addFields({
          name: `Level ${level}`,
          value: `${color} ${role.name} ${status}`,
          inline: true
        });
      }
    }

    embed.addFields({
      name: 'Your Current Level',
      value: `Level ${userLevel}`,
      inline: false
    });

    await interaction.reply({ embeds: [embed] });
  }
};