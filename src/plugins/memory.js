// memory.js - Plugin to show current memory usage and system info
import os from 'os';

export default {
  name: 'memory',
  description: 'Show current memory usage and system info',
  version: '1.0.0',
  author: 'MATDEV',
  commands: [
    {
      name: 'memory',
      aliases: ['mem', 'ram', 'meminfo'],
      description: 'Show current memory usage and system info',
      usage: '.memory',
      category: 'utility',
      ownerOnly: false,
      adminOnly: false,
      groupOnly: false,
      cooldown: 2,
      async execute(ctx) {
        const processMem = process.memoryUsage();
        const os = await import('os');
        const totalMem = os.default.totalmem();
        const freeMem = os.default.freemem();
        const format = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;
        const msg = `
*Bot Process Memory Usage:*
• RSS: ${format(processMem.rss)}
• Heap Total: ${format(processMem.heapTotal)}
• Heap Used: ${format(processMem.heapUsed)}
• External: ${format(processMem.external)}
• Array Buffers: ${format(processMem.arrayBuffers)}

*System Memory:*
• Free: ${format(freeMem)}
• Total: ${format(totalMem)}
• Free %: ${((freeMem/totalMem)*100).toFixed(2)}%
`;
        await ctx.reply(msg.trim());
      }
    }
  ]
};
