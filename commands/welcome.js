const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('welcome')
    .setDescription('Configure welcome message channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('set')
        .setDescription('Set the welcome message channel')
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('Channel to send welcome messages in')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('disable')
        .setDescription('Disable welcome messages'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('Check current welcome message configuration')),

  async execute(interaction) {
    try {
      const subcommand = interaction.options.getSubcommand();
      const guildId = interaction.guild.id;
      
      // Get database instance from client
      const database = interaction.client.database;
      
      if (!database) {
        throw new Error('Database not available');
      }

      // Ensure database is initialized
      if (!database.isInitialized) {
        await database.initialize();
      }

      if (subcommand === 'set') {
        const channel = interaction.options.getChannel('channel');
        
        // Check if channel is a text channel
        if (!channel.isTextBased()) {
          return await interaction.reply({
            content: '❌ Please select a text channel for welcome messages.',
            ephemeral: true
          });
        }

        // Get current welcome configs or create new object
        let welcomeConfigs = await database.get('welcome', 'features/welcome_configs.json') || {};
        
        // Ensure the structure exists
        if (!welcomeConfigs.guilds) {
          welcomeConfigs.guilds = {};
        }

        // Update config for this guild
        welcomeConfigs.guilds[guildId] = {
          channelId: channel.id,
          enabled: true,
          updatedAt: new Date().toISOString(),
          updatedBy: interaction.user.id
        };

        // Save to database
        await database.set('welcome', welcomeConfigs, 'features/welcome_configs.json');
        
        await interaction.reply({
          content: `✅ Welcome messages will now be sent in ${channel}`,
          ephemeral: true
        });
        
        console.log(`✅ Welcome channel set for guild ${guildId}: ${channel.name} (${channel.id})`);

      } else if (subcommand === 'disable') {
        // Get current welcome configs
        let welcomeConfigs = await database.get('welcome', 'features/welcome_configs.json') || {};
        
        // Check if guild has welcome configured
        if (!welcomeConfigs.guilds || !welcomeConfigs.guilds[guildId]) {
          return await interaction.reply({
            content: '❌ Welcome messages are not currently configured for this server.',
            ephemeral: true
          });
        }

        // Disable welcome for this guild
        welcomeConfigs.guilds[guildId].enabled = false;
        welcomeConfigs.guilds[guildId].disabledAt = new Date().toISOString();
        welcomeConfigs.guilds[guildId].disabledBy = interaction.user.id;

        // Save to database
        await database.set('welcome', welcomeConfigs, 'features/welcome_configs.json');
        
        await interaction.reply({
          content: '✅ Welcome messages have been disabled for this server.',
          ephemeral: true
        });
        
        console.log(`✅ Welcome messages disabled for guild ${guildId}`);

      } else if (subcommand === 'status') {
        // Get current welcome configs
        const welcomeConfigs = await database.get('welcome', 'features/welcome_configs.json') || {};
        
        const guildConfig = welcomeConfigs.guilds?.[guildId];
        
        if (!guildConfig || !guildConfig.enabled) {
          return await interaction.reply({
            content: '❌ Welcome messages are currently **disabled** for this server.',
            ephemeral: true
          });
        }

        // Get the channel
        const channel = interaction.guild.channels.cache.get(guildConfig.channelId);
        
        if (!channel) {
          return await interaction.reply({
            content: '⚠️ Welcome messages are enabled, but the configured channel no longer exists. Please reconfigure with `/welcome set`.',
            ephemeral: true
          });
        }

        const statusEmbed = {
          color: 0x00ff00,
          title: '📋 Welcome Message Configuration',
          fields: [
            {
              name: 'Status',
              value: '✅ **Enabled**',
              inline: true
            },
            {
              name: 'Channel',
              value: `${channel}`,
              inline: true
            },
            {
              name: 'Last Updated',
              value: guildConfig.updatedAt ? `<t:${Math.floor(new Date(guildConfig.updatedAt).getTime() / 1000)}:R>` : 'Unknown',
              inline: true
            }
          ],
          timestamp: new Date().toISOString()
        };

        await interaction.reply({
          embeds: [statusEmbed],
          ephemeral: true
        });
      }

    } catch (error) {
      console.error('Error in welcome command:', error);
      
      // More specific error messages
      let errorMessage = '❌ Failed to configure welcome messages. Please try again.';
      
      if (error.message.includes('Database not available')) {
        errorMessage = '❌ Database service is currently unavailable. Please try again later.';
      } else if (error.message.includes('GITHUB_TOKEN')) {
        errorMessage = '❌ Database configuration error. Please contact an administrator.';
      }
      
      await interaction.reply({
        content: errorMessage,
        ephemeral: true
      });
    }
  }
};
