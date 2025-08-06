const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '../data/economy.json');
const CONFIG_PATH = path.join(__dirname, '../data/config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addcoins')
    .setDescription('Add coins to a user\'s balance')
    .addUserOption(option =>
      option.setName('user').setDescription('User to add coins to').setRequired(true))
    .addIntegerOption(option =>
      option.setName('amount').setDescription('Amount of coins to add').setRequired(true))
    .addStringOption(option =>
      option.setName('reason').setDescription('Reason for adding coins').setRequired(true)),
  async execute(interaction) {
    if (!interaction.member.permissions.has('Administrator')) {
      return interaction.reply({ content: 'You need Economy Admin permission to use this command.', ephemeral: true });
    }

    const user = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');
    const reason = interaction.options.getString('reason');

    if (amount <= 0) {
      return interaction.reply({ content: 'Amount must be positive.', ephemeral: true });
    }

    let config = { economy: { max_balance: 1000000 } };
    if (fs.existsSync(CONFIG_PATH)) {
      config = JSON.parse(fs.readFileSync(CONFIG_PATH));
    }
    if (!config.economy) config.economy = { max_balance: 1000000 };

    let data = { users: {} };
    if (fs.existsSync(DATA_PATH)) {
      data = JSON.parse(fs.readFileSync(DATA_PATH));
    }
    if (!data.users) data.users = {};

    const userData = data.users[user.id] || { balance: 0, transactions: [] };
    const newBalance = Math.min((userData.balance || 0) + amount, config.economy.max_balance);
    const actualAmount = newBalance - (userData.balance || 0);

    userData.balance = newBalance;
    userData.transactions = userData.transactions || [];
    userData.transactions.push({
      type: 'add',
      amount: actualAmount,
      reason,
      moderator_id: interaction.user.id,
      timestamp: new Date().toISOString()
    });

    data.users[user.id] = userData;
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));

    await interaction.reply({ 
      content: `Added ${actualAmount} coins to ${user.tag}'s balance. New balance: ${newBalance}`,
      ephemeral: true 
    });

    try {
      await user.send({
        embeds: [{
          title: '💰 Coins Added',
          description: `${actualAmount} coins have been added to your balance`,
          fields: [
            { name: 'New Balance', value: newBalance.toString() },
            { name: 'Reason', value: reason },
            { name: 'Admin', value: interaction.user.tag }
          ],
          color: 0x00ff00,
          timestamp: new Date()
        }]
      });
    } catch (error) {
      console.error('Failed to send DM to user:', error);
    }
  }
};