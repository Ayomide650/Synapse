const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('modlog')
    .setDescription('Configure the moderation log channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('set')
        .setDescription('Set the moderation log channel')
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('Channel for moderation logs')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('disable')
        .setDescription('Disable moderation logging'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('Check current modlog configuration')),

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
        
        // Validate channel type
        if (channel.type !== ChannelType.GuildText) {
          return await interaction.reply({ 
            content: '❌ Modlog channel must be a text channel.',
            ephemeral: true 
          });
        }

        // Check bot permissions in the channel
        const botMember = interaction.guild.members.cache.get(interaction.client.user.id);
        const channelPermissions = channel.permissionsFor(botMember);
        
        if (!channelPermissions.has(['ViewChannel', 'SendMessages', 'EmbedLinks'])) {
          return await interaction.reply({
            content: `❌ I don't have the required permissions in ${channel}. I need: View Channel, Send Messages, and Embed Links.`,
            ephemeral: true
          });
        }

        // Get current server configs or create new object
        let serverConfigs = await database.get('modlog', 'moderation/server_configs.json') || {};
        
        // Ensure the structure exists
        if (!serverConfigs.guilds) {
          serverConfigs.guilds = {};
        }

        // Initialize guild config if it doesn't exist
        if (!serverConfigs.guilds[guildId]) {
          serverConfigs.guilds[guildId] = {};
        }

        // Update modlog config for this guild
        serverConfigs.guilds[guildId].modlogChannel = {
          channelId: channel.id,
          enabled: true,
          setAt: new Date().toISOString(),
          setBy: interaction.user.id
        };

        // Save to database
        await database.set('modlog', serverConfigs, 'moderation/server_configs.json');
        
        // Send confirmation to interaction
        await interaction.reply({ 
          content: `✅ Modlog channel set to ${channel}.`,
          ephemeral: true 
        });

        // Send confirmation to the modlog channel
        try {
          await channel.send({
            embeds: [{
              title: '📋 Modlog Channel Configured',
              description: `This channel has been set as the moderation log by ${interaction.user}`,
              color: 0x00ff00,
              fields: [
                {
                  name: 'Configured By',
                  value: `${interaction.user.tag} (${interaction.user.id})`,
                  inline: true
                },
                {
                  name: 'Date',
                  value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
                  inline: true
                }
              ],
              timestamp: new Date()
            }]
          });
        } catch (channelError) {
          console.warn(`Could not send confirmation to modlog channel: ${channelError.message}`);
        }
        
        console.log(`✅ Modlog channel set for guild ${guildId}: ${channel.name} (${channel.id})`);

      } else if (subcommand === 'disable') {
        // Get current server configs
        let serverConfigs = await database.get('modlog', 'moderation/server_configs.json') || {};
        
        // Check if guild has modlog configured
        if (!serverConfigs.guilds?.[guildId]?.modlogChannel?.enabled) {
          return await interaction.reply({
            content: '❌ Moderation logging is not currently enabled for this server.',
            ephemeral: true
          });
        }

        // Disable modlog for this guild
        serverConfigs.guilds[guildId].modlogChannel.enabled = false;
        serverConfigs.guilds[guildId].modlogChannel.disabledAt = new Date().toISOString();
        serverConfigs.guilds[guildId].modlogChannel.disabledBy = interaction.user.id;

        // Save to database
        await database.set('modlog', serverConfigs, 'moderation/server_configs.json');
        
        await interaction.reply({ 
          content: '✅ Moderation logging has been disabled.',
          ephemeral: true 
        });
        
        console.log(`✅ Modlog disabled for guild ${guildId}`);

      } else if (subcommand === 'status') {
        // Get current server configs
        const serverConfigs = await database.get('modlog', 'moderation/server_configs.json') || {};
        const guildConfig = serverConfigs.guilds?.[guildId]?.modlogChannel;
        
        if (!guildConfig || !guildConfig.enabled) {
          return await interaction.reply({
            content: '❌ Moderation logging is currently **disabled** for this server.',
            ephemeral: true
          });
        }

        // Get the channel
        const channel = interaction.guild.channels.cache.get(guildConfig.channelId);
        
        if (!channel) {
          return await interaction.reply({
            content: '⚠️ Modlog is enabled, but the configured channel no longer exists. Please reconfigure with `/modlog set`.',
            ephemeral: true
          });
        }

        const statusEmbed = {
          color: 0x00ff00,
          title: '📋 Moderation Log Configuration',
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
              name: 'Configured',
              value: guildConfig.setAt ? `<t:${Math.floor(new Date(guildConfig.setAt).getTime() / 1000)}:R>` : 'Unknown',
              inline: true
            }
          ],
          footer: {
            text: 'All moderation actions will be logged to this channel'
          },
          timestamp: new Date().toISOString()
        };

        await interaction.reply({
          embeds: [statusEmbed],
          ephemeral: true
        });
      }

    } catch (error) {
      console.error('Error in modlog command:', error);
      
      // More specific error messages
      let errorMessage = '❌ Failed to configure moderation logging. Please try again.';
      
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
  },

  // Helper function to get modlog channel for a guild (can be used by other commands)
  async getModlogChannel(database, guildId, guild) {
    try {
      const serverConfigs = await database.get('modlog', 'moderation/server_configs.json') || {};
      const guildConfig = serverConfigs.guilds?.[guildId]?.modlogChannel;
      
      if (!guildConfig || !guildConfig.enabled) {
        return null;
      }
      
      return guild.channels.cache.get(guildConfig.channelId) || null;
    } catch (error) {
      console.error('Error getting modlog channel:', error);
      return null;
    }
  }
};
