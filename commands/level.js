const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '../data/levels.json');

function calculateLevel(xp) {
  return Math.floor(Math.sqrt(xp / 100));
}

function calculateXpForLevel(level) {
  return level * level * 100;
}

function createProgressBar(current, max, size = 20) {
  const progress = Math.round((current / max) * size);
  const fill = '█'.repeat(progress);
  const empty = '░'.repeat(size - progress);
  return fill + empty;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('level')
    .setDescription('Show level and XP progress')
    .addUserOption(option =>
      option.setName('user').setDescription('User to check level for').setRequired(false)),
  async execute(interaction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    let data = { users: {} };
    if (fs.existsSync(DATA_PATH)) {
      data = JSON.parse(fs.readFileSync(DATA_PATH));
    }
    if (!data.users) data.users = {};
    const userData = data.users[targetUser.id] || { xp: 0, last_xp_gain: null };
    const currentXP = userData.xp || 0;
    const currentLevel = calculateLevel(currentXP);
    const nextLevelXP = calculateXpForLevel(currentLevel + 1);
    const currentLevelXP = calculateXpForLevel(currentLevel);
    const xpNeeded = nextLevelXP - currentXP;
    const levelProgress = currentXP - currentLevelXP;
    const levelTotalXP = nextLevelXP - currentLevelXP;
    const progressBar = createProgressBar(levelProgress, levelTotalXP);
    const sortedUsers = Object.entries(data.users)
      .sort(([, a], [, b]) => (b.xp || 0) - (a.xp || 0));
    const rank = sortedUsers.findIndex(([id]) => id === targetUser.id) + 1;
    const embed = new EmbedBuilder()
      .setTitle(`${targetUser.tag}'s Level`)
      .setThumbnail(targetUser.displayAvatarURL())
      .setDescription(`
**Rank:** #${rank}
**Level:** ${currentLevel}
**Total XP:** ${currentXP}

**Progress to Level ${currentLevel + 1}**
${progressBar} ${levelProgress}/${levelTotalXP}
${xpNeeded} XP needed for next level
      `)
      .setColor(0x00ff00)
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }
};