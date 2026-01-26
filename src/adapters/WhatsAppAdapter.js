import makeWASocket, { 
  DisconnectReason, 
  useMultiFileAuthState,
  downloadMediaMessage,
  jidNormalizedUser,
  delay,
  fetchLatestBaileysVersion,
  Browsers
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';
import BaseAdapter from './BaseAdapter.js';
import MessageContext from '../core/MessageContext.js';
import fs from 'fs';
import path from 'path';
import memoryStore from '../utils/memory.js';
import { logIncoming, logOutgoing } from '../utils/debugMessageLogger.js';
import readline from 'readline';

export default class WhatsAppAdapter extends BaseAdapter {
  constructor(config) {
    super('whatsapp', config);
    
    // Create a Baileys-compatible silent logger
    this.baileysLogger = {
      level: 'silent',
      child: () => this.baileysLogger,
      trace: () => {}, debug: () => {}, info: () => {},
      warn: () => {}, error: () => {}, fatal: () => {}
    };
    this.pendingViewOnce = new Map();
    this.pairingCodeRequested = false;
    this.pairingMethod = null;
    this.phoneNumber = null;
    this.isFirstPairingAttempt = true;
  }

  async connect() {
    const sessionPath = path.join(this.config.paths.session, 'whatsapp');
    
    // Check if credentials exist
    const credsPath = path.join(sessionPath, 'creds.json');
    const credsExist = fs.existsSync(credsPath);
    
    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true });
    }

    // If credentials exist, auto-login without prompting
    if (credsExist) {
      this.logger.info('Found existing WhatsApp credentials. Logging in automatically...');
      await this.connectWithCredentials(sessionPath);
      return;
    }

    // Ask for pairing method and phone number BEFORE attempting connection
    if (!this.pairingMethod) {
      this.pairingMethod = await this.promptPairingMethod();
    }
    
    if (this.pairingMethod === 'pairingCode' && !this.phoneNumber) {
      this.phoneNumber = await this.promptPhoneNumber();
    }

    // Clear auth directory on first pairing attempt for clean start
    if (this.isFirstPairingAttempt && this.pairingMethod === 'pairingCode') {
      const files = fs.readdirSync(sessionPath);
      for (const file of files) {
        fs.unlinkSync(path.join(sessionPath, file));
      }
    }

    await this.connectWithAuth(sessionPath);
  }

  async connectWithCredentials(sessionPath) {
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();
    const alwaysOnline = process.env.ALWAYS_ONLINE === 'true';
    this.logger.info(`[WhatsAppAdapter] ALWAYS_ONLINE: ${process.env.ALWAYS_ONLINE}, alwaysOnline: ${alwaysOnline}`);
    this.logger.info('[WhatsAppAdapter] makeWASocket options', {
      markOnlineOnConnect: alwaysOnline,
      shouldAlwaysSendPresence: alwaysOnline
    });
    this.client = makeWASocket({
      auth: state,
      version,
      browser: Browsers.macOS('Chrome'),
      logger: this.baileysLogger,
      generateHighQualityLinkPreview: true,
      markOnlineOnConnect: alwaysOnline, // <-- dynamic, should match ALWAYS_ONLINE
      shouldAlwaysSendPresence: alwaysOnline, // <-- dynamic, should match ALWAYS_ONLINE
      getMessage: async (key) => {
        const msg = memoryStore.getMessage('whatsapp', key.remoteJid, key.id);
        if (msg?.message) return msg;
        return { message: null };
      }
    });

    this.setupEventHandlers(saveCreds);
  }

  async connectWithAuth(sessionPath) {
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();
    const alwaysOnline = process.env.ALWAYS_ONLINE === 'true';
    this.logger.info(`[WhatsAppAdapter] ALWAYS_ONLINE: ${process.env.ALWAYS_ONLINE}, alwaysOnline: ${alwaysOnline}`);
    this.logger.info('[WhatsAppAdapter] makeWASocket options', {
      markOnlineOnConnect: alwaysOnline,
      shouldAlwaysSendPresence: alwaysOnline
    });
    this.client = makeWASocket({
      auth: state,
      version,
      browser: Browsers.macOS('Chrome'),
      logger: this.baileysLogger,
      printQRInTerminal: false,
      generateHighQualityLinkPreview: true,
      markOnlineOnConnect: alwaysOnline, // <-- dynamic, should match ALWAYS_ONLINE
      shouldAlwaysSendPresence: alwaysOnline, // <-- dynamic, should match ALWAYS_ONLINE
      getMessage: async (key) => {
        const msg = memoryStore.getMessage('whatsapp', key.remoteJid, key.id);
        if (msg?.message) return msg;
        return { message: null };
      }
    });

    this.setupEventHandlers(saveCreds, sessionPath);
  }

  setupEventHandlers(saveCreds, sessionPath) {
    // Save credentials when updated
    this.client.ev.on('creds.update', saveCreds);

    // Handle connection updates
    this.client.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      // Handle QR code - request pairing code or display QR
      if (qr) {
        if (this.pairingMethod === 'qr') {
          this.logger.info('Scan QR code to login to WhatsApp');
          console.log('\n╔════════════════════════════════════════╗');
          console.log('║   Scan this QR code in WhatsApp:       ║');
          console.log('║   Settings > Linked Devices            ║');
          console.log('║   > Link a Device                      ║');
          console.log('╚════════════════════════════════════════╝\n');
          qrcode.generate(qr, { small: true });
          console.log('\n⏳ Waiting for you to scan the QR code...\n');
        } else if (this.pairingMethod === 'pairingCode' && 
                   !this.pairingCodeRequested && 
                   !this.client.authState.creds.registered &&
                   this.isFirstPairingAttempt) {
          this.pairingCodeRequested = true;
          
          try {
            // Wait for socket to stabilize (2 seconds like working bot)
            await delay(2000);
            
            const code = await this.client.requestPairingCode(this.phoneNumber);
            console.log('\n╔════════════════════════════════════════╗');
            console.log(`║   🔑 Pairing Code: ${code}              ║`);
            console.log('╚════════════════════════════════════════╝\n');
            console.log('📱 Enter this code in WhatsApp:');
            console.log('   Settings → Linked Devices → Link a Device');
            console.log('   → Link with phone number instead\n');
            console.log('⏰ You have 20 seconds to enter the code\n');
          } catch (error) {
            this.logger.error({ error }, 'Failed to request pairing code');
            console.log('\n❌ Pairing code error:', error.message);
            console.log('Make sure phone number format is correct (e.g., 2347012343234)\n');
            process.exit(1);
          }
        }
      }

      // Handle successful connection
      if (connection === 'open') {
        console.log('\n✅ Successfully paired and connected!\n');
        this.isFirstPairingAttempt = false;
        
        // Get the bot's own WhatsApp number
        const userId = this.client.user?.id;
        if (userId) {
          const phone = userId.split(':')[0].replace(/[^\d]/g, '');
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

      // Handle connection close
      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        
        // After entering pairing code, WhatsApp disconnects to reconnect with credentials
        if (statusCode === DisconnectReason.restartRequired || 
            (this.pairingCodeRequested && statusCode !== DisconnectReason.loggedOut)) {
          console.log('\n🔄 Reconnecting with saved credentials...\n');
          this.isFirstPairingAttempt = false;
          this.pairingCodeRequested = false;
          await delay(1000);
          await this.connectWithAuth(sessionPath);
          return;
        }
        
        // Handle authentication failure
        if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
          console.log('\n❌ Authentication failed - Please restart and try again\n');
          process.exit(1);
        }
        
        // Normal reconnection
        const shouldReconnect = (lastDisconnect?.error instanceof Boom) &&
          statusCode !== DisconnectReason.loggedOut;
        
        if (shouldReconnect) {
          this.logger.info('Connection closed. Reconnecting...');
          await delay(5000);
          await this.connect();
        }
      }
    });

    // Handle incoming messages
    this.client.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const msg of messages) {
        const keys = Object.keys(msg.message || {});
        if (msg.key?.isViewOnce && !msg.message && this.pendingViewOnce.has(msg.key.id)) {
          msg.message = this.pendingViewOnce.get(msg.key.id).message;
          this.pendingViewOnce.delete(msg.key.id);
        }
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

    // Handle protocol messages
    this.client.ev.on('messages.update', async (updates) => {
      for (const update of updates) {
        this.emit('protocol', update);
      }
    });
  }

  async promptPairingMethod() {
    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      console.log('\n🔐 WhatsApp Authentication');
      rl.question('Choose login method (1 = QR code, 2 = 8-digit pairing code): ', (answer) => {
        rl.close();
        if (answer.trim() === '2') {
          resolve('pairingCode');
        } else {
          resolve('qr');
        }
      });
    });
  }

  async promptPhoneNumber() {
    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      console.log('\n📱 Phone Number Format:');
      console.log('   - Country code + number (no +, -, spaces, or parentheses)');
      console.log('   - Example: 447123456789 (UK), 12125551234 (US), 628123456789 (Indonesia)\n');
      
      rl.question('Enter your phone number: ', (answer) => {
        rl.close();
        // Clean the input to remove any non-numeric characters
        const cleanNumber = answer.trim().replace(/[^\d]/g, '');
        resolve(cleanNumber);
      });
    });
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

  /**
   * Send presence update (e.g., 'composing', 'recording', 'available', 'unavailable')
   */
  async sendPresence(chatId, type = 'composing') {
    if (!this.client || typeof this.client.sendPresenceUpdate !== 'function') {
      throw new Error('Baileys client not ready or sendPresenceUpdate not available');
    }
    // type: 'composing', 'recording', 'paused', 'available', 'unavailable'
    return await this.client.sendPresenceUpdate(type, chatId);
  }

  /**
   * Dynamically set always-online mode and update presence immediately
   */
  async setAlwaysOnline(value) {
    this._alwaysOnline = value;
    if (this.client && typeof this.client.sendPresenceUpdate === 'function') {
      if (value) {
        await this.client.sendPresenceUpdate('available');
      } else {
        await this.client.sendPresenceUpdate('unavailable');
      }
    }
  }

  /**
   * Mark a message as read
   */
  async markRead(chatId, messageId) {
    if (this.client && typeof this.client.readMessages === 'function') {
      await this.client.readMessages([{ remoteJid: chatId, id: messageId }]);
    }
  }

  async disconnect() {
    if (this.client) {
      this.client.end(); // Gracefully close without logging out
      this.logger.info('WhatsApp disconnected (session preserved)');
    }
  }
}