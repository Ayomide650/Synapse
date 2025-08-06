const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '../data/reminders.json');
const CHECK_INTERVAL = 60000; // Check every minute

class ReminderHandler {
  constructor(client) {
    this.client = client;
    this.checkInterval = null;
  }

  start() {
    this.checkInterval = setInterval(() => this.checkReminders(), CHECK_INTERVAL);
  }

  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  async checkReminders() {
    try {
      if (!fs.existsSync(DATA_PATH)) return;

      const data = JSON.parse(fs.readFileSync(DATA_PATH));
      const now = new Date();
      let updated = false;

      for (const reminder of data.reminders) {
        if (!reminder.active) continue;

        const remindTime = new Date(reminder.remind_at);
        if (remindTime <= now) {
          await this.sendReminder(reminder);
          reminder.active = false;
          updated = true;
        }
      }

      if (updated) {
        // Clean up completed reminders older than 1 day
        const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
        data.reminders = data.reminders.filter(r => 
          r.active || new Date(r.remind_at) > oneDayAgo
        );
        
        fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
      }
    } catch (error) {
      console.error('Error checking reminders:', error);
    }
  }

  async sendReminder(reminder) {
    try {
      const user = await this.client.users.fetch(reminder.user_id);
      if (!user) return;

      await user.send({
        content: `⏰ **Reminder!**\n${reminder.message}\n\n` +
                `Set in: <#${reminder.channel_id}>\n` +
                `Created: <t:${Math.floor(new Date(reminder.created_at).getTime() / 1000)}:R>`
      });
    } catch (error) {
      console.error('Error sending reminder:', error);
    }
  }
}

module.exports = ReminderHandler;