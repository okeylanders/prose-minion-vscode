/**
 * Host-owned Workshop session aggregate (ADR 2026-07-09, Sprint 06B).
 *
 * The aggregate owns one immutable persona host identity, the latest retained
 * sidecar per tool, explicit composer routing, report correlation, and the
 * transactional direct-tool delivery cursor, versioned excerpt revisions, and
 * pending host updates. Provider conversation ids never cross the
 * extension/webview boundary.
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
  WorkshopTurnArtifact,
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
  deliveredToHostThroughTurnId: string;
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

type WorkshopActivePhase = 'tool_report' | 'persona_synthesis' | 'host_message' | 'direct_tool_message';

interface ActiveRun {
  requestId: string;
  kind: WorkshopTurnKind;
  artifact: WorkshopTurnArtifact;
  phase: WorkshopActivePhase;
  target: 'host' | 'tool';
  toolId?: WorkshopToolId;
  reportTurnId?: string;
  excerptVersion: number;
}

export interface WorkshopPendingHostUpdates {
  revision?: WorkshopExcerpt;
  contextBrief?: {
    revision: number;
    text?: string;
  };
}

export interface WorkshopToolReportCompletion {
  turn: WorkshopTurn;
  replacedConversationId?: string;
}

export interface WorkshopExcerptReplacement {
  excerpt: WorkshopExcerpt;
  disposedConversationIds: string[];
  dividerTurn?: WorkshopTurn;
  retiredSidecarCount: number;
  replacementCount: number;
}

/** A pure aggregate: no I/O, no vscode, and only an injectable clock. */
export class WorkshopSessionService {
  private excerpt?: WorkshopExcerpt;
  private contextBrief?: string;
  private excerptVersion = 0;
  private replacementCount = 0;
  private contextBriefRevision = 0;
  private pendingRevisionVersion?: number;
  private pendingContextBriefRevision?: number;
  private turns: WorkshopTurn[] = [];
  private activeRun?: ActiveRun;
  private participants: WorkshopParticipants = this.newParticipants();
  private selectedToolId?: WorkshopToolId;
  private turnCounter = 0;

  constructor(private readonly now: () => number = Date.now) {}

  setExcerpt(input: WorkshopExcerptInput): WorkshopExcerpt {
    this.excerptVersion += 1;
    this.excerpt = {
      text: input.text,
      version: this.excerptVersion,
      sourceUri: input.sourceUri,
      relativePath: input.relativePath,
      truncation: input.truncation ? { ...input.truncation } : undefined,
      pinnedAt: this.now()
    };
    return cloneExcerpt(this.excerpt);
  }

  /** Replace working text, preserve host memory, and retire stale tool sidecars. */
  replaceExcerpt(input: WorkshopExcerptInput): WorkshopExcerptReplacement {
    const previous = this.excerpt;
    if (!previous) {
      return {
        excerpt: this.setExcerpt(input),
        disposedConversationIds: [],
        retiredSidecarCount: 0,
        replacementCount: this.replacementCount
      };
    }

    const retired = Object.entries(this.participants.toolSidecars)
      .flatMap(([toolId, sidecar]) => sidecar ? [{ toolId: toolId as WorkshopToolId, ...sidecar }] : []);
    const conversationIds = retired.map(sidecar => sidecar.conversationId);
    this.participants.toolSidecars = {};
    this.participants.directToolTarget = undefined;
    const excerpt = this.setExcerpt(input);
    this.replacementCount += 1;
    if (this.hasHostConversation()) {
      this.pendingRevisionVersion = excerpt.version;
    }

    const retiredLabels = retired.map(sidecar => workshopToolLabel(sidecar.toolId)).sort();
    const source = excerpt.relativePath ?? 'Pasted excerpt';
    const retiredText = retiredLabels.length > 0 ? retiredLabels.join(', ') : 'none';
    const dividerTurn: WorkshopTurn = {
      id: this.nextTurnId('system'),
      role: 'system',
      kind: 'divider',
      participant: 'session',
      artifact: 'excerpt_revision',
      excerptVersion: excerpt.version,
      content: `Excerpt v${excerpt.version} pinned · ${source} · retired: ${retiredText}`,
      timestamp: this.now()
    };
    this.turns.push(dividerTurn);
    return {
      excerpt,
      disposedConversationIds: conversationIds,
      dividerTurn: cloneTurn(dividerTurn),
      retiredSidecarCount: retired.length,
      replacementCount: this.replacementCount
    };
  }

  getExcerpt(): WorkshopExcerpt | undefined {
    return this.excerpt ? cloneExcerpt(this.excerpt) : undefined;
  }

  getContextBrief(): string | undefined {
    return this.contextBrief;
  }

  setContextBrief(text: string | undefined): void {
    const normalized = text?.trim() || undefined;
    if (normalized === this.contextBrief) {
      return;
    }
    this.contextBrief = normalized;
    this.contextBriefRevision += 1;
    if (this.hasHostConversation() || this.activeRun?.target === 'host') {
      this.pendingContextBriefRevision = this.contextBriefRevision;
    }
  }

  collectPendingHostUpdates(): WorkshopPendingHostUpdates | undefined {
    const revision = this.pendingRevisionVersion === this.excerpt?.version
      ? cloneExcerpt(this.excerpt!)
      : undefined;
    const contextBrief = this.pendingContextBriefRevision !== undefined
      ? {
          revision: this.pendingContextBriefRevision,
          text: this.contextBrief
        }
      : undefined;
    return revision || contextBrief ? { revision, contextBrief } : undefined;
  }

  /** Clear only the exact update generation that a successful host turn shipped. */
  commitPendingHostUpdates(delivered: WorkshopPendingHostUpdates): void {
    if (delivered.revision?.version === this.pendingRevisionVersion) {
      this.pendingRevisionVersion = undefined;
    }
    if (delivered.contextBrief?.revision === this.pendingContextBriefRevision) {
      this.pendingContextBriefRevision = undefined;
    }
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

  isLiveToolReport(toolId: WorkshopToolId, reportTurnId: string): boolean {
    return this.participants.toolSidecars[toolId]?.latestReportTurnId === reportTurnId;
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

  /** Start a fresh isolated tool sidecar run; the permanent host is untouched. */
  beginToolRun(toolId: WorkshopToolId, requestId: string): WorkshopTurn {
    this.requireExcerpt();
    this.selectedToolId = toolId;
    // A tool run always returns to host orchestration. Direct mode is entered
    // only through the explicit report action after the side-pass completes.
    this.participants.directToolTarget = undefined;
    const turn: WorkshopTurn = {
      id: this.nextTurnId('user'),
      role: 'user',
      kind: 'tool_run',
      participant: 'writer',
      artifact: 'tool_request',
      toolId,
      toolLabel: workshopToolLabel(toolId),
      content: `Run **${workshopToolLabel(toolId)}** on the pinned excerpt.`,
      timestamp: this.now(),
      excerptVersion: this.excerptVersion
    };
    this.turns.push(turn);
    this.activeRun = {
      requestId,
      kind: 'tool_run',
      artifact: 'tool_report',
      phase: 'tool_report',
      target: 'tool',
      toolId,
      excerptVersion: this.excerptVersion
    };
    return cloneTurn(turn);
  }

  /**
   * Atomically append the verbatim report and adopt/replace its retained
   * sidecar. A stale completion cannot mutate either the thread or registry.
   */
  completeToolReport(
    requestId: string,
    content: string,
    conversationId: string,
    usage?: TokenUsage,
    truncated?: boolean
  ): WorkshopToolReportCompletion | undefined {
    const active = this.activeRun;
    if (
      active?.requestId !== requestId ||
      active.phase !== 'tool_report' ||
      active.target !== 'tool' ||
      !active.toolId
    ) {
      return undefined;
    }

    this.activeRun = undefined;
    const turnId = this.nextTurnId('assistant');
    const turn: WorkshopTurn = {
      id: turnId,
      role: 'assistant',
      kind: 'tool_run',
      participant: 'tool',
      artifact: 'tool_report',
      toolId: active.toolId,
      toolLabel: workshopToolLabel(active.toolId),
      reportTurnId: turnId,
      content,
      timestamp: this.now(),
      usage: usage ? { ...usage } : undefined,
      truncated: truncated || undefined,
      excerptVersion: active.excerptVersion
    };

    const replaced = this.participants.toolSidecars[active.toolId];
    this.participants.toolSidecars[active.toolId] = {
      conversationId,
      latestReportTurnId: turnId,
      // The report itself goes to the host through the dedicated synthesis
      // evidence path; this cursor tracks only direct exchanges. A replacement
      // report INHERITS the prior cursor (PR #72 review #2): undelivered
      // exchanges under the old report stay claimable until a successful host
      // turn actually ships them — adoption is not delivery.
      deliveredToHostThroughTurnId: replaced?.deliveredToHostThroughTurnId ?? turnId
    };
    this.turns.push(turn);

    return {
      turn: cloneTurn(turn),
      replacedConversationId:
        replaced?.conversationId && replaced.conversationId !== conversationId
          ? replaced.conversationId
          : undefined
    };
  }

  /** Begin the host-only synthesis phase correlated to a visible report. */
  beginPersonaSynthesis(requestId: string, reportTurnId: string): void {
    const report = this.turns.find(
      (turn) => turn.id === reportTurnId && turn.artifact === 'tool_report'
    );
    if (!report) {
      throw new Error(`Cannot synthesize unknown Workshop report ${reportTurnId}`);
    }
    this.activeRun = {
      requestId,
      kind: 'tool_run',
      artifact: 'persona_synthesis',
      phase: 'persona_synthesis',
      target: 'host',
      toolId: report.toolId,
      reportTurnId,
      excerptVersion: report.excerptVersion
    };
  }

  /** Begin a normal message to the selected permanent persona host. */
  beginPersonaMessage(requestId: string, displayText: string): WorkshopTurn {
    this.requireExcerpt();
    return this.beginMessage(requestId, displayText, 'host');
  }

  /** Begin a direct follow-up to a retained tool sidecar. */
  beginDirectToolMessage(
    toolId: WorkshopToolId,
    requestId: string,
    displayText: string
  ): WorkshopTurn {
    if (!this.participants.toolSidecars[toolId]) {
      throw new Error(`Cannot message Workshop tool ${toolId} without a retained sidecar`);
    }
    return this.beginMessage(requestId, displayText, 'tool', toolId);
  }

  /** Finish an active host or direct-tool message/synthesis. */
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
    const toolSidecar = active.toolId
      ? this.participants.toolSidecars[active.toolId]
      : undefined;
    const turn: WorkshopTurn = {
      id: this.nextTurnId('assistant'),
      role: 'assistant',
      kind: active.kind,
      participant: isHost ? 'host' : 'tool',
      artifact: active.artifact,
      toolId: !isHost ? active.toolId : undefined,
      toolLabel: !isHost && active.toolId ? workshopToolLabel(active.toolId) : undefined,
      personaId: isHost ? this.participants.host.personaId : undefined,
      personaLabel: isHost ? workshopPersonaLabel(this.participants.host.personaId) : undefined,
      reportTurnId: active.reportTurnId ?? toolSidecar?.latestReportTurnId,
      content,
      timestamp: this.now(),
      usage: usage ? { ...usage } : undefined,
      truncated: truncated || undefined,
      excerptVersion: active.excerptVersion
    };

    if (isHost && conversationId) {
      this.participants.host.conversationId = conversationId;
    }
    this.turns.push(turn);
    return cloneTurn(turn);
  }

  /**
   * Collect the unseen direct-tool exchanges (writer message + tool response
   * pairs) past every sidecar's delivery cursor, in thread order. A pure
   * state query with no cursor movement: the bounded prompt envelope is
   * WorkshopPromptBuilder's job, and cursors advance only through
   * commitHostHandoff with the turn ids that actually shipped (PR #72
   * reviews #1/#6).
   */
  collectUnseenDirectExchanges(): WorkshopTurn[] {
    const turnIndexes = new Map(this.turns.map((turn, index) => [turn.id, index]));
    const unseen: WorkshopTurn[] = [];

    for (const [rawToolId, sidecar] of Object.entries(this.participants.toolSidecars)) {
      if (!sidecar) {
        continue;
      }
      const toolId = rawToolId as WorkshopToolId;
      const deliveredIndex = turnIndexes.get(sidecar.deliveredToHostThroughTurnId) ?? -1;
      for (let index = deliveredIndex + 1; index < this.turns.length; index += 1) {
        const response = this.turns[index];
        if (response.toolId !== toolId || response.artifact !== 'direct_tool_response') {
          continue;
        }
        // Exchanges keep the reportTurnId of the report they followed; a
        // replaced report does NOT orphan them — the cursor alone decides
        // delivery (PR #72 review #2). The pair check only guards integrity.
        const writerTurn = this.turns[index - 1];
        if (
          index - 1 > deliveredIndex &&
          writerTurn?.toolId === toolId &&
          writerTurn.artifact === 'direct_tool_message' &&
          writerTurn.reportTurnId === response.reportTurnId
        ) {
          unseen.push(writerTurn);
        }
        unseen.push(response);
      }
    }

    unseen.sort((left, right) =>
      (turnIndexes.get(left.id) ?? 0) - (turnIndexes.get(right.id) ?? 0)
    );
    return unseen.map(cloneTurn);
  }

  /**
   * Advance per-tool delivery cursors after a successful host turn, given the
   * turn ids whose content actually shipped in the handoff envelope. Deriving
   * the commit from the SHIPPED set — never from the unseen set — means
   * windowing and character budgeting can only defer an exchange to the next
   * handoff, not silently mark it delivered (PR #72 review #1). Cursors only
   * move forward.
   */
  commitHostHandoff(deliveredTurnIds: readonly string[]): void {
    const turnIndexes = new Map(this.turns.map((turn, index) => [turn.id, index]));
    for (const [rawToolId, sidecar] of Object.entries(this.participants.toolSidecars)) {
      if (!sidecar) {
        continue;
      }
      const toolId = rawToolId as WorkshopToolId;
      let cursorIndex = turnIndexes.get(sidecar.deliveredToHostThroughTurnId) ?? -1;
      for (const turnId of deliveredTurnIds) {
        const index = turnIndexes.get(turnId);
        if (index !== undefined && index > cursorIndex && this.turns[index].toolId === toolId) {
          cursorIndex = index;
          sidecar.deliveredToHostThroughTurnId = turnId;
        }
      }
    }
  }

  /** Cancel, preempt, or fail only the active request; keep visible turns. */
  abandonRun(requestId: string): void {
    if (this.activeRun?.requestId === requestId) {
      this.activeRun = undefined;
    }
  }

  /** Clear every retained participant after an assistant-resource generation loss. */
  clearAllConversations(): string[] {
    const conversationIds = this.conversationIds();
    this.participants.host.conversationId = undefined;
    this.participants.toolSidecars = {};
    this.participants.directToolTarget = undefined;
    this.pendingRevisionVersion = undefined;
    this.pendingContextBriefRevision = undefined;
    return conversationIds;
  }

  /** Fresh session boundary: preserve excerpt, clear thread, sidecars, and host. */
  reset(): string[] {
    const conversationIds = this.clearAllConversations();
    this.turns = [];
    this.activeRun = undefined;
    this.contextBrief = undefined;
    this.replacementCount = 0;
    this.selectedToolId = undefined;
    this.participants = this.newParticipants();
    return conversationIds;
  }

  getSnapshot(): WorkshopSessionSnapshot {
    const windowed = this.turns.slice(-WORKSHOP_SNAPSHOT_TURN_WINDOW);
    return {
      excerpt: this.excerpt ? cloneExcerpt(this.excerpt) : undefined,
      excerptVersion: this.excerptVersion,
      replacementCount: this.replacementCount,
      contextBrief: this.contextBrief,
      pendingHostUpdate: this.pendingRevisionVersion !== undefined || this.pendingContextBriefRevision !== undefined
        ? {
            excerptVersion: this.pendingRevisionVersion,
            contextBrief: this.pendingContextBriefRevision !== undefined
          }
        : undefined,
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
    requestId: string,
    displayText: string,
    target: 'host' | 'tool',
    toolId?: WorkshopToolId
  ): WorkshopTurn {
    const sidecar = toolId ? this.participants.toolSidecars[toolId] : undefined;
    const turn: WorkshopTurn = {
      id: this.nextTurnId('user'),
      role: 'user',
      kind: 'message',
      participant: 'writer',
      artifact: target === 'host' ? 'persona_message' : 'direct_tool_message',
      toolId: target === 'tool' ? toolId : undefined,
      toolLabel: target === 'tool' && toolId ? workshopToolLabel(toolId) : undefined,
      reportTurnId: sidecar?.latestReportTurnId,
      content: displayText,
      timestamp: this.now(),
      excerptVersion: this.excerptVersion
    };
    this.turns.push(turn);
    this.activeRun = {
      requestId,
      kind: 'message',
      artifact: target === 'host' ? 'persona_message' : 'direct_tool_response',
      phase: target === 'host' ? 'host_message' : 'direct_tool_message',
      target,
      toolId,
      reportTurnId: sidecar?.latestReportTurnId,
      excerptVersion: this.excerptVersion
    };
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
        sidecar ? [{
          toolId: toolId as WorkshopToolId,
          hasConversation: true as const,
          latestReportTurnId: sidecar.latestReportTurnId,
          availableForDirectFollowUp: true,
          activeTarget: this.participants.directToolTarget === toolId
        }] : []
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

  private nextTurnId(role: 'user' | 'assistant' | 'system'): string {
    return `turn-${++this.turnCounter}-${role}-${this.now()}`;
  }
}

function cloneTurn(turn: WorkshopTurn): WorkshopTurn {
  return { ...turn, usage: turn.usage ? { ...turn.usage } : undefined };
}

function cloneExcerpt(excerpt: WorkshopExcerpt): WorkshopExcerpt {
  return { ...excerpt, truncation: excerpt.truncation ? { ...excerpt.truncation } : undefined };
}
