/**
 * Conversation Manager - Application Layer
 * Manages multi-turn conversation state for AI tools
 */

import { LogSink } from '@/platform';
import { OpenRouterMessage } from '@providers/OpenRouterClient';
import { ContextBudgetSnapshot } from '@shared/types';

/**
 * Thrown when a caller references a conversation id this manager no longer
 * holds — typically after a config change rebuilt the AI resources (each
 * rebuild gets a fresh manager) or an explicit delete. Multi-turn callers
 * (WorkshopHandler) catch this by name to surface an honest "conversation
 * expired" message instead of silently cold-restarting.
 */
export class ConversationNotFoundError extends Error {
  constructor(conversationId: string) {
    super(`Conversation ${conversationId} not found`);
    this.name = 'ConversationNotFoundError';
  }
}

export interface ConversationContext {
  toolName: string;
  messages: OpenRouterMessage[];
  lastActivity: number;
  /** Pinned conversations survive clearOldConversations (multi-turn sessions). */
  pinned?: boolean;
  /** Provider-measured context after the latest atomically committed turn. */
  contextBudget?: ContextBudgetSnapshot;
}

export class ConversationManager {
  private conversations: Map<string, ConversationContext> = new Map();
  private nextId = 1;

  constructor(private readonly log?: LogSink) {}

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
      throw new ConversationNotFoundError(conversationId);
    }

    conversation.messages.push(message);
    conversation.lastActivity = Date.now();
  }

  /**
   * Commit one completed user turn atomically from the engine's working
   * transcript. No message from a cancelled or failed turn reaches history.
   */
  addMessages(conversationId: string, messages: readonly OpenRouterMessage[]): void {
    const conversation = this.conversations.get(conversationId);

    if (!conversation) {
      throw new ConversationNotFoundError(conversationId);
    }

    conversation.messages.push(...messages);
    conversation.lastActivity = Date.now();
  }

  /**
   * Get all messages for a conversation
   */
  getMessages(conversationId: string): OpenRouterMessage[] {
    const conversation = this.conversations.get(conversationId);

    if (!conversation) {
      throw new ConversationNotFoundError(conversationId);
    }

    return [...conversation.messages]; // Return copy to prevent external mutation
  }

  /**
   * Exempt a conversation from idle cleanup. A multi-turn session (Workshop)
   * outlives the 5-minute reaper window by design — the user is thinking, not
   * gone. Explicit deleteConversation always works regardless of pinning.
   */
  pinConversation(conversationId: string): void {
    const conversation = this.conversations.get(conversationId);

    if (!conversation) {
      throw new ConversationNotFoundError(conversationId);
    }

    conversation.pinned = true;
  }

  /**
   * True when the id names a conversation this manager currently holds.
   */
  hasConversation(conversationId: string): boolean {
    return this.conversations.has(conversationId);
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
    conversation.contextBudget = undefined;
    conversation.lastActivity = Date.now();
  }

  /** Store provider-measured context only after its matching turn commits. */
  setContextBudget(conversationId: string, snapshot: ContextBudgetSnapshot): void {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new ConversationNotFoundError(conversationId);
    }
    conversation.contextBudget = { ...snapshot };
  }

  getContextBudget(conversationId: string | undefined): ContextBudgetSnapshot | undefined {
    if (!conversationId) return undefined;
    const snapshot = this.conversations.get(conversationId)?.contextBudget;
    return snapshot ? { ...snapshot } : undefined;
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
  clearOldConversations(maxAgeMs: number = 300000): string[] {
    const now = Date.now();
    const idsToDelete: string[] = [];

    for (const [id, conversation] of this.conversations) {
      if (!conversation.pinned && now - conversation.lastActivity > maxAgeMs) {
        idsToDelete.push(id);
      }
    }

    for (const id of idsToDelete) {
      this.conversations.delete(id);
    }

    if (idsToDelete.length > 0) {
      this.log?.appendLine(`[ConversationManager] Cleared ${idsToDelete.length} old conversation(s)`);
    }
    return idsToDelete;
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
