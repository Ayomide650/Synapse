require('dotenv').config();
const { Client, Collection, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const express = require('express');
const config = require('./config/config');
const ErrorHandler = require('./middleware/errorHandler');
const { deployCommands } = require('./utils/deployCommands');
const database = require('./utils/database');

const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ] 
});

// Debug logging
console.log('🚀 Bot starting...');
console.log('Token exists:', !!config.token);
console.log('Client ID exists:', !!config.clientId);
console.log('Token starts with:', config.token ? config.token.substring(0, 20) + '...' : 'undefined');

// Express health check server
const app = express();
const port = config.port;

app.get('/', (req, res) => {
  res.json({ 
    status: 'healthy', 
    uptime: process.uptime(),
    guilds: client.guilds.cache.size,
    commands: client.commands ? client.commands.size : 0,
    timestamp: new Date().toISOString()
  });
});

app.listen(port, () => {
  console.log(`🌐 Health check endpoint listening on port ${port}`);
});

// Command Collection
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
  }
}

console.log(`📝 Loaded ${client.commands.size} commands`);

// Debug command options order
console.log('\n=== DEBUGGING COMMANDS FOR OPTION ORDER ===');
const commandArray = Array.from(client.commands.values());

commandArray.forEach((command, index) => {
    const options = command.data.options;
    if (options && options.length > 0) {
        console.log(`\nCommand #${index}: ${command.data.name}`);
        
        let foundOptional = false;
        let hasError = false;
        
        options.forEach((option, optIndex) => {
            const isRequired = option.required === true;
            console.log(`  Option ${optIndex}: ${option.name} - Required: ${isRequired}`);
            
            if (!isRequired) {
                foundOptional = true;
            } else if (isRequired && foundOptional) {
                console.log(`  ❌ ERROR: Option ${optIndex} (${option.name}) is required but comes after optional options!`);
                hasError = true;
            }
        });
        
        if (hasError) {
            console.log(`  🔧 Command "${command.data.name}" needs option reordering!`);
        }
    }
});

console.log('\n=== END COMMAND DEBUG ===\n');

// Event Handlers
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = require(filePath);
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
}

// Ready event handler
client.once('ready', async () => {
  console.log(`✅ Bot successfully logged in as ${client.user.tag}`);
  console.log(`🌐 Bot is in ${client.guilds.cache.size} servers`);
  console.log(`📝 Bot has ${client.commands.size} commands loaded`);
  
  // Deploy commands after bot is ready
  console.log('📤 Starting command deployment...');
  const success = await deployCommands();
  if (success) {
    console.log('✅ Command deployment completed successfully');
  } else {
    console.log('❌ Command deployment failed - but bot is still online');
  }
});

// Error handler for login issues
client.on('error', error => {
  console.error('❌ Discord client error:', error);
});

// Command Interaction Handler
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  
  const command = client.commands.get(interaction.commandName);
  if (!command) return;
  
  try {
    await command.execute(interaction);
  } catch (error) {
    await ErrorHandler.handle(error, interaction);
  }
});

// Modal Interaction Handler
client.on('interactionCreate', async interaction => {
  if (!interaction.isModalSubmit()) return;
  
  const command = client.commands.get(interaction.customId.split('_')[0]);
  if (!command || !command.handleModal) return;
  
  try {
    await command.handleModal(interaction);
  } catch (error) {
    await ErrorHandler.handle(error, interaction);
  }
});

// Button Interaction Handler
client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;
  
  const [commandName] = interaction.customId.split('_');
  const command = client.commands.get(commandName);
  if (!command || !command.handleButton) return;
  
  try {
    await command.handleButton(interaction);
  } catch (error) {
    await ErrorHandler.handle(error, interaction);
  }
});

// Message Handler (for features like antilink)
client.on('messageCreate', async message => {
  try {
    // Antilink
    const antilinkCommand = client.commands.get('antilink');
    if (antilinkCommand?.handleMessage) {
      await antilinkCommand.handleMessage(message);
    }
  } catch (error) {
    console.error('Error in message handler:', error);
  }
});

// Global Error Handler
ErrorHandler.handleGlobal(client);

// Login to Discord
console.log('🔑 Attempting to login to Discord...');
client.login(config.token).then(() => {
  console.log('🔑 Login request sent to Discord...');
}).catch(error => {
  console.error('❌ Login failed:', error);
  process.exit(1);
});
