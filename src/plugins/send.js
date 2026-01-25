import path from 'path';
import envMemory from '../utils/envMemory.js';
import pendingActions from '../utils/pendingActions.js';
import { downloadMediaMessage } from '@whiskeysockets/baileys';

/**
 * send.js - WhatsApp plugin
 * When a user replies to the owner's status with the word "Send",
 * the bot will send the status media/text to that user in their chat, using pendingActions for flow control.
 */

export default {
  name: 'send',
  description: 'Send owner status to user when they reply "Send" to owner status',
  version: '1.0.1',
  author: 'MATDEV',
  async onLoad(bot) {
    console.log('[send.js] Plugin loaded');
    const whatsappAdapter = bot.getAdapter('whatsapp');
    if (!whatsappAdapter) {
      console.log('[send.js] No WhatsApp adapter, aborting');
      return;
    }
    const ownerJid = bot.config.ownerNumber ? `${bot.config.ownerNumber}@s.whatsapp.net` : null;
    if (!ownerJid) {
      console.log('[send.js] No ownerJid, aborting');
      return;
    }

    // Listen for replies to owner's status
    whatsappAdapter.client?.ev?.on('messages.upsert', async (ev) => {
      try {
        console.log('[send.js] messages.upsert event received', ev.type, Array.isArray(ev.messages) ? ev.messages.length : 'no messages');
        if (ev.type !== 'notify' || !Array.isArray(ev.messages)) {
          console.log('[send.js] Skipping: not notify or no messages');
          return;
        }
        for (const msg of ev.messages) {
          try {
            const remoteJid = msg.key?.remoteJid;
            if (!remoteJid) {
              console.log('[send.js] Skipping: no remoteJid');
              continue;
            }
            // Always check for quoted message
            const contextInfo = msg.message?.extendedTextMessage?.contextInfo || msg.message?.imageMessage?.contextInfo || msg.message?.videoMessage?.contextInfo || {};
            const quoted = contextInfo.quotedMessage;
            const quotedParticipant = contextInfo.participant;
            const quotedRemoteJid = contextInfo.remoteJid || contextInfo.remoteJID;
            // Accept if quoted message is from status@broadcast or endsWith @status/@broadcast, and from the owner
            if (!quoted) {
              console.log('[send.js] Skipping: no quoted message');
              continue;
            }
            if (!quotedRemoteJid || !(quotedRemoteJid === 'status@broadcast' || quotedRemoteJid.endsWith('@status') || quotedRemoteJid.endsWith('@broadcast'))) {
              console.log('[send.js] Skipping: quotedRemoteJid is not status@broadcast or @status/@broadcast', quotedRemoteJid);
              continue;
            }
            if (quotedParticipant !== ownerJid) {
              console.log('[send.js] Skipping: quotedParticipant does not match ownerJid', quotedParticipant, ownerJid);
              continue;
            }
            // Only process if the message text is exactly "Send" (case-insensitive)
            const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
            if (text.trim().toLowerCase() !== 'send') {
              console.log('[send.js] Skipping: text is not "Send"', text);
              continue;
            }
            // Deduplicate: Only allow one send per user per status
            const userJid = msg.key.participant || msg.key.remoteJid;
            const statusMsgId = contextInfo.stanzaId || contextInfo.stanzaID || contextInfo.id || null;
            if (!statusMsgId) {
              console.log('[send.js] Skipping: no statusMsgId');
              continue;
            }
            if (pendingActions.get(userJid, statusMsgId)) {
              console.log('[send.js] Skipping: already pending', userJid, statusMsgId);
              continue;
            }
            // Set up a pending action
            pendingActions.set(userJid, statusMsgId, {
              type: 'send-status',
              userId: userJid,
              data: {
                quoted,
                quotedKey: {
                  remoteJid: quotedRemoteJid,
                  fromMe: false,
                  id: statusMsgId,
                  participant: ownerJid
                },
                mediaType: quoted.imageMessage ? 'image' : quoted.videoMessage ? 'video' : quoted.audioMessage ? 'audio' : quoted.documentMessage ? 'document' : null,
                caption: quoted.imageMessage?.caption || quoted.videoMessage?.caption || '',
                text: quoted.conversation || quoted.extendedTextMessage?.text || ''
              },
              match: (messageText) => /\bsend\b/i.test(messageText),
              handler: async (ctx) => {
                const { quoted, quotedKey, mediaType, caption, text } = ctx.pending.data;
                console.log('[send.js] Handler triggered', { quoted, quotedKey, mediaType, caption, text });
                try {
                  if (mediaType) {
                    const buffer = await downloadMediaMessage({ key: quotedKey, message: quoted }, 'buffer', {}, {
                      logger: whatsappAdapter.baileysLogger,
                      reuploadRequest: whatsappAdapter.client.updateMediaMessage
                    });
                    if (buffer) {
                      await whatsappAdapter.client.sendMessage(ctx.senderId, {
                        [mediaType]: buffer,
                        ...(caption ? { caption } : {})
                      });
                      console.log('[send.js] Media sent to', ctx.senderId);
                    } else {
                      console.error('[send.js] No buffer returned for media');
                    }
                  } else if (text) {
                    await whatsappAdapter.client.sendMessage(ctx.senderId, { text });
                    console.log('[send.js] Text sent to', ctx.senderId);
                  } else {
                    console.error('[send.js] No media or text to send');
                  }
                } catch (err) {
                  console.error('[send.js] Failed to forward status:', err, JSON.stringify(err));
                }
                // Clean up pending action
                pendingActions.delete(userJid, statusMsgId);
              },
              timeout: 5 * 60 * 1000 // 5 minutes
            });
            // Immediately run the handler
            const ctx = {
              senderId: userJid,
              raw: msg,
              pending: pendingActions.get(userJid, statusMsgId)
            };
            try {
              console.log('[send.js] About to call handler for', userJid, statusMsgId);
              await pendingActions.get(userJid, statusMsgId)?.handler(ctx);
            } catch (err) {
              console.error('[send.js] Handler threw error', err, JSON.stringify(err));
            }
          } catch (err) {
            console.error('[send.js] Error in message loop', err, JSON.stringify(err));
          }
        }
      } catch (err) {
        console.error('[send.js] Top-level error in messages.upsert', err, JSON.stringify(err));
      }
    });
  }
};
