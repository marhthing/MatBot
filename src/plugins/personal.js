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
    },
    {
      name: 'clr',
      aliases: ['clearchat'],
      description: 'Clear chat conversation (local)',
      usage: '.clr',
      execute: async (ctx) => {
        try {
          // Allow .clr in any chat (group, owner, or private)
          if (ctx.platform !== 'whatsapp') {
            return await ctx.reply('❌ This command is only available on WhatsApp.');
          }
          // Delete the command message first
          try {
            await ctx._adapter.deleteMessage(ctx.chatId, ctx.messageId);
          } catch (e) {
            // Ignore if deletion fails
          }
          await ctx._adapter.clearChat(ctx.chatId);
        } catch (error) {
          console.error(`Error in .clr command: ${error.message}`);
          await ctx.reply('❌ Failed to clear chat.');
        }
      }
    }
  ]
};
