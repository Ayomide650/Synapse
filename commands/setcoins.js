const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '../data/economy.json');
const CONFIG_PATH = path.join(__dirname, '../data/config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setcoins')
    .setDescription('Set a user\'s coin balance')
    .addUserOption(option =>
      option.setName('user').setDescription('User to set coins for').setRequired(true))
    .addIntegerOption(option =>
      option.setName('amount').setDescription('New balance amount').setRequired(true))
    .addStringOption(option =>
      option.setName('reason').setDescription('Reason for setting balance').setRequired(true)),
  async execute(interaction) {
    if (!interaction.member.permissions.has('Administrator')) {
      return interaction.reply({ content: 'You need Economy Admin permission to use this command.', ephemeral: true });
    }

    const user = interaction.options.getUser('user');
    const newAmount = interaction.options.getInteger('amount');
    const reason = interaction.options.getString('reason');

    if (newAmount < 0) {
      return interaction.reply({ content: 'Balance cannot be negative.', ephemeral: true });
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
    const oldBalance = userData.balance || 0;
    const finalAmount = Math.min(newAmount, config.economy.max_balance);

    userData.balance = finalAmount;
    userData.transactions = userData.transactions || [];
    userData.transactions.push({
      type: 'set',
      old_balance: oldBalance,
      new_balance: finalAmount,
      reason,
      moderator_id: interaction.user.id,
      timestamp: new Date().toISOString()
    });

    data.users[user.id] = userData;
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));

    await interaction.reply({ 
      content: `Set ${user.tag}'s balance to ${finalAmount} coins (was: ${oldBalance})`,
      ephemeral: true 
    });

    try {
      await user.send({
        embeds: [{
          title: '💰 Balance Updated',
          description: `Your coin balance has been set to ${finalAmount}`,
          fields: [
            { name: 'Old Balance', value: oldBalance.toString() },
            { name: 'New Balance', value: finalAmount.toString() },
            { name: 'Reason', value: reason },
            { name: 'Admin', value: interaction.user.tag }
          ],
          color: 0x0099ff,
          timestamp: new Date()
        }]
      });
    } catch (error) {
      console.error('Failed to send DM to user:', error);
    }
  }
};