import { Telegraf } from 'telegraf';
import { message as messageFilter } from 'telegraf/filters';
import BaseAdapter from './BaseAdapter.js';
import MessageContext from '../core/MessageContext.js';

export default class TelegramAdapter extends BaseAdapter {
  constructor(config) {
    super('telegram', config);
    
    if (!config.telegram.token) {
      throw new Error('Telegram bot token is required');
    }
  }

  async connect() {
    this.client = new Telegraf(this.config.telegram.token);

    // Handle all text messages
    this.client.on(messageFilter('text'), async (ctx) => {
      try {
        const messageContext = await this.parseMessage(ctx);
        this.emitMessage(messageContext);
      } catch (error) {
        this.logger.error({ error }, 'Failed to parse Telegram message');
      }
    });

    // Handle media messages
    this.client.on(messageFilter('photo'), async (ctx) => {
      try {
        const messageContext = await this.parseMessage(ctx);
        this.emitMessage(messageContext);
      } catch (error) {
        this.logger.error({ error }, 'Failed to parse Telegram photo');
      }
    });

    this.client.on(messageFilter('video'), async (ctx) => {
      try {
        const messageContext = await this.parseMessage(ctx);
        this.emitMessage(messageContext);
      } catch (error) {
        this.logger.error({ error }, 'Failed to parse Telegram video');
      }
    });

    this.client.on(messageFilter('document'), async (ctx) => {
      try {
        const messageContext = await this.parseMessage(ctx);
        this.emitMessage(messageContext);
      } catch (error) {
        this.logger.error({ error }, 'Failed to parse Telegram document');
      }
    });

    this.client.on(messageFilter('voice'), async (ctx) => {
      try {
        const messageContext = await this.parseMessage(ctx);
        this.emitMessage(messageContext);
      } catch (error) {
        this.logger.error({ error }, 'Failed to parse Telegram voice');
      }
    });

    // Launch bot with graceful stop
    await this.client.launch();
    
    this.logger.info('Telegram bot connected successfully!');
    this.emit('ready');

    // Enable graceful stop
    process.once('SIGINT', () => this.disconnect());
    process.once('SIGTERM', () => this.disconnect());
  }

  async parseMessage(ctx) {
    const msg = ctx.message;
    const isGroup = msg.chat.type === 'group' || msg.chat.type === 'supergroup';
    const senderId = msg.from.id.toString();
    const chatId = msg.chat.id.toString();
    const senderName = msg.from.first_name + (msg.from.last_name ? ` ${msg.from.last_name}` : '');

    // Extract message text
    let text = msg.text || msg.caption || '';

    // Parse command if message starts with prefix
    let command = null;
    let args = [];
    
    if (text.startsWith(this.config.prefix)) {
      const parts = text.slice(this.config.prefix.length).trim().split(/\s+/);
      command = parts[0].toLowerCase();
      args = parts.slice(1);
    }

    // Check if sender is owner
    const isOwner = senderId === this.config.ownerNumber;

    // Check if sender is admin (in groups)
    let isAdmin = false;
    if (isGroup) {
      try {
        const member = await ctx.getChatMember(senderId);
        isAdmin = member.status === 'administrator' || member.status === 'creator';
      } catch (error) {
        this.logger.error({ error }, 'Failed to check admin status');
      }
    }

    // Handle media
    let media = null;
    if (msg.photo) {
      const photos = msg.photo;
      media = {
        type: 'image',
        fileId: photos[photos.length - 1].file_id,
        ctx
      };
    } else if (msg.video) {
      media = {
        type: 'video',
        fileId: msg.video.file_id,
        ctx
      };
    } else if (msg.document) {
      media = {
        type: 'document',
        fileId: msg.document.file_id,
        mimeType: msg.document.mime_type,
        ctx
      };
    } else if (msg.voice) {
      media = {
        type: 'audio',
        fileId: msg.voice.file_id,
        ctx
      };
    }

    // Handle quoted/replied message
    let quoted = null;
    if (msg.reply_to_message) {
      quoted = {
        text: msg.reply_to_message.text || msg.reply_to_message.caption || '',
        senderId: msg.reply_to_message.from.id.toString(),
        messageId: msg.reply_to_message.message_id.toString()
      };
    }

    return new MessageContext({
      platform: 'telegram',
      messageId: msg.message_id.toString(),
      chatId,
      senderId,
      senderName,
      text,
      command,
      args,
      isGroup,
      isOwner,
      isAdmin,
      media,
      quoted,
      _ctx: ctx // Store Telegram context for advanced features
    }, this);
  }

  async sendMessage(chatId, text, options = {}) {
    const sendOptions = {};

    if (options.quoted) {
      sendOptions.reply_to_message_id = options.quoted;
    }

    return await this.client.telegram.sendMessage(chatId, text, sendOptions);
  }

  async sendMedia(chatId, media, options = {}) {
    const { type = 'photo', caption = '' } = options;

    const sendOptions = { caption };

    switch (type) {
      case 'image':
      case 'photo':
        return await this.client.telegram.sendPhoto(chatId, media, sendOptions);
      case 'video':
        return await this.client.telegram.sendVideo(chatId, media, sendOptions);
      case 'audio':
      case 'voice':
        return await this.client.telegram.sendVoice(chatId, media, sendOptions);
      case 'document':
        return await this.client.telegram.sendDocument(chatId, media, sendOptions);
      default:
        throw new Error(`Unsupported media type: ${type}`);
    }
  }

  async sendReaction(chatId, messageId, emoji) {
    // Telegram doesn't support reactions via bot API in the same way
    // This is a no-op or you can send a reply instead
    this.logger.warn('Reactions are not fully supported on Telegram bots');
    return null;
  }

  async deleteMessage(chatId, messageId) {
    return await this.client.telegram.deleteMessage(chatId, messageId);
  }

  async downloadMedia(mediaInfo) {
    try {
      const fileLink = await this.client.telegram.getFileLink(mediaInfo.fileId);
      const response = await fetch(fileLink.href);
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      this.logger.error({ error }, 'Failed to download media');
      throw error;
    }
  }

  async isGroupAdmin(chatId, userId) {
    try {
      const member = await this.client.telegram.getChatMember(chatId, userId);
      return member.status === 'administrator' || member.status === 'creator';
    } catch (error) {
      this.logger.error({ error }, 'Failed to check admin status');
      return false;
    }
  }

  async getInfo(id) {
    try {
      return await this.client.telegram.getChat(id);
    } catch (error) {
      this.logger.error({ error }, 'Failed to get info');
      return null;
    }
  }

  async disconnect() {
    if (this.client) {
      this.client.stop('SIGTERM');
      this.logger.info('Telegram bot disconnected');
    }
  }
}