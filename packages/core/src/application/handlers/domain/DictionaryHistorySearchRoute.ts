/**
 * The Dictionary history's definitions search (ADR 2026-10-14, the 2026-11-14
 * search amendment). Owned by `DictionaryHandler`, which registers it beside
 * the other history routes; split out so the handler stays within its size.
 *
 * The popup filters words, context and file names itself, over the summaries
 * it already holds. "Also search definitions" needs the result bodies, which
 * stay on the host (D5), so that part runs here: the store reads every entry
 * it holds and the answer carries ids and a short snippet around each first
 * hit, never a body.
 *
 * Every request names a webview-minted id and the answer echoes it, so the
 * popup can take only the answer it still waits for. A request without one
 * cannot be answered and is ignored. A search that throws answers `failed`,
 * so the popup stops waiting.
 *
 * Logs carry counts only: never the query, a word, or a snippet.
 */

import type { DictionaryHistoryStore } from '@/infrastructure/storage/DictionaryHistoryStore';
import {
  DictionaryHistorySearchResultMessage,
  DictionaryHistorySearchResultPayload,
  MessageType,
  SearchDictionaryHistoryMessage
} from '@messages';
import { LogSink } from '@/platform';
import { MessageTransport } from '@handlers/MessageHandlerContracts';
import { MessageRouter } from '../MessageRouter';

const LOG = '[DictionaryHistorySearch]';
/** The longest request id echoed back; the webview's are far shorter. */
const REQUEST_ID_CHARS = 200;

export class DictionaryHistorySearchRoute {
  constructor(
    private readonly history: DictionaryHistoryStore,
    private readonly postMessage: MessageTransport,
    private readonly outputChannel: LogSink
  ) {}

  registerRoutes(router: MessageRouter): void {
    router.register(MessageType.SEARCH_DICTIONARY_HISTORY, this.handleSearch.bind(this));
  }

  async handleSearch(message: SearchDictionaryHistoryMessage): Promise<void> {
    const request = message.payload as { requestId?: unknown; query?: unknown } | undefined;
    const requestId = request?.requestId;
    if (typeof requestId !== 'string' || requestId.length === 0 || requestId.length > REQUEST_ID_CHARS) {
      this.outputChannel.appendLine(`${LOG} Ignored a search with no request id`);
      return;
    }
    if (typeof request?.query !== 'string') {
      this.outputChannel.appendLine(`${LOG} Refused a search with no query`);
      this.send({ requestId, status: 'failed' });
      return;
    }

    try {
      const found = await this.history.searchDefinitions(request.query);
      this.outputChannel.appendLine(
        `${LOG} Definitions: ${found.matches.length} of ${found.scanned} entries matched a query of ${found.queryCharacters} characters`
      );
      this.send({ requestId, status: 'found', matches: found.matches });
    } catch {
      // The error is not logged: a thrown message could quote what it was reading.
      this.outputChannel.appendLine(`${LOG} Definitions search failed`);
      this.send({ requestId, status: 'failed' });
    }
  }

  private send(payload: DictionaryHistorySearchResultPayload): void {
    const reply: DictionaryHistorySearchResultMessage = {
      type: MessageType.DICTIONARY_HISTORY_SEARCH_RESULT,
      source: 'extension.dictionary',
      payload,
      timestamp: Date.now()
    };
    void this.postMessage(reply);
  }
}
