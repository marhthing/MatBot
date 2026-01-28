import memoryStore from '../utils/memory.js';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import fs from 'fs';
import path from 'path';

const STORAGE_PATH = path.join(process.cwd(), 'storage', 'storage.json');
const ENV_PATH = path.join(process.cwd(), '.env');

function getAntideleteConfig() {
  let config = { dest: 'owner', jid: null };
  try {
    const raw = fs.readFileSync(STORAGE_PATH, 'utf8');
    const json = JSON.parse(raw.replace(/^\/\/.*$/mg, ''));
    if (json.antidelete) config = { ...config, ...json.antidelete };
  } catch {}
  return config;
}
function setAntideleteConfig(newConfig) {
  let json = {};
  try {
    const raw = fs.readFileSync(STORAGE_PATH, 'utf8');
    json = JSON.parse(raw.replace(/^\/\/.*$/mg, ''));
  } catch {}
  json.antidelete = { ...json.antidelete, ...newConfig };
  fs.writeFileSync(STORAGE_PATH, JSON.stringify(json, null, 2));
}
function setAntideleteEnabled(enabled) {
  let env = fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/);
  let found = false;
  env = env.map(line => {
    if (line.startsWith('ANTIDELETE_ENABLED=')) {
      found = true;
      return `ANTIDELETE_ENABLED=${enabled ? 'on' : 'off'}`;
    }
    return line;
  });
  if (!found) env.push(`ANTIDELETE_ENABLED=${enabled ? 'on' : 'off'}`);
  fs.writeFileSync(ENV_PATH, env.join('\n'));
}
function getAntideleteEnabled() {
  try {
    const env = fs.readFileSync(ENV_PATH, 'utf8');
    const match = env.match(/^ANTIDELETE_ENABLED=(on|off)/m);
    return !match || match[1] === 'on';
  } catch { return true; }
}

// Deduplication tracking
const processedDeletes = new Map();
const processingDeletes = new Set();
const deletionQueue = []; // 🔥 NEW: Queue for processing deletions one by one
let isProcessingQueue = false; // 🔥 NEW: Flag to track if queue is being processed

// Cache for group metadata to avoid rate limiting
const groupMetadataCache = new Map();

// Cleanup old processed deletes every 5 minutes
setInterval(() => {
  const now = Date.now();
  const cutoff = now - 300000; // 5 minutes
  for (const [key, timestamp] of processedDeletes.entries()) {
    if (timestamp < cutoff) {
      processedDeletes.delete(key);
    }
  }
}, 300000);

export default {
  name: 'antidelete',
  description: 'Recovers deleted messages and sends them to owner',
  version: '1.6.0',
  author: 'MATDEV',
  commands: [
    {
      name: 'delete',
      description: 'Configure antidelete destination and state',
      usage: '.delete <jid|g|p|on|off>',
      async execute(ctx) {
        const arg = ctx.args[0]?.toLowerCase();
        if (!arg) {
          const conf = getAntideleteConfig();
          const enabled = getAntideleteEnabled();
          await ctx.reply(`Antidelete is ${enabled ? 'ON' : 'OFF'}\nDestination: ${conf.dest}${conf.jid ? `\nJID: ${conf.jid}` : ''}`);
          return;
        }
        if (arg === 'on' || arg === 'off') {
          setAntideleteEnabled(arg === 'on');
          await ctx.reply(`Antidelete ${arg === 'on' ? 'enabled' : 'disabled'}.`);
          return;
        }
        if (arg === 'g') {
          setAntideleteConfig({ dest: 'group', jid: null });
          await ctx.reply('Antidelete will now send deleted messages to the same chat.');
          return;
        }
        if (arg === 'p') {
          setAntideleteConfig({ dest: 'owner', jid: null });
          await ctx.reply('Antidelete will now send deleted messages to the owner.');
          return;
        }
        if (/^[0-9a-zA-Z@._-]+$/.test(arg)) {
          setAntideleteConfig({ dest: 'custom', jid: arg });
          await ctx.reply(`Antidelete will now send deleted messages to JID: ${arg}`);
          return;
        }
        await ctx.reply('Invalid argument. Usage: .delete <jid|g|p|on|off>');
      }
    },
    {
      name: 'antistatus',
      description: 'Configure WhatsApp status antidelete destination and state',
      usage: '.antistatus <jid|g|p|on|off>',
      async execute(ctx) {
        // Use a separate config section for status
        const STORAGE_PATH = path.join(process.cwd(), 'storage', 'storage.json');
        const ENV_PATH = path.join(process.cwd(), '.env');
        function getStatusConfig() {
          let config = { dest: 'owner', jid: null };
          try {
            const raw = fs.readFileSync(STORAGE_PATH, 'utf8');
            const json = JSON.parse(raw.replace(/^\/\/.*$/mg, ''));
            if (json.statusantidelete) config = { ...config, ...json.statusantidelete };
            if (config.dest !== 'custom') {
              config.dest = 'owner';
              config.jid = null;
            }
          } catch {}
          return config;
        }
        function setStatusConfig(newConfig) {
          let json = {};
          try {
            const raw = fs.readFileSync(STORAGE_PATH, 'utf8');
            json = JSON.parse(raw.replace(/^\/\/.*$/mg, ''));
          } catch {}
          if (!json.statusantidelete || typeof json.statusantidelete !== 'object') {
            json.statusantidelete = { dest: 'owner', jid: null };
          }
          json.statusantidelete = { ...json.statusantidelete, ...newConfig };
          fs.writeFileSync(STORAGE_PATH, JSON.stringify(json, null, 2));
        }
        function getStatusEnabled() {
          try {
            const env = fs.readFileSync(ENV_PATH, 'utf8');
            const match = env.match(/^STATUSANTIDELETE_ENABLED=(true|on|1|false|off|0)/m);
            if (!match) return false;
            return ['true', 'on', '1'].includes(match[1]);
          } catch { return false; }
        }
        function setStatusEnabled(enabled) {
          let env = fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/);
          let found = false;
          env = env.map(line => {
            if (line.startsWith('STATUSANTIDELETE_ENABLED=')) {
              found = true;
              return `STATUSANTIDELETE_ENABLED=${enabled ? 'true' : 'false'}`;
            }
            return line;
          });
          if (!found) env.push(`STATUSANTIDELETE_ENABLED=${enabled ? 'true' : 'false'}`);
          fs.writeFileSync(ENV_PATH, env.join('\n'));
        }
        const arg = ctx.args[0]?.toLowerCase();
        const conf = getStatusConfig();
        const enabled = getStatusEnabled();
        if (!arg) {
          await ctx.reply(`StatusAntidelete is ${enabled ? 'ON' : 'OFF'}\nDestination: ${conf.dest}${conf.jid ? `\nJID: ${conf.jid}` : ''}`);
          return;
        }
        if (arg === 'on' || arg === 'off') {
          setStatusEnabled(arg === 'on');
          await ctx.reply(`StatusAntidelete ${arg === 'on' ? 'enabled' : 'disabled'}.`);
          return;
        }
        if (arg === 'g') {
          setStatusConfig({ dest: 'group', jid: null });
          await ctx.reply('StatusAntidelete will now send deleted statuses to the same chat.');
          return;
        }
        if (arg === 'p') {
          setStatusConfig({ dest: 'owner', jid: null });
          await ctx.reply('StatusAntidelete will now send deleted statuses to the owner.');
          return;
        }
        if (/^[0-9a-zA-Z@._-]+$/.test(arg)) {
          if (arg.endsWith('@status') || arg.endsWith('@broadcast') || arg.endsWith('@g.us')) {
            await ctx.reply('Group, broadcast, or status JIDs are not allowed as custom destinations.');
            return;
          }
          setStatusConfig({ dest: 'custom', jid: arg });
          await ctx.reply(`StatusAntidelete will now send deleted statuses to JID: ${arg}`);
          return;
        }
        await ctx.reply('Invalid argument. Usage: .antistatus <jid|g|p|on|off>');
      }
    }
  ],
  
  async onLoad(bot) {
    const whatsappAdapter = bot.getAdapter('whatsapp');
    if (!whatsappAdapter) return;
    
    const ownerJid = bot.config.ownerNumber ? `${bot.config.ownerNumber}@s.whatsapp.net` : null;
    
    if (!ownerJid) {
      // console.log('[antidelete] No owner number configured, antidelete disabled');
      return;
    }
    
    // console.log('[antidelete] Plugin loaded, monitoring for deleted messages');
    
    // 🔥 NEW: Queue processor function
    const processQueue = async () => {
      if (isProcessingQueue || deletionQueue.length === 0) return;
      
      isProcessingQueue = true;
      
      while (deletionQueue.length > 0) {
        const deletion = deletionQueue.shift();
        
        try {
          await processDeletion(deletion);
        } catch (err) {
          console.error('[antidelete] Error processing queued deletion:', err);
        }
        
        // Small delay between processing to avoid rate limits
        if (deletionQueue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      isProcessingQueue = false;
    };
    
    // 🔥 NEW: Process a single deletion
    const processDeletion = async ({ deletedKey, chatId, deletedMessageId }) => {
      const dedupeKey = `${chatId}|${deletedMessageId}`;
      const now = Date.now();
      
      // Check if already processed
      const lastProcessed = processedDeletes.get(dedupeKey);
      if (lastProcessed && (now - lastProcessed) < 300000) {
        // console.log(`[antidelete] Skipping already processed: ${deletedMessageId}`);
        return;
      }
      
      try {
        // Check if antidelete is enabled
        if (!getAntideleteEnabled()) {
          processedDeletes.set(dedupeKey, now);
          return;
        }
        // Use CORRECT message ID to fetch from memory
        const originalMessage = memoryStore.getMessage('whatsapp', chatId, deletedMessageId);
        
        // console.log(`[antidelete] Recovery attempt for ${deletedMessageId}${originalMessage ? ' - FOUND' : ' - NOT FOUND'}`);
        
        if (!originalMessage) {
          // Only log, do not send a message to owner if not found
          // console.log(`[antidelete] Message not found in store for: ${deletedMessageId}`);
          processedDeletes.set(dedupeKey, now);
          return;
        }
        
        if (originalMessage.key?.fromMe) {
          // console.log('[antidelete] Skipping own deleted message');
          processedDeletes.set(dedupeKey, now);
          return;
        }
        
        const pushName = originalMessage.pushName || '';
        const isGroup = chatId.endsWith('@g.us');
        let groupName = '';
        
        if (isGroup) {
          if (groupMetadataCache.has(chatId)) {
            groupName = groupMetadataCache.get(chatId);
          } else {
            try {
              const metadata = await whatsappAdapter.client.groupMetadata(chatId);
              groupName = metadata.subject || 'Unknown Group';
              groupMetadataCache.set(chatId, groupName);
              setTimeout(() => groupMetadataCache.delete(chatId), 3600000);
            } catch (e) {
              groupName = 'Unknown Group';
            }
          }
        }
        
        let senderJid = deletedKey.participant || originalMessage.key?.participant || originalMessage.key?.remoteJid || deletedKey.remoteJid || deletedKey.remoteJidAlt || '';
        let senderNumber = senderJid.split('@')[0] || 'Unknown';
        
        if (senderNumber.includes(':')) {
          senderNumber = senderNumber.split(':')[0];
        }
        
        const displayName = pushName || senderNumber;
        const msg = originalMessage.message;
        
        if (!msg) {
          // Only log, do not send a message to owner if not found
          // console.log(`[antidelete] Message content unavailable for: ${deletedMessageId}`);
          processedDeletes.set(dedupeKey, now);
          return;
        }
        
        let actualMsg = msg;
        
        if (actualMsg?.protocolMessage) {
          processedDeletes.set(dedupeKey, now);
          return; 
        }

        if (msg?.viewOnceMessage?.message) {
          actualMsg = msg.viewOnceMessage.message;
        } else if (msg?.viewOnceMessageV2?.message) {
          actualMsg = msg.viewOnceMessageV2.message;
        } else if (msg?.ephemeralMessage?.message) {
          actualMsg = msg.ephemeralMessage.message;
        }

        // Check for empty or context-only messages
        const actualMsgKeys = Object.keys(actualMsg || {});
        const contextOnlyKeys = ['contextInfo', 'messageContextInfo'];
        if (
          actualMsgKeys.length === 0 ||
          actualMsgKeys.every(k => contextOnlyKeys.includes(k))
        ) {
          // console.log(`[antidelete] Message has no content (context-only) for: ${deletedMessageId}`);
          processedDeletes.set(dedupeKey, now);
          return;
        }
        
        let textContent = actualMsg?.conversation ||
                         actualMsg?.extendedTextMessage?.text ||
                         actualMsg?.imageMessage?.caption ||
                         actualMsg?.videoMessage?.caption ||
                         actualMsg?.documentMessage?.caption ||
                         actualMsg?.buttonsResponseMessage?.selectedDisplayText ||
                         actualMsg?.listResponseMessage?.title || 
                         actualMsg?.templateButtonReplyMessage?.selectedDisplayText ||
                         actualMsg?.buttonsMessage?.contentText ||
                         actualMsg?.listMessage?.description || 
                         actualMsg?.pollCreationMessage?.name || 
                         actualMsg?.interactiveMessage?.body?.text || '';
        
        let mediaType = null;
        const mediaTypes = [
          'imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 
          'stickerMessage', 'contactMessage', 'locationMessage', 
          'liveLocationMessage', 'pttMessage'
        ];
        
        for (const type of mediaTypes) {
          if (actualMsg?.[type]) {
            mediaType = type.replace('Message', '');
            break;
          }
        }
        
        let notification = '';
        
        if (isGroup) {
          notification = `🗑️ *Deleted in ${groupName}*\n👤 @${senderNumber}\n\n`;
        } else {
          notification = `🗑️ *@${senderNumber}* deleted:\n\n`;
        }
        
        if (textContent) {
          notification += `"${textContent}"`;
        } else if (mediaType) {
          notification += `[${mediaType}]`;
        } else {
          const msgKeys = Object.keys(actualMsg || {});
          if (msgKeys.length > 0) {
            notification += `[${msgKeys[0]}]`;
          } else {
            notification += `[empty message]`;
          }
        }
        
        const mentions = [senderJid];
        
        // --- destination logic ---
        const antideleteConf = getAntideleteConfig();
        let destJid = ownerJid;
        if (antideleteConf.dest === 'group') destJid = chatId;
        else if (antideleteConf.dest === 'custom' && antideleteConf.jid) destJid = antideleteConf.jid;

        let sentNotif;
        try {
          sentNotif = await whatsappAdapter.client.sendMessage(destJid, {
            text: notification,
            mentions
          });
        } catch (notifErr) {
          console.error('[antidelete] Failed to send notification:', notifErr.message);
          processedDeletes.set(dedupeKey, now);
          return;
        }

        // Send media as quoted reply
        if (mediaType && ['image', 'video', 'audio', 'document', 'sticker', 'ptt'].includes(mediaType)) {
          try {
            const buffer = await downloadMediaMessage(
              originalMessage,
              'buffer',
              {},
              { 
                logger: whatsappAdapter.baileysLogger,
                reuploadRequest: whatsappAdapter.client.updateMediaMessage 
              }
            );
            
            if (buffer) {
              const messageType = `${mediaType}Message`;
              const mimetype = actualMsg[messageType]?.mimetype || 'application/octet-stream';
              
              await whatsappAdapter.client.sendMessage(
                destJid,
                {
                  [mediaType]: buffer,
                  caption: mediaType !== 'sticker' ? `📎 Deleted ${mediaType}` : undefined,
                  mimetype,
                  ptt: mediaType === 'ptt'
                },
                {
                  quoted: sentNotif
                }
              );
            }
          } catch (mediaError) {
            console.error('[antidelete] Failed to download deleted media:', mediaError.message);
          }
        }
        
        // console.log(`[antidelete] ✅ Recovered deleted message from ${displayName}`);
        
        processedDeletes.set(dedupeKey, now);
        
      } catch (err) {
        console.error('[antidelete] Error processing deletion:', err);
        processedDeletes.set(dedupeKey, Date.now());
      }
    };
    
    whatsappAdapter.client?.ev?.on('messages.update', async (updates) => {
      for (const update of updates) {
        try {
          // Check for REVOKE protocol message (Type 0) or messageStubType 1 (deletion)
          const isRevoke = update.update?.message?.protocolMessage?.type === 0;
          const isStubDelete = update.update?.messageStubType === 1;
          if (!isStubDelete && !isRevoke) continue;

          let deletedKey;
          if (isStubDelete) {
            deletedKey = update.key;
          } else if (isRevoke) {
            deletedKey = update.update?.message?.protocolMessage?.key;
          }
          if (!deletedKey) continue;

          const chatId = deletedKey.remoteJid || deletedKey.remoteJidAlt;
          const deletedMessageId = deletedKey.id;
          if (!chatId || !deletedMessageId) continue;

          // Centralized: route to status or normal antidelete
          if (chatId.endsWith('@status') || chatId.endsWith('@broadcast')) {
            // --- STATUSANTIDELETE LOGIC ---
            const STORAGE_PATH = path.join(process.cwd(), 'storage', 'storage.json');
            const ENV_PATH = path.join(process.cwd(), '.env');
            function getStatusConfig() {
              let config = { dest: 'owner', jid: null };
              try {
                const raw = fs.readFileSync(STORAGE_PATH, 'utf8');
                const json = JSON.parse(raw.replace(/^\/\/.*$/mg, ''));
                if (json.statusantidelete) config = { ...config, ...json.statusantidelete };
                if (config.dest !== 'custom') {
                  config.dest = 'owner';
                  config.jid = null;
                }
              } catch {}
              return config;
            }
            function getStatusEnabled() {
              try {
                const env = fs.readFileSync(ENV_PATH, 'utf8');
                const match = env.match(/^STATUSANTIDELETE_ENABLED=(true|on|1|false|off|0)/m);
                if (!match) return false;
                return ['true', 'on', '1'].includes(match[1]);
              } catch { return false; }
            }
            if (!getStatusEnabled()) continue;
            const from = deletedKey.participant || 'unknown';
            const statusId = deletedKey.id;
            // Use memoryStore for status messages (like antistatus did)
            const msg = memoryStore.getMessage('whatsapp', chatId, deletedMessageId) || memoryStore.getMessage('whatsapp', chatId, statusId);
            if (!msg) continue;
            const conf = getStatusConfig();
            let destJid;
            if (conf.dest === 'group') destJid = chatId;
            else if (conf.dest === 'custom' && conf.jid) destJid = conf.jid;
            else if (conf.dest === 'owner') destJid = ownerJid;
            if (!destJid) destJid = chatId; // fallback
            // --- Build notification exactly like .delete ---
            let senderJid = from;
            let senderNumber = senderJid.split('@')[0] || 'Unknown';
            if (senderNumber.includes(':')) senderNumber = senderNumber.split(':')[0];
            const pushName = msg.pushName || '';
            const isGroup = false; // status is never group
            let notification = `🗑️ @${senderNumber} deleted status:\n\n`;
            let textContent = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || msg.message?.videoMessage?.caption || msg.message?.documentMessage?.caption || '';
            let mediaType = null;
            const mediaTypes = [ 'imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage', 'contactMessage', 'locationMessage', 'liveLocationMessage', 'pttMessage' ];
            for (const type of mediaTypes) {
              if (msg.message?.[type]) {
                mediaType = type.replace('Message', '');
                break;
              }
            }
            if (textContent) {
              notification += `"${textContent}"`;
            } else if (mediaType) {
              notification += `[${mediaType}]`;
            } else {
              const msgKeys = Object.keys(msg.message || {});
              if (msgKeys.length > 0) {
                notification += `[${msgKeys[0]}]`;
              } else {
                notification += `[empty message]`;
              }
            }
            const mentions = [senderJid];
            let sentNotif;
            try {
              sentNotif = await whatsappAdapter.client.sendMessage(destJid, {
                text: notification,
                mentions
              });
            } catch (notifErr) {
              console.error('[statusantidelete] Failed to send notification:', notifErr.message);
              continue;
            }
            // Send media as quoted reply
            if (mediaType && ['image', 'video', 'audio', 'document', 'sticker', 'ptt'].includes(mediaType)) {
              try {
                const buffer = await downloadMediaMessage(
                  msg,
                  'buffer',
                  {},
                  { 
                    logger: whatsappAdapter.baileysLogger,
                    reuploadRequest: whatsappAdapter.client.updateMediaMessage 
                  }
                );
                if (buffer) {
                  const messageType = `${mediaType}Message`;
                  const mimetype = msg.message[messageType]?.mimetype || 'application/octet-stream';
                  await whatsappAdapter.client.sendMessage(
                    destJid,
                    {
                      [mediaType]: buffer,
                      caption: mediaType !== 'sticker' ? `📎 Deleted status ${mediaType}` : undefined,
                      mimetype,
                      ptt: mediaType === 'ptt'
                    },
                    {
                      quoted: sentNotif
                    }
                  );
                }
              } catch (mediaError) {
                console.error('[statusantidelete] Failed to download deleted media:', mediaError.message);
              }
            }
            continue;
          }

          // --- NORMAL ANTIDELETE LOGIC ---
          const dedupeKey = `${chatId}|${deletedMessageId}`;
          if (processingDeletes.has(dedupeKey)) continue;
          const lastProcessed = processedDeletes.get(dedupeKey);
          if (lastProcessed && (Date.now() - lastProcessed) < 300000) continue;
          processingDeletes.add(dedupeKey);
          // console.log(`[antidelete] Deletion detected. Queuing: ${deletedMessageId}`);
          deletionQueue.push({ deletedKey, chatId, deletedMessageId });
          processQueue().catch(err => {
            console.error('[antidelete] Queue processor error:', err);
          });
        } catch (err) {
          console.error('[antidelete] Error queueing deletion:', err);
        }
      }
    });
  }
};