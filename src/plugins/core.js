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
        // Only check for updates, do not handle .update now logic here
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
      aliases: ['update now'], 
      description: 'Apply update if available (reclone only if update exists)',
      usage: '.update now',
      category: 'owner',
      ownerOnly: true,
      adminOnly: false,
      groupOnly: false,
      cooldown: 0,
      async execute(ctx) {
        // Check if local git is up to date with remote, then reclone if not
        try {
          const { execSync } = await import('child_process');
          execSync('git fetch');
          const local = execSync('git rev-parse HEAD').toString().trim();
          let remote;
          try {
            remote = execSync('git rev-parse @{u}').toString().trim();
          } catch (e) {
            await ctx.reply('❌ Could not determine remote tracking branch. Is this a git repo with a remote?');
            return;
          }
          if (local === remote) {
            await ctx.reply('✅ Bot is already up to date.');
            return;
          } else {
            await ctx.reply('🗑️ Update available! updating....');
            const fs = await import('fs');
            const path = await import('path');
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
              } catch (e) {
                await ctx.reply(`⚠️ Error deleting ${item}: ${e.message}`);
              }
            }
            try {
              // Instead of calling index.js again (which is already running as a manager),
              // we just exit and let the manager handle the restart or re-cloning.
              console.log('Update complete, exiting to allow manager to handle fresh start.');
              process.exit(0);
            } catch (e) {
              await ctx.reply('❌ Error exiting process: ' + e.message);
            }
          }
        } catch (error) {
          await ctx.reply('❌ Error checking for updates: ' + error.message);
        }
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
        await ctx.reply('Force updating.....');
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
