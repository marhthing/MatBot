import fs from 'fs';
import path from 'path';

const STORAGE_PATH = path.join(process.cwd(), 'storage', 'storage.json');
function getSaveConfig() {
  let config = { dest: 'owner', jid: null };
  try {
    const raw = fs.readFileSync(STORAGE_PATH, 'utf8');
    const json = JSON.parse(raw.replace(/^\/\/.*$/mg, ''));
    if (json.save) config = { ...config, ...json.save };
  } catch {}
  return config;
}
function setSaveConfig(newConfig) {
  let json = {};
  try {
    const raw = fs.readFileSync(STORAGE_PATH, 'utf8');
    json = JSON.parse(raw.replace(/^\/\/.*$/mg, ''));
  } catch {}
  json.save = { ...json.save, ...newConfig };
  fs.writeFileSync(STORAGE_PATH, JSON.stringify(json, null, 2));
}

/**
 * Save Plugin
 * Forwards any quoted message or current message to the owner or custom JID
 */
const SavePlugin = {
  name: 'save',
  description: 'Forward messages to owner or custom JID',
  category: 'utility',

  commands: [
    {
      name: 'save',
      description: 'Forward message to owner or custom JID',
      usage: '.save (reply to a message) | .save <jid|g|p>',
      async execute(ctx) {
        try {
          const arg = ctx.args[0]?.toLowerCase();
          if (arg && !ctx.quoted) {
            if (arg === 'g') {
              setSaveConfig({ dest: 'group', jid: null });
              await ctx.reply('Save will now forward to the same chat.');
              return;
            }
            if (arg === 'p') {
              setSaveConfig({ dest: 'owner', jid: null });
              await ctx.reply('Save will now forward to the owner.');
              return;
            }
            if (/^[0-9a-zA-Z@._-]+$/.test(arg)) {
              setSaveConfig({ dest: 'custom', jid: arg });
              await ctx.reply(`Save will now forward to JID: ${arg}`);
              return;
            }
            await ctx.reply('Invalid argument. Usage: .save <jid|g|p> or reply to a message.');
            return;
          }

          // --- destination logic ---
          const conf = getSaveConfig();
          let destJid;
          if (conf.dest === 'group') destJid = ctx.chatId;
          else if (conf.dest === 'custom' && conf.jid) destJid = conf.jid;
          else if (conf.dest === 'owner') {
            const ownerNumber = ctx.config?.ownerNumber || ctx.platformAdapter?.config?.ownerNumber || ctx._adapter?.config?.ownerNumber;
            if (!ownerNumber) return;
            destJid = `${ownerNumber}@s.whatsapp.net`;
          }
          if (!destJid) destJid = ctx.chatId; // fallback

          // Check if there is a quoted message
          const quoted = ctx.raw?.message?.extendedTextMessage?.contextInfo?.quotedMessage || 
                        ctx.raw?.message?.imageMessage?.contextInfo?.quotedMessage ||
                        ctx.raw?.message?.videoMessage?.contextInfo?.quotedMessage;

          if (quoted) {
            // Get the context info for proper forwarding
            const contextInfo = ctx.raw?.message?.extendedTextMessage?.contextInfo ||
                              ctx.raw?.message?.imageMessage?.contextInfo ||
                              ctx.raw?.message?.videoMessage?.contextInfo;
            // Forward the quoted message with proper structure
            await ctx.platformAdapter.client.sendMessage(destJid, {
              forward: {
                key: {
                  id: contextInfo?.stanzaId,
                  remoteJid: contextInfo?.remoteJid || ctx.raw.key.remoteJid,
                  participant: contextInfo?.participant,
                  fromMe: false
                },
                message: quoted
              }
            });
          } else {
            // Forward the current message with proper structure
            await ctx.platformAdapter.client.sendMessage(destJid, {
              forward: {
                key: ctx.raw.key,
                message: ctx.raw.message
              }
            });
          }
        } catch (error) {
          console.error(`Error in .save command: ${error.message}`);
        }
      }
    }
  ]
};

export default SavePlugin;