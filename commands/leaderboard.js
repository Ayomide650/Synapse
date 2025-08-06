const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '../data/levels.json');
const USERS_PER_PAGE = 10;

function calculateLevel(messages) {
  return Math.floor(Math.sqrt(messages / 5));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Show server XP leaderboard')
    .addIntegerOption(option =>
      option.setName('page').setDescription('Page number').setMinValue(1)),
  async execute(interaction) {
    let data = { users: {} };
    if (fs.existsSync(DATA_PATH)) {
      data = JSON.parse(fs.readFileSync(DATA_PATH));
    }

    const sortedUsers = Object.entries(data.users)
      .map(([id, userData]) => ({
        id,
        xp: userData.xp || 0,
        messages: userData.messages || 0,
        level: calculateLevel(userData.messages || 0)
      }))
      .sort((a, b) => b.xp - a.xp);

    const totalPages = Math.ceil(sortedUsers.length / USERS_PER_PAGE);
    const page = Math.min(interaction.options.getInteger('page') || 1, totalPages);
    const startIndex = (page - 1) * USERS_PER_PAGE;
    const pageUsers = sortedUsers.slice(startIndex, startIndex + USERS_PER_PAGE);

    const getRankColor = (index) => {
      switch (index) {
        case 0: return '🥇';  // Gold
        case 1: return '🥈';  // Silver
        case 2: return '🥉';  // Bronze
        default: return '⭐';
      }
    };

    const description = await Promise.all(pageUsers.map(async (userData, index) => {
      const rank = startIndex + index + 1;
      const user = await interaction.client.users.fetch(userData.id).catch(() => null);
      const username = user ? user.tag : 'Unknown User';
      const isCurrentUser = userData.id === interaction.user.id;
      const rankEmoji = getRankColor(rank - 1);
      const line = `${rankEmoji} **#${rank}** | Level ${userData.level} | XP: ${userData.xp} | ${username}`;
      return isCurrentUser ? `**→ ${line}**` : line;
    }));

    const embed = new EmbedBuilder()
      .setTitle('🏆 Server Leaderboard')
      .setDescription(description.join('\n'))
      .setColor(0xffd700)
      .setFooter({ text: `Page ${page}/${totalPages} • ${sortedUsers.length} total users` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};