/**
 * Group management plugin
 */
import { jidNormalizedUser } from '@whiskeysockets/baileys';

/**
 * Find participant in group using robust matching (supports both LID and PN formats)
 */
function findParticipant(participants, userId, userLid) {
  const userPhone = userId ? userId.split('@')[0].replace(/[^\d]/g, '') : null;
  const normalizedUserId = userId ? jidNormalizedUser(userId) : null;
  const normalizedUserLid = userLid ? jidNormalizedUser(userLid) : null;
  
  return participants.find(p => {
    const pId = jidNormalizedUser(p.id);
    const pLid = p.lid ? jidNormalizedUser(p.lid) : null;
    const pPhoneFromId = p.id ? p.id.split('@')[0].replace(/[^\d]/g, '') : null;
    const pPhoneFromField = p.phoneNumber ? p.phoneNumber.replace(/[^\d]/g, '') : null;
    
    // Match by normalized JID
    if (pId === normalizedUserId) return true;
    // Match by LID
    if (pLid === normalizedUserId) return true;
    if (normalizedUserLid && pId === normalizedUserLid) return true;
    if (normalizedUserLid && pLid === normalizedUserLid) return true;
    // Match by phone number
    if (pPhoneFromId && userPhone && pPhoneFromId === userPhone) return true;
    if (pPhoneFromField && userPhone && pPhoneFromField === userPhone) return true;
    
    return false;
  });
}

/**
 * Find participant by phone number and return their actual group ID (LID format)
 */
function findParticipantByPhone(participants, phoneNumber) {
  const cleanPhone = phoneNumber.replace(/[^\d]/g, '');
  
  return participants.find(p => {
    // Check phoneNumber field (present when id is LID)
    if (p.phoneNumber) {
      const pPhone = p.phoneNumber.replace(/[^\d@s.whatsapp.net]/g, '').replace('@swhatsappnet', '');
      if (pPhone === cleanPhone) return true;
    }
    // Check if id itself contains the phone number (PN format)
    const pPhoneFromId = p.id ? p.id.split('@')[0].replace(/[^\d]/g, '') : null;
    if (pPhoneFromId === cleanPhone) return true;
    
    return false;
  });
}

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
        const quotedImage = ctx.quoted?.message?.imageMessage || 
                          ctx.raw?.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
        
        if (!quotedImage) {
          return ctx.reply('Please reply to an image with .gpp');
        }
        try {
          const buffer = await ctx.platformAdapter.downloadMedia({
            raw: {
              message: { imageMessage: quotedImage }
            }
          });
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
        const botId = ctx.platformAdapter.client.user?.id || ctx.platformAdapter.client.user?.jid;
        const botLid = ctx.platformAdapter.client.user?.lid;
        const groupMetadata = await ctx.platformAdapter.client.groupMetadata(ctx.chatId);
        
        const botParticipant = findParticipant(groupMetadata.participants, botId, botLid);
        
        if (!botParticipant || !botParticipant.admin) {
          return ctx.reply('I am not an admin in this group.');
        }
        
        let targetParticipant;
        
        if (ctx.quoted) {
          // Find participant by sender ID from quoted message
          targetParticipant = findParticipant(groupMetadata.participants, ctx.quoted.senderId, null);
        } else if (ctx.mentions && ctx.mentions.length > 0) {
          // Find participant by mention
          targetParticipant = findParticipant(groupMetadata.participants, ctx.mentions[0], null);
        } else if (ctx.args[0]) {
          // Find participant by phone number
          const phoneNumber = ctx.args[0].replace(/[^\d]/g, '');
          targetParticipant = findParticipantByPhone(groupMetadata.participants, phoneNumber);
        } else {
          return ctx.reply('Please mention a user or reply to their message.');
        }

        if (!targetParticipant) {
          return ctx.reply('User not found in this group.');
        }

        try {
          // Use the participant's actual ID (LID format) from group metadata
          await ctx.platformAdapter.client.groupParticipantsUpdate(ctx.chatId, [targetParticipant.id], 'promote');
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
        const botId = ctx.platformAdapter.client.user?.id || ctx.platformAdapter.client.user?.jid;
        const botLid = ctx.platformAdapter.client.user?.lid;
        const groupMetadata = await ctx.platformAdapter.client.groupMetadata(ctx.chatId);
        const botParticipant = findParticipant(groupMetadata.participants, botId, botLid);
        
        if (!botParticipant || !botParticipant.admin) {
          return ctx.reply('I am not an admin in this group.');
        }
        
        let targetParticipant;
        
        if (ctx.quoted) {
          targetParticipant = findParticipant(groupMetadata.participants, ctx.quoted.senderId, null);
        } else if (ctx.mentions && ctx.mentions.length > 0) {
          targetParticipant = findParticipant(groupMetadata.participants, ctx.mentions[0], null);
        } else if (ctx.args[0]) {
          const phoneNumber = ctx.args[0].replace(/[^\d]/g, '');
          targetParticipant = findParticipantByPhone(groupMetadata.participants, phoneNumber);
        } else {
          return ctx.reply('Please mention a user or reply to their message.');
        }

        if (!targetParticipant) {
          return ctx.reply('User not found in this group.');
        }

        // Check if target is superadmin - only superadmins can demote superadmins
        if (targetParticipant.admin === 'superadmin') {
          return ctx.reply('Cannot demote superadmin. Only the group creator can demote superadmins.');
        }

        try {
          await ctx.platformAdapter.client.groupParticipantsUpdate(ctx.chatId, [targetParticipant.id], 'demote');
          await ctx.reply(`✅ User demoted from admin.`);
        } catch (error) {
          await ctx.reply(`❌ Failed to demote: ${error.message}`);
        }
      }
    },
    {
      name: 'kick',
      aliases: ['remove'],
      description: 'Remove a user from the group',
      usage: '.kick @user',
      category: 'group',
      groupOnly: true,
      adminOnly: true,
      async execute(ctx) {
        const botId = ctx.platformAdapter.client.user?.id || ctx.platformAdapter.client.user?.jid;
        const botLid = ctx.platformAdapter.client.user?.lid;
        const groupMetadata = await ctx.platformAdapter.client.groupMetadata(ctx.chatId);
        const botParticipant = findParticipant(groupMetadata.participants, botId, botLid);
        
        if (!botParticipant || !botParticipant.admin) {
          return ctx.reply('I am not an admin in this group.');
        }
        
        let targetParticipant;
        
        if (ctx.quoted) {
          targetParticipant = findParticipant(groupMetadata.participants, ctx.quoted.senderId, null);
        } else if (ctx.mentions && ctx.mentions.length > 0) {
          targetParticipant = findParticipant(groupMetadata.participants, ctx.mentions[0], null);
        } else if (ctx.args[0]) {
          const phoneNumber = ctx.args[0].replace(/[^\d]/g, '');
          targetParticipant = findParticipantByPhone(groupMetadata.participants, phoneNumber);
        } else {
          return ctx.reply('Please mention a user or reply to their message.');
        }

        if (!targetParticipant) {
          return ctx.reply('User not found in this group.');
        }

        if (targetParticipant.admin === 'superadmin') {
          return ctx.reply('Cannot kick the group creator (superadmin).');
        }

        try {
          await ctx.platformAdapter.client.groupParticipantsUpdate(ctx.chatId, [targetParticipant.id], 'remove');
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
