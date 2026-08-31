/**
 * Host-owned Workshop session aggregate facade and lifecycle coordinator.
 *
 * Session collaborators own closed local invariants for passage/scope,
 * participants, turns, todos, widget configs, and standing directives. This
 * root remains their only production caller and keeps the cross-record work:
 * writer-source manifests derive from passages, attachments, and participant
 * lifecycles; active runs coordinate those records with turn completion;
 * context/message attachments couple revisions, event turns, prompt artifacts,
 * and manifests; behavior-transition provenance is deliberately too small to
 * split. Whole-session export, atomic hydration, reset, snapshot, and
 * integrity coordination also stay here. Provider conversation ids never
 * cross the extension/webview boundary.
 */

import {
  ContextSourceEntry,
  WorkshopChatTarget,
  WorkshopActionableFinding,
  WorkshopConversationBehavior,
  DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR,
  isWorkshopInteractionMode,
  isWorkshopPersonaExpressionLevel,
  isWorkshopRelationalDepth,
  WorkshopExcerpt,
  workshopExcerptSourcePath,
  workshopExcerptTitle,
  WorkshopMessageAttachmentSnapshot,
  WorkshopPersonaId,
  WorkshopSelectableSessionScope,
  WorkshopSessionScope,
  WorkshopSessionSnapshot,
  WorkshopStandingDirectiveFamily,
  WorkshopStandingDirectiveSummary,
  WorkshopToolId,
  WorkshopTodoItem,
  WorkshopTurn,
  WorkshopTurnArtifact,
  WorkshopTurnWidgetCommit,
  WorkshopWidgetConfigSnapshot,
  WorkshopWidgetRecommendation
} from '@messages';
import { isContextPathGroup, TokenUsage } from '@shared/types';
import type { UrlCitation } from '@messages';
import {
  WorkshopAnalysisInputProvenance,
  WorkshopCapabilityPrincipal
} from '@shared/types/workshopCapabilities';
import {
  workshopPersonaLabel
} from '@shared/constants/workshopPersonas';
import { isWorkshopToolId, workshopToolLabel } from '@shared/constants/workshopTools';
import { workshopWidgetArtifactKind } from '@shared/constants/workshopWidgets';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  WORKSHOP_ACTIONABLE_FINDING_BOUNDS
} from '@/application/services/workshop/WorkshopActionableFindings';
import {
  isWorkshopPublishableCapabilityEvidence,
  workshopTurnAudience
} from '@/application/services/workshop/WorkshopRoomAudience';
import {
  assertCurrentWorkshopSessionStateV1,
  WorkshopConversationLogicalKey,
  WorkshopRuntimeConversationBindings,
  WorkshopSessionStateV1
} from '@/application/services/workshop/WorkshopSessionStateV1';
import {
  validateWorkshopSessionStateV1
} from '@/application/services/workshop/WorkshopSessionStateV1Integrity';
import {
  normalizeWorkshopSessionCheckpointForHydration
} from '@/application/services/workshop/WorkshopSessionCheckpointNormalization';
import type {
  WorkshopThreadArtifact,
  WorkshopThreadArtifactFrameInput
} from '@/application/services/workshop/WorkshopThreadArtifactFrame';
import {
  PreparedWorkshopWidgetConfigMutation,
  WorkshopWidgetConfigLedger
} from '@/application/services/workshop/widgets/WorkshopWidgetConfigLedger';
import { WorkshopWidgetConfigInput } from '@/application/services/workshop/widgets/WorkshopWidgetConfigLedger';
import { WORKSHOP_WIDGET_CONFIG_OPERATIONS } from '@/application/services/workshop/widgets/WorkshopWidgetConfigOperations';
import {
  PreparedWorkshopStandingDirectiveMutation,
  PreparedWorkshopStandingDirectiveUpsert,
  WorkshopStandingDirectiveLedger,
  WorkshopStandingDirectiveUpsertInput
} from '@/application/services/workshop/directives/WorkshopStandingDirectiveLedger';
import {
  summarizeWorkshopStandingDirective,
  workshopStandingDirectiveMarkerContent
} from '@/application/services/workshop/directives/WorkshopStandingDirectivePresentation';
import {
  WorkshopTodoLedger
} from '@/application/services/workshop/session/WorkshopTodoLedger';
import {
  WorkshopTurnLedger
} from '@/application/services/workshop/session/WorkshopTurnLedger';
import {
  WorkshopPassageScope
} from '@/application/services/workshop/session/WorkshopPassageScope';
import {
  WorkshopParticipantRoster,
  WorkshopParticipantRosterState
} from '@/application/services/workshop/session/WorkshopParticipantRoster';
import {
  attachmentSnapshot,
  cloneAnalysisInputs,
  cloneAttachment,
  cloneAttachmentInput,
  cloneCapabilityDetails,
  cloneFindings,
  cloneMessageAttachment,
  cloneMessageAttachmentInput,
  cloneMessageAttachmentSnapshot,
  cloneSourceEntry,
  cloneThreadArtifact,
  cloneToolWriterSources,
  cloneTurn,
  cloneWidgetRecommendation,
  excerptSnapshot,
  messageAttachmentSnapshot
} from '@/application/services/workshop/WorkshopSessionRecords';
import type {
  WorkshopActiveRun,
  WorkshopCapabilityArtifactInput,
  WorkshopContextAttachment,
  WorkshopContextAttachmentInput,
  WorkshopContextAttachmentResult,
  WorkshopContextAttachmentUpdateResult,
  WorkshopExcerptInput,
  WorkshopExcerptReplacement,
  WorkshopMessageAttachment,
  WorkshopMessageAttachmentInput,
  WorkshopMessageAttachmentResult,
  WorkshopPendingHostUpdates,
  WorkshopParticipantSubjectStatus,
  WorkshopPersonaGuestJoinStart,
  WorkshopScopeTransition,
  WorkshopSessionHydrationResult,
  WorkshopToolReportCompletion
} from '@/application/services/workshop/WorkshopSessionRecords';
export type {
  WorkshopSessionCheckpointNormalization
} from '@/application/services/workshop/WorkshopSessionCheckpointNormalization';
export {
  WorkshopScopeLockedError,
  workshopParticipantSubjectStatus
} from '@/application/services/workshop/session/WorkshopPassageScope';

export { WORKSHOP_TODO_BOUNDS } from '@/application/services/workshop/WorkshopSessionLimits';

const assertNever = (value: never): never => {
  throw new Error(`Unhandled Workshop capability operation: ${JSON.stringify(value)}`);
};

export const WORKSHOP_SNAPSHOT_TURN_WINDOW = 200;

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

export class WorkshopSessionActiveRunPersistenceError extends Error {
  constructor() {
    super('Cannot persist Workshop session while a run is active');
    this.name = 'WorkshopSessionActiveRunPersistenceError';
  }
}

/**
 * A pure aggregate: no I/O, no vscode, and only an injectable clock.
 *
 * Session state owners expose export/prepare/install/reset. Add a narrower
 * mutation-level prepare/install contract only when a caller must cross
 * provider I/O between those phases; otherwise mutate directly. Every
 * time-dependent collaborator requires an injected clock. Reset preserves a
 * counter when its ids must never recur during this aggregate's lifetime
 * (turns and todos); otherwise it restores the construction-time counter.
 */
export class WorkshopSessionService {
  /** Pinned/shelved passage and immutable-before-memory scope state machine. */
  private readonly passageScope: WorkshopPassageScope;
  private contextAttachments: WorkshopContextAttachment[] = [];
  private contextRevision = 0;
  private pendingContextRevision?: number;
  private attachmentCounter = 0;
  private pendingMessageAttachments: WorkshopMessageAttachment[] = [];
  /** Monotonic `ta-N` mint — never reused within a session (surgery address). */
  private threadArtifactCounter = 0;
  /**
   * Prompt-bearing bodies for committed room artifacts. Turns expose only
   * display-safe refs to the webview; participant catch-up resolves those refs
   * here and delivers each body once through that participant's room offset.
   */
  private threadArtifacts: WorkshopThreadArtifact[] = [];
  /** Session-owned widget config lifecycle; the aggregate remains its only caller. */
  private readonly widgetConfigLedger: WorkshopWidgetConfigLedger;
  /** Passage-scoped prose directives, closed to one active entry per family. */
  private readonly standingDirectiveLedger: WorkshopStandingDirectiveLedger;
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
  /** Shared room history; the aggregate constructs and interprets every turn. */
  private readonly turnLedger: WorkshopTurnLedger;
  private activeRun?: WorkshopActiveRun;
  /** Retained participants, room offsets, and composer routing. */
  private readonly participantRoster: WorkshopParticipantRoster;
  /** Writer-promoted tasks; staleness is derived from passage version at read time. */
  private readonly todoLedger: WorkshopTodoLedger;
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
    this.widgetConfigLedger = new WorkshopWidgetConfigLedger(
      this.now,
      WORKSHOP_WIDGET_CONFIG_OPERATIONS
    );
    this.standingDirectiveLedger = new WorkshopStandingDirectiveLedger(this.now);
    this.todoLedger = new WorkshopTodoLedger(this.now);
    this.turnLedger = new WorkshopTurnLedger(this.now);
    this.passageScope = new WorkshopPassageScope(this.now);
    this.participantRoster = new WorkshopParticipantRoster();
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
      excerptVersion: this.getExcerptVersion(),
      content,
      timestamp: this.now()
    };
    this.turnLedger.append(turn);
    return cloneTurn(turn);
  }

  getScope(): WorkshopSessionScope {
    return this.passageScope.getScope();
  }

  getShelvedExcerpt(): WorkshopExcerpt | undefined {
    return this.passageScope.getShelvedExcerpt();
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
    return this.participantRoster.hasRoomMemory();
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
    return this.passageScope.setSessionScope(scope, this.hasRoomMemory());
  }

  /** Take the set-aside passage back off the shelf, before the room has a memory. */
  repinShelvedExcerpt(): WorkshopScopeTransition {
    return this.passageScope.repinShelvedExcerpt(this.hasRoomMemory());
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

  setExcerpt(input: WorkshopExcerptInput): WorkshopExcerpt {
    return this.passageScope.setExcerpt(input);
  }

  /** Repair file provenance without creating a writer-visible passage revision. */
  refreshExcerptFileSource(
    expectedVersion: number,
    source: Extract<WorkshopExcerpt['source'], { kind: 'file' }>
  ): boolean {
    return this.passageScope.refreshExcerptFileSource(expectedVersion, source);
  }

  /** Replace working text, preserve host memory, and retire stale tool sidecars. */
  replaceExcerpt(input: WorkshopExcerptInput): WorkshopExcerptReplacement {
    const passageReplacement = this.passageScope.replaceExcerpt(
      input,
      this.hasRoomMemory()
    );
    const excerpt = passageReplacement.excerpt;
    if (!passageReplacement.replaced) {
      this.queueExcerptDelivery();
      return {
        excerpt,
        disposedConversationIds: [],
        retiredSidecarCount: 0,
        replacementCount: passageReplacement.replacementCount
      };
    }

    const retired = this.participantRoster.retireToolSidecars();
    const conversationIds = retired.map(sidecar => sidecar.conversationId);
    // Retired sidecars take their manifests with them (Phase 7).
    this.toolWriterSources = {};
    this.queueExcerptDelivery();

    const retiredLabels = retired.map(sidecar => workshopToolLabel(sidecar.toolId)).sort();
    const source = workshopExcerptSourcePath(excerpt.source) ?? 'Pasted excerpt';
    const retiredText = retiredLabels.length > 0 ? retiredLabels.join(', ') : 'none';
    // A displaced shelf is NAMED here: the shelf is one slot with no history,
    // so this pin is the last moment that passage exists anywhere.
    const dividerTurn = this.recordExcerptRevision(
      `Excerpt v${excerpt.version} pinned · ${source} · retired: ${retiredText}` +
      (passageReplacement.discardedShelvedExcerpt
        ? ` · set-aside “${excerptLabel(passageReplacement.discardedShelvedExcerpt)}” ` +
          `v${passageReplacement.discardedShelvedExcerpt.version} discarded`
        : '')
    );
    return {
      excerpt,
      disposedConversationIds: conversationIds,
      dividerTurn,
      retiredSidecarCount: retired.length,
      replacementCount: passageReplacement.replacementCount,
      discardedShelvedExcerpt: passageReplacement.discardedShelvedExcerpt
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
  private queueExcerptDelivery(): void {
    this.passageScope.queueExcerptDelivery(
      this.hasHostConversation(),
      this.hostDeliveredExcerptVersion()
    );
  }

  /** Append the visible "excerpt vN pinned" boundary for a passage revision. */
  private recordExcerptRevision(content: string): WorkshopTurn {
    const turn: WorkshopTurn = {
      id: this.nextTurnId('system'),
      role: 'system',
      kind: 'divider',
      participant: 'session',
      artifact: 'excerpt_revision',
      excerptVersion: this.getExcerptVersion(),
      content,
      timestamp: this.now()
    };
    this.turnLedger.append(turn);
    return cloneTurn(turn);
  }

  getExcerpt(): WorkshopExcerpt | undefined {
    return this.passageScope.getExcerpt();
  }

  /**
   * The current excerpt revision. Deliberately readable independently of
   * `getExcerpt()`: shelving a passage leaves the version standing, and
   * capability artifacts correlate on the version, not on the text.
   */
  getExcerptVersion(): number {
    return this.passageScope.getExcerptVersion();
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
   * Publish the exact artifacts that rode a successful persona-directed room
   * turn. Direct tool messages are private and may never enter this ledger.
   */
  recordRoomThreadArtifacts(
    turnId: string,
    artifacts: readonly WorkshopThreadArtifactFrameInput[]
  ): void {
    if (artifacts.length === 0) {
      return;
    }
    const turn = this.turnLedger.find(turnId);
    if (!turn) {
      throw new Error(`Cannot publish thread artifacts for unknown turn ${turnId}`);
    }
    if (workshopTurnAudience(turn).kind !== 'room') {
      throw new Error(`Cannot publish room thread artifacts for private turn ${turnId}`);
    }
    const threadWidgetCommit = turn.widgetCommit?.rail === 'thread-artifact'
      ? turn.widgetCommit
      : undefined;
    const referencedIds = new Set([
      ...(turn.messageAttachments ?? []).map((attachment) => attachment.id),
      ...(threadWidgetCommit ? [threadWidgetCommit.artifactId] : [])
    ]);
    const suppliedIds = new Set<string>();
    for (const artifact of artifacts) {
      if (!referencedIds.has(artifact.id)) {
        throw new Error(
          `Thread artifact ${artifact.id} is not referenced by room turn ${turnId}`
        );
      }
      if (
        suppliedIds.has(artifact.id)
        || this.threadArtifacts.some((existing) => existing.id === artifact.id)
      ) {
        throw new Error(`Duplicate committed Workshop thread artifact ${artifact.id}`);
      }
      suppliedIds.add(artifact.id);
      const widgetReference = threadWidgetCommit?.artifactId === artifact.id;
      if (
        widgetReference
        && artifact.kind !== workshopWidgetArtifactKind(threadWidgetCommit.widgetId)
      ) {
        throw new Error(
          `Thread artifact ${artifact.id} does not match its widget reference on ${turnId}`
        );
      }
      if (!widgetReference && artifact.kind !== undefined) {
        throw new Error(
          `Message attachment ${artifact.id} cannot carry a widget kind on ${turnId}`
        );
      }
    }
    if (suppliedIds.size !== referencedIds.size) {
      const missingIds = [...referencedIds].filter((id) => !suppliedIds.has(id));
      throw new Error(
        `Room turn ${turnId} is missing thread artifact bodies: ${missingIds.join(', ')}`
      );
    }
    this.threadArtifacts.push(
      ...artifacts.map((artifact) => cloneThreadArtifact({ ...artifact, turnId }))
    );
  }

  /** Host-private artifact projection for room catch-up and guest join only. */
  getRoomThreadArtifactsForTurn(turnId: string): WorkshopThreadArtifact[] {
    return this.threadArtifacts
      .filter((artifact) => artifact.turnId === turnId)
      .map(cloneThreadArtifact);
  }

  /**
   * Keep the participant's "In context" manifest honest when room catch-up or
   * a cold join delivers artifacts originally addressed to somebody else.
   */
  recordRoomThreadArtifactDeliveries(
    deliveredTurnIds: readonly string[],
    reader: WorkshopCapabilityPrincipal
  ): void {
    const deliveredTurns = new Set(deliveredTurnIds);
    const current = (() => {
      if (reader.kind === 'host') {
        return this.hostWriterSources;
      }
      const guestSources = this.guestWriterSources.get(reader.personaId);
      if (!guestSources) {
        throw new Error(
          `Cannot record artifact delivery for non-live Workshop guest ${reader.personaId}`
        );
      }
      return guestSources;
    })();
    const alreadyRecorded = new Set(
      current.flatMap((entry) => entry.artifactId ? [entry.artifactId] : [])
    );
    const entries = this.threadArtifacts
      .filter(
        (artifact) =>
          deliveredTurns.has(artifact.turnId)
          && !alreadyRecorded.has(artifact.id)
      )
      .map((artifact): ContextSourceEntry => ({
        kind: 'message-attachment',
        origin: 'writer',
        label: artifact.name,
        sizeChars: artifact.content.length,
        isEstimate: true,
        artifactId: artifact.id,
        deliveredAt: this.now()
      }));
    current.push(...entries);
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
        artifactId: attachment.id,
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

  // ───────────────────────────────────────────────────────────────────────────
  // Conversation Widgets (ADR 2026-07-22). The commit is one atomic host
  // route: it mints from the SAME `ta-N` counter as message attachments (ids
  // stay globally unique for tombstone surgery) but never enters the pending
  // list — the Phase 6B doctrine reserves that list for explicit composer
  // sends, and a persisted pending entry would orphan on a failed commit.
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Persist a widget authoring Draft under a fresh `wc-N` id. Created before
   * the send so the visible turn can reference it; a config whose commit
   * never landed is the durable retry token, not garbage.
   */
  createWidgetConfig(
    input: WorkshopWidgetConfigInput & { clonedFromConfigId?: string }
  ): WorkshopWidgetConfigSnapshot {
    return this.widgetConfigLedger.create(input);
  }

  prepareWidgetConfigCreation(
    input: WorkshopWidgetConfigInput & { clonedFromConfigId?: string }
  ) {
    return this.widgetConfigLedger.prepareCreation(input);
  }

  prepareWidgetConfigRevision(
    configId: string,
    input: WorkshopWidgetConfigInput
  ) {
    return this.widgetConfigLedger.prepareRevision(configId, input);
  }

  installPreparedWidgetConfigRevision(
    prepared: ReturnType<WorkshopWidgetConfigLedger['prepareRevision']>
  ): WorkshopWidgetConfigSnapshot {
    return this.widgetConfigLedger.installPreparedRevision(prepared);
  }

  getWidgetConfig(id: string): WorkshopWidgetConfigSnapshot | undefined {
    return this.widgetConfigLedger.get(id);
  }

  /** Stamp the landed commit's turn/artifact identities onto its config. */
  recordWidgetCommit(configId: string, linkage: { turnId: string; artifactId: string }): void {
    this.widgetConfigLedger.recordCommit(configId, linkage);
  }

  getStandingDirective(family: WorkshopStandingDirectiveFamily) {
    return this.standingDirectiveLedger.get(family);
  }

  getStandingDirectives() {
    return this.standingDirectiveLedger.list();
  }

  prepareStandingDirectiveUpsert(
    input: WorkshopStandingDirectiveUpsertInput
  ): PreparedWorkshopStandingDirectiveUpsert {
    return this.standingDirectiveLedger.prepareUpsert(input);
  }

  prepareStandingDirectiveRemoval(
    family: WorkshopStandingDirectiveFamily
  ): PreparedWorkshopStandingDirectiveMutation | undefined {
    return this.standingDirectiveLedger.prepareRemoval(family);
  }

  /**
   * Commit a prompt-replaced standing mutation as one room marker. The marker
   * and linked configs are resolved before either prepared ledger is installed.
   */
  commitStandingDirectiveMutation(
    prepared: PreparedWorkshopStandingDirectiveMutation,
    preparedConfig?: PreparedWorkshopWidgetConfigMutation
  ): WorkshopTurn {
    const previousDirective = this.standingDirectiveLedger.get(prepared.directive.family);
    const previousConfig = previousDirective
      ? this.widgetConfigLedger.get(previousDirective.widgetConfigId)
      : undefined;
    const directive = prepared.directive;
    const currentConfig = prepared.action === 'removed'
      ? previousConfig
      : preparedConfig?.config ?? this.widgetConfigLedger.get(directive.widgetConfigId);
    const markerContent = workshopStandingDirectiveMarkerContent(
      prepared.action,
      directive,
      previousConfig,
      currentConfig
    );
    if (preparedConfig) {
      this.widgetConfigLedger.installPreparedMutation(preparedConfig);
    }
    this.standingDirectiveLedger.installPreparedState(prepared.state);
    const turn: WorkshopTurn = {
      id: this.nextTurnId('system'),
      role: 'system',
      kind: 'divider',
      participant: 'session',
      artifact: 'standing_directive_change',
      excerptVersion: this.getExcerptVersion(),
      content: markerContent,
      timestamp: this.now(),
      widgetCommit: {
        widgetId: directive.widgetId,
        widgetConfigId: directive.widgetConfigId,
        rail: 'standing',
        directiveId: directive.id,
        revision: directive.revision
      },
      standingDirectiveChange: {
        action: prepared.action,
        family: directive.family,
        widgetId: directive.widgetId,
        directiveId: directive.id,
        widgetConfigId: directive.widgetConfigId,
        revision: directive.revision
      }
    };
    this.turnLedger.append(turn);
    this.widgetConfigLedger.recordCommit(directive.widgetConfigId, {
      turnId: turn.id,
      directiveId: directive.id
    });
    return cloneTurn(turn);
  }

  /**
   * Mint a thread-artifact id for a widget commit from the shared monotonic
   * counter. Deliberately NOT staged: the widget commit route holds the id
   * synchronously from mint to ship, so nothing can interleave.
   */
  mintWidgetArtifactId(): string {
    this.threadArtifactCounter += 1;
    return `ta-${this.threadArtifactCounter}`;
  }

  /**
   * Stamp a shipped widget artifact into the receiving participant's
   * writer-origin manifest — the same accounting commitMessageAttachments
   * performs for composer attachments, minus the pending list.
   */
  recordWidgetArtifactDelivery(
    artifactId: string,
    label: string,
    sizeChars: number,
    target: WorkshopChatTarget = { kind: 'host' }
  ): void {
    const entry: ContextSourceEntry = {
      kind: 'message-attachment',
      origin: 'writer',
      label,
      sizeChars,
      isEstimate: true,
      artifactId,
      deliveredAt: this.now()
    };
    if (target.kind === 'tool') {
      this.toolWriterSources[target.toolId] = [
        ...(this.toolWriterSources[target.toolId] ?? []),
        entry
      ];
    } else if (target.kind === 'personaGuest') {
      this.guestWriterSources.set(target.personaId, [
        ...(this.guestWriterSources.get(target.personaId) ?? []),
        entry
      ]);
    } else {
      this.hostWriterSources.push(entry);
    }
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
      excerptVersion: this.getExcerptVersion(),
      content,
      timestamp: this.now()
    };
    this.turnLedger.append(eventTurn);
    return cloneTurn(eventTurn);
  }

  collectPendingHostUpdates(): WorkshopPendingHostUpdates | undefined {
    const excerpt = this.passageScope.collectPendingExcerptDelivery();
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
    if (
      delivered.excerpt
      && this.passageScope.commitPendingExcerptDelivery(delivered.excerpt.version)
    ) {
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

  /** One captured pin as a manifest row; current pin by default. */
  private pinEntry(excerpt = this.getExcerpt()): ContextSourceEntry | undefined {
    if (!excerpt) {
      return undefined;
    }
    const source = excerpt.source;
    return {
      kind: 'pin',
      origin: 'writer',
      label: workshopExcerptSourcePath(source) ?? 'Pasted excerpt',
      configuredResource: source.kind !== 'manual' && source.configuredResource
        ? { ...source.configuredResource }
        : undefined,
      sizeChars: excerpt.text.length,
      isEstimate: true,
      excerptVersion: excerpt.version,
      deliveredAt: excerpt.pinnedAt
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
    return this.participantRoster.getSelectedPersonaId();
  }

  hasHostConversation(): boolean {
    return this.participantRoster.hasHostConversation();
  }

  getHostConversationId(): string | undefined {
    return this.participantRoster.getHostConversationId();
  }

  getChatTarget(): WorkshopChatTarget {
    return this.participantRoster.getChatTarget();
  }

  getToolSidecarConversationId(toolId: WorkshopToolId): string | undefined {
    return this.participantRoster.getToolSidecarConversationId(toolId);
  }

  isLiveToolReport(toolId: WorkshopToolId, reportTurnId: string): boolean {
    return this.participantRoster.isLiveToolReport(toolId, reportTurnId);
  }

  isLivePersonaGuest(personaId: WorkshopPersonaId): boolean {
    return this.participantRoster.isLivePersonaGuest(personaId);
  }

  getPersonaGuestConversationId(personaId: WorkshopPersonaId): string | undefined {
    return this.participantRoster.getPersonaGuestConversationId(personaId);
  }

  /**
   * Narrow aggregate port for WorkshopRoomDeliveryService. The aggregate
   * exposes durable facts; projection and acknowledgement policy stay in the
   * injected delivery collaborator.
   */
  readRoomDeliveryState(reader: WorkshopCapabilityPrincipal): {
    turns: WorkshopTurn[];
    lastSeenRoomTurnId?: string;
  } {
    const lastSeenRoomTurnId = this.participantRoster.readRoomDeliveryOffset(reader);
    return {
      turns: this.turnLedger.all(),
      lastSeenRoomTurnId
    };
  }

  /** Full defensive ledger read used only for a new participant's snapshot. */
  readRoomLedger(): WorkshopTurn[] {
    return this.turnLedger.all();
  }

  /**
   * Compare-and-set the durable room offset after the delivery collaborator
   * has proved an exact contiguous receipt.
   */
  advanceRoomDeliveryOffset(
    reader: WorkshopCapabilityPrincipal,
    expectedOffset: string | undefined,
    deliveredThroughTurnId: string
  ): void {
    const readerLabel = reader.kind === 'host'
      ? 'host'
      : `guest:${reader.personaId}`;
    if (!this.turnLedger.contains(deliveredThroughTurnId)) {
      throw new Error(
        `Cannot advance Workshop room offset for ${readerLabel} to unknown turn ` +
        `${deliveredThroughTurnId} (expected offset=${expectedOffset ?? '<start>'})`
      );
    }
    this.participantRoster.advanceDeliveryOffset(
      reader,
      expectedOffset,
      deliveredThroughTurnId
    );
  }

  /** Validate a user invitation before the provider conversation is created. */
  validatePersonaGuestInvitation(personaId: WorkshopPersonaId): void {
    this.participantRoster.validatePersonaGuestInvitation(personaId);
  }

  /** Adopt a successful fresh guest conversation at the join snapshot's head. */
  adoptPersonaGuest(
    personaId: WorkshopPersonaId,
    conversationId: string,
    deliveredWriterSources: readonly ContextSourceEntry[]
  ): void {
    const roomHead = this.turnLedger.head()?.id;
    this.participantRoster.adoptPersonaGuest(personaId, conversationId, roomHead);
    // Never re-read live room state here: adoption follows an awaited provider
    // call, so only the join-time snapshot can truthfully describe what shipped.
    this.guestWriterSources.set(
      personaId,
      deliveredWriterSources.map(cloneSourceEntry)
    );
  }

  /** Dispose one guest while preserving its historical thread attribution. */
  dismissPersonaGuest(personaId: WorkshopPersonaId): string | undefined {
    const dismissal = this.participantRoster.dismissPersonaGuest(personaId);
    if (!dismissal) {
      return undefined;
    }
    this.guestWriterSources.delete(personaId);
    if (this.activeRun?.target === 'personaGuest' && this.activeRun.guestPersonaId === personaId) {
      this.activeRun = undefined;
    }
    return dismissal.conversationId;
  }

  isPersonaSelectionLocked(): boolean {
    return this.participantRoster.isPersonaSelectionLocked(this.activeRun !== undefined);
  }

  /** A selected host can change only before its first run or conversation. */
  selectPersona(personaId: WorkshopPersonaId): void {
    this.participantRoster.selectPersona(personaId, this.activeRun !== undefined);
  }

  /** Host target is always valid; sidecar targets must name a live participant. */
  setChatTarget(target: WorkshopChatTarget): boolean {
    return this.participantRoster.setChatTarget(target);
  }

  /** Start a fresh isolated tool sidecar run; the permanent host is untouched. */
  beginToolRun(toolId: WorkshopToolId, requestId: string): WorkshopTurn {
    this.passageScope.chooseExcerptScopeIfUnchosen();
    this.participantRoster.selectToolForRun(toolId);
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
      excerptVersion: this.getExcerptVersion()
    };
    this.turnLedger.append(turn);
    this.activeRun = {
      requestId,
      kind: 'tool_run',
      artifact: 'tool_report',
      phase: 'tool_report',
      target: 'tool',
      toolId,
      excerptVersion: this.getExcerptVersion()
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
    this.turnLedger.append(turn);

    return {
      turn: cloneTurn(turn),
      replacedConversationId
    };
  }

  /**
   * Append completed nested capability evidence without replacing the active
   * run. Capability artifacts are transcript evidence only and can never
   * adopt a direct-tool sidecar. A reset/preemption refuses the late artifact
   * atomically.
   *
   * Sprint 13C: the invoking principal (host or persona guest) must match the
   * run that is actually active. This is an EVIDENCE-ADMISSION gate, not
   * authorization (PR #89 review #8): the capability call has already fully
   * executed by the time this runs — the real privilege boundary is the
   * closed request catalog. `invokedBy` is caller-supplied; today every mint
   * site builds it from the same locals that set `activeRun`, and this guard
   * exists so a future mis-wired site drops evidence loudly (callers log
   * `describeCapabilityArtifactRefusal`) instead of misattributing it.
   */
  recordCapabilityArtifact(
    input: WorkshopCapabilityArtifactInput
  ): WorkshopToolReportCompletion | undefined {
    if (this.capabilityArtifactRefusal(input)) {
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

    this.turnLedger.append(turn);
    this.activeRun!.capabilityTurnIds = [
      ...(this.activeRun!.capabilityTurnIds ?? []),
      turn.id
    ];
    return { turn: cloneTurn(turn) };
  }

  /**
   * Why `recordCapabilityArtifact` would refuse this artifact, for caller
   * logging (PR #89 review #6): a benign late arrival and a principal-wiring
   * bug must not produce byte-identical log lines. Returns undefined when the
   * artifact would be accepted.
   */
  describeCapabilityArtifactRefusal(
    input: Pick<WorkshopCapabilityArtifactInput, 'requestId' | 'excerptVersion' | 'details'>
  ): string | undefined {
    return this.capabilityArtifactRefusal(input);
  }

  private capabilityArtifactRefusal(
    input: Pick<WorkshopCapabilityArtifactInput, 'requestId' | 'excerptVersion' | 'details'>
  ): string | undefined {
    const active = this.activeRun;
    if (!active) {
      return 'no-active-run';
    }
    if (active.requestId !== input.requestId) {
      return `request-mismatch (artifact=${input.requestId}, active=${active.requestId})`;
    }
    const principal = input.details.invokedBy;
    const principalLabel = principal.kind === 'host' ? 'host' : `personaGuest:${principal.personaId}`;
    const activeLabel = active.target === 'personaGuest' && active.guestPersonaId
      ? `personaGuest:${active.guestPersonaId}`
      : active.target;
    const principalMatchesRun = principal.kind === 'host'
      ? active.target === 'host'
      : active.target === 'personaGuest' && active.guestPersonaId === principal.personaId;
    if (!principalMatchesRun) {
      return `principal-mismatch (artifact=${principalLabel}, active=${activeLabel})`;
    }
    if (active.excerptVersion !== input.excerptVersion) {
      return `stale-excerpt-version (artifact=${input.excerptVersion}, active=${active.excerptVersion})`;
    }
    return undefined;
  }

  /** Begin the host-only synthesis phase correlated to a visible report. */
  beginPersonaSynthesis(requestId: string, reportTurnId: string): void {
    const report = this.turnLedger.find(reportTurnId);
    if (!report || report.artifact !== 'tool_report') {
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
    messageAttachments?: readonly WorkshopMessageAttachmentSnapshot[],
    widgetCommit?: WorkshopTurnWidgetCommit
  ): WorkshopTurn {
    this.requireParticipantSubject();
    return this.beginMessage(
      requestId,
      displayText,
      'host',
      undefined,
      undefined,
      messageAttachments,
      widgetCommit
    );
  }

  /** Begin a message to a live guest; guests never receive host capabilities. */
  beginPersonaGuestMessage(
    personaId: WorkshopPersonaId,
    requestId: string,
    displayText: string,
    messageAttachments?: readonly WorkshopMessageAttachmentSnapshot[],
    widgetCommit?: WorkshopTurnWidgetCommit
  ): WorkshopTurn {
    this.requireParticipantSubject();
    if (!this.isLivePersonaGuest(personaId)) {
      throw new Error(`Cannot message Workshop guest ${workshopPersonaLabel(personaId)} without a live sidecar`);
    }
    return this.beginMessage(
      requestId,
      displayText,
      'personaGuest',
      undefined,
      personaId,
      messageAttachments,
      widgetCommit
    );
  }

  /** Begin the first invitation turn before the provider conversation exists. */
  beginPersonaGuestJoin(
    personaId: WorkshopPersonaId,
    requestId: string,
    displayText: string
  ): WorkshopPersonaGuestJoinStart {
    this.requireParticipantSubject();
    this.validatePersonaGuestInvitation(personaId);
    const excerpt = this.getExcerpt();
    const contextAttachments = this.getContextAttachments();
    const turn = this.beginMessage(
      requestId,
      displayText,
      'personaGuest',
      undefined,
      personaId
    );
    const pin = this.pinEntry(excerpt);
    this.activeRun!.guestJoinWriterSources = [
      ...(pin ? [pin] : []),
      ...contextAttachments.map((attachment) => this.attachmentEntry(attachment))
    ];
    return { turn, excerpt, contextAttachments };
  }

  /** Begin a direct follow-up to a retained tool sidecar. */
  beginDirectToolMessage(
    toolId: WorkshopToolId,
    requestId: string,
    displayText: string,
    messageAttachments?: readonly WorkshopMessageAttachmentSnapshot[]
  ): WorkshopTurn {
    if (!this.participantRoster.hasToolSidecar(toolId)) {
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
    actionableFindings: WorkshopActionableFinding[] = [],
    citations?: UrlCitation[],
    widgetRecommendation?: WorkshopWidgetRecommendation
  ): WorkshopTurn | undefined {
    if (this.activeRun?.requestId !== requestId) {
      return undefined;
    }

    const active = this.activeRun;
    const isHost = active.target === 'host';
    const isGuest = active.target === 'personaGuest';
    const toolReportTurnId = active.toolId
      ? this.participantRoster.getToolSidecarLatestReportTurnId(active.toolId)
      : undefined;
    const hostPersonaId = this.getSelectedPersonaId();
    const turn: WorkshopTurn = {
      id: this.nextTurnId('assistant'),
      role: 'assistant',
      kind: active.kind,
      participant: isHost ? 'host' : isGuest ? 'guest' : 'tool',
      artifact: active.artifact,
      toolId: !isHost && !isGuest ? active.toolId : undefined,
      toolLabel: !isHost && !isGuest && active.toolId ? workshopToolLabel(active.toolId) : undefined,
      personaId: isHost
        ? hostPersonaId
        : isGuest
          ? active.guestPersonaId
          : undefined,
      personaLabel: isHost
        ? workshopPersonaLabel(hostPersonaId)
        : isGuest && active.guestPersonaId
          ? workshopPersonaLabel(active.guestPersonaId)
          : undefined,
      reportTurnId: active.reportTurnId ?? toolReportTurnId,
      content,
      timestamp: this.now(),
      usage: usage ? { ...usage } : undefined,
      citations: citations?.map((citation) => ({ ...citation })),
      truncated: truncated || undefined,
      excerptVersion: active.excerptVersion,
      actionableFindings: (isHost || isGuest) && actionableFindings.length > 0
        ? cloneFindings(actionableFindings)
        : undefined,
      behavior: (isHost || isGuest) && active.behavior
        ? { ...active.behavior }
        : undefined,
      // Persona-only decoration: tool reports never carry recommendation chips.
      widgetRecommendation: (isHost || isGuest) && widgetRecommendation
        ? cloneWidgetRecommendation(widgetRecommendation)
        : undefined
    };

    if (isHost && conversationId) {
      if (!this.hasHostConversation()) {
        // First host adoption: the initial envelope delivered the current
        // pin — stamp it as the host's first writer-origin manifest row.
        const pin = this.pinEntry();
        if (pin) {
          this.appendHostPin(pin);
        }
      }
      this.participantRoster.setHostConversationId(conversationId);
    }
    if (isGuest && active.guestPersonaId && conversationId) {
      if (!this.isLivePersonaGuest(active.guestPersonaId)) {
        if (!active.guestJoinWriterSources) {
          throw new Error(
            `Cannot adopt Workshop guest ${workshopPersonaLabel(active.guestPersonaId)} ` +
            'without a join-time writer-source snapshot'
          );
        }
        this.adoptPersonaGuest(
          active.guestPersonaId,
          conversationId,
          active.guestJoinWriterSources
        );
      }
      if (this.isLivePersonaGuest(active.guestPersonaId)) {
        this.participantRoster.setPersonaGuestConversationId(
          active.guestPersonaId,
          conversationId
        );
      }
    }
    this.turnLedger.append(turn);
    for (const capabilityTurnId of new Set(active.capabilityTurnIds ?? [])) {
      this.turnLedger.update(capabilityTurnId, (capabilityTurn) => {
        if (
          capabilityTurn.capability
          && isWorkshopPublishableCapabilityEvidence(capabilityTurn.capability)
        ) {
          capabilityTurn.capability.publishedWithTurnId = turn.id;
        }
      });
    }
    this.activeRun = undefined;
    if ((isHost || isGuest) && active.behavior) {
      this.lastCommittedPersonaBehavior = {
        interactionMode: active.behavior.interactionMode,
        expressionLevel: active.behavior.expressionLevel,
        relationalDepth: active.behavior.relationalDepth
      };
    }
    return cloneTurn(turn);
  }

  addTodoFromFinding(sourceTurnId: string, findingKey: string): WorkshopTodoItem {
    const sourceTurn = this.turnLedger.find(sourceTurnId);
    return this.todoLedger.addFromFinding(sourceTurn, findingKey, this.getExcerptVersion());
  }

  editTodo(todoId: string, text: string): WorkshopTodoItem {
    return this.todoLedger.edit(todoId, text, this.getExcerptVersion());
  }

  setTodoStatus(todoId: string, status: WorkshopTodoItem['status']): WorkshopTodoItem {
    return this.todoLedger.setStatus(todoId, status, this.getExcerptVersion());
  }

  reorderTodo(todoId: string, direction: 'up' | 'down'): void {
    this.todoLedger.reorder(todoId, direction);
  }

  collectOpenTodosForHost(): WorkshopTodoItem[] {
    return this.todoLedger.collectOpen(this.getExcerptVersion());
  }

  /** Cancel or preempt only the active request; keep its visible writer turn. */
  abandonRun(requestId: string): void {
    if (this.activeRun?.requestId === requestId) {
      this.activeRun = undefined;
    }
  }

  /**
   * Roll a transiently unavailable message back to its pre-send room state.
   *
   * The writer turn is provisional until a participant reply commits.
   * Capability evidence is not: it may already be visible, billed, and the
   * source of a durable to-do, so rollback retains it. Composer attachments
   * remain pending for a retry; writer-turn-bound artifact bodies and widget
   * linkage leave with the writer turn.
   */
  rollbackMessageRun(requestId: string): WorkshopTurn | undefined {
    const active = this.activeRun;
    if (
      active?.requestId !== requestId
      || active.kind !== 'message'
      || !active.writerTurnId
    ) {
      return undefined;
    }

    const writerTurn = this.turnLedger.find(active.writerTurnId);
    if (!writerTurn || writerTurn.role !== 'user') {
      throw new Error(`Cannot roll back missing Workshop writer turn ${active.writerTurnId}`);
    }

    const widgetCommit = writerTurn.widgetCommit?.rail === 'thread-artifact'
      ? writerTurn.widgetCommit
      : undefined;
    if (widgetCommit) {
      this.widgetConfigLedger.rollbackThreadCommit(widgetCommit.widgetConfigId, {
        turnId: writerTurn.id,
        artifactId: widgetCommit.artifactId
      });
      this.removeWriterSourceArtifact(widgetCommit.artifactId);
    }

    const rollbackTurnIds = new Set([writerTurn.id]);
    this.turnLedger.removeByIds(rollbackTurnIds);
    this.threadArtifacts = this.threadArtifacts.filter(
      (artifact) => !rollbackTurnIds.has(artifact.turnId)
    );
    this.activeRun = undefined;
    return writerTurn;
  }

  /** Clear every retained participant after an assistant-resource generation loss. */
  clearAllConversations(): string[] {
    const conversationIds = this.participantRoster.clearAllConversations();
    this.passageScope.clearPendingExcerptDelivery();
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
      this.contextAttachments = [];
      this.contextRevision = 0;
      this.attachmentCounter = 0;
    }
    this.passageScope.reset(options);
    this.turnLedger.reset();
    this.activeRun = undefined;
    this.pendingMessageAttachments = [];
    this.threadArtifacts = [];
    this.widgetConfigLedger.reset();
    this.standingDirectiveLedger.reset();
    this.pendingContextRevision = undefined;
    this.todoLedger.reset();
    this.lastCommittedPersonaBehavior = undefined;
    this.participantRoster.reset();
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
    const widgetConfigState = this.widgetConfigLedger.exportState();
    const standingDirectiveState = this.standingDirectiveLedger.exportState();
    const todoState = this.todoLedger.exportState();
    const turnState = this.turnLedger.exportState();
    const passageState = this.passageScope.exportState();
    const rosterState = this.participantRoster.exportState();

    return {
      excerpt: passageState.excerpt,
      scope: passageState.scope,
      shelvedExcerpt: passageState.shelvedExcerpt,
      contextAttachments: this.contextAttachments.map(cloneAttachment),
      pendingMessageAttachments: this.pendingMessageAttachments.map(cloneMessageAttachment),
      threadArtifacts: this.threadArtifacts.map(cloneThreadArtifact),
      revisions: {
        excerpt: passageState.excerptVersion,
        replacementCount: passageState.replacementCount,
        context: this.contextRevision,
        pendingExcerpt: passageState.pendingRevisionVersion,
        pendingContext: this.pendingContextRevision
      },
      counters: {
        attachment: this.attachmentCounter,
        threadArtifact: this.threadArtifactCounter,
        turn: turnState.counter,
        todo: todoState.counter,
        widgetConfig: widgetConfigState.counter,
        standingDirective: standingDirectiveState.counter
      },
      widgetConfigs: widgetConfigState.configs,
      standingDirectives: standingDirectiveState.directives,
      writerSources: {
        host: this.hostWriterSources.map(cloneSourceEntry),
        tools: cloneToolWriterSources(this.toolWriterSources),
        guests: [...this.guestWriterSources.entries()].map(([personaId, sources]) => ({
          personaId,
          sources: sources.map(cloneSourceEntry)
        }))
      },
      turns: turnState.turns,
      participants: {
        host: {
          personaId: rosterState.host.personaId,
          conversationKey: rosterState.host.conversationId ? 'host' : undefined,
          lastSeenRoomTurnId: rosterState.host.lastSeenRoomTurnId
        },
        toolSidecars: Object.entries(rosterState.toolSidecars).flatMap(
          ([rawToolId, sidecar]) => {
            if (!sidecar) {
              return [];
            }
            const toolId = rawToolId as WorkshopToolId;
            return [{
              toolId,
              conversationKey: `tool:${toolId}` as `tool:${WorkshopToolId}`,
              latestReportTurnId: sidecar.latestReportTurnId
            }];
          }
        ),
        personaGuests: [...rosterState.personaGuests.values()].map((guest) => ({
          personaId: guest.personaId,
          conversationKey: guest.conversationId
            ? `guest:${guest.personaId}` as `guest:${WorkshopPersonaId}`
            : undefined,
          lastSeenRoomTurnId: guest.lastSeenRoomTurnId,
          liveness: guest.liveness
        })),
        chatTarget: rosterState.chatTarget
      },
      selectedToolId: rosterState.selectedToolId,
      todos: todoState.todos,
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
      allowLegacyOpenSessionWithExcerpt: true,
      skipWidgetDraftIntegrity: true
    });
    const normalization = normalizeWorkshopSessionCheckpointForHydration(state);
    const normalized = normalization.state;
    // The compatibility exception terminates at the migration boundary. From
    // this point on, the current invariant is absolute.
    assertCurrentWorkshopSessionStateV1(normalized);
    validateWorkshopSessionStateV1(normalized);

    const passageState = this.passageScope.prepareState({
      excerpt: normalized.excerpt,
      scope: normalized.scope ?? null,
      shelvedExcerpt: normalized.shelvedExcerpt,
      excerptVersion: normalized.revisions.excerpt,
      replacementCount: normalized.revisions.replacementCount,
      pendingRevisionVersion: normalized.revisions.pendingExcerpt
    });
    const contextAttachments = normalized.contextAttachments.map(cloneAttachment);
    const pendingMessageAttachments =
      normalized.pendingMessageAttachments.map(cloneMessageAttachment);
    const threadArtifacts = (normalized.threadArtifacts ?? []).map(cloneThreadArtifact);
    const turnState = this.turnLedger.prepareState({
      turns: normalized.turns,
      counter: normalized.counters.turn
    });
    const todoState = this.todoLedger.prepareState({
      todos: normalized.todos,
      counter: normalized.counters.todo
    });
    const widgetConfigState = this.widgetConfigLedger.prepareState({
      configs: normalized.widgetConfigs ?? [],
      counter: normalized.counters.widgetConfig ?? 0
    });
    const standingDirectiveState = this.standingDirectiveLedger.prepareState({
      directives: normalized.standingDirectives ?? [],
      counter: normalized.counters.standingDirective ?? 0
    });
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
    let pendingContextRevision = normalized.revisions.pendingContext;
    if (!hostConversationId) {
      if (hostExpected) {
        degradedConversationKeys.push('host');
      }
      hostWriterSources.length = 0;
      passageState.pendingRevisionVersion = undefined;
      pendingContextRevision = undefined;
    }

    const toolSidecars: WorkshopParticipantRosterState['toolSidecars'] = {};
    for (const sidecar of normalized.participants.toolSidecars) {
      const conversationId = usableBindings.get(sidecar.conversationKey);
      if (!conversationId) {
        degradedConversationKeys.push(sidecar.conversationKey);
        delete toolWriterSources[sidecar.toolId];
        continue;
      }
      toolSidecars[sidecar.toolId] = {
        conversationId,
        latestReportTurnId: sidecar.latestReportTurnId
      };
    }

    const personaGuests: WorkshopParticipantRosterState['personaGuests'] = new Map();
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
        lastSeenRoomTurnId: guest.lastSeenRoomTurnId,
        liveness: restoredLive ? 'live' : 'disposed'
      });
    }

    const rosterState = this.participantRoster.prepareState({
      host: {
        personaId: normalized.participants.host.personaId,
        conversationId: hostConversationId,
        lastSeenRoomTurnId: normalized.participants.host.lastSeenRoomTurnId
      },
      toolSidecars,
      personaGuests,
      chatTarget: normalized.participants.chatTarget,
      selectedToolId: normalized.selectedToolId
    });

    const activeHostPins = hostWriterSources.filter(
      (source) => source.kind === 'pin' && source.stale !== true
    );
    const activeHostPin = hostConversationId ? activeHostPins[0] : undefined;
    const discardedConversationIds = this.participantRoster.conversationIds();

    // Prepared collaborator values are aggregate-owned mutable drafts until
    // this shared barrier: degradation may reconcile them above it, but no
    // throwing work may cross below it. Everything after here is synchronous,
    // assignment-only installation of the fully reconciled room.
    this.contextAttachments = contextAttachments;
    this.contextRevision = normalized.revisions.context;
    this.pendingContextRevision = pendingContextRevision;
    this.attachmentCounter = normalized.counters.attachment;
    this.pendingMessageAttachments = pendingMessageAttachments;
    this.threadArtifactCounter = normalized.counters.threadArtifact;
    this.threadArtifacts = threadArtifacts;
    this.hostWriterSources = hostWriterSources;
    this.activeHostPin = activeHostPin;
    this.toolWriterSources = toolWriterSources;
    this.guestWriterSources = guestWriterSources;
    this.activeRun = undefined;
    this.widgetConfigLedger.installPreparedState(widgetConfigState);
    this.standingDirectiveLedger.installPreparedState(standingDirectiveState);
    this.todoLedger.installPreparedState(todoState);
    this.turnLedger.installPreparedState(turnState);
    this.passageScope.installPreparedState(passageState);
    this.participantRoster.installPreparedState(rosterState);
    this.behavior = behavior;
    this.lastCommittedPersonaBehavior = lastCommittedPersonaBehavior;

    return {
      discardedConversationIds,
      degradedConversationKeys,
      normalizations: normalization.normalizations,
      recoveryNotices: normalization.notices
    };
  }

  getSnapshot(): WorkshopSessionSnapshot {
    const windowed = this.turnLedger.window(WORKSHOP_SNAPSHOT_TURN_WINDOW);
    const passageState = this.passageScope.exportState();
    const visibleWidgetConfigIds = new Set(
      [
        ...windowed.map((turn) => turn.widgetCommit?.widgetConfigId),
        ...this.standingDirectiveLedger.list().map((directive) => directive.widgetConfigId)
      ].filter((id): id is string => id !== undefined)
    );
    return {
      excerpt: passageState.excerpt ? excerptSnapshot(passageState.excerpt) : undefined,
      scope: passageState.scope,
      participantSubjectReady: this.getParticipantSubjectStatus().ready,
      shelvedExcerpt: passageState.shelvedExcerpt
        ? excerptSnapshot(passageState.shelvedExcerpt)
        : undefined,
      excerptVersion: passageState.excerptVersion,
      replacementCount: passageState.replacementCount,
      contextAttachments: this.contextAttachments.map(attachmentSnapshot),
      pendingMessageAttachments: this.pendingMessageAttachments.map(messageAttachmentSnapshot),
      pendingHostUpdate: passageState.pendingRevisionVersion !== undefined
        || this.pendingContextRevision !== undefined
        ? {
            excerptVersion: passageState.pendingRevisionVersion,
            context: this.pendingContextRevision !== undefined
          }
        : undefined,
      todos: this.todoLedger.list(passageState.excerptVersion),
      widgetConfigs: this.widgetConfigLedger.summariesFor(visibleWidgetConfigIds),
      standingDirectives: this.standingDirectiveSummaries(),
      turns: windowed,
      totalTurns: this.turnLedger.count(),
      truncatedTurns: this.turnLedger.count() - windowed.length,
      roomHasMemory: this.hasRoomMemory(),
      participants: this.participantRoster.snapshot(),
      conversationBehavior: { ...this.behavior },
      selectedToolId: this.participantRoster.getSelectedToolId(),
      activeToolId: this.activeRun?.target === 'tool' ? this.activeRun.toolId : undefined,
      activeRequestId: this.activeRun?.requestId
    };
  }

  private standingDirectiveSummaries(): WorkshopStandingDirectiveSummary[] {
    return this.standingDirectiveLedger.list().map((directive) => {
      const config = this.widgetConfigLedger.get(directive.widgetConfigId);
      if (!config) {
        throw new Error(
          `Standing directive ${directive.id} has no matching widget config`
        );
      }
      return summarizeWorkshopStandingDirective(directive, config);
    });
  }

  private beginMessage(
    requestId: string,
    displayText: string,
    target: 'host' | 'tool' | 'personaGuest',
    toolId?: WorkshopToolId,
    guestPersonaId?: WorkshopPersonaId,
    messageAttachments?: readonly WorkshopMessageAttachmentSnapshot[],
    widgetCommit?: WorkshopTurnWidgetCommit
  ): WorkshopTurn {
    const reportTurnId = toolId
      ? this.participantRoster.getToolSidecarLatestReportTurnId(toolId)
      : undefined;
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
      reportTurnId: target === 'tool' ? reportTurnId : undefined,
      messageAttachments: messageAttachments && messageAttachments.length > 0
        ? messageAttachments.map(cloneMessageAttachmentSnapshot)
        : undefined,
      widgetCommit: widgetCommit ? { ...widgetCommit } : undefined,
      content: displayText,
      timestamp: this.now(),
      excerptVersion: this.getExcerptVersion(),
      ...behaviorMetadata
    };
    this.turnLedger.append(turn);
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
      reportTurnId: target === 'tool' ? reportTurnId : undefined,
      writerTurnId: turn.id,
      excerptVersion: this.getExcerptVersion(),
      ...behaviorMetadata
    };
    return cloneTurn(turn);
  }

  private removeWriterSourceArtifact(artifactId: string): void {
    const withoutArtifact = (entries: readonly ContextSourceEntry[]) =>
      entries.filter((entry) => entry.artifactId !== artifactId);
    this.hostWriterSources = withoutArtifact(this.hostWriterSources);
    for (const toolId of Object.keys(this.toolWriterSources) as WorkshopToolId[]) {
      this.toolWriterSources[toolId] = withoutArtifact(this.toolWriterSources[toolId] ?? []);
    }
    for (const [personaId, entries] of this.guestWriterSources) {
      this.guestWriterSources.set(personaId, withoutArtifact(entries));
    }
  }

  /** One replace-and-cursor policy for writer- and persona-requested reports. */
  private adoptToolSidecar(
    toolId: WorkshopToolId,
    conversationId: string,
    latestReportTurnId: string
  ): string | undefined {
    const replacedConversationId = this.participantRoster.adoptToolSidecar(
      toolId,
      conversationId,
      latestReportTurnId
    );
    // A sidecar is a fresh conversation on adoption: its writer-origin rows
    // are exactly the pin + standing attachments its run received (Phase 7).
    // Replacement replaces the manifest with the conversation.
    const pin = this.pinEntry();
    this.toolWriterSources[toolId] = [
      ...(pin ? [pin] : []),
      ...this.contextAttachments.map((attachment) => this.attachmentEntry(attachment))
    ];
    return replacedConversationId;
  }

  private requireExcerpt(): void {
    this.passageScope.requireExcerpt();
  }

  /**
   * What a participant turn needs to exist: a pinned passage, or an open
   * conversation, which is a real scope rather than a blank excerpt. A session
   * whose path is still unchosen has no subject at all — the writer has not
   * told us what this room is for yet.
   */
  getParticipantSubjectStatus(): WorkshopParticipantSubjectStatus {
    return this.passageScope.getParticipantSubjectStatus();
  }

  private requireParticipantSubject(): void {
    this.passageScope.requireParticipantSubject();
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

  private nextTurnId(role: 'user' | 'assistant' | 'system'): string {
    return this.turnLedger.nextId(role);
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
