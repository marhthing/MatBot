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
        
        const mentions = [];
        const tagList = targetParticipants.map(p => {
          const jid = jidNormalizedUser(p.id);
          mentions.push(jid);
          return `@${jid.split('@')[0]}`;
        }).join(' ');

        await ctx.platformAdapter.client.sendMessage(ctx.chatId, {
          text: `${message}\n\n${tagList}`,
          mentions: mentions
        });
      }
    },
    {
      name: 'gbio',
      description: 'Update group description',
      usage: '.gbio <text>',
      category: 'group',
      groupOnly: true,
      adminOnly: true,
      async execute(ctx) {
        if (!ctx.args[0]) return ctx.reply('Please provide a new group bio.');
        try {
          await ctx.platformAdapter.client.groupUpdateDescription(ctx.chatId, ctx.args.join(' '));
          await ctx.reply('✅ Group bio updated successfully.');
        } catch (error) {
          await ctx.reply(`❌ Failed to update group bio: ${error.message}`);
        }
      }
    },
    {
      name: 'gpp',
      description: 'Update group profile picture',
      usage: 'Reply to an image with .gpp',
      category: 'group',
      groupOnly: true,
      adminOnly: true,
      async execute(ctx) {
        if (!ctx.quoted || ctx.quoted.type !== 'image') {
          return ctx.reply('Please reply to an image with .gpp');
        }
        try {
          const buffer = await ctx.platformAdapter.downloadMedia(ctx.quoted);
          await ctx.platformAdapter.client.updateProfilePicture(ctx.chatId, buffer);
          await ctx.reply('✅ Group profile picture updated.');
        } catch (error) {
          await ctx.reply(`❌ Failed to update group profile picture: ${error.message}`);
        }
      }
    },
    {
      name: 'gname',
      description: 'Update group name',
      usage: '.gname <text>',
      category: 'group',
      groupOnly: true,
      adminOnly: true,
      async execute(ctx) {
        if (!ctx.args[0]) return ctx.reply('Please provide a new group name.');
        try {
          await ctx.platformAdapter.client.groupUpdateSubject(ctx.chatId, ctx.args.join(' '));
          await ctx.reply('✅ Group name updated.');
        } catch (error) {
          await ctx.reply(`❌ Failed to update group name: ${error.message}`);
        }
      }
    },
    {
      name: 'add',
      description: 'Add a user to the group',
      usage: '.add 234...',
      category: 'group',
      groupOnly: true,
      adminOnly: true,
      async execute(ctx) {
        if (!ctx.args[0]) return ctx.reply('Please provide a phone number to add.');
        const user = ctx.args[0].replace(/[^\d]/g, '') + '@s.whatsapp.net';
        try {
          await ctx.platformAdapter.client.groupParticipantsUpdate(ctx.chatId, [user], 'add');
          await ctx.reply('✅ User added to group.');
        } catch (error) {
          await ctx.reply(`❌ Failed to add user: ${error.message}`);
        }
      }
    },
    {
      name: 'link',
      description: 'Get group invite link',
      usage: '.link',
      category: 'group',
      groupOnly: true,
      adminOnly: true,
      async execute(ctx) {
        try {
          const code = await ctx.platformAdapter.client.groupInviteCode(ctx.chatId);
          await ctx.reply(`https://chat.whatsapp.com/${code}`);
        } catch (error) {
          await ctx.reply(`❌ Failed to get invite link: ${error.message}`);
        }
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
        // Check if bot is admin (normalize JIDs for comparison)
        const botId = ctx.platformAdapter.client.user?.id || ctx.platformAdapter.client.user?.jid;
        const groupMetadata = await ctx.platformAdapter.client.groupMetadata(ctx.chatId);
        const botParticipant = groupMetadata.participants.find(p => jidNormalizedUser(p.id) === jidNormalizedUser(botId));
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
        // Check if bot is admin (normalize JIDs for comparison)
        const botId = ctx.platformAdapter.client.user?.id || ctx.platformAdapter.client.user?.jid;
        const groupMetadata = await ctx.platformAdapter.client.groupMetadata(ctx.chatId);
        const botParticipant = groupMetadata.participants.find(p => jidNormalizedUser(p.id) === jidNormalizedUser(botId));
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
        // Check if bot is admin (normalize JIDs for comparison)
        const botId = ctx.platformAdapter.client.user?.id || ctx.platformAdapter.client.user?.jid;
        const groupMetadata = await ctx.platformAdapter.client.groupMetadata(ctx.chatId);
        const botParticipant = groupMetadata.participants.find(p => jidNormalizedUser(p.id) === jidNormalizedUser(botId));
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
