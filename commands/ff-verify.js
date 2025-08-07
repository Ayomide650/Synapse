const { SlashCommandBuilder, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const fetch = require('node-fetch');
const crypto = require('crypto');

const API_KEY = 'astute_ff';
const BASE_URL = 'https://www.public.freefireinfo.site/api/info';
const VERIFY_ROLE_NAME = 'Verified';
const pendingVerifications = new Map(); // Key: `${userId}-${uid}`, Value: verification data

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ff-verify')
    .setDescription('Verify your Free Fire account'),

  async execute(interaction) {
    try {
      const modal = new ModalBuilder()
        .setCustomId('ff_verify_modal')
        .setTitle('Free Fire Verification');

      const uidInput = new TextInputBuilder()
        .setCustomId('uid')
        .setLabel('Your Free Fire UID')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('Enter your Free Fire User ID');

      const regionInput = new TextInputBuilder()
        .setCustomId('region')
        .setLabel('Your Server Region')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('sg, ind, br, id, tw, us, sac, th, me, pk, cis, bd');

      modal.addComponents(
        new ActionRowBuilder().addComponents(uidInput),
        new ActionRowBuilder().addComponents(regionInput)
      );

      await interaction.showModal(modal);

    } catch (error) {
      console.error('Error in ff-verify command:', error);
      await interaction.reply({
        content: '❌ Failed to start verification process. Please try again.',
        ephemeral: true
      });
    }
  },

  async handleVerificationModal(interaction) {
    try {
      const uid = interaction.fields.getTextInputValue('uid').trim();
      const region = interaction.fields.getTextInputValue('region').toLowerCase().trim();
      const userId = interaction.user.id;
      const verificationKey = `${userId}-${uid}`;

      // Validate UID (should be numeric and reasonable length)
      if (!/^\d+$/.test(uid) || uid.length < 8 || uid.length > 12) {
        await interaction.reply({
          content: '❌ Invalid UID format. Please enter a valid numeric Free Fire UID (8-12 digits).',
          ephemeral: true
        });
        return;
      }

      // Validate region
      const validRegions = ['sg', 'ind', 'br', 'id', 'tw', 'us', 'sac', 'th', 'me', 'pk', 'cis', 'bd'];
      if (!validRegions.includes(region)) {
        await interaction.reply({
          content: '❌ Invalid region. Please use one of: ' + validRegions.join(', '),
          ephemeral: true
        });
        return;
      }

      // Check if same UID is already being verified within 5 minutes
      const existingVerification = pendingVerifications.get(verificationKey);
      if (existingVerification && Date.now() < existingVerification.expires) {
        // Return same UUID for same UID within 5 minutes
        // Get account info for personalized message
        const accountInfo = await this.fetchAccountInfo(uid, region);
        const accountName = accountInfo ? accountInfo['Account Name'] : 'User';
        
        const embed = new EmbedBuilder()
          .setTitle('🎮 Free Fire Verification')
          .setColor(0x2f3136)
          .setDescription(
            `Hey **${accountName}**\n\n` +
            `You already have an active verification!\n\n` +
            `Copy this uuid into your signature box in free fire\n\n` +
            `**UUID: \`${existingVerification.code}\`**\n\n` +
            `Close this page after copying the uuid, this uuid will expire in ${Math.ceil((existingVerification.expires - Date.now()) / 1000 / 60)} minutes.\n` +
            `You have ${Math.ceil((existingVerification.expires - Date.now()) / 1000 / 60)} minutes to set your temporary signature to the uuid to get the role **Verified**.`
          )
          .setFooter({ text: 'UUID expires soon' })
          .setTimestamp();

        await interaction.reply({
          embeds: [embed],
          ephemeral: true
        });
        return;
      }

      // Show initial loading message
      await interaction.reply({
        content: '🔍 Checking your Free Fire account...',
        ephemeral: true
      });

      // Fetch initial account info to validate UID
      const accountInfo = await this.fetchAccountInfo(uid, region);
      if (!accountInfo) {
        await interaction.editReply({
          content: '❌ Account doesn\'t exist. Please check your UID and region and try again.',
          ephemeral: true
        });
        return;
      }

      // Generate new verification code (UUID)
      const verificationCode = this.generateVerificationCode();
      const expiresAt = Date.now() + 300000; // 5 minutes

      // Store verification data
      pendingVerifications.set(verificationKey, {
        userId,
        uid,
        region,
        code: verificationCode,
        expires: expiresAt,
        initialSignature: accountInfo['Account Signature']
      });

      // Show personalized message with account name
      const embed = new EmbedBuilder()
        .setTitle('🎮 Free Fire Verification')
        .setColor(0x2f3136)
        .setDescription(
          `Hey **${accountInfo['Account Name']}**\n\n` +
          `Copy this uuid into your signature box in free fire\n\n` +
          `**UUID: \`${verificationCode}\`**\n\n` +
          `Close this page after copying the uuid, this uuid will expire in 5 minutes.\n` +
          `You have 5 minutes to set your temporary signature to the uuid to get the role **Verified**.`
        )
        .setFooter({ text: 'UUID expires in 5 minutes' })
        .setTimestamp();

      await interaction.editReply({
        content: '',
        embeds: [embed]
      });

      // Set automatic verification timer
      setTimeout(async () => {
        await this.performAutomaticVerification(verificationKey, interaction.guild, interaction.client);
      }, 300000); // 5 minutes

      // Set cleanup timer (in case verification fails)
      setTimeout(() => {
        pendingVerifications.delete(verificationKey);
      }, 360000); // 6 minutes (cleanup after verification attempt)

    } catch (error) {
      console.error('Error handling verification modal:', error);
      
      // Check if interaction was already replied to
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({
          content: '❌ An error occurred during verification. Please try again.',
        });
      } else {
        await interaction.reply({
          content: '❌ An error occurred during verification. Please try again.',
          ephemeral: true
        });
      }
    }
  },

  async performAutomaticVerification(verificationKey, guild, client) {
    try {
      const verificationData = pendingVerifications.get(verificationKey);
      if (!verificationData) {
        console.log('Verification data not found for key:', verificationKey);
        return;
      }

      // Fetch current account info
      const currentInfo = await this.fetchAccountInfo(verificationData.uid, verificationData.region);
      if (!currentInfo) {
        console.error('Failed to fetch account info during verification');
        await this.sendVerificationFailureDM(verificationData.userId, client, 'Failed to fetch account information during verification');
        pendingVerifications.delete(verificationKey);
        return;
      }

      // Check if signature matches verification code
      if (currentInfo['Account Signature'] && currentInfo['Account Signature'].includes(verificationData.code)) {
        // Verification successful!
        const member = await guild.members.fetch(verificationData.userId).catch(() => null);
        if (member) {
          const role = guild.roles.cache.find(r => r.name === VERIFY_ROLE_NAME);
          if (role) {
            await member.roles.add(role);
            console.log(`Successfully verified user ${verificationData.userId} with UID ${verificationData.uid}`);
            
            // Send success DM
            try {
              const user = await client.users.fetch(verificationData.userId);
              const successEmbed = new EmbedBuilder()
                .setTitle('✅ Verification Successful!')
                .setColor(0x00ff00)
                .setDescription(
                  `Your Free Fire account has been verified successfully!\n\n` +
                  `**Account:** ${currentInfo['Account Name']}\n` +
                  `**UID:** ${verificationData.uid}\n` +
                  `**Region:** ${verificationData.region.toUpperCase()}\n\n` +
                  `You now have the "Verified" role and can change your signature back.`
                )
                .setTimestamp();

              await user.send({ embeds: [successEmbed] });
            } catch (dmError) {
              console.log('Could not send success DM:', dmError.message);
            }
          } else {
            console.error('Verified role not found in guild');
            await this.sendVerificationFailureDM(verificationData.userId, client, 'Verified role not found in server');
          }
        } else {
          console.error('Member not found in guild');
          await this.sendVerificationFailureDM(verificationData.userId, client, 'Member not found in server');
        }
      } else {
        // Verification failed - signature doesn't match
        await this.sendVerificationFailureDM(verificationData.userId, client, 'UUID not found in your signature. Please make sure you set the UUID exactly as provided.');
      }

      // Clean up verification data
      pendingVerifications.delete(verificationKey);

    } catch (error) {
      console.error('Error during automatic verification:', error);
      const verificationData = pendingVerifications.get(verificationKey);
      if (verificationData) {
        await this.sendVerificationFailureDM(verificationData.userId, client, 'An unexpected error occurred during verification');
        pendingVerifications.delete(verificationKey);
      }
    }
  },

  async sendVerificationFailureDM(userId, client, customError = null) {
    try {
      const user = await client.users.fetch(userId);
      const message = customError || 'Unable to verify your UID. Please try again.';
      
      const failEmbed = new EmbedBuilder()
        .setTitle('❌ Verification Failed')
        .setColor(0xff0000)
        .setDescription(`${message}\n\nYou can try the verification process again using \`/ff-verify\`.`)
        .setTimestamp();

      await user.send({ embeds: [failEmbed] });
    } catch (error) {
      console.error('Failed to send verification failure DM:', error);
    }
  },

  async fetchAccountInfo(uid, region) {
    try {
      console.log(`Fetching account info for UID: ${uid}, Region: ${region}`);
      const url = `${BASE_URL}/${region}/${uid}?key=${API_KEY}`;
      console.log(`API URL: ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Discord-Bot/1.0',
          'Accept': 'application/json'
        },
        timeout: 10000 // 10 second timeout
      });

      console.log(`API Response Status: ${response.status}`);

      if (response.status === 400) {
        console.log('API returned 400 - Invalid region or request');
        return null;
      }

      if (response.status === 429) {
        console.log('API returned 429 - Rate limited');
        return null;
      }

      if (response.status === 500) {
        console.log('API returned 500 - Account not found or server error');
        return null;
      }

      if (!response.ok) {
        console.log(`API returned status ${response.status}`);
        return null;
      }

      const data = await response.json();
      console.log('Account info fetched successfully');
      
      // Validate that we have the required fields
      if (!data || !data['Account Name'] || !data['Account UID']) {
        console.log('Invalid account data structure');
        return null;
      }
      
      return data;

    } catch (error) {
      console.error('Error fetching account info:', error.message);
      
      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        console.error('Network error - API might be down');
      } else if (error.name === 'AbortError') {
        console.error('Request timeout');
      }
      
      return null;
    }
  },

  generateVerificationCode() {
    return Array(3).fill(0).map(() => 
      crypto.randomBytes(3).toString('hex')
    ).join('-');
  }
};
