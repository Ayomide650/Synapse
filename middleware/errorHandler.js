const { EmbedBuilder } = require('discord.js');
const config = require('../config/config');

class ErrorHandler {
  static async handle(error, interaction) {
    console.error('Command error:', error);

    const errorEmbed = new EmbedBuilder()
      .setColor(config.defaults.colorError)
      .setTitle('❌ Error')
      .setDescription('An error occurred while executing the command.')
      .setFooter({ text: 'Please try again later or contact an administrator.' });

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ embeds: [errorEmbed], ephemeral: true }).catch(console.error);
    } else {
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true }).catch(console.error);
    }
  }

  static handleGlobal(client) {
    process.on('unhandledRejection', error => {
      console.error('Unhandled promise rejection:', error);
    });

    client.on('error', error => {
      console.error('Client error:', error);
    });

    client.on('shardError', error => {
      console.error('Websocket connection error:', error);
    });
  }
}

module.exports = ErrorHandler;