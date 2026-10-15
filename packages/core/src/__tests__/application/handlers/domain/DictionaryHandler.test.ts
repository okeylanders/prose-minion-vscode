/**
 * DictionaryHandler Tests
 * Validates route registration, entry-option forwarding, and lookup history
 * recording (ADR 2026-10-14)
 */

import { DictionaryHandler } from '@/application/handlers/domain/DictionaryHandler';
import { MessageRouter } from '@/application/handlers/MessageRouter';
import { DictionaryHistoryStore } from '@/infrastructure/storage/DictionaryHistoryStore';
import { createFakeFileSystem, createFakeWorkspace } from '@/__tests__/mocks/platform';
import { MemoryFileSystem } from '@/__tests__/mocks/MemoryFileSystem';
import {
  ExtensionToWebviewMessage,
  FastGenerateDictionaryMessage,
  LookupDictionaryMessage,
  MessageType
} from '@/shared/types/messages';
import type { LogSink } from '@/platform';

const MODEL = 'anthropic/claude-sonnet-4.5';
const flushQueuedWork = (): Promise<void> => new Promise(resolve => setImmediate(resolve));

describe('DictionaryHandler', () => {
  let handler: DictionaryHandler;
  let router: MessageRouter;
  let mockService: {
    lookupWordStreaming: jest.Mock;
    generateParallelDictionary: jest.Mock;
  };
  let postMessage: jest.Mock;
  let log: LogSink & { appendLine: jest.Mock };
  let history: DictionaryHistoryStore;
  let nextHistoryId: number;

  beforeEach(() => {
    mockService = {
      lookupWordStreaming: jest.fn().mockResolvedValue({
        content: '# Entry', toolName: 'dictionary_lookup', finishReason: 'stop', outcome: 'entry', modelId: MODEL
      }),
      generateParallelDictionary: jest.fn().mockResolvedValue({
        word: 'plosive', result: '# Entry',
        metadata: { totalDuration: 10, blockDurations: {}, partialFailures: [], successCount: 15, totalBlocks: 15 },
        modelIds: [MODEL]
      })
    };
    postMessage = jest.fn().mockResolvedValue(undefined);
    log = { appendLine: jest.fn(), show: jest.fn(), clear: jest.fn() };
    nextHistoryId = 0;
    // A real store, session-only (no folder), so routes and broadcasts run end to end.
    history = new DictionaryHistoryStore(createFakeFileSystem(), createFakeWorkspace(), log, {
      createId: () => `hist-${++nextHistoryId}`,
      now: () => new Date('2026-10-14T14:02:00.000Z')
    });

    handler = new DictionaryHandler(mockService as never, history, postMessage, log);
    router = new MessageRouter();
  });

  const posted = (type: MessageType): ExtensionToWebviewMessage[] =>
    postMessage.mock.calls.map(([message]) => message as ExtensionToWebviewMessage)
      .filter((message) => message.type === type);
  const postedTypes = (): MessageType[] =>
    postMessage.mock.calls.map(([message]) => (message as ExtensionToWebviewMessage).type);

  const lookupMessage = (payload: Partial<LookupDictionaryMessage['payload']> = {}): LookupDictionaryMessage => ({
    type: MessageType.LOOKUP_DICTIONARY,
    source: 'webview.dictionary',
    payload: {
      word: 'plosive',
      contextText: '  Compare consonant textures.  ',
      includeEncyclopedia: false,
      includePalettes: true,
      sourceUri: 'file:///novel/chapter-01.md',
      relativePath: 'chapter-01.md',
      ...payload
    },
    timestamp: 1
  });

  const fastMessage = (
    payload: Partial<FastGenerateDictionaryMessage['payload']> = {}
  ): FastGenerateDictionaryMessage => ({
    type: MessageType.FAST_GENERATE_DICTIONARY,
    source: 'webview.dictionary',
    payload: {
      word: 'plosive',
      context: 'Compare consonant textures.',
      sourceUri: 'file:///novel/chapter-01.md',
      relativePath: 'chapter-01.md',
      ...payload
    },
    timestamp: 1
  });

  describe('Route Registration', () => {
    it('should register LOOKUP_DICTIONARY route', () => {
      handler.registerRoutes(router);
      expect(router.hasHandler(MessageType.LOOKUP_DICTIONARY)).toBe(true);
    });

    it('should register at least 1 route', () => {
      handler.registerRoutes(router);
      expect(router.handlerCount).toBeGreaterThanOrEqual(1);
    });

    it('registers the four history routes', () => {
      handler.registerRoutes(router);

      for (const type of [
        MessageType.REQUEST_DICTIONARY_HISTORY,
        MessageType.REQUEST_DICTIONARY_HISTORY_ENTRY,
        MessageType.DELETE_DICTIONARY_HISTORY_ENTRY,
        MessageType.CLEAR_DICTIONARY_HISTORY
      ]) {
        expect(router.hasHandler(type)).toBe(true);
      }
    });
  });

  // A payload's entry options are forwarded as one resolved object:
  // encyclopedia is opt-out (absent = on), palettes are opt-in (absent = off).
  const entryOptionCases = [
    { includeEncyclopedia: true, includePalettes: true, expected: { includeEncyclopedia: true, includePalettes: true } },
    { includeEncyclopedia: false, includePalettes: false, expected: { includeEncyclopedia: false, includePalettes: false } },
    { includeEncyclopedia: false, includePalettes: true, expected: { includeEncyclopedia: false, includePalettes: true } },
    { includeEncyclopedia: undefined, includePalettes: undefined, expected: { includeEncyclopedia: true, includePalettes: false } }
  ];

  it.each(entryOptionCases)(
    'forwards encyclopedia=$includeEncyclopedia palettes=$includePalettes to streaming lookup',
    async ({ includeEncyclopedia, includePalettes, expected }) => {
      await handler.handleLookupDictionary({
        type: MessageType.LOOKUP_DICTIONARY,
        source: 'webview.dictionary',
        payload: { word: 'plosive', contextText: 'Compare consonant textures.', includeEncyclopedia, includePalettes },
        timestamp: 1
      });

      expect(mockService.lookupWordStreaming).toHaveBeenCalledWith(
        'plosive',
        'Compare consonant textures.',
        expect.any(Function),
        expect.any(AbortSignal),
        expected
      );
      // Strict: no word, context, or other payload field rides along with the options.
      expect(mockService.lookupWordStreaming.mock.calls[0][4]).toStrictEqual(expected);
    }
  );

  it.each(entryOptionCases)(
    'forwards encyclopedia=$includeEncyclopedia palettes=$includePalettes to Fast Generate',
    async ({ includeEncyclopedia, includePalettes, expected }) => {
      await handler.handleFastGenerate({
        type: MessageType.FAST_GENERATE_DICTIONARY,
        source: 'webview.dictionary',
        payload: {
          word: 'plosive',
          context: 'Compare consonant textures.',
          sourceUri: 'file:///chapter.md',
          includeEncyclopedia,
          includePalettes
        },
        timestamp: 1
      });

      expect(mockService.generateParallelDictionary).toHaveBeenCalledWith(
        'plosive',
        'Compare consonant textures.',
        expected
      );
      expect(mockService.generateParallelDictionary.mock.calls[0][2]).toStrictEqual(expected);
    }
  );

  describe('history recording', () => {
    it('records a completed standard lookup once and tags the result with its entry', async () => {
      const record = jest.spyOn(history, 'record');

      await handler.handleLookupDictionary(lookupMessage());

      expect(record).toHaveBeenCalledTimes(1);
      expect(record).toHaveBeenCalledWith({
        request: {
          word: 'plosive',
          context: 'Compare consonant textures.',
          includeEncyclopedia: false,
          includePalettes: true,
          mode: 'standard',
          sourceUri: 'file:///novel/chapter-01.md',
          relativePath: 'chapter-01.md'
        },
        modelIds: [MODEL],
        toolName: 'dictionary_lookup',
        result: '# Entry'
      }, expect.any(AbortSignal));
      const requestId = (posted(MessageType.STREAM_STARTED)[0] as { payload: { requestId: string } }).payload.requestId;
      expect(posted(MessageType.DICTIONARY_RESULT)).toEqual([
        expect.objectContaining({
          source: 'extension.dictionary',
          payload: { requestId, result: '# Entry', toolName: 'dictionary_lookup', historyEntryId: 'hist-1' }
        })
      ]);
      // The stream still completes before the result is posted.
      expect(postedTypes().indexOf(MessageType.STREAM_COMPLETE))
        .toBeLessThan(postedTypes().indexOf(MessageType.DICTIONARY_RESULT));
    });

    // Astra F-01: completion releases the webview's lock on Run and history
    // navigation, so it must not go out while the history write is pending.
    it('completes the stream only after the history write, then posts the result right behind it', async () => {
      let finishWrite!: () => void;
      const record = history.record.bind(history);
      jest.spyOn(history, 'record').mockImplementation(async (input) => {
        await new Promise<void>(resolve => { finishWrite = resolve; });
        return record(input);
      });

      const lookup = handler.handleLookupDictionary(lookupMessage());
      await flushQueuedWork();

      expect(postedTypes()).toContain(MessageType.STREAM_STARTED);
      expect(postedTypes()).not.toContain(MessageType.STREAM_COMPLETE);
      expect(postedTypes()).not.toContain(MessageType.DICTIONARY_RESULT);

      finishWrite();
      await lookup;

      const types = postedTypes();
      const complete = types.indexOf(MessageType.STREAM_COMPLETE);
      const result = types.indexOf(MessageType.DICTIONARY_RESULT);
      expect(complete).toBeGreaterThan(-1);
      // Nothing but a status reset sits between completion and the result.
      expect(types.slice(complete + 1, result).every(type => type === MessageType.STATUS)).toBe(true);
      expect(posted(MessageType.DICTIONARY_RESULT)[0].payload).toMatchObject({ historyEntryId: 'hist-1' });
    });

    // Astra F-05: the stream stays cancellable through the history save, so a
    // cancel the host acknowledges there must win: no success, no entry.
    it('honors a cancel accepted during the history save: cancelled completion, no result, nothing retained', async () => {
      const fileSystem = new MemoryFileSystem();
      const projectHistory = new DictionaryHistoryStore(
        fileSystem,
        createFakeWorkspace({ workspaceFolders: () => [{ path: '/novel', name: 'novel' }] }),
        log,
        { createId: () => 'hist-cancelled', now: () => new Date('2026-10-14T14:02:00.000Z') }
      );
      handler.dispose();
      handler = new DictionaryHandler(mockService as never, projectHistory, postMessage, log);
      let releaseWrite!: () => void;
      const gate = new Promise<void>(resolve => { releaseWrite = resolve; });
      const writeFile = fileSystem.writeFile.bind(fileSystem);
      const write = jest.spyOn(fileSystem, 'writeFile').mockImplementationOnce(async (filePath, data) => {
        await gate;
        return writeFile(filePath, data);
      });

      const lookup = handler.handleLookupDictionary(lookupMessage());
      await flushQueuedWork();
      expect(write).toHaveBeenCalledTimes(1); // the save is in flight
      const { requestId } = (posted(MessageType.STREAM_STARTED)[0] as { payload: { requestId: string } }).payload;

      await handler.handleCancelRequest({
        type: MessageType.CANCEL_DICTIONARY_REQUEST,
        source: 'webview.dictionary',
        payload: { requestId, domain: 'dictionary' },
        timestamp: 2
      });
      expect(posted(MessageType.STATUS).map((message) => (message.payload as { message: string }).message))
        .toContain('Dictionary lookup cancelled');

      releaseWrite();
      await lookup;
      await flushQueuedWork();

      expect(posted(MessageType.STREAM_COMPLETE)).toEqual([
        expect.objectContaining({ payload: expect.objectContaining({ requestId, cancelled: true }) })
      ]);
      expect(posted(MessageType.DICTIONARY_RESULT)).toEqual([]);
      expect(posted(MessageType.DICTIONARY_HISTORY)).toEqual([]);
      expect((await projectHistory.snapshot()).entries).toEqual([]);
      expect(fileSystem.json('/novel/prose-minion/history/dictionary.json')).toMatchObject({ entries: [] });
    });

    it('names the stream a result settles, recorded or not', async () => {
      mockService.lookupWordStreaming.mockResolvedValue({
        content: 'Error: Provider unavailable', toolName: 'dictionary_lookup', outcome: 'failed'
      });

      await handler.handleLookupDictionary(lookupMessage());

      const started = posted(MessageType.STREAM_STARTED)[0] as { payload: { requestId: string } };
      expect(posted(MessageType.DICTIONARY_RESULT)[0].payload).toMatchObject({ requestId: started.payload.requestId });
    });

    it('records resolved defaults and an empty context when the payload omits them', async () => {
      const record = jest.spyOn(history, 'record');

      await handler.handleLookupDictionary(lookupMessage({
        contextText: undefined,
        includeEncyclopedia: undefined,
        includePalettes: undefined,
        sourceUri: undefined,
        relativePath: undefined
      }));

      expect(record.mock.calls[0][0].request).toStrictEqual({
        word: 'plosive',
        context: '',
        includeEncyclopedia: true,
        includePalettes: false,
        mode: 'standard'
      });
    });

    // Astra F-03: a selection read at any point can disagree with what ran,
    // because a hot swap can land while the prompt is still loading. History
    // records the provider-reported model the service returns. The swap
    // itself is exercised end to end in DictionaryService.test.ts.
    it('records the model the run reports', async () => {
      mockService.lookupWordStreaming.mockResolvedValue({
        content: '# generated by model/B', toolName: 'dictionary_lookup', outcome: 'entry', modelId: 'model/B'
      });

      await handler.handleLookupDictionary(lookupMessage());

      expect((await history.get('hist-1'))?.modelIds).toEqual(['model/B']);
    });

    it('records no model when the provider reported none, rather than guessing', async () => {
      mockService.lookupWordStreaming.mockResolvedValue({
        content: '# Entry', toolName: 'dictionary_lookup', outcome: 'entry'
      });

      await handler.handleLookupDictionary(lookupMessage());

      expect((await history.get('hist-1'))?.modelIds).toEqual([]);
    });

    it('records every model a fast lookup\'s blocks reported', async () => {
      mockService.generateParallelDictionary.mockResolvedValue({
        word: 'plosive', result: '# Entry',
        metadata: { totalDuration: 10, blockDurations: {}, partialFailures: [], successCount: 15, totalBlocks: 15 },
        modelIds: ['model/A', 'model/B']
      });

      await handler.handleFastGenerate(fastMessage());

      expect((await history.get('hist-1'))?.modelIds).toEqual(['model/A', 'model/B']);
    });

    it('does not record a cancelled lookup', async () => {
      const record = jest.spyOn(history, 'record');
      mockService.lookupWordStreaming.mockImplementation(async () => {
        const started = posted(MessageType.STREAM_STARTED)[0] as { payload: { requestId: string } };
        await handler.handleCancelRequest({
          type: MessageType.CANCEL_DICTIONARY_REQUEST,
          source: 'webview.dictionary',
          payload: { requestId: started.payload.requestId, domain: 'dictionary' },
          timestamp: 2
        });
        return { content: '# Partial', toolName: 'dictionary_lookup', outcome: 'entry' };
      });

      await handler.handleLookupDictionary(lookupMessage());

      expect(record).not.toHaveBeenCalled();
      expect(posted(MessageType.DICTIONARY_RESULT)).toEqual([]);
    });

    it.each([
      ['unconfigured', '## API key not configured'],
      ['failed', 'Error: Provider unavailable']
    ])('does not record a lookup whose outcome is %s, and posts its result without an entry', async (outcome, content) => {
      const record = jest.spyOn(history, 'record');
      mockService.lookupWordStreaming.mockResolvedValue({ content, toolName: 'dictionary_lookup', outcome });

      await handler.handleLookupDictionary(lookupMessage());

      expect(record).not.toHaveBeenCalled();
      expect(posted(MessageType.DICTIONARY_RESULT)).toEqual([
        expect.objectContaining({ payload: { requestId: expect.any(String), result: content, toolName: 'dictionary_lookup' } })
      ]);
    });

    it('records a fast lookup with at least one generated block', async () => {
      const record = jest.spyOn(history, 'record');
      mockService.generateParallelDictionary.mockResolvedValue({
        word: 'plosive', result: '# Partial entry',
        metadata: { totalDuration: 10, blockDurations: {}, partialFailures: ['definition'], successCount: 14, totalBlocks: 15 },
        modelIds: [MODEL]
      });

      await handler.handleFastGenerate(fastMessage());

      expect(record).toHaveBeenCalledWith({
        request: {
          word: 'plosive',
          context: 'Compare consonant textures.',
          includeEncyclopedia: true,
          includePalettes: false,
          mode: 'fast',
          sourceUri: 'file:///novel/chapter-01.md',
          relativePath: 'chapter-01.md'
        },
        modelIds: [MODEL],
        toolName: 'dictionary_fast_generate',
        result: '# Partial entry'
      });
      expect(posted(MessageType.FAST_GENERATE_DICTIONARY_RESULT)).toEqual([
        expect.objectContaining({ payload: expect.objectContaining({ result: '# Partial entry', historyEntryId: 'hist-1' }) })
      ]);
    });

    it('does not record a fast lookup with no generated block', async () => {
      const record = jest.spyOn(history, 'record');
      mockService.generateParallelDictionary.mockResolvedValue({
        word: 'plosive', result: '## API key not configured',
        metadata: { totalDuration: 0, blockDurations: {}, partialFailures: [], successCount: 0, totalBlocks: 0 }
      });

      await handler.handleFastGenerate(fastMessage());

      expect(record).not.toHaveBeenCalled();
      const [result] = posted(MessageType.FAST_GENERATE_DICTIONARY_RESULT);
      expect(result.payload).not.toHaveProperty('historyEntryId');
    });

    it('does not record a fast lookup that throws', async () => {
      const record = jest.spyOn(history, 'record');
      mockService.generateParallelDictionary.mockRejectedValue(new Error('Generation cancelled'));

      await handler.handleFastGenerate(fastMessage());

      expect(record).not.toHaveBeenCalled();
      expect(posted(MessageType.ERROR)).toHaveLength(1);
    });

    it.each([
      ['standard', MessageType.DICTIONARY_RESULT, () => handler.handleLookupDictionary(lookupMessage())],
      ['fast', MessageType.FAST_GENERATE_DICTIONARY_RESULT, () => handler.handleFastGenerate(fastMessage())]
    ] as const)('still posts a %s result, without an entry, when recording throws', async (mode, resultType, run) => {
      jest.spyOn(history, 'record').mockRejectedValue(new Error('disk full'));

      await run();

      const results = posted(resultType);
      expect(results).toHaveLength(1);
      expect(results[0].payload).toMatchObject({ result: '# Entry' });
      expect(results[0].payload).not.toHaveProperty('historyEntryId');
      expect(posted(MessageType.ERROR)).toEqual([]);
      expect(log.appendLine).toHaveBeenCalledWith(
        `[DictionaryHandler] Could not record ${mode} lookup in history: disk full`
      );
    });
  });

  describe('history routes', () => {
    beforeEach(() => {
      handler.registerRoutes(router);
    });

    const route = (type: MessageType, payload: object) => router.route({
      type, source: 'webview.dictionary', payload, timestamp: 3
    } as never);

    it('answers a history request with the summaries, durability, and limit', async () => {
      await handler.handleLookupDictionary(lookupMessage());
      await flushQueuedWork();
      postMessage.mockClear();

      await route(MessageType.REQUEST_DICTIONARY_HISTORY, {});

      expect(posted(MessageType.DICTIONARY_HISTORY)).toEqual([{
        type: MessageType.DICTIONARY_HISTORY,
        source: 'extension.dictionary',
        payload: {
          entries: [{
            id: 'hist-1',
            createdAt: '2026-10-14T14:02:00.000Z',
            word: 'plosive',
            contextPreview: 'Compare consonant textures.',
            includeEncyclopedia: false,
            includePalettes: true,
            mode: 'standard',
            modelIds: [MODEL],
            relativePath: 'chapter-01.md'
          }],
          durability: { kind: 'session', reason: 'no-workspace' },
          limit: 50
        },
        timestamp: expect.any(Number)
      }]);
    });

    it('answers an entry request with the full entry, or missing', async () => {
      await handler.handleLookupDictionary(lookupMessage());
      postMessage.mockClear();

      await route(MessageType.REQUEST_DICTIONARY_HISTORY_ENTRY, { id: 'hist-1' });
      await route(MessageType.REQUEST_DICTIONARY_HISTORY_ENTRY, { id: 'gone' });

      expect(posted(MessageType.DICTIONARY_HISTORY_ENTRY).map((message) => message.payload)).toEqual([
        { status: 'found', entry: await history.get('hist-1') },
        { status: 'missing', id: 'gone' }
      ]);
    });

    it('answers missing when the entry cannot be loaded', async () => {
      jest.spyOn(history, 'get').mockRejectedValue(new Error('store unavailable'));

      await route(MessageType.REQUEST_DICTIONARY_HISTORY_ENTRY, { id: 'hist-1' });

      expect(posted(MessageType.DICTIONARY_HISTORY_ENTRY).map((message) => message.payload)).toEqual([
        { status: 'missing', id: 'hist-1' }
      ]);
    });

    it('deletes and clears through the store, which broadcasts the new list', async () => {
      await handler.handleLookupDictionary(lookupMessage({ word: 'alpha' }));
      await handler.handleLookupDictionary(lookupMessage({ word: 'beta' }));
      await flushQueuedWork();
      postMessage.mockClear();

      await route(MessageType.DELETE_DICTIONARY_HISTORY_ENTRY, { id: 'hist-1' });
      await flushQueuedWork();

      const afterDelete = posted(MessageType.DICTIONARY_HISTORY);
      expect(afterDelete).toHaveLength(1);
      expect((afterDelete[0].payload as { entries: Array<{ word: string }> }).entries.map((entry) => entry.word))
        .toEqual(['beta']);

      postMessage.mockClear();
      await route(MessageType.CLEAR_DICTIONARY_HISTORY, {});
      await flushQueuedWork();

      expect(posted(MessageType.DICTIONARY_HISTORY).map((message) => message.payload))
        .toEqual([expect.objectContaining({ entries: [] })]);
    });
  });

  it('posts a fresh list when the shared store changes, and stops after dispose', async () => {
    // Another surface's handler records into the same store.
    await history.record({
      request: { word: 'alpha', context: '', includeEncyclopedia: true, includePalettes: false, mode: 'standard' },
      modelIds: [],
      toolName: 'dictionary_lookup',
      result: '# alpha'
    });
    await flushQueuedWork();

    expect(posted(MessageType.DICTIONARY_HISTORY).map((message) => message.payload))
      .toEqual([expect.objectContaining({ entries: [expect.objectContaining({ id: 'hist-1' })] })]);

    handler.dispose();
    postMessage.mockClear();
    await history.clear();
    await flushQueuedWork();

    expect(posted(MessageType.DICTIONARY_HISTORY)).toEqual([]);
  });
});
