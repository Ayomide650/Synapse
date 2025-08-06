const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '../data/economy.json');
const CONFIG_PATH = path.join(__dirname, '../data/config.json');
const GAME_LOG_CHANNEL = process.env.GAME_LOG_CHANNEL;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('coinflip')
    .setDescription('Flip a coin to win or lose coins')
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('Amount of coins to bet (minimum 1)')
        .setRequired(true)
        .setMinValue(1))
    .addStringOption(option =>
      option.setName('choice')
        .setDescription('Choose heads or tails')
        .setRequired(true)
        .addChoices(
          { name: 'Heads', value: 'heads' },
          { name: 'Tails', value: 'tails' }
        )),
  
  async execute(interaction) {
    try {
      const amount = interaction.options.getInteger('amount');
      const choice = interaction.options.getString('choice');

      // Check bet limits
      let config = { economy: { min_bet: 10, max_bet: 10000 } };
      if (fs.existsSync(CONFIG_PATH)) {
        config = JSON.parse(fs.readFileSync(CONFIG_PATH));
      }
      if (!config.economy) config.economy = { min_bet: 10, max_bet: 10000 };

      if (amount < config.economy.min_bet || amount > config.economy.max_bet) {
        return await interaction.reply({
          content: `❌ Bet amount must be between ${config.economy.min_bet} and ${config.economy.max_bet} coins.`,
          ephemeral: true
        });
      }

      // Check user balance
      let data = { users: {} };
      if (fs.existsSync(DATA_PATH)) {
        data = JSON.parse(fs.readFileSync(DATA_PATH));
      }
      if (!data.users) data.users = {};

      const userData = data.users[interaction.user.id] || { balance: 0, transactions: [] };
      if (userData.balance < amount) {
        return await interaction.reply({
          content: `❌ You don't have enough coins! You have ${userData.balance} coins but tried to bet ${amount}.`,
          ephemeral: true
        });
      }

      await interaction.reply('🪙 Flipping the coin...');

      // Simulate coin flip animation
      const flips = ['Heads', 'Tails'];
      let lastFlip = '';
      for (let i = 0; i < 3; i++) {
        lastFlip = flips[Math.floor(Math.random() * 2)];
        await new Promise(resolve => setTimeout(resolve, 800));
        await interaction.editReply(`🪙 ${lastFlip}...`);
      }

      // Final flip and result
      const result = Math.random() < 0.5 ? 'heads' : 'tails';
      const won = choice === result;
      const coinChange = won ? amount : -amount;
      
      // Update balance
      userData.balance = Math.max(0, userData.balance + coinChange);
      userData.transactions = userData.transactions || [];
      userData.transactions.push({
        type: 'coinflip',
        amount: amount,
        choice: choice,
        result: result,
        win: won,
        coin_change: coinChange,
        timestamp: new Date().toISOString()
      });

      data.users[interaction.user.id] = userData;
      fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));

      // Create result message
      const resultEmoji = result === 'heads' ? '🪙' : '🎯';
      const outcomeEmoji = won ? '🎉' : '💸';
      
      const resultMessage = `${resultEmoji} Coin landed on **${result.toUpperCase()}**!\n` +
        `${outcomeEmoji} You ${won ? 'won' : 'lost'} **${Math.abs(coinChange)}** coins!\n` +
        `💰 Your new balance: **${userData.balance}** coins`;

      // Send result to user
      await interaction.editReply({
        content: resultMessage,
        ephemeral: true
      });

      // Log game result to game log channel
      if (GAME_LOG_CHANNEL) {
        const logChannel = interaction.guild.channels.cache.get(GAME_LOG_CHANNEL);
        if (logChannel) {
          const logMessage = `🪙 ${interaction.user} flipped **${result.toUpperCase()}** and ${won ? 'won' : 'lost'} **${Math.abs(coinChange)}** coins!\n` +
            `Bet: ${amount} | Choice: ${choice}`;
          await logChannel.send({ content: logMessage });
        }
      }

    } catch (error) {
      console.error('Error in coinflip command:', error);
      
      const errorMessage = '❌ An error occurred while processing your coinflip. Please try again later.';
      
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ 
          content: errorMessage, 
          ephemeral: true 
        });
      } else {
        await interaction.reply({ 
          content: errorMessage, 
          ephemeral: true 
        });
      }
    }
  }
};