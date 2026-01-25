/**
 * Save Plugin
 * Forwards any quoted message or current message to the owner
 */
const SavePlugin = {
  name: 'save',
  description: 'Forward messages to owner',
  category: 'utility',

  commands: [
    {
      name: 'save',
      description: 'Forward message to owner',
      usage: '.save (reply to a message)',
      execute: async (ctx) => {
        try {
          // Use ctx.config if available, else fallback to global config
          const ownerNumber = ctx.config?.ownerNumber || ctx.platformAdapter?.config?.ownerNumber || ctx._adapter?.config?.ownerNumber;
          if (!ownerNumber) {
            return;
          }
          const ownerJid = `${ownerNumber}@s.whatsapp.net`;

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
            await ctx.platformAdapter.client.sendMessage(ownerJid, {
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
            await ctx.platformAdapter.client.sendMessage(ownerJid, {
              forward: {
                key: ctx.raw.key,
                message: ctx.raw.message
              }
            });
          }
        } catch (error) {
          console.error(`Error in .save command: ${error.message}`);
          // No user-facing error message
        }
      }
    }
  ]
};

export default SavePlugin;