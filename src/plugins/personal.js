/**
 * Personal management plugin
 */
import { jidNormalizedUser } from '@whiskeysockets/baileys';

export default {
  name: 'personal',
  description: 'Owner personal management commands',
  version: '1.0.0',
  author: 'MATDEV',
  commands: [
    {
      name: 'setpp',
      description: 'Update owner profile picture',
      usage: 'Reply to an image with .setpp',
      category: 'personal',
      ownerOnly: true,
      async execute(ctx) {
        const quotedImage = ctx.quoted?.message?.imageMessage || 
                          ctx.raw?.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
        
        if (!quotedImage) {
          return ctx.reply('Please reply to an image with .setpp');
        }
        try {
          const buffer = await ctx.platformAdapter.downloadMedia({
            raw: {
              message: { imageMessage: quotedImage }
            }
          });
          const botId = jidNormalizedUser(ctx.platformAdapter.client.user.id);
          await ctx.platformAdapter.client.updateProfilePicture(botId, buffer);
          await ctx.reply('✅ Profile picture updated successfully.');
        } catch (error) {
          await ctx.reply(`❌ Failed to update profile picture: ${error.message}`);
        }
      }
    },
    {
      name: 'setbio',
      description: 'Update owner bio',
      usage: '.setbio <text>',
      category: 'personal',
      ownerOnly: true,
      async execute(ctx) {
        if (!ctx.args[0]) return ctx.reply('Please provide a new bio.');
        try {
          await ctx.platformAdapter.client.updateProfileStatus(ctx.args.join(' '));
          await ctx.reply('✅ Bio updated successfully.');
        } catch (error) {
          await ctx.reply(`❌ Failed to update bio: ${error.message}`);
        }
      }
    }
  ]
};
