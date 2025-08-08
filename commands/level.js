const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// Level calculation functions
function calculateLevel(xp) {
  return Math.floor(Math.sqrt(xp / 100));
}

function calculateXpForLevel(level) {
  return level * level * 100;
}

function createProgressBar(current, max, size = 20) {
  const progress = Math.round((current / max) * size);
  const fill = '█'.repeat(progress);
  const empty = '░'.repeat(size - progress);
  return fill + empty;
}

function formatNumber(num) {
  return num.toLocaleString();
}

function getProgressEmoji(percentage) {
  if (percentage >= 75) return '🔥';
  if (percentage >= 50) return '⚡';
  if (percentage >= 25) return '💫';
  return '⭐';
}

function getLevelBadge(level) {
  if (level >= 100) return '👑';
  if (level >= 50) return '💎';
  if (level >= 25) return '🏆';
  if (level >= 10) return '🥇';
  if (level >= 5) return '🥈';
  if (level >= 1) return '🥉';
  return '🆕';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('level')
    .setDescription('Show level and XP progress for yourself or another user')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to check level for (defaults to yourself)')
        .setRequired(false)),

  async execute(interaction, database) {
    try {
      // Ensure database is initialized
      if (!database.isInitialized) {
        await database.initialize();
      }

      const targetUser = interaction.options.getUser('user') || interaction.user;
      const userId = targetUser.id;

      // Get user's leveling data
      let userData = await database.get('leveling/user_levels.json', userId) || {
        xp: 0,
        level: 0,
        total_messages: 0,
        last_xp_gain: null,
        first_message: null
      };

      const currentXP = userData.xp || 0;
      const currentLevel = calculateLevel(currentXP);
      const nextLevelXP = calculateXpForLevel(currentLevel + 1);
      const currentLevelXP = calculateXpForLevel(currentLevel);
      
      const xpNeeded = nextLevelXP - currentXP;
      const levelProgress = currentXP - currentLevelXP;
      const levelTotalXP = nextLevelXP - currentLevelXP;
      const progressPercentage = Math.round((levelProgress / levelTotalXP) * 100);
      
      const progressBar = createProgressBar(levelProgress, levelTotalXP);
      const progressEmoji = getProgressEmoji(progressPercentage);
      const levelBadge = getLevelBadge(currentLevel);

      // Get all users for ranking calculation
      const allUserData = await database.getAllData('leveling/user_levels.json') || {};
      const sortedUsers = Object.entries(allUserData)
        .map(([id, data]) => ({ id, xp: data.xp || 0 }))
        .sort((a, b) => b.xp - a.xp);

      const rank = sortedUsers.findIndex(user => user.id === userId) + 1;
      const totalUsers = sortedUsers.length;

      // Calculate some interesting stats
      const averageXpPerMessage = userData.total_messages > 0 ? 
        Math.round(currentXP / userData.total_messages) : 0;
      
      const timeActive = userData.first_message ? 
        Math.floor((Date.now() - new Date(userData.first_message).getTime()) / (1000 * 60 * 60 * 24)) : 0;

      // Update level if it changed (for display consistency)
      if (userData.level !== currentLevel) {
        userData.level = currentLevel;
        await database.set('leveling/user_levels.json', userId, userData);
      }

      // Create the embed
      const embed = new EmbedBuilder()
        .setTitle(`${levelBadge} ${targetUser.displayName}'s Level Progress`)
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 128 }))
        .setColor(currentLevel >= 50 ? 0xff6b6b : currentLevel >= 25 ? 0x4ecdc4 : currentLevel >= 10 ? 0x45b7d1 : 0x96ceb4)
        .addFields(
          {
            name: '📊 Current Stats',
            value: [
              `**Rank:** #${rank}${totalUsers > 1 ? ` / ${totalUsers}` : ''}`,
              `**Level:** ${currentLevel}`,
              `**Total XP:** ${formatNumber(currentXP)}`
            ].join('\n'),
            inline: true
          },
          {
            name: '🎯 Next Level Progress',
            value: [
              `**Progress:** ${progressPercentage}% ${progressEmoji}`,
              `**${progressBar}**`,
              `${formatNumber(levelProgress)} / ${formatNumber(levelTotalXP)} XP`,
              `**${formatNumber(xpNeeded)} XP needed**`
            ].join('\n'),
            inline: true
          }
        )
        .setTimestamp();

      // Add additional stats if available
      if (userData.total_messages > 0 || timeActive > 0) {
        const additionalStats = [];
        
        if (userData.total_messages > 0) {
          additionalStats.push(`**Messages:** ${formatNumber(userData.total_messages)}`);
          additionalStats.push(`**Avg XP/Message:** ${averageXpPerMessage}`);
        }
        
        if (timeActive > 0) {
          additionalStats.push(`**Days Active:** ${timeActive}`);
          if (timeActive > 0) {
            const avgXpPerDay = Math.round(currentXP / timeActive);
            additionalStats.push(`**Avg XP/Day:** ${formatNumber(avgXpPerDay)}`);
          }
        }

        if (userData.last_xp_gain) {
          const lastGain = new Date(userData.last_xp_gain);
          const timeSinceGain = Math.floor((Date.now() - lastGain.getTime()) / (1000 * 60));
          
          if (timeSinceGain < 60) {
            additionalStats.push(`**Last XP:** ${timeSinceGain}m ago`);
          } else if (timeSinceGain < 1440) {
            additionalStats.push(`**Last XP:** ${Math.floor(timeSinceGain / 60)}h ago`);
          } else {
            additionalStats.push(`**Last XP:** ${Math.floor(timeSinceGain / 1440)}d ago`);
          }
        }

        if (additionalStats.length > 0) {
          embed.addFields({
            name: '📈 Activity Stats',
            value: additionalStats.join('\n'),
            inline: false
          });
        }
      }

      // Add level milestone information
      const nextMilestone = [1, 5, 10, 25, 50, 100].find(milestone => milestone > currentLevel);
      if (nextMilestone) {
        const milestoneXP = calculateXpForLevel(nextMilestone);
        const xpToMilestone = milestoneXP - currentXP;
        
        embed.addFields({
          name: '🎖️ Next Milestone',
          value: `Level ${nextMilestone}: ${formatNumber(xpToMilestone)} XP away`,
          inline: true
        });
      }

      // Add footer with helpful information
      if (targetUser.id === interaction.user.id) {
        embed.setFooter({ 
          text: 'Keep chatting to gain more XP! • Use /leaderboard to see rankings',
          iconURL: interaction.client.user.displayAvatarURL()
        });
      } else {
        embed.setFooter({ 
          text: `Requested by ${interaction.user.displayName}`,
          iconURL: interaction.user.displayAvatarURL()
        });
      }

      await interaction.reply({ embeds: [embed] });

      // Log for debugging
      console.log(`📊 Level check: ${interaction.user.tag} checked ${targetUser.tag}'s level (Level ${currentLevel}, ${currentXP} XP)`);

    } catch (error) {
      console.error('❌ Error in level command:', error);
      
      await interaction.reply({
        content: '❌ Sorry, there was an error retrieving level information. Please try again later.',
        ephemeral: true
      }).catch(console.error);

      // If interaction already replied, try followUp
      if (interaction.replied) {
        await interaction.followUp({
          content: '❌ An error occurred while loading level data.',
          ephemeral: true
        }).catch(console.error);
      }
    }
  }
};
