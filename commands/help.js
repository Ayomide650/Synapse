const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Get help with bot commands')
    .addStringOption(option =>
      option.setName('command')
        .setDescription('Specific command to get help for')
        .setRequired(false)),

  async execute(interaction) {
    try {
      const commandQuery = interaction.options.getString('command');
      const member = interaction.member;

      // Load all commands
      const commands = this.loadCommands();

      if (commandQuery) {
        // Show detailed help for specific command
        await this.showCommandHelp(interaction, commandQuery, commands);
      } else {
        // Show command list based on permissions
        await this.showCommandList(interaction, member, commands);
      }

    } catch (error) {
      console.error('Error in help command:', error);
      await interaction.reply({
        content: '❌ Failed to fetch help information. Please try again.',
        ephemeral: true
      });
    }
  },

  loadCommands() {
    const commands = [];
    const commandsPath = path.join(__dirname);
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
      const command = require(path.join(commandsPath, file));
      if (command.data) {
        commands.push({
          name: command.data.name,
          description: command.data.description,
          defaultPermission: command.data.default_member_permissions,
          options: command.data.options
        });
      }
    }

    return commands;
  },

  async showCommandHelp(interaction, commandName, commands) {
    const command = commands.find(cmd => cmd.name === commandName.toLowerCase());
    if (!command) {
      return await interaction.reply({
        content: `❌ Command \`${commandName}\` not found. Use \`/help\` to see all commands.`,
        ephemeral: true
      });
    }

    const embed = new EmbedBuilder()
      .setTitle(`Command: /${command.name}`)
      .setColor(0x3498db)
      .setDescription(command.description)
      .addFields(
        {
          name: '📝 Usage',
          value: this.formatCommandUsage(command),
          inline: false
        }
      );

    // Add permission requirements if any
    if (command.defaultPermission) {
      const perms = new PermissionsBitField(command.defaultPermission);
      embed.addFields({
        name: '🔒 Required Permissions',
        value: perms.toArray().map(p => `\`${p}\``).join(', ') || 'None',
        inline: false
      });
    }

    // Add examples if command has options
    if (command.options?.length > 0) {
      embed.addFields({
        name: '📚 Examples',
        value: this.generateExamples(command),
        inline: false
      });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },

  async showCommandList(interaction, member, commands) {
    const categories = {
      'Moderation': [],
      'Utility': [],
      'Economy': [],
      'Leveling': [],
      'Information': [],
      'Fun': []
    };

    // Filter and categorize commands based on permissions
    commands.forEach(cmd => {
      if (this.canUserUseCommand(member, cmd)) {
        const category = this.getCommandCategory(cmd.name);
        if (categories[category]) {
          categories[category].push(cmd);
        }
      }
    });

    const embed = new EmbedBuilder()
      .setTitle('📚 Command Help')
      .setColor(0x3498db)
      .setDescription('Use `/help <command>` for detailed information about a specific command.');

    // Add non-empty categories to embed
    Object.entries(categories).forEach(([category, cmds]) => {
      if (cmds.length > 0) {
        embed.addFields({
          name: `${this.getCategoryEmoji(category)} ${category}`,
          value: cmds.map(cmd => `\`/${cmd.name}\` - ${cmd.description}`).join('\n'),
          inline: false
        });
      }
    });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },

  canUserUseCommand(member, command) {
    if (!command.defaultPermission) return true;
    return member.permissions.has(command.defaultPermission) || member.permissions.has(PermissionsBitField.Flags.Administrator);
  },

  formatCommandUsage(command) {
    let usage = `/${command.name}`;
    if (command.options) {
      command.options.forEach(opt => {
        const required = opt.required ? '<' : '[';
        const closing = opt.required ? '>' : ']';
        usage += ` ${required}${opt.name}${closing}`;
      });
    }
    return `\`${usage}\``;
  },

  generateExamples(command) {
    const examples = [`/${command.name}`];
    if (command.options) {
      // Generate an example with all required options
      const requiredExample = `/${command.name} ${command.options
        .filter(opt => opt.required)
        .map(opt => this.getExampleValue(opt))
        .join(' ')}`;
      if (requiredExample !== examples[0]) {
        examples.push(requiredExample);
      }

      // Generate an example with all options
      const fullExample = `/${command.name} ${command.options
        .map(opt => this.getExampleValue(opt))
        .join(' ')}`;
      if (fullExample !== requiredExample) {
        examples.push(fullExample);
      }
    }
    return examples.map(ex => `\`${ex}\``).join('\n');
  },

  getExampleValue(option) {
    const examples = {
      user: '@user',
      channel: '#channel',
      role: '@role',
      number: '10',
      string: 'text',
      duration: '1h30m',
      reason: 'reason here'
    };
    return `${option.name}:${examples[option.type] || 'value'}`;
  },

  getCommandCategory(commandName) {
    const categories = {
      'Moderation': ['ban', 'kick', 'mute', 'warn', 'timeout', 'purge', 'lock'],
      'Utility': ['ping', 'help', 'serverinvite', 'remindme', 'timer'],
      'Economy': ['balance', 'daily', 'coinflip', 'dice'],
      'Leveling': ['level', 'xp', 'leaderboard'],
      'Information': ['userinfo', 'serverinfo', 'channelinfo', 'roleinfo'],
      'Fun': ['hack', 'giveaway']
    };

    for (const [category, commands] of Object.entries(categories)) {
      if (commands.some(cmd => commandName.includes(cmd))) {
        return category;
      }
    }
    return 'Utility';
  },

  getCategoryEmoji(category) {
    const emojis = {
      'Moderation': '🛡️',
      'Utility': '🔧',
      'Economy': '💰',
      'Leveling': '📊',
      'Information': 'ℹ️',
      'Fun': '🎮'
    };
    return emojis[category] || '📌';
  }
};