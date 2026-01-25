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
}

const memoryStore = new MemoryStore();
export default memoryStore;
