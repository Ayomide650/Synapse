const config = require('../config/config');

function checkPermissions(requiredPermissions) {
  return async (interaction) => {
    if (!interaction.guild) return false;
    
    // Bot owners bypass all permission checks
    if (config.bot.owners.includes(interaction.user.id)) return true;

    // Check if user has required permissions
    if (!interaction.member.permissions.has(requiredPermissions)) {
      await interaction.reply({
        content: '❌ You do not have permission to use this command.',
        ephemeral: true
      });
      return false;
    }

    return true;
  };
}

module.exports = { checkPermissions };