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
 * Sprint 3 turns the thread into a conversation: a successful tool run
 * RETAINS its orchestrator conversation (system prompt = that tool's prompt)
 * and the session adopts the id; WORKSHOP_SEND_MESSAGE continues it
 * (addMessage + re-request under the hood); WORKSHOP_RESET_SESSION and
 * replacement-by-new-tool-run discard it. CANCEL_WORKSHOP_REQUEST aborts the
 * in-flight run; WORKSHOP_PICK_EXCERPT_FILE seeds the excerpt from a host
 * file picker (ShellService.pickFile) with a head-slice guardrail.
 *
 * Preemption semantics are unchanged from Sprint 2: a new run preempts any
 * in-flight one, reset aborts, and zombie completions are refused + logged.
 */

import { FileSystem, LogSink, ShellService, Workspace } from '@/platform';
import { AssistantToolService } from '@services/analysis/AssistantToolService';
import { WorkshopSessionService } from '@/application/services/WorkshopSessionService';
import { isWorkshopToolId, workshopToolLabel } from '@shared/constants/workshopTools';
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
  WorkshopRunToolMessage,
  WorkshopSendMessageMessage,
  WorkshopSetExcerptMessage,
  WorkshopSessionStateMessage,
  WorkshopToolId,
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

/** Display label for free-text follow-up runs (status ticker + log trail). */
const FOLLOW_UP_LABEL = 'Follow-up';

/**
 * Head-slice guardrail for "Pin from file…" (Sprint 3): pin at most this many
 * words of a picked file — a long chapter fits whole; a novel gets its head
 * pinned WITH a visible truncation notice, never silently.
 */
export const WORKSHOP_FILE_EXCERPT_MAX_WORDS = 10000;

const MID_RUN_EXCERPT_GUARD_MESSAGE =
  'A tool is still running. Wait for it to finish (or start a new session) before replacing the excerpt.';

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
    router.register(MessageType.WORKSHOP_SEND_MESSAGE, this.handleSendMessage.bind(this));
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
        // Sprint 3: a tool run opens the conversation follow-ups continue.
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
        this.sendStreamComplete(requestId, '', true);
      } else if (isApiKeyNotConfiguredWarning(result.content)) {
        // Config problem, not an analysis: keep the thread clean and surface
        // it through the error rail instead of appending an assistant turn.
        this.session.abandonRun(requestId);
        this.sendStreamComplete(requestId, '', true);
        this.sendError('workshop.run_tool', 'OpenRouter API key not configured.', result.content);
      } else {
        this.sendStreamComplete(requestId, result.content, false, result.usage, truncated);
        const previousConversationId = this.session.getConversationId();
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
          // The fresh conversation replaces the previous run's — one live
          // conversation per session, and the old one must not leak.
          if (
            result.conversationId &&
            previousConversationId &&
            previousConversationId !== result.conversationId
          ) {
            this.assistantToolService.discardConversation(previousConversationId);
            this.outputChannel.appendLine(
              `[WorkshopHandler] Conversation replaced: ${previousConversationId} → ${result.conversationId} (${toolLabel})`
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
  }

  /**
   * Free-text follow-up (Sprint 3's headline): append the user's message to
   * the session's retained conversation and stream the reply — a genuine
   * continuation with the prior turns in context, not a cold restart.
   */
  async handleSendMessage(message: WorkshopSendMessageMessage): Promise<void> {
    const text = typeof message.payload?.text === 'string' ? message.payload.text.trim() : '';
    if (text.length === 0) {
      this.sendError('workshop.send_message', 'Cannot send an empty message.');
      return;
    }

    const conversationId = this.session.getConversationId();
    if (!conversationId) {
      this.sendError(
        'workshop.send_message',
        'Run a tool first — follow-ups continue that tool\'s conversation.'
      );
      return;
    }

    // Same preemption contract as tool runs: the newest request owns the slot.
    this.preemptActiveRun();

    const requestId = generateRequestId('workshop_message');
    const controller = new AbortController();
    this.activeRun = { requestId, label: FOLLOW_UP_LABEL, controller };

    const userTurn = this.session.beginMessageRun(text, requestId);
    this.postTurn(userTurn);
    this.postSessionState();
    this.sendStreamStarted(requestId);
    this.sendStatus('Streaming follow-up…');

    try {
      const result = await this.assistantToolService.continueConversation(conversationId, text, {
        signal: controller.signal,
        onToken: (token: string) => {
          this.sendStreamChunk(requestId, token);
        }
      });

      const cancelled = controller.signal.aborted;
      const truncated = result.finishReason === 'length';

      if (cancelled) {
        // The orchestrator left the stored conversation untouched (user +
        // assistant messages append atomically on completion only), so the
        // next follow-up continues from the last COMPLETED exchange.
        this.outputChannel.appendLine(
          `[WorkshopHandler] Run cancelled: ${requestId} (${FOLLOW_UP_LABEL}, ${result.content.length} chars discarded)`
        );
        this.session.abandonRun(requestId);
        this.sendStreamComplete(requestId, '', true);
      } else if (isApiKeyNotConfiguredWarning(result.content)) {
        this.session.abandonRun(requestId);
        this.sendStreamComplete(requestId, '', true);
        this.sendError('workshop.send_message', 'OpenRouter API key not configured.', result.content);
      } else {
        this.sendStreamComplete(requestId, result.content, false, result.usage, truncated);
        const assistantTurn = this.session.completeRun(requestId, result.content, result.usage, truncated);
        if (assistantTurn) {
          this.postTurn(assistantTurn);
        } else {
          this.outputChannel.appendLine(
            `[WorkshopHandler] Discarded zombie completion: ${requestId} (${FOLLOW_UP_LABEL}) — session was reset or the run preempted mid-stream`
          );
        }
      }
      this.postSessionState();
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      this.session.abandonRun(requestId);
      this.sendStreamComplete(requestId, '', true);
      if (error instanceof Error && error.name === 'ConversationNotFoundError') {
        // The conversation died under us (config change rebuilt the AI
        // resources). Be honest instead of silently cold-restarting: clear
        // the stale reference so the composer disables, and say why.
        this.session.clearConversation();
        this.outputChannel.appendLine(
          `[WorkshopHandler] Conversation lost for follow-up ${requestId}: ${details}`
        );
        this.sendError(
          'workshop.send_message',
          'This conversation is no longer available (settings changed). Run a tool to start a new one.',
          details
        );
      } else if (error instanceof Error && error.name === 'AbortError') {
        this.sendStatus(`${FOLLOW_UP_LABEL} cancelled`);
      } else {
        this.sendError('workshop.send_message', 'Failed to send follow-up', details);
      }
      this.postSessionState();
    } finally {
      if (this.activeRun?.requestId === requestId) {
        this.activeRun = undefined;
      }
      if (!this.activeRun) {
        this.sendStatus('');
      }
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
      return;
    }
    if (this.activeRun?.requestId === requestId) {
      this.outputChannel.appendLine(
        `[WorkshopHandler] Cancel requested: ${requestId} (${this.activeRun.label})`
      );
      this.activeRun.controller.abort();
    }
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

    this.session.setExcerpt({ text, sourceUri, relativePath });
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

    let content: string;
    try {
      const raw = await this.fileSystem.readFile(picked.fsPath);
      content = Buffer.from(raw).toString('utf8');
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      this.sendError('workshop', `Could not read the selected file.`, details);
      return;
    }

    if (content.trim().length === 0) {
      this.sendError('workshop', 'That file is empty — nothing to pin.');
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
        `[WorkshopHandler] File excerpt head-sliced: ${trimmed.trimmedWords} of ${totalWords} words (${picked.fsPath})`
      );
    }

    const relativePath = this.workspace.asRelativePath(picked.fsPath);
    this.session.setExcerpt({ text, sourceUri: picked.uri, relativePath, truncation });
    this.outputChannel.appendLine(
      `[WorkshopHandler] Excerpt pinned from file (${text.length} chars, ${relativePath})`
    );
    this.postSessionState();
  }

  async handleResetSession(_message: WorkshopResetSessionMessage): Promise<void> {
    this.preemptActiveRun();
    const discardedConversationId = this.session.reset();
    if (discardedConversationId) {
      this.assistantToolService.discardConversation(discardedConversationId);
    }
    this.outputChannel.appendLine(
      `[WorkshopHandler] Session reset${
        discardedConversationId ? ` (conversation ${discardedConversationId} discarded)` : ''
      }`
    );
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
