const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '../data/economy.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Check your coin balance or another user\'s balance')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to check balance for (optional)')
        .setRequired(false)),
  
  async execute(interaction) {
    try {
      const targetUser = interaction.options.getUser('user') || interaction.user;
      
      let data = { users: {} };
      if (fs.existsSync(DATA_PATH)) {
        data = JSON.parse(fs.readFileSync(DATA_PATH));
      }

      const userData = data.users[targetUser.id] || { balance: 0, transactions: [] };
      const recentTransactions = userData.transactions?.slice(-3) || [];

      // Calculate statistics
      const totalWins = recentTransactions.filter(t => t.type === 'dice' && t.coin_change > 0).length;
      const totalLosses = recentTransactions.filter(t => t.type === 'dice' && t.coin_change < 0).length;
      
      let responseMessage = `💰 **Balance for ${targetUser}**: ${userData.balance} coins\n\n`;
      
      if (recentTransactions.length > 0) {
        responseMessage += '**Recent Activity**:\n';
        recentTransactions.reverse().forEach(t => {
          const time = new Date(t.timestamp).toLocaleTimeString();
          if (t.type === 'dice') {
            responseMessage += `🎲 ${time}: ${t.coin_change > 0 ? 'Won' : 'Lost'} ${Math.abs(t.coin_change)} coins\n`;
          } else if (t.type === 'daily') {
            responseMessage += `📅 ${time}: Daily reward +${t.amount} coins\n`;
          } else if (t.type === 'transfer_in') {
            responseMessage += `⬇️ ${time}: Received ${t.amount} coins\n`;
          } else if (t.type === 'transfer_out') {
            responseMessage += `⬆️ ${time}: Sent ${Math.abs(t.amount)} coins\n`;
          }
        });

        if (totalWins > 0 || totalLosses > 0) {
          responseMessage += `\n📊 Recent Gambling: ${totalWins}W - ${totalLosses}L`;
        }
      }

      await interaction.reply({
        content: responseMessage,
        ephemeral: true
      });

    } catch (error) {
      console.error('Error in balance command:', error);
      await interaction.reply({
        content: '❌ An error occurred while checking the balance.',
        ephemeral: true
      });
    }
  }
};