import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';

export default {
  name: 'qrcode',
  description: 'QR Code Generator',
  version: '1.0.0',
  author: 'MATDEV',

  commands: [
    {
      name: 'qr',
      aliases: [],
      description: 'Generate a QR code from text',
      usage: '.qr <text>',
      category: 'utility',
      ownerOnly: false,
      adminOnly: false,
      groupOnly: false,
      cooldown: 3,
      async execute(ctx) {
        if (!ctx.args.length) return await ctx.reply('❌ Please provide text to generate QR code.');
        
        const text = ctx.args.join(' ');
        const tmpPath = path.resolve(process.cwd(), 'tmp', `qr_${Date.now()}.png`);
        
        try {
          await QRCode.toFile(tmpPath, text, {
            color: { dark: '#000000', light: '#ffffff' },
            width: 500
          });
          
          await ctx.reply({ image: { url: tmpPath }, caption: `✅ QR Code for: ${text}` });
          if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
        } catch (error) {
          console.error('QR Error:', error);
          await ctx.reply('❌ Failed to generate QR code.');
        }
      }
    }
  ]
};