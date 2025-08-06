const ms = require('ms');

function parseTime(timeString) {
  try {
    const duration = ms(timeString);
    if (!duration) return null;
    return duration;
  } catch {
    return null;
  }
}

function formatTime(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours % 24 > 0) parts.push(`${hours % 24}h`);
  if (minutes % 60 > 0) parts.push(`${minutes % 60}m`);
  if (seconds % 60 > 0) parts.push(`${seconds % 60}s`);

  return parts.join(' ') || '0s';
}

function getTimeRemaining(targetDate) {
  const now = Date.now();
  const remaining = new Date(targetDate) - now;
  return remaining > 0 ? formatTime(remaining) : '0s';
}

function isValidDuration(duration) {
  const parsed = parseTime(duration);
  if (!parsed) return false;
  
  // Maximum 28 days (Discord limit for timeouts)
  return parsed > 0 && parsed <= ms('28d');
}

module.exports = {
  parseTime,
  formatTime,
  getTimeRemaining,
  isValidDuration
};