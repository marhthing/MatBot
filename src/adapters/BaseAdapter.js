import EventEmitter from 'events';
import logger from '../utils/logger.js';

/**
 * Base adapter class that all platform adapters must extend
 * Defines the interface that each platform must implement
 */
export default class BaseAdapter extends EventEmitter {
  constructor(platform, config) {
    super();
    this.platform = platform;
    this.config = config;
    this.client = null;
    this.logger = logger.child({ platform });
  }

  /**
   * Initialize and connect the platform client
   * Must be implemented by child classes
   */
  async connect() {
    throw new Error('connect() must be implemented');
  }

  /**
   * Disconnect the platform client
   * Must be implemented by child classes
   */
  async disconnect() {
    throw new Error('disconnect() must be implemented');
  }

  /**
   * Send a text message
   * @param {string} chatId - Chat/Group ID
   * @param {string} text - Message text
   * @param {object} options - Additional options (quoted, mentions, etc.)
   */
  async sendMessage(chatId, text, options = {}) {
    throw new Error('sendMessage() must be implemented');
  }

  /**
   * Send media (image, video, audio, document)
   * @param {string} chatId - Chat/Group ID
   * @param {Buffer|string} media - Media buffer or URL
   * @param {object} options - Media options (caption, mimetype, etc.)
   */
  async sendMedia(chatId, media, options = {}) {
    throw new Error('sendMedia() must be implemented');
  }

  /**
   * Send a reaction to a message
   * @param {string} chatId - Chat/Group ID
   * @param {string} messageId - Message ID to react to
   * @param {string} emoji - Emoji reaction
   */
  async sendReaction(chatId, messageId, emoji) {
    throw new Error('sendReaction() must be implemented');
  }

  /**
   * Delete a message
   * @param {string} chatId - Chat/Group ID
   * @param {string} messageId - Message ID to delete
   */
  async deleteMessage(chatId, messageId) {
    throw new Error('deleteMessage() must be implemented');
  }

  /**
   * Download media from a message
   * @param {object} mediaInfo - Platform-specific media information
   * @returns {Buffer} - Media buffer
   */
  async downloadMedia(mediaInfo) {
    throw new Error('downloadMedia() must be implemented');
  }

  /**
   * Check if a user is a group admin
   * @param {string} chatId - Group ID
   * @param {string} userId - User ID to check
   * @returns {boolean}
   */
  async isGroupAdmin(chatId, userId) {
    throw new Error('isGroupAdmin() must be implemented');
  }

  /**
   * Get user/chat info
   * @param {string} id - User or Chat ID
   */
  async getInfo(id) {
    throw new Error('getInfo() must be implemented');
  }

  /**
   * Emit a unified message event
   * This is called by platform-specific adapters when a message is received
   */
  emitMessage(messageContext) {
    if (messageContext.log) messageContext.log('[BaseAdapter] emitMessage', { messageId: messageContext.messageId, chatId: messageContext.chatId, text: messageContext.text });
    this.emit('message', messageContext);
  }
}