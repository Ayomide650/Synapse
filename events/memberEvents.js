const { EmbedBuilder, Events } = require('discord.js');
const fs = require('fs');
const path = require('path');
const databaseService = require('../services/databaseService');

const CONFIG_PATH = path.join(__dirname, '../data/config.json');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member) {
    try {
      // Load server config
      const config = await databaseService.read('config.json') || {};
      const welcomeChannel = config.welcome_channel;
      
      if (welcomeChannel) {
        const channel = member.guild.channels.cache.get(welcomeChannel);
        if (channel) {
          const embed = new EmbedBuilder()
            .setTitle('👋 Welcome!')
            .setDescription(`Welcome to ${member.guild.name}, ${member.user}!`)
            .setColor(0x00ff00)
            .setThumbnail(member.user.displayAvatarURL())
            .addFields(
              { name: 'Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>` },
              { name: 'Member Count', value: member.guild.memberCount.toString() }
            )
            .setTimestamp();

          await channel.send({ embeds: [embed] });
        }
      }

      // Add default roles if configured
      if (config.auto_roles) {
        for (const roleId of config.auto_roles) {
          const role = member.guild.roles.cache.get(roleId);
          if (role) {
            await member.roles.add(role);
          }
        }
      }
    } catch (error) {
      console.error('Error handling new member:', error);
    }
  },
  [Events.GuildMemberAdd]: async (member) => {
    try {
      // Load config
      if (!fs.existsSync(CONFIG_PATH)) return;
      const config = JSON.parse(fs.readFileSync(CONFIG_PATH));
      
      // Check if welcome channel is configured
      if (!config.welcome_channel) return;
      
      const channel = member.guild.channels.cache.get(config.welcome_channel);
      if (!channel) return;
      
      // Send welcome message
      await channel.send(
        `Welcome ${member} to ${member.guild.name}, Enjoy your stay`
      );
    } catch (error) {
      console.error('Error sending welcome message:', error);
    }
  }
};

// Leave event
module.exports.leave = {
  name: 'guildMemberRemove',
  async execute(member) {
    try {
      const config = await databaseService.read('config.json') || {};
      const leaveChannel = config.leave_channel;
      
      if (leaveChannel) {
        const channel = member.guild.channels.cache.get(leaveChannel);
        if (channel) {
          const embed = new EmbedBuilder()
            .setTitle('👋 Goodbye')
            .setDescription(`${member.user.tag} has left the server`)
            .setColor(0xff0000)
            .setThumbnail(member.user.displayAvatarURL())
            .addFields(
              { name: 'Joined Server', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` },
              { name: 'New Member Count', value: member.guild.memberCount.toString() }
            )
            .setTimestamp();

          await channel.send({ embeds: [embed] });
        }
      }
    } catch (error) {
      console.error('Error handling member leave:', error);
    }
  }
};