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
 * Sprint 05 makes the thread persona-hosted: WORKSHOP_SEND_MESSAGE starts or
 * continues the selected host unless the session names a live tool sidecar as
 * its explicit direct target. A pre-host tool run remains directly followable;
 * once a host conversation begins, new tool runs are guarded until Sprint 06
 * can perform a safe report-to-host side-pass. CANCEL_WORKSHOP_REQUEST aborts
 * the in-flight run; WORKSHOP_PICK_EXCERPT_FILE seeds the excerpt through the
 * ShellService port with a head-slice guardrail.
 *
 * Preemption semantics are unchanged from Sprint 2: a new run preempts any
 * in-flight one, reset aborts, and zombie completions are refused + logged.
 */

import { FileSystem, FileType, LogSink, ShellService, Workspace } from '@/platform';
import { AssistantToolService } from '@services/analysis/AssistantToolService';
import { WorkshopSessionService } from '@/application/services/WorkshopSessionService';
import { isWorkshopToolId, workshopToolLabel } from '@shared/constants/workshopTools';
import { isWorkshopPersonaId, workshopPersonaLabel } from '@shared/constants/workshopPersonas';
import { workshopQuickActionPrompt } from '@shared/constants/workshopQuickActions';
import { countWords, trimToWordLimit } from '@/utils/textUtils';
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
  WorkshopSetExcerptMessage,
  WorkshopSessionStateMessage,
  WorkshopToolId,
  WorkshopChatTarget,
  WorkshopTurn,
  WorkshopTurnMessage,
  isApiKeyNotConfiguredWarning
} from '@messages';
import { AnalysisResult } from '@/domain/models/AnalysisResult';
import { AnalysisStreamingOptions } from '@services/analysis/AssistantToolService';
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
export const WORKSHOP_FILE_EXCERPT_MAX_WORDS = 10000;
export const WORKSHOP_FILE_EXCERPT_MAX_BYTES = 5 * 1024 * 1024;

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

    // Sprint 05 deliberately keeps a host prompt immutable. Tool side-passes
    // and host synthesis arrive together in Sprint 06; until then a crafted
    // message must not replace or contaminate an active host conversation.
    if (this.session.hasHostConversation()) {
      this.sendError(
        'workshop.run_tool',
        'Integrated tool runs arrive in Sprint 06. Start a new session to run a tool before persona chat.'
      );
      return;
    }

    // A new run preempts any in-flight one: fresh turn, never continuation.
    this.preemptActiveRun();

    const toolLabel = workshopToolLabel(toolId);
    const requestId = generateRequestId(`workshop_${toolId}`);
    const controller = new AbortController();
    this.activeRun = { requestId, label: toolLabel, toolId, controller };

    const userTurn = this.session.beginToolRun(toolId, requestId);
    this.postTurn(userTurn);
    // Snapshot after the user turn: keeps the replay cache fresh so a webview
    // that reloads mid-run rehydrates the attempt (and its active tool).
    this.postSessionState();
    this.sendStreamStarted(requestId);
    this.sendStatus(`Streaming ${toolLabel}…`);

    try {
      const result = await this.invokeTool(toolId, excerpt, {
        signal: controller.signal,
        onToken: (token: string) => {
          this.sendStreamChunk(requestId, token);
        },
        // Sprint 05: a pre-host tool run becomes a retained sidecar that
        // direct-mode follow-ups can continue without changing any host prompt.
        retainConversation: true
      });

      const cancelled = controller.signal.aborted;
      const truncated = result.finishReason === 'length';

      if (cancelled) {
        // A designed disappearance still leaves a named trail (PR #67 #4):
        // this is the branch an aborted run actually resolves through — the
        // orchestrator catches AbortError internally and returns partial
        // content — so the requestId-correlated line lives HERE, not in the
        // AbortError catch below. (An aborted run never retains its
        // conversation — the orchestrator deletes it before returning.)
        this.outputChannel.appendLine(
          `[WorkshopHandler] Run cancelled: ${requestId} (${toolLabel}, ${result.content.length} chars discarded)`
        );
        this.session.abandonRun(requestId);
        if (result.conversationId) {
          this.assistantToolService.discardConversation(result.conversationId);
        }
        this.sendStreamComplete(requestId, '', true);
      } else if (isApiKeyNotConfiguredWarning(result.content)) {
        // Config problem, not an analysis: keep the thread clean and surface
        // it through the error rail instead of appending an assistant turn.
        this.session.abandonRun(requestId);
        this.sendStreamComplete(requestId, '', true);
        this.sendError('workshop.run_tool', 'OpenRouter API key not configured.', result.content);
      } else {
        this.sendStreamComplete(requestId, result.content, false, result.usage, truncated);
        const previousConversationId = this.session.getToolSidecarConversationId(toolId);
        const assistantTurn = this.session.completeRun(
          requestId,
          result.content,
          result.usage,
          truncated,
          result.conversationId
        );
        // Stale means the session was reset (or the run preempted) mid-stream;
        // the aggregate already refused the turn, so the thread stays honest.
        if (assistantTurn) {
          this.postTurn(assistantTurn);
          // The latest run replaces only its matching tool sidecar; a direct
          // follow-up to another tool remains valid and private to the host.
          if (
            result.conversationId &&
            previousConversationId &&
            previousConversationId !== result.conversationId
          ) {
            this.assistantToolService.discardConversation(previousConversationId);
            this.outputChannel.appendLine(
              `[WorkshopHandler] Tool sidecar replaced: ${previousConversationId} → ${result.conversationId} (${toolLabel})`
            );
          }
        } else {
          // A refused zombie turn must not orphan its retained conversation.
          if (result.conversationId) {
            this.assistantToolService.discardConversation(result.conversationId);
          }
          this.outputChannel.appendLine(
            `[WorkshopHandler] Discarded zombie completion: ${requestId} (${toolLabel}) — session was reset or the run preempted mid-stream`
          );
        }
      }
      this.postSessionState();
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      this.session.abandonRun(requestId);
      // Always complete the stream so the webview's streaming affordance
      // unsticks; the ERROR message carries the diagnostics.
      this.sendStreamComplete(requestId, '', true);
      if (error instanceof Error && error.name === 'AbortError') {
        this.sendStatus(`${toolLabel} cancelled`);
      } else {
        this.sendError('workshop.run_tool', `Failed to run ${toolLabel}`, details);
      }
      this.postSessionState();
    } finally {
      this.settleActiveRun(requestId);
    }
  }

  /** The one composer message: host start/continuation or explicit direct tool. */
  async handleSendMessage(message: WorkshopSendMessageMessage): Promise<void> {
    const text = typeof message.payload?.text === 'string' ? message.payload.text.trim() : '';
    if (text.length === 0) {
      this.sendError('workshop.send_message', 'Cannot send an empty message.');
      return;
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
    const { toolId, label } = message.payload;

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

    if (!this.session.setChatTarget({ kind: 'tool', toolId })) {
      this.sendError('workshop.quick_action', 'That tool conversation is no longer available.');
      return;
    }
    await this.executeMessage(prompt, actionLabel);
  }

  /** Route the one composer action to the stable host or explicit tool target. */
  private async executeMessage(text: string, displayText = text): Promise<void> {
    const target = this.session.getChatTarget();
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
    const label = target.kind === 'host'
      ? workshopPersonaLabel(personaId)
      : workshopToolLabel(target.toolId);
    const requestId = generateRequestId(target.kind === 'host' ? 'workshop_host' : 'workshop_tool_message');
    const controller = new AbortController();
    this.activeRun = { requestId, label, toolId: target.kind === 'tool' ? target.toolId : undefined, controller };

    const userTurn = target.kind === 'host'
      ? this.session.beginPersonaMessage(text, requestId, displayText)
      : this.session.beginDirectToolMessage(target.toolId, text, requestId, displayText);
    this.postTurn(userTurn);
    this.postSessionState();
    this.sendStreamStarted(requestId);
    this.sendStatus(`Streaming ${label}…`);

    try {
      const result = conversationId
        ? await this.assistantToolService.continueConversation(conversationId, text, {
            signal: controller.signal,
            onToken: (token: string) => this.sendStreamChunk(requestId, token)
          })
        : await this.assistantToolService.startWorkshopPersonaConversation({
            personaId,
            excerpt,
            message: text,
            contextBrief: this.session.getContextBrief()
          }, {
            signal: controller.signal,
            onToken: (token: string) => this.sendStreamChunk(requestId, token)
          });

      const truncated = result.finishReason === 'length';
      if (controller.signal.aborted) {
        this.outputChannel.appendLine(
          `[WorkshopHandler] Run cancelled: ${requestId} (${label}, ${result.content.length} chars discarded)`
        );
        this.session.abandonRun(requestId);
        if (result.conversationId) {
          this.assistantToolService.discardConversation(result.conversationId);
        }
        this.sendStreamComplete(requestId, '', true);
      } else if (isApiKeyNotConfiguredWarning(result.content)) {
        this.session.abandonRun(requestId);
        this.sendStreamComplete(requestId, '', true);
        this.sendError('workshop.send_message', 'OpenRouter API key not configured.', result.content);
      } else {
        this.sendStreamComplete(requestId, result.content, false, result.usage, truncated);
        const assistantTurn = this.session.completeRun(
          requestId,
          result.content,
          result.usage,
          truncated,
          result.conversationId
        );
        if (assistantTurn) {
          this.postTurn(assistantTurn);
        } else if (result.conversationId) {
          this.assistantToolService.discardConversation(result.conversationId);
          this.outputChannel.appendLine(
            `[WorkshopHandler] Discarded zombie completion: ${requestId} (${label})`
          );
        }
      }
      this.postSessionState();
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      this.session.abandonRun(requestId);
      this.sendStreamComplete(requestId, '', true);
      if (error instanceof Error && error.name === 'ConversationNotFoundError') {
        // A configuration/resource rebuild invalidates the assistant
        // generation as a whole, not merely the id that happened to be used.
        this.discardConversations(this.session.clearAllConversations());
        this.outputChannel.appendLine(`[WorkshopHandler] Conversation generation lost: ${details}`);
        this.sendError(
          'workshop.send_message',
          'This Workshop conversation is no longer available because settings changed. Send a new message to start the selected host again.',
          details
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
    // captured the OLD excerpt, and turns carry no excerpt provenance yet —
    // a swap here would leave the finished turn silently describing text
    // that's no longer pinned. The rail disables its buttons on isRunning,
    // but that flag only lands after a message round-trip; this closes the
    // race window at the source of truth.
    if (this.activeRun) {
      this.sendError('workshop', MID_RUN_EXCERPT_GUARD_MESSAGE);
      return;
    }

    this.replaceExcerpt({ text, sourceUri, relativePath });
    this.outputChannel.appendLine(
      `[WorkshopHandler] Excerpt pinned (${text.length} chars${relativePath ? `, ${relativePath}` : ''})`
    );
    this.postSessionState();
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
      if (stat.size > WORKSHOP_FILE_EXCERPT_MAX_BYTES) {
        this.sendError(
          'workshop',
          `That file is too large to pin safely (max ${formatBytes(WORKSHOP_FILE_EXCERPT_MAX_BYTES)}).`,
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
    if (totalWords > WORKSHOP_FILE_EXCERPT_MAX_WORDS) {
      const trimmed = trimToWordLimit(content, WORKSHOP_FILE_EXCERPT_MAX_WORDS);
      text = trimmed.trimmed;
      truncation = { pinnedWords: trimmed.trimmedWords, totalWords };
      this.outputChannel.appendLine(
        `[WorkshopHandler] File excerpt head-sliced: ${trimmed.trimmedWords} of ${totalWords} words (${displayPath})`
      );
    }

    this.replaceExcerpt({ text, sourceUri: picked.uri, relativePath: displayPath, truncation });
    this.outputChannel.appendLine(
      `[WorkshopHandler] Excerpt pinned from file (${text.length} chars, ${displayPath})`
    );
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

  // Tool routing — maps the catalog ids onto the three existing service calls.

  private invokeTool(
    toolId: WorkshopToolId,
    excerpt: WorkshopExcerpt,
    streamingOptions: AnalysisStreamingOptions
  ): Promise<AnalysisResult> {
    if (toolId === 'dialogue') {
      return this.assistantToolService.analyzeDialogue(
        excerpt.text,
        undefined,
        excerpt.sourceUri,
        undefined,
        streamingOptions
      );
    }
    if (toolId === 'prose') {
      return this.assistantToolService.analyzeProse(
        excerpt.text,
        undefined,
        excerpt.sourceUri,
        streamingOptions
      );
    }
    return this.assistantToolService.analyzeWritingTools(
      excerpt.text,
      undefined,
      excerpt.sourceUri,
      toolId,
      streamingOptions
    );
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
    const discardedConversationIds = this.session.replaceExcerpt(input);
    this.discardConversations(discardedConversationIds);
    if (discardedConversationIds.length > 0) {
      this.outputChannel.appendLine(
        `[WorkshopHandler] ${discardedConversationIds.length} conversations discarded after excerpt replacement`
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
