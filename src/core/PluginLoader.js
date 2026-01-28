import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import logger from '../utils/logger.js';

export default class PluginLoader {
  constructor(commandRegistry, config, bot = null) {
    this.commandRegistry = commandRegistry;
    this.config = config;
    this.bot = bot;
    this.plugins = new Map();
    this.logger = logger.child({ component: 'PluginLoader' });
  }
  
  setBot(bot) {
    this.bot = bot;
  }

  async loadAll() {
    const pluginsDir = this.config.paths.plugins;

    if (!fs.existsSync(pluginsDir)) {
      this.logger.warn(`Plugins directory not found: ${pluginsDir}`);
      fs.mkdirSync(pluginsDir, { recursive: true });
      return;
    }

    const files = fs.readdirSync(pluginsDir).filter(file => 
      file.endsWith('.js') && !file.startsWith('_')
    );

    this.logger.info(`Found ${files.length} plugin(s)`);

    for (const file of files) {
      await this.load(file);
    }
  }

  async load(filename) {
    try {
      const pluginPath = path.join(this.config.paths.plugins, filename);
      const pluginUrl = pathToFileURL(pluginPath).href;
      
      const pluginModule = await import(`${pluginUrl}?update=${Date.now()}`);
      const plugin = pluginModule.default;

      if (!plugin || !plugin.name) {
        this.logger.warn(`Invalid plugin structure: ${filename}`);
        return;
      }

      // Register all commands from the plugin (if any)
      if (plugin.commands && Array.isArray(plugin.commands)) {
        for (const command of plugin.commands) {
          // Patch: If command.run exists but not command.execute, set execute = run for registry compatibility
          if (typeof command.run === 'function' && typeof command.execute !== 'function') {
            command.execute = command.run;
          }
          this.commandRegistry.register(command.name, command);
        }
      }

      // Call onLoad hook if present
      if (typeof plugin.onLoad === 'function' && this.bot) {
        try {
          await plugin.onLoad(this.bot);
        } catch (hookError) {
          this.logger.error({ error: hookError, plugin: plugin.name }, 'Plugin onLoad hook failed');
        }
      }

      this.plugins.set(plugin.name, {
        ...plugin,
        filename,
        loaded: new Date()
      });

      const commandCount = plugin.commands?.length || 0;
      this.logger.info(`Loaded plugin: ${plugin.name} (${commandCount} command(s))`);
    } catch (error) {
      this.logger.error({ error, filename }, 'Failed to load plugin');
    }
  }

  async reload(pluginName) {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      this.logger.warn(`Plugin not found: ${pluginName}`);
      return false;
    }

    // Unregister all commands from this plugin
    if (plugin.commands) {
      for (const command of plugin.commands) {
        this.commandRegistry.unregister(command.name);
      }
    }

    this.plugins.delete(pluginName);
    await this.load(plugin.filename);
    return true;
  }

  unload(pluginName) {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      this.logger.warn(`Plugin not found: ${pluginName}`);
      return false;
    }

    if (plugin.commands) {
      for (const command of plugin.commands) {
        this.commandRegistry.unregister(command.name);
      }
    }

    this.plugins.delete(pluginName);
    this.logger.info(`Unloaded plugin: ${pluginName}`);
    return true;
  }

  getAll() {
    return Array.from(this.plugins.values());
  }

  get(name) {
    return this.plugins.get(name);
  }
}
