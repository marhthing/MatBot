import axios from 'axios';
import fs from 'fs';
import path from 'path';

export default {
  name: 'auto-features',
  description: 'Automated bot interactions (Typing, Online, React, Read)',
  version: '1.0.0',
  author: 'MATDEV',

  async onLoad(bot) {
    const registry = bot.getCommandRegistry();
    
    // Register a global message handler for auto-features
    registry.registerMessageHandler(async (ctx) => {
      // Read settings from process.env (set by config loader/default.js)
      const settings = {
        AUTO_TYPING: process.env.AUTO_TYPING === 'true',
        ALWAYS_ONLINE: process.env.ALWAYS_ONLINE === 'true',
        AUTO_READ: process.env.AUTO_READ === 'true',
        AUTO_REACT: process.env.AUTO_REACT === 'true',
        AUTO_STATUS_REACT: process.env.AUTO_STATUS_REACT === 'true'
      };

      if (!ctx.isFromMe) {
        // Auto Read
        if (settings.AUTO_READ && typeof ctx.read === 'function') {
          try { await ctx.read(); } catch (e) {}
        }

        // Auto Typing
        if (settings.AUTO_TYPING && typeof ctx.presence === 'function') {
          try { await ctx.presence('composing'); } catch (e) {}
        }

        // Auto React to messages
        if (settings.AUTO_REACT && typeof ctx.react === 'function' && !ctx.command) {
          const reactions = ['❤️', '👍', '🔥', '✨', '🤖'];
          const randomReact = reactions[Math.floor(Math.random() * reactions.length)];
          try { await ctx.react(randomReact); } catch (e) {}
        }
      }

      // Auto Status React (requires platform specific logic in adapter, but we can try here)
      if (settings.AUTO_STATUS_REACT && ctx.raw?.key?.remoteJid === 'status@broadcast') {
        if (typeof ctx.react === 'function') {
           try { await ctx.react('❤️'); } catch (e) {}
        }
      }
      
      // Always Online (Presence updates)
      if (settings.ALWAYS_ONLINE && typeof ctx.presence === 'function') {
        try { await ctx.presence('available'); } catch (e) {}
      }
    });
  },

  commands: [
    {
      name: 'autotyping',
      description: 'Turn auto typing on or off',
      usage: '.autotyping <on/off>',
      category: 'owner',
      ownerOnly: true,
      async execute(ctx) {
        const value = ctx.args[0]?.toLowerCase();
        if (!['on', 'off'].includes(value)) {
          return await ctx.reply('Usage: .autotyping <on/off>');
        }
        const envPath = path.resolve(process.cwd(), '.env');
        let envContent = fs.readFileSync(envPath, 'utf-8');
        const regex = /^AUTO_TYPING=.*/m;
        const newValue = `AUTO_TYPING=${value === 'on' ? 'true' : 'false'}`;
        if (regex.test(envContent)) {
          envContent = envContent.replace(regex, newValue);
        } else {
          envContent += `\n${newValue}`;
        }
        fs.writeFileSync(envPath, envContent);
        process.env.AUTO_TYPING = value === 'on' ? 'true' : 'false';
        await ctx.reply(`✅ AUTO_TYPING has been set to ${value}.`);
      }
    },
    {
      name: 'autoonline',
      description: 'Turn always online on or off',
      usage: '.autoonline <on/off>',
      category: 'owner',
      ownerOnly: true,
      async execute(ctx) {
        const value = ctx.args[0]?.toLowerCase();
        if (!['on', 'off'].includes(value)) {
          return await ctx.reply('Usage: .autoonline <on/off>');
        }
        const envPath = path.resolve(process.cwd(), '.env');
        let envContent = fs.readFileSync(envPath, 'utf-8');
        const regex = /^ALWAYS_ONLINE=.*/m;
        const newValue = `ALWAYS_ONLINE=${value === 'on' ? 'true' : 'false'}`;
        if (regex.test(envContent)) {
          envContent = envContent.replace(regex, newValue);
        } else {
          envContent += `\n${newValue}`;
        }
        fs.writeFileSync(envPath, envContent);
        process.env.ALWAYS_ONLINE = value === 'on' ? 'true' : 'false';
        // Immediately update WhatsAppAdapter presence
        const waAdapter = ctx.platformAdapter || (ctx.bot && ctx.bot.getAdapter && ctx.bot.getAdapter('whatsapp'));
        if (waAdapter && typeof waAdapter.setAlwaysOnline === 'function') {
          await waAdapter.setAlwaysOnline(value === 'on');
        }
        await ctx.reply(`✅ ALWAYS_ONLINE has been set to ${value}.`);
      }
    },
    {
      name: 'autoread',
      description: 'Turn auto read on or off',
      usage: '.autoread <on/off>',
      category: 'owner',
      ownerOnly: true,
      async execute(ctx) {
        const value = ctx.args[0]?.toLowerCase();
        if (!['on', 'off'].includes(value)) {
          return await ctx.reply('Usage: .autoread <on/off>');
        }
        const envPath = path.resolve(process.cwd(), '.env');
        let envContent = fs.readFileSync(envPath, 'utf-8');
        const regex = /^AUTO_READ=.*/m;
        const newValue = `AUTO_READ=${value === 'on' ? 'true' : 'false'}`;
        if (regex.test(envContent)) {
          envContent = envContent.replace(regex, newValue);
        } else {
          envContent += `\n${newValue}`;
        }
        fs.writeFileSync(envPath, envContent);
        await ctx.reply(`✅ AUTO_READ has been set to ${value}.`);
      }
    },
    {
      name: 'autoreact',
      description: 'Turn auto react on or off',
      usage: '.autoreact <on/off>',
      category: 'owner',
      ownerOnly: true,
      async execute(ctx) {
        const value = ctx.args[0]?.toLowerCase();
        if (!['on', 'off'].includes(value)) {
          return await ctx.reply('Usage: .autoreact <on/off>');
        }
        const envPath = path.resolve(process.cwd(), '.env');
        let envContent = fs.readFileSync(envPath, 'utf-8');
        const regex = /^AUTO_REACT=.*/m;
        const newValue = `AUTO_REACT=${value === 'on' ? 'true' : 'false'}`;
        if (regex.test(envContent)) {
          envContent = envContent.replace(regex, newValue);
        } else {
          envContent += `\n${newValue}`;
        }
        fs.writeFileSync(envPath, envContent);
        await ctx.reply(`✅ AUTO_REACT has been set to ${value}.`);
      }
    },
    {
      name: 'autostatusreact',
      description: 'Turn auto status react on or off',
      usage: '.autostatusreact <on/off>',
      category: 'owner',
      ownerOnly: true,
      async execute(ctx) {
        const value = ctx.args[0]?.toLowerCase();
        if (!['on', 'off'].includes(value)) {
          return await ctx.reply('Usage: .autostatusreact <on/off>');
        }
        const envPath = path.resolve(process.cwd(), '.env');
        let envContent = fs.readFileSync(envPath, 'utf-8');
        const regex = /^AUTO_STATUS_REACT=.*/m;
        const newValue = `AUTO_STATUS_REACT=${value === 'on' ? 'true' : 'false'}`;
        if (regex.test(envContent)) {
          envContent = envContent.replace(regex, newValue);
        } else {
          envContent += `\n${newValue}`;
        }
        fs.writeFileSync(envPath, envContent);
        await ctx.reply(`✅ AUTO_STATUS_REACT has been set to ${value}.`);
      }
    }
  ]
};