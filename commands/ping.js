const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '../data/server_data.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check bot latency and performance metrics'),

  async execute(interaction) {
    try {
      const sent = await interaction.reply({ 
        content: '📡 Testing latency...', 
        fetchReply: true 
      });

      // Test file read/write speed
      const start = process.hrtime();
      const fileExists = fs.existsSync(DATA_PATH);
      if (fileExists) {
        const data = JSON.parse(fs.readFileSync(DATA_PATH));
        fs.writeFileSync(DATA_PATH, JSON.stringify(data));
      }
      const [seconds, nanoseconds] = process.hrtime(start);
      const fileIOTime = ((seconds * 1000) + (nanoseconds / 1000000)).toFixed(2);

      // Calculate latencies
      const wsHeartbeat = interaction.client.ws.ping;
      const msgLatency = sent.createdTimestamp - interaction.createdTimestamp;
      
      // Color code based on highest latency
      const maxLatency = Math.max(wsHeartbeat, msgLatency);
      const color = maxLatency < 100 ? 0x00ff00 : maxLatency < 200 ? 0xffff00 : 0xff0000;

      const embed = new EmbedBuilder()
        .setTitle('🏓 Pong!')
        .setColor(color)
        .addFields(
          { 
            name: '📶 Latency',
            value: `
• API Latency: ${wsHeartbeat}ms
• Message Latency: ${msgLatency}ms
• File I/O Speed: ${fileIOTime}ms
            `,
            inline: false
          }
        )
        .setFooter({ text: 'Color indicates overall performance' })
        .setTimestamp();

      await interaction.editReply({ content: null, embeds: [embed] });

    } catch (error) {
      console.error('Error in ping command:', error);
      await interaction.editReply('❌ Error checking latency. Please try again.');
    }
  }
};