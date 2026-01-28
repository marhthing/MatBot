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
import { fileURLToPath } from 'url';
import memoryStore from '../utils/memory.js';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default class WhatsAppAdapter extends BaseAdapter {
  constructor(config) {
    super('whatsapp', config);
    
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
    this.authFailures = 0;
  }

  getWhatsAppSessionPath() {
    const projectRoot = path.resolve(__dirname, '..', '..');
    return path.join(projectRoot, 'session', 'whatsapp');
  }

  async connect() {
    const sessionPath = this.getWhatsAppSessionPath();
    const credsPath = path.join(sessionPath, 'creds.json');
    const credsExist = fs.existsSync(credsPath);
    
    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true });
    }

    if (credsExist) {
      this.logger.info('Found existing WhatsApp credentials. Logging in automatically...');
      await this.connectWithCredentials(sessionPath);
      return;
    }

    if (!this.pairingMethod) {
      this.pairingMethod = await this.promptPairingMethod();
    }
    
    if (this.pairingMethod === 'pairingCode' && !this.phoneNumber) {
      this.phoneNumber = await this.promptPhoneNumber();
    }

    if (this.isFirstPairingAttempt && this.pairingMethod === 'pairingCode') {
      const files = fs.existsSync(sessionPath) ? fs.readdirSync(sessionPath) : [];
      for (const file of files) {
        fs.unlinkSync(path.join(sessionPath, file));
      }
    }

    await this.connectWithAuth(sessionPath);
  }

  async connectWithCredentials(sessionPath) {
    sessionPath = this.getWhatsAppSessionPath();
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();
    const alwaysOnline = process.env.ALWAYS_ONLINE === 'true';
    this._alwaysOnline = alwaysOnline;
    this.client = makeWASocket({
      auth: state,
      version,
      browser: Browsers.macOS('Chrome'),
      logger: this.baileysLogger,
      generateHighQualityLinkPreview: true,
      markOnlineOnConnect: alwaysOnline,
      getMessage: async (key) => {
        const msg = memoryStore.getMessage('whatsapp', key.remoteJid, key.id);
        if (msg?.message) return msg;
        return { message: null };
      }
    });

    this.setupEventHandlers(saveCreds);
  }

  async connectWithAuth(sessionPath) {
    sessionPath = this.getWhatsAppSessionPath();
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();
    const alwaysOnline = process.env.ALWAYS_ONLINE === 'true';
    this._alwaysOnline = alwaysOnline;
    this.client = makeWASocket({
      auth: state,
      version,
      browser: Browsers.macOS('Chrome'),
      logger: this.baileysLogger,
      printQRInTerminal: false,
      generateHighQualityLinkPreview: true,
      markOnlineOnConnect: alwaysOnline,
      getMessage: async (key) => {
        const msg = memoryStore.getMessage('whatsapp', key.remoteJid, key.id);
        if (msg?.message) return msg;
        return { message: null };
      }
    });

    this.setupEventHandlers(saveCreds, sessionPath);
  }

  setupEventHandlers(saveCreds, sessionPath) {
    sessionPath = this.getWhatsAppSessionPath();
    this.client.ev.on('creds.update', saveCreds);

    this.client.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        if (this.pairingMethod === 'qr') {
          this.logger.info('Scan QR code to login to WhatsApp');
          qrcode.generate(qr, { small: true });
        } else if (this.pairingMethod === 'pairingCode' && 
                   !this.pairingCodeRequested && 
                   !this.client.authState.creds.registered &&
                   this.isFirstPairingAttempt) {
          this.pairingCodeRequested = true;
          try {
            await delay(2000);
            const code = await this.client.requestPairingCode(this.phoneNumber);
            console.log(`\n🔑 Pairing Code: ${code}\n`);
          } catch (error) {
            this.logger.error({ error }, 'Failed to request pairing code');
          }
        }
      }

      if (connection === 'open') {
        this.isFirstPairingAttempt = false;
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
          }
        }
        
        // Explicitly set presence based on ALWAYS_ONLINE setting
        const alwaysOnline = process.env.ALWAYS_ONLINE === 'true';
        this._alwaysOnline = alwaysOnline;
        try {
          if (alwaysOnline) {
            await this.client.sendPresenceUpdate('available');
          } else {
            await this.client.sendPresenceUpdate('unavailable');
          }
        } catch (e) {
          // Ignore presence update errors
        }
        
        this.emit('ready');
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        if (statusCode === DisconnectReason.restartRequired || 
            (this.pairingCodeRequested && statusCode !== DisconnectReason.loggedOut)) {
          this.isFirstPairingAttempt = false;
          this.pairingCodeRequested = false;
          await delay(1000);
          await this.connectWithAuth(sessionPath);
          return;
        }
        if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
          this.authFailures++;
          if (this.authFailures >= 5) {
            this.logger.info('Clearing session after 5 failed attempts and restarting...');
            fs.rmSync(sessionPath, { recursive: true, force: true });
            this.authFailures = 0;
            this.pairingCodeRequested = false;
            this.pairingMethod = null;
            this.phoneNumber = null;
            this.isFirstPairingAttempt = true;
            await delay(2000);
            await this.connect();
          } else {
            await delay(5000);
            await this.connect();
          }
          return;
        }
        const shouldReconnect = (lastDisconnect?.error instanceof Boom) && statusCode !== DisconnectReason.loggedOut;
        if (shouldReconnect) {
          await delay(5000);
          await this.connect();
        }
      }
    });

    this.client.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const msg of messages) {
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
  }

  async promptPairingMethod() {
    return new Promise((resolve) => {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      rl.question('Choose login method (1 = QR code, 2 = 8-digit pairing code): ', (answer) => {
        rl.close();
        resolve(answer.trim() === '2' ? 'pairingCode' : 'qr');
      });
    });
  }

  async promptPhoneNumber() {
    return new Promise((resolve) => {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      rl.question('Enter your phone number: ', (answer) => {
        rl.close();
        resolve(answer.trim().replace(/[^\d]/g, ''));
      });
    });
  }

  async parseMessage(msg) {
    const isGroup = msg.key.remoteJid?.endsWith('@g.us');
    const chatId = msg.key.remoteJid;
    let senderId = isGroup ? msg.key.participant : msg.key.remoteJid;

    if (isGroup && senderId?.endsWith('@lid')) {
        if (msg.key.participantAlt) senderId = msg.key.participantAlt;
        else if (msg.key.participantPn) senderId = msg.key.participantPn;
        else {
          try {
            const pn = await this.client.signalRepository.lidMapping.getPNForLID(senderId);
            if (pn) senderId = pn;
          } catch (e) {}
        }
    } else if (!isGroup && senderId?.endsWith('@lid') && msg.key.remoteJidAlt) {
        senderId = msg.key.remoteJidAlt;
    }
    
    senderId = jidNormalizedUser(senderId);

    // Normalize LID to JID if possible for isOwner check
    let normalizedSenderForOwnerCheck = senderId;
    if (senderId.endsWith('@lid')) {
        const pn = await this.client.signalRepository.lidMapping.getPNForLID(senderId);
        if (pn) {
          normalizedSenderForOwnerCheck = jidNormalizedUser(pn);
          this.logger.debug({ senderId, resolvedPn: normalizedSenderForOwnerCheck }, 'Resolved LID for owner check');
        }
    }

    let text = msg.message?.conversation ||
               msg.message?.extendedTextMessage?.text ||
               msg.message?.imageMessage?.caption ||
               msg.message?.videoMessage?.caption || '';

    let command = null;
    let args = [];
    if (text.startsWith(this.config.prefix)) {
      const cleanedText = text.slice(this.config.prefix.length).trimStart();
      const parts = cleanedText.split(/\s+/);
      command = parts[0].toLowerCase();
      args = parts.slice(1);
    }

    const isOwner = normalizedSenderForOwnerCheck.split('@')[0] === this.config.ownerNumber || 
                    normalizedSenderForOwnerCheck === this.config.ownerNumber || 
                    normalizedSenderForOwnerCheck === jidNormalizedUser(this.config.ownerNumber + '@s.whatsapp.net') ||
                    senderId.split('@')[0] === this.config.ownerNumber;

    let isAdmin = false;
    if (isGroup) {
      try {
        const groupMetadata = await this.client.groupMetadata(chatId);
        
        // Extract phone number from senderId for comparison
        const senderPhone = senderId.split('@')[0].replace(/[^\d]/g, '');
        const normalizedSenderId = jidNormalizedUser(senderId);

        const participant = groupMetadata.participants.find(p => {
          // Get all possible identifiers for this participant
          const pId = jidNormalizedUser(p.id);
          const pLid = p.lid ? jidNormalizedUser(p.lid) : null;
          
          // Extract phone number from participant's id or phoneNumber field
          const pPhoneFromId = p.id ? p.id.split('@')[0].replace(/[^\d]/g, '') : null;
          const pPhoneFromField = p.phoneNumber ? p.phoneNumber.replace(/[^\d]/g, '') : null;
          
          // Check all possible matches
          const match = pId === normalizedSenderId || 
                        pLid === normalizedSenderId ||
                        (pPhoneFromId && pPhoneFromId === senderPhone) ||
                        (pPhoneFromField && pPhoneFromField === senderPhone);
          
          return match;
        });
        
        isAdmin = participant?.admin === 'admin' || participant?.admin === 'superadmin';
        
        if (isOwner && !isAdmin) {
          isAdmin = true;
        }
      } catch (error) {
        this.logger.error({ error }, 'Failed to get group metadata');
        if (isOwner) isAdmin = true;
      }
    }

    // Parse quoted message if present
    let quoted = null;
    const contextInfo = msg.message?.extendedTextMessage?.contextInfo ||
                        msg.message?.imageMessage?.contextInfo ||
                        msg.message?.videoMessage?.contextInfo ||
                        msg.message?.stickerMessage?.contextInfo ||
                        msg.message?.audioMessage?.contextInfo ||
                        msg.message?.documentMessage?.contextInfo;
    
    if (contextInfo?.quotedMessage) {
      const quotedMsg = contextInfo.quotedMessage;
      let quotedSenderId = contextInfo.participant || contextInfo.remoteJid;
      
      // Handle LID format for quoted sender
      if (quotedSenderId?.endsWith('@lid')) {
        try {
          const pn = await this.client.signalRepository.lidMapping.getPNForLID(quotedSenderId);
          if (pn) quotedSenderId = pn;
        } catch (e) {}
      }
      if (quotedSenderId) {
        quotedSenderId = jidNormalizedUser(quotedSenderId);
      }
      
      // Determine quoted message type
      let quotedType = 'text';
      let quotedText = '';
      
      if (quotedMsg.imageMessage) {
        quotedType = 'image';
        quotedText = quotedMsg.imageMessage.caption || '';
      } else if (quotedMsg.videoMessage) {
        quotedType = 'video';
        quotedText = quotedMsg.videoMessage.caption || '';
      } else if (quotedMsg.audioMessage) {
        quotedType = 'audio';
      } else if (quotedMsg.stickerMessage) {
        quotedType = 'sticker';
      } else if (quotedMsg.documentMessage) {
        quotedType = 'document';
      } else if (quotedMsg.conversation) {
        quotedText = quotedMsg.conversation;
      } else if (quotedMsg.extendedTextMessage) {
        quotedText = quotedMsg.extendedTextMessage.text || '';
      }
      
      quoted = {
        messageId: contextInfo.stanzaId,
        senderId: quotedSenderId,
        type: quotedType,
        text: quotedText,
        message: quotedMsg,
        raw: {
          key: {
            remoteJid: chatId,
            id: contextInfo.stanzaId,
            participant: contextInfo.participant
          },
          message: quotedMsg
        }
      };
    }

    return new MessageContext({
      platform: 'whatsapp',
      messageId: msg.key.id,
      messageKey: msg.key,
      chatId,
      senderId,
      senderName: msg.pushName || senderId.split('@')[0],
      text,
      command,
      args,
      isGroup,
      isOwner,
      isAdmin,
      isFromMe: msg.key.fromMe || false,
      quoted,
      raw: msg
    }, this);
  }

  async sendMessage(chatId, text, options = {}) {
    const message = { text };
    if (options.quoted) message.quoted = { key: { id: options.quoted, remoteJid: chatId } };
    const sent = await this.client.sendMessage(chatId, message);
    if (sent?.key?.id) memoryStore.saveMessage('whatsapp', chatId, sent.key.id, sent);
    return sent;
  }

  async sendReaction(chatId, messageKey, emoji) {
    const key = typeof messageKey === 'object' ? messageKey : { id: messageKey, remoteJid: chatId, fromMe: false };
    return await this.client.sendMessage(chatId, { react: { text: emoji, key: key } });
  }

  async deleteMessage(chatId, messageId) {
    return await this.client.sendMessage(chatId, { delete: { id: messageId, remoteJid: chatId } });
  }

  async clearChat(chatId) {
    try {
      // Baileys requires the key and timestamp of the last message to clear/delete a chat properly
      const lastMsg = memoryStore.getLatestMessage('whatsapp', chatId);
      
      // this.logger.info({ chatId, hasLastMsg: !!lastMsg }, 'Attempting to clear chat');

      // 1. First attempt: Delete for me (clears history but keeps chat in list)
      try {
        await this.client.chatModify({
          clear: {
            messages: lastMsg ? [{
              key: lastMsg.key,
              messageTimestamp: lastMsg.messageTimestamp
            }] : []
          }
        }, chatId);
      } catch (e) {
        this.logger.warn({ error: e.message, chatId }, 'Chat clear failed, trying delete');
      }

      // 2. Second attempt: Delete chat (removes from list)
      await this.client.chatModify(
        { 
          delete: true,
          lastMessages: lastMsg ? [{
            key: lastMsg.key,
            messageTimestamp: lastMsg.messageTimestamp
          }] : []
        }, 
        chatId
      );
      
      return true;
    } catch (error) {
      this.logger.error({ error: error.message, chatId }, 'Failed to clear chat');
      // Final fallback: old style clear if possible
      try {
        await this.client.chatModify({ clear: 'all' }, chatId);
        return true;
      } catch (e) {
        throw error;
      }
    }
  }

  async downloadMedia(mediaInfo) {
    try {
      return await downloadMediaMessage(mediaInfo.raw, 'buffer', {}, { logger: this.logger, reuploadRequest: this.client.updateMediaMessage });
    } catch (error) {
      throw error;
    }
  }

  async isGroupAdmin(chatId, userId) {
    try {
      const groupMetadata = await this.client.groupMetadata(chatId);
      
      // Extract phone number from userId for comparison
      const userPhone = userId.split('@')[0].replace(/[^\d]/g, '');
      const normalizedUserId = jidNormalizedUser(userId);
      
      const participant = groupMetadata.participants.find(p => {
        const pId = jidNormalizedUser(p.id);
        const pLid = p.lid ? jidNormalizedUser(p.lid) : null;
        const pPhoneFromId = p.id ? p.id.split('@')[0].replace(/[^\d]/g, '') : null;
        const pPhoneFromField = p.phoneNumber ? p.phoneNumber.replace(/[^\d]/g, '') : null;
        
        return pId === normalizedUserId || 
               pLid === normalizedUserId ||
               (pPhoneFromId && pPhoneFromId === userPhone) ||
               (pPhoneFromField && pPhoneFromField === userPhone);
      });
      
      return participant?.admin === 'admin' || participant?.admin === 'superadmin';
    } catch (error) {
      return false;
    }
  }

  async getInfo(id) {
    try {
      if (id.endsWith('@g.us')) return await this.client.groupMetadata(id);
      return await this.client.onWhatsApp(id);
    } catch (error) {
      return null;
    }
  }

  async sendMedia(chatId, mediaBuffer, mediaType, options = {}) {
    // Support both string and object for mediaType
    let type = mediaType;
    let mimetype = options.mimetype;
    
    if (mediaType && typeof mediaType === 'object') {
      type = mediaType.type || mediaType.mediaType || mediaType.kind;
      if (mediaType.mimetype) mimetype = mediaType.mimetype;
    }
    
    if (!type) {
      throw new Error('Media type is required. Received: ' + JSON.stringify(mediaType));
    }

    let message = {};
    if (type === 'image') {
      message.image = mediaBuffer;
      if (options.caption) message.caption = options.caption;
    } else if (type === 'video') {
      message.video = mediaBuffer;
      if (options.caption) message.caption = options.caption;
      if (options.gifPlayback) message.gifPlayback = true;
      if (mimetype) message.mimetype = mimetype;
    } else if (type === 'audio') {
      message.audio = mediaBuffer;
      message.mimetype = mimetype || 'audio/mp4';
      if (options.ptt) message.ptt = true;
    } else if (type === 'document') {
      message.document = mediaBuffer;
      message.mimetype = mimetype || 'application/octet-stream';
      if (options.fileName) message.fileName = options.fileName;
    } else if (type === 'sticker') {
      message.sticker = mediaBuffer;
    } else {
      throw new Error('Unsupported media type: ' + type);
    }
    if (options.quoted) message.quoted = { key: { id: options.quoted, remoteJid: chatId } };
    const sent = await this.client.sendMessage(chatId, message);
    if (sent?.key?.id) memoryStore.saveMessage('whatsapp', chatId, sent.key.id, sent);
    return sent;
  }

  async setAlwaysOnline(value) {
    this._alwaysOnline = value;
    try {
      if (value) {
        await this.client.sendPresenceUpdate('available');
      } else {
        await this.client.sendPresenceUpdate('unavailable');
      }
    } catch (e) {
      // Ignore presence update errors
    }
  }
}