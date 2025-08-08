const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');

const USERS_PER_PAGE = 10;

// Level calculation function - updated to match your level.js formula
function calculateLevel(xp) {
  return Math.floor(Math.sqrt(xp / 100));
}

function calculateXpForLevel(level) {
  return level * level * 100;
}

function formatNumber(num) {
  return num.toLocaleString();
}

function getRankEmoji(rank) {
  switch (rank) {
    case 1: return '🥇';  // Gold
    case 2: return '🥈';  // Silver
    case 3: return '🥉';  // Bronze
    case 4: case 5: return '🏅'; // Top 5
    default: return rank <= 10 ? '⭐' : '📊'; // Top 10 or regular
  }
}

function getProgressBar(current, max, size = 10) {
  const progress = Math.round((current / max) * size);
  const fill = '█'.repeat(progress);
  const empty = '░'.repeat(size - progress);
  return fill + empty;
}

async function createLeaderboardEmbed(interaction, database, page = 1, sortBy = 'xp') {
  try {
    // Get all user data
    const allUserData = await database.getAllData('leveling/user_levels.json') || {};
    
    // Filter and sort users
    let sortedUsers = Object.entries(allUserData)
      .map(([id, userData]) => {
        const xp = userData.xp || 0;
        const level = calculateLevel(xp);
        const currentLevelXP = calculateXpForLevel(level);
        const nextLevelXP = calculateXpForLevel(level + 1);
        const levelProgress = xp - currentLevelXP;
        const levelTotalXP = nextLevelXP - currentLevelXP;
        
        return {
          id,
          xp,
          level,
          messages: userData.total_messages || 0,
          levelProgress,
          levelTotalXP,
          lastActivity: userData.last_xp_gain || userData.first_message
        };
      })
      .filter(user => user.xp > 0) // Only show users with XP
      .sort((a, b) => {
        switch (sortBy) {
          case 'level':
            return b.level - a.level || b.xp - a.xp; // Sort by level, then XP
          case 'messages':
            return b.messages - a.messages;
          case 'xp':
          default:
            return b.xp - a.xp;
        }
      });

    if (sortedUsers.length === 0) {
      return new EmbedBuilder()
        .setTitle('🏆 Server Leaderboard')
        .setDescription('No users found with XP data. Start chatting to appear on the leaderboard!')
        .setColor(0xffd700)
        .setTimestamp();
    }

    const totalPages = Math.ceil(sortedUsers.length / USERS_PER_PAGE);
    const validPage = Math.max(1, Math.min(page, totalPages));
    const startIndex = (validPage - 1) * USERS_PER_PAGE;
    const pageUsers = sortedUsers.slice(startIndex, startIndex + USERS_PER_PAGE);

    // Find current user's rank
    const currentUserRank = sortedUsers.findIndex(user => user.id === interaction.user.id) + 1;
    const currentUserData = sortedUsers.find(user => user.id === interaction.user.id);

    // Create leaderboard entries
    const description = await Promise.all(pageUsers.map(async (userData, index) => {
      const globalRank = startIndex + index + 1;
      const user = await interaction.client.users.fetch(userData.id).catch(() => null);
      const username = user ? (user.displayName.length > 20 ? user.displayName.substring(0, 17) + '...' : user.displayName) : 'Unknown User';
      const isCurrentUser = userData.id === interaction.user.id;
      const rankEmoji = getRankEmoji(globalRank);
      
      // Create progress bar for level progress
      const progressBar = getProgressBar(userData.levelProgress, userData.levelTotalXP);
      const progressPercent = Math.round((userData.levelProgress / userData.levelTotalXP) * 100);
      
      let line = '';
      
      if (sortBy === 'level') {
        line = `${rankEmoji} **#${globalRank}** ${username}\n    ⚡ Level ${userData.level} • ${formatNumber(userData.xp)} XP\n    ${progressBar} ${progressPercent}%`;
      } else if (sortBy === 'messages') {
        line = `${rankEmoji} **#${globalRank}** ${username}\n    💬 ${formatNumber(userData.messages)} messages • Level ${userData.level}\n    ⚡ ${formatNumber(userData.xp)} XP`;
      } else { // xp
        line = `${rankEmoji} **#${globalRank}** ${username}\n    ⚡ ${formatNumber(userData.xp)} XP • Level ${userData.level}\n    ${progressBar} ${progressPercent}%`;
      }
      
      return isCurrentUser ? `**→ ${line}**` : line;
    }));

    // Determine sort title
    let sortTitle = '';
    switch (sortBy) {
      case 'level':
        sortTitle = 'Level Leaderboard';
        break;
      case 'messages':
        sortTitle = 'Message Leaderboard';
        break;
      case 'xp':
      default:
        sortTitle = 'XP Leaderboard';
        break;
    }

    const embed = new EmbedBuilder()
      .setTitle(`🏆 Server ${sortTitle}`)
      .setDescription(description.join('\n\n'))
      .setColor(0xffd700)
      .setTimestamp();

    // Add current user info if not on current page
    if (currentUserData && (validPage === 1 || !pageUsers.some(user => user.id === interaction.user.id))) {
      const userProgressBar = getProgressBar(currentUserData.levelProgress, currentUserData.levelTotalXP);
      const userProgressPercent = Math.round((currentUserData.levelProgress / currentUserData.levelTotalXP) * 100);
      
      embed.addFields({
        name: '👤 Your Stats',
        value: `**Rank:** #${currentUserRank} / ${sortedUsers.length}\n**Level:** ${currentUserData.level}\n**XP:** ${formatNumber(currentUserData.xp)}\n**Progress:** ${userProgressBar} ${userProgressPercent}%`,
        inline: true
      });
    }

    // Add server stats
    const totalXP = sortedUsers.reduce((sum, user) => sum + user.xp, 0);
    const totalMessages = sortedUsers.reduce((sum, user) => sum + user.messages, 0);
    const averageLevel = Math.round(sortedUsers.reduce((sum, user) => sum + user.level, 0) / sortedUsers.length);
    
    embed.addFields({
      name: '📊 Server Stats',
      value: `**Total XP:** ${formatNumber(totalXP)}\n**Total Messages:** ${formatNumber(totalMessages)}\n**Average Level:** ${averageLevel}`,
      inline: true
    });

    embed.setFooter({ 
      text: `Page ${validPage}/${totalPages} • ${sortedUsers.length} active users • Sorted by ${sortBy.toUpperCase()}` 
    });

    return embed;

  } catch (error) {
    console.error('❌ Error creating leaderboard embed:', error);
    return new EmbedBuilder()
      .setTitle('❌ Error')
      .setDescription('Sorry, there was an error loading the leaderboard. Please try again later.')
      .setColor(0xff0000);
  }
}

function createNavigationButtons(currentPage, totalPages, sortBy) {
  const row = new ActionRowBuilder();

  // Previous page button
  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`leaderboard_prev_${currentPage}_${sortBy}`)
      .setLabel('◀️ Previous')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage <= 1)
  );

  // Sort buttons
  const sortButtons = [
    { id: 'xp', label: 'XP', emoji: '⚡' },
    { id: 'level', label: 'Level', emoji: '🎯' },
    { id: 'messages', label: 'Messages', emoji: '💬' }
  ];

  sortButtons.forEach(sort => {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`leaderboard_sort_${sort.id}_${currentPage}`)
        .setLabel(sort.label)
        .setEmoji(sort.emoji)
        .setStyle(sortBy === sort.id ? ButtonStyle.Primary : ButtonStyle.Secondary)
    );
  });

  // Next page button
  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`leaderboard_next_${currentPage}_${sortBy}`)
      .setLabel('Next ▶️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage >= totalPages)
  );

  return row;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Show server XP leaderboard with interactive navigation')
    .addIntegerOption(option =>
      option.setName('page')
        .setDescription('Page number to display')
        .setMinValue(1)
        .setMaxValue(100))
    .addStringOption(option =>
      option.setName('sort')
        .setDescription('Sort leaderboard by')
        .addChoices(
          { name: '⚡ XP (Total Experience)', value: 'xp' },
          { name: '🎯 Level', value: 'level' },
          { name: '💬 Messages', value: 'messages' }
        )),

  async execute(interaction, database) {
    try {
      // Ensure database is initialized
      if (!database.isInitialized) {
        await database.initialize();
      }

      const page = interaction.options.getInteger('page') || 1;
      const sortBy = interaction.options.getString('sort') || 'xp';

      await interaction.deferReply();

      const embed = await createLeaderboardEmbed(interaction, database, page, sortBy);
      
      // Get total pages for navigation
      const allUserData = await database.getAllData('leveling/user_levels.json') || {};
      const activeUsers = Object.values(allUserData).filter(user => (user.xp || 0) > 0).length;
      const totalPages = Math.ceil(activeUsers / USERS_PER_PAGE);

      const components = totalPages > 1 || true ? [createNavigationButtons(page, totalPages, sortBy)] : [];

      await interaction.editReply({ 
        embeds: [embed], 
        components 
      });

      // Set up button interaction collector
      const filter = i => i.user.id === interaction.user.id && i.customId.startsWith('leaderboard_');
      const collector = interaction.channel.createMessageComponentCollector({ 
        filter, 
        time: 300000 // 5 minutes
      });

      collector.on('collect', async i => {
        try {
          const [, action, value, currentValue] = i.customId.split('_');
          let newPage = page;
          let newSort = sortBy;

          switch (action) {
            case 'prev':
              newPage = Math.max(1, parseInt(value) - 1);
              newSort = currentValue;
              break;
            case 'next':
              newPage = parseInt(value) + 1;
              newSort = currentValue;
              break;
            case 'sort':
              newSort = value;
              newPage = parseInt(currentValue);
              break;
          }

          await i.deferUpdate();

          const newEmbed = await createLeaderboardEmbed(interaction, database, newPage, newSort);
          const newComponents = [createNavigationButtons(newPage, totalPages, newSort)];

          await i.editReply({ 
            embeds: [newEmbed], 
            components: newComponents 
          });

        } catch (error) {
          console.error('❌ Error handling leaderboard button:', error);
          await i.reply({ 
            content: '❌ An error occurred while updating the leaderboard.', 
            ephemeral: true 
          }).catch(console.error);
        }
      });

      collector.on('end', async () => {
        try {
          // Disable all buttons when collector expires
          const disabledRow = new ActionRowBuilder();
          const buttons = createNavigationButtons(page, totalPages, sortBy).components;
          
          buttons.forEach(button => {
            disabledRow.addComponents(
              ButtonBuilder.from(button).setDisabled(true)
            );
          });

          await interaction.editReply({ 
            components: [disabledRow] 
          }).catch(() => {}); // Ignore errors if message was deleted
        } catch (error) {
          // Silently handle cleanup errors
        }
      });

      console.log(`📊 Leaderboard viewed: ${interaction.user.tag} (page ${page}, sorted by ${sortBy})`);

    } catch (error) {
      console.error('❌ Error in leaderboard command:', error);
      
      const errorMessage = '❌ Sorry, there was an error loading the leaderboard. Please try again later.';
      
      if (interaction.deferred) {
        await interaction.editReply({ content: errorMessage }).catch(console.error);
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true }).catch(console.error);
      }
    }
  }
};
