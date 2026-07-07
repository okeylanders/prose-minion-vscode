/**
 * WorkshopSessionService — Application layer (ADR 2026-07-03, Sprints 2–3).
 *
 * The host-side session aggregate for the Workshop editor tab: pinned excerpt
 * (+ source metadata), context-brief reference, the ordered turn thread, the
 * in-flight run, and — since Sprint 3 — the id of the retained conversation
 * that free-text follow-ups continue. Session state lives HERE, never in
 * React — the webview renders snapshots and increments, so a reload or
 * reopen rehydrates the thread from this object (the ADR's reload-safety
 * criterion). Constructed once in extension.ts and shared through the
 * CoreServices bundle so it outlives any single webview's MessageHandler.
 *
 * Pure and dependency-free (an injectable clock is the only seam, for tests):
 * no vscode, no React, no I/O. This class holds the conversation ID only —
 * the conversation itself lives in the assistant orchestrator's
 * ConversationManager, and WorkshopHandler mediates between the two (it
 * discards replaced/reset conversations through AssistantToolService).
 *
 * Conversation policy (Sprint 3): the session's conversation follows the
 * LAST SUCCESSFUL TOOL RUN. Each tool run retains a fresh conversation
 * (tool system prompts must not cross-contaminate); follow-ups continue it;
 * reset clears it. Adoption happens atomically in completeRun — a cancelled,
 * failed, or zombie run never replaces the conversation.
 */

import {
  WorkshopExcerpt,
  WorkshopExcerptTruncation,
  WorkshopSessionSnapshot,
  WorkshopToolId,
  WorkshopTurn,
  WorkshopTurnKind
} from '@messages';
import { TokenUsage } from '@shared/types';
import { workshopToolLabel } from '@shared/constants/workshopTools';

export interface WorkshopExcerptInput {
  text: string;
  sourceUri?: string;
  relativePath?: string;
  truncation?: WorkshopExcerptTruncation;
}

/**
 * Snapshot turn window (PR #67 review #12, Tim): a snapshot ships at most
 * this many most-recent turns, so the per-mutation broadcast payload is
 * bounded no matter how long a multi-turn thread grows. Older turns stay
 * host-side and are reported via `truncatedTurns`; live WORKSHOP_TURN
 * increments are unaffected.
 */
export const WORKSHOP_SNAPSHOT_TURN_WINDOW = 100;

interface ActiveRun {
  requestId: string;
  kind: WorkshopTurnKind;
  /** Set for tool runs; absent for free-text message runs. */
  toolId?: WorkshopToolId;
}

export class WorkshopSessionService {
  private excerpt?: WorkshopExcerpt;
  private contextBrief?: string;
  private turns: WorkshopTurn[] = [];
  private activeRun?: ActiveRun;
  private conversationId?: string;
  private selectedToolId?: WorkshopToolId;
  private turnCounter = 0;

  constructor(private readonly now: () => number = Date.now) {}

  /** Pin (or replace) the working excerpt. Host stamps the pin time. */
  setExcerpt(input: WorkshopExcerptInput): WorkshopExcerpt {
    this.excerpt = {
      text: input.text,
      sourceUri: input.sourceUri,
      relativePath: input.relativePath,
      truncation: input.truncation ? { ...input.truncation } : undefined,
      pinnedAt: this.now()
    };
    return cloneExcerpt(this.excerpt);
  }

  getExcerpt(): WorkshopExcerpt | undefined {
    return this.excerpt ? cloneExcerpt(this.excerpt) : undefined;
  }

  /** Id of the retained conversation follow-ups continue, if any. */
  getConversationId(): string | undefined {
    return this.conversationId;
  }

  /**
   * Drop the conversation reference (e.g. the handler learned the underlying
   * conversation no longer exists after a config change). Returns the old id
   * so the caller can discard the conversation itself where one still exists.
   */
  clearConversation(): string | undefined {
    const previous = this.conversationId;
    this.conversationId = undefined;
    return previous;
  }

  /**
   * Record the start of a tool run: appends the deterministic user turn and
   * marks the run active. Throws when no usable excerpt is pinned — the
   * aggregate refuses to represent a run against nothing.
   */
  beginToolRun(toolId: WorkshopToolId, requestId: string): WorkshopTurn {
    if (!this.excerpt || this.excerpt.text.trim().length === 0) {
      throw new Error('Cannot run a Workshop tool without a pinned excerpt');
    }
    const toolLabel = workshopToolLabel(toolId);
    this.selectedToolId = toolId;
    const turn: WorkshopTurn = {
      id: this.nextTurnId('user'),
      role: 'user',
      kind: 'tool_run',
      toolId,
      toolLabel,
      content: `Run **${toolLabel}** on the pinned excerpt.`,
      timestamp: this.now()
    };
    this.turns.push(turn);
    this.activeRun = { requestId, kind: 'tool_run', toolId };
    return cloneTurn(turn);
  }

  /**
   * Record the start of a free-text follow-up: appends the user's message
   * turn and marks the run active. Throws without a retained conversation —
   * a follow-up needs something to follow.
   */
  beginMessageRun(text: string, requestId: string, displayText = text): WorkshopTurn {
    if (!this.conversationId) {
      throw new Error('Cannot send a Workshop follow-up without an active conversation');
    }
    const turn: WorkshopTurn = {
      id: this.nextTurnId('user'),
      role: 'user',
      kind: 'message',
      content: displayText,
      timestamp: this.now()
    };
    this.turns.push(turn);
    this.activeRun = { requestId, kind: 'message' };
    return cloneTurn(turn);
  }

  /**
   * Record a finished run: appends the assistant turn (shaped by the run's
   * kind) and clears the active run. When `conversationId` is provided (a
   * successful tool run that retained its conversation), the session adopts
   * it — the caller is responsible for discarding any replaced conversation.
   * Returns undefined for a stale requestId (the session was reset or the run
   * preempted mid-stream) — the aggregate silently refuses turns that no
   * longer belong to it, and never adopts their conversations.
   */
  completeRun(
    requestId: string,
    content: string,
    usage?: TokenUsage,
    truncated?: boolean,
    conversationId?: string
  ): WorkshopTurn | undefined {
    if (this.activeRun?.requestId !== requestId) {
      return undefined;
    }
    const { kind, toolId } = this.activeRun;
    this.activeRun = undefined;
    if (conversationId) {
      this.conversationId = conversationId;
    }
    const turn: WorkshopTurn = {
      id: this.nextTurnId('assistant'),
      role: 'assistant',
      kind,
      toolId,
      toolLabel: toolId ? workshopToolLabel(toolId) : undefined,
      content,
      timestamp: this.now(),
      usage: usage ? { ...usage } : undefined,
      truncated: truncated || undefined
    };
    this.turns.push(turn);
    return cloneTurn(turn);
  }

  /**
   * Clear the active run without an assistant turn (cancelled, preempted, or
   * failed). The user turn stays — the thread honestly records the attempt.
   * The conversation reference is untouched: it still points at the last
   * completed exchange. No-op for a stale requestId.
   */
  abandonRun(requestId: string): void {
    if (this.activeRun?.requestId === requestId) {
      this.activeRun = undefined;
    }
  }

  /**
   * Start a fresh session: clears the thread, any active run, and the
   * conversation reference (returned so the caller can discard the
   * conversation itself). The pinned excerpt survives — "New session" means
   * a clean thread over the same working text; re-pinning replaces the
   * excerpt explicitly.
   */
  reset(): string | undefined {
    this.turns = [];
    this.activeRun = undefined;
    this.contextBrief = undefined;
    this.selectedToolId = undefined;
    return this.clearConversation();
  }

  /**
   * Deep-enough copy of the aggregate for the webview to render from. Turns
   * are windowed to the most recent WORKSHOP_SNAPSHOT_TURN_WINDOW entries
   * (PR #67 review #12) — `totalTurns`/`truncatedTurns` tell the webview
   * what was left out so it can merge instead of shrinking a live thread.
   */
  getSnapshot(): WorkshopSessionSnapshot {
    const windowed = this.turns.slice(-WORKSHOP_SNAPSHOT_TURN_WINDOW);
    return {
      excerpt: this.excerpt ? cloneExcerpt(this.excerpt) : undefined,
      contextBrief: this.contextBrief,
      turns: windowed.map(cloneTurn),
      totalTurns: this.turns.length,
      truncatedTurns: this.turns.length - windowed.length,
      hasConversation: this.conversationId !== undefined,
      selectedToolId: this.selectedToolId,
      activeToolId: this.activeRun?.toolId,
      activeRequestId: this.activeRun?.requestId
    };
  }

  private nextTurnId(role: 'user' | 'assistant'): string {
    return `turn-${++this.turnCounter}-${role}-${this.now()}`;
  }
}

/** Copy deep enough that no caller-held reference can reach stored state. */
function cloneTurn(turn: WorkshopTurn): WorkshopTurn {
  return { ...turn, usage: turn.usage ? { ...turn.usage } : undefined };
}

function cloneExcerpt(excerpt: WorkshopExcerpt): WorkshopExcerpt {
  return { ...excerpt, truncation: excerpt.truncation ? { ...excerpt.truncation } : undefined };
}
