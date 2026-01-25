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
      aliases: ['update', 'update now'],
      description: 'Update the bot from GitHub and restart',
      usage: '.update or .update now',
      category: 'owner',
      ownerOnly: true,
      adminOnly: false,
      groupOnly: false,
      cooldown: 0,
      async execute(ctx) {
        const { execSync, spawnSync } = require('child_process');
        const { writeFileSync } = require('fs');
        let isUpToDate = true;
        try {
          // Fetch latest from origin
          execSync('git fetch origin', { stdio: 'ignore' });
          // Check if HEAD is behind origin/main
          const local = execSync('git rev-parse HEAD').toString().trim();
          const remote = execSync('git rev-parse origin/main').toString().trim();
          isUpToDate = (local === remote);
        } catch (e) {
          isUpToDate = false;
        }
        if (ctx.command === 'update') {
          if (isUpToDate) {
            await ctx.reply('✅ Bot is already up to date with GitHub.');
          } else {
            await ctx.reply('❌ Bot is not up to date. Use .update now to force a full update.');
          }
          return;
        }
        // .update now: force full reclone
        await ctx.reply('🔄 Forcing full update: recloning from GitHub and restarting...');
        writeFileSync('.update_flag.json', '{}');
        setTimeout(() => process.exit(0), 500);
      }
    }
  ]
};
