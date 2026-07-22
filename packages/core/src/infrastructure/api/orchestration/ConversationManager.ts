/**
 * Conversation Manager - Application Layer
 * Manages multi-turn conversation state for AI tools
 */

import { LogSink } from '@/platform';
import { OpenRouterMessage } from '@providers/OpenRouterClient';
import { ContextBudgetSnapshot, ContextSourceEntry } from '@shared/types';

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
  /**
   * Agent-fetched manifest rows committed beside contextBudget (Sprint 12
   * Phase 7): what this conversation is carrying. Same lifecycle — written
   * only after an atomic turn commit, cleared with reset/delete.
   */
  contextSources?: ContextSourceEntry[];
  /**
   * Monotonic mint for agent-fetched artifact ids (`art-N`, ADR 2026-07-18).
   * Never reused within a conversation — cancelled turns may skip numbers,
   * which keeps ids stable without densifying them.
   */
  nextArtifactNumber?: number;
}

/**
 * One entry in a between-run system-message replacement batch (ADR
 * 2026-07-20): the retained conversation to retarget and the fully assembled
 * system prompt it carries from the next run onward.
 */
export interface ConversationSystemMessageReplacement {
  conversationId: string;
  systemMessage: string;
}

/**
 * Supersede identity for a manifest row: re-delivering the same canonical
 * resource (or same-kind/same-label item) REPLACES its entry instead of
 * duplicating it (Sprint 12 Phase 7).
 */
const contextSourceKey = (entry: ContextSourceEntry): string =>
  `${entry.kind}${entry.origin}${entry.configuredResource
    ? `${entry.configuredResource.group}:${entry.configuredResource.path}`
    : `label:${entry.label}`}`;

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
    conversation.contextSources = undefined;
    conversation.lastActivity = Date.now();
  }

  /**
   * Replace each listed conversation's retained system message as one atomic
   * batch (ADR 2026-07-20). A mode change swaps the system prompt of the host
   * and every live persona guest between runs, so the complete batch is
   * validated before any conversation changes — a bad final entry leaves
   * every earlier entry's system message, history, and context snapshot
   * exactly as they were. An empty batch is a valid no-op.
   *
   * Application builds a new messages array around a new system entry rather
   * than mutating the old object, so copies handed out by getMessages keep
   * showing the content their turns actually ran against. contextBudget is
   * cleared because it was measured against the previous system prompt;
   * conversation ids, pinning, committed non-system history, and monotonic
   * artifact numbering all survive the swap.
   */
  replaceSystemMessages(replacements: readonly ConversationSystemMessageReplacement[]): void {
    const seen = new Set<string>();
    for (const { conversationId, systemMessage } of replacements) {
      if (seen.has(conversationId)) {
        throw new Error(`Duplicate conversation ${conversationId} in system-message replacement batch`);
      }
      seen.add(conversationId);
      const conversation = this.conversations.get(conversationId);
      if (!conversation) {
        throw new ConversationNotFoundError(conversationId);
      }
      if (!systemMessage.trim()) {
        throw new Error(`Blank replacement system message for conversation ${conversationId}`);
      }
      // The primitive only ever swaps a sole leading system entry. Any other
      // shape — missing, displaced, or duplicated system message — is
      // corrupted state this method fails closed on rather than silently
      // repairing into something no run has ever seen.
      const messages = conversation.messages;
      const holdsSoleLeadingSystemMessage =
        messages.length > 0 &&
        messages[0].role === 'system' &&
        !messages.some((message, index) => index > 0 && message.role === 'system');
      if (!holdsSoleLeadingSystemMessage) {
        throw new Error(`Conversation ${conversationId} does not hold a sole leading system message`);
      }
    }

    for (const { conversationId, systemMessage } of replacements) {
      const conversation = this.conversations.get(conversationId)!;
      conversation.messages = [
        { role: 'system', content: systemMessage },
        ...conversation.messages.slice(1)
      ];
      conversation.contextBudget = undefined;
      conversation.lastActivity = Date.now();
    }
  }

  /**
   * Commit agent-fetched manifest rows for an atomically committed turn
   * (Sprint 12 Phase 7). Re-delivered canonical resources replace their
   * prior row. Callers commit only after history commits — a cancelled turn
   * never reaches this, so the prior manifest survives it.
   */
  appendContextSources(conversationId: string, entries: readonly ContextSourceEntry[]): void {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new ConversationNotFoundError(conversationId);
    }
    conversation.contextSources ??= [];
    for (const entry of entries) {
      const key = contextSourceKey(entry);
      const existingIndex = conversation.contextSources.findIndex(
        (existing) => contextSourceKey(existing) === key
      );
      const stored = {
        ...entry,
        configuredResource: entry.configuredResource ? { ...entry.configuredResource } : undefined
      };
      if (existingIndex === -1) {
        conversation.contextSources.push(stored);
      } else {
        conversation.contextSources[existingIndex] = stored;
      }
    }
  }

  getContextSources(conversationId: string | undefined): ContextSourceEntry[] {
    if (!conversationId) return [];
    return (this.conversations.get(conversationId)?.contextSources ?? []).map((entry) => ({
      ...entry,
      configuredResource: entry.configuredResource ? { ...entry.configuredResource } : undefined
    }));
  }

  /**
   * Mint the next stable agent-artifact id for evidence injected into this
   * conversation (ADR 2026-07-18). Ids address stored entries for the Phase 7
   * manifest and future tombstone surgery; indices shift, ids never do.
   */
  nextArtifactId(conversationId: string): string {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new ConversationNotFoundError(conversationId);
    }
    conversation.nextArtifactNumber = (conversation.nextArtifactNumber ?? 0) + 1;
    return `art-${conversation.nextArtifactNumber}`;
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
