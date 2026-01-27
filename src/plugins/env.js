import fs from 'fs';
import path from 'path';

const ENV_PATH = path.resolve(process.cwd(), '.env');
const EXCLUDED_KEYS = ['BOT_NAME', 'LOG_LEVEL', 'OWNER_NUMBER'];

function readEnvFile() {
  if (!fs.existsSync(ENV_PATH)) return '';
  return fs.readFileSync(ENV_PATH, 'utf-8');
}

function parseEnv(content) {
  const lines = content.split(/\r?\n/);
  const env = {};
  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const match = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (match) {
      env[match[1]] = match[2];
    }
  }
  return env;
}

function writeEnvFile(envObj) {
  let lines = ['# Bot Configuration'];
  for (const [key, value] of Object.entries(envObj)) {
    lines.push(`${key}=${value}`);
  }
  fs.writeFileSync(ENV_PATH, lines.join('\n'), 'utf-8');
}

export default {
  name: 'env',
  description: 'View or update .env variables',
  version: '1.0.0',
  author: 'MATDEV',
  commands: [
    {
      name: 'env',
      description: 'Show or update .env variables',
      usage: '.env [VAR=VALUE]',
      ownerOnly: true,
      async execute(ctx) {
        const arg = ctx.args.join(' ');
        let envContent = readEnvFile();
        let envObj = parseEnv(envContent);
        if (!arg) {
          // Show all except excluded
          let msg = '*Current .env variables:*\n';
          for (const [k, v] of Object.entries(envObj)) {
            if (EXCLUDED_KEYS.includes(k)) continue;
            msg += `• ${k} = ${v}\n`;
          }
          await ctx.reply(msg.trim());
          return;
        }
        // Parse VAR=VALUE
        const match = arg.match(/^([A-Za-z0-9_]+)=(.*)$/);
        if (!match) {
          await ctx.reply('Usage: .env VAR=VALUE');
          return;
        }
        const [, key, value] = match;
        if (EXCLUDED_KEYS.includes(key)) {
          await ctx.reply(`❌ You cannot update or add ${key} via this command.`);
          return;
        }
        envObj[key] = value;
        writeEnvFile(envObj);
        await ctx.reply(`✅ Updated .env: ${key}=${value}`);
      }
    }
  ]
};
