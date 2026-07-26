/**
 * Workshop domain handler (ADR 2026-07-03; Sprint 2 session spine, Sprint 3
 * multi-turn).
 *
 * The 12th domain. Routes the Workshop editor tab's messages onto the
 * EXISTING analysis tools: WORKSHOP_RUN_TOOL invokes dialogue / prose / the
 * twelve WritingToolsFocus modes through AssistantToolService, streams chunks
 * under `domain: 'workshop'`, and appends the completed turn pair to the
 * shared WorkshopSessionService aggregate. Session truth lives in the
 * service (composition-root-owned, outlives this handler); the handler owns
 * only messaging, streaming, and run lifecycle.
 *
 * Sprint 06B makes every tool run an isolated retained sidecar: the exact tool
 * report lands first, then the permanent persona host receives bounded
 * evidence and synthesizes a separate attributed turn. Explicit direct-tool
 * mode continues the sidecar without relaying through the host.
 *
 * Preemption semantics are unchanged from Sprint 2: a new run preempts any
 * in-flight one, reset aborts, and zombie completions are refused + logged.
 */

import { FileSystem, FileType, LogSink, ShellService, Workspace } from '@/platform';
import { AssistantToolService } from '@services/analysis/AssistantToolService';
import { ContextAssistantService } from '@services/analysis/ContextAssistantService';
import {
  WorkshopContextAttachmentInput,
  WorkshopExcerptReplacement,
  WorkshopMessageAttachmentInput,
  WorkshopScopeLockedError,
  WorkshopScopeTransition,
  WorkshopSessionService,
  workshopTextNoteLabel
} from '@/application/services/workshop/WorkshopSessionService';
import { RunWorkshopToolSidePass } from '@/application/services/workshop/RunWorkshopToolSidePass';
import {
  WorkshopRoomDeliveryService
} from '@/application/services/workshop/WorkshopRoomDeliveryService';
import {
  WorkshopConfiguredResourceLoadResult,
  WorkshopContextResourceService
} from '@/application/services/workshop/WorkshopContextResourceService';
import { WorkshopConversationSettingsService } from '@/application/services/workshop/WorkshopConversationSettingsService';
import {
  WorkshopPreparedTimeNotice,
  WorkshopSessionTimeService,
  workshopGuestConversationKey
} from '@/application/services/workshop/WorkshopSessionTimeService';
import { WorkshopSessionPersistenceCoordinator } from '@/application/services/workshop/WorkshopSessionPersistenceCoordinator';
import { WorkshopPersonaCapabilityFactory } from '@/application/services/workshop/WorkshopPersonaCapability';
import {
  buildWorkshopContextAttachmentsFrame,
  buildWorkshopExcerptSourceFrame,
  buildWorkshopGuestJoinMessage,
  buildWorkshopGuestMessage,
  buildWorkshopHostMessage,
  buildWorkshopHostUpdateFrame,
  buildWorkshopBehaviorActivationFrame,
  buildWorkshopInteractionFrame,
  buildWorkshopInteractionTransitionFrame,
  buildWorkshopThreadArtifactFrame,
  buildWorkshopTodoEvidence,
  describeWorkshopPendingHostUpdates
} from '@/application/services/workshop/WorkshopPromptBuilder';
import {
  completeWorkshopRun,
  workshopMessageCompletionCopy
} from '@/application/services/workshop/WorkshopRunCompletion';
import { isWorkshopToolId, workshopToolLabel } from '@shared/constants/workshopTools';
import {
  WORKSHOP_SCOPE_LOCK_RECOVERY_MESSAGE
} from '@shared/constants/workshopScope';
import { isContextPathGroup } from '@shared/types/context';
import {
  isWorkshopPersonaId,
  workshopPersonaLabel
} from '@shared/constants/workshopPersonas';
import { workshopQuickActionPrompt } from '@shared/constants/workshopQuickActions';
import { countWords, trimToWordLimit } from '@/utils/textUtils';
import { workshopWriterPreferredAddress } from '@/utils/workshopWriterProfile';
import { fileURLToPath, pathToFileURL } from 'url';
import { createHash } from 'crypto';
import * as path from 'path';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  MessageType,
  API_KEY_NOT_CONFIGURED_HEADING,
  CancelWorkshopRequestMessage,
  ErrorMessage,
  ErrorSource,
  StatusMessage,
  StreamStartedMessage,
  StreamChunkMessage,
  StreamCompleteMessage,
  TokenUsage,
  WorkshopExcerpt,
  WorkshopExcerptSource,
  WorkshopExcerptTruncation,
  coerceWorkshopExcerptSource,
  workshopExcerptSourcePath,
  workshopExcerptSourceUri,
  WorkshopPickExcerptFileMessage,
  WorkshopRereadExcerptMessage,
  WorkshopRequestSessionMessage,
  WorkshopResetSessionMessage,
  WorkshopQuickActionMessage,
  WorkshopRunToolMessage,
  WorkshopSendMessageMessage,
  WorkshopInviteGuestMessage,
  WorkshopDismissGuestMessage,
  WorkshopSelectPersonaMessage,
  WorkshopSetChatTargetMessage,
  WorkshopAddContextTextMessage,
  WorkshopAddContextFileMessage,
  WorkshopRemoveContextAttachmentMessage,
  WorkshopUpdateContextTextMessage,
  WorkshopRequestContextAttachmentMessage,
  WorkshopOpenContextAttachmentFileMessage,
  WorkshopSetSessionScopeMessage,
  WorkshopRepinExcerptMessage,
  isWorkshopSelectableSessionScope,
  WorkshopRequestContextCatalogMessage,
  WorkshopContextCatalogMessage,
  WorkshopContextCatalogEntry,
  WorkshopSearchContextResourcesMessage,
  WorkshopContextSearchResultsMessage,
  WorkshopAddContextResourcesMessage,
  WorkshopAttachMessageResourcesMessage,
  WorkshopAttachMessageFileMessage,
  WorkshopRemoveMessageAttachmentMessage,
  WorkshopSetExcerptResourceMessage,
  WorkshopRunContextWizardMessage,
  WorkshopConfiguredResourceRef,
  WorkshopSetExcerptMessage,
  WorkshopSetConversationSettingsMessage,
  WorkshopTodoActionMessage,
  WorkshopSessionStateMessage,
  WorkshopSaveSessionMessage,
  WorkshopListSessionsMessage,
  WorkshopOpenSessionMessage,
  WorkshopRenameSessionMessage,
  WorkshopDuplicateSessionMessage,
  WorkshopRevealSessionMessage,
  WorkshopDeleteSessionMessage,
  WorkshopSessionAction,
  WorkshopSessionSaveStatusMessage,
  WorkshopToolId,
  WorkshopPersonaId,
  WorkshopChatTarget,
  LabeledContextBudgetSnapshot,
  WorkshopTurn,
  WorkshopTurnMessage,
} from '@messages';
import { WorkshopCapabilityPrincipal } from '@shared/types/workshopCapabilities';
import { MessageTransport } from '@handlers/MessageHandlerContracts';
import { MessageRouter } from '@handlers/MessageRouter';
import { WorkshopSessionMessageHandler } from '@handlers/domain/WorkshopSessionMessageHandler';

// Generate unique request IDs (module-scoped counter, same idiom as AnalysisHandler)
let requestIdCounter = 0;
const generateRequestId = (type: string) => `${type}-${Date.now()}-${++requestIdCounter}`;

/**
 * Head-slice guardrail for "Pin from file…" (Sprint 3): pin at most this many
 * words of a picked file — a long chapter fits whole; a novel gets its head
 * pinned WITH a visible truncation notice, never silently.
 */

const MID_RUN_EXCERPT_GUARD_MESSAGE =
  'A tool is still running. Wait for it to finish (or start a new session) before replacing the excerpt.';
const MID_WIZARD_EXCERPT_GUARD_MESSAGE =
  'The Context wizard is still running. Wait for it to finish or cancel it before replacing the excerpt.';

/**
 * Why a context edit was refused (Sprint 13A §6). Every branch names a reason
 * the writer can act on — the sheet keeps the draft, so a refusal must never
 * read as "your edit vanished".
 */
const WORKSHOP_CONTEXT_EDIT_REFUSALS: Readonly<
  Record<'unknown' | 'not-editable' | 'over-budget', (remainingWords: number) => string>
> = Object.freeze({
  unknown: () => 'That context attachment is no longer attached to this session.',
  'not-editable': () =>
    'Project files stay in sync with the file on disk. Edit the file itself, or add a text note instead.',
  'over-budget': (remainingWords) =>
    `That edit exceeds the shared context budget — ${remainingWords.toLocaleString('en-US')} words are available. Trim it, or remove another attachment first.`
});

const workshopScopeMutationError = (error: unknown, fallback: string): string =>
  error instanceof WorkshopScopeLockedError
    ? WORKSHOP_SCOPE_LOCK_RECOVERY_MESSAGE
    : error instanceof Error
      ? error.message
      : fallback;

const isAbsolutePath = (filePath: string): boolean =>
  filePath.startsWith('/') || /^[A-Za-z]:[\\/]/.test(filePath) || filePath.startsWith('\\\\');

const baseName = (filePath: string): string => filePath.split(/[\\/]/).filter(Boolean).pop() ?? filePath;

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const kib = bytes / 1024;
  if (kib < 1024) {
    return `${kib.toFixed(1)} KiB`;
  }
  return `${(kib / 1024).toFixed(1)} MiB`;
};

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const behaviorFramesFor = (
  metadata: Pick<WorkshopTurn, 'behavior' | 'behaviorTransition'>
): { interactionFrame?: string; activationFrame?: string; transitionFrame?: string } => ({
  interactionFrame: metadata.behavior
    ? buildWorkshopInteractionFrame(metadata.behavior)
    : undefined,
  activationFrame: metadata.behavior
    ? buildWorkshopBehaviorActivationFrame(metadata.behavior)
    : undefined,
  transitionFrame: metadata.behaviorTransition
    ? buildWorkshopInteractionTransitionFrame(metadata.behaviorTransition)
    : undefined
});

/** Optional direct-mode shortcut; explicit target state remains authoritative. */
export const isWorkshopHostReturnShortcut = (text: string, personaLabel: string): boolean =>
  new RegExp(
    `^(?:hey|hi|hello)(?:\\s+|,\\s*)${escapeRegExp(personaLabel)}(?:\\b|(?=\\s*[,!:?—-]))`,
    'i'
  ).test(text.trim());

export class WorkshopHandler {
  /** The single in-flight run — at most one; a new run preempts it. */
  private activeRun?: {
    requestId: string;
    /** Display label for logs/status ("Prose", "Follow-up", …). */
    label: string;
    toolId?: WorkshopToolId;
    guestPersonaId?: WorkshopPersonaId;
    controller: AbortController;
  };

  private readonly disposeStatusListener: () => void;
  private readonly disposeSessionSaveStatusListener: () => void;
  private readonly sessionMessageHandler: WorkshopSessionMessageHandler;

  /** The single in-flight Context wizard run — independent of activeRun. */
  private wizardRun?: { requestId: string; excerptVersion: number; controller: AbortController };

  constructor(
    private readonly assistantToolService: AssistantToolService,
    private readonly contextAssistantService: ContextAssistantService,
    private readonly session: WorkshopSessionService,
    private readonly roomDelivery: WorkshopRoomDeliveryService,
    private readonly runToolSidePass: RunWorkshopToolSidePass,
    private readonly capabilityFactory: WorkshopPersonaCapabilityFactory,
    private readonly postMessage: MessageTransport,
    private readonly shell: ShellService,
    private readonly fileSystem: FileSystem,
    private readonly workspace: Workspace,
    private readonly contextResourceService: WorkshopContextResourceService,
    private readonly conversationSettingsService: WorkshopConversationSettingsService,
    private readonly sessionTime: WorkshopSessionTimeService,
    private readonly sessionPersistence: WorkshopSessionPersistenceCoordinator,
    private readonly outputChannel: LogSink
  ) {
    // Guide-loading status is forwarded only while a Workshop run is in
    // flight — the service is shared with the sidebar's AnalysisHandler, and
    // un-gated forwarding would strand the other surface's status here.
    this.disposeStatusListener = this.assistantToolService.addStatusListener(
      (message, progress, tickerMessage) => {
        if (this.activeRun) {
          this.sendStatus(message, progress, tickerMessage);
        }
      }
    );
    this.disposeSessionSaveStatusListener =
      this.sessionPersistence.addSessionSaveStatusListener((event) => {
        const message: WorkshopSessionSaveStatusMessage = {
          type: MessageType.WORKSHOP_SESSION_SAVE_STATUS,
          source: 'extension.workshop',
          payload: { ...event },
          timestamp: Date.now()
        };
        void this.postMessage(message);
      });
    this.sessionMessageHandler = new WorkshopSessionMessageHandler(
      this.sessionPersistence,
      this.postMessage,
      this.shell,
      this.outputChannel,
      {
        postSessionState: () => this.postSessionState(),
        flushDeferredConversationSettings: async () => {
          await this.flushDeferredConversationSettings();
        },
        reportError: (message, details) => {
          this.sendError('workshop', message, details);
        },
        activeRunLabel: () => this.wizardRun
          ? 'Context wizard'
          : this.activeRun
            ? 'response'
            : undefined
      }
    );
  }

  /**
   * Register message routes for the workshop domain
   */
  registerRoutes(router: MessageRouter): void {
    const registerMutation = (
      messageType: MessageType,
      handler: (message: never) => Promise<void>,
      sessionAction?: WorkshopSessionAction
    ): void => {
      router.register(messageType, async (message) => {
        if (this.rejectRoomMutationDuringSessionOperation(sessionAction)) {
          return;
        }
        await handler(message as never);
      });
    };

    registerMutation(MessageType.WORKSHOP_RUN_TOOL, this.handleRunTool.bind(this));
    registerMutation(MessageType.WORKSHOP_QUICK_ACTION, this.handleQuickAction.bind(this));
    registerMutation(MessageType.WORKSHOP_SEND_MESSAGE, this.handleSendMessage.bind(this));
    registerMutation(MessageType.WORKSHOP_INVITE_GUEST, this.handleInviteGuest.bind(this));
    registerMutation(MessageType.WORKSHOP_DISMISS_GUEST, this.handleDismissGuest.bind(this));
    registerMutation(MessageType.WORKSHOP_SELECT_PERSONA, this.handleSelectPersona.bind(this));
    registerMutation(MessageType.WORKSHOP_SET_CHAT_TARGET, this.handleSetChatTarget.bind(this));
    registerMutation(
      MessageType.WORKSHOP_SET_CONVERSATION_SETTINGS,
      this.handleSetConversationSettings.bind(this)
    );
    registerMutation(MessageType.WORKSHOP_SET_EXCERPT, this.handleSetExcerpt.bind(this));
    registerMutation(MessageType.WORKSHOP_ADD_CONTEXT_TEXT, this.handleAddContextText.bind(this));
    registerMutation(MessageType.WORKSHOP_ADD_CONTEXT_FILE, this.handleAddContextFile.bind(this));
    registerMutation(
      MessageType.WORKSHOP_REMOVE_CONTEXT_ATTACHMENT,
      this.handleRemoveContextAttachment.bind(this)
    );
    registerMutation(
      MessageType.WORKSHOP_UPDATE_CONTEXT_TEXT,
      this.handleUpdateContextText.bind(this)
    );
    // Reads, not mutations: opening the sheet or the file must work while a
    // session operation is in flight.
    router.register(
      MessageType.WORKSHOP_REQUEST_CONTEXT_ATTACHMENT,
      this.handleRequestContextAttachment.bind(this)
    );
    router.register(
      MessageType.WORKSHOP_OPEN_CONTEXT_ATTACHMENT_FILE,
      this.handleOpenContextAttachmentFile.bind(this)
    );
    router.register(
      MessageType.WORKSHOP_REQUEST_CONTEXT_CATALOG,
      this.handleRequestContextCatalog.bind(this)
    );
    router.register(
      MessageType.WORKSHOP_SEARCH_CONTEXT_RESOURCES,
      this.handleSearchContextResources.bind(this)
    );
    registerMutation(
      MessageType.WORKSHOP_ADD_CONTEXT_RESOURCES,
      this.handleAddContextResources.bind(this)
    );
    registerMutation(
      MessageType.WORKSHOP_ATTACH_MESSAGE_RESOURCES,
      this.handleAttachMessageResources.bind(this)
    );
    registerMutation(
      MessageType.WORKSHOP_ATTACH_MESSAGE_FILE,
      this.handleAttachMessageFile.bind(this)
    );
    registerMutation(
      MessageType.WORKSHOP_REMOVE_MESSAGE_ATTACHMENT,
      this.handleRemoveMessageAttachment.bind(this)
    );
    registerMutation(
      MessageType.WORKSHOP_SET_EXCERPT_RESOURCE,
      this.handleSetExcerptResource.bind(this)
    );
    registerMutation(
      MessageType.WORKSHOP_RUN_CONTEXT_WIZARD,
      this.handleRunContextWizard.bind(this)
    );
    registerMutation(MessageType.WORKSHOP_TODO_ACTION, this.handleTodoAction.bind(this));
    registerMutation(MessageType.WORKSHOP_PICK_EXCERPT_FILE, this.handlePickExcerptFile.bind(this));
    registerMutation(MessageType.WORKSHOP_REREAD_EXCERPT, this.handleRereadExcerpt.bind(this));
    registerMutation(
      MessageType.WORKSHOP_SET_SESSION_SCOPE,
      this.handleSetSessionScope.bind(this)
    );
    registerMutation(MessageType.WORKSHOP_REPIN_EXCERPT, this.handleRepinExcerpt.bind(this));
    this.sessionMessageHandler.registerRoutes(router, registerMutation);
    router.register(MessageType.CANCEL_WORKSHOP_REQUEST, this.handleCancelRequest.bind(this));
  }

  /**
   * Release the shared-service subscription and abort any in-flight run.
   * The session aggregate survives (it is composition-root-owned) — only this
   * webview's run and listeners die with it. The retained conversation also
   * survives: it belongs to the session, not to this handler.
   */
  dispose(): void {
    this.disposeStatusListener();
    this.disposeSessionSaveStatusListener();
    this.sessionMessageHandler.dispose();
    if (this.activeRun) {
      this.outputChannel.appendLine(
        `[WorkshopHandler] Aborting in-flight run on dispose: ${this.activeRun.requestId}`
      );
      this.activeRun.controller.abort();
      this.session.abandonRun(this.activeRun.requestId);
      this.activeRun = undefined;
    }
    this.cancelWizardRun('dispose');
    void this.sessionPersistence.flush();
  }

  // Message handlers

  async handleRunTool(message: WorkshopRunToolMessage): Promise<void> {
    const { toolId } = message.payload;

    if (!isWorkshopToolId(toolId)) {
      this.sendError('workshop.run_tool', `Unknown Workshop tool: ${String(toolId)}`);
      return;
    }

    const excerpt = this.session.getExcerpt();
    if (!excerpt || excerpt.text.trim().length === 0) {
      this.sendError('workshop.run_tool', 'Pin an excerpt before running a tool.');
      return;
    }

    // A new run preempts any in-flight one: fresh turn, never continuation.
    this.preemptActiveRun();

    const controller = new AbortController();
    await this.runToolSidePass.run(toolId, excerpt, controller, {
      activatePhase: (requestId, label, activeToolId, activeController) => {
        this.activeRun = {
          requestId,
          label,
          toolId: activeToolId,
          controller: activeController
        };
      },
      streamStarted: (requestId) => this.sendStreamStarted(requestId),
      streamChunk: (requestId, token) => this.sendStreamChunk(requestId, token),
      streamCompleted: (requestId, content, cancelled, usage, truncated) =>
        this.sendStreamComplete(requestId, content, cancelled, usage, truncated),
      turnCompleted: (turn) => this.postTurn(turn),
      sessionChanged: () => {
        this.sessionPersistence.markDirty('tool run committed');
        this.postSessionState();
      },
      status: (status, tickerMessage) => this.sendStatus(status, undefined, tickerMessage),
      error: (errorMessage, details) =>
        this.sendError('workshop.run_tool', errorMessage, details),
      settled: (requestId) => this.settleActiveRun(requestId)
    });
  }

  async handleSetConversationSettings(
    message: WorkshopSetConversationSettingsMessage
  ): Promise<void> {
    if (this.activeRun) {
      this.sendError(
        'workshop',
        'A Workshop response is still running. Wait for it to finish before changing conversation settings.'
      );
      this.postSessionState();
      return;
    }

    try {
      const result = await this.conversationSettingsService.applyFromWebview(
        message.payload?.behavior,
        message.payload?.writerProfile
      );
      if (result.persistenceErrors) {
        const persistenceDetails = [
          result.persistenceErrors.behavior
            ? `behavior: ${result.persistenceErrors.behavior}`
            : undefined,
          result.persistenceErrors.writerProfile
            ? `writer profile: ${result.persistenceErrors.writerProfile}`
            : undefined
        ].filter(Boolean).join('; ');
        this.outputChannel.appendLine(
          `[WorkshopHandler] Conversation settings are active but could not be persisted: ${persistenceDetails}`
        );
        this.sendError(
          'workshop',
          'Conversation settings changed for this session, but VS Code could not save them for restart.',
          persistenceDetails
        );
      }
      if (result.changed) {
        this.sessionPersistence.markDirty('conversation settings changed');
      }
      this.postSessionState();
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(
        `[WorkshopHandler] Conversation settings change rejected; prior settings retained: ${details}`
      );
      this.sendError(
        'workshop',
        'Could not change conversation settings. The previous settings are still active.',
        details
      );
      this.postSessionState();
    }
  }

  /** Pull an external VS Code Settings/settings.json edit into the live room. */
  async syncConversationSettingsFromSettings(): Promise<void> {
    try {
      const result = await this.conversationSettingsService.syncFromSettings();
      if (!result.deferred) {
        if (result.changed) {
          this.sessionPersistence.markDirty('external conversation settings changed');
        }
        this.postSessionState();
      }
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(
        `[WorkshopHandler] External conversation settings sync failed: ${details}`
      );
      this.sendError(
        'workshop',
        'Could not apply the conversation settings changed in VS Code Settings.',
        details
      );
    }
  }

  /** The one composer message: host start/continuation or explicit direct tool. */
  async handleSendMessage(message: WorkshopSendMessageMessage): Promise<void> {
    const text = typeof message.payload?.text === 'string' ? message.payload.text.trim() : '';
    if (text.length === 0) {
      this.sendError('workshop.send_message', 'Cannot send an empty message.');
      return;
    }

    const target = this.session.getChatTarget();
    if (
      target.kind === 'tool' &&
      isWorkshopHostReturnShortcut(
        text,
        workshopPersonaLabel(this.session.getSelectedPersonaId())
      )
    ) {
      this.session.setChatTarget({ kind: 'host' });
      this.sessionPersistence.markDirty('chat target returned to host');
      this.postSessionState();
    }

    await this.executeMessage(text, text, undefined, { includeMessageAttachments: true });
  }

  async handleSelectPersona(message: WorkshopSelectPersonaMessage): Promise<void> {
    const personaId = message.payload?.personaId;
    if (!isWorkshopPersonaId(personaId)) {
      this.sendError('workshop.select_persona', `Unknown Workshop persona: ${String(personaId)}`);
      return;
    }
    try {
      this.session.selectPersona(personaId);
      this.sessionPersistence.markDirty('host persona selected');
      this.postSessionState();
    } catch (error) {
      this.sendError(
        'workshop.select_persona',
        'Choose a different persona by starting a new Workshop session.',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /** Start a fresh retained guest sidecar from an explicit writer invitation. */
  async handleInviteGuest(message: WorkshopInviteGuestMessage): Promise<void> {
    const personaId = message.payload?.personaId;
    if (!isWorkshopPersonaId(personaId)) {
      this.sendError('workshop.invite_guest', `Unknown Workshop persona: ${String(personaId)}`);
      return;
    }
    const openingMessage = message.payload?.openingMessage?.trim();
    if (!openingMessage) {
      this.sendError('workshop.invite_guest', 'Write an opening message for the guest.');
      return;
    }
    if (openingMessage.length > PROMPT_BUDGETS.guestOpening.characters) {
      this.sendError(
        'workshop.invite_guest',
        `Guest opening messages are limited to ${PROMPT_BUDGETS.guestOpening.characters.toLocaleString()} characters.`
      );
      return;
    }

    const excerpt = this.session.getExcerpt();
    if (!excerpt || excerpt.text.trim().length === 0) {
      this.sendError('workshop.invite_guest', 'Pin an excerpt before inviting a guest.');
      return;
    }

    try {
      this.session.validatePersonaGuestInvitation(personaId);
      this.preemptActiveRun();

      const requestId = generateRequestId('workshop_guest_join');
      const controller = new AbortController();
      const timeNotice = this.sessionTime.prepareNotice(
        workshopGuestConversationKey(personaId)
      );
      const writerProfile = this.conversationSettingsService.getWriterProfile();
      const userTurn = this.session.beginPersonaGuestJoin(
        personaId,
        requestId,
        openingMessage
      );
      const join = buildWorkshopGuestJoinMessage({
        guestPersonaId: personaId,
        excerpt,
        roomTurns: this.roomDelivery.prepareJoinSnapshot({
          kind: 'personaGuest',
          personaId
        }, userTurn.id),
        openingMessage,
        roomFrameOptions: {
          writerName: workshopWriterPreferredAddress(writerProfile),
          renderedAt: Date.now()
        },
        timeFrame: timeNotice?.frame,
        ...behaviorFramesFor(userTurn)
      });
      this.activeRun = {
        requestId,
        label: workshopPersonaLabel(personaId),
        guestPersonaId: personaId,
        controller
      };

      this.postTurn(userTurn);
      this.postSessionState();
      this.sendStreamStarted(requestId);
      this.sendStatus(`Inviting ${workshopPersonaLabel(personaId)} into the room…`);

      // Sprint 13C: the joining guest owns the same bounded instruments as
      // the host — dictionary, configured resources, excerpt analysis — with
      // its own principal persisted on every artifact.
      const guestCapability = this.capabilityFactory.create({
        requestId,
        personaId,
        owner: { kind: 'personaGuest', personaId },
        excerpt,
        excerptVersion: this.session.getExcerptVersion(),
        signal: controller.signal,
        events: {
          status: (message, tickerMessage) => this.sendStatus(message, undefined, tickerMessage),
          turnCompleted: (turn) => this.postTurn(turn),
          sessionChanged: () => {
            this.postSessionState();
            this.sessionPersistence.markDirty('participant capability committed');
          }
        }
      });

      try {
        const result = await this.assistantToolService.startWorkshopGuestConversation({
          personaId,
          message: join.message,
          behavior: userTurn.behavior!,
          writerProfile
        }, {
          signal: controller.signal,
          onToken: (token: string) => this.sendStreamChunk(requestId, token),
          capability: guestCapability
        });
        const assistantTurn = completeWorkshopRun({
          session: this.session,
          requestId,
          label: workshopPersonaLabel(personaId),
          result,
          aborted: controller.signal.aborted,
          createsRetainedConversation: true,
          copy: workshopMessageCompletionCopy(workshopPersonaLabel(personaId)),
          discardConversation: (id) => this.assistantToolService.discardConversation(id),
          log: (line) => this.outputChannel.appendLine(`[WorkshopHandler] ${line}`),
          events: {
            streamCompleted: (id, content, cancelled, usage, truncated) =>
              this.sendStreamComplete(id, content, cancelled, usage, truncated),
            turnCompleted: (turn) => this.postTurn(turn),
            status: (status) => this.sendStatus(status),
            error: (errorMessage, details) =>
              this.sendError('workshop.invite_guest', errorMessage, details)
          }
        });
        if (assistantTurn) {
          this.commitTimeNotice(timeNotice);
          this.session.setChatTarget({ kind: 'personaGuest', personaId });
          this.sendStatus(`${workshopPersonaLabel(personaId)} joined the room.`);
          this.sessionPersistence.markDirty('guest invitation completed');
        }
        this.postSessionState();
      } catch (error) {
        const details = error instanceof Error ? error.message : String(error);
        this.session.abandonRun(requestId);
        this.sendStreamComplete(requestId, '', true);
        if (error instanceof Error && error.name === 'AbortError') {
          this.sendStatus(`${workshopPersonaLabel(personaId)} invitation cancelled`);
        } else {
          this.sendError('workshop.invite_guest', `Failed to invite ${workshopPersonaLabel(personaId)}`, details);
        }
        this.postSessionState();
      } finally {
        this.settleActiveRun(requestId);
      }
    } catch (error) {
      this.sendError(
        'workshop.invite_guest',
        error instanceof Error ? error.message : 'That guest cannot join the room.'
      );
    }
  }

  /** Dispose a guest explicitly and discard its provider-side conversation. */
  async handleDismissGuest(message: WorkshopDismissGuestMessage): Promise<void> {
    const personaId = message.payload?.personaId;
    if (!isWorkshopPersonaId(personaId)) {
      this.sendError('workshop.dismiss_guest', `Unknown Workshop persona: ${String(personaId)}`);
      return;
    }
    if (this.activeRun?.guestPersonaId === personaId) {
      this.preemptActiveRun();
    }
    const conversationId = this.session.dismissPersonaGuest(personaId);
    if (!conversationId) {
      this.sendError('workshop.dismiss_guest', `${workshopPersonaLabel(personaId)} is not an active guest.`);
      return;
    }
    this.assistantToolService.discardConversation(conversationId);
    this.outputChannel.appendLine(
      `[WorkshopHandler] Guest dismissed (persona=${personaId}, conversation=${conversationId})`
    );
    this.sendStatus(`${workshopPersonaLabel(personaId)} left the room.`);
    this.sessionPersistence.markDirty('guest dismissed');
    this.postSessionState();
  }

  async handleSetChatTarget(message: WorkshopSetChatTargetMessage): Promise<void> {
    const target = message.payload;
    if (!target || !['host', 'tool', 'personaGuest'].includes(target.kind)) {
      this.sendError('workshop.set_chat_target', 'Invalid Workshop chat target.');
      return;
    }
    if (target.kind === 'tool' && !isWorkshopToolId(target.toolId)) {
      this.sendError('workshop.set_chat_target', `Unknown Workshop tool: ${String(target.toolId)}`);
      return;
    }
    if (target.kind === 'personaGuest' && !isWorkshopPersonaId(target.personaId)) {
      this.sendError('workshop.set_chat_target', `Unknown Workshop guest: ${String(target.personaId)}`);
      return;
    }
    if (!this.session.setChatTarget(target)) {
      this.sendError('workshop.set_chat_target', 'That Workshop participant is no longer available.');
      return;
    }
    this.sessionPersistence.markDirty('chat target changed');
    this.postSessionState();
  }

  /**
   * Deterministic Sprint 4 quick action: resolve the clicked label to a static
   * prompt template, then run the SAME retained-conversation path as a typed
   * free-text follow-up. Labels/prompts live in code; the model never invents
   * UI affordances.
   */
  async handleQuickAction(message: WorkshopQuickActionMessage): Promise<void> {
    const { toolId, reportTurnId, label } = message.payload;

    if (!isWorkshopToolId(toolId)) {
      this.sendError('workshop.quick_action', `Unknown Workshop tool: ${String(toolId)}`);
      return;
    }

    const actionLabel = typeof label === 'string' ? label.trim() : '';
    const prompt = actionLabel ? workshopQuickActionPrompt(toolId, actionLabel) : undefined;
    if (!prompt) {
      this.sendError(
        'workshop.quick_action',
        `Unknown Workshop quick action for ${workshopToolLabel(toolId)}: ${actionLabel || '(empty)'}`
      );
      return;
    }

    if (
      typeof reportTurnId !== 'string' ||
      !this.session.isLiveToolReport(toolId, reportTurnId)
    ) {
      this.sendError(
        'workshop.quick_action',
        'That report has been archived because a newer tool run replaced its conversation.'
      );
      return;
    }
    await this.executeMessage(prompt, actionLabel, { kind: 'tool', toolId });
  }

  /** Route the one composer action to the stable host or explicit tool target. */
  private async executeMessage(
    text: string,
    displayText = text,
    targetOverride?: WorkshopChatTarget,
    executeOptions?: {
      /**
       * Explicit composer sends ship the staged message attachments;
       * deterministic quick actions never consume them (Phase 6B).
       */
      includeMessageAttachments?: boolean;
    }
  ): Promise<void> {
    const target = targetOverride ?? this.session.getChatTarget();
    const personaId = this.session.getSelectedPersonaId();
    const hostConversationId = this.session.getHostConversationId();
    const targetDetails = (() => {
      switch (target.kind) {
        case 'host':
          return {
            conversationId: hostConversationId,
            label: workshopPersonaLabel(personaId),
            requestType: 'workshop_host',
            toolId: undefined,
            guestPersonaId: undefined,
            missingConversationMessage: undefined
          };
        case 'tool':
          return {
            conversationId: this.session.getToolSidecarConversationId(target.toolId),
            label: workshopToolLabel(target.toolId),
            requestType: 'workshop_tool_message',
            toolId: target.toolId,
            guestPersonaId: undefined,
            missingConversationMessage: 'That tool conversation is no longer available.'
          };
        case 'personaGuest':
          return {
            conversationId: this.session.getPersonaGuestConversationId(target.personaId),
            label: workshopPersonaLabel(target.personaId),
            requestType: 'workshop_guest_message',
            toolId: undefined,
            guestPersonaId: target.personaId,
            missingConversationMessage: 'That guest conversation is no longer available.'
          };
      }
    })();

    if (targetDetails.missingConversationMessage && !targetDetails.conversationId) {
      this.sendError('workshop.send_message', targetDetails.missingConversationMessage);
      return;
    }
    // Sprint 13A §1: what a turn needs depends on the session's SCOPE, not on
    // whether an excerpt happens to be present. An open conversation is a real
    // room; tool sidecars and guests still require the passage they read.
    const scope = this.session.getScope();
    const excerpt = this.session.getExcerpt();
    const hasExcerpt = !!excerpt && excerpt.text.trim().length > 0;
    // Scope first, and independently of excerpt presence: a new session
    // deliberately CARRIES the previous room's passage across the boundary
    // (§3), so "an excerpt exists" is not evidence that the writer has chosen
    // what this room is for.
    if (scope === null) {
      this.sendError(
        'workshop.send_message',
        'Choose how to start this session — workshop an excerpt, or start an open conversation.'
      );
      return;
    }
    if (!hasExcerpt) {
      if (target.kind !== 'host') {
        this.sendError(
          'workshop.send_message',
          'Add an excerpt before continuing with a tool or guest.'
        );
        return;
      }
      if (scope !== 'open') {
        this.sendError('workshop.send_message', 'Pin an excerpt before messaging the Workshop.');
        return;
      }
    }

    this.preemptActiveRun();
    const roomReader: WorkshopCapabilityPrincipal | undefined =
      target.kind === 'host'
        ? { kind: 'host' }
        : target.kind === 'personaGuest'
          ? { kind: 'personaGuest', personaId: target.personaId }
          : undefined;
    const writerProfile = this.conversationSettingsService.getWriterProfile();
    const roomDelivery = roomReader
      ? this.roomDelivery.prepare(roomReader, {
          writerName: workshopWriterPreferredAddress(writerProfile),
          renderedAt: Date.now()
        })
      : undefined;
    const roomCatchUp = roomDelivery?.frame;
    const pendingHostUpdates = target.kind === 'host'
      ? this.session.collectPendingHostUpdates()
      : undefined;
    const todoEvidence = target.kind === 'host'
      ? buildWorkshopTodoEvidence(this.session.collectOpenTodosForHost())
      : undefined;
    // A fresh host already receives the current excerpt and brief through its
    // initial envelope. Only retained conversations need a superseding delta.
    const hostUpdateFrame = hostConversationId
      ? buildWorkshopHostUpdateFrame(pendingHostUpdates)
      : undefined;
    if (pendingHostUpdates) {
      this.outputChannel.appendLine(
        `[WorkshopHandler] Pending host update prepared (${describeWorkshopPendingHostUpdates(pendingHostUpdates)}; ${hostConversationId ? 'retained delta frame' : 'fresh-host initial envelope'})`
      );
    }
    if (roomDelivery && roomDelivery.deliveredTurnIds.length > 0) {
      this.outputChannel.appendLine(
        `[WorkshopHandler] Room catch-up prepared (${roomReader?.kind === 'host' ? 'host' : `guest=${roomReader?.personaId}`}): ${roomDelivery.deliveredTurnIds.length} whole turns included, ${roomDelivery.deferredTurns} deferred`
      );
    }
    const { conversationId, label, requestType, toolId, guestPersonaId } = targetDetails;
    const requestId = generateRequestId(requestType);
    const controller = new AbortController();
    // Staged one-shot thread-artifacts ride THIS message only (Phase 6B).
    const messageAttachments = executeOptions?.includeMessageAttachments
      ? this.session.collectMessageAttachments()
      : [];
    const threadArtifactFrames = messageAttachments.map((attachment) =>
      buildWorkshopThreadArtifactFrame({
        id: attachment.id,
        name: attachment.label,
        sourcePath: attachment.relativePath,
        truncation: attachment.truncation,
        content: attachment.content
      })
    );
    const attachmentRefs = messageAttachments.map(
      ({ content: _content, sourceUri: _sourceUri, ...ref }) => ref
    );
    if (messageAttachments.length > 0) {
      this.outputChannel.appendLine(
        `[WorkshopHandler] Message attachments riding this send: ${messageAttachments.map((a) => a.id).join(', ')}`
      );
    }
    let modelMessage: string;
    let userTurn: WorkshopTurn;
    let statusMessage: string;
    const timeNotice = target.kind === 'host'
      ? this.sessionTime.prepareNotice('host')
      : target.kind === 'personaGuest'
        ? this.sessionTime.prepareNotice(workshopGuestConversationKey(target.personaId))
        : undefined;
    let personaBehaviorFrames: {
      interactionFrame?: string;
      activationFrame?: string;
      transitionFrame?: string;
      timeFrame?: string;
    } = {};
    switch (target.kind) {
      case 'host':
        userTurn = this.session.beginPersonaMessage(requestId, displayText, attachmentRefs);
        personaBehaviorFrames = {
          ...behaviorFramesFor(userTurn),
          timeFrame: timeNotice?.frame
        };
        modelMessage = buildWorkshopHostMessage(text, {
          roomCatchUp,
          todoEvidence,
          hostUpdate: hostUpdateFrame,
          threadArtifactFrames,
          ...(conversationId ? personaBehaviorFrames : {})
        });
        statusMessage = roomCatchUp
          ? `Catching ${label} up on the room…`
          : `Streaming ${label}…`;
        break;
      case 'tool':
        modelMessage = threadArtifactFrames.length > 0
          ? [...threadArtifactFrames.flatMap((frame) => [frame, '']), text].join('\n')
          : text;
        userTurn = this.session.beginDirectToolMessage(
          target.toolId,
          requestId,
          displayText,
          attachmentRefs
        );
        statusMessage = `Continuing directly with ${label}…`;
        break;
      case 'personaGuest':
        userTurn = this.session.beginPersonaGuestMessage(
          target.personaId,
          requestId,
          displayText,
          attachmentRefs
        );
        personaBehaviorFrames = {
          ...behaviorFramesFor(userTurn),
          timeFrame: timeNotice?.frame
        };
        modelMessage = buildWorkshopGuestMessage(
          text,
          roomCatchUp,
          threadArtifactFrames,
          personaBehaviorFrames
        );
        statusMessage = roomCatchUp
          ? `Catching ${label} up on the room…`
          : `Continuing with ${label}…`;
        break;
    }
    this.activeRun = { requestId, label, toolId, guestPersonaId, controller };
    // Sprint 13C: capabilities are participant-owned. Host and persona-guest
    // turns each mint one adapter with their own principal; direct-tool
    // sidecars stay capability-free instruments. Decide "which participant is
    // this" exactly once (PR #89 review #13) so the gate, the speaking
    // persona, and the persisted principal cannot drift apart.
    const participantOwner = roomReader;
    const participantCapability = participantOwner
      ? this.capabilityFactory.create({
          requestId,
          personaId: participantOwner.kind === 'personaGuest'
            ? participantOwner.personaId
            : personaId,
          owner: participantOwner,
          conversationId,
          excerpt,
          excerptVersion: this.session.getExcerptVersion(),
          signal: controller.signal,
          events: {
            status: (message, tickerMessage) => this.sendStatus(message, undefined, tickerMessage),
            turnCompleted: (turn) => this.postTurn(turn),
            sessionChanged: () => {
              this.postSessionState();
              this.sessionPersistence.markDirty('participant capability committed');
            }
          }
        })
      : undefined;
    this.postTurn(userTurn);
    this.postSessionState();
    this.sendStreamStarted(requestId);
    this.sendStatus(statusMessage);

    try {
      const result = conversationId
        ? await this.assistantToolService.continueConversation(conversationId, modelMessage, {
            signal: controller.signal,
            onToken: (token: string) => this.sendStreamChunk(requestId, token),
            capability: participantCapability
          })
        : await this.assistantToolService.startWorkshopPersonaConversation({
            personaId,
            excerpt,
            message: modelMessage,
            behavior: userTurn.behavior!,
            writerProfile,
            messageIsTrustedEnvelope: true,
            ...personaBehaviorFrames,
            contextAttachmentsFrame: buildWorkshopContextAttachmentsFrame(
              this.session.getContextAttachments()
            ),
            excerptSourceFrame: excerpt
              ? buildWorkshopExcerptSourceFrame(excerpt.source)
              : undefined
          }, {
            signal: controller.signal,
            onToken: (token: string) => this.sendStreamChunk(requestId, token),
            capability: participantCapability!
          });

      const assistantTurn = completeWorkshopRun({
        session: this.session,
        requestId,
        label,
        result,
        aborted: controller.signal.aborted,
        createsRetainedConversation: target.kind === 'host' && !hostConversationId,
        copy: workshopMessageCompletionCopy(label),
        discardConversation: (id) => this.assistantToolService.discardConversation(id),
        log: (line) => this.outputChannel.appendLine(`[WorkshopHandler] ${line}`),
        events: {
          streamCompleted: (id, content, cancelled, usage, truncated) =>
            this.sendStreamComplete(id, content, cancelled, usage, truncated),
          turnCompleted: (turn) => this.postTurn(turn),
          status: (status) => this.sendStatus(status),
          error: (errorMessage, details) =>
            this.sendError('workshop.send_message', errorMessage, details)
        }
      });
      if (assistantTurn && roomDelivery) {
        try {
          this.roomDelivery.commit(roomDelivery);
          this.outputChannel.appendLine(
            `[WorkshopHandler] Room delivery committed ` +
            `(${roomDelivery.reader.kind === 'host'
              ? 'host'
              : `guest=${roomDelivery.reader.personaId}`}; ` +
            `through=${roomDelivery.deliveredTurnIds.at(-1) ?? '<none>'})`
          );
        } catch (error) {
          // The model reply is already committed and visible. A failed
          // acknowledgement is bookkeeping failure only; retain the offset so
          // the same contiguous prefix retries instead of misreporting the
          // successful participant turn as failed.
          this.outputChannel.appendLine(
            `[WorkshopHandler] Room delivery acknowledgement retained for retry after ` +
            `committed ${label} reply: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      } else if (roomDelivery) {
        this.outputChannel.appendLine(
          `[WorkshopHandler] Room delivery retained after incomplete ${label} reply ` +
          `(${roomDelivery.reader.kind === 'host'
            ? 'host'
            : `guest=${roomDelivery.reader.personaId}`}; ` +
          `${roomDelivery.deliveredTurnIds.length} turns remain pending)`
        );
      }
      if (assistantTurn && target.kind === 'host' && pendingHostUpdates) {
        this.session.commitPendingHostUpdates(pendingHostUpdates);
        this.outputChannel.appendLine(
          `[WorkshopHandler] Pending host update committed (${describeWorkshopPendingHostUpdates(pendingHostUpdates)})`
        );
      } else if (target.kind === 'host' && pendingHostUpdates) {
        this.outputChannel.appendLine(
          `[WorkshopHandler] Pending host update retained after incomplete delivery (${describeWorkshopPendingHostUpdates(pendingHostUpdates)})`
        );
      }
      if (assistantTurn && messageAttachments.length > 0) {
        // A failed/cancelled turn falls through to the catch, which leaves
        // the staged artifacts pending — the pills survive and a retry
        // ships the same ids.
        this.session.commitMessageAttachments(messageAttachments.map((a) => a.id), target);
        this.outputChannel.appendLine(
          `[WorkshopHandler] Message attachments shipped (${messageAttachments.map((a) => a.id).join(', ')})`
        );
      }
      if (assistantTurn) {
        this.commitTimeNotice(timeNotice);
        this.sessionPersistence.markDirty(
          target.kind === 'tool'
            ? 'direct tool turn completed'
            : 'persona turn completed'
        );
      }
      this.postSessionState();
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      this.session.abandonRun(requestId);
      if (target.kind === 'host' && pendingHostUpdates) {
        this.outputChannel.appendLine(
          `[WorkshopHandler] Pending host update retained after failed delivery (${describeWorkshopPendingHostUpdates(pendingHostUpdates)}): ${details}`
        );
      }
      this.sendStreamComplete(requestId, '', true);
      if (error instanceof Error && error.name === 'ConversationNotFoundError') {
        // A configuration/resource rebuild invalidates the assistant
        // generation as a whole, not merely the id that happened to be used.
        const discardedConversationIds = this.session.clearAllConversations();
        this.discardConversations(discardedConversationIds);
        this.outputChannel.appendLine(
          `[WorkshopHandler] Conversation generation lost (${discardedConversationIds.length} conversations discarded: ${discardedConversationIds.join(', ') || 'none'}): ${details}`
        );
        this.sessionPersistence.markDirty('expired conversation bindings cleared');
        this.sendError(
          'workshop.send_message',
          'This Workshop conversation is no longer available because settings changed. Send a new message to start the selected host again.',
          'The retained conversation could not be found. Details were recorded in the Prose Minion output channel.'
        );
      } else if (error instanceof Error && error.name === 'AbortError') {
        this.sendStatus(`${label} cancelled`);
      } else {
        this.sendError('workshop.send_message', `Failed to message ${label}`, details);
      }
      this.postSessionState();
    } finally {
      this.settleActiveRun(requestId);
    }
  }

  /**
   * Webview-initiated cancel (Sprint 3 — the composer's stop affordance).
   * Abort only; the in-flight run's own flow resolves through its cancelled
   * branch, so the wire order (COMPLETE → SESSION_STATE → STATUS) and the
   * log trail stay identical to a preemption-style abort.
   */
  async handleCancelRequest(message: CancelWorkshopRequestMessage): Promise<void> {
    const { requestId, domain } = message.payload;
    if (domain === 'workshop-context') {
      if (this.wizardRun?.requestId === requestId) {
        this.outputChannel.appendLine(`[WorkshopHandler] Wizard cancel requested: ${requestId}`);
        this.wizardRun.controller.abort();
      }
      return;
    }
    if (domain !== 'workshop') {
      this.outputChannel.appendLine(
        `[WorkshopHandler] Cancel ignored: ${requestId} (domain=${domain}, active=${this.activeRun?.requestId ?? 'none'})`
      );
      return;
    }
    if (this.activeRun?.requestId === requestId) {
      this.outputChannel.appendLine(
        `[WorkshopHandler] Cancel requested: ${requestId} (${this.activeRun.label})`
      );
      this.activeRun.controller.abort();
      return;
    }
    this.outputChannel.appendLine(
      `[WorkshopHandler] Cancel ignored: ${requestId} (domain=${domain}, active=${this.activeRun?.requestId ?? 'none'})`
    );
  }

  async handleSetExcerpt(message: WorkshopSetExcerptMessage): Promise<void> {
    const { text } = message.payload;

    if (typeof text !== 'string' || text.trim().length === 0) {
      this.sendError('workshop', 'Cannot pin an empty excerpt.');
      return;
    }

    // Mid-run re-pin guard (PR #67 review #3, Sam): the running analysis
    // captured the OLD excerpt. Turns now carry version provenance, but a swap
    // would still make the visible working text diverge from the live stream.
    // The rail disables its buttons on isRunning,
    // but that flag only lands after a message round-trip; this closes the
    // race window at the source of truth.
    if (this.rejectExcerptMutationWhileRunning()) {
      return;
    }

    const source = await this.withConfiguredResource(
      coerceWorkshopExcerptSource(message.payload.source)
    );
    // Resolution awaited on catalog I/O; re-check the guard it may have raced.
    if (this.rejectExcerptMutationWhileRunning()) {
      return;
    }
    if (!this.tryReplaceExcerpt({ text, source })) {
      return;
    }
    this.sessionPersistence.markDirty('excerpt replaced');
    this.postSessionState();
  }

  async handleAddContextText(message: WorkshopAddContextTextMessage): Promise<void> {
    const text = typeof message.payload?.text === 'string' ? message.payload.text.trim() : '';
    if (text.length === 0) {
      this.sendError('workshop', 'Cannot attach empty context text.');
      return;
    }
    this.applyContextAttachment({
      kind: 'text',
      origin: 'writer',
      // Sprint 13A \u00a76: the note's own first line is its name. The old
      // "first three words\u2026" placeholder was a stand-in for a pill the writer
      // could not open; now that the sheet opens it, the title is real.
      label: workshopTextNoteLabel(text),
      content: text,
      words: countWords(text)
    });
  }

  /**
   * "Explore project folders…" path (Sprint 12): host picker → read →
   * head-slice to the aggregate cap → attach. The Context Selector modal's
   * configured-resource path arrives in Phase 4.
   */
  async handleAddContextFile(_message: WorkshopAddContextFileMessage): Promise<void> {
    const picked = await this.shell.pickFile({
      title: 'Add context from file',
      filters: { 'Text files': ['md', 'markdown', 'txt'], 'All files': ['*'] }
    });
    if (!picked) {
      return;
    }
    const displayPath = this.toDisplayPath(picked.fsPath);
    const loaded = await this.loadContextFileFromDisk(picked.fsPath, displayPath);
    if (!loaded) {
      return;
    }
    this.applyContextAttachment({
      kind: 'file',
      origin: 'writer',
      label: baseName(picked.fsPath),
      content: loaded.text,
      words: loaded.words,
      sourceUri: picked.uri,
      relativePath: displayPath,
      truncation: loaded.truncation
    });
  }

  async handleRemoveContextAttachment(
    message: WorkshopRemoveContextAttachmentMessage
  ): Promise<void> {
    const id = message.payload?.id;
    if (typeof id !== 'string' || id.length === 0) {
      this.sendError('workshop', 'Context removal must identify an attachment.');
      return;
    }
    const { removed, eventTurn } = this.session.removeContextAttachment(id);
    if (!removed) {
      this.sendError('workshop', 'That context attachment no longer exists.');
      return;
    }
    if (eventTurn) {
      this.postTurn(eventTurn);
    }
    this.outputChannel.appendLine(
      `[WorkshopHandler] Context attachment removed (${removed.label}, ${removed.words} words)`
    );
    this.sessionPersistence.markDirty('context attachment removed');
    this.postSessionState();
  }

  /**
   * Save an edit made in the shared Edit/Preview sheet (Sprint 13A §6). The
   * aggregate owns editability and the shared word budget; this handler owns
   * the visible reason a refusal happened.
   */
  async handleUpdateContextText(message: WorkshopUpdateContextTextMessage): Promise<void> {
    const id = message.payload?.id;
    const text = typeof message.payload?.text === 'string' ? message.payload.text : '';
    if (typeof id !== 'string' || id.length === 0) {
      this.sendError('workshop', 'A context edit must identify an attachment.');
      return;
    }
    if (text.trim().length === 0) {
      this.sendError('workshop', 'Cannot save empty context text. Remove the attachment instead.');
      return;
    }
    const result = this.session.updateContextAttachmentText(id, text, countWords(text));
    if (!result.ok) {
      this.sendError('workshop', WORKSHOP_CONTEXT_EDIT_REFUSALS[result.reason](result.remainingWords));
      this.postSessionState();
      return;
    }
    if (result.eventTurn) {
      this.postTurn(result.eventTurn);
    }
    this.outputChannel.appendLine(
      `[WorkshopHandler] Context attachment edited (${result.attachment.label}, ` +
      `${result.attachment.words} words, origin=${result.attachment.origin})`
    );
    this.sessionPersistence.markDirty('context attachment edited');
    this.postSessionState();
  }

  /**
   * Serve ONE attachment's body to the Edit/Preview sheet (Sprint 13A §7).
   *
   * Attachment content is prompt-bearing host state under a 50,000-word shared
   * budget, so it deliberately does not ride every session snapshot — the
   * webview asks for exactly the one the writer opened.
   */
  async handleRequestContextAttachment(
    message: WorkshopRequestContextAttachmentMessage
  ): Promise<void> {
    const id = message.payload?.id;
    if (typeof id !== 'string' || id.length === 0) {
      this.sendError('workshop', 'A context request must identify an attachment.');
      return;
    }
    const attachment = this.session.getContextAttachment(id);
    if (!attachment) {
      // The sheet renders this inline against the attachment it opened, so the
      // reply still carries the message — but a lost race (one sheet removing
      // what another is mid-fetch on) needs a trail to correlate against.
      const detail = `Workshop context attachment ${id} was requested after it left the session`;
      this.outputChannel.appendLine(`[WorkshopHandler] ${detail}`);
      this.sendError(
        'workshop',
        'That context attachment is no longer attached to this session.',
        detail
      );
      this.postMessage({
        type: MessageType.WORKSHOP_CONTEXT_ATTACHMENT_CONTENT,
        source: 'extension.workshop',
        payload: {
          id,
          error: 'That context attachment is no longer attached to this session.',
          canOpenInEditor: false
        },
        timestamp: Date.now()
      });
      return;
    }
    this.outputChannel.appendLine(
      `[WorkshopHandler] Context attachment served to the sheet (${attachment.label}, ` +
      `${attachment.content.length} chars, origin=${attachment.origin})`
    );
    this.postMessage({
      type: MessageType.WORKSHOP_CONTEXT_ATTACHMENT_CONTENT,
      source: 'extension.workshop',
      payload: {
        id,
        content: attachment.content,
        canOpenInEditor: attachment.sourceUri !== undefined
      },
      timestamp: Date.now()
    });
  }

  /**
   * Open a file-backed attachment's real document (Sprint 13A §7). The sheet
   * is the prettified in-webview read; this is the escape hatch to the editor.
   * Routed through the ShellService port, so core never touches `vscode`.
   */
  async handleOpenContextAttachmentFile(
    message: WorkshopOpenContextAttachmentFileMessage
  ): Promise<void> {
    const id = message.payload?.id;
    if (typeof id !== 'string' || id.length === 0) {
      this.sendError('workshop', 'An open request must identify an attachment.');
      return;
    }
    const attachment = this.session.getContextAttachment(id);
    if (!attachment?.sourceUri) {
      this.sendError(
        'workshop',
        attachment
          ? `${attachment.label} is a typed note, so it has no file to open.`
          : 'That context attachment is no longer attached to this session.'
      );
      return;
    }
    try {
      await this.shell.openFileInEditor(fileURLToPath(attachment.sourceUri), { beside: true });
      this.outputChannel.appendLine(
        `[WorkshopHandler] Context attachment opened in an editor tab (${attachment.label})`
      );
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(
        `[WorkshopHandler] Could not open ${attachment.label} in an editor tab: ${details}`
      );
      this.sendError('workshop', `Could not open ${attachment.label} in an editor tab.`, details);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Session scope (ADR 2026-07-25) — choose or revise the path only before
  // participant memory exists. Once locked, the aggregate refuses the change
  // and the handler names the new-session recovery path.
  // ───────────────────────────────────────────────────────────────────────────

  async handleSetSessionScope(message: WorkshopSetSessionScopeMessage): Promise<void> {
    const scope = message.payload?.scope;
    if (!isWorkshopSelectableSessionScope(scope)) {
      this.sendError('workshop', `Unknown Workshop session scope: ${String(scope)}`);
      return;
    }
    // A scope flip changes what the NEXT turn is about; letting it land
    // mid-stream would make the in-flight reply's subject ambiguous.
    if (this.rejectExcerptMutationWhileRunning()) {
      return;
    }
    try {
      const transition = this.session.setSessionScope(scope);
      this.applyScopeTransition(transition, scope === 'open'
        ? 'session scope set to open conversation'
        : 'session scope set to passage session');
    } catch (error) {
      this.sendError(
        'workshop',
        workshopScopeMutationError(error, 'That session scope is unavailable.')
      );
    }
  }

  async handleRepinExcerpt(_message: WorkshopRepinExcerptMessage): Promise<void> {
    if (this.rejectExcerptMutationWhileRunning()) {
      return;
    }
    try {
      this.applyScopeTransition(this.session.repinShelvedExcerpt(), 'shelved excerpt re-pinned');
    } catch (error) {
      this.sendError(
        'workshop',
        workshopScopeMutationError(error, 'There is no excerpt on the shelf.')
      );
    }
  }

  private applyScopeTransition(
    transition: WorkshopScopeTransition,
    reason: string
  ): void {
    if (!transition.changed) {
      // Idempotent: still broadcast so a stale webview reconciles.
      this.postSessionState();
      return;
    }
    this.outputChannel.appendLine(
      `[WorkshopHandler] ${reason} (scope=${transition.scope ?? 'unchosen'}, ` +
      `excerpt=${transition.excerpt ? `v${transition.excerpt.version}` : 'none'}, ` +
      `shelved=${transition.shelvedExcerpt ? `v${transition.shelvedExcerpt.version}` : 'none'})`
    );
    this.sessionPersistence.markDirty(reason);
    this.postSessionState();
  }

  /** Context Selector modal (Phase 4): the configured catalog, display-safe. */
  async handleRequestContextCatalog(_message: WorkshopRequestContextCatalogMessage): Promise<void> {
    try {
      const catalog = await this.contextResourceService.openCatalog();
      const entries: WorkshopContextCatalogEntry[] = catalog.entries().map((resource) => ({
        group: resource.group,
        path: resource.path,
        label: resource.label,
        sizeBytes: resource.sizeBytes
      }));
      const message: WorkshopContextCatalogMessage = {
        type: MessageType.WORKSHOP_CONTEXT_CATALOG,
        source: 'extension.workshop',
        payload: { entries },
        timestamp: Date.now()
      };
      void this.postMessage(message);
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      this.sendError('workshop', 'Could not read the configured resource catalog.', details);
    }
  }

  /**
   * Content search for the modal, under the SAME bounds as the persona
   * capability's resource.search (file count + per-file/total bytes). Name
   * matching stays client-side — the webview already holds the catalog.
   */
  async handleSearchContextResources(message: WorkshopSearchContextResourcesMessage): Promise<void> {
    const rawQuery = typeof message.payload?.query === 'string' ? message.payload.query.trim() : '';
    if (rawQuery.length === 0) {
      return;
    }
    const query = rawQuery.slice(0, PROMPT_BUDGETS.workshopResource.queryCharacters).toLowerCase();
    const budgets = PROMPT_BUDGETS.workshopResource;
    try {
      const catalog = await this.contextResourceService.openCatalog();
      const candidates = catalog.entries();
      const scannable = candidates.slice(0, budgets.searchFiles);
      let bounded = candidates.length > scannable.length;
      let bytesScanned = 0;
      const matches: WorkshopConfiguredResourceRef[] = [];
      for (const candidate of scannable) {
        if (bytesScanned >= budgets.searchTotalBytes) {
          bounded = true;
          break;
        }
        if (candidate.sizeBytes > Math.min(budgets.searchFileBytes, budgets.searchTotalBytes - bytesScanned)) {
          bounded = true;
          continue;
        }
        const loaded = await catalog.load(
          { group: candidate.group, path: candidate.path },
          {
            maxBytes: Math.min(budgets.searchFileBytes, budgets.searchTotalBytes - bytesScanned),
            maxWords: Number.MAX_SAFE_INTEGER
          }
        );
        if (loaded.kind !== 'loaded') {
          continue;
        }
        bytesScanned += candidate.sizeBytes;
        if (loaded.resource.text.toLowerCase().includes(query)) {
          matches.push({ group: candidate.group, path: candidate.path });
        }
      }
      const results: WorkshopContextSearchResultsMessage = {
        type: MessageType.WORKSHOP_CONTEXT_SEARCH_RESULTS,
        source: 'extension.workshop',
        payload: { query: rawQuery, matches, bounded },
        timestamp: Date.now()
      };
      void this.postMessage(results);
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      this.sendError('workshop', 'Context search failed.', details);
    }
  }

  /** Attach selected configured resources by canonical { group, path }. */
  async handleAddContextResources(message: WorkshopAddContextResourcesMessage): Promise<void> {
    const items = Array.isArray(message.payload?.items) ? message.payload.items : [];
    const validated = items.flatMap((item) => {
      const candidate = item as { group?: unknown; path?: unknown };
      return typeof candidate.group === 'string' &&
        isContextPathGroup(candidate.group) &&
        typeof candidate.path === 'string' &&
        candidate.path.trim().length > 0
        ? [{ group: candidate.group, path: candidate.path }]
        : [];
    });
    if (validated.length === 0) {
      this.sendError('workshop', 'No valid configured resources to attach.');
      return;
    }

    let catalog;
    try {
      catalog = await this.contextResourceService.openCatalog();
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      this.sendError('workshop', 'Could not read the configured resource catalog.', details);
      return;
    }
    for (const item of validated) {
      const loaded = await catalog.load(item, {
        maxBytes: PROMPT_BUDGETS.contextAttachments.fileBytes,
        maxWords: PROMPT_BUDGETS.contextAttachments.words
      });
      if (!this.reportConfiguredResourceLoadFailure(loaded, 'attach')) {
        continue;
      }
      const { resource } = loaded;
      this.applyContextAttachment({
        kind: 'file',
        origin: 'writer',
        label: baseName(item.path),
        content: resource.text,
        words: resource.words,
        sourceUri: pathToFileURL(resource.summary.absolutePath).toString(),
        relativePath: item.path,
        configuredResource: { group: item.group, path: item.path },
        truncation: resource.truncation
      });
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Message attachments (Phase 6B): stage one-shot thread-artifacts for the
  // writer's next composer message. Staging mutates no prompt — the artifact
  // ships inside exactly one send, then leaves the pending list.
  // ───────────────────────────────────────────────────────────────────────────

  /** Stage configured resources picked in the modal's message-attach mode. */
  async handleAttachMessageResources(message: WorkshopAttachMessageResourcesMessage): Promise<void> {
    const items = Array.isArray(message.payload?.items) ? message.payload.items : [];
    const validated = items.flatMap((item) => {
      const candidate = item as { group?: unknown; path?: unknown };
      return typeof candidate.group === 'string' &&
        isContextPathGroup(candidate.group) &&
        typeof candidate.path === 'string' &&
        candidate.path.trim().length > 0
        ? [{ group: candidate.group, path: candidate.path }]
        : [];
    });
    if (validated.length === 0) {
      this.sendError('workshop', 'No valid configured resources to attach to the message.');
      return;
    }

    let catalog;
    try {
      catalog = await this.contextResourceService.openCatalog();
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      this.sendError('workshop', 'Could not read the configured resource catalog.', details);
      return;
    }
    for (const item of validated) {
      const loaded = await catalog.load(item, {
        maxBytes: PROMPT_BUDGETS.contextAttachments.fileBytes,
        maxWords: PROMPT_BUDGETS.workshopThreadArtifacts.words
      });
      if (!this.reportConfiguredResourceLoadFailure(loaded, 'attach')) {
        continue;
      }
      const { resource } = loaded;
      this.stageMessageAttachment({
        label: baseName(item.path),
        content: resource.text,
        words: resource.words,
        relativePath: item.path,
        configuredResource: { group: item.group, path: item.path },
        sourceUri: pathToFileURL(resource.summary.absolutePath).toString(),
        truncation: resource.truncation
      });
    }
  }

  /** Stage an explored file (host picker) as a next-message attachment. */
  async handleAttachMessageFile(_message: WorkshopAttachMessageFileMessage): Promise<void> {
    const picked = await this.shell.pickFile({
      title: 'Attach file to this message',
      filters: { 'Text files': ['md', 'markdown', 'txt'], 'All files': ['*'] }
    });
    if (!picked) {
      return;
    }
    const displayPath = this.toDisplayPath(picked.fsPath);
    const loaded = await this.loadContextFileFromDisk(picked.fsPath, displayPath);
    if (!loaded) {
      return;
    }
    const totalWords = loaded.truncation?.totalWords ?? loaded.words;
    const bounded = this.boundThreadArtifact(loaded.text, totalWords);
    this.stageMessageAttachment({
      label: baseName(picked.fsPath),
      content: bounded.text,
      words: bounded.words,
      relativePath: displayPath,
      sourceUri: picked.uri,
      truncation: bounded.truncation
    });
  }

  async handleRemoveMessageAttachment(
    message: WorkshopRemoveMessageAttachmentMessage
  ): Promise<void> {
    const id = message.payload?.id;
    if (typeof id !== 'string' || id.length === 0) {
      this.sendError('workshop', 'Message-attachment removal must identify an attachment.');
      return;
    }
    const removed = this.session.removeMessageAttachment(id);
    if (!removed) {
      this.sendError('workshop', 'That message attachment no longer exists.');
      return;
    }
    this.outputChannel.appendLine(
      `[WorkshopHandler] Message attachment removed (${removed.id}, ${removed.label})`
    );
    this.sessionPersistence.markDirty('message attachment removed');
    this.postSessionState();
  }

  private stageMessageAttachment(input: WorkshopMessageAttachmentInput): void {
    const result = this.session.addMessageAttachment(input);
    if (!result.ok) {
      if (result.reason === 'duplicate') {
        this.sendError('workshop', `${input.label} is already attached to this message.`);
      } else {
        this.sendError(
          'workshop',
          `A message carries at most ${PROMPT_BUDGETS.workshopThreadArtifacts.itemsPerMessage} attachments.`,
          'Send the message, or remove a staged attachment to make room.'
        );
      }
      return;
    }
    this.outputChannel.appendLine(
      `[WorkshopHandler] Message attachment staged (${result.attachment.id}, ${result.attachment.label}, ${result.attachment.words} words)`
    );
    this.sessionPersistence.markDirty('message attachment staged');
    this.postSessionState();
  }

  /** Head-slice one thread artifact to its per-artifact cap, with provenance. */
  private boundThreadArtifact(
    content: string,
    knownTotalWords?: number
  ): { text: string; words: number; truncation?: { keptWords: number; totalWords: number } } {
    const totalWords = knownTotalWords ?? countWords(content);
    const cap = PROMPT_BUDGETS.workshopThreadArtifacts.words;
    if (totalWords <= cap && countWords(content) <= cap) {
      return { text: content, words: countWords(content) };
    }
    const trimmed = trimToWordLimit(content, cap);
    return {
      text: trimmed.trimmed,
      words: trimmed.trimmedWords,
      truncation: { keptWords: trimmed.trimmedWords, totalWords }
    };
  }

  /**
   * "Choose from project…" for the EXCERPT (Sprint 12): one configured
   * resource picked in the modal becomes the working excerpt, with canonical
   * provenance and an honest sourceUri so Re-read from file keeps working.
   */
  async handleSetExcerptResource(message: WorkshopSetExcerptResourceMessage): Promise<void> {
    if (this.rejectExcerptMutationWhileRunning()) {
      return;
    }
    const candidate = message.payload as { group?: unknown; path?: unknown };
    if (
      typeof candidate?.group !== 'string' ||
      !isContextPathGroup(candidate.group) ||
      typeof candidate.path !== 'string' ||
      candidate.path.trim().length === 0
    ) {
      this.sendError('workshop', 'Excerpt selection must name a configured resource.');
      return;
    }
    const item = { group: candidate.group, path: candidate.path };

    let catalog;
    try {
      catalog = await this.contextResourceService.openCatalog();
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      this.sendError('workshop', 'Could not read the configured resource catalog.', details);
      return;
    }
    const loaded = await catalog.load(item, {
      maxBytes: PROMPT_BUDGETS.fileExcerpt.bytes,
      maxWords: PROMPT_BUDGETS.fileExcerpt.words
    });
    if (!this.reportConfiguredResourceLoadFailure(loaded, 'pin', PROMPT_BUDGETS.fileExcerpt.bytes)) {
      return;
    }
    const { resource } = loaded;

    if (this.rejectExcerptMutationWhileRunning()) {
      return;
    }
    if (!this.tryReplaceExcerpt({
      text: resource.text,
      source: {
        kind: 'file',
        sourceUri: pathToFileURL(resource.summary.absolutePath).toString(),
        relativePath: item.path,
        configuredResource: item
      },
      truncation: resource.truncation
        ? { pinnedWords: resource.truncation.keptWords, totalWords: resource.truncation.totalWords }
        : undefined,
      sourceFingerprint: resource.sourceFingerprint
    })) {
      return;
    }
    this.sessionPersistence.markDirty('configured excerpt replaced');
    this.postSessionState();
  }

  /**
   * Context wizard (Sprint 12): reuse the sidebar Context lane's generation
   * pipeline — contextModel scope, closed projectContext read protocol —
   * behind the Workshop's own streaming domain so the two lanes never
   * cross-consume events. One run at a time; every result lands as a
   * wizard-tagged attachment through the standard budget/duplicate path, so
   * nothing the wizard does is silent or exempt.
   */
  async handleRunContextWizard(_message: WorkshopRunContextWizardMessage): Promise<void> {
    if (this.wizardRun) {
      this.sendError('workshop', 'The Context wizard is already running — one run at a time.');
      return;
    }
    const excerpt = this.session.getExcerpt();
    if (!excerpt) {
      this.sendError('workshop', 'Set an excerpt first — the wizard reads your project around it.');
      return;
    }

    const requestId = generateRequestId('workshop-wizard');
    const controller = new AbortController();
    this.wizardRun = { requestId, excerptVersion: excerpt.version, controller };
    const started: StreamStartedMessage = {
      type: MessageType.STREAM_STARTED,
      source: 'extension.workshop',
      payload: { requestId, domain: 'workshop-context' },
      timestamp: Date.now()
    };
    void this.postMessage(started);

    let cancelled = false;
    try {
      const attachments = this.session.getContextAttachments();
      const existingContext = attachments.length > 0
        ? `Context already attached (do not re-request these): ${attachments.map((entry) => entry.label).join(', ')}`
        : undefined;
      const result = await this.contextAssistantService.generateContext(
        {
          excerpt: excerpt.text,
          existingContext,
          sourceFileUri: workshopExcerptSourceUri(excerpt.source)
        },
        { signal: controller.signal }
      );
      cancelled = controller.signal.aborted;
      if (
        !cancelled &&
        this.wizardRun?.requestId === requestId &&
        this.wizardRun.excerptVersion === this.session.getExcerpt()?.version
      ) {
        await this.adoptWizardResult(result.content, result.requestedResources ?? []);
      } else if (!cancelled) {
        this.outputChannel.appendLine(
          `[WorkshopHandler] Context wizard ${requestId} discarded because excerpt v${excerpt.version} is no longer current`
        );
        this.sendStatus('Context wizard result was discarded because the excerpt changed.');
      }
    } catch (error) {
      cancelled = controller.signal.aborted;
      if (!cancelled) {
        const details = error instanceof Error ? error.message : String(error);
        this.sendError('workshop', 'The Context wizard failed.', details);
      }
    } finally {
      if (this.wizardRun?.requestId === requestId) {
        this.wizardRun = undefined;
      }
      const complete: StreamCompleteMessage = {
        type: MessageType.STREAM_COMPLETE,
        source: 'extension.workshop',
        payload: { requestId, domain: 'workshop-context', content: '', cancelled },
        timestamp: Date.now()
      };
      void this.postMessage(complete);
    }
  }

  /**
   * Land wizard output as ordinary wizard-tagged attachments; say what fit.
   * The BRIEF attaches first — it is the wizard's distilled output and must
   * never lose the budget race to the raw files it happened to read.
   */
  private async adoptWizardResult(brief: string, requestedResources: string[]): Promise<void> {
    let attached = 0;
    let skipped = 0;
    let failed = 0;

    const briefText = brief.trim();
    if (briefText.length > 0 && !briefText.startsWith(API_KEY_NOT_CONFIGURED_HEADING)) {
      const words = countWords(briefText);
      const result = this.session.addContextAttachment({
        kind: 'text',
        origin: 'wizard',
        label: 'Wizard brief\u2026',
        content: briefText,
        words
      });
      if (result.ok) {
        attached += 1;
        if (result.eventTurn) {
          this.postTurn(result.eventTurn);
        }
      } else {
        skipped += 1;
      }
    }

    if (requestedResources.length > 0) {
      let catalog;
      try {
        catalog = await this.contextResourceService.openCatalog();
      } catch (error) {
        this.outputChannel.appendLine(
          `[WorkshopHandler] Context wizard could not read the configured resource catalog: ${error instanceof Error ? error.message : String(error)}`
        );
        failed += requestedResources.length;
      }
      if (catalog) {
        for (const path of requestedResources) {
          const summary = catalog.entries().find((resource) => resource.path === path);
          if (!summary) {
            skipped += 1;
            continue;
          }
          const loaded = await catalog.load(
            { group: summary.group, path: summary.path },
            {
              maxBytes: PROMPT_BUDGETS.contextAttachments.fileBytes,
              maxWords: PROMPT_BUDGETS.contextAttachments.words
            }
          );
          if (loaded.kind === 'unreadable') {
            this.outputChannel.appendLine(
              `[WorkshopHandler] Context wizard could not read ${summary.path}: ${loaded.details}`
            );
            failed += 1;
            continue;
          }
          if (!this.reportConfiguredResourceLoadFailure(loaded, 'attach')) {
            skipped += 1;
            continue;
          }
          const { resource } = loaded;
          const result = this.session.addContextAttachment({
            kind: 'file',
            origin: 'wizard',
            label: baseName(summary.path),
            content: resource.text,
            words: resource.words,
            sourceUri: pathToFileURL(summary.absolutePath).toString(),
            relativePath: summary.path,
            configuredResource: { group: summary.group, path: summary.path },
            truncation: resource.truncation
          });
          if (result.ok) {
            attached += 1;
            if (result.eventTurn) {
              this.postTurn(result.eventTurn);
            }
          } else {
            skipped += 1;
          }
        }
      }
    }

    this.outputChannel.appendLine(
      `[WorkshopHandler] Wizard finished (${attached} attached, ${skipped} skipped, ${failed} failed)`
    );
    this.sendStatus(
      attached > 0
        ? `Wizard attached ${attached} item${attached === 1 ? '' : 's'}${skipped > 0 ? ` \u00b7 ${skipped} didn\u2019t fit` : ''}${failed > 0 ? ` \u00b7 ${failed} couldn\u2019t be loaded` : ''} \u2014 yours to keep or remove.`
        : failed > 0
          ? `Wizard finished \u2014 ${failed} requested item${failed === 1 ? '' : 's'} couldn\u2019t be loaded.`
          : 'Wizard finished \u2014 nothing new fit the budget.'
    );
    if (attached > 0) {
      this.sessionPersistence.markDirty('context wizard attachments committed');
    }
    this.postSessionState();
  }

  /** Shared attach tail: aggregate validation, event turn, logging, broadcast. */
  private applyContextAttachment(input: WorkshopContextAttachmentInput): void {
    const result = this.session.addContextAttachment(input);
    if (!result.ok) {
      if (result.reason === 'duplicate') {
        this.sendError('workshop', `Already attached: ${input.label}`);
      } else {
        this.sendError(
          'workshop',
          `Won\u2019t fit: ${input.label} (${input.words.toLocaleString('en-US')} words) would pass the ${PROMPT_BUDGETS.contextAttachments.words.toLocaleString('en-US')}-word context budget.`,
          `${result.remainingWords.toLocaleString('en-US')} words remain \u2014 remove an attachment to make room.`
        );
      }
      return;
    }
    if (result.eventTurn) {
      this.postTurn(result.eventTurn);
    }
    this.outputChannel.appendLine(
      `[WorkshopHandler] Context attached (${result.attachment.kind}, ${result.attachment.label}, ${result.attachment.words} words)`
    );
    this.sessionPersistence.markDirty('context attachment added');
    this.postSessionState();
  }

  /**
   * Context-file disk pipeline: same guardrails as excerpts, but head-sliced
   * to the AGGREGATE context budget — a single file can never carry more
   * than the whole list is allowed to hold.
   */
  private async loadContextFileFromDisk(
    fsPath: string,
    displayPath: string
  ): Promise<{ text: string; words: number; truncation?: { keptWords: number; totalWords: number } } | undefined> {
    try {
      const stat = await this.fileSystem.stat(fsPath);
      if (stat.type !== FileType.File) {
        this.sendError('workshop', 'The selected path is not a file.', displayPath);
        return undefined;
      }
      if (stat.size > PROMPT_BUDGETS.contextAttachments.fileBytes) {
        this.sendError(
          'workshop',
          `That file is too large to attach safely (max ${formatBytes(PROMPT_BUDGETS.contextAttachments.fileBytes)}).`,
          `${displayPath} is ${formatBytes(stat.size)}`
        );
        return undefined;
      }
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      this.sendError('workshop', `Could not inspect the selected file.`, `${displayPath}: ${details}`);
      return undefined;
    }

    let content: string;
    try {
      content = Buffer.from(await this.fileSystem.readFile(fsPath)).toString('utf8');
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      this.sendError('workshop', `Could not read the selected file.`, `${displayPath}: ${details}`);
      return undefined;
    }

    if (content.trim().length === 0) {
      this.sendError('workshop', 'That file is empty \u2014 nothing to attach.', displayPath);
      return undefined;
    }

    const totalWords = countWords(content);
    if (totalWords > PROMPT_BUDGETS.contextAttachments.words) {
      const trimmed = trimToWordLimit(content, PROMPT_BUDGETS.contextAttachments.words);
      this.outputChannel.appendLine(
        `[WorkshopHandler] Context file head-sliced: ${trimmed.trimmedWords} of ${totalWords} words (${displayPath})`
      );
      return {
        text: trimmed.trimmed,
        words: trimmed.trimmedWords,
        truncation: { keptWords: trimmed.trimmedWords, totalWords }
      };
    }
    return { text: content, words: totalWords };
  }

  async handleTodoAction(message: WorkshopTodoActionMessage): Promise<void> {
    const action = message.payload;
    let apply: () => void;
    let target: string;
    switch (action?.action) {
      case 'add':
        if (typeof action.sourceTurnId !== 'string' || typeof action.findingKey !== 'string') {
          this.sendError('workshop.todo', 'Task source must identify a turn and finding');
          return;
        }
        apply = () => this.session.addTodoFromFinding(action.sourceTurnId, action.findingKey);
        target = `sourceTurnId=${action.sourceTurnId}, findingKey=${action.findingKey}`;
        break;
      case 'edit':
        if (typeof action.todoId !== 'string' || typeof action.text !== 'string') {
          this.sendError('workshop.todo', 'Task edit must include an id and text');
          return;
        }
        apply = () => this.session.editTodo(action.todoId, action.text);
        target = `todoId=${action.todoId}`;
        break;
      case 'complete':
        if (typeof action.todoId !== 'string') {
          this.sendError('workshop.todo', 'Task action must include an id');
          return;
        }
        apply = () => this.session.setTodoStatus(action.todoId, 'completed');
        target = `todoId=${action.todoId}`;
        break;
      case 'reopen':
        if (typeof action.todoId !== 'string') {
          this.sendError('workshop.todo', 'Task action must include an id');
          return;
        }
        apply = () => this.session.setTodoStatus(action.todoId, 'open');
        target = `todoId=${action.todoId}`;
        break;
      case 'dismiss':
        if (typeof action.todoId !== 'string') {
          this.sendError('workshop.todo', 'Task action must include an id');
          return;
        }
        apply = () => this.session.setTodoStatus(action.todoId, 'dismissed');
        target = `todoId=${action.todoId}`;
        break;
      case 'reorder':
        if (
          typeof action.todoId !== 'string' ||
          (action.direction !== 'up' && action.direction !== 'down')
        ) {
          this.sendError('workshop.todo', 'Task reorder must include an id and direction');
          return;
        }
        apply = () => this.session.reorderTodo(action.todoId, action.direction);
        target = `todoId=${action.todoId}, direction=${action.direction}`;
        break;
      default:
        this.sendError('workshop.todo', 'Unknown Workshop task action');
        return;
    }
    try {
      apply();
      this.outputChannel.appendLine(
        `[WorkshopHandler] Task action applied (${action.action}, ${target}, source=${message.source})`
      );
      this.sessionPersistence.markDirty('task action committed');
      this.postSessionState();
    } catch (error) {
      this.sendError(
        'workshop.todo',
        error instanceof Error ? error.message : 'Could not update Workshop task'
      );
    }
  }

  /**
   * "Pin from file…" (Sprint 3): host-side file picker → read → head-slice
   * if huge → pin with full provenance. The dialog lives behind the
   * ShellService port so this handler stays vscode-free.
   */
  async handlePickExcerptFile(_message: WorkshopPickExcerptFileMessage): Promise<void> {
    // Same source-of-truth guard as handleSetExcerpt — a picker dialog takes
    // long enough that "wasn't running when I clicked" proves nothing.
    if (this.rejectExcerptMutationWhileRunning()) {
      return;
    }

    const picked = await this.shell.pickFile({
      title: 'Pin excerpt from file',
      filters: { 'Text files': ['md', 'markdown', 'txt'], 'All files': ['*'] }
    });
    if (!picked) {
      // Dialog dismissed — not an error, nothing changed.
      return;
    }

    // The dialog was open for arbitrarily long; re-check the guard.
    if (this.rejectExcerptMutationWhileRunning()) {
      return;
    }

    const displayPath = this.toDisplayPath(picked.fsPath);
    const loaded = await this.loadExcerptFromDisk(picked.fsPath, displayPath);
    if (!loaded) {
      return;
    }

    const source = await this.withConfiguredResource({
      kind: 'file',
      sourceUri: picked.uri,
      relativePath: displayPath
    });

    if (this.rejectExcerptMutationWhileRunning()) {
      return;
    }

    if (!this.tryReplaceExcerpt({
      text: loaded.text,
      source,
      truncation: loaded.truncation,
      sourceFingerprint: loaded.sourceFingerprint
    })) {
      return;
    }
    this.sessionPersistence.markDirty('file excerpt replaced');
    this.postSessionState();
  }

  /**
   * "Re-read from file" (Sprint 12): a file-backed excerpt picks up on-disk
   * edits as a normal revision. Unchanged content no-ops with a status line —
   * no version bump, no divider, no retired sidecars.
   */
  async handleRereadExcerpt(_message: WorkshopRereadExcerptMessage): Promise<void> {
    if (this.rejectExcerptMutationWhileRunning()) {
      return;
    }

    const excerpt = this.session.getExcerpt();
    if (!excerpt || excerpt.source.kind !== 'file') {
      this.sendError('workshop', 'Only a file-backed excerpt can be re-read from disk.');
      return;
    }
    const source = excerpt.source;

    let fsPath: string;
    try {
      fsPath = fileURLToPath(source.sourceUri);
    } catch (error) {
      this.outputChannel.appendLine(
        `[WorkshopHandler] Excerpt source URI could not be converted to a file path: ${error instanceof Error ? error.message : String(error)}`
      );
      this.sendError('workshop', 'The excerpt’s source location is no longer readable.', source.relativePath);
      return;
    }

    const loaded = await this.loadExcerptFromDisk(fsPath, source.relativePath);
    if (!loaded) {
      return;
    }

    if (this.rejectExcerptMutationWhileRunning()) {
      return;
    }

    const unchanged = excerpt.sourceFingerprint !== undefined
      ? loaded.sourceFingerprint === excerpt.sourceFingerprint
      : loaded.text === excerpt.text &&
        loaded.truncation?.totalWords === excerpt.truncation?.totalWords;
    if (unchanged) {
      this.outputChannel.appendLine(
        `[WorkshopHandler] Excerpt re-read: unchanged on disk (${source.relativePath})`
      );
      this.sendStatus(`Excerpt unchanged on disk · ${source.relativePath}`);
      return;
    }

    // Re-derive the canonical key on every re-read so configuration changes
    // since the original pin are honored in the revision's provenance.
    const resolvedSource = await this.withConfiguredResource(source);
    if (this.rejectExcerptMutationWhileRunning()) {
      return;
    }

    if (!this.tryReplaceExcerpt({
      text: loaded.text,
      source: resolvedSource,
      truncation: loaded.truncation,
      sourceFingerprint: loaded.sourceFingerprint
    })) {
      return;
    }
    this.sessionPersistence.markDirty('file excerpt reread');
    this.postSessionState();
  }

  /**
   * Shared disk pipeline for file-backed excerpts (pick + re-read): stat,
   * size cap, read, UTF-8 decode, empty check, head-slice guardrail. Sends
   * the user-facing error itself and returns undefined on any failure.
   */
  private async loadExcerptFromDisk(
    fsPath: string,
    displayPath: string
  ): Promise<{ text: string; truncation?: WorkshopExcerptTruncation; sourceFingerprint: string } | undefined> {
    try {
      const stat = await this.fileSystem.stat(fsPath);
      if (stat.type !== FileType.File) {
        this.sendError('workshop', 'The selected path is not a file.', displayPath);
        return undefined;
      }
      if (stat.size > PROMPT_BUDGETS.fileExcerpt.bytes) {
        this.sendError(
          'workshop',
          `That file is too large to pin safely (max ${formatBytes(PROMPT_BUDGETS.fileExcerpt.bytes)}).`,
          `${displayPath} is ${formatBytes(stat.size)}`
        );
        return undefined;
      }
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      this.sendError('workshop', `Could not inspect the selected file.`, `${displayPath}: ${details}`);
      return undefined;
    }

    let raw: Uint8Array;
    try {
      raw = await this.fileSystem.readFile(fsPath);
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      this.sendError('workshop', `Could not read the selected file.`, `${displayPath}: ${details}`);
      return undefined;
    }

    let content: string;
    try {
      content = Buffer.from(raw).toString('utf8');
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      this.sendError('workshop', `Could not decode the selected file as UTF-8.`, `${displayPath}: ${details}`);
      return undefined;
    }

    if (content.trim().length === 0) {
      this.sendError('workshop', 'That file is empty — nothing to pin.', displayPath);
      return undefined;
    }

    // Head-slice guardrail: pin a sane head of a huge file and SAY SO —
    // the truncation rides the excerpt model so the UI renders it durably.
    let text = content;
    let truncation: WorkshopExcerptTruncation | undefined;
    const totalWords = countWords(content);
    if (totalWords > PROMPT_BUDGETS.fileExcerpt.words) {
      const trimmed = trimToWordLimit(content, PROMPT_BUDGETS.fileExcerpt.words);
      text = trimmed.trimmed;
      truncation = { pinnedWords: trimmed.trimmedWords, totalWords };
      this.outputChannel.appendLine(
        `[WorkshopHandler] File excerpt head-sliced: ${trimmed.trimmedWords} of ${totalWords} words (${displayPath})`
      );
    }

    return { text, truncation, sourceFingerprint: createHash('sha256').update(raw).digest('hex') };
  }

  // Public compatibility seam for focused tests and direct callers;
  // implementation lives in the bounded session IPC collaborator.
  handleResetSession(message: WorkshopResetSessionMessage): Promise<void> {
    return this.sessionMessageHandler.handleResetSession(message);
  }

  handleRequestSession(message: WorkshopRequestSessionMessage): Promise<void> {
    return this.sessionMessageHandler.handleRequestSession(message);
  }

  handleSaveSession(message: WorkshopSaveSessionMessage): Promise<void> {
    return this.sessionMessageHandler.handleSaveSession(message);
  }

  handleListSessions(message: WorkshopListSessionsMessage): Promise<void> {
    return this.sessionMessageHandler.handleListSessions(message);
  }

  handleOpenSession(message: WorkshopOpenSessionMessage): Promise<void> {
    return this.sessionMessageHandler.handleOpenSession(message);
  }

  handleRenameSession(message: WorkshopRenameSessionMessage): Promise<void> {
    return this.sessionMessageHandler.handleRenameSession(message);
  }

  handleDuplicateSession(message: WorkshopDuplicateSessionMessage): Promise<void> {
    return this.sessionMessageHandler.handleDuplicateSession(message);
  }

  handleRevealSession(message: WorkshopRevealSessionMessage): Promise<void> {
    return this.sessionMessageHandler.handleRevealSession(message);
  }

  handleDeleteSession(message: WorkshopDeleteSessionMessage): Promise<void> {
    return this.sessionMessageHandler.handleDeleteSession(message);
  }

  private rejectRoomMutationDuringSessionOperation(
    sessionAction?: WorkshopSessionAction
  ): boolean {
    if (!this.sessionPersistence.isSessionOperationPending()) {
      return false;
    }
    const message =
      'Wait for the current session save or replacement to finish before changing the room.';
    if (sessionAction) {
      this.sessionMessageHandler.postActionResult(sessionAction, false, message);
    } else {
      this.sendError('workshop', message);
    }
    return true;
  }

  private preemptActiveRun(): void {
    if (this.activeRun) {
      this.outputChannel.appendLine(
        `[WorkshopHandler] Preempting in-flight run: ${this.activeRun.requestId} (${this.activeRun.label})`
      );
      this.activeRun.controller.abort();
      this.session.abandonRun(this.activeRun.requestId);
      this.activeRun = undefined;
    }
  }

  /** Prevent an excerpt mutation from invalidating an active tool or wizard result. */
  private rejectExcerptMutationWhileRunning(): boolean {
    if (this.activeRun) {
      this.sendError('workshop', MID_RUN_EXCERPT_GUARD_MESSAGE);
      return true;
    }
    if (this.wizardRun) {
      this.sendError('workshop', MID_WIZARD_EXCERPT_GUARD_MESSAGE);
      return true;
    }
    return false;
  }

  private cancelWizardRun(reason: string): void {
    if (!this.wizardRun) {
      return;
    }
    this.outputChannel.appendLine(
      `[WorkshopHandler] Aborting Context wizard ${this.wizardRun.requestId} on ${reason}`
    );
    this.wizardRun.controller.abort();
    this.wizardRun = undefined;
  }

  private reportConfiguredResourceLoadFailure(
    result: WorkshopConfiguredResourceLoadResult,
    action: string,
    maxBytes = PROMPT_BUDGETS.contextAttachments.fileBytes
  ): result is Extract<WorkshopConfiguredResourceLoadResult, { kind: 'loaded' }> {
    switch (result.kind) {
      case 'loaded':
        return true;
      case 'missing':
        this.sendError('workshop', 'That resource is no longer in the configured catalog.');
        return false;
      case 'too-large':
        this.sendError(
          'workshop',
          `That file is too large to ${action} safely (max ${formatBytes(maxBytes)}).`,
          `${result.summary.path} is ${formatBytes(result.summary.sizeBytes)}`
        );
        return false;
      case 'empty':
        this.sendError('workshop', `That resource is empty — nothing to ${action}.`, result.summary.path);
        return false;
      case 'unreadable':
        this.sendError('workshop', `Could not read the selected resource to ${action}.`, `${result.summary.path}: ${result.details}`);
        return false;
    }
  }

  private settleActiveRun(requestId: string): void {
    if (this.activeRun?.requestId === requestId) {
      this.activeRun = undefined;
    }
    // Only blank the ticker when NO successor owns the slot (PR #67 #15):
    // a preempted run's late finally must not erase the new run's
    // "Streaming…" status mid-stream.
    if (!this.activeRun) {
      this.sendStatus('');
      void this.flushDeferredConversationSettings().then((changed) => {
        if (changed) {
          this.sessionPersistence.markDirty('deferred conversation settings applied');
          this.postSessionState();
        }
      });
      void this.sessionPersistence.flush();
    }
  }

  private commitTimeNotice(notice: WorkshopPreparedTimeNotice | undefined): void {
    if (notice) {
      this.sessionTime.commitNotice(notice);
    }
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private async flushDeferredConversationSettings(): Promise<boolean> {
    try {
      const result = await this.conversationSettingsService.flushDeferredSettingsSync();
      return result.changed;
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(
        `[WorkshopHandler] Deferred conversation settings sync failed: ${details}`
      );
      this.sendError(
        'workshop',
        'Could not apply the deferred conversation settings from VS Code Settings.',
        details
      );
      return false;
    }
  }

  /**
   * Resolve verified selection/file provenance to the resolver's canonical
   * `{ group, path }` key (Sprint 12 Phase 6). Comparison happens host-side
   * against summaries' HOST-ONLY absolutePath — that path never crosses to
   * the webview or a prompt; only the canonical key is stamped. Webview
   * configuredResource claims are always re-derived here, never trusted.
   * Any failure (unparseable URI, unreadable catalog, ambiguous case-folded
   * match) fails safe: the source stays honest with no configured key.
   */
  private async withConfiguredResource(
    source: WorkshopExcerptSource
  ): Promise<WorkshopExcerptSource> {
    if (source.kind === 'manual') {
      return source;
    }
    const unstamped: Extract<WorkshopExcerptSource, { kind: 'editor-selection' | 'file' }> = source.kind === 'file'
      ? { kind: 'file', sourceUri: source.sourceUri, relativePath: source.relativePath }
      : {
          kind: 'editor-selection',
          sourceUri: source.sourceUri,
          relativePath: source.relativePath,
          ...(source.startLine !== undefined && source.endLine !== undefined
            ? { startLine: source.startLine, endLine: source.endLine }
            : {})
        };
    let fsPath: string;
    try {
      fsPath = path.normalize(fileURLToPath(source.sourceUri));
    } catch (error) {
      this.outputChannel.appendLine(
        `[WorkshopHandler] Excerpt-source resolution skipped — URI unreadable: ${error instanceof Error ? error.message : String(error)}`
      );
      return unstamped;
    }
    let summaries;
    try {
      summaries = (await this.contextResourceService.openCatalog()).entries();
    } catch (error) {
      this.outputChannel.appendLine(
        `[WorkshopHandler] Excerpt-source resolution skipped — catalog unreadable: ${error instanceof Error ? error.message : String(error)}`
      );
      return unstamped;
    }
    const exact = summaries.filter(
      (summary) => path.normalize(summary.absolutePath) === fsPath
    );
    const caseFolded = exact.length > 0 ? exact : summaries.filter(
      (summary) => path.normalize(summary.absolutePath).toLowerCase() === fsPath.toLowerCase()
    );
    if (caseFolded.length !== 1) {
      if (caseFolded.length > 1) {
        this.outputChannel.appendLine(
          `[WorkshopHandler] Excerpt source matched ${caseFolded.length} configured resources when letter case is ignored; leaving it unstamped.`
        );
      }
      return unstamped;
    }
    const summary = caseFolded[0];
    this.outputChannel.appendLine(
      `[WorkshopHandler] Excerpt source resolved to configured resource [${summary.group}] ${summary.path}`
    );
    return {
      ...unstamped,
      configuredResource: { group: summary.group, path: summary.path }
    };
  }

  /**
   * Try to pin or revise the excerpt. Centralized because four intake paths
   * share the same aggregate transition and refusal behavior.
   *
   * Returns false when the aggregate refused —
   * the scope lock (ADR 2026-07-25) will not let an open conversation adopt a
   * passage once it has a memory. The refusal names the recovery path, so it
   * belongs in front of the writer rather than escaping as an unhandled
   * rejection at the IPC boundary.
   */
  private tryReplaceExcerpt(input: {
    text: string;
    source: WorkshopExcerptSource;
    truncation?: WorkshopExcerptTruncation;
    sourceFingerprint?: string;
  }): boolean {
    let replacement: WorkshopExcerptReplacement;
    try {
      replacement = this.session.replaceExcerpt(input);
    } catch (error) {
      this.sendError(
        'workshop',
        workshopScopeMutationError(error, 'That excerpt cannot be pinned in this session.')
      );
      return false;
    }
    this.discardConversations(replacement.disposedConversationIds);
    if (replacement.dividerTurn) {
      this.postTurn(replacement.dividerTurn);
    }
    this.outputChannel.appendLine(
      `[WorkshopHandler] Excerpt v${replacement.excerpt.version} pinned (${workshopExcerptSourcePath(replacement.excerpt.source) ?? 'pasted'}, ${replacement.excerpt.text.length} chars, ${replacement.retiredSidecarCount} sidecars retired)`
    );
    if (replacement.discardedShelvedExcerpt) {
      // The shelf holds one passage and no history, so this line is the only
      // surviving record of what the pin destroyed.
      const discarded = replacement.discardedShelvedExcerpt;
      this.outputChannel.appendLine(
        `[WorkshopHandler] Set-aside excerpt discarded by that pin (` +
        `${workshopExcerptSourcePath(discarded.source) ?? 'pasted'}, ` +
        `v${discarded.version}, ${discarded.text.length} chars)`
      );
    }
    const pendingHostUpdates = this.session.collectPendingHostUpdates();
    if (pendingHostUpdates?.excerpt) {
      this.outputChannel.appendLine(
        `[WorkshopHandler] Pending host update queued (${describeWorkshopPendingHostUpdates(pendingHostUpdates)})`
      );
    }
    if (replacement.replacementCount === 3) {
      this.sendStatus(
        'This session now carries three excerpt revisions. Consider a new session soon to keep context cost down.'
      );
    }
    return true;
  }

  private discardConversations(conversationIds: readonly string[]): void {
    for (const conversationId of conversationIds) {
      this.assistantToolService.discardConversation(conversationId);
    }
  }

  private toDisplayPath(filePath: string): string {
    const relativePath = this.workspace.asRelativePath(filePath);
    if (relativePath === filePath || isAbsolutePath(relativePath)) {
      return `External file: ${baseName(filePath)}`;
    }
    return relativePath;
  }

  // Message helpers (domain owns its message lifecycle)

  private postTurn(turn: WorkshopTurn): void {
    const message: WorkshopTurnMessage = {
      type: MessageType.WORKSHOP_TURN,
      source: 'extension.workshop',
      payload: { turn },
      timestamp: Date.now()
    };
    void this.postMessage(message);
  }

  private postSessionState(): void {
    const session = this.session.getSnapshot();
    session.contextBudget = this.activeContextBudget();
    const availability = this.sessionPersistence.availability();
    const message: WorkshopSessionStateMessage = {
      type: MessageType.WORKSHOP_SESSION_STATE,
      source: 'extension.workshop',
      payload: {
        session,
        writerProfile: this.conversationSettingsService.getWriterProfile(),
        persistence: {
          available: availability.available,
          unavailableReason: availability.available ? undefined : availability.reason,
          currentCheckpointProtected: this.sessionPersistence.isCurrentCheckpointProtected(),
          degradedConversationKeys: this.sessionPersistence.getDegradedConversationKeys(),
          degradedConversations: this.sessionPersistence.getDegradedConversations()
        }
      },
      timestamp: Date.now()
    };
    void this.postMessage(message);
  }

  private activeContextBudget(): LabeledContextBudgetSnapshot {
    const target = this.session.getChatTarget();
    const { label, conversationId } = target.kind === 'tool'
      ? {
          label: `${workshopToolLabel(target.toolId)} context`,
          conversationId: this.session.getToolSidecarConversationId(target.toolId)
        }
      : target.kind === 'personaGuest'
        ? {
            label: `${workshopPersonaLabel(target.personaId)} context`,
            conversationId: this.session.getPersonaGuestConversationId(target.personaId)
          }
        : {
            label: `${workshopPersonaLabel(this.session.getSelectedPersonaId())} context`,
            conversationId: this.session.getHostConversationId()
          };
    // The Phase 7 manifest: writer-declared rows first, then this
    // conversation's agent-fetched deliveries in delivery order. Both sides
    // are display-safe; the conversation id never leaves this method.
    const sources = [
      ...this.session.collectWriterSources(target),
      ...this.assistantToolService.getConversationContextSources(conversationId)
    ];
    return {
      label,
      snapshot: this.assistantToolService.getConversationContextBudget(conversationId),
      sources: sources.length > 0 ? sources : undefined
    };
  }

  private sendStreamStarted(requestId: string): void {
    const message: StreamStartedMessage = {
      type: MessageType.STREAM_STARTED,
      source: 'extension.workshop',
      payload: { requestId, domain: 'workshop' },
      timestamp: Date.now()
    };
    void this.postMessage(message);
  }

  private sendStreamChunk(requestId: string, token: string): void {
    const message: StreamChunkMessage = {
      type: MessageType.STREAM_CHUNK,
      source: 'extension.workshop',
      payload: { requestId, domain: 'workshop', token },
      timestamp: Date.now()
    };
    void this.postMessage(message);
  }

  private sendStreamComplete(
    requestId: string,
    content: string,
    cancelled: boolean,
    usage?: TokenUsage,
    truncated: boolean = false
  ): void {
    const message: StreamCompleteMessage = {
      type: MessageType.STREAM_COMPLETE,
      source: 'extension.workshop',
      payload: { requestId, domain: 'workshop', content, cancelled, usage, truncated },
      timestamp: Date.now()
    };
    void this.postMessage(message);
  }

  private sendStatus(
    message: string,
    progress?: { current: number; total: number },
    tickerMessage?: string
  ): void {
    const statusMessage: StatusMessage = {
      type: MessageType.STATUS,
      source: 'extension.workshop',
      payload: { message, progress, tickerMessage },
      timestamp: Date.now()
    };
    void this.postMessage(statusMessage);
  }

  private sendError(source: ErrorSource, message: string, details?: string): void {
    const errorMessage: ErrorMessage = {
      type: MessageType.ERROR,
      source: 'extension.workshop',
      payload: { source, message, details },
      timestamp: Date.now()
    };
    void this.postMessage(errorMessage);
    this.outputChannel.appendLine(
      `[WorkshopHandler] ERROR [${source}]: ${message}${details ? ` - ${details}` : ''}`
    );
  }
}
