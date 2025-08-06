const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '../data/config.json');

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

    let config = { rank_roles: {} };
    if (fs.existsSync(CONFIG_PATH)) {
      config = JSON.parse(fs.readFileSync(CONFIG_PATH));
    }
    if (!config.rank_roles) config.rank_roles = {};

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'add') {
      const level = interaction.options.getInteger('level');
      const role = interaction.options.getRole('role');

      if (level < 1) {
        return interaction.reply({ content: 'Level must be positive.', ephemeral: true });
      }

      if (Object.entries(config.rank_roles).some(([, roleId]) => roleId === role.id)) {
        return interaction.reply({ content: 'This role is already used as a rank reward.', ephemeral: true });
      }

      config.rank_roles[level] = role.id;
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

      await interaction.reply({ 
        content: `Added ${role.name} as a reward for level ${level}.`,
        ephemeral: true 
      });
    }
    else if (subcommand === 'remove') {
      const role = interaction.options.getRole('role');
      const level = Object.entries(config.rank_roles).find(([, roleId]) => roleId === role.id)?.[0];

      if (!level) {
        return interaction.reply({ content: 'This role is not a rank reward.', ephemeral: true });
      }

      delete config.rank_roles[level];
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

      await interaction.reply({ 
        content: `Removed ${role.name} from level ${level} rewards.`,
        ephemeral: true 
      });
    }
    else if (subcommand === 'list') {
      const entries = Object.entries(config.rank_roles);
      if (entries.length === 0) {
        return interaction.reply({ content: 'No rank roles configured.', ephemeral: true });
      }

      const roleList = await Promise.all(entries
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(async ([level, roleId]) => {
          const role = await interaction.guild.roles.fetch(roleId);
          return role ? `Level ${level}: ${role.name}` : null;
        }));

      await interaction.reply({ 
        content: `**Rank Roles:**\n${roleList.filter(Boolean).join('\n')}`,
        ephemeral: true 
      });
    }
  }
};