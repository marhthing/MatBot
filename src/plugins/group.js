/**
 * Group management plugin
 */
import { jidNormalizedUser } from '@whiskeysockets/baileys';

export default {
  name: 'group',
  description: 'Group management commands',
  version: '1.0.0',
  author: 'MATDEV',
  commands: [
    {
      name: 'tag',
      aliases: ['everyone', 'all'],
      description: 'Tag everyone or admins in the group',
      usage: '.tag [admin]',
      category: 'group',
      groupOnly: true,
      adminOnly: true,
      async execute(ctx) {
        const metadata = await ctx.platformAdapter.client.groupMetadata(ctx.chatId);
        const participants = metadata.participants;
        const isAdminTag = ctx.args[0]?.toLowerCase() === 'admin';
        
        let targetParticipants = participants;
        let message = isAdminTag ? '📢 *Tagging Admins:*' : '📢 *Tagging Everyone:*';
        
        if (isAdminTag) {
          targetParticipants = participants.filter(p => p.admin !== null);
        }
        
        const mentions = targetParticipants.map(p => p.id);
        const tagList = targetParticipants.map(p => `@${p.id.split('@')[0]}`).join(' ');
        
        await ctx.send(`${message}\n\n${tagList}`, { mentions });
      }
    },
    {
      name: 'promote',
      description: 'Promote a user to admin',
      usage: '.promote @user',
      category: 'group',
      groupOnly: true,
      adminOnly: true,
      async execute(ctx) {
        if (!ctx.isAdmin) {
          return ctx.reply('You are not an admin.');
        }
        // Check if bot is admin
        const botId = ctx.platformAdapter.client.user?.id || ctx.platformAdapter.client.user?.jid;
        const groupMetadata = await ctx.platformAdapter.client.groupMetadata(ctx.chatId);
        const botParticipant = groupMetadata.participants.find(p => p.id === botId);
        if (!botParticipant || !botParticipant.admin) {
          return ctx.reply('I am not an admin in this group.');
        }
        let userToPromote;
        
        if (ctx.quoted) {
          userToPromote = ctx.quoted.senderId;
        } else if (ctx.args[0]) {
          userToPromote = ctx.args[0].replace(/[^\d]/g, '') + '@s.whatsapp.net';
        } else {
          return ctx.reply('Please mention a user or reply to their message.');
        }

        try {
          await ctx.platformAdapter.client.groupParticipantsUpdate(ctx.chatId, [userToPromote], 'promote');
          await ctx.reply(`✅ User promoted to admin.`);
        } catch (error) {
          await ctx.reply(`❌ Failed to promote: ${error.message}`);
        }
      }
    },
    {
      name: 'demote',
      description: 'Demote a user from admin',
      usage: '.demote @user',
      category: 'group',
      groupOnly: true,
      adminOnly: true,
      async execute(ctx) {
        if (!ctx.isAdmin) {
          return ctx.reply('You are not an admin.');
        }
        // Check if bot is admin
        const botId = ctx.platformAdapter.client.user?.id || ctx.platformAdapter.client.user?.jid;
        const groupMetadata = await ctx.platformAdapter.client.groupMetadata(ctx.chatId);
        const botParticipant = groupMetadata.participants.find(p => p.id === botId);
        if (!botParticipant || !botParticipant.admin) {
          return ctx.reply('I am not an admin in this group.');
        }
        let userToDemote;
        
        if (ctx.quoted) {
          userToDemote = ctx.quoted.senderId;
        } else if (ctx.args[0]) {
          userToDemote = ctx.args[0].replace(/[^\d]/g, '') + '@s.whatsapp.net';
        } else {
          return ctx.reply('Please mention a user or reply to their message.');
        }

        try {
          await ctx.platformAdapter.client.groupParticipantsUpdate(ctx.chatId, [userToDemote], 'demote');
          await ctx.reply(`✅ User demoted from admin.`);
        } catch (error) {
          await ctx.reply(`❌ Failed to demote: ${error.message}`);
        }
      }
    },
    {
      name: 'kick',
      description: 'Remove a user from the group',
      usage: '.kick @user',
      category: 'group',
      groupOnly: true,
      adminOnly: true,
      async execute(ctx) {
        if (!ctx.isAdmin) {
          return ctx.reply('You are not an admin.');
        }
        // Check if bot is admin
        const botId = ctx.platformAdapter.client.user?.id || ctx.platformAdapter.client.user?.jid;
        const groupMetadata = await ctx.platformAdapter.client.groupMetadata(ctx.chatId);
        const botParticipant = groupMetadata.participants.find(p => p.id === botId);
        if (!botParticipant || !botParticipant.admin) {
          return ctx.reply('I am not an admin in this group.');
        }
        let userToKick;
        
        if (ctx.quoted) {
          userToKick = ctx.quoted.senderId;
        } else if (ctx.args[0]) {
          userToKick = ctx.args[0].replace(/[^\d]/g, '') + '@s.whatsapp.net';
        } else {
          return ctx.reply('Please mention a user or reply to their message.');
        }

        try {
          await ctx.platformAdapter.client.groupParticipantsUpdate(ctx.chatId, [userToKick], 'remove');
          await ctx.reply(`✅ User removed from group.`);
        } catch (error) {
          await ctx.reply(`❌ Failed to kick: ${error.message}`);
        }
      }
    },
    {
        name: 'group',
        description: 'Open or close group chat',
        usage: '.group open/close',
        category: 'group',
        groupOnly: true,
        adminOnly: true,
        async execute(ctx) {
            const action = ctx.args[0]?.toLowerCase();
            if (action === 'open') {
                await ctx.platformAdapter.client.groupSettingUpdate(ctx.chatId, 'not_announcement');
                await ctx.reply('✅ Group chat is now open for everyone.');
            } else if (action === 'close') {
                await ctx.platformAdapter.client.groupSettingUpdate(ctx.chatId, 'announcement');
                await ctx.reply('✅ Group chat is now closed. Only admins can send messages.');
            } else {
                await ctx.reply('Usage: .group open/close');
            }
        }
    }
  ]
};
