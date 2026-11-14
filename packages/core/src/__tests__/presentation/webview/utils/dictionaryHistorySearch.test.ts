import type { DictionaryHistorySearchSnippet, DictionaryHistorySummary } from '@messages';
import { DICTIONARY_HISTORY_SEARCH_QUERY_CHARS } from '@shared/constants/dictionaryHistory';
import {
  describeDictionaryHistoryMatches,
  dictionaryHistorySearchQuery,
  dictionaryHistoryWordMatches,
  searchDictionaryHistory
} from '@utils/dictionaryHistorySearch';
import { dictionaryPhraseKey, findPriorDictionaryLookups } from '@utils/dictionaryHistoryNavigation';

const summary = (id: string, word: string, overrides: Partial<DictionaryHistorySummary> = {}): DictionaryHistorySummary => ({
  id,
  createdAt: '2026-11-14T10:00:00.000Z',
  word,
  contextPreview: '',
  includeEncyclopedia: false,
  includePalettes: false,
  mode: 'standard',
  modelIds: [],
  ...overrides
});

/* Newest first. Made-up Alice words and paths. */
const ENTRIES: DictionaryHistorySummary[] = [
  summary('h5', 'Slithy', { contextPreview: 'The toves were slithy that afternoon.', relativePath: 'chapters/alice-ch3.md' }),
  summary('h4', 'mimsy', { contextPreview: 'All mimsy were the borogoves.', relativePath: 'chapters/alice-ch1.md' }),
  summary('h3', 'café au lait', { contextPreview: 'She ordered at the Looking-Glass.' }),
  summary('h2', 'frabjous day', { relativePath: 'notes/Wonderland Café.md' }),
  summary('h1', 'slithy')
];

const ids = (typed: string, definitions?: ReadonlyMap<string, DictionaryHistorySearchSnippet>): string[] =>
  searchDictionaryHistory(ENTRIES, typed, definitions).rows.map(row => row.entry.id);

const markedIn = (text: string, ranges: readonly { start: number; end: number }[]): string[] =>
  ranges.map(({ start, end }) => text.slice(start, end));

describe('searchDictionaryHistory', () => {
  it('shows every entry, unmarked, with no query', () => {
    const view = searchDictionaryHistory(ENTRIES, '   ');
    expect(view.active).toBe(false);
    expect(view.total).toBe(5);
    expect(view.rows.map(row => row.entry.id)).toEqual(['h5', 'h4', 'h3', 'h2', 'h1']);
    expect(view.rows.every(row => row.word.length + row.context.length + row.file.length === 0 && !row.snippet)).toBe(true);
  });

  it('filters by word, keeping the order', () => {
    expect(ids('frabjous')).toEqual(['h2']);
    expect(ids('slithy')).toEqual(['h5', 'h1']);
  });

  it('filters by context', () => {
    expect(ids('borogoves')).toEqual(['h4']);
    expect(ids('looking-glass')).toEqual(['h3']);
  });

  it('filters by file name and path', () => {
    expect(ids('alice-ch1')).toEqual(['h4']);
    expect(ids('chapters/')).toEqual(['h5', 'h4']);
    expect(ids('.md')).toEqual(['h5', 'h4', 'h2']);
  });

  it('ignores case and accents in all three', () => {
    expect(ids('SLITHY')).toEqual(['h5', 'h1']);
    expect(ids('cafe')).toEqual(['h3', 'h2']);
    expect(ids('CAFÉ')).toEqual(['h3', 'h2']);
    expect(ids('BOROGOVES')).toEqual(['h4']);
    expect(ids('wonderland cafe')).toEqual(['h2']);
  });

  it('matches a part of a word and collapses the query’s whitespace', () => {
    expect(ids('lith')).toEqual(['h5', 'h1']);
    expect(ids('  frabjous \t day ')).toEqual(['h2']);
  });

  it('treats pattern characters as plain text', () => {
    expect(ids('.*')).toEqual([]);
    expect(ids('(slithy)')).toEqual([]);
  });

  it('counts what matches against the whole history', () => {
    const view = searchDictionaryHistory(ENTRIES, 'cafe');
    expect(view.active).toBe(true);
    expect(describeDictionaryHistoryMatches(view.rows.length, view.total)).toBe('2 of 5 match');
    expect(describeDictionaryHistoryMatches(1, 500)).toBe('1 of 500 matches');
    expect(describeDictionaryHistoryMatches(0, 5)).toBe('0 of 5 match');
  });

  it('marks where the query stands in the word, the context and the file', () => {
    const [row] = searchDictionaryHistory(ENTRIES, 'slithy').rows;
    expect(markedIn(row.entry.word, row.word)).toEqual(['Slithy']);
    expect(markedIn(row.entry.contextPreview, row.context)).toEqual(['slithy']);
    expect(row.file).toEqual([]);

    const cafe = searchDictionaryHistory(ENTRIES, 'cafe').rows;
    expect(markedIn(cafe[0].entry.word, cafe[0].word)).toEqual(['café']);
    expect(markedIn(cafe[1].entry.relativePath ?? '', cafe[1].file)).toEqual(['Café']);
  });

  it('adds the rows the host found only in their definitions, with its snippet', () => {
    const snippet: DictionaryHistorySearchSnippet = { before: '…as the ', hit: 'toves', after: ' were.' };
    const definitions = new Map([['h2', snippet], ['h5', snippet], ['gone', snippet]]);

    const view = searchDictionaryHistory(ENTRIES, 'toves', definitions);

    // h5 matches by its context already; h2 only by its definition.
    expect(view.rows.map(row => row.entry.id)).toEqual(['h5', 'h2']);
    expect(view.rows.map(row => row.snippet)).toEqual([null, snippet]);
    expect(describeDictionaryHistoryMatches(view.rows.length, view.total)).toBe('2 of 5 match');
  });

  it('clips an over-long query to the bound the host uses', () => {
    const bound = DICTIONARY_HISTORY_SEARCH_QUERY_CHARS;
    expect(dictionaryHistorySearchQuery('x'.repeat(bound * 2))).toBe('x'.repeat(bound));
    const entries = [summary('h1', 'tove', { contextPreview: 'x'.repeat(bound) })];
    expect(searchDictionaryHistory(entries, 'x'.repeat(bound * 2)).rows).toHaveLength(1);
  });
});

describe('the word rule is the prior-lookup offer’s (dictionaryPhraseKey)', () => {
  /* Spellings the offer calls the same lookup, and ones it calls different. */
  const SPELLINGS = [
    'slithy', 'Slithy', '  SLITHY  ', 'slithy\ttoves', 'Slithy   Toves', 'slithy toves',
    'one two three four five six', 'one two three four five six seven', 'ONE  two three four five six',
    'mimsy', 'frabjous day'
  ];

  it('finds every recorded word the offer would call the same lookup', () => {
    for (const typed of SPELLINGS) {
      for (const recorded of SPELLINGS) {
        if (dictionaryPhraseKey(typed) === dictionaryPhraseKey(recorded)) {
          expect([typed, recorded, dictionaryHistoryWordMatches(recorded, typed)]).toEqual([typed, recorded, true]);
        }
      }
    }
  });

  it('agrees with findPriorDictionaryLookups over a history', () => {
    const entries = SPELLINGS.map((word, index) => summary(`h${index}`, word));
    for (const typed of SPELLINGS) {
      const offered = findPriorDictionaryLookups(entries, typed, null).map(entry => entry.id);
      const found = new Set(searchDictionaryHistory(entries, typed).rows.map(row => row.entry.id));
      expect(offered.length).toBeGreaterThan(0);
      expect(offered.filter(id => !found.has(id))).toEqual([]);
    }
  });

  it('matches a word exactly when the query’s key stands in the word’s key, accents aside', () => {
    const strip = (value: string): string => value.normalize('NFD').replace(/\p{M}/gu, '');
    const typedQueries = [...SPELLINGS, 'lith', 'thy to', 'six seven', 'two  THREE', 'café', 'cafe', 'day frabjous', ''];
    const recordedWords = [...SPELLINGS, 'café au lait', 'Café society'];
    for (const typed of typedQueries) {
      for (const recorded of recordedWords) {
        const queryKey = strip(dictionaryPhraseKey(typed));
        const expected = queryKey.length > 0 && strip(dictionaryPhraseKey(recorded)).includes(queryKey);
        expect([typed, recorded, dictionaryHistoryWordMatches(recorded, typed)]).toEqual([typed, recorded, expected]);
      }
    }
  });

  it('reads at most the six words the offer reads', () => {
    expect(dictionaryHistoryWordMatches('one two three four five six', 'one two three four five six seven')).toBe(true);
    expect(dictionaryHistoryWordMatches('one two three four five six', 'seven')).toBe(false);
  });
});
