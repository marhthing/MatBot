// memory.js
// In-memory message store for WhatsApp (and other platforms if needed)
// Stores all incoming and outgoing messages for antidelete and other features
import fs from 'fs';
import path from 'path';

const STORAGE_DIR = path.join(process.cwd(), 'storage', 'messages');

class MemoryStore {
  constructor() {
    // Structure: { chatId: { messageId: { ...messageData } } }
    this.messages = {};
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }
  }

  saveMessage(platform, chatId, messageId, messageData) {
    if (!this.messages[platform]) this.messages[platform] = {};
    if (!this.messages[platform][chatId]) this.messages[platform][chatId] = {};
    
    // Check if it's a real message (has content or media)
    const isRealMessage = messageData.message && !messageData.message.protocolMessage;
    
    // Only save if it's a real message
    if (isRealMessage) {
      const timestamp = Date.now();
      const extendedData = { ...messageData, _savedAt: timestamp };
      this.messages[platform][chatId][messageId] = extendedData;
      
      // Also save to disk for long term persistence
      this.saveToDisk(platform, chatId, messageId, extendedData);
    }
  }

  saveToDisk(platform, chatId, messageId, data) {
    try {
      const platformDir = path.join(STORAGE_DIR, platform);
      const safeChatId = chatId.replace(/[^a-zA-Z0-9]/g, '_');
      const chatDir = path.join(platformDir, safeChatId);
      
      if (!fs.existsSync(chatDir)) fs.mkdirSync(chatDir, { recursive: true });
      
      const filePath = path.join(chatDir, `${messageId}.json`);
      fs.writeFileSync(filePath, JSON.stringify(data));
    } catch (err) {
      // Silent fail for disk storage
    }
  }

  // Map-based getMessage for compatibility with Baileys getMessage
  getMessage(platform, chatId, messageId) {
    const platformStore = this.messages[platform];
    let msg = platformStore?.[chatId]?.[messageId];
    
    if (!msg) {
      // Try loading from disk if not in memory
      try {
        const safeChatId = chatId.replace(/[^a-zA-Z0-9]/g, '_');
        const filePath = path.join(STORAGE_DIR, platform, safeChatId, `${messageId}.json`);
        if (fs.existsSync(filePath)) {
          msg = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          // Restore to memory for future use
          if (!this.messages[platform]) this.messages[platform] = {};
          if (!this.messages[platform][chatId]) this.messages[platform][chatId] = {};
          this.messages[platform][chatId][messageId] = msg;
        }
      } catch (err) {}
    }
    
    return msg || null;
  }

  getAllMessages(platform, chatId) {
    return this.messages[platform]?.[chatId] || {};
  }

  getLatestMessage(platform, chatId) {
    const chatStore = this.messages[platform]?.[chatId];
    if (!chatStore) return null;
    const entries = Object.values(chatStore);
    if (entries.length === 0) return null;
    return entries.sort((a, b) => (b.messageTimestamp || 0) - (a.messageTimestamp || 0))[0];
  }

  deleteMessage(platform, chatId, messageId) {
    if (this.messages[platform]?.[chatId]) {
      delete this.messages[platform][chatId][messageId];
    }
    // Note: We don't delete from disk immediately to allow recovery even if memory is cleared
  }

  /**
   * Smart memory management: prune old/unimportant messages.
   * Keeps status/broadcast for 24h, others for 3 days.
   * If memory is low, aggressively move older messages to disk and clear from RAM.
   */
  async smartCleanup({ minFreeMB = 200, minFreePercent = 15 } = {}) {
    const os = await import('os');
    const now = Date.now();
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    
    // Check container memory if possible, fallback to os
    let freeMB, freePercent;
    try {
      // Direct import to avoid circular dependency issues if any
      const os = await import('os');
      const fs = await import('fs');
      
      const getContainerMemoryLocal = () => {
        try {
          const memMax = '/sys/fs/cgroup/memory.max';
          const memCurrent = '/sys/fs/cgroup/memory.current';
          if (fs.existsSync(memMax)) {
            const maxRaw = fs.readFileSync(memMax, 'utf8').trim();
            const currentRaw = fs.readFileSync(memCurrent, 'utf8').trim();
            const total = maxRaw === 'max' ? os.totalmem() : parseInt(maxRaw);
            return { total, used: parseInt(currentRaw) };
          }
          const memLimit = '/sys/fs/cgroup/memory/memory.limit_in_bytes';
          const memUsage = '/sys/fs/cgroup/memory/memory.usage_in_bytes';
          if (fs.existsSync(memLimit)) {
            const limit = parseInt(fs.readFileSync(memLimit, 'utf8').trim());
            const usage = parseInt(fs.readFileSync(memUsage, 'utf8').trim());
            const total = limit > 100 * 1024 * 1024 * 1024 ? os.totalmem() : limit;
            return { total, used: usage };
          }
        } catch (e) {}
        return { total: os.totalmem(), used: os.totalmem() - os.freemem() };
      };

      const containerMem = getContainerMemoryLocal();
      const freeMem = containerMem.total - containerMem.used;
      freeMB = freeMem / 1024 / 1024;
      freePercent = (freeMem / containerMem.total) * 100;
    } catch (err) {
      const os = await import('os');
      const freeMem = os.default.freemem();
      const totalMem = os.default.totalmem();
      freeMB = freeMem / 1024 / 1024;
      freePercent = (freeMem / totalMem) * 100;
    }

    const isLowMemory = freeMB < minFreeMB || freePercent < minFreePercent;
    let prunedMem = 0;
    let prunedDisk = 0;

    // 1. Memory Cleanup
    for (const platform of Object.keys(this.messages)) {
      for (const chatId of Object.keys(this.messages[platform])) {
        const isStatus = chatId.endsWith('@status') || chatId.endsWith('@broadcast');
        const retentionPeriod = isStatus ? MS_PER_DAY : 3 * MS_PER_DAY;
        
        // If memory is low, we also keep only the most recent messages in RAM
        const messages = Object.entries(this.messages[platform][chatId])
          .map(([id, msg]) => ({ id, ...msg }))
          .sort((a, b) => (b._savedAt || 0) - (a._savedAt || 0));

        messages.forEach((msg, index) => {
          const age = now - (msg._savedAt || now);
          
          // Case 1: Past absolute retention period (Delete forever)
          if (age > retentionPeriod) {
            delete this.messages[platform][chatId][msg.id];
            prunedMem++;
            return;
          }

          // Case 2: Memory is low or message is old (Offload to disk only)
          // Keep only top 100 most recent messages in RAM if memory is tight
          if (isLowMemory && index > 100) {
            delete this.messages[platform][chatId][msg.id];
            prunedMem++;
          }
        });
      }
    }

    // 2. Disk Cleanup (Recursive)
    const cleanDir = (dir) => {
      if (!fs.existsSync(dir)) return;
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stats = fs.statSync(fullPath);
        if (stats.isDirectory()) {
          cleanDir(fullPath);
          if (fs.readdirSync(fullPath).length === 0) fs.rmdirSync(fullPath);
        } else if (file.endsWith('.json')) {
          const isStatus = dir.includes('_status') || dir.includes('_broadcast');
          const retentionPeriod = isStatus ? MS_PER_DAY : 3 * MS_PER_DAY;
          if (now - stats.mtimeMs > retentionPeriod) {
            fs.unlinkSync(fullPath);
            prunedDisk++;
          }
        }
      }
    };
    cleanDir(STORAGE_DIR);

    if (prunedMem > 0 || prunedDisk > 0) {
      console.log(`[MemoryStore] Cleanup: Pruned ${prunedMem} from memory, ${prunedDisk} from disk. Free: ${freeMB.toFixed(2)}MB (${freePercent.toFixed(2)}%)`);
    }
  }
}

const memoryStore = new MemoryStore();

// Periodically run smartCleanup every 10 minutes
setInterval(() => {
  memoryStore.smartCleanup().catch(() => {});
}, 600000);

export default memoryStore;
