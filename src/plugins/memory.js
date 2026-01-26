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
        const cpus = os.default.cpus();
        const platform = os.default.platform();
        const arch = os.default.arch();
        const uptime = os.default.uptime();
        const formatMB = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;
        const formatGB = (bytes) => `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
        const msg = `
*Bot Process Memory Usage:*
• RSS: ${formatMB(processMem.rss)}
• Heap Total: ${formatMB(processMem.heapTotal)}
• Heap Used: ${formatMB(processMem.heapUsed)}
• External: ${formatMB(processMem.external)}
• Array Buffers: ${formatMB(processMem.arrayBuffers)}

*System Info:*
• Platform: ${platform} ${arch}
• Uptime: ${(uptime/3600).toFixed(2)} hours
• CPU: ${cpus[0]?.model || 'Unknown'} (${cpus.length} cores)

*System Memory:*
• Free: ${formatMB(freeMem)} (${formatGB(freeMem)})
• Total: ${formatMB(totalMem)} (${formatGB(totalMem)})
• Free %: ${((freeMem/totalMem)*100).toFixed(2)}%
`;
        await ctx.reply(msg.trim());
      }
    }
  ]
};
