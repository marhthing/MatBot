import EventEmitter from 'events';
import logger from '../utils/logger.js';
import CommandRegistry from './CommandRegistry.js';
import PluginLoader from './PluginLoader.js';
import PermissionManager from './PermissionManager.js';
import RateLimiter from '../utils/rateLimiter.js';
import MediaHandler from '../utils/mediaHandler.js';
import WhatsAppAdapter from '../adapters/WhatsAppAdapter.js';
import TelegramAdapter from '../adapters/TelegramAdapter.js';
import fs from 'fs';
import path from 'path';
import pendingActions from '../utils/pendingActions.js';

export default class Bot extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.logger = logger.child({ component: 'Bot' });
    
    this.commandRegistry = new CommandRegistry(config);
    this.pluginLoader = new PluginLoader(this.commandRegistry, config);
    this.pluginLoader.setBot(this);
    this.permissionManager = new PermissionManager(config);
    this.rateLimiter = new RateLimiter(config);
    this.mediaHandler = new MediaHandler(config);
    
    this.adapters = new Map();
    
    this.createDirectories();
  }

  createDirectories() {
    const dirs = [
      this.config.paths.session,
      this.config.paths.storage,
      this.config.paths.tmp,
      this.config.paths.plugins
    ];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        this.logger.info(`Created directory: ${dir}`);
      }
    }

    // Ensure storage.json exists
    const storageFile = path.join(this.config.paths.storage, 'storage.json');
    if (!fs.existsSync(storageFile)) {
      fs.writeFileSync(storageFile, '{}', 'utf-8');
      this.logger.info(`Created file: ${storageFile}`);
    }
  }

  async start() {
    this.logger.info(`Starting ${this.config.botName}...`);

    if (this.config.platforms.whatsapp) {
      await this.initializeWhatsApp();
      await new Promise((resolve) => {
        const onReady = (platform) => {
          if (platform === 'whatsapp') {
            this.off('platform:ready', onReady);
            resolve();
          }
        };
        this.on('platform:ready', onReady);
      });
    }

    await this.pluginLoader.loadAll();

    if (this.config.platforms.telegram) {
      await this.initializeTelegram();
    }

    if (this.adapters.size === 0) {
      this.logger.error('No platforms enabled! Enable at least one platform in .env');
      process.exit(1);
    }

    this.logger.info(`${this.config.botName} started successfully on ${this.adapters.size} platform(s)`);
  }

  async initializeWhatsApp() {
    try {
      this.logger.info('Initializing WhatsApp...');
      const adapter = new WhatsAppAdapter(this.config);
      adapter.commandRegistry = this.commandRegistry;
      
      adapter.on('message', (messageContext) => {
        this.handleMessage(messageContext);
      });

      adapter.on('ready', () => {
        this.logger.info('WhatsApp is ready');
        this.emit('platform:ready', 'whatsapp');
      });

      await adapter.connect();
      this.adapters.set('whatsapp', adapter);
    } catch (error) {
      this.logger.error({ 
        message: error?.message, 
        stack: error?.stack,
        name: error?.name,
        code: error?.code
      }, 'Failed to initialize WhatsApp');
      throw error;
    }
  }

  async restart() {
    this.logger.info('Restarting bot...');
    await this.stop();
    process.exit(0);
  }

  async initializeTelegram() {
    try {
      this.logger.info('Initializing Telegram...');
      const adapter = new TelegramAdapter(this.config);
      adapter.commandRegistry = this.commandRegistry;
      
      adapter.on('message', (messageContext) => {
        this.handleMessage(messageContext);
      });

      adapter.on('ready', () => {
        this.logger.info('Telegram is ready');
        this.emit('platform:ready', 'telegram');
      });

      await adapter.connect();
      this.adapters.set('telegram', adapter);
    } catch (error) {
      this.logger.error({ error }, 'Failed to initialize Telegram');
    }
  }

  async handleMessage(messageContext) {
    this.logger.debug({
      platform: messageContext.platform,
      command: messageContext.command,
      sender: messageContext.senderName,
      isCommand: !!messageContext.command,
      text: messageContext.text,
      chatId: messageContext.chatId,
      senderId: messageContext.senderId
    }, '[handleMessage] Received message');

    let handled = false;
    try {
      handled = await pendingActions.handle(messageContext);
    } catch (err) {
      this.logger.error({ err, ctx: messageContext }, '[handleMessage] Error in pendingActions.handle');
    }
    if (handled) return;

    if (this.permissionManager.isBanned(messageContext.senderId, messageContext.platform)) {
      this.logger.warn(`Blocked message from banned user: ${messageContext.senderId}`);
      return;
    }

    if (this.permissionManager.isChatBlacklisted(messageContext.chatId, messageContext.platform)) {
      this.logger.warn(`Blocked message from blacklisted chat: ${messageContext.chatId}`);
      return;
    }

    this.emit('message', messageContext);

    for (const handler of this.commandRegistry.getMessageHandlers()) {
      try {
        await handler(messageContext);
      } catch (err) {
        this.logger.error({ err }, '[handleMessage] Error in message handler');
      }
    }

    if (messageContext.command) {
      try {
        // Check for owner override on adminOnly commands
        const registry = this.commandRegistry;
        const cmd = registry.get(messageContext.command);
        if (cmd && cmd.adminOnly && messageContext.isOwner && messageContext.isGroup) {
          messageContext.isAdmin = true;
        }

        const rateLimitResult = this.rateLimiter.check(messageContext.senderId, messageContext.platform);
        
        if (!rateLimitResult.allowed) {
          if (rateLimitResult.reason === 'temporarily_blocked') {
            await messageContext.reply(`You are temporarily blocked from using commands. Try again in ${rateLimitResult.resetIn} seconds.`);
          } else {
            await messageContext.reply(`Slow down! You can use ${rateLimitResult.remaining} more command(s). Reset in ${rateLimitResult.resetIn} seconds.`);
          }
          return;
        }

        await this.commandRegistry.execute(messageContext);
      } catch (err) {
        this.logger.error({ err, command: messageContext.command }, '[handleMessage] Error executing command');
      }
    }
  }

  async stop() {
    if (this._stopping) return;
    this._stopping = true;
    this.logger.info('Stopping bot...');
    for (const [platform, adapter] of this.adapters) {
      this.logger.info(`Disconnecting ${platform}...`);
      try {
        await adapter.disconnect();
      } catch (e) {
        this.logger.error({ error: e }, `Error disconnecting ${platform}`);
      }
    }
    this.logger.info('Bot stopped');
  }

  getAdapter(platform) {
    return this.adapters.get(platform);
  }

  getCommandRegistry() {
    return this.commandRegistry;
  }

  getPluginLoader() {
    return this.pluginLoader;
  }

  getPermissionManager() {
    return this.permissionManager;
  }

  getRateLimiter() {
    return this.rateLimiter;
  }

  getMediaHandler() {
    return this.mediaHandler;
  }
}
