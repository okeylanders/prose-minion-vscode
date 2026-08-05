/**
 * Session-persistence IPC slice for Workshop.
 *
 * WorkshopHandler owns the room and run orchestration. This per-webview
 * collaborator owns only New/Save/Open/browser messages, response envelopes,
 * and cancellation of superseded browser searches.
 */

import { MessageRouter } from '@/application/handlers/MessageRouter';
import { MessageTransport } from '@/application/handlers/MessageHandlerContracts';
import { WorkshopSessionPersistenceCoordinator } from '@/application/services/workshop/WorkshopSessionPersistenceCoordinator';
import { LogSink, ShellService } from '@/platform';
import {
  MessageType,
  WorkshopDeleteSessionMessage,
  WorkshopDuplicateSessionMessage,
  WorkshopListSessionsMessage,
  WorkshopOpenSessionMessage,
  WorkshopRenameSessionMessage,
  WorkshopRequestSessionMessage,
  WorkshopResetSessionMessage,
  WorkshopRevealSessionMessage,
  WorkshopSaveSessionMessage,
  WorkshopSessionAction,
  WorkshopSessionActionResultMessage,
  WorkshopSessionsDataMessage
} from '@messages';
import type {
  WorkshopMutationRouteRegistrar
} from '@handlers/domain/workshop/WorkshopHandlerContracts';

let sessionRequestCounter = 0;
const generateSessionRequestId = (): string =>
  `workshop_sessions-${Date.now()}-${++sessionRequestCounter}`;

export interface WorkshopSessionMessageHandlerOptions {
  postSessionState: () => void;
  flushDeferredConversationSettings: () => Promise<void>;
  reportError: (message: string, details?: string) => void;
  /** Human label for a run currently blocking state replacement. */
  activeRunLabel: () => 'Context wizard' | 'response' | undefined;
}

export class WorkshopSessionMessageHandler {
  private sessionListAbortController?: AbortController;

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
    registerMutation(MessageType.WORKSHOP_RESET_SESSION, this.handleResetSession.bind(this), 'new');
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

  async handleRequestSession(_message: WorkshopRequestSessionMessage): Promise<void> {
    await this.persistence.waitForSessionOperations();
    await this.options.flushDeferredConversationSettings();
    this.options.postSessionState();
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
      const result = await this.persistence.openNamed(message.payload?.sessionId ?? '');
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
