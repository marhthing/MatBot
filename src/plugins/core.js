// pm2style.js - Plugin for .shutdown, .update, .restart commands (PM2 style)
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
        const { writeFileSync } = require('fs');
        writeFileSync('.restart_flag', '1');
        setTimeout(() => process.exit(0), 500);
      }
    },
    {
      name: 'update',
      aliases: [],
      description: 'Update the bot from GitHub and restart',
      usage: '.update',
      category: 'owner',
      ownerOnly: true,
      adminOnly: false,
      groupOnly: false,
      cooldown: 0,
      async execute(ctx) {
        await ctx.reply('🔄 Updating from GitHub and restarting...');
        console.log('Update command received, pulling from git and restarting.');
        const { spawnSync, spawn } = require('child_process');
        setTimeout(() => {
          spawnSync('git', ['pull'], { stdio: 'inherit', shell: process.platform === 'win32' });
          spawn(process.argv[0], process.argv.slice(1), {
            cwd: process.cwd(),
            detached: true,
            stdio: 'ignore',
            shell: process.platform === 'win32',
          }).unref();
          process.exit(0);
        }, 500);
      }
    }
  ]
};
