const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '../data/economy.json');
const BACKUP_PATH = path.join(__dirname, '../data/economy.backup.json');

/**
 * Get user's coin balance
 */
async function getUserCoins(guildId, userId) {
  try {
    if (!fs.existsSync(DATA_PATH)) {
      return 0;
    }
    const data = JSON.parse(fs.readFileSync(DATA_PATH));
    if (!data.users || !data.users[userId]) {
      return 0;
    }
    return data.users[userId].balance || 0;
  } catch (error) {
    console.error('Error getting user coins:', error);
    return 0;
  }
}

/**
 * Update user's coin balance
 */
async function updateUserCoins(guildId, userId, amount) {
  try {
    // Create backup of current data
    if (fs.existsSync(DATA_PATH)) {
      fs.copyFileSync(DATA_PATH, BACKUP_PATH);
    }

    let data = { users: {} };
    if (fs.existsSync(DATA_PATH)) {
      data = JSON.parse(fs.readFileSync(DATA_PATH));
    }
    if (!data.users) data.users = {};
    
    if (!data.users[userId]) {
      data.users[userId] = { balance: 0, transactions: [] };
    }

    const previousBalance = data.users[userId].balance || 0;
    const newBalance = Math.max(0, previousBalance + amount);
    
    data.users[userId].balance = newBalance;
    data.users[userId].transactions = data.users[userId].transactions || [];
    data.users[userId].transactions.push({
      type: 'update',
      amount: amount,
      previous_balance: previousBalance,
      new_balance: newBalance,
      timestamp: new Date().toISOString()
    });

    // Atomic write
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
    
    // Remove backup after successful write
    if (fs.existsSync(BACKUP_PATH)) {
      fs.unlinkSync(BACKUP_PATH);
    }

    return newBalance;
  } catch (error) {
    console.error('Error updating user coins:', error);
    throw error;
  }
}

/**
 * Set user's coin balance to a specific amount
 */
async function setUserCoins(guildId, userId, amount) {
  try {
    // Create backup of current data
    if (fs.existsSync(DATA_PATH)) {
      fs.copyFileSync(DATA_PATH, BACKUP_PATH);
    }

    let data = { users: {} };
    if (fs.existsSync(DATA_PATH)) {
      data = JSON.parse(fs.readFileSync(DATA_PATH));
    }
    if (!data.users) data.users = {};
    
    const newBalance = Math.max(0, amount);
    const previousBalance = data.users[userId]?.balance || 0;
    
    data.users[userId] = data.users[userId] || { balance: 0, transactions: [] };
    data.users[userId].balance = newBalance;
    data.users[userId].transactions = data.users[userId].transactions || [];
    data.users[userId].transactions.push({
      type: 'set',
      previous_balance: previousBalance,
      new_balance: newBalance,
      timestamp: new Date().toISOString()
    });

    // Atomic write
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
    
    // Remove backup after successful write
    if (fs.existsSync(BACKUP_PATH)) {
      fs.unlinkSync(BACKUP_PATH);
    }

    return newBalance;
  } catch (error) {
    console.error('Error setting user coins:', error);
    throw error;
  }
}

/**
 * Transfer coins between users
 */
async function transferCoins(guildId, fromUserId, toUserId, amount) {
  try {
    if (amount <= 0) {
      throw new Error('Transfer amount must be positive');
    }

    // Create backup of current data
    if (fs.existsSync(DATA_PATH)) {
      fs.copyFileSync(DATA_PATH, BACKUP_PATH);
    }

    let data = { users: {} };
    if (fs.existsSync(DATA_PATH)) {
      data = JSON.parse(fs.readFileSync(DATA_PATH));
    }
    if (!data.users) data.users = {};

    // Initialize users if they don't exist
    if (!data.users[fromUserId]) {
      data.users[fromUserId] = { balance: 0, transactions: [] };
    }
    if (!data.users[toUserId]) {
      data.users[toUserId] = { balance: 0, transactions: [] };
    }

    const senderBalance = data.users[fromUserId].balance || 0;
    if (senderBalance < amount) {
      return {
        success: false,
        error: 'Insufficient funds',
        fromBalance: senderBalance,
        toBalance: data.users[toUserId].balance || 0
      };
    }

    // Update balances
    data.users[fromUserId].balance = senderBalance - amount;
    data.users[toUserId].balance = (data.users[toUserId].balance || 0) + amount;

    // Record transactions
    const timestamp = new Date().toISOString();
    data.users[fromUserId].transactions.push({
      type: 'transfer_out',
      amount: -amount,
      to_user: toUserId,
      timestamp
    });
    data.users[toUserId].transactions.push({
      type: 'transfer_in',
      amount: amount,
      from_user: fromUserId,
      timestamp
    });

    // Atomic write
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
    
    // Remove backup after successful write
    if (fs.existsSync(BACKUP_PATH)) {
      fs.unlinkSync(BACKUP_PATH);
    }

    return {
      success: true,
      fromBalance: data.users[fromUserId].balance,
      toBalance: data.users[toUserId].balance
    };
  } catch (error) {
    console.error('Error in transfer:', error);
    throw error;
  }
}

/**
 * Get top users by coin balance
 */
async function getTopUsers(guildId, limit = 10) {
  try {
    if (!fs.existsSync(DATA_PATH)) {
      return [];
    }

    const data = JSON.parse(fs.readFileSync(DATA_PATH));
    if (!data.users) {
      return [];
    }

    return Object.entries(data.users)
      .map(([userId, userData]) => ({
        user_id: userId,
        balance: userData.balance || 0
      }))
      .sort((a, b) => b.balance - a.balance)
      .slice(0, limit);
  } catch (error) {
    console.error('Error getting top users:', error);
    return [];
  }
}

/**
 * Check if user can afford an item
 */
async function canAffordItem(guildId, userId, cost) {
  try {
    const currentBalance = await getUserCoins(guildId, userId);
    const canAfford = currentBalance >= cost;
    
    return {
      canAfford,
      currentBalance,
      needed: canAfford ? 0 : cost - currentBalance
    };
  } catch (error) {
    console.error('Error checking affordability:', error);
    return {
      canAfford: false,
      currentBalance: 0,
      needed: cost
    };
  }
}

/**
 * Claim daily coins with 4 AM WAT reset
 */
async function claimDailyCoins(guildId, userId, dailyAmount = 500) {
  try {
    // Create backup of current data
    if (fs.existsSync(DATA_PATH)) {
      fs.copyFileSync(DATA_PATH, BACKUP_PATH);
    }

    let data = { users: {} };
    if (fs.existsSync(DATA_PATH)) {
      data = JSON.parse(fs.readFileSync(DATA_PATH));
    }
    if (!data.users) data.users = {};

    // Initialize user if they don't exist
    if (!data.users[userId]) {
      data.users[userId] = { balance: 0, transactions: [], last_daily: null };
    }

    const currentTime = new Date();
    const watTime = new Date(currentTime.getTime() + (1 * 60 * 60 * 1000)); // Add 1 hour for WAT
    const resetTime = new Date(watTime);
    resetTime.setHours(4, 0, 0, 0);
    
    if (watTime.getHours() < 4) {
      resetTime.setDate(resetTime.getDate() - 1);
    }

    if (data.users[userId].last_daily) {
      const lastDaily = new Date(data.users[userId].last_daily);
      if (lastDaily > resetTime) {
        return {
          success: false,
          alreadyClaimed: true,
          newBalance: data.users[userId].balance,
          nextResetTime: new Date(resetTime.getTime() + 24 * 60 * 60 * 1000)
        };
      }
    }

    // Update balance and record daily claim
    const previousBalance = data.users[userId].balance;
    data.users[userId].balance = previousBalance + dailyAmount;
    data.users[userId].last_daily = currentTime.toISOString();
    data.users[userId].transactions.push({
      type: 'daily',
      amount: dailyAmount,
      timestamp: currentTime.toISOString()
    });

    // Atomic write
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
    
    // Remove backup after successful write
    if (fs.existsSync(BACKUP_PATH)) {
      fs.unlinkSync(BACKUP_PATH);
    }

    return {
      success: true,
      newBalance: data.users[userId].balance,
      amountClaimed: dailyAmount
    };
  } catch (error) {
    console.error('Error claiming daily coins:', error);
    throw error;
  }
}

module.exports = {
  getUserCoins,
  updateUserCoins,
  setUserCoins,
  transferCoins,
  getTopUsers,
  canAffordItem,
  claimDailyCoins,
  DATA_PATH,
  BACKUP_PATH
};