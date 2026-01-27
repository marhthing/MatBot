/**
 * Sticker Command Plugin
 * Bind commands to stickers for quick execution
 */
import fs from 'fs';
import path from 'path';

const STORAGE_FILE = path.resolve('storage', 'storage.json');

function loadStickerCommands() {
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      const raw = fs.readFileSync(STORAGE_FILE, 'utf-8');
      const json = JSON.parse(raw.replace(/^\/\/.*$/mg, ''));
      return json.stickerCommands || {};
    }
  } catch {}
  return {};
}

function saveStickerCommands(stickerCommands) {
  let json = {};
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      const raw = fs.readFileSync(STORAGE_FILE, 'utf-8');
      json = JSON.parse(raw.replace(/^\/\/.*$/mg, ''));
    }
  } catch {}
  json.stickerCommands = stickerCommands;
  fs.writeFileSync(STORAGE_FILE, JSON.stringify(json, null, 2), 'utf-8');
}

const StickerCommandPlugin = {
  name: 'stickercommand',

  onLoad: async (bot) => {
    bot.getCommandRegistry().registerMessageHandler(async (ctx) => {
      await StickerCommandPlugin.handleMessage(ctx);
    });
  },
  description: 'Bind commands to stickers',
  category: 'utility',

  commands: [
    {
      name: 'setcmd',
      description: 'Bind a command to a sticker',
      usage: '.setcmd <command> (reply to a sticker)',
      ownerOnly: true,
      execute: async (ctx) => {
        try {
          const args = ctx.args;
          
          if (!args || args.length === 0) {
            await ctx.reply('❌ Usage: .setcmd <command>\nReply to a sticker with this command.');
            return;
          }

          const commandName = args[0].toLowerCase().replace('.', '');

          // Verify the command exists
          const commandExists = ctx.commandRegistry?.get(commandName);
          if (!commandExists) {
            await ctx.reply(`❌ Command "${commandName}" not found.`);
            return;
          }

          // Check if replying to a sticker
          const quotedMessage = ctx.raw?.message?.extendedTextMessage?.contextInfo?.quotedMessage;
          
          if (!quotedMessage || !quotedMessage.stickerMessage) {
            await ctx.reply('❌ Please reply to a sticker when using .setcmd');
            return;
          }

          // Get sticker identifiers
          const stickerData = quotedMessage.stickerMessage;
          const identifiers = getStickerIdentifiers(stickerData);

          if (identifiers.length === 0) {
            await ctx.reply('❌ Could not identify sticker.');
            return;
          }

          // Get current sticker commands from database
          const stickerCommands = loadStickerCommands();

          // Store binding with all identifiers
          identifiers.forEach(identifier => {
            stickerCommands[identifier] = {
              command: commandName,
              boundAt: Date.now(),
              boundBy: ctx.sender,
              chatId: ctx.chatId,
              identifiers: identifiers
            };
          });

          // Save to database
          saveStickerCommands(stickerCommands);

          await ctx.reply(
            `✅ Sticker bound to command: *${commandName}*\n\n` +
            `📝 Identifiers stored: ${identifiers.length}\n` +
            `👤 Bound by: ${ctx.senderName || 'Owner'}\n` +
            `📅 Date: ${new Date().toLocaleString()}`
          );

        } catch (error) {
          console.error(`Error in .setcmd: ${error.message}`);
          await ctx.reply('❌ Failed to bind sticker to command.');
        }
      }
    },

    {
      name: 'delcmd',
      description: 'Remove command binding from a sticker',
      usage: '.delcmd (reply to a sticker)',
      ownerOnly: true,
      execute: async (ctx) => {
        try {
          // Check if replying to a sticker
          const quotedMessage = ctx.raw?.message?.extendedTextMessage?.contextInfo?.quotedMessage;
          
          if (!quotedMessage || !quotedMessage.stickerMessage) {
            await ctx.reply('❌ Please reply to a sticker when using .delcmd');
            return;
          }

          // Get sticker identifiers
          const stickerData = quotedMessage.stickerMessage;
          const identifiers = getStickerIdentifiers(stickerData);

          if (identifiers.length === 0) {
            await ctx.reply('❌ Could not identify sticker.');
            return;
          }

          // Get current sticker commands from database
          const stickerCommands = loadStickerCommands();
          
          let removedCommand = null;
          let identifiersRemoved = 0;

          // Remove all matching identifiers
          identifiers.forEach(identifier => {
            if (stickerCommands[identifier]) {
              if (!removedCommand) {
                removedCommand = stickerCommands[identifier].command;
              }
              delete stickerCommands[identifier];
              identifiersRemoved++;
            }
          });

          if (removedCommand) {
            // Save updated database
            saveStickerCommands(stickerCommands);
            
            await ctx.reply(
              `✅ Command binding removed!\n\n` +
              `🗑️ Command: *${removedCommand}*\n` +
              `📝 Identifiers removed: ${identifiersRemoved}`
            );
          } else {
            await ctx.reply('❌ This sticker has no command binding.');
          }

        } catch (error) {
          console.error(`Error in .delcmd: ${error.message}`);
          await ctx.reply('❌ Failed to remove command binding.');
        }
      }
    },

    {
      name: 'listcmd',
      description: 'List all sticker command bindings',
      usage: '.listcmd',
      ownerOnly: true,
      execute: async (ctx) => {
        try {
          const stickerCommands = loadStickerCommands();
          
          if (Object.keys(stickerCommands).length === 0) {
            await ctx.reply('📋 No sticker commands bound yet.\n\nUse .setcmd to bind a command to a sticker.');
            return;
          }

          // Group by command to avoid duplicates
          const commandMap = new Map();
          
          Object.values(stickerCommands).forEach(binding => {
            if (!commandMap.has(binding.command)) {
              commandMap.set(binding.command, {
                command: binding.command,
                boundAt: binding.boundAt,
                boundBy: binding.boundBy,
                identifiers: binding.identifiers?.length || 0
              });
            }
          });

          let message = '*📋 Sticker Command Bindings*\n\n';
          
          commandMap.forEach((binding, cmd) => {
            const date = new Date(binding.boundAt).toLocaleDateString();
            message += `▪️ *${cmd}*\n`;
            message += `   🔗 Identifiers: ${binding.identifiers}\n`;
            message += `   📅 ${date}\n\n`;
          });

          message += `_Total unique bindings: ${commandMap.size}_`;

          await ctx.reply(message);

        } catch (error) {
          console.error(`Error in .listcmd: ${error.message}`);
          await ctx.reply('❌ Failed to list command bindings.');
        }
      }
    }
  ],

  // Message handler to intercept stickers and execute bound commands
  async handleMessage(ctx) {
    try {
      // Check if this is a sticker message
      const stickerMessage = ctx.raw?.message?.stickerMessage;
      
      if (!stickerMessage) {
        return; // Not a sticker, continue normal processing
      }

      // Get sticker identifiers
      const identifiers = getStickerIdentifiers(stickerMessage);
      
      if (identifiers.length === 0) {
        return;
      }

      // Check if any identifier has a command binding
      const stickerCommands = loadStickerCommands();
      
      let boundCommand = null;
      
      for (const identifier of identifiers) {
        if (stickerCommands[identifier]) {
          boundCommand = stickerCommands[identifier].command;
          break;
        }
      }

      if (boundCommand) {
        // Execute the bound command
        console.log(`🎯 Sticker triggered command: ${boundCommand}`);
        
        // Create a modified context with the command
        const modifiedCtx = {
          ...ctx,
          command: boundCommand,
          args: [], // Stickers don't have args
          text: `.${boundCommand}`,
          isStickerCommand: true
        };

        // Use the main execute method for full permission/cooldown logic
        if (ctx.commandRegistry?.execute) {
          await ctx.commandRegistry.execute(modifiedCtx);
        }
      }

    } catch (error) {
      console.error(`Error handling sticker command: ${error.message}`);
    }
  }
};

/**
 * Generate multiple identifiers for a sticker
 * This ensures robust matching even if some properties change
 */
function getStickerIdentifiers(stickerData) {
  const identifiers = [];

  try {
    // Method 1: File SHA256 hash (most reliable)
    if (stickerData.fileSha256) {
      const sha256Hash = Buffer.from(stickerData.fileSha256).toString('hex');
      identifiers.push(`sha256:${sha256Hash}`);
    }

    // Method 2: Direct URL
    if (stickerData.url) {
      identifiers.push(`url:${stickerData.url}`);
    }

    // Method 3: Media key hash
    if (stickerData.mediaKey) {
      const mediaKeyHash = Buffer.from(stickerData.mediaKey).toString('hex');
      identifiers.push(`mediakey:${mediaKeyHash}`);
    }

    // Method 4: File size + MIME type combination
    if (stickerData.fileLength && stickerData.mimetype) {
      identifiers.push(`size-mime:${stickerData.fileLength}-${stickerData.mimetype}`);
    }

    // Method 5: Sticker pack info
    if (stickerData.packname && stickerData.author) {
      identifiers.push(`pack:${stickerData.packname}-${stickerData.author}`);
    }

    // Method 6: File encryption SHA256 (additional backup)
    if (stickerData.fileEncSha256) {
      const encSha256Hash = Buffer.from(stickerData.fileEncSha256).toString('hex');
      identifiers.push(`encsha256:${encSha256Hash}`);
    }

  } catch (error) {
    console.error('Error generating sticker identifiers:', error);
  }

  return identifiers;
}

export default StickerCommandPlugin;