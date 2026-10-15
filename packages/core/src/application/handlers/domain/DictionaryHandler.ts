/**
 * Dictionary domain handler
 * Handles dictionary lookup operations with streaming support
 *
 * SPRINT 05 REFACTOR: Now injects DictionaryService directly (facade removed)
 * SPRINT 03 (Sub-Epic 4): Added streaming + cancellation support
 * ADR 2026-10-14: Records Dictionary-tab lookups in the shared history and
 * answers the history routes. Workshop persona lookups call DictionaryService
 * directly, never through this handler, so they never enter the history.
 */

import { DictionaryService } from '@services/dictionary/DictionaryService';
import type {
  DictionaryHistoryRecordInput,
  DictionaryHistoryStore
} from '@/infrastructure/storage/DictionaryHistoryStore';
import {
  LookupDictionaryMessage,
  FastGenerateDictionaryMessage,
  StreamStartedMessage,
  CancelDictionaryRequestMessage,
  MessageType,
  ErrorSource,
  DictionaryResultMessage,
  FastGenerateDictionaryResultMessage,
  FastGenerateDictionaryResultPayload,
  StatusMessage,
  ErrorMessage,
  StreamStartedPayload,
  StreamChunkMessage,
  StreamCompleteMessage,
  resolveDictionaryEntryOptions,
  ResolvedDictionaryEntryOptions,
  DictionaryLookupMode,
  DictionaryLookupRequest,
  DictionaryHistoryMessage,
  DictionaryHistoryEntryMessage,
  DictionaryHistoryEntryPayload,
  RequestDictionaryHistoryMessage,
  RequestDictionaryHistoryEntryMessage,
  DeleteDictionaryHistoryEntryMessage,
  ClearDictionaryHistoryMessage
} from '@messages';
import { LogSink } from '@/platform';
import { MessageTransport } from '@handlers/MessageHandlerContracts';
import { MessageRouter } from '../MessageRouter';

// Generate unique request IDs
let requestIdCounter = 0;
const generateRequestId = () => `dict-${Date.now()}-${++requestIdCounter}`;

/** The tool name the Dictionary tab gives a fast result; the fast payload carries none. */
const FAST_GENERATE_TOOL_NAME = 'dictionary_fast_generate';

export class DictionaryHandler {
  // Track active abort controllers by request ID for cancellation
  private activeRequests = new Map<string, AbortController>();
  private readonly disposeHistoryListener: () => void;

  constructor(
    private readonly dictionaryService: DictionaryService,
    private readonly history: DictionaryHistoryStore,
    private readonly postMessage: MessageTransport,
    private readonly outputChannel: LogSink
  ) {
    // The store is shared by every webview; each handler pushes a fresh list
    // to its own webview after any change, whichever surface caused it.
    this.disposeHistoryListener = history.onDidChange(() => {
      void this.sendHistory();
    });
  }

  /**
   * Register message routes for dictionary domain
   */
  registerRoutes(router: MessageRouter): void {
    router.register(MessageType.LOOKUP_DICTIONARY, this.handleLookupDictionary.bind(this));
    router.register(MessageType.FAST_GENERATE_DICTIONARY, this.handleFastGenerate.bind(this));
    router.register(MessageType.CANCEL_DICTIONARY_REQUEST, this.handleCancelRequest.bind(this));
    router.register(MessageType.REQUEST_DICTIONARY_HISTORY, this.handleRequestHistory.bind(this));
    router.register(MessageType.REQUEST_DICTIONARY_HISTORY_ENTRY, this.handleRequestHistoryEntry.bind(this));
    router.register(MessageType.DELETE_DICTIONARY_HISTORY_ENTRY, this.handleDeleteHistoryEntry.bind(this));
    router.register(MessageType.CLEAR_DICTIONARY_HISTORY, this.handleClearHistory.bind(this));
  }

  /** Release this handler's history subscription; the shared store lives on. */
  dispose(): void {
    this.disposeHistoryListener();
  }

  /**
   * Handle cancel request for streaming operations
   */
  async handleCancelRequest(message: CancelDictionaryRequestMessage): Promise<void> {
    const { requestId, domain } = message.payload;

    // Only handle dictionary domain cancellations
    if (domain !== 'dictionary') return;

    const controller = this.activeRequests.get(requestId);
    if (controller) {
      controller.abort();
      this.activeRequests.delete(requestId);
      this.sendStatus('Dictionary lookup cancelled');
    }
  }

  // Helper methods (domain owns its message lifecycle)

  /**
   * Send stream started message so UI can enable cancel immediately
   */
  private sendStreamStarted(payload: StreamStartedPayload): void {
    const message: StreamStartedMessage = {
      type: MessageType.STREAM_STARTED,
      source: 'extension.dictionary',
      payload,
      timestamp: Date.now()
    };
    void this.postMessage(message);
  }

  private sendDictionaryResult(requestId: string, result: string, toolName: string, historyEntryId?: string): void {
    const message: DictionaryResultMessage = {
      type: MessageType.DICTIONARY_RESULT,
      source: 'extension.dictionary',
      payload: {
        requestId,
        result,
        toolName,
        ...(historyEntryId ? { historyEntryId } : {})
      },
      timestamp: Date.now()
    };
    void this.postMessage(message);
    this.sendStatus('');
  }

  private sendStatus(message: string, tickerMessage?: string): void {
    const statusMessage: StatusMessage = {
      type: MessageType.STATUS,
      source: 'extension.dictionary',
      payload: {
        message,
        tickerMessage
      },
      timestamp: Date.now()
    };
    void this.postMessage(statusMessage);
  }

  private sendError(source: ErrorSource, message: string, details?: string): void {
    const errorMessage: ErrorMessage = {
      type: MessageType.ERROR,
      source: 'extension.dictionary',
      payload: {
        source,
        message,
        details
      },
      timestamp: Date.now()
    };
    void this.postMessage(errorMessage);
  }

  /**
   * Send a streaming token chunk to webview
   */
  private sendStreamChunk(requestId: string, token: string): void {
    const message: StreamChunkMessage = {
      type: MessageType.STREAM_CHUNK,
      source: 'extension.dictionary',
      payload: {
        requestId,
        domain: 'dictionary',
        token
      },
      timestamp: Date.now()
    };
    void this.postMessage(message);
  }

  /**
   * Send stream complete message to webview
   */
  private sendStreamComplete(
    requestId: string,
    content: string,
    cancelled: boolean = false,
    usage?: { promptTokens: number; completionTokens: number; totalTokens: number; costUsd?: number },
    truncated: boolean = false
  ): void {
    const message: StreamCompleteMessage = {
      type: MessageType.STREAM_COMPLETE,
      source: 'extension.dictionary',
      payload: {
        requestId,
        domain: 'dictionary',
        content,
        cancelled,
        usage,
        truncated
      },
      timestamp: Date.now()
    };
    void this.postMessage(message);
    this.sendStatus('');
  }

  // Message handlers

  /**
   * Handle dictionary lookup with streaming support
   * Uses streaming API for progressive response display
   */
  async handleLookupDictionary(message: LookupDictionaryMessage): Promise<void> {
    const { word, contextText, sourceUri, relativePath } = message.payload;

    if (!word.trim()) {
      this.sendError('dictionary', 'Dictionary lookup requires a word to search');
      return;
    }

    const entryOptions = resolveDictionaryEntryOptions(message.payload);
    const requestId = generateRequestId();
    const controller = new AbortController();
    this.activeRequests.set(requestId, controller);
    this.sendStreamStarted({ requestId, domain: 'dictionary' });

    try {
      this.sendStatus(`Streaming dictionary entry for "${word}"...`);

      // Use streaming lookup
      const result = await this.dictionaryService.lookupWordStreaming(
        word,
        contextText,
        (token: string) => {
          // Send each token as a chunk
          this.sendStreamChunk(requestId, token);
        },
        controller.signal,
        entryOptions
      );

      // Record BEFORE completing the stream (Astra F-01). The webview holds the
      // lookup, and with it Run and history navigation, until the stream
      // completes, so the history write must not open a window in which a
      // newer lookup starts and then receives this one's result. Only a
      // generated entry is history; the API-key notice and `Error:` text are not.
      // signal.aborted detects cancellation (the orchestrator returns partial
      // content on abort instead of throwing).
      const historyEntryId = !controller.signal.aborted && result.outcome === 'entry'
        ? await this.recordHistory({
          request: buildHistoryRequest('standard', word, contextText, entryOptions, { sourceUri, relativePath }),
          // What the provider reported running, not a selection read before
          // or after: a hot swap can land while the prompt is still loading.
          modelIds: result.modelId ? [result.modelId] : [],
          toolName: result.toolName,
          result: result.content
        }, controller.signal)
        : undefined;

      // Read cancellation only now. The stream stays cancellable through the
      // save, and the store withdraws the entry when a cancel lands there, so
      // an acknowledged cancel completes as cancelled with nothing retained
      // (Astra F-05).
      const cancelled = controller.signal.aborted;

      // Completion and the final result go out back to back. The result names
      // its stream, so the webview applies it only to the lookup it settles.
      this.sendStreamComplete(requestId, result.content, cancelled, result.usage, result.finishReason === 'length');
      if (!cancelled) {
        this.sendDictionaryResult(requestId, result.content, result.toolName, historyEntryId);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);

      if (error instanceof Error && error.name === 'AbortError') {
        this.sendStreamComplete(requestId, '', true);
        this.sendStatus('Dictionary lookup cancelled');
      } else {
        this.sendError('dictionary', 'Failed to lookup dictionary entry', msg);
      }
    } finally {
      this.activeRequests.delete(requestId);
    }
  }

  /**
   * Handle fast (parallel) dictionary generation request
   */
  async handleFastGenerate(message: FastGenerateDictionaryMessage): Promise<void> {
    try {
      const { word, context, sourceUri, relativePath } = message.payload;

      if (!word.trim()) {
        this.sendError('dictionary', 'Fast dictionary generation requires a word');
        return;
      }

      const entryOptions = resolveDictionaryEntryOptions(message.payload);
      this.sendStatus(`🧪 Fast generating dictionary entry for "${word}"...`);

      // Generate parallel dictionary (progress sent via STATUS messages)
      const result = await this.dictionaryService.generateParallelDictionary(
        word,
        context,
        entryOptions
      );

      // At least one generated block makes an entry, partial failures and all,
      // exactly as rendered. No block means the API-key notice or total failure.
      let historyEntryId: string | undefined;
      if (result.metadata.successCount > 0) {
        historyEntryId = await this.recordHistory({
          request: buildHistoryRequest('fast', word, context, entryOptions, { sourceUri, relativePath }),
          modelIds: result.modelIds,
          toolName: FAST_GENERATE_TOOL_NAME,
          result: result.result
        });
      }

      // Send result back to webview
      this.sendFastGenerateResult(historyEntryId ? { ...result, historyEntryId } : result);
      this.sendStatus('');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.sendError('dictionary', 'Failed to generate dictionary entry', msg);
    }
  }

  /**
   * Send fast generate result to webview
   */
  private sendFastGenerateResult(result: FastGenerateDictionaryResultPayload): void {
    const message: FastGenerateDictionaryResultMessage = {
      type: MessageType.FAST_GENERATE_DICTIONARY_RESULT,
      source: 'extension.dictionary',
      payload: result,
      timestamp: Date.now()
    };
    void this.postMessage(message);
  }

  // History (ADR 2026-10-14)

  /**
   * Record a completed lookup and return its id. History must never fail a
   * lookup, so any failure is logged and the result is posted without an id.
   * With the lookup's signal, a cancel that lands during the save withdraws
   * the entry and this resolves `undefined`.
   */
  private async recordHistory(input: DictionaryHistoryRecordInput, signal?: AbortSignal): Promise<string | undefined> {
    try {
      const entry = signal ? await this.history.record(input, signal) : await this.history.record(input);
      return entry?.id;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[DictionaryHandler] Could not record ${input.request.mode} lookup in history: ${msg}`);
      return undefined;
    }
  }

  async handleRequestHistory(_message: RequestDictionaryHistoryMessage): Promise<void> {
    await this.sendHistory();
  }

  async handleRequestHistoryEntry(message: RequestDictionaryHistoryEntryMessage): Promise<void> {
    const { id } = message.payload;
    let payload: DictionaryHistoryEntryPayload;
    try {
      const entry = await this.history.get(id);
      payload = entry ? { status: 'found', entry } : { status: 'missing', id };
    } catch (error) {
      // A reply the webview can act on (it clears its pending load) beats silence.
      const msg = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[DictionaryHandler] Could not load history entry ${id}: ${msg}`);
      payload = { status: 'missing', id };
    }
    const reply: DictionaryHistoryEntryMessage = {
      type: MessageType.DICTIONARY_HISTORY_ENTRY,
      source: 'extension.dictionary',
      payload,
      timestamp: Date.now()
    };
    void this.postMessage(reply);
  }

  /** The store's change event broadcasts the new list. */
  async handleDeleteHistoryEntry(message: DeleteDictionaryHistoryEntryMessage): Promise<void> {
    await this.history.delete(message.payload.id);
  }

  /** The store's change event broadcasts the new list. */
  async handleClearHistory(_message: ClearDictionaryHistoryMessage): Promise<void> {
    await this.history.clear();
  }

  private async sendHistory(): Promise<void> {
    try {
      const snapshot = await this.history.snapshot();
      const message: DictionaryHistoryMessage = {
        type: MessageType.DICTIONARY_HISTORY,
        source: 'extension.dictionary',
        payload: snapshot,
        timestamp: Date.now()
      };
      void this.postMessage(message);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[DictionaryHandler] Could not send dictionary history: ${msg}`);
    }
  }
}

/** What the writer asked for, with options resolved and context trimmed, as history keeps it. */
function buildHistoryRequest(
  mode: DictionaryLookupMode,
  word: string,
  context: string | undefined,
  entryOptions: ResolvedDictionaryEntryOptions,
  source: { sourceUri?: string; relativePath?: string }
): DictionaryLookupRequest {
  return {
    word,
    context: context?.trim() ?? '',
    includeEncyclopedia: entryOptions.includeEncyclopedia,
    includePalettes: entryOptions.includePalettes,
    mode,
    ...(source.sourceUri ? { sourceUri: source.sourceUri } : {}),
    ...(source.relativePath ? { relativePath: source.relativePath } : {})
  };
}
