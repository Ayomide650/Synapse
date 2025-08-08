const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const Database = require('../database/database'); // Adjust path as needed

module.exports = {
  data: new SlashCommandBuilder()
    .setName('filter')
    .setDescription('Manage word filter')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Add a word to the filter')
        .addStringOption(option =>
          option.setName('word').setDescription('Word or pattern to filter').setRequired(true))
        .addStringOption(option =>
          option.setName('action')
          .setDescription('Action to take when word is used')
          .setRequired(true)
          .addChoices(
            { name: 'Delete Message', value: 'delete' },
            { name: 'Timeout User', value: 'mute' },
            { name: 'Warn User', value: 'warn' },
            { name: 'Ban User', value: 'ban' }
          ))
        .addIntegerOption(option =>
          option.setName('duration')
          .setDescription('Duration in minutes for timeout/ban (optional)')
          .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove a word from the filter')
        .addStringOption(option =>
          option.setName('word').setDescription('Word to remove from filter').setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List all filtered words'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('settings')
        .setDescription('Configure filter settings')
        .addBooleanOption(option =>
          option.setName('enabled')
          .setDescription('Enable or disable the word filter')
          .setRequired(false))
        .addBooleanOption(option =>
          option.setName('case_sensitive')
          .setDescription('Make filter case sensitive')
          .setRequired(false))
        .addBooleanOption(option =>
          option.setName('partial_match')
          .setDescription('Match partial words (e.g., "bad" matches "badword")')
          .setRequired(false))),

  async execute(interaction) {
    try {
      if (!interaction.member.permissions.has('Administrator')) {
        return interaction.reply({ 
          content: 'You do not have permission to use this command.', 
          ephemeral: true 
        });
      }

      // Initialize database
      const db = new Database();
      await db.initialize();

      // Get current filter data from database
      // Based on your commandFiles mapping, filter uses 'features/word_filters.json'
      const filterKey = 'word_filters';
      let config = await db.get(filterKey) || {
        guilds: {},
        global_settings: {
          enabled: true,
          case_sensitive: false,
          partial_match: true,
          log_actions: true
        }
      };

      // Initialize guild data if not exists
      const guildId = interaction.guild.id;
      if (!config.guilds[guildId]) {
        config.guilds[guildId] = {
          filters: [],
          settings: {
            enabled: true,
            case_sensitive: false,
            partial_match: true,
            exempt_roles: [],
            exempt_channels: []
          }
        };
      }

      const subcommand = interaction.options.getSubcommand();

      switch (subcommand) {
        case 'add': {
          const word = interaction.options.getString('word');
          const action = interaction.options.getString('action');
          const duration = interaction.options.getInteger('duration');

          // Validate duration for certain actions
          if ((action === 'mute' || action === 'ban') && !duration) {
            return interaction.reply({
              content: '❌ Duration is required for timeout and ban actions.',
              ephemeral: true
            });
          }

          const processedWord = config.guilds[guildId].settings.case_sensitive ? word : word.toLowerCase();
          const existingFilter = config.guilds[guildId].filters.find(f => f.word === processedWord);

          if (existingFilter) {
            return interaction.reply({ 
              content: `❌ The word "${word}" is already filtered.`, 
              ephemeral: true 
            });
          }

          const newFilter = {
            word: processedWord,
            original_word: word, // Keep original for display
            action,
            duration: duration || null,
            created_by: interaction.user.id,
            created_at: new Date().toISOString(),
            id: Date.now() // Unique identifier
          };

          config.guilds[guildId].filters.push(newFilter);
          await db.set(filterKey, config);

          const embed = new EmbedBuilder()
            .setTitle('✅ Word Filter Added')
            .setDescription(`Successfully added word filter`)
            .addFields([
              { name: 'Word/Pattern', value: `\`${word}\``, inline: true },
              { name: 'Action', value: action, inline: true },
              { name: 'Duration', value: duration ? `${duration} minutes` : 'N/A', inline: true },
              { name: 'Filter ID', value: newFilter.id.toString(), inline: true },
              { name: 'Case Sensitive', value: config.guilds[guildId].settings.case_sensitive ? 'Yes' : 'No', inline: true },
              { name: 'Added By', value: interaction.user.tag, inline: true }
            ])
            .setColor(0x00ff00)
            .setTimestamp();

          await interaction.reply({ embeds: [embed], ephemeral: true });
          console.log(`✅ Filter added: "${word}" (${action}) by ${interaction.user.tag} in ${interaction.guild.name}`);
          break;
        }

        case 'remove': {
          const word = interaction.options.getString('word');
          const processedWord = config.guilds[guildId].settings.case_sensitive ? word : word.toLowerCase();
          const filterIndex = config.guilds[guildId].filters.findIndex(f => f.word === processedWord);

          if (filterIndex === -1) {
            return interaction.reply({ 
              content: `❌ Word "${word}" not found in filter.`, 
              ephemeral: true 
            });
          }

          const removedFilter = config.guilds[guildId].filters[filterIndex];
          config.guilds[guildId].filters.splice(filterIndex, 1);
          await db.set(filterKey, config);

          const embed = new EmbedBuilder()
            .setTitle('✅ Word Filter Removed')
            .setDescription(`Successfully removed word filter`)
            .addFields([
              { name: 'Word/Pattern', value: `\`${removedFilter.original_word || removedFilter.word}\``, inline: true },
              { name: 'Previous Action', value: removedFilter.action, inline: true },
              { name: 'Removed By', value: interaction.user.tag, inline: true }
            ])
            .setColor(0xff9900)
            .setTimestamp();

          await interaction.reply({ embeds: [embed], ephemeral: true });
          console.log(`✅ Filter removed: "${word}" by ${interaction.user.tag} in ${interaction.guild.name}`);
          break;
        }

        case 'list': {
          const filters = config.guilds[guildId].filters;
          
          if (filters.length === 0) {
            return interaction.reply({ 
              content: '📝 No filtered words configured for this server.', 
              ephemeral: true 
            });
          }

          const embed = new EmbedBuilder()
            .setTitle('📋 Word Filter List')
            .setDescription(`**Server:** ${interaction.guild.name}\n**Total Filters:** ${filters.length}`)
            .setColor(0x0099ff)
            .setTimestamp();

          // Group filters by action for better organization
          const filtersByAction = {};
          filters.forEach(filter => {
            if (!filtersByAction[filter.action]) {
              filtersByAction[filter.action] = [];
            }
            filtersByAction[filter.action].push(filter);
          });

          Object.entries(filtersByAction).forEach(([action, actionFilters]) => {
            const filterList = actionFilters.map(f => {
              const duration = f.duration ? ` (${f.duration}min)` : '';
              return `• \`${f.original_word || f.word}\`${duration}`;
            }).join('\n');

            embed.addFields([{
              name: `${action.toUpperCase()} (${actionFilters.length})`,
              value: filterList.length > 1000 ? filterList.substring(0, 1000) + '...' : filterList,
              inline: false
            }]);
          });

          // Add settings info
          const settings = config.guilds[guildId].settings;
          embed.addFields([{
            name: 'Current Settings',
            value: `**Enabled:** ${settings.enabled ? '✅' : '❌'}\n` +
                   `**Case Sensitive:** ${settings.case_sensitive ? '✅' : '❌'}\n` +
                   `**Partial Match:** ${settings.partial_match ? '✅' : '❌'}`,
            inline: false
          }]);

          await interaction.reply({ embeds: [embed], ephemeral: true });
          break;
        }

        case 'settings': {
          const enabled = interaction.options.getBoolean('enabled');
          const caseSensitive = interaction.options.getBoolean('case_sensitive');
          const partialMatch = interaction.options.getBoolean('partial_match');

          let updated = [];
          
          if (enabled !== null) {
            config.guilds[guildId].settings.enabled = enabled;
            updated.push(`Enabled: ${enabled ? '✅' : '❌'}`);
          }
          
          if (caseSensitive !== null) {
            config.guilds[guildId].settings.case_sensitive = caseSensitive;
            updated.push(`Case Sensitive: ${caseSensitive ? '✅' : '❌'}`);
          }
          
          if (partialMatch !== null) {
            config.guilds[guildId].settings.partial_match = partialMatch;
            updated.push(`Partial Match: ${partialMatch ? '✅' : '❌'}`);
          }

          if (updated.length === 0) {
            // Show current settings
            const settings = config.guilds[guildId].settings;
            const embed = new EmbedBuilder()
              .setTitle('⚙️ Current Filter Settings')
              .setDescription(`Settings for **${interaction.guild.name}**`)
              .addFields([
                { name: 'Enabled', value: settings.enabled ? '✅ Yes' : '❌ No', inline: true },
                { name: 'Case Sensitive', value: settings.case_sensitive ? '✅ Yes' : '❌ No', inline: true },
                { name: 'Partial Match', value: settings.partial_match ? '✅ Yes' : '❌ No', inline: true },
                { name: 'Total Filters', value: config.guilds[guildId].filters.length.toString(), inline: true }
              ])
              .setColor(0x0099ff)
              .setTimestamp();

            return interaction.reply({ embeds: [embed], ephemeral: true });
          }

          await db.set(filterKey, config);

          const embed = new EmbedBuilder()
            .setTitle('✅ Filter Settings Updated')
            .setDescription('Successfully updated filter settings')
            .addFields([
              { name: 'Updated Settings', value: updated.join('\n'), inline: false }
            ])
            .setColor(0x00ff00)
            .setTimestamp();

          await interaction.reply({ embeds: [embed], ephemeral: true });
          console.log(`✅ Filter settings updated by ${interaction.user.tag} in ${interaction.guild.name}: ${updated.join(', ')}`);
          break;
        }
      }
    } catch (error) {
      console.error('❌ Error in filter command:', error);
      
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Error')
        .setDescription('An error occurred while managing the word filter. Please try again.')
        .setColor(0xff0000)
        .setTimestamp();

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
      } else {
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }
    }
  },

  // Message event handler for word filtering
  async handleMessage(message) {
    try {
      if (message.author.bot) return;
      if (!message.guild) return;

      // Initialize database
      const db = new Database();
      await db.initialize();

      // Get filter data
      const filterKey = 'word_filters';
      const config = await db.get(filterKey);
      
      if (!config?.guilds[message.guild.id]?.settings.enabled) {
        return; // Filter not enabled for this guild
      }

      const guildConfig = config.guilds[message.guild.id];
      
      // Skip if user is admin (unless you want to filter admins too)
      if (message.member?.permissions?.has(PermissionFlagsBits.Administrator)) {
        return;
      }

      // Check message against filters
      for (const filter of guildConfig.filters) {
        let messageContent = guildConfig.settings.case_sensitive ? message.content : message.content.toLowerCase();
        let filterWord = filter.word;

        let matched = false;
        if (guildConfig.settings.partial_match) {
          matched = messageContent.includes(filterWord);
        } else {
          // Exact word match with word boundaries
          const regex = new RegExp(`\\b${filterWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
          matched = regex.test(messageContent);
        }

        if (matched) {
          await this.executeFilterAction(message, filter, db, filterKey, config);
          break; // Stop after first match
        }
      }
    } catch (error) {
      console.error('❌ Error in filter message handler:', error);
    }
  },

  async executeFilterAction(message, filter, db, filterKey, config) {
    try {
      // Delete the message first (for all actions)
      await message.delete().catch(() => {});

      // Log the action
      console.log(`🚫 Filter triggered: "${filter.original_word || filter.word}" by ${message.author.tag} in ${message.channel.name} (${message.guild.name})`);

      switch (filter.action) {
        case 'delete':
          // Message already deleted, just send notification
          const deleteWarning = await message.channel.send({
            content: `⚠️ ${message.author}, your message was deleted for containing filtered content.`
          });
          setTimeout(() => deleteWarning.delete().catch(() => {}), 5000);
          break;

        case 'warn':
          // This would integrate with your warn system
          const warnMessage = await message.channel.send({
            content: `⚠️ ${message.author} has been warned for using filtered language.`
          });
          setTimeout(() => warnMessage.delete().catch(() => {}), 10000);
          break;

        case 'mute':
          if (filter.duration && message.member?.moderatable) {
            await message.member.timeout(filter.duration * 60 * 1000, `Used filtered word: ${filter.original_word || filter.word}`);
            const muteMessage = await message.channel.send({
              content: `🔇 ${message.author} has been timed out for ${filter.duration} minutes for using filtered language.`
            });
            setTimeout(() => muteMessage.delete().catch(() => {}), 10000);
          }
          break;

        case 'ban':
          if (filter.duration && message.member?.bannable) {
            await message.member.ban({ 
              reason: `Used filtered word: ${filter.original_word || filter.word}`,
              deleteMessageDays: 1 
            });
            
            // Schedule unban if temporary
            // You might want to integrate this with your tempban system
            
            const banMessage = await message.channel.send({
              content: `🔨 ${message.author.tag} has been banned for using filtered language.`
            });
            setTimeout(() => banMessage.delete().catch(() => {}), 10000);
          }
          break;
      }
    } catch (error) {
      console.error('❌ Error executing filter action:', error);
    }
  }
};
