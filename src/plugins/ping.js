export default {
  name: 'ping',
  description: 'Ping command plugin',
  version: '1.0.0',
  author: 'MATDEV',
  commands: [
    {
      name: 'ping',
      aliases: ['p'],
      description: 'Check if the bot is alive',
      usage: '.ping',
      category: 'utility',
      ownerOnly: false,
      adminOnly: false,
      groupOnly: false,
      cooldown: 3,
      async execute(ctx) {
        const start = Date.now();
        // Send initial message
        const sentMsg = await ctx.reply('🏓 Pong!');
        const latency = Date.now() - start;
        // Edit the original message with latency (remove platform info)
        if (ctx._adapter.editMessage) {
          await ctx._adapter.editMessage(ctx.chatId, sentMsg.id || sentMsg.key?.id, `🏓 Pong!\n⏱️ Latency: ${latency}ms`);
        } else {
          // Fallback: send a new message and optionally delete the old one
          await ctx.send(`🏓 Pong!\n⏱️ Latency: ${latency}ms`);
        }
      }
    }
  ]
};
