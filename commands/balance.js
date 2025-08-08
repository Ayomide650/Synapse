const { SlashCommandBuilder } = require('discord.js');
const Database = require('../utils/database'); // Adjust path as needed

// Initialize database
const db = require('../utils/database');

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
      
      // Get user data from database
      const userData = await db.get('balance', targetUser.id) || { 
        balance: 0, 
        transactions: [],
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      };
      
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
          } else if (t.type === 'coinflip') {
            responseMessage += `🪙 ${time}: ${t.coin_change > 0 ? 'Won' : 'Lost'} ${Math.abs(t.coin_change)} coins (Coinflip)\n`;
          } else if (t.type === 'admin_add') {
            responseMessage += `➕ ${time}: Admin added ${t.amount} coins\n`;
          } else if (t.type === 'admin_remove') {
            responseMessage += `➖ ${time}: Admin removed ${Math.abs(t.amount)} coins\n`;
          } else if (t.type === 'admin_set') {
            responseMessage += `⚙️ ${time}: Balance set to ${t.amount} coins\n`;
          }
        });
        
        if (totalWins > 0 || totalLosses > 0) {
          responseMessage += `\n📊 Recent Gambling: ${totalWins}W - ${totalLosses}L`;
        }
      } else {
        responseMessage += '💭 No recent activity found.';
      }
      
      // Add account info for self-check
      if (targetUser.id === interaction.user.id && userData.createdAt) {
        const accountAge = Math.floor((new Date() - new Date(userData.createdAt)) / (1000 * 60 * 60 * 24));
        if (accountAge > 0) {
          responseMessage += `\n\n📅 Account created: ${accountAge} days ago`;
        }
      }
      
      await interaction.reply({
        content: responseMessage,
        ephemeral: true
      });
      
      console.log(`Balance checked for user ${targetUser.id} (${targetUser.username}): ${userData.balance} coins`);
      
    } catch (error) {
      console.error('Error in balance command:', error);
      await interaction.reply({
        content: '❌ An error occurred while checking the balance. Please try again.',
        ephemeral: true
      });
    }
  },

  // Helper function for other commands to get user balance
  async getUserBalance(userId) {
    try {
      const userData = await db.get('balance', userId);
      return userData ? userData.balance : 0;
    } catch (error) {
      console.error('Error getting user balance:', error);
      return 0;
    }
  },

  // Helper function for other commands to update user balance
  async updateUserBalance(userId, newBalance, transaction = null) {
    try {
      const userData = await db.get('balance', userId) || { 
        balance: 0, 
        transactions: [],
        createdAt: new Date().toISOString()
      };
      
      userData.balance = newBalance;
      userData.lastUpdated = new Date().toISOString();
      
      // Add transaction if provided
      if (transaction) {
        if (!userData.transactions) userData.transactions = [];
        userData.transactions.push({
          ...transaction,
          timestamp: new Date().toISOString()
        });
        
        // Keep only last 50 transactions to prevent data bloat
        if (userData.transactions.length > 50) {
          userData.transactions = userData.transactions.slice(-50);
        }
      }
      
      await db.set('balance', userId, userData);
      console.log(`Updated balance for user ${userId}: ${newBalance} coins`);
      return true;
    } catch (error) {
      console.error('Error updating user balance:', error);
      return false;
    }
  },

  // Helper function to add coins (for admin commands)
  async addCoins(userId, amount, reason = 'admin_add') {
    try {
      const userData = await db.get('balance', userId) || { 
        balance: 0, 
        transactions: [],
        createdAt: new Date().toISOString()
      };
      
      const newBalance = userData.balance + amount;
      const transaction = {
        type: reason,
        amount: amount,
        balance_before: userData.balance,
        balance_after: newBalance
      };
      
      return await this.updateUserBalance(userId, newBalance, transaction);
    } catch (error) {
      console.error('Error adding coins:', error);
      return false;
    }
  },

  // Helper function to remove coins (for admin commands)
  async removeCoins(userId, amount, reason = 'admin_remove') {
    try {
      const userData = await db.get('balance', userId) || { 
        balance: 0, 
        transactions: [],
        createdAt: new Date().toISOString()
      };
      
      const newBalance = Math.max(0, userData.balance - amount);
      const transaction = {
        type: reason,
        amount: -amount,
        balance_before: userData.balance,
        balance_after: newBalance
      };
      
      return await this.updateUserBalance(userId, newBalance, transaction);
    } catch (error) {
      console.error('Error removing coins:', error);
      return false;
    }
  },

  // Helper function to set coins (for admin commands)
  async setCoins(userId, amount, reason = 'admin_set') {
    try {
      const userData = await db.get('balance', userId) || { 
        balance: 0, 
        transactions: [],
        createdAt: new Date().toISOString()
      };
      
      const transaction = {
        type: reason,
        amount: amount,
        balance_before: userData.balance,
        balance_after: amount
      };
      
      return await this.updateUserBalance(userId, amount, transaction);
    } catch (error) {
      console.error('Error setting coins:', error);
      return false;
    }
  },

  // Helper function to transfer coins between users
  async transferCoins(fromUserId, toUserId, amount) {
    try {
      const fromUserData = await db.get('balance', fromUserId) || { 
        balance: 0, 
        transactions: [],
        createdAt: new Date().toISOString()
      };
      
      if (fromUserData.balance < amount) {
        return { success: false, error: 'Insufficient balance' };
      }
      
      const toUserData = await db.get('balance', toUserId) || { 
        balance: 0, 
        transactions: [],
        createdAt: new Date().toISOString()
      };
      
      // Create transactions
      const outTransaction = {
        type: 'transfer_out',
        amount: -amount,
        balance_before: fromUserData.balance,
        balance_after: fromUserData.balance - amount,
        target_user: toUserId
      };
      
      const inTransaction = {
        type: 'transfer_in',
        amount: amount,
        balance_before: toUserData.balance,
        balance_after: toUserData.balance + amount,
        source_user: fromUserId
      };
      
      // Update both balances
      const fromSuccess = await this.updateUserBalance(fromUserId, fromUserData.balance - amount, outTransaction);
      const toSuccess = await this.updateUserBalance(toUserId, toUserData.balance + amount, inTransaction);
      
      if (fromSuccess && toSuccess) {
        return { success: true };
      } else {
        return { success: false, error: 'Database update failed' };
      }
    } catch (error) {
      console.error('Error transferring coins:', error);
      return { success: false, error: 'Transfer failed' };
    }
  }
};
