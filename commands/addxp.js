const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const database = require('../utils/database'); // Import your database utility

const DATA_PATH = path.join(__dirname, '../data/levels.json');
const XP_LOGS_CHANNEL = process.env.XP_LOGS_CHANNEL;

function calculateLevel(messages) {
  return Math.floor(Math.sqrt(messages / 5));
}

// Function to check and assign level roles
async function checkLevelRoles(interaction, userId, newLevel, oldLevel) {
  try {
    const levelingData = await database.read('leveling.json');
    if (!levelingData?.levelRoles) return [];

    const member = await interaction.guild.members.fetch(userId);
    let rolesAssigned = [];

    // Check all levels from oldLevel+1 to newLevel
    for (let level = oldLevel + 1; level <= newLevel; level++) {
      const roleId = levelingData.levelRoles[level.toString()];
      if (roleId) {
        try {
          const role = await interaction.guild.roles.fetch(roleId);
          if (role && !member.roles.cache.has(roleId)) {
            await member.roles.add(role);
            rolesAssigned.push({ level, role: role.name });
            console.log(`Assigned role ${role.name} to ${member.user.tag} for level ${level}`);
          }
        } catch (error) {
          console.log(`Failed to assign role for level ${level}:`, error.message);
        }
      }
    }

    return rolesAssigned;
  } catch (error) {
    console.error('Error checking level roles:', error);
    return [];
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addxp')
    .setDescription('Add XP to a user')
    .addUserOption(option =>
      option.setName('user').setDescription('User to add XP to').setRequired(true))
    .addIntegerOption(option =>
      option.setName('amount').setDescription('Amount of XP to add').setRequired(true))
    .addStringOption(option =>
      option.setName('reason').setDescription('Reason for adding XP').setRequired(true)),

  async execute(interaction) {
    if (!interaction.member.permissions.has('Administrator')) {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }

    const targetUser = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');
    const reason = interaction.options.getString('reason');

    if (amount <= 0) {
      return interaction.reply({ content: 'XP amount must be positive.', ephemeral: true });
    }

    let data = { users: {} };
    if (fs.existsSync(DATA_PATH)) {
      data = JSON.parse(fs.readFileSync(DATA_PATH));
    }
    if (!data.users) data.users = {};

    const userData = data.users[targetUser.id] || { xp: 0, messages: 0 };
    const oldXP = userData.xp || 0;
    const oldLevel = calculateLevel(userData.messages);

    userData.xp = oldXP + amount;
    userData.messages = Math.ceil(userData.xp / 20); // Approximate message count based on XP
    const newLevel = calculateLevel(userData.messages);

    data.users[targetUser.id] = userData;
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));

    await interaction.reply({ 
      content: `✅ Added ${amount} XP to ${targetUser.tag}. New total: ${userData.xp} XP`,
      ephemeral: true 
    });

    // Check for level up and assign roles
    if (newLevel > oldLevel) {
      // Send level up message
      await interaction.followUp(`🎉 ${targetUser} has reached level ${newLevel}!`);
      
      // Check for role rewards
      const rolesAssigned = await checkLevelRoles(interaction, targetUser.id, newLevel, oldLevel);
      
      // Send role reward messages
      if (rolesAssigned.length > 0) {
        const roleNames = rolesAssigned.map(r => `**${r.role}** (Level ${r.level})`).join(', ');
        await interaction.followUp(`🏆 **New Role Rewards for ${targetUser.tag}:** ${roleNames}`);
      }
    }

    // Send to XP logs channel
    if (XP_LOGS_CHANNEL) {
      const logsChannel = interaction.guild.channels.cache.get(XP_LOGS_CHANNEL);
      if (logsChannel) {
        const embed = {
          title: 'XP Added',
          description: `${interaction.user.tag} added XP to ${targetUser.tag}`,
          fields: [
            { name: 'Amount', value: amount.toString() },
            { name: 'Reason', value: reason },
            { name: 'New Total', value: userData.xp.toString() },
            { name: 'Level', value: `${oldLevel} → ${newLevel}` }
          ],
          color: 0x00ff00,
          timestamp: new Date()
        };

        // Add roles field if any were assigned
        if (newLevel > oldLevel) {
          const rolesAssigned = await checkLevelRoles(interaction, targetUser.id, newLevel, oldLevel);
          if (rolesAssigned.length > 0) {
            embed.fields.push({
              name: '🏆 Roles Assigned',
              value: rolesAssigned.map(r => `${r.role} (Level ${r.level})`).join('\n')
            });
          }
        }

        logsChannel.send({ embeds: [embed] });
      }
    }
  }
};
