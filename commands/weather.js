const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fetch = require('node-fetch');

const WEATHER_API_KEY = '33133755e9ca4490862114921250608';
const BASE_URL = 'http://api.weatherapi.com/v1';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('weather')
    .setDescription('Get weather information for a location')
    .addStringOption(option =>
      option.setName('city')
        .setDescription('City name to get weather for')
        .setRequired(true)),

  async execute(interaction) {
    try {
      const city = interaction.options.getString('city');
      await interaction.deferReply();

      // Fetch current weather and forecast
      const response = await fetch(`${BASE_URL}/forecast.json?key=${WEATHER_API_KEY}&q=${encodeURIComponent(city)}&days=5`);
      if (!response.ok) {
        throw new Error(`Weather API returned ${response.status}`);
      }

      const data = await response.json();
      const current = data.current;
      const forecast = data.forecast.forecastday;
      const location = data.location;

      const embed = new EmbedBuilder()
        .setTitle(`Weather for ${location.name}, ${location.country}`)
        .setColor(module.exports.getWeatherColor(current.condition.code))
        .setThumbnail(`https:${current.condition.icon}`)
        .addFields(
          {
            name: '🌡️ Current Conditions',
            value: `
• Temperature: ${current.temp_c}°C (${current.temp_f}°F)
• Feels Like: ${current.feelslike_c}°C (${current.feelslike_f}°F)
• Condition: ${current.condition.text}
• Humidity: ${current.humidity}%
            `,
            inline: false
          },
          {
            name: '💨 Wind',
            value: `
• Speed: ${current.wind_kph} km/h (${current.wind_mph} mph)
• Direction: ${current.wind_dir}
• Gust: ${current.gust_kph} km/h
            `,
            inline: true
          },
          {
            name: '🌅 Other',
            value: `
• UV Index: ${current.uv}
• Visibility: ${current.vis_km} km
• Pressure: ${current.pressure_mb} mb
            `,
            inline: true
          }
        )
        .setFooter({ text: `Last Updated: ${current.last_updated}` });

      // Add forecast
      const forecastText = forecast.map(day => {
        const date = new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        return `**${date}**: ${day.day.condition.text}\n` +
               `↳ High: ${day.day.maxtemp_c}°C | Low: ${day.day.mintemp_c}°C\n` +
               `↳ Rain Chance: ${day.day.daily_chance_of_rain}%`;
      }).join('\n\n');

      embed.addFields({
        name: '📅 5-Day Forecast',
        value: forecastText,
        inline: false
      });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in weather command:', error);
      const errorMessage = error.message.includes('API')
        ? '❌ City not found. Please check the spelling and try again.'
        : '❌ Failed to fetch weather data. Please try again.';

      if (interaction.deferred) {
        await interaction.editReply({ content: errorMessage });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
  },

  // Helper method to get color based on weather condition
  getWeatherColor(code) {
    // Clear or sunny
    if (code === 1000) return 0xFFDB4D;
    // Partly cloudy or cloudy
    if (code >= 1003 && code <= 1030) return 0x7F7F7F;
    // Rain
    if (code >= 1063 && code <= 1201) return 0x3498DB;
    // Snow
    if (code >= 1210 && code <= 1237) return 0xFFFFFF;
    // Thunder
    if (code >= 1273 && code <= 1282) return 0x9B59B6;
    // Default
    return 0x2F3136;
  }
};