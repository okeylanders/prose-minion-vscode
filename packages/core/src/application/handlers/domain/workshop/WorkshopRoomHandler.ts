/**
 * Workshop room/run orchestration owner (ADR 2026-07-03; architecture-refactor
 * Sprint 07).
 *
 * Owns the nine room/run routes, the single active-run slot, preemption,
 * transport envelopes, and the sole WORKSHOP_SESSION_STATE constructor.
 * WorkshopSliceComposition owns the shared mutation gate and composes the
 * sibling route handlers around this room owner. Session truth lives in
 * WorkshopSessionService and outlives both handler surfaces.
 *
 * Sprint 06B makes every tool run an isolated retained sidecar: the exact tool
 * report lands first, then the permanent persona host receives bounded
 * evidence and synthesizes a separate attributed turn. Explicit direct-tool
 * mode continues the sidecar without relaying through the host.
 *
 * Preemption semantics are unchanged from Sprint 2: a new run preempts any
 * in-flight one, reset aborts, and zombie completions are refused + logged.
 */

import type { WorkshopBookmarkBrowserPort } from '@handlers/domain/workshop/WorkshopBookmarkBrowserHandler';
import type { WorkshopMemoryDraftPorts } from '@handlers/domain/workshop/WorkshopMemoryDraftHandler';
import type { WorkshopProjectMemoryPort } from '@handlers/domain/workshop/WorkshopRouteContracts';
import type { WorkshopPinnedContextServices } from '@/application/services/workshop/pinnedContext/WorkshopPinnedContextPorts';
import {
  hasWorkshopMemoryProposalText
} from '@/utils/workshopReplyControls';
import { resolveWorkshopReplyMemory, type WorkshopReplyMemoryContext } from '@/application/services/workshop/memory/WorkshopReplyMemory';
import {
  resolveWorkshopReplyEdits,
  type WorkshopReplyEditsContext
} from '@/application/services/workshop/fileEdits/WorkshopReplyEditOffers';
import type { FileEditStaging } from '@/domain/models/FileEditStaging';
import type { FileEditApplyPort } from '@/domain/models/FileEdit';
import {
  workshopEditOfferRoomViewOnce,
  workshopTurnForWebview,
  type WorkshopEditOfferRoomView
} from '@/application/services/workshop/fileEdits/WorkshopFileEditWebviewView';
import { workshopEditOfferAuthorTarget } from '@handlers/domain/workshop/WorkshopEditOfferHandler';
import { workshopEditRequestTime } from '@/utils/workshopEditRequestFrame';
import { LogSink, ShellService } from '@/platform';
import { AssistantToolService } from '@services/analysis/AssistantToolService';
import { AgentRunUnavailableError } from '@orchestration/AgentRunEngine';
import { projectContextSource } from '@orchestration/ContextSourceRecord';
import { ContextAssistantService } from '@services/analysis/ContextAssistantService';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { RunWorkshopToolSidePass } from '@/application/services/workshop/RunWorkshopToolSidePass';
import {
  WorkshopRoomDeliveryService,
  workshopRoomDeliveredThrough
} from '@/application/services/workshop/WorkshopRoomDeliveryService';
import { WorkshopContextIntakeService } from '@/application/services/workshop/WorkshopContextIntakeService';
import { WorkshopConversationSettingsService } from '@/application/services/workshop/WorkshopConversationSettingsService';
import { renderWorkshopStandingDirectiveFrames } from '@/application/services/workshop/directives/WorkshopStandingDirectiveFrames';
import {
  WorkshopPreparedTimeNotice,
  WorkshopSessionTimeService,
  workshopGuestConversationKey
} from '@/application/services/workshop/WorkshopSessionTimeService';
import { WorkshopSessionPersistenceCoordinator } from '@/application/services/workshop/WorkshopSessionPersistenceCoordinator';
import { WorkshopPersonaCapabilityFactory } from '@/application/services/workshop/WorkshopPersonaCapability';
import {
  prepareWorkshopReactionDelivery,
  stageWorkshopReactionDelivery,
  workshopReactionHoldsAfterCatchUp,
  workshopReactionHoldsTranscript
} from '@/application/services/workshop/reactions/WorkshopReactionDeliveryStage';
import { workshopReactionInviteFor } from '@/application/services/workshop/reactions/WorkshopReactionInvite';
import { workshopEditOfferReminderFor } from '@/application/services/workshop/fileEdits/WorkshopEditOfferReminder';
import type {
  WorkshopOneShotWidgetRoomArtifact
} from '@/application/services/workshop/widgets/WorkshopOneShotWidgetCommitCoordinator';
import {
  buildWorkshopContextAttachmentsFrame,
  buildWorkshopExcerptSourceFrame,
  buildWorkshopGuestJoinMessage,
  buildWorkshopGuestTranscript,
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
import type {
  WorkshopThreadArtifactFrameInput
} from '@/application/services/workshop/WorkshopThreadArtifactFrame';
import { isWorkshopToolId, workshopToolLabel } from '@shared/constants/workshopTools';
import {
  isWorkshopPersonaId,
  workshopPersonaLabel
} from '@shared/constants/workshopPersonas';
import { workshopQuickActionPrompt } from '@shared/constants/workshopQuickActions';
import { workshopWriterPreferredAddress } from '@/utils/workshopWriterProfile';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  MessageType,
  CancelWorkshopRequestMessage,
  ErrorMessage,
  ErrorSource,
  StatusMessage,
  StreamStartedMessage,
  StreamChunkMessage,
  StreamCompleteMessage,
  TokenUsage,
  WorkshopQuickActionMessage,
  WorkshopRunToolMessage,
  WorkshopSendMessageMessage,
  WorkshopInviteGuestMessage,
  WorkshopDismissGuestMessage,
  WorkshopSelectPersonaMessage,
  WorkshopSetChatTargetMessage,
  WorkshopSetConversationSettingsMessage,
  WorkshopSessionStateMessage,
  WorkshopSessionSaveStatusMessage,
  WorkshopToolId,
  WorkshopPersonaId,
  WorkshopChatTarget,
  LabeledContextBudgetSnapshot,
  WorkshopTurn,
  WorkshopMessageAttachmentSnapshot,
  WorkshopComposerDraftRestoredMessage,
  WorkshopTurnMessage,
  WorkshopTurnWidgetCommit,
  WorkshopExcerpt,
  workshopExcerptSourceUri,
} from '@messages';
import { WorkshopCapabilityPrincipal } from '@shared/types/workshopCapabilities';
import { workshopWidgetArtifactKind } from '@shared/constants/workshopWidgets';
import { workshopMessageAttachmentKind } from '@shared/constants/workshopThreadArtifactKinds';
import { MessageTransport } from '@handlers/MessageHandlerContracts';
import { MessageRouter } from '@handlers/MessageRouter';
import type {
  WorkshopDirectedRun,
  WorkshopDirectedRunResult,
  WorkshopMutationRouteRegistrar,
  WorkshopTranscriptExportPort,
  WorkshopWidgetRuntime
} from '@handlers/domain/workshop/WorkshopRouteContracts';
import { WorkshopSliceComposition } from '@handlers/domain/workshop/WorkshopSliceComposition';
import {
  WorkshopConversationSettingsPartialApplyError,
  workshopConversationSettingsApplyReport,
  workshopConversationSettingsPartialApplyWords
} from '@/application/services/workshop/WorkshopConversationSettingsPartialApply';

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

type WorkshopPersonaBehaviorFrames = ReturnType<typeof behaviorFramesFor> & {
  timeFrame?: string;
};

type WorkshopPendingHostUpdates = ReturnType<
  WorkshopSessionService['collectPendingHostUpdates']
>;
type WorkshopTodoEvidenceFrame = ReturnType<typeof buildWorkshopTodoEvidence>;

interface WorkshopTargetTurnInput {
  requestId: string;
  text: string;
  displayText: string;
  attachmentRefs: readonly WorkshopMessageAttachmentSnapshot[];
  widgetCommitRef?: WorkshopTurnWidgetCommit;
  editOfferRequest?: WorkshopDirectedRun['editOfferRequest'];
  roomCatchUp?: string;
  hasConversationalCatchUp: boolean;
  todoEvidence?: WorkshopTodoEvidenceFrame;
  hostUpdateFrame?: string;
  threadArtifactFrames: string[];
  timeNotice?: WorkshopPreparedTimeNotice;
  /** `<workshop-reactions>` for a persona turn (ADR 2026-11-07 D4). */
  reactionsFrame?: string;
}

interface WorkshopTargetTurn {
  userTurn: WorkshopTurn;
  modelMessage: string;
  statusMessage: string;
  personaBehaviorFrames: WorkshopPersonaBehaviorFrames;
}

interface WorkshopMessageTargetPlan {
  chatTarget: WorkshopChatTarget;
  conversationId?: string;
  label: string;
  requestType: string;
  toolId?: WorkshopToolId;
  guestPersonaId?: WorkshopPersonaId;
  missingConversationMessage?: string;
  requiresExcerpt: boolean;
  participantOwner?: WorkshopCapabilityPrincipal;
  publishesRoomArtifacts: boolean;
  createsRetainedConversation: boolean;
  completionReason: string;
  hostUpdateDeliveryLabel?: string;
  collectPendingHostUpdates: () => WorkshopPendingHostUpdates | undefined;
  buildTodoEvidence: () => WorkshopTodoEvidenceFrame;
  buildHostUpdateFrame: (
    pendingHostUpdates: WorkshopPendingHostUpdates | undefined
  ) => string | undefined;
  prepareTimeNotice: () => WorkshopPreparedTimeNotice | undefined;
  prepareTurn: (input: WorkshopTargetTurnInput) => WorkshopTargetTurn;
}

/** Optional direct-mode shortcut; explicit target state remains authoritative. */
export const isWorkshopHostReturnShortcut = (text: string, personaLabel: string): boolean =>
  new RegExp(
    `^(?:hey|hi|hello)(?:\\s+|,\\s*)${escapeRegExp(personaLabel)}(?:\\b|(?=\\s*[,!:?—-]))`,
    'i'
  ).test(text.trim());

export class WorkshopRoomHandler {
  /** The single in-flight run — at most one; a new run preempts it. */
  private activeRun?: {
    requestId: string;
    /** Display label for logs/status ("Prose", "Follow-up", …). */
    label: string;
    toolId?: WorkshopToolId;
    guestPersonaId?: WorkshopPersonaId;
    controller: AbortController;
    /** A host-directed run: its writer turn leaves with it when it is preempted (ADR 2026-11-10 D3). */
    directed?: boolean;
  };

  private readonly disposeStatusListener: () => void;
  private readonly disposeSessionSaveStatusListener: () => void;
  private readonly sliceComposition: WorkshopSliceComposition;
  /** One prefixed log line: counts and keys only (the reaction delivery steps log through it). */
  private readonly logLine = (line: string): void => this.outputChannel.appendLine(`[WorkshopRoomHandler] ${line}`);

  /**
   * The per-turn reaction invite for the run just begun (ADR 2026-11-07,
   * 2026-11-10 addendum): only while persona reactions are on and the run's
   * reply has a writer message to react to. Logged without text. A press on
   * an edit offer is never invited: its answer is trailers alone (ADR
   * 2026-11-10 D5).
   */
  private reactionInvite(requestId: string): string | undefined {
    const invite = workshopReactionInviteFor(
      this.conversationSettingsService.personaReactionsOpen(),
      this.session.personaReplyReactionTarget(requestId)
    );
    if (invite) {
      this.logLine('Reaction invite added');
    }
    return invite;
  }

  /** The per-turn edit-offer reminder for a persona's message (ADR 2026-11-10, second addendum). Logged without text. */
  private editOfferReminder(toPersona: boolean, press: boolean, excerpt: WorkshopExcerpt | undefined): string[] {
    const reminder = workshopEditOfferReminderFor({
      fileEditsOpen: this.conversationSettingsService.fileEditsOpen(),
      excerptFromFile: excerpt !== undefined && workshopExcerptSourceUri(excerpt.source) !== undefined,
      toPersona,
      press
    });
    if (reminder) {
      this.logLine('Edit offer reminder added');
    }
    return reminder ? [reminder] : [];
  }

  constructor(
    private readonly assistantToolService: AssistantToolService,
    contextAssistantService: ContextAssistantService,
    private readonly session: WorkshopSessionService,
    private readonly roomDelivery: WorkshopRoomDeliveryService,
    private readonly runToolSidePass: RunWorkshopToolSidePass,
    private readonly capabilityFactory: WorkshopPersonaCapabilityFactory,
    private readonly postMessage: MessageTransport,
    shell: ShellService,
    contextIntakeService: WorkshopContextIntakeService,
    private readonly conversationSettingsService: WorkshopConversationSettingsService,
    private readonly sessionTime: WorkshopSessionTimeService,
    private readonly sessionPersistence: WorkshopSessionPersistenceCoordinator,
    transcriptExport: WorkshopTranscriptExportPort,
    widgetRuntime: WorkshopWidgetRuntime,
    private readonly outputChannel: LogSink,
    projectMemory: WorkshopProjectMemoryPort,
    pinnedContext: WorkshopPinnedContextServices,
    bookmarkBrowser: WorkshopBookmarkBrowserPort,
    /** Persona file edits' staging (ADR 2026-11-05 D4): `FileEditStagingService`, built in `extension.ts`. */
    private readonly fileEditStaging: FileEditStaging,
    /** Persona file edits' Apply and Preview (ADR 2026-11-05 D7–D9): the gateway, built in `extension.ts`. */
    fileEditApply: FileEditApplyPort,
    memoryDrafts: WorkshopMemoryDraftPorts
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
    this.sliceComposition = new WorkshopSliceComposition(
      {
        contextAssistantService,
        session: this.session,
        postMessage: this.postMessage,
        shell,
        contextIntakeService,
        sessionPersistence: this.sessionPersistence,
        transcriptExport,
        widgetRuntime,
        projectMemory,
        pinnedContext,
        bookmarkBrowser,
        fileEditApply,
        memoryDrafts,
        outputChannel: this.outputChannel
      },
      {
        postSessionState: () => this.postSessionState(),
        postTurn: (turn) => this.postTurn(turn),
        reportRouteError: (source, message, details, owner) =>
          this.sendError(source, message, details, owner),
        sendStatus: (message) => this.sendStatus(message),
        discardConversations: (conversationIds) => this.discardConversations(conversationIds),
        excerptMutationBlockedReason: () => this.excerptMutationBlockedReason(),
        flushDeferredConversationSettings: async () => {
          await this.flushDeferredConversationSettings();
        },
        activeRunLabel: () => this.activeRunLabel(),
        sendRoomMessage: (text, displayText, executeOptions) =>
          this.executeMessage(text, displayText, undefined, executeOptions),
        isRoomRunActive: () => this.activeRun !== undefined,
        fileEditsMode: () => this.conversationSettingsService.getFileEditsMode(),
        runDirected: (target, run) =>
          this.executeMessage(run.message, run.displayText, target, { directedRun: run }),
        formatTurnTime: (timestamp) => workshopEditRequestTime(timestamp, this.sessionTime.exportState().timezone),
        findReadInRecord: (identity) => this.assistantToolService.findConversationContextSourceRead(
          this.chatTargetConversation().conversationId,
          identity
        ),
        disposeRoomSubscriptions: () => {
          this.disposeStatusListener();
          this.disposeSessionSaveStatusListener();
        },
        disposeActiveRoomRun: () => {
          if (this.activeRun) {
            this.outputChannel.appendLine(
              `[WorkshopRoomHandler] Aborting in-flight run on dispose: ${this.activeRun.requestId}`
            );
            this.activeRun.controller.abort();
            this.session.abandonRun(this.activeRun.requestId);
            this.activeRun = undefined;
          }
        }
      }
    );
  }

  /** Register the nine room/run routes beside the composed sibling routes. */
  registerRoutes(router: MessageRouter): void {
    this.sliceComposition.registerRoutes(router, (
      router,
      registerMutation: WorkshopMutationRouteRegistrar
    ) => {
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
      router.register(
        MessageType.CANCEL_WORKSHOP_REQUEST,
        this.handleCancelRequest.bind(this)
      );
    });
  }

  /**
   * Delegate the preserved Workshop teardown sequence to the composition.
   * Room listeners and the active run are released through named host effects;
   * the session aggregate and retained conversation survive this webview.
   */
  dispose(): void {
    this.sliceComposition.dispose();
  }

  private beginSessionInteraction(): void {
    const marker = this.sessionPersistence.beginInteraction();
    if (marker) {
      this.postTurn(marker);
    }
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

    this.beginSessionInteraction();
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
      widgetRecommendationRejected: (errorMessage, details) =>
        this.sendError('workshop.widget_recommendation', errorMessage, details),
      memoryAutoSave: (turn, indexes) => this.sliceComposition.autoSaveMemoryProposals(turn, indexes, controller.signal),
      memoryAutoSavesInRoom: () => this.sliceComposition.memoryAutoSavesInRoom(),
      fileEdits: (reply, signal) => this.replyFileEdits(reply, signal),
      reactionsOpen: () => this.conversationSettingsService.personaReactionsOpen(),
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
        message.payload?.writerProfile,
        message.payload?.webResearch,
        message.payload?.projectMemory,
        message.payload?.fileEdits
      );
      const report = workshopConversationSettingsApplyReport(result);
      if (report) {
        this.outputChannel.appendLine(`[WorkshopRoomHandler] ${report.logLine}`);
        this.sendError('workshop', report.message, report.details);
      }
      if (result.changed) {
        this.sessionPersistence.markDirty('conversation settings changed');
      }
      this.postSessionState();
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(
        `[WorkshopRoomHandler] Conversation settings change rejected; prior settings retained: ${details}`
      );
      this.sendError(
        'workshop',
        error instanceof WorkshopConversationSettingsPartialApplyError
          ? workshopConversationSettingsPartialApplyWords(error)
          : 'Could not change conversation settings. The previous settings are still active.',
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
        `[WorkshopRoomHandler] External conversation settings sync failed: ${details}`
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

    await this.executeMessage(text, text, undefined, {
      includeMessageAttachments: true,
      restoreDraftOnRollback: true
    });
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

    const subjectStatus = this.session.getParticipantSubjectStatus();
    if (!subjectStatus.ready && subjectStatus.reason === 'scope-unchosen') {
      this.sendError(
        'workshop.invite_guest',
        'Choose how to start this session before inviting a guest.'
      );
      return;
    }
    if (!subjectStatus.ready) {
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
      this.beginSessionInteraction();
      const joinStart = this.session.beginPersonaGuestJoin(
        personaId,
        requestId,
        openingMessage
      );
      const joinRoomTurns = this.roomDelivery.prepareJoinSnapshot({
        kind: 'personaGuest',
        personaId
      }, joinStart.turn.id);
      const roomFrameOptions = {
        writerName: workshopWriterPreferredAddress(writerProfile),
        renderedAt: Date.now(),
        threadArtifactsForTurn: (turn: WorkshopTurn) =>
          this.session.getRoomThreadArtifactsForTurn(turn.id)
      };
      const transcript = buildWorkshopGuestTranscript(joinRoomTurns, roomFrameOptions);
      // A join starts the guest's conversation: its view of reactions begins
      // here, over the turns its transcript hands it (ADR 2026-11-07 D6; PR #246 L1).
      const joinReader = { kind: 'personaGuest', personaId } as const;
      const joinReactions = prepareWorkshopReactionDelivery(
        this.session, joinReader, 'start', workshopReactionHoldsTranscript(transcript.deliveredTurnIds)
      );
      stageWorkshopReactionDelivery(this.session, requestId, joinReader, joinReactions, this.logLine);
      const joinInvite = this.reactionInvite(requestId);
      const join = buildWorkshopGuestJoinMessage({
        guestPersonaId: personaId,
        excerpt: joinStart.excerpt,
        contextAttachmentsFrame: buildWorkshopContextAttachmentsFrame(
          joinStart.contextAttachments
        ),
        roomTurns: joinRoomTurns,
        openingMessage,
        roomFrameOptions,
        transcript,
        timeFrame: timeNotice?.frame,
        reactionsFrame: joinReactions.frame,
        // The edit-offer reminder shares the invite's slot on a join, which has no thread-artifact slot.
        reactionInviteFrame: [joinInvite, ...this.editOfferReminder(true, false, joinStart.excerpt)].filter(Boolean).join('\n\n') || undefined,
        ...behaviorFramesFor(joinStart.turn)
      });
      this.activeRun = {
        requestId,
        label: workshopPersonaLabel(personaId),
        guestPersonaId: personaId,
        controller
      };

      this.postTurn(joinStart.turn);
      this.postSessionState();
      this.sendStreamStarted(requestId);
      this.sendStatus(`Inviting ${workshopPersonaLabel(personaId)} into the room…`);

      // Sprint 13D_2 / ADR 2026-07-26: the joining guest owns the same bounded
      // instruments as the host. Excerpt-dependent work remains unavailable
      // when this open-room join has no excerpt.
      const guestCapability = this.capabilityFactory.create({
        requestId,
        personaId,
        owner: { kind: 'personaGuest', personaId },
        excerpt: joinStart.excerpt,
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
          behavior: joinStart.turn.behavior!,
          writerProfile,
          standingDirectiveFrames: renderWorkshopStandingDirectiveFrames(this.session)
        }, {
          signal: controller.signal,
          onToken: (token: string) => this.sendStreamChunk(requestId, token),
          capability: guestCapability,
          webResearch: this.conversationSettingsService.getWebResearch().enabled
        });
        const pendingMemory = this.replyMemory(result.content, controller.signal);
        const replyMemory = pendingMemory && await pendingMemory;
        const fileEdits = await this.replyFileEdits(result.content, controller.signal);
        const memoryAutoSave = this.memoryAutoSaveFor(controller.signal);
        const assistantTurn = completeWorkshopRun({
          memory: replyMemory,
          memoryAutoSave: memoryAutoSave.hand,
          memoryAutoSavesInRoom: memoryAutoSave.inRoom,
          fileEdits,
          reactionsOpen: this.conversationSettingsService.personaReactionsOpen(),
          session: this.session,
          requestId,
          label: workshopPersonaLabel(personaId),
          result,
          aborted: controller.signal.aborted,
          createsRetainedConversation: true,
          copy: workshopMessageCompletionCopy(workshopPersonaLabel(personaId)),
          discardConversation: (id) => this.assistantToolService.discardConversation(id),
          readRetainedHistory: (id) => this.assistantToolService.readWorkshopRetainedHistory(id),
          settleCommittedRun: () => {
            this.session.recordRoomThreadArtifactDeliveries(
              join.transcript.deliveredTurnIds,
              { kind: 'personaGuest', personaId }
            );
          },
          log: (line) => this.outputChannel.appendLine(`[WorkshopRoomHandler] ${line}`),
          events: {
            streamCompleted: (id, content, cancelled, usage, truncated) =>
              this.sendStreamComplete(id, content, cancelled, usage, truncated),
            turnCompleted: (turn) => this.postTurn(turn),
            status: (status) => this.sendStatus(status),
            error: (errorMessage, details) =>
              this.sendError('workshop.invite_guest', errorMessage, details),
            widgetRecommendationRejected: (errorMessage, details) =>
              this.sendError('workshop.widget_recommendation', errorMessage, details)
          }
        });
        if (assistantTurn) {
          this.commitTimeNotice(timeNotice);
          this.session.setChatTarget({ kind: 'personaGuest', personaId });
          this.sendStatus(`${workshopPersonaLabel(personaId)} joined the room.`);
          this.sessionPersistence.markDirty('guest invitation completed');
        }
        this.postSessionState();
        await memoryAutoSave.settled();
      } catch (error) {
        const details = error instanceof Error ? error.message : String(error);
        this.session.abandonRun(requestId);
        if (error instanceof AgentRunUnavailableError) {
          // A personalized invitation is authored in a dedicated sheet and
          // has no draft-restoration channel. Keep its visible turn so the
          // writer retains the only copy after a provider refusal.
          this.sessionPersistence.markDirty('unavailable guest invitation retained');
        }
        this.sendStreamComplete(requestId, '', true);
        if (error instanceof Error && error.name === 'AbortError') {
          this.sendStatus(`${workshopPersonaLabel(personaId)} invitation cancelled`);
        } else if (error instanceof AgentRunUnavailableError) {
          this.sendError('workshop.invite_guest', error.message, error.providerDetails);
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
    // A re-invited guest is a fresh conversation and gets its own time frame.
    this.sessionTime.forgetNotices([workshopGuestConversationKey(personaId)]);
    this.outputChannel.appendLine(
      `[WorkshopRoomHandler] Guest dismissed (persona=${personaId}, conversation=${conversationId})`
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

  private resolveMessageTarget(
    target: WorkshopChatTarget,
    hostPersonaId: WorkshopPersonaId
  ): WorkshopMessageTargetPlan {
    switch (target.kind) {
      case 'host': {
        const conversationId = this.session.getHostConversationId();
        return {
          chatTarget: target,
          conversationId,
          label: workshopPersonaLabel(hostPersonaId),
          requestType: 'workshop_host',
          missingConversationMessage: undefined,
          requiresExcerpt: false,
          participantOwner: { kind: 'host' },
          publishesRoomArtifacts: true,
          createsRetainedConversation: !conversationId,
          completionReason: 'persona turn completed',
          hostUpdateDeliveryLabel: conversationId
            ? 'retained delta frame'
            : 'fresh-host initial envelope',
          collectPendingHostUpdates: () => this.session.prepareHostUpdatesForDelivery(conversationId),
          buildTodoEvidence: () =>
            buildWorkshopTodoEvidence(this.session.collectOpenTodosForHost()),
          buildHostUpdateFrame: (pendingHostUpdates) => conversationId
            ? buildWorkshopHostUpdateFrame(pendingHostUpdates)
            : undefined,
          prepareTimeNotice: () => this.sessionTime.prepareNotice('host'),
          prepareTurn: (input) => {
            const userTurn = this.session.beginPersonaMessage(
              input.requestId,
              input.displayText,
              input.attachmentRefs,
              input.widgetCommitRef,
              input.editOfferRequest
            );
            const personaBehaviorFrames: WorkshopPersonaBehaviorFrames = {
              ...behaviorFramesFor(userTurn),
              timeFrame: input.timeNotice?.frame
            };
            return {
              userTurn,
              personaBehaviorFrames,
              modelMessage: buildWorkshopHostMessage(input.text, {
                roomCatchUp: input.roomCatchUp,
                todoEvidence: input.todoEvidence,
                hostUpdate: input.hostUpdateFrame,
                threadArtifactFrames: input.threadArtifactFrames,
                reactionsFrame: input.reactionsFrame,
                reactionInviteFrame: input.editOfferRequest ? undefined : this.reactionInvite(input.requestId),
                ...(conversationId ? personaBehaviorFrames : {})
              }),
              statusMessage: input.hasConversationalCatchUp
                ? `Catching ${workshopPersonaLabel(hostPersonaId)} up on the room…`
                : `Streaming ${workshopPersonaLabel(hostPersonaId)}…`
            };
          }
        };
      }
      case 'tool':
        return {
          chatTarget: target,
          conversationId: this.session.getToolSidecarConversationId(target.toolId),
          label: workshopToolLabel(target.toolId),
          requestType: 'workshop_tool_message',
          toolId: target.toolId,
          missingConversationMessage: 'That tool conversation is no longer available.',
          requiresExcerpt: true,
          participantOwner: undefined,
          publishesRoomArtifacts: false,
          createsRetainedConversation: false,
          completionReason: 'direct tool turn completed',
          collectPendingHostUpdates: () => undefined,
          buildTodoEvidence: () => undefined,
          buildHostUpdateFrame: () => undefined,
          prepareTimeNotice: () => undefined,
          prepareTurn: (input) => ({
            userTurn: this.session.beginDirectToolMessage(
              target.toolId,
              input.requestId,
              input.displayText,
              input.attachmentRefs
            ),
            personaBehaviorFrames: {},
            modelMessage: input.threadArtifactFrames.length > 0
              ? [...input.threadArtifactFrames.flatMap((frame) => [frame, '']), input.text]
                  .join('\n')
              : input.text,
            statusMessage: `Continuing directly with ${workshopToolLabel(target.toolId)}…`
          })
        };
      case 'personaGuest':
        return {
          chatTarget: target,
          conversationId: this.session.getPersonaGuestConversationId(target.personaId),
          label: workshopPersonaLabel(target.personaId),
          requestType: 'workshop_guest_message',
          guestPersonaId: target.personaId,
          missingConversationMessage: 'That guest conversation is no longer available.',
          requiresExcerpt: false,
          participantOwner: { kind: 'personaGuest', personaId: target.personaId },
          publishesRoomArtifacts: true,
          createsRetainedConversation: false,
          completionReason: 'persona turn completed',
          collectPendingHostUpdates: () => undefined,
          buildTodoEvidence: () => undefined,
          buildHostUpdateFrame: () => undefined,
          prepareTimeNotice: () =>
            this.sessionTime.prepareNotice(workshopGuestConversationKey(target.personaId)),
          prepareTurn: (input) => {
            const userTurn = this.session.beginPersonaGuestMessage(
              target.personaId,
              input.requestId,
              input.displayText,
              input.attachmentRefs,
              input.widgetCommitRef,
              input.editOfferRequest
            );
            const personaBehaviorFrames: WorkshopPersonaBehaviorFrames = {
              ...behaviorFramesFor(userTurn),
              timeFrame: input.timeNotice?.frame
            };
            return {
              userTurn,
              personaBehaviorFrames,
              modelMessage: buildWorkshopGuestMessage(
                input.text,
                input.roomCatchUp,
                input.threadArtifactFrames,
                personaBehaviorFrames,
                input.reactionsFrame,
                input.editOfferRequest ? undefined : this.reactionInvite(input.requestId)
              ),
              statusMessage: input.hasConversationalCatchUp
                ? `Catching ${workshopPersonaLabel(target.personaId)} up on the room…`
                : `Continuing with ${workshopPersonaLabel(target.personaId)}…`
            };
          }
        };
    }
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
      /** Restore writer-owned composer text if transient rollback removes its turn. */
      restoreDraftOnRollback?: boolean;
      /**
       * Atomic widget commit (ADR 2026-07-22): a host-built one-shot artifact
       * that rides THIS send without ever entering the pending list, plus the
       * display-safe ref stamped on the visible writer turn. Only the widget
       * commit route sets this, and it never sets includeMessageAttachments —
       * the writer's staged pills belong to the message they were typing.
       */
      widgetArtifact?: WorkshopOneShotWidgetRoomArtifact;
      /**
       * Widget commits close their authoring sheet once the room owns the
       * writer turn and artifact, not after the participant finishes replying.
       */
      onRoomAccepted?: (userTurnId: string) => void;
      /** A reply edit offer's press (ADR 2026-11-10 D4, D5): see `WorkshopDirectedRun`. */
      directedRun?: WorkshopDirectedRun;
    }
  ): Promise<WorkshopDirectedRunResult> {
    const personaId = this.session.getSelectedPersonaId();
    const targetPlan = this.resolveMessageTarget(
      targetOverride ?? this.session.getChatTarget(),
      personaId
    );

    if (targetPlan.missingConversationMessage && !targetPlan.conversationId) {
      this.sendError('workshop.send_message', targetPlan.missingConversationMessage);
      return { committed: false };
    }
    // Sprint 13A §1: what a turn needs depends on the session's SCOPE, not on
    // whether an excerpt happens to be present. An open conversation is a real
    // room; direct tool sidecars still require the passage they read.
    const excerpt = this.session.getExcerpt();
    const hasExcerpt = !!excerpt && excerpt.text.trim().length > 0;
    const subjectStatus = this.session.getParticipantSubjectStatus();
    // Scope first, and independently of excerpt presence: a new session
    // deliberately CARRIES the previous room's passage across the boundary
    // (§3), so "an excerpt exists" is not evidence that the writer has chosen
    // what this room is for.
    if (!subjectStatus.ready && subjectStatus.reason === 'scope-unchosen') {
      this.sendError(
        'workshop.send_message',
        'Choose how to start this session — workshop an excerpt, or start an open conversation.'
      );
      return { committed: false };
    }
    if (!hasExcerpt) {
      if (targetPlan.requiresExcerpt) {
        this.sendError(
          'workshop.send_message',
          'Add an excerpt before continuing with a tool.'
        );
        return { committed: false };
      }
      if (!subjectStatus.ready) {
        this.sendError('workshop.send_message', 'Pin an excerpt before messaging the Workshop.');
        return { committed: false };
      }
    }

    this.preemptActiveRun();
    const roomReader = targetPlan.participantOwner;
    const writerProfile = this.conversationSettingsService.getWriterProfile();
    const roomDelivery = roomReader
      ? this.roomDelivery.prepare(roomReader, {
          writerName: workshopWriterPreferredAddress(writerProfile),
          renderedAt: Date.now()
        })
      : undefined;
    const roomCatchUp = roomDelivery?.frame;
    const hasConversationalCatchUp = roomDelivery?.hasConversationalCatchUp ?? false;
    const pendingHostUpdates = targetPlan.collectPendingHostUpdates();
    const todoEvidence = targetPlan.buildTodoEvidence();
    // A fresh host already receives the current excerpt and brief through its
    // initial envelope. Only retained conversations need a superseding delta.
    const hostUpdateFrame = targetPlan.buildHostUpdateFrame(pendingHostUpdates);
    if (pendingHostUpdates) {
      this.outputChannel.appendLine(
        `[WorkshopRoomHandler] Pending host update prepared (${describeWorkshopPendingHostUpdates(pendingHostUpdates)}; ${targetPlan.hostUpdateDeliveryLabel})`
      );
    }
    if (roomDelivery && roomDelivery.deliveredTurnIds.length > 0) {
      this.outputChannel.appendLine(
        `[WorkshopRoomHandler] Room catch-up prepared (${roomReader?.kind === 'host' ? 'host' : `guest=${roomReader?.personaId}`}): ${roomDelivery.deliveredTurnIds.length} whole turns included, ${roomDelivery.deferredTurns} deferred, characters=${roomCatchUp?.length ?? 0}, status=${hasConversationalCatchUp ? 'conversational' : 'lifecycle-only'}`
      );
    }
    const { conversationId, label, requestType, toolId, guestPersonaId } = targetPlan;
    const requestId = generateRequestId(requestType);
    const controller = new AbortController();
    // Staged one-shot thread-artifacts ride THIS message only (Phase 6B).
    const messageAttachments = executeOptions?.includeMessageAttachments
      ? this.session.collectMessageAttachments()
      : [];
    const roomThreadArtifacts: WorkshopThreadArtifactFrameInput[] =
      messageAttachments.map((attachment) => ({
        id: attachment.id,
        // A Lightbox tile's frame says what it is (Slice 4); a file's has no kind.
        ...withMessageAttachmentKind(attachment),
        name: attachment.label,
        sourcePath: attachment.relativePath,
        truncation: attachment.truncation,
        content: attachment.content
      }));
    const attachmentRefs = messageAttachments.map(
      ({ content: _content, sourceUri: _sourceUri, ...ref }) => ref
    );
    if (messageAttachments.length > 0) {
      this.outputChannel.appendLine(
        `[WorkshopRoomHandler] Message attachments riding this send: ${messageAttachments.map((a) => a.id).join(', ')}`
      );
    }
    // Widget commits share the frame builder and the ta-N mint but bypass the
    // pending list (ADR 2026-07-22): the artifact is held synchronously from
    // mint to ship inside the one commit route, so nothing can interleave.
    const widgetArtifact = executeOptions?.widgetArtifact;
    if (widgetArtifact) {
      roomThreadArtifacts.push({
        id: widgetArtifact.id,
        kind: workshopWidgetArtifactKind(widgetArtifact.widgetId),
        name: widgetArtifact.label,
        content: widgetArtifact.content
      });
      this.outputChannel.appendLine(
        `[WorkshopRoomHandler] Widget artifact riding this send: ${widgetArtifact.id} (${widgetArtifact.widgetId}, config ${widgetArtifact.widgetConfigId})`
      );
    }
    const directedRun = executeOptions?.directedRun;
    const threadArtifactFrames = [
      ...roomThreadArtifacts.map(buildWorkshopThreadArtifactFrame),
      // A press's directive rides the frames' own slot, last before the message (ADR 2026-11-10 D4).
      ...(directedRun ? [directedRun.frame] : []),
      // The edit-offer reminder rides it too, never with a press and never for a tool (second addendum).
      ...this.editOfferReminder(roomReader !== undefined, directedRun !== undefined, excerpt)
    ];
    const widgetCommitRef: WorkshopTurnWidgetCommit | undefined = widgetArtifact
      ? {
          widgetId: widgetArtifact.widgetId,
          widgetConfigId: widgetArtifact.widgetConfigId,
          rail: 'thread-artifact',
          artifactId: widgetArtifact.id,
          selectionCount: widgetArtifact.selectionCount
        }
      : undefined;
    const timeNotice = targetPlan.prepareTimeNotice();
    // Reactions since this conversation's last reply; a fresh host's is its first message (ADR 2026-11-07 D4, D6).
    const reactionPlan = roomReader
      ? prepareWorkshopReactionDelivery(
          this.session,
          roomReader,
          conversationId ? 'update' : 'start',
          workshopReactionHoldsAfterCatchUp(this.session.readRoomLedger(), roomReader, roomDelivery)
        )
      : undefined;
    this.beginSessionInteraction();
    const {
      modelMessage,
      userTurn,
      statusMessage,
      personaBehaviorFrames
    } = targetPlan.prepareTurn({
      requestId,
      text,
      displayText,
      attachmentRefs,
      widgetCommitRef,
      editOfferRequest: directedRun?.editOfferRequest,
      roomCatchUp,
      hasConversationalCatchUp,
      todoEvidence,
      hostUpdateFrame,
      threadArtifactFrames,
      timeNotice,
      reactionsFrame: reactionPlan?.frame
    });
    if (roomReader && reactionPlan) {
      stageWorkshopReactionDelivery(this.session, requestId, roomReader, reactionPlan, this.logLine);
    }
    this.activeRun = { requestId, label, toolId, guestPersonaId, controller, ...(directedRun ? { directed: true } : {}) };
    // Sprint 13C: capabilities are participant-owned. Host and persona-guest
    // turns each mint one adapter with their own principal; direct-tool
    // sidecars stay capability-free instruments. Decide "which participant is
    // this" exactly once (PR #89 review #13) so the gate, the speaking
    // persona, and the persisted principal cannot drift apart.
    const participantOwner = targetPlan.participantOwner;
    const participantCapability = participantOwner
      ? this.capabilityFactory.create({
          requestId,
          personaId: participantOwner.kind === 'personaGuest'
            ? participantOwner.personaId
            : personaId,
          owner: participantOwner,
          conversationId,
          roomDeliveredThrough: workshopRoomDeliveredThrough(roomDelivery),
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
    if (targetPlan.publishesRoomArtifacts && widgetArtifact) {
      // The visible writer turn and its artifact body are one room-ledger
      // fact. Publish them together before inference so cancellation or
      // transport failure cannot persist a hollow turn that promises content
      // the room can never recover.
      this.session.recordRoomThreadArtifacts(userTurn.id, roomThreadArtifacts);
      this.outputChannel.appendLine(
        `[WorkshopRoomHandler] Room thread artifacts published on ${userTurn.id} ` +
        `(${roomThreadArtifacts.map((artifact) => artifact.id).join(', ')})`
      );
    }
    executeOptions?.onRoomAccepted?.(userTurn.id);
    this.postTurn(userTurn);
    this.postSessionState();
    this.sendStreamStarted(requestId);
    this.sendStatus(statusMessage);

    // A directed run's reply is never shown (ADR 2026-11-10 D5): its tokens go nowhere.
    const onToken = directedRun ? () => undefined : (token: string) => this.sendStreamChunk(requestId, token);
    try {
      const result = conversationId
        ? await this.assistantToolService.continueConversation(conversationId, modelMessage, {
            signal: controller.signal,
            onToken,
            capability: participantCapability,
            webResearch: this.conversationSettingsService.getWebResearch().enabled,
            finalReply: directedRun?.finalReply
          })
        : await this.assistantToolService.startWorkshopPersonaConversation({
            personaId,
            excerpt,
            message: modelMessage,
            behavior: userTurn.behavior!,
            writerProfile,
            standingDirectiveFrames: renderWorkshopStandingDirectiveFrames(this.session),
            messageIsTrustedEnvelope: true,
            ...personaBehaviorFrames,
            contextAttachmentsFrame: buildWorkshopContextAttachmentsFrame(
              pendingHostUpdates?.contextAttachments?.attachments ?? []
            ),
            excerptSourceFrame: excerpt
              ? buildWorkshopExcerptSourceFrame(excerpt.source)
              : undefined
          }, {
            signal: controller.signal,
            onToken,
            capability: participantCapability!,
            webResearch: this.conversationSettingsService.getWebResearch().enabled,
            finalReply: directedRun?.finalReply
          });

      const pendingMemory = this.replyMemory(result.content, controller.signal);
      const replyMemory = pendingMemory && await pendingMemory;
      const fileEdits = await this.replyFileEdits(result.content, controller.signal, directedRun?.boundExcerpt);
      const memoryAutoSave = this.memoryAutoSaveFor(controller.signal);
      const assistantTurn = (directedRun?.complete ?? completeWorkshopRun)({
        memory: replyMemory,
        memoryAutoSave: memoryAutoSave.hand,
        memoryAutoSavesInRoom: memoryAutoSave.inRoom,
        fileEdits,
        reactionsOpen: this.conversationSettingsService.personaReactionsOpen(),
        session: this.session,
        requestId,
        label,
        result,
        aborted: controller.signal.aborted,
        createsRetainedConversation: targetPlan.createsRetainedConversation,
        copy: workshopMessageCompletionCopy(label),
        discardConversation: (id) => this.assistantToolService.discardConversation(id),
        readRetainedHistory: (id) => this.assistantToolService.readWorkshopRetainedHistory(id),
        // Everything this commit changes about the participant settles here,
        // before completion records its retained-history mark.
        settleCommittedRun: () => {
          if (roomDelivery) {
            try {
              this.roomDelivery.commit(roomDelivery);
              this.outputChannel.appendLine(
                `[WorkshopRoomHandler] Room delivery committed ` +
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
                `[WorkshopRoomHandler] Room delivery acknowledgement retained for retry after ` +
                `committed ${label} reply: ${error instanceof Error ? error.message : String(error)}`
              );
            }
          }
          if (pendingHostUpdates) {
            this.session.commitPendingHostUpdates(pendingHostUpdates);
            this.outputChannel.appendLine(
              `[WorkshopRoomHandler] Pending host update committed (${describeWorkshopPendingHostUpdates(pendingHostUpdates)})`
            );
          }
          if (messageAttachments.length > 0) {
            // A failed/cancelled turn never settles, which leaves the staged
            // artifacts pending — the pills survive and a retry ships the
            // same ids.
            if (targetPlan.publishesRoomArtifacts) {
              this.session.recordRoomThreadArtifacts(userTurn.id, roomThreadArtifacts);
              this.outputChannel.appendLine(
                `[WorkshopRoomHandler] Room thread artifacts published on ${userTurn.id} ` +
                `(${roomThreadArtifacts.map((artifact) => artifact.id).join(', ')})`
              );
            }
            this.session.commitMessageAttachments(
              messageAttachments.map((a) => a.id),
              targetPlan.chatTarget
            );
            this.outputChannel.appendLine(
              `[WorkshopRoomHandler] Message attachments shipped (${messageAttachments.map((a) => a.id).join(', ')})`
            );
          }
        },
        log: (line) => this.outputChannel.appendLine(`[WorkshopRoomHandler] ${line}`),
        events: {
          streamCompleted: (id, content, cancelled, usage, truncated) =>
            this.sendStreamComplete(id, content, cancelled, usage, truncated),
          turnCompleted: (turn) => this.postTurn(turn),
          status: (status) => this.sendStatus(status),
          error: (errorMessage, details) =>
            this.sendError('workshop.send_message', errorMessage, details),
          widgetRecommendationRejected: (errorMessage, details) =>
            this.sendError('workshop.widget_recommendation', errorMessage, details)
        }
      });
      if (!assistantTurn && roomDelivery) {
        this.outputChannel.appendLine(
          `[WorkshopRoomHandler] Room delivery retained after incomplete ${label} reply ` +
          `(${roomDelivery.reader.kind === 'host'
            ? 'host'
            : `guest=${roomDelivery.reader.personaId}`}; ` +
          `${roomDelivery.deliveredTurnIds.length} turns remain pending)`
        );
      }
      if (!assistantTurn && pendingHostUpdates) {
        this.outputChannel.appendLine(
          `[WorkshopRoomHandler] Pending host update retained after incomplete delivery (${describeWorkshopPendingHostUpdates(pendingHostUpdates)})`
        );
      }
      if (assistantTurn) {
        this.commitTimeNotice(timeNotice);
        this.sessionPersistence.markDirty(targetPlan.completionReason);
      }
      this.postSessionState();
      await memoryAutoSave.settled();
      return { committed: assistantTurn !== undefined };
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      if (error instanceof AgentRunUnavailableError) {
        const rolledBack = this.session.rollbackMessageRun(requestId);
        if (rolledBack) {
          this.sessionPersistence.markDirty('unavailable message rolled back');
          this.outputChannel.appendLine(
            `[WorkshopRoomHandler] Rolled back unavailable writer turn ${rolledBack.id}`
          );
          if (executeOptions?.restoreDraftOnRollback) {
            this.postComposerDraftRestored(rolledBack.content);
          }
        }
      } else if (!directedRun || !this.session.rollbackMessageRun(requestId)) {
        // A directed run's writer turn leaves with a failed run (ADR 2026-11-10 D3); any other stays visible.
        this.session.abandonRun(requestId);
      }
      if (pendingHostUpdates) {
        this.outputChannel.appendLine(
          `[WorkshopRoomHandler] Pending host update retained after failed delivery (${describeWorkshopPendingHostUpdates(pendingHostUpdates)}): ${details}`
        );
      }
      this.sendStreamComplete(requestId, '', true);
      if (error instanceof Error && error.name === 'ConversationNotFoundError') {
        // A configuration/resource rebuild invalidates the assistant
        // generation as a whole, not merely the id that happened to be used.
        const discardedConversationIds = this.session.clearAllConversations();
        this.discardConversations(discardedConversationIds);
        // Every persona starts a fresh conversation, so each gets a fresh time frame.
        this.sessionTime.forgetAllNotices();
        this.outputChannel.appendLine(
          `[WorkshopRoomHandler] Conversation generation lost (${discardedConversationIds.length} conversations discarded: ${discardedConversationIds.join(', ') || 'none'}): ${details}`
        );
        this.sessionPersistence.markDirty('expired conversation bindings cleared');
        this.sendError(
          'workshop.send_message',
          'This Workshop conversation is no longer available because settings changed. Send a new message to start the selected host again.',
          'The retained conversation could not be found. Details were recorded in the Prose Minion output channel.'
        );
      } else if (error instanceof Error && error.name === 'AbortError') {
        this.sendStatus(`${label} cancelled`);
      } else if (error instanceof AgentRunUnavailableError) {
        this.sendError('workshop.send_message', error.message, error.providerDetails);
      } else {
        this.sendError('workshop.send_message', `Failed to message ${label}`, details);
      }
      this.postSessionState();
      return {
        committed: false,
        ...(error instanceof AgentRunUnavailableError
          ? { refusalReason: error.message }
          : {}),
        ...(error instanceof Error && error.name === 'AbortError' ? { cancelled: true } : {})
      };
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
      if (!this.sliceComposition.cancelContextRun(requestId)) {
        this.outputChannel.appendLine(
          `[WorkshopRoomHandler] Cancel ignored: ${requestId} (domain=${domain})`
        );
      }
      return;
    }
    if (domain !== 'workshop') {
      this.outputChannel.appendLine(
        `[WorkshopRoomHandler] Cancel ignored: ${requestId} (domain=${domain}, active=${this.activeRun?.requestId ?? 'none'})`
      );
      return;
    }
    if (this.activeRun?.requestId === requestId) {
      this.outputChannel.appendLine(
        `[WorkshopRoomHandler] Cancel requested: ${requestId} (${this.activeRun.label})`
      );
      this.activeRun.controller.abort();
      return;
    }
    this.outputChannel.appendLine(
      `[WorkshopRoomHandler] Cancel ignored: ${requestId} (domain=${domain}, active=${this.activeRun?.requestId ?? 'none'})`
    );
  }

  private currentRunKind(): 'room' | 'wizard' | undefined {
    if (this.activeRun) {
      return 'room';
    }
    return this.sliceComposition?.isContextRunActive() ? 'wizard' : undefined;
  }

  /**
   * Save and tell me (Slice 5; PR #201 F-03): completion hands the recorded
   * reply's card to `hand`, and the run awaits `settled()` as its tail,
   * under its own controller, before it settles. So no later request ever
   * waits on a save, and New, Open, a preempting run and disposal stop it
   * as they stop any running run (its permission is withdrawn).
   */
  private memoryAutoSaveFor(signal: AbortSignal): {
    hand: (turn: WorkshopTurn, indexes: readonly number[]) => void;
    inRoom: () => number;
    settled: () => Promise<void> | undefined;
  } {
    let saving: Promise<void> | undefined;
    return {
      inRoom: () => this.sliceComposition.memoryAutoSavesInRoom(),
      hand: (turn, indexes) => {
        saving = this.sliceComposition.autoSaveMemoryProposals(turn, indexes, signal);
      },
      settled: () => saving
    };
  }

  /**
   * A reply's project-memory context, settled at completion (ADR 2026-11-04
   * D6). Only a reply holding a frame reads the listing; any other gets
   * none, so its completion costs no await.
   */
  private replyMemory(reply: string, signal: AbortSignal): Promise<WorkshopReplyMemoryContext> | undefined {
    return hasWorkshopMemoryProposalText(reply)
      ? resolveWorkshopReplyMemory(this.capabilityFactory, reply, signal,
        workshopWriterPreferredAddress(this.conversationSettingsService.getWriterProfile()))
      : undefined;
  }

  /**
   * A reply's file edits, staged before completion (ADR 2026-11-05 D4,
   * D11), and its edit offers, resolved (ADR 2026-11-10 D2): the setting is
   * read now, when the reply is read. A reply holding neither tag costs no await.
   */
  private replyFileEdits(reply: string, signal: AbortSignal, boundExcerpt?: WorkshopDirectedRun['boundExcerpt']): Promise<WorkshopReplyEditsContext | undefined> {
    return resolveWorkshopReplyEdits({
      reply,
      open: this.conversationSettingsService.fileEditsOpen(),
      staging: this.fileEditStaging,
      ...(boundExcerpt ? { boundExcerpt } : {}),
      signal
    });
  }

  private excerptMutationBlockedReason(): string | undefined {
    switch (this.currentRunKind()) {
      case 'room':
        return MID_RUN_EXCERPT_GUARD_MESSAGE;
      case 'wizard':
        return MID_WIZARD_EXCERPT_GUARD_MESSAGE;
      default:
        return undefined;
    }
  }

  private activeRunLabel(): 'Context wizard' | 'response' | undefined {
    switch (this.currentRunKind()) {
      case 'room':
        return 'response';
      case 'wizard':
        return 'Context wizard';
      default:
        return undefined;
    }
  }

  private preemptActiveRun(): void {
    if (this.activeRun) {
      this.outputChannel.appendLine(
        `[WorkshopRoomHandler] Preempting in-flight run: ${this.activeRun.requestId} (${this.activeRun.label})`
      );
      this.activeRun.controller.abort();
      if (!this.activeRun.directed || !this.session.rollbackMessageRun(this.activeRun.requestId)) {
        this.session.abandonRun(this.activeRun.requestId);
      }
      this.activeRun = undefined;
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
        `[WorkshopRoomHandler] Deferred conversation settings sync failed: ${details}`
      );
      this.sendError(
        'workshop',
        'Could not apply the deferred conversation settings from VS Code Settings.',
        details
      );
      return false;
    }
  }

  private discardConversations(conversationIds: readonly string[]): void {
    for (const conversationId of conversationIds) {
      this.assistantToolService.discardConversation(conversationId);
    }
  }

  // Message helpers (domain owns its message lifecycle)

  private postTurn(turn: WorkshopTurn): void {
    const message: WorkshopTurnMessage = {
      type: MessageType.WORKSHOP_TURN,
      source: 'extension.workshop',
      payload: { turn: workshopTurnForWebview(turn, this.editOfferRoomView()) },
      timestamp: Date.now()
    };
    void this.postMessage(message);
  }

  /** What an edit offer's view is derived from, read when a turn is posted (ADR 2026-11-10 D3, U5). */
  private editOfferRoomView(): WorkshopEditOfferRoomView {
    return {
      fileEditsOpen: this.conversationSettingsService.getFileEditsMode() === 'ask',
      runActive: this.activeRun !== undefined,
      ledger: () => this.session.readRoomLedger(),
      authorPresent: (turn) => workshopEditOfferAuthorTarget(this.session, turn) !== undefined
    };
  }

  private postComposerDraftRestored(text: string): void {
    const message: WorkshopComposerDraftRestoredMessage = {
      type: MessageType.WORKSHOP_COMPOSER_DRAFT_RESTORED,
      source: 'extension.workshop',
      payload: { text },
      timestamp: Date.now()
    };
    void this.postMessage(message);
  }

  private postSessionState(): void {
    const snapshot = this.session.getSnapshot();
    // A file-edit card's `documentUri` is host-only (ADR 2026-11-05 D4.3); an offer's status is derived here (ADR 2026-11-10 D3).
    const room = workshopEditOfferRoomViewOnce(this.editOfferRoomView());
    const session = { ...snapshot, turns: snapshot.turns.map((turn) => workshopTurnForWebview(turn, room)) };
    session.contextBudget = this.activeContextBudget();
    const availability = this.sessionPersistence.availability();
    const message: WorkshopSessionStateMessage = {
      type: MessageType.WORKSHOP_SESSION_STATE,
      source: 'extension.workshop',
      payload: {
        session,
        writerProfile: this.conversationSettingsService.getWriterProfile(),
        webResearch: this.conversationSettingsService.getWebResearch(),
        projectMemory: this.conversationSettingsService.getProjectMemoryMode(),
        fileEdits: this.conversationSettingsService.getFileEditsMode(),
        persistence: {
          available: availability.available,
          unavailableReason: availability.available ? undefined : availability.reason,
          currentCheckpointProtected: this.sessionPersistence.isCurrentCheckpointProtected(),
          currentCheckpointError: this.sessionPersistence.getCurrentCheckpointError(),
          degradedConversationKeys: this.sessionPersistence.getDegradedConversationKeys(),
          degradedConversations: this.sessionPersistence.getDegradedConversations()
        }
      },
      timestamp: Date.now()
    };
    void this.postMessage(message);
  }

  /** The chat target's manifest name and retained conversation; the id never leaves the host. */
  private chatTargetConversation(): { label: string; conversationId: string | undefined } {
    const target = this.session.getChatTarget();
    return target.kind === 'tool'
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
  }

  private activeContextBudget(): LabeledContextBudgetSnapshot {
    const target = this.session.getChatTarget();
    const { label, conversationId } = this.chatTargetConversation();
    // The Phase 7 manifest: writer-declared rows first, then this
    // conversation's agent-fetched deliveries in delivery order. Both sides
    // are display-safe; the conversation id never leaves this method.
    // Every row is projected on its way out, writer rows included, so no
    // host-private field can reach the webview however a row was stored
    // (PR #187 F-02).
    const sources = [
      ...this.session.collectWriterSources(target),
      ...this.assistantToolService.getConversationContextSources(conversationId)
    ].map(projectContextSource);
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

  private sendError(
    source: ErrorSource,
    message: string,
    details?: string,
    owner = 'WorkshopRoomHandler'
  ): void {
    const errorMessage: ErrorMessage = {
      type: MessageType.ERROR,
      source: 'extension.workshop',
      payload: { source, message, details },
      timestamp: Date.now()
    };
    void this.postMessage(errorMessage);
    this.outputChannel.appendLine(
      `[${owner}] ERROR [${source}]: ${message}${details ? ` - ${details}` : ''}`
    );
  }
}

/** The frame kind a staged attachment carries, when it has one. */
function withMessageAttachmentKind(attachment: { lightboxTile?: unknown }): { kind?: string } {
  const kind = workshopMessageAttachmentKind(attachment);
  return kind ? { kind } : {};
}
