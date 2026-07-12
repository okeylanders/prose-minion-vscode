/**
 * Host-owned Workshop session aggregate (ADR 2026-07-09, Sprint 06B).
 *
 * The aggregate owns one immutable persona host identity, the latest retained
 * sidecar per tool, explicit composer routing, report correlation, and the
 * transactional direct-tool delivery cursor. Provider conversation ids never
 * cross the extension/webview boundary.
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
export const WORKSHOP_DIRECT_HANDOFF_MAX_TURNS = 8;
export const WORKSHOP_DIRECT_HANDOFF_MAX_CHARS = 20_000;

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

type WorkshopActivePhase = NonNullable<WorkshopSessionSnapshot['activePhase']>;

interface ActiveRun {
  requestId: string;
  kind: WorkshopTurnKind;
  artifact: WorkshopTurnArtifact;
  phase: WorkshopActivePhase;
  target: 'host' | 'tool';
  toolId?: WorkshopToolId;
  reportTurnId?: string;
}

export interface WorkshopToolReportCompletion {
  turn: WorkshopTurn;
  replacedConversationId?: string;
}

/** Prepared but not yet delivered direct-tool delta. */
export interface WorkshopHostHandoff {
  message: string;
  unseenTurns: number;
  includedTurns: number;
  omittedTurns: number;
  truncatedCharacters: number;
  /** Private commit markers. Never serialize this application-layer object. */
  cursorUpdates: Partial<Record<WorkshopToolId, string>>;
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
      timestamp: this.now()
    };
    this.turns.push(turn);
    this.activeRun = {
      requestId,
      kind: 'tool_run',
      artifact: 'tool_report',
      phase: 'tool_report',
      target: 'tool',
      toolId
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
      truncated: truncated || undefined
    };

    const replacedConversationId = this.participants.toolSidecars[active.toolId]?.conversationId;
    this.participants.toolSidecars[active.toolId] = {
      conversationId,
      latestReportTurnId: turnId,
      // The report itself goes to the host through the dedicated synthesis
      // evidence path; this cursor tracks only later direct exchanges.
      deliveredToHostThroughTurnId: turnId
    };
    this.turns.push(turn);

    return {
      turn: cloneTurn(turn),
      replacedConversationId:
        replacedConversationId && replacedConversationId !== conversationId
          ? replacedConversationId
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
      reportTurnId
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
      truncated: truncated || undefined
    };

    if (isHost && conversationId) {
      this.participants.host.conversationId = conversationId;
    }
    this.turns.push(turn);
    return cloneTurn(turn);
  }

  /**
   * Prepare the unseen direct-tool delta without advancing any cursor. The
   * caller must commit the returned markers only after a successful host turn.
   */
  prepareHostHandoff(): WorkshopHostHandoff | undefined {
    const turnIndexes = new Map(this.turns.map((turn, index) => [turn.id, index]));
    const unseen: WorkshopTurn[] = [];
    const cursorUpdates: Partial<Record<WorkshopToolId, string>> = {};

    for (const [rawToolId, sidecar] of Object.entries(this.participants.toolSidecars)) {
      if (!sidecar) {
        continue;
      }
      const toolId = rawToolId as WorkshopToolId;
      const deliveredIndex = turnIndexes.get(sidecar.deliveredToHostThroughTurnId) ?? -1;
      const toolTurns: WorkshopTurn[] = [];
      for (let index = deliveredIndex + 1; index < this.turns.length; index += 1) {
        const response = this.turns[index];
        if (
          response.toolId !== toolId ||
          response.reportTurnId !== sidecar.latestReportTurnId ||
          response.artifact !== 'direct_tool_response'
        ) {
          continue;
        }
        const writerTurn = this.turns[index - 1];
        if (
          writerTurn?.toolId === toolId &&
          writerTurn.reportTurnId === sidecar.latestReportTurnId &&
          writerTurn.artifact === 'direct_tool_message'
        ) {
          toolTurns.push(writerTurn);
        }
        toolTurns.push(response);
      }
      if (toolTurns.length > 0) {
        unseen.push(...toolTurns);
        cursorUpdates[toolId] = toolTurns[toolTurns.length - 1].id;
      }
    }

    if (unseen.length === 0) {
      return undefined;
    }

    unseen.sort((left, right) =>
      (turnIndexes.get(left.id) ?? 0) - (turnIndexes.get(right.id) ?? 0)
    );
    const newest = unseen.slice(-WORKSHOP_DIRECT_HANDOFF_MAX_TURNS);
    let omittedTurns = unseen.length - newest.length;
    let truncatedCharacters = 0;
    const bodyBudget = WORKSHOP_DIRECT_HANDOFF_MAX_CHARS - 800;
    const selectedBlocks: string[] = [];
    let remaining = bodyBudget;

    for (let index = newest.length - 1; index >= 0; index -= 1) {
      const turn = newest[index];
      const speaker = turn.participant === 'writer' ? 'Writer' : workshopToolLabel(turn.toolId!);
      const block = `[${workshopToolLabel(turn.toolId!)} — ${speaker}]\n${turn.content}`;
      const separatorLength = selectedBlocks.length > 0 ? 2 : 0;
      if (block.length + separatorLength <= remaining) {
        selectedBlocks.unshift(block);
        remaining -= block.length + separatorLength;
        continue;
      }

      if (selectedBlocks.length === 0) {
        const marker = '\n[Direct exchange truncated by the 20,000-character handoff limit.]';
        const keptLength = Math.max(0, remaining - marker.length);
        selectedBlocks.unshift(`${block.slice(0, keptLength)}${marker}`);
        truncatedCharacters += Math.max(0, block.length - keptLength);
      } else {
        omittedTurns += 1;
        truncatedCharacters += block.length;
      }
    }

    const message = [
      'DIRECT-TOOL HANDOFF (structured conversation evidence; do not impersonate the tool)',
      `Unseen turns: ${unseen.length}`,
      `Included turns: ${selectedBlocks.length}`,
      `Omitted turns: ${omittedTurns}`,
      `Characters omitted by bound: ${truncatedCharacters}`,
      '',
      ...selectedBlocks.flatMap((block, index) => index === 0 ? [block] : ['', block]),
      '',
      'Use this bounded delta as context for the writer\'s next message. Do not claim you witnessed exchanges omitted by the bounds.'
    ].join('\n');

    return {
      message: message.slice(0, WORKSHOP_DIRECT_HANDOFF_MAX_CHARS),
      unseenTurns: unseen.length,
      includedTurns: selectedBlocks.length,
      omittedTurns,
      truncatedCharacters,
      cursorUpdates
    };
  }

  /** Commit a prepared handoff after the host response has been adopted. */
  commitHostHandoff(handoff: WorkshopHostHandoff): void {
    for (const [rawToolId, turnId] of Object.entries(handoff.cursorUpdates)) {
      if (!turnId) {
        continue;
      }
      const toolId = rawToolId as WorkshopToolId;
      const sidecar = this.participants.toolSidecars[toolId];
      const turn = this.turns.find((candidate) => candidate.id === turnId);
      if (
        sidecar &&
        turn?.toolId === toolId &&
        turn.reportTurnId === sidecar.latestReportTurnId
      ) {
        sidecar.deliveredToHostThroughTurnId = turnId;
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
    return conversationIds;
  }

  /** Fresh session boundary: preserve excerpt, clear thread, sidecars, and host. */
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
      activeRequestId: this.activeRun?.requestId,
      activePhase: this.activeRun?.phase
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
      timestamp: this.now()
    };
    this.turns.push(turn);
    this.activeRun = {
      requestId,
      kind: 'message',
      artifact: target === 'host' ? 'persona_message' : 'direct_tool_response',
      phase: target === 'host' ? 'host_message' : 'direct_tool_message',
      target,
      toolId,
      reportTurnId: sidecar?.latestReportTurnId
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
