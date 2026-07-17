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
  WorkshopActionableFinding,
  WorkshopExcerpt,
  WorkshopExcerptSource,
  WorkshopExcerptTruncation,
  workshopExcerptSourcePath,
  WorkshopPersonaId,
  WorkshopPersonaGuestSnapshot,
  WorkshopParticipantsSnapshot,
  WorkshopSessionSnapshot,
  WorkshopToolId,
  WorkshopTodoItem,
  WorkshopTurn,
  WorkshopTurnArtifact,
  WorkshopTurnKind
} from '@messages';
import { TokenUsage } from '@shared/types';
import {
  WorkshopCapabilityArtifactDetails,
  WorkshopCapabilityResult
} from '@shared/types/workshopCapabilities';
import {
  DEFAULT_WORKSHOP_PERSONA_ID,
  WORKSHOP_GUEST_CAPACITY,
  workshopPersonaLabel
} from '@shared/constants/workshopPersonas';
import { workshopToolLabel } from '@shared/constants/workshopTools';
import { WORKSHOP_ACTIONABLE_FINDING_BOUNDS } from './WorkshopActionableFindings';

const assertNever = (value: never): never => {
  throw new Error(`Unhandled Workshop capability operation: ${JSON.stringify(value)}`);
};

export interface WorkshopExcerptInput {
  text: string;
  /** Validated provenance — callers coerce IPC claims before reaching the aggregate. */
  source: WorkshopExcerptSource;
  truncation?: WorkshopExcerptTruncation;
}

export const WORKSHOP_SNAPSHOT_TURN_WINDOW = 100;
export const WORKSHOP_TODO_BOUNDS = Object.freeze({
  items: 200,
  textCharacters: WORKSHOP_ACTIONABLE_FINDING_BOUNDS.itemCharacters
});

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
  personaGuests: Map<WorkshopPersonaId, WorkshopPersonaGuest>;
  chatTarget: WorkshopChatTarget;
}

interface WorkshopPersonaGuest {
  personaId: WorkshopPersonaId;
  conversationId?: string;
  lastSeenHostTurnId?: string;
  deliveredToHostThroughTurnId?: string;
  liveness: 'live' | 'disposed';
}

type WorkshopActivePhase =
  | 'tool_report'
  | 'persona_synthesis'
  | 'host_message'
  | 'guest_message'
  | 'direct_tool_message';

interface ActiveRun {
  requestId: string;
  kind: WorkshopTurnKind;
  artifact: WorkshopTurnArtifact;
  phase: WorkshopActivePhase;
  target: 'host' | 'tool' | 'personaGuest';
  toolId?: WorkshopToolId;
  guestPersonaId?: WorkshopPersonaId;
  reportTurnId?: string;
  excerptVersion: number;
}

export interface WorkshopPendingHostUpdates {
  excerpt?: WorkshopExcerpt;
  contextBrief?: {
    revision: number;
    text?: string;
  };
}

export interface WorkshopToolReportCompletion {
  turn: WorkshopTurn;
  replacedConversationId?: string;
}

export interface WorkshopCapabilityArtifactInput {
  hostRequestId: string;
  excerptVersion: number;
  details: WorkshopCapabilityArtifactDetails;
  result: WorkshopCapabilityResult;
  toolId?: WorkshopToolId;
  conversationId?: string;
  truncated?: boolean;
  actionableFindings?: WorkshopActionableFinding[];
}

export interface WorkshopExcerptReplacement {
  excerpt: WorkshopExcerpt;
  disposedConversationIds: string[];
  dividerTurn?: WorkshopTurn;
  retiredSidecarCount: number;
  replacementCount: number;
}

type StoredWorkshopTodoItem = Omit<WorkshopTodoItem, 'stale'>;

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
  private todoCounter = 0;
  /** Staleness is derived at snapshot time from immutable source provenance. */
  private todos: StoredWorkshopTodoItem[] = [];

  constructor(private readonly now: () => number = Date.now) {}

  setExcerpt(input: WorkshopExcerptInput): WorkshopExcerpt {
    this.excerptVersion += 1;
    this.excerpt = {
      text: input.text,
      version: this.excerptVersion,
      source: cloneExcerptSource(input.source),
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
    if (this.participants.chatTarget.kind === 'tool') {
      this.participants.chatTarget = { kind: 'host' };
    }
    const excerpt = this.setExcerpt(input);
    this.replacementCount += 1;
    if (this.hasHostConversation()) {
      this.pendingRevisionVersion = excerpt.version;
    }

    const retiredLabels = retired.map(sidecar => workshopToolLabel(sidecar.toolId)).sort();
    const source = workshopExcerptSourcePath(excerpt.source) ?? 'Pasted excerpt';
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
    const excerpt = this.excerpt !== undefined && this.pendingRevisionVersion === this.excerpt.version
      ? cloneExcerpt(this.excerpt)
      : undefined;
    const contextBrief = this.pendingContextBriefRevision !== undefined
      ? {
          revision: this.pendingContextBriefRevision,
          text: this.contextBrief
        }
      : undefined;
    return excerpt || contextBrief ? { excerpt, contextBrief } : undefined;
  }

  /** Clear only the exact update generation that a successful host turn shipped. */
  commitPendingHostUpdates(delivered: WorkshopPendingHostUpdates): void {
    if (delivered.excerpt?.version === this.pendingRevisionVersion) {
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
    switch (this.participants.chatTarget.kind) {
      case 'host':
        return { kind: 'host' };
      case 'tool':
        return { kind: 'tool', toolId: this.participants.chatTarget.toolId };
      case 'personaGuest':
        return { kind: 'personaGuest', personaId: this.participants.chatTarget.personaId };
    }
  }

  getToolSidecarConversationId(toolId: WorkshopToolId): string | undefined {
    return this.participants.toolSidecars[toolId]?.conversationId;
  }

  isLiveToolReport(toolId: WorkshopToolId, reportTurnId: string): boolean {
    return this.participants.toolSidecars[toolId]?.latestReportTurnId === reportTurnId;
  }

  isLivePersonaGuest(personaId: WorkshopPersonaId): boolean {
    const guest = this.participants.personaGuests.get(personaId);
    return guest?.liveness === 'live' && guest.conversationId !== undefined;
  }

  getPersonaGuestConversationId(personaId: WorkshopPersonaId): string | undefined {
    return this.isLivePersonaGuest(personaId)
      ? this.participants.personaGuests.get(personaId)?.conversationId
      : undefined;
  }

  /** Validate a user invitation before the provider conversation is created. */
  validatePersonaGuestInvitation(personaId: WorkshopPersonaId): void {
    if (personaId === this.participants.host.personaId) {
      throw new Error('The Workshop host is already in the room');
    }
    if (this.participants.personaGuests.get(personaId)?.liveness === 'live') {
      throw new Error(`${workshopPersonaLabel(personaId)} is already in the room`);
    }
    const liveGuests = [...this.participants.personaGuests.values()]
      .filter((guest) => guest.liveness === 'live').length;
    if (liveGuests >= WORKSHOP_GUEST_CAPACITY) {
      throw new Error(`Workshop supports at most ${WORKSHOP_GUEST_CAPACITY} live guests`);
    }
  }

  /** Adopt a successful fresh guest conversation and establish its cursors. */
  adoptPersonaGuest(personaId: WorkshopPersonaId, conversationId: string): void {
    this.validatePersonaGuestInvitation(personaId);
    if (!conversationId.trim()) {
      throw new Error('Cannot retain a guest without a conversation id');
    }
    const cursor = this.latestHostThreadTurnId();
    const previousDeliveryCursor = this.participants.personaGuests.get(personaId)
      ?.deliveredToHostThroughTurnId;
    this.participants.personaGuests.set(personaId, {
      personaId,
      conversationId,
      lastSeenHostTurnId: cursor,
      deliveredToHostThroughTurnId: previousDeliveryCursor ?? cursor,
      liveness: 'live'
    });
  }

  /** Dispose one guest while preserving its historical thread attribution. */
  dismissPersonaGuest(personaId: WorkshopPersonaId): string | undefined {
    const guest = this.participants.personaGuests.get(personaId);
    if (!guest || guest.liveness === 'disposed') {
      return undefined;
    }
    const conversationId = guest.conversationId;
    guest.conversationId = undefined;
    guest.liveness = 'disposed';
    if (this.activeRun?.target === 'personaGuest' && this.activeRun.guestPersonaId === personaId) {
      this.activeRun = undefined;
    }
    if (
      this.participants.chatTarget.kind === 'personaGuest'
      && this.participants.chatTarget.personaId === personaId
    ) {
      this.participants.chatTarget = { kind: 'host' };
    }
    return conversationId;
  }

  isPersonaSelectionLocked(): boolean {
    const hasLiveGuest = [...this.participants.personaGuests.values()]
      .some((guest) => guest.liveness === 'live');
    return this.activeRun !== undefined || this.hasHostConversation() || hasLiveGuest;
  }

  /** A selected host can change only before its first run or conversation. */
  selectPersona(personaId: WorkshopPersonaId): void {
    if (this.isPersonaSelectionLocked()) {
      throw new Error('Cannot change the Workshop persona after host conversation start');
    }
    this.participants.host.personaId = personaId;
  }

  /** Host target is always valid; sidecar targets must name a live participant. */
  setChatTarget(target: WorkshopChatTarget): boolean {
    if (target.kind === 'host') {
      this.participants.chatTarget = { kind: 'host' };
      return true;
    }
    if (target.kind === 'tool') {
      if (!this.participants.toolSidecars[target.toolId]) {
        return false;
      }
      this.participants.chatTarget = { kind: 'tool', toolId: target.toolId };
      return true;
    }
    if (!this.isLivePersonaGuest(target.personaId)) {
      return false;
    }
    this.participants.chatTarget = { kind: 'personaGuest', personaId: target.personaId };
    return true;
  }

  /** Start a fresh isolated tool sidecar run; the permanent host is untouched. */
  beginToolRun(toolId: WorkshopToolId, requestId: string): WorkshopTurn {
    this.requireExcerpt();
    this.selectedToolId = toolId;
    // A tool run always returns to host orchestration. Direct mode is entered
    // only through the explicit report action after the side-pass completes.
    this.participants.chatTarget = { kind: 'host' };
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
    truncated?: boolean,
    actionableFindings: WorkshopActionableFinding[] = []
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
      excerptVersion: active.excerptVersion,
      actionableFindings: actionableFindings.length > 0
        ? cloneFindings(actionableFindings)
        : undefined
    };

    const replacedConversationId = this.adoptToolSidecar(
      active.toolId,
      conversationId,
      turnId
    );
    this.turns.push(turn);

    return {
      turn: cloneTurn(turn),
      replacedConversationId
    };
  }

  /**
   * Append completed nested capability evidence without replacing the active
   * host run. A reset/preemption refuses the late artifact atomically.
   */
  recordCapabilityArtifact(
    input: WorkshopCapabilityArtifactInput
  ): WorkshopToolReportCompletion | undefined {
    const active = this.activeRun;
    if (
      active?.requestId !== input.hostRequestId ||
      active.target !== 'host' ||
      active.excerptVersion !== input.excerptVersion
    ) {
      return undefined;
    }

    const isAnalysis = input.details.operation === 'analysis.run';
    const turnId = this.nextTurnId('assistant');
    const artifact: WorkshopTurnArtifact = (() => {
      switch (input.details.operation) {
        case 'analysis.run': return 'tool_report';
        case 'dictionary.lookup': return 'dictionary_lookup';
        case 'dictionary.full-entry': return 'dictionary_full_entry';
        case 'resource.catalog': return 'resource_catalog';
        case 'resource.search': return 'resource_search';
        case 'resource.read': return 'resource_read';
        default: return assertNever(input.details.operation);
      }
    })();
    const isResource = input.details.operation.startsWith('resource.');
    const turn: WorkshopTurn = {
      id: turnId,
      role: 'assistant',
      kind: 'tool_run',
      participant: 'tool',
      artifact,
      toolId: isAnalysis ? input.toolId : undefined,
      toolLabel: isAnalysis && input.toolId
        ? workshopToolLabel(input.toolId)
        : isResource ? 'Project Resources' : 'Writer\'s Dictionary',
      reportTurnId: isAnalysis && input.conversationId ? turnId : undefined,
      capability: cloneCapabilityDetails(input.details),
      content: input.result.content ?? input.result.error ?? 'No capability result was returned.',
      timestamp: this.now(),
      usage: input.result.usage ? { ...input.result.usage } : undefined,
      truncated: input.truncated || undefined,
      excerptVersion: input.excerptVersion,
      actionableFindings: input.actionableFindings && input.actionableFindings.length > 0
        ? cloneFindings(input.actionableFindings)
        : undefined
    };

    let replacedConversationId: string | undefined;
    if (isAnalysis && input.toolId && input.conversationId) {
      replacedConversationId = this.adoptToolSidecar(
        input.toolId,
        input.conversationId,
        turnId
      );
    }
    this.turns.push(turn);
    return { turn: cloneTurn(turn), replacedConversationId };
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

  /** Begin a message to a live guest; guests never receive host capabilities. */
  beginPersonaGuestMessage(
    personaId: WorkshopPersonaId,
    requestId: string,
    displayText: string
  ): WorkshopTurn {
    this.requireExcerpt();
    if (!this.isLivePersonaGuest(personaId)) {
      throw new Error(`Cannot message Workshop guest ${workshopPersonaLabel(personaId)} without a live sidecar`);
    }
    return this.beginMessage(requestId, displayText, 'personaGuest', undefined, personaId);
  }

  /** Begin the first invitation turn before the provider conversation exists. */
  beginPersonaGuestJoin(
    personaId: WorkshopPersonaId,
    requestId: string,
    displayText: string
  ): WorkshopTurn {
    this.requireExcerpt();
    this.validatePersonaGuestInvitation(personaId);
    return this.beginMessage(requestId, displayText, 'personaGuest', undefined, personaId);
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
    conversationId?: string,
    actionableFindings: WorkshopActionableFinding[] = []
  ): WorkshopTurn | undefined {
    if (this.activeRun?.requestId !== requestId) {
      return undefined;
    }

    const active = this.activeRun;
    this.activeRun = undefined;
    const isHost = active.target === 'host';
    const isGuest = active.target === 'personaGuest';
    const toolSidecar = active.toolId
      ? this.participants.toolSidecars[active.toolId]
      : undefined;
    const turn: WorkshopTurn = {
      id: this.nextTurnId('assistant'),
      role: 'assistant',
      kind: active.kind,
      participant: isHost ? 'host' : isGuest ? 'guest' : 'tool',
      artifact: active.artifact,
      toolId: !isHost && !isGuest ? active.toolId : undefined,
      toolLabel: !isHost && !isGuest && active.toolId ? workshopToolLabel(active.toolId) : undefined,
      personaId: isHost
        ? this.participants.host.personaId
        : isGuest
          ? active.guestPersonaId
          : undefined,
      personaLabel: isHost
        ? workshopPersonaLabel(this.participants.host.personaId)
        : isGuest && active.guestPersonaId
          ? workshopPersonaLabel(active.guestPersonaId)
          : undefined,
      reportTurnId: active.reportTurnId ?? toolSidecar?.latestReportTurnId,
      content,
      timestamp: this.now(),
      usage: usage ? { ...usage } : undefined,
      truncated: truncated || undefined,
      excerptVersion: active.excerptVersion,
      actionableFindings: isHost && actionableFindings.length > 0
        ? cloneFindings(actionableFindings)
        : undefined
    };

    if (isHost && conversationId) {
      this.participants.host.conversationId = conversationId;
    }
    if (isGuest && active.guestPersonaId && conversationId) {
      if (!this.isLivePersonaGuest(active.guestPersonaId)) {
        this.adoptPersonaGuest(active.guestPersonaId, conversationId);
      }
      const guest = this.participants.personaGuests.get(active.guestPersonaId);
      if (guest?.liveness === 'live') {
        guest.conversationId = conversationId;
      }
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

  /** Collect room turns a guest has not yet seen; this is a pure cursor read. */
  collectUnseenHostTurnsForGuest(personaId: WorkshopPersonaId): WorkshopTurn[] {
    const guest = this.participants.personaGuests.get(personaId);
    if (guest?.liveness !== 'live') {
      return [];
    }
    const turnIndexes = new Map(this.turns.map((turn, index) => [turn.id, index]));
    const cursorIndex = guest.lastSeenHostTurnId
      ? turnIndexes.get(guest.lastSeenHostTurnId) ?? -1
      : -1;
    return this.turns
      .slice(cursorIndex + 1)
      .filter((turn) => this.isHostThreadTurn(turn))
      .map(cloneTurn);
  }

  /** Full host-room view used only to build a bounded guest join envelope. */
  collectHostThreadTurns(): WorkshopTurn[] {
    return this.turns.filter((turn) => this.isHostThreadTurn(turn)).map(cloneTurn);
  }

  /** Adopt only the host delta that actually reached a successful guest turn. */
  commitGuestCatchUp(personaId: WorkshopPersonaId, deliveredTurnIds: readonly string[]): void {
    const guest = this.participants.personaGuests.get(personaId);
    if (guest?.liveness !== 'live' || deliveredTurnIds.length === 0) {
      return;
    }
    const turnIndexes = new Map(this.turns.map((turn, index) => [turn.id, index]));
    let newestIndex = guest.lastSeenHostTurnId
      ? turnIndexes.get(guest.lastSeenHostTurnId) ?? -1
      : -1;
    let newestTurnId = guest.lastSeenHostTurnId;
    for (const turnId of deliveredTurnIds) {
      const index = turnIndexes.get(turnId);
      if (index !== undefined && index > newestIndex && this.isHostThreadTurn(this.turns[index])) {
        newestIndex = index;
        newestTurnId = turnId;
      }
    }
    if (newestTurnId !== undefined) {
      guest.lastSeenHostTurnId = newestTurnId;
    }
  }

  /** Collect guest exchanges that the host has not yet received as evidence. */
  collectUnseenGuestExchangesForHost(): WorkshopTurn[] {
    if (this.participants.personaGuests.size === 0) {
      return [];
    }
    const turnIndexes = new Map(this.turns.map((turn, index) => [turn.id, index]));
    const unseen: WorkshopTurn[] = [];
    for (const guest of this.participants.personaGuests.values()) {
      const cursorIndex = guest.deliveredToHostThroughTurnId
        ? turnIndexes.get(guest.deliveredToHostThroughTurnId) ?? -1
        : -1;
      for (let index = cursorIndex + 1; index < this.turns.length; index += 1) {
        const response = this.turns[index];
        if (response.participant !== 'guest' || response.personaId !== guest.personaId) {
          continue;
        }
        const writerTurn = this.turns[index - 1];
        if (
          index - 1 > cursorIndex &&
          writerTurn?.participant === 'writer' &&
          writerTurn.personaId === guest.personaId &&
          writerTurn.artifact === 'persona_message'
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

  /** Advance guest-to-host cursors only after the host turn succeeds. */
  commitHostGuestHandoff(deliveredTurnIds: readonly string[]): void {
    if (deliveredTurnIds.length === 0 || this.participants.personaGuests.size === 0) {
      return;
    }
    const turnIndexes = new Map(this.turns.map((turn, index) => [turn.id, index]));
    for (const guest of this.participants.personaGuests.values()) {
      let newestIndex = guest.deliveredToHostThroughTurnId
        ? turnIndexes.get(guest.deliveredToHostThroughTurnId) ?? -1
        : -1;
      let newestTurnId = guest.deliveredToHostThroughTurnId;
      for (const turnId of deliveredTurnIds) {
        const index = turnIndexes.get(turnId);
        const turn = index === undefined ? undefined : this.turns[index];
        if (
          index !== undefined &&
          index > newestIndex &&
          turn?.participant === 'guest' &&
          turn.personaId === guest.personaId
        ) {
          newestIndex = index;
          newestTurnId = turnId;
        }
      }
      if (newestTurnId !== undefined) {
        guest.deliveredToHostThroughTurnId = newestTurnId;
      }
    }
  }

  addTodoFromFinding(sourceTurnId: string, findingKey: string): WorkshopTodoItem {
    const sourceTurn = this.turns.find(
      (turn) =>
        turn.id === sourceTurnId &&
        (turn.artifact === 'tool_report' || turn.participant === 'host')
    );
    const finding = sourceTurn?.actionableFindings?.find(
      (candidate) => candidate.key === findingKey
    );
    const isToolReport = sourceTurn?.artifact === 'tool_report' && !!sourceTurn.toolId;
    const isHostTurn = sourceTurn?.participant === 'host' && !!sourceTurn.personaId;
    if (!sourceTurn || (!isToolReport && !isHostTurn) || !finding) {
      throw new Error('Cannot add a task from an unknown actionable finding');
    }
    if (sourceTurn.excerptVersion !== this.excerptVersion) {
      throw new Error('Cannot add a task from a stale excerpt turn');
    }
    const existing = this.todos.find(
      (todo) => todo.source.turnId === sourceTurnId && todo.source.findingKey === findingKey
    );
    if (existing) {
      return cloneTodo(existing, this.excerptVersion);
    }
    if (this.todos.length >= WORKSHOP_TODO_BOUNDS.items) {
      throw new Error(`Workshop task list is limited to ${WORKSHOP_TODO_BOUNDS.items} items`);
    }
    const source: WorkshopTodoItem['source'] = isToolReport
      ? {
          kind: 'tool_report',
          turnId: sourceTurnId,
          participantLabel: sourceTurn.toolLabel ?? workshopToolLabel(sourceTurn.toolId!),
          toolId: sourceTurn.toolId!,
          findingKey,
          findingText: finding.text,
          excerptVersion: sourceTurn.excerptVersion
        }
      : {
          kind: 'host_turn',
          turnId: sourceTurnId,
          participantLabel: sourceTurn.personaLabel ?? workshopPersonaLabel(sourceTurn.personaId!),
          personaId: sourceTurn.personaId!,
          upstreamReportTurnId: sourceTurn.reportTurnId,
          findingKey,
          findingText: finding.text,
          excerptVersion: sourceTurn.excerptVersion
        };
    const todo: StoredWorkshopTodoItem = {
      id: `todo-${++this.todoCounter}-${this.now()}`,
      text: finding.text,
      status: 'open',
      priority: finding.priority,
      source,
      createdAt: this.now()
    };
    this.todos.push(todo);
    return cloneTodo(todo, this.excerptVersion);
  }

  editTodo(todoId: string, text: string): WorkshopTodoItem {
    const todo = this.requireTodo(todoId);
    const normalized = text.trim();
    if (
      normalized.length === 0 ||
      normalized.length > WORKSHOP_TODO_BOUNDS.textCharacters
    ) {
      throw new Error(
        `Task text must contain 1–${WORKSHOP_TODO_BOUNDS.textCharacters} characters`
      );
    }
    if (normalized !== todo.text) {
      todo.text = normalized;
      todo.writerEdit = {
        originalText: todo.writerEdit?.originalText ?? todo.source.findingText,
        editedAt: this.now()
      };
    }
    return cloneTodo(todo, this.excerptVersion);
  }

  setTodoStatus(todoId: string, status: WorkshopTodoItem['status']): WorkshopTodoItem {
    const todo = this.requireTodo(todoId);
    todo.status = status;
    return cloneTodo(todo, this.excerptVersion);
  }

  reorderTodo(todoId: string, direction: 'up' | 'down'): void {
    const index = this.todos.findIndex((todo) => todo.id === todoId);
    if (index < 0) {
      throw new Error('Unknown Workshop task');
    }
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= this.todos.length) {
      return;
    }
    [this.todos[index], this.todos[target]] = [this.todos[target], this.todos[index]];
  }

  collectOpenTodosForHost(): WorkshopTodoItem[] {
    return this.todos
      .filter((todo) => todo.status === 'open' && todo.source.excerptVersion === this.excerptVersion)
      .map((todo) => cloneTodo(todo, this.excerptVersion));
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
    this.participants.chatTarget = { kind: 'host' };
    for (const guest of this.participants.personaGuests.values()) {
      guest.conversationId = undefined;
      guest.liveness = 'disposed';
    }
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
    this.todos = [];
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
      todos: this.todos.map((todo) => cloneTodo(todo, this.excerptVersion)),
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
    target: 'host' | 'tool' | 'personaGuest',
    toolId?: WorkshopToolId,
    guestPersonaId?: WorkshopPersonaId
  ): WorkshopTurn {
    const sidecar = toolId ? this.participants.toolSidecars[toolId] : undefined;
    const guest = guestPersonaId ? this.participants.personaGuests.get(guestPersonaId) : undefined;
    const turn: WorkshopTurn = {
      id: this.nextTurnId('user'),
      role: 'user',
      kind: 'message',
      participant: 'writer',
      artifact: target === 'tool' ? 'direct_tool_message' : 'persona_message',
      toolId: target === 'tool' ? toolId : undefined,
      toolLabel: target === 'tool' && toolId ? workshopToolLabel(toolId) : undefined,
      personaId: target === 'personaGuest' ? guestPersonaId : undefined,
      personaLabel: target === 'personaGuest' && guestPersonaId
        ? workshopPersonaLabel(guestPersonaId)
        : undefined,
      reportTurnId: target === 'tool' ? sidecar?.latestReportTurnId : undefined,
      content: displayText,
      timestamp: this.now(),
      excerptVersion: this.excerptVersion
    };
    this.turns.push(turn);
    this.activeRun = {
      requestId,
      kind: 'message',
      artifact: target === 'host' || target === 'personaGuest'
        ? 'persona_message'
        : 'direct_tool_response',
      phase: target === 'host'
        ? 'host_message'
        : target === 'personaGuest'
          ? 'guest_message'
          : 'direct_tool_message',
      target,
      toolId,
      guestPersonaId,
      reportTurnId: target === 'tool' ? sidecar?.latestReportTurnId : undefined,
      excerptVersion: this.excerptVersion
    };
    return cloneTurn(turn);
  }

  /** One replace-and-cursor policy for writer- and persona-requested reports. */
  private adoptToolSidecar(
    toolId: WorkshopToolId,
    conversationId: string,
    latestReportTurnId: string
  ): string | undefined {
    const replaced = this.participants.toolSidecars[toolId];
    this.participants.toolSidecars[toolId] = {
      conversationId,
      latestReportTurnId,
      // A replacement report inherits the prior cursor: undelivered direct
      // exchanges remain claimable until a successful host turn ships them.
      deliveredToHostThroughTurnId:
        replaced?.deliveredToHostThroughTurnId ?? latestReportTurnId
    };
    return replaced?.conversationId && replaced.conversationId !== conversationId
      ? replaced.conversationId
      : undefined;
  }

  private requireExcerpt(): void {
    if (!this.excerpt || this.excerpt.text.trim().length === 0) {
      throw new Error('Cannot run a Workshop conversation without a pinned excerpt');
    }
  }

  private requireTodo(todoId: string): StoredWorkshopTodoItem {
    const todo = this.todos.find((candidate) => candidate.id === todoId);
    if (!todo) {
      throw new Error('Unknown Workshop task');
    }
    return todo;
  }

  private conversationIds(): string[] {
    const ids = this.participants.host.conversationId ? [this.participants.host.conversationId] : [];
    for (const sidecar of Object.values(this.participants.toolSidecars)) {
      if (sidecar?.conversationId) {
        ids.push(sidecar.conversationId);
      }
    }
    for (const guest of this.participants.personaGuests.values()) {
      if (guest.conversationId) {
        ids.push(guest.conversationId);
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
          activeTarget: this.participants.chatTarget.kind === 'tool'
            && this.participants.chatTarget.toolId === toolId
        }] : []
      ),
      personaGuests: [...this.participants.personaGuests.values()].map<WorkshopPersonaGuestSnapshot>((guest) => ({
        personaId: guest.personaId,
        personaLabel: workshopPersonaLabel(guest.personaId),
        hasConversation: guest.liveness === 'live' && guest.conversationId !== undefined,
        liveness: guest.liveness,
        activeTarget: this.participants.chatTarget.kind === 'personaGuest'
          && this.participants.chatTarget.personaId === guest.personaId
      })),
      chatTarget: this.getChatTarget()
    };
  }

  private newParticipants(): WorkshopParticipants {
    return {
      host: { personaId: DEFAULT_WORKSHOP_PERSONA_ID },
      toolSidecars: {},
      personaGuests: new Map(),
      chatTarget: { kind: 'host' }
    };
  }

  private latestHostThreadTurnId(): string | undefined {
    for (let index = this.turns.length - 1; index >= 0; index -= 1) {
      if (this.isHostThreadTurn(this.turns[index])) {
        return this.turns[index].id;
      }
    }
    return undefined;
  }

  private isHostThreadTurn(turn: WorkshopTurn): boolean {
    if (turn.participant === 'guest') {
      return false;
    }
    if (turn.participant === 'writer' && turn.personaId) {
      return false;
    }
    if (turn.artifact === 'direct_tool_message' || turn.artifact === 'direct_tool_response') {
      return false;
    }
    return turn.participant === 'writer'
      || turn.participant === 'host'
      || turn.participant === 'tool'
      || turn.participant === 'session';
  }

  private nextTurnId(role: 'user' | 'assistant' | 'system'): string {
    return `turn-${++this.turnCounter}-${role}-${this.now()}`;
  }
}

function cloneTurn(turn: WorkshopTurn): WorkshopTurn {
  return {
    ...turn,
    usage: turn.usage ? { ...turn.usage } : undefined,
    capability: turn.capability ? cloneCapabilityDetails(turn.capability) : undefined,
    actionableFindings: turn.actionableFindings
      ? cloneFindings(turn.actionableFindings)
      : undefined
  };
}

function cloneFindings(findings: readonly WorkshopActionableFinding[]): WorkshopActionableFinding[] {
  return findings.map((finding) => ({ ...finding }));
}

function cloneTodo(todo: StoredWorkshopTodoItem, excerptVersion: number): WorkshopTodoItem {
  return {
    ...todo,
    source: { ...todo.source },
    writerEdit: todo.writerEdit ? { ...todo.writerEdit } : undefined,
    stale: todo.source.excerptVersion !== excerptVersion
  };
}

function cloneCapabilityDetails(
  details: WorkshopCapabilityArtifactDetails
): WorkshopCapabilityArtifactDetails {
  return {
    ...details,
    metadata: details.metadata
      ? Object.fromEntries(
          Object.entries(details.metadata).map(([key, value]) => [key, cloneMetadataValue(value)])
        )
      : undefined
  };
}

function cloneMetadataValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(cloneMetadataValue);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, cloneMetadataValue(nested)])
    );
  }
  return value;
}

function cloneExcerptSource(source: WorkshopExcerptSource): WorkshopExcerptSource {
  if (source.kind === 'manual') {
    return { kind: 'manual' };
  }
  return {
    ...source,
    configuredResource: source.configuredResource ? { ...source.configuredResource } : undefined
  };
}

function cloneExcerpt(excerpt: WorkshopExcerpt): WorkshopExcerpt {
  return {
    ...excerpt,
    source: cloneExcerptSource(excerpt.source),
    truncation: excerpt.truncation ? { ...excerpt.truncation } : undefined
  };
}
