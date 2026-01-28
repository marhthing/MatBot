// Dependency check and install must run before any other imports!
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

function ensureDependencies() {
  const nodeModulesPath = path.join(process.cwd(), 'node_modules');
  const pkgPath = path.join(process.cwd(), 'package.json');
  let needInstall = false;
  if (!fs.existsSync(nodeModulesPath)) {
    needInstall = true;
  } else {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      for (const dep of Object.keys(pkg.dependencies || {})) {
        if (!fs.existsSync(path.join(nodeModulesPath, dep))) {
          needInstall = true;
          break;
        }
      }
    } catch {}
  }
  if (needInstall) {
    // Use console.log here, logger may not be available yet
    console.log('Installing missing packages...');
    try {
      execSync('npm install', { stdio: 'inherit' });
      console.log('All packages installed. Please restart the bot.');
      process.exit(0); // Exit cleanly so the manager restarts and loads with packages
    } catch (e) {
      console.error('Failed to install packages', e);
      process.exit(1);
    }
  }
}

ensureDependencies();

import Bot from './core/Bot.js';
import config from './config/default.js';
import logger from './utils/logger.js';
import watchFilesAndFolders from './utils/watcher.js';
import dotenv from 'dotenv';
import envMemory from './utils/envMemory.js';
dotenv.config();

/**
 * Main entry point for MATDEV Universal Bot
 */

const bot = new Bot(config);

// Hot-reload plugins and .env
watchFilesAndFolders({
  files: ['.env'],
  folders: ['./src/plugins'],
  async onChange(type, changedPath) {
    logger.info(`Detected change in ${changedPath}. Reloading...`);
    if (changedPath.endsWith('.env')) {
      dotenv.config();
      envMemory.reload(); // reload in-memory .env
      Object.assign(config, (await import('./config/default.js')).default);
      logger.info('Reloaded .env, envMemory, and config');
    }
    if (changedPath.includes('plugins')) {
      const pluginFile = path.basename(changedPath);
      if (pluginFile.endsWith('.js')) {
        // Try to find plugin by filename
        let found = false;
        for (const plugin of bot.pluginLoader.getAll()) {
          if (plugin.filename === pluginFile) {
            await bot.pluginLoader.reload(plugin.name);
            logger.info(`Reloaded plugin: ${plugin.name}`);
            found = true;
            break;
          }
        }
        if (!found) {
          // New plugin file, try to load it
          await bot.pluginLoader.load(pluginFile);
          logger.info(`Loaded new plugin: ${pluginFile}`);
        }
      }
    }
  }
});

// Handle graceful shutdown for Baileys session safety
let isShuttingDown = false;

function shutdownHandler(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info(`Received ${signal}, shutting down gracefully...`);
  bot.stop().then(() => process.exit(0)).catch(() => process.exit(1));
}

process.on('SIGINT', () => shutdownHandler('SIGINT'));
process.on('SIGTERM', () => shutdownHandler('SIGTERM'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error({ error }, 'Uncaught Exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  const errorDetails = reason instanceof Error 
    ? { message: reason.message, stack: reason.stack, name: reason.name }
    : { reason: String(reason) };
  logger.error(errorDetails, 'Unhandled Rejection');
});

// Start the bot
(async () => {
  try {
    await bot.start();
  } catch (error) {
    logger.error({ error }, 'Failed to start bot');
    process.exit(1);
  }
})();