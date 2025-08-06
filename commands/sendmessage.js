const { 
  SlashCommandBuilder, 
  PermissionFlagsBits, 
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sendmessage')
    .setDescription('Send a message to a specific channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Channel to send the message to')
        .setRequired(true)),

  async execute(interaction) {
    try {
      const targetChannel = interaction.options.getChannel('channel');

      // Create the modal
      const modal = new ModalBuilder()
        .setCustomId('sendMessageModal')
        .setTitle('Send Channel Message');

      // Add message input
      const messageInput = new TextInputBuilder()
        .setCustomId('messageContent')
        .setLabel('Message Content')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Enter your message here...')
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(2000);

      // Add ping everyone option
      const pingEveryoneInput = new TextInputBuilder()
        .setCustomId('pingEveryone')
        .setLabel('Ping @everyone? (yes/no)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('yes or no')
        .setRequired(true)
        .setMinLength(2)
        .setMaxLength(3);

      // Add inputs to modal
      const firstActionRow = new ActionRowBuilder().addComponents(messageInput);
      const secondActionRow = new ActionRowBuilder().addComponents(pingEveryoneInput);
      modal.addComponents(firstActionRow, secondActionRow);

      // Show the modal
      await interaction.showModal(modal);

      // Wait for modal submission
      const filter = i => i.customId === 'sendMessageModal';
      const submission = await interaction.awaitModalSubmit({ filter, time: 300000 });

      if (submission) {
        const message = submission.fields.getTextInputValue('messageContent');
        const pingEveryone = submission.fields.getTextInputValue('pingEveryone').toLowerCase() === 'yes';

        // Send the message
        await targetChannel.send({
          content: `${pingEveryone ? '@everyone\n' : ''}${message}`
        });

        // Log the action in console
        console.log(`Message sent to ${targetChannel.name} by ${interaction.user.tag}`);

        // Confirm to the user
        await submission.reply({
          content: `✅ Message sent to ${targetChannel}!`,
          ephemeral: true
        });
      }

    } catch (error) {
      console.error('Error in sendmessage command:', error);

      // Handle modal timeout
      if (error.code === 'INTERACTION_COLLECTOR_ERROR') {
        await interaction.followUp({
          content: '❌ Time ran out. Please try the command again.',
          ephemeral: true
        });
        return;
      }

      // Handle other errors
      try {
        const reply = {
          content: '❌ Failed to send message. Please check my permissions and try again.',
          ephemeral: true
        };

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(reply);
        } else {
          await interaction.reply(reply);
        }
      } catch (err) {
        console.error('Error handling error:', err);
      }
    }
  }
};