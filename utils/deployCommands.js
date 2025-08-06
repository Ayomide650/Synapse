const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('../config/config');

const commands = [];
const commandsPath = path.join(__dirname, '../commands');

async function deployCommands() {
  try {
    console.log('📂 Loading command files...');
    
    // Clear commands array
    commands.length = 0;
    
    // Load command files
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    console.log(`📄 Found ${commandFiles.length} command files`);
    
    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      
      try {
        // Clear require cache to ensure fresh load
        delete require.cache[require.resolve(filePath)];
        const command = require(filePath);
        
        if ('data' in command && 'execute' in command) {
          const commandData = command.data.toJSON();
          commands.push(commandData);
          console.log(`✅ Loaded command: ${commandData.name}`);
        } else {
          console.log(`⚠️  [WARNING] The command at ${filePath} is missing required "data" or "execute" property.`);
        }
      } catch (commandError) {
        console.error(`❌ Error loading command ${file}:`, commandError);
      }
    }
    
    console.log(`📝 Successfully loaded ${commands.length} commands`);
    
    // Validate configuration
    if (!config.token) {
      throw new Error('DISCORD_TOKEN is not set in environment variables');
    }
    
    if (!config.clientId) {
      throw new Error('CLIENT_ID is not set in environment variables');
    }
    
    // Create REST instance
    const rest = new REST({ version: '10' }).setToken(config.token);
    
    console.log(`🚀 Started refreshing ${commands.length} application (/) commands...`);
    
    // Deploy commands
    const data = await rest.put(
      Routes.applicationCommands(config.clientId),
      { body: commands },
    );
    
    console.log(`✅ Successfully reloaded ${data.length} application (/) commands.`);
    return true;
    
  } catch (error) {
    console.error('❌ Error deploying commands:', error);
    
    // More detailed error information
    if (error.code === 50035) {
      console.error('📋 This is a form validation error. Check your command option orders.');
      console.error('💡 Make sure all required options come before optional options.');
    }
    
    if (error.rawError && error.rawError.errors) {
      console.error('🔍 Detailed errors:', JSON.stringify(error.rawError.errors, null, 2));
    }
    
    return false;
  }
}

module.exports = { deployCommands };
