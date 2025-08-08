const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Database = require('../utils/database'); // Adjust path as needed

// Initialize database
const db = require('../database/database');

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
    try {
      // Check permissions
      if (!interaction.member.permissions.has('Administrator')) {
        return interaction.reply({ 
          content: '❌ You need Administrator permission to use this command.', 
          ephemeral: true 
        });
      }

      const user = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');
      const reason = interaction.options.getString('reason');

      // Validate amount
      if (amount <= 0) {
        return interaction.reply({ 
          content: '❌ Amount must be positive.', 
          ephemeral: true 
        });
      }

      // Get config from database or use defaults
      const config = await db.get('config', 'economy') || { max_balance: 1000000 };
      const maxBalance = config.max_balance || 1000000;

      // Get user data from database
      const userData = await db.get('balance', user.id) || { 
        balance: 0, 
        transactions: [],
        createdAt: new Date().toISOString()
      };

      const currentBalance = userData.balance || 0;
      const newBalance = Math.min(currentBalance + amount, maxBalance);
      const actualAmount = newBalance - currentBalance;

      // Check if we hit the max balance limit
      if (actualAmount < amount) {
        await interaction.reply({ 
          content: `⚠️ User would exceed max balance (${maxBalance}). Added ${actualAmount} coins instead of ${amount}.`,
          ephemeral: true 
        });
      }

      // Update user data
      userData.balance = newBalance;
      userData.lastUpdated = new Date().toISOString();
      
      if (!userData.transactions) userData.transactions = [];
      userData.transactions.push({
        type: 'admin_add',
        amount: actualAmount,
        reason: reason,
        moderator_id: interaction.user.id,
        moderator_tag: interaction.user.tag,
        balance_before: currentBalance,
        balance_after: newBalance,
        timestamp: new Date().toISOString()
      });

      // Keep only last 50 transactions to prevent data bloat
      if (userData.transactions.length > 50) {
        userData.transactions = userData.transactions.slice(-50);
      }

      // Save to database
      await db.set('balance', user.id, userData);

      // Log the admin action
      const adminLogData = {
        action: 'add_coins',
        admin_id: interaction.user.id,
        admin_tag: interaction.user.tag,
        target_user_id: user.id,
        target_user_tag: user.tag,
        amount: actualAmount,
        reason: reason,
        old_balance: currentBalance,
        new_balance: newBalance,
        timestamp: new Date().toISOString(),
        guild_id: interaction.guild.id
      };

      await db.set('admin_logs', `addcoins_${Date.now()}_${user.id}`, adminLogData);

      // Reply to admin
      const responseEmbed = new EmbedBuilder()
        .setTitle('💰 Coins Added Successfully')
        .setDescription(`Added **${actualAmount}** coins to ${user.tag}'s balance`)
        .addFields(
          { name: 'Previous Balance', value: currentBalance.toString(), inline: true },
          { name: 'New Balance', value: newBalance.toString(), inline: true },
          { name: 'Amount Added', value: actualAmount.toString(), inline: true },
          { name: 'Reason', value: reason, inline: false },
          { name: 'Admin', value: interaction.user.tag, inline: true }
        )
        .setColor('#00ff00')
        .setTimestamp();

      await interaction.reply({ 
        embeds: [responseEmbed],
        ephemeral: true 
      });

      // Try to send DM to user
      try {
        const userEmbed = new EmbedBuilder()
          .setTitle('💰 Coins Added to Your Account')
          .setDescription(`**${actualAmount}** coins have been added to your balance!`)
          .addFields(
            { name: 'New Balance', value: newBalance.toString(), inline: true },
            { name: 'Amount Added', value: actualAmount.toString(), inline: true },
            { name: 'Reason', value: reason, inline: false },
            { name: 'Admin', value: interaction.user.tag, inline: true },
            { name: 'Server', value: interaction.guild.name, inline: true }
          )
          .setColor('#00ff00')
          .setTimestamp();

        await user.send({ embeds: [userEmbed] });
        console.log(`✅ DM sent to ${user.tag} about coin addition`);
      } catch (error) {
        console.log(`⚠️ Failed to send DM to ${user.tag}:`, error.message);
        // Send follow-up to admin about DM failure
        await interaction.followUp({ 
          content: `⚠️ Coins added successfully, but couldn't send DM to ${user.tag} (they may have DMs disabled).`,
          ephemeral: true 
        });
      }

      console.log(`Admin ${interaction.user.tag} added ${actualAmount} coins to ${user.tag}. New balance: ${newBalance}`);

    } catch (error) {
      console.error('Error in addcoins command:', error);
      await interaction.reply({
        content: '❌ An error occurred while adding coins. Please try again.',
        ephemeral: true
      });
    }
  }
};
