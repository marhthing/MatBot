// Dynamic per-user command permission management plugin
import fs from 'fs';
import path from 'path';

const STORAGE_FILE = path.resolve('storage', 'storage.json');

function loadStorage() {
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      return JSON.parse(fs.readFileSync(STORAGE_FILE, 'utf-8'));
    }
  } catch {}
  return {};
}

function saveStorage(data) {
  fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

export default {
  name: 'permissions',
  description: 'Manage per-user command permissions',
  version: '1.0.0',
  author: 'MATDEV',
  commands: [
    {
      name: 'allow',
      description: 'Allow a user to use a command: .allow <cmd>',
      usage: '.allow <cmd>',
      groupOnly: false,
      ownerOnly: true,
      async execute(ctx) {
        // In both private and group chats, just use chatId as the JID to allow
        const [cmd] = ctx.args;
        const jid = ctx.chatId;
        if (!cmd || !jid) {
          return ctx.reply('Usage: .allow <cmd>');
        }
        const storage = loadStorage();
        storage.allowedCommands = storage.allowedCommands || {};
        storage.allowedCommands[cmd] = storage.allowedCommands[cmd] || [];
        if (!storage.allowedCommands[cmd].includes(jid)) {
          storage.allowedCommands[cmd].push(jid);
          saveStorage(storage);
          ctx.reply(`✅ Allowed ${cmd} command`);
        } else {
          ctx.reply(`${cmd} command is already allowed`);
        }
      }
    },
    {
      name: 'remove',
      description: 'Remove a user or group from allowed list: .remove <cmd>',
      usage: '.remove <cmd>',
      groupOnly: false,
      ownerOnly: true,
      async execute(ctx) {
        // In both private and group chats, just use chatId as the JID to remove
        const [cmd] = ctx.args;
        const jid = ctx.chatId;
        if (!cmd || !jid) {
          return ctx.reply('Usage: .remove <cmd>');
        }
        const storage = loadStorage();
        storage.allowedCommands = storage.allowedCommands || {};
        storage.allowedCommands[cmd] = storage.allowedCommands[cmd] || [];
        if (storage.allowedCommands[cmd].includes(jid)) {
          storage.allowedCommands[cmd] = storage.allowedCommands[cmd].filter(j => j !== jid);
          saveStorage(storage);
          ctx.reply(`❌ Removed ${cmd} command`);
        } else {
          ctx.reply(`${cmd} command was not allowed`);
        }
      }
    },
    {
      name: 'pm',
      description: 'Show allowed users for all commands',
      usage: '.pm',
      groupOnly: false,
      ownerOnly: true,
      async execute(ctx) {
        const storage = loadStorage();
        const allowed = storage.allowedCommands || {};
        // Show only allowed commands for the current user or group
        const myJid = ctx.chatId;
        const allowedCmds = Object.entries(allowed)
          .filter(([cmd, jids]) => Array.isArray(jids) && jids.includes(myJid))
          .map(([cmd]) => cmd);
        if (!allowedCmds.length) return ctx.reply('No allowed commands set for this chat.');
        let msg = '*Allowed commands:*\n';
        for (const cmd of allowedCmds) {
          msg += `• ${cmd}\n`;
        }
        ctx.reply(msg);
      }
    }
  ]
};
