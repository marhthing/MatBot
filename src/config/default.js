import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

// Auto-fill missing .env variables with defaults (template)
const envPath = path.resolve(process.cwd(), '.env');
const requiredVars = {
  BOT_NAME: 'MATDEV',
  PREFIX: '.',
  OWNER_NUMBER: '',
  ENABLE_WHATSAPP: 'true',
  ENABLE_TELEGRAM: 'true',
  TELEGRAM_BOT_TOKEN: '',
  LOG_LEVEL: 'info',
  MAX_COMMAND_COOLDOWN: '3000',
  STICKER_PACK: 'MATDEV Bot',
  STICKER_AUTHOR: 'Bot',
};
if (fs.existsSync(envPath)) {
  let envContent = fs.readFileSync(envPath, 'utf-8');
  let changed = false;
  for (const [key, def] of Object.entries(requiredVars)) {
    const regex = new RegExp(`^${key}=`, 'm');
    if (!regex.test(envContent)) {
      envContent += `\n${key}=${def}`;
      changed = true;
    }
  }
  if (changed) fs.writeFileSync(envPath, envContent.trim() + '\n');
}

export default {
  // Bot settings
  botName: process.env.BOT_NAME || 'MATDEV',
  prefix: process.env.PREFIX || '.',

  // Owner settings
  ownerNumber: process.env.OWNER_NUMBER || '',

  // Platform toggles
  platforms: {
    whatsapp: process.env.ENABLE_WHATSAPP === 'true',
    telegram: process.env.ENABLE_TELEGRAM === 'true'
  },

  // Telegram settings
  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN || ''
  },

  // Sticker defaults
  stickerPack: process.env.STICKER_PACK || 'MATDEV Bot',
  stickerAuthor: process.env.STICKER_AUTHOR || 'Bot',

  // Rate limiting
  rateLimiting: {
    enabled: true,
    maxCommands: 5,
    windowMs: 10000 // 10 seconds
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info'
  },

  // Paths
  paths: {
    session: './session',
    storage: './storage',
    tmp: './tmp',
    plugins: './src/plugins'
  }
};