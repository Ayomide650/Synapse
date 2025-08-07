const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits } = require('discord.js');
const cron = require('node-cron');

// Store active giveaways
const activeGiveaways = new Map();

// Initialize cron job when module loads
if (!global.giveawayCronInitialized) {
  cron.schedule('* * * * *', () => {
    const now = new Date();
    
    for (const [giveawayId, giveaway] of activeGiveaways) {
      if (now >= giveaway.endTime) {
        console.log(`Ending giveaway ${giveawayId} now`);
        endGiveaway(giveawayId);
      }
    }
  });
  
  global.giveawayCronInitialized = true;
  console.log('🎉 Giveaway cron job initialized');
}

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

// Function to end giveaway
async function endGiveaway(giveawayId, forceEnd = false) {
  const giveaway = activeGiveaways.get(giveawayId);
  if (!giveaway) return;
  
  const { channel, messageId, participants, winners: numWinners, prize } = giveaway;
  
  try {
    const message = await channel.messages.fetch(messageId);
    let winnersList = [];
    
    if (participants.length === 0) {
      const embed = new EmbedBuilder()
        .setTitle('🎉 Giveaway Ended')
        .setDescription(`**Prize:** ${prize}\n\n❌ No participants joined this giveaway.`)
        .setColor('#ff0000')
        .setTimestamp();
      
      await message.edit({ embeds: [embed], components: [] });
    } else {
      // Randomly select winners
      const shuffled = [...participants].sort(() => 0.5 - Math.random());
      winnersList = shuffled.slice(0, Math.min(numWinners, participants.length));
      
      const winnersText = winnersList.map(id => `<@${id}>`).join(', ');
      
      const embed = new EmbedBuilder()
        .setTitle('🎉 Giveaway Ended')
        .setDescription(`**Prize:** ${prize}\n\n🏆 **Winners:** ${winnersText}\n\n**Total Participants:** ${participants.length}`)
        .setColor('#00ff00')
        .setTimestamp();
      
      await message.edit({ embeds: [embed], components: [] });
      
      // Tag winners in a separate message
      if (winnersList.length > 0) {
        await channel.send(`🎉 Congratulations ${winnersText}! You won: **${prize}**`);
      }
    }
    
    activeGiveaways.delete(giveawayId);
    console.log(`Giveaway ${giveawayId} ended at ${new Date().toISOString()}`);
  } catch (error) {
    console.error('Error ending giveaway:', error);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Create and manage giveaways')
    .addSubcommand(subcommand =>
      subcommand
        .setName('create')
        .setDescription('Create a new giveaway')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('end')
        .setDescription('End an active giveaway')
        .addStringOption(option =>
          option
            .setName('giveaway_id')
            .setDescription('The ID of the giveaway to end')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List all active giveaways')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'create':
        await this.handleCreate(interaction);
        break;
      case 'end':
        await this.handleEnd(interaction);
        break;
      case 'list':
        await this.handleList(interaction);
        break;
    }
  },

  async handleCreate(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('🎉 Create Giveaway')
      .setDescription('Click the button below to set up your giveaway!')
      .setColor('#0099ff');

    const setupButton = new ButtonBuilder()
      .setCustomId('giveaway_setup')
      .setLabel('Setup Giveaway')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🎁');

    const row = new ActionRowBuilder().addComponents(setupButton);
    
    await interaction.reply({ embeds: [embed], components: [row] });
  },

  async handleEnd(interaction) {
    const giveawayId = interaction.options.getString('giveaway_id');
    const giveaway = activeGiveaways.get(giveawayId);
    
    if (!giveaway) {
      await interaction.reply({ 
        content: '❌ No active giveaway found with that ID.',
        ephemeral: true 
      });
      return;
    }
    
    await endGiveaway(giveawayId, true);
    await interaction.reply({ 
      content: `✅ Giveaway ${giveawayId} has been ended.`,
      ephemeral: true 
    });
  },

  async handleList(interaction) {
    if (activeGiveaways.size === 0) {
      await interaction.reply({ 
        content: 'No active giveaways found.',
        ephemeral: true 
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('🎉 Active Giveaways')
      .setColor('#0099ff')
      .setTimestamp();

    let description = '';
    for (const [giveawayId, giveaway] of activeGiveaways) {
      description += `**ID:** ${giveawayId}\n`;
      description += `**Prize:** ${giveaway.prize}\n`;
      description += `**Participants:** ${giveaway.participants.length}\n`;
      description += `**Ends:** ${formatEndTime(giveaway.endTime)}\n\n`;
    }

    embed.setDescription(description);
    await interaction.reply({ embeds: [embed], ephemeral: true });
  },

  async handleButton(interaction) {
    try {
      const { customId, user, message } = interaction;
      
      if (customId === 'giveaway_setup') {
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
        
        const firstRow = new ActionRowBuilder().addComponents(prizeInput);
        const secondRow = new ActionRowBuilder().addComponents(durationInput);
        const thirdRow = new ActionRowBuilder().addComponents(winnersInput);
        const fourthRow = new ActionRowBuilder().addComponents(descriptionInput);
        
        modal.addComponents(firstRow, secondRow, thirdRow, fourthRow);
        
        await interaction.showModal(modal);
        return;
      }
      
      if (customId.startsWith('giveaway_participate_')) {
        const giveawayId = customId.split('_')[2];
        const giveaway = activeGiveaways.get(giveawayId);
        
        if (!giveaway) {
          await interaction.reply({ content: 'This giveaway is no longer active.', ephemeral: true });
          return;
        }
        
        if (giveaway.participants.includes(user.id)) {
          await interaction.reply({ content: 'You are already participating in this giveaway!', ephemeral: true });
          return;
        }
        
        giveaway.participants.push(user.id);
        
        // Update the embed with new participant count
        const embed = new EmbedBuilder()
          .setTitle('🎉 Giveaway Active')
          .setDescription(`**Prize:** ${giveaway.prize}\n${giveaway.description ? `**Description:** ${giveaway.description}\n` : ''}\n**Winners:** ${giveaway.winners}\n**Participants:** ${giveaway.participants.length}\n**Ends:** ${formatEndTime(giveaway.endTime)}`)
          .setColor('#00ff00')
          .setTimestamp();
        
        const participateButton = new ButtonBuilder()
          .setCustomId(`giveaway_participate_${giveawayId}`)
          .setLabel('🎁 Participate')
          .setStyle(ButtonStyle.Primary);
        
        const endButton = new ButtonBuilder()
          .setCustomId(`giveaway_end_${giveawayId}`)
          .setLabel('END')
          .setStyle(ButtonStyle.Danger);
        
        const row = new ActionRowBuilder().addComponents(participateButton, endButton);
        
        await message.edit({ embeds: [embed], components: [row] });
        await interaction.reply({ content: 'You have successfully joined the giveaway! Good luck! 🍀', ephemeral: true });
        return;
      }
      
      if (customId.startsWith('giveaway_end_')) {
        const giveawayId = customId.split('_')[2];
        const giveaway = activeGiveaways.get(giveawayId);
        
        if (!giveaway) {
          await interaction.reply({ content: 'This giveaway is no longer active.', ephemeral: true });
          return;
        }
        
        // Check if user has permission to end giveaway
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
          await interaction.reply({ content: 'You do not have permission to end this giveaway.', ephemeral: true });
          return;
        }
        
        // End without winners
        const embed = new EmbedBuilder()
          .setTitle('🎉 Giveaway Ended')
          .setDescription(`**Prize:** ${giveaway.prize}\n\n❌ Giveaway ended by administrator with no winners.`)
          .setColor('#ff0000')
          .setTimestamp();
        
        await message.edit({ embeds: [embed], components: [] });
        activeGiveaways.delete(giveawayId);
        
        await interaction.reply({ content: 'Giveaway ended with no winners.', ephemeral: true });
        return;
      }
    } catch (error) {
      console.error('Error in giveaway handleButton:', error);
      
      const errorMessage = 'There was an error processing your request. Please try again.';
      
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: errorMessage, ephemeral: true });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
  },

  async handleModal(interaction) {
    try {
      if (interaction.customId !== 'giveaway_create') return;
      
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
        .setDescription(`**Prize:** ${prize}\n${description ? `**Description:** ${description}\n` : ''}\n**Winners:** ${winners}\n**Participants:** 0\n**Ends:** ${formatEndTime(endTime)}`)
        .setColor('#00ff00')
        .setTimestamp();
      
      const participateButton = new ButtonBuilder()
        .setCustomId(`giveaway_participate_${giveawayId}`)
        .setLabel('🎁 Participate')
        .setStyle(ButtonStyle.Primary);
      
      const endButton = new ButtonBuilder()
        .setCustomId(`giveaway_end_${giveawayId}`)
        .setLabel('END')
        .setStyle(ButtonStyle.Danger);
      
      const row = new ActionRowBuilder().addComponents(participateButton, endButton);
      
      const channel = interaction.channel;
      
      // Delete the setup message first
      try {
        await interaction.message.delete();
      } catch (error) {
        console.log('Could not delete setup message:', error);
      }
      
      const giveawayMessage = await channel.send({ embeds: [embed], components: [row] });
      
      // Store giveaway data
      activeGiveaways.set(giveawayId, {
        messageId: giveawayMessage.id,
        channel: channel,
        prize: prize,
        description: description,
        winners: winners,
        endTime: endTime,
        participants: []
      });
      
      await interaction.reply({ 
        content: `🎉 Giveaway created successfully! It will end at **${formatEndTime(endTime)}**\n**Giveaway ID:** ${giveawayId}`, 
        ephemeral: true 
      });
      
    } catch (error) {
      console.error('Error in giveaway handleModal:', error);
      await interaction.reply({ content: `❌ Error: ${error.message}`, ephemeral: true });
    }
  }
};
