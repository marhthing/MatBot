import logger from './logger.js';

/**
 * Rate Limiter
 * Prevents spam and abuse by limiting command usage
 */
export default class RateLimiter {
  constructor(config) {
    this.config = config;
    this.logger = logger.child({ component: 'RateLimiter' });
    
    // Store user activity: Map<userId, Array<timestamp>>
    this.userActivity = new Map();
    
    // Store warnings: Map<userId, warningCount>
    this.warnings = new Map();
    
    // Temporarily blocked users: Map<userId, unblockTimestamp>
    this.blocked = new Map();
    
    // Cleanup interval
    this.startCleanup();
  }

  /**
   * Check if user is rate limited
   * @param {string} userId - User identifier
   * @param {string} platform - Platform name
   * @returns {object} - { allowed: boolean, remaining: number, resetIn: number }
   */
  check(userId, platform) {
    const key = `${platform}:${userId}`;
    
    // Check if user is temporarily blocked
    if (this.isBlocked(key)) {
      const unblockTime = this.blocked.get(key);
      const resetIn = Math.ceil((unblockTime - Date.now()) / 1000);
      return {
        allowed: false,
        remaining: 0,
        resetIn,
        reason: 'temporarily_blocked'
      };
    }

    const now = Date.now();
    const windowMs = this.config.rateLimiting.windowMs;
    const maxCommands = this.config.rateLimiting.maxCommands;

    // Get user's activity history
    if (!this.userActivity.has(key)) {
      this.userActivity.set(key, []);
    }

    const activity = this.userActivity.get(key);
    
    // Remove old timestamps outside the window
    const validActivity = activity.filter(timestamp => now - timestamp < windowMs);
    this.userActivity.set(key, validActivity);

    // Check if user exceeded the limit
    if (validActivity.length >= maxCommands) {
      this.handleExceeded(key);
      
      const oldestTimestamp = validActivity[0];
      const resetIn = Math.ceil((windowMs - (now - oldestTimestamp)) / 1000);
      
      return {
        allowed: false,
        remaining: 0,
        resetIn,
        reason: 'rate_limit_exceeded'
      };
    }

    // Record this activity
    validActivity.push(now);
    this.userActivity.set(key, validActivity);

    return {
      allowed: true,
      remaining: maxCommands - validActivity.length,
      resetIn: Math.ceil(windowMs / 1000)
    };
  }

  /**
   * Handle when user exceeds rate limit
   */
  handleExceeded(key) {
    const currentWarnings = this.warnings.get(key) || 0;
    const newWarnings = currentWarnings + 1;
    this.warnings.set(key, newWarnings);

    this.logger.warn(`Rate limit exceeded: ${key} (warnings: ${newWarnings})`);

    // Block user after 3 warnings
    if (newWarnings >= 3) {
      const blockDuration = 5 * 60 * 1000; // 5 minutes
      const unblockTime = Date.now() + blockDuration;
      this.blocked.set(key, unblockTime);
      this.warnings.delete(key);
      
      this.logger.warn(`User blocked for 5 minutes: ${key}`);
    }
  }

  /**
   * Check if user is blocked
   */
  isBlocked(key) {
    if (!this.blocked.has(key)) return false;

    const unblockTime = this.blocked.get(key);
    const now = Date.now();

    if (now >= unblockTime) {
      this.blocked.delete(key);
      this.logger.info(`User unblocked: ${key}`);
      return false;
    }

    return true;
  }

  /**
   * Manually block a user
   * @param {string} userId - User ID
   * @param {string} platform - Platform
   * @param {number} durationMs - Block duration in milliseconds
   */
  blockUser(userId, platform, durationMs = 5 * 60 * 1000) {
    const key = `${platform}:${userId}`;
    const unblockTime = Date.now() + durationMs;
    this.blocked.set(key, unblockTime);
    this.logger.info(`Manually blocked user: ${key} for ${durationMs}ms`);
  }

  /**
   * Manually unblock a user
   */
  unblockUser(userId, platform) {
    const key = `${platform}:${userId}`;
    if (this.blocked.has(key)) {
      this.blocked.delete(key);
      this.logger.info(`Manually unblocked user: ${key}`);
      return true;
    }
    return false;
  }

  /**
   * Reset user's rate limit
   */
  reset(userId, platform) {
    const key = `${platform}:${userId}`;
    this.userActivity.delete(key);
    this.warnings.delete(key);
    this.blocked.delete(key);
    this.logger.info(`Reset rate limit for user: ${key}`);
  }

  /**
   * Get user's current status
   */
  getStatus(userId, platform) {
    const key = `${platform}:${userId}`;
    
    return {
      isBlocked: this.isBlocked(key),
      warnings: this.warnings.get(key) || 0,
      activityCount: this.userActivity.get(key)?.length || 0,
      maxCommands: this.config.rateLimiting.maxCommands
    };
  }

  /**
   * Cleanup old data periodically
   */
  startCleanup() {
    setInterval(() => {
      const now = Date.now();
      const windowMs = this.config.rateLimiting.windowMs;

      // Clean up old activity
      for (const [key, activity] of this.userActivity.entries()) {
        const validActivity = activity.filter(timestamp => now - timestamp < windowMs);
        if (validActivity.length === 0) {
          this.userActivity.delete(key);
        } else {
          this.userActivity.set(key, validActivity);
        }
      }

      // Clean up expired blocks
      for (const [key, unblockTime] of this.blocked.entries()) {
        if (now >= unblockTime) {
          this.blocked.delete(key);
        }
      }

      // Clean up old warnings (older than 1 hour)
      if (this.warnings.size > 100) {
        this.warnings.clear();
      }

    }, 60000); // Run every minute
  }
}