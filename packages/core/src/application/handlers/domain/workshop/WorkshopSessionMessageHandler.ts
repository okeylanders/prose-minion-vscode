/**
 * Session-persistence IPC slice for Workshop.
 *
 * WorkshopRoomHandler owns the room and run orchestration. This per-webview
 * collaborator owns only New/Rewind/Save/Open/browser messages, response
 * envelopes, and cancellation of superseded browser searches.
 */

import { MessageRouter } from '@handlers/MessageRouter';
import { MessageTransport } from '@handlers/MessageHandlerContracts';
import {
  WorkshopRewindCut,
  WorkshopRewindOutcome,
  WorkshopRewindRefusedError,
  WorkshopSessionPersistenceCoordinator
} from '@/application/services/workshop/WorkshopSessionPersistenceCoordinator';
import { LogSink, ShellService } from '@/platform';
import {
  MessageType,
  WorkshopComposerDraftRestoredMessage,
  WorkshopDeleteSessionMessage,
  WorkshopDuplicateSessionMessage,
  WorkshopListSessionsMessage,
  WorkshopOpenSessionMessage,
  WorkshopRefreshContextFilesMessage,
  WorkshopRenameSessionMessage,
  WorkshopRequestSessionMessage,
  WorkshopResetSessionMessage,
  WorkshopRevealSessionMessage,
  WorkshopRewindSessionMessage,
  WorkshopSaveSessionMessage,
  WorkshopSessionAction,
  WorkshopSessionActionResultMessage,
  WorkshopSessionContextScanMessage,
  WorkshopSessionRecoveryNoticeMessage,
  WorkshopSessionsDataMessage,
  WorkshopWidgetConfigRestoredMessage
} from '@messages';
import type {
  WorkshopMutationRouteRegistrar
} from '@handlers/domain/workshop/WorkshopRouteContracts';
import { workshopPersonaLabel, isWorkshopPersonaId } from '@shared/constants/workshopPersonas';
import { workshopToolLabel, isWorkshopToolId } from '@shared/constants/workshopTools';
import { workshopRewindUnavailableReason } from '@shared/constants/workshopRewind';

let sessionRequestCounter = 0;
const generateSessionRequestId = (): string =>
  `workshop_sessions-${Date.now()}-${++sessionRequestCounter}`;

export interface WorkshopSessionMessageHandlerOptions {
  postSessionState: () => void;
  /** Re-read file-backed context with explicit or automatic persistence semantics. */
  refreshContextFiles: (origin: 'manual' | 'session-open') => Promise<void>;
  flushDeferredConversationSettings: () => Promise<void>;
  reportError: (message: string, details?: string) => void;
  /** Human label for a run currently blocking state replacement. */
  activeRunLabel: () => 'Context wizard' | 'response' | undefined;
  /** The cut a thread bubble offers (ADR 2026-09-30 §1), if any. */
  rewindCutForBubble: (turnId: string) => WorkshopRewindCut | undefined;
}

export class WorkshopSessionMessageHandler {
  private sessionListAbortController?: AbortController;
  /** A mounted panel reads the already-hydrated rolling session once. */
  private initialContextRefreshCompleted = false;
  private scanningContextFiles = false;

  constructor(
    private readonly persistence: WorkshopSessionPersistenceCoordinator,
    private readonly postMessage: MessageTransport,
    private readonly shell: ShellService,
    private readonly outputChannel: LogSink,
    private readonly options: WorkshopSessionMessageHandlerOptions
  ) {}

  registerRoutes(
    router: MessageRouter,
    registerMutation: WorkshopMutationRouteRegistrar
  ): void {
    registerMutation(MessageType.WORKSHOP_REFRESH_CONTEXT_FILES, this.handleRefreshContextFiles.bind(this));
    registerMutation(MessageType.WORKSHOP_RESET_SESSION, this.handleResetSession.bind(this), 'new');
    registerMutation(MessageType.WORKSHOP_REWIND_SESSION, this.handleRewindSession.bind(this), 'rewind');
    router.register(MessageType.WORKSHOP_REQUEST_SESSION, this.handleRequestSession.bind(this));
    registerMutation(MessageType.WORKSHOP_SAVE_SESSION, this.handleSaveSession.bind(this), 'save');
    router.register(MessageType.WORKSHOP_LIST_SESSIONS, this.handleListSessions.bind(this));
    registerMutation(MessageType.WORKSHOP_OPEN_SESSION, this.handleOpenSession.bind(this), 'open');
    registerMutation(MessageType.WORKSHOP_RENAME_SESSION, this.handleRenameSession.bind(this), 'rename');
    registerMutation(
      MessageType.WORKSHOP_DUPLICATE_SESSION,
      this.handleDuplicateSession.bind(this),
      'duplicate'
    );
    router.register(MessageType.WORKSHOP_REVEAL_SESSION, this.handleRevealSession.bind(this));
    registerMutation(MessageType.WORKSHOP_DELETE_SESSION, this.handleDeleteSession.bind(this), 'delete');
  }

  dispose(): void {
    this.sessionListAbortController?.abort();
    this.sessionListAbortController = undefined;
  }

  postActionResult(action: WorkshopSessionAction, ok: boolean, message: string): void {
    const result: WorkshopSessionActionResultMessage = {
      type: MessageType.WORKSHOP_SESSION_ACTION_RESULT,
      source: 'extension.workshop',
      payload: { action, ok, message },
      timestamp: Date.now()
    };
    void this.postMessage(result);
  }

  async handleResetSession(message: WorkshopResetSessionMessage): Promise<void> {
    if (this.rejectWhileRunning('start a new session', 'new')) {
      return;
    }
    const clearWorkingSet = message.payload?.clearWorkingSet === true;
    try {
      const cleared = await this.persistence.resetSession({ clearWorkingSet });
      await this.options.flushDeferredConversationSettings();
      this.outputChannel.appendLine(
        '[WorkshopSessionMessageHandler] Session reset and current checkpoint replaced' +
        (clearWorkingSet
          ? ` (full reset — excerpt: ${cleared.excerptLabel ?? 'none'};` +
            ` context cleared: ${cleared.attachmentLabels.length > 0
              ? cleared.attachmentLabels.join(', ')
              : 'none'})`
          : '')
      );
      this.options.postSessionState();
      this.postActionResult(
        'new',
        true,
        clearWorkingSet
          ? 'Started an empty Workshop session — excerpt and context cleared.'
          : 'Started a new Workshop session.'
      );
    } catch (error) {
      this.options.postSessionState();
      this.postActionFailure('new', error);
    }
  }

  /**
   * Rewind to one bubble (ADR 2026-09-30 §6). The bubble maps to its cut
   * here; the coordinator re-checks the cut, cuts, installs and writes the
   * room, or restores the prior one. A writer-message rewind is an edit (see
   * `postEditRestores`).
   */
  async handleRewindSession(message: WorkshopRewindSessionMessage): Promise<void> {
    if (this.rejectWhileRunning('rewind the conversation', 'rewind')) {
      return;
    }
    const turnId = typeof message.payload?.turnId === 'string' ? message.payload.turnId : '';
    const cut = this.options.rewindCutForBubble(turnId);
    if (!cut) {
      this.postActionResult('rewind', false, `${workshopRewindUnavailableReason('not-a-rest-point')}.`);
      return;
    }
    try {
      const outcome = await this.persistence.rewindTo(cut, { origin: 'writer' });
      await this.options.flushDeferredConversationSettings();
      this.options.postSessionState();
      this.postEditRestores(outcome);
      this.postActionResult('rewind', true, describeRewindOutcome(outcome));
    } catch (error) {
      this.options.postSessionState();
      if (error instanceof WorkshopRewindRefusedError) {
        this.outputChannel.appendLine(
          `[WorkshopSessionMessageHandler] Rewind refused (turn=${turnId}, reason=${error.reason})`
        );
        this.postActionResult('rewind', false, `${workshopRewindUnavailableReason(error.reason)}.`);
      } else {
        this.postActionFailure('rewind', error);
      }
    } finally {
      this.postRecoveryNotices();
    }
  }

  /**
   * A writer-bubble cut is an edit: what it removed returns to where the
   * writer made it. Message text goes back to the composer (its attachments
   * come back through session state); a widget message reopens its widget.
   */
  private postEditRestores(
    outcome: Pick<WorkshopRewindOutcome, 'composerRestore' | 'widgetRestore'>
  ): void {
    if (outcome.composerRestore) {
      const restored: WorkshopComposerDraftRestoredMessage = {
        type: MessageType.WORKSHOP_COMPOSER_DRAFT_RESTORED,
        source: 'extension.workshop',
        payload: { text: outcome.composerRestore.text },
        timestamp: Date.now()
      };
      void this.postMessage(restored);
    }
    if (outcome.widgetRestore) {
      const reopened: WorkshopWidgetConfigRestoredMessage = {
        type: MessageType.WORKSHOP_WIDGET_CONFIG_RESTORED,
        source: 'extension.workshop',
        payload: { widgetConfigId: outcome.widgetRestore.widgetConfigId },
        timestamp: Date.now()
      };
      void this.postMessage(reopened);
    }
  }

  async handleRequestSession(_message: WorkshopRequestSessionMessage): Promise<void> {
    try {
      await this.persistence.waitForSessionOperations();
      if (!this.options.activeRunLabel()) {
        await this.persistence.refreshNamedSession(async (changed) => {
          if (changed) {
            this.initialContextRefreshCompleted = false;
          }
          if (!this.initialContextRefreshCompleted && !this.options.activeRunLabel()) {
            await this.scanContextFiles();
            this.initialContextRefreshCompleted = true;
          }
        });
      }
      await this.options.flushDeferredConversationSettings();
      this.options.postSessionState();
    } catch (error) {
      this.options.reportError('Could not load the saved Workshop session.', this.errorMessage(error));
      this.options.postSessionState();
    } finally {
      this.postRecoveryNotices();
      // Replay authoritative busy state even if the hidden tab missed scan-end.
      this.postScanState(this.scanningContextFiles);
    }
  }

  async handleSaveSession(message: WorkshopSaveSessionMessage): Promise<void> {
    if (this.rejectWhileRunning('save this session', 'save')) {
      return;
    }
    try {
      const targetSessionId = message.payload?.sessionId?.trim() || undefined;
      const saved = await this.persistence.saveNamed(
        message.payload?.title ?? '',
        targetSessionId
      );
      this.postActionResult(
        'save',
        true,
        targetSessionId ? `Updated “${saved.title}”.` : `Saved “${saved.title}”.`
      );
    } catch (error) {
      this.postActionFailure('save', error);
    }
  }

  async handleListSessions(message: WorkshopListSessionsMessage): Promise<void> {
    const requestId = typeof message.payload?.requestId === 'string'
      ? message.payload.requestId
      : generateSessionRequestId();
    this.sessionListAbortController?.abort();
    const controller = new AbortController();
    this.sessionListAbortController = controller;
    try {
      const data = await this.persistence.list(message.payload?.query, controller.signal);
      if (controller.signal.aborted || this.sessionListAbortController !== controller) {
        return;
      }
      const response: WorkshopSessionsDataMessage = {
        type: MessageType.WORKSHOP_SESSIONS_DATA,
        source: 'extension.workshop',
        payload: {
          requestId,
          available: data.availability.available,
          unavailableReason: data.availability.available
            ? undefined
            : data.availability.reason,
          current: data.current,
          sessions: data.sessions,
          truncated: data.truncated,
          searchTruncated: data.searchTruncated
        },
        timestamp: Date.now()
      };
      void this.postMessage(response);
    } catch (error) {
      if (controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
        return;
      }
      const details = this.errorMessage(error);
      const availability = this.persistence.availability();
      const response: WorkshopSessionsDataMessage = {
        type: MessageType.WORKSHOP_SESSIONS_DATA,
        source: 'extension.workshop',
        payload: {
          requestId,
          available: availability.available,
          unavailableReason: availability.available ? undefined : availability.reason,
          error: details,
          sessions: []
        },
        timestamp: Date.now()
      };
      void this.postMessage(response);
      this.options.reportError('Could not list Workshop sessions.', details);
      this.outputChannel.appendLine(
        `[WorkshopSessionMessageHandler] Could not list sessions: ${details}`
      );
    } finally {
      if (this.sessionListAbortController === controller) {
        this.sessionListAbortController = undefined;
      }
    }
  }

  async handleOpenSession(message: WorkshopOpenSessionMessage): Promise<void> {
    if (this.rejectWhileRunning('open another session', 'open')) {
      return;
    }
    try {
      const result = await this.persistence.openNamed(message.payload?.sessionId ?? '', async () => {
        await this.scanContextFiles();
        this.initialContextRefreshCompleted = true;
      });
      this.options.postSessionState();
      const degraded = result.degradedConversationKeys.length;
      this.postActionResult(
        'open',
        true,
        degraded > 0
          ? `Session opened. ${degraded} conversation ${
            degraded === 1 ? 'history was' : 'histories were'
          } restored without retained memory.`
          : 'Session opened with conversation memory restored.'
      );
    } catch (error) {
      this.postActionFailure('open', error);
    } finally {
      this.postRecoveryNotices();
    }
  }

  async handleRefreshContextFiles(_message: WorkshopRefreshContextFilesMessage): Promise<void> {
    const activeRun = this.options.activeRunLabel();
    if (activeRun) {
      this.options.reportError(`Wait for the active ${activeRun} to finish before refreshing context files.`);
      return;
    }
    try {
      await this.persistence.runContextRefresh(() => this.scanContextFiles('manual'));
    } catch (error) {
      this.options.reportError('Could not refresh Workshop context files.', this.errorMessage(error));
    } finally {
      this.options.postSessionState();
    }
  }

  private postScanState(scanning: boolean): void {
    const message: WorkshopSessionContextScanMessage = {
      type: MessageType.WORKSHOP_SESSION_CONTEXT_SCAN,
      source: 'extension.workshop',
      payload: { scanning },
      timestamp: Date.now()
    };
    void this.postMessage(message);
  }

  private async scanContextFiles(origin: 'manual' | 'session-open' = 'session-open'): Promise<void> {
    this.scanningContextFiles = true;
    this.postScanState(true);
    try {
      await this.options.refreshContextFiles(origin);
    } finally {
      this.scanningContextFiles = false;
      this.postScanState(false);
    }
  }

  private postRecoveryNotices(): void {
    for (const notice of this.persistence.consumeRecoveryNotices()) {
      const message: WorkshopSessionRecoveryNoticeMessage = {
        type: MessageType.WORKSHOP_SESSION_RECOVERY_NOTICE,
        source: 'extension.workshop',
        payload: { ...notice },
        timestamp: Date.now()
      };
      void this.postMessage(message);
    }
  }

  async handleRenameSession(message: WorkshopRenameSessionMessage): Promise<void> {
    if (this.rejectWhileRunning('rename a saved session', 'rename')) {
      return;
    }
    try {
      const renamed = await this.persistence.renameNamed(
        message.payload?.sessionId ?? '',
        message.payload?.title ?? ''
      );
      this.postActionResult('rename', true, `Renamed to “${renamed.title}”.`);
    } catch (error) {
      this.postActionFailure('rename', error);
    }
  }

  async handleDuplicateSession(message: WorkshopDuplicateSessionMessage): Promise<void> {
    if (this.rejectWhileRunning('duplicate a saved session', 'duplicate')) {
      return;
    }
    try {
      const duplicated = await this.persistence.duplicateNamed(
        message.payload?.sessionId ?? '',
        message.payload?.title
      );
      this.postActionResult('duplicate', true, `Duplicated as “${duplicated.title}”.`);
    } catch (error) {
      this.postActionFailure('duplicate', error);
    }
  }

  async handleRevealSession(message: WorkshopRevealSessionMessage): Promise<void> {
    try {
      const filePath = await this.persistence.resolveRevealPath(
        message.payload?.sessionId ?? ''
      );
      await this.shell.revealFileInOS(filePath);
      this.postActionResult('reveal', true, 'Session file revealed.');
    } catch (error) {
      this.postActionFailure('reveal', error);
    }
  }

  async handleDeleteSession(message: WorkshopDeleteSessionMessage): Promise<void> {
    if (this.rejectWhileRunning('delete a saved session', 'delete')) {
      return;
    }
    try {
      await this.persistence.deleteNamed(message.payload?.sessionId ?? '');
      this.postActionResult('delete', true, 'Saved session deleted.');
    } catch (error) {
      this.postActionFailure('delete', error);
    }
  }

  private rejectWhileRunning(action: string, sessionAction: WorkshopSessionAction): boolean {
    const activeRunLabel = this.options.activeRunLabel();
    if (!activeRunLabel) {
      return false;
    }
    this.postActionResult(
      sessionAction,
      false,
      `Wait for the current ${activeRunLabel} to finish before you ${action}.`
    );
    return true;
  }

  private postActionFailure(action: WorkshopSessionAction, error: unknown): void {
    const details = this.errorMessage(error);
    this.outputChannel.appendLine(
      `[WorkshopSessionMessageHandler] Session ${action} failed: ${details}`
    );
    this.postActionResult(action, false, details);
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}

/** The action result a writer reads after a rewind: what went, and what to redo. */
function describeRewindOutcome(outcome: WorkshopRewindOutcome): string {
  const removed = outcome.summary.removedTurnCount;
  const sentences = [
    removed === 0
      ? 'Rewound: nothing after this point to remove.'
      : `Rewound: ${removed} ${removed === 1 ? 'turn' : 'turns'} removed.`,
    ...outcome.summary.droppedConversationKeys.map(describeDroppedParticipant)
  ];
  const unrestored = outcome.composerRestore?.unrestoredAttachmentLabels ?? [];
  if (unrestored.length > 0) {
    sentences.push(`Re-attach ${unrestored.join(', ')} before you send it again.`);
  }
  return sentences.join(' ');
}

function describeDroppedParticipant(key: string): string {
  if (key === 'host') {
    return 'The host starts fresh from here.';
  }
  const id = key.slice(key.indexOf(':') + 1);
  if (key.startsWith('guest:') && isWorkshopPersonaId(id)) {
    return `${workshopPersonaLabel(id)} left the room.`;
  }
  if (key.startsWith('tool:') && isWorkshopToolId(id)) {
    return `The ${workshopToolLabel(id)} tool's conversation was set aside; run it again for a fresh report.`;
  }
  return 'A participant was set aside.';
}
