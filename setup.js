const database = require('./utils/database');
const path = require('path');
const fs = require('fs').promises;

// Initial database setup script
async function setupDatabase() {
  console.log('🗄️ Setting up initial database files...');

  try {
    // 1. Users database - for economy, leveling, and user data
    const initialUsers = {
      "meta": {
        "version": "1.0.0",
        "lastUpdated": new Date().toISOString(),
        "totalUsers": 0
      },
      "users": {}
    };

    // 2. Guilds database - for server-specific settings
    const initialGuilds = {
      "meta": {
        "version": "1.0.0",
        "lastUpdated": new Date().toISOString(),
        "totalGuilds": 0
      },
      "guilds": {}
    };

    // 3. Economy database - for shop items, transactions
    const initialEconomy = {
      "meta": {
        "version": "1.0.0",
        "lastUpdated": new Date().toISOString()
      },
      "shop": {
        "items": [
          {
            "id": "1",
            "name": "Coffee",
            "description": "A nice cup of coffee to boost your energy!",
            "price": 50,
            "category": "consumables",
            "emoji": "☕"
          },
          {
            "id": "2",
            "name": "Pizza Slice",
            "description": "Delicious pizza slice - who doesn't love pizza?",
            "price": 75,
            "category": "food",
            "emoji": "🍕"
          },
          {
            "id": "3",
            "name": "VIP Role",
            "description": "Get access to exclusive VIP channels!",
            "price": 1000,
            "category": "roles",
            "emoji": "👑"
          }
        ]
      },
      "transactions": [],
      "dailyClaims": {}
    };

    // 4. Moderation database - for warnings, bans, mutes
    const initialModeration = {
      "meta": {
        "version": "1.0.0",
        "lastUpdated": new Date().toISOString()
      },
      "warnings": {},
      "bans": {},
      "mutes": {},
      "antilink": {}
    };

    // 5. Leveling database - for XP tracking
    const initialLeveling = {
      "meta": {
        "version": "1.0.0",
        "lastUpdated": new Date().toISOString(),
        "xpSettings": {
          "minXp": 15,
          "maxXp": 25,
          "cooldown": 60000,
          "xpPerLevel": 100
        }
      },
      "userXp": {},
      "levelRoles": {}
    };

    // 6. Settings database - for bot configuration
    const initialSettings = {
      "meta": {
        "version": "1.0.0",
        "lastUpdated": new Date().toISOString()
      },
      "bot": {
        "maintenanceMode": false,
        "commandsEnabled": true,
        "defaultPrefix": "/"
      },
      "features": {
        "antiLink": true,
        "leveling": true,
        "economy": true,
        "moderation": true
      },
      "channels": {
        "serverLog": null,
        "giveaway": null
      }
    };

    // Write all initial database files
    const databases = [
      { name: 'users.json', data: initialUsers },
      { name: 'guilds.json', data: initialGuilds },
      { name: 'economy.json', data: initialEconomy },
      { name: 'moderation.json', data: initialModeration },
      { name: 'leveling.json', data: initialLeveling },
      { name: 'settings.json', data: initialSettings }
    ];

    for (const db of databases) {
      const success = await database.write(db.name, db.data);
      if (success) {
        console.log(`✅ Created ${db.name}`);
      } else {
        console.log(`❌ Failed to create ${db.name}`);
      }
    }

    console.log('\n🎉 Database setup complete!');
    console.log('\n📁 Created files:');
    databases.forEach(db => console.log(`   - ${db.name}`));
    
    console.log('\n📖 Usage examples:');
    console.log('   const userData = await database.read("users.json");');
    console.log('   await database.write("users.json", updatedData);');
    console.log('   const economyData = await database.read("economy.json");');

  } catch (error) {
    console.error('❌ Error setting up database:', error);
  }
}

// Helper functions for your Discord bot commands
class DatabaseHelper {
  
  // User management
  static async getUser(userId, guildId = null) {
    const userData = await database.read('users.json');
    const key = guildId ? `${userId}_${guildId}` : userId;
    
    if (!userData.users[key]) {
      userData.users[key] = {
        id: userId,
        guildId: guildId,
        balance: 0,
        xp: 0,
        level: 1,
        lastDaily: null,
        inventory: [],
        createdAt: new Date().toISOString()
      };
      userData.meta.totalUsers++;
      await database.write('users.json', userData);
    }
    
    return userData.users[key];
  }

  static async updateUser(userId, updates, guildId = null) {
    const userData = await database.read('users.json');
    const key = guildId ? `${userId}_${guildId}` : userId;
    
    if (userData.users[key]) {
      Object.assign(userData.users[key], updates, {
        lastUpdated: new Date().toISOString()
      });
      userData.meta.lastUpdated = new Date().toISOString();
      await database.write('users.json', userData);
      return userData.users[key];
    }
    return null;
  }

  // Economy functions
  static async addBalance(userId, amount, guildId = null) {
    const user = await this.getUser(userId, guildId);
    user.balance = (user.balance || 0) + amount;
    return await this.updateUser(userId, { balance: user.balance }, guildId);
  }

  static async removeBalance(userId, amount, guildId = null) {
    const user = await this.getUser(userId, guildId);
    if (user.balance >= amount) {
      user.balance -= amount;
      return await this.updateUser(userId, { balance: user.balance }, guildId);
    }
    return false; // Insufficient funds
  }

  // Leveling functions
  static async addXp(userId, xp, guildId = null) {
    const user = await this.getUser(userId, guildId);
    const oldLevel = user.level || 1;
    
    user.xp = (user.xp || 0) + xp;
    user.level = Math.floor(user.xp / 100) + 1; // 100 XP per level
    
    await this.updateUser(userId, { xp: user.xp, level: user.level }, guildId);
    
    return {
      levelUp: user.level > oldLevel,
      oldLevel,
      newLevel: user.level,
      totalXp: user.xp
    };
  }

  // Guild settings
  static async getGuildSettings(guildId) {
    const guildsData = await database.read('guilds.json');
    
    if (!guildsData.guilds[guildId]) {
      guildsData.guilds[guildId] = {
        id: guildId,
        prefix: '/',
        antilink: { enabled: false, whitelist: [] },
        leveling: { enabled: true, announceLevelUp: true },
        economy: { enabled: true, dailyAmount: 100 },
        createdAt: new Date().toISOString()
      };
      guildsData.meta.totalGuilds++;
      await database.write('guilds.json', guildsData);
    }
    
    return guildsData.guilds[guildId];
  }

  // Moderation functions
  static async addWarning(userId, guildId, moderatorId, reason) {
    const modData = await database.read('moderation.json');
    const key = `${userId}_${guildId}`;
    
    if (!modData.warnings[key]) {
      modData.warnings[key] = [];
    }
    
    modData.warnings[key].push({
      id: Date.now().toString(),
      moderatorId,
      reason,
      timestamp: new Date().toISOString()
    });
    
    await database.write('moderation.json', modData);
    return modData.warnings[key].length; // Return warning count
  }
}

// Export setup function and helper
module.exports = {
  setupDatabase,
  DatabaseHelper
};

// Run setup if this file is executed directly
if (require.main === module) {
  setupDatabase();
}
