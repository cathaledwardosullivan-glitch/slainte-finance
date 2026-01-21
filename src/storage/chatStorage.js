/**
 * Chat Storage for Financial Chat (Finn)
 * Manages conversation history, grouping, and persistence
 */

const CHATS_KEY = 'ciaran_chats';
const CURRENT_CHAT_KEY = 'ciaran_current_chat_id';

export const chatStorage = {
  /**
   * Get all chats
   * @returns {Array} Array of chat objects
   */
  getAllChats() {
    try {
      const data = localStorage.getItem(CHATS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error reading chats:', error);
      return [];
    }
  },

  /**
   * Get a specific chat by ID
   * @param {string} chatId - Chat ID
   * @returns {Object|null} Chat object or null
   */
  getChat(chatId) {
    const chats = this.getAllChats();
    return chats.find(chat => chat.id === chatId) || null;
  },

  /**
   * Get current active chat ID
   * @returns {string|null} Current chat ID
   */
  getCurrentChatId() {
    return localStorage.getItem(CURRENT_CHAT_KEY);
  },

  /**
   * Set current active chat
   * @param {string} chatId - Chat ID to make active
   */
  setCurrentChatId(chatId) {
    localStorage.setItem(CURRENT_CHAT_KEY, chatId);
  },

  /**
   * Create a new chat
   * @param {string} title - Optional title (auto-generated if not provided)
   * @returns {Object} New chat object
   */
  createChat(title = null) {
    const chatId = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newChat = {
      id: chatId,
      title: title || 'New Conversation',
      messages: [],
      artifacts: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_setup: false,
    };

    const chats = this.getAllChats();
    chats.unshift(newChat); // Add to beginning
    this.saveAllChats(chats);
    this.setCurrentChatId(chatId);

    return newChat;
  },

  /**
   * Update a chat
   * @param {string} chatId - Chat ID
   * @param {Object} updates - Fields to update
   */
  updateChat(chatId, updates) {
    const chats = this.getAllChats();
    const chatIndex = chats.findIndex(chat => chat.id === chatId);

    if (chatIndex === -1) return null;

    chats[chatIndex] = {
      ...chats[chatIndex],
      ...updates,
      updated_at: new Date().toISOString(),
    };

    this.saveAllChats(chats);
    return chats[chatIndex];
  },

  /**
   * Add message to chat
   * @param {string} chatId - Chat ID
   * @param {Object} message - Message object {type, content}
   */
  addMessage(chatId, message) {
    const chat = this.getChat(chatId);
    if (!chat) return null;

    chat.messages.push({
      ...message,
      timestamp: message.timestamp || new Date().toISOString(),
    });

    // Auto-generate title from first user message if still "New Conversation"
    if (chat.title === 'New Conversation' && message.type === 'user' && chat.messages.length <= 2) {
      chat.title = this.generateTitle(message.content);
    }

    return this.updateChat(chatId, chat);
  },

  /**
   * Add artifact to chat
   * @param {string} chatId - Chat ID
   * @param {Object} artifact - Artifact object
   */
  addArtifact(chatId, artifact) {
    const chat = this.getChat(chatId);
    if (!chat) return null;

    if (!chat.artifacts) chat.artifacts = [];

    const artifactWithId = {
      id: `artifact_${Date.now()}`,
      created_at: new Date().toISOString(),
      ...artifact,
    };

    chat.artifacts.push(artifactWithId);
    return this.updateChat(chatId, chat);
  },

  /**
   * Delete a chat
   * @param {string} chatId - Chat ID
   */
  deleteChat(chatId) {
    const chats = this.getAllChats();
    const filtered = chats.filter(chat => chat.id !== chatId);
    this.saveAllChats(filtered);

    // If deleting current chat, clear current chat ID
    if (this.getCurrentChatId() === chatId) {
      localStorage.removeItem(CURRENT_CHAT_KEY);
    }
  },

  /**
   * Save all chats
   */
  saveAllChats(chats) {
    try {
      localStorage.setItem(CHATS_KEY, JSON.stringify(chats));
    } catch (error) {
      console.error('Error saving chats:', error);
      // If quota exceeded, keep only last 20 chats
      if (error.name === 'QuotaExceededError') {
        const recentChats = chats.slice(0, 20);
        localStorage.setItem(CHATS_KEY, JSON.stringify(recentChats));
      }
    }
  },

  /**
   * Generate title from message content
   */
  generateTitle(content) {
    // Take first 50 chars and clean up
    let title = content.substring(0, 50).trim();
    if (content.length > 50) title += '...';

    // Remove line breaks
    title = title.replace(/\n/g, ' ');

    return title;
  },

  /**
   * Export chat history
   */
  exportChats() {
    const chats = this.getAllChats();
    const dataStr = JSON.stringify(chats, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ciaran_chats_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  },

  /**
   * Clear all chats
   */
  clearAll() {
    localStorage.removeItem(CHATS_KEY);
    localStorage.removeItem(CURRENT_CHAT_KEY);
  },

  /**
   * Migrate old chat history to new format
   */
  migrateOldHistory() {
    const oldHistory = localStorage.getItem('gp_practice_chat_history');
    if (!oldHistory) return;

    try {
      const oldMessages = JSON.parse(oldHistory);
      if (Array.isArray(oldMessages) && oldMessages.length > 0) {
        // Create a new chat with old messages
        const chat = this.createChat('Migrated Conversation');
        chat.messages = oldMessages;
        this.updateChat(chat.id, chat);

        // Remove old storage
        localStorage.removeItem('gp_practice_chat_history');
        console.log('Successfully migrated old chat history');
      }
    } catch (error) {
      console.error('Error migrating old history:', error);
    }
  }
};
