export default {
  name: 'help',
  description: 'Show help for all commands',
  version: '1.0.0',
  author: 'MATDEV',
  commands: [
    {
      name: 'help',
      aliases: ['h'],
      description: 'List all available commands or get help for a specific command',
      usage: '.help [command]',
      category: 'utility',
      ownerOnly: false,
      adminOnly: false,
      groupOnly: false,
      cooldown: 2,
      async execute(ctx) {
        const allCommands = ctx._adapter.commandRegistry.getAll();
        if (ctx.args.length === 0) {
          const commandList = allCommands.map(cmd => `• *${cmd.name}* - ${cmd.description}`).join('\n');
          await ctx.reply(`🤖 *Available Commands:*\n${commandList}`);
        } else {
          const cmd = allCommands.find(c => c.name === ctx.args[0] || (c.aliases && c.aliases.includes(ctx.args[0])));
          if (!cmd) return await ctx.reply('❌ Command not found.');
          await ctx.reply(`*${cmd.name}*\n${cmd.description}\nUsage: ${cmd.usage || 'N/A'}`);
        }
      }
    }
  ]
};
