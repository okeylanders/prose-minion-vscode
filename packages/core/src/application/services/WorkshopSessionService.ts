/**
 * Host-owned Workshop session aggregate (ADR 2026-07-09, Sprint 05).
 *
 * The webview receives a defensive participant snapshot, never provider
 * conversation ids. The aggregate owns one stable persona host, the latest
 * retained sidecar for each tool, and one explicit direct-tool target.
 */

import {
  WorkshopChatTarget,
  WorkshopExcerpt,
  WorkshopExcerptTruncation,
  WorkshopPersonaId,
  WorkshopParticipantsSnapshot,
  WorkshopSessionSnapshot,
  WorkshopToolId,
  WorkshopTurn,
  WorkshopTurnKind
} from '@messages';
import { TokenUsage } from '@shared/types';
import { DEFAULT_WORKSHOP_PERSONA_ID, workshopPersonaLabel } from '@shared/constants/workshopPersonas';
import { workshopToolLabel } from '@shared/constants/workshopTools';

export interface WorkshopExcerptInput {
  text: string;
  sourceUri?: string;
  relativePath?: string;
  truncation?: WorkshopExcerptTruncation;
}

export const WORKSHOP_SNAPSHOT_TURN_WINDOW = 100;

interface WorkshopToolSidecar {
  conversationId: string;
  latestReportTurnId: string;
  deliveredToHostThroughTurnId?: string;
}

interface WorkshopParticipants {
  host: {
    personaId: WorkshopPersonaId;
    conversationId?: string;
  };
  toolSidecars: Partial<Record<WorkshopToolId, WorkshopToolSidecar>>;
  /** Undefined represents the ordinary host route. */
  directToolTarget?: WorkshopToolId;
}

interface ActiveRun {
  requestId: string;
  kind: WorkshopTurnKind;
  target: 'host' | 'tool';
  toolId?: WorkshopToolId;
}

/** A pure aggregate: no I/O, no vscode, and only an injectable clock. */
export class WorkshopSessionService {
  private excerpt?: WorkshopExcerpt;
  private contextBrief?: string;
  private turns: WorkshopTurn[] = [];
  private activeRun?: ActiveRun;
  private participants: WorkshopParticipants = this.newParticipants();
  private selectedToolId?: WorkshopToolId;
  private turnCounter = 0;

  constructor(private readonly now: () => number = Date.now) {}

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

  /** Replace the working text and invalidate every retained participant. */
  replaceExcerpt(input: WorkshopExcerptInput): string[] {
    const conversationIds = this.clearAllConversations();
    this.setExcerpt(input);
    return conversationIds;
  }

  getExcerpt(): WorkshopExcerpt | undefined {
    return this.excerpt ? cloneExcerpt(this.excerpt) : undefined;
  }

  /** Existing context loading can seed this later without leaking into React state. */
  getContextBrief(): string | undefined {
    return this.contextBrief;
  }

  getSelectedPersonaId(): WorkshopPersonaId {
    return this.participants.host.personaId;
  }

  hasHostConversation(): boolean {
    return this.participants.host.conversationId !== undefined;
  }

  getHostConversationId(): string | undefined {
    return this.participants.host.conversationId;
  }

  getChatTarget(): WorkshopChatTarget {
    return this.participants.directToolTarget
      ? { kind: 'tool', toolId: this.participants.directToolTarget }
      : { kind: 'host' };
  }

  getToolSidecarConversationId(toolId: WorkshopToolId): string | undefined {
    return this.participants.toolSidecars[toolId]?.conversationId;
  }

  isPersonaSelectionLocked(): boolean {
    return this.activeRun !== undefined || this.hasHostConversation();
  }

  /** A selected host can change only before its first run or conversation. */
  selectPersona(personaId: WorkshopPersonaId): void {
    if (this.isPersonaSelectionLocked()) {
      throw new Error('Cannot change the Workshop persona after host conversation start');
    }
    this.participants.host.personaId = personaId;
  }

  /** Host target is always valid; a tool target must name a live sidecar. */
  setChatTarget(target: WorkshopChatTarget): boolean {
    if (target.kind === 'host') {
      this.participants.directToolTarget = undefined;
      return true;
    }
    if (!this.participants.toolSidecars[target.toolId]) {
      return false;
    }
    this.participants.directToolTarget = target.toolId;
    return true;
  }

  beginToolRun(toolId: WorkshopToolId, requestId: string): WorkshopTurn {
    this.requireExcerpt();
    this.selectedToolId = toolId;
    const turn: WorkshopTurn = {
      id: this.nextTurnId('user'),
      role: 'user',
      kind: 'tool_run',
      toolId,
      toolLabel: workshopToolLabel(toolId),
      content: `Run **${workshopToolLabel(toolId)}** on the pinned excerpt.`,
      timestamp: this.now()
    };
    this.turns.push(turn);
    this.activeRun = { requestId, kind: 'tool_run', target: 'tool', toolId };
    return cloneTurn(turn);
  }

  /** Begin a normal message to the selected permanent persona host. */
  beginPersonaMessage(text: string, requestId: string, displayText = text): WorkshopTurn {
    this.requireExcerpt();
    return this.beginMessage(text, requestId, displayText, 'host');
  }

  /** Begin a direct follow-up to a retained tool sidecar. */
  beginDirectToolMessage(
    toolId: WorkshopToolId,
    text: string,
    requestId: string,
    displayText = text
  ): WorkshopTurn {
    if (!this.participants.toolSidecars[toolId]) {
      throw new Error(`Cannot message Workshop tool ${toolId} without a retained sidecar`);
    }
    return this.beginMessage(text, requestId, displayText, 'tool', toolId);
  }

  /**
   * Finish the currently active run. Adoption occurs only after the request id
   * matches, so a cancelled or zombie completion cannot replace participants.
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

    const active = this.activeRun;
    this.activeRun = undefined;
    const isHost = active.target === 'host';
    const turn: WorkshopTurn = {
      id: this.nextTurnId('assistant'),
      role: 'assistant',
      kind: active.kind,
      toolId: !isHost ? active.toolId : undefined,
      toolLabel: !isHost && active.toolId ? workshopToolLabel(active.toolId) : undefined,
      personaId: isHost ? this.participants.host.personaId : undefined,
      personaLabel: isHost ? workshopPersonaLabel(this.participants.host.personaId) : undefined,
      content,
      timestamp: this.now(),
      usage: usage ? { ...usage } : undefined,
      truncated: truncated || undefined
    };

    if (isHost && conversationId) {
      this.participants.host.conversationId = conversationId;
    }
    if (!isHost && active.toolId && conversationId) {
      this.participants.toolSidecars[active.toolId] = {
        conversationId,
        latestReportTurnId: turn.id
      };
      // Sprint 05 preserves the tool-first path as an honest direct mode.
      this.participants.directToolTarget = active.toolId;
    }

    this.turns.push(turn);
    return cloneTurn(turn);
  }

  /** Cancel, preempt, or fail only the active request; keep its user turn. */
  abandonRun(requestId: string): void {
    if (this.activeRun?.requestId === requestId) {
      this.activeRun = undefined;
    }
  }

  /** Clear one known-lost participant and return its private id for disposal. */
  clearLostConversation(target: WorkshopChatTarget): string | undefined {
    if (target.kind === 'host') {
      const conversationId = this.participants.host.conversationId;
      this.participants.host.conversationId = undefined;
      return conversationId;
    }
    const sidecar = this.participants.toolSidecars[target.toolId];
    delete this.participants.toolSidecars[target.toolId];
    if (this.participants.directToolTarget === target.toolId) {
      this.participants.directToolTarget = undefined;
    }
    return sidecar?.conversationId;
  }

  /** Clear every retained participant after an assistant-resource generation loss. */
  clearAllConversations(): string[] {
    const conversationIds = this.conversationIds();
    this.participants.host.conversationId = undefined;
    this.participants.toolSidecars = {};
    this.participants.directToolTarget = undefined;
    return conversationIds;
  }

  /**
   * Fresh session boundary: preserve the excerpt, clear thread and sidecars,
   * and return Jill as the selected host.
   */
  reset(): string[] {
    const conversationIds = this.clearAllConversations();
    this.turns = [];
    this.activeRun = undefined;
    this.contextBrief = undefined;
    this.selectedToolId = undefined;
    this.participants = this.newParticipants();
    return conversationIds;
  }

  getSnapshot(): WorkshopSessionSnapshot {
    const windowed = this.turns.slice(-WORKSHOP_SNAPSHOT_TURN_WINDOW);
    return {
      excerpt: this.excerpt ? cloneExcerpt(this.excerpt) : undefined,
      contextBrief: this.contextBrief,
      turns: windowed.map(cloneTurn),
      totalTurns: this.turns.length,
      truncatedTurns: this.turns.length - windowed.length,
      hasConversation: this.conversationIds().length > 0,
      participants: this.snapshotParticipants(),
      selectedToolId: this.selectedToolId,
      activeToolId: this.activeRun?.target === 'tool' ? this.activeRun.toolId : undefined,
      activeRequestId: this.activeRun?.requestId
    };
  }

  private beginMessage(
    _text: string,
    requestId: string,
    displayText: string,
    target: 'host' | 'tool',
    toolId?: WorkshopToolId
  ): WorkshopTurn {
    const turn: WorkshopTurn = {
      id: this.nextTurnId('user'),
      role: 'user',
      kind: 'message',
      content: displayText,
      timestamp: this.now()
    };
    this.turns.push(turn);
    this.activeRun = { requestId, kind: 'message', target, toolId };
    return cloneTurn(turn);
  }

  private requireExcerpt(): void {
    if (!this.excerpt || this.excerpt.text.trim().length === 0) {
      throw new Error('Cannot run a Workshop conversation without a pinned excerpt');
    }
  }

  private conversationIds(): string[] {
    const ids = this.participants.host.conversationId ? [this.participants.host.conversationId] : [];
    for (const sidecar of Object.values(this.participants.toolSidecars)) {
      if (sidecar?.conversationId) {
        ids.push(sidecar.conversationId);
      }
    }
    return ids;
  }

  private snapshotParticipants(): WorkshopParticipantsSnapshot {
    return {
      host: {
        personaId: this.participants.host.personaId,
        hasConversation: this.hasHostConversation()
      },
      toolSidecars: Object.entries(this.participants.toolSidecars).flatMap(([toolId, sidecar]) =>
        sidecar ? [{ toolId: toolId as WorkshopToolId, hasConversation: true as const }] : []
      ),
      chatTarget: this.getChatTarget()
    };
  }

  private newParticipants(): WorkshopParticipants {
    return {
      host: { personaId: DEFAULT_WORKSHOP_PERSONA_ID },
      toolSidecars: {}
    };
  }

  private nextTurnId(role: 'user' | 'assistant'): string {
    return `turn-${++this.turnCounter}-${role}-${this.now()}`;
  }
}

function cloneTurn(turn: WorkshopTurn): WorkshopTurn {
  return { ...turn, usage: turn.usage ? { ...turn.usage } : undefined };
}

function cloneExcerpt(excerpt: WorkshopExcerpt): WorkshopExcerpt {
  return { ...excerpt, truncation: excerpt.truncation ? { ...excerpt.truncation } : undefined };
}
