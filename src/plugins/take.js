import dotenv from 'dotenv';
dotenv.config();
import envMemory from '../utils/envMemory.js';

export default {
  name: 'take',
  description: 'Change sticker pack name and author',
  version: '1.0.0',
  author: 'MATDEV',
  commands: [
    {
      name: 'take',
      aliases: [],
      description: 'Update sticker metadata with your pack name and author',
      usage: '.take (reply to sticker)',
      category: 'media',
      ownerOnly: false,
      adminOnly: false,
      groupOnly: false,
      cooldown: 5,
      async execute(ctx) {
        // Helper to extract sticker from quoted message
        function extractSticker(ctx) {
          // Quoted sticker - need to reconstruct full message object
          const extMsg = ctx.raw?.message?.extendedTextMessage;
          const quotedMsg = extMsg?.contextInfo?.quotedMessage;
          
          if (quotedMsg && quotedMsg.stickerMessage) {
            // Reconstruct the full WAMessage object that downloadMediaMessage expects
            const reconstructedMsg = {
              key: {
                remoteJid: ctx.chatId,
                id: extMsg.contextInfo.stanzaId,
                participant: extMsg.contextInfo.participant,
                fromMe: false
              },
              message: {
                stickerMessage: quotedMsg.stickerMessage
              }
            };
            
            return reconstructedMsg;
          }

          return null;
        }

        const stickerMsg = extractSticker(ctx);
        
        if (!stickerMsg) {
          return await ctx.reply('❌ Please reply to a sticker to change its metadata.');
        }

        // Download the sticker buffer
        let buffer;
        try {
          buffer = await ctx._adapter.downloadMedia({ raw: stickerMsg });
          
          if (!buffer || buffer.length === 0) {
            throw new Error('Empty buffer');
          }
        } catch (e) {
          console.error('Download sticker error:', e);
          return await ctx.reply('❌ Failed to download sticker. The sticker might have been deleted from WhatsApp servers.');
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
        await ctx.react('⏳');

        // Re-create sticker with new metadata
        try {
          const sticker = new Sticker(buffer, {
            pack: stickerPack,
            author: stickerAuthor,
            type: StickerTypes.DEFAULT,
            quality: 100, // Keep original quality for existing stickers
            categories: ['🤖'],
          });
          
          const stickerBuffer = await sticker.toBuffer();
          
          // Remove processing indicator
          await ctx.react('');
          
          await ctx._adapter.sendMedia(ctx.chatId, stickerBuffer, { type: 'sticker' });
        } catch (e) {
          await ctx.react('❌');
          console.error('Create sticker error:', e);
          await ctx.reply('❌ Failed to update sticker metadata.');
        }
      }
    }
  ]
};