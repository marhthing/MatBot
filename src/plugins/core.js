// pm2style.js - Plugin for .shutdown, .update, .restart commands (PM2 style)
import { writeFileSync } from 'fs';
import { execSync } from 'child_process';

export default {
  name: 'core',
  description: 'Bot process management commands: .shutdown, .update, .restart',
  version: '1.0.0',
  author: 'MATDEV',
  commands: [
    {
      name: 'shutdown',
      aliases: [],
      description: 'Shutdown the bot process',
      usage: '.shutdown',
      category: 'owner',
      ownerOnly: true,
      adminOnly: false,
      groupOnly: false,
      cooldown: 0,
      async execute(ctx) {
        await ctx.reply('🛑 Shutting down...');
        console.log('Shutdown command received, exiting process.');
        setTimeout(() => process.exit(0), 500);
      }
    },
    {
      name: 'restart',
      aliases: [],
      description: 'Restart the bot process',
      usage: '.restart',
      category: 'owner',
      ownerOnly: true,
      adminOnly: false,
      groupOnly: false,
      cooldown: 0,
      async execute(ctx) {
        await ctx.reply('♻️ Restarting...');
        console.log('Restart command received, exiting process to trigger manager restart.');
        if (ctx.bot && typeof ctx.bot.restart === 'function') {
           await ctx.bot.restart();
        } else {
           process.exit(0);
        }
      }
    },
    {
      name: 'update',
      aliases: [],
      description: 'Check for updates',
      usage: '.update',
      category: 'owner',
      ownerOnly: true,
      adminOnly: false,
      groupOnly: false,
      cooldown: 0,
      async execute(ctx) {
        // If the user says ".update now", handle it directly
        if (ctx.args && ctx.args[0] === 'now') {
          await ctx.reply('🗑️ Cleaning project files (src, node_modules) and preparing for re-clone...');
          
          const fs = await import('fs');
          const { execSync } = await import('child_process');
          const path = await import('path');
          
          // Delete everything except .env, session folder, and root index.js
          const keep = ['.env', 'session', 'index.js'];
          const cwd = process.cwd();
          const all = fs.readdirSync(cwd);
          for (const item of all) {
            if (keep.includes(item)) continue;
            try {
              const full = path.join(cwd, item);
              if (fs.lstatSync(full).isDirectory()) {
                if (process.platform === 'win32') {
                  execSync(`powershell -Command \"Remove-Item '${full}' -Recurse -Force\"`);
                } else {
                  execSync(`rm -rf '${full}'`);
                }
              } else {
                fs.unlinkSync(full);
              }
            } catch (e) {}
          }
          
          // Force exit immediately and start the root index.js (recloner) in the foreground (interactive)
          execSync('node index.js', { stdio: 'inherit' });
          process.exit(0);
          return;
        }

        //await ctx.reply('🔍 Checking for updates...');
        try {
          const { execSync } = await import('child_process');
          execSync('git fetch');
          const status = execSync('git status -uno').toString();
          if (status.includes('Your branch is up to date')) {
            await ctx.reply('✅ Bot is already up to date.');
          } else {
            await ctx.reply('🆕 Update available! Use `.update now` to apply.');
          }
        } catch (error) {
          await ctx.reply('❌ Error checking for updates: ' + error.message);
        }
      }
    },
    {
      name: 'updatenow',
      aliases: [], 
      description: 'Apply update (forces reclone and cleans environment)',
      usage: '.update now',
      category: 'owner',
      ownerOnly: true,
      adminOnly: false,
      groupOnly: false,
      cooldown: 0,
      async execute(ctx) {
        const updateCmd = ctx.bot.commandRegistry.get('update');
        if (updateCmd) {
           // Manually trigger the "now" logic
           ctx.args = ['now'];
           return await updateCmd.execute(ctx);
        }
        await ctx.reply('❌ Internal error: update command not found.');
      }
    },
    {
      name: 'updateforce',
      aliases: ['update force'],
      description: 'Force reclone and clean environment, regardless of update status',
      usage: '.update force',
      category: 'owner',
      ownerOnly: true,
      adminOnly: false,
      groupOnly: false,
      cooldown: 0,
      async execute(ctx) {
        await ctx.reply('🗑️ Forcing reclone and cleaning project files (src, node_modules)...');
        const fs = await import('fs');
        const { execSync } = await import('child_process');
        const path = await import('path');
        // Delete everything except .env, session folder, and root index.js
        const keep = ['.env', 'session', 'index.js'];
        const cwd = process.cwd();
        const all = fs.readdirSync(cwd);
        for (const item of all) {
          if (keep.includes(item)) continue;
          try {
            const full = path.join(cwd, item);
            if (fs.lstatSync(full).isDirectory()) {
              if (process.platform === 'win32') {
                execSync(`powershell -Command \"Remove-Item '${full}' -Recurse -Force\"`);
              } else {
                execSync(`rm -rf '${full}'`);
              }
            } else {
              fs.unlinkSync(full);
            }
          } catch (e) {}
        }
        // Start the root index.js in the foreground (interactive)
        execSync('node index.js', { stdio: 'inherit' });
        process.exit(0);
      }
    }
  ]
};
