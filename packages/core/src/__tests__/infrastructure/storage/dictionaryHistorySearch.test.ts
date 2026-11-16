import type { DictionaryHistoryEntry } from '@messages';
import { searchDictionaryHistoryDefinitions } from '@/infrastructure/storage/dictionaryHistorySearch';
import { DictionaryHistoryStore } from '@/infrastructure/storage/DictionaryHistoryStore';
import {
  DICTIONARY_HISTORY_LIMIT,
  DICTIONARY_HISTORY_SEARCH_QUERY_CHARS,
  DICTIONARY_HISTORY_SEARCH_SNIPPET_AFTER_CHARS,
  DICTIONARY_HISTORY_SEARCH_SNIPPET_BEFORE_CHARS
} from '@shared/constants/dictionaryHistory';
import { createFakeFileSystem, createFakeWorkspace } from '@/__tests__/mocks/platform';
import type { LogSink } from '@/platform';

const entry = (id: string, word: string, result: string): DictionaryHistoryEntry => ({
  id,
  createdAt: '2026-11-14T10:00:00.000Z',
  request: { word, context: '', includeEncyclopedia: false, includePalettes: false, mode: 'standard' },
  modelIds: [],
  toolName: 'dictionary_lookup',
  result
});

/* Newest first, as the store holds them. Made-up Alice words. */
const ENTRIES: DictionaryHistoryEntry[] = [
  entry('h3', 'slithy', '# slithy\n\n**Definition:** lithe and slimy, as the toves were.\n\nSee also: *mimsy*.'),
  entry('h2', 'mimsy', '# mimsy\n\nFlimsy and miserable; said of the borogoves at the Café Royal.'),
  entry('h1', 'frabjous', '# frabjous\n\nFair, fabulous and joyous.')
];

describe('searchDictionaryHistoryDefinitions', () => {
  it('returns the ids of the entries whose result holds the query, newest first', () => {
    const found = searchDictionaryHistoryDefinitions(ENTRIES, 'mimsy');
    expect(found.matches.map(match => match.id)).toEqual(['h3', 'h2']);
    expect(found.scanned).toBe(3);
  });

  it('answers with a snippet around the first hit and never a body', () => {
    const found = searchDictionaryHistoryDefinitions(ENTRIES, 'slimy');
    expect(found.matches).toEqual([{
      id: 'h3',
      snippet: { before: '# slithy **Definition:** lithe and ', hit: 'slimy', after: ', as the toves were. See also: *mimsy*.' }
    }]);
    expect(JSON.stringify(found)).not.toContain(ENTRIES[0].result);
    expect(Object.keys(found.matches[0])).toEqual(['id', 'snippet']);
  });

  it('ignores case and accents, as the popup filter does', () => {
    expect(searchDictionaryHistoryDefinitions(ENTRIES, 'CAFE royal').matches).toEqual([{
      id: 'h2',
      snippet: { before: '…miserable; said of the borogoves at the ', hit: 'Café Royal', after: '.' }
    }]);
  });

  it('matches a phrase across a line break', () => {
    const found = searchDictionaryHistoryDefinitions(
      [entry('h1', 'tove', 'a kind of badger\nwith corkscrew noses')],
      'badger with'
    );
    expect(found.matches[0].snippet).toEqual({ before: 'a kind of ', hit: 'badger with', after: ' corkscrew noses' });
  });

  it('bounds every part of a snippet', () => {
    const body = `${'a '.repeat(500)}JABBERWOCK${' b'.repeat(500)}`;
    const { snippet } = searchDictionaryHistoryDefinitions([entry('h1', 'jabberwock', body)], 'jabberwock').matches[0];
    expect(snippet.hit).toBe('JABBERWOCK');
    expect(snippet.before.startsWith('…')).toBe(true);
    expect(snippet.after.endsWith('…')).toBe(true);
    expect(snippet.before.length).toBeLessThanOrEqual(DICTIONARY_HISTORY_SEARCH_SNIPPET_BEFORE_CHARS + 1);
    expect(snippet.after.length).toBeLessThanOrEqual(DICTIONARY_HISTORY_SEARCH_SNIPPET_AFTER_CHARS + 1);
  });

  it('bounds a hit whose accents are written as a long run of marks', () => {
    const body = `e${'́'.repeat(1_000)} tove`;
    const { snippet } = searchDictionaryHistoryDefinitions([entry('h1', 'tove', body)], 'e tove').matches[0];
    expect(snippet.hit.length).toBeLessThanOrEqual(DICTIONARY_HISTORY_SEARCH_QUERY_CHARS * 2);
  });

  it('never cuts a snippet through a surrogate pair', () => {
    const body = `${'𝒜'.repeat(30)} tove ${'𝒜'.repeat(60)}`;
    const { snippet } = searchDictionaryHistoryDefinitions([entry('h1', 'tove', body)], 'tove').matches[0];
    const loneSurrogate = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/;
    expect(loneSurrogate.test(snippet.before)).toBe(false);
    expect(loneSurrogate.test(snippet.after)).toBe(false);
  });

  it('matches nothing for an empty query, and reads nothing', () => {
    expect(searchDictionaryHistoryDefinitions(ENTRIES, '')).toEqual({ queryCharacters: 0, scanned: 0, matches: [] });
    expect(searchDictionaryHistoryDefinitions(ENTRIES, ' \n\t ')).toEqual({ queryCharacters: 0, scanned: 0, matches: [] });
  });

  it('clips an over-long query to its bound rather than refusing it', () => {
    const bound = DICTIONARY_HISTORY_SEARCH_QUERY_CHARS;
    const entries = [
      entry('h2', 'long', 'x'.repeat(bound)),
      entry('h1', 'short', 'x'.repeat(bound - 1))
    ];
    const found = searchDictionaryHistoryDefinitions(entries, 'x'.repeat(bound * 3));
    expect(found.queryCharacters).toBe(bound);
    expect(found.matches.map(match => match.id)).toEqual(['h2']);
  });

  it('treats pattern characters as plain text', () => {
    const entries = [entry('h1', 'tove', 'gyre (and gimble)+ in the wabe')];
    expect(searchDictionaryHistoryDefinitions(entries, '(and gimble)+').matches).toHaveLength(1);
    expect(searchDictionaryHistoryDefinitions(entries, '.*').matches).toEqual([]);
  });

  it('reads every entry up to the cap', () => {
    const entries = Array.from({ length: DICTIONARY_HISTORY_LIMIT }, (_, index) =>
      entry(`h${index}`, 'tove', index === DICTIONARY_HISTORY_LIMIT - 1 ? 'the oldest bandersnatch' : 'nothing here'));
    const found = searchDictionaryHistoryDefinitions(entries, 'bandersnatch');
    expect(found.scanned).toBe(DICTIONARY_HISTORY_LIMIT);
    expect(found.matches.map(match => match.id)).toEqual([`h${DICTIONARY_HISTORY_LIMIT - 1}`]);
  });
});

describe('DictionaryHistoryStore.searchDefinitions', () => {
  it('searches the entries the store holds and logs nothing of the query', async () => {
    const log: LogSink & { appendLine: jest.Mock } = { appendLine: jest.fn(), show: jest.fn(), clear: jest.fn() };
    let nextId = 0;
    const store = new DictionaryHistoryStore(createFakeFileSystem(), createFakeWorkspace(), log, {
      createId: () => `hist-${++nextId}`
    });
    for (const { request, result } of [...ENTRIES].reverse()) {
      await store.record({ request, modelIds: [], toolName: 'dictionary_lookup', result });
    }

    const found = await store.searchDefinitions('BOROGOVES');

    expect(found.matches.map(match => match.id)).toEqual(['hist-2']);
    expect(found.scanned).toBe(3);
    expect(log.appendLine.mock.calls.flat().join('\n').toLowerCase()).not.toContain('borogoves');
  });
});
