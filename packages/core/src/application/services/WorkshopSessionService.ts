/**
 * WorkshopSessionService — Application layer (ADR 2026-07-03, Sprint 2).
 *
 * The host-side session aggregate for the Workshop editor tab: pinned excerpt
 * (+ source metadata), context-brief reference (seeded in Sprint 3), the
 * ordered turn thread, and the in-flight run. Session state lives HERE, never
 * in React — the webview renders snapshots and increments, so a reload or
 * reopen rehydrates the thread from this object (the ADR's reload-safety
 * criterion). Constructed once in extension.ts and shared through the
 * CoreServices bundle so it outlives any single webview's MessageHandler.
 *
 * Pure and dependency-free (an injectable clock is the only seam, for tests):
 * no vscode, no React, no I/O. WorkshopHandler owns messaging and streaming;
 * this class owns nothing but session truth.
 *
 * Sprint 2 is single-turn: begin/complete each describe one tool run. The
 * multi-turn continuation seam (ConversationManager) arrives in Sprint 3.
 */

import {
  WorkshopExcerpt,
  WorkshopSessionSnapshot,
  WorkshopToolId,
  WorkshopTurn
} from '@messages';
import { TokenUsage } from '@shared/types';
import { workshopToolLabel } from '@shared/constants/workshopTools';

export interface WorkshopExcerptInput {
  text: string;
  sourceUri?: string;
  relativePath?: string;
}

export class WorkshopSessionService {
  private excerpt?: WorkshopExcerpt;
  private contextBrief?: string;
  private turns: WorkshopTurn[] = [];
  private activeRun?: { requestId: string; toolId: WorkshopToolId };
  private turnCounter = 0;

  constructor(private readonly now: () => number = Date.now) {}

  /** Pin (or replace) the working excerpt. Host stamps the pin time. */
  setExcerpt(input: WorkshopExcerptInput): WorkshopExcerpt {
    this.excerpt = {
      text: input.text,
      sourceUri: input.sourceUri,
      relativePath: input.relativePath,
      pinnedAt: this.now()
    };
    return { ...this.excerpt };
  }

  getExcerpt(): WorkshopExcerpt | undefined {
    return this.excerpt ? { ...this.excerpt } : undefined;
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
    this.activeRun = { requestId, toolId };
    return cloneTurn(turn);
  }

  /**
   * Record a finished run: appends the assistant turn and clears the active
   * run. Returns undefined for a stale requestId (the session was reset or the
   * run preempted mid-stream) — the aggregate silently refuses turns that no
   * longer belong to it.
   */
  completeToolRun(
    requestId: string,
    content: string,
    usage?: TokenUsage,
    truncated?: boolean
  ): WorkshopTurn | undefined {
    if (this.activeRun?.requestId !== requestId) {
      return undefined;
    }
    const { toolId } = this.activeRun;
    this.activeRun = undefined;
    const turn: WorkshopTurn = {
      id: this.nextTurnId('assistant'),
      role: 'assistant',
      kind: 'tool_run',
      toolId,
      toolLabel: workshopToolLabel(toolId),
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
   * No-op for a stale requestId.
   */
  abandonToolRun(requestId: string): void {
    if (this.activeRun?.requestId === requestId) {
      this.activeRun = undefined;
    }
  }

  /**
   * Start a fresh session: clears the thread and any active run. The pinned
   * excerpt survives — "New session" means a clean thread over the same
   * working text (the acceptance criterion clears thread + active tool only);
   * re-pinning replaces the excerpt explicitly.
   */
  reset(): void {
    this.turns = [];
    this.activeRun = undefined;
    this.contextBrief = undefined;
  }

  /** Deep-enough copy of the aggregate for the webview to render from. */
  getSnapshot(): WorkshopSessionSnapshot {
    return {
      excerpt: this.excerpt ? { ...this.excerpt } : undefined,
      contextBrief: this.contextBrief,
      turns: this.turns.map(cloneTurn),
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
