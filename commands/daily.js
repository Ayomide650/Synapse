const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const ms = require('ms');

const DATA_PATH = path.join(__dirname, '../data/economy.json');
const CONFIG_PATH = path.join(__dirname, '../data/config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Claim your daily coin reward'),
  async execute(interaction) {
    let config = { economy: { daily_amount: 100, streak_bonus: 10 } };
    if (fs.existsSync(CONFIG_PATH)) {
      config = JSON.parse(fs.readFileSync(CONFIG_PATH));
    }
    if (!config.economy) config.economy = { daily_amount: 100, streak_bonus: 10 };

    let data = { users: {} };
    if (fs.existsSync(DATA_PATH)) {
      data = JSON.parse(fs.readFileSync(DATA_PATH));
    }
    if (!data.users) data.users = {};

    const userData = data.users[interaction.user.id] || { 
      balance: 0, 
      transactions: [],
      last_daily: null,
      daily_streak: 0
    };

    const now = Date.now();
    const lastDaily = userData.last_daily ? new Date(userData.last_daily).getTime() : 0;
    const timeLeft = lastDaily + ms('24h') - now;

    if (timeLeft > 0) {
      const timeLeftString = ms(timeLeft, { long: true });
      return interaction.reply({
        content: `You already claimed your daily reward! Try again in ${timeLeftString}.`,
        ephemeral: true
      });
    }

    // Check streak (within 48h of last claim)
    if (now - lastDaily <= ms('48h')) {
      userData.daily_streak += 1;
    } else {
      userData.daily_streak = 1;
    }

    const streakBonus = (userData.daily_streak - 1) * config.economy.streak_bonus;
    const totalAmount = config.economy.daily_amount + streakBonus;

    userData.balance += totalAmount;
    userData.last_daily = new Date().toISOString();
    userData.transactions = userData.transactions || [];
    userData.transactions.push({
      type: 'daily',
      amount: totalAmount,
      streak: userData.daily_streak,
      timestamp: new Date().toISOString()
    });

    data.users[interaction.user.id] = userData;
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));

    const embed = new EmbedBuilder()
      .setTitle('💰 Daily Reward Claimed!')
      .setDescription(`You received your daily coins!`)
      .addFields(
        { name: 'Base Reward', value: `${config.economy.daily_amount} coins`, inline: true },
        { name: 'Streak Bonus', value: `${streakBonus} coins`, inline: true },
        { name: 'Total', value: `${totalAmount} coins`, inline: true },
        { name: 'Current Streak', value: `${userData.daily_streak} days 🔥`, inline: true },
        { name: 'New Balance', value: `${userData.balance} coins`, inline: true }
      )
      .setColor(0xffd700)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};