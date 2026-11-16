/**
 * The Dictionary history's definitions search route (ADR 2026-10-14, the
 * 2026-11-14 search amendment): correlated answers, ids and snippets only,
 * and logs that carry counts, never the query or a word.
 */

import { DictionaryHistorySearchRoute } from '@/application/handlers/domain/DictionaryHistorySearchRoute';
import { MessageRouter } from '@/application/handlers/MessageRouter';
import { DictionaryHistoryStore } from '@/infrastructure/storage/DictionaryHistoryStore';
import { createFakeFileSystem, createFakeWorkspace } from '@/__tests__/mocks/platform';
import {
  DictionaryHistorySearchResultPayload,
  ExtensionToWebviewMessage,
  MessageType
} from '@messages';
import type { LogSink } from '@/platform';

const BODIES: Record<string, string> = {
  slithy: '# slithy\n\nLithe and slimy, as the toves were in alice-ch3.md.',
  mimsy: '# mimsy\n\nFlimsy and miserable, like the borogoves.',
  frabjous: '# frabjous\n\nFair, fabulous and joyous.'
};

describe('DictionaryHistorySearchRoute', () => {
  let router: MessageRouter;
  let postMessage: jest.Mock;
  let log: LogSink & { appendLine: jest.Mock };
  let history: DictionaryHistoryStore;

  beforeEach(async () => {
    postMessage = jest.fn().mockResolvedValue(undefined);
    log = { appendLine: jest.fn(), show: jest.fn(), clear: jest.fn() };
    let nextId = 0;
    history = new DictionaryHistoryStore(createFakeFileSystem(), createFakeWorkspace(), log, {
      createId: () => `hist-${++nextId}`
    });
    for (const [word, result] of Object.entries(BODIES)) {
      await history.record({
        request: { word, context: `Context for ${word}.`, includeEncyclopedia: false, includePalettes: false, mode: 'standard' },
        modelIds: [],
        toolName: 'dictionary_lookup',
        result
      });
    }
    log.appendLine.mockClear();
    router = new MessageRouter();
    new DictionaryHistorySearchRoute(history, postMessage, log).registerRoutes(router);
  });

  const search = (payload: unknown): Promise<void> => router.route({
    type: MessageType.SEARCH_DICTIONARY_HISTORY,
    source: 'webview.dictionary.history.search',
    payload,
    timestamp: 1
  } as never);
  const answers = (): DictionaryHistorySearchResultPayload[] =>
    postMessage.mock.calls.map(([message]) => message as ExtensionToWebviewMessage)
      .filter(message => message.type === MessageType.DICTIONARY_HISTORY_SEARCH_RESULT)
      .map(message => message.payload as DictionaryHistorySearchResultPayload);
  const logs = (): string => log.appendLine.mock.calls.flat().join('\n');

  it('registers the search route', () => {
    expect(router.hasHandler(MessageType.SEARCH_DICTIONARY_HISTORY)).toBe(true);
  });

  it('answers with the request id, matching ids and snippets, never a body', async () => {
    await search({ requestId: 'dhs-alice:1', query: 'Borogoves' });

    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage.mock.calls[0][0]).toMatchObject({
      type: MessageType.DICTIONARY_HISTORY_SEARCH_RESULT,
      source: 'extension.dictionary'
    });
    expect(answers()).toEqual([{
      requestId: 'dhs-alice:1',
      status: 'found',
      matches: [{
        id: 'hist-2',
        snippet: { before: '# mimsy Flimsy and miserable, like the ', hit: 'borogoves', after: '.' }
      }]
    }]);
    const sent = JSON.stringify(postMessage.mock.calls);
    for (const body of Object.values(BODIES)) {
      expect(sent).not.toContain(JSON.stringify(body).slice(1, -1));
    }
  });

  it('answers an empty query with no matches', async () => {
    await search({ requestId: 'dhs-alice:2', query: '   ' });
    expect(answers()).toEqual([{ requestId: 'dhs-alice:2', status: 'found', matches: [] }]);
  });

  it('logs counts, never the query, a word, a path or a snippet', async () => {
    await search({ requestId: 'dhs-alice:3', query: 'toves' });
    await search({ requestId: 'dhs-alice:4', query: 'alice-ch3.md' });

    expect(logs()).toContain('1 of 3 entries matched a query of 5 characters');
    expect(logs()).toContain('1 of 3 entries matched a query of 12 characters');
    for (const secret of ['toves', 'alice-ch3', 'slithy', 'slimy', 'Lithe']) {
      expect(logs()).not.toContain(secret);
    }
  });

  it('ignores a request it cannot answer: no request id, or one too long to echo', async () => {
    await search({ query: 'toves' });
    await search({ requestId: '', query: 'toves' });
    await search({ requestId: 'x'.repeat(201), query: 'toves' });
    await search(undefined);

    expect(postMessage).not.toHaveBeenCalled();
    expect(logs()).not.toContain('toves');
  });

  it('answers failed, once, for a request with no query', async () => {
    await search({ requestId: 'dhs-alice:5', query: 42 });
    expect(answers()).toEqual([{ requestId: 'dhs-alice:5', status: 'failed' }]);
  });

  it('answers failed when the search throws, and logs nothing the error said', async () => {
    jest.spyOn(history, 'searchDefinitions').mockRejectedValue(new Error('could not read "toves"'));

    await search({ requestId: 'dhs-alice:6', query: 'toves' });

    expect(answers()).toEqual([{ requestId: 'dhs-alice:6', status: 'failed' }]);
    expect(logs()).toContain('Definitions search failed');
    expect(logs()).not.toContain('toves');
  });
});
