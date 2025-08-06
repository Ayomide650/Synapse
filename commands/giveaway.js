const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

// Store active giveaways
const activeGiveaways = new Map();

// Utility function to parse time with Nigeria timezone (WAT - UTC+1)
function parseTime(timeString) {
    const timeRegex = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i;
    const match = timeString.match(timeRegex);
    
    if (!match) {
        throw new Error('Invalid time format. Please use format like "5:30PM" or "11:45AM"');
    }
    
    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const period = match[3].toUpperCase();
    
    if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) {
        throw new Error('Invalid time values. Hours must be 1-12, minutes 0-59');
    }
    
    // Convert to 24-hour format
    if (period === 'AM' && hours === 12) {
        hours = 0;
    } else if (period === 'PM' && hours !== 12) {
        hours += 12;
    }
    
    // Get current time in Nigeria timezone (WAT - UTC+1)
    const now = new Date();
    const nowInNigeria = new Date(now.getTime() + (1 * 60 * 60 * 1000)); // Add 1 hour for WAT
    
    // Create the target time in Nigeria timezone
    const endTimeInNigeria = new Date(nowInNigeria);
    endTimeInNigeria.setHours(hours, minutes, 0, 0);
    
    // If time has already passed today in Nigeria time, set for tomorrow
    if (endTimeInNigeria <= nowInNigeria) {
        endTimeInNigeria.setDate(endTimeInNigeria.getDate() + 1);
    }
    
    // Convert back to UTC for storage (subtract 1 hour)
    const endTimeUTC = new Date(endTimeInNigeria.getTime() - (1 * 60 * 60 * 1000));
    
    return endTimeUTC;
}

// Function to format date consistently in Nigeria timezone
function formatEndTime(date) {
    // Convert UTC time to Nigeria time (WAT - UTC+1)
    const nigeriaTime = new Date(date.getTime() + (1 * 60 * 60 * 1000));
    
    const options = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    };
    
    return nigeriaTime.toLocaleString('en-US', options) + ' WAT';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Create a new giveaway')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    try {
      // Check if command is used in the designated giveaway channel (if env variable is set)
      if (process.env.GIVEAWAY_CHANNEL_ID && interaction.channel.id !== process.env.GIVEAWAY_CHANNEL_ID) {
        await interaction.reply({ 
          content: 'This command can only be used in the designated giveaway channel.', 
          ephemeral: true 
        });
        return;
      }

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
        .setLabel('End Time (e.g., 5:30PM)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('Format: 5:30PM or 11:45AM');

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

  async handleModal(interaction) {
    if (interaction.customId !== 'giveaway_create') return;

    try {
      const prize = interaction.fields.getTextInputValue('prize');
      const duration = interaction.fields.getTextInputValue('duration');
      const winners = parseInt(interaction.fields.getTextInputValue('winners'));
      const description = interaction.fields.getTextInputValue('description') || null;

      // Validate inputs
      if (isNaN(winners) || winners < 1) {
        throw new Error('Number of winners must be a positive number.');
      }

      const endTime = parseTime(duration);
      const giveawayId = Date.now().toString();

      console.log(`Creating giveaway ${giveawayId}`);
      console.log(`Input time: ${duration}`);
      console.log(`Parsed end time (UTC): ${endTime.toISOString()}`);
      console.log(`Display end time (WAT): ${formatEndTime(endTime)}`);

      // Create giveaway embed
      const embed = new EmbedBuilder()
        .setTitle('🎉 Giveaway Active')
        .setDescription(
          `**Prize:** ${prize}\n` +
          `${description ? `**Description:** ${description}\n` : ''}` +
          `**Winners:** ${winners}\n` +
          `**Participants:** 0\n` +
          `**Ends:** ${formatEndTime(endTime)}`
        )
        .setColor(0x00ff00)
        .setTimestamp();

      const participateButton = new ButtonBuilder()
        .setCustomId(`participate_${giveawayId}`)
        .setLabel('🎁 Participate')
        .setStyle(ButtonStyle.Primary);

      const endButton = new ButtonBuilder()
        .setCustomId(`end_${giveawayId}`)
        .setLabel('END')
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

      await interaction.reply({
        content: `🎉 Giveaway created successfully! It will end at **${formatEndTime(endTime)}**`,
        ephemeral: true
      });

    } catch (error) {
      console.error('Error in modal submit:', error);
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
    try {
      const embed = new EmbedBuilder()
        .setTitle('🎉 Giveaway Active')
        .setDescription(
          `**Prize:** ${giveaway.prize}\n` +
          `${giveaway.description ? `**Description:** ${giveaway.description}\n` : ''}` +
          `**Winners:** ${giveaway.winners}\n` +
          `**Participants:** ${giveaway.participants.length}\n` +
          `**Ends:** ${formatEndTime(giveaway.endTime)}`
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
          .setLabel('END')
          .setStyle(ButtonStyle.Danger)
      );

      const message = await giveaway.channel.messages.fetch(giveaway.messageId);
      await message.edit({ embeds: [embed], components: [buttons] });
    } catch (error) {
      console.error('Error updating giveaway message:', error);
    }
  },

  async endGiveaway(giveawayId, forceEnd = false) {
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
        if (winnersList.length > 0) {
          await giveaway.channel.send(
            `🎉 Congratulations ${winnersText}! You won: **${giveaway.prize}**`
          );
        }
      }

      activeGiveaways.delete(giveawayId);
      console.log(`Giveaway ${giveawayId} ended at ${new Date().toISOString()}`);

    } catch (error) {
      console.error('Error ending giveaway:', error);
    }
  },

  // Method to check and end expired giveaways (to be called by a cron job or timer)
  checkExpiredGiveaways() {
    const now = new Date();
    
    for (const [giveawayId, giveaway] of activeGiveaways) {
      if (now >= giveaway.endTime) {
        console.log(`Ending expired giveaway ${giveawayId}`);
        this.endGiveaway(giveawayId);
      }
    }
  },

  // Getter for active giveaways (useful for debugging)
  getActiveGiveaways() {
    return activeGiveaways;
  }
};
