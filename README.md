# 🤖 Synapse – The All-in-One Discord Power Bot

**Synapse** is a next-generation, feature-rich Discord bot designed to replace outdated multipurpose bots like Dyno and MEE6. It's built for **advanced server management**, **user engagement**, and **automated community control**, combining **moderation**, **utility**, **economy**, **XP/leveling**, and more in a single, responsive bot.

---

## 🏗️ Technical Architecture

### **Backend Foundation**
- **Language**: JavaScript/Node.js
- **Database**: JSON File Storage with atomic writes
- **Command System**: Discord.js v14 with Slash Commands
- **Data Persistence**: All critical data stored in JSON files for zero data loss on restarts
- **Performance**: In-memory caching with disk persistence for fast response times
- **Reliability**: Atomic file operations prevent data corruption

### **Core Design Principles**
- **Single Server Focused**: Optimized for dedicated server usage
- **Admin Control**: Server owners have full control over all features
- **Data Safety**: Persistent JSON storage with automatic backups
- **Modern UX**: Slash commands for intuitive user experience
- **Performance First**: Cached data operations and efficient file handling

### **JSON Database Architecture**
```
server_data.json
├── config: { modlog_channel, leveling_enabled, economy_enabled }
├── users: {
│   └── userId: {
│       ├── levels: { xp, level, total_xp }
│       ├── economy: { balance, total_earned, last_daily }
│       └── warnings: [{ reason, moderator, date }]
│   }
├── filters: [{ word, action, created_by }]
├── temp_bans: [{ user_id, expires_at, reason }]
├── mutes: [{ user_id, expires_at, reason }]
└── reminders: [{ user_id, message, remind_at }]
```

---

## 📊 Complete Feature Breakdown

### 🔨 **Moderation & Server Control** (20 Commands)

#### **Basic Moderation Actions**
- **`/kick [@user] [reason]`**
  - Removes a member from the server
  - Logs action to modlog channel if configured
  - Requires: `KICK_MEMBERS` permission

- **`/ban [@user] [reason] [delete_days]`**
  - Permanently bans a user from the server
  - Option to delete their recent messages (1-7 days)
  - Logs action with moderator info to JSON storage
  - Requires: `BAN_MEMBERS` permission

- **`/mute [@user] [duration] [reason]`**
  - Applies mute role to user or uses Discord timeout
  - Supports time-based mutes (1m, 1h, 1d format)
  - Stores mute data in JSON for automatic unmuting
  - Auto-unmutes when duration expires
  - Requires: `MODERATE_MEMBERS` permission

- **`/unmute [@user]`**
  - Removes mute role/timeout from user
  - Updates JSON storage to mark mute as inactive
  - Logs unmute action
  - Requires: `MODERATE_MEMBERS` permission

#### **Advanced Moderation Tools**
- **`/warn [@user] [reason]`**
  - Issues a formal warning to user
  - Stores warning in JSON with timestamp
  - Tracks total warnings per user
  - Logs to modlog channel

- **`/warnings [@user]`**
  - Displays all warnings for a specific user from JSON storage
  - Shows warning dates, reasons, and issuing moderators
  - Paginated embed for users with many warnings
  - Color-coded by warning count (green, yellow, red)

- **`/clearwarnings [@user]`**
  - Removes all warnings for a user from JSON storage
  - Requires confirmation for safety
  - Logs the clearing action
  - Only accessible to admins
  - Requires: `ADMINISTRATOR` permission

- **`/timeout [@user] [duration] [reason]`**
  - Uses Discord's native timeout feature
  - Duration: 1m to 28d maximum
  - Optionally logs timeout to JSON storage
  - Requires: `MODERATE_MEMBERS` permission

- **`/untimeout [@user]`**
  - Removes Discord timeout from user
  - Logs removal action to JSON
  - Requires: `MODERATE_MEMBERS` permission

- **`/tempban [@user] [duration] [reason]`**
  - Temporarily bans user with auto-unban
  - Stores expiry time in JSON for background processing
  - Background task handles auto-unbanning
  - Supports formats: 1h, 1d, 1w, etc.
  - Requires: `BAN_MEMBERS` permission

- **`/softban [@user] [reason]`**
  - Bans user then immediately unbans
  - Effectively kicks user while deleting their messages
  - Useful for spam cleanup without permanent ban
  - Logs both ban and unban actions
  - Requires: `BAN_MEMBERS` permission

#### **Mass Moderation Tools**
- **`/massban [user_list] [reason]`**
  - Bans multiple users at once
  - Accepts user IDs or mentions separated by spaces
  - Confirmation prompt for safety
  - Progress indicator for large lists
  - Requires: `BAN_MEMBERS` + `ADMINISTRATOR`

- **`/purge [amount] [user] [content_filter]`**
  - Bulk deletes messages (1-100 limit)
  - Optional: Delete only from specific user
  - Optional: Filter by content (links, images, etc.)
  - Shows deleted message count
  - Requires: `MANAGE_MESSAGES` permission

- **`/slowmode [seconds]`**
  - Sets channel slowmode (0-21600 seconds)
  - 0 seconds disables slowmode
  - Applies to current channel only
  - Shows current slowmode status
  - Requires: `MANAGE_CHANNELS` permission

#### **Channel Management**
- **`/lock [channel] [reason]`**
  - Removes SEND_MESSAGES permission from @everyone
  - Optionally specify different channel
  - Announces lock with reason in channel
  - Stores original permissions in JSON for unlock
  - Requires: `MANAGE_CHANNELS` permission

- **`/unlock [channel]`**
  - Restores SEND_MESSAGES permission to @everyone
  - Announces unlock in channel
  - Restores original permission state from JSON storage
  - Works with previously locked channels
  - Requires: `MANAGE_CHANNELS` permission

- **`/lockall [reason]`**
  - Locks all text channels in server
  - Emergency feature for server-wide issues
  - Confirmation prompt required
  - Skips channels bot can't access
  - Requires: `ADMINISTRATOR` permission

- **`/unlockall`**
  - Unlocks all previously locked channels
  - Restores original permissions from JSON storage
  - Progress indicator for large servers
  - Logs completion to modlog
  - Requires: `ADMINISTRATOR` permission

#### **Server Configuration**
- **`/modlog [channel]`**
  - Sets channel for moderation logs in JSON config
  - All mod actions automatically logged here
  - Rich embeds with action details
  - No channel = disables modlog
  - Requires: `ADMINISTRATOR` permission

- **`/filter [add/remove/list] [word] [action]`**
  - Manages server word filter stored in JSON
  - Actions: delete, mute, warn, ban
  - Supports wildcard patterns
  - Case-insensitive matching
  - Bypass roles can be configured
  - Requires: `ADMINISTRATOR` permission

---

### 📊 **Leveling & XP System** (10 Commands)

#### **User XP Commands**
- **`/level [@user]`**
  - Shows current level and XP for user from JSON storage
  - Displays XP needed for next level
  - Shows server rank position
  - Beautiful progress bar visualization
  - Works for self or other users

- **`/xp [@user]`**
  - Detailed XP information display from JSON
  - Shows total XP earned all-time
  - XP gain rate and last activity
  - Time to next level estimation
  - Formatted with custom server currency

#### **Leaderboard System**
- **`/leaderboard [page]`**
  - Server XP leaderboard from JSON data
  - 10 users per page with pagination
  - Shows rank, level, XP, and username
  - Current user highlighted if on page
  - Updates in real-time from JSON storage
  - Color-coded ranks (gold, silver, bronze)

#### **Admin XP Management**
- **`/addxp [@user] [amount] [reason]`**
  - Adds XP to specified user in JSON storage
  - Triggers level-up checks and calculations
  - Logs transaction with reason
  - Announces level-ups if configured
  - Requires: `ADMINISTRATOR` permission

- **`/removexp [@user] [amount] [reason]`**
  - Removes XP from user in JSON (can't go below 0)
  - Recalculates level after removal
  - Logs transaction for audit trail
  - No level-down announcements
  - Requires: `ADMINISTRATOR` permission

- **`/setxp [@user] [amount] [reason]`**
  - Sets user's XP to exact amount in JSON
  - Recalculates level from new XP
  - More efficient than add/remove for large changes
  - Logs both old and new values
  - Requires: `ADMINISTRATOR` permission

- **`/resetlevels [confirmation]`**
  - Resets ALL server XP/levels to 0 in JSON storage
  - Requires typing "CONFIRM" for safety
  - Irreversible action with warning
  - Logs reset action and admin
  - Requires: `ADMINISTRATOR` permission

#### **Level Role System**
- **`/rankrole [level] [role] [action]`**
  - Manages XP-based role rewards in JSON config
  - Actions: add, remove, list
  - Automatically assigns roles on level-up
  - Supports multiple roles per level
  - Requires: `ADMINISTRATOR` permission

- **`/levelroles`**
  - Lists all configured level roles from JSON
  - Shows level requirement and role name
  - Sorted by level requirement
  - Color-coded by accessibility
  - Available to all users

#### **System Configuration**
- **`/toggleleveling [enabled]`**
  - Enables/disables XP system for server in JSON config
  - When disabled, no XP is gained
  - Existing data preserved in JSON
  - Announces system status change
  - Requires: `ADMINISTRATOR` permission

#### **XP Gain Mechanics**
- **Automatic XP Gain**: 15-25 XP per message (configurable in JSON)
- **Cooldown System**: 60-second cooldown between XP gains
- **Level Calculation**: Level = floor(sqrt(total_xp / 100))
- **Activity Tracking**: Last XP gain timestamp stored in JSON
- **Channel Restrictions**: Configurable XP-enabled channels

---

### 💸 **Economy System** (5 Commands)

#### **User Economy Commands**
- **`/balance [@user]`**
  - Shows current coin balance from JSON storage
  - Displays server currency symbol
  - Shows ranking in server economy
  - Total earned/spent statistics from JSON
  - Works for self or other users

- **`/daily`**
  - Claim daily coin reward stored in JSON
  - 24-hour cooldown system tracked in JSON
  - Amount configurable per server in JSON config
  - Streak bonuses (optional feature)
  - Shows time until next claim

#### **Admin Economy Management**
- **`/addcoins [@user] [amount] [reason]`**
  - Adds coins to user's balance in JSON storage
  - Respects server maximum balance from JSON config
  - Logs transaction with admin and reason in JSON
  - Announces to user via DM (optional)
  - Requires: Economy admin permission

- **`/removecoins [@user] [amount] [reason]`**
  - Removes coins from user's balance in JSON
  - Cannot go below 0 coins
  - Logs transaction for audit trail in JSON
  - Used for penalties or corrections
  - Requires: Economy admin permission

- **`/setcoins [@user] [amount] [reason]`**
  - Sets exact coin balance for user in JSON
  - Overrides current balance completely
  - Useful for major corrections
  - Logs both old and new balance in JSON
  - Requires: Economy admin permission

#### **Economy Configuration**
- **Currency Customization**: Custom coin name and emoji stored in JSON
- **Daily Rewards**: Configurable daily coin amount in JSON config
- **Balance Limits**: Server-wide maximum balance in JSON
- **Transaction Logging**: All economy actions logged in JSON
- **Admin Permissions**: Granular economy management roles

#### **Gambling Integration**
- **`/coinflip [bet_amount]`**
  - 50/50 chance gambling game
  - Win: 2x bet amount, updates JSON balance
  - Lose: Lose bet amount, updates JSON balance
  - Minimum/maximum bet limits from JSON config
  - Updates balance in real-time

- **`/dice [bet_amount] [target_number]`**
  - Roll 1-6, guess the number
  - Correct guess: 6x bet amount, updates JSON
  - Wrong guess: Lose bet amount, updates JSON
  - Higher risk, higher reward
  - Animated dice roll display

---

### 🛠️ **Utility Commands** (15 Commands)

#### **Communication Tools**
- **`/announce [title] [message] [channel] [color]`**
  - Sends rich embed announcements
  - Customizable title, description, color
  - Optional channel specification
  - Mentions and role pings supported
  - Requires: `ADMINISTRATOR` permission

- **`/poll [question] [option1] [option2] [option3...]`**
  - Creates reaction-based polls
  - Supports 2-10 poll options
  - Automatic emoji reactions (🇦, 🇧, 🇨...)
  - Real-time vote counting
  - Optional time limit for polls

- **`/sendmessage [channel] [message]`**
  - Sends message to specified channel
  - Useful for cross-channel communication
  - Supports embeds and mentions
  - Logs sender for accountability
  - Requires: `MANAGE_MESSAGES` permission

#### **Server Management**
- **`/recreate [channel] [reason]`**
  - Deletes and recreates channel
  - Preserves channel permissions
  - Useful for clearing chat history
  - Confirmation prompt for safety
  - Requires: `MANAGE_CHANNELS` permission

- **`/serverinvite [expires] [max_uses]`**
  - Generates server invite link
  - Customizable expiration time
  - Limited use count options
  - Tracks invite usage statistics
  - Requires: `CREATE_INSTANT_INVITE` permission

- **`/nickname [@user] [nickname]`**
  - Changes user's server nickname
  - Empty nickname resets to username
  - Hierarchy checks (can't change higher roles)
  - Logs nickname changes
  - Requires: `MANAGE_NICKNAMES` permission

#### **Information Commands**
- **`/avatar [@user] [server/global]`**
  - Displays user's avatar in high quality
  - Option for server-specific or global avatar
  - Multiple format downloads (PNG, JPG, WebP)
  - Shows avatar URL for copying
  - Works for any server member

- **`/userinfo [@user]`**
  - Comprehensive user information
  - Join dates, account creation, roles
  - Current status and activities
  - Permissions summary
  - Color-coded by highest role

- **`/serverinfo`**
  - Detailed server statistics
  - Member counts, channel counts, role counts
  - Server creation date and owner
  - Boost level and feature list
  - Server icon and banner display

- **`/channelinfo [channel]`**
  - Channel-specific information
  - Creation date, topic, permissions
  - Message count (if tracked)
  - Channel type and category
  - Permission overwrites list

- **`/roleinfo [role]`**
  - Role information and statistics
  - Member count with role
  - Permission list
  - Role color and position
  - Creation date and manager

- **`/oldestmembers [count]`**
  - Lists oldest accounts in server
  - Sorted by Discord account creation
  - Useful for finding legitimate members
  - Shows account age
  - Default: 10 members, max: 25

#### **Channel Visibility**
- **`/hidechannel [channel] [role]`**
  - Hides channel from @everyone or specified role
  - Removes VIEW_CHANNEL permission
  - Optional: Hide from specific role instead
  - Logs permission changes
  - Requires: `MANAGE_CHANNELS` permission

- **`/showchannel [channel] [role]`**
  - Makes hidden channel visible
  - Restores VIEW_CHANNEL permission
  - Works with previously hidden channels
  - Can target specific roles
  - Requires: `MANAGE_CHANNELS` permission

#### **Time-Based Utilities**
- **`/timer [duration] [message]`**
  - Starts countdown timer in channel
  - Supports: seconds, minutes, hours, days
  - Optional custom completion message
  - Edits message with remaining time
  - Stores in JSON for persistence across restarts

- **`/remindme [duration] [message]`**
  - Sets personal reminder via DM
  - Flexible time format (1h30m, 2d, etc.)
  - Custom reminder message
  - Works across server restarts (stored in JSON)
  - User can have multiple reminders

---

### 🔄 **System & Diagnostic Tools** (7 Commands)

#### **Performance Monitoring**
- **`/ping`**
  - Bot latency to Discord API
  - JSON file read/write speed
  - WebSocket heartbeat latency
  - Message edit time calculation
  - Color-coded performance indicators

- **`/uptime`**
  - Bot online duration
  - Last restart timestamp
  - System uptime statistics
  - Memory usage information
  - JSON file size and status

- **`/botinfo`**
  - Comprehensive bot statistics
  - Version information and changelog
  - Server count and user count
  - Commands executed today
  - JSON storage statistics

#### **External Integration**
- **`/weather [city]`**
  - Current weather conditions
  - Temperature, humidity, conditions
  - 5-day forecast preview
  - Wind speed and direction
  - Powered by weather API

#### **Server Analytics**
- **`/stats [timeframe]`**
  - Server activity statistics from JSON
  - Message counts by channel/user
  - Join/leave rates
  - Command usage statistics
  - Growth trends and charts

#### **Bot Configuration**
- **`/help [command]`**
  - Comprehensive command help
  - Usage examples and syntax
  - Permission requirements
  - Related commands suggestions
  - Searchable command database

- **`/setup`**
  - Interactive server setup wizard
  - Guides through feature configuration
  - Sets up modlog, roles, channels in JSON config
  - Configures economy and leveling settings
  - Beginner-friendly interface

---

### 🧠 **Fun & Interaction** (5 Commands)

#### **Simple Games**
- **`/coinflip [bet]`**
  - Classic heads or tails
  - Optional coin betting (economy integration with JSON)
  - Animated coin flip visualization
  - Win/loss statistics tracking in JSON
  - Fair random number generation

- **`/dice [sides] [count] [bet]`**
  - Roll dice with custom sides (default: 6)
  - Multiple dice support (1-10 dice)
  - Optional betting with economy (JSON storage)
  - Shows individual dice results
  - Statistics for lucky/unlucky streaks

#### **Server Engagement**
- **`/giveaway [duration] [prize] [winners]`**
  - Creates reaction-based giveaways
  - Customizable duration and prize
  - Multiple winners support
  - Automatic winner selection
  - Prevents duplicate entries
  - Requires: `ADMINISTRATOR` permission

#### **Entertainment**
- **`/hack [@user]`**
  - Simulated "hacking" sequence for fun
  - Progressive status messages
  - Harmless entertainment command
  - Random "system access" messages
  - Popular meme command

---

## 🔧 **JSON Storage System**

### **Data Architecture**
- **Single File Storage**: `server_data.json` contains all bot data
- **Atomic Operations**: Safe read/write operations prevent corruption
- **Automatic Backups**: Daily backups with timestamp rotation
- **In-Memory Caching**: Frequently accessed data cached for performance
- **Restart Persistence**: All data survives bot restarts and crashes

### **File Structure**
```json
{
  "config": {
    "modlog_channel": "123456789012345678",
    "leveling_enabled": true,
    "economy_enabled": true,
    "currency_name": "coins",
    "currency_symbol": "🪙",
    "daily_amount": 50,
    "xp_per_message": 20
  },
  "users": {
    "987654321098765432": {
      "levels": {
        "xp": 1500,
        "level": 3,
        "total_xp": 1500,
        "last_xp_gain": "2025-01-15T10:30:00Z"
      },
      "economy": {
        "balance": 750,
        "total_earned": 1200,
        "total_spent": 450,
        "last_daily": "2025-01-15T08:00:00Z"
      },
      "warnings": [
        {
          "id": 1705123456789,
          "moderator_id": "111222333444555666",
          "reason": "Inappropriate language",
          "created_at": "2025-01-13T14:22:00Z"
        }
      ]
    }
  },
  "level_roles": {
    "5": "123456789012345678",
    "10": "987654321098765432"
  },
  "word_filters": [
    {
      "word": "spam",
      "action": "delete",
      "created_by": "111222333444555666"
    }
  ],
  "temp_bans": [
    {
      "user_id": "555666777888999000",
      "moderator_id": "111222333444555666",
      "reason": "Temporary suspension",
      "expires_at": "2025-01-20T12:00:00Z",
      "active": true
    }
  ],
  "mutes": [],
  "reminders": [
    {
      "user_id": "987654321098765432",
      "channel_id": "444555666777888999",
      "message": "Check the announcements",
      "remind_at": "2025-01-16T09:00:00Z",
      "active": true
    }
  ]
}
```

### **Performance Features**
- **Lazy Loading**: Data loaded only when needed
- **Write Batching**: Multiple operations batched for efficiency
- **Backup System**: Automatic daily backups with rotation
- **Data Validation**: Schema validation prevents corruption
- **Error Recovery**: Automatic backup restoration on corruption

---

## 🚀 **Performance & Reliability**

### **Technical Specifications**
- **Response Time**: < 100ms average command response
- **Data Safety**: Atomic file operations prevent corruption
- **Memory Efficient**: Cached frequently accessed data
- **Restart Safe**: All data persists through restarts
- **Backup System**: Automated daily backups with 30-day retention

### **Storage Benefits**
- **No External Dependencies**: Self-contained JSON storage
- **Human Readable**: Easy to debug and manually edit
- **Portable**: Single file contains all server data
- **Backup Friendly**: Simple file copy for backups
- **Version Control**: Git-friendly plain text format

---

## 📈 **Why Choose Synapse?**

### **Advantages**
1. **All-in-One Solution**: Replace 3-5 bots with one comprehensive system
2. **No Database Setup**: Simple JSON file storage, no external dependencies
3. **Data Safety**: Atomic file operations and automatic backups
4. **Admin Control**: Full customization and management capabilities
5. **Performance**: In-memory caching with persistent storage
6. **Reliability**: Restart-safe design with data corruption protection

### **Perfect for Single Server Usage**
- **Dedicated Server Bot**: Optimized for single server deployment
- **Easy Setup**: No database configuration required
- **Data Ownership**: Complete control over your server's data
- **Backup Control**: Simple file-based backup system
- **Customizable**: JSON config allows easy feature customization

---

**Total Commands: 62** - Everything you need to manage and engage your Discord community with reliable JSON-based storage!