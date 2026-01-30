import { shouldReact } from '../utils/pendingActions.js';

export default {
  name: 'enhance',
  description: 'Enhance the quality of an image (upscale and sharpen)',
  version: '1.0.0',
  author: 'MATDEV',
  commands: [
    {
      name: 'enhance',
      description: 'Enhance image quality (reply to image)',
      usage: '.enhance (reply to image)',
      category: 'media',
      async execute(ctx) {
        function extractImage(ctx) {
          const extMsg = ctx.raw?.message?.extendedTextMessage;
          const quotedMsg = extMsg?.contextInfo?.quotedMessage;
          if (quotedMsg && quotedMsg.imageMessage) {
            const reconstructedMsg = {
              key: {
                remoteJid: ctx.chatId,
                id: extMsg.contextInfo.stanzaId,
                participant: extMsg.contextInfo.participant,
                fromMe: false
              },
              message: {
                imageMessage: quotedMsg.imageMessage
              }
            };
            return reconstructedMsg;
          }
          return null;
        }
        const imageMsg = extractImage(ctx);
        if (!imageMsg) {
          return await ctx.reply('❌ Please reply to an image to enhance.');
        }
        let buffer;
        try {
          buffer = await ctx._adapter.downloadMedia({ raw: imageMsg });
          if (!buffer || buffer.length === 0) throw new Error('Empty buffer');
        } catch (e) {
          return await ctx.reply('❌ Failed to download image.');
        }
        let sharp;
        try {
          sharp = (await import('sharp')).default;
        } catch (e) {
          return await ctx.reply('❌ sharp is not installed. Please run: npm install sharp');
        }
        try {
          // Upscale by 3x, sharpen, and increase contrast/brightness
          const img = sharp(buffer);
          const metadata = await img.metadata();
          const width = metadata.width ? Math.round(metadata.width * 3) : undefined;
          const height = metadata.height ? Math.round(metadata.height * 3) : undefined;
          let enhancedBuffer = await img
            .resize(width, height, { kernel: sharp.kernel.lanczos3 })
            .sharpen(3, 1.5, 0.5)
            .modulate({ brightness: 1.08, contrast: 1.15 })
            .toBuffer();
          if (shouldReact()) await ctx.react('✅');
          await ctx._adapter.sendMedia(ctx.chatId, enhancedBuffer, { type: 'image' });
        } catch (e) {
          if (shouldReact()) await ctx.react('❌');
          await ctx.reply('❌ Failed to enhance image.');
        }
      }
    }
  ]
};
