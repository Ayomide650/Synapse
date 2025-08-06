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
      const uid = interaction.fields.getTextInputValue('uid');
      const region = interaction.fields.getTextInputValue('region').toLowerCase();
      const userId = interaction.user.id;
      const verificationKey = `${userId}-${uid}`;

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

      // Fetch initial account info to validate UID
      const accountInfo = await this.fetchAccountInfo(uid, region);
      if (!accountInfo) {
        await interaction.reply({
          content: '❌ Could not fetch account information. Please check your UID and region.',
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

      await interaction.reply({
        embeds: [embed],
        ephemeral: true
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
      await interaction.reply({
        content: '❌ An error occurred during verification. Please try again.',
        ephemeral: true
      });
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
        await this.sendVerificationFailureDM(verificationData.userId, client, 'Failed to fetch account information');
        pendingVerifications.delete(verificationKey);
        return;
      }

      // Check if signature matches verification code
      if (currentInfo['Account Signature'] === verificationData.code) {
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
            console.error('Verified role not found');
          }
        }
      } else {
        // Verification failed - signature doesn't match
        await this.sendVerificationFailureDM(verificationData.userId, client, null);
      }

      // Clean up verification data
      pendingVerifications.delete(verificationKey);

    } catch (error) {
      console.error('Error during automatic verification:', error);
      const verificationData = pendingVerifications.get(verificationKey);
      if (verificationData) {
        await this.sendVerificationFailureDM(verificationData.userId, client, 'An unexpected error occurred');
        pendingVerifications.delete(verificationKey);
      }
    }
  },

  async sendVerificationFailureDM(userId, client, customError = null) {
    try {
      const user = await client.users.fetch(userId);
      const message = customError || 'Unable to verify your uid, Please try again';
      
      await user.send(`❌ ${message}`);
    } catch (error) {
      console.error('Failed to send verification failure DM:', error);
    }
  },

  async fetchAccountInfo(uid, region) {
    try {
      const response = await fetch(`${BASE_URL}/${region}/${uid}?key=${API_KEY}`);
      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      console.error('Error fetching account info:', error);
      return null;
    }
  },

  generateVerificationCode() {
    return Array(3).fill(0).map(() => 
      crypto.randomBytes(3).toString('hex')
    ).join('-');
  }
};