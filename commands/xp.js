const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '../data/levels.json');
const CONFIG_PATH = path.join(__dirname, '../data/config.json');

function calculateLevel(xp) {
  return Math.floor(Math.sqrt(xp / 100));
}

function calculateXpForLevel(level) {
  return level * level * 100;
}

function formatTime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('xp')
    .setDescription('Show detailed XP information')
    .addUserOption(option =>
      option.setName('user').setDescription('User to check XP for').setRequired(false)),
  async execute(interaction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    let data = { users: {} };
    let config = {};
    if (fs.existsSync(DATA_PATH)) {
      data = JSON.parse(fs.readFileSync(DATA_PATH));
    }
    if (fs.existsSync(CONFIG_PATH)) {
      config = JSON.parse(fs.readFileSync(CONFIG_PATH));
    }
    if (!data.users) data.users = {};
    const userData = data.users[targetUser.id] || { xp: 0, last_xp_gain: null };
    const currentXP = userData.xp || 0;
    const currentLevel = calculateLevel(currentXP);
    const nextLevelXP = calculateXpForLevel(currentLevel + 1);
    const xpNeeded = nextLevelXP - currentXP;
    const lastActivity = userData.last_xp_gain ? new Date(userData.last_xp_gain) : null;
    const xpGainRate = userData.xp_gain_rate || 0;
    const timeToLevel = xpGainRate > 0 ? formatTime((xpNeeded / xpGainRate) * 3600000) : 'Unknown';
    const currency = config.currency_symbol || '🪙';
    const embed = new EmbedBuilder()
      .setTitle(`${targetUser.tag}'s XP Details`)
      .setThumbnail(targetUser.displayAvatarURL())
      .addFields(
        { name: 'Current Level', value: currentLevel.toString(), inline: true },
        { name: 'Total XP Earned', value: `${currentXP} ${currency}`, inline: true },
        { name: 'XP to Next Level', value: `${xpNeeded} ${currency}`, inline: true },
        { name: 'XP Gain Rate', value: `${xpGainRate.toFixed(1)}/hour ${currency}`, inline: true },
        { name: 'Est. Time to Level', value: timeToLevel, inline: true },
        { name: 'Last Activity', value: lastActivity ? `<t:${Math.floor(lastActivity.getTime() / 1000)}:R>` : 'Never', inline: true }
      )
      .setColor(0x00ff00)
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }
};