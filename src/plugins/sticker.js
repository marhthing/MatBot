import dotenv from 'dotenv';
dotenv.config();
import envMemory from '../utils/envMemory.js';
import { shouldReact } from '../utils/pendingActions.js';

export default {
  name: 'sticker',
  description: 'Convert an image to a sticker',
  version: '1.0.0',
  author: 'MATDEV',
  commands: [
    {
      name: 'sticker',
      aliases: ['st', 's'],
      description: 'Convert an image to a sticker',
      usage: '.sticker (reply to image/video)',
      category: 'media',
      ownerOnly: false,
      adminOnly: false,
      groupOnly: false,
      cooldown: 5,
      async execute(ctx) {
        // Helper to extract media from context or quoted message
        function extractMedia(ctx) {
          // Direct media (user sent media with command)
          if (ctx.media && ['image', 'video', 'gif'].includes(ctx.media.type)) {
            return { mediaMsg: ctx.raw, type: ctx.media.type };
          }

          // Quoted media - need to reconstruct full message object
          const extMsg = ctx.raw?.message?.extendedTextMessage;
          const quotedMsg = extMsg?.contextInfo?.quotedMessage;
          
          if (quotedMsg) {
            // Determine media type
            let type = null;
            let mediaMessage = null;

            if (quotedMsg.imageMessage) {
              type = 'image';
              mediaMessage = quotedMsg.imageMessage;
            } else if (quotedMsg.videoMessage) {
              type = quotedMsg.videoMessage.gifPlayback ? 'gif' : 'video';
              mediaMessage = quotedMsg.videoMessage;
            } else if (quotedMsg.stickerMessage) {
              type = 'sticker';
              mediaMessage = quotedMsg.stickerMessage;
            }

            if (type && mediaMessage) {
              // Reconstruct the full WAMessage object that downloadMediaMessage expects
              const reconstructedMsg = {
                key: {
                  remoteJid: ctx.chatId,
                  id: extMsg.contextInfo.stanzaId,
                  participant: extMsg.contextInfo.participant,
                  fromMe: false
                },
                message: {
                  [type + 'Message']: mediaMessage
                }
              };
              
              return { mediaMsg: reconstructedMsg, type };
            }
          }

          return null;
        }

        const media = extractMedia(ctx);
        
        if (!media || !['image', 'video', 'gif', 'sticker'].includes(media.type)) {
          return await ctx.reply('❌ Please reply to an image, video, or gif to convert it to a sticker.');
        }

        // Download the media buffer
        let buffer;
        try {
          buffer = await ctx._adapter.downloadMedia({ raw: media.mediaMsg });
          
          if (!buffer || buffer.length === 0) {
            throw new Error('Empty buffer');
          }
        } catch (e) {
          // console.error('Download media error:', e);
          return await ctx.reply('❌ Failed to download media. The media might have been deleted from WhatsApp servers.');
        }

        // Import wa-sticker-formatter
        let Sticker, StickerTypes;
        try {
          ({ Sticker, StickerTypes } = await import('wa-sticker-formatter'));
        } catch (e) {
          return await ctx.reply('❌ wa-sticker-formatter is not installed. Please run: npm install wa-sticker-formatter');
        }

        // Import config for sticker pack/author
        let config;
        try {
          config = (await import('../../config/default.js')).default;
        } catch (e) {
          config = {};
        }
        // Fetch from envMemory (in-memory .env), fallback to config, then hardcoded
        const stickerPack = envMemory.get('STICKER_PACK') || config.stickerPack || 'MATDEV Bot';
        const stickerAuthor = envMemory.get('STICKER_AUTHOR') || config.stickerAuthor || 'Bot';

        // Send processing indicator
        if (shouldReact()) await ctx.react('⏳');

        // Create sticker with optimized settings
        try {
          const sticker = new Sticker(buffer, {
            pack: stickerPack,
            author: stickerAuthor,
            type: StickerTypes.DEFAULT, // Faster than FULL
            quality: 30, // Lower quality = faster processing (30-60 range)
            categories: ['🤖'],
          });
          
          const stickerBuffer = await sticker.toBuffer();
          
          // Remove processing indicator
          if (shouldReact()) await ctx.react('✅');
          
          await ctx._adapter.sendMedia(ctx.chatId, stickerBuffer, { type: 'sticker' });
        } catch (e) {
          if (shouldReact()) await ctx.react('❌');
          // console.error('Create sticker error:', e);
          await ctx.reply('❌ Failed to create sticker. Make sure the media is a valid image or video.');
        }
      }
    }
  ]
};