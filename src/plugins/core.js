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
        console.log('Restart command received, creating .restart_flag for manager.');
        try {
          writeFileSync('.restart_flag', '1');
        } catch (e) {
          console.error('Failed to write .restart_flag:', e);
        }
        setTimeout(() => process.exit(0), 500);
      }
    },
    {
      name: 'update',
      aliases: ['update now'],
      description: 'Delete important files and restart the bot (forces reclone)',
      usage: '.update or .update now',
      category: 'owner',
      ownerOnly: true,
      adminOnly: false,
      groupOnly: false,
      cooldown: 0,
      async execute(ctx) {
        await ctx.reply('🗑️ Deleting important files and restarting bot (will force reclone)...');
        const fs = await import('fs');
        const path = await import('path');
        const cwd = process.cwd();
        // List of files/folders to delete
        const targets = [
          'package.json',
          'package-lock.json',
          'node_modules',
          'src',
          'storage',
          'tmp',
          'README.md',
        ];
        for (const target of targets) {
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
