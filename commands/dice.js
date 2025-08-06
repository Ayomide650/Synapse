const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '../data/economy.json');
const CONFIG_PATH = path.join(__dirname, '../data/config.json');
const GAME_LOG_CHANNEL = process.env.GAME_LOG_CHANNEL;
const DICE_EMOJIS = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dice')
    .setDescription('Play dice with multipliers')
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('Amount to bet (minimum 1)')
        .setRequired(true)
        .setMinValue(1))
    .addIntegerOption(option =>
      option.setName('number1')
        .setDescription('First number (1-6)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(6))
    .addIntegerOption(option =>
      option.setName('number2')
        .setDescription('Second number (1-6)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(6))
    .addStringOption(option =>
      option.setName('multipliers')
        .setDescription('Choose multiplier combination')
        .setRequired(true)
        .addChoices(
          { name: '3x and 2x (Higher risk, higher reward)', value: '3_2' },
          { name: '4x and 1x (Extreme risk, extreme reward)', value: '4_1' }
        )),
  async execute(interaction) {
    try {
      // Get user inputs
      const amount = interaction.options.getInteger('amount');
      const number1 = interaction.options.getInteger('number1');
      const number2 = interaction.options.getInteger('number2');
      const multiplierChoice = interaction.options.getString('multipliers');

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

      if (number1 === number2) {
        return await interaction.reply({
          content: '❌ You must choose two different numbers!',
          ephemeral: true
        });
      }

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

      await interaction.reply('🎲 Rolling the dice...');

      // Simulate dice roll animation
      for (let i = 0; i < 3; i++) {
        const randomIndex = Math.floor(Math.random() * 6) + 1;
        await new Promise(resolve => setTimeout(resolve, 800));
        await interaction.editReply(`🎲 Rolling... ${DICE_EMOJIS[randomIndex]}`);
      }

      // Roll the dice and determine outcome
      const diceRoll = Math.floor(Math.random() * 6) + 1;
      let multiplier = 0;
      let matchedNumber = null;

      if (diceRoll === number1) {
        multiplier = multiplierChoice === '3_2' ? 3 : 4;
        matchedNumber = number1;
      } else if (diceRoll === number2) {
        multiplier = multiplierChoice === '3_2' ? 2 : 1;
        matchedNumber = number2;
      }

      const won = multiplier > 0;
      const coinChange = won ? (amount * multiplier) - amount : -amount;

      // Update user's balance
      userData.balance = Math.max(0, userData.balance + coinChange);
      userData.transactions = userData.transactions || [];
      userData.transactions.push({
        type: 'dice',
        amount: amount,
        number1,
        number2,
        multiplier_choice: multiplierChoice,
        roll: diceRoll,
        multiplier: multiplier,
        win: won,
        coin_change: coinChange,
        timestamp: new Date().toISOString()
      });

      data.users[interaction.user.id] = userData;
      fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));

      // Create result message
      const outcomeEmoji = won ? '🎉' : '💸';
      let resultMessage = `🎲 **Dice Result**: ${DICE_EMOJIS[diceRoll]} **${diceRoll}**\n\n`;
      
      if (won) {
        resultMessage += `${outcomeEmoji} **WINNER!** You matched number **${matchedNumber}** with **${multiplier}x** multiplier!\n`;
        resultMessage += `💰 You won **${Math.abs(coinChange)}** coins!\n`;
      } else {
        resultMessage += `${outcomeEmoji} **No match!** The dice didn't land on ${number1} or ${number2}.\n`;
        resultMessage += `💸 You lost **${Math.abs(coinChange)}** coins.\n`;
      }
      
      resultMessage += `🏦 Your new balance: **${userData.balance}** coins`;

      // Reply to user
      await interaction.editReply({
        content: resultMessage,
        ephemeral: true
      });

      // Log game result to game log channel
      // Log game result to game log channel
      if (GAME_LOG_CHANNEL && interaction.guild) {
        const logChannel = await interaction.guild.channels.fetch(GAME_LOG_CHANNEL);
        if (logChannel) {
          const logMessage = `🎲 ${interaction.user} rolled a **${diceRoll}** (${DICE_EMOJIS[diceRoll]}) and ${won ? 'won' : 'lost'} **${Math.abs(coinChange)}** coins!\n` +
            `Numbers: ${number1}, ${number2} | Multiplier: ${multiplierChoice === '3_2' ? '3x/2x' : '4x/1x'}`;
          await logChannel.send({ content: logMessage });
        }
      }

    } catch (error) {
      console.error('Error in dice command:', error);
      
      const errorMessage = '❌ An error occurred while processing your dice roll. Please try again later.';
      
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