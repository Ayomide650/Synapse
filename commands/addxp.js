const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

const XP_LOGS_CHANNEL = process.env.XP_LOGS_CHANNEL;

// Level calculation functions - updated to match your level.js formula
function calculateLevel(xp) {
  return Math.floor(Math.sqrt(xp / 100));
}

function calculateXpForLevel(level) {
  return level * level * 100;
}

// Function to check and assign level roles
async function checkLevelRoles(interaction, database, userId, newLevel, oldLevel) {
  try {
    // Get level roles configuration
    const levelRolesData = await database.get('leveling/level_roles_config.json', 'config') || {};
    const levelRoles = levelRolesData.levelRoles || {};

    if (Object.keys(levelRoles).length === 0) {
      return [];
    }

    const member = await interaction.guild.members.fetch(userId).catch(() => null);
    if (!member) return [];

    let rolesAssigned = [];
    let rolesRemoved = [];

    // Check all levels from oldLevel+1 to newLevel
    for (let level = oldLevel + 1; level <= newLevel; level++) {
      const roleId = levelRoles[level.toString()];
      if (roleId) {
        try {
          const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
          if (role && !member.roles.cache.has(roleId)) {
            await member.roles.add(role);
            rolesAssigned.push({ level, role: role.name, roleId });
            console.log(`✅ Assigned role ${role.name} to ${member.user.tag} for level ${level}`);
          }
        } catch (error) {
          console.log(`❌ Failed to assign role for level ${level}:`, error.message);
        }
      }
    }

    // Optional: Remove roles from previous levels if configured
    const removeOldRoles = levelRolesData.removeOldRoles || false;
    if (removeOldRoles && newLevel > oldLevel) {
      for (let level = 1; level < newLevel; level++) {
        const roleId = levelRoles[level.toString()];
        if (roleId && member.roles.cache.has(roleId)) {
          try {
            const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
            if (role) {
              await member.roles.remove(role);
              rolesRemoved.push({ level, role: role.name });
              console.log(`🔄 Removed old role ${role.name} from ${member.user.tag} (level ${level})`);
            }
          } catch (error) {
            console.log(`❌ Failed to remove old role for level ${level}:`, error.message);
          }
        }
      }
    }

    return { assigned: rolesAssigned, removed: rolesRemoved };
  } catch (error) {
    console.error('❌ Error checking level roles:', error);
    return { assigned: [], removed: [] };
  }
}

// Function to log XP transaction
async function logXpTransaction(database, userId, amount, reason, adminId, oldXp, newXp, oldLevel, newLevel) {
  try {
    // Get current transaction log
    let transactionLog = await database.get('leveling/xp_transactions.json', userId) || {
      transactions: []
    };

    // Add new transaction
    transactionLog.transactions.push({
      type: 'admin_add',
      amount: amount,
      reason: reason,
      admin_id: adminId,
      old_xp: oldXp,
      new_xp: newXp,
      old_level: oldLevel,
      new_level: newLevel,
      timestamp: new Date().toISOString()
    });

    // Keep only last 50 transactions to prevent data bloat
    if (transactionLog.transactions.length > 50) {
      transactionLog.transactions = transactionLog.transactions.slice(-50);
    }

    await database.set('leveling/xp_transactions.json', userId, transactionLog);
  } catch (error) {
    console.error('❌ Error logging XP transaction:', error);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addxp')
    .setDescription('Add XP to a user (Administrator only)')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to add XP to')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('Amount of XP to add (1-10000)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(10000))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for adding XP')
        .setRequired(true)
        .setMaxLength(200))
    .addBooleanOption(option =>
      option.setName('silent')
        .setDescription('Whether to add XP silently (no public announcement)')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, database) {
    try {
      // Check permissions
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ 
          content: '❌ You need Administrator permissions to use this command.', 
          ephemeral: true 
        });
      }

      // Ensure database is initialized
      if (!database.isInitialized) {
        await database.initialize();
      }

      const targetUser = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');
      const reason = interaction.options.getString('reason');
      const silent = interaction.options.getBoolean('silent') ?? false;

      // Prevent adding XP to bots
      if (targetUser.bot) {
        return interaction.reply({ 
          content: '❌ Cannot add XP to bots.', 
          ephemeral: true 
        });
      }

      // Prevent self-XP addition (optional security measure)
      if (targetUser.id === interaction.user.id && !interaction.user.id === interaction.guild.ownerId) {
        return interaction.reply({ 
          content: '❌ You cannot add XP to yourself.', 
          ephemeral: true 
        });
      }

      // Get current user data
      let userData = await database.get('leveling/user_levels.json', targetUser.id) || {
        xp: 0,
        level: 0,
        total_messages: 0,
        last_xp_gain: null,
        first_message: null
      };

      const oldXP = userData.xp || 0;
      const oldLevel = calculateLevel(oldXP);
      const newXP = oldXP + amount;
      const newLevel = calculateLevel(newXP);

      // Update user data
      userData.xp = newXP;
      userData.level = newLevel;
      userData.last_xp_gain = new Date().toISOString();
      
      // Set first message time if not exists
      if (!userData.first_message) {
        userData.first_message = new Date().toISOString();
      }

      // Update estimated message count (for compatibility)
      userData.total_messages = Math.max(userData.total_messages || 0, Math.ceil(newXP / 20));

      // Save updated data
      await database.set('leveling/user_levels.json', targetUser.id, userData);

      // Log the transaction
      await logXpTransaction(database, targetUser.id, amount, reason, interaction.user.id, 
                           oldXP, newXP, oldLevel, newLevel);

      // Create response embed
      const embed = new EmbedBuilder()
        .setTitle('✅ XP Added Successfully')
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: '👤 User', value: `${targetUser.tag}`, inline: true },
          { name: '⚡ XP Added', value: `+${amount.toLocaleString()}`, inline: true },
          { name: '📊 New Total', value: `${newXP.toLocaleString()} XP`, inline: true },
          { name: '🎯 Level', value: `${oldLevel} → ${newLevel}`, inline: true },
          { name: '📝 Reason', value: reason, inline: false }
        )
        .setColor(newLevel > oldLevel ? 0x00ff00 : 0x3498db)
        .setFooter({ 
          text: `Added by ${interaction.user.displayName}`,
          iconURL: interaction.user.displayAvatarURL()
        })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });

      // Handle level up
      if (newLevel > oldLevel) {
        const levelDifference = newLevel - oldLevel;
        
        // Check for role rewards
        const roleResults = await checkLevelRoles(interaction, database, targetUser.id, newLevel, oldLevel);
        
        // Create level up announcement
        if (!silent) {
          const levelUpEmbed = new EmbedBuilder()
            .setTitle('🎉 Level Up!')
            .setDescription(`${targetUser} has reached **Level ${newLevel}**!`)
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
            .setColor(0xffd700)
            .addFields(
              { name: '📈 Progress', value: `Level ${oldLevel} → ${newLevel}`, inline: true },
              { name: '⚡ Total XP', value: `${newXP.toLocaleString()}`, inline: true }
            )
            .setTimestamp();

          // Add multiple level notification if applicable
          if (levelDifference > 1) {
            levelUpEmbed.setDescription(`${targetUser} has jumped **${levelDifference} levels** to **Level ${newLevel}**! 🚀`);
          }

          // Add role rewards information
          if (roleResults.assigned && roleResults.assigned.length > 0) {
            const roleNames = roleResults.assigned.map(r => `**${r.role}** (Level ${r.level})`).join('\n');
            levelUpEmbed.addFields({ 
              name: '🏆 New Role Rewards', 
              value: roleNames, 
              inline: false 
            });
          }

          if (roleResults.removed && roleResults.removed.length > 0) {
            const removedRoleNames = roleResults.removed.map(r => `~~${r.role}~~ (Level ${r.level})`).join('\n');
            levelUpEmbed.addFields({ 
              name: '🔄 Roles Removed', 
              value: removedRoleNames, 
              inline: false 
            });
          }

          await interaction.followUp({ embeds: [levelUpEmbed] });
        }

        // Send role assignment confirmation to admin
        if ((roleResults.assigned && roleResults.assigned.length > 0) || 
            (roleResults.removed && roleResults.removed.length > 0)) {
          let roleMessage = '';
          
          if (roleResults.assigned.length > 0) {
            roleMessage += `**Roles Assigned:** ${roleResults.assigned.map(r => r.role).join(', ')}\n`;
          }
          
          if (roleResults.removed.length > 0) {
            roleMessage += `**Roles Removed:** ${roleResults.removed.map(r => r.role).join(', ')}`;
          }

          await interaction.followUp({ 
            content: `🏆 **Role Updates for ${targetUser.tag}:**\n${roleMessage}`,
            ephemeral: true 
          });
        }
      }

      // Send to XP logs channel
      if (XP_LOGS_CHANNEL) {
        const logsChannel = interaction.guild.channels.cache.get(XP_LOGS_CHANNEL);
        if (logsChannel) {
          const logEmbed = new EmbedBuilder()
            .setTitle('📊 XP Administration Log')
            .setDescription(`${interaction.user.tag} added XP to ${targetUser.tag}`)
            .addFields(
              { name: '⚡ Amount Added', value: `+${amount.toLocaleString()} XP`, inline: true },
              { name: '📊 New Total', value: `${newXP.toLocaleString()} XP`, inline: true },
              { name: '🎯 Level Change', value: `${oldLevel} → ${newLevel}`, inline: true },
              { name: '📝 Reason', value: reason, inline: false }
            )
            .setColor(0x3498db)
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
            .setFooter({ 
              text: `Admin: ${interaction.user.displayName}`,
              iconURL: interaction.user.displayAvatarURL()
            })
            .setTimestamp();

          // Add role information if roles were assigned/removed
          if (newLevel > oldLevel) {
            const roleResults = await checkLevelRoles(interaction, database, targetUser.id, newLevel, oldLevel);
            if ((roleResults.assigned && roleResults.assigned.length > 0) || 
                (roleResults.removed && roleResults.removed.length > 0)) {
              let roleInfo = '';
              
              if (roleResults.assigned.length > 0) {
                roleInfo += `**Added:** ${roleResults.assigned.map(r => `${r.role} (L${r.level})`).join(', ')}\n`;
              }
              
              if (roleResults.removed.length > 0) {
                roleInfo += `**Removed:** ${roleResults.removed.map(r => `${r.role} (L${r.level})`).join(', ')}`;
              }

              logEmbed.addFields({ 
                name: '🏆 Role Changes', 
                value: roleInfo, 
                inline: false 
              });
            }
          }

          await logsChannel.send({ embeds: [logEmbed] }).catch(console.error);
        }
      }

      console.log(`⚡ XP Added: ${interaction.user.tag} gave ${amount} XP to ${targetUser.tag} (${oldLevel} → ${newLevel}). Reason: ${reason}`);

    } catch (error) {
      console.error('❌ Error in addxp command:', error);
      
      await interaction.reply({
        content: '❌ Sorry, there was an error adding XP. Please try again later.',
        ephemeral: true
      }).catch(console.error);

      if (interaction.replied) {
        await interaction.followUp({
          content: '❌ An error occurred while processing the XP addition.',
          ephemeral: true
        }).catch(console.error);
      }
    }
  }
};
