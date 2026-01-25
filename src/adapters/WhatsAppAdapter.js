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
import readline from 'readline';
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
    
    this.baileysLogger = pino({ level: 'silent' });
    this.pendingViewOnce = new Map();
    this.loginMethod = null;
    this.isFirstPairingAttempt = true;
  }

  async connect() {
    const sessionPath = path.join(this.config.paths.session, 'whatsapp');
    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true });
    }

    const credsPath = path.join(sessionPath, 'creds.json');
    const credsExist = fs.existsSync(credsPath);

    if (credsExist) {
      // Auto-login with existing credentials
      this.logger.info('🔑 Found existing WhatsApp credentials. Logging in automatically...');
      await this.connectWithExistingCreds(sessionPath);
      return;
    }

    // Interactive login method selection for new connections
    await this.promptLoginMethod(sessionPath);
  }

  async promptLoginMethod(sessionPath) {
    const rl = readline.createInterface({ 
      input: process.stdin, 
      output: process.stdout 
    });

    let methodPrompted = false;
    let methodTimeout;

    const promptUser = () => {
      if (methodPrompted) return;
      methodPrompted = true;
      
      rl.question('Choose login method: [1] QR Code, [2] Pairing Code. (Default: Pairing Code in 30s)\n> ', (answer) => {
        clearTimeout(methodTimeout);
        if (answer.trim() === '1') {
          this.loginMethod = 'qr';
          this.connectWithQRCode(sessionPath, rl);
        } else {
          this.loginMethod = 'pairing';
          this.promptPhoneNumber(sessionPath, rl);
        }
      });

      // Default to pairing code after 30s
      methodTimeout = setTimeout(() => {
        if (!this.loginMethod) {
          this.loginMethod = 'pairing';
          console.log('⏳ No option selected. Defaulting to Pairing Code.');
          this.promptPhoneNumber(sessionPath, rl);
        }
      }, 30000);
    };

    promptUser();
  }

  async promptPhoneNumber(sessionPath, rl) {
    rl.question('Enter your WhatsApp number with country code (e.g. +1234567890):\n> ', (number) => {
      const userNumber = number.trim();
      if (!userNumber.match(/^\+\d{10,15}$/)) {
        console.log('❌ Invalid number format. Please try again.');
        this.promptPhoneNumber(sessionPath, rl);
      } else {
        this.connectWithPairingCode(sessionPath, userNumber, rl);
      }
    });
  }

  async connectWithExistingCreds(sessionPath) {
    try {
      const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
      const version = (await fetchLatestBaileysVersion()).version;
      
      this.client = makeWASocket({
        auth: state,
        version,
        browser: Browsers.macOS('Chrome'),
        logger: this.baileysLogger,
        printQRInTerminal: false,
        generateHighQualityLinkPreview: true,
        defaultQueryTimeoutMs: 60000,
        getMessage: async (key) => {
          const msg = memoryStore.getMessage('whatsapp', key.remoteJid, key.id);
          if (msg?.message) return msg;
          if (key.isViewOnce) return undefined;
          return { message: null };
        }
      });

      this.setupEventHandlers(saveCreds);
    } catch (error) {
      this.logger.error({ error }, 'Failed to connect with existing credentials');
      throw error;
    }
  }

  async connectWithQRCode(sessionPath, rl) {
    try {
      const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
      const version = (await fetchLatestBaileysVersion()).version;
      
      this.client = makeWASocket({
        auth: state,
        version,
        browser: Browsers.macOS('Chrome'),
        logger: this.baileysLogger,
        printQRInTerminal: true,
        getMessage: async (key) => {
          const msg = memoryStore.getMessage('whatsapp', key.remoteJid, key.id);
          if (msg?.message) return msg;
          if (key.isViewOnce) return undefined;
          return { message: null };
        }
      });

      this.setupEventHandlers(saveCreds);
      rl.close();
    } catch (error) {
      this.logger.error({ error }, 'Failed to connect with QR code');
      rl.close();
      throw error;
    }
  }

  async connectWithPairingCode(sessionPath, userNumber, rl) {
    try {
      // ONLY clear auth directory on FIRST attempt, not on reconnects
      if (this.isFirstPairingAttempt) {
        if (fs.existsSync(sessionPath)) {
          fs.rmSync(sessionPath, { recursive: true, force: true });
        }
        fs.mkdirSync(sessionPath, { recursive: true });
      }

      const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
      const version = (await fetchLatestBaileysVersion()).version;
      
      this.client = makeWASocket({
        auth: state,
        version,
        browser: Browsers.macOS('Chrome'),
        logger: this.baileysLogger,
        printQRInTerminal: false,
        getMessage: async (key) => {
          const msg = memoryStore.getMessage('whatsapp', key.remoteJid, key.id);
          if (msg?.message) return msg;
          if (key.isViewOnce) return undefined;
          return { message: null };
        }
      });

      let pairingRequested = false;

      // Save credentials when updated
      this.client.ev.on('creds.update', saveCreds);

      // Handle connection updates
      this.client.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        console.log('[DEBUG] Pairing connection status:', connection);

        // Request pairing code only on first attempt when QR appears
        if (qr && !pairingRequested && !this.client.authState.creds.registered && this.isFirstPairingAttempt) {
          pairingRequested = true;
          
          // Wait for socket to stabilize
          await delay(2000);
          
          try {
            const phoneNumber = userNumber.replace(/\D/g, '');
            console.log('\n📞 Requesting pairing code for:', phoneNumber);
            
            const code = await this.client.requestPairingCode(phoneNumber);
            
            console.log('\n╔═══════════════════════════════════╗');
            console.log(`║  🔑 Pairing Code: ${code}  ║`);
            console.log('╚═══════════════════════════════════╝\n');
            console.log('📱 Enter this code in WhatsApp:');
            console.log('   Settings → Linked Devices → Link a Device');
            console.log('   → Link with phone number instead\n');
            console.log('⏰ You have 20 seconds\n');
          } catch (err) {
            console.error('\n❌ Pairing code error:', err.message);
            process.exit(1);
          }
          
          rl.close();
        }

        // Handle successful connection
        if (connection === 'open') {
          console.log('\n✅ Successfully paired and connected!\n');
          this.isFirstPairingAttempt = false;
          this.emit('ready');
        }

        // Handle connection close
        if (connection === 'close') {
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          
          // After entering code, WhatsApp disconnects to reconnect with credentials
          if (statusCode === DisconnectReason.restartRequired || 
              (pairingRequested && statusCode !== DisconnectReason.loggedOut)) {
            console.log('\n🔄 Reconnecting with saved credentials...\n');
            this.isFirstPairingAttempt = false;
            setTimeout(() => this.connectWithPairingCode(sessionPath, userNumber, rl), 1000);
            return;
          }

          // Handle authentication failure
          if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
            console.log('\n❌ Pairing failed - Authentication error\n');
            process.exit(1);
          }
        }
      });

      // Setup remaining event handlers
      this.client.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        for (const msg of messages) {
          const keys = Object.keys(msg.message || {});
          console.log(`[WhatsAppAdapter] New Message: ${msg.key.id} | Keys: ${keys.length > 0 ? keys : 'EMPTY'}`);
          
          if (msg.key?.isViewOnce && !msg.message && this.pendingViewOnce.has(msg.key.id)) {
            console.log('[WhatsAppAdapter] 🔥 Restoring view-once from cache!');
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

      this.client.ev.on('messages.update', async (updates) => {
        for (const update of updates) {
          this.emit('protocol', update);
        }
      });

    } catch (err) {
      console.error('\n❌ Setup error:', err.message);
      rl.close();
      throw err;
    }
  }

  setupEventHandlers(saveCreds) {
    this.client.ev.on('creds.update', saveCreds);

    this.client.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr && this.loginMethod === 'qr') {
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
    });

    this.client.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const msg of messages) {
        const keys = Object.keys(msg.message || {});
        console.log(`[WhatsAppAdapter] New Message: ${msg.key.id} | Keys: ${keys.length > 0 ? keys : 'EMPTY'}`);
        
        if (msg.key?.isViewOnce && !msg.message && this.pendingViewOnce.has(msg.key.id)) {
          console.log('[WhatsAppAdapter] 🔥 Restoring view-once from cache!');
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

    this.client.ev.on('messages.update', async (updates) => {
      for (const update of updates) {
        this.emit('protocol', update);
      }
    });
  }

  async parseMessage(msg) {
    const isGroup = msg.key.remoteJid?.endsWith('@g.us');
    const chatId = msg.key.remoteJid;
    
    let senderId;
    if (isGroup) {
      senderId = msg.key.participant;
      
      if (senderId?.endsWith('@lid')) {
        if (msg.key.participantAlt) {
          senderId = msg.key.participantAlt;
        } else if (msg.key.participantPn) {
          senderId = msg.key.participantPn;
        } else {
          try {
            const pn = await this.client.signalRepository.lidMapping.getPNForLID(senderId);
            if (pn) senderId = pn;
          } catch (e) {
            this.logger.warn(`Could not resolve LID to PN for ${senderId}`);
          }
        }
      }
    } else {
      senderId = msg.key.remoteJid;
      
      if (senderId?.endsWith('@lid') && msg.key.remoteJidAlt) {
        senderId = msg.key.remoteJidAlt;
      }
    }
    
    senderId = jidNormalizedUser(senderId);

    let text = msg.message?.conversation ||
               msg.message?.extendedTextMessage?.text ||
               msg.message?.imageMessage?.caption ||
               msg.message?.videoMessage?.caption || '';

    let command = null;
    let args = [];
    
    if (text.startsWith(this.config.prefix)) {
      const parts = text.slice(this.config.prefix.length).trim().split(/\s+/);
      command = parts[0].toLowerCase();
      args = parts.slice(1);
    }

    const isOwner = senderId.split('@')[0] === this.config.ownerNumber;

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

    let senderName = msg.pushName || senderId.split('@')[0];
    const isFromMe = msg.key.fromMe || false;

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
      const quotedMessageId =
        contextInfo.stanzaId ||
        contextInfo.quotedMessage?.key?.id ||
        contextInfo.quotedMessageId ||
        contextInfo?.stanza_id;

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
      messageKey: msg.key,
      chatId,
      senderId,
      senderName,
      text,
      command,
      args,
      isGroup,
      isOwner,
      isAdmin,
      isFromMe,
      media,
      quoted,
      raw: msg
    }, this);
  }

  async sendMessage(chatId, text, options = {}) {
    logOutgoing(chatId, text, options);
    const message = { text };

    if (options.quoted) {
      message.quoted = { key: { id: options.quoted, remoteJid: chatId } };
    }

    const sent = await this.client.sendMessage(chatId, message);
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
    const key = typeof messageKey === 'object' ? messageKey : {
      id: messageKey,
      remoteJid: chatId,
      fromMe: false
    };

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

  async editMessage(chatId, messageId, newText) {
    const key = typeof messageId === 'object' ? messageId : { id: messageId, remoteJid: chatId, fromMe: true };
    return await this.client.sendMessage(chatId, {
      text: newText,
      edit: key
    });
  }

  async disconnect() {
    if (this.client) {
      this.client.end();
      this.logger.info('WhatsApp disconnected (session preserved)');
    }
  }
}