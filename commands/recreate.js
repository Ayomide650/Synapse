const { SlashCommandBuilder, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('recreate')
    .setDescription('Delete and recreate a channel with preserved permissions')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Channel to recreate (default: current channel)')
        .setRequired(false)),

  async execute(interaction) {
    try {
      const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

      // Show confirmation modal
      const modal = new ModalBuilder()
        .setCustomId('recreateConfirmModal')
        .setTitle('Confirm Channel Recreation');

      const reasonInput = new TextInputBuilder()
        .setCustomId('recreateReason')
        .setLabel('Reason for recreation (optional)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Enter reason...')
        .setRequired(false)
        .setMaxLength(100);

      const confirmInput = new TextInputBuilder()
        .setCustomId('recreateConfirm')
        .setLabel('Type CONFIRM to proceed')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('CONFIRM')
        .setRequired(true)
        .setMaxLength(7);

      const firstRow = new ActionRowBuilder().addComponents(reasonInput);
      const secondRow = new ActionRowBuilder().addComponents(confirmInput);
      modal.addComponents(firstRow, secondRow);

      await interaction.showModal(modal);

      // Wait for modal submission
      const filter = i => i.customId === 'recreateConfirmModal';
      const submission = await interaction.awaitModalSubmit({ filter, time: 60000 }).catch(() => null);

      if (!submission) {
        return await interaction.followUp({
          content: '❌ Time ran out. Channel recreation cancelled.',
          ephemeral: true
        });
      }

      const confirm = submission.fields.getTextInputValue('recreateConfirm');
      if (confirm !== 'CONFIRM') {
        return await submission.reply({
          content: '❌ Channel recreation cancelled. You did not type CONFIRM.',
          ephemeral: true
        });
      }

      const reason = submission.fields.getTextInputValue('recreateReason') || 'No reason provided';

      // Store channel data
      const name = targetChannel.name;
      const type = targetChannel.type;
      const parent = targetChannel.parent;
      const position = targetChannel.position;
      const permissionOverwrites = targetChannel.permissionOverwrites.cache.toJSON();
      const topic = targetChannel.topic;
      const nsfw = targetChannel.nsfw;
      const rateLimitPerUser = targetChannel.rateLimitPerUser;

      // Create progress message
      await submission.reply({
        content: '🔄 Starting channel recreation process...',
        ephemeral: true
      });

      // Delete the channel
      await targetChannel.delete(`Channel recreation requested by ${interaction.user.tag} - ${reason}`);

      // Create new channel with same settings
      const newChannel = await interaction.guild.channels.create({
        name,
        type,
        parent,
        position,
        permissionOverwrites,
        topic,
        nsfw,
        rateLimitPerUser
      });

      // Update the response
      await submission.editReply({
        content: `✅ Channel successfully recreated!\nOld Channel: ${targetChannel.name}\nNew Channel: ${newChannel}\nReason: ${reason}`,
        ephemeral: true
      });

    } catch (error) {
      console.error('Error in recreate command:', error);
      try {
        const reply = {
          content: '❌ Failed to recreate channel. Please check my permissions and try again.',
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