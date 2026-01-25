// memory.js
// In-memory message store for WhatsApp (and other platforms if needed)
// Stores all incoming and outgoing messages for antidelete and other features
// Memory management (cleanup, disk persistence, etc.) can be added later

class MemoryStore {
  constructor() {
    // Structure: { chatId: { messageId: { ...messageData } } }
    this.messages = {};
  }

  saveMessage(platform, chatId, messageId, messageData) {
    if (!this.messages[platform]) this.messages[platform] = {};
    if (!this.messages[platform][chatId]) this.messages[platform][chatId] = {};
    
    // Check if it's a real message (has content or media)
    const isRealMessage = messageData.message && !messageData.message.protocolMessage;
    
    // Only save if it's a real message
    if (isRealMessage) {
      this.messages[platform][chatId][messageId] = messageData;
    }
  }

  // Map-based getMessage for compatibility with Baileys getMessage
  getMessage(platform, chatId, messageId) {
    // Support both object and Map storage (for future-proofing)
    const platformStore = this.messages[platform];
    if (!platformStore) return null;
    const chatStore = platformStore[chatId];
    if (!chatStore) return null;
    return chatStore[messageId] || null;
  }

  getAllMessages(platform, chatId) {
    return this.messages[platform]?.[chatId] || {};
  }

  deleteMessage(platform, chatId, messageId) {
    if (this.messages[platform]?.[chatId]) {
      delete this.messages[platform][chatId][messageId];
    }
  }

  // Add memory management methods here (cleanup, disk save/load, etc.)

  /**
   * Smart memory management: prune old/unimportant messages if system memory is low.
   * Keeps recent and media messages, prunes oldest first.
   */
  async smartCleanup({ minFreeMB = 200, minFreePercent = 10, keepRecent = 1000 } = {}) {
    const os = await import('os');
    const freeMem = os.default.freemem();
    const totalMem = os.default.totalmem();
    const freeMB = freeMem / 1024 / 1024;
    const freePercent = (freeMem / totalMem) * 100;
    if (freeMB > minFreeMB && freePercent > minFreePercent) return; // No cleanup needed

    let pruned = 0;
    for (const platform of Object.keys(this.messages)) {
      for (const chatId of Object.keys(this.messages[platform])) {
        const chatStore = this.messages[platform][chatId];
        // Sort messages by timestamp (oldest first)
        const entries = Object.entries(chatStore)
          .map(([id, msg]) => ({ id, ...msg }))
          .sort((a, b) => (a.messageTimestamp || 0) - (b.messageTimestamp || 0));
        // Keep the most recent N messages, and always keep media
        let kept = 0;
        for (const entry of entries) {
          const isMedia = entry.message && (
            entry.message.imageMessage ||
            entry.message.videoMessage ||
            entry.message.audioMessage ||
            entry.message.documentMessage ||
            entry.message.stickerMessage
          );
          if (kept < keepRecent || isMedia) {
            kept++;
            continue;
          }
          // Prune this message
          delete this.messages[platform][chatId][entry.id];
          pruned++;
        }
      }
    }
    if (pruned > 0) {
      console.log(`[MemoryStore] Pruned ${pruned} old/unimportant messages to free memory. Free: ${freeMB.toFixed(2)}MB (${freePercent.toFixed(2)}%)`);
    }
  }
}

// Periodically run smartCleanup every 60 seconds
setInterval(() => {
  memoryStore.smartCleanup().catch(() => {});
}, 60000);

const memoryStore = new MemoryStore();
export default memoryStore;
