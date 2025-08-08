const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../utils/database');

function calculateLevel(messages) {
  return Math.floor(Math.sqrt(messages / 5));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('levelroles')
    .setDescription('View all level-based role rewards'),
    
  async execute(interaction) {
    try {
      const db = new Database();
      await db.initialize(); // Ensure database is initialized
      
      // Get level roles configuration from the new database system
      // Based on your command file mapping, this should be stored in 'leveling/level_roles_config.json'
      const levelRolesConfig = await db.get('levelroles') || { rank_roles: {} };
      
      const entries = Object.entries(levelRolesConfig.rank_roles || {});
      if (entries.length === 0) {
        return interaction.reply({ 
          content: 'No level roles configured.', 
          ephemeral: true 
        });
      }
      
      // Get user's current level data from the new database system
      // Based on your command file mapping, this should be stored in 'leveling/user_levels.json'
      const userLevelData = await db.get('level', interaction.user.id) || { messages: 0 };
      const userLevel = calculateLevel(userLevelData.messages || 0);
      
      const embed = new EmbedBuilder()
        .setTitle('🏆 Level Roles')
        .setColor(0xffd700)
        .setDescription('Earn these roles by leveling up!')
        .setTimestamp()
        .setFooter({ 
          text: `Requested by ${interaction.user.username}`, 
          iconURL: interaction.user.displayAvatarURL() 
        });
      
      // Sort entries by level (ascending)
      const sortedEntries = entries.sort(([a], [b]) => Number(a) - Number(b));
      
      let rolesAdded = 0;
      for (const [level, roleId] of sortedEntries) {
        try {
          const role = await interaction.guild.roles.fetch(roleId);
          if (role) {
            const levelNum = Number(level);
            const hasRole = levelNum <= userLevel;
            const isClose = levelNum - userLevel <= 5 && levelNum > userLevel;
            
            // Status indicators
            const status = hasRole ? '✅' : '❌';
            const color = hasRole ? '🟢' : isClose ? '🟡' : '🔴';
            
            // Additional info for close roles
            const progressInfo = !hasRole && isClose 
              ? ` (${levelNum - userLevel} levels to go!)` 
              : '';
            
            embed.addFields({
              name: `Level ${level}`,
              value: `${color} **${role.name}** ${status}${progressInfo}`,
              inline: true
            });
            
            rolesAdded++;
            
            // Discord embed field limit is 25
            if (rolesAdded >= 24) { // Save one field for user's current level
              break;
            }
          }
        } catch (error) {
          console.warn(`Could not fetch role ${roleId} for level ${level}:`, error.message);
          // Continue with other roles even if one fails
        }
      }
      
      // Add user's current level information
      const nextLevelXp = Math.pow((userLevel + 1) * Math.sqrt(5), 2);
      const currentXp = userLevelData.messages || 0;
      const xpNeeded = Math.ceil(nextLevelXp - currentXp);
      
      embed.addFields({
        name: '📊 Your Progress',
        value: `**Current Level:** ${userLevel}\n**Messages Sent:** ${currentXp.toLocaleString()}\n**XP to Next Level:** ${xpNeeded > 0 ? xpNeeded.toLocaleString() : 'Max Level!'}`,
        inline: false
      });
      
      await interaction.reply({ embeds: [embed] });
      
    } catch (error) {
      console.error('Error in levelroles command:', error);
      
      // Fallback error message
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Error')
        .setDescription('An error occurred while fetching level roles. Please try again later.')
        .setColor(0xff0000);
        
      await interaction.reply({ 
        embeds: [errorEmbed], 
        ephemeral: true 
      });
    }
  }
};
