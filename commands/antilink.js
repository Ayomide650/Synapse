const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../utils/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('antilink')
    .setDescription('Manage link protection in channels')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('enable')
        .setDescription('Enable link protection in a channel')
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('Channel to enable link protection in')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('disable')
        .setDescription('Disable link protection in a channel')
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('Channel to disable link protection in')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List all channels with link protection enabled'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('Check link protection status for current channel')),

  async execute(interaction) {
    try {
      // Initialize database
      const db = new Database();
      await db.initialize();

      const subcommand = interaction.options.getSubcommand();
      
      // Get current antilink data from database
      // Based on your commandFiles mapping, antilink uses 'features/antilink_configs.json'
      const antilinkKey = 'antilink_configs';
      let data = await db.get(antilinkKey) || { 
        guilds: {},
        settings: {
          deleteWarningAfter: 5000, // 5 seconds
          logActions: true
        }
      };

      // Initialize guild data if not exists
      const guildId = interaction.guild.id;
      if (!data.guilds[guildId]) {
        data.guilds[guildId] = {
          channels: {},
          whitelist: [], // Future feature: whitelisted domains
          exemptRoles: [], // Future feature: exempt roles
          enabled: true
        };
      }

      switch (subcommand) {
        case 'enable': {
          const channel = interaction.options.getChannel('channel');
          
          // Validate channel type
          if (!channel.isTextBased()) {
            return await interaction.reply({
              content: '❌ Link protection can only be enabled in text channels.',
              ephemeral: true
            });
          }

          data.guilds[guildId].channels[channel.id] = {
            enabled: true,
            enabledBy: interaction.user.id,
            enabledAt: new Date().toISOString()
          };
          
          await db.set(antilinkKey, data);
          
          await interaction.reply({
            content: `✅ Link protection enabled in ${channel}`,
            ephemeral: true
          });

          console.log(`✅ Antilink enabled in ${channel.name} (${channel.id}) by ${interaction.user.tag}`);
          break;
        }

        case 'disable': {
          const channel = interaction.options.getChannel('channel');
          
          if (!data.guilds[guildId].channels[channel.id]) {
            return await interaction.reply({
              content: `❌ Link protection is not enabled in ${channel}`,
              ephemeral: true
            });
          }

          delete data.guilds[guildId].channels[channel.id];
          
          await db.set(antilinkKey, data);
          
          await interaction.reply({
            content: `✅ Link protection disabled in ${channel}`,
            ephemeral: true
          });

          console.log(`✅ Antilink disabled in ${channel.name} (${channel.id}) by ${interaction.user.tag}`);
          break;
        }

        case 'list': {
          const guildChannels = data.guilds[guildId]?.channels || {};
          const enabledChannels = Object.keys(guildChannels);
          
          if (enabledChannels.length === 0) {
            return await interaction.reply({
              content: '**Channels with Link Protection:**\nNo channels currently have link protection enabled.',
              ephemeral: true
            });
          }

          const channelList = enabledChannels
            .map(channelId => {
              const channelData = guildChannels[channelId];
              const enabledDate = channelData.enabledAt ? 
                `\n  └ *Enabled: ${new Date(channelData.enabledAt).toLocaleDateString()}*` : '';
              return `<#${channelId}>${enabledDate}`;
            })
            .join('\n');
          
          await interaction.reply({
            content: `**Channels with Link Protection:**\n${channelList}`,
            ephemeral: true
          });
          break;
        }

        case 'status': {
          const currentChannel = interaction.channel;
          const isEnabled = data.guilds[guildId]?.channels[currentChannel.id]?.enabled || false;
          const channelData = data.guilds[guildId]?.channels[currentChannel.id];
          
          let statusMessage = `**Link Protection Status for ${currentChannel}:**\n`;
          statusMessage += `Status: ${isEnabled ? '✅ Enabled' : '❌ Disabled'}`;
          
          if (isEnabled && channelData) {
            if (channelData.enabledAt) {
              statusMessage += `\nEnabled: ${new Date(channelData.enabledAt).toLocaleString()}`;
            }
            if (channelData.enabledBy) {
              try {
                const enabledByUser = await interaction.client.users.fetch(channelData.enabledBy);
                statusMessage += `\nEnabled by: ${enabledByUser.tag}`;
              } catch (e) {
                statusMessage += `\nEnabled by: <@${channelData.enabledBy}>`;
              }
            }
          }
          
          await interaction.reply({
            content: statusMessage,
            ephemeral: true
          });
          break;
        }
      }
    } catch (error) {
      console.error('❌ Error in antilink command:', error);
      
      const errorMessage = '❌ Failed to manage link protection. Please try again.';
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: errorMessage, ephemeral: true });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
  },

  // Message event handler for link detection
  async handleMessage(message) {
    try {
      if (message.author.bot) return;
      if (!message.guild) return; // DM messages
      
      // Initialize database
      const db = new Database();
      await db.initialize();

      // Get antilink data from database
      const antilinkKey = 'antilink_configs';
      const data = await db.get(antilinkKey);
      
      if (!data?.guilds[message.guild.id]?.channels[message.channel.id]?.enabled) {
        return; // Link protection not enabled for this channel
      }

      // Skip if user is admin or has exempt role (future feature)
      if (message.member?.permissions?.has(PermissionFlagsBits.Administrator)) {
        return;
      }

      // Enhanced link detection regex
      const linkRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|discord\.gg\/[a-zA-Z0-9]+|(discord\.com\/invite\/[a-zA-Z0-9]+)|([a-zA-Z0-9-]+\.[a-zA-Z]{2,}\/[^\s]*)/gi;
      
      if (linkRegex.test(message.content)) {
        try {
          await message.delete();
          
          const warning = await message.channel.send({
            content: `⚠️ ${message.author}, links are not allowed in this channel! Your message has been deleted.`
          });
          
          // Delete warning after configured time (default 5 seconds)
          const deleteAfter = data.settings?.deleteWarningAfter || 5000;
          setTimeout(() => warning.delete().catch(() => {}), deleteAfter);

          // Log the action if logging is enabled
          if (data.settings?.logActions) {
            console.log(`🔗 Antilink: Deleted message from ${message.author.tag} in ${message.channel.name} (${message.guild.name})`);
          }
          
        } catch (deleteError) {
          console.error('❌ Error deleting message in antilink handler:', deleteError);
        }
      }
    } catch (error) {
      console.error('❌ Error in antilink message handler:', error);
    }
  }
};
