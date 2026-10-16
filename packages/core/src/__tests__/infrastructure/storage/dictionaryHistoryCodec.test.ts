import {
  decodeDictionaryHistoryFile,
  encodeDictionaryHistoryFile,
  toDictionaryHistorySummary
} from '@/infrastructure/storage/dictionaryHistoryCodec';
import { DICTIONARY_HISTORY_CONTEXT_PREVIEW_CHARS } from '@shared/constants/dictionaryHistory';
import type { DictionaryHistoryEntry } from '@messages';

const entry = (overrides: Partial<DictionaryHistoryEntry> = {}): DictionaryHistoryEntry => ({
  id: 'dict-hist-1',
  createdAt: '2026-10-14T14:02:00.000Z',
  request: {
    word: 'petrichor',
    context: 'Rain on hot stone.',
    includeEncyclopedia: true,
    includePalettes: false,
    mode: 'standard',
    sourceUri: 'file:///novel/chapter-01.md',
    relativePath: 'chapter-01.md'
  },
  modelIds: ['anthropic/claude-sonnet-4.5'],
  toolName: 'dictionary_lookup',
  result: '# Prose Minion | Writer\'s Dictionary Lookup\n\n**petrichor**',
  ...overrides
});

const fileText = (entries: unknown[]): string => JSON.stringify({ formatVersion: 1, entries });

describe('dictionaryHistoryCodec', () => {
  it('round-trips entries newest first through formatVersion 1', () => {
    const newest = entry({ id: 'dict-hist-2', request: { ...entry().request, mode: 'fast', context: '' } });
    const withoutOptionals = entry({
      id: 'dict-hist-1',
      modelIds: [],
      request: { word: 'umbra', context: '', includeEncyclopedia: false, includePalettes: true, mode: 'standard' }
    });

    const text = encodeDictionaryHistoryFile([newest, withoutOptionals]);

    expect(JSON.parse(text)).toMatchObject({ formatVersion: 1 });
    expect(text.endsWith('\n')).toBe(true);
    expect(text).toContain('\n  "entries"'); // pretty-printed for a writer who opens the file
    const decoded = decodeDictionaryHistoryFile(text);
    expect(decoded).toStrictEqual({
      kind: 'ok',
      entries: [
        newest,
        {
          id: 'dict-hist-1',
          createdAt: withoutOptionals.createdAt,
          request: { word: 'umbra', context: '', includeEncyclopedia: false, includePalettes: true, mode: 'standard' },
          modelIds: [],
          toolName: 'dictionary_lookup',
          result: withoutOptionals.result
        }
      ],
      dropped: 0
    });
  });

  it.each([
    ['a newer format', { formatVersion: 2 }],
    ['a missing format', {}],
    ['a string format', { formatVersion: '1' }]
  ])('treats %s as invalid rather than guessing', (_label, version) => {
    const decoded = decodeDictionaryHistoryFile(JSON.stringify({ ...version, entries: [entry()] }));

    expect(decoded).toEqual({ kind: 'invalid', reason: expect.stringContaining('formatVersion') });
  });

  it.each([
    ['bad JSON', '{"formatVersion": 1, "entries": ['],
    ['a JSON array', '[]'],
    ['a missing entry list', '{"formatVersion": 1}']
  ])('treats %s as invalid', (_label, text) => {
    const decoded = decodeDictionaryHistoryFile(text);

    expect(decoded).toEqual({ kind: 'invalid', reason: expect.any(String) });
  });

  describe('invalid-file reasons are fixed phrases, because the store logs them', () => {
    const MARKER = 'SECRET_MANUSCRIPT_WORDS';

    it.each([
      ['malformed JSON around writer text', `{"formatVersion":1,"entries":[{"request":{"context":${MARKER}}}]}`],
      ['a string formatVersion', JSON.stringify({ formatVersion: MARKER, entries: [] })],
      ['an object formatVersion', JSON.stringify({ formatVersion: { note: MARKER }, entries: [] })],
      ['a fractional formatVersion', JSON.stringify({ formatVersion: 1.5, entries: [] })]
    ])('never quotes the file for %s', (_label, text) => {
      const decoded = decodeDictionaryHistoryFile(text);

      expect(decoded.kind).toBe('invalid');
      expect(JSON.stringify(decoded)).not.toContain(MARKER);
      expect(JSON.stringify(decoded)).not.toContain('SECRET');
    });

    it('names a whole-number version it does not know, and only that', () => {
      expect(decodeDictionaryHistoryFile(JSON.stringify({ formatVersion: 7, entries: [] })))
        .toEqual({ kind: 'invalid', reason: 'unknown formatVersion 7' });
      expect(decodeDictionaryHistoryFile(JSON.stringify({ entries: [] })))
        .toEqual({ kind: 'invalid', reason: 'formatVersion is missing' });
      expect(decodeDictionaryHistoryFile('{"formatVersion":1,')).toEqual({ kind: 'invalid', reason: 'the file is not valid JSON' });
    });
  });

  it('drops and counts malformed entries while their valid neighbors survive', () => {
    const valid = entry();
    const { request } = valid;
    const malformed: unknown[] = [
      'not an entry',
      { ...valid, id: '' },
      { ...valid, id: 7 },
      { ...valid, createdAt: 'yesterday' },
      { ...valid, modelIds: undefined },
      { ...valid, modelIds: 'model/A' },
      { ...valid, modelIds: [42] },
      { ...valid, modelIds: [''] },
      { ...valid, modelIds: ['model/A', 'model/A'] },
      { ...valid, toolName: undefined },
      { ...valid, result: null },
      { ...valid, request: undefined },
      { ...valid, request: { ...request, word: '   ' } },
      { ...valid, request: { ...request, context: undefined } },
      { ...valid, request: { ...request, includeEncyclopedia: 'yes' } },
      { ...valid, request: { ...request, includePalettes: undefined } },
      { ...valid, request: { ...request, mode: 'streaming' } },
      { ...valid, request: { ...request, sourceUri: 3 } },
      { ...valid, request: { ...request, relativePath: false } }
    ];
    const second = entry({ id: 'dict-hist-0' });

    const decoded = decodeDictionaryHistoryFile(fileText([valid, ...malformed, second]));

    expect(decoded).toStrictEqual({ kind: 'ok', entries: [valid, second], dropped: malformed.length });
  });

  it('keeps the newest of two entries that share an id', () => {
    const newest = entry({ result: 'newest' });

    const decoded = decodeDictionaryHistoryFile(fileText([newest, entry({ result: 'older' })]));

    expect(decoded).toStrictEqual({ kind: 'ok', entries: [newest], dropped: 1 });
  });

  it('drops fields the contract does not define', () => {
    const decoded = decodeDictionaryHistoryFile(fileText([
      { ...entry(), extra: true, request: { ...entry().request, extra: true } }
    ]));

    expect(decoded).toStrictEqual({ kind: 'ok', entries: [entry()], dropped: 0 });
  });

  describe('toDictionaryHistorySummary', () => {
    it('carries the list fields without the result body or source URI', () => {
      expect(toDictionaryHistorySummary(entry())).toStrictEqual({
        id: 'dict-hist-1',
        createdAt: '2026-10-14T14:02:00.000Z',
        word: 'petrichor',
        contextPreview: 'Rain on hot stone.',
        includeEncyclopedia: true,
        includePalettes: false,
        mode: 'standard',
        modelIds: ['anthropic/claude-sonnet-4.5'],
        relativePath: 'chapter-01.md'
      });
    });

    it('omits the model and path when the entry has none', () => {
      const summary = toDictionaryHistorySummary(entry({
        modelIds: [],
        request: { ...entry().request, sourceUri: undefined, relativePath: undefined }
      }));

      expect(summary).not.toHaveProperty('modelId');
      expect(summary).not.toHaveProperty('relativePath');
    });

    it('collapses whitespace in the context preview', () => {
      const summary = toDictionaryHistorySummary(entry({
        request: { ...entry().request, context: '  Rain\n\non   hot\tstone.  ' }
      }));

      expect(summary.contextPreview).toBe('Rain on hot stone.');
    });

    it('cuts a long context at the preview bound and marks the cut', () => {
      const context = `${'a'.repeat(DICTIONARY_HISTORY_CONTEXT_PREVIEW_CHARS)}${'b'.repeat(20)}`;

      const summary = toDictionaryHistorySummary(entry({ request: { ...entry().request, context } }));

      expect(summary.contextPreview).toBe(`${'a'.repeat(DICTIONARY_HISTORY_CONTEXT_PREVIEW_CHARS)}…`);
    });

    it('keeps a context of exactly the preview bound whole', () => {
      const context = 'c'.repeat(DICTIONARY_HISTORY_CONTEXT_PREVIEW_CHARS);

      const summary = toDictionaryHistorySummary(entry({ request: { ...entry().request, context } }));

      expect(summary.contextPreview).toBe(context);
    });

    it('does not split an emoji at the cut', () => {
      // A UTF-16 cut at the bound would keep only the emoji's high surrogate.
      const context = `${'d'.repeat(DICTIONARY_HISTORY_CONTEXT_PREVIEW_CHARS - 1)}😀😀 and more rain`;

      const summary = toDictionaryHistorySummary(entry({ request: { ...entry().request, context } }));

      expect(summary.contextPreview).toBe(`${'d'.repeat(DICTIONARY_HISTORY_CONTEXT_PREVIEW_CHARS - 1)}😀…`);
    });

    it.each([['empty', ''], ['whitespace-only', ' \n\t ']])('gives the %s context an empty preview', (_label, context) => {
      const summary = toDictionaryHistorySummary(entry({ request: { ...entry().request, context } }));

      expect(summary.contextPreview).toBe('');
    });
  });
});
