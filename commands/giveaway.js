const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

// Store active giveaways
const activeGiveaways = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Create a new giveaway')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    try {
      const modal = new ModalBuilder()
        .setCustomId('giveaway_create')
        .setTitle('Create Giveaway');

      const prizeInput = new TextInputBuilder()
        .setCustomId('prize')
        .setLabel('Prize')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(100);

      const durationInput = new TextInputBuilder()
        .setCustomId('duration')
        .setLabel('Duration in minutes')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('Enter duration in minutes (e.g., 60)');

      const winnersInput = new TextInputBuilder()
        .setCustomId('winners')
        .setLabel('Number of Winners')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('Enter a number');

      const descriptionInput = new TextInputBuilder()
        .setCustomId('description')
        .setLabel('Description (Optional)')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setMaxLength(500);

      modal.addComponents(
        new ActionRowBuilder().addComponents(prizeInput),
        new ActionRowBuilder().addComponents(durationInput),
        new ActionRowBuilder().addComponents(winnersInput),
        new ActionRowBuilder().addComponents(descriptionInput)
      );

      await interaction.showModal(modal);
    } catch (error) {
      console.error('Error creating giveaway:', error);
      await interaction.reply({
        content: '❌ Failed to create giveaway. Please try again.',
        ephemeral: true
      });
    }
  },

  async handleModalSubmit(interaction) {
    if (interaction.customId !== 'giveaway_create') return;

    try {
      const prize = interaction.fields.getTextInputValue('prize');
      const duration = parseInt(interaction.fields.getTextInputValue('duration'));
      const winners = parseInt(interaction.fields.getTextInputValue('winners'));
      const description = interaction.fields.getTextInputValue('description') || null;

      // Validate inputs
      if (isNaN(duration) || duration < 1) {
        throw new Error('Duration must be a positive number of minutes.');
      }
      if (isNaN(winners) || winners < 1) {
        throw new Error('Number of winners must be a positive number.');
      }

      const endTime = new Date(Date.now() + duration * 60000);
      const giveawayId = Date.now().toString();

      // Create giveaway embed
      const embed = new EmbedBuilder()
        .setTitle('🎉 Giveaway Active')
        .setDescription(
          `**Prize:** ${prize}\n` +
          `${description ? `**Description:** ${description}\n` : ''}` +
          `**Winners:** ${winners}\n` +
          `**Participants:** 0\n` +
          `**Ends:** <t:${Math.floor(endTime.getTime() / 1000)}:R>`
        )
        .setColor(0x00ff00)
        .setTimestamp();

      const participateButton = new ButtonBuilder()
        .setCustomId(`participate_${giveawayId}`)
        .setLabel('🎁 Participate')
        .setStyle(ButtonStyle.Primary);

      const endButton = new ButtonBuilder()
        .setCustomId(`end_${giveawayId}`)
        .setLabel('End Giveaway')
        .setStyle(ButtonStyle.Danger);

      const row = new ActionRowBuilder().addComponents(participateButton, endButton);
      const giveawayMessage = await interaction.channel.send({ embeds: [embed], components: [row] });

      // Store giveaway data
      activeGiveaways.set(giveawayId, {
        messageId: giveawayMessage.id,
        channel: interaction.channel,
        prize,
        description,
        winners,
        endTime,
        participants: [],
        hostId: interaction.user.id
      });

      // Set timeout to end giveaway
      setTimeout(() => this.endGiveaway(giveawayId), duration * 60000);

      await interaction.reply({
        content: `🎉 Giveaway created successfully! It will end ${duration} minutes from now.`,
        ephemeral: true
      });

    } catch (error) {
      await interaction.reply({
        content: `❌ Error: ${error.message}`,
        ephemeral: true
      });
    }
  },

  async handleButton(interaction) {
    const { customId } = interaction;
    if (!customId.startsWith('participate_') && !customId.startsWith('end_')) return;

    const giveawayId = customId.split('_')[1];
    const giveaway = activeGiveaways.get(giveawayId);

    if (!giveaway) {
      await interaction.reply({
        content: 'This giveaway is no longer active.',
        ephemeral: true
      });
      return;
    }

    if (customId.startsWith('participate_')) {
      if (giveaway.participants.includes(interaction.user.id)) {
        await interaction.reply({
          content: 'You are already participating in this giveaway!',
          ephemeral: true
        });
        return;
      }

      giveaway.participants.push(interaction.user.id);
      await this.updateGiveawayMessage(giveaway, giveawayId);
      await interaction.reply({
        content: 'You have successfully joined the giveaway! Good luck! 🍀',
        ephemeral: true
      });

    } else if (customId.startsWith('end_')) {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator) &&
          interaction.user.id !== giveaway.hostId) {
        await interaction.reply({
          content: 'Only administrators or the giveaway host can end the giveaway.',
          ephemeral: true
        });
        return;
      }

      await this.endGiveaway(giveawayId);
      await interaction.reply({
        content: 'Giveaway ended manually!',
        ephemeral: true
      });
    }
  },

  async updateGiveawayMessage(giveaway, giveawayId) {
    const embed = new EmbedBuilder()
      .setTitle('🎉 Giveaway Active')
      .setDescription(
        `**Prize:** ${giveaway.prize}\n` +
        `${giveaway.description ? `**Description:** ${giveaway.description}\n` : ''}` +
        `**Winners:** ${giveaway.winners}\n` +
        `**Participants:** ${giveaway.participants.length}\n` +
        `**Ends:** <t:${Math.floor(giveaway.endTime.getTime() / 1000)}:R>`
      )
      .setColor(0x00ff00)
      .setTimestamp();

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`participate_${giveawayId}`)
        .setLabel('🎁 Participate')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`end_${giveawayId}`)
        .setLabel('End Giveaway')
        .setStyle(ButtonStyle.Danger)
    );

    const message = await giveaway.channel.messages.fetch(giveaway.messageId);
    await message.edit({ embeds: [embed], components: [buttons] });
  },

  async endGiveaway(giveawayId) {
    const giveaway = activeGiveaways.get(giveawayId);
    if (!giveaway) return;

    try {
      const message = await giveaway.channel.messages.fetch(giveaway.messageId);
      let winnersList = [];

      if (giveaway.participants.length === 0) {
        const embed = new EmbedBuilder()
          .setTitle('🎉 Giveaway Ended')
          .setDescription(
            `**Prize:** ${giveaway.prize}\n\n` +
            `❌ No participants joined this giveaway.`
          )
          .setColor(0xff0000)
          .setTimestamp();

        await message.edit({ embeds: [embed], components: [] });
      } else {
        // Randomly select winners
        const shuffled = [...giveaway.participants].sort(() => 0.5 - Math.random());
        winnersList = shuffled.slice(0, Math.min(giveaway.winners, giveaway.participants.length));
        const winnersText = winnersList.map(id => `<@${id}>`).join(', ');

        const embed = new EmbedBuilder()
          .setTitle('🎉 Giveaway Ended')
          .setDescription(
            `**Prize:** ${giveaway.prize}\n\n` +
            `🏆 **Winners:** ${winnersText}\n\n` +
            `**Total Participants:** ${giveaway.participants.length}`
          )
          .setColor(0x00ff00)
          .setTimestamp();

        await message.edit({ embeds: [embed], components: [] });

        // Tag winners in a separate message
        await giveaway.channel.send(
          `🎉 Congratulations ${winnersText}! You won: **${giveaway.prize}**`
        );
      }

      activeGiveaways.delete(giveawayId);

    } catch (error) {
      console.error('Error ending giveaway:', error);
    }
  }
};