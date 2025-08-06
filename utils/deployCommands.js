const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('../config/config');

const commands = [];
const commandsPath = path.join(__dirname, '../commands');

async function deployCommands() {
  try {
    // Load command files
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    
    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      const command = require(filePath);
      
      if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
      } else {
        console.log(`[WARNING] The command at ${filePath} is missing required "data" or "execute" property.`);
      }
    }

    // Create REST instance
    const rest = new REST().setToken(config.token);

    console.log(`Started refreshing ${commands.length} application (/) commands.`);

    // Deploy commands
    const data = await rest.put(
      Routes.applicationCommands(config.clientId),
      { body: commands },
    );

    console.log(`Successfully reloaded ${data.length} application (/) commands.`);
    return true;
  } catch (error) {
    console.error('Error deploying commands:', error);
    return false;
  }
}

module.exports = { deployCommands };