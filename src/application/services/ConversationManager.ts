/**
 * Conversation Manager - Application Layer
 * Manages multi-turn conversation state for AI tools
 */

import { OpenRouterMessage } from '../../infrastructure/api/OpenRouterClient';

export interface ConversationContext {
  toolName: string;
  messages: OpenRouterMessage[];
  lastActivity: number;
}

export class ConversationManager {
  private conversations: Map<string, ConversationContext> = new Map();
  private nextId = 1;

  /**
   * Start a new conversation with a system message
   * @returns conversationId
   */
  startConversation(toolName: string, systemMessage: string): string {
    const conversationId = `${toolName}-${this.nextId++}-${Date.now()}`;

    this.conversations.set(conversationId, {
      toolName,
      messages: [
        {
          role: 'system',
          content: systemMessage
        }
      ],
      lastActivity: Date.now()
    });

    return conversationId;
  }

  /**
   * Add a message to an existing conversation
   */
  addMessage(conversationId: string, message: OpenRouterMessage): void {
    const conversation = this.conversations.get(conversationId);

    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    conversation.messages.push(message);
    conversation.lastActivity = Date.now();
  }

  /**
   * Get all messages for a conversation
   */
  getMessages(conversationId: string): OpenRouterMessage[] {
    const conversation = this.conversations.get(conversationId);

    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    return [...conversation.messages]; // Return copy to prevent external mutation
  }

  /**
   * Reset a conversation (clear all messages except system)
   */
  resetConversation(conversationId: string): void {
    const conversation = this.conversations.get(conversationId);

    if (!conversation) {
      return; // No-op if conversation doesn't exist
    }

    // Keep only the system message (first message)
    conversation.messages = conversation.messages.slice(0, 1);
    conversation.lastActivity = Date.now();
  }

  /**
   * Delete a conversation entirely
   */
  deleteConversation(conversationId: string): void {
    this.conversations.delete(conversationId);
  }

  /**
   * Clear old conversations that haven't been active recently
   * @param maxAgeMs Maximum age in milliseconds (default: 5 minutes)
   */
  clearOldConversations(maxAgeMs: number = 300000): void {
    const now = Date.now();
    const idsToDelete: string[] = [];

    for (const [id, conversation] of this.conversations) {
      if (now - conversation.lastActivity > maxAgeMs) {
        idsToDelete.push(id);
      }
    }

    for (const id of idsToDelete) {
      this.conversations.delete(id);
    }

    if (idsToDelete.length > 0) {
      console.log(`Cleared ${idsToDelete.length} old conversation(s)`);
    }
  }

  /**
   * Get total number of active conversations
   */
  getActiveConversationCount(): number {
    return this.conversations.size;
  }

  /**
   * Get conversation metadata (without messages)
   */
  getConversationInfo(conversationId: string): { toolName: string; messageCount: number; lastActivity: number } | null {
    const conversation = this.conversations.get(conversationId);

    if (!conversation) {
      return null;
    }

    return {
      toolName: conversation.toolName,
      messageCount: conversation.messages.length,
      lastActivity: conversation.lastActivity
    };
  }
}
