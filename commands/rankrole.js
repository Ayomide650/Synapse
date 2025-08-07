const { SlashCommandBuilder } = require('discord.js');
const database = require('../utils/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rankrole')
    .setDescription('Manage level-based role rewards')
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Add a role reward for a level')
        .addIntegerOption(option =>
          option.setName('level').setDescription('Level required for the role').setRequired(true))
        .addRoleOption(option =>
          option.setName('role').setDescription('Role to award').setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove a role reward')
        .addRoleOption(option =>
          option.setName('role').setDescription('Role to remove from rewards').setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List all role rewards')),

  async execute(interaction) {
    if (!interaction.member.permissions.has('Administrator')) {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }

    try {
      // Use the leveling database instead of config.json
      let levelingData = await database.read('leveling.json');
      if (!levelingData) {
        levelingData = {
          meta: {
            version: "1.0.0",
            lastUpdated: new Date().toISOString(),
            xpSettings: {
              minXp: 15,
              maxXp: 25,
              cooldown: 60000,
              xpPerLevel: 100
            }
          },
          userXp: {},
          levelRoles: {}
        };
      }

      if (!levelingData.levelRoles) levelingData.levelRoles = {};

      const subcommand = interaction.options.getSubcommand();

      if (subcommand === 'add') {
        const level = interaction.options.getInteger('level');
        const role = interaction.options.getRole('role');

        if (level < 1) {
          return interaction.reply({ content: 'Level must be positive.', ephemeral: true });
        }

        // Check if role is already used
        const existingLevel = Object.entries(levelingData.levelRoles)
          .find(([, roleId]) => roleId === role.id)?.[0];

        if (existingLevel) {
          return interaction.reply({ 
            content: `This role is already used as a reward for level ${existingLevel}.`, 
            ephemeral: true 
          });
        }

        // Add the role reward
        levelingData.levelRoles[level] = role.id;
        levelingData.meta.lastUpdated = new Date().toISOString();
        
        await database.write('leveling.json', levelingData);
        
        await interaction.reply({ 
          content: `✅ Added **${role.name}** as a reward for level **${level}**.`,
          ephemeral: true 
        });
      }

      else if (subcommand === 'remove') {
        const role = interaction.options.getRole('role');
        
        const levelEntry = Object.entries(levelingData.levelRoles)
          .find(([, roleId]) => roleId === role.id);

        if (!levelEntry) {
          return interaction.reply({ 
            content: 'This role is not configured as a rank reward.', 
            ephemeral: true 
          });
        }

        const [level] = levelEntry;
        delete levelingData.levelRoles[level];
        levelingData.meta.lastUpdated = new Date().toISOString();
        
        await database.write('leveling.json', levelingData);

        await interaction.reply({ 
          content: `✅ Removed **${role.name}** from level **${level}** rewards.`,
          ephemeral: true 
        });
      }

      else if (subcommand === 'list') {
        const entries = Object.entries(levelingData.levelRoles);
        
        if (entries.length === 0) {
          return interaction.reply({ 
            content: '📝 No rank roles configured yet.\nUse `/rankrole add` to set up level rewards.', 
            ephemeral: true 
          });
        }

        const roleList = await Promise.all(
          entries
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(async ([level, roleId]) => {
              try {
                const role = await interaction.guild.roles.fetch(roleId);
                return role ? `**Level ${level}:** ${role.name}` : `**Level ${level}:** <Role Deleted>`;
              } catch {
                return `**Level ${level}:** <Role Not Found>`;
              }
            })
        );

        await interaction.reply({ 
          content: `🏆 **Rank Role Rewards:**\n\n${roleList.join('\n')}\n\n*Use \`/rank\` to check your current level!*`,
          ephemeral: true 
        });
      }

    } catch (error) {
      console.error('Error in rankrole command:', error);
      await interaction.reply({
        content: '❌ An error occurred while managing rank roles. Please try again.',
        ephemeral: true
      });
    }
  },

  // Helper function to check and assign level roles (call this from your XP system)
  async checkLevelRoles(interaction, userId, newLevel, oldLevel) {
    try {
      const levelingData = await database.read('leveling.json');
      if (!levelingData?.levelRoles) return;

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
};
