const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const LOG_CHANNEL_ID = process.env.SERVER_LOG_CHANNEL;
const DATA_PATH = path.join(__dirname, '../data/moderation.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Remove timeout from a user')
    .addUserOption(option =>
      option.setName('user').setDescription('User to unmute').setRequired(true)),
  async execute(interaction) {
    if (!interaction.member.permissions.has('ModerateMembers')) {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }
    const user = interaction.options.getUser('user');
    const member = interaction.guild.members.cache.get(user.id);
    
    if (!member) {
      return interaction.reply({ content: 'User not found in this server.', ephemeral: true });
    }
    if (!member.moderatable) {
      return interaction.reply({ content: 'I cannot unmute this user.', ephemeral: true });
    }

    try {
      await member.timeout(null);
      await interaction.reply({ content: `Unmuted ${user.tag}.`, ephemeral: true });

      if (LOG_CHANNEL_ID) {
        const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
        if (logChannel) {
          logChannel.send({
            embeds: [{
              title: 'User Unmuted',
              description: `${user.tag} was unmuted by ${interaction.user.tag}`,
              fields: [
                { name: 'User ID', value: user.id },
                { name: 'Moderator', value: interaction.user.tag },
                { name: 'Time', value: new Date().toISOString() }
              ],
              color: 0x00ff00
            }]
          });
        }
      }

      let data = { mutes: [] };
      if (fs.existsSync(DATA_PATH)) {
        data = JSON.parse(fs.readFileSync(DATA_PATH));
      }
      if (!data.mutes) data.mutes = [];
      
      const activeMute = data.mutes.find(mute => 
        mute.user_id === user.id && 
        new Date(mute.expires_at) > new Date()
      );
      
      if (activeMute) {
        activeMute.expires_at = new Date().toISOString();
        activeMute.unmuted_by = interaction.user.id;
        activeMute.unmuted_at = new Date().toISOString();
      }
      
      fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
    } catch (error) {
      interaction.reply({ 
        content: 'Failed to unmute user. Error: ' + error.message,
        ephemeral: true 
      });
    }
  }
};