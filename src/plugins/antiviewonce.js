import { downloadMediaMessage } from '@whiskeysockets/baileys';
import fs from 'fs';
import path from 'path';

const STORAGE_PATH = path.join(process.cwd(), 'storage', 'storage.json');
function getAntiviewonceConfig() {
  let config = { dest: 'owner', jid: null };
  try {
    const raw = fs.readFileSync(STORAGE_PATH, 'utf8');
    const json = JSON.parse(raw.replace(/^\/\/.*$/mg, ''));
    if (json.antiviewonce) config = { ...config, ...json.antiviewonce };
  } catch {}
  return config;
}
function setAntiviewonceConfig(newConfig) {
  let json = {};
  try {
    const raw = fs.readFileSync(STORAGE_PATH, 'utf8');
    json = JSON.parse(raw.replace(/^\/\/.*$/mg, ''));
  } catch {}
  json.antiviewonce = { ...json.antiviewonce, ...newConfig };
  fs.writeFileSync(STORAGE_PATH, JSON.stringify(json, null, 2));
}

// Helper to get owner JID from config or adapter
function getOwnerJid(ctx) {
  // Try from adapter config
  if (ctx.platformAdapter && ctx.platformAdapter.config && ctx.platformAdapter.config.ownerNumber) {
    return ctx.platformAdapter.config.ownerNumber + '@s.whatsapp.net';
  }
  // Try from bot config
  if (ctx.bot && ctx.bot.config && ctx.bot.config.ownerNumber) {
    return ctx.bot.config.ownerNumber + '@s.whatsapp.net';
  }
  // Fallback: try from environment
  if (process.env.OWNER_NUMBER) {
    return process.env.OWNER_NUMBER + '@s.whatsapp.net';
  }
  return null;
}

/**
 * Anti-View Once Plugin
 * Captures view-once messages
 */
const AntiViewOncePlugin = {
  name: 'antiviewonce',
  description: 'Automatically captures view-once messages',
  category: 'privacy',

  // Command to manually extract from a reply
  commands: [
    {
      name: 'vv',
      description: 'Manually extract view-once from reply or set destination',
      usage: '.vv (reply to a view-once message) | .vv <jid|g|p>',
      async execute(ctx) {
        const arg = ctx.args[0]?.toLowerCase();
        if (arg && !ctx.quoted) {
          if (arg === 'g') {
            setAntiviewonceConfig({ dest: 'group', jid: null });
            await ctx.reply('AntiViewOnce will now send captures to the same chat.');
            return;
          }
          if (arg === 'p') {
            setAntiviewonceConfig({ dest: 'owner', jid: null });
            await ctx.reply('AntiViewOnce will now send captures to the owner.');
            return;
          }
          if (/^[0-9a-zA-Z@._-]+$/.test(arg)) {
            setAntiviewonceConfig({ dest: 'custom', jid: arg });
            await ctx.reply(`AntiViewOnce will now send captures to JID: ${arg}`);
            return;
          }
          await ctx.reply('Invalid argument. Usage: .vv <jid|g|p> or reply to a view-once message.');
          return;
        }
        if (!arg && !ctx.quoted) {
          const conf = getAntiviewonceConfig();
          await ctx.reply(`AntiViewOnce destination: ${conf.dest}${conf.jid ? `\nJID: ${conf.jid}` : ''}`);
          return;
        }
        try {
          const raw = ctx.raw;
          const quotedMessage = raw.message?.extendedTextMessage?.contextInfo?.quotedMessage;
          const contextInfo = raw.message?.extendedTextMessage?.contextInfo;

          if (!quotedMessage) {
            return await ctx.reply('❌ Please reply to a view-once message with .vv');
          }

          await extractAndSend(ctx, quotedMessage, contextInfo);
        } catch (error) {
          console.error(`Error in .vv command: ${error.message}`);
          await ctx.reply('❌ Failed to extract view-once content.');
        }
      }
    }
  ],

  // Hook for automatic capture
  onLoad: async (bot) => {
    console.log('✅ Anti-View Once plugin loaded');
    const adapter = bot.getAdapter('whatsapp');
    if (!adapter) return;

    // Listen for incoming messages for auto-capture
    bot.on('message', async (ctx) => {
      if (ctx.platform !== 'whatsapp') return;
      
      const msg = ctx.raw;
      // Detect view-once
      if (msg.message?.viewOnceMessage || msg.message?.viewOnceMessageV2 || msg.message?.viewOnceMessageV3) {
        console.log('[antiviewonce] View-once detected, auto-capturing...');
        
        const quotedMessage = msg.message.viewOnceMessage?.message || 
                             msg.message.viewOnceMessageV2?.message || 
                             msg.message.viewOnceMessageV3?.message;
        
        if (quotedMessage) {
          await extractAndSend(ctx, quotedMessage, msg.messageContextInfo || msg.contextInfo);
        }
      }
    });
  }
};

/**
 * Common extraction logic
 */
async function extractAndSend(ctx, quotedContent, contextInfo) {
  try {
    let viewOnceContent = null;

    // Find view-once content in different possible structures
    if (quotedContent.viewOnceMessageV2) {
      viewOnceContent = quotedContent.viewOnceMessageV2.message;
    } else if (quotedContent.viewOnceMessage) {
      viewOnceContent = quotedContent.viewOnceMessage.message;
    } else if (quotedContent.viewOnceMessageV3) {
      viewOnceContent = quotedContent.viewOnceMessageV3.message;
    } else if (quotedContent.imageMessage || quotedContent.videoMessage || quotedContent.audioMessage) {
      viewOnceContent = quotedContent;
    }

    if (!viewOnceContent) {
      console.log('[antiviewonce] No view-once content found');
      return;
    }

    // Determine content type
    let contentType = null;
    let mediaType = null;

    if (viewOnceContent.imageMessage) {
      contentType = 'imageMessage';
      mediaType = 'image';
    } else if (viewOnceContent.videoMessage) {
      contentType = 'videoMessage';
      mediaType = 'video';
    } else if (viewOnceContent.audioMessage) {
      contentType = 'audioMessage';
      mediaType = 'audio';
    }

    if (!mediaType) {
      return;
    }

    // Download
    const mockMessage = {
      key: ctx.raw.key,
      message: {
        [contentType]: viewOnceContent[contentType]
      }
    };

    // Use the adapter's downloadMediaMessage if available, else fallback
    let buffer;
    if (ctx.platformAdapter && typeof ctx.platformAdapter.downloadMedia === 'function') {
      buffer = await ctx.platformAdapter.downloadMedia({ raw: mockMessage });
    } else if (typeof downloadMediaMessage === 'function') {
      buffer = await downloadMediaMessage(
        mockMessage,
        'buffer',
        {},
        {
          logger: ctx.platformAdapter?.baileysLogger,
          reuploadRequest: ctx.platformAdapter?.client?.updateMediaMessage
        }
      );
    } else {
      throw new Error('No downloadMedia method available');
    }

    if (!buffer || buffer.length === 0) {
      return;
    }

    // --- destination logic ---
    let destJid;
    const conf = getAntiviewonceConfig();
    if (conf.dest === 'group') destJid = ctx.chatId;
    else if (conf.dest === 'custom' && conf.jid) destJid = conf.jid;
    else if (conf.dest === 'owner') destJid = getOwnerJid(ctx);
    if (!destJid) destJid = ctx.chatId; // fallback

    const senderId = contextInfo?.participant || ctx.senderId;
    const senderName = ctx.senderName || 'Unknown';
    const mediaData = viewOnceContent[contentType];
    const caption = mediaData?.caption || '';
    const mimetype = mediaData?.mimetype || 'application/octet-stream';

    const text = `👁️ *Anti-ViewOnce Captured*
👤 *From:* ${senderName}
📱 *Number:* @${senderId.split('@')[0]}
💬 *Caption:* ${caption || '[No caption]'}
📎 *Type:* ${mediaType.toUpperCase()}`;

    // Send back to the user or owner
    if (ctx.platform === 'whatsapp' && ctx.platformAdapter && typeof ctx.platformAdapter.sendMedia === 'function') {
      // WhatsApp: send as real media message
      // WhatsAppAdapter expects: sendMedia(chatId, buffer, options)
      await ctx.platformAdapter.sendMedia(destJid, buffer, {
        type: mediaType,
        mimetype: mimetype
      });
    } else {
      // Debug why fallback is used
      console.warn('[antiviewonce] Fallback used:', {
        platform: ctx.platform,
        hasAdapter: !!ctx.platformAdapter,
        hasSendMedia: ctx.platformAdapter && typeof ctx.platformAdapter.sendMedia === 'function'
      });
      if (typeof ctx.reply === 'function') {
        // Fallback for other platforms (Telegram, Discord, etc.)
        await ctx.reply('', {
          files: [{
            name: `viewonce.${mediaType === 'image' ? 'jpg' : mediaType === 'video' ? 'mp4' : 'bin'}`,
            content: buffer
          }]
        });
      } else {
        throw new Error('No sendMedia or reply method available to send extracted view-once');
      }
    }

  } catch (error) {
    console.error('[antiviewonce] Extract error:', error.message);
  }
}

export default AntiViewOncePlugin;
