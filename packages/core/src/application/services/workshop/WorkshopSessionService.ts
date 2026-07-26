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
  workshopExcerptTitle,
  WorkshopMessageAttachmentSnapshot,
  WorkshopPersonaId,
  WorkshopPersonaGuestSnapshot,
  WorkshopParticipantsSnapshot,
  WorkshopSelectableSessionScope,
  WorkshopSessionScope,
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
  WorkshopAnalysisInputProvenance,
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
import {
  WORKSHOP_ACTIONABLE_FINDING_BOUNDS
} from '@/application/services/workshop/WorkshopActionableFindings';
import { WORKSHOP_TODO_BOUNDS } from '@/application/services/workshop/WorkshopSessionLimits';
import {
  WorkshopConversationLogicalKey,
  WorkshopRuntimeConversationBindings,
  WorkshopSessionStateV1,
  WorkshopStoredTodoItemV1
} from '@/application/services/workshop/WorkshopSessionStateV1';
import {
  validateWorkshopSessionStateV1
} from '@/application/services/workshop/WorkshopSessionStateV1Integrity';
import {
  migrateWorkshopSessionStateV1ForHydration,
  WorkshopSessionHydrationMigration
} from '@/application/services/workshop/WorkshopSessionStateV1Migration';
export type {
  WorkshopSessionHydrationMigration
} from '@/application/services/workshop/WorkshopSessionStateV1Migration';

export { WORKSHOP_TODO_BOUNDS } from '@/application/services/workshop/WorkshopSessionLimits';

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

export type WorkshopContextAttachmentUpdateResult =
  | { ok: true; attachment: WorkshopContextAttachment; eventTurn?: WorkshopTurn }
  | {
      ok: false;
      reason: 'unknown' | 'not-editable' | 'over-budget';
      remainingWords: number;
    };

/**
 * A text note's display label is its first meaningful line (Sprint 13A §6) —
 * the writer's own heading, not a truncated word salad. Leading markdown
 * heading marks are stripped so `# Kayla — running notes` reads as a title.
 */
export function workshopTextNoteLabel(text: string): string {
  const firstLine = text.split('\n').map((line) => line.trim()).find((line) => line.length > 0);
  const label = (firstLine ?? '').replace(/^#{1,6}\s*/, '').trim().slice(0, 38);
  return label.length > 0 ? label : 'Text note';
}

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

/**
 * The result of one session-scope transition. Every field describes state the
 * caller must broadcast. A transition never discards the passage, and it can
 * only happen before the room has a memory (ADR 2026-07-25) — which is why it
 * carries no divider turn: no participant experienced it.
 */
export interface WorkshopScopeTransition {
  scope: WorkshopSessionScope;
  /** False when the request was a no-op (already in that scope). */
  changed: boolean;
  /** The excerpt now pinned, if any. */
  excerpt?: WorkshopExcerpt;
  /** The excerpt now on the shelf, if any. */
  shelvedExcerpt?: WorkshopExcerpt;
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
  truncated?: boolean;
  actionableFindings?: WorkshopActionableFinding[];
}

export interface WorkshopExcerptReplacement {
  excerpt: WorkshopExcerpt;
  disposedConversationIds: string[];
  dividerTurn?: WorkshopTurn;
  retiredSidecarCount: number;
  replacementCount: number;
  /**
   * The set-aside passage this pin destroyed, when it displaced one. The shelf
   * holds exactly one passage and no history, so this is the only record the
   * caller gets — it belongs in the log and in the divider.
   */
  discardedShelvedExcerpt?: WorkshopExcerpt;
}


export interface WorkshopSessionHydrationResult {
  discardedConversationIds: string[];
  degradedConversationKeys: WorkshopConversationLogicalKey[];
  migrations: WorkshopSessionHydrationMigration[];
}

export class WorkshopSessionActiveRunPersistenceError extends Error {
  constructor() {
    super('Cannot persist Workshop session while a run is active');
    this.name = 'WorkshopSessionActiveRunPersistenceError';
  }
}

/**
 * Domain refusal for an attempted path change after participant memory exists.
 * Presentation adapters decide how to explain the recovery path to a writer.
 */
export class WorkshopScopeLockedError extends Error {
  readonly code = 'workshop-scope-locked';

  constructor(readonly attempt: string) {
    super(`Cannot ${attempt}: this room already has a conversation`);
    this.name = 'WorkshopScopeLockedError';
  }
}

type StoredWorkshopTodoItem = WorkshopStoredTodoItemV1;

/** A pure aggregate: no I/O, no vscode, and only an injectable clock. */
export class WorkshopSessionService {
  private excerpt?: WorkshopExcerpt;
  /**
   * Explicit session scope (Sprint 13A). `null` until the writer picks a path.
   * Assigned by writer actions — choosing a path, pinning, running a tool —
   * and never derived from `this.excerpt` being set.
   */
  private scope: WorkshopSessionScope = null;
  /**
   * The passage set aside when the writer switched to open conversation.
   * Shelved, not deleted: `excerptVersion` is deliberately NOT bumped across
   * shelve/re-pin, so turn and task staleness stay truthful about which text
   * each one was written against.
   */
  private shelvedExcerpt?: WorkshopExcerpt;
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

  getScope(): WorkshopSessionScope {
    return this.scope;
  }

  getShelvedExcerpt(): WorkshopExcerpt | undefined {
    return this.shelvedExcerpt ? cloneExcerpt(this.shelvedExcerpt) : undefined;
  }

  /**
   * True once any participant holds or has held a conversation — the host, a
   * tool sidecar, or a persona guest. This is the scope lock
   * (ADR 2026-07-25).
   *
   * Deliberately NOT "does the room have any turn". Every session records a
   * `session_start` marker before the writer does anything, and a resumed
   * session records `session_resume`, so a turn-based lock would fire the
   * instant a session was created and strand the writer on the path chooser
   * with no way to choose. Ledger events append to `turns` and never touch
   * `participants`, so no temporal frame can move this. A disposed guest stays
   * in the participant map as a tombstone, preserving the lock after its
   * provider conversation is discarded. Host/tool degradation is different:
   * a failed runtime rebind leaves no retained model memory, so those missing
   * live bindings do not lock; the persistence coordinator logs that loss.
   */
  hasRoomMemory(): boolean {
    return this.conversationIds().length > 0
      || this.participants.personaGuests.size > 0;
  }

  /** Scope is immutable once someone's memory depends on it (ADR 2026-07-25). */
  private requireUnlockedScope(attempt: string): void {
    if (this.hasRoomMemory()) {
      throw new WorkshopScopeLockedError(attempt);
    }
  }

  /**
   * Choose the session path, or change it while the room has no memory yet
   * (ADR 2026-07-25, superseding Sprint 13A §4).
   *
   * Because no participant has been prompted, a change here is invisible to
   * everyone: there is nothing to withdraw, nothing to re-deliver, and no
   * divider to record, since no one experienced the transition. `open` shelves
   * a pinned passage rather than deleting it; `excerpt` takes it back.
   */
  setSessionScope(scope: WorkshopSelectableSessionScope): WorkshopScopeTransition {
    // The no-op check deliberately precedes the lock: reconciling a stale
    // caller with the room's CURRENT path is safe even after memory exists.
    if (this.isIdempotentScopeRequest(scope)) {
      return this.scopeTransition(false);
    }
    this.requireUnlockedScope(
      scope === 'open'
        ? 'set this session to an open conversation'
        : 'start a passage session'
    );

    if (scope === 'open') {
      const shelved = this.excerpt;
      this.scope = 'open';
      if (shelved) {
        this.shelvedExcerpt = shelved;
        this.excerpt = undefined;
        this.pendingRevisionVersion = undefined;
      }
      return this.scopeTransition(true);
    }

    const restored = this.excerpt ?? this.shelvedExcerpt;
    if (!restored) {
      throw new Error('Cannot start a passage session without an excerpt');
    }
    this.adoptShelvedExcerpt(restored);
    this.scope = 'excerpt';
    return this.scopeTransition(true);
  }

  private isIdempotentScopeRequest(scope: WorkshopSelectableSessionScope): boolean {
    return scope === 'open'
      ? this.scope === 'open' && this.excerpt === undefined
      : this.scope === 'excerpt' && this.excerpt !== undefined;
  }

  /** Take the set-aside passage back off the shelf, before the room has a memory. */
  repinShelvedExcerpt(): WorkshopScopeTransition {
    const shelved = this.shelvedExcerpt;
    if (!shelved) {
      throw new Error('No Workshop excerpt is on the shelf');
    }
    if (this.excerpt) {
      throw new Error('An excerpt is already pinned in this Workshop session');
    }
    this.requireUnlockedScope('re-pin the set-aside excerpt');
    this.adoptShelvedExcerpt(shelved);
    this.scope = 'excerpt';
    return this.scopeTransition(true);
  }

  private adoptShelvedExcerpt(excerpt: WorkshopExcerpt): void {
    this.excerpt = excerpt;
    this.shelvedExcerpt = undefined;
    // Pre-memory by construction (the scope lock), so there is no retained
    // participant to notify and no queued delivery to reconcile.
    this.pendingRevisionVersion = undefined;
  }

  /**
   * The excerpt version the retained host was actually HANDED — `undefined`
   * when it has never been given a passage.
   *
   * What the host holds is its OWN fact and cannot be read off `this.excerpt`:
   * shelving empties the pin slot while the host's transcript still carries
   * the passage, and a pin can sit queued for delivery that never shipped. The
   * writer-origin pin rows are the delivery record — superseded rows are kept
   * (dimmed, Phase 7) and still name what was sent.
   */
  private hostDeliveredExcerptVersion(): number | undefined {
    for (let index = this.hostWriterSources.length - 1; index >= 0; index -= 1) {
      const entry = this.hostWriterSources[index];
      if (entry.kind === 'pin' && entry.excerptVersion !== undefined) {
        return entry.excerptVersion;
      }
    }
    return undefined;
  }

  private scopeTransition(changed: boolean): WorkshopScopeTransition {
    return {
      scope: this.scope,
      changed,
      excerpt: this.getExcerpt(),
      shelvedExcerpt: this.getShelvedExcerpt()
    };
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
    // Pinning IS choosing the passage path (ADR 2026-07-25). The 13A hybrid —
    // an open conversation carrying an excerpt — is gone: a room either
    // workshops a passage or it does not, and the scope lock means this can
    // only ever run before anyone has been prompted about either.
    this.scope = 'excerpt';
    // A fresh pin supersedes anything on the shelf — exactly one slot may hold
    // the passage (the V1 integrity rule). Nothing lingers, and nothing
    // vanishes quietly either: `replaceExcerpt` returns the displaced passage
    // so the caller can log and confirm it.
    this.shelvedExcerpt = undefined;
    return cloneExcerpt(this.excerpt);
  }

  /** Replace working text, preserve host memory, and retire stale tool sidecars. */
  replaceExcerpt(input: WorkshopExcerptInput): WorkshopExcerptReplacement {
    if (this.scope === 'open') {
      // An open conversation never gains a passage once it has a memory: the
      // host has been answering without one, and handing it prose now would
      // make everything already said ambiguous (ADR 2026-07-25).
      this.requireUnlockedScope('add an excerpt to this open conversation');
    }
    // The SHELF counts as previously carried. Shelving is not a deletion, so
    // pinning over a set-aside passage is a replacement, not a first pin: the
    // tool sidecars still hold that passage and so does the host's transcript.
    // Branching on `this.excerpt` alone would skip every staleness protection
    // below and assert "your FIRST passage" to a host holding the last one.
    const displaced = this.shelvedExcerpt;
    const previous = this.excerpt ?? displaced;

    if (!previous) {
      const excerpt = this.setExcerpt(input);
      this.queueExcerptDelivery(excerpt);
      return {
        excerpt,
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
    this.queueExcerptDelivery(excerpt);

    const retiredLabels = retired.map(sidecar => workshopToolLabel(sidecar.toolId)).sort();
    const source = workshopExcerptSourcePath(excerpt.source) ?? 'Pasted excerpt';
    const retiredText = retiredLabels.length > 0 ? retiredLabels.join(', ') : 'none';
    // A displaced shelf is NAMED here: the shelf is one slot with no history,
    // so this pin is the last moment that passage exists anywhere.
    const dividerTurn = this.recordExcerptRevision(
      `Excerpt v${excerpt.version} pinned · ${source} · retired: ${retiredText}` +
      (displaced
        ? ` · set-aside “${excerptLabel(displaced)}” v${displaced.version} discarded`
        : '')
    );
    return {
      excerpt,
      disposedConversationIds: conversationIds,
      dividerTurn,
      retiredSidecarCount: retired.length,
      replacementCount: this.replacementCount,
      discardedShelvedExcerpt: displaced ? cloneExcerpt(displaced) : undefined
    };
  }

  /**
   * Queue the retained host's excerpt delta frame.
   *
   * Under the scope lock every surviving delivery is a REVISION of a passage
   * the host already holds: an open conversation can never adopt one, and a
   * re-pin can only happen before any host exists. `hostDeliveredExcerptVersion`
   * is what makes that claim checkable rather than assumed — it is the honest
   * answer to "what does the host actually have," and the one guard against
   * queueing a revision to a host that was never handed the original.
   */
  private queueExcerptDelivery(excerpt: WorkshopExcerpt): void {
    if (!this.hasHostConversation() || this.hostDeliveredExcerptVersion() === undefined) {
      return;
    }
    this.pendingRevisionVersion = excerpt.version;
  }

  /** Append the visible "excerpt vN pinned" boundary for a passage revision. */
  private recordExcerptRevision(content: string): WorkshopTurn {
    const turn: WorkshopTurn = {
      id: this.nextTurnId('system'),
      role: 'system',
      kind: 'divider',
      participant: 'session',
      artifact: 'excerpt_revision',
      excerptVersion: this.excerptVersion,
      content,
      timestamp: this.now()
    };
    this.turns.push(turn);
    return cloneTurn(turn);
  }

  getExcerpt(): WorkshopExcerpt | undefined {
    return this.excerpt ? cloneExcerpt(this.excerpt) : undefined;
  }

  /**
   * The current excerpt revision. Deliberately readable independently of
   * `getExcerpt()`: shelving a passage leaves the version standing, and
   * capability artifacts correlate on the version, not on the text.
   */
  getExcerptVersion(): number {
    return this.excerptVersion;
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

  /** One attachment by id, content included — host-side callers only. */
  getContextAttachment(id: string): WorkshopContextAttachment | undefined {
    const attachment = this.contextAttachments.find((candidate) => candidate.id === id);
    return attachment ? cloneAttachment(attachment) : undefined;
  }

  /**
   * Replace one authored attachment's body from the shared Edit/Preview sheet
   * (Sprint 13A §6). Only writer text notes and wizard suggestions are
   * editable: a plain project file's session copy must keep matching the file
   * on disk, or "re-read from file" would silently discard writer edits.
   *
   * A wizard edit is session-only — the source file is never written. The
   * change bumps the context revision like any other, so the retained host is
   * told rather than silently re-prompted.
   */
  updateContextAttachmentText(
    id: string,
    text: string,
    words: number
  ): WorkshopContextAttachmentUpdateResult {
    const attachment = this.contextAttachments.find((candidate) => candidate.id === id);
    if (!attachment) {
      return { ok: false, reason: 'unknown', remainingWords: 0 };
    }
    const editable = attachment.kind === 'text' || attachment.origin === 'wizard';
    if (!editable) {
      return { ok: false, reason: 'not-editable', remainingWords: 0 };
    }
    // Budget headroom excludes the attachment being replaced — an edit that
    // shrinks a note must never be refused for exceeding a cap it is under.
    const remainingWords = PROMPT_BUDGETS.contextAttachments.words
      - (this.contextWordsUsed() - attachment.words);
    if (words > remainingWords) {
      return { ok: false, reason: 'over-budget', remainingWords };
    }
    attachment.content = text;
    attachment.words = words;
    if (attachment.kind === 'text') {
      attachment.label = workshopTextNoteLabel(text);
    }
    const eventTurn = this.recordContextChange(
      `Edited context: ${attachment.label} · ${words.toLocaleString('en-US')} words`
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
    return excerpt || contextAttachments
      ? { excerpt, contextAttachments }
      : undefined;
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
    // Running a tool against the carried-over excerpt IS choosing the passage
    // path; the path chooser must not still be showing behind the report.
    if (this.scope === null) {
      this.scope = 'excerpt';
    }
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
    actionableFindings: WorkshopActionableFinding[] = [],
    analysisInputs?: {
      excerpt: WorkshopAnalysisInputProvenance;
      context: WorkshopAnalysisInputProvenance;
    }
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
      analysisInputs: analysisInputs ? cloneAnalysisInputs(analysisInputs) : undefined,
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
   * host run. Capability artifacts are transcript evidence only and can never
   * adopt a direct-tool sidecar. A reset/preemption refuses the late artifact
   * atomically.
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
        : isAnalysis ? 'Analysis'
          : isResource ? 'Project Resources' : 'Writer\'s Dictionary',
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

    this.turns.push(turn);
    return { turn: cloneTurn(turn) };
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
    this.requireHostSubject();
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

  /**
   * Fresh room boundary: preserve the working set, clear thread, sidecars, and
   * host.
   *
   * Sprint 13A refines what "the working set" means (§3): the pinned excerpt
   * and every context attachment survive the boundary, but `scope` returns to
   * `null` so the new room opens on the path chooser and offers "Continue with
   * current excerpt". A shelved passage comes back off the shelf — the next
   * session should not inherit the previous one's set-aside decision.
   *
   * `clearWorkingSet` asks for the other boundary: an empty room. The excerpt,
   * the shelf, and every context attachment go too. Nothing on disk is deleted
   * — the caller replaces the rolling checkpoint; named sessions are untouched.
   */
  reset(options: { clearWorkingSet?: boolean } = {}): string[] {
    const conversationIds = this.clearAllConversations();
    if (options.clearWorkingSet) {
      this.excerpt = undefined;
      this.shelvedExcerpt = undefined;
      this.contextAttachments = [];
      // The excerpt revision counter belongs to a passage. With no passage in
      // either slot it MUST return to zero, or the next checkpoint would claim
      // a revision with nothing to own it and fail its own integrity rule.
      this.excerptVersion = 0;
      this.contextRevision = 0;
      this.attachmentCounter = 0;
    } else {
      if (!this.excerpt && this.shelvedExcerpt) {
        this.excerpt = this.shelvedExcerpt;
      }
      this.shelvedExcerpt = undefined;
    }
    this.scope = null;
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
      scope: this.scope,
      shelvedExcerpt: this.shelvedExcerpt ? cloneExcerpt(this.shelvedExcerpt) : undefined,
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
    validateWorkshopSessionStateV1(state, {
      allowLegacyOpenSessionWithExcerpt: true
    });
    const migration = migrateWorkshopSessionStateV1ForHydration(state);
    const normalized = migration.state;
    // The compatibility exception terminates at the migration boundary. From
    // this point on, the current invariant is absolute.
    validateWorkshopSessionStateV1(normalized);

    const excerpt = normalized.excerpt ? cloneExcerpt(normalized.excerpt) : undefined;
    const shelvedExcerpt = normalized.shelvedExcerpt
      ? cloneExcerpt(normalized.shelvedExcerpt)
      : undefined;
    const scope = normalized.scope ?? null;
    const contextAttachments = normalized.contextAttachments.map(cloneAttachment);
    const pendingMessageAttachments =
      normalized.pendingMessageAttachments.map(cloneMessageAttachment);
    const turns = normalized.turns.map(cloneTurn);
    const todos = normalized.todos.map(cloneStoredTodo);
    const behavior = { ...currentBehavior };
    const lastCommittedPersonaBehavior = normalized.lastCommittedPersonaBehavior
      ? { ...normalized.lastCommittedPersonaBehavior }
      : undefined;
    const hostWriterSources = normalized.writerSources.host.map(cloneSourceEntry);
    const toolWriterSources = cloneToolWriterSources(normalized.writerSources.tools);
    const guestWriterSources = new Map<WorkshopPersonaId, ContextSourceEntry[]>(
      normalized.writerSources.guests.map(({ personaId, sources }) => [
        personaId,
        sources.map(cloneSourceEntry)
      ])
    );

    const degradedConversationKeys: WorkshopConversationLogicalKey[] = [];
    const usableBindings = usableRuntimeBindings(runtimeBindings);
    const hostExpected = normalized.participants.host.conversationKey === 'host';
    const hostConversationId = hostExpected ? usableBindings.get('host') : undefined;
    let pendingRevisionVersion = normalized.revisions.pendingExcerpt;
    let pendingContextRevision = normalized.revisions.pendingContext;
    if (!hostConversationId) {
      if (hostExpected) {
        degradedConversationKeys.push('host');
      }
      hostWriterSources.length = 0;
      pendingRevisionVersion = undefined;
      pendingContextRevision = undefined;
    }

    const toolSidecars: WorkshopParticipants['toolSidecars'] = {};
    for (const sidecar of normalized.participants.toolSidecars) {
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
    for (const guest of normalized.participants.personaGuests) {
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

    const requestedTarget = cloneChatTarget(normalized.participants.chatTarget);
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
        personaId: normalized.participants.host.personaId,
        conversationId: hostConversationId
      },
      toolSidecars,
      personaGuests,
      chatTarget
    };
    const discardedConversationIds = this.conversationIds();

    // Synchronous field replacement after every validation/clone/remap step.
    this.excerpt = excerpt;
    this.scope = scope;
    this.shelvedExcerpt = shelvedExcerpt;
    this.contextAttachments = contextAttachments;
    this.excerptVersion = normalized.revisions.excerpt;
    this.replacementCount = normalized.revisions.replacementCount;
    this.contextRevision = normalized.revisions.context;
    this.pendingRevisionVersion = pendingRevisionVersion;
    this.pendingContextRevision = pendingContextRevision;
    this.attachmentCounter = normalized.counters.attachment;
    this.pendingMessageAttachments = pendingMessageAttachments;
    this.threadArtifactCounter = normalized.counters.threadArtifact;
    this.hostWriterSources = hostWriterSources;
    this.activeHostPin = activeHostPin;
    this.toolWriterSources = toolWriterSources;
    this.guestWriterSources = guestWriterSources;
    this.turns = turns;
    this.activeRun = undefined;
    this.participants = participants;
    this.selectedToolId = normalized.selectedToolId;
    this.turnCounter = normalized.counters.turn;
    this.todoCounter = normalized.counters.todo;
    this.todos = todos;
    this.behavior = behavior;
    this.lastCommittedPersonaBehavior = lastCommittedPersonaBehavior;

    return {
      discardedConversationIds,
      degradedConversationKeys,
      migrations: migration.migrations
    };
  }

  getSnapshot(): WorkshopSessionSnapshot {
    const windowed = this.turns.slice(-WORKSHOP_SNAPSHOT_TURN_WINDOW);
    return {
      excerpt: this.excerpt ? excerptSnapshot(this.excerpt) : undefined,
      scope: this.scope,
      shelvedExcerpt: this.shelvedExcerpt ? excerptSnapshot(this.shelvedExcerpt) : undefined,
      excerptVersion: this.excerptVersion,
      replacementCount: this.replacementCount,
      contextAttachments: this.contextAttachments.map(attachmentSnapshot),
      pendingMessageAttachments: this.pendingMessageAttachments.map(messageAttachmentSnapshot),
      pendingHostUpdate: this.pendingRevisionVersion !== undefined
        || this.pendingContextRevision !== undefined
        ? {
            excerptVersion: this.pendingRevisionVersion,
            context: this.pendingContextRevision !== undefined
          }
        : undefined,
      todos: this.todos.map((todo) => cloneTodo(todo, this.excerptVersion)),
      turns: windowed.map(cloneTurn),
      totalTurns: this.turns.length,
      truncatedTurns: this.turns.length - windowed.length,
      roomHasMemory: this.hasRoomMemory(),
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

  /**
   * What a HOST turn needs to exist (Sprint 13A §1): a pinned passage, or an
   * open conversation, which is a real scope rather than a blank excerpt. A
   * session whose path is still unchosen has no subject at all — the writer
   * has not told us what this room is for yet.
   */
  private requireHostSubject(): void {
    if (this.scope === 'open') {
      return;
    }
    if (this.scope === null) {
      throw new Error('Choose how to start this Workshop session before messaging');
    }
    this.requireExcerpt();
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


/**
 * Display name for a passage in a visible divider. Uses the SHARED title
 * helper, so a scope divider, the center scope strip, and the rail all name the
 * same excerpt identically.
 */
function excerptLabel(excerpt: WorkshopExcerpt): string {
  return workshopExcerptTitle(excerpt.source);
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
    analysisInputs: turn.analysisInputs
      ? cloneAnalysisInputs(turn.analysisInputs)
      : undefined,
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

function cloneAnalysisInputs(inputs: NonNullable<WorkshopTurn['analysisInputs']>) {
  return {
    excerpt: { ...inputs.excerpt },
    context: { ...inputs.context }
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
