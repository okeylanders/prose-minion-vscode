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
  ContextSourceEntry,
  WorkshopChatTarget,
  WorkshopActionableFinding,
  WorkshopConversationBehavior,
  WorkshopConversationBehaviorTransition,
  WorkshopContextAttachmentSnapshot,
  DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR,
  isWorkshopInteractionMode,
  isWorkshopPersonaExpressionLevel,
  isWorkshopRelationalDepth,
  WorkshopExcerpt,
  WorkshopExcerptSnapshot,
  WorkshopExcerptSource,
  WorkshopExcerptTruncation,
  workshopExcerptSourcePath,
  WorkshopMessageAttachmentSnapshot,
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
import { isContextPathGroup, TokenUsage } from '@shared/types';
import {
  WorkshopCapabilityArtifactDetails,
  WorkshopCapabilityResult
} from '@shared/types/workshopCapabilities';
import {
  DEFAULT_WORKSHOP_PERSONA_ID,
  isWorkshopPersonaId,
  WORKSHOP_GUEST_CAPACITY,
  workshopPersonaLabel
} from '@shared/constants/workshopPersonas';
import { isWorkshopToolId, workshopToolLabel } from '@shared/constants/workshopTools';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { WORKSHOP_ACTIONABLE_FINDING_BOUNDS } from './WorkshopActionableFindings';

const assertNever = (value: never): never => {
  throw new Error(`Unhandled Workshop capability operation: ${JSON.stringify(value)}`);
};

export interface WorkshopExcerptInput {
  text: string;
  /** Validated provenance — callers coerce IPC claims before reaching the aggregate. */
  source: WorkshopExcerptSource;
  truncation?: WorkshopExcerptTruncation;
  sourceFingerprint?: string;
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
  /** Behavior captured when a persona run begins; settings cannot change mid-run. */
  behavior?: WorkshopConversationBehavior;
  behaviorTransition?: WorkshopConversationBehaviorTransition;
}

/**
 * Full host-side attachment (Sprint 12): snapshot metadata plus the content
 * that enters prompt frames. Content never crosses to the webview — the
 * snapshot projection strips it.
 */
export interface WorkshopContextAttachment extends WorkshopContextAttachmentSnapshot {
  content: string;
  /** File kind only; host-private (used for duplicate guard + re-reads). */
  sourceUri?: string;
}

export type WorkshopContextAttachmentInput = Omit<WorkshopContextAttachment, 'id' | 'addedAt'>;

export type WorkshopContextAttachmentResult =
  | { ok: true; attachment: WorkshopContextAttachment; eventTurn?: WorkshopTurn }
  | { ok: false; reason: 'duplicate' | 'over-budget'; remainingWords: number };

/**
 * Full host-side message attachment (Phase 6B): the display-safe snapshot
 * plus the content that enters exactly one `<thread-artifact>` frame.
 * Content never crosses to the webview.
 */
export interface WorkshopMessageAttachment extends WorkshopMessageAttachmentSnapshot {
  content: string;
  /** Host-private (duplicate guard only). */
  sourceUri?: string;
}

export type WorkshopMessageAttachmentInput = Omit<WorkshopMessageAttachment, 'id'>;

export type WorkshopMessageAttachmentResult =
  | { ok: true; attachment: WorkshopMessageAttachment }
  | { ok: false; reason: 'duplicate' | 'limit' };

export interface WorkshopPendingHostUpdates {
  excerpt?: WorkshopExcerpt;
  contextAttachments?: {
    revision: number;
    attachments: WorkshopContextAttachment[];
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

export type WorkshopStoredTodoItemV1 = Omit<WorkshopTodoItem, 'stale'>;

export type WorkshopConversationLogicalKey =
  | 'host'
  | `tool:${WorkshopToolId}`
  | `guest:${WorkshopPersonaId}`;

export type WorkshopRuntimeConversationBindings = Readonly<
  Partial<Record<WorkshopConversationLogicalKey, string>>
>;

export interface WorkshopSessionStateV1 {
  excerpt?: WorkshopExcerpt;
  contextAttachments: WorkshopContextAttachment[];
  pendingMessageAttachments: WorkshopMessageAttachment[];
  revisions: {
    excerpt: number;
    replacementCount: number;
    context: number;
    pendingExcerpt?: number;
    pendingContext?: number;
  };
  counters: {
    attachment: number;
    threadArtifact: number;
    turn: number;
    todo: number;
  };
  writerSources: {
    host: ContextSourceEntry[];
    tools: Partial<Record<WorkshopToolId, ContextSourceEntry[]>>;
    guests: Array<{
      personaId: WorkshopPersonaId;
      sources: ContextSourceEntry[];
    }>;
  };
  turns: WorkshopTurn[];
  participants: {
    host: {
      personaId: WorkshopPersonaId;
      conversationKey?: 'host';
    };
    toolSidecars: Array<{
      toolId: WorkshopToolId;
      conversationKey: `tool:${WorkshopToolId}`;
      latestReportTurnId: string;
      deliveredToHostThroughTurnId: string;
    }>;
    personaGuests: Array<{
      personaId: WorkshopPersonaId;
      conversationKey?: `guest:${WorkshopPersonaId}`;
      lastSeenHostTurnId?: string;
      deliveredToHostThroughTurnId?: string;
      liveness: 'live' | 'disposed';
    }>;
    chatTarget: WorkshopChatTarget;
  };
  selectedToolId?: WorkshopToolId;
  todos: WorkshopStoredTodoItemV1[];
  lastCommittedPersonaBehavior?: Pick<
    WorkshopConversationBehavior,
    'interactionMode' | 'expressionLevel' | 'relationalDepth'
  >;
}

export interface WorkshopSessionHydrationResult {
  discardedConversationIds: string[];
  degradedConversationKeys: WorkshopConversationLogicalKey[];
}

export class WorkshopSessionActiveRunPersistenceError extends Error {
  constructor() {
    super('Cannot persist Workshop session while a run is active');
    this.name = 'WorkshopSessionActiveRunPersistenceError';
  }
}

/**
 * Decode the host-private aggregate at the raw JSON boundary. Structural
 * validation is exact-key and recursive; semantic/referential validation then
 * runs on a defensive clone. Conversation import may safely happen only after
 * this preflight succeeds.
 */
export function parseWorkshopSessionStateV1(value: unknown): WorkshopSessionStateV1 {
  assertWorkshopSessionStateShape(value);
  const decoded = cloneWorkshopSessionState(value);
  validatePersistedState(decoded);
  return decoded;
}

type StoredWorkshopTodoItem = WorkshopStoredTodoItemV1;

/** A pure aggregate: no I/O, no vscode, and only an injectable clock. */
export class WorkshopSessionService {
  private excerpt?: WorkshopExcerpt;
  private contextAttachments: WorkshopContextAttachment[] = [];
  private excerptVersion = 0;
  private replacementCount = 0;
  private contextRevision = 0;
  private pendingRevisionVersion?: number;
  private pendingContextRevision?: number;
  private attachmentCounter = 0;
  private pendingMessageAttachments: WorkshopMessageAttachment[] = [];
  /** Monotonic `ta-N` mint — never reused within a session (surgery address). */
  private threadArtifactCounter = 0;
  /**
   * Writer-origin manifest rows per retained participant (Phase 7): pins
   * stamped at delivery (stale-marked on revision), tool/guest rows stamped
   * at sidecar adoption, message attachments stamped at ship time. Standing
   * attachments for the HOST are derived live at collect time — the host
   * receives list changes via update frames, so the live list is what it
   * carries; tools snapshot the list at adoption because retained sidecars
   * never receive later changes.
   */
  private hostWriterSources: ContextSourceEntry[] = [];
  /** The one pin revision still live in the host manifest, if any. */
  private activeHostPin?: ContextSourceEntry;
  private toolWriterSources: Partial<Record<WorkshopToolId, ContextSourceEntry[]>> = {};
  private guestWriterSources = new Map<WorkshopPersonaId, ContextSourceEntry[]>();
  private turns: WorkshopTurn[] = [];
  private activeRun?: ActiveRun;
  private participants: WorkshopParticipants = this.newParticipants();
  private selectedToolId?: WorkshopToolId;
  private turnCounter = 0;
  private todoCounter = 0;
  /** Staleness is derived at snapshot time from immutable source provenance. */
  private todos: StoredWorkshopTodoItem[] = [];
  private behavior: WorkshopConversationBehavior;
  /** System-prompt behavior that governed the latest committed persona reply. */
  private lastCommittedPersonaBehavior?: Pick<
    WorkshopConversationBehavior,
    'interactionMode' | 'expressionLevel' | 'relationalDepth'
  >;

  constructor(
    private readonly now: () => number = Date.now,
    initialBehavior: WorkshopConversationBehavior = DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR
  ) {
    this.behavior = { ...initialBehavior };
  }

  getConversationBehavior(): WorkshopConversationBehavior {
    return { ...this.behavior };
  }

  /**
   * Commit one complete writer-owned behavior object. Prompt replacement, run
   * guards, and IPC validation remain application-layer concerns; the pure
   * aggregate owns only the accepted room state and per-turn provenance.
   */
  setConversationBehavior(behavior: WorkshopConversationBehavior): WorkshopConversationBehavior {
    this.behavior = { ...behavior };
    return this.getConversationBehavior();
  }

  /** Current metadata for a persona call that has no visible writer turn (tool synthesis). */
  getPersonaBehaviorMetadata(): Pick<WorkshopTurn, 'behavior' | 'behaviorTransition'> {
    return this.currentPersonaBehaviorMetadata();
  }

  /** Append one trusted, host-authored temporal boundary to the visible ledger. */
  recordSessionMarker(kind: 'start' | 'resume', content: string): WorkshopTurn {
    if (!content.trim()) {
      throw new Error('Workshop session marker content cannot be blank');
    }
    const turn: WorkshopTurn = {
      id: this.nextTurnId('system'),
      role: 'system',
      kind: 'divider',
      participant: 'session',
      artifact: kind === 'start' ? 'session_start' : 'session_resume',
      excerptVersion: this.excerptVersion,
      content,
      timestamp: this.now()
    };
    this.turns.push(turn);
    return cloneTurn(turn);
  }

  setExcerpt(input: WorkshopExcerptInput): WorkshopExcerpt {
    this.excerptVersion += 1;
    this.excerpt = {
      text: input.text,
      version: this.excerptVersion,
      source: cloneExcerptSource(input.source),
      truncation: input.truncation ? { ...input.truncation } : undefined,
      sourceFingerprint: input.sourceFingerprint,
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
    // Retired sidecars take their manifests with them (Phase 7).
    this.toolWriterSources = {};
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

  getContextAttachments(): WorkshopContextAttachment[] {
    return this.contextAttachments.map(cloneAttachment);
  }

  contextWordsUsed(): number {
    return this.contextAttachments.reduce((total, attachment) => total + attachment.words, 0);
  }

  /**
   * Attach validated content to the ordered list (Sprint 12). The aggregate
   * owns the invariants: one word budget across all attachments, and a
   * duplicate guard on the canonical source for file attachments. Mid-session
   * changes surface as a visible event turn — never a silent prompt mutation.
   */
  addContextAttachment(input: WorkshopContextAttachmentInput): WorkshopContextAttachmentResult {
    const remainingWords = PROMPT_BUDGETS.contextAttachments.words - this.contextWordsUsed();
    const duplicates = (existing: WorkshopContextAttachment): boolean => {
      if (input.kind !== 'file') {
        return false;
      }
      if (input.sourceUri !== undefined && existing.sourceUri === input.sourceUri) {
        return true;
      }
      return input.configuredResource !== undefined &&
        existing.configuredResource?.group === input.configuredResource.group &&
        existing.configuredResource?.path === input.configuredResource.path;
    };
    if (this.contextAttachments.some(duplicates)) {
      return { ok: false, reason: 'duplicate', remainingWords };
    }
    if (input.words > remainingWords) {
      return { ok: false, reason: 'over-budget', remainingWords };
    }
    this.attachmentCounter += 1;
    const attachment: WorkshopContextAttachment = {
      ...cloneAttachmentInput(input),
      id: `ctx-${this.attachmentCounter}`,
      addedAt: this.now()
    };
    this.contextAttachments.push(attachment);
    const eventTurn = this.recordContextChange(
      `Added context: ${attachment.label} · ${attachment.words.toLocaleString('en-US')} words`
    );
    return { ok: true, attachment: cloneAttachment(attachment), eventTurn };
  }

  removeContextAttachment(id: string): { removed?: WorkshopContextAttachment; eventTurn?: WorkshopTurn } {
    const index = this.contextAttachments.findIndex((attachment) => attachment.id === id);
    if (index === -1) {
      return {};
    }
    const [removed] = this.contextAttachments.splice(index, 1);
    const eventTurn = this.recordContextChange(`Removed context: ${removed.label}`);
    return { removed: cloneAttachment(removed), eventTurn };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Message attachments (Phase 6B) — staged thread-artifacts for the NEXT
  // composer message. No event turns: the message turn itself is the visible
  // artifact, and nothing here mutates any retained prompt until send.
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Stage validated content for the next composer message. Per-message item
   * cap and a duplicate guard on the canonical source; word bounding
   * (head-slice + truncation provenance) happens at read time in the handler.
   */
  addMessageAttachment(input: WorkshopMessageAttachmentInput): WorkshopMessageAttachmentResult {
    const duplicates = (existing: WorkshopMessageAttachment): boolean => {
      if (input.sourceUri !== undefined && existing.sourceUri === input.sourceUri) {
        return true;
      }
      return input.configuredResource !== undefined &&
        existing.configuredResource?.group === input.configuredResource.group &&
        existing.configuredResource?.path === input.configuredResource.path;
    };
    // Duplicate outranks the cap: "already attached" is the actionable error
    // even when the list is also full.
    if (this.pendingMessageAttachments.some(duplicates)) {
      return { ok: false, reason: 'duplicate' };
    }
    if (this.pendingMessageAttachments.length >= PROMPT_BUDGETS.workshopThreadArtifacts.itemsPerMessage) {
      return { ok: false, reason: 'limit' };
    }
    this.threadArtifactCounter += 1;
    const attachment: WorkshopMessageAttachment = {
      ...cloneMessageAttachmentInput(input),
      id: `ta-${this.threadArtifactCounter}`
    };
    this.pendingMessageAttachments.push(attachment);
    return { ok: true, attachment: cloneMessageAttachment(attachment) };
  }

  removeMessageAttachment(id: string): WorkshopMessageAttachment | undefined {
    const index = this.pendingMessageAttachments.findIndex((attachment) => attachment.id === id);
    if (index === -1) {
      return undefined;
    }
    const [removed] = this.pendingMessageAttachments.splice(index, 1);
    return cloneMessageAttachment(removed);
  }

  /** Pure read for send assembly — nothing is consumed until the turn succeeds. */
  collectMessageAttachments(): WorkshopMessageAttachment[] {
    return this.pendingMessageAttachments.map(cloneMessageAttachment);
  }

  /**
   * Clear exactly the attachments a successful send actually shipped
   * (mirrors commitPendingHostUpdates): a failed or cancelled turn retains
   * them, so the pills survive and a retry ships the same artifacts. The
   * shipped artifacts are stamped into the receiving participant's
   * writer-origin manifest (Phase 7) before leaving the pending list.
   */
  commitMessageAttachments(
    shippedIds: readonly string[],
    target: WorkshopChatTarget = { kind: 'host' }
  ): void {
    const shipped = new Set(shippedIds);
    const entries = this.pendingMessageAttachments
      .filter((attachment) => shipped.has(attachment.id))
      .map((attachment): ContextSourceEntry => ({
        kind: 'message-attachment',
        origin: 'writer',
        label: attachment.label,
        configuredResource: attachment.configuredResource ? { ...attachment.configuredResource } : undefined,
        sizeChars: attachment.content.length,
        isEstimate: true,
        deliveredAt: this.now()
      }));
    if (entries.length > 0) {
      if (target.kind === 'tool') {
        this.toolWriterSources[target.toolId] = [
          ...(this.toolWriterSources[target.toolId] ?? []),
          ...entries
        ];
      } else if (target.kind === 'personaGuest') {
        this.guestWriterSources.set(target.personaId, [
          ...(this.guestWriterSources.get(target.personaId) ?? []),
          ...entries
        ]);
      } else {
        this.hostWriterSources.push(...entries);
      }
    }
    this.pendingMessageAttachments = this.pendingMessageAttachments.filter(
      (attachment) => !shipped.has(attachment.id)
    );
  }

  /** Bump the revision, queue host delivery, and mint the visible event turn mid-session. */
  private recordContextChange(content: string): WorkshopTurn | undefined {
    this.contextRevision += 1;
    if (!this.hasHostConversation() && this.activeRun?.target !== 'host') {
      return undefined;
    }
    this.pendingContextRevision = this.contextRevision;
    const eventTurn: WorkshopTurn = {
      id: this.nextTurnId('system'),
      role: 'system',
      kind: 'divider',
      participant: 'session',
      artifact: 'context_change',
      excerptVersion: this.excerptVersion,
      content,
      timestamp: this.now()
    };
    this.turns.push(eventTurn);
    return cloneTurn(eventTurn);
  }

  collectPendingHostUpdates(): WorkshopPendingHostUpdates | undefined {
    const excerpt = this.excerpt !== undefined && this.pendingRevisionVersion === this.excerpt.version
      ? cloneExcerpt(this.excerpt)
      : undefined;
    const contextAttachments = this.pendingContextRevision !== undefined
      ? {
          revision: this.pendingContextRevision,
          attachments: this.getContextAttachments()
        }
      : undefined;
    return excerpt || contextAttachments ? { excerpt, contextAttachments } : undefined;
  }

  /** Clear only the exact update generation that a successful host turn shipped. */
  commitPendingHostUpdates(delivered: WorkshopPendingHostUpdates): void {
    if (delivered.excerpt?.version === this.pendingRevisionVersion) {
      this.pendingRevisionVersion = undefined;
      // The revision frame actually reached the host: only the one live pin
      // can change state. Earlier rows were made stale at their own revision.
      const pin = this.pinEntry();
      if (pin) {
        this.appendHostPin(pin);
      }
    }
    if (delivered.contextAttachments?.revision === this.pendingContextRevision) {
      this.pendingContextRevision = undefined;
    }
  }

  /**
   * The active participant's writer-origin manifest rows (Phase 7).
   * Display-safe clones only.
   */
  collectWriterSources(target: WorkshopChatTarget): ContextSourceEntry[] {
    if (target.kind === 'tool') {
      return (this.toolWriterSources[target.toolId] ?? []).map(cloneSourceEntry);
    }
    if (target.kind === 'personaGuest') {
      return (this.guestWriterSources.get(target.personaId) ?? []).map(cloneSourceEntry);
    }
    return [
      ...this.hostWriterSources.map(cloneSourceEntry),
      ...this.contextAttachments.map((attachment) => this.attachmentEntry(attachment))
    ];
  }

  /** The current pin as a manifest row; undefined before the first pin. */
  private pinEntry(): ContextSourceEntry | undefined {
    if (!this.excerpt) {
      return undefined;
    }
    const source = this.excerpt.source;
    return {
      kind: 'pin',
      origin: 'writer',
      label: workshopExcerptSourcePath(source) ?? 'Pasted excerpt',
      configuredResource: source.kind !== 'manual' && source.configuredResource
        ? { ...source.configuredResource }
        : undefined,
      sizeChars: this.excerpt.text.length,
      isEstimate: true,
      excerptVersion: this.excerpt.version,
      deliveredAt: this.excerpt.pinnedAt
    };
  }

  /**
   * Add the next delivered host pin without revisiting historical revisions.
   * Superseded rows remain for Phase 7's dimmed-history display.
   */
  private appendHostPin(pin: ContextSourceEntry): void {
    if (this.activeHostPin) {
      this.activeHostPin.stale = true;
    }
    this.hostWriterSources.push(pin);
    this.activeHostPin = pin;
  }

  private attachmentEntry(attachment: WorkshopContextAttachment): ContextSourceEntry {
    return {
      kind: 'attachment',
      origin: 'writer',
      label: attachment.label,
      configuredResource: attachment.configuredResource ? { ...attachment.configuredResource } : undefined,
      sizeChars: attachment.content.length,
      isEstimate: true,
      deliveredAt: attachment.addedAt
    };
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
    // The join envelope delivered the current pin (Phase 7).
    const pin = this.pinEntry();
    this.guestWriterSources.set(personaId, pin ? [pin] : []);
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
    this.guestWriterSources.delete(personaId);
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
    const behaviorMetadata = this.currentPersonaBehaviorMetadata();
    this.activeRun = {
      requestId,
      kind: 'tool_run',
      artifact: 'persona_synthesis',
      phase: 'persona_synthesis',
      target: 'host',
      toolId: report.toolId,
      reportTurnId,
      excerptVersion: report.excerptVersion,
      ...behaviorMetadata
    };
  }

  /** Begin a normal message to the selected permanent persona host. */
  beginPersonaMessage(
    requestId: string,
    displayText: string,
    messageAttachments?: readonly WorkshopMessageAttachmentSnapshot[]
  ): WorkshopTurn {
    this.requireExcerpt();
    return this.beginMessage(requestId, displayText, 'host', undefined, undefined, messageAttachments);
  }

  /** Begin a message to a live guest; guests never receive host capabilities. */
  beginPersonaGuestMessage(
    personaId: WorkshopPersonaId,
    requestId: string,
    displayText: string,
    messageAttachments?: readonly WorkshopMessageAttachmentSnapshot[]
  ): WorkshopTurn {
    this.requireExcerpt();
    if (!this.isLivePersonaGuest(personaId)) {
      throw new Error(`Cannot message Workshop guest ${workshopPersonaLabel(personaId)} without a live sidecar`);
    }
    return this.beginMessage(requestId, displayText, 'personaGuest', undefined, personaId, messageAttachments);
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
    displayText: string,
    messageAttachments?: readonly WorkshopMessageAttachmentSnapshot[]
  ): WorkshopTurn {
    if (!this.participants.toolSidecars[toolId]) {
      throw new Error(`Cannot message Workshop tool ${toolId} without a retained sidecar`);
    }
    return this.beginMessage(requestId, displayText, 'tool', toolId, undefined, messageAttachments);
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
        : undefined,
      behavior: (isHost || isGuest) && active.behavior
        ? { ...active.behavior }
        : undefined
    };

    if (isHost && conversationId) {
      if (this.participants.host.conversationId === undefined) {
        // First host adoption: the initial envelope delivered the current
        // pin — stamp it as the host's first writer-origin manifest row.
        const pin = this.pinEntry();
        if (pin) {
          this.appendHostPin(pin);
        }
      }
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
    if ((isHost || isGuest) && active.behavior) {
      this.lastCommittedPersonaBehavior = {
        interactionMode: active.behavior.interactionMode,
        expressionLevel: active.behavior.expressionLevel,
        relationalDepth: active.behavior.relationalDepth
      };
    }
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
    this.pendingContextRevision = undefined;
    // Manifests live and die with their conversations (Phase 7).
    this.hostWriterSources = [];
    this.activeHostPin = undefined;
    this.toolWriterSources = {};
    this.guestWriterSources.clear();
    return conversationIds;
  }

  /** Fresh room boundary: preserve the working set, clear thread, sidecars, and host. */
  reset(): string[] {
    const conversationIds = this.clearAllConversations();
    this.turns = [];
    this.activeRun = undefined;
    this.pendingMessageAttachments = [];
    this.pendingContextRevision = undefined;
    this.replacementCount = 0;
    this.selectedToolId = undefined;
    this.todos = [];
    this.lastCommittedPersonaBehavior = undefined;
    this.participants = this.newParticipants();
    return conversationIds;
  }

  /**
   * Export the complete host-private aggregate for a coordinated durable
   * checkpoint. This is intentionally distinct from getSnapshot(): the
   * webview projection is bounded and strips prompt-bearing content, private
   * provenance, counters, cursors, and retained-participant state.
   *
   * An active run has already appended its visible writer turn but has not
   * necessarily committed matching provider history. Refuse that ambiguous
   * boundary rather than persisting two state owners from different moments.
   */
  exportCommittedState(): WorkshopSessionStateV1 {
    if (this.activeRun) {
      throw new WorkshopSessionActiveRunPersistenceError();
    }

    return {
      excerpt: this.excerpt ? cloneExcerpt(this.excerpt) : undefined,
      contextAttachments: this.contextAttachments.map(cloneAttachment),
      pendingMessageAttachments: this.pendingMessageAttachments.map(cloneMessageAttachment),
      revisions: {
        excerpt: this.excerptVersion,
        replacementCount: this.replacementCount,
        context: this.contextRevision,
        pendingExcerpt: this.pendingRevisionVersion,
        pendingContext: this.pendingContextRevision
      },
      counters: {
        attachment: this.attachmentCounter,
        threadArtifact: this.threadArtifactCounter,
        turn: this.turnCounter,
        todo: this.todoCounter
      },
      writerSources: {
        host: this.hostWriterSources.map(cloneSourceEntry),
        tools: cloneToolWriterSources(this.toolWriterSources),
        guests: [...this.guestWriterSources.entries()].map(([personaId, sources]) => ({
          personaId,
          sources: sources.map(cloneSourceEntry)
        }))
      },
      turns: this.turns.map(cloneTurn),
      participants: {
        host: {
          personaId: this.participants.host.personaId,
          conversationKey: this.participants.host.conversationId ? 'host' : undefined
        },
        toolSidecars: Object.entries(this.participants.toolSidecars).flatMap(
          ([rawToolId, sidecar]) => {
            if (!sidecar) {
              return [];
            }
            const toolId = rawToolId as WorkshopToolId;
            return [{
              toolId,
              conversationKey: `tool:${toolId}` as `tool:${WorkshopToolId}`,
              latestReportTurnId: sidecar.latestReportTurnId,
              deliveredToHostThroughTurnId: sidecar.deliveredToHostThroughTurnId
            }];
          }
        ),
        personaGuests: [...this.participants.personaGuests.values()].map((guest) => ({
          personaId: guest.personaId,
          conversationKey: guest.conversationId
            ? `guest:${guest.personaId}` as `guest:${WorkshopPersonaId}`
            : undefined,
          lastSeenHostTurnId: guest.lastSeenHostTurnId,
          deliveredToHostThroughTurnId: guest.deliveredToHostThroughTurnId,
          liveness: guest.liveness
        })),
        chatTarget: this.getChatTarget()
      },
      selectedToolId: this.selectedToolId,
      todos: this.todos.map(cloneStoredTodo),
      lastCommittedPersonaBehavior: this.lastCommittedPersonaBehavior
        ? { ...this.lastCommittedPersonaBehavior }
        : undefined
    };
  }

  /**
   * Replace the live aggregate from one validated product checkpoint and a set
   * of freshly imported runtime conversation ids. Validation and defensive
   * cloning finish before the first assignment, so callers never observe a
   * half-hydrated room.
   *
   * Missing/blank/duplicate runtime bindings degrade only their logical
   * participant. Tool sidecars are dropped, guests become disposed, host
   * memory becomes fresh, and an invalid active target falls back to host.
   * The current global behavior is injected rather than replayed from disk.
   */
  hydrateCommittedState(
    state: WorkshopSessionStateV1,
    runtimeBindings: WorkshopRuntimeConversationBindings,
    currentBehavior: WorkshopConversationBehavior
  ): WorkshopSessionHydrationResult {
    validatePersistedState(state);

    const excerpt = state.excerpt ? cloneExcerpt(state.excerpt) : undefined;
    const contextAttachments = state.contextAttachments.map(cloneAttachment);
    const pendingMessageAttachments = state.pendingMessageAttachments.map(cloneMessageAttachment);
    const turns = state.turns.map(cloneTurn);
    const todos = state.todos.map(cloneStoredTodo);
    const behavior = { ...currentBehavior };
    const lastCommittedPersonaBehavior = state.lastCommittedPersonaBehavior
      ? { ...state.lastCommittedPersonaBehavior }
      : undefined;
    const hostWriterSources = state.writerSources.host.map(cloneSourceEntry);
    const toolWriterSources = cloneToolWriterSources(state.writerSources.tools);
    const guestWriterSources = new Map<WorkshopPersonaId, ContextSourceEntry[]>(
      state.writerSources.guests.map(({ personaId, sources }) => [
        personaId,
        sources.map(cloneSourceEntry)
      ])
    );

    const degradedConversationKeys: WorkshopConversationLogicalKey[] = [];
    const usableBindings = usableRuntimeBindings(runtimeBindings);
    const hostExpected = state.participants.host.conversationKey === 'host';
    const hostConversationId = hostExpected ? usableBindings.get('host') : undefined;
    let pendingRevisionVersion = state.revisions.pendingExcerpt;
    let pendingContextRevision = state.revisions.pendingContext;
    if (!hostConversationId) {
      if (hostExpected) {
        degradedConversationKeys.push('host');
      }
      hostWriterSources.length = 0;
      pendingRevisionVersion = undefined;
      pendingContextRevision = undefined;
    }

    const toolSidecars: WorkshopParticipants['toolSidecars'] = {};
    for (const sidecar of state.participants.toolSidecars) {
      const conversationId = usableBindings.get(sidecar.conversationKey);
      if (!conversationId) {
        degradedConversationKeys.push(sidecar.conversationKey);
        delete toolWriterSources[sidecar.toolId];
        continue;
      }
      toolSidecars[sidecar.toolId] = {
        conversationId,
        latestReportTurnId: sidecar.latestReportTurnId,
        deliveredToHostThroughTurnId: sidecar.deliveredToHostThroughTurnId
      };
    }

    const personaGuests = new Map<WorkshopPersonaId, WorkshopPersonaGuest>();
    for (const guest of state.participants.personaGuests) {
      const conversationId = guest.conversationKey
        ? usableBindings.get(guest.conversationKey)
        : undefined;
      const restoredLive = guest.liveness === 'live' && conversationId !== undefined;
      if (guest.liveness === 'live' && guest.conversationKey && !conversationId) {
        degradedConversationKeys.push(guest.conversationKey);
      }
      if (!restoredLive) {
        guestWriterSources.delete(guest.personaId);
      }
      personaGuests.set(guest.personaId, {
        personaId: guest.personaId,
        conversationId: restoredLive ? conversationId : undefined,
        lastSeenHostTurnId: guest.lastSeenHostTurnId,
        deliveredToHostThroughTurnId: guest.deliveredToHostThroughTurnId,
        liveness: restoredLive ? 'live' : 'disposed'
      });
    }

    const requestedTarget = cloneChatTarget(state.participants.chatTarget);
    const chatTarget: WorkshopChatTarget = requestedTarget.kind === 'tool'
      ? toolSidecars[requestedTarget.toolId]
        ? requestedTarget
        : { kind: 'host' }
      : requestedTarget.kind === 'personaGuest'
        ? personaGuests.get(requestedTarget.personaId)?.liveness === 'live'
          ? requestedTarget
          : { kind: 'host' }
        : requestedTarget;

    const activeHostPins = hostWriterSources.filter(
      (source) => source.kind === 'pin' && source.stale !== true
    );
    if (activeHostPins.length > 1) {
      throw new Error('Persisted Workshop state contains multiple live host pins');
    }
    const activeHostPin = hostConversationId ? activeHostPins[0] : undefined;
    const participants: WorkshopParticipants = {
      host: {
        personaId: state.participants.host.personaId,
        conversationId: hostConversationId
      },
      toolSidecars,
      personaGuests,
      chatTarget
    };
    const discardedConversationIds = this.conversationIds();

    // Synchronous field replacement after every validation/clone/remap step.
    this.excerpt = excerpt;
    this.contextAttachments = contextAttachments;
    this.excerptVersion = state.revisions.excerpt;
    this.replacementCount = state.revisions.replacementCount;
    this.contextRevision = state.revisions.context;
    this.pendingRevisionVersion = pendingRevisionVersion;
    this.pendingContextRevision = pendingContextRevision;
    this.attachmentCounter = state.counters.attachment;
    this.pendingMessageAttachments = pendingMessageAttachments;
    this.threadArtifactCounter = state.counters.threadArtifact;
    this.hostWriterSources = hostWriterSources;
    this.activeHostPin = activeHostPin;
    this.toolWriterSources = toolWriterSources;
    this.guestWriterSources = guestWriterSources;
    this.turns = turns;
    this.activeRun = undefined;
    this.participants = participants;
    this.selectedToolId = state.selectedToolId;
    this.turnCounter = state.counters.turn;
    this.todoCounter = state.counters.todo;
    this.todos = todos;
    this.behavior = behavior;
    this.lastCommittedPersonaBehavior = lastCommittedPersonaBehavior;

    return {
      discardedConversationIds,
      degradedConversationKeys
    };
  }

  getSnapshot(): WorkshopSessionSnapshot {
    const windowed = this.turns.slice(-WORKSHOP_SNAPSHOT_TURN_WINDOW);
    return {
      excerpt: this.excerpt ? excerptSnapshot(this.excerpt) : undefined,
      excerptVersion: this.excerptVersion,
      replacementCount: this.replacementCount,
      contextAttachments: this.contextAttachments.map(attachmentSnapshot),
      pendingMessageAttachments: this.pendingMessageAttachments.map(messageAttachmentSnapshot),
      pendingHostUpdate: this.pendingRevisionVersion !== undefined || this.pendingContextRevision !== undefined
        ? {
            excerptVersion: this.pendingRevisionVersion,
            context: this.pendingContextRevision !== undefined
          }
        : undefined,
      todos: this.todos.map((todo) => cloneTodo(todo, this.excerptVersion)),
      turns: windowed.map(cloneTurn),
      totalTurns: this.turns.length,
      truncatedTurns: this.turns.length - windowed.length,
      hasConversation: this.conversationIds().length > 0,
      participants: this.snapshotParticipants(),
      conversationBehavior: { ...this.behavior },
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
    guestPersonaId?: WorkshopPersonaId,
    messageAttachments?: readonly WorkshopMessageAttachmentSnapshot[]
  ): WorkshopTurn {
    const sidecar = toolId ? this.participants.toolSidecars[toolId] : undefined;
    const guest = guestPersonaId ? this.participants.personaGuests.get(guestPersonaId) : undefined;
    const behaviorMetadata = target === 'host' || target === 'personaGuest'
      ? this.currentPersonaBehaviorMetadata()
      : {};
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
      messageAttachments: messageAttachments && messageAttachments.length > 0
        ? messageAttachments.map(cloneMessageAttachmentSnapshot)
        : undefined,
      content: displayText,
      timestamp: this.now(),
      excerptVersion: this.excerptVersion,
      ...behaviorMetadata
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
      excerptVersion: this.excerptVersion,
      ...behaviorMetadata
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
    // A sidecar is a fresh conversation on adoption: its writer-origin rows
    // are exactly the pin + standing attachments its run received (Phase 7).
    // Replacement replaces the manifest with the conversation.
    const pin = this.pinEntry();
    this.toolWriterSources[toolId] = [
      ...(pin ? [pin] : []),
      ...this.contextAttachments.map((attachment) => this.attachmentEntry(attachment))
    ];
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

  private currentPersonaBehaviorMetadata(): Pick<WorkshopTurn, 'behavior' | 'behaviorTransition'> {
    const behavior = this.getConversationBehavior();
    const behaviorTransition = this.lastCommittedPersonaBehavior !== undefined
      && (
        this.lastCommittedPersonaBehavior.interactionMode !== behavior.interactionMode
        || this.lastCommittedPersonaBehavior.expressionLevel !== behavior.expressionLevel
        || this.lastCommittedPersonaBehavior.relationalDepth !== behavior.relationalDepth
      )
      ? {
          from: { ...this.lastCommittedPersonaBehavior },
          to: {
            interactionMode: behavior.interactionMode,
            expressionLevel: behavior.expressionLevel,
            relationalDepth: behavior.relationalDepth
          },
          reason: 'writer-selected' as const
        }
      : undefined;
    return { behavior, behaviorTransition };
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

function cloneWorkshopSessionState(state: WorkshopSessionStateV1): WorkshopSessionStateV1 {
  return {
    excerpt: state.excerpt ? cloneExcerpt(state.excerpt) : undefined,
    contextAttachments: state.contextAttachments.map(cloneAttachment),
    pendingMessageAttachments: state.pendingMessageAttachments.map(cloneMessageAttachment),
    revisions: { ...state.revisions },
    counters: { ...state.counters },
    writerSources: {
      host: state.writerSources.host.map(cloneSourceEntry),
      tools: cloneToolWriterSources(state.writerSources.tools),
      guests: state.writerSources.guests.map(({ personaId, sources }) => ({
        personaId,
        sources: sources.map(cloneSourceEntry)
      }))
    },
    turns: state.turns.map(cloneTurn),
    participants: {
      host: { ...state.participants.host },
      toolSidecars: state.participants.toolSidecars.map((sidecar) => ({ ...sidecar })),
      personaGuests: state.participants.personaGuests.map((guest) => ({ ...guest })),
      chatTarget: cloneChatTarget(state.participants.chatTarget)
    },
    selectedToolId: state.selectedToolId,
    todos: state.todos.map(cloneStoredTodo),
    lastCommittedPersonaBehavior: state.lastCommittedPersonaBehavior
      ? { ...state.lastCommittedPersonaBehavior }
      : undefined
  };
}

function assertWorkshopSessionStateShape(
  value: unknown
): asserts value is WorkshopSessionStateV1 {
  const state = exactObject(
    value,
    'Workshop session state',
    [
      'contextAttachments',
      'pendingMessageAttachments',
      'revisions',
      'counters',
      'writerSources',
      'turns',
      'participants',
      'todos'
    ],
    ['excerpt', 'selectedToolId', 'lastCommittedPersonaBehavior']
  );
  if (state.excerpt !== undefined) {
    assertExcerpt(state.excerpt, 'Workshop session state.excerpt');
  }
  arrayOf(state.contextAttachments, 'Workshop session state.contextAttachments', assertContextAttachment);
  arrayOf(
    state.pendingMessageAttachments,
    'Workshop session state.pendingMessageAttachments',
    assertMessageAttachment
  );
  assertRevisions(state.revisions);
  assertCounters(state.counters);
  assertWriterSources(state.writerSources);
  arrayOf(state.turns, 'Workshop session state.turns', assertTurn);
  assertParticipants(state.participants);
  if (state.selectedToolId !== undefined && !isWorkshopToolId(state.selectedToolId)) {
    shapeError('Workshop session state.selectedToolId', 'known Workshop tool id');
  }
  arrayOf(state.todos, 'Workshop session state.todos', assertStoredTodo);
  if (state.lastCommittedPersonaBehavior !== undefined) {
    assertLastCommittedBehavior(
      state.lastCommittedPersonaBehavior,
      'Workshop session state.lastCommittedPersonaBehavior'
    );
  }
}

function assertExcerpt(value: unknown, path: string): void {
  const excerpt = exactObject(
    value,
    path,
    ['text', 'version', 'source', 'pinnedAt'],
    ['truncation', 'sourceFingerprint']
  );
  stringAt(excerpt.text, `${path}.text`);
  numberAt(excerpt.version, `${path}.version`);
  assertExcerptSource(excerpt.source, `${path}.source`);
  numberAt(excerpt.pinnedAt, `${path}.pinnedAt`);
  if (excerpt.truncation !== undefined) {
    const truncation = exactObject(
      excerpt.truncation,
      `${path}.truncation`,
      ['pinnedWords', 'totalWords']
    );
    numberAt(truncation.pinnedWords, `${path}.truncation.pinnedWords`);
    numberAt(truncation.totalWords, `${path}.truncation.totalWords`);
  }
  optionalStringAt(excerpt.sourceFingerprint, `${path}.sourceFingerprint`);
}

function assertExcerptSource(value: unknown, path: string): void {
  const source = objectAt(value, path);
  if (source.kind === 'manual') {
    exactKeys(source, path, ['kind']);
    return;
  }
  if (source.kind === 'file') {
    exactKeys(source, path, ['kind', 'sourceUri', 'relativePath'], ['configuredResource']);
    stringAt(source.sourceUri, `${path}.sourceUri`);
    stringAt(source.relativePath, `${path}.relativePath`);
    assertOptionalConfiguredResource(source.configuredResource, `${path}.configuredResource`);
    return;
  }
  if (source.kind === 'editor-selection') {
    exactKeys(
      source,
      path,
      ['kind', 'sourceUri', 'relativePath'],
      ['startLine', 'endLine', 'configuredResource']
    );
    stringAt(source.sourceUri, `${path}.sourceUri`);
    stringAt(source.relativePath, `${path}.relativePath`);
    optionalNumberAt(source.startLine, `${path}.startLine`);
    optionalNumberAt(source.endLine, `${path}.endLine`);
    assertOptionalConfiguredResource(source.configuredResource, `${path}.configuredResource`);
    return;
  }
  shapeError(`${path}.kind`, 'manual, file, or editor-selection');
}

function assertContextAttachment(value: unknown, path: string): void {
  const attachment = exactObject(
    value,
    path,
    ['id', 'kind', 'origin', 'label', 'words', 'content', 'addedAt'],
    ['relativePath', 'configuredResource', 'truncation', 'sourceUri']
  );
  stringAt(attachment.id, `${path}.id`);
  enumAt(attachment.kind, `${path}.kind`, ['text', 'file']);
  enumAt(attachment.origin, `${path}.origin`, ['writer', 'wizard']);
  stringAt(attachment.label, `${path}.label`);
  numberAt(attachment.words, `${path}.words`);
  stringAt(attachment.content, `${path}.content`);
  numberAt(attachment.addedAt, `${path}.addedAt`);
  optionalStringAt(attachment.relativePath, `${path}.relativePath`);
  optionalStringAt(attachment.sourceUri, `${path}.sourceUri`);
  assertOptionalConfiguredResource(attachment.configuredResource, `${path}.configuredResource`);
  if (attachment.truncation !== undefined) {
    assertKeptWordTruncation(attachment.truncation, `${path}.truncation`);
  }
}

function assertMessageAttachment(value: unknown, path: string): void {
  const attachment = exactObject(
    value,
    path,
    ['id', 'label', 'words', 'content'],
    ['relativePath', 'configuredResource', 'truncation', 'sourceUri']
  );
  stringAt(attachment.id, `${path}.id`);
  stringAt(attachment.label, `${path}.label`);
  numberAt(attachment.words, `${path}.words`);
  stringAt(attachment.content, `${path}.content`);
  optionalStringAt(attachment.relativePath, `${path}.relativePath`);
  optionalStringAt(attachment.sourceUri, `${path}.sourceUri`);
  assertOptionalConfiguredResource(attachment.configuredResource, `${path}.configuredResource`);
  if (attachment.truncation !== undefined) {
    assertKeptWordTruncation(attachment.truncation, `${path}.truncation`);
  }
}

function assertKeptWordTruncation(value: unknown, path: string): void {
  const truncation = exactObject(value, path, ['keptWords', 'totalWords']);
  numberAt(truncation.keptWords, `${path}.keptWords`);
  numberAt(truncation.totalWords, `${path}.totalWords`);
}

function assertOptionalConfiguredResource(value: unknown, path: string): void {
  if (value === undefined) {
    return;
  }
  const resource = exactObject(value, path, ['group', 'path']);
  if (typeof resource.group !== 'string' || !isContextPathGroup(resource.group)) {
    shapeError(`${path}.group`, 'known context resource group');
  }
  stringAt(resource.path, `${path}.path`);
}

function assertRevisions(value: unknown): void {
  const revisions = exactObject(
    value,
    'Workshop session state.revisions',
    ['excerpt', 'replacementCount', 'context'],
    ['pendingExcerpt', 'pendingContext']
  );
  numberAt(revisions.excerpt, 'Workshop session state.revisions.excerpt');
  numberAt(revisions.replacementCount, 'Workshop session state.revisions.replacementCount');
  numberAt(revisions.context, 'Workshop session state.revisions.context');
  optionalNumberAt(revisions.pendingExcerpt, 'Workshop session state.revisions.pendingExcerpt');
  optionalNumberAt(revisions.pendingContext, 'Workshop session state.revisions.pendingContext');
}

function assertCounters(value: unknown): void {
  const counters = exactObject(
    value,
    'Workshop session state.counters',
    ['attachment', 'threadArtifact', 'turn', 'todo']
  );
  numberAt(counters.attachment, 'Workshop session state.counters.attachment');
  numberAt(counters.threadArtifact, 'Workshop session state.counters.threadArtifact');
  numberAt(counters.turn, 'Workshop session state.counters.turn');
  numberAt(counters.todo, 'Workshop session state.counters.todo');
}

function assertWriterSources(value: unknown): void {
  const sources = exactObject(
    value,
    'Workshop session state.writerSources',
    ['host', 'tools', 'guests']
  );
  arrayOf(sources.host, 'Workshop session state.writerSources.host', assertContextSource);
  const tools = objectAt(sources.tools, 'Workshop session state.writerSources.tools');
  for (const [toolId, entries] of Object.entries(tools)) {
    if (!isWorkshopToolId(toolId)) {
      shapeError(`Workshop session state.writerSources.tools.${toolId}`, 'known Workshop tool id');
    }
    arrayOf(
      entries,
      `Workshop session state.writerSources.tools.${toolId}`,
      assertContextSource
    );
  }
  arrayOf(
    sources.guests,
    'Workshop session state.writerSources.guests',
    (guestValue, guestPath) => {
      const guest = exactObject(guestValue, guestPath, ['personaId', 'sources']);
      if (!isWorkshopPersonaId(guest.personaId)) {
        shapeError(`${guestPath}.personaId`, 'known Workshop persona id');
      }
      arrayOf(guest.sources, `${guestPath}.sources`, assertContextSource);
    }
  );
}

function assertContextSource(value: unknown, path: string): void {
  const source = exactObject(
    value,
    path,
    ['kind', 'origin', 'label', 'sizeChars', 'isEstimate', 'deliveredAt'],
    [
      'configuredResource',
      'promptTokensDelta',
      'excerptVersion',
      'stale',
      'artifactId'
    ]
  );
  enumAt(
    source.kind,
    `${path}.kind`,
    ['pin', 'attachment', 'message-attachment', 'resource', 'tool-evidence', 'dictionary']
  );
  enumAt(source.origin, `${path}.origin`, ['writer', 'host', 'tool']);
  stringAt(source.label, `${path}.label`);
  numberAt(source.sizeChars, `${path}.sizeChars`);
  booleanAt(source.isEstimate, `${path}.isEstimate`);
  numberAt(source.deliveredAt, `${path}.deliveredAt`);
  assertOptionalConfiguredResource(source.configuredResource, `${path}.configuredResource`);
  optionalNumberAt(source.promptTokensDelta, `${path}.promptTokensDelta`);
  optionalNumberAt(source.excerptVersion, `${path}.excerptVersion`);
  optionalBooleanAt(source.stale, `${path}.stale`);
  optionalStringAt(source.artifactId, `${path}.artifactId`);
}

function assertTurn(value: unknown, path: string): void {
  const turn = exactObject(
    value,
    path,
    ['id', 'role', 'kind', 'participant', 'artifact', 'excerptVersion', 'content', 'timestamp'],
    [
      'toolId',
      'toolLabel',
      'personaId',
      'personaLabel',
      'reportTurnId',
      'capability',
      'actionableFindings',
      'messageAttachments',
      'usage',
      'truncated',
      'behavior',
      'behaviorTransition'
    ]
  );
  stringAt(turn.id, `${path}.id`);
  enumAt(turn.role, `${path}.role`, ['user', 'assistant', 'system']);
  enumAt(turn.kind, `${path}.kind`, ['tool_run', 'message', 'divider']);
  enumAt(turn.participant, `${path}.participant`, ['writer', 'host', 'guest', 'tool', 'session']);
  enumAt(
    turn.artifact,
    `${path}.artifact`,
    [
      'tool_request',
      'persona_message',
      'tool_report',
      'persona_synthesis',
      'direct_tool_message',
      'direct_tool_response',
      'dictionary_lookup',
      'dictionary_full_entry',
      'resource_catalog',
      'resource_search',
      'resource_read',
      'excerpt_revision',
      'context_change',
      'session_start',
      'session_resume'
    ]
  );
  numberAt(turn.excerptVersion, `${path}.excerptVersion`);
  stringAt(turn.content, `${path}.content`);
  numberAt(turn.timestamp, `${path}.timestamp`);
  if (turn.toolId !== undefined && !isWorkshopToolId(turn.toolId)) {
    shapeError(`${path}.toolId`, 'known Workshop tool id');
  }
  optionalStringAt(turn.toolLabel, `${path}.toolLabel`);
  if (turn.personaId !== undefined && !isWorkshopPersonaId(turn.personaId)) {
    shapeError(`${path}.personaId`, 'known Workshop persona id');
  }
  optionalStringAt(turn.personaLabel, `${path}.personaLabel`);
  optionalStringAt(turn.reportTurnId, `${path}.reportTurnId`);
  if (turn.capability !== undefined) {
    assertCapability(turn.capability, `${path}.capability`);
  }
  if (turn.actionableFindings !== undefined) {
    arrayOf(turn.actionableFindings, `${path}.actionableFindings`, assertFinding);
  }
  if (turn.messageAttachments !== undefined) {
    arrayOf(
      turn.messageAttachments,
      `${path}.messageAttachments`,
      assertMessageAttachmentSnapshot
    );
  }
  if (turn.usage !== undefined) {
    assertTokenUsage(turn.usage, `${path}.usage`);
  }
  optionalBooleanAt(turn.truncated, `${path}.truncated`);
  if (turn.behavior !== undefined) {
    assertBehavior(turn.behavior, `${path}.behavior`);
  }
  if (turn.behaviorTransition !== undefined) {
    assertBehaviorTransition(turn.behaviorTransition, `${path}.behaviorTransition`);
  }
}

function assertCapability(value: unknown, path: string): void {
  const capability = exactObject(
    value,
    path,
    ['operation', 'status', 'requestSummary', 'requestedByPersonaId'],
    ['metadata']
  );
  enumAt(
    capability.operation,
    `${path}.operation`,
    [
      'dictionary.lookup',
      'dictionary.full-entry',
      'analysis.run',
      'resource.catalog',
      'resource.search',
      'resource.read'
    ]
  );
  enumAt(
    capability.status,
    `${path}.status`,
    ['success', 'partial', 'failed', 'cancelled', 'rejected']
  );
  stringAt(capability.requestSummary, `${path}.requestSummary`);
  if (!isWorkshopPersonaId(capability.requestedByPersonaId)) {
    shapeError(`${path}.requestedByPersonaId`, 'known Workshop persona id');
  }
  if (capability.metadata !== undefined) {
    jsonObjectAt(capability.metadata, `${path}.metadata`);
  }
}

function assertFinding(value: unknown, path: string): void {
  const finding = exactObject(value, path, ['key', 'text', 'ordinal'], ['priority']);
  stringAt(finding.key, `${path}.key`);
  stringAt(finding.text, `${path}.text`);
  numberAt(finding.ordinal, `${path}.ordinal`);
  if (finding.priority !== undefined) {
    enumAt(finding.priority, `${path}.priority`, ['high', 'medium', 'low']);
  }
}

function assertMessageAttachmentSnapshot(value: unknown, path: string): void {
  const attachment = exactObject(
    value,
    path,
    ['id', 'label', 'words'],
    ['relativePath', 'configuredResource', 'truncation']
  );
  stringAt(attachment.id, `${path}.id`);
  stringAt(attachment.label, `${path}.label`);
  numberAt(attachment.words, `${path}.words`);
  optionalStringAt(attachment.relativePath, `${path}.relativePath`);
  assertOptionalConfiguredResource(attachment.configuredResource, `${path}.configuredResource`);
  if (attachment.truncation !== undefined) {
    assertKeptWordTruncation(attachment.truncation, `${path}.truncation`);
  }
}

function assertTokenUsage(value: unknown, path: string): void {
  const usage = exactObject(
    value,
    path,
    ['promptTokens', 'completionTokens', 'totalTokens'],
    ['requestCount', 'costUsd', 'isEstimate']
  );
  numberAt(usage.promptTokens, `${path}.promptTokens`);
  numberAt(usage.completionTokens, `${path}.completionTokens`);
  numberAt(usage.totalTokens, `${path}.totalTokens`);
  optionalNumberAt(usage.requestCount, `${path}.requestCount`);
  optionalNumberAt(usage.costUsd, `${path}.costUsd`);
  optionalBooleanAt(usage.isEstimate, `${path}.isEstimate`);
}

function assertBehavior(value: unknown, path: string): void {
  const behavior = exactObject(
    value,
    path,
    ['interactionMode', 'expressionLevel', 'relationalDepth', 'carryCuesThroughSession']
  );
  if (!isWorkshopInteractionMode(behavior.interactionMode)) {
    shapeError(`${path}.interactionMode`, 'valid Workshop interaction mode');
  }
  if (!isWorkshopPersonaExpressionLevel(behavior.expressionLevel)) {
    shapeError(`${path}.expressionLevel`, 'valid Workshop expression level');
  }
  if (!isWorkshopRelationalDepth(behavior.relationalDepth)) {
    shapeError(`${path}.relationalDepth`, 'valid Workshop relational depth');
  }
  booleanAt(behavior.carryCuesThroughSession, `${path}.carryCuesThroughSession`);
}

function assertLastCommittedBehavior(value: unknown, path: string): void {
  const behavior = exactObject(
    value,
    path,
    ['interactionMode', 'expressionLevel', 'relationalDepth']
  );
  if (!isWorkshopInteractionMode(behavior.interactionMode)) {
    shapeError(`${path}.interactionMode`, 'valid Workshop interaction mode');
  }
  if (!isWorkshopPersonaExpressionLevel(behavior.expressionLevel)) {
    shapeError(`${path}.expressionLevel`, 'valid Workshop expression level');
  }
  if (!isWorkshopRelationalDepth(behavior.relationalDepth)) {
    shapeError(`${path}.relationalDepth`, 'valid Workshop relational depth');
  }
}

function assertBehaviorTransition(value: unknown, path: string): void {
  const transition = exactObject(value, path, ['from', 'to', 'reason']);
  assertLastCommittedBehavior(transition.from, `${path}.from`);
  assertLastCommittedBehavior(transition.to, `${path}.to`);
  if (transition.reason !== 'writer-selected') {
    shapeError(`${path}.reason`, 'writer-selected');
  }
}

function assertParticipants(value: unknown): void {
  const participants = exactObject(
    value,
    'Workshop session state.participants',
    ['host', 'toolSidecars', 'personaGuests', 'chatTarget']
  );
  const host = exactObject(
    participants.host,
    'Workshop session state.participants.host',
    ['personaId'],
    ['conversationKey']
  );
  if (!isWorkshopPersonaId(host.personaId)) {
    shapeError('Workshop session state.participants.host.personaId', 'known Workshop persona id');
  }
  if (host.conversationKey !== undefined && host.conversationKey !== 'host') {
    shapeError('Workshop session state.participants.host.conversationKey', 'host');
  }
  arrayOf(
    participants.toolSidecars,
    'Workshop session state.participants.toolSidecars',
    (sidecarValue, sidecarPath) => {
      const sidecar = exactObject(
        sidecarValue,
        sidecarPath,
        ['toolId', 'conversationKey', 'latestReportTurnId', 'deliveredToHostThroughTurnId']
      );
      if (!isWorkshopToolId(sidecar.toolId)) {
        shapeError(`${sidecarPath}.toolId`, 'known Workshop tool id');
      }
      stringAt(sidecar.conversationKey, `${sidecarPath}.conversationKey`);
      stringAt(sidecar.latestReportTurnId, `${sidecarPath}.latestReportTurnId`);
      stringAt(sidecar.deliveredToHostThroughTurnId, `${sidecarPath}.deliveredToHostThroughTurnId`);
    }
  );
  arrayOf(
    participants.personaGuests,
    'Workshop session state.participants.personaGuests',
    (guestValue, guestPath) => {
      const guest = exactObject(
        guestValue,
        guestPath,
        ['personaId', 'liveness'],
        ['conversationKey', 'lastSeenHostTurnId', 'deliveredToHostThroughTurnId']
      );
      if (!isWorkshopPersonaId(guest.personaId)) {
        shapeError(`${guestPath}.personaId`, 'known Workshop persona id');
      }
      enumAt(guest.liveness, `${guestPath}.liveness`, ['live', 'disposed']);
      optionalStringAt(guest.conversationKey, `${guestPath}.conversationKey`);
      optionalStringAt(guest.lastSeenHostTurnId, `${guestPath}.lastSeenHostTurnId`);
      optionalStringAt(
        guest.deliveredToHostThroughTurnId,
        `${guestPath}.deliveredToHostThroughTurnId`
      );
    }
  );
  assertChatTarget(participants.chatTarget, 'Workshop session state.participants.chatTarget');
}

function assertChatTarget(value: unknown, path: string): void {
  const target = objectAt(value, path);
  if (target.kind === 'host') {
    exactKeys(target, path, ['kind']);
    return;
  }
  if (target.kind === 'tool') {
    exactKeys(target, path, ['kind', 'toolId']);
    if (!isWorkshopToolId(target.toolId)) {
      shapeError(`${path}.toolId`, 'known Workshop tool id');
    }
    return;
  }
  if (target.kind === 'personaGuest') {
    exactKeys(target, path, ['kind', 'personaId']);
    if (!isWorkshopPersonaId(target.personaId)) {
      shapeError(`${path}.personaId`, 'known Workshop persona id');
    }
    return;
  }
  shapeError(`${path}.kind`, 'host, tool, or personaGuest');
}

function assertStoredTodo(value: unknown, path: string): void {
  const todo = exactObject(
    value,
    path,
    ['id', 'text', 'status', 'source', 'createdAt'],
    ['priority', 'writerEdit']
  );
  stringAt(todo.id, `${path}.id`);
  stringAt(todo.text, `${path}.text`);
  enumAt(todo.status, `${path}.status`, ['open', 'completed', 'dismissed']);
  if (todo.priority !== undefined) {
    enumAt(todo.priority, `${path}.priority`, ['high', 'medium', 'low']);
  }
  assertTodoSource(todo.source, `${path}.source`);
  numberAt(todo.createdAt, `${path}.createdAt`);
  if (todo.writerEdit !== undefined) {
    const writerEdit = exactObject(
      todo.writerEdit,
      `${path}.writerEdit`,
      ['originalText', 'editedAt']
    );
    stringAt(writerEdit.originalText, `${path}.writerEdit.originalText`);
    numberAt(writerEdit.editedAt, `${path}.writerEdit.editedAt`);
  }
}

function assertTodoSource(value: unknown, path: string): void {
  const source = objectAt(value, path);
  const baseRequired = [
    'kind',
    'turnId',
    'participantLabel',
    'findingKey',
    'findingText',
    'excerptVersion'
  ];
  if (source.kind === 'tool_report') {
    exactKeys(source, path, [...baseRequired, 'toolId']);
    if (!isWorkshopToolId(source.toolId)) {
      shapeError(`${path}.toolId`, 'known Workshop tool id');
    }
  } else if (source.kind === 'host_turn') {
    exactKeys(source, path, [...baseRequired, 'personaId'], ['upstreamReportTurnId']);
    if (!isWorkshopPersonaId(source.personaId)) {
      shapeError(`${path}.personaId`, 'known Workshop persona id');
    }
    optionalStringAt(source.upstreamReportTurnId, `${path}.upstreamReportTurnId`);
  } else {
    shapeError(`${path}.kind`, 'tool_report or host_turn');
  }
  stringAt(source.turnId, `${path}.turnId`);
  stringAt(source.participantLabel, `${path}.participantLabel`);
  stringAt(source.findingKey, `${path}.findingKey`);
  stringAt(source.findingText, `${path}.findingText`);
  numberAt(source.excerptVersion, `${path}.excerptVersion`);
}

function exactObject(
  value: unknown,
  path: string,
  required: readonly string[],
  optional: readonly string[] = []
): Record<string, unknown> {
  const object = objectAt(value, path);
  exactKeys(object, path, required, optional);
  return object;
}

function objectAt(value: unknown, path: string): Record<string, unknown> {
  if (
    typeof value !== 'object'
    || value === null
    || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype
  ) {
    shapeError(path, 'plain object');
  }
  return value as Record<string, unknown>;
}

function exactKeys(
  object: Record<string, unknown>,
  path: string,
  required: readonly string[],
  optional: readonly string[] = []
): void {
  const allowed = new Set([...required, ...optional]);
  const unknown = Object.keys(object).find((key) => !allowed.has(key));
  if (unknown) {
    throw new Error(`${path} contains unknown field ${unknown}`);
  }
  const missing = required.find(
    (key) => !Object.prototype.hasOwnProperty.call(object, key) || object[key] === undefined
  );
  if (missing) {
    throw new Error(`${path} is missing required field ${missing}`);
  }
}

function arrayOf(
  value: unknown,
  path: string,
  assertItem: (item: unknown, itemPath: string) => void
): void {
  if (!Array.isArray(value)) {
    shapeError(path, 'array');
  }
  value.forEach((item, index) => assertItem(item, `${path}[${index}]`));
}

function stringAt(value: unknown, path: string): void {
  if (typeof value !== 'string') {
    shapeError(path, 'string');
  }
}

function optionalStringAt(value: unknown, path: string): void {
  if (value !== undefined) {
    stringAt(value, path);
  }
}

function numberAt(value: unknown, path: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    shapeError(path, 'finite number');
  }
}

function optionalNumberAt(value: unknown, path: string): void {
  if (value !== undefined) {
    numberAt(value, path);
  }
}

function booleanAt(value: unknown, path: string): void {
  if (typeof value !== 'boolean') {
    shapeError(path, 'boolean');
  }
}

function optionalBooleanAt(value: unknown, path: string): void {
  if (value !== undefined) {
    booleanAt(value, path);
  }
}

function enumAt(value: unknown, path: string, allowed: readonly string[]): void {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    shapeError(path, allowed.join(' | '));
  }
}

function jsonObjectAt(value: unknown, path: string): void {
  objectAt(value, path);
  assertJsonValue(value, path);
}

function assertJsonValue(value: unknown, path: string): void {
  if (
    value === null
    || typeof value === 'string'
    || typeof value === 'boolean'
  ) {
    return;
  }
  if (typeof value === 'number') {
    numberAt(value, path);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertJsonValue(item, `${path}[${index}]`));
    return;
  }
  const object = objectAt(value, path);
  for (const [key, nested] of Object.entries(object)) {
    assertJsonValue(nested, `${path}.${key}`);
  }
}

function shapeError(path: string, expected: string): never {
  throw new Error(`${path} must be ${expected}`);
}

function validatePersistedState(state: WorkshopSessionStateV1): void {
  const requireCounter = (value: number, label: string): void => {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`Persisted Workshop ${label} must be a non-negative safe integer`);
    }
  };
  requireCounter(state.revisions.excerpt, 'excerpt revision');
  requireCounter(state.revisions.replacementCount, 'replacement count');
  requireCounter(state.revisions.context, 'context revision');
  requireCounter(state.counters.attachment, 'attachment counter');
  requireCounter(state.counters.threadArtifact, 'thread-artifact counter');
  requireCounter(state.counters.turn, 'turn counter');
  requireCounter(state.counters.todo, 'todo counter');

  if (state.excerpt) {
    if (state.excerpt.version !== state.revisions.excerpt) {
      throw new Error('Persisted Workshop excerpt version does not match its revision counter');
    }
  } else if (state.revisions.excerpt !== 0) {
    throw new Error('Persisted Workshop state has an excerpt revision without an excerpt');
  }
  if (
    state.revisions.pendingExcerpt !== undefined
    && state.revisions.pendingExcerpt !== state.revisions.excerpt
  ) {
    throw new Error('Persisted Workshop pending excerpt revision is not current');
  }
  if (
    state.revisions.pendingContext !== undefined
    && (
      !Number.isSafeInteger(state.revisions.pendingContext)
      || state.revisions.pendingContext < 1
      || state.revisions.pendingContext > state.revisions.context
    )
  ) {
    throw new Error('Persisted Workshop pending context revision is invalid');
  }

  const attachmentIds = new Set<string>();
  let greatestAttachmentNumber = 0;
  for (const attachment of state.contextAttachments) {
    if (attachmentIds.has(attachment.id)) {
      throw new Error(`Duplicate persisted Workshop context attachment ${attachment.id}`);
    }
    attachmentIds.add(attachment.id);
    greatestAttachmentNumber = Math.max(
      greatestAttachmentNumber,
      numericIdSuffix(attachment.id, /^ctx-(\d+)$/, 'context attachment')
    );
  }
  if (greatestAttachmentNumber > state.counters.attachment) {
    throw new Error('Persisted Workshop attachment counter trails an existing id');
  }

  const turnIds = new Set<string>();
  let greatestTurnNumber = 0;
  let greatestThreadArtifactNumber = 0;
  for (const turn of state.turns) {
    if (turnIds.has(turn.id)) {
      throw new Error(`Duplicate persisted Workshop turn ${turn.id}`);
    }
    turnIds.add(turn.id);
    greatestTurnNumber = Math.max(
      greatestTurnNumber,
      numericIdSuffix(
        turn.id,
        /^turn-(\d+)-(?:user|assistant|system)-\d+$/,
        'turn'
      )
    );
    for (const attachment of turn.messageAttachments ?? []) {
      greatestThreadArtifactNumber = Math.max(
        greatestThreadArtifactNumber,
        numericIdSuffix(attachment.id, /^ta-(\d+)$/, 'thread artifact')
      );
    }
  }
  if (greatestTurnNumber > state.counters.turn) {
    throw new Error('Persisted Workshop turn counter trails an existing id');
  }

  const pendingMessageIds = new Set<string>();
  for (const attachment of state.pendingMessageAttachments) {
    if (pendingMessageIds.has(attachment.id)) {
      throw new Error(`Duplicate persisted Workshop pending message attachment ${attachment.id}`);
    }
    pendingMessageIds.add(attachment.id);
    greatestThreadArtifactNumber = Math.max(
      greatestThreadArtifactNumber,
      numericIdSuffix(attachment.id, /^ta-(\d+)$/, 'thread artifact')
    );
  }
  if (greatestThreadArtifactNumber > state.counters.threadArtifact) {
    throw new Error('Persisted Workshop thread-artifact counter trails an existing id');
  }

  const todoIds = new Set<string>();
  let greatestTodoNumber = 0;
  for (const todo of state.todos) {
    if (todoIds.has(todo.id)) {
      throw new Error(`Duplicate persisted Workshop task ${todo.id}`);
    }
    todoIds.add(todo.id);
    greatestTodoNumber = Math.max(
      greatestTodoNumber,
      numericIdSuffix(todo.id, /^todo-(\d+)-\d+$/, 'task')
    );
    if (!turnIds.has(todo.source.turnId)) {
      throw new Error(`Persisted Workshop task ${todo.id} references an unknown turn`);
    }
  }
  if (greatestTodoNumber > state.counters.todo) {
    throw new Error('Persisted Workshop task counter trails an existing id');
  }

  if (!isWorkshopPersonaId(state.participants.host.personaId)) {
    throw new Error('Persisted Workshop host persona is invalid');
  }
  if (
    state.participants.host.conversationKey !== undefined
    && state.participants.host.conversationKey !== 'host'
  ) {
    throw new Error('Persisted Workshop host conversation key is invalid');
  }

  const toolIds = new Set<WorkshopToolId>();
  for (const sidecar of state.participants.toolSidecars) {
    if (!isWorkshopToolId(sidecar.toolId) || toolIds.has(sidecar.toolId)) {
      throw new Error(`Duplicate or invalid persisted Workshop tool sidecar ${String(sidecar.toolId)}`);
    }
    toolIds.add(sidecar.toolId);
    if (sidecar.conversationKey !== `tool:${sidecar.toolId}`) {
      throw new Error(`Persisted Workshop tool ${sidecar.toolId} has the wrong conversation key`);
    }
    const report = state.turns.find((turn) => turn.id === sidecar.latestReportTurnId);
    if (
      !report
      || report.artifact !== 'tool_report'
      || report.toolId !== sidecar.toolId
    ) {
      throw new Error(`Persisted Workshop tool ${sidecar.toolId} has an invalid latest report`);
    }
    if (!turnIds.has(sidecar.deliveredToHostThroughTurnId)) {
      throw new Error(`Persisted Workshop tool ${sidecar.toolId} has an invalid delivery cursor`);
    }
  }

  const guestIds = new Set<WorkshopPersonaId>();
  for (const guest of state.participants.personaGuests) {
    if (!isWorkshopPersonaId(guest.personaId) || guestIds.has(guest.personaId)) {
      throw new Error(`Duplicate or invalid persisted Workshop guest ${String(guest.personaId)}`);
    }
    guestIds.add(guest.personaId);
    const expectedKey = `guest:${guest.personaId}`;
    if (guest.conversationKey !== undefined && guest.conversationKey !== expectedKey) {
      throw new Error(`Persisted Workshop guest ${guest.personaId} has the wrong conversation key`);
    }
    if (guest.liveness === 'live' && guest.conversationKey === undefined) {
      throw new Error(`Persisted live Workshop guest ${guest.personaId} has no conversation key`);
    }
    for (const cursor of [guest.lastSeenHostTurnId, guest.deliveredToHostThroughTurnId]) {
      if (cursor !== undefined && !turnIds.has(cursor)) {
        throw new Error(`Persisted Workshop guest ${guest.personaId} has an invalid delivery cursor`);
      }
    }
  }

  const writerSourceGuests = new Set<WorkshopPersonaId>();
  for (const guest of state.writerSources.guests) {
    if (!isWorkshopPersonaId(guest.personaId) || writerSourceGuests.has(guest.personaId)) {
      throw new Error(`Duplicate or invalid persisted Workshop guest manifest ${String(guest.personaId)}`);
    }
    writerSourceGuests.add(guest.personaId);
  }
  for (const rawToolId of Object.keys(state.writerSources.tools)) {
    if (!isWorkshopToolId(rawToolId)) {
      throw new Error(`Invalid persisted Workshop tool manifest ${rawToolId}`);
    }
  }

  const target = state.participants.chatTarget;
  if (target.kind === 'tool' && !toolIds.has(target.toolId)) {
    throw new Error('Persisted Workshop chat target references an unknown tool sidecar');
  }
  if (
    target.kind === 'personaGuest'
    && !state.participants.personaGuests.some(
      (guest) => guest.personaId === target.personaId && guest.liveness === 'live'
    )
  ) {
    throw new Error('Persisted Workshop chat target references a non-live guest');
  }
}

function numericIdSuffix(id: string, pattern: RegExp, label: string): number {
  const match = pattern.exec(id);
  const value = match ? Number(match[1]) : Number.NaN;
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`Persisted Workshop ${label} id is invalid: ${id}`);
  }
  return value;
}

function usableRuntimeBindings(
  bindings: WorkshopRuntimeConversationBindings
): Map<WorkshopConversationLogicalKey, string> {
  const candidates = Object.entries(bindings).flatMap(([rawKey, rawId]) => {
    if (typeof rawId !== 'string' || rawId.trim().length === 0) {
      return [];
    }
    return [{
      key: rawKey as WorkshopConversationLogicalKey,
      conversationId: rawId
    }];
  });
  const counts = new Map<string, number>();
  for (const { conversationId } of candidates) {
    counts.set(conversationId, (counts.get(conversationId) ?? 0) + 1);
  }
  return new Map(
    candidates
      .filter(({ conversationId }) => counts.get(conversationId) === 1)
      .map(({ key, conversationId }) => [key, conversationId])
  );
}

function cloneToolWriterSources(
  sources: Partial<Record<WorkshopToolId, ContextSourceEntry[]>>
): Partial<Record<WorkshopToolId, ContextSourceEntry[]>> {
  return Object.fromEntries(
    Object.entries(sources).flatMap(([toolId, entries]) =>
      entries ? [[toolId, entries.map(cloneSourceEntry)]] : []
    )
  ) as Partial<Record<WorkshopToolId, ContextSourceEntry[]>>;
}

function cloneChatTarget(target: WorkshopChatTarget): WorkshopChatTarget {
  if (target.kind === 'tool') {
    return { kind: 'tool', toolId: target.toolId };
  }
  if (target.kind === 'personaGuest') {
    return { kind: 'personaGuest', personaId: target.personaId };
  }
  return { kind: 'host' };
}

function cloneTurn(turn: WorkshopTurn): WorkshopTurn {
  return {
    ...turn,
    behavior: turn.behavior ? { ...turn.behavior } : undefined,
    behaviorTransition: turn.behaviorTransition
      ? {
          ...turn.behaviorTransition,
          from: { ...turn.behaviorTransition.from },
          to: { ...turn.behaviorTransition.to }
        }
      : undefined,
    usage: turn.usage ? { ...turn.usage } : undefined,
    capability: turn.capability ? cloneCapabilityDetails(turn.capability) : undefined,
    actionableFindings: turn.actionableFindings
      ? cloneFindings(turn.actionableFindings)
      : undefined,
    messageAttachments: turn.messageAttachments
      ? turn.messageAttachments.map(cloneMessageAttachmentSnapshot)
      : undefined
  };
}

function cloneSourceEntry(entry: ContextSourceEntry): ContextSourceEntry {
  return {
    ...entry,
    configuredResource: entry.configuredResource ? { ...entry.configuredResource } : undefined
  };
}

function cloneMessageAttachmentSnapshot(
  snapshot: WorkshopMessageAttachmentSnapshot
): WorkshopMessageAttachmentSnapshot {
  return {
    ...snapshot,
    configuredResource: snapshot.configuredResource ? { ...snapshot.configuredResource } : undefined,
    truncation: snapshot.truncation ? { ...snapshot.truncation } : undefined
  };
}

function cloneMessageAttachmentInput(
  input: WorkshopMessageAttachmentInput
): WorkshopMessageAttachmentInput {
  return {
    ...input,
    configuredResource: input.configuredResource ? { ...input.configuredResource } : undefined,
    truncation: input.truncation ? { ...input.truncation } : undefined
  };
}

function cloneMessageAttachment(attachment: WorkshopMessageAttachment): WorkshopMessageAttachment {
  return {
    ...attachment,
    configuredResource: attachment.configuredResource ? { ...attachment.configuredResource } : undefined,
    truncation: attachment.truncation ? { ...attachment.truncation } : undefined
  };
}

/** Webview projection: strips content and the host-private sourceUri. */
function messageAttachmentSnapshot(
  attachment: WorkshopMessageAttachment
): WorkshopMessageAttachmentSnapshot {
  const { content: _content, sourceUri: _sourceUri, ...snapshot } = cloneMessageAttachment(attachment);
  return snapshot;
}

function cloneFindings(findings: readonly WorkshopActionableFinding[]): WorkshopActionableFinding[] {
  return findings.map((finding) => ({ ...finding }));
}

function cloneStoredTodo(todo: StoredWorkshopTodoItem): StoredWorkshopTodoItem {
  return {
    ...todo,
    source: { ...todo.source },
    writerEdit: todo.writerEdit ? { ...todo.writerEdit } : undefined
  };
}

function cloneTodo(todo: StoredWorkshopTodoItem, excerptVersion: number): WorkshopTodoItem {
  return {
    ...cloneStoredTodo(todo),
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

function cloneAttachmentInput(input: WorkshopContextAttachmentInput): WorkshopContextAttachmentInput {
  return {
    ...input,
    configuredResource: input.configuredResource ? { ...input.configuredResource } : undefined,
    truncation: input.truncation ? { ...input.truncation } : undefined
  };
}

function cloneAttachment(attachment: WorkshopContextAttachment): WorkshopContextAttachment {
  return {
    ...attachment,
    configuredResource: attachment.configuredResource ? { ...attachment.configuredResource } : undefined,
    truncation: attachment.truncation ? { ...attachment.truncation } : undefined
  };
}

/**
 * Webview projection: strips the host-private sourceUri always, and content
 * for FILE attachments (re-readable from disk, potentially large). Text
 * attachments keep their content — the pill is the note's only home.
 */
function attachmentSnapshot(attachment: WorkshopContextAttachment): WorkshopContextAttachmentSnapshot {
  const { content, sourceUri: _sourceUri, ...snapshot } = cloneAttachment(attachment);
  return attachment.kind === 'text' ? { ...snapshot, content } : snapshot;
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

/** Snapshot boundary: sourceUri is an internal file-read capability, never webview data. */
function excerptSnapshot(excerpt: WorkshopExcerpt): WorkshopExcerptSnapshot {
  const { sourceFingerprint: _sourceFingerprint, source, ...snapshot } = excerpt;
  if (source.kind === 'manual') {
    return { ...snapshot, source: { kind: 'manual' } };
  }
  const { sourceUri: _sourceUri, ...displaySource } = source;
  return {
    ...snapshot,
    source: {
      ...displaySource,
      configuredResource: source.configuredResource ? { ...source.configuredResource } : undefined
    }
  };
}
