import logger from '../utils/logger.js';
import fs from 'fs';
import path from 'path';

/**
 * Permission Manager
 * Manages user permissions across platforms
 */
export default class PermissionManager {
  constructor(config) {
    this.config = config;
    this.logger = logger.child({ component: 'PermissionManager' });
    this.permissionsFile = path.join(config.paths.storage, 'permissions.json');
    this.permissions = this.load();
  }

  /**
   * Load permissions from file
   */
  load() {
    try {
      if (fs.existsSync(this.permissionsFile)) {
        const data = fs.readFileSync(this.permissionsFile, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      this.logger.error({ error }, 'Failed to load permissions');
    }

    return {
      banned: [], // Banned users across all platforms
      admins: [], // Additional admins (besides group admins)
      premium: [], // Premium users
      blacklistedGroups: [] // Blacklisted groups/chats
    };
  }

  /**
   * Save permissions to file
   */
  save() {
    try {
      fs.writeFileSync(
        this.permissionsFile,
        JSON.stringify(this.permissions, null, 2),
        'utf8'
      );
    } catch (error) {
      this.logger.error({ error }, 'Failed to save permissions');
    }
  }

  /**
   * Check if user is the bot owner
   */
  isOwner(userId, platform) {
    // Format user ID for comparison
    const normalizedId = userId.toString().replace(/[^\d]/g, '');
    const ownerId = this.config.ownerNumber.toString();
    
    return normalizedId === ownerId;
  }

  /**
   * Check if user is banned
   */
  isBanned(userId, platform) {
    // Use normal remoteJid logic only
    const key = `${platform}:${userId}`;
    return this.permissions.banned.includes(key);
  }

  /**
   * Ban a user
   */
  banUser(userId, platform) {
    const key = `${platform}:${userId}`;
    if (!this.permissions.banned.includes(key)) {
      this.permissions.banned.push(key);
      this.save();
      this.logger.info(`Banned user: ${key}`);
      return true;
    }
    return false;
  }

  /**
   * Unban a user
   */
  unbanUser(userId, platform) {
    const key = `${platform}:${userId}`;
    const index = this.permissions.banned.indexOf(key);
    if (index > -1) {
      this.permissions.banned.splice(index, 1);
      this.save();
      this.logger.info(`Unbanned user: ${key}`);
      return true;
    }
    return false;
  }

  /**
   * Check if user is an admin (custom list, not group admin)
   */
  isAdmin(userId, platform) {
    const key = `${platform}:${userId}`;
    return this.permissions.admins.includes(key);
  }

  /**
   * Add user as admin
   */
  addAdmin(userId, platform) {
    const key = `${platform}:${userId}`;
    if (!this.permissions.admins.includes(key)) {
      this.permissions.admins.push(key);
      this.save();
      this.logger.info(`Added admin: ${key}`);
      return true;
    }
    return false;
  }

  /**
   * Remove user as admin
   */
  removeAdmin(userId, platform) {
    const key = `${platform}:${userId}`;
    const index = this.permissions.admins.indexOf(key);
    if (index > -1) {
      this.permissions.admins.splice(index, 1);
      this.save();
      this.logger.info(`Removed admin: ${key}`);
      return true;
    }
    return false;
  }

  /**
   * Check if chat is blacklisted
   */
  isChatBlacklisted(chatId, platform) {
    const key = `${platform}:${chatId}`;
    return this.permissions.blacklistedGroups.includes(key);
  }

  /**
   * Blacklist a chat
   */
  blacklistChat(chatId, platform) {
    const key = `${platform}:${chatId}`;
    if (!this.permissions.blacklistedGroups.includes(key)) {
      this.permissions.blacklistedGroups.push(key);
      this.save();
      this.logger.info(`Blacklisted chat: ${key}`);
      return true;
    }
    return false;
  }

  /**
   * Remove chat from blacklist
   */
  unblacklistChat(chatId, platform) {
    const key = `${platform}:${chatId}`;
    const index = this.permissions.blacklistedGroups.indexOf(key);
    if (index > -1) {
      this.permissions.blacklistedGroups.splice(index, 1);
      this.save();
      this.logger.info(`Removed chat from blacklist: ${key}`);
      return true;
    }
    return false;
  }

  /**
   * Check if user is premium
   */
  isPremium(userId, platform) {
    const key = `${platform}:${userId}`;
    return this.permissions.premium.includes(key);
  }

  /**
   * Add premium user
   */
  addPremium(userId, platform) {
    const key = `${platform}:${userId}`;
    if (!this.permissions.premium.includes(key)) {
      this.permissions.premium.push(key);
      this.save();
      this.logger.info(`Added premium user: ${key}`);
      return true;
    }
    return false;
  }

  /**
   * Remove premium user
   */
  removePremium(userId, platform) {
    const key = `${platform}:${userId}`;
    const index = this.permissions.premium.indexOf(key);
    if (index > -1) {
      this.permissions.premium.splice(index, 1);
      this.save();
      this.logger.info(`Removed premium user: ${key}`);
      return true;
    }
    return false;
  }

  /**
   * Get all permissions
   */
  getAll() {
    return { ...this.permissions };
  }

  /**
   * Check if user has permission for a specific action
   */
  hasPermission(userId, platform, requiredLevel) {
    // Owner has all permissions
    if (this.isOwner(userId, platform)) {
      return true;
    }

    // Banned users have no permissions
    if (this.isBanned(userId, platform)) {
      return false;
    }

    // Check permission levels
    switch (requiredLevel) {
      case 'owner':
        return this.isOwner(userId, platform);
      case 'admin':
        return this.isAdmin(userId, platform);
      case 'premium':
        return this.isPremium(userId, platform);
      default:
        return true; // Everyone else
    }
  }
}