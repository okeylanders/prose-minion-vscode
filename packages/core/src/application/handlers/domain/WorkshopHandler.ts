/**
 * Workshop domain handler (ADR 2026-07-03, Sprint 2 — session spine).
 *
 * The 12th domain. Routes the Workshop editor tab's messages onto the
 * EXISTING analysis tools: WORKSHOP_RUN_TOOL invokes dialogue / prose / the
 * twelve WritingToolsFocus modes through AssistantToolService, streams chunks
 * under `domain: 'workshop'`, and appends the completed turn pair to the
 * shared WorkshopSessionService aggregate. Session truth lives in the
 * service (composition-root-owned, outlives this handler); the handler owns
 * only messaging, streaming, and run lifecycle.
 *
 * Sprint 2 is single-turn: each run is a fresh request — a second run
 * preempts any in-flight one rather than continuing it. The
 * ConversationManager continuation seam is Sprint 3.
 */

import { LogSink } from '@/platform';
import { AssistantToolService } from '@services/analysis/AssistantToolService';
import { WorkshopSessionService } from '@/application/services/WorkshopSessionService';
import { isWorkshopToolId, workshopToolLabel } from '@shared/constants/workshopTools';
import {
  MessageType,
  ErrorMessage,
  ErrorSource,
  StatusMessage,
  StreamStartedMessage,
  StreamChunkMessage,
  StreamCompleteMessage,
  TokenUsage,
  WorkshopExcerpt,
  WorkshopRequestSessionMessage,
  WorkshopResetSessionMessage,
  WorkshopRunToolMessage,
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

export class WorkshopHandler {
  /** The single in-flight run — Sprint 2 semantics allow at most one. */
  private activeRun?: { requestId: string; toolId: WorkshopToolId; controller: AbortController };

  private readonly disposeStatusListener: () => void;

  constructor(
    private readonly assistantToolService: AssistantToolService,
    private readonly session: WorkshopSessionService,
    private readonly postMessage: MessageTransport,
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
    router.register(MessageType.WORKSHOP_SET_EXCERPT, this.handleSetExcerpt.bind(this));
    router.register(MessageType.WORKSHOP_RESET_SESSION, this.handleResetSession.bind(this));
    router.register(MessageType.WORKSHOP_REQUEST_SESSION, this.handleRequestSession.bind(this));
  }

  /**
   * Release the shared-service subscription and abort any in-flight run.
   * The session aggregate survives (it is composition-root-owned) — only this
   * webview's run and listeners die with it.
   */
  dispose(): void {
    this.disposeStatusListener();
    if (this.activeRun) {
      this.outputChannel.appendLine(
        `[WorkshopHandler] Aborting in-flight run on dispose: ${this.activeRun.requestId}`
      );
      this.activeRun.controller.abort();
      this.session.abandonToolRun(this.activeRun.requestId);
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
    this.activeRun = { requestId, toolId, controller };

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
        }
      });

      const cancelled = controller.signal.aborted;
      const truncated = result.finishReason === 'length';

      if (cancelled) {
        // A designed disappearance still leaves a named trail (PR #67 #4):
        // this is the branch an aborted run actually resolves through — the
        // orchestrator catches AbortError internally and returns partial
        // content — so the requestId-correlated line lives HERE, not in the
        // AbortError catch below.
        this.outputChannel.appendLine(
          `[WorkshopHandler] Run cancelled: ${requestId} (${toolLabel}, ${result.content.length} chars discarded)`
        );
        this.session.abandonToolRun(requestId);
        this.sendStreamComplete(requestId, '', true);
      } else if (isApiKeyNotConfiguredWarning(result.content)) {
        // Config problem, not an analysis: keep the thread clean and surface
        // it through the error rail instead of appending an assistant turn.
        this.session.abandonToolRun(requestId);
        this.sendStreamComplete(requestId, '', true);
        this.sendError('workshop.run_tool', 'OpenRouter API key not configured.', result.content);
      } else {
        this.sendStreamComplete(requestId, result.content, false, result.usage, truncated);
        const assistantTurn = this.session.completeToolRun(
          requestId,
          result.content,
          result.usage,
          truncated
        );
        // Stale means the session was reset (or the run preempted) mid-stream;
        // the aggregate already refused the turn, so the thread stays honest.
        if (assistantTurn) {
          this.postTurn(assistantTurn);
        } else {
          this.outputChannel.appendLine(
            `[WorkshopHandler] Discarded zombie completion: ${requestId} (${toolLabel}) — session was reset or the run preempted mid-stream`
          );
        }
      }
      this.postSessionState();
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      this.session.abandonToolRun(requestId);
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
      this.sendError(
        'workshop',
        'A tool is still running. Wait for it to finish (or start a new session) before replacing the excerpt.'
      );
      return;
    }

    this.session.setExcerpt({ text, sourceUri, relativePath });
    this.outputChannel.appendLine(
      `[WorkshopHandler] Excerpt pinned (${text.length} chars${relativePath ? `, ${relativePath}` : ''})`
    );
    this.postSessionState();
  }

  async handleResetSession(_message: WorkshopResetSessionMessage): Promise<void> {
    this.preemptActiveRun();
    this.session.reset();
    this.outputChannel.appendLine('[WorkshopHandler] Session reset');
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
        `[WorkshopHandler] Preempting in-flight run: ${this.activeRun.requestId} (${workshopToolLabel(this.activeRun.toolId)})`
      );
      this.activeRun.controller.abort();
      this.session.abandonToolRun(this.activeRun.requestId);
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
