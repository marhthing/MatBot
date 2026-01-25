import fs from 'fs';
import path from 'path';

const ENV_PATH = path.resolve(process.cwd(), '.env');

const BotReactionsPlugin = {
  name: 'botreactions',
  description: 'Toggle bot reactions to commands',
  category: 'utility',
  commands: [
    {
      name: 'br',
      description: 'Turn bot reactions on or off',
      usage: '.br on | off',
      execute: async (ctx) => {
        const arg = (ctx.args[0] || '').toLowerCase();
        if (!['on', 'off'].includes(arg)) {
          return ctx.reply('Usage: .br on | off');
        }
        // Read .env
        let envContent = '';
        if (fs.existsSync(ENV_PATH)) {
          envContent = fs.readFileSync(ENV_PATH, 'utf-8');
        }
        // Update or add BOT_REACTIONS
        if (/^BOT_REACTIONS=.*/m.test(envContent)) {
          envContent = envContent.replace(/^BOT_REACTIONS=.*/m, `BOT_REACTIONS=${arg}`);
        } else {
          envContent += `\nBOT_REACTIONS=${arg}`;
        }
        fs.writeFileSync(ENV_PATH, envContent, 'utf-8');
        ctx.reply(`Bot reactions are now *${arg.toUpperCase()}*.`);
      }
    }
  ]
};

export default BotReactionsPlugin;
