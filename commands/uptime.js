const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const os = require('os');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('uptime')
    .setDescription('Display bot uptime and system statistics'),

  async execute(interaction) {
    try {
      // Get bot uptime
      const uptime = process.uptime();
      const days = Math.floor(uptime / 86400);
      const hours = Math.floor((uptime % 86400) / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);
      const seconds = Math.floor(uptime % 60);

      // Get system memory usage
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const memUsage = ((usedMem / totalMem) * 100).toFixed(2);

      // Get process memory usage
      const processMemory = process.memoryUsage();
      const heapUsed = (processMemory.heapUsed / 1024 / 1024).toFixed(2);
      const heapTotal = (processMemory.heapTotal / 1024 / 1024).toFixed(2);

      // Get JSON storage size
      const dataFolder = path.join(__dirname, '../data');
      let storageSize = 0;
      if (fs.existsSync(dataFolder)) {
        const files = fs.readdirSync(dataFolder);
        for (const file of files) {
          if (file.endsWith('.json')) {
            const stats = fs.statSync(path.join(dataFolder, file));
            storageSize += stats.size;
          }
        }
      }
      const storageMB = (storageSize / 1024 / 1024).toFixed(2);

      const embed = new EmbedBuilder()
        .setTitle('⏰ System Status')
        .setColor(0x3498db)
        .addFields(
          {
            name: '🕒 Uptime',
            value: `${days}d ${hours}h ${minutes}m ${seconds}s`,
            inline: false
          },
          {
            name: '💾 Memory Usage',
            value: `
• System: ${memUsage}% (${(usedMem / 1024 / 1024 / 1024).toFixed(2)}GB / ${(totalMem / 1024 / 1024 / 1024).toFixed(2)}GB)
• Bot: ${heapUsed}MB / ${heapTotal}MB allocated
• JSON Storage: ${storageMB}MB
            `,
            inline: false
          },
          {
            name: '🖥️ System Info',
            value: `
• Platform: ${os.platform()} ${os.release()}
• CPU: ${os.cpus()[0].model}
• Load Average: ${os.loadavg().map(x => x.toFixed(2)).join(', ')}
            `,
            inline: false
          }
        )
        .setFooter({ text: `Last Restart: ${new Date(Date.now() - (uptime * 1000)).toLocaleString()}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in uptime command:', error);
      await interaction.reply({
        content: '❌ Failed to fetch system statistics. Please try again.',
        ephemeral: true
      });
    }
  }
};