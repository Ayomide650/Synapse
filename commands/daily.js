const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const ms = require('ms');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Claim your daily coin reward'),

  async execute(interaction, database) {
    try {
      // Ensure database is initialized
      if (!database.isInitialized) {
        await database.initialize();
      }

      // Get current configuration
      const config = database.config || { 
        economy: { 
          daily_amount: 100, 
          streak_bonus: 10 
        } 
      };

      if (!config.economy) {
        config.economy = { daily_amount: 100, streak_bonus: 10 };
      }

      const userId = interaction.user.id;
      const now = Date.now();

      // Get user's current economy data
      let userData = await database.get('economy/user_balances.json', userId) || {
        balance: 0,
        transactions: [],
        last_daily: null,
        daily_streak: 0
      };

      // Get user's daily claims data
      let dailyData = await database.get('economy/daily_claims.json', userId) || {
        last_daily: null,
        daily_streak: 0,
        total_claims: 0
      };

      const lastDaily = dailyData.last_daily ? new Date(dailyData.last_daily).getTime() : 0;
      const timeLeft = lastDaily + ms('24h') - now;

      // Check if user can claim daily reward
      if (timeLeft > 0) {
        const timeLeftString = ms(timeLeft, { long: true });
        return interaction.reply({
          content: `⏰ You already claimed your daily reward! Try again in **${timeLeftString}**.`,
          ephemeral: true
        });
      }

      // Calculate streak (within 48h of last claim maintains streak)
      if (lastDaily > 0 && now - lastDaily <= ms('48h')) {
        dailyData.daily_streak += 1;
      } else {
        dailyData.daily_streak = 1;
      }

      // Calculate rewards
      const baseAmount = config.economy.daily_amount;
      const streakBonus = Math.max(0, (dailyData.daily_streak - 1) * config.economy.streak_bonus);
      const totalAmount = baseAmount + streakBonus;

      // Update user balance
      userData.balance = (userData.balance || 0) + totalAmount;
      
      // Update transactions history
      if (!userData.transactions) userData.transactions = [];
      userData.transactions.push({
        type: 'daily',
        amount: totalAmount,
        base_amount: baseAmount,
        streak_bonus: streakBonus,
        streak: dailyData.daily_streak,
        timestamp: new Date().toISOString(),
        description: `Daily reward claim (${dailyData.daily_streak} day streak)`
      });

      // Keep only last 100 transactions to prevent data bloat
      if (userData.transactions.length > 100) {
        userData.transactions = userData.transactions.slice(-100);
      }

      // Update daily claims data
      dailyData.last_daily = new Date().toISOString();
      dailyData.total_claims += 1;

      // Save all data to GitHub database
      await Promise.all([
        database.set('economy/user_balances.json', userId, userData),
        database.set('economy/daily_claims.json', userId, dailyData)
      ]);

      // Create response embed
      const embed = new EmbedBuilder()
        .setTitle('💰 Daily Reward Claimed!')
        .setDescription(`Congratulations! You've claimed your daily coins!`)
        .addFields(
          { 
            name: '🪙 Base Reward', 
            value: `${baseAmount.toLocaleString()} coins`, 
            inline: true 
          },
          { 
            name: '🔥 Streak Bonus', 
            value: `${streakBonus.toLocaleString()} coins`, 
            inline: true 
          },
          { 
            name: '✨ Total Earned', 
            value: `${totalAmount.toLocaleString()} coins`, 
            inline: true 
          },
          { 
            name: '📈 Current Streak', 
            value: `${dailyData.daily_streak} day${dailyData.daily_streak === 1 ? '' : 's'} 🔥`, 
            inline: true 
          },
          { 
            name: '💳 New Balance', 
            value: `${userData.balance.toLocaleString()} coins`, 
            inline: true 
          },
          { 
            name: '📊 Total Claims', 
            value: `${dailyData.total_claims} time${dailyData.total_claims === 1 ? '' : 's'}`, 
            inline: true 
          }
        )
        .setColor(0xffd700)
        .setFooter({ 
          text: `Come back tomorrow to maintain your streak!`,
          iconURL: interaction.user.displayAvatarURL()
        })
        .setTimestamp();

      // Add streak milestone messages
      let streakMessage = '';
      if (dailyData.daily_streak === 7) {
        streakMessage = '🎉 **Week Streak!** Amazing dedication!';
      } else if (dailyData.daily_streak === 30) {
        streakMessage = '👑 **Month Streak!** You\'re a true champion!';
      } else if (dailyData.daily_streak === 100) {
        streakMessage = '🏆 **Century Streak!** Legendary commitment!';
      } else if (dailyData.daily_streak % 10 === 0 && dailyData.daily_streak >= 10) {
        streakMessage = `⭐ **${dailyData.daily_streak} Day Streak!** Keep it up!`;
      }

      if (streakMessage) {
        embed.setDescription(`${embed.data.description}\n\n${streakMessage}`);
      }

      await interaction.reply({ embeds: [embed] });

      // Log the transaction for admin monitoring
      console.log(`💰 Daily claim: ${interaction.user.tag} (${userId}) claimed ${totalAmount} coins (streak: ${dailyData.daily_streak})`);

    } catch (error) {
      console.error('❌ Error in daily command:', error);
      
      await interaction.reply({
        content: '❌ Sorry, there was an error processing your daily reward. Please try again later.',
        ephemeral: true
      }).catch(console.error);
      
      // If interaction already replied, try followUp
      if (interaction.replied) {
        await interaction.followUp({
          content: '❌ An error occurred while saving your daily reward data.',
          ephemeral: true
        }).catch(console.error);
      }
    }
  }
};
