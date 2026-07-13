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
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { RunWorkshopToolSidePass } from '@/application/services/workshop/RunWorkshopToolSidePass';
import { WorkshopPersonaCapabilityFactory } from '@/application/services/workshop/WorkshopPersonaCapability';
import {
  buildWorkshopDirectHandoff,
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
import { isWorkshopPersonaId, workshopPersonaLabel } from '@shared/constants/workshopPersonas';
import { workshopQuickActionPrompt } from '@shared/constants/workshopQuickActions';
import { countWords, trimToWordLimit } from '@/utils/textUtils';
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
  WorkshopExcerptTruncation,
  WorkshopPickExcerptFileMessage,
  WorkshopRequestSessionMessage,
  WorkshopResetSessionMessage,
  WorkshopQuickActionMessage,
  WorkshopRunToolMessage,
  WorkshopSendMessageMessage,
  WorkshopSelectPersonaMessage,
  WorkshopSetChatTargetMessage,
  WorkshopSetContextBriefMessage,
  WorkshopSetExcerptMessage,
  WorkshopTodoActionMessage,
  WorkshopSessionStateMessage,
  WorkshopToolId,
  WorkshopChatTarget,
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
    router.register(MessageType.WORKSHOP_SELECT_PERSONA, this.handleSelectPersona.bind(this));
    router.register(MessageType.WORKSHOP_SET_CHAT_TARGET, this.handleSetChatTarget.bind(this));
    router.register(MessageType.WORKSHOP_SET_EXCERPT, this.handleSetExcerpt.bind(this));
    router.register(
      MessageType.WORKSHOP_SET_CONTEXT_BRIEF,
      this.handleSetContextBrief.bind(this)
    );
    router.register(MessageType.WORKSHOP_TODO_ACTION, this.handleTodoAction.bind(this));
    router.register(MessageType.WORKSHOP_PICK_EXCERPT_FILE, this.handlePickExcerptFile.bind(this));
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

  async handleSetChatTarget(message: WorkshopSetChatTargetMessage): Promise<void> {
    const target = message.payload;
    if (!target || (target.kind !== 'host' && target.kind !== 'tool')) {
      this.sendError('workshop.set_chat_target', 'Invalid Workshop chat target.');
      return;
    }
    if (target.kind === 'tool' && !isWorkshopToolId(target.toolId)) {
      this.sendError('workshop.set_chat_target', `Unknown Workshop tool: ${String(target.toolId)}`);
      return;
    }
    if (!this.session.setChatTarget(target)) {
      this.sendError('workshop.set_chat_target', 'That tool conversation is no longer available.');
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
    const conversationId = target.kind === 'host'
      ? hostConversationId
      : this.session.getToolSidecarConversationId(target.toolId);

    if (target.kind === 'tool' && !conversationId) {
      this.sendError('workshop.send_message', 'That tool conversation is no longer available.');
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
    const modelMessage = target.kind === 'host'
      ? buildWorkshopHostMessage(text, {
          handoff,
          todoEvidence,
          hostUpdate: hostUpdateFrame
        })
      : text;
    const label = target.kind === 'host'
      ? workshopPersonaLabel(personaId)
      : workshopToolLabel(target.toolId);
    const requestId = generateRequestId(target.kind === 'host' ? 'workshop_host' : 'workshop_tool_message');
    const controller = new AbortController();
    this.activeRun = { requestId, label, toolId: target.kind === 'tool' ? target.toolId : undefined, controller };

    const userTurn = target.kind === 'host'
      ? this.session.beginPersonaMessage(requestId, displayText)
      : this.session.beginDirectToolMessage(target.toolId, requestId, displayText);
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
    this.sendStatus(
      handoff
        ? `Handing ${handoff.unseenTurns} unseen direct-tool turn${handoff.unseenTurns === 1 ? '' : 's'} back to ${label}…`
        : target.kind === 'tool'
          ? `Continuing directly with ${label}…`
          : `Streaming ${label}…`
    );

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
            contextBrief: this.session.getContextBrief()
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
    const { text, sourceUri, relativePath } = message.payload;

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

    this.replaceExcerpt({ text, sourceUri, relativePath });
    this.postSessionState();
  }

  async handleSetContextBrief(message: WorkshopSetContextBriefMessage): Promise<void> {
    const rawText = message.payload?.text;
    if (rawText !== undefined && typeof rawText !== 'string') {
      this.sendError('workshop', 'Context brief must be text.');
      return;
    }
    const previousBrief = this.session.getContextBrief();
    this.session.setContextBrief(rawText);
    const pendingHostUpdates = this.session.collectPendingHostUpdates();
    this.outputChannel.appendLine(
      `[WorkshopHandler] Context brief ${rawText?.trim() ? 'updated' : 'cleared'} (${rawText?.trim().length ?? 0} chars, source=${message.source})`
    );
    if (previousBrief !== this.session.getContextBrief() && pendingHostUpdates?.contextBrief) {
      this.outputChannel.appendLine(
        `[WorkshopHandler] Pending host update queued (${describeWorkshopPendingHostUpdates(pendingHostUpdates)})`
      );
    }
    this.postSessionState();
  }

  async handleTodoAction(message: WorkshopTodoActionMessage): Promise<void> {
    const action = message.payload;
    try {
      switch (action?.action) {
        case 'add':
          if (typeof action.sourceTurnId !== 'string' || typeof action.findingKey !== 'string') {
            throw new Error('Task source must identify a turn and finding');
          }
          this.session.addTodoFromFinding(action.sourceTurnId, action.findingKey);
          break;
        case 'edit':
          if (typeof action.todoId !== 'string' || typeof action.text !== 'string') {
            throw new Error('Task edit must include an id and text');
          }
          this.session.editTodo(action.todoId, action.text);
          break;
        case 'complete':
        case 'reopen':
        case 'dismiss':
          if (typeof action.todoId !== 'string') {
            throw new Error('Task action must include an id');
          }
          this.session.setTodoStatus(
            action.todoId,
            action.action === 'complete'
              ? 'completed'
              : action.action === 'dismiss'
                ? 'dismissed'
                : 'open'
          );
          break;
        case 'reorder':
          if (
            typeof action.todoId !== 'string' ||
            (action.direction !== 'up' && action.direction !== 'down')
          ) {
            throw new Error('Task reorder must include an id and direction');
          }
          this.session.reorderTodo(action.todoId, action.direction);
          break;
        default:
          throw new Error('Unknown Workshop task action');
      }
      this.outputChannel.appendLine(
        `[WorkshopHandler] Task action applied (${action.action}, source=${message.source})`
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
    try {
      const stat = await this.fileSystem.stat(picked.fsPath);
      if (stat.type !== FileType.File) {
        this.sendError('workshop', 'The selected path is not a file.', displayPath);
        return;
      }
      if (stat.size > PROMPT_BUDGETS.fileExcerpt.bytes) {
        this.sendError(
          'workshop',
          `That file is too large to pin safely (max ${formatBytes(PROMPT_BUDGETS.fileExcerpt.bytes)}).`,
          `${displayPath} is ${formatBytes(stat.size)}`
        );
        return;
      }
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      this.sendError('workshop', `Could not inspect the selected file.`, `${displayPath}: ${details}`);
      return;
    }

    if (this.activeRun) {
      this.sendError('workshop', MID_RUN_EXCERPT_GUARD_MESSAGE);
      return;
    }

    let raw: Uint8Array;
    try {
      raw = await this.fileSystem.readFile(picked.fsPath);
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      this.sendError('workshop', `Could not read the selected file.`, `${displayPath}: ${details}`);
      return;
    }

    if (this.activeRun) {
      this.sendError('workshop', MID_RUN_EXCERPT_GUARD_MESSAGE);
      return;
    }

    let content: string;
    try {
      content = Buffer.from(raw).toString('utf8');
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      this.sendError('workshop', `Could not decode the selected file as UTF-8.`, `${displayPath}: ${details}`);
      return;
    }

    if (content.trim().length === 0) {
      this.sendError('workshop', 'That file is empty — nothing to pin.', displayPath);
      return;
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

    this.replaceExcerpt({ text, sourceUri: picked.uri, relativePath: displayPath, truncation });
    this.postSessionState();
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
    sourceUri?: string;
    relativePath?: string;
    truncation?: WorkshopExcerptTruncation;
  }): void {
    const replacement = this.session.replaceExcerpt(input);
    this.discardConversations(replacement.disposedConversationIds);
    if (replacement.dividerTurn) {
      this.postTurn(replacement.dividerTurn);
    }
    this.outputChannel.appendLine(
      `[WorkshopHandler] Excerpt v${replacement.excerpt.version} pinned (${replacement.excerpt.relativePath ?? 'pasted'}, ${replacement.excerpt.text.length} chars, ${replacement.retiredSidecarCount} sidecars retired)`
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
    const message: WorkshopSessionStateMessage = {
      type: MessageType.WORKSHOP_SESSION_STATE,
      source: 'extension.workshop',
      payload: { session: this.session.getSnapshot() },
      timestamp: Date.now()
    };
    void this.postMessage(message);
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
