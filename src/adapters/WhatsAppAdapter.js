import makeWASocket, { 
  DisconnectReason, 
  useMultiFileAuthState,
  downloadMediaMessage,
  jidNormalizedUser,
  delay
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';
import BaseAdapter from './BaseAdapter.js';
import MessageContext from '../core/MessageContext.js';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import memoryStore from '../utils/memory.js';
import { logIncoming, logOutgoing } from '../utils/debugMessageLogger.js';

export default class WhatsAppAdapter extends BaseAdapter {
  constructor(config) {
    super('whatsapp', config);
    
    // Create a silent logger for Baileys to suppress its debug messages
    this.baileysLogger = pino({ level: 'silent' });
    // 🔥 NEW: Store for capturing view-once before they're marked as viewed
    this.pendingViewOnce = new Map();
  }

  async connect() {
    const sessionPath = path.join(this.config.paths.session, 'whatsapp');
    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true });
    }

    let state, saveCreds;
    let maxTries = 5;
    let tries = 0;
    let connected = false;
    let lastError = null;

    while (tries < maxTries && !connected) {
      try {
        ({ state, saveCreds } = await useMultiFileAuthState(sessionPath));
        this.client = makeWASocket({
          auth: state,
          printQRInTerminal: false,
          logger: this.baileysLogger,
          browser: ['MATDEV Bot', 'Chrome', '121.0.0'],
          generateHighQualityLinkPreview: true,
          defaultQueryTimeoutMs: 60000,
          // 🔥 CRITICAL: This tells Baileys to fetch missing messages
          getMessage: async (key) => {
            console.log('[WhatsAppAdapter] 🔥 getMessage called for:', key.id);
            // Try to get from memory store first
            const msg = memoryStore.getMessage('whatsapp', key.remoteJid, key.id);
            if (msg?.message) {
              console.log('[WhatsAppAdapter] ✓ Found in memory store');
              return msg;
            }
            // If view-once, try to fetch from WhatsApp servers
            if (key.isViewOnce) {
              console.log('[WhatsAppAdapter] 🔥 Attempting to fetch view-once from WhatsApp...');
              // Return undefined to trigger server fetch
              return undefined;
            }
            return { message: null };
          }
        });

        // Handle credentials update
        this.client.ev.on('creds.update', saveCreds);

        // Handle connection updates
        this.client.ev.on('connection.update', async (update) => {
          const { connection, lastDisconnect, qr } = update;

          if (qr) {
            this.logger.info('📱 Scan QR code to login to WhatsApp');
            console.log('\n');
            qrcode.generate(qr, { small: true });
            console.log('\n');
          }

          if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error instanceof Boom) &&
              lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut;

            this.logger.info(`Connection closed. Reconnecting: ${shouldReconnect}`);

            if (shouldReconnect) {
              await delay(5000);
              await this.connect();
            }
          } else if (connection === 'open') {
            this.logger.info('✅ WhatsApp connected successfully!');
            // Get the bot's own WhatsApp number from Baileys user object
            const userId = this.client.user?.id;
            if (userId) {
              const phone = userId.split(':')[0].replace(/[^\d]/g, '');
              // Update OWNER_NUMBER in .env if different
              const envPath = path.resolve(process.cwd(), '.env');
              if (fs.existsSync(envPath)) {
                let envContent = fs.readFileSync(envPath, 'utf-8');
                const regex = /^OWNER_NUMBER=.*/m;
                if (regex.test(envContent)) {
                  envContent = envContent.replace(regex, `OWNER_NUMBER=${phone}`);
                } else {
                  envContent += `\nOWNER_NUMBER=${phone}`;
                }
                fs.writeFileSync(envPath, envContent, 'utf-8');
                this.logger.info(`Updated OWNER_NUMBER in .env to: ${phone}`);
              }
            }
            this.emit('ready');
          }
        });

        // Handle incoming messages and all events
        this.client.ev.on('messages.upsert', async ({ messages, type }) => {
          if (type !== 'notify') return;
          for (const msg of messages) {
            // CRITICAL: Log full message structure if it seems empty to find hidden ViewOnce
            const keys = Object.keys(msg.message || {});
            console.log(`[WhatsAppAdapter] New Message: ${msg.key.id} | Keys: ${keys.length > 0 ? keys : 'EMPTY'}`);
            // 🔥 NEW: Check if we caught this view-once earlier
            if (msg.key?.isViewOnce && !msg.message && this.pendingViewOnce.has(msg.key.id)) {
              console.log('[WhatsAppAdapter] 🔥 Restoring view-once from cache!');
              msg.message = this.pendingViewOnce.get(msg.key.id).message;
              this.pendingViewOnce.delete(msg.key.id); // Clean up
            }
            if (keys.length === 0 && msg.key?.isViewOnce) {
              console.log('[WhatsAppAdapter] DEBUG - View-Once with no content:', JSON.stringify(msg, null, 2));
            }
            if (msg.message?.ephemeralMessage) {
              console.log(`[WhatsAppAdapter] Ephemeral Keys: ${Object.keys(msg.message.ephemeralMessage.message || {})}`);
            }
            // Allow view-once messages through even if message field is empty
            if (!msg.message && !msg.messageStubType && !msg.key?.isViewOnce) continue;
            try {
              memoryStore.saveMessage('whatsapp', msg.key.remoteJid, msg.key.id, msg);
              const messageContext = await this.parseMessage(msg);
              this.emitMessage(messageContext);
            } catch (error) {
              this.logger.error({ error }, 'Failed to parse WhatsApp message');
            }
          }
        });

        // Handle protocol messages and all other message events
        this.client.ev.on('messages.update', async (updates) => {
          for (const update of updates) {
            // DO NOT save protocol messages/updates over the original message in memory
            // only emit the event for plugins to handle
            this.emit('protocol', update);
          }
        });

        connected = true;
      } catch (e) {
        lastError = e;
        this.logger.error({ error: e }, `WhatsApp session connect attempt ${tries + 1} failed.`);
        tries++;
        await delay(2000);
      }
    }

    if (!connected) {
      this.logger.error('All WhatsApp session connect attempts failed. Deleting session and requiring re-authentication.');
      // Delete all files in sessionPath
      for (const file of fs.readdirSync(sessionPath)) {
        fs.unlinkSync(path.join(sessionPath, file));
      }
      // Optionally, restart the process to trigger QR scan
      process.exit(1);
    }
  }

async parseMessage(msg) {
    const isGroup = msg.key.remoteJid?.endsWith('@g.us');
    const chatId = msg.key.remoteJid; // Use remoteJid as primary chat ID
    
    // Determine sender ID - handle @lid and @s.whatsapp.net
    let senderId;
    if (isGroup) {
      // In groups, use participant field (can be @lid or @s.whatsapp.net)
      senderId = msg.key.participant;
      
      // Baileys 6.8.0+ provides participantAlt for LID -> PN mapping
      // Try participantAlt first (official field), then fallback to participantPn
      if (senderId?.endsWith('@lid')) {
        if (msg.key.participantAlt) {
          senderId = msg.key.participantAlt; // Official field for PN when participant is LID
        } else if (msg.key.participantPn) {
          senderId = msg.key.participantPn; // Legacy field
        } else {
          // If no mapping available, try to get from signal repository
          try {
            const pn = await this.client.signalRepository.lidMapping.getPNForLID(senderId);
            if (pn) senderId = pn;
          } catch (e) {
            this.logger.warn(`Could not resolve LID to PN for ${senderId}`);
          }
        }
      }
    } else {
      // In private chats, remoteJid is the sender
      senderId = msg.key.remoteJid;
      
      // Handle LID in DMs using remoteJidAlt
      if (senderId?.endsWith('@lid') && msg.key.remoteJidAlt) {
        senderId = msg.key.remoteJidAlt;
      }
    }
    
    // Normalize the JID
    senderId = jidNormalizedUser(senderId);

    // Extract message text
    let text = msg.message?.conversation ||
               msg.message?.extendedTextMessage?.text ||
               msg.message?.imageMessage?.caption ||
               msg.message?.videoMessage?.caption || '';

    // Parse command if message starts with prefix
    let command = null;
    let args = [];
    
    if (text.startsWith(this.config.prefix)) {
      const parts = text.slice(this.config.prefix.length).trim().split(/\s+/);
      command = parts[0].toLowerCase();
      args = parts.slice(1);
    }

    // Check if sender is owner
    const isOwner = senderId.split('@')[0] === this.config.ownerNumber;

    // Check if sender is admin (in groups)
    let isAdmin = false;
    if (isGroup) {
      try {
        const groupMetadata = await this.client.groupMetadata(chatId);
        const participant = groupMetadata.participants.find(p => 
          jidNormalizedUser(p.id) === senderId
        );
        isAdmin = participant?.admin === 'admin' || participant?.admin === 'superadmin';
      } catch (error) {
        this.logger.error({ error }, 'Failed to get group metadata');
      }
    }

    // Get sender name
    let senderName = msg.pushName || senderId.split('@')[0];

    // Check if message is from the bot itself
    const isFromMe = msg.key.fromMe || false;

    // Handle media
    let media = null;
    const mediaTypes = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage'];
    for (const type of mediaTypes) {
      if (msg.message[type]) {
        media = {
          type: type.replace('Message', ''),
          message: msg.message[type],
          raw: msg
        };
        break;
      }
    }

    // Handle quoted message (robust extraction)
    let quoted = null;
    const contextInfo =
      msg.message?.extendedTextMessage?.contextInfo ||
      msg.message?.imageMessage?.contextInfo ||
      msg.message?.videoMessage?.contextInfo ||
      msg.message?.documentMessage?.contextInfo ||
      msg.message?.audioMessage?.contextInfo ||
      msg.messageContextInfo ||
      msg.contextInfo;

    if (contextInfo) {
      // Try to get quoted message ID from all possible fields
      const quotedMessageId =
        contextInfo.stanzaId ||
        contextInfo.quotedMessage?.key?.id ||
        contextInfo.quotedMessageId ||
        contextInfo?.stanza_id; // Some Baileys versions

      if (quotedMessageId) {
        quoted = {
          messageId: quotedMessageId,
          senderId: contextInfo.participant ? jidNormalizedUser(contextInfo.participant) : undefined,
          text:
            contextInfo.quotedMessage?.conversation ||
            contextInfo.quotedMessage?.extendedTextMessage?.text ||
            contextInfo.quotedMessage?.imageMessage?.caption ||
            contextInfo.quotedMessage?.videoMessage?.caption ||
            ''
        };
      }
    }

    return new MessageContext({
      platform: 'whatsapp',
      messageId: msg.key.id,
      messageKey: msg.key, // 🔥 NEW: Pass the full message key
      chatId,
      senderId,
      senderName,
      text,
      command,
      args,
      isGroup,
      isOwner,
      isAdmin,
      isFromMe, // Add this field
      media,
      quoted,
      raw: msg // <-- Ensure raw is always set
    }, this);
  }

  async sendMessage(chatId, text, options = {}) {
    logOutgoing(chatId, text, options); // TEMP: Log outgoing message structure for debugging
    const message = { text };

    if (options.quoted) {
      message.quoted = { key: { id: options.quoted, remoteJid: chatId } };
    }

    const sent = await this.client.sendMessage(chatId, message);
    // Save outgoing message to memory
    if (sent?.key?.id) {
      memoryStore.saveMessage('whatsapp', chatId, sent.key.id, sent);
    }
    return sent;
  }

  async sendMedia(chatId, media, options = {}) {
    const { type = 'image', caption = '', mimetype } = options;

    const message = {
      [type]: media,
      caption,
      mimetype
    };

    return await this.client.sendMessage(chatId, message);
  }

  async sendReaction(chatId, messageKey, emoji) {
    // messageKey should be the full message key object from msg.key
    const key = typeof messageKey === 'object' ? messageKey : {
      id: messageKey,
      remoteJid: chatId,
      fromMe: false
    };

    console.log('[WhatsAppAdapter.sendReaction] Sending reaction:', {
      chatId,
      key,
      emoji
    });

    return await this.client.sendMessage(chatId, {
      react: {
        text: emoji,
        key: key
      }
    });
  }

  async deleteMessage(chatId, messageId) {
    return await this.client.sendMessage(chatId, {
      delete: { id: messageId, remoteJid: chatId }
    });
  }

  async downloadMedia(mediaInfo) {
    try {
      const buffer = await downloadMediaMessage(
        mediaInfo.raw,
        'buffer',
        {},
        { logger: this.logger, reuploadRequest: this.client.updateMediaMessage }
      );
      return buffer;
    } catch (error) {
      this.logger.error({ error }, 'Failed to download media');
      throw error;
    }
  }

  async isGroupAdmin(chatId, userId) {
    try {
      const groupMetadata = await this.client.groupMetadata(chatId);
      const participant = groupMetadata.participants.find(p => 
        jidNormalizedUser(p.id) === userId
      );
      return participant?.admin === 'admin' || participant?.admin === 'superadmin';
    } catch (error) {
      this.logger.error({ error }, 'Failed to check admin status');
      return false;
    }
  }

  async getInfo(id) {
    try {
      if (id.endsWith('@g.us')) {
        return await this.client.groupMetadata(id);
      } else {
        return await this.client.onWhatsApp(id);
      }
    } catch (error) {
      this.logger.error({ error }, 'Failed to get info');
      return null;
    }
  }

  // WhatsApp now supports editing messages via Baileys
  async editMessage(chatId, messageId, newText) {
    // messageId can be a string or a key object
    const key = typeof messageId === 'object' ? messageId : { id: messageId, remoteJid: chatId, fromMe: true };
    return await this.client.sendMessage(chatId, {
      text: newText,
      edit: key
    });
  }

  async disconnect() {
    if (this.client) {
      this.client.end(); // Gracefully close without logging out
      this.logger.info('WhatsApp disconnected (session preserved)');
    }
  }
}