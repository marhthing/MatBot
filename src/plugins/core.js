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
      description: 'Check if an update is available',
      usage: '.update',
      category: 'owner',
      ownerOnly: true,
      adminOnly: false,
      groupOnly: false,
      cooldown: 0,
      async execute(ctx) {
        await ctx.reply('🔍 Checking for updates...');
        let updateAvailable = false;
        let updateInfo = '';
        try {
          // Check for git updates (assumes git repo)
          const { execSync } = await import('child_process');
          execSync('git fetch', { stdio: 'ignore' });
          const local = execSync('git rev-parse HEAD').toString().trim();
          const remote = execSync('git rev-parse @{u}').toString().trim();
          if (local !== remote) {
            updateAvailable = true;
            updateInfo = 'A new update is available! Use .update now to apply.';
          } else {
            updateInfo = 'You are already up to date.';
          }
        } catch (e) {
          updateInfo = 'Could not check for updates (not a git repo or no remote set).';
        }
        await ctx.reply(updateInfo);
      }
    },
    {
      name: 'update now',
      aliases: ['update now'],
      description: 'Apply update if available (forces reclone)',
      usage: '.update now',
      category: 'owner',
      ownerOnly: true,
      adminOnly: false,
      groupOnly: false,
      cooldown: 0,
      async execute(ctx) {
        await ctx.reply('🔍 Checking for updates...');
        let updateAvailable = false;
        try {
          const { execSync } = await import('child_process');
          execSync('git fetch', { stdio: 'ignore' });
          const local = execSync('git rev-parse HEAD').toString().trim();
          const remote = execSync('git rev-parse @{u}').toString().trim();
          if (local !== remote) {
            updateAvailable = true;
          }
        } catch (e) {
          await ctx.reply('Could not check for updates (not a git repo or no remote set).');
          return;
        }
        if (!updateAvailable) {
          await ctx.reply('No update available. You are already up to date.');
          return;
        }
        await ctx.reply('🗑️ Update found! Deleting important files and restarting bot (will force reclone)...');
        const fs = await import('fs');
        const path = await import('path');
        const cwd = process.cwd();
        const targets = [
          'package.json',
          'package-lock.json',
          'node_modules',
          'src',
          'storage',
          'tmp',
          'README.md',
          // Do NOT include '.git' so git repo is preserved
        ];
        for (const target of targets) {
          if (target === '.git') continue; // Never delete .git, even if present
          const targetPath = path.resolve(cwd, target);
          if (fs.existsSync(targetPath)) {
            try {
              if (fs.lstatSync(targetPath).isDirectory()) {
                fs.rmSync(targetPath, { recursive: true, force: true });
              } else {
                fs.unlinkSync(targetPath);
              }
            } catch (e) {
              // Ignore errors
            }
          }
        }
        setTimeout(() => process.exit(0), 1000);
      }
    }
  ]
};
