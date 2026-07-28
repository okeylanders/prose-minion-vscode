/**
 * Conversation Manager - Application Layer
 * Manages multi-turn conversation state for AI tools
 */

import { LogSink } from '@/platform';
import { OpenRouterMessage } from '@providers/OpenRouterClient';
import {
  ContextBudgetSnapshot,
  ContextSourceEntry,
  isContextPathGroup
} from '@shared/types';
import { randomUUID } from 'node:crypto';

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

/** Provider-neutral committed history stored without its replaceable system prompt. */
export interface ArchivedConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * One V1 retained conversation addressed by an application-owned logical key.
 * Runtime conversation ids and the leading system prompt are deliberately
 * absent: import mints a fresh id and receives a current rebuilt prompt.
 */
export interface ConversationArchiveEntryV1<K extends string = string> {
  key: K;
  toolName: string;
  messages: ArchivedConversationMessage[];
  lastActivity: number;
  contextSources: ContextSourceEntry[];
  nextArtifactNumber: number;
}

export interface ConversationExportTarget<K extends string = string> {
  key: K;
  conversationId: string;
}

export interface ConversationImportTarget<K extends string = string> {
  entry: ConversationArchiveEntryV1<K>;
  systemMessage: string;
}

export type ConversationImportOutcome<K extends string = string> =
  | { key: K; status: 'imported'; conversationId: string }
  | { key: K; status: 'degraded'; reason: string };

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
    const conversationId = this.createConversationId(toolName);

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
   * Snapshot a coherent set of committed conversations. Any invalid target
   * rejects the whole export: callers must never persist a deceptively
   * partial room. The leading system entry is validated and excluded.
   */
  exportConversations<K extends string>(
    targets: readonly ConversationExportTarget<K>[]
  ): ConversationArchiveEntryV1<K>[] {
    const seenKeys = new Set<string>();
    const seenConversationIds = new Set<string>();
    return targets.map(({ key, conversationId }) => {
      if (!key.trim()) {
        throw new Error('Conversation export key cannot be blank');
      }
      if (seenKeys.has(key)) {
        throw new Error(`Duplicate conversation export key: ${key}`);
      }
      if (seenConversationIds.has(conversationId)) {
        throw new Error(`Conversation ${conversationId} appears more than once in export`);
      }
      seenKeys.add(key);
      seenConversationIds.add(conversationId);

      const conversation = this.conversations.get(conversationId);
      if (!conversation) {
        throw new ConversationNotFoundError(conversationId);
      }
      this.assertCommittedMessageShape(conversation.messages, `conversation ${conversationId}`);

      return {
        key,
        toolName: conversation.toolName,
        messages: conversation.messages.slice(1).map((message) => ({
          role: message.role as ArchivedConversationMessage['role'],
          content: message.content
        })),
        lastActivity: conversation.lastActivity,
        contextSources: cloneContextSources(conversation.contextSources ?? []),
        nextArtifactNumber: conversation.nextArtifactNumber ?? 0
      };
    });
  }

  /**
   * Restore every independently valid archive entry with a fresh runtime id.
   * Candidates are all validated before any valid entry is installed; one bad
   * participant degrades locally without poisoning its siblings.
   */
  importConversations<K extends string>(
    targets: readonly ConversationImportTarget<K>[]
  ): ConversationImportOutcome<K>[] {
    const duplicateKeys = duplicateValues(targets.map(({ entry }) => entry.key));
    const candidates: Array<{
      key: K;
      conversationId: string;
      context: ConversationContext;
    }> = [];
    const outcomes: ConversationImportOutcome<K>[] = [];

    for (const { entry, systemMessage } of targets) {
      try {
        if (duplicateKeys.has(entry.key)) {
          throw new Error(`Duplicate conversation import key: ${entry.key}`);
        }
        this.validateArchiveEntry(entry, systemMessage);
        const conversationId = this.createConversationId(entry.toolName);
        candidates.push({
          key: entry.key,
          conversationId,
          context: {
            toolName: entry.toolName,
            messages: [
              { role: 'system', content: systemMessage },
              ...entry.messages.map((message) => ({ ...message }))
            ],
            lastActivity: entry.lastActivity,
            pinned: true,
            contextSources: cloneContextSources(entry.contextSources),
            nextArtifactNumber: entry.nextArtifactNumber
          }
        });
      } catch (error) {
        outcomes.push({
          key: entry.key,
          status: 'degraded',
          reason: error instanceof Error ? error.message : String(error)
        });
      }
    }

    for (const candidate of candidates) {
      this.conversations.set(candidate.conversationId, candidate.context);
      outcomes.push({
        key: candidate.key,
        status: 'imported',
        conversationId: candidate.conversationId
      });
    }

    const outcomeByKey = new Map(outcomes.map((outcome) => [outcome.key, outcome]));
    return targets.map(({ entry }) => outcomeByKey.get(entry.key) ?? {
      key: entry.key,
      status: 'degraded',
      reason: `Conversation ${entry.key} was not imported`
    });
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

  private createConversationId(toolName: string): string {
    return `${toolName}-${this.nextId++}-${Date.now()}-${randomUUID()}`;
  }

  private validateArchiveEntry<K extends string>(
    entry: ConversationArchiveEntryV1<K>,
    systemMessage: string
  ): void {
    if (!entry.key.trim()) {
      throw new Error('Conversation import key cannot be blank');
    }
    if (!entry.toolName.trim()) {
      throw new Error(`Conversation ${entry.key} has a blank tool name`);
    }
    if (!systemMessage.trim()) {
      throw new Error(`Conversation ${entry.key} has a blank rebuilt system message`);
    }
    if (!Number.isFinite(entry.lastActivity) || entry.lastActivity < 0) {
      throw new Error(`Conversation ${entry.key} has invalid last activity`);
    }
    if (!Number.isInteger(entry.nextArtifactNumber) || entry.nextArtifactNumber < 0) {
      throw new Error(`Conversation ${entry.key} has an invalid artifact counter`);
    }
    this.assertArchivedMessageShape(entry.messages, `conversation ${entry.key}`);
    this.validateContextSources(entry.contextSources, entry.key);
    const highestArtifactNumber = Math.max(
      0,
      ...entry.messages.flatMap(({ content }) => artifactNumbers(content)),
      ...entry.contextSources.flatMap(({ artifactId }) =>
        artifactId ? artifactNumbers(artifactId) : []
      )
    );
    if (entry.nextArtifactNumber < highestArtifactNumber) {
      throw new Error(
        `Conversation ${entry.key} artifact counter ${entry.nextArtifactNumber} is below retained art-${highestArtifactNumber}`
      );
    }
  }

  private assertCommittedMessageShape(
    messages: readonly OpenRouterMessage[],
    label: string
  ): void {
    const hasSoleLeadingSystem =
      messages.length > 0 &&
      messages[0].role === 'system' &&
      !messages.some((message, index) => index > 0 && message.role === 'system');
    if (!hasSoleLeadingSystem) {
      throw new Error(`${label} does not hold a sole leading system message`);
    }
    this.assertArchivedMessageShape(messages.slice(1), label);
  }

  private assertArchivedMessageShape(
    messages: readonly Pick<OpenRouterMessage, 'role' | 'content'>[],
    label: string
  ): void {
    if (messages.length === 0 || messages.length % 2 !== 0) {
      throw new Error(`${label} does not contain complete committed user/assistant exchanges`);
    }
    messages.forEach((message, index) => {
      const expectedRole = index % 2 === 0 ? 'user' : 'assistant';
      if (message.role !== expectedRole) {
        throw new Error(`${label} has ${message.role} at message ${index}; expected ${expectedRole}`);
      }
      if (typeof message.content !== 'string') {
        throw new Error(`${label} has non-string content at message ${index}`);
      }
    });
  }

  private validateContextSources<K extends string>(
    sources: readonly ContextSourceEntry[],
    key: K
  ): void {
    if (!Array.isArray(sources)) {
      throw new Error(`Conversation ${key} has invalid context sources`);
    }
    const kinds = new Set(['pin', 'attachment', 'message-attachment', 'resource', 'tool-evidence', 'dictionary']);
    const origins = new Set(['writer', 'host', 'tool']);
    sources.forEach((source, index) => {
      if (
        !source ||
        !kinds.has(source.kind) ||
        !origins.has(source.origin) ||
        typeof source.label !== 'string' ||
        !Number.isInteger(source.sizeChars) ||
        source.sizeChars < 0 ||
        typeof source.isEstimate !== 'boolean' ||
        !Number.isInteger(source.deliveredAt) ||
        source.deliveredAt < 0 ||
        (source.stale !== undefined && typeof source.stale !== 'boolean') ||
        (source.artifactId !== undefined && !/^art-[1-9]\d*$/.test(source.artifactId)) ||
        (source.promptTokensDelta !== undefined &&
          (!Number.isInteger(source.promptTokensDelta) || source.promptTokensDelta < 0)) ||
        (source.excerptVersion !== undefined &&
          (!Number.isInteger(source.excerptVersion) || source.excerptVersion < 0))
      ) {
        throw new Error(`Conversation ${key} has invalid context source ${index}`);
      }
      if (source.configuredResource && (
        !isContextPathGroup(source.configuredResource.group) ||
        typeof source.configuredResource.path !== 'string' ||
        !source.configuredResource.path.trim()
      )) {
        throw new Error(`Conversation ${key} has invalid configured resource ${index}`);
      }
    });
  }
}

const cloneContextSources = (
  sources: readonly ContextSourceEntry[]
): ContextSourceEntry[] => sources.map((entry) => ({
  ...entry,
  configuredResource: entry.configuredResource ? { ...entry.configuredResource } : undefined
}));

const duplicateValues = <T>(values: readonly T[]): Set<T> => {
  const seen = new Set<T>();
  const duplicates = new Set<T>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return duplicates;
};

const artifactNumbers = (value: string): number[] =>
  [...value.matchAll(/\bart-(\d+)\b/g)].map((match) => Number(match[1]));
