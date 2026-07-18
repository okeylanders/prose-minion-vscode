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
import {
  WorkshopContextAttachmentInput,
  WorkshopSessionService
} from '@/application/services/workshop/WorkshopSessionService';
import { RunWorkshopToolSidePass } from '@/application/services/workshop/RunWorkshopToolSidePass';
import { WorkshopPersonaCapabilityFactory } from '@/application/services/workshop/WorkshopPersonaCapability';
import {
  buildWorkshopContextAttachmentsFrame,
  buildWorkshopDirectHandoff,
  buildWorkshopGuestCatchUp,
  buildWorkshopGuestHandoff,
  buildWorkshopGuestJoinMessage,
  buildWorkshopGuestMessage,
  buildWorkshopHostMessage,
  buildWorkshopHostUpdateFrame,
  buildWorkshopTodoEvidence,
  describeWorkshopPendingHostUpdates
} from '@/application/services/workshop/WorkshopPromptBuilder';
import {
  completeWorkshopRun,
  workshopMessageCompletionCopy
} from '@/application/services/workshop/WorkshopRunCompletion';
import { isWorkshopToolId, workshopToolLabel } from '@shared/constants/workshopTools';
import { isContextPathGroup } from '@shared/types/context';
import { ContextResourceProviderFactory, DEFAULT_CONTEXT_GROUPS } from '@/domain/models/ContextGeneration';
import {
  isWorkshopPersonaId,
  workshopPersonaLabel
} from '@shared/constants/workshopPersonas';
import { workshopQuickActionPrompt } from '@shared/constants/workshopQuickActions';
import { countWords, trimToWordLimit } from '@/utils/textUtils';
import { fileURLToPath, pathToFileURL } from 'url';
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
  WorkshopExcerpt,
  WorkshopExcerptSource,
  WorkshopExcerptTruncation,
  coerceWorkshopExcerptSource,
  workshopExcerptSourcePath,
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
  WorkshopRequestContextCatalogMessage,
  WorkshopContextCatalogMessage,
  WorkshopContextCatalogEntry,
  WorkshopSearchContextResourcesMessage,
  WorkshopContextSearchResultsMessage,
  WorkshopAddContextResourcesMessage,
  WorkshopSetExcerptResourceMessage,
  WorkshopConfiguredResourceRef,
  WorkshopSetExcerptMessage,
  WorkshopTodoActionMessage,
  WorkshopSessionStateMessage,
  WorkshopToolId,
  WorkshopPersonaId,
  WorkshopChatTarget,
  LabeledContextBudgetSnapshot,
  WorkshopTurn,
  WorkshopTurnMessage
} from '@messages';
import { MessageTransport } from '@handlers/MessageHandlerContracts';
import { MessageRouter } from '../MessageRouter';

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

  constructor(
    private readonly assistantToolService: AssistantToolService,
    private readonly session: WorkshopSessionService,
    private readonly runToolSidePass: RunWorkshopToolSidePass,
    private readonly capabilityFactory: WorkshopPersonaCapabilityFactory,
    private readonly postMessage: MessageTransport,
    private readonly shell: ShellService,
    private readonly fileSystem: FileSystem,
    private readonly workspace: Workspace,
    private readonly resourceProviderFactory: ContextResourceProviderFactory,
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
  }

  /**
   * Register message routes for the workshop domain
   */
  registerRoutes(router: MessageRouter): void {
    router.register(MessageType.WORKSHOP_RUN_TOOL, this.handleRunTool.bind(this));
    router.register(MessageType.WORKSHOP_QUICK_ACTION, this.handleQuickAction.bind(this));
    router.register(MessageType.WORKSHOP_SEND_MESSAGE, this.handleSendMessage.bind(this));
    router.register(MessageType.WORKSHOP_INVITE_GUEST, this.handleInviteGuest.bind(this));
    router.register(MessageType.WORKSHOP_DISMISS_GUEST, this.handleDismissGuest.bind(this));
    router.register(MessageType.WORKSHOP_SELECT_PERSONA, this.handleSelectPersona.bind(this));
    router.register(MessageType.WORKSHOP_SET_CHAT_TARGET, this.handleSetChatTarget.bind(this));
    router.register(MessageType.WORKSHOP_SET_EXCERPT, this.handleSetExcerpt.bind(this));
    router.register(MessageType.WORKSHOP_ADD_CONTEXT_TEXT, this.handleAddContextText.bind(this));
    router.register(MessageType.WORKSHOP_ADD_CONTEXT_FILE, this.handleAddContextFile.bind(this));
    router.register(
      MessageType.WORKSHOP_REMOVE_CONTEXT_ATTACHMENT,
      this.handleRemoveContextAttachment.bind(this)
    );
    router.register(
      MessageType.WORKSHOP_REQUEST_CONTEXT_CATALOG,
      this.handleRequestContextCatalog.bind(this)
    );
    router.register(
      MessageType.WORKSHOP_SEARCH_CONTEXT_RESOURCES,
      this.handleSearchContextResources.bind(this)
    );
    router.register(
      MessageType.WORKSHOP_ADD_CONTEXT_RESOURCES,
      this.handleAddContextResources.bind(this)
    );
    router.register(
      MessageType.WORKSHOP_SET_EXCERPT_RESOURCE,
      this.handleSetExcerptResource.bind(this)
    );
    router.register(MessageType.WORKSHOP_TODO_ACTION, this.handleTodoAction.bind(this));
    router.register(MessageType.WORKSHOP_PICK_EXCERPT_FILE, this.handlePickExcerptFile.bind(this));
    router.register(MessageType.WORKSHOP_REREAD_EXCERPT, this.handleRereadExcerpt.bind(this));
    router.register(MessageType.WORKSHOP_RESET_SESSION, this.handleResetSession.bind(this));
    router.register(MessageType.WORKSHOP_REQUEST_SESSION, this.handleRequestSession.bind(this));
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
    if (this.activeRun) {
      this.outputChannel.appendLine(
        `[WorkshopHandler] Aborting in-flight run on dispose: ${this.activeRun.requestId}`
      );
      this.activeRun.controller.abort();
      this.session.abandonRun(this.activeRun.requestId);
      this.activeRun = undefined;
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
      sessionChanged: () => this.postSessionState(),
      status: (status, tickerMessage) => this.sendStatus(status, undefined, tickerMessage),
      error: (errorMessage, details) =>
        this.sendError('workshop.run_tool', errorMessage, details),
      settled: (requestId) => this.settleActiveRun(requestId)
    });
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
      this.postSessionState();
    }

    await this.executeMessage(text);
  }

  async handleSelectPersona(message: WorkshopSelectPersonaMessage): Promise<void> {
    const personaId = message.payload?.personaId;
    if (!isWorkshopPersonaId(personaId)) {
      this.sendError('workshop.select_persona', `Unknown Workshop persona: ${String(personaId)}`);
      return;
    }
    try {
      this.session.selectPersona(personaId);
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
      const join = buildWorkshopGuestJoinMessage({
        guestPersonaId: personaId,
        excerpt,
        hostTurns: this.session.collectHostThreadTurns(),
        openingMessage
      });
      const userTurn = this.session.beginPersonaGuestJoin(
        personaId,
        requestId,
        openingMessage
      );
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

      try {
        const result = await this.assistantToolService.startWorkshopGuestConversation({
          personaId,
          message: join.message
        }, {
          signal: controller.signal,
          onToken: (token: string) => this.sendStreamChunk(requestId, token)
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
          this.session.setChatTarget({ kind: 'personaGuest', personaId });
          this.sendStatus(`${workshopPersonaLabel(personaId)} joined the room.`);
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
    targetOverride?: WorkshopChatTarget
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
    const excerpt = this.session.getExcerpt();
    if (!excerpt || excerpt.text.trim().length === 0) {
      this.sendError('workshop.send_message', 'Pin an excerpt before messaging the Workshop.');
      return;
    }

    this.preemptActiveRun();
    const handoff = target.kind === 'host'
      ? buildWorkshopDirectHandoff(this.session.collectUnseenDirectExchanges())
      : undefined;
    const guestHandoff = target.kind === 'host'
      ? buildWorkshopGuestHandoff(this.session.collectUnseenGuestExchangesForHost())
      : undefined;
    const guestCatchUp = target.kind === 'personaGuest'
      ? buildWorkshopGuestCatchUp(this.session.collectUnseenHostTurnsForGuest(target.personaId))
      : undefined;
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
    if (handoff) {
      this.outputChannel.appendLine(
        `[WorkshopHandler] Direct handoff prepared: ${handoff.unseenTurns} unseen → ${handoff.includedTurns} included, ${handoff.omittedTurns} omitted, ${handoff.truncatedCharacters} chars truncated`
      );
    }
    if (guestHandoff) {
      this.outputChannel.appendLine(
        `[WorkshopHandler] Guest handoff prepared: ${guestHandoff.includedTurns} included, ${guestHandoff.omittedTurns} omitted, ${guestHandoff.truncatedCharacters} chars truncated`
      );
    }
    if (guestCatchUp && target.kind === 'personaGuest') {
      this.outputChannel.appendLine(
        `[WorkshopHandler] Guest catch-up prepared (persona=${target.personaId}): ${guestCatchUp.includedTurns} included, ${guestCatchUp.omittedTurns} omitted, ${guestCatchUp.truncatedCharacters} chars truncated`
      );
    }
    const { conversationId, label, requestType, toolId, guestPersonaId } = targetDetails;
    const requestId = generateRequestId(requestType);
    const controller = new AbortController();
    let modelMessage: string;
    let userTurn: WorkshopTurn;
    let statusMessage: string;
    switch (target.kind) {
      case 'host':
        modelMessage = buildWorkshopHostMessage(text, {
          handoff,
          guestHandoff,
          todoEvidence,
          hostUpdate: hostUpdateFrame
        });
        userTurn = this.session.beginPersonaMessage(requestId, displayText);
        statusMessage = handoff
          ? `Handing ${handoff.unseenTurns} unseen direct-tool turn${handoff.unseenTurns === 1 ? '' : 's'} back to ${label}…`
          : `Streaming ${label}…`;
        break;
      case 'tool':
        modelMessage = text;
        userTurn = this.session.beginDirectToolMessage(target.toolId, requestId, displayText);
        statusMessage = `Continuing directly with ${label}…`;
        break;
      case 'personaGuest':
        modelMessage = buildWorkshopGuestMessage(text, guestCatchUp);
        userTurn = this.session.beginPersonaGuestMessage(target.personaId, requestId, displayText);
        statusMessage = guestCatchUp
          ? `Catching ${label} up on the room…`
          : `Continuing with ${label}…`;
        break;
    }
    this.activeRun = { requestId, label, toolId, guestPersonaId, controller };
    const hostCapability = target.kind === 'host'
      ? this.capabilityFactory.create({
          requestId,
          personaId,
          excerpt,
          signal: controller.signal,
          events: {
            status: (message, tickerMessage) => this.sendStatus(message, undefined, tickerMessage),
            turnCompleted: (turn) => this.postTurn(turn),
            sessionChanged: () => this.postSessionState()
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
            capability: hostCapability
          })
        : await this.assistantToolService.startWorkshopPersonaConversation({
            personaId,
            excerpt,
            message: modelMessage,
            contextAttachmentsFrame: buildWorkshopContextAttachmentsFrame(
              this.session.getContextAttachments()
            )
          }, {
            signal: controller.signal,
            onToken: (token: string) => this.sendStreamChunk(requestId, token),
            capability: hostCapability!
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
      if (assistantTurn && target.kind === 'host' && handoff) {
        this.session.commitHostHandoff(handoff.deliveredTurnIds);
      }
      if (assistantTurn && target.kind === 'host' && guestHandoff) {
        this.session.commitHostGuestHandoff(guestHandoff.deliveredTurnIds);
      }
      if (assistantTurn && target.kind === 'personaGuest') {
        this.session.commitGuestCatchUp(target.personaId, guestCatchUp?.deliveredTurnIds ?? []);
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
    if (this.activeRun) {
      this.sendError('workshop', MID_RUN_EXCERPT_GUARD_MESSAGE);
      return;
    }

    this.replaceExcerpt({ text, source: coerceWorkshopExcerptSource(message.payload.source) });
    this.postSessionState();
  }

  async handleAddContextText(message: WorkshopAddContextTextMessage): Promise<void> {
    const text = typeof message.payload?.text === 'string' ? message.payload.text.trim() : '';
    if (text.length === 0) {
      this.sendError('workshop', 'Cannot attach empty context text.');
      return;
    }
    const words = countWords(text);
    const label = `${text.split(/\s+/).slice(0, 3).join(' ')}\u2026`;
    this.applyContextAttachment({
      kind: 'text',
      origin: 'writer',
      label,
      content: text,
      words
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
    this.postSessionState();
  }

  /** Context Selector modal (Phase 4): the configured catalog, display-safe. */
  async handleRequestContextCatalog(_message: WorkshopRequestContextCatalogMessage): Promise<void> {
    try {
      const provider = await this.resourceProviderFactory.createProvider([...DEFAULT_CONTEXT_GROUPS]);
      const entries: WorkshopContextCatalogEntry[] = provider.listResources().map((resource) => ({
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
      const provider = await this.resourceProviderFactory.createProvider([...DEFAULT_CONTEXT_GROUPS]);
      const candidates = provider.listResources();
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
        const [loaded] = await provider.loadResources([candidate.path]);
        if (!loaded) {
          continue;
        }
        bytesScanned += candidate.sizeBytes;
        if (loaded.content.toLowerCase().includes(query)) {
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

    let provider;
    try {
      provider = await this.resourceProviderFactory.createProvider([...DEFAULT_CONTEXT_GROUPS]);
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      this.sendError('workshop', 'Could not read the configured resource catalog.', details);
      return;
    }
    const summaries = provider.listResources();

    for (const item of validated) {
      const summary = summaries.find(
        (resource) => resource.group === item.group && resource.path === item.path
      );
      if (!summary) {
        this.sendError('workshop', 'That resource is no longer in the configured catalog.', item.path);
        continue;
      }
      let content: string | undefined;
      try {
        content = (await provider.loadResources([summary.path]))[0]?.content;
      } catch (error) {
        const details = error instanceof Error ? error.message : String(error);
        this.sendError('workshop', 'Could not read the selected resource.', `${item.path}: ${details}`);
        continue;
      }
      if (!content || content.trim().length === 0) {
        this.sendError('workshop', 'That resource is empty — nothing to attach.', item.path);
        continue;
      }

      let text = content;
      let words = countWords(content);
      let truncation: { keptWords: number; totalWords: number } | undefined;
      if (words > PROMPT_BUDGETS.contextAttachments.words) {
        const trimmed = trimToWordLimit(content, PROMPT_BUDGETS.contextAttachments.words);
        truncation = { keptWords: trimmed.trimmedWords, totalWords: words };
        text = trimmed.trimmed;
        words = trimmed.trimmedWords;
      }
      this.applyContextAttachment({
        kind: 'file',
        origin: 'writer',
        label: baseName(item.path),
        content: text,
        words,
        sourceUri: pathToFileURL(summary.absolutePath).toString(),
        relativePath: item.path,
        configuredResource: { group: item.group, path: item.path },
        truncation
      });
    }
  }

  /**
   * "Choose from project…" for the EXCERPT (Sprint 12): one configured
   * resource picked in the modal becomes the working excerpt, with canonical
   * provenance and an honest sourceUri so Re-read from file keeps working.
   */
  async handleSetExcerptResource(message: WorkshopSetExcerptResourceMessage): Promise<void> {
    if (this.activeRun) {
      this.sendError('workshop', MID_RUN_EXCERPT_GUARD_MESSAGE);
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

    let provider;
    try {
      provider = await this.resourceProviderFactory.createProvider([...DEFAULT_CONTEXT_GROUPS]);
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      this.sendError('workshop', 'Could not read the configured resource catalog.', details);
      return;
    }
    const summary = provider.listResources().find(
      (resource) => resource.group === item.group && resource.path === item.path
    );
    if (!summary) {
      this.sendError('workshop', 'That resource is no longer in the configured catalog.', item.path);
      return;
    }
    if (summary.sizeBytes > PROMPT_BUDGETS.fileExcerpt.bytes) {
      this.sendError(
        'workshop',
        `That file is too large to pin safely (max ${formatBytes(PROMPT_BUDGETS.fileExcerpt.bytes)}).`,
        `${item.path} is ${formatBytes(summary.sizeBytes)}`
      );
      return;
    }

    let content: string | undefined;
    try {
      content = (await provider.loadResources([summary.path]))[0]?.content;
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      this.sendError('workshop', 'Could not read the selected resource.', `${item.path}: ${details}`);
      return;
    }
    if (!content || content.trim().length === 0) {
      this.sendError('workshop', 'That resource is empty — nothing to pin.', item.path);
      return;
    }

    let text = content;
    let truncation: WorkshopExcerptTruncation | undefined;
    const totalWords = countWords(content);
    if (totalWords > PROMPT_BUDGETS.fileExcerpt.words) {
      const trimmed = trimToWordLimit(content, PROMPT_BUDGETS.fileExcerpt.words);
      text = trimmed.trimmed;
      truncation = { pinnedWords: trimmed.trimmedWords, totalWords };
    }

    if (this.activeRun) {
      this.sendError('workshop', MID_RUN_EXCERPT_GUARD_MESSAGE);
      return;
    }
    this.replaceExcerpt({
      text,
      source: {
        kind: 'file',
        sourceUri: pathToFileURL(summary.absolutePath).toString(),
        relativePath: item.path,
        configuredResource: item
      },
      truncation
    });
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
    if (this.activeRun) {
      this.sendError('workshop', MID_RUN_EXCERPT_GUARD_MESSAGE);
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
    if (this.activeRun) {
      this.sendError('workshop', MID_RUN_EXCERPT_GUARD_MESSAGE);
      return;
    }

    const displayPath = this.toDisplayPath(picked.fsPath);
    const loaded = await this.loadExcerptFromDisk(picked.fsPath, displayPath);
    if (!loaded) {
      return;
    }

    if (this.activeRun) {
      this.sendError('workshop', MID_RUN_EXCERPT_GUARD_MESSAGE);
      return;
    }

    this.replaceExcerpt({
      text: loaded.text,
      source: { kind: 'file', sourceUri: picked.uri, relativePath: displayPath },
      truncation: loaded.truncation
    });
    this.postSessionState();
  }

  /**
   * "Re-read from file" (Sprint 12): a file-backed excerpt picks up on-disk
   * edits as a normal revision. Unchanged content no-ops with a status line —
   * no version bump, no divider, no retired sidecars.
   */
  async handleRereadExcerpt(_message: WorkshopRereadExcerptMessage): Promise<void> {
    if (this.activeRun) {
      this.sendError('workshop', MID_RUN_EXCERPT_GUARD_MESSAGE);
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
    } catch {
      this.sendError('workshop', 'The excerpt’s source location is no longer readable.', source.relativePath);
      return;
    }

    const loaded = await this.loadExcerptFromDisk(fsPath, source.relativePath);
    if (!loaded) {
      return;
    }

    if (this.activeRun) {
      this.sendError('workshop', MID_RUN_EXCERPT_GUARD_MESSAGE);
      return;
    }

    if (loaded.text === excerpt.text) {
      this.outputChannel.appendLine(
        `[WorkshopHandler] Excerpt re-read: unchanged on disk (${source.relativePath})`
      );
      this.sendStatus(`Excerpt unchanged on disk · ${source.relativePath}`);
      return;
    }

    this.replaceExcerpt({ text: loaded.text, source, truncation: loaded.truncation });
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
  ): Promise<{ text: string; truncation?: WorkshopExcerptTruncation } | undefined> {
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

    return { text, truncation };
  }

  async handleResetSession(_message: WorkshopResetSessionMessage): Promise<void> {
    this.preemptActiveRun();
    const discardedConversationIds = this.session.reset();
    this.discardConversations(discardedConversationIds);
    this.outputChannel.appendLine(`[WorkshopHandler] Session reset (${discardedConversationIds.length} conversations discarded)`);
    this.postSessionState();
  }

  async handleRequestSession(_message: WorkshopRequestSessionMessage): Promise<void> {
    this.postSessionState();
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

  private settleActiveRun(requestId: string): void {
    if (this.activeRun?.requestId === requestId) {
      this.activeRun = undefined;
    }
    // Only blank the ticker when NO successor owns the slot (PR #67 #15):
    // a preempted run's late finally must not erase the new run's
    // "Streaming…" status mid-stream.
    if (!this.activeRun) {
      this.sendStatus('');
    }
  }

  private replaceExcerpt(input: {
    text: string;
    source: WorkshopExcerptSource;
    truncation?: WorkshopExcerptTruncation;
  }): void {
    const replacement = this.session.replaceExcerpt(input);
    this.discardConversations(replacement.disposedConversationIds);
    if (replacement.dividerTurn) {
      this.postTurn(replacement.dividerTurn);
    }
    this.outputChannel.appendLine(
      `[WorkshopHandler] Excerpt v${replacement.excerpt.version} pinned (${workshopExcerptSourcePath(replacement.excerpt.source) ?? 'pasted'}, ${replacement.excerpt.text.length} chars, ${replacement.retiredSidecarCount} sidecars retired)`
    );
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
    const message: WorkshopSessionStateMessage = {
      type: MessageType.WORKSHOP_SESSION_STATE,
      source: 'extension.workshop',
      payload: { session },
      timestamp: Date.now()
    };
    void this.postMessage(message);
  }

  private activeContextBudget(): LabeledContextBudgetSnapshot {
    const target = this.session.getChatTarget();
    if (target.kind === 'tool') {
      return {
        label: `${workshopToolLabel(target.toolId)} context`,
        snapshot: this.assistantToolService.getConversationContextBudget(
          this.session.getToolSidecarConversationId(target.toolId)
        )
      };
    }
    if (target.kind === 'personaGuest') {
      return {
        label: `${workshopPersonaLabel(target.personaId)} context`,
        snapshot: this.assistantToolService.getConversationContextBudget(
          this.session.getPersonaGuestConversationId(target.personaId)
        )
      };
    }
    return {
      label: `${workshopPersonaLabel(this.session.getSelectedPersonaId())} context`,
      snapshot: this.assistantToolService.getConversationContextBudget(
        this.session.getHostConversationId()
      )
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
