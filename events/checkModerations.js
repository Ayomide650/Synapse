const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '../data/moderation.json');
const CONFIG_PATH = path.join(__dirname, '../data/config.json');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    // Check every minute for expired moderations
    setInterval(async () => {
      if (!fs.existsSync(DATA_PATH)) return;

      let data = JSON.parse(fs.readFileSync(DATA_PATH));
      const now = new Date();
      let config = {};

      if (fs.existsSync(CONFIG_PATH)) {
        config = JSON.parse(fs.readFileSync(CONFIG_PATH));
      }

      // Check temp bans
      if (data.temp_bans) {
        const activeBans = data.temp_bans.filter(ban => ban.active);
        for (const ban of activeBans) {
          if (new Date(ban.expires_at) <= now) {
            try {
              for (const guild of client.guilds.cache.values()) {
                await guild.members.unban(ban.user_id, 'Temporary ban expired');
              }
              ban.active = false;
              ban.unbanned_at = now.toISOString();

              // Log to modlog if configured
              if (config.modlog_channel) {
                const logChannel = await client.channels.fetch(config.modlog_channel).catch(() => null);
                if (logChannel) {
                  logChannel.send({
                    embeds: [{
                      title: 'Temporary Ban Expired',
                      description: `<@${ban.user_id}>'s temporary ban has expired`,
                      fields: [
                        { name: 'User ID', value: ban.user_id },
                        { name: 'Original Reason', value: ban.reason },
                        { name: 'Ban Duration', value: ban.duration }
                      ],
                      color: 0x00ff00,
                      timestamp: new Date()
                    }]
                  });
                }
              }
            } catch (error) {
              console.error('Error processing temp ban expiration:', error);
            }
          }
        }
      }

      // Check mutes
      if (data.mutes) {
        const activeMutes = data.mutes.filter(mute => mute.active);
        for (const mute of activeMutes) {
          if (new Date(mute.expires_at) <= now) {
            try {
              for (const guild of client.guilds.cache.values()) {
                const member = await guild.members.fetch(mute.user_id).catch(() => null);
                if (member) {
                  await member.timeout(null, 'Mute duration expired');
                  mute.active = false;
                  mute.unmuted_at = now.toISOString();

                  // Log to modlog if configured
                  if (config.modlog_channel) {
                    const logChannel = await client.channels.fetch(config.modlog_channel).catch(() => null);
                    if (logChannel) {
                      logChannel.send({
                        embeds: [{
                          title: 'Mute Expired',
                          description: `${member.user.tag}'s mute has expired`,
                          fields: [
                            { name: 'User', value: member.user.tag },
                            { name: 'User ID', value: mute.user_id },
                            { name: 'Original Reason', value: mute.reason },
                            { name: 'Mute Duration', value: mute.duration }
                          ],
                          color: 0x00ff00,
                          timestamp: new Date()
                        }]
                      });
                    }
                  }
                }
              }
            } catch (error) {
              console.error('Error processing mute expiration:', error);
            }
          }
        }
      }

      // Save changes
      fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
    }, 60000); // Check every minute
  }
};