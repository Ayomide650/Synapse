const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const LOG_CHANNEL_ID = process.env.SERVER_LOG_CHANNEL;
const DATA_PATH = path.join(__dirname, '../data/moderation.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('massban')
    .setDescription('Ban multiple users at once')
    .addStringOption(option =>
      option.setName('user_list').setDescription('User IDs or mentions separated by spaces').setRequired(true))  // ✅ Required option #1
    .addStringOption(option =>
      option.setName('confirm').setDescription('Type CONFIRM to proceed').setRequired(true))  // ✅ Required option #2 (moved up)
    .addStringOption(option =>
      option.setName('reason').setDescription('Reason for massban').setRequired(false)),  // ✅ Optional option comes last
  async execute(interaction) {
    if (!interaction.member.permissions.has('BanMembers') || !interaction.member.permissions.has('Administrator')) {
      return interaction.reply({ content: 'You need BAN_MEMBERS and ADMINISTRATOR permissions.', ephemeral: true });
    }
    
    const userList = interaction.options.getString('user_list').split(/\s+/);
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const confirm = interaction.options.getString('confirm');
    
    if (confirm !== 'CONFIRM') {
      return interaction.reply({ content: 'You must type CONFIRM to massban.', ephemeral: true });
    }
    
    let bannedCount = 0;
    let failed = [];
    
    for (const idOrMention of userList) {
      let userId = idOrMention.replace(/<@!?|>/g, '');
      try {
        const member = interaction.guild.members.cache.get(userId);
        if (member && member.bannable) {
          await member.ban({ reason });
          bannedCount++;
        } else {
          failed.push(userId);
        }
      } catch {
        failed.push(userId);
      }
    }
    
    let data = { massbans: [] };
    if (fs.existsSync(DATA_PATH)) {
      data = JSON.parse(fs.readFileSync(DATA_PATH));
    }
    if (!data.massbans) data.massbans = [];
    
    data.massbans.push({
      moderator_id: interaction.user.id,
      reason,
      banned: bannedCount,
      failed,
      timestamp: new Date().toISOString()
    });
    
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
    
    if (LOG_CHANNEL_ID) {
      const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
      if (logChannel) {
        logChannel.send({
          embeds: [{
            title: 'Massban Executed',
            description: `${interaction.user.tag} massbanned users.`,
            fields: [
              { name: 'Reason', value: reason },
              { name: 'Banned', value: bannedCount.toString() },
              { name: 'Failed', value: failed.length ? failed.join(', ') : 'None' },
              { name: 'Moderator', value: interaction.user.tag },
              { name: 'Time', value: new Date().toISOString() }
            ],
            color: 0xff0000
          }]
        });
      }
    }
    
    await interaction.reply({ content: `Massban complete. Banned: ${bannedCount}, Failed: ${failed.length}`, ephemeral: true });
  }
};
