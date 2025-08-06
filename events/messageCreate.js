const fs = require('fs');
const path = require('path');
const ms = require('ms');

const CONFIG_PATH = path.join(__dirname, '../data/config.json');
const DATA_PATH = path.join(__dirname, '../data/levels.json');
const XP_LOGS_CHANNEL = process.env.XP_LOGS_CHANNEL;
const XP_COOLDOWN = 60000; // 1 minute cooldown between XP gains
const XP_MIN = 15;
const XP_MAX = 25;

function calculateLevel(messages) {
  return Math.floor(Math.sqrt(messages / 5));
}

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (message.author.bot) return;

    // Handle word filters
    if (fs.existsSync(CONFIG_PATH)) {
      const config = JSON.parse(fs.readFileSync(CONFIG_PATH));
      if (config.filters && config.filters.length > 0) {
        const content = message.content.toLowerCase();
        for (const filter of config.filters) {
          const pattern = filter.word.replace(/\*/g, '.*');
          const regex = new RegExp(pattern, 'i');
          
          if (regex.test(content)) {
            try {
              switch (filter.action) {
                case 'delete':
                  await message.delete();
                  break;
                case 'mute':
                  if (message.member.moderatable) {
                    await message.member.timeout(ms('10m'), 'Filtered word violation');
                    await message.delete();
                  }
                  break;
                case 'warn':
                  await message.delete();
                  const warnPath = path.join(__dirname, '../data/moderation.json');
                  let warnData = { warnings: [] };
                  if (fs.existsSync(warnPath)) {
                    warnData = JSON.parse(fs.readFileSync(warnPath));
                  }
                  if (!warnData.warnings) warnData.warnings = [];
                  warnData.warnings.push({
                    user_id: message.author.id,
                    moderator_id: message.client.user.id,
                    reason: `Filtered word violation: ${filter.word}`,
                    timestamp: new Date().toISOString()
                  });
                  fs.writeFileSync(warnPath, JSON.stringify(warnData, null, 2));
                  break;
                case 'ban':
                  if (message.member.bannable) {
                    await message.member.ban({ reason: `Filtered word violation: ${filter.word}` });
                  }
                  break;
              }

              if (config.modlog_channel) {
                const logChannel = message.guild.channels.cache.get(config.modlog_channel);
                if (logChannel) {
                  logChannel.send({
                    embeds: [{
                      title: 'Filter Action Taken',
                      description: `Action taken on ${message.author.tag}`,
                      fields: [
                        { name: 'Action', value: filter.action },
                        { name: 'Filtered Word', value: filter.word },
                        { name: 'Channel', value: message.channel.name },
                        { name: 'User ID', value: message.author.id },
                        { name: 'Time', value: new Date().toISOString() }
                      ],
                      color: 0xff9900
                    }]
                  });
                }
              }
              return; // Stop processing message after filter action
            } catch (error) {
              console.error('Error executing filter action:', error);
            }
          }
        }
      }
    }

    // Handle XP gain
    let data = { users: {} };
    if (fs.existsSync(DATA_PATH)) {
      data = JSON.parse(fs.readFileSync(DATA_PATH));
    }
    if (!data.users) data.users = {};
    
    const now = Date.now();
    const userData = data.users[message.author.id] || { 
      xp: 0, 
      messages: 0,
      last_xp_gain: null,
      xp_gain_rate: 0
    };

    // Check cooldown
    if (!userData.last_xp_gain || now - new Date(userData.last_xp_gain).getTime() >= XP_COOLDOWN) {
      const earnedXP = Math.floor(Math.random() * (XP_MAX - XP_MIN + 1)) + XP_MIN;
      userData.xp = (userData.xp || 0) + earnedXP;
      userData.messages = (userData.messages || 0) + 1;
      userData.last_xp_gain = new Date().toISOString();

      // Calculate XP gain rate (XP per hour)
      const hourAgo = now - 3600000;
      if (userData.xp_gains) {
        userData.xp_gains = userData.xp_gains.filter(gain => new Date(gain.timestamp).getTime() > hourAgo);
        userData.xp_gains.push({ xp: earnedXP, timestamp: userData.last_xp_gain });
      } else {
        userData.xp_gains = [{ xp: earnedXP, timestamp: userData.last_xp_gain }];
      }
      userData.xp_gain_rate = userData.xp_gains.reduce((sum, gain) => sum + gain.xp, 0);

      data.users[message.author.id] = userData;
      fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));

      // Level up check
      const oldLevel = calculateLevel((userData.messages || 1) - 1);
      const newLevel = calculateLevel(userData.messages);
      if (newLevel > oldLevel) {
        message.channel.send(`🎉 Congratulations ${message.author}! You've reached level ${newLevel}!`);
        
        // Check for role rewards
        if (fs.existsSync(CONFIG_PATH)) {
          const config = JSON.parse(fs.readFileSync(CONFIG_PATH));
          if (config.rank_roles) {
            Object.entries(config.rank_roles).forEach(async ([level, roleId]) => {
              if (Number(level) <= newLevel && Number(level) > oldLevel) {
                const role = await message.guild.roles.fetch(roleId);
                if (role && !message.member.roles.cache.has(roleId)) {
                  await message.member.roles.add(role);
                  message.channel.send(`🎊 ${message.author} earned the ${role.name} role!`);
                }
              }
            });
          }
        }

        // Send to XP logs channel
        if (XP_LOGS_CHANNEL) {
          const logsChannel = message.guild.channels.cache.get(XP_LOGS_CHANNEL);
          if (logsChannel) {
            logsChannel.send({
              content: `${message.author} has leveled up to ${newLevel}!`,
              embeds: [{
                title: 'Level Up!',
                description: `**Level:** ${oldLevel} → ${newLevel}\n**Total Messages:** ${userData.messages}\n**Total XP:** ${userData.xp}`,
                color: 0xffac33,
                thumbnail: { url: message.author.displayAvatarURL() }
              }]
            });
          }
        }
      }
    }
  }
};